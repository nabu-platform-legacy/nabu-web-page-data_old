<template id="data-table-list-configure">
	<data-common-configure :page="page" :parameters="parameters" :cell="cell"
			:edit="edit"
			:records="records"
			:selected="selected"
			:inactive="inactive"
			@updatedEvents="$emit('updatedEvents')"
			@close="$emit('close'); configuring=false"
			:multiselect="true"
			:configuring="true"
			:updatable="true"
			:paging="paging"
			:filters="filters"
			@refresh="refresh">
		<div slot="main-settings">
			<n-form-switch v-model="cell.state.useNativeTable" label="Use HTML Table" info="By default flex tables are used, but in some cases a native HTML table is more appropriate"/>
			<n-form-switch v-if="cell.state.useNativeTable" v-model="cell.state.useTopHeader" label="Use top header"/>
			<n-form-switch v-model="cell.state.hideEmptyColumns" label="Hide empty columns"/>
		</div>
		<div slot="settings">
			<n-collapsible class="padded" title="Field widths" v-if="!cell.state.useNativeTable && cell.state.fields && cell.state.fields.length">
				<n-form-text :label="'Width for: ' + (field.label ? field.label : field.key)" :value="field.width" v-for="field in cell.state.fields" @input="function(newValue) { $window.Vue.set(field, 'width', newValue) }"/>
			</n-collapsible>
			<n-collapsible class="page-fields list" title="Top header" v-if="cell.state.useTopHeader && cell.state.fields && cell.state.fields.length">
				<div class="list-actions">
					<button @click="addTopHeaderField()"><span class="fa fa-plus"></span>Field</button>
				</div>
				<div v-if="cell.state.topHeaders">
					<n-collapsible class="list-item" :title="field.label ? field.label : 'Unlabeled'" v-for="field in cell.state.topHeaders">
						<n-form-text v-model="field.label" label="Field Label"/>
						<div>
							<div class="list-item-actions">
								<button @click="addSubheader(field)">Add Subheader</button>
								<button  @click="cell.state.topHeaders.splice(cell.state.topHeaders.indexOf(field), 1)">Remove Field</button>
								<button @click="fieldBeginning(field)"><span class="fa fa-chevron-circle-left"></span></button>
								<button @click="fieldUp(field)"><span class="fa fa-chevron-circle-up"></span></button>
								<button @click="fieldDown(field)"><span class="fa fa-chevron-circle-down"></span></button>
								<button @click="fieldEnd(field)"><span class="fa fa-chevron-circle-right"></span></button>
							</div>
						</div>
						<n-form-section class="list-row" v-for="i in Object.keys(field.subheaders)">
							<n-form-combo v-model="field.subheaders[i]" :items="eventFields"
								:formatter="function(x) { return x.index + (x.label ? ' - ' + x.label : '') }"
								:extracter="function(x) { return x.index }"
								label="Subheader"/>
							<span class="fa fa-times" @click="field.subheaders.splice(i, 1)"></span>
						</n-form-section>
						<div class="list-item-actions">
							<button @click="addStyle(field)"><span class="fa fa-plus"></span>Style</button>
						</div>
						<n-form-section class="list-row" v-for="style in field.styles">
							<n-form-text v-model="style.class" label="Class"/>
							<n-form-text v-model="style.condition" label="Condition"/>
							<span class="fa fa-times" @click="field.styles.splice(field.styles.indexOf(style), 1)"></span>
						</n-form-section>
					</n-collapsible>
				</div>
			</n-collapsible>
			<n-collapsible title="Device Layout" v-if="cell.state.fields && cell.state.fields.length && $services.page.devices.length">
				<n-collapsible v-for="field in cell.state.fields" :title="field.label ? field.label : 'Unlabeled'" class="light">
					<div class="padded-content">
						<div class="list-actions">
							<button @click="addDevice(field)"><span class="fa fa-plus"></span>Device rule</button>
						</div>
						<div v-if="field.devices">
							<div class="list-row" v-for="device in field.devices">
								<n-form-combo v-model="device.operator" :items="['>', '>=', '<', '<=', '==']"/>
								<n-form-combo v-model="device.name" 
									:filter="$services.page.suggestDevices"/>
								<span @click="cell.devices.splice(cell.devices.indexOf(device), 1)" class="fa fa-times"></span>
							</div>
						</div>
					</div>
				</n-collapsible>
			</n-collapsible>
		</div>
	</data-common-configure>
