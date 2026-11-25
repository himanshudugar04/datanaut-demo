// Mock database schema for SQL Builder
// Structure: Projects → Datasets → Tables → Columns + Sample Data


// SQL filter operators categorized by data type
export const filterOperatorsByType = {
  // Numeric types: INTEGER, FLOAT
  NUMERIC: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "<", name: "<", label: "less than" },
    { id: ">", name: ">", label: "greater than" },
    { id: "<=", name: "<=", label: "less than or equal" },
    { id: ">=", name: ">=", label: "greater than or equal" },
    { id: "IN", name: "IN", label: "in" },
    { id: "NOT IN", name: "NOT IN", label: "not in" },
    { id: "BETWEEN", name: "BETWEEN", label: "between" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ],
  // String types: STRING
  STRING: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "LIKE", name: "LIKE", label: "contains" },
    { id: "NOT LIKE", name: "NOT LIKE", label: "not contains" },
    { id: "STARTS WITH", name: "STARTS WITH", label: "starts with" },
    { id: "ENDS WITH", name: "ENDS WITH", label: "ends with" },
    { id: "IN", name: "IN", label: "in" },
    { id: "NOT IN", name: "NOT IN", label: "not in" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ],
  // JSON types: JSON (uses same operators as STRING)
  JSON: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "LIKE", name: "LIKE", label: "contains" },
    { id: "NOT LIKE", name: "NOT LIKE", label: "not contains" },
    { id: "STARTS WITH", name: "STARTS WITH", label: "starts with" },
    { id: "ENDS WITH", name: "ENDS WITH", label: "ends with" },
    { id: "IN", name: "IN", label: "in" },
    { id: "NOT IN", name: "NOT IN", label: "not in" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ],
  // Date types: DATE
  DATE: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "<", name: "<", label: "before" },
    { id: ">", name: ">", label: "after" },
    { id: "<=", name: "<=", label: "on or before" },
    { id: ">=", name: ">=", label: "on or after" },
    { id: "BETWEEN", name: "BETWEEN", label: "between" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ],
  // Timestamp types: TIMESTAMP, DATETIME, TIME (BigQuery)
  TIMESTAMP: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "<", name: "<", label: "before" },
    { id: ">", name: ">", label: "after" },
    { id: "<=", name: "<=", label: "on or before" },
    { id: ">=", name: ">=", label: "on or after" },
    { id: "BETWEEN", name: "BETWEEN", label: "between" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ],
  // Boolean type: BOOLEAN
  BOOLEAN: [
    { id: "=", name: "=", label: "equals" },
    { id: "!=", name: "!=", label: "not equals" },
    { id: "IS NULL", name: "IS NULL", label: "is null" },
    { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
  ]
};

// Helper function to get operator category from column type
// Supports BigQuery data types: INT64, FLOAT64, NUMERIC, BIGNUMERIC, STRING, BYTES, BOOL, DATE, DATETIME, TIME, TIMESTAMP, STRUCT, ARRAY, GEOGRAPHY, JSON
// Also supports standard SQL types for backward compatibility: VARCHAR, INT, BOOLEAN, DATETIME
export const getOperatorCategory = (columnType) => {
  const type = columnType?.toUpperCase();
  
  // BigQuery numeric types: INT64, FLOAT64, NUMERIC, BIGNUMERIC
  // Also supports standard SQL: INTEGER, INT, FLOAT, DECIMAL, NUMBER
  if (type === "INTEGER" || type === "INT64" || type === "FLOAT" || type === "FLOAT64" || 
      type === "INT" || type === "DECIMAL" || type === "NUMBER" || 
      type === "NUMERIC" || type === "BIGNUMERIC" || type === "DOUBLE" || type === "REAL") {
    return "NUMERIC";
  }
  // BigQuery DATE type
  if (type === "DATE") {
    return "DATE";
  }
  // BigQuery TIMESTAMP and DATETIME types
  if (type === "TIMESTAMP" || type === "DATETIME" || type === "TIME") {
    return "TIMESTAMP";
  }
  // BigQuery BOOL type (also supports BOOLEAN for backward compatibility)
  if (type === "BOOLEAN" || type === "BOOL") {
    return "BOOLEAN";
  }
  // BigQuery JSON type
  if (type === "JSON") {
    return "JSON";
  }
  // BigQuery complex types (STRUCT, ARRAY, GEOGRAPHY) - treat as STRING for filtering
  if (type === "STRUCT" || type === "ARRAY" || type === "GEOGRAPHY" || type === "BYTES" || type === "RECORD") {
    return "STRING";
  }
  // String types: STRING (BigQuery), VARCHAR, CHAR, TEXT (standard SQL)
  if (type === "STRING" || type === "VARCHAR" || type === "CHAR" || type === "TEXT" || type === "NVARCHAR") {
    return "STRING";
  }
  // Default to STRING for unknown types
  return "STRING";
};

// Get filter operators for a specific column type
export const getFilterOperatorsForType = (columnType) => {
  const category = getOperatorCategory(columnType);
  return filterOperatorsByType[category] || filterOperatorsByType.STRING;
};

