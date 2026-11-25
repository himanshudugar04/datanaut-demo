
import { useState } from "react";
import { 
  TableCellsIcon, 
  FunnelIcon, 
  PlusIcon, 
  XMarkIcon, 
  ChevronDownIcon, 
  ChevronRightIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ViewColumnsIcon,
  EyeIcon,
  LinkIcon,
  PlayIcon,
  BookmarkIcon
} from "@heroicons/react/24/outline";
import { filterJoinOptions, getFilterOperatorsForType, valueTypes, columnRoles, getColumnRolesForType, getOperatorCategory, havingOperators } from "../../../data/databaseSchema";
import FilterValueInput from "./FilterValueInput";
import HintModal, { AndOrContent, ChainContent, GroupByContent, AggregationContent, OrderByContent, LimitContent } from "./HintModal";
import { useQueryExecution } from "../hooks/useQueryExecution";
import { generateSingleTableSQL, generateSavedDatasetSQL, transformSQLForSaveDataset } from "../utils/sqlHelpers";
import { saveDataset, executeQuery} from "../../../services/databaseApi";

// Normalize API error payloads (handles FastAPI detail/message/error shapes)
const getApiErrorMessage = (err) => {
  const data = err?.response?.data || err;
  if (data?.message) return data.message;
  if (data?.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.detail === "object" && data.detail.message) return data.detail.message;
  }
  if (Array.isArray(data) && data[0]?.message) return data[0].message;
  if (data?.error) return data.error;
  if (typeof data === "string") return data;
  return err?.message;
};

// Friendly operator display names
const operatorDisplayNames = {
  "=": "= (equal to)",
  "!=": "!= (not equal to)",
  ">": "> (greater than)",
  "<": "< (less than)",
  ">=": ">= (greater or equal)",
  "<=": "<= (less or equal)",
  "LIKE": "LIKE (contains)",
  "NOT LIKE": "NOT LIKE (doesn't contain)",
  "STARTS WITH": "STARTS WITH",
  "ENDS WITH": "ENDS WITH",
  "IN": "IN (is one of)",
  "NOT IN": "NOT IN (is not one of)",
  "BETWEEN": "BETWEEN (range)",
  "IS NULL": "IS NULL (empty)",
  "IS NOT NULL": "IS NOT NULL (has value)"
};

// Value type hints
const valueTypeHints = {
  direct: "Enter a specific value (number or text)",
  derived: "Use functions like Average, Sum, Min, Max"
};

/**
 * Get the chain tooltip text based on current chaining state
 * @param {Array} filters - All filters
 * @param {number} currentIndex - Index of the current filter (the one that would be chained)
 * @returns {string} - Tooltip text
 */
const getChainTooltip = (filters, currentIndex) => {
  if (currentIndex <= 0) return "";
  
  // Find the start of the current chain group by looking backwards
  let chainStartIndex = currentIndex - 1;
  
  // Check if the previous filter is already chained with something before it
  for (let i = currentIndex - 2; i >= 0; i--) {
    if (filters[i].chainWithNext) {
      chainStartIndex = i;
    } else {
      break;
    }
  }
  
  // Build the list of filters that would be in the chain
  const chainedFilterNumbers = [];
  for (let i = chainStartIndex; i < currentIndex; i++) {
    chainedFilterNumbers.push(i + 1); // 1-indexed for display
  }
  
  const currentFilterNum = currentIndex + 1;
  
  if (chainedFilterNumbers.length === 1) {
    return `Chain Filter ${currentFilterNum} with Filter ${chainedFilterNumbers[0]}`;
  } else {
    return `Chain Filter ${currentFilterNum} with Filter ${chainedFilterNumbers.join(", ")}`;
  }
};

/**
 * Table Card component - for selecting a table, applying filters
 */
