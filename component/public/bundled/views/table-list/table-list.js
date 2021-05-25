if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

nabu.page.views.data.TableListGenerator = function(name) { return Vue.component(name, {
	mixins: [nabu.page.views.data.DataCommon],
	template: "#" + name,
	data: function() {
		return {
			configuring: false,
			hiddenColNames: []
		}
	},
	activate: function(done) {
		this.activate(done);
	},
	created: function() {
		this.create();
	},
	methods: {
		addDevice: function(field) {
			if (!field.devices) {
				Vue.set(field, "devices", []);
			}
			field.devices.push({name: null, operator: '>='});
		},
		isAllowedDevice: function(field) {
			return !field.devices || field.devices.length == 0 || this.$services.page.isDevice(field.devices);
		},
		configure: function() {
			this.configuring = true;
		},
		configurator: function() {
			return "data-table-list-configure"
		},
		addTopHeaderField: function() {
			if (!this.cell.state.topHeaders) {
				Vue.set(this.cell.state, "topHeaders", []);
			}
			this.cell.state.topHeaders.push({
				label: null,
				subheaders: [],
				colspan: null,
				styles: []
			});
		},
		addSubheader: function(field) {
			field.subheaders.push(null);
		},
		addStyle: function(field) {
			field.styles.push({
				class: null,
				condition: null
			});
		},
		fieldUp: function(field) {
			var index = this.cell.state.topHeaders.indexOf(field);
			if (index > 0) {
				var replacement = this.cell.state.topHeaders[index - 1];
				this.cell.state.topHeaders.splice(index - 1, 1, field);
				this.cell.state.topHeaders.splice(index, 1, replacement);
			}
		},
		fieldDown: function(field) {
			var index = this.cell.state.topHeaders.indexOf(field);
			if (index < this.cell.state.topHeaders.length - 1) {
				var replacement = this.cell.state.topHeaders[index + 1];
				this.cell.state.topHeaders.splice(index + 1, 1, field);
				this.cell.state.topHeaders.splice(index, 1, replacement);
			}
		},
		fieldBeginning: function(field) {
			var index = this.cell.state.topHeaders.indexOf(field);
			if (index > 0) {
				this.cell.state.topHeaders.splice(index, 1);
				this.cell.state.topHeaders.unshift(field);
			}
		},
		fieldEnd: function(field) {
			var index = this.cell.state.topHeaders.indexOf(field);
			if (index < this.cell.state.topHeaders.length - 1) {
				this.cell.state.topHeaders.splice(index, 1);
				this.cell.state.topHeaders.push(field);
			}
		},
		calculateColspan: function(field) {
			var self = this;
			if (field.subheaders != null && this.cell.state.hideEmptyColumns) {
				var result = field.subheaders.filter(function(subheader) {
					return !self.isAllFieldHidden(self.cell.state.fields[subheader]) && self.isAllowedDevice(self.cell.state.fields[subheader]);
				});
				field.colspan = result.length;
			}
			else if (field.subheaders != null) {
				field.colspan = field.subheaders.length;
			}
			else {
				field.colspan = 1;	
			}
			return field.colspan
		},
		subheadersHidden: function(field) {
			var self = this;
			if (field.subheaders != null && field.subheaders.length > 1) {
				var result = field.subheaders.filter(function(subheader) {
					return !self.isAllFieldHidden(self.cell.state.fields[subheader]) && self.isAllowedDevice(self.cell.state.fields[subheader]);
				});
				return result.length == 0;
			}
			else {
				return false;
			}
		}
	}
});}

nabu.page.views.data.TableList = nabu.page.views.data.TableListGenerator("data-table-list");
nabu.page.views.data.TableListGenerator("data-table-list-configure");