</template>
<template id="data-table-list">
	<div class="data-cell data-table-list">
		<data-common-header :page="page" :parameters="parameters" :cell="cell"
				:edit="edit"
				:records="records"
				:selected="selected"
				:inactive="inactive"
				@updatedEvents="$emit('updatedEvents')"
				@close="$emit('close'); configuring=false"
				:multiselect="true"
				:configuring="configuring"
				:updatable="true"
				:paging="paging"
				:filters="filters"
				@refresh="refresh">
			<div slot="main-settings">
				<n-form-switch v-model="cell.state.useNativeTable" label="Use HTML Table" info="By default flex tables are used, but in some cases a native HTML table is more appropriate"/>
				<n-form-switch v-if="cell.state.useNativeTable" v-model="cell.state.useTopHeader" label="Use top header"/>
				<n-form-switch v-model="cell.state.hideEmptyColumns" label="Hide empty columns"/>
			</div>
			<n-collapsible slot="settings" class="padded" title="Field widths" v-if="!cell.state.useNativeTable && cell.state.fields && cell.state.fields.length">
				<n-form-text :label="'Width for: ' + (field.label ? field.label : field.key)" :value="field.width" v-for="field in cell.state.fields" @input="function(newValue) { $window.Vue.set(field, 'width', newValue) }"/>
			</n-collapsible>
			<n-collapsible slot="settings" class="page-fields list" title="Top header" v-if="cell.state.useTopHeader && cell.state.fields && cell.state.fields.length">
				<div class="list-actions">
					<button @click="addTopHeaderField()"><span class="fa fa-plus"></span>Field</button>
				</div>
				<div v-if="cell.state.topHeaders">
					<n-collapsible class="list-item" :title="field.label ? field.label : 'Unlabeled'" v-for="field in cell.state.topHeaders">
						<n-form-text v-model="field.label" label="Field Label"/>
						<div>
							<div class="list-item-actions">
								<button @click="addSubheader(field)">Add Subheader</button>
								<button  @click="cell.state.topHeaders.splice(cell.state.topHeaders.indexOf(field), 1)">Remove Field</button>
								<button @click="fieldBeginning(field)"><span class="fa fa-chevron-circle-left"></span></button>
								<button @click="fieldUp(field)"><span class="fa fa-chevron-circle-up"></span></button>
								<button @click="fieldDown(field)"><span class="fa fa-chevron-circle-down"></span></button>
								<button @click="fieldEnd(field)"><span class="fa fa-chevron-circle-right"></span></button>
							</div>
						</div>
						<n-form-section class="list-row" v-for="i in Object.keys(field.subheaders)">
							<n-form-combo v-model="field.subheaders[i]" :items="eventFields"
								:formatter="function(x) { return x.index + (x.label ? ' - ' + x.label : '') }"
								:extracter="function(x) { return x.index }"
								label="Subheader"/>
							<span class="fa fa-times" @click="field.subheaders.splice(i, 1)"></span>
						</n-form-section>
						<div class="list-item-actions">
							<button @click="addStyle(field)"><span class="fa fa-plus"></span>Style</button>
						</div>
						<n-form-section class="list-row" v-for="style in field.styles">
							<n-form-text v-model="style.class" label="Class"/>
							<n-form-text v-model="style.condition" label="Condition"/>
							<span class="fa fa-times" @click="field.styles.splice(field.styles.indexOf(style), 1)"></span>
						</n-form-section>
					</n-collapsible>
				</div>
			</n-collapsible>
		</data-common-header>
		
		<ul class="table-list classic data" cellspacing="0" cellpadding="0" :class="dataClass" v-if="!cell.state.useNativeTable && (edit || showEmpty || records.length)">
			<li class="row title">
				<span @click="sort(getSortKey(field))" v-for="field in cell.state.fields" :style="{'flex-grow': (field.width != null ? field.width : '1')}"
						v-if="!(isAllFieldHidden(field) && cell.state.hideEmptyColumns)">
					<span>{{ $services.page.translate(field.label) }}</span>
					<n-info class="n-form-label-info" v-if="field.info" :icon="field.infoIcon"><span v-html="$services.page.translate(field.info)"></span></n-info>
					<span class="fa fa-sort-up" v-if="orderBy.indexOf(getSortKey(field)) >= 0"></span>
					<span class="fa fa-sort-down" v-if="orderBy.indexOf(getSortKey(field) + ' desc') >= 0"></span>
				</span>
				<span v-if="actions.length" class="actions"></span>
			</li>
			<li v-visible="lazyLoad.bind($self, record)" class="row" v-for="record in records" @click="select(record)" :class="getRecordStyles(record)" :custom-style="cell.state.styles.length > 0" :key="record.id ? record.id : records.indexOf(record)">
				<page-field :field="field" :data="record" 
					v-if="!(isFieldHidden(field, record) && cell.state.hideEmptyColumns)"
					:should-style="false" 
					:label="false"
					:style="{'flex-grow': (field.width != null ? field.width : '1')}"
					@updated="update(record)"
					:page="page"
					:class="$services.page.getDynamicClasses(field.styles, {record:record}, $self)" 
					v-for="field in cell.state.fields"
					:cell="cell"
					@mouseover="actionHovering = fieldActions(field).length > 0" @mouseout="actionHovering = false"
					:actions="fieldActions(field)"/>
				<div class="actions" v-if="recordActions.length" @mouseover="actionHovering = true" @mouseout="actionHovering = false">
					<button v-if="!action.condition || $services.page.isCondition(action.condition, {record:record}, $self)" 
						v-for="action in recordActions" 
						@click="trigger(action, record)"
						:class="[action.class, {'has-icon': action.icon && action.label }, {'inline': !action.class }]"><span class="fa" v-if="action.icon" :class="action.icon"></span><label v-if="action.label">{{$services.page.translate(action.label)}}</label></button>
				</div>
			</li>
		</ul>
		
		<table class="classic data" cellspacing="0" cellpadding="0" :class="dataClass" v-else-if="cell.state.useNativeTable && (edit || showEmpty || records.length)">
			<thead>
				<tr v-if="cell.state.useTopHeader && cell.state.topHeaders && cell.state.topHeaders.length" class="top-header">
					<th v-for="field in cell.state.topHeaders" v-if="!(subheadersHidden(field) && cell.state.hideEmptyColumns)" :colspan="calculateColspan(field)"><span>{{ $services.page.translate(field.label) }}</span>
					</th>
					<th v-if="actions.length"></th>
				</tr>
				<tr>
					<th @click="sort(getSortKey(field))"
							v-for="field in cell.state.fields"
							v-if="!(isAllFieldHidden(field) && cell.state.hideEmptyColumns) && isAllowedDevice(field)"><span>{{ $services.page.translate(field.label) }}</span>
						<n-info class="n-form-label-info" v-if="field.info" :icon="field.infoIcon"><span>{{ $services.page.translate(field.info) }}</span></n-info>
						<span class="fa fa-sort-up" v-if="orderBy.indexOf(getSortKey(field)) >= 0"></span>
						<span class="fa fa-sort-down" v-if="orderBy.indexOf(getSortKey(field) + ' desc') >= 0"></span>
					</th>
					<th v-if="actions.length"></th>
				</tr>
			</thead>
			<tbody>
				<tr v-visible="lazyLoad.bind($self, record)" v-for="record in records" @click="select(record)" :class="getRecordStyles(record)" :custom-style="cell.state.styles.length > 0" :key="record.id ? record.id : records.indexOf(record)">
					<td :class="$services.page.getDynamicClasses(field.styles, {record:record}, $self)" v-for="field in cell.state.fields" v-if="!(isAllFieldHidden(field) && cell.state.hideEmptyColumns) && isAllowedDevice(field)">
						<page-field :field="field" :data="record" 
							v-if="!isFieldHidden(field, record)"
							:should-style="false" 
							:label="false"
							@updated="update(record)"
							@mouseover="actionHovering = fieldActions(field).length > 0" @mouseout="actionHovering = false"
							:actions="fieldActions(field)"
							:page="page"
							:cell="cell"/>
					</td>
					<td class="actions" v-if="actions.length" @mouseover="actionHovering = true" @mouseout="actionHovering = false">
						<button v-if="!action.condition || $services.page.isCondition(action.condition, {record:record}, $self)" 
							v-for="action in recordActions" 
							@click="trigger(action, record)"
							:class="[action.class, {'has-icon': action.icon && action.label }, {'inline': !action.class }]"><span class="fa" v-if="action.icon" :class="action.icon"></span><label v-if="action.label">{{$services.page.translate(action.label)}}</label></button>
					</td>
				</tr>
			</tbody>
		</table>
		<n-paging :value="paging.current" :total="paging.total" :load="load" :initialize="false" v-if="!cell.state.loadLazy && !cell.state.loadMore"/>
		<div class="load-more" v-else-if="cell.state.loadMore && paging.current != null && paging.total != null && paging.current < paging.total - 1">
			<button class="load-more-button" @click="load(paging.current + 1, true)">%{Load More}</button>
		</div>
		<div v-if="!records.length && !showEmpty && cell.state.fields && cell.state.fields.length" class="no-data">{{ cell.state.emptyPlaceholder ? $services.page.translate(cell.state.emptyPlaceholder) : "%{No data available}"}}<span v-if="$services.page.wantEdit && cell.state.fields && cell.state.fields.length" class="fa fa-table generate-stub" @click="generateStub" title="Generate Stub Data"></span></div>
		
		<data-common-footer :page="page" :parameters="parameters" :cell="cell" 
			:edit="edit"
			:records="records"
			:selected="selected"
			:inactive="inactive"
			:global-actions="globalActions"
			@updatedEvents="$emit('updatedEvents')"
			@close="$emit('close')"
			:multiselect="true"
			:updatable="true"/>
	</div>
</template>

