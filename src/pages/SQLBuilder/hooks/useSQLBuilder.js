import { useState, useMemo, useCallback, useEffect } from "react";
import { fetchProjects, fetchDatasets, fetchColumns, fetchTablePreview, fetchSavedDatasetColumns } from "../../../services/databaseApi";

/**
 * Generate a short unique ID for CTE naming (8 characters)
 * Uses random hex characters for uniqueness
 */
const generateShortUUID = () => {
  return Math.random().toString(16).substring(2, 10);
};

/**
 * Custom hook for SQL Builder state management
 * Supports cross-project joins (Table 2 can be from different project)
 * Fetches real data from BigQuery via API
 */
export const useSQLBuilder = () => {
  // API Data State
  const [databases, setDatabases] = useState([]);
  const [datasets, setDatasets] = useState([]); // Datasets for Table 1's database
  const [table2Datasets, setTable2Datasets] = useState([]); // Datasets for Table 2's database
  const [tables, setTables] = useState([]);
  const [table2Tables, setTable2Tables] = useState([]); // Tables for Table 2's database
  const [table1ColumnsData, setTable1ColumnsData] = useState([]);
  const [table2ColumnsData, setTable2ColumnsData] = useState([]);
  const [table1PreviewData, setTable1PreviewData] = useState([]);
  const [table2PreviewData, setTable2PreviewData] = useState([]);
  const [loading, setLoading] = useState({ 
    databases: false, 
    tables: false, 
    table2Tables: false,
    table1Columns: false, 
    table2Columns: false 
  });
  const [error, setError] = useState(null);

  // Database selection
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [table2Database, setTable2Database] = useState(""); // Database for Table 2
  
  // Dataset selection
  const [table1Dataset, setTable1Dataset] = useState("");
  const [table2Dataset, setTable2Dataset] = useState("");
  
  // Table 1 state
  const [table1, setTable1] = useState("");
  const [table1CteName, setTable1CteName] = useState("");
  const [table1Filters, setTable1Filters] = useState([]);
  const [table1UUID, setTable1UUID] = useState(""); // Unique ID for CTE naming
  
  // Table 2 state
  const [table2, setTable2] = useState("");
  const [table2CteName, setTable2CteName] = useState("");
  const [table2Filters, setTable2Filters] = useState([]);
  const [table2UUID, setTable2UUID] = useState(""); // Unique ID for CTE naming
  
  // Table 2 visibility toggle
  const [table2Enabled, setTable2Enabled] = useState(false);
  
  // Handler to enable Table 2 (show UI)
  const enableTable2 = useCallback(() => {
    setTable2Enabled(true);
  }, []);
  
  // Handler to disable and reset Table 2 (hide UI and clear state)
  const disableTable2 = useCallback(() => {
    setTable2Enabled(false);
    // Reset Table 2 state
    setTable2("");
    setTable2CteName("");
    setTable2Filters([]);
    setTable2UUID("");
    setTable2Dataset("");
    setTable2Database("");
    // Reset Table 2 columns data
    setTable2ColumnsData([]);
    setTable2PreviewData([]);
    // Reset Table 2 grouping/aggregation state
    setTable2GroupByEnabled(false);
    setTable2GroupByColumns([]);
    setTable2AggregationEnabled(false);
    setTable2AggregationColumns([]);
    setTable2HavingConditions([]);
    setTable2OrderByColumns([]);
    setTable2LimitEnabled(false);
    setTable2LimitValue(0);
    setTable2FilterEnabled(true);
    // Reset join state
    setJoinConditions([{ id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }]);
    setJoinType("INNER JOIN");
    setResultTableName("");
  }, []);
  
  // Join configuration
  const [joinType, setJoinType] = useState("INNER JOIN");
  // Multiple join conditions: array of { id, leftColumn, rightColumn, joinType, chainWithNext }
  const [joinConditions, setJoinConditions] = useState([
    { id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }
  ]);
  const [resultTableName, setResultTableName] = useState(""); // Name for joined result
  
  // Backward compatibility: joinLeftColumn and joinRightColumn point to first condition
  const joinLeftColumn = joinConditions[0]?.leftColumn || "";
  const joinRightColumn = joinConditions[0]?.rightColumn || "";
  
  // Update single join column (backward compatibility)
  const setJoinLeftColumn = (value) => {
    setJoinConditions(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0] = { ...updated[0], leftColumn: value };
      }
      return updated;
    });
  };
  
  const setJoinRightColumn = (value) => {
    setJoinConditions(prev => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0] = { ...updated[0], rightColumn: value };
      }
      return updated;
    });
  };
  
  // Add new join condition
  const addJoinCondition = () => {
    setJoinConditions(prev => [
      ...prev,
      { id: Date.now(), leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }
    ]);
  };
  
  // Remove join condition
  const removeJoinCondition = (id) => {
    setJoinConditions(prev => {
      // Don't remove if only one condition left
      if (prev.length <= 1) return prev;
      return prev.filter(c => c.id !== id);
    });
  };
  
  // Update join condition
  const updateJoinCondition = (id, field, value) => {
    setJoinConditions(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
  };
  
  // Post-join filters
  const [postJoinFilters, setPostJoinFilters] = useState([]);
  // Track tables already used in DATABASE-derived filters to avoid duplicates
  const databaseFunctionUsedTableIds = useMemo(() => {
    const usedIds = new Set();
    const addFromFilters = (filters = []) => {
      filters.forEach(f => {
        if (f?.valueType === "derived" && f.aggregation === "DATABASE" && f.aggregationTable) {
          usedIds.add(f.aggregationTable);
        }
      });
    };

    addFromFilters(table1Filters);
    addFromFilters(table2Filters);
    addFromFilters(postJoinFilters);

    return usedIds;
  }, [table1Filters, table2Filters, postJoinFilters]);
  
  // Selected columns for final output
  const [selectedColumns, setSelectedColumns] = useState([]);
  
  // Result CTE name
  const [resultCteName, setResultCteName] = useState("");
  
  // Preview columns (for column selection in table cards)
  const [table1PreviewColumns, setTable1PreviewColumns] = useState([]);
  const [table2PreviewColumns, setTable2PreviewColumns] = useState([]);
  
  // Saved dataset SQL definitions (when a saved dataset is selected)
  const [table1SavedDatasetSQL, setTable1SavedDatasetSQL] = useState("");
  const [table1SavedDatasetName, setTable1SavedDatasetName] = useState("");
  const [table2SavedDatasetSQL, setTable2SavedDatasetSQL] = useState("");
  const [table2SavedDatasetName, setTable2SavedDatasetName] = useState("");
  
  // ==========================================
  // PER-TABLE AGGREGATION MODE (GROUP BY, HAVING)
  // ==========================================
  
  // Table 1 toggles
  const [table1FilterEnabled, setTable1FilterEnabled] = useState(true);
  const [table1GroupByEnabled, setTable1GroupByEnabled] = useState(false);
  const [table1AggregationEnabled, setTable1AggregationEnabled] = useState(false);
  const [table1GroupByColumns, setTable1GroupByColumns] = useState([]);
  const [table1AggregationColumns, setTable1AggregationColumns] = useState([]);
  const [table1HavingConditions, setTable1HavingConditions] = useState([]);
  
  // Table 2 toggles
  const [table2FilterEnabled, setTable2FilterEnabled] = useState(true);
  const [table2GroupByEnabled, setTable2GroupByEnabled] = useState(false);
  const [table2AggregationEnabled, setTable2AggregationEnabled] = useState(false);
  const [table2GroupByColumns, setTable2GroupByColumns] = useState([]);
  const [table2AggregationColumns, setTable2AggregationColumns] = useState([]);
  const [table2HavingConditions, setTable2HavingConditions] = useState([]);
  
  // Table 1 ORDER BY and LIMIT (for individual table queries)
  // Array-based ORDER BY: [{ id, column, direction }]
  const [table1OrderByColumns, setTable1OrderByColumns] = useState([]);
  const [table1LimitEnabled, setTable1LimitEnabled] = useState(false);
  const [table1LimitValue, setTable1LimitValue] = useState("");
  
  // Table 2 ORDER BY and LIMIT (for individual table queries)
  const [table2OrderByColumns, setTable2OrderByColumns] = useState([]);
  const [table2LimitEnabled, setTable2LimitEnabled] = useState(false);
  const [table2LimitValue, setTable2LimitValue] = useState(0);
  
  // Join ORDER BY and LIMIT (for joined result)
  const [joinOrderByColumns, setJoinOrderByColumns] = useState([]);
  const [joinLimitEnabled, setJoinLimitEnabled] = useState(false);
  const [joinLimitValue, setJoinLimitValue] = useState(0);
  
  // Global ORDER BY and LIMIT (applies to final SELECT) - kept for backward compat
  const [orderByColumns, setOrderByColumns] = useState([]);
  const [limitEnabled, setLimitEnabled] = useState(false);
  const [limitValue, setLimitValue] = useState(0);
  
  // Table 1 Group By handlers
  const addTable1GroupByColumn = useCallback(() => {
    setTable1GroupByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "" }
    ]);
  }, []);
  
  const updateTable1GroupByColumn = useCallback((id, field, value) => {
    setTable1GroupByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable1GroupByColumn = useCallback((id) => {
    setTable1GroupByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Table 1 Aggregation handlers
  const addTable1AggregationColumn = useCallback(() => {
    setTable1AggregationColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", role: "COUNT", alias: "" }
    ]);
  }, []);
  
  const updateTable1AggregationColumn = useCallback((id, field, value) => {
    setTable1AggregationColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable1AggregationColumn = useCallback((id) => {
    setTable1AggregationColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  const addTable1HavingCondition = useCallback(() => {
    setTable1HavingConditions(prev => [
      ...prev,
      { id: Date.now(), column: "", operator: ">", value: "", joinType: "AND", chainWithNext: false }
    ]);
  }, []);
  
  const updateTable1HavingCondition = useCallback((id, field, value) => {
    setTable1HavingConditions(prev => prev.map(cond => 
      cond.id === id ? { ...cond, [field]: value } : cond
    ));
  }, []);
  
  const removeTable1HavingCondition = useCallback((id) => {
    setTable1HavingConditions(prev => prev.filter(cond => cond.id !== id));
  }, []);
  
  // Table 2 Group By handlers
  const addTable2GroupByColumn = useCallback(() => {
    setTable2GroupByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "" }
    ]);
  }, []);
  
  const updateTable2GroupByColumn = useCallback((id, field, value) => {
    setTable2GroupByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable2GroupByColumn = useCallback((id) => {
    setTable2GroupByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Table 2 Aggregation handlers
  const addTable2AggregationColumn = useCallback(() => {
    setTable2AggregationColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", role: "COUNT", alias: "" }
    ]);
  }, []);
  
  const updateTable2AggregationColumn = useCallback((id, field, value) => {
    setTable2AggregationColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable2AggregationColumn = useCallback((id) => {
    setTable2AggregationColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  const addTable2HavingCondition = useCallback(() => {
    setTable2HavingConditions(prev => [
      ...prev,
      { id: Date.now(), column: "", operator: ">", value: "", joinType: "AND", chainWithNext: false }
    ]);
  }, []);
  
  const updateTable2HavingCondition = useCallback((id, field, value) => {
    setTable2HavingConditions(prev => prev.map(cond => 
      cond.id === id ? { ...cond, [field]: value } : cond
    ));
  }, []);
  
  const removeTable2HavingCondition = useCallback((id) => {
    setTable2HavingConditions(prev => prev.filter(cond => cond.id !== id));
  }, []);
  
  // ORDER BY handlers (global - legacy)
  const addOrderByColumn = useCallback(() => {
    setOrderByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", direction: "ASC" }
    ]);
  }, []);
  
  const updateOrderByColumn = useCallback((id, field, value) => {
    setOrderByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeOrderByColumn = useCallback((id) => {
    setOrderByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Table 1 ORDER BY handlers
  const addTable1OrderByColumn = useCallback(() => {
    setTable1OrderByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", direction: "ASC" }
    ]);
  }, []);
  
  const updateTable1OrderByColumn = useCallback((id, field, value) => {
    setTable1OrderByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable1OrderByColumn = useCallback((id) => {
    setTable1OrderByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Table 2 ORDER BY handlers
  const addTable2OrderByColumn = useCallback(() => {
    setTable2OrderByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", direction: "ASC" }
    ]);
  }, []);
  
  const updateTable2OrderByColumn = useCallback((id, field, value) => {
    setTable2OrderByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeTable2OrderByColumn = useCallback((id) => {
    setTable2OrderByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Join ORDER BY handlers
  const addJoinOrderByColumn = useCallback(() => {
    setJoinOrderByColumns(prev => [
      ...prev,
      { id: Date.now(), column: "", direction: "ASC" }
    ]);
  }, []);
  
  const updateJoinOrderByColumn = useCallback((id, field, value) => {
    setJoinOrderByColumns(prev => prev.map(col => 
      col.id === id ? { ...col, [field]: value } : col
    ));
  }, []);
  
  const removeJoinOrderByColumn = useCallback((id) => {
    setJoinOrderByColumns(prev => prev.filter(col => col.id !== id));
  }, []);
  
  // Reset Table 1 aggregation state
  const resetTable1AggregationState = useCallback(() => {
    setTable1GroupByEnabled(false);
    setTable1AggregationEnabled(false);
    setTable1GroupByColumns([]);
    setTable1AggregationColumns([]);
    setTable1HavingConditions([]);
    // Also reset ORDER BY and LIMIT
    setTable1OrderByColumns([]);
    setTable1LimitEnabled(false);
    setTable1LimitValue("");
  }, []);
  
  // Reset Table 2 aggregation state
  const resetTable2AggregationState = useCallback(() => {
    setTable2GroupByEnabled(false);
    setTable2AggregationEnabled(false);
    setTable2GroupByColumns([]);
    setTable2AggregationColumns([]);
    setTable2HavingConditions([]);
    // Also reset ORDER BY and LIMIT
    setTable2OrderByColumns([]);
    setTable2LimitEnabled(false);
    setTable2LimitValue(0);
  }, []);
  
  // UI state
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("queries");

  // Fetch databases on mount
  useEffect(() => {
    const loadDatabases = async () => {
      setLoading(prev => ({ ...prev, databases: true }));
      setError(null);
      try {
        const data = await fetchProjects();
        setDatabases(data);
      } catch (err) {
        console.error("Failed to fetch databases:", err);
        setError("Failed to load databases. Make sure the backend server is running.");
      } finally {
        setLoading(prev => ({ ...prev, databases: false }));
      }
    };
    loadDatabases();
  }, []);

  // Fetch datasets and tables for Table 1's database
  useEffect(() => {
    if (!selectedDatabase) {
      setDatasets([]);
      setTables([]);
      setTable1Dataset("");
      return;
    }

    const loadDatasets = async () => {
      setLoading(prev => ({ ...prev, tables: true }));
      try {
        const data = await fetchDatasets(selectedDatabase);
        setDatasets(data);
        // Flatten tables with dataset info
        const flattenedTables = data.flatMap(dataset => 
          dataset.tables.map(table => ({
            ...table,
            datasetId: dataset.id,
            datasetName: dataset.name
          }))
        );
        setTables(flattenedTables);
        // Auto-select dataset: if table1 is already selected, use its dataset; otherwise use first dataset
        if (data.length > 0) {
          if (table1) {
            const selectedTableObj = flattenedTables.find(t => t.id === table1);
            if (selectedTableObj && selectedTableObj.datasetId) {
              console.log("Auto-setting dataset for selected table:", selectedTableObj.datasetId);
              setTable1Dataset(selectedTableObj.datasetId);
            } else if (!table1Dataset) {
              console.log("Auto-selecting first dataset:", data[0].id);
              setTable1Dataset(data[0].id);
            }
          } else if (!table1Dataset) {
            console.log("Auto-selecting first dataset (no table selected):", data[0].id);
            setTable1Dataset(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch datasets:", err);
        setError("Failed to load datasets.");
      } finally {
        setLoading(prev => ({ ...prev, tables: false }));
      }
    };
    loadDatasets();
  }, [selectedDatabase]);

  // Fetch datasets and tables for Table 2's database (if different)
  useEffect(() => {
    if (!table2Database) {
      setTable2Datasets([]);
      setTable2Tables([]);
      setTable2Dataset("");
      return;
    }

    // If same as selected database, use same datasets and tables
    if (table2Database === selectedDatabase) {
      setTable2Datasets(datasets);
      setTable2Tables(tables);
      if (datasets.length > 0 && !table2Dataset) {
        setTable2Dataset(datasets[0].id);
      }
      return;
    }

    const loadTable2Datasets = async () => {
      setLoading(prev => ({ ...prev, table2Tables: true }));
      try {
        const data = await fetchDatasets(table2Database);
        setTable2Datasets(data);
        // Flatten tables with dataset info
        const flattenedTables = data.flatMap(dataset => 
          dataset.tables.map(table => ({
            ...table,
            datasetId: dataset.id,
            datasetName: dataset.name
          }))
        );
        setTable2Tables(flattenedTables);
        // Auto-select dataset: if table2 is already selected, use its dataset; otherwise use first dataset
        if (data.length > 0) {
          if (table2) {
            const selectedTableObj = flattenedTables.find(t => t.id === table2);
            if (selectedTableObj && selectedTableObj.datasetId) {
              setTable2Dataset(selectedTableObj.datasetId);
            } else if (!table2Dataset) {
              setTable2Dataset(data[0].id);
            }
          } else if (!table2Dataset) {
            setTable2Dataset(data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch table2 datasets:", err);
      } finally {
        setLoading(prev => ({ ...prev, table2Tables: false }));
      }
    };
    loadTable2Datasets();
  }, [table2Database, selectedDatabase, datasets, tables]);

  // Fetch Table 1 columns when table1 or dataset changes
  useEffect(() => {
    if (!selectedDatabase || !table1 || !table1Dataset) {
      setTable1ColumnsData([]);
      setTable1PreviewData([]);
      if (table1 && !table1Dataset) {
        console.warn("Table1 selected but dataset not set:", { table1, table1Dataset, tables });
        // Try to find and set the dataset from the table
        const tableObj = tables.find(t => t.id === table1);
        if (tableObj && tableObj.datasetId) {
          console.log("Auto-setting dataset from table object:", tableObj.datasetId);
          setTable1Dataset(tableObj.datasetId);
        }
      }
      return;
    }

    const loadTable1Data = async () => {
      setLoading(prev => ({ ...prev, table1Columns: true }));
      try {
        // Check if this is a saved dataset (id starts with "saved_")
        if (table1.startsWith('saved_')) {
          const datasetId = table1.replace('saved_', '');
          console.log("Fetching saved dataset columns for:", datasetId);
          
          // Always fetch the SQL definition from API for saved datasets
          const result = await fetchSavedDatasetColumns(datasetId);
          console.log("Saved dataset fetched:", result);
          
          // Use columns from API result
          setTable1ColumnsData(result.columns || []);
          setTable1PreviewData([]); // No preview for saved datasets
          
          // Store the SQL definition and dataset name for SQL generation
          setTable1SavedDatasetSQL(result.sql_definition || "");
          setTable1SavedDatasetName(result.dataset_name || "");
          
          console.log("Saved dataset SQL definition:", result.sql_definition);
        } else {
          // Clear saved dataset info when selecting a regular table
          setTable1SavedDatasetSQL("");
          setTable1SavedDatasetName("");
          // Regular table - fetch columns and preview
          console.log("Fetching table1 columns:", { selectedDatabase, table1, table1Dataset });
          const [columns, preview] = await Promise.all([
            fetchColumns(selectedDatabase, table1, table1Dataset),
            fetchTablePreview(selectedDatabase, table1, table1Dataset, 5)
          ]);
          console.log("Table1 columns fetched:", columns, "Count:", columns?.length);
          setTable1ColumnsData(columns || []);
          setTable1PreviewData(preview || []);
        }
      } catch (err) {
        console.error("Failed to fetch table1 data:", err);
        const errorMsg = err.response?.data?.error || err.message || "Failed to load table columns. Make sure dataset is selected.";
        setError(errorMsg);
        setTable1ColumnsData([]);
        setTable1PreviewData([]);
      } finally {
        setLoading(prev => ({ ...prev, table1Columns: false }));
      }
    };
    loadTable1Data();
  }, [selectedDatabase, table1, table1Dataset, tables]);

  // Fetch Table 2 columns - uses table2Database and table2Dataset
  useEffect(() => {
    const db = table2Database || selectedDatabase;
    if (!db || !table2 || !table2Dataset) {
      setTable2ColumnsData([]);
      setTable2PreviewData([]);
      return;
    }

    const loadTable2Data = async () => {
      setLoading(prev => ({ ...prev, table2Columns: true }));
      try {
        // Check if this is a saved dataset (id starts with "saved_")
        if (table2.startsWith('saved_')) {
          const datasetId = table2.replace('saved_', '');
          console.log("Fetching saved dataset columns for table2:", datasetId);
          
          // Always fetch the SQL definition from API for saved datasets
          const result = await fetchSavedDatasetColumns(datasetId);
          console.log("Saved dataset fetched for table2:", result);
          
          // Use columns from API result
          setTable2ColumnsData(result.columns || []);
          setTable2PreviewData([]); // No preview for saved datasets
          
          // Store the SQL definition and dataset name for SQL generation
          setTable2SavedDatasetSQL(result.sql_definition || "");
          setTable2SavedDatasetName(result.dataset_name || "");
          
          console.log("Saved dataset SQL definition for table2:", result.sql_definition);
        } else {
          // Clear saved dataset info when selecting a regular table
          setTable2SavedDatasetSQL("");
          setTable2SavedDatasetName("");
          
          // Regular table - fetch columns and preview
          const [columns, preview] = await Promise.all([
            fetchColumns(db, table2, table2Dataset),
            fetchTablePreview(db, table2, table2Dataset, 5)
          ]);
          setTable2ColumnsData(columns);
          setTable2PreviewData(preview);
        }
      } catch (err) {
        console.error("Failed to fetch table2 data:", err);
      } finally {
        setLoading(prev => ({ ...prev, table2Columns: false }));
      }
    };
    loadTable2Data();
  }, [table2Database, selectedDatabase, table2, table2Dataset, tables, table2Tables]);

  // Get available tables for Table 1 (filtered by selected dataset)
  const availableTables = useMemo(() => {
    // If no dataset selected, show all tables (user can select any table)
    // When a table is selected, its dataset will be auto-set
    if (!table1Dataset) return tables;
    return tables.filter(table => table.datasetId === table1Dataset);
  }, [tables, table1Dataset]);

  // Get available tables for Table 2 (from its selected dataset within same project)
  const table2AvailableTables = useMemo(() => {
    if (!table2Dataset) return tables;
    return tables.filter(table => table.datasetId === table2Dataset);
  }, [tables, table2Dataset]);

  // Get Table 1 columns
  const table1Columns = useMemo(() => {
    return table1ColumnsData;
  }, [table1ColumnsData]);

  // Get Table 2 columns
  const table2Columns = useMemo(() => {
    return table2ColumnsData;
  }, [table2ColumnsData]);

  // Create table data object with columns and sample data for Table 1
  const table1Data = useMemo(() => {
    if (!table1 || table1ColumnsData.length === 0) return null;
    return {
      id: table1,
      name: table1,
      database: selectedDatabase,
      columns: table1ColumnsData,
      sampleData: table1PreviewData
    };
  }, [table1, selectedDatabase, table1ColumnsData, table1PreviewData]);

  // Create table data object with columns and sample data for Table 2
  const table2Data = useMemo(() => {
    if (!table2 || table2ColumnsData.length === 0) return null;
    return {
      id: table2,
      name: table2,
      database: table2Database || selectedDatabase,
      columns: table2ColumnsData,
      sampleData: table2PreviewData
    };
  }, [table2, table2Database, selectedDatabase, table2ColumnsData, table2PreviewData]);

  // Get all available columns (from both tables)
  const allAvailableColumns = useMemo(() => {
    const columns = [];

    // Heuristic type inference for aggregation outputs
    const getAggregationOutputType = (role, baseType) => {
      switch (role) {
        case "COUNT":
        case "COUNT_DISTINCT":
          return "INTEGER";
        case "SUM":
        case "AVG":
          return "NUMERIC";
        case "MIN":
        case "MAX":
          return baseType || "NUMERIC";
        default:
          return baseType || "NUMERIC";
      }
    };

    const addAggregationColumns = ({
      aggregationEnabled,
      aggregationColumns,
      baseColumns,
      cteName,
      tableId,
      tableDisplayName,
      database
    }) => {
      if (!aggregationEnabled || !aggregationColumns || aggregationColumns.length === 0) return;

      aggregationColumns.forEach(col => {
        if (!(col.column || (col.column === "*" && col.role === "COUNT"))) return;

        const baseColName = col.column === "*" ? "*" : col.column.split('.').pop();
        if (!baseColName) return;

        let aggName;
        if (col.column === "*" && col.role === "COUNT") {
          aggName = "COUNT(*)";
        } else if (col.role === "COUNT_DISTINCT") {
          aggName = `COUNT(DISTINCT ${baseColName})`;
        } else {
          aggName = `${col.role}(${baseColName})`;
        }

        const displayName = col.alias || aggName;
        const baseType = baseColName === "*"
          ? "INTEGER"
          : (baseColumns.find(c => c.id === baseColName)?.type || "NUMERIC");

        columns.push({
          id: displayName,
          name: displayName,
          tableId,
          tableName: tableId,
          tableDisplayName,
          database,
          cteName,
          fullId: `${cteName}.${displayName}`,
          tableFullId: `${tableId}.${displayName}`,
          displayName: `${cteName}.${displayName}`,
          type: getAggregationOutputType(col.role, baseType),
          isAggregation: true
        });
      });
    };
    
    if (table1 && table1Columns.length) {
      // Use the same logic as getTable1DefaultCteName for consistency
      let defaultCteName;
      const table1Display = table1SavedDatasetName || table1;
      if (table1.startsWith('saved_') && table1SavedDatasetName) {
        const baseName = table1SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
        defaultCteName = `${baseName}_filtered`;
      } else {
        defaultCteName = `${table1}_filtered`;
      }
      const cteName = table1CteName || defaultCteName;
      
      table1Columns.forEach(col => {
        columns.push({
          ...col,
          tableId: table1,
          tableName: table1,
          tableDisplayName: table1Display,
          database: selectedDatabase,
          cteName: cteName,
          fullId: `${cteName}.${col.id}`,
          tableFullId: `${table1}.${col.id}`,
          displayName: `${cteName}.${col.name}`
        });
      });

      addAggregationColumns({
        aggregationEnabled: table1AggregationEnabled,
        aggregationColumns: table1AggregationColumns,
        baseColumns: table1Columns,
        cteName,
        tableId: table1,
        tableDisplayName: table1Display,
        database: selectedDatabase
      });
    }
    
    if (table2 && table2Columns.length) {
      // Use the same logic as getTable2DefaultCteName for consistency
      let defaultCteName;
      let baseName;
      const table2Display = table2SavedDatasetName || table2;
      if (table2.startsWith('saved_') && table2SavedDatasetName) {
        baseName = table2SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      } else {
        baseName = table2;
      }
      defaultCteName = `${baseName}_filtered`;
      
      // Check for conflict with table1's CTE name
      let table1Default;
      if (table1.startsWith('saved_') && table1SavedDatasetName) {
        table1Default = `${table1SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}_filtered`;
      } else {
        table1Default = `${table1}_filtered`;
      }
      const table1CteNameResolved = table1CteName || table1Default;
      
      if (defaultCteName === table1CteNameResolved) {
        defaultCteName = `${baseName}_filtered_2`;
      }
      
      const cteName = table2CteName || defaultCteName;
      const db = table2Database || selectedDatabase;
      
      table2Columns.forEach(col => {
        columns.push({
          ...col,
          tableId: table2,
          tableName: table2,
          tableDisplayName: table2Display,
          database: db,
          cteName: cteName,
          fullId: `${cteName}.${col.id}`,
          tableFullId: `${table2}.${col.id}`,
          displayName: `${cteName}.${col.name}`
        });
      });

      addAggregationColumns({
        aggregationEnabled: table2AggregationEnabled,
        aggregationColumns: table2AggregationColumns,
        baseColumns: table2Columns,
        cteName,
        tableId: table2,
        tableDisplayName: table2Display,
        database: db
      });
    }
    
    return columns;
  }, [table1, table1Columns, table1CteName, table1SavedDatasetName, selectedDatabase, table2, table2Columns, table2CteName, table2SavedDatasetName, table2Database, table1AggregationEnabled, table1AggregationColumns, table2AggregationEnabled, table2AggregationColumns]);

  // Helper function to get HAVING column options for a table's aggregation
  const getHavingColumnsForTable = useCallback((groupByColumns, aggregationColumns) => {
    const options = [];
    if (groupByColumns && groupByColumns.length > 0) {
      groupByColumns.forEach(col => {
        const colName = col.column ? col.column.split('.').pop() : '';
        if (colName) {
          options.push({ id: colName, name: colName, isAggregate: false });
        }
      });
    }
    if (aggregationColumns && aggregationColumns.length > 0) {
      aggregationColumns.forEach(col => {
        if (col.column === "*" && col.role === "COUNT") {
          const aggName = "COUNT(*)";
          options.push({ id: aggName, name: col.alias || aggName, isAggregate: true });
        } else if (col.column) {
          const colName = col.column.split('.').pop();
          // Handle COUNT_DISTINCT specially - SQL syntax is COUNT(DISTINCT column)
          const aggName = col.role === "COUNT_DISTINCT" 
            ? `COUNT(DISTINCT ${colName})`
            : `${col.role}(${colName})`;
          options.push({ id: aggName, name: col.alias || aggName, isAggregate: true });
        }
      });
    }
    return options;
  }, []);
  
  // Get available columns for ORDER BY (combines all table aggregation outputs)
  const getOrderByColumns = useMemo(() => {
    const columns = [];
    
    // Add table 1 output columns
    if (table1GroupByEnabled && table1GroupByColumns.length > 0) {
      table1GroupByColumns.forEach(col => {
        const colName = col.column ? col.column.split('.').pop() : "";
        if (colName) {
          columns.push({ id: colName, name: colName });
        }
      });
    } else if (table1) {
      table1Columns.forEach(col => {
        columns.push({ id: col.id, name: col.name || col.id });
      });
    }
    if (table1AggregationEnabled && table1AggregationColumns.length > 0) {
      table1AggregationColumns.forEach(col => {
        if (col.column === "*" && col.role === "COUNT") {
          const aggName = col.alias || "COUNT(*)";
          columns.push({ id: aggName, name: aggName });
        } else if (col.column) {
          const colName = col.column.split('.').pop();
          // Handle COUNT_DISTINCT specially - SQL syntax is COUNT(DISTINCT column)
          const aggName = col.alias || (col.role === "COUNT_DISTINCT" 
            ? `COUNT(DISTINCT ${colName})`
            : `${col.role}(${colName})`);
          columns.push({ id: aggName, name: aggName });
        }
      });
    }
    
    // Add table 2 output columns if present
    if (table2) {
      if (table2GroupByEnabled && table2GroupByColumns.length > 0) {
        table2GroupByColumns.forEach(col => {
          const colName = col.column ? col.column.split('.').pop() : "";
          if (colName) {
            columns.push({ id: colName, name: colName });
          }
        });
      } else {
        table2Columns.forEach(col => {
          columns.push({ id: col.id, name: col.name || col.id });
        });
      }
      if (table2AggregationEnabled && table2AggregationColumns.length > 0) {
        table2AggregationColumns.forEach(col => {
          if (col.column === "*" && col.role === "COUNT") {
            const aggName = col.alias || "COUNT(*)";
            columns.push({ id: aggName, name: aggName });
          } else if (col.column) {
            const colName = col.column.split('.').pop();
            // Handle COUNT_DISTINCT specially - SQL syntax is COUNT(DISTINCT column)
            const aggName = col.alias || (col.role === "COUNT_DISTINCT" 
              ? `COUNT(DISTINCT ${colName})`
              : `${col.role}(${colName})`);
            columns.push({ id: aggName, name: aggName });
          }
        });
      }
    }
    
    return columns;
  }, [table1, table1Columns, table1GroupByEnabled, table1GroupByColumns, table1AggregationEnabled, table1AggregationColumns, table2, table2Columns, table2GroupByEnabled, table2GroupByColumns, table2AggregationEnabled, table2AggregationColumns]);

  // Get effective columns for Table 1 based on GROUP BY state and selected columns
  // When GROUP BY is enabled: show only GROUP BY columns + aggregation columns
  // When GROUP BY is NOT enabled: show only selected columns from "Select Columns" dropdown
  const getTable1EffectiveColumns = useMemo(() => {
    if (!table1) return [];
    
    const useGroupBy = table1GroupByEnabled || table1AggregationEnabled;
    
    if (useGroupBy) {
      // Build effective columns from GROUP BY + aggregation
      const columns = [];
      
      // Add GROUP BY columns
      if (table1GroupByColumns && table1GroupByColumns.length > 0) {
        table1GroupByColumns.forEach(col => {
          const colName = col.column ? col.column.split('.').pop() : '';
          if (colName) {
            columns.push({ id: colName, name: colName });
          }
        });
      }
      
      // Add aggregation output columns
      if (table1AggregationEnabled && table1AggregationColumns && table1AggregationColumns.length > 0) {
        table1AggregationColumns.forEach(col => {
          if (col.column === "*" && col.role === "COUNT") {
            const aggName = col.alias || "COUNT(*)";
            columns.push({ id: aggName, name: aggName });
          } else if (col.column) {
            const colName = col.column.split('.').pop();
            const aggName = col.alias || (col.role === "COUNT_DISTINCT" 
              ? `COUNT(DISTINCT ${colName})`
              : `${col.role}(${colName})`);
            columns.push({ id: aggName, name: aggName });
          }
        });
      }
      
      return columns;
    }
    
    // No grouping - return only selected columns from "Select Columns" dropdown
    // If no columns selected, return all table columns
    if (table1PreviewColumns && table1PreviewColumns.length > 0) {
      return table1Columns.filter(col => table1PreviewColumns.includes(col.id));
    }
    
    return table1Columns;
  }, [table1, table1Columns, table1GroupByEnabled, table1GroupByColumns, table1AggregationEnabled, table1AggregationColumns, table1PreviewColumns]);

  // Get effective columns for Table 2 based on GROUP BY state and selected columns
  // When GROUP BY is enabled: show only GROUP BY columns + aggregation columns
  // When GROUP BY is NOT enabled: show only selected columns from "Select Columns" dropdown
  const getTable2EffectiveColumns = useMemo(() => {
    if (!table2) return [];
    
    const useGroupBy = table2GroupByEnabled || table2AggregationEnabled;
    
    if (useGroupBy) {
      // Build effective columns from GROUP BY + aggregation
      const columns = [];
      
      // Add GROUP BY columns
      if (table2GroupByColumns && table2GroupByColumns.length > 0) {
        table2GroupByColumns.forEach(col => {
          const colName = col.column ? col.column.split('.').pop() : '';
          if (colName) {
            columns.push({ id: colName, name: colName });
          }
        });
      }
      
      // Add aggregation output columns
      if (table2AggregationEnabled && table2AggregationColumns && table2AggregationColumns.length > 0) {
        table2AggregationColumns.forEach(col => {
          if (col.column === "*" && col.role === "COUNT") {
            const aggName = col.alias || "COUNT(*)";
            columns.push({ id: aggName, name: aggName });
          } else if (col.column) {
            const colName = col.column.split('.').pop();
            const aggName = col.alias || (col.role === "COUNT_DISTINCT" 
              ? `COUNT(DISTINCT ${colName})`
              : `${col.role}(${colName})`);
            columns.push({ id: aggName, name: aggName });
          }
        });
      }
      
      return columns;
    }
    
    // No grouping - return only selected columns from "Select Columns" dropdown
    // If no columns selected, return all table columns
    if (table2PreviewColumns && table2PreviewColumns.length > 0) {
      return table2Columns.filter(col => table2PreviewColumns.includes(col.id));
    }
    
    return table2Columns;
  }, [table2, table2Columns, table2GroupByEnabled, table2GroupByColumns, table2AggregationEnabled, table2AggregationColumns, table2PreviewColumns]);

  // Get filtered available columns based on table card selections
  const filteredAvailableColumns = useMemo(() => {
    let filtered = allAvailableColumns;
    
    // Filter table 1 columns if specific columns are selected
    if (table1PreviewColumns.length > 0) {
      const cte1Name = table1CteName || `${table1}_filtered`;
      filtered = filtered.filter(col => {
        if (col.cteName === cte1Name) {
          if (col.isAggregation) return true;
          return table1PreviewColumns.includes(col.id);
        }
        return true; // Keep table 2 columns
      });
    }
    
    // Filter table 2 columns if specific columns are selected
    if (table2PreviewColumns.length > 0) {
      const cte2Name = table2CteName || `${table2}_filtered`;
      filtered = filtered.filter(col => {
        if (col.cteName === cte2Name) {
          if (col.isAggregation) return true;
          return table2PreviewColumns.includes(col.id);
        }
        return true; // Keep table 1 columns
      });
    }
    
    return filtered;
  }, [allAvailableColumns, table1PreviewColumns, table2PreviewColumns, table1, table1CteName, table2, table2CteName]);

  // Clean up selectedColumns when filtered columns change
  // Remove any selected columns that are no longer in the filtered list
  useEffect(() => {
    const filteredFullIds = filteredAvailableColumns.map(c => c.fullId);
    setSelectedColumns(prev => {
      const cleaned = prev.filter(id => filteredFullIds.includes(id));
      // Only update if something was removed
      if (cleaned.length !== prev.length) {
        return cleaned;
      }
      return prev;
    });
  }, [filteredAvailableColumns]);

  // Get default CTE name for table 1
  const getTable1DefaultCteName = useCallback(() => {
    if (!table1) return "";
    
    // For saved datasets, use the saved dataset name
    if (table1.startsWith('saved_') && table1SavedDatasetName) {
      const baseName = table1SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      return `${baseName}_filtered`;
    }
    
    return `${table1}_filtered`;
  }, [table1, table1SavedDatasetName]);

  // Get default CTE name for table 2
  // Adds suffix if same table as table1 to avoid conflicts
  const getTable2DefaultCteName = useCallback(() => {
    if (!table2) return "";
    
    let baseName;
    
    // For saved datasets, use the saved dataset name
    if (table2.startsWith('saved_') && table2SavedDatasetName) {
      baseName = table2SavedDatasetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    } else {
      baseName = table2;
    }
    
    const defaultName = `${baseName}_filtered`;
    
    // Check if this would conflict with table1's default name
    const table1Default = getTable1DefaultCteName();
    
    if (defaultName === table1Default || 
        (table1CteName && defaultName === table1CteName)) {
      // Same table used twice - add suffix to avoid conflict
      return `${baseName}_filtered_2`;
    }
    
    return defaultName;
  }, [table2, table2SavedDatasetName, getTable1DefaultCteName, table1CteName]);

  // Handle database change - reset all downstream selections
  const handleDatabaseChange = useCallback((databaseId) => {
    setSelectedDatabase(databaseId);
    setTable1("");
    setTable1CteName("");
    setTable1Filters([]);
    setTable1Dataset("");
    setTable2("");
    setTable2CteName("");
    setTable2Filters([]);
    setTable2Database(""); // Reset table2 database
    setTable2Dataset("");
    setJoinConditions([{ id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }]); // Reset to single empty condition
    setResultTableName("");
    setPostJoinFilters([]);
    setSelectedColumns([]);
    setDatasets([]);
    setTable2Datasets([]);
    setTables([]);
    setTable2Tables([]);
    setTable1ColumnsData([]);
    setTable2ColumnsData([]);
    setTable1PreviewData([]);
    setTable2PreviewData([]);
    // Clear preview columns
    setTable1PreviewColumns([]);
    setTable2PreviewColumns([]);
    // Reset toggles/group/aggregation states
    setTable1FilterEnabled(true);
    setTable2FilterEnabled(true);
    resetTable1AggregationState();
    resetTable2AggregationState();
  }, []);

  // Handle Table 2 database change
  const handleTable2DatabaseChange = useCallback((databaseId) => {
    setTable2Database(databaseId);
    setTable2("");
    setTable2CteName("");
    setTable2Filters([]);
    setTable2Dataset("");
    setJoinRightColumn("");
    setSelectedColumns([]);
    setTable2ColumnsData([]);
    setTable2PreviewData([]);
    // Clear preview columns
    setTable2PreviewColumns([]);
  }, []);

  // Handle Table 1 dataset change
  const handleTable1DatasetChange = useCallback((datasetId) => {
    setTable1Dataset(datasetId);
    // Clear table if it doesn't belong to the new dataset
    if (table1) {
      const tableObj = tables.find(t => t.id === table1);
      if (tableObj && tableObj.datasetId !== datasetId) {
        setTable1("");
        setTable1CteName("");
        setTable1Filters([]);
        setJoinLeftColumn("");
        setSelectedColumns([]);
        setTable1ColumnsData([]);
        setTable1PreviewData([]);
        setTable1PreviewColumns([]);
      }
    } else {
      // If no table selected, just clear related data
      setTable1CteName("");
      setTable1Filters([]);
      setJoinLeftColumn("");
      setSelectedColumns([]);
      setTable1ColumnsData([]);
      setTable1PreviewData([]);
      setTable1PreviewColumns([]);
    }
  }, [table1, tables]);

  // Handle Table 2 dataset change
  const handleTable2DatasetChange = useCallback((datasetId) => {
    setTable2Dataset(datasetId);
    // Clear table if it doesn't belong to the new dataset
    const tablesToCheck = (table2Database && table2Database !== selectedDatabase) ? table2Tables : tables;
    if (table2) {
      const tableObj = tablesToCheck.find(t => t.id === table2);
      if (tableObj && tableObj.datasetId !== datasetId) {
        setTable2("");
        setTable2CteName("");
        setTable2Filters([]);
        setJoinRightColumn("");
        setSelectedColumns([]);
        setTable2ColumnsData([]);
        setTable2PreviewData([]);
        setTable2PreviewColumns([]);
      }
    } else {
      // If no table selected, just clear related data
      setTable2CteName("");
      setTable2Filters([]);
      setJoinRightColumn("");
      setSelectedColumns([]);
      setTable2ColumnsData([]);
      setTable2PreviewData([]);
      setTable2PreviewColumns([]);
    }
  }, [table2, table2Database, selectedDatabase, table2Tables, tables]);

  // Handle Table 1 change
  const handleTable1Change = useCallback((tableId) => {
    console.log("Table1 changed:", tableId, "Current tables:", tables);
    setTable1(tableId);
    setTable1CteName("");
    setTable1Filters([]);
    setTable1FilterEnabled(true);
    setTable1GroupByEnabled(false);
    setTable1AggregationEnabled(false);
    setTable1GroupByColumns([]);
    setTable1AggregationColumns([]);
    setTable1HavingConditions([]);
    setJoinLeftColumn("");
    setSelectedColumns([]);
    // Clear preview columns when table changes
    setTable1PreviewColumns([]);
    // Generate a new UUID for this table selection (for unique CTE naming)
    if (tableId) {
      setTable1UUID(generateShortUUID());
    } else {
      setTable1UUID("");
    }
    // Auto-set dataset if table is selected and has dataset info
    if (tableId) {
      const selectedTableObj = tables.find(t => t.id === tableId);
      console.log("Found table object:", selectedTableObj);
      if (selectedTableObj && selectedTableObj.datasetId) {
        console.log("Setting dataset to:", selectedTableObj.datasetId);
        setTable1Dataset(selectedTableObj.datasetId);
      } else {
        console.warn("Table selected but dataset info not found. Table ID:", tableId, "Available tables:", tables);
      }
    }
  }, [tables]);

  // Handle Table 2 change
  const handleTable2Change = useCallback((tableId) => {
    setTable2(tableId);
    setTable2CteName("");
    setTable2Filters([]);
    setTable2FilterEnabled(true);
    setTable2GroupByEnabled(false);
    setTable2AggregationEnabled(false);
    setTable2GroupByColumns([]);
    setTable2AggregationColumns([]);
    setTable2HavingConditions([]);
    setJoinRightColumn("");
    setSelectedColumns([]);
    // Clear preview columns when table changes
    setTable2PreviewColumns([]);
    // Generate a new UUID for this table selection (for unique CTE naming)
    if (tableId) {
      setTable2UUID(generateShortUUID());
    } else {
      setTable2UUID("");
      setTable2Enabled(false);
      // Reset all join-related state when Table 2 is cleared
      setJoinConditions([{ id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }]);
      setJoinType("INNER JOIN");
      setPostJoinFilters([]);
      setJoinOrderByColumns([]);
      setJoinLimitEnabled(false);
      setJoinLimitValue(0);
      setResultTableName("");
    }
    // Auto-set dataset if table is selected and has dataset info
    if (tableId) {
      const tablesToCheck = (table2Database && table2Database !== selectedDatabase) ? table2Tables : tables;
      const selectedTableObj = tablesToCheck.find(t => t.id === tableId);
      if (selectedTableObj && selectedTableObj.datasetId && selectedTableObj.datasetId !== table2Dataset) {
        setTable2Dataset(selectedTableObj.datasetId);
      }
    }
  }, [table2Database, selectedDatabase, table2Tables, tables, table2Dataset]);

  // Create a new filter object
  const createFilter = () => ({
    id: Date.now(),
    column: "",
    operator: "",
    valueType: "",
    value: "",
    value2: "",
    aggregation: "",
    aggregationColumn: "",
    joinType: "AND",
    chainWithNext: false  // Controls explicit bracket grouping with next filter
  });

  // Add filter to Table 1
  const addTable1Filter = useCallback(() => {
    setTable1Filters(prev => [...prev, createFilter()]);
  }, []);

  // Add filter to Table 2
  const addTable2Filter = useCallback(() => {
    setTable2Filters(prev => [...prev, createFilter()]);
  }, []);

  // Add post-join filter
  const addPostJoinFilter = useCallback(() => {
    setPostJoinFilters(prev => [...prev, createFilter()]);
  }, []);

  // Generic filter update function
  const updateFilterInList = (setFilters) => (filterId, field, value) => {
    setFilters(prev =>
      prev.map(f => {
        if (f.id !== filterId) return f;
        
        const updatedFilter = { ...f, [field]: value };
        
        if (field === "column") {
          updatedFilter.operator = "=";
          updatedFilter.value = "";
          updatedFilter.value2 = "";
          updatedFilter.aggregation = "";
          updatedFilter.aggregationColumn = "";
        }
        
        if (field === "operator") {
          if (value !== "BETWEEN") {
            updatedFilter.value2 = "";
          }
        }

        if (field === "valueType") {
          if (value === "direct") {
            updatedFilter.aggregation = "";
            updatedFilter.aggregationColumn = "";
          } else {
            updatedFilter.value = "";
          }
        }
        
        return updatedFilter;
      })
    );
  };

  // Update Table 1 filter
  const updateTable1Filter = useCallback(updateFilterInList(setTable1Filters), []);

  // Update Table 2 filter
  const updateTable2Filter = useCallback(updateFilterInList(setTable2Filters), []);

  // Update post-join filter
  const updatePostJoinFilter = useCallback(updateFilterInList(setPostJoinFilters), []);

  // Remove Table 1 filter
  const removeTable1Filter = useCallback((filterId) => {
    setTable1Filters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  // Remove Table 2 filter
  const removeTable2Filter = useCallback((filterId) => {
    setTable2Filters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  // Remove post-join filter
  const removePostJoinFilter = useCallback((filterId) => {
    setPostJoinFilters(prev => prev.filter(f => f.id !== filterId));
  }, []);

  // Handle column selection
  const handleColumnToggle = useCallback((columnFullId) => {
    setSelectedColumns(prev => {
      if (prev.includes(columnFullId)) {
        return prev.filter(c => c !== columnFullId);
      }
      return [...prev, columnFullId];
    });
  }, []);

  // Select all columns - accepts optional filtered columns array
  // If filteredColumns is provided, only those columns are considered for selection
  const handleSelectAllColumns = useCallback((filteredColumns = null) => {
    const columnsToUse = filteredColumns || allAvailableColumns;
    
    // Check if all filtered columns are already selected
    const allFilteredSelected = columnsToUse.every(c => selectedColumns.includes(c.fullId));
    
    if (allFilteredSelected && columnsToUse.length > 0) {
      // Deselect all filtered columns (keep any that aren't in the filtered list)
      const filteredFullIds = columnsToUse.map(c => c.fullId);
      setSelectedColumns(prev => prev.filter(id => !filteredFullIds.includes(id)));
    } else {
      // Select all filtered columns (add to existing selection)
      const newColumns = columnsToUse.map(c => c.fullId);
      setSelectedColumns(prev => {
        const combined = [...new Set([...prev, ...newColumns])];
        return combined;
      });
    }
  }, [selectedColumns, allAvailableColumns]);

  // Reset entire builder state (projects/tables/joins) after saving
  const resetAllSelections = useCallback(() => {
    // Top-level selections
    setSelectedDatabase("");
    setTable2Database("");
    setTable1Dataset("");
    setTable2Dataset("");
    setTable1("");
    setTable2("");
    setTable1CteName("");
    setTable2CteName("");
    setTable1UUID("");
    setTable2UUID("");
    setResultCteName("");

    // Clear fetched data/previews
    setTable1ColumnsData([]);
    setTable2ColumnsData([]);
    setTable1PreviewData([]);
    setTable2PreviewData([]);
    setTable1PreviewColumns([]);
    setTable2PreviewColumns([]);

    // Filters
    setTable1Filters([]);
    setTable2Filters([]);
    setTable1FilterEnabled(true);
    setTable2FilterEnabled(true);
    setPostJoinFilters([]);

    // Group By / Aggregation / Having
    setTable1GroupByEnabled(false);
    setTable2GroupByEnabled(false);
    setTable1AggregationEnabled(false);
    setTable2AggregationEnabled(false);
    setTable1GroupByColumns([]);
    setTable2GroupByColumns([]);
    setTable1AggregationColumns([]);
    setTable2AggregationColumns([]);
    setTable1HavingConditions([]);
    setTable2HavingConditions([]);

    // Order By / Limit
    setTable1OrderByColumns([]);
    setTable2OrderByColumns([]);
    setTable1LimitEnabled(false);
    setTable1LimitValue("");
    setTable2LimitEnabled(false);
    setTable2LimitValue(0);
    setOrderByColumns([]);
    setLimitEnabled(false);
    setLimitValue(100);

    // Join section
    setJoinType("INNER JOIN");
    setJoinConditions([{ id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }]);
    setJoinOrderByColumns([]);
    setJoinLimitEnabled(false);
    setJoinLimitValue(0);
    setResultTableName("");

    // Selected output columns and table 2 toggle
    setSelectedColumns([]);
    setTable2Enabled(false);

    // Saved dataset info
    setTable1SavedDatasetSQL("");
    setTable1SavedDatasetName("");
    setTable2SavedDatasetSQL("");
    setTable2SavedDatasetName("");
  }, []);

  // Reset selections/settings for Table 1 (keep table choice)
  const resetTable1Selections = useCallback(() => {
    setTable1Filters([]);
    setTable1FilterEnabled(true);
    setTable1GroupByEnabled(false);
    setTable1AggregationEnabled(false);
    setTable1GroupByColumns([]);
    setTable1AggregationColumns([]);
    setTable1HavingConditions([]);
    setTable1OrderByColumns([]);
    setTable1LimitEnabled(false);
    setTable1LimitValue("");
    setTable1PreviewColumns([]);
    setSelectedColumns([]);
  }, []);

  // Reset selections/settings for join section (keep table choices)
  const resetJoinSelections = useCallback(() => {
    setJoinConditions([{ id: 1, leftColumn: "", rightColumn: "", joinType: "AND", chainWithNext: false }]);
    setJoinType("INNER JOIN");
    setPostJoinFilters([]);
    setSelectedColumns([]);
    setJoinOrderByColumns([]);
    setJoinLimitEnabled(false);
    setJoinLimitValue(0);
    setResultTableName("");
  }, []);

  return {
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
    table1PreviewData,
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
    table2PreviewData,
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
    setJoinConditions,
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
    setSelectedColumns,
    allAvailableColumns,
    handleColumnToggle,
    handleSelectAllColumns,
    resetAllSelections,
    resetTable1Selections,
    resetJoinSelections,
    
    // Result
    resultCteName,
    setResultCteName,
    
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
    setCopied,
    activeTab,
    setActiveTab
  };
};
