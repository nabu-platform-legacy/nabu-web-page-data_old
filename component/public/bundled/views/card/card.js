if (!nabu) { var nabu = {} }
if (!nabu.page) { nabu.page = {} }
if (!nabu.page.views) { nabu.page.views = {} }
if (!nabu.page.views.data) { nabu.page.views.data = {} }

nabu.page.views.data.CardGenerator = function(name) {
	return Vue.component(name, {
		template: "#" + name,
		mixins: [nabu.page.views.data.DataCommon],
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
			configurator: function() {
				return "data-card-configure";
			}
		}
	});
};

nabu.page.views.data.Card = nabu.page.views.data.CardGenerator("data-card");
nabu.page.views.data.TableListGenerator("data-card-configure");