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
		allRecords: {
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
		},
		supportsRecordStyling: {
			type: Boolean,
			required: false,
			default: true
		},
		supportsGlobalStyling: {
			type: Boolean,
			required: false,
			default: false
		},
		supportsFields: {
			type: Boolean,
			required: false,
			default: true
		}
	},
	data: function() {
		return {
			filterState: null,
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
			loadTimer: null,
			lazyPromise: null,
			wizard: "step1",
			offset: 0
		}
	},
	ready: function() {
		this.ready = true;
		if (this.cell.state.array || this.inactive) {
			//this.$emit("input", true);
		}
	},
	watch: {
		watchedArray: function(newValue) {
			this.allRecords.splice(0);
			if (newValue) {
				nabu.utils.arrays.merge(this.allRecords, newValue);
			}
			this.load(this.paging && this.paging.current ? this.paging.current : 0, false);
		}
	},
	computed: {
		filterConfiguration: function() {
			var self = this;
			if (this.cell.state.filterType) {
				// backwards compatibility
				if (this.cell.state.filterType.configure) {
					return this.cell.state.filterType.configure;
				}
				else {
					var filter = nabu.page.providers('data-filter').filter(function(x) {
						return x.component == self.cell.state.filterType;
					})[0];
					return filter && filter.configure ? filter.configure : null;
				}
			}	
		},
		eventFields: function() {
			return this.cell.state.fields.map(function(x, index) {
				return {
					index: index,
					label: x.label
				}
			});
		},
		watchedArray: function() {
			if (this.cell.state.array) {
				var current = this.$services.page.getValue(this.localState, this.cell.state.array);
				if (current == null) {
					current = this.$services.page.getPageInstance(this.page, this).get(this.cell.state.array);
				}
				return current;
			}
			return [];
		},
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
		recordActions: function() {
			return this.actions.filter(function(x) {
				return !x.global && x.field == null;
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
				var arrays = this.$services.page.getArrays(definition);
				if (arrays.length > 0) {
					var childDefinition = this.$services.page.getChildDefinition(definition, arrays[0]);
					if (childDefinition && childDefinition.items && childDefinition.items.properties) {
						nabu.utils.objects.merge(properties, childDefinition.items.properties);
					}
				}
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
				var available = this.$services.page.getAvailableParameters(this.page, this.cell, true);
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
			var self = this;
			return !this.operation || (!this.operation.parameters ? false : this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "limit";
			}).length);
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
					return blacklist.indexOf(self.getFinalName(x)) < 0;
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
			var self = this;
			// the operation must have an input parameter called "orderBy"
			return this.operation && this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "orderBy";
			}).length > 0;
		},
		pageable: function() {
			var self = this;
			// the operation must have an input parameter called "orderBy"
			return this.operation && this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "limit";
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
		getLimitName: function() {
			var self = this;
			var limit = !this.operation || !this.operation.parameters ? null : this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "limit";
			})[0];
			return limit == null ? null : limit.name;
		},
		getOffsetName: function() {
			var self = this;
			var limit = !this.operation || !this.operation.parameters ? null : this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "offset";
			})[0];
			return limit == null ? null : limit.name;
		},
		getOrderByName: function() {
			var self = this;
			var limit = !this.operation || !this.operation.parameters ? null : this.operation.parameters.filter(function(x) {
				return self.getFinalName(x.name) == "orderBy";
			})[0];
			return limit == null ? null : limit.name;
		},
		// when we directly drag a swagger service into an application, the limit is actually under parameters
		// so it becomes "parameter:limit".
		getFinalName: function(param) {
			// if we give the whole document, we just want the name
			if (param && param.name) {
				param = param.name;
			}
			if (!param) {
				return null;
			}
			var parts = param.split(":");
			return parts[parts.length - 1];
		},
		fieldActions: function(field) {
			var index = this.cell.state.fields.indexOf(field);
			return this.cell.state.actions.filter(function(x) {
				return x.field === index;
			});
		},
		generateStub: function() {
			var definition = this.definition;
			if (definition) {
				var self = this;
				for (var i = 0; i < 10; i++) {
					var stub = {};
					Object.keys(definition).forEach(function(key) {
						var value = null;
						if (definition[key].format == "date-time" || definition[key].format == "date") {
							value = new Date();
						}
						else if (definition[key].type == "boolean") {
							value = true;
						}
						else {
							value = "test";
						}
						self.$services.page.setValue(stub, key, value);
					});
					this.records.push(stub);
				}
			}
		},
		getOrderByKeys: function(value) {
			var keys = this.$services.page.getSimpleKeysFor({properties:this.definition});
			if (value && keys.indexOf(value) < 0) {
				keys.unshift(value);
			}
			return keys;
		},
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
				var self = this;
				var pageInstance = self.$services.page.getPageInstance(self.page, self);
				
				// prefill filter value if necessary
				if (this.cell.state.filters && this.filters) {
					this.cell.state.filters.forEach(function(filter) {
						if (self.cell.bindings[filter.name]) {
							self.filters[filter.name] = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[filter.name], self);
						}
					});
				}
				
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
				
				this.cell.state.refreshOn.map(function(x) {
					self.subscriptions.push(pageInstance.subscribe(x, function() {
						// mimic the frontend configuration logic
						if (self.operation != null) {
							self.load(self.paging.current);
						}
						else if (self.cell.state.array != null) {
							self.pushToArray(pageInstance.get(x));
						}
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
				if (this.operation.responses && this.operation.responses["200"]) {
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
						result[action.name] = action.global && (!action.useSelection && !action.useAll)
							//? (self.cell.on ? self.$services.page.instances[self.page.name].getEvents()[self.cell.on] : [])
							? (self.cell.on ? self.cell.on : {})
							: definition;
					});
				}
			}
			else {
				this.cell.state.actions.map(function(action) {
					result[action.name] = action.global && (!action.useSelection && !action.useAll)
						? (self.cell.on ? self.cell.on : {})
						: {properties:self.definition};
				});
			}
			if (this.getCustomEvents) {
				var custom = this.getCustomEvents();
				if (custom) {
					Object.keys(custom).forEach(function(key) {
						result[key] = custom[key];	
					});
				}
			}
			return result;
		},
		buildSimpleToolTip: function(field) {
			var self = this;
			return function(data) {
				var result = data ? data[field] : null;
				if (result && Number(result) == result && result % 1 != 0) {
					result = self.$services.formatter.number(result, 2);
				}
				return result;
			}
		},
		buildToolTip: function(d, field) {
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
		addGlobalStyle: function() {
			if (!this.cell.state.globalStyles) {
				Vue.set(this.cell.state, "globalStyles", []);
			}
			this.cell.state.globalStyles.push({
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
		getLiveFilters: function() {
			var self = this;
			return this.cell.state.filters.map(function(x) {
				// if we have a client side filter, enrich it with the possible values
				if (x && x.name && x.name.indexOf("$client.") == 0) {
					var fieldName = x.name.substring("$client.".length);
					var clone = nabu.utils.objects.clone(x);
					clone.enumerations = self.records.map(function(y) {
						return y[fieldName];
					});
					return clone;
				}
				return x;
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
					pageInstance.emit(action.name, null, true);
				}
			});
			// it is a client side filter
			if (filter.name.indexOf("$client.") == 0) {
				this.records.splice(0);
				nabu.utils.arrays.merge(this.records, this.allRecords.filter(function(x) {
					var matches = true;
					Object.keys(self.filters).forEach(function(filter) {
						// reapply all client filters
						if (filter && filter.indexOf("$client.") == 0) {
							var fieldName = filter.substring("$client.".length);
							if (self.filters[filter] && ("" + x[fieldName]).toLowerCase().indexOf(("" + self.filters[filter]).toLowerCase()) < 0) {
								matches = false;
							}
						}	
					});
					return matches;
				}));
			}
			else {
				// we delay the reload in case of multiple filters firing
				this.delayedLoad();
			}
		},
		clearFilters: function () {
			var self = this;
			this.cell.state.filters.map(function (filter) {
				self.setFilter(filter, null);
			});
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
			if (this.cell.state.allowFrontendFiltering) {
				Object.keys(this.definition).map(function(key) {
					result.push("$client." + key);
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
		select: function(record, skipTrigger, $event) {
			// if you are hovering over an action, you are most likely triggering that, not selecting
			if ((!$event || this.$services.page.isClickable($event.target)) && (!this.actionHovering || skipTrigger)) {
				if (!this.multiselect || !this.cell.state.multiselect) {
					this.selected.splice(0, this.selected.length);
				}
				var index = this.selected.indexOf(record);
				// if we are adding it, send out an event
				if (index < 0) {
					this.selected.push(record);
					if (!skipTrigger) {
						this.trigger(null, record);
					}
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
			// if we are executing a non global action and we have data, select it as well without triggering the select event
			// this is expected behavior as you are clicking on the item
			else if (!action.global && data) {
				this.lastTriggered = data;
				this.select(data, true);
			}
			// if no action is specified, it is the one without the icon and label (and not global)
			// this is row specific (not global) but does not have an actual presence (no icon & label)
			if (!action && !this.actionHovering) {
				// selected events must not be linked to fields
				action = this.cell.state.actions.filter(function(x) {
					return !x.icon && !x.label && !x.global && x.field == null;
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
					else if (action.useAll) {
						data = this.records;
					}
					else {
						data = this.$services.page.getPageInstance(this.page, this).get(this.cell.on);
					}
					if (!data) {
						data = {};
					}
					// if we give a live feed to the array, we can update it remotely
					// we don't actually want this, new items can be retrieved through a refresh, selection is not an external concern
					// the problem we had was feeding an array of parameters into a form with a predefined list of parameters
					// the changes were done right in the records of this data which meant we saw them live while typing (cool!) but they could not be undone on cancel
					if (data instanceof Array) {
						var data = data.map(function(x) {
							return nabu.utils.objects.clone(x);
						});
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
							// TODO: do the delete in the original array as well?
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
			var $services = this.$services;
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
		internalSort: function(key, multiplier, records) {
			if (records == null) {
				records = this.records;
			}
			records.sort(function(a, b) {
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
			var regenerate = function() {
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
			};
			if (array) {
				if (self.cell.state.fields && self.cell.state.fields.length) {
					this.$confirm({
						message: "Regenerate fields?"
					}).then(regenerate);
				}
				else {
					regenerate();
				}
			}
			this.loadArray();
		},
		pushToArray: function(record) {
			if (this.cell.state.array) {
				var current = this.$services.page.getValue(this.localState, this.cell.state.array);
				if (current == null) {
					current = this.$services.page.getPageInstance(this.page, this).get(this.cell.state.array);
				}
				if (current != null) {
					current.push(record);
				}
				// make sure all records stays up to date
				this.allRecords.push(record);
				// if we are using paging, reload current page, it may have changed
				if (this.paging && this.paging.current != null) {
					this.doInternalSort(this.allRecords);
					this.load(this.paging.current);
				}
				else {
					this.records.push(record);
					this.doInternalSort();
				}
			}
		},
		loadArray: function() {
			if (true) {
				this.load();
			}
			else if (this.cell.state.array) {
				var current = this.$services.page.getValue(this.localState, this.cell.state.array);
				if (current == null) {
					current = this.$services.page.getPageInstance(this.page, this).get(this.cell.state.array);
				}
				if (current) {
					this.records.splice(0, this.records.length);
					nabu.utils.arrays.merge(this.records, current);
					nabu.utils.arrays.merge(this.allRecords, current);
				}
				this.doInternalSort();
			}
		},
		doInternalSort: function(records) {
			if (this.orderBy && this.orderBy.length) {
				var field = this.orderBy[0];
				var index = field.indexOf(" desc");
				var multiplier = 1;
				if (index >= 0) {
					multiplier = -1;
					field = field.substring(0, index);
				}
				this.internalSort(field, multiplier, records);
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
				
				var regenerate = function() {
					// we clear out the fields, they are most likely useless with another operation
					self.cell.state.fields.splice(0, self.cell.state.fields.length);
					// instead we add entries for all the fields in the return value
					self.keys.map(function(key) {
						self.cell.state.fields.push({
							// avoid interpretation...
							label: "%" + "{" + self.$services.page.prettify(key) + "}",
							fragments: [{
								type: "data",
								key: key
							}]
						});
					});
				};
				
				if (operationId) {
					if (self.cell.state.fields && self.cell.state.fields.length) {
						this.$confirm({
							message: "Regenerate fields?"
						}).then(regenerate)
					}
					else {
						regenerate();
					}
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
			if (this.filterState == null) {
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
				this.filterState = state;
			}
			// merge the currently set filters
			nabu.utils.objects.merge(this.filterState, this.filters);
			return this.filterState;
		},
		next: function() {
			var increment = 1;
			// suppose page is currently 0, limit is 3
			// we add the increment to the offset which is relative to the currently loaded page
			// we already fetched [page, page+limit]
			// now we fetch [page+limit+offset, page+limit+offset+increment]
			// we add the increment to the offset for next time
			this.offset += increment;
			// we make sure we move the page to match the offset
			while (this.offset >= limit) {
				this.page++;
				this.offset -= limit;
			}
		},
		previous: function() {
			
		},
		getRestParameters: function(page) {
			var parameters = {};
			var self = this;
				
			// we put a best effort limit & offset on there, but the operation might not support it
			// at this point the parameter is simply ignored
			var limit = this.cell.state.limit != null ? parseInt(this.cell.state.limit) : 20;
			
			var limitName = this.getLimitName();
			var offsetName = this.getOffsetName();
			
			if (limitName != null && limit != 0) {
				parameters[limitName] = limit;
			}
			if (offsetName != null) {
				parameters[offsetName] = (page ? page : 0) * limit;
			}
			
			var pageInstance = self.$services.page.getPageInstance(self.page, self);
			// bind additional stuff from the page
			Object.keys(this.cell.bindings).map(function(name) {
				if (self.cell.bindings[name]) {
					var value = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[name], self);
					if (value != null && typeof(value) != "undefined") {
						parameters[name] = value;
					}
				}
			});
			this.cell.state.filters.map(function(filter) {
				parameters[filter.name] = filter.type == 'fixed' ? filter.value : self.filters[filter.name];
				/*if (parameters[filter.name] == null && self.cell.bindings[filter.name]) {
					parameters[filter.name] = self.$services.page.getBindingValue(pageInstance, self.cell.bindings[filter.name], self);
				}*/
			});
			
			if (this.orderable && this.orderBy.length) {
				parameters[this.getOrderByName()] = this.orderBy;
			}
			return parameters;
		},
		// see if we have to lazy load more records
		lazyLoad: function(record) {
			// current is 0-based
			if (this.lazyPromise == null && this.paging && this.cell.state.loadLazy && this.paging.current != null && this.paging.total != null && this.paging.current < this.paging.total - 1) {
				var index = this.records.indexOf(record);
				// if we are in the final 10% of the table, try to load more
				if (index >= Math.floor(this.records.length * 0.9)) {
					this.lazyPromise = this.load(this.paging.current + 1, true);
					var self = this;
					this.lazyPromise.then(function() {
						self.lazyPromise = null;
					}, function() {
						self.lazyPromise = null;
					});
				}
			}
		},
		loadNext: function() {
			this.load(this.paging.current != null ? this.paging.current + 1 : 0);
		},
		loadPrevious: function() {
			this.load(this.paging.current != null ? this.paging.current - 1 : 0);
		},
		// how much to increment by
		load: function(page, append, increment) {
			if (this.refreshTimer) {
				clearTimeout(this.refreshTimer);
				this.refreshTimer = null;
			}
			var promise = this.$services.q.defer();
			var self = this;
			if (this.cell.state.operation) {
				var parameters = this.getRestParameters(page);
				try {
					this.$services.swagger.execute(this.cell.state.operation, parameters).then(function(list) {
						if (!append) {
							self.records.splice(0, self.records.length);
						}
						if (list) {
							var arrayFound = false;
							var findArray = function(root) {
								Object.keys(root).forEach(function(field) {
									if (root[field] instanceof Array && !arrayFound) {
										root[field].forEach(function(x, i) {
											x.$position = i;
										});
										nabu.utils.arrays.merge(self.records, root[field]);
										nabu.utils.arrays.merge(self.allRecords, root[field]);
										arrayFound = true;
									}
									if (!arrayFound && typeof(root[field]) === "object" && root[field] != null) {
										findArray(root[field]);
									}
								});
							}
							findArray(list);
							
							var pageFound = false;
							var findPage = function(root) {
								Object.keys(root).forEach(function(field) {
									// check if we have an object that has the necessary information
									if (typeof(root[field]) === "object" && root[field] != null && !pageFound) {
										// these are the two fields we use and map, check if they exist
										if (root[field].current != null && root[field].total != null) {
											nabu.utils.objects.merge(self.paging, root[field]);
											pageFound = true;
										}
										// recurse
										if (!pageFound) {
											findPage(root[field]);
										}
									}
								});
							}
							findPage(list);
							if (!pageFound && !self.orderable) {
								self.doInternalSort();
							}
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
			else if (this.cell.state.array) {
				var current = this.$services.page.getValue(this.localState, this.cell.state.array);
				if (current == null) {
					current = this.$services.page.getPageInstance(this.page, this).get(this.cell.state.array);
				}
				if (current) {
					if (!append) {
						this.records.splice(0, this.records.length);
					}
					// only reload the data if we have no data as of yet
					// otherwise we might lose state that was added via pushToArray
					if (!this.allRecords.length) {
						nabu.utils.arrays.merge(this.allRecords, current);
					}
					this.doInternalSort(this.allRecords);
					// if we set a limit, only get those records
					if (this.cell.state.limit && this.cell.state.limit != 0) {
						var start = page ? page * parseInt(this.cell.state.limit) : 0;
						var end = start + parseInt(this.cell.state.limit);
						// only add something to records if we are still inside the array
						if (start < this.allRecords.length) {
							end = Math.min(end, this.allRecords.length);
							nabu.utils.arrays.merge(this.records, this.allRecords.slice(start, end));
						}
						this.paging.current = page ? page : 0;
						this.paging.totalRowCount = this.allRecords.length;
						this.paging.pageSize = parseInt(this.cell.state.limit);
						this.paging.rowOffset = start;
						this.paging.total = Math.ceil(this.allRecords.length / parseInt(this.cell.state.limit));
					}
					else {
						nabu.utils.arrays.merge(this.records, this.allRecords);
					}
					promise.resolve();
					//nabu.utils.arrays.merge(this.records, current);
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
	data: function() {
		return {
			isHeader: true
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

Vue.component("data-common-configure", {
	template: "#data-common-configure",
	mixins:[nabu.page.views.data.DataCommon]
});

Vue.component("data-common-prev-next", {
	template: "#data-common-prev-next",
	props: {
		hasNext: {
			type: Boolean,
			required: false
		},
		hasPrevious: {
			type: Boolean,
			required: false
		},
		prevButtonLabel: {
			required: false
		},
		nextButtonLabel: {
			required: false
		}
	}
})

Vue.component("data-common-filter", {
	template: "#data-common-filter",
	props: {
		page: {
			type: Object,
			required: true
		},
		cell: {
			type: Object,
			required: true
		},
		edit: {
			type: Boolean,
			required: true
		},
		filters: {
			type: Array
		},
		orderable: {
			type: Boolean,
			required: false
		},
		state: {
			type: Object,
			required: true
		}
	}
})




