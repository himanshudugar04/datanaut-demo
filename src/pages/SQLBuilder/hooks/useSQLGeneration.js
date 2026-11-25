import { useMemo } from "react";
import { generateCTESQL } from "../utils/sqlHelpers";
import { getColumnType } from "../utils/filterHelpers";

/**
 * Custom hook for CTE-based SQL generation (BigQuery format)
 * Supports cross-project joins and per-table aggregation
 */
export const useSQLGeneration = ({
  selectedDatabase,
  table2Database,
  table1,
  table1Dataset,
  table1CteName,
  table1Filters,
  table1FilterEnabled = true,
  table1GroupByEnabled = false,
  table1GroupByColumns = [],
  table1SelectedColumns,
  table2,
  table2Dataset,
  table2CteName,
  table2Filters,
  table2FilterEnabled = true,
  table2GroupByEnabled = false,
  table2GroupByColumns = [],
  table2SelectedColumns,
  joinType,
  joinLeftColumn,
  joinRightColumn,
  joinConditions = [],
  postJoinFilters,
  selectedColumns,
  allAvailableColumns,
  resultTableName,
  // Saved dataset info
  table1SavedDatasetSQL = "",
  table1SavedDatasetName = "",
  table2SavedDatasetSQL = "",
  table2SavedDatasetName = "",
  // UUIDs for unique CTE naming
  table1UUID = "",
  table2UUID = "",
  // Per-table aggregation options
  table1AggregationEnabled = false,
  table1AggregationColumns = [],
  table1HavingConditions = [],
  table2AggregationEnabled = false,
  table2AggregationColumns = [],
  table2HavingConditions = [],
  // Per-table ORDER BY and LIMIT (array-based)
  table1OrderByColumns = [],
  table1LimitEnabled = false,
  table1LimitValue = "",
  table2OrderByColumns = [],
  table2LimitEnabled = false,
  table2LimitValue = "",
  // Join ORDER BY and LIMIT (array-based)
  joinOrderByColumns = [],
  joinLimitEnabled = false,
  joinLimitValue = "",
  // Global options (legacy)
  orderByColumns = [],
  limitEnabled = false,
  limitValue = 100
}) => {
  // Memoized function to get column type
  const getColumnTypeFn = useMemo(() => {
    return (columnFullId) => getColumnType(columnFullId, allAvailableColumns);
  }, [allAvailableColumns]);

  // Generate SQL query in real-time
  const generatedSQL = useMemo(() => {
    return generateCTESQL({
      selectedDatabase,
      table2Database: table2Database || selectedDatabase,
      table1,
      table1Dataset,
      table1CteName,
      table1Filters,
      table1FilterEnabled,
      table1GroupByEnabled,
      table1GroupByColumns,
      table1SelectedColumns,
      table2,
      table2Dataset,
      table2CteName,
      table2Filters,
      table2FilterEnabled,
      table2GroupByEnabled,
      table2GroupByColumns,
      table2SelectedColumns,
      joinType,
      joinLeftColumn,
      joinRightColumn,
      joinConditions,
      postJoinFilters,
      selectedColumns,
      getColumnTypeFn,
      resultTableName,
      // Saved dataset info
      table1SavedDatasetSQL,
      table1SavedDatasetName,
      table2SavedDatasetSQL,
      table2SavedDatasetName,
      // UUIDs for unique CTE naming
      table1UUID,
      table2UUID,
      // Per-table aggregation options
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
      // Global options (legacy)
      orderByColumns,
      limitEnabled,
      limitValue
    });
  }, [
    selectedDatabase,
    table2Database,
    table1,
    table1Dataset,
    table1CteName,
    table1Filters,
    table1FilterEnabled,
    table1GroupByEnabled,
    table1GroupByColumns,
    table1SelectedColumns,
    table2,
    table2Dataset,
    table2CteName,
    table2Filters,
    table2FilterEnabled,
    table2GroupByEnabled,
    table2GroupByColumns,
    table2SelectedColumns,
    joinType,
    joinLeftColumn,
    joinRightColumn,
    joinConditions,
    postJoinFilters,
    selectedColumns,
    getColumnTypeFn,
    resultTableName,
    table1SavedDatasetSQL,
    table1SavedDatasetName,
    table2SavedDatasetSQL,
    table2SavedDatasetName,
    table1UUID,
    table2UUID,
    table1AggregationEnabled,
    table1AggregationColumns,
    table1HavingConditions,
    table2AggregationEnabled,
    table2AggregationColumns,
    table2HavingConditions,
    table1OrderByColumns,
    table1LimitEnabled,
    table1LimitValue,
    table2OrderByColumns,
    table2LimitEnabled,
    table2LimitValue,
    joinOrderByColumns,
    joinLimitEnabled,
    joinLimitValue,
    orderByColumns,
    limitEnabled,
    limitValue
  ]);

  return {
    generatedSQL,
    getColumnTypeFn
  };
};
