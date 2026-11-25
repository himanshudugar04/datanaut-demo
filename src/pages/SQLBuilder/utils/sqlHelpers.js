import { getOperatorCategory } from "../../../data/databaseSchema";
import { formatDateForSQL } from "./filterHelpers";

/**
 * Build a single filter condition string for SQL (without join prefix)
 */
const buildSingleCondition = (filter, columnType, formatDateFn = formatDateForSQL, originalTableName = null, extraCTEs = null) => {
  const col = filter.column;
  const op = filter.operator;
  const category = getOperatorCategory(columnType);

  // Handle operators that don't need values
  if (op === "IS NULL" || op === "IS NOT NULL") {
    return `${col} ${op}`;
  }

  // For derived values with aggregation, use subquery pattern with ORIGINAL table name
  if (filter.valueType === "derived" && filter.aggregation && filter.aggregationColumn) {
    // Check if this is a DATABASE function (select from single-column table)
    if (filter.aggregation === "DATABASE" && filter.aggregationTable) {
      // Saved dataset path: add CTEs to outer WITH instead of nesting them in the condition
      if (filter.aggregationSavedSQL && extraCTEs) {
        const extracted = extractCTEsFromSavedSQL(
          unescapeQuotes(filter.aggregationSavedSQL),
          filter.aggregationSavedDatasetName || filter.aggregationTable
        );
        if (extracted.ctes) {
          extraCTEs.push(extracted.ctes);
        }
        const targetColumn = (filter.aggregationColumn || "").split(".").pop();
        return `${col} ${op} (SELECT ${targetColumn} FROM ${extracted.finalCTEName})`;
      }

      // aggregationColumn contains the full path: project.dataset.table.column
      const aggParts = filter.aggregationColumn.split(".");
      if (aggParts.length >= 4) {
        const dbProject = aggParts[0];
        const dbDataset = aggParts[1];
        const dbTable = aggParts[2];
        const dbColumn = aggParts[3];
        const fullTablePath = `\`${dbProject}.${dbDataset}.${dbTable}\``;
        // For DATABASE function, just select the column value (assumes single row/value)
        const subquery = `(SELECT ${dbColumn} FROM ${fullTablePath})`;
        return `${col} ${op} ${subquery}`;
      }
    }
    
    const parts = filter.aggregationColumn.split(".");
    const columnPart = parts.length > 1 ? parts[1] : filter.aggregationColumn;
    
    // Use the original table name passed in, NOT the CTE name
    const tableForSubquery = originalTableName || (parts.length > 1 ? parts[0] : "");
    
    // Build subquery for aggregate using original table
    const subquery = `(SELECT ${filter.aggregation}(${columnPart}) FROM ${tableForSubquery})`;
    return `${col} ${op} ${subquery}`;
  }

  const val = filter.value;
  const val2 = filter.value2;

  // Handle BETWEEN
  if (op === "BETWEEN") {
    if (category === "DATE") {
      const formattedVal1 = formatDateFn(val, columnType);
      const formattedVal2 = formatDateFn(val2, columnType);
      // BigQuery DATE literal syntax
      return `${col} BETWEEN DATE '${formattedVal1}' AND DATE '${formattedVal2}'`;
    }
  if (category === "TIMESTAMP") {
    const formattedVal1 = formatDateFn(val, columnType);
    const formattedVal2 = formatDateFn(val2, columnType);
    // Use matching literal type based on actual column type (DATETIME vs TIMESTAMP)
    const upperType = columnType?.toUpperCase();
    const literalType = upperType === "DATETIME" ? "DATETIME" : (upperType === "TIME" ? "TIME" : "TIMESTAMP");
    return `${col} BETWEEN ${literalType} '${formattedVal1}' AND ${literalType} '${formattedVal2}'`;
  }
    return `${col} BETWEEN ${val} AND ${val2}`;
  }

  // Handle IN / NOT IN
  if (op === "IN" || op === "NOT IN") {
    return `${col} ${op} (${val})`;
  }

  // Handle STARTS WITH
  if (op === "STARTS WITH") {
    return `${col} LIKE '${val}%'`;
  }

  // Handle ENDS WITH
  if (op === "ENDS WITH") {
    return `${col} LIKE '%${val}'`;
  }

  // Handle LIKE / NOT LIKE
  if (op === "LIKE" || op === "NOT LIKE") {
    return `${col} ${op} '%${val}%'`;
  }

  // Build value string based on type
  let valueStr = "";
  if (category === "BOOLEAN") {
    // BigQuery uses uppercase TRUE/FALSE
    const boolVal = String(val).toLowerCase();
    valueStr = (boolVal === "true" || boolVal === "1") ? "TRUE" : "FALSE";
  } else if (category === "DATE") {
    const formattedVal = formatDateFn(val, columnType);
    // BigQuery DATE literal syntax
    valueStr = `DATE '${formattedVal}'`;
  } else if (category === "TIMESTAMP") {
    const formattedVal = formatDateFn(val, columnType);
    // Use matching literal type based on actual column type (DATETIME vs TIMESTAMP)
    const upperType = columnType?.toUpperCase();
    const literalType = upperType === "DATETIME" ? "DATETIME" : (upperType === "TIME" ? "TIME" : "TIMESTAMP");
    valueStr = `${literalType} '${formattedVal}'`;
  } else if (category === "NUMERIC") {
    valueStr = val;
  } else {
    valueStr = `'${val}'`;
  }

  return `${col} ${op} ${valueStr}`;
};

/**
 * Build filter condition string for SQL (legacy - with join prefix inline)
 */
export const buildFilterCondition = (filter, index, columnType, formatDateFn = formatDateForSQL, originalTableName = null) => {
  const joinPrefix = index > 0 ? `${filter.joinType} ` : "";
  const condition = buildSingleCondition(filter, columnType, formatDateFn, originalTableName);
  return `${joinPrefix}${condition}`;
};

/**
 * Build WHERE clause from filters with explicit chain-based bracket grouping
 * Uses the chainWithNext property to determine bracket groups:
 * - Continuous chains form one bracket group
 * - Discontinuous chains form separate bracket groups
 * 
 * Example: If filter1.chainWithNext=true and filter2.chainWithNext=true:
 *   (filter1 AND filter2 AND filter3)
 * 
 * Example: If filter1.chainWithNext=false and filter2.chainWithNext=true:
 *   filter1 AND (filter2 AND filter3)
 */