const TableCard = ({
  tableNumber,
  selectedTable,
  selectedDataset = "",
  datasets = [],
  cteName,
  defaultCteName,
  filters,
  filterEnabled = true,
  onFilterToggle = null,
  availableTables,
  tableColumns,
  allAvailableColumns,
  onTableChange,
  onDatasetChange = null,
  onCteNameChange,
  onAddFilter,
  onUpdateFilter,
  onRemoveFilter,
  getColumnTypeFn,
  excludeTable = null,
  showDatabaseSelector = false,
  databases = [],
  selectedDatabase = "",
  onDatabaseChange = null,
  loadingTables = false,
  isExpanded = true,
  onToggleExpand = null,
  usedDatabaseTableIds = null,
  // Props for column selection
  previewColumns = [],
  onPreviewColumnsChange = null,
  // New props for table data preview
  tableData = null,
  // Display name for saved datasets
  tableDisplayName = "",
  // SQL definition for saved datasets
  savedDatasetSQL = "",
  // Aggregation props
  groupByEnabled = false,
  onToggleGroupBy = null,
  groupByColumns = [],
  onAddGroupByColumn = null,
  onUpdateGroupByColumn = null,
  onRemoveGroupByColumn = null,
  aggregationEnabled = false,
  onToggleAggregation = null,
  aggregationColumns = [],
  onAddAggregationColumn = null,
  onUpdateAggregationColumn = null,
  onRemoveAggregationColumn = null,
  havingConditions = [],
  havingColumnOptions = [],
  onAddHavingCondition = null,
  onUpdateHavingCondition = null,
  onRemoveHavingCondition = null,
  // ORDER BY and LIMIT props (array-based)
  orderByColumns = [],
  orderByColumnOptions = null, // Effective columns for ORDER BY (GROUP BY columns + aggregation when enabled)
  onAddOrderByColumn = null,
  onUpdateOrderByColumn = null,
  onRemoveOrderByColumn = null,
  limitEnabled = false,
  generatedSQL,
  onLimitEnabledChange = null,
  limitValue = 100,
  onLimitValueChange = null,
  onAfterSave = null
}) => {
  const isActive = !!selectedTable;
  const displayCteName = cteName || defaultCteName;
  
  // Collapsible state for advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  // Modal state for help (AND/OR, Chain, GroupBy, OrderBy)
  const [hintModal, setHintModal] = useState({ open: false, type: null, category: null });
  // Column selector dropdown state
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  // State for data preview modal
  const [showDataPreviewModal, setShowDataPreviewModal] = useState(false);
  // State for filtered data preview modal
  const [showFilteredPreviewModal, setShowFilteredPreviewModal] = useState(false);
  // State for save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTableName, setSaveTableName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // State for aggregation section visibility
  const [showAggregationSection, setShowAggregationSection] = useState(false);
  const [showHavingSection, setShowHavingSection] = useState(false);
  const [showGroupBySection, setShowGroupBySection] = useState(false);

  // Get sample data for preview
  const sampleData = tableData?.sampleData || [];

  // State for saved dataset preview data (fetched on-demand)
  const [savedDatasetPreviewData, setSavedDatasetPreviewData] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Check if this is a saved dataset
  const isSavedDataset = selectedTable?.startsWith('saved_');

  // Query execution hook for filtered preview
  const { executing, queryResult, queryError, runQuery, clearResults } = useQueryExecution();

  // Handle save table
   const handleSaveTable = async () => {
    const trimmed = (saveTableName || "").trim();
    if (!trimmed) return setSaveError("Table name is required");
    if (!generatedSQL) return setSaveError("No SQL available to save");

    setIsSaving(true);
    setSaveError("");

    try {
     

      const baseSql = generatedSQL.trim().replace(/;$/, "");
      const sqlDefinition = transformSQLForSaveDataset(baseSql, trimmed);

      const useGroup = groupByEnabled || aggregationEnabled;
      let columnInfo;

      if (useGroup) {
        const cols = [];
        groupByColumns.filter(c => c.column).forEach(c => {
          const name = c.column.split(".").pop();
          cols.push({ name, type: getColumnTypeFn(c.column) || "STRING" });
        });
        aggregationColumns.filter(c => c.column).forEach(c => {
          const baseName = c.column === "*" ? "*" : c.column.split(".").pop();
          const name = c.alias || (c.role === "COUNT_DISTINCT"
            ? `COUNT(DISTINCT ${baseName})`
            : `${c.role}(${baseName})`);
          const type =
            c.role === "COUNT" || c.role === "COUNT_DISTINCT" ? "INTEGER" :
            c.role === "AVG" ? "FLOAT64" :
            getColumnTypeFn(c.column) || "STRING";
          cols.push({ name, type });
        });
        columnInfo = cols;
      } else {
        const colsToSave = previewColumns.length > 0
          ? tableColumns.filter(col => previewColumns.includes(col.id))
          : tableColumns;
        columnInfo = colsToSave.map(col => ({
          name: col.name || col.id,
          type: col.type || getColumnTypeFn(col.id) || "STRING"
        }));
      }

      await saveDataset({ datasetName: trimmed, sqlDefinition, columnInfo, createdBy: null });
      setShowSaveModal(false);
      setSaveTableName("");
      if (onAfterSave) {
        onAfterSave();
      }
    } catch (err) {
      setSaveError(getApiErrorMessage(err) || "Failed to save dataset");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle filtered preview (play button)
  const handleFilteredPreview = async (e) => {
    e.stopPropagation();
    
    if (!selectedTable || !selectedDatabase) {
      console.log("Missing required data:", { selectedTable, selectedDatabase, selectedDataset });
      return;
    }

    let sql;
    
    // Build options for ORDER BY and LIMIT (array-based)
    const sqlOptions = {
      orderByColumns,
      limitEnabled,
      limitValue,
      filterEnabled,
      groupByEnabled,
      groupByColumns,
      aggregationEnabled,
      aggregationColumns,
      havingConditions
    };

    if (isSavedDataset && savedDatasetSQL) {
      // For saved datasets, use the saved SQL with filters/columns applied
      const displayName = tableDisplayName || selectedTable;
      sql = generateSavedDatasetSQL(
        savedDatasetSQL,
        displayName,
        filters,
        previewColumns,
        getColumnTypeFn,
        selectedDatabase,
        selectedDataset,
        sqlOptions
      );
      console.log("Using saved dataset SQL with filters:", sql);
    } else if (!isSavedDataset && selectedDataset) {
      // For regular tables, generate SQL
      sql = generateSingleTableSQL(
        selectedDatabase,
        selectedDataset,
        selectedTable,
        filters,
        previewColumns,
        getColumnTypeFn,
        sqlOptions
      );
    } else {
      console.log("Cannot generate SQL - missing dataset or saved SQL");
      return;
    }

    console.log("Generated SQL:", sql);
    console.log("Filters:", filters);

    if (!sql) {
      console.log("No SQL generated");
      return;
    }

    // Clear previous results and open modal
    clearResults();
    setShowFilteredPreviewModal(true);

    // Execute the query
    try {
      await runQuery(sql);
      console.log("Query executed, result:", queryResult);
    } catch (error) {
      console.error("Query execution error:", error);
    }
  };

  // Handle column toggle for preview
  const handleColumnToggle = (columnId) => {
    if (!onPreviewColumnsChange) return;
    
    if (previewColumns.includes(columnId)) {
      onPreviewColumnsChange(previewColumns.filter(c => c !== columnId));
    } else {
      onPreviewColumnsChange([...previewColumns, columnId]);
    }
  };

  // Select all columns - explicitly select all column IDs
  const handleSelectAllColumns = () => {
    if (!onPreviewColumnsChange) return;
    onPreviewColumnsChange(tableColumns.map(c => c.id));
  };

  // Clear all columns - set to empty array
  const handleClearAllColumns = () => {
    if (!onPreviewColumnsChange) return;
    onPreviewColumnsChange([]);
  };

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
          <span className="sql-builder__step-indicator">{tableNumber}</span>
          <TableCellsIcon />
          <span>Table {tableNumber}</span>
        </div>
        <div className="sql-builder__table-card-actions">
          {isActive && (
            <span className="sql-builder__table-card-badge">
              {tableDisplayName || selectedTable}
            </span>
          )}
          {isActive && (
            <div className="sql-builder__table-card-toggles" onClick={(e) => e.stopPropagation()}>
              <div className="sql-builder__toggle-group">
                <span className="sql-builder__toggle-text">Filter</span>
                <label className="sql-builder__toggle-switch sql-builder__toggle-switch--inline">
                  <input
                    type="checkbox"
                    checked={filterEnabled}
                    onChange={(e) => onFilterToggle && onFilterToggle(e.target.checked)}
                  />
                  <span className="sql-builder__toggle-slider"></span>
                </label>
              </div>

              <div className="sql-builder__toggle-group">
                <span className="sql-builder__toggle-text">Group By</span>
                <button
                  type="button"
                  className="sql-builder__hint-btn sql-builder__hint-btn--toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHintModal({ open: true, type: "groupby", category: "groupby" });
                  }}
                  title="Learn about GROUP BY"
                >
                  <QuestionMarkCircleIcon />
                </button>
                <label className="sql-builder__toggle-switch sql-builder__toggle-switch--inline">
                  <input
                    type="checkbox"
                    checked={groupByEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (onToggleGroupBy) {
                        onToggleGroupBy(next);
                      }
                      if (!next && aggregationEnabled && onToggleAggregation) {
                        onToggleAggregation(false);
                      }
                    }}
                  />
                  <span className="sql-builder__toggle-slider"></span>
                </label>
              </div>

              <div className="sql-builder__toggle-group">
                <span className="sql-builder__toggle-text">Aggregation</span>
                <button
                  type="button"
                  className="sql-builder__hint-btn sql-builder__hint-btn--toggle"
                  onClick={(e) => {
                    e.stopPropagation();
                    setHintModal({ open: true, type: "aggregation", category: "aggregation" });
                  }}
                  title="Learn about Aggregation & HAVING"
                >
                  <QuestionMarkCircleIcon />
                </button>
                <label className="sql-builder__toggle-switch sql-builder__toggle-switch--inline">
                  <input
                    type="checkbox"
                    checked={aggregationEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next && onToggleGroupBy && !groupByEnabled) {
                        onToggleGroupBy(true);
                      }
                      onToggleAggregation && onToggleAggregation(next);
                    }}
                  />
                  <span className="sql-builder__toggle-slider"></span>
                </label>
              </div>
            </div>
          )}
          {/* Play Button - Preview Filtered Data */}
          {isActive && (
            <>
  
              <button
                type="button"
                className="sql-builder__preview-filtered-btn"
                onClick={handleFilteredPreview}
                title="Preview Filtered Data"
                disabled={executing}
              >
                <PlayIcon />
              </button>
              {/* Save Button */}
               {tableNumber !== 2 && (
              <button
                type="button"
                className="sql-builder__save-table-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSaveModal(true);
                  setSaveTableName("");
                  setSaveError("");
                }}
                title="Save Table"
              >
                <BookmarkIcon />
              </button>
              )}
            </>
          )}
          {/* Data Preview Icon - show when we have data OR for saved datasets */}
          {isActive && (sampleData.length > 0 || (isSavedDataset && savedDatasetSQL)) && (
            <button
              type="button"
              className="sql-builder__preview-data-btn"
              onClick={async (e) => {
                e.stopPropagation();
                // For saved datasets, fetch data on-demand if not already loaded
                if (isSavedDataset && savedDatasetSQL && savedDatasetPreviewData.length === 0) {
                  setIsLoadingPreview(true);
                  try {
                    const sql = `${savedDatasetSQL.replace(/''/g, "'").trim().replace(/;$/, '')} LIMIT 10`;
                    const result = await executeQuery(sql);
                    if (result && result.data && result.data.length > 0) {
                      setSavedDatasetPreviewData(result.data);
                    }
                  } catch (error) {
                    console.error("Error fetching saved dataset preview:", error);
                  } finally {
                    setIsLoadingPreview(false);
                  }
                }
                setShowDataPreviewModal(!showDataPreviewModal);
              }}
              title="Preview Table Data"
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? (
                <div className="sql-builder__spinner-small"></div>
              ) : (
                <EyeIcon />
              )}
            </button>
          )}
          {/* Advanced Settings Icon */}
          {isActive && (
            <button
              type="button"
              className="sql-builder__advanced-settings-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowAdvancedSettings(!showAdvancedSettings);
              }}
              title="Advanced Settings"
            >
              <Cog6ToothIcon />
            </button>
          )}
        </div>
      </div>
      
      {/* Advanced Settings Popup */}
      {showAdvancedSettings && (
        <div className="sql-builder__advanced-popup">
          <div className="sql-builder__advanced-popup-header">
            <span>Advanced Settings</span>
            <button onClick={() => setShowAdvancedSettings(false)}>
              <XMarkIcon />
            </button>
          </div>
          <div className="sql-builder__advanced-popup-body">
            <div className="sql-builder__cte-name">
              <label>Filtered Dataset Name</label>
              <input
                type="text"
                value={cteName}
                onChange={(e) => onCteNameChange(e.target.value)}
                placeholder={defaultCteName || "table_filtered"}
              />
              <small>
                {cteName 
                  ? `Using custom name: "${cteName}"` 
                  : `Using default name: "${defaultCteName || 'table_filtered'}"`}
              </small>
              <small className="sql-builder__cte-hint">
                This name is used in the SQL query to reference this filtered table
              </small>
            </div>
          </div>
        </div>
      )}
      
      {/* Data Preview Modal */}
      {showDataPreviewModal && (() => {
        // Use savedDatasetPreviewData for saved datasets, sampleData for regular tables
        const previewData = isSavedDataset ? savedDatasetPreviewData : sampleData;
        const displayName = tableDisplayName || selectedTable;
        
        if (previewData.length === 0 && !isLoadingPreview) {
          return null;
        }
        
        return (
          <div className="sql-builder__data-preview-modal-overlay">
            <div className="sql-builder__data-preview-modal">
              <div className="sql-builder__data-preview-modal-header">
                <div className="sql-builder__data-preview-modal-title">
                  <TableCellsIcon />
                  <span>Data Preview - {displayName}</span>
                </div>
                <button 
                  className="sql-builder__data-preview-modal-close"
                  onClick={() => setShowDataPreviewModal(false)}
                >
                  <XMarkIcon />
                </button>
              </div>
              <div className="sql-builder__data-preview-modal-body">
                {isLoadingPreview ? (
                  <div className="sql-builder__loading-preview">
                    <div className="sql-builder__spinner-small"></div>
                    <span>Loading preview data...</span>
                  </div>
                ) : (
                  <>
                    <table className="sql-builder__data-table">
                      <thead>
                        <tr>
                          {Object.keys(previewData[0] || {}).map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 10).map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.keys(previewData[0] || {}).map((col) => (
                              <td key={col}>
                                {typeof row[col] === "boolean" 
                                  ? (row[col] ? "TRUE" : "FALSE") 
                                  : String(row[col] ?? "NULL")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="sql-builder__data-preview-modal-footer">
                      <span>Showing {Math.min(previewData.length, 10)} of {previewData.length} sample rows</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filtered Data Preview Modal */}
      {showFilteredPreviewModal && (
        <div className="sql-builder__data-preview-modal-overlay">
          <div className="sql-builder__data-preview-modal">
            <div className="sql-builder__data-preview-modal-header">
              <div className="sql-builder__data-preview-modal-title">
                <PlayIcon />
                <span>Filtered Data Preview - {selectedTable}</span>
              </div>
              <button 
                className="sql-builder__data-preview-modal-close"
                onClick={() => {
                  setShowFilteredPreviewModal(false);
                  clearResults();
                }}
              >
                <XMarkIcon />
              </button>
            </div>
            <div className="sql-builder__data-preview-modal-body">
              {executing ? (
                <div className="sql-builder__loading-state">
                  <span>Executing query...</span>
                </div>
              ) : queryError ? (
                <div className="sql-builder__error-state">
                  <span>Error: {queryError}</span>                </div>
              ) : queryResult ? (
                queryResult.data && queryResult.data.length > 0 ? (
                  <>
                    <table className="sql-builder__data-table">
                      <thead>
                        <tr>
                          {Object.keys(queryResult.data[0]).map(col => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.data.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {Object.keys(queryResult.data[0]).map((col) => (
                              <td key={col}>
                                {row[col] === null ? (
                                  <span className="sql-builder__null-value">NULL</span>
                                ) : typeof row[col] === "boolean" ? (
                                  row[col] ? "TRUE" : "FALSE"
                                ) : typeof row[col] === "object" ? (
                                  JSON.stringify(row[col])
                                ) : (
                                  String(row[col])
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="sql-builder__data-preview-modal-footer">
                      <span>
                        Showing {queryResult.data.length} of {queryResult.rowCount || queryResult.data.length} rows
                        {queryResult.executionTime && ` (${queryResult.executionTime}ms)`}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="sql-builder__no-results">
                    Query executed successfully. No rows returned.
                  </div>
                )
              ) : (
                <div className="sql-builder__loading-state">
                  <span>Preparing query...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Collapsible Body */}
      {isExpanded && (
        <div className="sql-builder__table-card-body">
          {/* Project Selector (for Table 2 cross-project joins) */}
          {showDatabaseSelector && (
            <div className="sql-builder__selector" style={{ marginBottom: '1rem' }}>
              <label>Project</label>
              <select
                value={selectedDatabase}
                onChange={(e) => onDatabaseChange && onDatabaseChange(e.target.value)}
              >
                <option value="">Select project...</option>
                {databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Dataset Selector */}
          {datasets.length > 0 && (
            <div className="sql-builder__selector" style={{ marginBottom: '1rem' }}>
              <label>Dataset</label>
              <select
                value={selectedDataset}
                onChange={(e) => onDatasetChange && onDatasetChange(e.target.value)}
                disabled={showDatabaseSelector && !selectedDatabase}
              >
                <option value="">Select dataset...</option>
                {datasets.map(dataset => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Table Selection and Column Preview Selection in same row */}
          <div className="sql-builder__table-columns-row">
          {/* Table Selection */}
            <div className="sql-builder__selector sql-builder__selector--table">
            <label>Select Table</label>
            <select
              value={selectedTable}
              onChange={(e) => onTableChange(e.target.value)}
              disabled={(showDatabaseSelector && !selectedDatabase) || (datasets.length > 0 && !selectedDataset)}
            >
              <option value="">
                {loadingTables ? "Loading tables..." : "Select table..."}
              </option>
              {availableTables
                .filter(t => t.id !== excludeTable)
                .map(table => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
            </select>
            </div>

            {/* Column Selection for SQL Query - only show when table is selected */}
            {selectedTable && onPreviewColumnsChange && (
              <div className="sql-builder__selector sql-builder__selector--columns">
                <label>Select Columns</label>
                <div className="sql-builder__column-dropdown-wrapper">
                  <button
                    type="button"
                    className="sql-builder__column-dropdown-btn"
                    onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                    disabled={!tableColumns || tableColumns.length === 0}
                  >
                    <ViewColumnsIcon />
                    <span>
                      {!tableColumns || tableColumns.length === 0
                        ? "Loading columns..."
                        : previewColumns.length === 0 
                          ? "All columns (default)" 
                          : previewColumns.length === tableColumns.length 
                            ? "All columns" 
                            : `${previewColumns.length} of ${tableColumns.length} selected`}
                    </span>
                    <ChevronDownIcon className="sql-builder__dropdown-chevron" />
                  </button>
                  
                  {/* Column Dropdown */}
                  {showColumnDropdown && (
                    <div className="sql-builder__column-dropdown">
                      <div className="sql-builder__column-dropdown-header">
                        <button 
                          type="button" 
                          onClick={handleSelectAllColumns}
                          className="sql-builder__column-action-btn"
                        >
                          Select All
                        </button>
                        <button 
                          type="button" 
                          onClick={handleClearAllColumns}
                          className="sql-builder__column-action-btn"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="sql-builder__column-dropdown-list">
                        {tableColumns && tableColumns.length > 0 ? (
                          tableColumns.map(col => (
                            <label key={col.id} className="sql-builder__column-dropdown-item">
                              <input
                                type="checkbox"
                                checked={previewColumns.includes(col.id)}
                                onChange={() => handleColumnToggle(col.id)}
                              />
                              <span className="sql-builder__column-dropdown-name">{col.name}</span>
                              <span className="sql-builder__column-dropdown-type">{col.type}</span>
                            </label>
                          ))
                        ) : (
                          <div className="sql-builder__column-dropdown-empty">
                            <span>No columns available. Make sure dataset is selected.</span>
                          </div>
                        )}
                      </div>
                      <div className="sql-builder__column-dropdown-footer">
                        <button 
                          type="button" 
                          onClick={() => setShowColumnDropdown(false)}
                          className="sql-builder__column-done-btn"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters Section */}
          {selectedTable && filterEnabled && (
            <div className="sql-builder__section">
              <div className="sql-builder__section-header">
                <FunnelIcon />
                <span>Filters</span>
                <span className="sql-builder__optional">(narrow down results)</span>
              </div>
              
              <div className="sql-builder__filters">
                {filters.map((filter, index) => (
                  <div key={filter.id} className="sql-builder__filter-row">
                    {/* AND/OR Selector with Chain Button */}
                    {index > 0 && (
                      <div className="sql-builder__filter-join-inline">
                        {filterJoinOptions.map(option => (
                          <div key={option.id} className="sql-builder__filter-join-wrapper">
                            <button
                              type="button"
                              className={`sql-builder__filter-join-btn ${filter.joinType === option.id ? "is-active" : ""}`}
                              onClick={() => onUpdateFilter(filter.id, "joinType", option.id)}
                            >
                              {option.id}
                            </button>
                            {/* Help Icon - Opens Modal */}
                            <button
                              type="button"
                              className="sql-builder__hint-btn"
                              onClick={() => setHintModal({ open: true, type: option.id })}
                              title={`Learn about ${option.id}`}
                            >
                              <QuestionMarkCircleIcon />
                            </button>
                          </div>
                        ))}
                        
                        {/* Chain Button - toggles chainWithNext on the PREVIOUS filter */}
                        <div className="sql-builder__filter-join-wrapper">
                          <button
                            type="button"
                            className={`sql-builder__chain-btn ${filters[index - 1]?.chainWithNext ? "is-active" : ""}`}
                            onClick={() => onUpdateFilter(filters[index - 1].id, "chainWithNext", !filters[index - 1].chainWithNext)}
                            title={getChainTooltip(filters, index)}
                          >
                            <LinkIcon />
                            <span>Chain</span>
                          </button>
                          {/* Help Icon for Chain */}
                          <button
                            type="button"
                            className="sql-builder__hint-btn sql-builder__hint-btn--chain"
                            onClick={() => setHintModal({ open: true, type: "CHAIN" })}
                            title="Learn about Chain"
                          >
                            <QuestionMarkCircleIcon />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    <div className="sql-builder__filter-controls">
                      {/* Column selector */}
                      <select
                        value={filter.column}
                        onChange={(e) => onUpdateFilter(filter.id, "column", e.target.value)}
                        className="sql-builder__filter-column"
                      >
                        <option value="">Select column...</option>
                        {tableColumns.map(col => (
                          <option key={col.id} value={`${selectedTable}.${col.id}`}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>

                      {/* Operator selector with friendly names */}
                      <select
                        value={filter.operator}
                        onChange={(e) => onUpdateFilter(filter.id, "operator", e.target.value)}
                        className="sql-builder__filter-operator"
                        disabled={!filter.column}
                      >
                        <option value="">Select operation...</option>
                        {filter.column && 
                          getFilterOperatorsForType(getColumnTypeFn(filter.column)).map(op => (
                          <option key={op.id} value={op.id}>
                            {operatorDisplayNames[op.id] || op.name}
                          </option>
                          ))
                        }
                      </select>

                      {/* Value Type Selector Dropdown */}
                      <select
                        value={filter.valueType}
                        onChange={(e) => onUpdateFilter(filter.id, "valueType", e.target.value)}
                        className="sql-builder__filter-value-type"
                        disabled={filter.operator === "IS NULL" || filter.operator === "IS NOT NULL" || !filter.operator}
                      >
                        <option value="">Select value type...</option>
                        {valueTypes.map(vt => (
                          <option key={vt.id} value={vt.id} title={valueTypeHints[vt.id]}>
                            {vt.name}
                          </option>
                        ))}
                      </select>

                      {/* Value Input */}
                      <FilterValueInput
                        filter={filter}
                        allAvailableColumns={allAvailableColumns}
                        updateFilter={onUpdateFilter}
                        getColumnTypeFn={getColumnTypeFn}
                        selectedDatabase={selectedDatabase}
                        selectedDataset={selectedDataset}
                        availableTables={availableTables}
                        usedDatabaseTableIds={usedDatabaseTableIds}
                      />

                      <button
                        type="button"
                        className="sql-builder__remove-filter"
                        onClick={() => onRemoveFilter(filter.id)}
                        title="Remove filter"
                      >
                        <XMarkIcon />
                      </button>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  className="sql-builder__add-filter"
                  onClick={onAddFilter}
                  title="Add new filter"
                >
                  <PlusIcon />
                  <span>Add Filter</span>
                </button>
              </div>
            </div>
          )}

          {/* Group By Section */}
          {selectedTable && groupByEnabled && (
            <div className="sql-builder__section sql-builder__aggregation-section-card">
              <div 
                className="sql-builder__section-header sql-builder__section-header--clickable"
                onClick={() => setShowGroupBySection(!showGroupBySection)}
              >
                <ChevronRightIcon className={`sql-builder__section-chevron ${showGroupBySection ? 'sql-builder__section-chevron--open' : ''}`} />
                <span>Group By</span>
              </div>

              {showGroupBySection && (
                <div className="sql-builder__filters">
                  {(!groupByColumns || groupByColumns.length === 0) ? (
                    <div className="sql-builder__empty-state">
                      <p>Select columns to group your results.</p>
                    </div>
                  ) : (
                    groupByColumns.map((grp) => (
                      <div key={grp.id} className="sql-builder__filter-row">
                        <div className="sql-builder__filter-controls">
                          <select
                            className="sql-builder__filter-column"
                            value={grp.column}
                            onChange={(e) => onUpdateGroupByColumn && onUpdateGroupByColumn(grp.id, "column", e.target.value)}
                          >
                            <option value="">Select column...</option>
                            {tableColumns.map((col) => (
                              <option key={col.id} value={col.id}>
                                {col.name || col.id}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="sql-builder__remove-filter"
                            onClick={() => onRemoveGroupByColumn && onRemoveGroupByColumn(grp.id)}
                            title="Remove"
                          >
                            <XMarkIcon />
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <button
                    type="button"
                    className="sql-builder__add-filter"
                    onClick={() => onAddGroupByColumn && onAddGroupByColumn()}
                  >
                    <PlusIcon />
                    <span>Add Group By</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Aggregation Section */}
          {selectedTable && aggregationEnabled && (
            <div className="sql-builder__section sql-builder__aggregation-section-card">
              <div 
                className="sql-builder__section-header sql-builder__section-header--clickable"
                onClick={() => setShowAggregationSection(!showAggregationSection)}
              >
                <ChevronRightIcon className={`sql-builder__section-chevron ${showAggregationSection ? 'sql-builder__section-chevron--open' : ''}`} />
                <span>Aggregation</span>
              </div>

              {showAggregationSection && (
                <div className="sql-builder__filters">
                  {aggregationColumns.length === 0 ? (
                    <div className="sql-builder__empty-state">
                      <p>Add aggregate functions for your grouped data.</p>
                    </div>
                  ) : (
                    aggregationColumns.map((aggCol) => {
                      const rolesForCol = columnRoles.filter(role => role.id !== "GROUP_BY");
                      return (
                        <div key={aggCol.id} className="sql-builder__filter-row">
                          <div className="sql-builder__filter-controls">
                            <select
                              className="sql-builder__filter-column"
                              value={aggCol.column}
                              onChange={(e) => {
                                onUpdateAggregationColumn && onUpdateAggregationColumn(aggCol.id, "column", e.target.value);
                                if (e.target.value === "*" && aggCol.role !== "COUNT" && onUpdateAggregationColumn) {
                                  onUpdateAggregationColumn(aggCol.id, "role", "COUNT");
                                }
                              }}
                            >
                              <option value="">Select column...</option>
                              <option value="*">*</option>
                              {tableColumns.map((col) => (
                                <option key={col.id} value={col.id}>
                                  {col.name || col.id}
                                </option>
                              ))}
                            </select>

                            <select
                              className="sql-builder__filter-operator"
                              value={aggCol.role}
                              onChange={(e) => onUpdateAggregationColumn && onUpdateAggregationColumn(aggCol.id, "role", e.target.value)}
                            >
                              {rolesForCol.map((role) => {
                                if (!role.supportsAllTypes && aggCol.column && aggCol.column !== "*") {
                                  const colType = getColumnTypeFn ? getColumnTypeFn(aggCol.column) : "STRING";
                                  const category = getOperatorCategory(colType);
                                  if (category !== "NUMERIC" && (role.id === "SUM" || role.id === "AVG")) return null;
                                }
                                if (aggCol.column === "*" && role.id !== "COUNT") {
                                  return null;
                                }
                                return (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                );
                              })}
                            </select>

                            <input
                              type="text"
                              className="sql-builder__filter-value"
                              placeholder="alias (optional)"
                              value={aggCol.alias || ""}
                              onChange={(e) => onUpdateAggregationColumn && onUpdateAggregationColumn(aggCol.id, "alias", e.target.value)}
                            />

                            <button
                              type="button"
                              className="sql-builder__remove-filter"
                              onClick={() => onRemoveAggregationColumn && onRemoveAggregationColumn(aggCol.id)}
                              title="Remove"
                            >
                              <XMarkIcon />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  
                  <button
                    type="button"
                    className="sql-builder__add-filter"
                    onClick={() => onAddAggregationColumn && onAddAggregationColumn()}
                  >
                    <PlusIcon />
                    <span>Add Aggregation</span>
                  </button>

                  {/* HAVING Section - show when there's at least one aggregate with a column selected */}
                  {aggregationColumns.some(c => c.column) && (
                    <div className="sql-builder__having-section">
                      <div 
                        className="sql-builder__section-header"
                        onClick={() => setShowHavingSection(!showHavingSection)}
                        style={{ cursor: 'pointer' }}
                      >
                        {showHavingSection ? <ChevronDownIcon className="sql-builder__section-icon" /> : <ChevronRightIcon className="sql-builder__section-icon" />}
                        <span>HAVING</span>
                        <span className="sql-builder__section-hint">Filter groups after aggregation</span>
                      </div>
                      
                      {showHavingSection && (
                        <div className="sql-builder__filters">
                          {havingConditions.length === 0 ? (
                            <div className="sql-builder__empty-state">
                              <p>No HAVING conditions. Add conditions to filter grouped results.</p>
                            </div>
                          ) : (
                            havingConditions.map((cond, idx) => (
                              <div key={cond.id} className="sql-builder__filter-row">
                                {/* AND/OR and Chain buttons for 2nd+ conditions */}
                                {idx > 0 && (
                                  <div className="sql-builder__filter-join-inline">
                                    {[{ id: "AND" }, { id: "OR" }].map((option) => (
                                      <div key={option.id} className="sql-builder__filter-join-wrapper">
                                        <button
                                          type="button"
                                          className={`sql-builder__filter-join-btn ${cond.joinType === option.id ? "is-active" : ""}`}
                                          onClick={() => onUpdateHavingCondition && onUpdateHavingCondition(cond.id, "joinType", option.id)}
                                        >
                                          {option.id}
                                        </button>
                                      </div>
                                    ))}
                                    
                                    {/* Chain Button */}
                                    <div className="sql-builder__filter-join-wrapper">
                                      <button
                                        type="button"
                                        className={`sql-builder__chain-btn ${havingConditions[idx - 1]?.chainWithNext ? "is-active" : ""}`}
                                        onClick={() => onUpdateHavingCondition && onUpdateHavingCondition(havingConditions[idx - 1].id, "chainWithNext", !havingConditions[idx - 1].chainWithNext)}
                                        title="Chain with previous condition"
                                      >
                                        <LinkIcon />
                                        <span>Chain</span>
                                      </button>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="sql-builder__filter-controls">
                                  <select
                                    className="sql-builder__filter-column"
                                    value={cond.column}
                                    onChange={(e) => onUpdateHavingCondition && onUpdateHavingCondition(cond.id, "column", e.target.value)}
                                  >
                                    <option value="">Select...</option>
                                    {havingColumnOptions.map((col) => (
                                      <option key={col.id} value={col.id}>{col.name}</option>
                                    ))}
                                  </select>
                                  
                                  <select
                                    className="sql-builder__filter-operator"
                                    value={cond.operator}
                                    onChange={(e) => onUpdateHavingCondition && onUpdateHavingCondition(cond.id, "operator", e.target.value)}
                                  >
                                    {havingOperators.map((op) => (
                                      <option key={op.id} value={op.id}>{op.id}</option>
                                    ))}
                                  </select>
                                  
                                  <input
                                    type="text"
                                    className="sql-builder__filter-value"
                                    placeholder="value"
                                    value={cond.value || ""}
                                    onChange={(e) => onUpdateHavingCondition && onUpdateHavingCondition(cond.id, "value", e.target.value)}
                                  />
                                  
                                  <button
                                    type="button"
                                    className="sql-builder__remove-filter"
                                    onClick={() => onRemoveHavingCondition && onRemoveHavingCondition(cond.id)}
                                  >
                                    <XMarkIcon />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                          
                          <button
                            type="button"
                            className="sql-builder__add-filter"
                            onClick={() => onAddHavingCondition && onAddHavingCondition()}
                          >
                            <PlusIcon />
                            <span>Add HAVING</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* ORDER BY and LIMIT - inline expandable list (hidden when collapsed) */}
          {selectedTable && (
            <div className="sql-builder__orderby-limit-section">
              <div className="sql-builder__orderby-limit-row">
                <div className="sql-builder__orderby-inline">
                  <span className="sql-builder__inline-label">ORDER BY</span>
                  <button
                    type="button"
                    className="sql-builder__hint-btn sql-builder__hint-btn--small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHintModal({ open: true, type: "orderby", category: "orderby" });
                    }}
                    title="Learn about ORDER BY"
                  >
                    <QuestionMarkCircleIcon />
                  </button>
                  {/* First ORDER BY row or "None" if empty */}
                  {orderByColumns.length === 0 ? (
                    <>
                      <span className="sql-builder__orderby-none">None</span>
                      <button
                        type="button"
                        className="sql-builder__orderby-add-btn"
                        onClick={() => onAddOrderByColumn && onAddOrderByColumn()}
                        title="Add ORDER BY column"
                      >
                        <PlusIcon />
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        className="sql-builder__inline-select"
                        value={orderByColumns[0]?.column || ""}
                        onChange={(e) => onUpdateOrderByColumn && onUpdateOrderByColumn(orderByColumns[0]?.id, "column", e.target.value)}
                      >
                        <option value="">Select column</option>
                        {(orderByColumnOptions || tableColumns).map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name || col.id}
                          </option>
                        ))}
                      </select>
                      <select
                        className="sql-builder__inline-select sql-builder__inline-select--small"
                        value={orderByColumns[0]?.direction || "ASC"}
                        onChange={(e) => onUpdateOrderByColumn && onUpdateOrderByColumn(orderByColumns[0]?.id, "direction", e.target.value)}
                      >
                        <option value="ASC">ASC</option>
                        <option value="DESC">DESC</option>
                      </select>
                      {orderByColumns.length === 1 && (
                        <button
                          type="button"
                          className="sql-builder__orderby-remove-btn"
                          onClick={() => onRemoveOrderByColumn && onRemoveOrderByColumn(orderByColumns[0]?.id)}
                          title="Remove ORDER BY column"
                        >
                          <XMarkIcon />
                        </button>
                      )}
                      <button
                        type="button"
                        className="sql-builder__orderby-add-btn"
                        onClick={() => onAddOrderByColumn && onAddOrderByColumn()}
                        title="Add another ORDER BY column"
                      >
                        <PlusIcon />
                      </button>
                    </>
                  )}
                </div>
                
                <div className="sql-builder__limit-inline">
                  <label className="sql-builder__inline-checkbox">
                    <input
                      type="checkbox"
                      checked={limitEnabled}
                      onChange={(e) => onLimitEnabledChange && onLimitEnabledChange(e.target.checked)}
                    />
                    <span className="sql-builder__inline-label">LIMIT</span>
                  </label>
                  <button
                    type="button"
                    className="sql-builder__hint-btn sql-builder__hint-btn--small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHintModal({ open: true, type: "limit", category: "limit" });
                    }}
                    title="Learn about LIMIT"
                  >
                    <QuestionMarkCircleIcon />
                  </button>
                  <input
                    type="number"
                    className="sql-builder__inline-input"
                    value={limitValue}
                    onChange={(e) => onLimitValueChange && onLimitValueChange(e.target.value === "" ? "" : parseInt(e.target.value))}
                    disabled={!limitEnabled}
                    min={0}
                    max={10000}
                  />
                </div>
              </div>
              
              {/* Additional ORDER BY columns (expandable) */}
              {orderByColumns.length > 1 && (
                <div className="sql-builder__orderby-additional">
                  {orderByColumns.slice(1).map((orderCol) => (
                    <div key={orderCol.id} className="sql-builder__orderby-row">
                      <span className="sql-builder__orderby-comma">,</span>
                      <select
                        className="sql-builder__inline-select"
                        value={orderCol.column || ""}
                        onChange={(e) => onUpdateOrderByColumn && onUpdateOrderByColumn(orderCol.id, "column", e.target.value)}
                      >
                        <option value="">Select column</option>
                        {(orderByColumnOptions || tableColumns).map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name || col.id}
                          </option>
                        ))}
                      </select>
                      <select
                        className="sql-builder__inline-select sql-builder__inline-select--small"
                        value={orderCol.direction || "ASC"}
                        onChange={(e) => onUpdateOrderByColumn && onUpdateOrderByColumn(orderCol.id, "direction", e.target.value)}
                      >
                        <option value="ASC">ASC</option>
                        <option value="DESC">DESC</option>
                      </select>
                      <button
                        type="button"
                        className="sql-builder__orderby-remove-btn"
                        onClick={() => onRemoveOrderByColumn && onRemoveOrderByColumn(orderCol.id)}
                        title="Remove ORDER BY column"
                      >
                        <XMarkIcon />
                      </button>
                    </div>
                  ))}
                  {/* Add more columns button at end of list */}
                  <button
                    type="button"
                    className="sql-builder__orderby-add-more-btn"
                    onClick={() => onAddOrderByColumn && onAddOrderByColumn()}
                    title="Add another ORDER BY column"
                  >
                    <PlusIcon />
                    <span>Add Column</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Save Table Modal */}
      {tableNumber !== 2 &&showSaveModal && (
        <div className="sql-builder__modal-overlay" onClick={() => setShowSaveModal(false)}>
          <div className="sql-builder__modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="sql-builder__modal-header">
              <h3>Save Table</h3>
              <button onClick={() => setShowSaveModal(false)} className="sql-builder__modal-close">
                <XMarkIcon />
              </button>
            </div>
            
            <div className="sql-builder__modal-body">
              <div className="sql-builder__form-group">
                <label htmlFor="save-table-name">Table Name</label>
                <input
                  id="save-table-name"
                  type="text"
                  value={saveTableName}
                  onChange={(e) => {
                    setSaveTableName(e.target.value);
                    setSaveError("");
                  }}
                  placeholder="e.g., high_value_orders"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && saveTableName.trim()) {
                      handleSaveTable();
                    }
                  }}
                  autoFocus
                />
                <small>Enter a name for the saved table</small>
              </div>

              {saveError && (
                <div className="sql-builder__error-message">
                  {saveError}
                </div>
              )}
            </div>

            <div className="sql-builder__modal-footer">
              <button
                onClick={() => setShowSaveModal(false)}
                className="sql-builder__btn-secondary"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTable}
                disabled={!saveTableName.trim() || isSaving}
                className="sql-builder__btn-primary"
              >
                {isSaving ? "Saving..." : "Save Dataset"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal - AND/OR/Chain/GroupBy/Aggregation/OrderBy/Limit */}
      <HintModal
        isOpen={hintModal.open}
        onClose={() => setHintModal({ open: false, type: null, category: null })}
        title={
          hintModal.category === "groupby"
            ? "Understanding GROUP BY"
            : hintModal.category === "aggregation"
              ? "Understanding Aggregation & HAVING"
              : hintModal.category === "orderby"
                ? "Understanding ORDER BY"
                : hintModal.category === "limit"
                  ? "Understanding LIMIT"
                  : hintModal.type === "AND" 
                    ? "Understanding AND" 
                    : hintModal.type === "OR" 
                      ? "Understanding OR" 
                      : "Understanding Chain"
        }
      >
        {hintModal.category === "groupby" ? (
          <GroupByContent />
        ) : hintModal.category === "aggregation" ? (
          <AggregationContent />
        ) : hintModal.category === "orderby" ? (
          <OrderByContent />
        ) : hintModal.category === "limit" ? (
          <LimitContent />
        ) : hintModal.type === "CHAIN" ? (
          <ChainContent />
        ) : (
          <AndOrContent type={hintModal.type} />
        )}
      </HintModal>
    </div>
  );
};

export default TableCard;
