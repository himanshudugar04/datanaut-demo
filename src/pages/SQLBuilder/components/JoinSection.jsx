import { useState } from "react";
import { 
  LinkIcon, 
  FunnelIcon, 
  PlusIcon, 
  XMarkIcon, 
  ChevronDownIcon, 
  ChevronRightIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  ViewColumnsIcon,
  BookmarkIcon
} from "@heroicons/react/24/outline";
import { joinTypes, filterJoinOptions, getFilterOperatorsForType, valueTypes } from "../../../data/databaseSchema";
import FilterValueInput from "./FilterValueInput";
import HintModal, { AndOrContent, JoinTypeContent, ChainContent, OrderByContent, LimitContent } from "./HintModal";
import { saveDataset } from "../../../services/databaseApi";
import {
  generateSingleTableSQL,
  generateCTESQL,
  transformSQLForSaveDataset
} from "../utils/sqlHelpers";

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
 * Join Section component - for configuring the join between two tables
 */
const JoinSection = ({
  table1,
  table1CteName,
  table1Columns,
  table2,
  table2CteName,
  table2Columns,
  joinType,
  joinLeftColumn,
  joinRightColumn,
  joinConditions = [],
  onAddJoinCondition = null,
  onRemoveJoinCondition = null,
  onUpdateJoinCondition = null,
  postJoinFilters,
  allAvailableColumns,
  onJoinTypeChange,
  onLeftColumnChange,
  onRightColumnChange,
  onAddPostJoinFilter,
  onUpdatePostJoinFilter,
  onRemovePostJoinFilter,
  getColumnTypeFn,
  resultTableName = "",
  onResultTableNameChange = null,
  isExpanded = true,
  onToggleExpand = null,
  // New props for filtering columns based on table card selection
  table1SelectedColumns = [],
  table2SelectedColumns = [],
  // Props for GROUP BY state and effective columns
  table1GroupByEnabled = false,
  table2GroupByEnabled = false,
  table1EffectiveColumns = null,
  table2EffectiveColumns = null,
  // Column selection props
  selectedColumns = [],
  onColumnToggle = null,
  onSelectAll = null,
  // Props needed for saving dataset
  selectedDatabase = "",
  table1Dataset = "",
  table2Database = "",
  table2Dataset = "",
  table1Filters = [],
  table2Filters = [],
  generatedSQL = "",
  // Display names for saved datasets
  table1DisplayName = "",
  table2DisplayName = "",
  // Available tables for derived filter database option
  availableTables = [],
  usedDatabaseTableIds = null,
  // ORDER BY and LIMIT props for joined result (array-based)
  orderByColumns = [],
  onAddOrderByColumn = null,
  onUpdateOrderByColumn = null,
  onRemoveOrderByColumn = null,
  limitEnabled = false,
  onLimitEnabledChange = null,
  limitValue = 100,
  onLimitValueChange = null,
  onSaveDataset = null,
  onAfterSave = null,

}) => {
  const isEnabled = table1 && table2;
  const cte1Name = table1CteName || `${table1}_filtered`;
  const cte2Name = table2CteName || `${table2}_filtered`;
  
  // Use effective columns which handle both GROUP BY and selected columns cases
  // - When GROUP BY is enabled: shows GROUP BY columns + aggregation outputs
  // - When GROUP BY is NOT enabled: shows selected columns from "Select Columns" dropdown
  // - If no columns are selected: shows all table columns
  const filteredTable1Columns = table1EffectiveColumns && table1EffectiveColumns.length > 0
    ? table1EffectiveColumns
    : table1Columns;
  
  const filteredTable2Columns = table2EffectiveColumns && table2EffectiveColumns.length > 0
    ? table2EffectiveColumns
    : table2Columns;
  
  // Get columns for column selection (respects GROUP BY and selected columns)
  // When GROUP BY is enabled: only show effective columns (GROUP BY + aggregation outputs)
  // Otherwise: only show selected columns from table cards (or all if none selected)
  const table1ColsForSelection = allAvailableColumns.filter(col => {
    if (col.cteName !== cte1Name) return false;
    // When GROUP BY is enabled, use effective columns
    if (table1GroupByEnabled && table1EffectiveColumns && table1EffectiveColumns.length > 0) {
      return table1EffectiveColumns.some(ec => ec.id === col.id);
    }
    // Otherwise use selected columns
    if (table1SelectedColumns.length > 0) {
      return table1SelectedColumns.includes(col.id);
    }
    return true;
  });
  
  const table2ColsForSelection = allAvailableColumns.filter(col => {
    if (col.cteName !== cte2Name) return false;
    // When GROUP BY is enabled, use effective columns
    if (table2GroupByEnabled && table2EffectiveColumns && table2EffectiveColumns.length > 0) {
      return table2EffectiveColumns.some(ec => ec.id === col.id);
    }
    // Otherwise use selected columns
    if (table2SelectedColumns.length > 0) {
      return table2SelectedColumns.includes(col.id);
    }
    return true;
  });
  
  const allColsForSelection = [...table1ColsForSelection, ...table2ColsForSelection];
  const allFilteredSelected = allColsForSelection.length > 0 && 
    allColsForSelection.every(col => selectedColumns.includes(col.fullId));
  const selectedFilteredCount = allColsForSelection.filter(col => 
    selectedColumns.includes(col.fullId)
  ).length;
  
  // Collapsible state for advanced settings
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  // Modal state for help
  const [hintModal, setHintModal] = useState({ open: false, type: null, category: null });
  // Column dropdown state
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  // State for save modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveTableName, setSaveTableName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const defaultResultName = `${cte1Name}_${cte2Name}_joined`;
  
  // Handle select all columns
  const handleSelectAllColumns = () => {
    if (onSelectAll && allColsForSelection.length > 0) {
      onSelectAll(allColsForSelection);
    }
  };
  
  // Handle clear all columns
  const handleClearAllColumns = () => {
    if (onColumnToggle && allColsForSelection.length > 0) {
      // Deselect all columns
      allColsForSelection.forEach(col => {
        if (selectedColumns.includes(col.fullId)) {
          onColumnToggle(col.fullId);
        }
      });
    }
  };
  
  // Get display text for dropdown button
  const getColumnDropdownText = () => {
    if (selectedFilteredCount === 0) {
      return "All columns (default)";
    } else if (allFilteredSelected) {
      return "All columns";
    } else {
      return `${selectedFilteredCount} of ${allColsForSelection.length} selected`;
    }
  };

// Handle save table
const handleSaveTable = async () => {
  const trimmedName = (saveTableName || "").trim();
  if (!trimmedName) {
    setSaveError("Dataset name is required");
    return;
  }

  const baseSQL = generatedSQL?.trim()?.replace(/;$/, "");
  if (!baseSQL) {
    setSaveError("No SQL available to save");
    return;
  }

  try {
    setIsSaving(true);
    setSaveError(null);

  
    // Wrap only the final SELECT; existing CTEs (with UUIDs) stay untouched
    const transformedSQL = transformSQLForSaveDataset(baseSQL, trimmedName);

    // Use selected columns if any; otherwise all currently visible columns
    const columnIds =
      selectedColumns.length > 0
        ? selectedColumns
        : allColsForSelection.map(col => col.fullId);

    const columnInfo = columnIds.map(fullId => {
      const col =
        allAvailableColumns.find(c => c.fullId === fullId) ||
        allColsForSelection.find(c => c.fullId === fullId) ||
        {};
      const parts = fullId.split(".");
      const name = col.name || parts[parts.length - 1] || fullId;
      return { name, type: col.type || "STRING" };
    });

    await saveDataset({
      datasetName: trimmedName,
      sqlDefinition: transformedSQL,
      columnInfo
    });

    setShowSaveModal(false);
    setSaveTableName("");
    if (onAfterSave) {
      onAfterSave();
    }
  } catch (err) {
    console.error("Save dataset failed:", err);
    setSaveError(getApiErrorMessage(err) || "Failed to save dataset");
  } finally {
    setIsSaving(false);
  }
};



  if (!isEnabled) {
    return (
      <div className="sql-builder__table-card sql-builder__table-card--disabled">
        <div className="sql-builder__table-card-header">
          <div className="sql-builder__table-card-title">
            <span className="sql-builder__step-indicator sql-builder__step-indicator--inactive">3</span>
            <LinkIcon />
            <span>Connect Tables</span>
          </div>
        </div>
        <div className="sql-builder__table-card-body">
          <div className="sql-builder__empty-state">
            <LinkIcon />
            <p>Select both tables above to connect them</p>
          </div>
        </div>
      </div>
    );
  }

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
          <span className="sql-builder__step-indicator">3</span>
          <LinkIcon />
          <span>Connect Tables</span>
        </div>
        <div className="sql-builder__table-card-actions">
          <span className="sql-builder__table-card-badge">
            {joinType.replace(" JOIN", "")}
          </span>
          {/* Save Button */}
          {joinLeftColumn && joinRightColumn && (
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
          {/* Advanced Settings Icon */}
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
              <label>Joined Result Name</label>
              <input
                type="text"
                value={resultTableName}
                onChange={(e) => onResultTableNameChange && onResultTableNameChange(e.target.value)}
                placeholder={defaultResultName}
              />
              <small>
                {resultTableName 
                  ? `Using custom name: "${resultTableName}"` 
                  : `Using default name: "${defaultResultName}"`}
              </small>
              <small className="sql-builder__cte-hint">
                This name identifies the joined result in your query
              </small>
            </div>
          </div>
        </div>
      )}
      
      {/* Collapsible Body */}
      {isExpanded && (
        <>
        <div className="sql-builder__table-card-body">
          {/* Join Type Selection with Help Buttons */}
          <div className="sql-builder__section">
            <div className="sql-builder__section-header">
              <span>Connection Type</span>
            </div>
            
            <div className="sql-builder__join-type-selector">
              {joinTypes.map(jt => (
                <div key={jt.id} className="sql-builder__join-type-wrapper">
                  <button
                    type="button"
                    className={`sql-builder__join-type-btn ${joinType === jt.id ? "is-active" : ""}`}
                    onClick={() => onJoinTypeChange(jt.id)}
                  >
                    {jt.name.replace(" JOIN", "")}
                  </button>
                  {/* Help Icon - Opens Modal */}
                  <button
                    type="button"
                    className="sql-builder__hint-btn"
                    onClick={() => setHintModal({ open: true, type: jt.id, category: "join" })}
                    title={`Learn about ${jt.name}`}
                  >
                    <QuestionMarkCircleIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Join Condition and Selected Columns - Side by Side */}
          <div className="sql-builder__join-match-columns-row">
            {/* Match Condition */}
            <div className="sql-builder__section sql-builder__section--compact">
              <div className="sql-builder__section-header">
                <span>Match Conditions</span>
                <span className="sql-builder__optional">(which rows to connect)</span>
                {onAddJoinCondition && (
                  <button
                    type="button"
                    className="sql-builder__add-condition-btn"
                    onClick={onAddJoinCondition}
                    title="Add another match condition"
                  >
                    <PlusIcon />
                  </button>
                )}
              </div>
              
              <div className="sql-builder__join-conditions-list">
                {joinConditions.map((condition, index) => (
                  <div key={condition.id} className="sql-builder__join-config-wrapper">
                    {/* AND/OR Selector with Chain Button for conditions after the first */}
                    {index > 0 && (
                      <div className="sql-builder__join-condition-operator">
                        {filterJoinOptions.map(option => (
                          <div key={option.id} className="sql-builder__filter-join-wrapper">
                            <button
                              type="button"
                              className={`sql-builder__join-operator-btn ${(condition.joinType || 'AND') === option.id ? "is-active" : ""}`}
                              onClick={() => onUpdateJoinCondition && onUpdateJoinCondition(condition.id, 'joinType', option.id)}
                            >
                              {option.id}
                            </button>
                            {/* Help Icon - Opens Modal */}
                            <button
                              type="button"
                              className="sql-builder__hint-btn"
                              onClick={() => setHintModal({ open: true, type: option.id, category: "andor" })}
                              title={`Learn about ${option.id}`}
                            >
                              <QuestionMarkCircleIcon />
                            </button>
                          </div>
                        ))}
                        
                        {/* Chain Button - toggles chainWithNext on the PREVIOUS condition */}
                        <div className="sql-builder__filter-join-wrapper">
                          <button
                            type="button"
                            className={`sql-builder__chain-btn ${joinConditions[index - 1]?.chainWithNext ? "is-active" : ""}`}
                            onClick={() => onUpdateJoinCondition && onUpdateJoinCondition(joinConditions[index - 1].id, "chainWithNext", !joinConditions[index - 1].chainWithNext)}
                            title={getChainTooltip(joinConditions, index)}
                          >
                            <LinkIcon />
                            <span>Chain</span>
                          </button>
                          {/* Help Icon for Chain */}
                          <button
                            type="button"
                            className="sql-builder__hint-btn sql-builder__hint-btn--chain"
                            onClick={() => setHintModal({ open: true, type: "CHAIN", category: "chain" })}
                            title="Learn about Chain"
                          >
                            <QuestionMarkCircleIcon />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="sql-builder__join-config">
                      <select
                        value={condition.leftColumn}
                        onChange={(e) => {
                          if (index === 0) {
                            onLeftColumnChange(e.target.value);
                          } else if (onUpdateJoinCondition) {
                            onUpdateJoinCondition(condition.id, 'leftColumn', e.target.value);
                          }
                        }}
                        className="sql-builder__join-column"
                      >
                        <option value="">Select from {table1DisplayName || table1}...</option>
                        {filteredTable1Columns.map(col => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      
                      <span className="sql-builder__join-equals">=</span>
                      
                      <select
                        value={condition.rightColumn}
                        onChange={(e) => {
                          if (index === 0) {
                            onRightColumnChange(e.target.value);
                          } else if (onUpdateJoinCondition) {
                            onUpdateJoinCondition(condition.id, 'rightColumn', e.target.value);
                          }
                        }}
                        className="sql-builder__join-column"
                      >
                        <option value="">Select from {table2DisplayName || table2}...</option>
                        {filteredTable2Columns.map(col => (
                          <option key={col.id} value={col.id}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                      
                      {index > 0 && onRemoveJoinCondition && (
                        <button
                          type="button"
                          className="sql-builder__remove-condition-btn"
                          onClick={() => onRemoveJoinCondition(condition.id)}
                          title="Remove this condition"
                        >
                          <XMarkIcon />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Columns - Dropdown Style */}
            <div className="sql-builder__section sql-builder__section--compact">
              <div className="sql-builder__section-header">
                <span>Selected Columns</span>
                <span className="sql-builder__optional">(empty = all columns)</span>
              </div>
              
              <div className="sql-builder__column-dropdown-wrapper">
                <button
                  type="button"
                  className="sql-builder__column-dropdown-btn"
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                >
                  <ViewColumnsIcon />
                  <span>{getColumnDropdownText()}</span>
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
                      {/* Table 1 Columns */}
                      {table1ColsForSelection.length > 0 && (
                        <>
                          <div className="sql-builder__column-dropdown-group-header">From {table1DisplayName || table1}</div>
                          {table1ColsForSelection.map(col => (
                            <label key={col.fullId} className="sql-builder__column-dropdown-item">
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(col.fullId)}
                                onChange={() => onColumnToggle && onColumnToggle(col.fullId)}
                              />
                              <span className="sql-builder__column-dropdown-name">{col.name}</span>
                              <span className="sql-builder__column-dropdown-type">{col.type}</span>
                            </label>
                          ))}
                        </>
                      )}
                      
                      {/* Table 2 Columns */}
                      {table2ColsForSelection.length > 0 && (
                        <>
                          <div className="sql-builder__column-dropdown-group-header">From {table2DisplayName || table2}</div>
                          {table2ColsForSelection.map(col => (
                            <label key={col.fullId} className="sql-builder__column-dropdown-item">
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(col.fullId)}
                                onChange={() => onColumnToggle && onColumnToggle(col.fullId)}
                              />
                              <span className="sql-builder__column-dropdown-name">{col.name}</span>
                              <span className="sql-builder__column-dropdown-type">{col.type}</span>
                            </label>
                          ))}
                        </>
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
          </div>

          {/* Post-Join Filters */}
          <div className="sql-builder__section">
            <div className="sql-builder__section-header">
              <FunnelIcon />
              <span>Additional Filters</span>
              <span className="sql-builder__optional">(on combined data)</span>
            </div>
            
            <div className="sql-builder__filters">
              {postJoinFilters.map((filter, index) => (
                <div key={filter.id} className="sql-builder__filter-row">
                  {/* AND/OR Selector with Chain Button */}
                  {index > 0 && (
                    <div className="sql-builder__filter-join-inline">
                      {filterJoinOptions.map(option => (
                        <div key={option.id} className="sql-builder__filter-join-wrapper">
                          <button
                            type="button"
                            className={`sql-builder__filter-join-btn ${filter.joinType === option.id ? "is-active" : ""}`}
                            onClick={() => onUpdatePostJoinFilter(filter.id, "joinType", option.id)}
                          >
                            {option.id}
                          </button>
                          <button
                            type="button"
                            className="sql-builder__hint-btn"
                            onClick={() => setHintModal({ open: true, type: option.id, category: "andor" })}
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
                          className={`sql-builder__chain-btn ${postJoinFilters[index - 1]?.chainWithNext ? "is-active" : ""}`}
                          onClick={() => onUpdatePostJoinFilter(postJoinFilters[index - 1].id, "chainWithNext", !postJoinFilters[index - 1].chainWithNext)}
                          title={getChainTooltip(postJoinFilters, index)}
                        >
                          <LinkIcon />
                          <span>Chain</span>
                        </button>
                        {/* Help Icon for Chain */}
                        <button
                          type="button"
                          className="sql-builder__hint-btn sql-builder__hint-btn--chain"
                          onClick={() => setHintModal({ open: true, type: "CHAIN", category: "chain" })}
                          title="Learn about Chain"
                        >
                          <QuestionMarkCircleIcon />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="sql-builder__filter-controls">
                    {/* Column selector - from both tables */}
                    <select
                      value={filter.column}
                      onChange={(e) => onUpdatePostJoinFilter(filter.id, "column", e.target.value)}
                      className="sql-builder__filter-column"
                    >
                      <option value="">Select column...</option>
                      <optgroup label={`From ${table1DisplayName || table1}`}>
                        {filteredTable1Columns.map(col => (
                          <option key={`t1-${col.id}`} value={`${cte1Name}.${col.id}`}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={`From ${table2DisplayName || table2}`}>
                        {filteredTable2Columns.map(col => (
                          <option key={`t2-${col.id}`} value={`${cte2Name}.${col.id}`}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {/* Operator selector with friendly names */}
                    <select
                      value={filter.operator}
                      onChange={(e) => onUpdatePostJoinFilter(filter.id, "operator", e.target.value)}
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
                      onChange={(e) => onUpdatePostJoinFilter(filter.id, "valueType", e.target.value)}
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
                      updateFilter={onUpdatePostJoinFilter}
                      getColumnTypeFn={getColumnTypeFn}
                      selectedDatabase={selectedDatabase}
                      selectedDataset={table1Dataset}
                      availableTables={availableTables}
                      usedDatabaseTableIds={usedDatabaseTableIds}
                    />

                    <button
                      type="button"
                      className="sql-builder__remove-filter"
                      onClick={() => onRemovePostJoinFilter(filter.id)}
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
                onClick={onAddPostJoinFilter}
                title="Add new filter"
              >
                <PlusIcon />
                <span>Add Filter</span>
              </button>
            </div>
          </div>
        </div>

        {/* ORDER BY and LIMIT - inline expandable list (hidden when collapsed) */}
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
                    {allColsForSelection.map((col) => (
                      <option key={col.fullId} value={col.fullId}>
                        {col.tableDisplayName || col.tableName}.{col.name || col.id}
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
                    {allColsForSelection.map((col) => (
                      <option key={col.fullId} value={col.fullId}>
                        {col.tableDisplayName || col.tableName}.{col.name || col.id}
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
            </div>
          )}
        </div>
        </>
      )}

      {/* Save Table Modal */}
      {showSaveModal && (
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
                <label htmlFor="save-table-name-join">Table Name</label>
                <input
                  id="save-table-name-join"
                  type="text"
                  value={saveTableName}
                  onChange={(e) => {
                    setSaveTableName(e.target.value);
                    setSaveError("");
                  }}
                  placeholder="e.g., joined_orders_products"
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

      {/* Help Modal */}
      <HintModal
        isOpen={hintModal.open}
        onClose={() => setHintModal({ open: false, type: null, category: null })}
        title={
          hintModal.category === "join" 
            ? `Understanding ${hintModal.type}` 
            : hintModal.category === "chain"
              ? "Understanding Chain"
              : hintModal.category === "orderby"
                ? "Understanding ORDER BY"
                : hintModal.category === "limit"
                  ? "Understanding LIMIT"
                  : hintModal.type === "AND" 
                    ? "Understanding AND" 
                    : "Understanding OR"
        }
      >
        {hintModal.category === "join" ? (
          <JoinTypeContent type={hintModal.type} />
        ) : hintModal.category === "chain" ? (
          <ChainContent />
        ) : hintModal.category === "orderby" ? (
          <OrderByContent />
        ) : hintModal.category === "limit" ? (
          <LimitContent />
        ) : (
          <AndOrContent type={hintModal.type} />
        )}
      </HintModal>
    </div>
  );
};

export default JoinSection;