const buildWhereClauseWithChaining = (filters, getColumnTypeFn, originalTableName = null, fullTablePath = null, extraCTEs = null) => {
  const validFilters = filters.filter(f => f.column && f.operator);
  if (validFilters.length === 0) return "";

  // Build conditions for each filter with metadata
  const filterData = validFilters.map((f, originalIndex) => {
    const columnParts = f.column.split(".");
    const columnName = columnParts.length > 1 ? columnParts[1] : f.column;
    const columnType = getColumnTypeFn(f.column);
    const modifiedFilter = { ...f, column: columnName };
    return {
      condition: buildSingleCondition(modifiedFilter, columnType, formatDateForSQL, fullTablePath || originalTableName, extraCTEs),
      joinType: f.joinType || "AND",
      chainWithNext: f.chainWithNext || false,
      originalIndex
    };
  });

  // If only one filter, no brackets needed
  if (filterData.length === 1) {
    return `\n    WHERE ${filterData[0].condition}`;
  }

  // Find chain groups - a group starts when a filter is chained with the next one
  // and continues until chainWithNext is false
  const groups = [];
  let currentGroup = [filterData[0]];
  
  for (let i = 0; i < filterData.length - 1; i++) {
    if (filterData[i].chainWithNext) {
      // Continue the current group with the next filter
      currentGroup.push(filterData[i + 1]);
    } else {
      // End the current group and start a new one
      groups.push(currentGroup);
      currentGroup = [filterData[i + 1]];
    }
  }
  // Don't forget the last group
  groups.push(currentGroup);

  // Build the WHERE clause from groups
  const groupStrings = groups.map((group, groupIndex) => {
    if (group.length === 1) {
      // Single filter, no brackets
      return group[0].condition;
    } else {
      // Multiple filters in group, wrap in brackets
      const innerConditions = group.map((f, idx) => {
        if (idx === 0) {
          return f.condition;
        } else {
          return `${f.joinType} ${f.condition}`;
        }
      }).join(" ");
      return `(${innerConditions})`;
    }
  });

  // Connect groups with the joinType of the first filter in each group (except the first group)
  let result = groupStrings[0];
  for (let i = 1; i < groups.length; i++) {
    // The joinType to use is from the first filter of this group
    const joinType = groups[i][0].joinType;
    result = `${result} ${joinType} ${groupStrings[i]}`;
  }

  return `\n    WHERE ${result}`;
};

/**
 * Build WHERE clause - uses explicit chaining
 */
export const buildWhereClause = (filters, getColumnTypeFn, originalTableName = null, fullTablePath = null, extraCTEs = null) => {
  return buildWhereClauseWithChaining(filters, getColumnTypeFn, originalTableName, fullTablePath, extraCTEs);
};

/**
 * Get all post-join filters (no separation - all filters applied in post-join WHERE clause)
 */
const getPostJoinFilters = (postJoinFilters) => {
  const validFilters = postJoinFilters.filter(f => f.column && f.operator);
  return validFilters;
};

/**
 * Build post-join WHERE clause with explicit chain-based bracket grouping
 */
const buildPostJoinWhereClause = (filters, getColumnTypeFn, cte1Name, cte2Name, table1, table2, fullTablePath1, fullTablePath2, extraCTEs = null) => {
  const validFilters = filters.filter(f => f.column && f.operator);
  if (validFilters.length === 0) return "";

  const belongsToTable = (tableToken, targetCteName) => {
    if (!tableToken || !targetCteName) return false;
    return (
      tableToken === targetCteName ||
      targetCteName.startsWith(`${tableToken}_`) ||
      tableToken.startsWith(`${targetCteName}_`)
    );
  };

  // Build conditions for each filter with metadata
  const filterData = validFilters.map((f) => {
    const columnType = getColumnTypeFn(f.column);
    const parts = f.column.split(".");
    const tableToken = parts[0];
    const columnName = parts.length > 1 ? parts[parts.length - 1] : f.column;
    const isTable1 = tableToken === "t1" || belongsToTable(tableToken, cte1Name);
    const isTable2 = tableToken === "t2" || belongsToTable(tableToken, cte2Name);
    const alias = isTable1 ? "t1" : (isTable2 ? "t2" : "t1");
    const aliasedColumn = parts.length > 1 ? `${alias}.${columnName}` : f.column;
    const modifiedFilter = { ...f, column: aliasedColumn };
    // Use the filtered CTE name (with UUID) so derived subqueries target the correct scoped data
    const originalTablePath = isTable1 
      ? (cte1Name || fullTablePath1) 
      : (isTable2 ? (cte2Name || fullTablePath2) : (cte1Name || fullTablePath1));

    // For derived filters, choose the source table based on the aggregationColumn (not the filter column)
    let derivedTablePath = originalTablePath;
    if (f.valueType === "derived" && f.aggregationColumn) {
      const aggParts = f.aggregationColumn.split(".");
      const aggTableToken = aggParts[0];
      const aggIsTable1 = aggTableToken === "t1" || belongsToTable(aggTableToken, cte1Name);
      const aggIsTable2 = aggTableToken === "t2" || belongsToTable(aggTableToken, cte2Name);
      derivedTablePath = aggIsTable1
        ? (cte1Name || fullTablePath1)
        : (aggIsTable2 ? (cte2Name || fullTablePath2) : originalTablePath);
    }
    return {
      condition: buildSingleCondition(modifiedFilter, columnType, formatDateForSQL, derivedTablePath, extraCTEs),
      joinType: f.joinType || "AND",
      chainWithNext: f.chainWithNext || false
    };
  });

  // If only one filter, no brackets needed
  if (filterData.length === 1) {
    return `\nWHERE ${filterData[0].condition}`;
  }

  // Find chain groups based on chainWithNext property
  const groups = [];
  let currentGroup = [filterData[0]];
  
  for (let i = 0; i < filterData.length - 1; i++) {
    if (filterData[i].chainWithNext) {
      currentGroup.push(filterData[i + 1]);
    } else {
      groups.push(currentGroup);
      currentGroup = [filterData[i + 1]];
    }
  }
  groups.push(currentGroup);

  // Build the WHERE clause from groups
  const groupStrings = groups.map((group) => {
    if (group.length === 1) {
      return group[0].condition;
    } else {
      const innerConditions = group.map((f, idx) => {
        if (idx === 0) {
          return f.condition;
        } else {
          return `${f.joinType} ${f.condition}`;
        }
      }).join(" ");
      return `(${innerConditions})`;
    }
  });

  // Connect groups with the joinType of the first filter in each group
  let result = groupStrings[0];
  for (let i = 1; i < groups.length; i++) {
    const joinType = groups[i][0].joinType;
    result = `${result} ${joinType} ${groupStrings[i]}`;
  }

  return `\nWHERE ${result}`;
};

/**
 * Build column selection for CTE SELECT clause
 */
const buildCteColumnSelection = (selectedColumns) => {
  // If no columns selected or empty array, use SELECT *
  if (!selectedColumns || selectedColumns.length === 0) {
    return "*";
  }
  
  // Return comma-separated column names
  return selectedColumns.join(", ");
};

/**
 * Generate unique CTE names by tracking used names and adding counters when needed.
 * This prevents conflicts when the same table is used multiple times (e.g., self-joins).
 */
const createCTENameGenerator = () => {
  const usedNames = new Map(); // Maps base name to count
  
  return {
    /**
     * Get a unique CTE name based on the base name.
     * First usage: "orders_filtered"
     * Second usage: "orders_filtered_2"
     * Third usage: "orders_filtered_3"
     */
    getUniqueName: (baseName) => {
      const cleanBaseName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      if (!usedNames.has(cleanBaseName)) {
        usedNames.set(cleanBaseName, 1);
        return cleanBaseName;
      }
      
      const count = usedNames.get(cleanBaseName) + 1;
      usedNames.set(cleanBaseName, count);
      return `${cleanBaseName}_${count}`;
    },
    
    /**
     * Check if a name would conflict and return the adjusted name
     */
    checkAndReserve: (name) => {
      const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      
      if (!usedNames.has(cleanName)) {
        usedNames.set(cleanName, 1);
        return cleanName;
      }
      
      const count = usedNames.get(cleanName) + 1;
      usedNames.set(cleanName, count);
      return `${cleanName}_${count}`;
    },
    
    /**
     * Reset the counter (for testing or new query generation)
     */
    reset: () => {
      usedNames.clear();
    }
  };
};

