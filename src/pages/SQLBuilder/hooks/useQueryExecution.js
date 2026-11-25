import { useState, useCallback } from "react";
import { executeQuery } from "../../../services/databaseApi";

// Default row limit for preview queries (Get Results button)
const PREVIEW_ROW_LIMIT = 1000;

// Prefer API payload over generic Axios message (handles FastAPI detail/message)
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

/**
 * Custom hook for executing SQL queries against the database
 */
export const useQueryExecution = () => {
  const [executing, setExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);

  /**
   * Execute a SQL query with row limit for preview
   * @param {string} sql - The SQL query to execute
   * @param {number|null} limit - Row limit (default 1000 for preview, null for no limit)
   */
  const runQuery = useCallback(async (sql, limit = PREVIEW_ROW_LIMIT) => {
    if (!sql || sql.trim() === "" || sql === "-- Select columns to generate SQL") {
      setQueryError("No valid SQL query to execute");
      return;
    }

    setExecuting(true);
    setQueryError(null);
    setQueryResult(null);

    try {
      // Pass limit to executeQuery (1000 for preview, null for download)
      const result = await executeQuery(sql, limit);
      setQueryResult(result);
    } catch (err) {
      console.error("Query execution failed:", err);
      
      // Check if this is a blocked query (dry run validation failed or size limit exceeded)
      const errorData = err.response?.data;
      if (errorData?.blocked) {
        // Preserve the full error structure for blocked queries
        setQueryError({
          message: errorData.message || errorData.error,
          blocked: true,
          bytesFormatted: errorData.bytesFormatted,
          maxAllowed: errorData.maxAllowed,
          sql: errorData.sql
        });
      } else {
        // Regular error - just the message
         setQueryError(getApiErrorMessage(err) || "Query execution failed");
      }
    } finally {
      setExecuting(false);
    }
  }, []);

  /**
   * Clear the current results
   */
  const clearResults = useCallback(() => {
    setQueryResult(null);
    setQueryError(null);
  }, []);

  return {
    executing,
    queryResult,
    queryError,
    runQuery,
    clearResults
  };
};
