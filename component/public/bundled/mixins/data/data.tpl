<template id="data-common-configure">
	<div class="data-common-configure">
		<n-form class="layout2">
			<n-collapsible title="Data Settings" class="padded">
				<h2>Data<span class="subscript">Determine where you will get your data from</span></h2>
				<n-form-combo label="Operation" :value="cell.state.operation" 
					:filter="getDataOperations"
					@input="updateOperation"
					v-if="!cell.state.array && !cell.state.collect"/>
				<n-form-combo label="Array" :value="cell.state.array"
					:filter="function(value) { return $services.page.getAllArrays(page, cell.id) }"
					v-if="!cell.state.operation && !cell.state.collect"
					@input="updateArray"/>
				<n-form-combo label="Collect" :value="cell.state.collect"
					:filter="function(value) { return $services.page.getAllArrays(page, cell.id) }"
					v-if="false && !cell.state.operation && !cell.state.array"
					@input="updateCollect"/>
				<n-form-text v-if="cell.state.operation" v-model="cell.state.autoRefresh" label="Auto-refresh" info="If you want to automatically refresh the data, fill in the number of ms after which it will be refreshed"/>
				<n-form-text v-model="cell.state.limit" v-if="hasLimit" label="Limit" :timeout="600" @input="load()" info="How many items do you want to load at once?"/>
				<n-form-text v-model="cell.state.windowIncrement" label="Window Increment" :timeout="600" @input="load()" info="For windowed data lists, the limit determines how many items are on screen while the window increment determines how much you move by each time"/>   
				<n-form-switch v-if="!cell.state.loadMore && !cell.state.loadPrevNext && hasLimit" v-model="cell.state.loadLazy" label="Lazy Loading"/> 
				<n-form-switch v-if="!cell.state.loadLazy && !cell.state.loadPrevNext && hasLimit" v-model="cell.state.loadMore" label="Load more button"/>
				<n-form-switch v-if="!cell.state.loadMore && !cell.state.loadLazy && hasLimit" v-model="cell.state.loadPrevNext" label="Load next/prev"/> 
				<n-form-text v-model="cell.state.prevButtonLabel" label="Label previous button" v-if="cell.state.loadPrevNext"/>
				<n-form-text v-model="cell.state.nextButtonLabel" label="Label next button" v-if="cell.state.loadPrevNext"/>
				<slot name="main-settings"></slot>
				<h2>Additional<span class="subscript">Configure some additional data properties.</span></h2>
				<n-form-text v-model="cell.state.title" label="Title" info="The title for this data component"/>
				<n-form-text v-model="cell.state.emptyPlaceholder" label="Empty Place Holder"/>
				<n-form-switch v-if="multiselect" v-model="cell.state.multiselect" label="Allow Multiselect"/>
				
				<n-form-combo label="Update Operation" :value="cell.state.updateOperation"
					v-if="updatable"
					:filter="getFormOperations"
					@input="updateFormOperation"/>
				<n-page-mapper v-if="cell.state.updateOperation"
					v-model="cell.state.updateBindings"
					:from="formAvailableParameters"
					:to="formInputParameters"/>
				<slot name="additional-settings"></slot>
			</n-collapsible>
			<n-collapsible title="Mapping" class="mapping padded" v-if="Object.keys(inputParameters.properties).length">
				<n-page-mapper :to="inputParameters" :from="availableParameters" 
					v-model="cell.bindings"/>
			</n-collapsible>
			<n-collapsible title="Filters" v-if="cell.state.filters.length || filtersToAdd().length">
				<div class="padded-content">
					<n-form-combo label="Filter Type" :filter="function(value) { return $window.nabu.page.providers('data-filter') }" 
						v-model="cell.state.filterType"
						:extracter="function(x) { return x.component }"
						:formatter="function(x) { return x.name }"/>
						
					<component v-if="filterConfiguration" :is="filterConfiguration" :page="page" :cell="cell" :filters="cell.state.filters"/>
					<n-form-text v-if="cell.state.filterType == 'combo'" v-model="cell.state.filterPlaceHolder" label="Combo placeholder"/>
					<n-form-switch v-model="cell.state.allowFrontendFiltering" label="Allow Frontend Filtering"/>
				</div>
				<page-form-configure root-tag="div"
					:page="page"
					:cell="cell"
					:fields="cell.state.filters" 
					:possible-fields="filtersToAdd()"/>
			</n-collapsible>
			<n-collapsible title="Refresh" v-if="operation != null">
				<div class="list-actions">
					<button @click="cell.state.refreshOn.push(null)"><span class="fa fa-plus"></span>Refresh Listener</button>
				</div>
				<div class="padded-content">
					<div v-for="i in Object.keys(cell.state.refreshOn)" class="list-row">
						<n-form-combo v-model="cell.state.refreshOn[i]"
							:filter="getRefreshEvents"/>
						<span @click="cell.state.refreshOn.splice(i, 1)" class="fa fa-times"></span>
					</div>
					<n-form-switch v-model="cell.state.showRefresh" label="Show Refresh Option"/>
					<n-form-switch v-model="cell.state.showClear" label="Show Clear Filter Option"/>
				</div>
			</n-collapsible>
			<n-collapsible title="Update" v-else-if="cell.state.array != null">
				<div class="list-actions">
					<button @click="cell.state.refreshOn.push(null)">Add To Array</button>
				</div>
				<div class="padded-content">
					<div v-for="i in Object.keys(cell.state.refreshOn)" class="list-row">
						<n-form-combo v-model="cell.state.refreshOn[i]"
							:filter="getRefreshEvents"/>
						<button @click="cell.state.refreshOn.splice(i, 1)"><span class="fa fa-trash"></span></button>
					</div>
				</div>
			</n-collapsible>
			<n-collapsible title="Download">
				<div class="list-actions">
					<button @click="addDownloadListener()"><span class="fa fa-plus"></span>Download Listener</button>
				</div>
				<div v-if="cell.state.downloadOn" class="padded-content">
					<div v-for="i in Object.keys(cell.state.downloadOn)" class="list-row">
						<n-form-combo v-model="cell.state.downloadOn[i].event"
							:filter="getRefreshEvents"/>
						<n-form-combo v-model="cell.state.downloadOn[i].contentType"
							:filter="getContentTypes"
							:formatter="function(x) { return x.type }"
							:extracter="function(x) { return x.contentType }"/>
						<n-form-text v-model="cell.state.downloadOn[i].fileName" placeholder="Filename"/>
						<n-form-text v-model="cell.state.downloadOn[i].limit" placeholder="Limit"/>
						<span class="fa fa-times" @click="cell.state.downloadOn.splice(i, 1)"></span>
					</div>
				</div>
			</n-collapsible>
			<n-collapsible title="Eventing" class="list">
				<div class="list-actions">
					<button @click="addAction"><span class="fa fa-plus"></span>Event</button>
				</div>
				<n-collapsible class="list-item" :title="action.name ? action.name : 'Unnamed'" v-for="action in cell.state.actions">
					<n-form-text v-model="action.name" label="Name" @input="$emit('updatedEvents')"/>
					<n-form-combo v-model="action.class" :filter="$services.page.getSimpleClasses" label="Class"/>
					<n-form-switch v-model="action.global" label="Global" v-if="!action.field" />
					<n-form-switch v-model="action.useSelection" v-if="action.global && !action.useAll" label="Use Selection" />
					<n-form-switch v-model="action.useAll" v-if="action.global && !action.useSelection" label="Use All" />
					<n-form-text v-model="action.icon" label="Icon"/>
					<n-form-text v-model="action.label" label="Label"/>
					<n-form-text v-model="action.condition" label="Condition"/>
					<n-form-switch v-model="action.refresh" label="Reload"/>
					<n-form-switch v-model="action.close" label="Close"/>
					<n-form-switch v-model="action.delete" label="Delete" v-if="!pageable && (!action.global || action.useSelection)"/>
					<n-form-combo v-model="action.type" v-if="action.global" :items="['button', 'link']" :nillable="false" label="Type"/>
					<n-form-combo v-model="action.field" v-if="!action.global" :items="eventFields"
						:formatter="function(x) { return x.index + (x.label ? ' - ' + x.label : '') }"
						:extracter="function(x) { return x.index }"
						label="Link to field"/>
					<div class="list-item-actions">
						<button @click="upAction(action)"><span class="fa fa-chevron-circle-up"></span></button>
						<button @click="downAction(action)"><span class="fa fa-chevron-circle-down"></span></button>
						<button @click="removeAction(action)"><span class="fa fa-trash"></span></button>
					</div>
				</n-collapsible>
			</n-collapsible>
			<page-fields-edit :cell="cell" :page="page" :keys="keys" :allow-editable="!!cell.state.updateOperation" :allow-events="false" v-if="supportsFields"/>
			<n-collapsible title="Formatters" class="list" v-if="false">
				<n-collapsible class="list-item" :title="cell.state.result[key].label ? cell.state.result[key].label : key" v-for="key in keys">
					<n-form-text v-model="cell.state.result[key].label" :label="'Label for ' + key" 
						v-if="cell.state.result[key].format != 'hidden'"/>
					<n-form-combo v-model="cell.state.result[key].format" :label="'Format ' + key + ' as'"
						:items="['hidden', 'link', 'date', 'dateTime', 'time', 'masterdata', 'custom']"/>
					<n-ace v-if="cell.state.result[key].format == 'custom'" mode="javascript" v-model="cell.state.result[key].custom"/>
				</n-collapsible>
			</n-collapsible>
			<n-collapsible title="Styling">
				<div class="padded-content">
					<n-form-text v-model="cell.state.class" label="Class"/>
				</div>
				<div v-if="supportsRecordStyling">
					<div class="list-actions">
						<button @click="addRecordStyle()"><span class="fa fa-plus"></span>Record Style</button>
					</div>
					<div class="list-row" v-for="style in cell.state.styles">
						<n-form-text v-model="style.class" label="Class"/>
						<n-form-text v-model="style.condition" label="Condition"/>
						<span @click="cell.state.styles.splice(cell.state.styles.indexOf(style), 1)" class="fa fa-times"></span>
					</div>
				</div>
				<div v-if="supportsGlobalStyling">
					<div class="list-actions">
						<button @click="addGlobalStyle()"><span class="fa fa-plus"></span>Global Style</button>
					</div>
					<div v-if="cell.state.globalStyles">
						<div class="list-row" v-for="style in cell.state.globalStyles">
							<n-form-text v-model="style.class" label="Class"/>
							<n-form-text v-model="style.condition" label="Condition"/>
							<span @click="cell.state.globalStyles.splice(cell.state.globalStyles.indexOf(style), 1)" class="fa fa-times"></span>
						</div>
					</div>
				</div>
			</n-collapsible>
			<n-collapsible title="Order By" v-if="orderable">
				<div class="list-item-actions">
					<button @click="cell.state.orderBy.push('')"><span class="fa fa-plus"></span>Order By</button>
				</div>
				<div class="list-row" v-for="i in Object.keys(cell.state.orderBy)">
					<n-form-combo v-model="cell.state.orderBy[i]" :filter="getOrderByKeys"/>
					<span @click="cell.state.orderBy.splice(i, 1)" class="fa fa-times"></span>
				</div>
			</n-collapsible>
			<n-collapsible title="Column Styling" class="list" v-if="false">
				<n-collapsible class="list-item" :title="key" v-for="key in keys">
					<div class="list-item-actions">
						<button @click="addStyle(key)"><span class="fa fa-plus"></span>Style for {{key}}</button>
					</div>
					<n-form-section class="list-row" v-for="style in cell.state.result[key].styles">
						<n-form-text v-model="style.class" label="Class"/>
						<n-form-text v-model="style.condition" label="Condition"/>
						<span @click="cell.state.result[key].styles.splice(cell.state.result[key].styles.indexOf(style), 1)" class="fa fa-times"></span>
					</n-form-section>
				</n-collapsible>
			</n-collapsible>
			<n-collapsible title="Advanced" v-if="false" comment="currently disabled, transforming data is tricky because we lose definition">
				<n-ace :timeout="600" v-model="cell.state.transform" mode="javascript"/>
			</n-collapsible>
			<slot name="settings"></slot>
		</n-form>
	</div>