/**
 * Extract CTE names from a SQL string.
 * Looks for patterns like "name AS (" to find CTE definitions.
 * Returns an array of CTE names found.
 */
const extractCTENames = (sql) => {
  if (!sql) return [];
  
  const cteNames = [];
  // Match pattern: word characters followed by optional whitespace, then "AS", then optional whitespace, then "("
  const ctePattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+AS\s*\(/gi;
  let match;
  
  while ((match = ctePattern.exec(sql)) !== null) {
    cteNames.push(match[1].toLowerCase());
  }
  
  return cteNames;
};

/**
 * Extract CTEs from a saved dataset SQL definition.
 * Returns an object with { ctes: string, finalCTEName: string, cteNames: string[] }
 */
const extractCTEsFromSavedSQL = (sql, datasetName) => {
  if (!sql || !sql.trim()) {
    return { ctes: "", finalCTEName: datasetName, cteNames: [] };
  }
  
  const trimmedSQL = sql.trim();
  
  // Extract all CTE names from the SQL
  const cteNames = extractCTENames(trimmedSQL);
  
  // If it starts with WITH, we have CTEs
  if (trimmedSQL.toUpperCase().startsWith('WITH')) {
    // Find the position after "WITH" and before the final "SELECT * FROM <name>"
    const lines = trimmedSQL.split('\n');
    let selectLineIndex = -1;
    let parenDepth = 0;
    
    // Find where the final SELECT starts
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '(') parenDepth++;
        if (char === ')') parenDepth--;
      }
      if (parenDepth === 0 && line.toUpperCase().trim().startsWith('SELECT')) {
        selectLineIndex = i;
        break;
      }
    }
    
    if (selectLineIndex > 0) {
      // Get just the CTEs part (remove "WITH" and the final SELECT)
      const ctePart = lines.slice(0, selectLineIndex).join('\n');
      // Remove the "WITH" keyword and clean up
      const withMatch = ctePart.match(/^WITH\s*/i);
      if (withMatch) {
        return {
          ctes: ctePart.substring(withMatch[0].length).trim(),
          finalCTEName: datasetName,
          cteNames: cteNames
        };
      }
    }
  }
  
  return { ctes: "", finalCTEName: datasetName, cteNames: cteNames };
};
/**
 * Rename all CTEs in a SQL string by appending a suffix
 * This makes CTEs unique when combining multiple saved datasets
 */
const renameCTEsWithSuffix = (sql, suffix) => {
  if (!sql || !suffix) return sql;
  
  // Extract all CTE names from the SQL
  const cteNames = extractCTENames(sql);
  if (cteNames.length === 0) return sql;
  
  let modifiedSQL = sql;
  
  // Replace each CTE name with the suffixed version
  // We need to be careful to only replace whole words (CTE definitions and references)
  cteNames.forEach(cteName => {
    const newName = `${cteName}_${suffix}`;
    // Replace CTE definition: "cteName AS ("
    const defPattern = new RegExp(`\\b${cteName}\\s+AS\\s*\\(`, 'gi');
    modifiedSQL = modifiedSQL.replace(defPattern, `${newName} AS (`);
    // Replace CTE references: "FROM cteName" or "JOIN cteName"
    const refPattern = new RegExp(`\\b(FROM|JOIN)\\s+${cteName}\\b`, 'gi');
    modifiedSQL = modifiedSQL.replace(refPattern, `$1 ${newName}`);
    // Replace references after SELECT * FROM
    const selectPattern = new RegExp(`SELECT\\s+\\*\\s+FROM\\s+${cteName}\\b`, 'gi');
    modifiedSQL = modifiedSQL.replace(selectPattern, `SELECT * FROM ${newName}`);
  });
  
  return modifiedSQL;
};

/**
 * Unescape double single-quotes to single quotes in SQL
 * BigQuery stores strings with escaped quotes ('') but we need single quotes (')
 */
const unescapeQuotes = (sql) => {
  if (!sql) return sql;
  // Replace '' with ' (but not within backtick-quoted identifiers)
  return sql.replace(/''/g, "'");
};

/**
 * Build SELECT clause for aggregation mode
 * @param {Array} aggregationColumns - Array of { column, role, alias }
 * @returns {string} - SELECT clause columns
 */
const buildAggregationSelectClause = ({
  groupByColumns = [],
  aggregationColumns = [],
  aggregationEnabled = false,
  groupByEnabled = false
}) => {
  const effectiveGroupBy = groupByEnabled || aggregationEnabled;

  const parts = [];

  if (effectiveGroupBy && groupByColumns.length > 0) {
    groupByColumns.forEach(col => {
      const colName = col.column ? col.column.split('.').pop() : "";
      if (colName) {
        parts.push(colName);
      }
    });
  }

  if (aggregationEnabled && aggregationColumns && aggregationColumns.length > 0) {
    aggregationColumns
      .filter(col => col.column)
      .forEach(col => {
        const colName = col.column === "*" ? "*" : col.column.split('.').pop();
        if (col.column === "*" && col.role === "COUNT") {
          const alias = col.alias ? ` AS ${col.alias}` : "";
          parts.push(`COUNT(*)${alias}`);
        } else if (col.role === "COUNT_DISTINCT") {
          const alias = col.alias ? ` AS ${col.alias}` : "";
          parts.push(`COUNT(DISTINCT ${colName})${alias}`);
        } else {
          const alias = col.alias ? ` AS ${col.alias}` : "";
          parts.push(`${col.role}(${colName})${alias}`);
        }
      });
  }

  if (parts.length === 0) {
    return "*";
  }

  return parts.join(",\n    ");
};

/**
 * Build GROUP BY clause
 * @param {Array} aggregationColumns - Array of { column, role, alias }
 * @returns {string} - GROUP BY clause (empty string if no grouping)
 */
const buildGroupByClause = (groupByColumns, groupByEnabled) => {
  if (!groupByEnabled || !groupByColumns || groupByColumns.length === 0) {
    return "";
  }

  const cols = groupByColumns
    .filter(col => col.column)
    .map(col => col.column.split('.').pop());

  if (cols.length === 0) {
    return "";
  }

  return `\nGROUP BY ${cols.join(", ")}`;
};

/**
 * Build HAVING clause with chain grouping support
 * @param {Array} havingConditions - Array of { column, operator, value, joinType, chainWithNext }
 * @returns {string} - HAVING clause (empty string if no conditions)
 */
