if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

// because we split up the header, footer and they all extend common
// the first load() is triggered by the main body
// however any loads triggered through searching come from the header!
// could really use a refactor...
nabu.page.views.data.DataCommon = Vue.extend({
	props: {
		page: {
			type: Object,
			required: true
		},
		parameters: {
			type: Object,
			required: false
		},
		cell: {
			type: Object,
			required: true
		},
		edit: {
			type: Boolean,
			required: true
		},
		records: {
			type: Array,
			required: false,
			default: function() { return [] }
		},
		selected: {
			type: Array,
			required: false,
			default: function() { return [] }
		},
		updatable: {
			type: Boolean,
			required: false,
			default: false
		},
		multiselect: {
			type: Boolean,
			required: false,
			default: false
		},
		inactive: {
			type: Boolean,
			required: false,
			default: false
		},
		showEmpty: {
			type: Boolean,
			required: false,
			default: false
		},
		paging: {
			type: Object,
			required: false,
			default: function() { return {} }
		},
		filters: {
			type: Object,
			required: false,
			default: function() { return {} }
		}
	},
	data: function() {
		return {
			actionHovering: false,
			last: null,
			showFilter: false,
			ready: false,
			subscriptions: [],
			lastTriggered: null,
			query: null,
			// the current order by
			orderBy: [],
			refreshTimer: null,
			loadTimer: null
		}
	},
	ready: function() {
		this.ready = true;
		if (this.cell.state.array || this.inactive) {
			//this.$emit("input", true);
		}
	},
	computed: {
		self: function() {
			return this;
		},
		filterable: function() {
			return this.cell.state.filters.length;  
		},
		actions: function() {
			return this.cell.state.actions.filter(function(x) {
				return !x.global && (x.label || x.icon);
			});
		},
		globalActions: function() {
			var self = this;
			var globalActions = this.cell.state.actions.filter(function(x) {
				if (!x.global) {
					return false;
				}
				return !x.condition || self.$services.page.isCondition(x.condition, {records:self.records}, self);
			});
			return globalActions;
		},
		dataClass: function() {
			return this.cell.state.class ? this.cell.state.class : [];        
		},
		operation: function() {
			return this.cell.state.operation ? this.$services.swagger.operations[this.cell.state.operation] : null;
		},
		availableParameters: function() {
			return this.$services.page.getAvailableParameters(this.page, this.cell, true);
		},
		definition: function() {
			var properties = {};
			if (this.operation && this.operation.responses["200"]) {
				var definition = this.$services.swagger.resolve(this.operation.responses["200"].schema);
				//var definition = this.$services.swagger.definition(schema["$ref"]);
				if (definition.properties) {
					var self = this;
					Object.keys(definition.properties).map(function(field) {
						if (definition.properties[field].type == "array") {
							var items = definition.properties[field].items;
							if (items.properties) {
								nabu.utils.objects.merge(properties, items.properties);
							}
						}
					});
				}
			}
			else if (this.cell.state.array) {
				var available = this.$services.page.getAvailableParameters(this.page, this.cell);
				var variable = this.cell.state.array.substring(0, this.cell.state.array.indexOf("."));
				var rest = this.cell.state.array.substring(this.cell.state.array.indexOf(".") + 1);
				if (available[variable]) {
					var childDefinition = this.$services.page.getChildDefinition(available[variable], rest);
					if (childDefinition) {
						nabu.utils.objects.merge(properties, childDefinition.items.properties);
					}
				}
			}
			return properties;
		},
		hasLimit: function() {
			return !this.operation || !this.operation.parameters ? false : this.operation.parameters.filter(function(x) {
				return x.name == "limit";
			}).length;
		},
		// all the actual parameters (apart from the spec-based ones)
		inputParameters: function() {
			var result = {
				properties: {}
			};
			var self = this;
			if (this.operation && this.operation.parameters) {
				var blacklist = ["limit", "offset", "orderBy", "connectionId"];
				var parameters = this.operation.parameters.filter(function(x) {
					return blacklist.indexOf(x.name) < 0;
				}).map(function(x) {
					result.properties[x.name] = self.$services.swagger.resolve(x);
				})
			}
			return result;
		},
		formInputParameters: function() {
			var result = {
				properties: {}
			};
			if (this.cell.state.updateOperation && this.$services.swagger.operations[this.cell.state.updateOperation]) {
				this.$services.swagger.operations[this.cell.state.updateOperation].parameters.filter(function(x) {
					return x.in != "body";
				}).map(function(parameter) {
					result.properties[parameter.name] = parameter;
				});
			}
			return result;
		},
		formAvailableParameters: function() {
			var result = this.$services.page.getAvailableParameters(this.page, this.cell, true);
			result.record = {
				properties: this.definition
			};
			return result;
		},
		keys: function() {
			var keys = this.$services.page.getSimpleKeysFor({properties:this.definition});
			var self = this;
			keys.map(function(key) {
				if (!self.cell.state.result[key]) {
					Vue.set(self.cell.state.result, key, {
						label: null,
						format: null,
						custom: null,
						styles: []
					});
				}
			});
			return keys;
		},
		orderable: function() {
			// the operation must have an input parameter called "orderBy"
			return this.operation && this.operation.parameters.filter(function(x) {
				return x.name == "orderBy";
			}).length > 0;
		},
		pageable: function() {
			// the operation must have an input parameter called "orderBy"
			return this.operation && this.operation.parameters.filter(function(x) {
				return x.name == "limit";
			}).length > 0;
		}
	},
	beforeDestroy: function() {
		this.subscriptions.map(function(x) {
			x();
		});
		if (this.refreshTimer) {
			clearTimeout(this.refreshTimer);
			this.refreshTimer = null;
		}	
	},
	methods: {
		addDownloadListener: function() {
			if (!this.cell.state.downloadOn) {
				Vue.set(this.cell.state, "downloadOn", []);
			}
			this.cell.state.downloadOn.push({
				event: null,
				contentType: null,
				limit: null,
				fileName: null
			});
		},
		getContentTypes: function() {
			return [{
				type: "xml",
				contentType: "application/xml"
			}, {
				type: "json",
				contentType: "application/json"
			}, {
				type: "csv",
				contentType: "text/csv"
			}, {
				type: "xlsx",
				contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
			}]
		},
		isFieldHidden: function(field, record) {
			return !!field.hidden && this.$services.page.isCondition(field.hidden, {record:record}, this);
		},
		isAllFieldHidden: function(field) {
			if (!field.hidden) {
				return false;
			}
			for (var i = 0; i < this.records.length; i++) {
				if (!this.isFieldHidden(field, this.records[i])) {
					return false;
				}
			}
			return true;
		},
		create: function() {
			this.normalize(this.cell.state);
			// merge the configured orderby into the actual
			nabu.utils.arrays.merge(this.orderBy, this.cell.state.orderBy);
		},
		activate: function(done) {
			if (!this.inactive) {
				if (this.cell.state.array) {
					this.loadArray();
					done();
				}
				else {
					var self = this;
					this.load().then(function() {
						done();
					});
				}
				
				var self = this;
				var pageInstance = self.$services.page.getPageInstance(self.page, self);
				this.cell.state.refreshOn.map(function(x) {
					self.subscriptions.push(pageInstance.subscribe(x, function() {
						self.load(self.paging.current);
					}));
				});
				if (this.cell.state.downloadOn) {
					this.cell.state.downloadOn.map(function(x) {
						self.subscriptions.push(pageInstance.subscribe(x.event, function() {
							self.download(x);
						}));
					});
				}
			}
			else {
				done();
			}
		},
		download: function(definition) {
			var fileName = definition.fileName;
			if (!fileName) {
				var contentType = this.getContentTypes().filter(function(x) {
					return x.contentType == definition.contentType;
				})[0];
				fileName = "unnamed";
				if (contentType) {
					fileName += "." + contentType.type;
				}
			}
			var parameters = this.getRestParameters();
			if (definition.limit == 0) {
				delete parameters.limit;
			}
			else if (definition.limit != null) {
				parameters.limit = definition.limit;
			}
			parameters = this.$services.swagger.parameters(this.cell.state.operation, parameters);
			var url = parameters.url;
			if (url.indexOf("?") < 0) {
				url += "?";
			}
			else {
				url += "&";
			}
			url += "header:Accept=" + definition.contentType;
			url += "&header:Accept-Content-Disposition=attachment;filename=\"" + fileName + "\"";
			window.location = url;
		},
		getDataOperations: function(value) {
			return this.$services.dataUtils.getDataOperations(value).map(function(x) { return x.id });	
		},
		getSortKey: function(field) {
			for (var i = 0; i < field.fragments.length; i++) {
				var fragment = field.fragments[i];
				if (fragment.type == "data" && fragment.key) {
					return fragment.key;
				}
				else if (fragment.type == "form" && fragment.form.name) {
					return fragment.form.name;
				}
			}
			return null;
		},
		getEvents: function() {
			var self = this;
			var result = {};
			if (this.operation) {
				var schema = this.operation.responses["200"].schema;
				
				// the return is always a singular object
				var definition = this.$services.swagger.resolve(schema).properties;
				var found = false;
				// we are interested in the (complex) array within this object
				Object.keys(definition).map(function(key) {
					if (!found && definition[key].type == "array" && definition[key].items.properties) {
						definition = definition[key].items;
						found = true;
					}
				});
				if (!found) {
					definition = null;
				}
				this.cell.state.actions.map(function(action) {
					result[action.name] = action.global && !action.useSelection
						//? (self.cell.on ? self.$services.page.instances[self.page.name].getEvents()[self.cell.on] : [])
						? (self.cell.on ? self.cell.on : {})
						: definition;
				});
			}
			else {
				this.cell.state.actions.map(function(action) {
					result[action.name] = action.global && !action.useSelection
						? (self.cell.on ? self.cell.on : {})
						: {properties:self.definition};
				});
			}
			return result;
		},
		buildToolTip: function(d) {
			if (!this.cell.state.fields.length) {
				return null;
			}
			var self = this;
			var component = Vue.extend({
				template: "<page-fields class='data-field' :cell='cell' :label='label' :page='page' :data='record' :should-style='true' :edit='edit'/>",
				data: function() {
					return {
						cell: self.cell,
						page: self.page,
						record: d,
						edit: self.edit,
						label: self.cell.state.showFieldLabels
					}
				}
			});
			return new component();
		},
		getRefreshEvents: function(value) {
			return this.$services.page.getPageInstance(this.page, this).getAvailableEvents();
		},
		getRecordStyles: function(record) {
			var styles = [{'selected': this.selected.indexOf(record) >= 0}];
			nabu.utils.arrays.merge(styles, this.$services.page.getDynamicClasses(this.cell.state.styles, {record:record}, this));
			return styles;
		},
		addRecordStyle: function() {
			this.cell.state.styles.push({
				class: null,
				condition: null
			});
		},
		addStyle: function(key) {
			if (!this.cell.state.result[key].styles) {
				Vue.set(this.cell.state.result[key], "styles", []);
			}
			this.cell.state.result[key].styles.push({
				class:null,
				condition:null
			});
		},
		// standard methods!
		refresh: function() {
			this.load();
		},
		// custom methods
		setFilter: function(filter, newValue) {
			Vue.set(this.filters, filter.name, newValue);
			// if we adjusted the filter, do we want to rescind the selection event we may have sent out?
			var self = this;
			var pageInstance = self.$services.page.getPageInstance(self.page, self);
			this.cell.state.actions.map(function(action) {
				if (action.name && pageInstance.get(action.name)) {
					pageInstance.emit(action.name, null);
				}
			})
			// we delay the reload in case of multiple filters firing
			this.delayedLoad();
		},
		delayedLoad: function() {
			if (this.loadTimer) {
				clearTimeout(this.loadTimer);
				this.loadTimer = null;
			}
			this.loadTimer = setTimeout(this.load, 100);
		},
		setComboFilter: function(value, label) {
			this.setFilter(this.cell.state.filters.filter(function(x) { return x.label == label })[0], value);
		},
		filterCombo: function(value, label) {
			var filter = this.cell.state.filters.filter(function(x) { return x.label == label })[0];
			if (filter.type == 'enumeration') {
				return value ? filter.enumerations.filter(function(x) {
					return x.toLowerCase().indexOf(value.toLowerCase()) >= 0;
				}) : filter.enumerations;
			}
			else {
				this.setComboFilter(value, label);
				return [];
			}
		},
		filtersToAdd: function(ignoreCurrentFilters) {
			var self = this;
			var currentFilters = this.cell.state.filters.map(function(x) {
				return x.name;
			});
			// any input parameters that are not bound
			var result = Object.keys(this.inputParameters.properties);
			if (!ignoreCurrentFilters) {
				result = result.filter(function(key) {
					// must not be bound and not yet a filter
					return !self.cell.bindings[key] && (currentFilters.indexOf(key) < 0 || ignoreCurrentFilters);
				});
			}
			return result;
		},
		addFilter: function() {
			this.cell.state.filters.push({
				field: null,
				label: null,
				type: 'text',
				enumerations: [],
				value: null
			})
		},
		select: function(record) {
			// if you are hovering over an action, you are most likely triggering that, not selecting
			if (!this.actionHovering) {
				if (!this.multiselect || !this.cell.state.multiselect) {
					this.selected.splice(0, this.selected.length);
				}
				var index = this.selected.indexOf(record);
				// if we are adding it, send out an event
				if (index < 0) {
					this.selected.push(record);
					this.trigger(null, record);
				}
				else {
					this.selected.splice(index, 1);
				}
			}
		},
		trigger: function(action, data) {
			if (!action) {
				this.lastTriggered = data;
			}
			// if no action is specified, it is the one without the icon and label (and not global)
			// this is row specific (not global) but does not have an actual presence (no icon & label)
			if (!action && !this.actionHovering) {
				action = this.cell.state.actions.filter(function(x) {
					return !x.icon && !x.label && !x.global;
				})[0];
				if (action && action.condition) {
					// we do want to change the event, just with a null value
					if (!this.$services.page.isCondition(action.condition, {record:data}, this)) {
						data = null;
					}
				}
			}
			if (action) {
				var self = this;
				var pageInstance = self.$services.page.getPageInstance(self.page, self);
				// if there is no data (for a global event) 
				if (action.global) {
					if (action.useSelection) {
						data = this.multiselect && this.cell.state.multiselect && this.selected.length > 1 
							? this.selected
							: (this.selected.length ? this.selected[0] : null);
					}
					else {
						data = this.$services.page.getPageInstance(this.page, this).get(this.cell.on);
					}
					if (!data) {
						data = {};
					}
				}
				if (action.name) {
					return pageInstance.emit(action.name, data).then(function() {
						if (action.refresh) {
							self.load();
						}
						else if (action.close) {
							self.$emit("close");
						}
						else if (action.delete) {
							self.records.splice(self.records.indexOf(data), 1);
						}
					});
				}
				else if (action.close) {
					this.$emit("close");
				}
			}
		},
		getFormOperations: function(name) {
			var self = this;
			return this.$services.page.getOperations(function(operation) {
				// must be a put or post
				return (operation.method.toLowerCase() == "put" || operation.method.toLowerCase() == "post")
					// and contain the name fragment (if any)
					&& (!name || operation.id.toLowerCase().indexOf(name.toLowerCase()) >= 0);
			}).map(function(x) { return x.id });
		},
		normalize: function(state) {
			/*if (!state.transform) {
				Vue.set(state, "transform", null);
			}*/
			if (!state.autoRefresh) {
				Vue.set(state, "autoRefresh", null);
			}
			if (!state.orderBy) {
				Vue.set(state, "orderBy", []);
			}
			if (!state.filterPlaceHolder) {
				Vue.set(state, "filterPlaceHolder", null);
			}
			if (!state.filterType) {
				Vue.set(state, "filterType", null);
			}
			if (!state.title) {
				Vue.set(state, "title", null);
			}
			if (!state.limit) {
				Vue.set(state, "limit", 10);
			}
			// actions you can perform on a single row
			if (!state.actions) {
				Vue.set(state, "actions", []);
			}
			if (!state.filters) {
				Vue.set(state, "filters", []);
			}
			if (!state.fields) {
				Vue.set(state, "fields", []);
			}
			if (!state.updateOperation) {
				Vue.set(state, "updateOperation", null);
			}
			if (!state.updateBindings) {
				Vue.set(state, "updateBindings", {});
			}
			if (!state.multiselect) {
				Vue.set(state, "multiselect", false);
			}
			if (!state.styles) {
				Vue.set(state, "styles", []);
			}
			if (!state.refreshOn) {
				Vue.set(state, "refreshOn", []);
			}
			else {
				var self = this;
				state.filters.map(function(x) {
					Vue.set(self.filters, x.field, null);
				});
			}
			if (!state.showRefresh) {
				Vue.set(state, "showRefresh", false);
			}
			// we add a result entry for each field
			// we can then set formatters for each field
			if (!state.result) {
				Vue.set(state, "result", {});
			}
			Object.keys(this.definition).map(function(key) {
				if (!state.result[key]) {
					Vue.set(state.result, key, {
						label: null,
						format: null,
						custom: null,
						styles: []
					});
				}
			});
			var self = this;
			Object.keys(this.inputParameters).map(function(x) {
				if (!self.cell.bindings[x]) {
					Vue.set(self.cell.bindings, x, null);
				}
			});
		},
		removeAction: function(action) {
			var index = this.cell.state.actions.indexOf(action);
			if (index >= 0) {
				this.cell.state.actions.splice(index, 1);
			}
		},
		getDynamicClasses: function(key, record) {
			// the old way
			if (typeof(key) == "string") {
				var styles = this.cell.state.result[key].styles;
				if (styles) {
					var self = this;
					return styles.filter(function(style) {
						return self.isCondition(style.condition, record, self);
					}).map(function(style) {
						return style.class;
					});
				}
				else {
					return [];
				}
			}
			else {
				
			}
		},
		isCondition: function(condition, record) {
			var state = {
				record: record	
			}
			var result = eval(condition);
			if (result instanceof Function) {
				result = result(state);
			}
			return result == true;
		},
		addAction: function() {
			this.cell.state.actions.push({
				name: "unnamed",
				icon: null,
				class: null,
				label: null,
				condition: null,
				refresh: false,
				global: false,
				close: false,
				type: "button",
				useSelection: false
			});
		},
		upAction: function(action) {
			var index = this.cell.state.actions.indexOf(action);
			if (index > 0) {
				var replacement = this.cell.state.actions[index - 1];
				this.cell.state.actions.splice(index - 1, 1, action);
				this.cell.state.actions.splice(index, 1, replacement);
			}
		},
		downAction: function(action) {
			var index = this.cell.state.actions.indexOf(action);
			if (index < this.cell.state.length - 1) {
				var replacement = this.cell.state.actions[index + 1];
				this.cell.state.actions.splice(index + 1, 1, action);
				this.cell.state.actions.splice(index, 1, replacement);
			}
		},
		sort: function(key) {
			if (key) {
				if (this.orderable) {
					var newOrderBy = [];
					if (this.orderBy.indexOf(key) >= 0) {
						newOrderBy.push(key + " desc");
					}
					else if (this.orderBy.indexOf(key + " desc") >= 0) {
						// do nothing, we want to remove the filter
					}
					else {
						newOrderBy.push(key);
					}
					this.orderBy.splice(0, this.orderBy.length);
					nabu.utils.arrays.merge(this.orderBy, newOrderBy);
					if (this.edit) {
						this.cell.state.orderBy.splice(0, this.cell.state.orderBy.length);
						nabu.utils.arrays.merge(this.cell.state.orderBy, this.orderBy);
					}
					this.load();
				}
				// do a frontend sort (can't do it if paged)
				else if (this.cell.state.array || !this.pageable) {
					var newOrderBy = [];
					var multiplier = 1;
					if (this.orderBy.indexOf(key) >= 0) {
						newOrderBy.push(key + " desc");
						multiplier = -1;
					}
					else if (this.orderBy.indexOf(key + " desc") >= 0) {
						// do nothing, we want to remove the filter
					}
					else {
						newOrderBy.push(key);
					}
					this.orderBy.splice(0, this.orderBy.length);
					nabu.utils.arrays.merge(this.orderBy, newOrderBy);
					if (this.edit) {
						this.cell.state.orderBy.splice(0, this.cell.state.orderBy.length);
						nabu.utils.arrays.merge(this.cell.state.orderBy, this.orderBy);
					}
					if (newOrderBy.length) {
						this.internalSort(key, multiplier);
					}
				}
			}
		},
		internalSort: function(key, multiplier) {
			this.records.sort(function(a, b) {
				var valueA = a[key];
				var valueB = b[key];
				var result = 0;
				if (!valueA && valueB) {
					result = -1;
				}
				else if (valueA && !valueB) {
					result = 1;
				}
				else if (valueA instanceof Date && valueB instanceof Date) {
					result = valueA.getTime() - valueB.getTime();
				}
				else if (typeof(valueA) == "string" || typeof(valueB) == "string") {
					result = valueA.localeCompare(valueB);
				}
				return result * multiplier;
			});
		},
		updateFormOperation: function(operationId) {
			if (this.cell.state["updateOperation"] != operationId) {
				Vue.set(this.cell.state, "updateOperation", operationId);
				var operation = this.$services.swagger.operations[operationId];
				var bindings = {};
				var self = this;
				if (operation.parameters) {
					operation.parameters.map(function(parameter) {
						bindings[parameter.name] = self.cell.state.updateBindings && self.cell.state.updateBindings[parameter.name]
							? self.cell.state.updateBindings[parameter.name]
							: null;
					});
					Vue.set(this.cell.state, "updateBindings", bindings);
				}
			}
		},
		updateArray: function(array) {
			Vue.set(this.cell.state, "array", array);
			Vue.set(this.cell, "bindings", {});
			Vue.set(this.cell, "result", {});
			var self = this;
			if (array) {
				this.$confirm({
					message: "(Re)generate fields?"
				}).then(function() {
					// we clear out the fields, they are most likely useless with another operation
					self.cell.state.fields.splice(0, self.cell.state.fields.length);
					// instead we add entries for all the fields in the return value
					self.keys.map(function(key) {
						self.cell.state.fields.push({
							label: key,
							fragments: [{
								type: "data",
								key: key
							}]
						});
					});
				});
			}
			this.loadArray();
		},
		loadArray: function() {
			if (this.cell.state.array) {
				var current = this.$services.page.getValue(this.localState, this.cell.state.array);
				if (current == null) {
					current = this.$services.page.getPageInstance(this.page, this).get(this.cell.state.array);
				}
				if (current) {
					this.records.splice(0, this.records.length);
					nabu.utils.arrays.merge(this.records, current);
				}
				this.doInternalSort();
			}
		},
		doInternalSort: function() {
			if (this.orderBy && this.orderBy.length) {
				var field = this.orderBy[0];
				var index = field.indexOf(" desc");
				var multiplier = 1;
				if (index >= 0) {
					multiplier = -1;
					field = field.substring(0, index);
				}
				this.internalSort(field, multiplier);
			}
		},
		updateOperation: function(operationId) {
			if (this.cell.state["operation"] != operationId) {
				Vue.set(this.cell.state, "operation", operationId);
				var bindings = {};
				
				if (operationId) {
					var operation = this.$services.swagger.operations[operationId];
					var self = this;
					if (operation.parameters) {
						operation.parameters.map(function(parameter) {
							bindings[parameter.name] = self.cell.bindings && self.cell.bindings[parameter.name]
								? self.cell.bindings[parameter.name]
								: null;
						});
					}
				}
				
				// TODO: is it OK that we simply remove all bindings?
				// is the table the only one who sets bindings here?
				Vue.set(this.cell, "bindings", bindings);
				
				Vue.set(this.cell, "result", {});
				
				if (operationId) {
					this.$confirm({
						message: "(Re)generate fields?"
					}).then(function() {
						// we clear out the fields, they are most likely useless with another operation
						self.cell.state.fields.splice(0, self.cell.state.fields.length);
						// instead we add entries for all the fields in the return value
						self.keys.map(function(key) {
							self.cell.state.fields.push({
								label: key,
								fragments: [{
									type: "data",
									key: key
								}]
							});
						});
					})
				}
				// if there are no parameters required, do an initial load
				if (operationId && !operation.parameters.filter(function(x) { return x.required }).length) {
					this.load();
				}
			}
		},
		update: function(record) {
			var parameters = {};
			var self = this;
			var pageInstance = self.$services.page.getPageInstance(self.page, self);
			Object.keys(this.cell.state.updateBindings).map(function(key) {
				if (self.cell.state.updateBindings[key]) {
					if (self.cell.state.updateBindings[key].indexOf("record.") == 0) {
						parameters[key] = record[self.cell.state.updateBindings[key].substring("record.".length)];
					}
					else {
						parameters[key] = self.$services.page.getBindingValue(pageInstance, self.cell.state.updateBindings[key], self);
					}
				}
			});
			parameters.body = record;
			return this.$services.swagger.execute(this.cell.state.updateOperation, parameters);
		},
		isHidden: function(key) {
			return this.cell.state.result[key] && this.cell.state.result[key].format == "hidden";	
		},
		interpret: function(key, value, record) {
			if (value) {
				var format = this.cell.state.result[key] ? this.cell.state.result[key].format : null;
				if (format == "link") {
					if (value.indexOf("http://") == 0 || value.indexOf("https://") == 0) {
						return "<a target='_blank' href='" + value + "'>" + value.replace(/http[s]*:\/\/([^/]+).*/, "$1") + "</a>";
					}
				}
				else if (format == "dateTime") {
					value = new Date(value).toLocaleString();
				}
				else if (format == "date") {
					value = new Date(value).toLocaleDateString();
				}
				else if (format == "time") {
					value = new Date(value).toLocaleTimeString();
				}
				else if (format == "masterdata") {
					value = this.$services.masterdata.resolve(value);
				}
				else if (format == "custom") {
					value = this.formatCustom(key, value, record);
				}
				else if (typeof(value) == "string") {
					value = value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
						.replace(/\n/g, "<br/>").replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
				}
			}
			return value;
		},
		formatCustom: function(key, value, record) {
			var state = {
				record: record
			}
			if (this.cell.state.result[key].custom) {
				try {
					var result = eval(this.cell.state.result[key].custom);
					if (result instanceof Function) {
						result = result(key, value, state);	
					}
					return result;
				}
				catch (exception) {
					return exception.message;
				}
			}
		},
		getFilterState: function() {
			var state = {};
			if (this.cell.state.filters) {
				var self = this;
				var pageInstance = self.$services.page.getPageInstance(self.page, self);
				this.cell.state.filters.map(function(filter) {
					if (self.cell.bindings[filter.name]) {
						state[filter.name] = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[filter.name], self);
					}
				})
			}
			return state;
		},
		getRestParameters: function(page) {
			var parameters = {};
			var self = this;
				
			// we put a best effort limit & offset on there, but the operation might not support it
			// at this point the parameter is simply ignored
			var limit = this.cell.state.limit != null ? parseInt(this.cell.state.limit) : 20;
			parameters.offset = (page ? page : 0) * limit;
			parameters.limit = limit;
			
			if (parameters.limit == 0) {
				delete parameters.limit;
			}
			
			var pageInstance = self.$services.page.getPageInstance(self.page, self);
			// bind additional stuff from the page
			Object.keys(this.cell.bindings).map(function(name) {
				if (self.cell.bindings[name]) {
					var value = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[name]);
					if (value != null && typeof(value) != "undefined") {
						parameters[name] = value;
					}
				}
			});
			this.cell.state.filters.map(function(filter) {
				parameters[filter.name] = filter.type == 'fixed' ? filter.value : self.filters[filter.name];
				if (parameters[filter.name] == null && self.cell.bindings[filter.name]) {
					parameters[filter.name] = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[filter.name]);
				}
			});
			
			if (this.orderable && this.orderBy.length) {
				parameters.orderBy = this.orderBy;
			}
			return parameters;
		},
		load: function(page) {
			if (this.refreshTimer) {
				clearTimeout(this.refreshTimer);
				this.refreshTimer = null;
			}
			var promise = this.$services.q.defer();
			if (this.cell.state.operation) {
				var self = this;
				var parameters = this.getRestParameters(page);
				try {
					this.$services.swagger.execute(this.cell.state.operation, parameters).then(function(list) {
						self.records.splice(0, self.records.length);
						Object.keys(list).map(function(field) {
							if (list[field] instanceof Array && !self.records.length) {
								nabu.utils.arrays.merge(self.records, list[field]);
							}
						});
						if (list.page) {
							nabu.utils.objects.merge(self.paging, list.page);
						}
						else if (!self.orderable) {
							self.doInternalSort();
						}
						self.last = new Date();
						if (self.cell.state.autoRefresh) {
							self.refreshTimer = setTimeout(function() {
								self.load(page);
							}, self.cell.state.autoRefresh);
						}
						promise.resolve();
					}, function(error) {
						promise.resolve(error);
					});
				}
				catch(error) {
					console.error("Could not run", this.cell.state.operation, error);
					promise.resolve(error);
				}
			}
			else {
				promise.resolve("No operation found");
			}
			return promise;
		}
	}
});

Vue.component("data-common-header", {
	template: "#data-common-header",
	mixins:[nabu.page.views.data.DataCommon],
	props: {
		configuring: {
			type: Boolean,
			required: true
		}
	},
	created: function() {
		this.create();
	}
});

Vue.component("data-common-footer", {
	template: "#data-common-footer",
	mixins:[nabu.page.views.data.DataCommon],
	/*props: {
		globalActions: {
			type: Array,
			required: false
		}
	}*/
});