</template>

<template id="data-common-header">
	<div class="data-common-header">
		<n-sidebar :autocloseable="false" v-if="configuring" @close="$emit('close')" class="settings" :inline="true">
			<n-form class="layout2">
				<n-collapsible title="Data Settings" class="padded">
					<h2>Data<span class="subscript">Determine where you will get your data from</span></h2>
					<n-form-combo label="Operation" :value="cell.state.operation" 
						:filter="getDataOperations"
						@input="updateOperation"
						v-if="!cell.state.array && !cell.state.collect"/>
					<n-form-combo label="Array" :value="cell.state.array"
						:filter="function(value) { return $services.page.getAllArrays(page, cell.id) }"
						v-if="!cell.state.operation && !cell.state.collect"
						@input="updateArray"/>
					<n-form-combo label="Collect" :value="cell.state.collect"
						:filter="function(value) { return $services.page.getAllArrays(page, cell.id) }"
						v-if="false && !cell.state.operation && !cell.state.array"
						@input="updateCollect"/>
					<n-form-text v-if="cell.state.operation" v-model="cell.state.autoRefresh" label="Auto-refresh" info="If you want to automatically refresh the data, fill in the number of ms after which it will be refreshed"/>
					<n-form-text v-model="cell.state.limit" v-if="hasLimit" label="Limit" :timeout="600" @input="load()" info="How many items do you want to load at once?"/>
					<n-form-text v-model="cell.state.windowIncrement" label="Window Increment" :timeout="600" @input="load()" info="For windowed data lists, the limit determines how many items are on screen while the window increment determines how much you move by each time"/>   
					<n-form-switch v-if="!cell.state.loadMore && !cell.state.loadPrevNext && hasLimit" v-model="cell.state.loadLazy" label="Lazy Loading"/> 
					<n-form-switch v-if="!cell.state.loadLazy && !cell.state.loadPrevNext && hasLimit" v-model="cell.state.loadMore" label="Load more button"/>
					<n-form-switch v-if="!cell.state.loadMore && !cell.state.loadLazy && hasLimit" v-model="cell.state.loadPrevNext" label="Load next/prev"/> 
					<n-form-text v-model="cell.state.prevButtonLabel" label="Label previous button" v-if="cell.state.loadPrevNext"/>
					<n-form-text v-model="cell.state.nextButtonLabel" label="Label next button" v-if="cell.state.loadPrevNext"/>
					<slot name="main-settings"></slot>
					<h2>Additional<span class="subscript">Configure some additional data properties.</span></h2>
					<n-form-text v-model="cell.state.title" label="Title" info="The title for this data component"/>
					<n-form-text v-model="cell.state.emptyPlaceholder" label="Empty Place Holder"/>
					<n-form-switch v-if="multiselect" v-model="cell.state.multiselect" label="Allow Multiselect"/>
					<n-form-combo label="Filter Type" :filter="function(value) { return $window.nabu.page.providers('data-filter') }" v-model="cell.state.filterType"
						:formatter="function(x) { return x.name }"/>
					<component v-if="cell.state.filterType && cell.state.filterType.configure" :is="cell.state.filterType.configure" :page="page" :cell="cell" :filters="cell.state.filters"/>
					<n-form-text v-if="cell.state.filterType == 'combo'" v-model="cell.state.filterPlaceHolder" label="Combo placeholder"/>
					<n-form-switch v-model="cell.state.allowFrontendFiltering" label="Allow Frontend Filtering"/>
					<n-form-combo label="Update Operation" :value="cell.state.updateOperation"
						v-if="updatable"
						:filter="getFormOperations"
						@input="updateFormOperation"/>
					<n-page-mapper v-if="cell.state.updateOperation"
						v-model="cell.state.updateBindings"
						:from="formAvailableParameters"
						:to="formInputParameters"/>
					<slot name="additional-settings"></slot>
				</n-collapsible>
				<n-collapsible title="Mapping" class="mapping padded" v-if="Object.keys(inputParameters.properties).length">
					<n-page-mapper :to="inputParameters" :from="availableParameters" 
						v-model="cell.bindings"/>
				</n-collapsible>
				<n-collapsible title="Refresh" v-if="operation != null">
					<div class="list-actions">
						<button @click="cell.state.refreshOn.push(null)"><span class="fa fa-plus"></span>Refresh Listener</button>
					</div>
					<div class="padded-content">
						<div v-for="i in Object.keys(cell.state.refreshOn)" class="list-row">
							<n-form-combo v-model="cell.state.refreshOn[i]"
								:filter="getRefreshEvents"/>
							<span @click="cell.state.refreshOn.splice(i, 1)" class="fa fa-times"></span>
						</div>
						<n-form-switch v-model="cell.state.showRefresh" label="Show Refresh Option"/>
						<n-form-switch v-model="cell.state.showClear" label="Show Clear Filter Option"/>
					</div>
				</n-collapsible>
				<n-collapsible title="Update" v-else-if="cell.state.array != null">
					<div class="list-actions">
						<button @click="cell.state.refreshOn.push(null)">Add To Array</button>
					</div>
					<div class="padded-content">
						<div v-for="i in Object.keys(cell.state.refreshOn)" class="list-row">
							<n-form-combo v-model="cell.state.refreshOn[i]"
								:filter="getRefreshEvents"/>
							<button @click="cell.state.refreshOn.splice(i, 1)"><span class="fa fa-trash"></span></button>
						</div>
					</div>
				</n-collapsible>
				<n-collapsible title="Download">
					<div class="list-actions">
						<button @click="addDownloadListener()"><span class="fa fa-plus"></span>Download Listener</button>
					</div>
					<div v-if="cell.state.downloadOn" class="padded-content">
						<div v-for="i in Object.keys(cell.state.downloadOn)" class="list-row">
							<n-form-combo v-model="cell.state.downloadOn[i].event"
								:filter="getRefreshEvents"/>
							<n-form-combo v-model="cell.state.downloadOn[i].contentType"
								:filter="getContentTypes"
								:formatter="function(x) { return x.type }"
								:extracter="function(x) { return x.contentType }"/>
							<n-form-text v-model="cell.state.downloadOn[i].fileName" placeholder="Filename"/>
							<n-form-text v-model="cell.state.downloadOn[i].limit" placeholder="Limit"/>
							<span class="fa fa-times" @click="cell.state.downloadOn.splice(i, 1)"></span>
						</div>
					</div>
				</n-collapsible>
				<n-collapsible title="Eventing" class="list">
					<div class="list-actions">
						<button @click="addAction"><span class="fa fa-plus"></span>Event</button>
					</div>
					<n-collapsible class="list-item" :title="action.name ? action.name : 'Unnamed'" v-for="action in cell.state.actions">
						<n-form-text v-model="action.name" label="Name" @input="$emit('updatedEvents')"/>
						<n-form-combo v-model="action.class" :filter="$services.page.getSimpleClasses" label="Class"/>
						<n-form-switch v-model="action.global" label="Global" v-if="!action.field" />
						<n-form-switch v-model="action.useSelection" v-if="action.global && !action.useAll" label="Use Selection" />
						<n-form-switch v-model="action.useAll" v-if="action.global && !action.useSelection" label="Use All" />
						<n-form-text v-model="action.icon" label="Icon"/>
						<n-form-text v-model="action.label" label="Label"/>
						<n-form-text v-model="action.condition" label="Condition"/>
						<n-form-switch v-model="action.refresh" label="Reload"/>
						<n-form-switch v-model="action.close" label="Close"/>
						<n-form-switch v-model="action.delete" label="Delete" v-if="!pageable && (!action.global || action.useSelection)"/>
						<n-form-combo v-model="action.type" v-if="action.global" :items="['button', 'link']" :nillable="false" label="Type"/>
						<n-form-combo v-model="action.field" v-if="!action.global" :items="eventFields"
							:formatter="function(x) { return x.index + (x.label ? ' - ' + x.label : '') }"
							:extracter="function(x) { return x.index }"
							label="Link to field"/>
						<div class="list-item-actions">
							<button @click="upAction(action)"><span class="fa fa-chevron-circle-up"></span></button>
							<button @click="downAction(action)"><span class="fa fa-chevron-circle-down"></span></button>
							<button @click="removeAction(action)"><span class="fa fa-trash"></span></button>
						</div>
					</n-collapsible>
				</n-collapsible>
				<page-form-configure title="Filters" v-if="cell.state.filters.length || filtersToAdd().length"
					:page="page"
					:cell="cell"
					:fields="cell.state.filters" 
					:possible-fields="filtersToAdd()"/>
				<page-fields-edit :cell="cell" :page="page" :keys="keys" :allow-editable="!!cell.state.updateOperation" :allow-events="false" v-if="supportsFields"/>
				<n-collapsible title="Formatters" class="list" v-if="false">
					<n-collapsible class="list-item" :title="cell.state.result[key].label ? cell.state.result[key].label : key" v-for="key in keys">
						<n-form-text v-model="cell.state.result[key].label" :label="'Label for ' + key" 
							v-if="cell.state.result[key].format != 'hidden'"/>
						<n-form-combo v-model="cell.state.result[key].format" :label="'Format ' + key + ' as'"
							:items="['hidden', 'link', 'date', 'dateTime', 'time', 'masterdata', 'custom']"/>
						<n-ace v-if="cell.state.result[key].format == 'custom'" mode="javascript" v-model="cell.state.result[key].custom"/>
					</n-collapsible>
				</n-collapsible>
				<n-collapsible title="Styling">
					<div class="padded-content">
						<n-form-text v-model="cell.state.class" label="Class"/>
					</div>
					<div v-if="supportsRecordStyling">
						<div class="list-actions">
							<button @click="addRecordStyle()"><span class="fa fa-plus"></span>Record Style</button>
						</div>
						<div class="list-row" v-for="style in cell.state.styles">
							<n-form-text v-model="style.class" label="Class"/>
							<n-form-text v-model="style.condition" label="Condition"/>
							<span @click="cell.state.styles.splice(cell.state.styles.indexOf(style), 1)" class="fa fa-times"></span>
						</div>
					</div>
					<div v-if="supportsGlobalStyling">
						<div class="list-actions">
							<button @click="addGlobalStyle()"><span class="fa fa-plus"></span>Global Style</button>
						</div>
						<div v-if="cell.state.globalStyles">
							<div class="list-row" v-for="style in cell.state.globalStyles">
								<n-form-text v-model="style.class" label="Class"/>
								<n-form-text v-model="style.condition" label="Condition"/>
								<span @click="cell.state.globalStyles.splice(cell.state.globalStyles.indexOf(style), 1)" class="fa fa-times"></span>
							</div>
						</div>
					</div>
				</n-collapsible>
				<n-collapsible title="Order By" v-if="orderable">
					<div class="list-item-actions">
						<button @click="cell.state.orderBy.push('')"><span class="fa fa-plus"></span>Order By</button>
					</div>
					<div class="list-row" v-for="i in Object.keys(cell.state.orderBy)">
						<n-form-combo v-model="cell.state.orderBy[i]" :filter="getOrderByKeys"/>
						<span @click="cell.state.orderBy.splice(i, 1)" class="fa fa-times"></span>
					</div>
				</n-collapsible>
				<n-collapsible title="Column Styling" class="list" v-if="false">
					<n-collapsible class="list-item" :title="key" v-for="key in keys">
						<div class="list-item-actions">
							<button @click="addStyle(key)"><span class="fa fa-plus"></span>Style for {{key}}</button>
						</div>
						<n-form-section class="list-row" v-for="style in cell.state.result[key].styles">
							<n-form-text v-model="style.class" label="Class"/>
							<n-form-text v-model="style.condition" label="Condition"/>
							<span @click="cell.state.result[key].styles.splice(cell.state.result[key].styles.indexOf(style), 1)" class="fa fa-times"></span>
						</n-form-section>
					</n-collapsible>
				</n-collapsible>
				<n-collapsible title="Advanced" v-if="false" comment="currently disabled, transforming data is tricky because we lose definition">
					<n-ace :timeout="600" v-model="cell.state.transform" mode="javascript"/>
				</n-collapsible>
				<slot name="settings"></slot>
			</n-form>
		</n-sidebar>
		<h2 v-if="cell.state.title">{{$services.page.translate($services.page.interpret(cell.state.title, $self))}}</h2>

		<data-common-filter
			:filters="getLiveFilters()"
			:orderable="orderable"
			:state="getFilterState()"
			:page="page"
			:cell="cell"
			:edit="edit"
			@refresh="$emit('refresh')"
			@clear="clearFilters"
			@filter="setFilter"
			@sort="sort"/>
			
		<div class="page-startup-wizard" v-if="edit && !cell.state.operation && !cell.state.array && (!cell.state.fields || !cell.state.fields.length)">
			<div class="step" v-if="wizard == 'step1'">
				<h2 class="title">Choose a data source</h2>
				<n-form-combo label="Operation" :value="cell.state.operation" 
					:filter="getDataOperations"
					@input="updateOperation"
					v-if="!cell.state.array && !cell.state.collect"/>
				<div v-if="$services.page.getAllArrays(page, cell.id).length">
					<h3>Or</h3>
					<n-form-combo label="Array" :value="cell.state.array"
						:filter="function(value) { return $services.page.getAllArrays(page, cell.id) }"
						v-if="!cell.state.operation && !cell.state.collect"
						@input="updateArray"/>
				</div>
			</div>
		</div>
	</div>