const buildHavingClause = (havingConditions) => {
  if (!havingConditions || havingConditions.length === 0) {
    return "";
  }
  
  const validConditions = havingConditions.filter(c => c.column && c.operator && c.value);
  if (validConditions.length === 0) {
    return "";
  }
  
  // Build conditions with metadata
  const conditionData = validConditions.map((cond) => {
    let conditionStr;
    if (cond.operator === "BETWEEN") {
      const [val1, val2] = String(cond.value).split(',').map(v => v.trim());
      conditionStr = `${cond.column} BETWEEN ${val1} AND ${val2}`;
    } else {
      conditionStr = `${cond.column} ${cond.operator} ${cond.value}`;
    }
    return {
      condition: conditionStr,
      joinType: cond.joinType || "AND",
      chainWithNext: cond.chainWithNext || false
    };
  });
  
  // If only one condition, no grouping needed
  if (conditionData.length === 1) {
    return `\nHAVING ${conditionData[0].condition}`;
  }
  
  // Find chain groups based on chainWithNext property
  const groups = [];
  let currentGroup = [conditionData[0]];
  
  for (let i = 0; i < conditionData.length - 1; i++) {
    if (conditionData[i].chainWithNext) {
      currentGroup.push(conditionData[i + 1]);
    } else {
      groups.push(currentGroup);
      currentGroup = [conditionData[i + 1]];
    }
  }
  groups.push(currentGroup);
  
  // Build the HAVING clause from groups
  const groupStrings = groups.map((group) => {
    if (group.length === 1) {
      return group[0].condition;
    } else {
      // Multiple conditions in group, wrap in brackets
      const innerConditions = group.map((c, idx) => {
        if (idx === 0) {
          return c.condition;
        } else {
          return `${c.joinType} ${c.condition}`;
        }
      }).join(" ");
      return `(${innerConditions})`;
    }
  });
  
  // Connect groups with the joinType of the first condition in each group
  let result = groupStrings[0];
  for (let i = 1; i < groups.length; i++) {
    const joinType = groups[i][0].joinType;
    result = `${result} ${joinType} ${groupStrings[i]}`;
  }
  
  return `\nHAVING ${result}`;
};

/**
 * Build ORDER BY clause
 * @param {Array} orderByColumns - Array of { column, direction }
 * @returns {string} - ORDER BY clause (empty string if no ordering)
 */
const buildOrderByClause = (orderByColumns) => {
  if (!orderByColumns || orderByColumns.length === 0) {
    return "";
  }
  
  const validColumns = orderByColumns.filter(c => c.column);
  if (validColumns.length === 0) {
    return "";
  }
  
  const parts = validColumns.map(col => {
    const direction = col.direction || "ASC";
    return `${col.column} ${direction}`;
  });
  
  return `\nORDER BY ${parts.join(", ")}`;
};

/**
 * Build LIMIT clause
 * @param {boolean} limitEnabled - Whether LIMIT is enabled
 * @param {number} limitValue - The limit value
 * @returns {string} - LIMIT clause (empty string if disabled)
 */
const buildLimitClause = (limitEnabled, limitValue) => {
  if (!limitEnabled || !limitValue) {
    return "";
  }
  return `\nLIMIT ${limitValue}`;
};

/**
 * Generate CTE-based SQL query for BigQuery (supports cross-project joins)
 */
