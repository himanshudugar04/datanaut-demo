import { useState, useEffect } from "react";
import { getOperatorCategory, getAggregationFunctionsForType, aggregationFunctions } from "../../../data/databaseSchema";
import { getInputType, getNumericColumns } from "../utils/filterHelpers";
import { fetchTableColumns, fetchSavedDatasetColumns, fetchSavedDatasetSQL } from "../../../services/databaseApi";

/**
 * Filter Value Input component - renders appropriate input based on filter type
 */
const FilterValueInput = ({
  filter,
  allAvailableColumns,
  updateFilter,
  getColumnTypeFn,
  // New props for database option
  selectedDatabase = "",
  selectedDataset = "",
  availableTables = [],
  // Track tables already used by DATABASE derived filters
  usedDatabaseTableIds = null
}) => {
  const columnType = getColumnTypeFn(filter.column);
  const category = getOperatorCategory(columnType);
  const inputType = getInputType(columnType);
  const isDisabled = filter.operator === "IS NULL" || filter.operator === "IS NOT NULL";
  
  // State for database function option - tables with single column
  const [singleColumnTables, setSingleColumnTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  // Check if DATABASE function is selected
  const isDatabaseFunction = filter.aggregation === "DATABASE";
  
  // Fetch single-column tables when DATABASE function is selected
  useEffect(() => {
    const fetchSingleColumnTables = async () => {
      if (filter.valueType === "derived" && isDatabaseFunction && selectedDatabase && selectedDataset && availableTables.length > 0) {
        setLoadingTables(true);
        const usedTableSet = usedDatabaseTableIds?.has
          ? usedDatabaseTableIds
          : new Set(Array.isArray(usedDatabaseTableIds) ? usedDatabaseTableIds : []);
        const isUsedElsewhere = (tableId) => usedTableSet.has(tableId) && tableId !== filter.aggregationTable;
        const tablesWithSingleColumn = [];
        
        // Check each table for single column
        for (const table of availableTables) {
          if (isUsedElsewhere(table.id)) {
            continue;
          }
          try {
            let columnsResult;

            // Saved datasets need a different API call to fetch their columns
         if (table.id?.startsWith("saved_")) {
  const datasetId = table.id.replace("saved_", "");
  const [savedDatasetColumns, savedDatasetSQL] = await Promise.all([
    fetchSavedDatasetColumns(datasetId),
    fetchSavedDatasetSQL(datasetId)
  ]);

  const savedColumns = Array.isArray(savedDatasetColumns?.columns)
    ? savedDatasetColumns.columns
    : savedDatasetColumns;

  if (savedColumns && savedColumns.length === 1) {
    tablesWithSingleColumn.push({
      ...table,
      column: savedColumns[0],                       // lone column object
      savedSQL: savedDatasetSQL?.sql_definition || "",
      savedDatasetName: savedDatasetColumns?.dataset_name || table.name
    });
  }
  continue;
}
else {
              const datasetId = table.datasetId || selectedDataset;
              columnsResult = await fetchTableColumns(selectedDatabase, datasetId, table.id);
            }

            const columns = Array.isArray(columnsResult) ? columnsResult : columnsResult?.columns;

            if (columns && columns.length === 1) {
              tablesWithSingleColumn.push({
                ...table,
                column: columns[0]
              });
            }
          } catch (error) {
            console.error(`Error fetching columns for ${table.id}:`, error);
          }
        }
        
        setSingleColumnTables(
          tablesWithSingleColumn.filter(t => !isUsedElsewhere(t.id))
        );
        setLoadingTables(false);
      }
    };
    
    fetchSingleColumnTables();
  }, [filter.valueType, isDatabaseFunction, selectedDatabase, selectedDataset, availableTables, usedDatabaseTableIds, filter.aggregationTable]);
  
  // If derived value type, show aggregation selector
  if (filter.valueType === "derived") {
    const numericColumns = getNumericColumns(allAvailableColumns);
    const availableAggFuncs = filter.aggregationColumn 
      ? getAggregationFunctionsForType(getColumnTypeFn(filter.aggregationColumn))
      : aggregationFunctions;
    
    return (
      <div className="sql-builder__filter-derived">
        <select
          value={filter.aggregation}
          onChange={(e) => {
            updateFilter(filter.id, "aggregation", e.target.value);
            // Clear column/table selections when changing function
            updateFilter(filter.id, "aggregationColumn", "");
            updateFilter(filter.id, "aggregationTable", "");
            updateFilter(filter.id, "aggregationSavedSQL", "");
            updateFilter(filter.id, "aggregationSavedDatasetName", "");

          }}
          className="sql-builder__filter-aggregation"
          disabled={isDisabled}
        >
          <option value="">Function...</option>
          {availableAggFuncs.map(agg => (
            <option key={agg.id} value={agg.id}>{agg.name}</option>
          ))}
        </select>
        <span className="sql-builder__filter-derived-paren">(</span>
        
        {/* Show table selector if DATABASE function is selected, otherwise show column selector */}
        {isDatabaseFunction ? (
          <select
            value={filter.aggregationTable || ""}
            onChange={(e) => {
             const selectedTable = singleColumnTables.find(t => t.id === e.target.value);
updateFilter(filter.id, "aggregationTable", e.target.value);
if (selectedTable && selectedTable.column) {
  const datasetId = selectedTable.datasetId || selectedDataset;
  const isSaved = selectedTable.id?.startsWith("saved_");
  if (isSaved) {
    updateFilter(filter.id, "aggregationColumn", selectedTable.column.id); // no prefix
    updateFilter(filter.id, "aggregationSavedSQL", selectedTable.savedSQL || "");
    updateFilter(filter.id, "aggregationSavedDatasetName", selectedTable.savedDatasetName || selectedTable.name || selectedTable.id);
  } else {
    updateFilter(filter.id, "aggregationColumn", `${selectedDatabase}.${datasetId}.${selectedTable.id}.${selectedTable.column.id}`);
    updateFilter(filter.id, "aggregationSavedSQL", "");
    updateFilter(filter.id, "aggregationSavedDatasetName", "");
  }
}

            }}
            className="sql-builder__filter-agg-column"
            disabled={isDisabled || loadingTables}
          >
            <option value="">
              {loadingTables ? "Loading tables..." : "Select table (single column only)..."}
            </option>
            {singleColumnTables.map(table => (
              <option key={table.id} value={table.id}>
                {table.name} ({table.column?.name || table.column?.id})
              </option>
            ))}
          </select>
        ) : (
          <select
            value={filter.aggregationColumn}
            onChange={(e) => updateFilter(filter.id, "aggregationColumn", e.target.value)}
            className="sql-builder__filter-agg-column"
            disabled={isDisabled}
          >
            <option value="">Column...</option>
            {(filter.aggregation === "COUNT" ? allAvailableColumns : numericColumns).map(col => (
              <option key={col.fullId} value={col.fullId}>
                {col.tableDisplayName || col.tableName}.{col.name}
              </option>
            ))}
          </select>
        )}
        
        <span className="sql-builder__filter-derived-paren">)</span>
      </div>
    );
  }
  
  // Boolean type - show select dropdown
  if (category === "BOOLEAN") {
    return (
      <select
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
        className="sql-builder__filter-value"
        disabled={isDisabled}
      >
        <option value="">Select...</option>
        <option value="TRUE">TRUE</option>
        <option value="FALSE">FALSE</option>
      </select>
    );
  }
  
  // BETWEEN operator - show two inputs
  if (filter.operator === "BETWEEN") {
    return (
      <div className="sql-builder__filter-between">
        <input
          type={category === "TIMESTAMP" ? "datetime-local" : inputType}
          step={category === "TIMESTAMP" ? "1" : undefined}
          value={filter.value}
          onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
          placeholder={category === "DATE" ? "Start" : category === "TIMESTAMP" ? "Start" : "Min"}
          className="sql-builder__filter-value sql-builder__filter-value--between"
          disabled={isDisabled}
        />
        <span className="sql-builder__filter-between-label">and</span>
        <input
          type={category === "TIMESTAMP" ? "datetime-local" : inputType}
          step={category === "TIMESTAMP" ? "1" : undefined}
          value={filter.value2}
          onChange={(e) => updateFilter(filter.id, "value2", e.target.value)}
          placeholder={category === "DATE" ? "End" : category === "TIMESTAMP" ? "End" : "Max"}
          className="sql-builder__filter-value sql-builder__filter-value--between"
          disabled={isDisabled}
        />
      </div>
    );
  }
  
  // Date type
  if (category === "DATE") {
    return (
      <input
        type="date"
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
        className="sql-builder__filter-value"
        disabled={isDisabled}
      />
    );
  }
  
  // Timestamp type - use datetime-local with seconds support via pattern-restricted text input
  if (category === "TIMESTAMP") {
    return (
      <input
        type="datetime-local"
        step="1"
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
        className="sql-builder__filter-value"
        disabled={isDisabled}
      />
    );
  }
  
  // IN/NOT IN - show input for multiple values
  if (filter.operator === "IN" || filter.operator === "NOT IN") {
    return (
      <input
        type="text"
        value={filter.value}
        onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
        placeholder="'val1', 'val2'..."
        className="sql-builder__filter-value"
        disabled={isDisabled}
      />
    );
  }
  
  // Default text/number input
  return (
    <input
      type={inputType === "number" ? "number" : "text"}
      value={filter.value}
      onChange={(e) => updateFilter(filter.id, "value", e.target.value)}
      placeholder={category === "NUMERIC" ? "0" : "Value..."}
      className="sql-builder__filter-value"
      disabled={isDisabled}
      step={category === "NUMERIC" ? "any" : undefined}
    />
  );
};

export default FilterValueInput;