</template>

<template id="data-common-filter">
	<component v-if="cell.state.filterType" 
		:is="cell.state.filterType.component ? cell.state.filterType.component : cell.state.filterType" 
		class="cell-actions"
		:page="page"
		:cell="cell"
		:show-refresh="cell.state.showRefresh"
		:show-clear="cell.state.showClear"
		:filters="filters"
		:formatters="cell.state.formatters"
		:orderable="orderable"
		:state="state"
		v-bubble:refresh
		v-bubble:clear
		v-bubble:filter
		v-bubble:sort/>
</template>

<template id="data-common-prev-next">
	<div class="prev-next-actions">
		<span class="previous-button-wrapper" v-if="hasPrevious">
			<button class="previous-button" @click="$emit('previous')">{{$services.page.translate(prevButtonLabel)}}</button>
		</span>
		<span class="next-button-wrapper" v-if="hasNext">
			<button class="next-button" @click="$emit('next')">{{$services.page.translate(nextButtonLabel)}}</button>
		</span>
	</div>
</template>

<template id="data-common-footer">
	<div class="data-common-footer">
		<div class="global-actions" v-if="globalActions.length">
			<component
				v-for="action in globalActions"
				:is="action.type == 'link' ? 'a' : 'button'"
				:disabled="action.useSelection && !selected.length"
				:class="[action.class, {'has-icon': action.icon}]"
				href="javascript:void(0)"
				v-action="function() { trigger(action) }"><span v-if="action.icon" class="fa" :class="action.icon"></span><label v-if="action.label">{{$services.page.translate(action.label)}}</label></component>
		</div>
	</div>
</template>

