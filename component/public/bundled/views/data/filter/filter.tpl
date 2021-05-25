<template id="data-filter-default">
	<div :class="{'always-open': cell.state.defaultFilter.displayOpenOnly}" class="data-filter-default" v-auto-close.filter="function() { cell.state.defaultFilter.displayOpenOnly ? showFilter = true : showFilter = false }">
		<span v-if="showRefresh" class="fa fa-sync refresh-button" @click="$emit('refresh')"></span>
		<span class="fa fa-search" @click="showFilter = !showFilter" v-if="filters.length && !cell.state.defaultFilter.displayOpenOnly"></span>
		<n-form class="layout2 filter" v-if="showFilter">
			<span v-if="!!cell.state.defaultFilter.textBefore" class="data-filter-text-before">{{$services.page.translate(cell.state.defaultFilter.textBefore)}}</span>
			<page-form-field v-for="field in filters" class="filter-field"
				:key="field.name + '_value'" 
				:field="field" 
				:value="state[field.name]"
				:page="page"
				@label="function(label) { setLabel(field, label) }"
				:cell="cell"
				@input="function(newValue) { setFilter(field, newValue) }"/>
		</n-form>
		<div class="default-filter-tags" v-if="cell.state.defaultFilter && cell.state.defaultFilter.useTags">
			<div class="default-filter-tag" v-for="tag in tags">
				<span class="value">{{ tag.value }}</span>
				<span class="key">{{ $services.page.translate(tag.filter.label) }}</span>
				<span class="fa icon fa-times" @click="tag.remove()"></span>
			</div>
			<a class="page-action-link page-action-entry"
				@click="$emit('clear')"
				v-if="showClear && tags.length > 0"
					><span v-if="cell.state.defaultFilter.clearFilterIcon" class="icon fa" :class="cell.state.defaultFilter.clearFilterIcon"></span
					><span v-if="cell.state.defaultFilter.clearFilterText">{{ $services.page.translate(cell.state.defaultFilter.clearFilterText, $self) }}</span>
			</a>
			<a class="page-action-link page-action-entry clear-all-filter"
				@click="$emit('clear')"
				v-if="showClear && !cell.state.defaultFilter.clearFilterIcon && !cell.state.defaultFilter.clearFilterText && tags.length > 0"
					><span class="icon fa fa-times"></span>
			</a>
		</div>		
	</div>
</template>

<template id="data-default-filter-configure">
	<n-form-section class="data-default-filter-configure">
		<n-form-switch v-model="cell.state.defaultFilter.displayOpenOnly" label="Always show filters"/>
		<n-form-text v-model="cell.state.defaultFilter.textBefore" label="Text before"/>
		<n-form-switch v-model="cell.state.defaultFilter.useTags" label="Use Tags"/>
		<n-form-text v-model="cell.state.defaultFilter.clearFilterIcon" v-if="showClear" label="Clear filter icon"/>
		<n-form-text v-model="cell.state.defaultFilter.clearFilterText" v-if="showClear" label="Clear filter text"/>
	</n-form-section>
</template>