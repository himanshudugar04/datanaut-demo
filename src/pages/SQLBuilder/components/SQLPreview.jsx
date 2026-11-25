import { useState, useEffect } from "react";
import { 
  ClipboardDocumentIcon, 
  PlayIcon, 
  CodeBracketIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import { ArrowDownTrayIcon } from "@heroicons/react/24/solid";
import { executeQuery} from "../../../services/databaseApi";

// Prefer API payload over generic Axios message
const getApiErrorMessage = (err) => {
  const data = err?.response?.data;
  if (Array.isArray(data) && data[0]?.message) return data[0].message;
  if (data?.message) return data.message;
  if (data?.detail) {
    if (typeof data.detail === "string") return data.detail;
    if (typeof data.detail === "object" && data.detail.message) return data.detail.message;
  }
  if (data?.error) return data.error;

  if (typeof data === "string") return data;
  return err?.message;
};

// Batch size for displaying rows (load more in batches)
const BATCH_SIZE = 100;

/**
 * SQL Preview component with query execution and results display
 * SQL code is hidden by default with "View SQL" toggle
 * Displays limited rows for performance
 * 
 * Single download button that:
 * - Only visible when table1Selected is true
 * - Always uses the latest generatedSQL (includes filters, GROUP BY, etc.)
 * - Goes through backend dry run validation (200MB limit)
 */
const SQLPreview = ({
  generatedSQL,
  copied,
  onCopy,
  onExecute,
  executing,
  queryResult,
  queryError,
  // NEW: Is Table 1 selected? Download only visible when true
  table1Selected = false,
  // NEW: Filename for download (e.g., table name or "joined_result")
  downloadFileName = "query_result"
}) => {
  const [showSQL, setShowSQL] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  // Track how many rows to display (in batches of 100)
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE);
  
  const hasValidSQL = generatedSQL && 
    generatedSQL.trim() !== "" && 
    generatedSQL !== "-- Select columns to generate SQL";

  /**
   * Handle CSV download - always uses the latest generatedSQL
   * This ensures all current filters, GROUP BY, aggregations, ORDER BY, and LIMIT are included
   */
  const handleDownload = async () => {
    if (!hasValidSQL || !table1Selected) return;

    // Use the current generatedSQL which already includes all user settings
    const downloadSQL = generatedSQL.trim().replace(/;$/, '');

    setIsDownloading(true);
    setDownloadError(null);
    
    try {
      // Execute the query with NO limit (null) for full download
      // Goes through backend dry run validation (200MB check)
      const result = await executeQuery(downloadSQL, null);
      
      if (result && result.data && result.data.length > 0) {
        // Convert to CSV
        const headers = result.columns 
          ? result.columns.map(c => c.name) 
          : Object.keys(result.data[0]);
        const csvRows = [headers.join(',')];
        
        result.data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            const strValue = String(value);
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
              return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
          });
          csvRows.push(values.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${downloadFileName}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        console.log("No data to download");
      }
    } catch (error) {
      console.error("Download error:", error);
      
      // Check if this is a blocked query (size limit exceeded)
      const errorData = error.response?.data;
      const message = getApiErrorMessage(error) || "Download failed";
      if (errorData?.blocked) {
        setDownloadError({
          message,
          blocked: true,
          bytesFormatted: errorData.bytesFormatted,
          maxAllowed: errorData.maxAllowed
        });
      } else {
        setDownloadError({
          message,
          blocked: false
        });
      }
    } finally {
      setIsDownloading(false);
    }
  };


  // Reset display count when new query results come in
  useEffect(() => {
    setDisplayCount(BATCH_SIZE);
  }, [queryResult]);

  // Get display data (in batches of 100 for UI performance)
  const allData = queryResult?.data || [];
  const totalRows = queryResult?.totalRows || queryResult?.rowCount || allData.length;
  const displayData = allData.slice(0, displayCount);
  const hasMoreRows = displayCount < allData.length;
  const queryErrorMessage = queryError
    ? (typeof queryError === "string"
      ? queryError
      : queryError.message || getApiErrorMessage({ response: { data: queryError } }) || "Query execution failed")
    : null;
  
  // Load more rows (next batch of 100)
  const handleLoadMore = () => {
    setDisplayCount(prev => Math.min(prev + BATCH_SIZE, allData.length));
  };

  return (
    <div className="sql-builder__preview-panel">
      {/* Action Buttons - Get Results and Download */}
      <div className="sql-builder__preview-actions-bar">
        <button
          type="button"
          className={`sql-builder__execute-btn sql-builder__execute-btn--large ${executing ? 'executing' : ''}`}
          onClick={onExecute}
          disabled={!hasValidSQL || executing}
          title="Run query and see results"
        >
          <PlayIcon />
          {executing ? "Running..." : "Get Results"}
        </button>
        
        {/* Download Button - Only visible when Table 1 is selected */}
        {table1Selected && hasValidSQL && (
          <button
            type="button"
            className="sql-builder__download-btn-main"
            onClick={handleDownload}
            disabled={isDownloading || executing}
            title="Download query result as CSV"
          >
            <ArrowDownTrayIcon />
            {isDownloading ? "Downloading..." : "Download"}
          </button>
        )}

        
      </div>
      
      {/* Download Error - Blocked Query */}
      {downloadError && downloadError.blocked && (
        <div className="sql-builder__results-error sql-builder__results-error--size-limit">
          <ExclamationTriangleIcon className="sql-builder__results-error-icon-svg" />
          <div className="sql-builder__error-content">
            <strong>Download Blocked </strong>
            <p>{downloadError.message}</p>
            {downloadError.bytesFormatted && (
              <p className="sql-builder__error-details">
                Estimated size: <strong>{downloadError.bytesFormatted}</strong> (max allowed: {downloadError.maxAllowed})
              </p>
            )}
          </div>
        </div>
      )}
      {/* Download Error - Regular */}
      {downloadError && !downloadError.blocked && (
        <div className="sql-builder__results-error">
          <ExclamationTriangleIcon className="sql-builder__results-error-icon-svg" />
          <div className="sql-builder__error-content">
            <strong>Download Error</strong>
            <p>{downloadError.message}</p>
          </div>
        </div>
      )}


      {/* Query Results Section */}
      {(queryResult || queryError || executing) && (
        <div className="sql-builder__results-section">
          <div className="sql-builder__results-header">
            <span>Results</span>
            {queryResult && (
              <span className="sql-builder__results-meta">
                Showing {displayData.length.toLocaleString()} of {totalRows.toLocaleString()} rows
                {" | "}{queryResult.executionTime}ms
              </span>
            )}
          </div>

          {/* Loading State */}
          {executing && (
            <div className="sql-builder__results-loading">
              <div className="sql-builder__spinner"></div>
              <span>Fetching data...</span>
            </div>
          )}

          {/* Error State - Blocked Query (Size Limit) */}
          {queryError && queryError.blocked && !executing && (
            <div className="sql-builder__results-error sql-builder__results-error--size-limit">
              <ExclamationTriangleIcon className="sql-builder__results-error-icon-svg" />
              <div className="sql-builder__error-content">
                <strong>Error In Query</strong>
                <p>{queryErrorMessage}</p>
                {queryError.bytesFormatted && (
                  <p className="sql-builder__error-details">
                    Estimated size: <strong>{queryError.bytesFormatted}</strong> (max allowed: {queryError.maxAllowed})
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Error State - Regular Error */}
          {queryError && !queryError.blocked && !executing && (
            <div className="sql-builder__results-error">
              <ExclamationTriangleIcon className="sql-builder__results-error-icon-svg" />
              <div className="sql-builder__error-content">
                <strong>Error</strong>
                <p>{queryErrorMessage}</p>
              </div>
            </div>
          )}

          {/* Results Table - displays limited rows for performance */}
          {queryResult && !executing && !queryError && (
            <div className="sql-builder__results-table-container">
              {displayData.length > 0 ? (
                <>
                  <table className="sql-builder__results-table">
                    <thead>
                      <tr>
                        <th className="sql-builder__index-col">Index</th>
                        {Object.keys(displayData[0]).map((columnName, idx) => (
                          <th key={idx}>{columnName}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayData.map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="sql-builder__index-col">{rowIdx + 1}</td>
                          {Object.values(row).map((value, colIdx) => (
                            <td key={colIdx}>
                              {value === null ? (
                                <span className="sql-builder__null-value">NULL</span>
                              ) : typeof value === 'object' ? (
                                JSON.stringify(value)
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Load More / Download notice */}
                  <div className="sql-builder__results-pagination">
                    {hasMoreRows ? (
                      <button
                        type="button"
                        className="sql-builder__load-more-btn"
                        onClick={handleLoadMore}
                      >
                        Load More ({Math.min(BATCH_SIZE, allData.length - displayCount)} rows)
                      </button>
                    ) : displayData.length < totalRows ? (
                      <span className="sql-builder__results-limited-notice">
                        Showing all {displayData.length.toLocaleString()} fetched rows. 
                        Click "Download" to get the complete dataset.
                      </span>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="sql-builder__no-results">
                  Query executed successfully. No rows returned.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsible SQL View */}
      <div className="sql-builder__sql-toggle-section">
        <button
          type="button"
          className="sql-builder__sql-toggle-btn"
          onClick={() => setShowSQL(!showSQL)}
        >
          {showSQL ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <CodeBracketIcon />
          <span>View SQL</span>
        </button>
        
        {showSQL && (
          <div className="sql-builder__sql-content">
            <div className="sql-builder__sql-header">
              <span>Generated Query</span>
              <button
                type="button"
                className="sql-builder__copy-btn"
                onClick={onCopy}
                title="Copy to clipboard"
                disabled={!hasValidSQL}
              >
                <ClipboardDocumentIcon />
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="sql-builder__sql-code">
              <code>{generatedSQL}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default SQLPreview;
