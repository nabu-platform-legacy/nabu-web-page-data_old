if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

nabu.page.views.data.Table = Vue.extend({
	mixins: [nabu.page.views.data.DataCommon],
	template: "#data-table",
	data: function() {
		return {
			configuring: false
		}
	},
	created: function() {
		this.create();
	},
	activate: function(done) {
		this.activate(done);
	},
	methods: {
		configure: function() {
			this.configuring = true;	
		}
	}
});