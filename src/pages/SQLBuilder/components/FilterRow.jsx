import { XMarkIcon } from "@heroicons/react/24/outline";
import { filterJoinOptions, getFilterOperatorsForType, valueTypes } from "../../../data/databaseSchema";
import FilterValueInput from "./FilterValueInput";

/**
 * Individual Filter Row component
 */
const FilterRow = ({
  filter,
  index,
  selectedTable,
  availableColumns,
  allAvailableColumns,
  updateFilter,
  removeFilter,
  getColumnTypeFn
}) => {
  return (
    <div className="sql-builder__filter-row">
      {/* Individual Join Type Selector (shown after first filter) */}
      {index > 0 && (
        <div className="sql-builder__filter-join-inline">
          {filterJoinOptions.map(option => (
            <button
              key={option.id}
              type="button"
              className={`sql-builder__filter-join-btn ${filter.joinType === option.id ? "is-active" : ""}`}
              onClick={() => updateFilter(filter.id, "joinType", option.id)}
              title={option.label}
            >
              {option.id}
            </button>
          ))}
        </div>
      )}
      
      <div className="sql-builder__filter-controls">
        {/* Column selector - only main table columns for pre-join filter */}
        <select
          value={filter.column}
          onChange={(e) => updateFilter(filter.id, "column", e.target.value)}
          className="sql-builder__filter-column"
        >
          <option value="">Select column...</option>
          {availableColumns.map(col => (
            <option key={col.id} value={`${selectedTable}.${col.id}`}>
              {selectedTable}.{col.name} ({col.type})
            </option>
          ))}
        </select>

        {/* Operator selector */}
        <select
          value={filter.operator}
          onChange={(e) => updateFilter(filter.id, "operator", e.target.value)}
          className="sql-builder__filter-operator"
          disabled={!filter.column}
        >
          {filter.column 
            ? getFilterOperatorsForType(getColumnTypeFn(filter.column)).map(op => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))
            : []
          }
        </select>

        {/* Value Type Selector */}
        <div className="sql-builder__value-type-selector">
          {valueTypes.map(vt => (
            <button
              key={vt.id}
              type="button"
              className={`sql-builder__value-type-btn ${filter.valueType === vt.id ? "is-active" : ""}`}
              onClick={() => updateFilter(filter.id, "valueType", vt.id)}
              title={vt.label}
              disabled={filter.operator === "IS NULL" || filter.operator === "IS NOT NULL"}
            >
              {vt.name}
            </button>
          ))}
        </div>

        {/* Value Input */}
        <FilterValueInput
          filter={filter}
          allAvailableColumns={allAvailableColumns}
          updateFilter={updateFilter}
          getColumnTypeFn={getColumnTypeFn}
        />

        <button
          type="button"
          className="sql-builder__remove-filter"
          onClick={() => removeFilter(filter.id)}
          title="Remove filter"
        >
          <XMarkIcon />
        </button>
      </div>
    </div>
  );
};

export default FilterRow;

