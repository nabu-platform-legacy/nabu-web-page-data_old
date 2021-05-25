<template id="data-card-configure">
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
		<n-form-section slot="main-settings">
			<n-form-switch v-model="cell.state.showLabels" label="Show Labels" />
			<n-form-combo label="Direction" v-model="cell.state.direction" :items="['horizontal', 'vertical']"/>
		</n-form-section>
	</data-common-configure>
	
</template>

<template id="data-card">
	<div class="data-cell data-cards">
		<data-common-header :page="page" :parameters="parameters" :cell="cell" :edit="edit"
				:records="records"
				:all-records="allRecords"
				@updatedEvents="$emit('updatedEvents')"
				:configuring="configuring"
				@close="$emit('close'); configuring=false"
				:updatable="true"
				:filters="filters"
				:paging="paging">
		</data-common-header>
				
		<div class="data-card-list" :class="dataClass" v-if="edit || records.length" :style="{'flex-direction': cell.state.direction == 'vertical' ? 'column' : 'row-wrapped'}">
			<dl class="data-card" @click="select(record, false, $event)" v-visible="lazyLoad.bind($self, record)" v-for="record in records" :class="$services.page.getDynamicClasses(cell.state.styles, {record:record}, $self)" :key="record.id ? record.id : record.$position">
				<page-field :field="field" :data="record" :should-style="false" 
					:edit="edit"
					class="data-card-field" :class="$services.page.getDynamicClasses(field.styles, {record:record}, $self)" v-for="field in cell.state.fields"
					v-if="!isFieldHidden(field, record)"
					:label="cell.state.showLabels"
					@updated="update(record)"
					:page="page"
					:cell="cell"/>
				<div class="data-card-actions" v-if="actions.length" @mouseover="actionHovering = true" @mouseout="actionHovering = false">
					<button v-if="!action.condition || $services.page.isCondition(action.condition, {record:record}, $self)" 
						v-for="action in actions" 
						@click="trigger(action, record)"
						:class="[action.class, {'has-icon': action.icon}]"><span v-if="action.icon" class="fa" :class="action.icon"></span><label v-if="action.label">{{$services.page.translate(action.label)}}</label></button>
				</div>
			</dl>
		</div>
		<data-common-prev-next v-if="cell.state.loadPrevNext" @next="loadNext" @previous="loadPrevious" 
			:has-previous="paging.current != null && paging.current > 0"
			:has-next="paging.current != null && paging.total != null && paging.current < paging.total - 1"/>
		<n-paging :value="paging.current" :total="paging.total" :load="load" :initialize="false" v-else-if="!cell.state.loadLazy && !cell.state.loadMore"/>
		<div class="load-more" v-else-if="cell.state.loadMore && paging.current != null && paging.total != null && paging.current < paging.total - 1">
			<button class="load-more-button" @click="load(paging.current + 1, true)">%{Load More}</button>
		</div>
		<div v-if="!records.length && !showEmpty && cell.state.emptyPlaceholder" class="no-data">{{ $services.page.translate(cell.state.emptyPlaceholder) }}</div>
		
		<data-common-footer :page="page" :parameters="parameters" :cell="cell" 
			:edit="edit"
			:records="records"
			:all-records="allRecords"
			:selected="selected"
			:inactive="inactive"
			:global-actions="globalActions"
			@updatedEvents="$emit('updatedEvents')"
			@close="$emit('close'); configuring=false"
			:multiselect="true"
			:updatable="true"/>
	</div>
</template>