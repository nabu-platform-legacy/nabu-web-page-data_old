nabu.services.VueService(Vue.extend({
	services: ["swagger"],
	methods: {
		watchValue: function(original, labelFormat, svg, i) {
			var self = this;
			if (labelFormat.format == "masterdata") {
				var unwatch2 = self.$services.masterdata.$watch("masterdata.resolved." + original + ".label", function(newVal, oldVal) {
					var value = self.$services.formatter.format(original, labelFormat);
					if (value) {
						svg.select("[label-index=\"" + i + "\"]").html(value);
						unwatch2();
					}
				});
			}
			else if (labelFormat.format == "resolve") {
				var key = labelFormat.resolveOperation + "." + labelFormat.resolveOperationIds;
				var unwatch = self.$services.pageResolver.$watch("resolved." + key + "." + original, function(newVal, oldVal) {
					var value = self.$services.formatter.format(original, labelFormat);
					if (value) {
						svg.select("[label-index=\"" + i + "\"]").html(value);
						unwatch();
					}
				}); //{ deep: true, immediate: true }
			}	
		},
		getOperations: function(accept) {
			var result = [];
			var operations = this.$services.swagger.operations;
			Object.keys(operations).map(function(operationId) {
				if (accept(operations[operationId])) {
					result.push(operations[operationId]);
				}
			});
			result.sort(function(a, b) {
				return a.id.localeCompare(b.id);
			});
			return result;
		},
		getDataOperations: function(name) {
			var self = this;
			return this.getOperations(function(operation) {
				// must be a get
				var isAllowed = operation.method.toLowerCase() == "get"
					// and contain the name fragment (if any)
					&& (!name || operation.id.toLowerCase().indexOf(name.toLowerCase()) >= 0)
					// must have _a_ response
					&& operation.responses["200"];
				// we also need at least _a_ complex array in the results
				if (isAllowed && operation.responses["200"] != null && operation.responses["200"].schema != null) {
					var schema = operation.responses["200"].schema;
					if (!schema["$ref"]) {
						isAllowed = false;
					}
					else {
						var definition = self.$services.swagger.resolve(schema["$ref"]);
						return self.$services.page.getArrays(definition).length > 0;
						/*isAllowed = false;
						if (definition.properties) {
							Object.keys(definition.properties).map(function(field) {
								if (definition.properties[field].type == "array") {
									isAllowed = true;
								}
							});
						}*/
					}
				}
				return isAllowed;
			});
		},
		buildStandardD3Tooltip: function(data, i, builder) {
			var x = d3.event.pageX;
			var y = d3.event.pageY;
			var div = document.createElement("div");
			var result = builder(data);
			if (result) {
				// add 10 pixels to prevent blinking
				div.setAttribute("style", "position:absolute;top:" + (y+10) + "px;left:" + (x+10) + "px");
				div.setAttribute("class", "d3-tooltip");
				document.body.appendChild(div);
				if (result.$mount) {
					result.$mount().$appendTo(div);
				}
				else {
					if (Number(result) == result && result % 1 != 0) {
						result = this.$services.formatter.number(result, 2);
					}
					div.innerHTML = result;
				}
			}
			return div;
		},
		removeStandardD3Tooltip: function() {
			var elements = document.body.querySelectorAll(".d3-tooltip");
			if (elements.length) {
				for (var i = elements.length - 1; i >= 0; i--) {
					elements[i].parentNode.removeChild(elements[i]);
				}
			}
		},
		extractValues: function(cell, records) {
			var zValues = [];
			var xValues = [];
			var yValues = [];
			// we use getTime() for dates
			var xDateValues = [];
			var minY = Number.MAX_VALUE;
			var maxY = null;
			var self = this;
			records.map(function(record, i) {
				if (cell.state.z) {
					var z = self.$services.page.getValue(record, cell.state.z);
					if (zValues.indexOf(z) < 0) {
						zValues.push(z);
					}
				}
				if (cell.state.x) {
					var x = self.$services.page.getValue(record, cell.state.x);
					if (x instanceof Date && xDateValues.indexOf(x.getTime()) < 0) {
						xValues.push(x);
						yValues.push(0);
						xDateValues.push(x.getTime());
					}
					else if (!(x instanceof Date) && xValues.indexOf(x) < 0) {
						xValues.push(x);
						yValues.push(0);
					}
				}
				else {
					xValues.push(i);
				}
				var y = self.$services.page.getValue(record, cell.state.y);
				if (minY == null || y < minY) {
					minY = y;
				}
				if (maxY == null || y > maxY) {
					maxY = y;
				}
				if (cell.state.x) {
					yValues[xValues.indexOf(self.$services.page.getValue(record, cell.state.x))] += y;
				}
				else {
					yValues.push(y);
				}
			});
			
			if (cell.state.sortBy) {
				var combined = xValues.map(function(x, i) {
					return {
						x: x,
						y: yValues[i]
					}
				});
				combined.sort(function(a, b) {
					var value1 = a[cell.state.sortBy == 'x' ? 'x' : 'y'];
					var value2 = b[cell.state.sortBy == 'x' ? 'x' : 'y'];
					var comparison;
					if (typeof(value1) == "string" && typeof(value2) == "string" && value1.match(/[0-9.-]+/) && value2.match(/[0-9.-]+/)) {
						comparison = parseFloat(value1) - parseFloat(value2);
					}
					else if (typeof(value1) == "string") {
						comparison = value1.localeCompare(value2);
					}
					else if (value1 instanceof Date) {
						comparison = value1.getTime() - value2.getTime();
					}
					else {
						comparison = value1 - value2;
					}
					if (cell.state.reverseSortBy) {
						comparison *= -1;
					}
					return comparison;
				});
				xValues = combined.map(function(a) { return a.x });
				yValues = combined.map(function(a) { return a.y });
			}
			
			// calculate the range of the Y-axis
			//var maxY = d3.max(yValues);
			
			// changed @2019-01-25: if a zvalue is non-existent, it will throw an exception in barchart line 167: self.$services.page.setValue(single, self.$services.page.getValue(record, self.cell.state.z), self.$services.page.getValue(record, self.cell.state.y));
			zValues = zValues.filter(function(x) { return x != null });
			
			return {
				xValues: xValues,
				yValues: yValues,
				zValues: zValues,
				minY: minY,
				maxY: maxY
			};
		}
	}
}), { name: "nabu.services.DataUtils" });