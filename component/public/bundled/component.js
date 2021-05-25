window.addEventListener("load", function() {
	application.bootstrap(function($services) {
		
		var accept = function(type, value) {
			if (type == "operation") {
				return $services.dataUtils.getDataOperations().map(function(x) { return x.id }).indexOf(value) >= 0;
			}
		};
		var initialize = function(type, value, component, cell, row, page) {
			component.updateOperation(value);
			var name = $services.page.guessNameFromOperation(value);
			if (name != null) {
				cell.state.title = $services.page.prettify(name);
			}
			cell.state.filterType = "data-combo-filter";
			cell.state.comboFilter = {
				useTags: true
			}
		};
		
		$services.router.register({
			alias: "data-table",
			enter: function(parameters) {
				return new nabu.page.views.data.Table({propsData:parameters});
			},
			slow: true
		});
		
		$services.router.register({
			alias: "data-table-list",
			icon: "page/data/images/table.svg",
			description: "A tabular view of data",
			name: "Table",
			category: "data",
			accept: accept,
			initialize: function(type, value, component, cell, row, page) {
				// do general initialize
				initialize(type, value, component, cell, row, page);	
				// use native table by default, it deals better with lots of data (which is the default usecase often)
				cell.state.useNativeTable = true;
			},
			enter: function(parameters) {
				return new nabu.page.views.data.TableList({propsData:parameters});
			},
			slow: true
		});
		
		// should be possible but no immediate usecase for it
		// it is exposed as a list handler for forms, that should be enough for now
		/*$services.router.register({
			alias: "data-multi-select",
			enter: function(parameters) {
				return new nabu.page.views.data.MultiSelect({propsData:parameters});
			}
		});*/
		
		$services.router.register({
			alias: "data-donut",
			enter: function(parameters) {
				return new nabu.page.views.data.Donut({propsData:parameters});
			},
			slow: true
		});
		
		$services.router.register({
			alias: "data-gauge",
			enter: function(parameters) {
				return new nabu.page.views.data.Gauge({propsData:parameters});
			},
			slow: true
		});
		
		$services.router.register({
			alias: "data-bar",
			enter: function(parameters) {
				return new nabu.page.views.data.Bar({propsData:parameters});
			},
			slow: true
		});
		
		$services.router.register({
			alias: "data-line",
			enter: function(parameters) {
				return new nabu.page.views.data.Line({propsData:parameters});
			},
			slow: true
		});
		
		$services.router.register({
			alias: "data-card",
			icon: "page/data/images/card.svg",
			description: "Display a list of data records as separate cards",
			category: "data",
			name: "Card",
			accept: accept,
			initialize: function(type, value, component, cell, row, page) {
				initialize(type, value, component, cell, row, page);
				// default show labels
				cell.state.showLabels = true;
				// default we want row view, note that this may no be available in all themes
				// we might remove this in the future, but for now it makes things easier..
				cell.state.class = "row";
			},
			enter: function(parameters) {
				return new nabu.page.views.data.Card({propsData:parameters});
			},
			slow: true
		});
		
		// form list providers
		nabu.page.provide("page-form-list-input", { 
			component: "data-multi-select", 
			configure: "data-multi-select-configure", 
			name: "multi-select",
			namespace: "nabu.page"
		});
	
		return $services.$register({
			dataUtils: nabu.services.DataUtils
		});	
	});
	
	// register data filter provider
	nabu.page.provide("data-filter", { component: "data-filter-default", name: "Default Filter", configure: "data-default-filter-configure" });
	nabu.page.provide("data-filter", { component: "data-combo-filter", name: "Combo Filter", configure: "data-combo-filter-configure" });
});