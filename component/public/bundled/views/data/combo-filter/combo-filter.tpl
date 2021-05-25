<template id="data-combo-filter">
	<form v-on:submit.prevent class="data-combo-filter n-form">
		<div class="combo-filter n-input-combo n-component" v-if="filters.length || showRefresh">
			<div class="n-input-combo-label-container" v-auto-close="function() { showLabels = false }" v-if="filters && filters.length">
				<div class="n-component-label n-input-combo-label" @click="showLabels = !showLabels" v-if="activeFilter">
					<span>{{ activeFilter.label ? $services.page.translate(activeFilter.label) : activeFilter.name }}</span><span v-if="filters.length > 1" class="n-icon n-icon-arrow-down fa fa-chevron-down"></span>
				</div>
				
				<ul class="n-input-combo-dropdown n-input-combo-dropdown-labels" v-if="filters.length > 1 && showLabels">
					<li v-for="filter in filters" class="n-input-combo-dropdown-label" :class="{ 'active': filter == activeFilter }" @click="activeFilter = filter" auto-close>
						<slot name="label-dropdown" :label="single"><span>{{ filter.label ? $services.page.translate(filter.label) : filter.name }}</span></slot>
					</li>
				</ul>
			</div>
			<div v-if="activeFilter">
				<page-form-field :key="activeFilter.name + '_value'" 
					class="combo-filter-field"
					:field="activeFilter" 
					:label="false"
					:value="state[activeFilter.name]"
					@label="function(label) { setLabel(activeFilter, label) }"
					:page="page"
					:cell="cell"
					@input="function(newValue) { setFilter(activeFilter, newValue) }"/>
			</div>
			<button class="primary refresh-button" v-if="showRefresh" @click="$emit('refresh')"><span class="fa fa-sync"></span></button>
		</div>
		<div class="combo-filter-tags" v-if="cell.state.comboFilter && cell.state.comboFilter.useTags">
			<div class="combo-filter-tag" v-for="tag in tags">
				<span class="value">{{ tag.value }}</span>
				<span class="key">{{ $services.page.translate(tag.filter.label) }}</span>
				<span class="fa fa-times" @click="tag.remove()"></span>
			</div>
			
			<a class="page-action-link page-action-entry"
				@click="$emit('clear')"
				v-if="showClear && tags.length > 0"
					><span v-if="cell.state.comboFilter.clearFilterIcon" class="icon fa" :class="cell.state.comboFilter.clearFilterIcon"></span
					><span v-if="cell.state.comboFilter.clearFilterText">{{ $services.page.translate($services.page.interpret(cell.state.comboFilter.clearFilterText, $self)) }}</span
			></a>
			<a class="page-action-link page-action-entry"
				@click="$emit('clear')"
				v-if="showClear && !cell.state.comboFilter.clearFilterIcon && !cell.state.comboFilter.clearFilterText && tags.length > 0"
					><span class="icon fa fa-times"></span
			></a>
		</div>
	</form>
</template>

<template id="data-combo-filter-configure">
	<n-form-section class="data-combo-filter-configure">
		<n-form-switch v-model="cell.state.comboFilter.useTags" label="Use Tags"/>
		<n-form-text v-model="cell.state.comboFilter.clearFilterIcon" label="Clear filter icon"/>
		<n-form-text v-model="cell.state.comboFilter.clearFilterText" label="Clear filter text"/>
	</n-form-section>
</template>