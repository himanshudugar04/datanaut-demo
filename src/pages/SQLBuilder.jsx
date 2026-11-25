import { useCallback, useState } from "react";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useSQLBuilder } from "./SQLBuilder/hooks/useSQLBuilder";
import { useSQLGeneration } from "./SQLBuilder/hooks/useSQLGeneration";
import { useQueryExecution } from "./SQLBuilder/hooks/useQueryExecution";
import TableCard from "./SQLBuilder/components/TableCard";
import JoinSection from "./SQLBuilder/components/JoinSection";
import SQLPreview from "./SQLBuilder/components/SQLPreview";
import "./styles/SQLBuilder.css";

function SQLBuilder() {
  const {
    // API data
    databases,
    datasets,
    table2Datasets,
    loading,
    error,
    
    // Database
    selectedDatabase,
    availableTables,
    databaseFunctionUsedTableIds,
    handleDatabaseChange,
    
    // Table 1
    table1,
    table1Dataset,
    table1CteName,
    table1Filters,
    table1Data,
    table1Columns,
    getTable1EffectiveColumns,
    table1PreviewColumns,
    setTable1PreviewColumns,
    table1FilterEnabled,
    setTable1FilterEnabled,
    table1GroupByEnabled,
    setTable1GroupByEnabled,
    handleTable1Change,
    handleTable1DatasetChange,
    setTable1CteName,
    addTable1Filter,
    updateTable1Filter,
    removeTable1Filter,
    getTable1DefaultCteName,
    
    // Table 2 (with cross-database support)
    table2,
    table2Dataset,
    table2CteName,
    table2Filters,
    table2Data,
    table2Columns,
    getTable2EffectiveColumns,
    table2PreviewColumns,
    setTable2PreviewColumns,
    table2FilterEnabled,
    setTable2FilterEnabled,
    table2GroupByEnabled,
    setTable2GroupByEnabled,
    table2Database,
    table2AvailableTables,
    handleTable2Change,
    handleTable2DatabaseChange,
    handleTable2DatasetChange,
    setTable2CteName,
    addTable2Filter,
    updateTable2Filter,
    removeTable2Filter,
    getTable2DefaultCteName,
    
    // Table 2 toggle
    table2Enabled,
    enableTable2,
    disableTable2,
    
    // Join
    joinType,
    setJoinType,
    joinLeftColumn,
    setJoinLeftColumn,
    joinRightColumn,
    setJoinRightColumn,
    joinConditions,
    addJoinCondition,
    removeJoinCondition,
    updateJoinCondition,
    resultTableName,
    setResultTableName,
    
    // Post-join
    postJoinFilters,
    addPostJoinFilter,
    updatePostJoinFilter,
    removePostJoinFilter,

    // Columns
    selectedColumns,
    allAvailableColumns,
    handleColumnToggle,
    handleSelectAllColumns,
    resetAllSelections,
    resetTable1Selections,
    resetJoinSelections,
    
    // Saved dataset info
    table1SavedDatasetSQL,
    table1SavedDatasetName,
    table2SavedDatasetSQL,
    table2SavedDatasetName,
    
    // UUIDs for unique CTE naming
    table1UUID,
    table2UUID,
    
    // Table 1 Aggregation
    table1GroupByColumns,
    addTable1GroupByColumn,
    updateTable1GroupByColumn,
    removeTable1GroupByColumn,
    table1AggregationEnabled,
    setTable1AggregationEnabled,
    table1AggregationColumns,
    addTable1AggregationColumn,
    updateTable1AggregationColumn,
    removeTable1AggregationColumn,
    table1HavingConditions,
    addTable1HavingCondition,
    updateTable1HavingCondition,
    removeTable1HavingCondition,
    resetTable1AggregationState,
    
    // Table 1 ORDER BY and LIMIT
    table1OrderByColumns,
    addTable1OrderByColumn,
    updateTable1OrderByColumn,
    removeTable1OrderByColumn,
    table1LimitEnabled,
    setTable1LimitEnabled,
    table1LimitValue,
    setTable1LimitValue,
    
    // Table 2 Aggregation
    table2GroupByColumns,
    addTable2GroupByColumn,
    updateTable2GroupByColumn,
    removeTable2GroupByColumn,
    table2AggregationEnabled,
    setTable2AggregationEnabled,
    table2AggregationColumns,
    addTable2AggregationColumn,
    updateTable2AggregationColumn,
    removeTable2AggregationColumn,
    table2HavingConditions,
    addTable2HavingCondition,
    updateTable2HavingCondition,
    removeTable2HavingCondition,
    resetTable2AggregationState,
    
    // Table 2 ORDER BY and LIMIT
    table2OrderByColumns,
    addTable2OrderByColumn,
    updateTable2OrderByColumn,
    removeTable2OrderByColumn,
    table2LimitEnabled,
    setTable2LimitEnabled,
    table2LimitValue,
    setTable2LimitValue,
    
    // Join ORDER BY and LIMIT
    joinOrderByColumns,
    addJoinOrderByColumn,
    updateJoinOrderByColumn,
    removeJoinOrderByColumn,
    joinLimitEnabled,
    setJoinLimitEnabled,
    joinLimitValue,
    setJoinLimitValue,
    
    // Global ORDER BY and LIMIT
    orderByColumns,
    addOrderByColumn,
    updateOrderByColumn,
    removeOrderByColumn,
    limitEnabled,
    setLimitEnabled,
    limitValue,
    setLimitValue,
    getOrderByColumns,
    getHavingColumnsForTable,
    
    // UI
    copied,
    setCopied
  } = useSQLBuilder();

  // Section collapse states
  const [sectionsExpanded, setSectionsExpanded] = useState({
    table1: true,
    table2: true,
    join: true,
    columns: true,
    queryOptions: true
  });

  const toggleSection = (section) => {
    setSectionsExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // SQL generation hook
  const { generatedSQL, getColumnTypeFn } = useSQLGeneration({
    selectedDatabase,
    table2Database: table2Database || selectedDatabase,
    table1,
    table1Dataset,
    table1CteName: table1CteName || getTable1DefaultCteName(),
    table1Filters,
    table1FilterEnabled,
    table1GroupByEnabled,
    table1GroupByColumns,
    table1SelectedColumns: table1PreviewColumns,
    table2,
    table2Dataset,
    table2CteName: table2CteName || getTable2DefaultCteName(),
    table2Filters,
    table2FilterEnabled,
    table2GroupByEnabled,
    table2GroupByColumns,
    table2SelectedColumns: table2PreviewColumns,
    joinType,
    joinLeftColumn,
    joinRightColumn,
    joinConditions,
    postJoinFilters,
    selectedColumns,
    allAvailableColumns,
    resultTableName,
    // Saved dataset info
    table1SavedDatasetSQL,
    table1SavedDatasetName,
    table2SavedDatasetSQL,
    table2SavedDatasetName,
    // UUIDs for unique CTE naming
    table1UUID,
    table2UUID,
    // Per-table Aggregation options
    table1AggregationEnabled,
    table1AggregationColumns,
    table1HavingConditions,
    table2AggregationEnabled,
    table2AggregationColumns,
    table2HavingConditions,
    // Per-table ORDER BY and LIMIT (array-based)
    table1OrderByColumns,
    table1LimitEnabled,
    table1LimitValue,
    table2OrderByColumns,
    table2LimitEnabled,
    table2LimitValue,
    // Join ORDER BY and LIMIT (array-based)
    joinOrderByColumns,
    joinLimitEnabled,
    joinLimitValue,
    // Global options
    orderByColumns,
    limitEnabled,
    limitValue
  });

  // Query execution hook
  const {
    executing,
    queryResult,
    queryError,
    runQuery
  } = useQueryExecution();

  // Copy SQL to clipboard
  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [generatedSQL, setCopied]);

  // Execute the generated SQL
  const handleExecuteQuery = useCallback(() => {
    runQuery(generatedSQL);
  }, [generatedSQL, runQuery]);

  return (
    <section className="sql-builder">
      {/* Error Banner */}
      {error && (
        <div className="sql-builder__error-banner">
          <span className="sql-builder__error-icon">!</span>
          <span>{error}</span>
          <small>The query service could not be reached. Please retry in a few seconds.</small>
        </div>
      )}

      {/* Main Builder Section */}
      <div className="sql-builder__main">
        {/* Content Area */}
        <div className="sql-builder__content-area">
          {/* Page Header - Simplified for non-SQL users */}
          <div className="sql-builder__page-header">
            <h1 className="sql-builder__page-title">DataLens</h1>
            <p className="sql-builder__page-subtitle">Explore and analyze your data</p>
            </div>

          {/* Project Selection */}
          <div className="sql-builder__selectors sql-builder__selectors--single">
            <div className="sql-builder__selector">
              <label>Project</label>
              <select
                value={selectedDatabase}
                onChange={(e) => handleDatabaseChange(e.target.value)}
                disabled={loading.databases}
              >
                <option value="">
                  {loading.databases ? "Loading projects..." : "Select project..."}
                </option>
                {databases.map(db => (
                  <option key={db.id} value={db.id}>
                    {db.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sql-builder__selector">
              {/* Status indicator */}
              {(loading.databases || loading.tables) && (
                <div className="sql-builder__loading-indicator">
                  <div className="sql-builder__spinner-small"></div>
                  <span>Loading...</span>
                </div>
              )}
            </div>
          </div>

          {/* Table 1 Selection Card */}
          {selectedDatabase && (
            <TableCard
              tableNumber={1}
              selectedTable={table1}
              selectedDataset={table1Dataset}
              datasets={datasets}
              cteName={table1CteName}
              defaultCteName={getTable1DefaultCteName()}
              filters={table1Filters}
              filterEnabled={table1FilterEnabled}
              onFilterToggle={setTable1FilterEnabled}
              availableTables={availableTables}
              usedDatabaseTableIds={databaseFunctionUsedTableIds}
              tableColumns={table1Columns}
              allAvailableColumns={allAvailableColumns}
              onTableChange={handleTable1Change}
              onDatasetChange={handleTable1DatasetChange}
              onCteNameChange={setTable1CteName}
              onAddFilter={addTable1Filter}
              onUpdateFilter={updateTable1Filter}
              onRemoveFilter={removeTable1Filter}
              getColumnTypeFn={getColumnTypeFn}
              excludeTable={table2}
              selectedDatabase={selectedDatabase}
              loadingTables={loading.tables}
              isExpanded={sectionsExpanded.table1}
              onToggleExpand={() => toggleSection('table1')}
              previewColumns={table1PreviewColumns}
              onPreviewColumnsChange={setTable1PreviewColumns}
              tableData={table1Data}
              tableDisplayName={table1SavedDatasetName || table1}
              savedDatasetSQL={table1SavedDatasetSQL}
              groupByEnabled={table1GroupByEnabled}
              onToggleGroupBy={setTable1GroupByEnabled}
              groupByColumns={table1GroupByColumns}
              onAddGroupByColumn={addTable1GroupByColumn}
              onUpdateGroupByColumn={updateTable1GroupByColumn}
              onRemoveGroupByColumn={removeTable1GroupByColumn}
              aggregationEnabled={table1AggregationEnabled}
              onToggleAggregation={setTable1AggregationEnabled}
              aggregationColumns={table1AggregationColumns}
              onAddAggregationColumn={addTable1AggregationColumn}
              onUpdateAggregationColumn={updateTable1AggregationColumn}
              onRemoveAggregationColumn={removeTable1AggregationColumn}
              havingConditions={table1HavingConditions}
              havingColumnOptions={getHavingColumnsForTable(table1GroupByColumns, table1AggregationColumns)}
              onAddHavingCondition={addTable1HavingCondition}
              onUpdateHavingCondition={updateTable1HavingCondition}
              onRemoveHavingCondition={removeTable1HavingCondition}
              orderByColumns={table1OrderByColumns}
              orderByColumnOptions={getTable1EffectiveColumns}
              onAddOrderByColumn={addTable1OrderByColumn}
              onUpdateOrderByColumn={updateTable1OrderByColumn}
              onRemoveOrderByColumn={removeTable1OrderByColumn}
              limitEnabled={table1LimitEnabled}
              onLimitEnabledChange={setTable1LimitEnabled}
              limitValue={table1LimitValue}
              onLimitValueChange={setTable1LimitValue}
              generatedSQL={generatedSQL}
              onAfterSave={resetAllSelections}
            />
          )}

          {/* Divider with Add/Remove Table 2 Toggle */}
          {table1 && (
            <div className="sql-builder__divider">
              <div className="sql-builder__divider-line" />
              {!table2Enabled ? (
                <button
                  type="button"
                  className="sql-builder__add-table2-btn"
                  onClick={enableTable2}
                  title="Add Second Table"
                >
                  <PlusIcon />
                  <span>Add Table</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="sql-builder__remove-table2-btn"
                  onClick={disableTable2}
                  title="Remove Second Table"
                >
                  <XMarkIcon />
                  <span>Remove Table</span>
                </button>
              )}
              <div className="sql-builder__divider-line" />
            </div>
          )}
                      
          {/* Table 2 Selection Card */}
          {table1 && table2Enabled && (
            <TableCard
              tableNumber={2}
              selectedTable={table2}
              selectedDataset={table2Dataset}
              datasets={datasets}
              cteName={table2CteName}
              defaultCteName={getTable2DefaultCteName()}
              filters={table2Filters}
              filterEnabled={table2FilterEnabled}
              onFilterToggle={setTable2FilterEnabled}
              availableTables={table2AvailableTables}
              usedDatabaseTableIds={databaseFunctionUsedTableIds}
              tableColumns={table2Columns}
              allAvailableColumns={allAvailableColumns}
              onTableChange={handleTable2Change}
              onDatasetChange={handleTable2DatasetChange}
              onCteNameChange={setTable2CteName}
              onAddFilter={addTable2Filter}
              onUpdateFilter={updateTable2Filter}
              onRemoveFilter={removeTable2Filter}
              getColumnTypeFn={getColumnTypeFn}
              excludeTable={table1}
              loadingTables={loading.table2Tables}
              selectedDatabase={selectedDatabase}
              isExpanded={sectionsExpanded.table2}
              onToggleExpand={() => toggleSection('table2')}
              previewColumns={table2PreviewColumns}
              onPreviewColumnsChange={setTable2PreviewColumns}
              tableData={table2Data}
              tableDisplayName={table2SavedDatasetName || table2}
              savedDatasetSQL={table2SavedDatasetSQL}
              groupByEnabled={table2GroupByEnabled}
              onToggleGroupBy={setTable2GroupByEnabled}
              groupByColumns={table2GroupByColumns}
              onAddGroupByColumn={addTable2GroupByColumn}
              onUpdateGroupByColumn={updateTable2GroupByColumn}
              onRemoveGroupByColumn={removeTable2GroupByColumn}
              aggregationEnabled={table2AggregationEnabled}
              onToggleAggregation={setTable2AggregationEnabled}
              aggregationColumns={table2AggregationColumns}
              onAddAggregationColumn={addTable2AggregationColumn}
              onUpdateAggregationColumn={updateTable2AggregationColumn}
              onRemoveAggregationColumn={removeTable2AggregationColumn}
              havingConditions={table2HavingConditions}
              havingColumnOptions={getHavingColumnsForTable(table2GroupByColumns, table2AggregationColumns)}
              onAddHavingCondition={addTable2HavingCondition}
              onUpdateHavingCondition={updateTable2HavingCondition}
              onRemoveHavingCondition={removeTable2HavingCondition}
              orderByColumns={table2OrderByColumns}
              orderByColumnOptions={getTable2EffectiveColumns}
              onAddOrderByColumn={addTable2OrderByColumn}
              onUpdateOrderByColumn={updateTable2OrderByColumn}
              onRemoveOrderByColumn={removeTable2OrderByColumn}
              limitEnabled={table2LimitEnabled}
              onLimitEnabledChange={setTable2LimitEnabled}
              limitValue={table2LimitValue}
              onLimitValueChange={setTable2LimitValue}
              generatedSQL={generatedSQL}
            />
          )}

          {/* Join Configuration Section */}
          {table1 && table2Enabled && table2 && (
            <JoinSection
              table1={table1}
              table1CteName={table1CteName || getTable1DefaultCteName()}
              table1Columns={table1Columns}
              table2={table2}
              table2CteName={table2CteName || getTable2DefaultCteName()}
              table2Columns={table2Columns}
              joinType={joinType}
              joinLeftColumn={joinLeftColumn}
              joinRightColumn={joinRightColumn}
              joinConditions={joinConditions}
              onAddJoinCondition={addJoinCondition}
              onRemoveJoinCondition={removeJoinCondition}
              onUpdateJoinCondition={updateJoinCondition}
              postJoinFilters={postJoinFilters}
              allAvailableColumns={allAvailableColumns}
              onJoinTypeChange={setJoinType}
              onLeftColumnChange={setJoinLeftColumn}
              onRightColumnChange={setJoinRightColumn}
              onAddPostJoinFilter={addPostJoinFilter}
              onUpdatePostJoinFilter={updatePostJoinFilter}
              onRemovePostJoinFilter={removePostJoinFilter}
              getColumnTypeFn={getColumnTypeFn}
              resultTableName={resultTableName}
              onResultTableNameChange={setResultTableName}
              isExpanded={sectionsExpanded.join}
              onToggleExpand={() => toggleSection('join')}
              table1SelectedColumns={table1PreviewColumns}
              table2SelectedColumns={table2PreviewColumns}
              table1GroupByEnabled={table1GroupByEnabled}
              table2GroupByEnabled={table2GroupByEnabled}
              table1EffectiveColumns={getTable1EffectiveColumns}
              table2EffectiveColumns={getTable2EffectiveColumns}
              selectedColumns={selectedColumns}
              onColumnToggle={handleColumnToggle}
              onSelectAll={handleSelectAllColumns}
              // Props for saving dataset
              selectedDatabase={selectedDatabase}
              table1Dataset={table1Dataset}
              table2Database={selectedDatabase}
              table2Dataset={table2Dataset}
              table1Filters={table1Filters}
              table2Filters={table2Filters}
              generatedSQL={generatedSQL}
              // Display names for saved datasets
              table1DisplayName={table1SavedDatasetName || table1}
              table2DisplayName={table2SavedDatasetName || table2}
              // Available tables for derived filter database option
              availableTables={availableTables}
              usedDatabaseTableIds={databaseFunctionUsedTableIds}
              // ORDER BY and LIMIT for joined result
              orderByColumns={joinOrderByColumns}
              onAddOrderByColumn={addJoinOrderByColumn}
              onUpdateOrderByColumn={updateJoinOrderByColumn}
              onRemoveOrderByColumn={removeJoinOrderByColumn}
              limitEnabled={joinLimitEnabled}
              onLimitEnabledChange={setJoinLimitEnabled}
              limitValue={joinLimitValue}
              onLimitValueChange={setJoinLimitValue}
              onAfterSave={resetAllSelections}
              
            />
          )}

        </div>

        {/* SQL Preview Panel */}
        <SQLPreview
          generatedSQL={generatedSQL}
          copied={copied}
          onCopy={copyToClipboard}
          onExecute={handleExecuteQuery}
          executing={executing}
          queryResult={queryResult}
          queryError={queryError}
          // Download button visibility and filename
          table1Selected={Boolean(table1)}
          downloadFileName={table2 ? "joined_result" : table1 || "query_result"}
        />
      </div>
    </section>
  );
}

export default SQLBuilder;
