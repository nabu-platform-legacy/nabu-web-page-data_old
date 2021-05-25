if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

Vue.component("data-multi-select-configure", {
	template: "<div/>",
});

// need id field to prevent doubles
// need (optional) value field to extract information
nabu.page.views.data.MultiSelect = Vue.component("data-multi-select", {
	mixins: [nabu.page.views.data.DataCommon],
	template: "#data-multi-select",
	props: {
		field: {
			type: Object,
			required: false
		},
		value: {
			required: false
		}
	},
	data: function() {
		return {
			configuring: false,
			sourceSelected: [],
			targetSelected: [],
			targetRecords: []
		}	
	},
	created: function() {
		var self = this;
		if (!self.cell.state.childCell) {
			Vue.set(self.cell.state, "childCell", JSON.parse(JSON.stringify(self.cell)));
			self.cell.state.childCell.state = {};
		}
		this.normalize(this.cell.state.childCell.state);
		// we want (for all intents and purposes) that the data configuration works upon the child cell, not the cell itself
		//this.cell = this.cell.state.childCell;
		
		//this.create();
		self.normalizeCustom(self.cell.state);
	},
	activate: function(done) {
		this.activate(function() {
			done();
		});
	},
	methods: {
		// standard methods!
		configure: function() {
			this.configuring = true;
		},
		getDisplayOptions: function() {
			return ["data-table", "data-table-list"];
		},
		normalizeCustom: function(state) {
			// always set multiselect
			if (!state.multiselect) {
				Vue.set(state, "multiselect", true);
			}
			if (!state.valueField) {
				Vue.set(state, "valueField", null);
			}
			if (!state.idField) {
				Vue.set(state, "idField", null);
			}
			if (!state.displayType) {
				Vue.set(state, "displayType", null);
			}
		},
		addAll: function() {
			var self = this;
			var available = this.cell.state.idField ? self.targetRecords.map(function(x) { return self.$services.page.getValue(x, self.cell.state.idField) }) : self.targetRecords;
			self.sourceSelected.map(function(x) {
				var match = self.cell.state.idField ? self.$services.page.getValue(x, self.cell.state.idField) : x;
				if (available.indexOf(match) < 0) {
					self.targetRecords.push(x);
				}
			});
			self.sourceSelected.splice(0, self.sourceSelected.length);
		},
		removeAll: function() {
			var self = this;
			self.targetSelected.map(function(x) {
				var index = self.targetRecords.indexOf(x);
				self.targetRecords.splice(index, 1);
			});
			self.targetSelected.splice(0, self.targetSelected.length);
		},
		getValueFields: function() {
			return this.$services.page.getSimpleKeysFor({properties:this.$refs.data.definition});
		}
	},
	watch: {
		targetRecords: function(newValue) {
			if (this.value) {
				if (!this.value[this.field.name]) {
					Vue.set(this.value, this.field.name, []);
				}
				// remove all current
				this.value[this.field.name].splice(0, this.value[this.field.name].length);
				if (newValue && newValue.length) {
					var self = this;
					// add the new
					if (this.cell.state.valueField) {
						nabu.utils.arrays.merge(this.value[this.field.name], newValue.map(function(x) {
							return self.$services.page.getValue(x, self.cell.state.valueField);
						}));
					}
					else {
						nabu.utils.arrays.merge(this.value[this.field.name], newValue);
					}
				}
			}
		}
	}
});