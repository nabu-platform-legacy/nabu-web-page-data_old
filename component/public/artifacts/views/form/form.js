if (!nabu) { var nabu = {} };
if (!nabu.views) { nabu.views = {} };
if (!nabu.views.dashboard) { nabu.views.dashboard = {} };

/*
TODO:

- can add support for bound input for enumerations, for example could pass in a contextual id to further limit relevant choices
	- then we have to choose the field you use to bind "q" input to as there are multiple inputs

deprecated! moved to main component for better reuse
*/

nabu.views.dashboard.Form = Vue.extend({
	template: "#dashboard-form",
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
		}
	},
	data: function() {
		return {
			configuring: false,
			result: {}
		}
	},
	computed: {
		operation: function() {
			return this.cell.state.operation ? this.$services.swagger.operations[this.cell.state.operation] : null;
		},
		body: function() {
			var operation = this.$services.swagger.operations[this.cell.state.operation];
			if (operation) {
				var self = this;
				for (var i = 0; i < operation.parameters.length; i++) {
					var parameter = operation.parameters[i];
					if (parameter.in == "body") {
						return self.$services.swagger.resolve(parameter);
					}
				};
			}
			return {};
		},
		availableParameters: function() {
			var parameters = this.$services.page.instances[this.page.name].availableParameters;
			var result = {};
			result.page = parameters.page;
			if (this.cell.on) {
				result[this.cell.on] = parameters[this.cell.on];
			}
			return result;
		},
		fieldsToAdd: function() {
			var fields = [];
			var self = this;
			Object.keys(this.cell.bindings).map(function(key) {
				// can bind a value that is bound, to update!
			//	if (!self.cell.bindings[key]) {
					fields.push(key);
			//	}
			});
			return fields;
		},
		events: function() {
			var result = {};
			if (this.operation && this.cell.state.event) {
				var parameters = [];
				var schema = this.operation.responses["200"] ? this.operation.responses["200"].schema : null;
				if (schema) {
					var definition = this.$services.swagger.definition(schema["$ref"]);
					Object.keys(definition.properties).map(function(key) {
						parameters.push(key);
						// TODO: we have more metadata about the field here, might want to pass it along?
					});
				}
				result[this.cell.state.event] = parameters;
			}
			return result;
		}
	},
	created: function() {
		this.normalize(this.cell.state);
		
		var self = this;
		var pageInstance = this.$services.page.instances[this.page.name];
		if (this.cell.bindings) {
			Object.keys(this.cell.bindings).map(function(key) {
				if (self.cell.bindings[key]) {
					self.result[key] = pageInstance.get(self.cell.bindings[key]);
				}
			});
		}
	},
	methods: {
		configure: function() {
			this.configuring = true;	
		},
		normalize: function(state) {
			if (!state.title) {
				Vue.set(state, "title", null);
			}
			if (!state.immediate) {
				Vue.set(state, "immediate", false);
			}
			if (!state.fields) {
				Vue.set(state, "fields", []);
			}
			if (!state.class) {
				Vue.set(state, "class", "layout2");
			}
			if (!state.ok) {
				Vue.set(state, "ok", "Ok");
			}
			if (!state.cancel) {
				Vue.set(state, "cancel", "Cancel");
			}
			if (!state.event) {
				Vue.set(state, "event", null);
			}
			if (!state.synchronize) {
				Vue.set(state, "synchronize", false);
			}
		},
		getOperations: function() {
			var self = this;
			return this.$services.dashboard.getOperations(function(operation) {
				// must be a put or post
				return (operation.method.toLowerCase() == "put" || operation.method.toLowerCase() == "post")
					// and contain the name fragment (if any)
					&& (!name || operation.id.toLowerCase().indexOf(name.toLowerCase()) >= 0);
			});
		},
		getField: function(name) {
			return this.cell.state.fields.filter(function(x) {
				return x.name == name;
			})[0];
		},
		updateOperation: function(operation) {
			this.cell.state.operation = operation.id;
			var bindings = {};
			if (operation.parameters) {
				var self = this;
				operation.parameters.map(function(parameter) {
					if (parameter.in == "body") {
						var type = self.$services.swagger.resolve(parameter);
						if (type.schema.properties) {
							Object.keys(type.schema.properties).map(function(key) {
								// 1-level recursion (currently)
								// always add the element itself if it is a list (need to be able to add/remove it)
								if (type.schema.properties[key].type != "object") {
									var newKey = "body." + key;
									bindings[newKey] = self.cell.bindings && self.cell.bindings[newKey]
										? self.cell.bindings[newKey]
										: null;
								}
								if (type.schema.properties[key].type == "object" || type.schema.properties[key].type == "array") {
									var properties = type.schema.properties[key].type == "array" ? type.schema.properties[key].items.properties : type.schema.properties[key].properties;
									Object.keys(properties).map(function(key2) {
										var newKey = "body." + key + "." + key2;
										bindings[newKey] = self.cell.bindings && self.cell.bindings[newKey]
											? self.cell.bindings[newKey]
											: null;	
									});
								}
							});
						}
					}
					else {
						bindings[parameter.name] = self.cell.bindings && self.cell.bindings[parameter.name]
							? self.cell.bindings[parameter.name]
							: null;
					}
				});
			}
			// TODO: is it OK that we simply remove all bindings?
			// is the table the only one who sets bindings here?
			Vue.set(this.cell, "bindings", bindings);
		},
		getSchemaFor: function(field) {
			if (!field) {
				return null;
			}
			var operation = this.$services.swagger.operations[this.cell.state.operation];
			var result = null;
			if (operation) {
				var self = this;
				// body parameter
				if (field.indexOf("body.") == 0) {
					var recursiveGet = function(schema, parts, index) {
						if (schema.items) {
							schema = schema.items;
						}
						var properties = schema.properties;
						if (properties && properties[parts[index]]) {
							if (index < parts.length - 1) {
								return recursiveGet(properties[parts[index]], parts, index + 1);
							}
							else {
								var result = properties[parts[index]];
								result.required = schema.required && schema.required.indexOf(parts[index]) >= 0;
								return result;
							}
						}
					}
					var body = this.body;
					var parts = field.substring("body.".length).split(".");
					result = body.schema ? recursiveGet(body.schema, parts, 0) : null;
				}
				// non-body parameter
				else {
					for (var i = 0; i < operation.parameters.length; i++) {
						var parameter = operation.parameters[i];
						if (parameter.in != "body") {
							result = parameter;
						}
					};
				}
			}
			return result;
		},
		isList: function(field) {
			var field = this.getSchemaFor(field);
			return field && field.type == "array";
		},
		isPartOfList: function(field) {
			// only things in the body can be a list (?)
			if (!field || field.indexOf("body.") != 0) {
				return false;
			}
			var parts = field.substring("body.".length).split(".");
			var schema = this.body.schema;
			for (var i = 0; i < parts.length - 1; i++) {
				if (schema.items) {
					schema = schema.items;
				}
				schema = schema.properties[parts[i]];
				if (schema && schema.type == "array") {
					return true;	
				}
			}
			return false;
		},
		// copy/pasted from the table getOperations
		getEnumerationServices: function() {
			var self = this;
			return this.$services.dashboard.getOperations(function(operation) {
				// must be a get
				var isAllowed = operation.method.toLowerCase() == "get"
					// and contain the name fragment (if any)
					&& (!name || operation.id.toLowerCase().indexOf(name.toLowerCase()) >= 0)
					// must have _a_ response
					&& operation.responses["200"];
				// we also need at least _a_ complex array in the results
				if (isAllowed) {
					var schema = operation.responses["200"].schema;
					var definition = self.$services.swagger.definition(schema["$ref"]);
					// now we need a child in the definition that is a record array
					// TODO: we currently don't actually check for a complex array, just any array, could be an array of strings...
					isAllowed = false;
					if (definition.properties) {
						Object.keys(definition.properties).map(function(field) {
							if (definition.properties[field].type == "array") {
								isAllowed = true;
							}
						});
					}
				}
				return isAllowed;
			});	
		},
		getEnumerationFields: function(operationId) {
			var fields = [];
			var resolved = this.$services.swagger.resolve(this.$services.swagger.operations[operationId].responses["200"]);
			Object.keys(resolved.schema.properties).map(function(property) {
				if (resolved.schema.properties[property].type == "array") {
					nabu.utils.arrays.merge(fields, Object.keys(resolved.schema.properties[property].items.properties));
				}
			});
			return fields;
		},
		getEnumerationParameters: function(operationId) {
			var parameters = this.$services.swagger.operations[operationId].parameters;
			return parameters ? parameters.map(function(x) { return x.name }) : [];
		},
		addField: function() {
			this.cell.state.fields.push({
				name: null,
				label: null,
				description: null,
				type: 'text',
				enumerations: [],
				value: null,
				enumerationOperation: null,
				enumerationOperationLabel: null,
				enumerationOperationValue: null,
				enumerationOperationQuery: null
			})
		},
		addInstanceOfField: function(field) {
			if (!this.result[field.name]) {
				Vue.set(this.result, field.name, []);
			}
			var schema = this.getSchemaFor(field.name);
			if (schema.items) {
				schema = schema.items;
			}
			var result = {};
			Object.keys(schema.properties).map(function(key) {
				result[key] = null;
			});
			this.result[field.name].push(result);
		},
		createResult: function() {
			var result = this.result;
			var transformed = {};
			Object.keys(result).map(function(name) {
				var parts = name.split(".");
				var tmp = transformed;
				for (var i = 0; i < parts.length - 1; i++) {
					if (!tmp[parts[i]]) {
						Vue.set(tmp, parts[i], {});
					}
					tmp = tmp[parts[i]];
				}
				Vue.set(tmp, parts[parts.length - 1], result[name]);	
			});
			var self = this;
			var pageInstance = this.$services.page.instances[this.page.name];
			// bind additional stuff from the page
			Object.keys(this.cell.bindings).map(function(name) {
				// don't overwrite manually set values
				if (self.cell.bindings[name] && !transformed[name]) {
					transformed[name] = pageInstance.get(self.cell.bindings[name]);
				}
			});
			return transformed;
		},
		changed: function() {
			if (this.cell.state.immediate) {
				this.doIt();
			}	
		},
		doIt: function() {
			var messages = this.$refs.form.validate();
			if (!messages.length) {
				// commit the form
				// refresh things that are necessary
				// send out event! > can use this to refresh stuff!
				// globale parameters that we can pass along
				var self = this;
				var result = this.createResult();
				this.$services.swagger.execute(this.cell.state.operation, result).then(function(returnValue) {
					var pageInstance = self.$services.page.instances[self.page.name];
					// if we want to synchronize the values, do so
					if (self.cell.state.synchronize) {
						Object.keys(self.cell.bindings).map(function(name) {
							pageInstance.set(self.cell.bindings[name], result[name]);
						});
					}
					if (self.cell.state.event) {
						pageInstance.emit(self.cell.state.event, returnValue);
					}
					self.$emit("close");
				}, function(error) {
					self.error = "Form submission failed";
				});
			}
		},
		up: function(field) {
			var index = this.cell.state.fields.indexOf(field);
			if (index > 0) {
				var replacement = this.cell.state.fields[index - 1];
				this.cell.state.fields.splice(index - 1, 1, this.cell.state.fields[index]);
				this.cell.state.fields.splice(index, 1, replacement);
			}
		},
		down: function(field) {
			var index = this.cell.state.fields.indexOf(field);
			if (index < this.cell.state.fields.length - 1) {
				var replacement = this.cell.state.fields[index + 1];
				this.cell.state.fields.splice(index + 1, 1, this.cell.state.fields[index]);
				this.cell.state.fields.splice(index, 1, replacement);
			}
		}
	}
});

