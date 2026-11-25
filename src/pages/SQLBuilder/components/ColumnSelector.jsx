import { TableCellsIcon, TrashIcon, PlusIcon } from "@heroicons/react/24/outline";
import { aggregationFunctions } from "../../../data/databaseSchema";

/**
 * Column Selector component
 */
const ColumnSelector = ({
  selectedColumns,
  allAvailableColumns,
  onColumnChange,
  onClearColumns
}) => {
  return (
    <div className="sql-builder__section">
      <div className="sql-builder__section-header">
        <TableCellsIcon />
        <span>Column</span>
        <span className="sql-builder__section-sub">Aggregation</span>
        <span className="sql-builder__section-sub">- optional</span>
        <button
          type="button"
          className="sql-builder__delete-btn"
          title="Clear selection"
          onClick={onClearColumns}
        >
          <TrashIcon />
        </button>
      </div>
      
      {/* Column Selection Dropdown */}
      <div className="sql-builder__column-row">
        <select
          value={selectedColumns[0] || "*"}
          onChange={(e) => {
            if (e.target.value === "*") {
              onColumnChange([]);
            } else {
              onColumnChange([e.target.value]);
            }
          }}
          className="sql-builder__column-select"
        >
          <option value="*">*</option>
          {allAvailableColumns.map(col => (
            <option key={col.fullId} value={col.fullId}>
              {col.tableDisplayName || col.tableName}.{col.name}
            </option>
          ))}
        </select>
        
        <select className="sql-builder__aggregation-select">
          <option value="">No aggregation</option>
          {aggregationFunctions.map(agg => (
            <option key={agg.id} value={agg.id}>{agg.name}</option>
          ))}
        </select>
        
        <button
          type="button"
          className="sql-builder__delete-btn"
          onClick={onClearColumns}
        >
          <TrashIcon />
        </button>
      </div>

      {/* Add more columns button */}
      <button
        type="button"
        className="sql-builder__add-btn"
        onClick={() => {/* Add column logic */}}
      >
        <PlusIcon />
      </button>
    </div>
  );
};

export default ColumnSelector;

