<template id="data-table">
	<div class="data-cell data-table">
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
			<div slot="settings">
				<button @click="cell.alias = 'data-table-list'"><span>Switch to flex table</span></button>
			</div>
		</data-common-header>
			
		<table class="classic data" cellspacing="0" cellpadding="0" :class="dataClass" v-if="edit || showEmpty || records.length">
			<thead>
				<tr>
					<th @click="sort(getSortKey(field))"
							v-for="field in cell.state.fields"
							v-if="!isAllFieldHidden(field)"><span>{{ $services.page.translate(field.label) }}</span>
						<span class="fa fa-sort-up" v-if="orderBy.indexOf(getSortKey(field)) >= 0"></span>
						<span class="fa fa-sort-down" v-if="orderBy.indexOf(getSortKey(field) + ' desc') >= 0"></span>
					</th>
					<th v-if="actions.length"></th>
				</tr>
			</thead>
			<tbody>
				<tr v-visible="lazyLoad.bind($self, record)" v-for="record in records" @click="select(record)" :class="getRecordStyles(record)" :custom-style="cell.state.styles.length > 0" :key="record.id ? record.id : records.indexOf(record)">
					<td :class="$services.page.getDynamicClasses(field.styles, {record:record}, $self)" v-for="field in cell.state.fields" v-if="!isAllFieldHidden(field)">
						<page-field :field="field" :data="record" 
							v-if="!isFieldHidden(field, record)"
							:should-style="false" 
							:label="false"
							@updated="update(record)"
							:page="page"
							@mouseover="actionHovering = fieldActions(field).length > 0" @mouseout="actionHovering = false"
							:actions="fieldActions(field)"
							:cell="cell"/>
					</td>
					<td class="actions" v-if="actions.length" @mouseover="actionHovering = true" @mouseout="actionHovering = false">
						<button v-if="!action.condition || $services.page.isCondition(action.condition, {record:record}, $self)" 
							v-for="action in actions" 
							@click="trigger(action, record)"
							:class="[action.class, {'has-icon': action.icon}, {'inline': !action.class }]"><span class="fa" v-if="action.icon" :class="action.icon"></span><label v-if="action.label">{{$services.page.translate(action.label)}}</label></button>
					</td>
				</tr>
			</tbody>
		</table>
		<n-paging :value="paging.current" :total="paging.total" :load="load" :initialize="false" v-if="!cell.state.loadLazy && !cell.state.loadMore"/>
		<div class="load-more" v-else-if="cell.state.loadMore && paging.current != null && paging.total != null && paging.current < paging.total - 1">
			<button class="load-more-button" @click="load(paging.current + 1, true)">%{Load More}</button>
		</div>
		<div v-if="!records.length && !showEmpty" class="no-data">{{ cell.state.emptyPlaceholder ? $services.page.translate(cell.state.emptyPlaceholder) : "%{No data available}"}}<span v-if="$services.page.wantEdit" class="fa fa-table generate-stub" @click="generateStub" title="Generate Stub Data"></span></div>
		
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