Vue.component("n-dashboard-form-field", {
	template: "#dashboard-form-field",
	props: {
		schema: {
			type: Object,
			required: false
		},
		field: {
			type: Object,
			required: true
		},
		value: {
			required: true
		}
	},
	created: function() {
		// if it is a fixed field, just emit the value
		if (this.field.fixed) {
			this.$emit("input", this.field.value);
		}
	},
	// mostly a copy paste from form-section
	data: function() {
		return {
			labels: [],
			currentEnumerationValue: null
		}
	},
	computed: {
		definition: function() {
			return nabu.utils.vue.form.definition(this);
		},
		mandatory: function() {
			return nabu.utils.vue.form.mandatory(this);
		}
	},
	methods: {
		filterEnumeration: function(value) {
			var parameters = {};
			if (this.field.enumerationOperationQuery) {
				parameters[this.field.enumerationOperationQuery] = value;
			}
			return this.$services.swagger.execute(this.field.enumerationOperation, parameters, function(response) {
				var result = null;
				if (response) {
					Object.keys(response).map(function(key) {
						if (response[key] instanceof Array) {
							result = response[key];
						}
					});
				}
				return result;
			});
		},
		validate: function(soft) {
			var messages = nabu.utils.vue.form.validateChildren(this, soft);
			if (this.validator) {
				var additional = this.validator(this.value);
				if (additional && additional.length) {
					for (var i = 0; i < additional.length; i++) {
						additional[i].component = this;
						if (typeof(additional[i].context) == "undefined") {
							additional[i].context = [];
						}
						messages.push(additional[i]);
					}
				}
			}
			return messages;
		}
	},
	events: {
		'$vue.child.added': function(child) {
			if (child.label) {
				// we pass in the entire component because we are interested in the "hide" property it may have
				// if we simply pass in the hide, it doesn't work...
				this.labels.push({ 
					name: child.label,
					component: child
				});
			}
			else if (!this.labels.length && child.labels) {
				nabu.utils.arrays.merge(this.labels, child.labels);
			}
			else {
				this.labels.push(null);
			}
		}
	},
	watch: {
		currentEnumerationValue: function(newValue) {
			this.$emit('input', this.field.enumerationOperationValue ? newValue[this.field.enumerationOperationValue] : newValue);
		}
	}
});