export const generateCTESQL = ({
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
  joinConditions = [], // Array of { leftColumn, rightColumn }
  postJoinFilters,
  selectedColumns,
  getColumnTypeFn,
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
  // Global options (ORDER BY, LIMIT) - legacy
  orderByColumns = [],
  limitEnabled = false,
  limitValue = 100
}) => {
  // Create a CTE name generator to ensure unique names
  const nameGenerator = createCTENameGenerator();
  
  // If no database (project) selected
  if (!selectedDatabase) {
    return "-- Select a project to start building your query";
  }

  // If no table 1 selected
  if (!table1) {
    return "-- Select Table 1 to start building your query";
  }

  // Check if table1 is a saved dataset
  const isTable1SavedDataset = table1.startsWith('saved_');
  const isTable2SavedDataset = table2 && table2.startsWith('saved_');

  // If no dataset selected for table1 (only for regular tables)
  if (!isTable1SavedDataset && !table1Dataset) {
    return "-- Select a dataset for Table 1 to start building your query";
  }

  // For saved datasets, use the dataset name as the table reference
  // For regular tables, use BigQuery format: `project.dataset.table`
 let fullTablePath1;
  let savedCTEs1 = "";
  let savedDatasetCTEName1 = "";
  
  if (isTable1SavedDataset && table1SavedDatasetName) {
    // Use the saved dataset name directly - it's already a CTE
    const baseName = table1SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    // Reserve this name in the generator to track it (no UUID modification to saved SQL)
    savedDatasetCTEName1 = nameGenerator.checkAndReserve(baseName);
    fullTablePath1 = savedDatasetCTEName1;
    
    // Only unescape double quotes - do NOT modify the saved SQL CTEs with UUID
    const unescapedSQL = unescapeQuotes(table1SavedDatasetSQL);
    
    // Extract CTEs from the saved dataset SQL (unchanged)
    const extracted = extractCTEsFromSavedSQL(unescapedSQL, savedDatasetCTEName1);
    savedCTEs1 = extracted.ctes;
    fullTablePath1 = extracted.finalCTEName;
    
    // Reserve all CTE names from the saved dataset's SQL to prevent conflicts
    if (extracted.cteNames && extracted.cteNames.length > 0) {
      extracted.cteNames.forEach(cteName => {
        nameGenerator.checkAndReserve(cteName);
      });
    }
  } else if (!isTable1SavedDataset) {
    fullTablePath1 = `\`${selectedDatabase}.${table1Dataset}.${table1}\``;
  } else {
    fullTablePath1 = table1.replace('saved_', '');
  }

  const db2 = table2Database || selectedDatabase;
  const dataset2 = table2Dataset || table1Dataset;
  
  let fullTablePath2 = null;
  let savedCTEs2 = "";
  let savedDatasetCTEName2 = "";
  
  if (table2) {
    if (isTable2SavedDataset && table2SavedDatasetName) {
      const baseName = table2SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      // Reserve this name - will get a suffix if same as table1's saved dataset (no UUID modification to saved SQL)
      savedDatasetCTEName2 = nameGenerator.checkAndReserve(baseName);
      fullTablePath2 = savedDatasetCTEName2;
      
      // Only unescape double quotes - do NOT modify the saved SQL CTEs with UUID
      const unescapedSQL = unescapeQuotes(table2SavedDatasetSQL);
      
      const extracted = extractCTEsFromSavedSQL(unescapedSQL, savedDatasetCTEName2);
      savedCTEs2 = extracted.ctes;
      fullTablePath2 = extracted.finalCTEName;
      
      // Reserve all CTE names from the saved dataset's SQL to prevent conflicts
      if (extracted.cteNames && extracted.cteNames.length > 0) {
        extracted.cteNames.forEach(cteName => {
          nameGenerator.checkAndReserve(cteName);
        });
      }
    } else if (!isTable2SavedDataset) {
      fullTablePath2 = `\`${db2}.${dataset2}.${table2}\``;
    } else {
      fullTablePath2 = table2.replace('saved_', '');
    }
  }

  // Generate unique CTE names with UUID suffix for all tables
  // This ensures uniqueness even when the same table is used multiple times
  // UUID is added to the _filtered CTE names that wrap the table/saved dataset
  let cte1Name;
  if (table1CteName) {
    // User provided custom name - use it with UUID if available
    const baseName = table1UUID ? `${table1CteName}_${table1UUID}` : table1CteName;
    cte1Name = nameGenerator.getUniqueName(baseName);
  } else if (isTable1SavedDataset) {
    // Saved dataset - add UUID to the filtered CTE name
    const baseFilteredName = savedDatasetCTEName1 || fullTablePath1;
    const baseName = table1UUID ? `${baseFilteredName}_filtered_${table1UUID}` : `${baseFilteredName}_filtered`;
    cte1Name = nameGenerator.getUniqueName(baseName);
  } else {
    // Regular table - always append UUID for uniqueness
    const baseName = table1UUID ? `${table1}_filtered_${table1UUID}` : `${table1}_filtered`;
    cte1Name = nameGenerator.getUniqueName(baseName);
  }
  
  let cte2Name = null;
  if (table2) {
    if (table2CteName) {
      // User provided custom name - use it with UUID if available
      const baseName = table2UUID ? `${table2CteName}_${table2UUID}` : table2CteName;
      cte2Name = nameGenerator.getUniqueName(baseName);
    } else if (isTable2SavedDataset) {
      // Saved dataset - add UUID to the filtered CTE name
      const baseFilteredName = savedDatasetCTEName2 || fullTablePath2;
      const baseName = table2UUID ? `${baseFilteredName}_filtered_${table2UUID}` : `${baseFilteredName}_filtered`;
      cte2Name = nameGenerator.getUniqueName(baseName);
    } else {
      // Regular table - always append UUID for uniqueness
      const baseName = table2UUID ? `${table2}_filtered_${table2UUID}` : `${table2}_filtered`;
      cte2Name = nameGenerator.getUniqueName(baseName);
    }
  }

  const table1UseGroupBy = table1GroupByEnabled || table1AggregationEnabled;
  const table2UseGroupBy = table2GroupByEnabled || table2AggregationEnabled;

  // Build CTE column selections (with aggregation/group by if enabled)
  const table1CteColumns = table1UseGroupBy
    ? buildAggregationSelectClause({
        groupByColumns: table1GroupByColumns,
        aggregationColumns: table1AggregationColumns,
        aggregationEnabled: table1AggregationEnabled,
        groupByEnabled: table1UseGroupBy
      })
    : buildCteColumnSelection(table1SelectedColumns);
  
  const table2CteColumns = table2 
    ? (table2UseGroupBy
        ? buildAggregationSelectClause({
            groupByColumns: table2GroupByColumns,
            aggregationColumns: table2AggregationColumns,
            aggregationEnabled: table2AggregationEnabled,
            groupByEnabled: table2UseGroupBy
          })
        : buildCteColumnSelection(table2SelectedColumns))
    : "*";

  // Build GROUP BY and HAVING for each table's CTE
  const table1GroupByClause = buildGroupByClause(table1GroupByColumns, table1UseGroupBy);
  const table1HavingClause = table1AggregationEnabled ? buildHavingClause(table1HavingConditions) : "";
  const table2GroupByClause = buildGroupByClause(table2GroupByColumns, table2UseGroupBy);
  const table2HavingClause = table2AggregationEnabled ? buildHavingClause(table2HavingConditions) : "";

  // If only Table 1 is selected (no join)
  if (!table2) {
    // For saved datasets, we SELECT from the saved dataset's final CTE
    // For regular tables, we SELECT from the full table path
    const sourceTable = isTable1SavedDataset ? fullTablePath1 : fullTablePath1;
    const table1FilterCTEs = [];
    const table1WhereClause = table1FilterEnabled ? (
      isTable1SavedDataset 
        ? buildWhereClause(table1Filters, getColumnTypeFn, fullTablePath1, fullTablePath1, table1FilterCTEs)
        : buildWhereClause(table1Filters, getColumnTypeFn, table1, fullTablePath1, table1FilterCTEs)
    ) : "";
    
    // Build CTE with aggregation inside (GROUP BY and HAVING are inside the CTE)
    const cte1 = `${cte1Name} AS (\n    SELECT ${table1CteColumns}\n    FROM ${sourceTable}${table1WhereClause}${table1GroupByClause}${table1HavingClause}\n  )`;
    
    const columnsClause = selectedColumns.length === 0 
      ? "*" 
      : selectedColumns.map(c => {
          const parts = c.split('.');
          return parts.length > 1 ? parts[1] : c;
        }).join(",\n  ");

    // Include saved CTEs if present
    let allCTEs = [];
    if (savedCTEs1) {
      allCTEs.push(savedCTEs1);
    }
    if (table1FilterCTEs.length > 0) {
      allCTEs.push(...table1FilterCTEs);
    }
    allCTEs.push(cte1);
    
    // ORDER BY and LIMIT - use per-table settings (array-based), fallback to global
    let orderByClause = "";
    if (table1OrderByColumns && table1OrderByColumns.length > 0) {
      const validCols = table1OrderByColumns.filter(c => c.column);
      if (validCols.length > 0) {
        const orderParts = validCols.map(c => {
          const parts = c.column.split('.');
          const colName = parts.length > 1 ? parts[parts.length - 1] : c.column;
          return `${colName} ${c.direction || 'ASC'}`;
        });
        orderByClause = `\nORDER BY ${orderParts.join(', ')}`;
      }
    } else {
      orderByClause = buildOrderByClause(orderByColumns);
    }
    
    // LIMIT - use per-table settings if enabled, otherwise fallback to global
    let limitClause = "";
    if (table1LimitEnabled) {
      const limitVal = table1LimitValue !== "" && table1LimitValue !== null ? table1LimitValue : 0;
      if (limitVal > 0) {
        limitClause = `\nLIMIT ${limitVal}`;
      }
    } else if (limitEnabled && limitValue) {
      limitClause = buildLimitClause(limitEnabled, limitValue);
    }
    
    return `WITH\n  ${allCTEs.join(",\n  ")}\nSELECT\n  ${columnsClause}\nFROM ${cte1Name}${orderByClause}${limitClause}`;
  }

  // Get all post-join filters (all applied in post-join WHERE clause)
  const allPostJoinFilters = getPostJoinFilters(postJoinFilters);

  // Build Table 1 CTE (with filters, aggregation, ORDER BY, and LIMIT)
  const sourceTable1 = isTable1SavedDataset ? fullTablePath1 : fullTablePath1;
  const table1FilterCTEs = [];
  const table1WhereClause = table1FilterEnabled ? (
    isTable1SavedDataset 
      ? buildWhereClause(table1Filters, getColumnTypeFn, fullTablePath1, fullTablePath1, table1FilterCTEs)
      : buildWhereClause(table1Filters, getColumnTypeFn, table1, fullTablePath1, table1FilterCTEs)
  ) : "";
  
  // Build per-table ORDER BY for CTE1 (array-based)
  let cte1OrderByClause = "";
  if (table1OrderByColumns && table1OrderByColumns.length > 0) {
    const validCols = table1OrderByColumns.filter(c => c.column);
    if (validCols.length > 0) {
      const orderParts = validCols.map(c => {
        const parts = c.column.split('.');
        const colName = parts.length > 1 ? parts[parts.length - 1] : c.column;
        return `${colName} ${c.direction || 'ASC'}`;
      });
      cte1OrderByClause = `\n    ORDER BY ${orderParts.join(', ')}`;
    }
  }
  
  // Build per-table LIMIT for CTE1
  let cte1LimitClause = "";
  if (table1LimitEnabled) {
    const limitVal = table1LimitValue !== "" && table1LimitValue !== null ? table1LimitValue : 0;
    if (limitVal > 0) {
      cte1LimitClause = `\n    LIMIT ${limitVal}`;
    }
  }
  
  const cte1 = `${cte1Name} AS (\n    SELECT ${table1CteColumns}\n    FROM ${sourceTable1}${table1WhereClause}${table1GroupByClause}${table1HavingClause}${cte1OrderByClause}${cte1LimitClause}\n  )`;

  // Build Table 2 CTE (with filters, aggregation, ORDER BY, and LIMIT)
  const sourceTable2 = isTable2SavedDataset ? fullTablePath2 : fullTablePath2;
  const table2FilterCTEs = [];
  const table2WhereClause = table2FilterEnabled ? (
    isTable2SavedDataset
      ? buildWhereClause(table2Filters, getColumnTypeFn, fullTablePath2, fullTablePath2, table2FilterCTEs)
      : buildWhereClause(table2Filters, getColumnTypeFn, table2, fullTablePath2, table2FilterCTEs)
  ) : "";
  
  // Build per-table ORDER BY for CTE2 (array-based)
  let cte2OrderByClause = "";
  if (table2OrderByColumns && table2OrderByColumns.length > 0) {
    const validCols = table2OrderByColumns.filter(c => c.column);
    if (validCols.length > 0) {
      const orderParts = validCols.map(c => {
        const parts = c.column.split('.');
        const colName = parts.length > 1 ? parts[parts.length - 1] : c.column;
        return `${colName} ${c.direction || 'ASC'}`;
      });
      cte2OrderByClause = `\n    ORDER BY ${orderParts.join(', ')}`;
    }
  }
  
  // Build per-table LIMIT for CTE2
  let cte2LimitClause = "";
  if (table2LimitEnabled) {
    const limitVal = table2LimitValue !== "" && table2LimitValue !== null ? table2LimitValue : 0;
    if (limitVal > 0) {
      cte2LimitClause = `\n    LIMIT ${limitVal}`;
    }
  }
  
  const cte2 = `${cte2Name} AS (\n    SELECT ${table2CteColumns}\n    FROM ${sourceTable2}${table2WhereClause}${table2GroupByClause}${table2HavingClause}${cte2OrderByClause}${cte2LimitClause}\n  )`;

  // Build column selection
  let columnsClause = "*";
  if (selectedColumns.length > 0) {
    const cte1Base = table1CteName || `${table1}_filtered`;
    const cte2Base = table2CteName || `${table2}_filtered`;
    columnsClause = selectedColumns.map(c => {
      const parts = c.split('.');
      if (parts.length > 1) {
        const alias = (parts[0] === cte1Name || parts[0] === cte1Base) ? "t1" : "t2";
        return `${alias}.${parts[1]}`;
      }
      return c;
    }).join(",\n  ");
  }

  // Build JOIN condition - supports multiple conditions with AND/OR and chain grouping
  let joinCondition = "";
  // Use joinConditions array if available, otherwise fall back to single pair
  const conditions = joinConditions && joinConditions.length > 0 
    ? joinConditions.filter(c => c.leftColumn && c.rightColumn)
    : (joinLeftColumn && joinRightColumn ? [{ leftColumn: joinLeftColumn, rightColumn: joinRightColumn, joinType: "AND", chainWithNext: false }] : []);
  
  if (conditions.length > 0) {
    if (conditions.length === 1) {
      // Single condition - no grouping needed
      joinCondition = `t1.${conditions[0].leftColumn} = t2.${conditions[0].rightColumn}`;
    } else {
      // Multiple conditions - apply chain grouping logic
      // Build condition data with metadata
      const conditionData = conditions.map((c, idx) => ({
        condition: `t1.${c.leftColumn} = t2.${c.rightColumn}`,
        joinType: c.joinType || "AND",
        chainWithNext: c.chainWithNext || false
      }));
      
      // Find chain groups based on chainWithNext property
      const groups = [];
      let currentGroup = [conditionData[0]];
      
      for (let i = 0; i < conditionData.length - 1; i++) {
        if (conditionData[i].chainWithNext) {
          currentGroup.push(conditionData[i + 1]);
        } else {
          groups.push(currentGroup);
          currentGroup = [conditionData[i + 1]];
        }
      }
      groups.push(currentGroup);
      
      // Build the condition string from groups
      const groupStrings = groups.map((group) => {
        if (group.length === 1) {
          return group[0].condition;
        } else {
          // Multiple conditions in group, wrap in brackets
          const innerConditions = group.map((c, idx) => {
            if (idx === 0) {
              return c.condition;
            } else {
              return `${c.joinType} ${c.condition}`;
            }
          }).join(" ");
          return `(${innerConditions})`;
        }
      });
      
      // Connect groups with the joinType of the first condition in each group
      let result = groupStrings[0];
      for (let i = 1; i < groups.length; i++) {
        const joinOp = groups[i][0].joinType;
        result = `${result} ${joinOp} ${groupStrings[i]}`;
      }
      
      joinCondition = result;
    }
  } else {
    joinCondition = "<join_condition>";
  }

  // Build post-join WHERE clause with bracket grouping (all post-join filters applied here)
  const postJoinFilterCTEs = [];
  const postJoinWhereClause = buildPostJoinWhereClause(
    allPostJoinFilters, 
    getColumnTypeFn, 
    cte1Name, 
    cte2Name, 
    table1, 
    table2, 
    fullTablePath1, 
    fullTablePath2,
    postJoinFilterCTEs
  );

  // Build final SQL with saved CTEs included
  let allCTEs = [];
  if (savedCTEs1) {
    allCTEs.push(savedCTEs1);
  }
  if (savedCTEs2) {
    allCTEs.push(savedCTEs2);
  }
  if (table1FilterCTEs.length > 0) {
    allCTEs.push(...table1FilterCTEs);
  }
  if (table2FilterCTEs.length > 0) {
    allCTEs.push(...table2FilterCTEs);
  }
  if (postJoinFilterCTEs.length > 0) {
    allCTEs.push(...postJoinFilterCTEs);
  }
  allCTEs.push(cte1);
  allCTEs.push(cte2);
  
  // ORDER BY and LIMIT - use join-specific settings (array-based), fallback to global
  let orderByClause = "";
  if (joinOrderByColumns && joinOrderByColumns.length > 0) {
    const validCols = joinOrderByColumns.filter(c => c.column);
    if (validCols.length > 0) {
      const orderParts = validCols.map(c => {
        // For join, the column ID may include table prefix - extract column name and alias
        const parts = c.column.split('.');
        let columnRef = c.column;
        if (parts.length > 1) {
          const tablePart = parts[0];
          const columnName = parts[parts.length - 1];
          // Determine if it's from table 1 or table 2; allow for UUID suffix differences
          const isTable1 = cte1Name === tablePart || cte1Name.startsWith(`${tablePart}_`);
          const isTable2 = cte2Name === tablePart || cte2Name.startsWith(`${tablePart}_`);
          const alias = isTable1 ? "t1" : (isTable2 ? "t2" : "t1");
          columnRef = `${alias}.${columnName}`;
        }
        return `${columnRef} ${c.direction || 'ASC'}`;
      });
      orderByClause = `\nORDER BY ${orderParts.join(', ')}`;
    }
  } else {
    orderByClause = buildOrderByClause(orderByColumns);
  }
  
  // LIMIT - use join settings if enabled, otherwise fallback to global
  let limitClause = "";
  if (joinLimitEnabled) {
    const limitVal = joinLimitValue !== "" && joinLimitValue !== null ? joinLimitValue : 0;
    if (limitVal > 0) {
      limitClause = `\nLIMIT ${limitVal}`;
    }
  } else if (limitEnabled && limitValue) {
    limitClause = buildLimitClause(limitEnabled, limitValue);
  }
  
  const sql = `WITH
  ${allCTEs.join(",\n  ")}
SELECT
  ${columnsClause}
FROM ${cte1Name} t1
${joinType} ${cte2Name} t2
  ON ${joinCondition}${postJoinWhereClause}${orderByClause}${limitClause}`;

  return sql;
};

