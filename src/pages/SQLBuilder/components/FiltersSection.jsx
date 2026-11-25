import { FunnelIcon, PlusIcon } from "@heroicons/react/24/outline";
import FilterRow from "./FilterRow";

/**
 * Filters Section component
 */
const FiltersSection = ({
  selectedTable,
  filters,
  availableColumns,
  allAvailableColumns,
  addFilter,
  updateFilter,
  removeFilter,
  getColumnTypeFn
}) => {
  return (
    <div className="sql-builder__section">
      <div className="sql-builder__section-header">
        <FunnelIcon />
        <span>Filter on {selectedTable}</span>
        <span className="sql-builder__optional">- applied before join</span>
      </div>
      
      <div className="sql-builder__filters">
        {filters.map((filter, index) => (
          <FilterRow
            key={filter.id}
            filter={filter}
            index={index}
            selectedTable={selectedTable}
            availableColumns={availableColumns}
            allAvailableColumns={allAvailableColumns}
            updateFilter={updateFilter}
            removeFilter={removeFilter}
            getColumnTypeFn={getColumnTypeFn}
          />
        ))}
        
        <button
          type="button"
          className="sql-builder__add-filter"
          onClick={addFilter}
          title="Add new filter"
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
};

export default FiltersSection;