Vue.component("nabu-form-configure", {
	template: "#dashboard-form-configure",
	props: {
		title: {
			type: String,
			required: true
		},
		// string list of field names
		possibleFields: {
			type: Array,
			required: true
		},
		// field values
		fields: {
			type: Array,
			required: true
		},
		isList: {
			type: Function,
			required: false
		}
	},
	methods: {
		up: function(field) {
			var index = this.fields.indexOf(field);
			if (index > 0) {
				var replacement = this.fields[index - 1];
				this.fields.splice(index - 1, 1, this.fields[index]);
				this.fields.splice(index, 1, replacement);
			}
		},
		down: function(field) {
			var index = this.fields.indexOf(field);
			if (index < this.fields.length - 1) {
				var replacement = this.fields[index + 1];
				this.fields.splice(index + 1, 1, this.fields[index]);
				this.fields.splice(index, 1, replacement);
			}
		},
		addField: function() {
			this.fields.push({
				name: null,
				label: null,
				description: null,
				type: 'text',
				enumerations: [],
				value: null,
				enumerationOperation: null,
				enumerationOperationLabel: null,
				enumerationOperationValue: null,
				enumerationOperationQuery: null
			})
		}
	}
});

Vue.component("nabu-form-configure-single", {
	template: "#dashboard-form-configure-single",
	props: {
		field: {
			type: Object,
			required: true
		},
		allowLabel: {
			type: Boolean,
			required: false,
			default: true
		},
		allowDescription: {
			type: Boolean,
			required: false,
			default: true
		}
	},
	created: function() {
		this.normalize(this.field);
	},
	methods: {
		normalize: function(field) {
			if (!field.name) {
				Vue.set(field, "name", null);
			}
			if (!field.label) {
				Vue.set(field, "label", null);
			}
			if (!field.description) {
				Vue.set(field, "description", null);
			}
			if (!field.type) {
				Vue.set(field, "type", "text");
			}
			if (!field.enumerations) {
				Vue.set(field, "enumerations", []);
			}
			if (!field.value) {
				Vue.set(field, "value", null);
			}
			if (!field.enumerationOperation) {
				Vue.set(field, "enumerationOperation", null);
			}
			if (!field.enumerationOperationLabel) {
				Vue.set(field, "enumerationOperationLabel", null);
			}
			if (!field.enumerationOperationValue) {
				Vue.set(field, "enumerationOperationValue", null);
			}
			if (!field.enumerationOperationQuery) {
				Vue.set(field, "enumerationOperationQuery", null);
			}
		}
	}
});