// Keep the old generateSQL for backward compatibility
export const generateSQL = generateCTESQL;

/**
 * Transform a SQL query to wrap the final SELECT as a CTE with the given name.
 * This allows the saved dataset to be reused in other queries.
 * 
 * Example input:
 * WITH
 *   orders_filtered AS (
 *     SELECT * FROM orders WHERE total_amount > 148
 *   )
 * SELECT * FROM orders_filtered
 * 
 * Example output (with datasetName = "high_value_orders"):
 * WITH
 *   orders_filtered AS (
 *     SELECT * FROM orders WHERE total_amount > 148
 *   ),
 *   high_value_orders AS (
 *     SELECT * FROM orders_filtered
 *   )
 * SELECT * FROM high_value_orders
 * 
 * @param {string} sql - The original SQL query
 * @param {string} datasetName - The name to use for the new CTE
 * @returns {string} - The transformed SQL
 */
export const transformSQLForSaveDataset = (sql, datasetName) => {
  if (!sql || !datasetName) return sql;

  const cleanName = datasetName
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase();

  const trimmed = sql.trim();

  // Case 1: SQL already has WITH
  if (/^WITH\s/i.test(trimmed)) {
    // Find the FIRST top-level SELECT (not inside parentheses)
    let depth = 0;
    let index = -1;

    for (let i = 0; i < trimmed.length; i++) {
      const char = trimmed[i];
      if (char === "(") depth++;
      if (char === ")") depth--;
      if (
        depth === 0 &&
        trimmed.slice(i, i + 6).toUpperCase() === "SELECT"
      ) {
        index = i;
        break;
      }
    }

    if (index === -1) return sql;

    const cteBlock = trimmed.slice(0, index).trimEnd().replace(/,\s*$/, "");
    const finalSelect = trimmed.slice(index).trim();

    return `
${cteBlock},
${cleanName} AS (
  ${finalSelect}
)
SELECT * FROM ${cleanName}
`.trim();
  }

  // Case 2: SQL starts directly with SELECT
  if (/^SELECT\s/i.test(trimmed)) {
    return `
WITH
${cleanName} AS (
  ${trimmed}
)
SELECT * FROM ${cleanName}
`.trim();
  }

  return sql;
};