// All filter operators (for backwards compatibility)
export const filterOperators = [
  { id: "=", name: "=", label: "equals" },
  { id: "!=", name: "!=", label: "not equals" },
  { id: "<", name: "<", label: "less than" },
  { id: ">", name: ">", label: "greater than" },
  { id: "<=", name: "<=", label: "less than or equal" },
  { id: ">=", name: ">=", label: "greater than or equal" },
  { id: "LIKE", name: "LIKE", label: "like" },
  { id: "NOT LIKE", name: "NOT LIKE", label: "not like" },
  { id: "IN", name: "IN", label: "in" },
  { id: "NOT IN", name: "NOT IN", label: "not in" },
  { id: "IS NULL", name: "IS NULL", label: "is null" },
  { id: "IS NOT NULL", name: "IS NOT NULL", label: "is not null" }
];

// Aggregation functions for derived values (only for numeric types)
export const aggregationFunctions = [
  { id: "COUNT", name: "COUNT", label: "Count", supportsAllTypes: true },
  { id: "SUM", name: "SUM", label: "Sum", supportsAllTypes: false },
  { id: "AVG", name: "AVG", label: "Average", supportsAllTypes: false },
  { id: "MIN", name: "MIN", label: "Minimum", supportsAllTypes: true },
  { id: "MAX", name: "MAX", label: "Maximum", supportsAllTypes: true },
  { id: "DATABASE", name: "Database", label: "Select from database table with single column", supportsAllTypes: true, isDatabase: true }
];

// Get aggregation functions for a specific column type
export const getAggregationFunctionsForType = (columnType) => {
  const category = getOperatorCategory(columnType);
  
  if (category === "NUMERIC") {
    return aggregationFunctions;
  }
  // For non-numeric types, only allow COUNT, MIN, MAX
  return aggregationFunctions.filter(f => f.supportsAllTypes);
};

// Filter join options
export const filterJoinOptions = [
  { id: "AND", name: "AND", label: "All conditions must match" },
  { id: "OR", name: "OR", label: "Any condition can match" }
];

// Join types for table joins (BigQuery compatible)
// Simplified to only include commonly used join types
export const joinTypes = [
  { id: "INNER JOIN", name: "INNER JOIN", label: "Inner Join - Returns matching rows from both tables", icon: "⊙" },
  { id: "LEFT JOIN", name: "LEFT JOIN", label: "Left Join - Returns all rows from left table", icon: "◐" },
  { id: "RIGHT JOIN", name: "RIGHT JOIN", label: "Right Join - Returns all rows from right table", icon: "◑" },
  { id: "FULL JOIN", name: "FULL JOIN", label: "Full Join - Returns all rows from both tables", icon: "◯" }
];

// Value types for filter values
export const valueTypes = [
  { id: "direct", name: "Value", label: "Direct value input" },
  { id: "derived", name: "Derived", label: "Aggregation function on column" }
];

// Column roles for aggregation mode
export const columnRoles = [
  { id: "GROUP_BY", name: "Group By", label: "Group by this column", isAggregate: false, supportsAllTypes: true },
  { id: "COUNT", name: "COUNT", label: "Count values", isAggregate: true, supportsAllTypes: true },
  { id: "COUNT_DISTINCT", name: "COUNT DISTINCT", label: "Count distinct values", isAggregate: true, supportsAllTypes: true },
  { id: "SUM", name: "SUM", label: "Sum values", isAggregate: true, supportsAllTypes: false },
  { id: "AVG", name: "AVG", label: "Average value", isAggregate: true, supportsAllTypes: false },
  { id: "MIN", name: "MIN", label: "Minimum value", isAggregate: true, supportsAllTypes: true },
  { id: "MAX", name: "MAX", label: "Maximum value", isAggregate: true, supportsAllTypes: true },
  { id: "ANY_VALUE", name: "ANY_VALUE", label: "Any value (BigQuery)", isAggregate: true, supportsAllTypes: true }
];

// Get column roles available for a specific column type
export const getColumnRolesForType = (columnType) => {
  const category = getOperatorCategory(columnType);
  
  if (category === "NUMERIC") {
    // Numeric columns can use all roles
    return columnRoles;
  }
  // For non-numeric types, only allow GROUP_BY and roles that support all types
  return columnRoles.filter(role => !role.isAggregate || role.supportsAllTypes);
};

// ORDER BY directions
export const orderByDirections = [
  { id: "ASC", name: "ASC", label: "Ascending (A→Z, 1→9)" },
  { id: "DESC", name: "DESC", label: "Descending (Z→A, 9→1)" }
];

// HAVING operators (for aggregate conditions)
export const havingOperators = [
  { id: "=", name: "=", label: "equals" },
  { id: "!=", name: "!=", label: "not equals" },
  { id: "<", name: "<", label: "less than" },
  { id: ">", name: ">", label: "greater than" },
  { id: "<=", name: "<=", label: "less than or equal" },
  { id: ">=", name: ">=", label: "greater than or equal" },
  { id: "BETWEEN", name: "BETWEEN", label: "between" }
];
