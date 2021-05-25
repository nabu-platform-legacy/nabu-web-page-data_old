<template id="data-multi-select">
	<div class="data-cell data-multi-select">
		<data-common-header :page="page" :parameters="parameters" 
				:cell="cell.state.childCell" 
				:edit="edit"
				:inactive="true"
				@updatedEvents="$emit('updatedEvents')"
				@close="$emit('close'); configuring=false"
				:multiselect="true"
				:configuring="configuring"
				ref="data"
				:updatable="true"
				:filters="filters"
				:paging="paging">
			<n-collapsible title="Multi select settings" slot="settings">
				<n-form-combo label="Display Type" :filter="getDisplayOptions" v-model="cell.state.displayType"/>
				<n-form-combo label="Value Field" :filter="getValueFields" v-model="cell.state.valueField"/>
				<n-form-combo label="Id Field" :filter="getValueFields" v-model="cell.state.idField"/>
			</n-collapsible>
		</data-common-header>
		
		<div class="data-multi-select-content">
			<div v-route-render="{alias: cell.state.displayType, parameters: { showEmpty:true,cell:cell.state.childCell, page:page, edit:edit, parameters:parameters,selected:sourceSelected }}" 
				v-if="cell.state.displayType"
				class="source"/>
			<div class="data-multi-select-actions">
				<button @click="addAll"><span class="fa fa-chevron-right"></span></button>
				<button @click="removeAll"><span class="fa fa-chevron-left"></span></button>
				<button v-if="edit" @click="configure()"><span class="fa fa-cog"></span></button>
			</div>
			<div v-route-render="{alias: cell.state.displayType, parameters: { showEmpty:true,cell:cell.state.childCell, page:page, edit:edit, parameters:parameters,selected:targetSelected, records:targetRecords, inactive:true }}" 
				v-if="cell.state.displayType"
				class="target"/>
		</div>
	</div>
</template>