/**
 * Generate SQL for a single table with filters (for preview)
 * @param {string} database - Project name (BigQuery)
 * @param {string} dataset - Dataset name (BigQuery)
 * @param {string} table - Table name
 * @param {Array} filters - Array of filter objects
 * @param {Array} selectedColumns - Array of selected column IDs (empty = all columns)
 * @param {Function} getColumnTypeFn - Function to get column type
 * @returns {string} - SQL query string
 */
export const generateSingleTableSQL = (database, dataset, table, filters, selectedColumns, getColumnTypeFn, options = {}) => {
  if (!database || !dataset || !table) {
    return null;
  }

  // Extract options with defaults (supports both array-based and legacy single-column ORDER BY)
  const {
    orderByColumns = [],
    orderByColumn = "", // Legacy support
    orderByDirection = "ASC", // Legacy support
    limitEnabled = false,
    limitValue = "",
    filterEnabled = true,
    groupByEnabled = false,
    groupByColumns = [],
    aggregationEnabled = false,
    aggregationColumns = [],
    havingConditions = []
  } = options;

  // BigQuery format: `project.dataset.table`
  const fullTablePath = `\`${database}.${dataset}.${table}\``;
  const savedFilterCTEs = [];
  const whereClause = filterEnabled ? buildWhereClause(filters, getColumnTypeFn, table, fullTablePath, savedFilterCTEs) : "";
  
  const useGroup = groupByEnabled || aggregationEnabled;
  let columnsClause = "*";
  if (useGroup) {
    columnsClause = buildAggregationSelectClause({
      groupByColumns,
      aggregationColumns,
      aggregationEnabled,
      groupByEnabled: useGroup
    });
  } else if (selectedColumns && selectedColumns.length > 0) {
    const columnNames = selectedColumns.map(col => {
      const parts = col.split('.');
      return parts.length > 1 ? parts[1] : col;
    });
    columnsClause = columnNames.join(", ");
  }
  const groupByClause = buildGroupByClause(groupByColumns, useGroup);
  const havingClause = aggregationEnabled ? buildHavingClause(havingConditions) : "";

  const ctePrefix = savedFilterCTEs.length > 0 ? `WITH\n${savedFilterCTEs.join(",\n")}\n` : "";

  // Build ORDER BY clause - supports array-based (new) or single-column (legacy)
  let orderByClause = "";
  if (orderByColumns && orderByColumns.length > 0) {
    const validCols = orderByColumns.filter(c => c.column);
    if (validCols.length > 0) {
      const orderParts = validCols.map(c => {
        const parts = c.column.split('.');
        const colName = parts.length > 1 ? parts[parts.length - 1] : c.column;
        return `${colName} ${c.direction || 'ASC'}`;
      });
      orderByClause = `\nORDER BY ${orderParts.join(', ')}`;
    }
  } else if (orderByColumn) {
    // Legacy single-column support
    const parts = orderByColumn.split('.');
    const columnName = parts.length > 1 ? parts[parts.length - 1] : orderByColumn;
    orderByClause = `\nORDER BY ${columnName} ${orderByDirection}`;
  }

  // Build LIMIT clause - use user value if enabled, otherwise default to 100
  let limitClause = "";
  if (limitEnabled) {
    const resolvedLimit = limitValue !== "" && limitValue !== null ? limitValue : 0;
    if (resolvedLimit > 0) {
      limitClause = `\nLIMIT ${resolvedLimit}`;
    }
  } else {
    // Default limit of 100 for preview queries
    limitClause = `\nLIMIT 100`;
  }

  return `${ctePrefix}SELECT ${columnsClause}\nFROM ${fullTablePath}${whereClause}${groupByClause}${havingClause}${orderByClause}${limitClause}`;
};

/**
 * Generate SQL for a saved dataset with filters applied (for preview)
 * @param {string} savedSQL - The saved SQL definition from usersSavedQueries
 * @param {string} datasetName - The friendly name of the saved dataset (e.g., "test_1")
 * @param {Array} filters - Array of filter objects to apply
 * @param {Array} selectedColumns - Array of selected column IDs (empty = all columns)
 * @param {Function} getColumnTypeFn - Function to get column type
 * @param {string} database - Project name (for derived filter subqueries)
 * @param {string} dataset - Dataset name (for derived filter subqueries)
 * @returns {string} - SQL query string
 */
