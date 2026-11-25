import { TableCellsIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

/**
 * Column Selection component - for selecting output columns from both tables
 * Collapsible section
 * Now filters columns based on what's selected in each table's "Select Columns" dropdown
 */
const ColumnSelection = ({
  table1,
  table1CteName,
  table2,
  table2CteName,
  allAvailableColumns,
  selectedColumns,
  onColumnToggle,
  onSelectAll,
  isExpanded = true,
  onToggleExpand = null,
  // New props for filtering based on table card column selection
  table1SelectedColumns = [],
  table2SelectedColumns = []
}) => {
  const isEnabled = table1;
  const cte1Name = table1CteName || `${table1}_filtered`;
  const cte2Name = table2 ? (table2CteName || `${table2}_filtered`) : null;

  if (!isEnabled) {
    return null;
  }

  // Group columns by table
  let table1Cols = allAvailableColumns.filter(col => col.cteName === cte1Name);
  let table2Cols = cte2Name ? allAvailableColumns.filter(col => col.cteName === cte2Name) : [];

  // Filter based on what's selected in the table card's "Select Columns" dropdown
  // If table1SelectedColumns is empty, show all columns (empty = all)
  // If it has specific columns, only show those
  // Note: table1SelectedColumns contains column IDs (e.g., "order_id", "customer_name")
  if (table1SelectedColumns.length > 0) {
    table1Cols = table1Cols.filter(col => table1SelectedColumns.includes(col.id));
  }
  
  if (table2SelectedColumns.length > 0) {
    table2Cols = table2Cols.filter(col => table2SelectedColumns.includes(col.id));
  }

  // Calculate total available columns after filtering
  const filteredAvailableColumns = [...table1Cols, ...table2Cols];
  
  // Check if all filtered columns are selected
  const allFilteredSelected = filteredAvailableColumns.length > 0 && 
    filteredAvailableColumns.every(col => selectedColumns.includes(col.fullId));
  
  // Count how many of the filtered columns are selected
  const selectedFilteredCount = filteredAvailableColumns.filter(col => 
    selectedColumns.includes(col.fullId)
  ).length;

  const stepNumber = table2 ? 4 : 2;

  return (
    <div className="sql-builder__table-card">
      {/* Collapsible Header */}
      <div 
        className="sql-builder__table-card-header sql-builder__table-card-header--clickable"
        onClick={onToggleExpand}
      >
        <div className="sql-builder__table-card-title">
          <span className="sql-builder__expand-icon">
            {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </span>
          <span className="sql-builder__step-indicator">{stepNumber}</span>
          <TableCellsIcon />
          <span>Choose Columns</span>
        </div>
        <button
          type="button"
          className="sql-builder__table-card-badge sql-builder__table-card-badge--clickable"
          onClick={(e) => {
            e.stopPropagation();
            // Pass the filtered columns so only those are selected/deselected
            onSelectAll(filteredAvailableColumns);
          }}
        >
          {allFilteredSelected ? "Deselect All" : selectedFilteredCount === 0 ? "All Columns" : `${selectedFilteredCount} selected`}
        </button>
      </div>
      
      {/* Collapsible Body */}
      {isExpanded && (
        <div className="sql-builder__table-card-body">
          <div className="sql-builder__section">
            <div className="sql-builder__section-header">
              <span>Which columns to show in results</span>
              <span className="sql-builder__optional">(empty = all columns)</span>
            </div>
            
            <div className="sql-builder__column-grid">
              {/* Table 1 Columns */}
              {table1Cols.length > 0 && (
                <div className="sql-builder__column-group">
                  <div className="sql-builder__column-group-header">From {table1}</div>
                  <div className="sql-builder__column-list">
                    {table1Cols.map(col => (
                      <label key={col.fullId} className="sql-builder__column-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col.fullId)}
                          onChange={() => onColumnToggle(col.fullId)}
                        />
                        <span className="sql-builder__column-checkbox-box">
                          {selectedColumns.includes(col.fullId) && <CheckIcon />}
                        </span>
                        <span className="sql-builder__column-name">{col.name}</span>
                        <span className="sql-builder__column-type">{col.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Table 2 Columns */}
              {table2Cols.length > 0 && (
                <div className="sql-builder__column-group">
                  <div className="sql-builder__column-group-header">From {table2}</div>
                  <div className="sql-builder__column-list">
                    {table2Cols.map(col => (
                      <label key={col.fullId} className="sql-builder__column-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col.fullId)}
                          onChange={() => onColumnToggle(col.fullId)}
                        />
                        <span className="sql-builder__column-checkbox-box">
                          {selectedColumns.includes(col.fullId) && <CheckIcon />}
                        </span>
                        <span className="sql-builder__column-name">{col.name}</span>
                        <span className="sql-builder__column-type">{col.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnSelection;
