  import { getOperatorCategory, getAggregationFunctionsForType, aggregationFunctions } from "../../../data/databaseSchema";

  /**
   * Get the correct input type based on column type
   * Supports BigQuery data types
   */
  export const getInputType = (columnType) => {
    const category = getOperatorCategory(columnType);
    switch (category) {
      case "NUMERIC":
        return "number";
      case "DATE":
        return "date";
      case "TIMESTAMP":
      case "DATETIME":
        return "datetime-local";
      case "BOOLEAN":
        return "boolean";
      default:
        return "text";
    }
  };

  /**
   * Format date value for BigQuery SQL
   * BigQuery uses DATE 'YYYY-MM-DD' and TIMESTAMP 'YYYY-MM-DD HH:MM:SS' literals
   * Handles multiple input formats:
   * - HTML datetime-local with step="1": YYYY-MM-DDTHH:MM:SS (with seconds)
   * - HTML datetime-local: YYYY-MM-DDTHH:MM (without seconds, defaults to :00)
   * - Manual input with space: DD-MM-YYYY HH:MM:SS or YYYY-MM-DD HH:MM:SS
   * - Manual input with T: DD-MM-YYYYTHH:MM:SS or YYYY-MM-DDTHH:MM:SS
   */
  export const formatDateForSQL = (dateValue, columnType) => {
    if (!dateValue) return "";
    
    const category = getOperatorCategory(columnType);
    
    if (category === "DATE") {
      // Check if input is in DD-MM-YYYY format (manual input)
      const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = dateValue.match(ddmmyyyyPattern);
      if (match) {
        const [, day, month, year] = match;
        return `${year}-${month}-${day}`;
      }
      // Otherwise, assume YYYY-MM-DD format (from HTML date input)
      return dateValue;
    }
    
    if (category === "TIMESTAMP" || category === "DATETIME") {
      // Handle different input formats:
      // 1. HTML datetime-local: YYYY-MM-DDTHH:MM
      // 2. Manual input with space: DD-MM-YYYY HH:MM or YYYY-MM-DD HH:MM
      // 3. Manual input with T: DD-MM-YYYYTHH:MM or YYYY-MM-DDTHH:MM
      
      let datePart, timePart;
      
      // Check if input has space separator (manual input format)
      if (dateValue.includes(" ")) {
        [datePart, timePart] = dateValue.split(" ");
      } else if (dateValue.includes("T")) {
        // HTML datetime-local format
        [datePart, timePart] = dateValue.split("T");
      } else {
        // Only date part provided
        datePart = dateValue;
        timePart = null;
      }
      
      if (datePart) {
        // Check if date part is in DD-MM-YYYY format (manual input)
        const ddmmyyyyPattern = /^(\d{2})-(\d{2})-(\d{4})$/;
        const dateMatch = datePart.match(ddmmyyyyPattern);
        let formattedDate = datePart;
        
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          formattedDate = `${year}-${month}-${day}`;
        }
        
        // Format time part: ensure HH:MM:SS format
        let time = "00:00:00";
        if (timePart) {
          const timeParts = timePart.split(":");
          if (timeParts.length >= 3) {
            // Has seconds: HH:MM:SS
            time = `${timeParts[0]}:${timeParts[1]}:${timeParts[2]}`;
          } else if (timeParts.length >= 2) {
            // Only hours and minutes: HH:MM
            time = `${timeParts[0]}:${timeParts[1]}:00`;
          } else if (timeParts.length === 1) {
            // Only hours: HH
            time = `${timeParts[0]}:00:00`;
          }
        }
        
        return `${formattedDate} ${time}`;
      }
    }
    
    return dateValue;
  };

  /**
   * Get column type by column id
   * Handles multiple formats: 
   * - fullId (cteName.columnId)
   * - tableFullId (tableName.columnId)
   * - just columnId
   */
  export const getColumnType = (columnFullId, allAvailableColumns) => {
    if (!columnFullId || !allAvailableColumns || allAvailableColumns.length === 0) {
      return "STRING";
    }
    
    // Try direct match first (fullId or tableFullId or id)
    let column = allAvailableColumns.find(c => 
      c.fullId === columnFullId || 
      c.tableFullId === columnFullId || 
      c.id === columnFullId
    );
    
    // If not found, try matching by extracting tableName.columnId format
    if (!column) {
      const parts = columnFullId.split(".");
      if (parts.length > 1) {
        const tableName = parts[0];
        const columnId = parts[1];
        
        // Match by tableName/cteName and column id
        column = allAvailableColumns.find(c => 
          (c.tableName === tableName || c.tableId === tableName || c.cteName === tableName) && 
          c.id === columnId
        );
        
        // Also try matching just by column id if table match failed
        if (!column) {
          column = allAvailableColumns.find(c => c.id === columnId);
        }
      }
    }
    
    return column?.type || "STRING";
  };

  /**
   * Get numeric columns for aggregation
   */
  export const getNumericColumns = (allAvailableColumns) => {
    return allAvailableColumns.filter(col => {
      const category = getOperatorCategory(col.type);
      return category === "NUMERIC";
    });
  };

  /**
   * Get available aggregation functions for a filter
   */
  export const getAvailableAggregationFunctions = (filter, allAvailableColumns, getColumnTypeFn) => {
    if (!filter.aggregationColumn) {
      return aggregationFunctions;
    }
    return getAggregationFunctionsForType(getColumnTypeFn(filter.aggregationColumn, allAvailableColumns));
  };