export const generateSavedDatasetSQL = (savedSQL, datasetName, filters, selectedColumns, getColumnTypeFn, database, dataset, options = {}) => {
  if (!savedSQL || !datasetName) {
    return null;
  }

  // Extract options with defaults
  // Extract options with defaults (supports both array-based and legacy single-column ORDER BY)
  const {
    orderByColumns = [],
    orderByColumn = "", // Legacy support
    orderByDirection = "ASC", // Legacy support
    limitEnabled = false,
    limitValue = 100,
    filterEnabled = true,
    groupByEnabled = false,
    groupByColumns = [],
    aggregationEnabled = false,
    aggregationColumns = [],
    havingConditions = []
  } = options;

  // Fix double quotes in saved SQL
  let baseSql = savedSQL.replace(/''/g, "'");
  
  // Remove the final SELECT statement from the saved SQL to get just the CTEs
  // The saved SQL format is: WITH ... SELECT * FROM <datasetName>
  const selectPattern = /SELECT\s+\*\s+FROM\s+\w+\s*;?\s*$/i;
  const ctesPart = baseSql.replace(selectPattern, '').trim();
  
  const useGroup = groupByEnabled || aggregationEnabled;
  let columnsClause = "*";
  if (useGroup) {
    columnsClause = buildAggregationSelectClause({
      groupByColumns,
      aggregationColumns,
      aggregationEnabled,
      groupByEnabled: useGroup
    });
  } else if (selectedColumns && selectedColumns.length > 0) {
    const columnNames = selectedColumns.map(col => {
      const parts = col.split('.');
      return parts.length > 1 ? parts[1] : col;
    });
    columnsClause = columnNames.join(", ");
  }
  const groupByClause = buildGroupByClause(groupByColumns, useGroup);
  const havingClause = aggregationEnabled ? buildHavingClause(havingConditions) : "";

  // Build where clause for new filters
  let whereClause = "";
  if (filterEnabled && filters && filters.length > 0) {
    const validFilters = filters.filter(f => f.column && f.operator);
    if (validFilters.length > 0) {
      const conditions = [];
      
      validFilters.forEach((filter, index) => {
        const columnType = getColumnTypeFn ? getColumnTypeFn(filter.column) : "STRING";
        let condition = "";
        
        // Get just the column name without table prefix
        const columnParts = filter.column.split('.');
        const columnName = columnParts.length > 1 ? columnParts[1] : filter.column;
        
        // Handle different value types
        if (filter.valueType === "derived") {
          // Derived value (aggregation from same table or another table)
          if (filter.aggregation === "DATABASE" && filter.aggregationTable && filter.aggregationColumn) {
            // Value from another table
            if (filter.aggregationSavedSQL) {
              const extracted = extractCTEsFromSavedSQL(
                unescapeQuotes(filter.aggregationSavedSQL),
                filter.aggregationSavedDatasetName || filter.aggregationTable
              );
              const withClause = extracted.ctes ? `WITH\n${extracted.ctes}\n` : "";
              const targetColumn = (filter.aggregationColumn || "").split(".").pop();
              const subquery = `${withClause}SELECT ${targetColumn} FROM ${extracted.finalCTEName}`;
              condition = `${columnName} ${filter.operator} (${subquery})`;
            } else {
            const colParts = filter.aggregationColumn.split('.');
            const colName = colParts.length > 1 ? colParts[colParts.length - 1] : filter.aggregationColumn;
            condition = `${columnName} ${filter.operator} (SELECT ${colName} FROM \`${database}.${dataset}.${filter.aggregationTable}\`)`;
            }
          } else if (filter.aggregation && filter.aggregationColumn) {
            // Aggregation from same table
            const aggColParts = filter.aggregationColumn.split('.');
            const aggColName = aggColParts.length > 1 ? aggColParts[1] : filter.aggregationColumn;
            condition = `${columnName} ${filter.operator} (SELECT ${filter.aggregation}(${aggColName}) FROM ${datasetName})`;
          }
        } else {
          // Direct value
          const value = filter.value;
          
          if (filter.operator === "IS NULL" || filter.operator === "IS NOT NULL") {
            condition = `${columnName} ${filter.operator}`;
          } else if (filter.operator === "IN" || filter.operator === "NOT IN") {
            const values = String(value).split(',').map(v => {
              const trimmed = v.trim();
              if (columnType === "INTEGER" || columnType === "FLOAT" || columnType === "NUMERIC") {
                return trimmed;
              }
              return `'${trimmed}'`;
            }).join(', ');
            condition = `${columnName} ${filter.operator} (${values})`;
          } else if (filter.operator === "LIKE" || filter.operator === "NOT LIKE") {
            condition = `${columnName} ${filter.operator} '${value}'`;
          } else if (filter.operator === "STARTS WITH") {
            condition = `${columnName} LIKE '${value}%'`;
          } else if (filter.operator === "ENDS WITH") {
            condition = `${columnName} LIKE '%${value}'`;
          } else if (filter.operator === "BETWEEN") {
            const [val1, val2] = String(value).split(',').map(v => v.trim());
            if (columnType === "INTEGER" || columnType === "FLOAT" || columnType === "NUMERIC") {
              condition = `${columnName} BETWEEN ${val1} AND ${val2}`;
            } else {
              condition = `${columnName} BETWEEN '${val1}' AND '${val2}'`;
            }
          } else {
            // Standard operators: =, !=, <, >, <=, >=
            if (columnType === "INTEGER" || columnType === "FLOAT" || columnType === "NUMERIC" || columnType === "BOOLEAN") {
              condition = `${columnName} ${filter.operator} ${value}`;
            } else {
              condition = `${columnName} ${filter.operator} '${value}'`;
            }
          }
        }
        
        if (condition) {
          // Handle AND/OR join
          if (index > 0) {
            const joinType = filter.joinType || "AND";
            conditions.push({ condition, joinType, chainWithNext: filter.chainWithNext });
          } else {
            conditions.push({ condition, joinType: null, chainWithNext: filter.chainWithNext });
          }
        }
      });
      
      if (conditions.length > 0) {
        // Build the where clause with proper grouping
        let whereStr = "";
        let i = 0;
        while (i < conditions.length) {
          const current = conditions[i];
          
          if (i === 0) {
            whereStr = current.condition;
          } else {
            whereStr += ` ${current.joinType} ${current.condition}`;
          }
          
          i++;
        }
        whereClause = `\nWHERE ${whereStr}`;
      }
    }
  }

  // Build ORDER BY clause - supports array-based (new) or single-column (legacy)
  let orderByClause = "";
  if (orderByColumns && orderByColumns.length > 0) {
    const validCols = orderByColumns.filter(c => c.column);
    if (validCols.length > 0) {
      const orderParts = validCols.map(c => {
        const parts = c.column.split('.');
        const colName = parts.length > 1 ? parts[parts.length - 1] : c.column;
        return `${colName} ${c.direction || 'ASC'}`;
      });
      orderByClause = `\nORDER BY ${orderParts.join(', ')}`;
    }
  } else if (orderByColumn) {
    // Legacy single-column support
    const parts = orderByColumn.split('.');
    const columnName = parts.length > 1 ? parts[parts.length - 1] : orderByColumn;
    orderByClause = `\nORDER BY ${columnName} ${orderByDirection}`;
  }

  // Build LIMIT clause - use user value if enabled, otherwise default to 100
  let limitClause = "";
  if (limitEnabled) {
    const resolvedLimit = limitValue !== "" && limitValue !== null ? limitValue : 0;
    if (resolvedLimit > 0) {
      limitClause = `\nLIMIT ${resolvedLimit}`;
    }
  } else {
    // Default limit of 100 for preview queries
    limitClause = `\nLIMIT 100`;
  }

   // Build final SQL with CTEs + filtered SELECT
  return `${ctesPart}\nSELECT ${columnsClause}\nFROM ${datasetName}${whereClause}${groupByClause}${havingClause}${orderByClause}${limitClause}`;
};
