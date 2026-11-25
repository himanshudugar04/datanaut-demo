import { EyeIcon, EyeSlashIcon, TableCellsIcon } from "@heroicons/react/24/outline";

/**
 * Data Preview component - shows sample data from selected tables
 * Respects previewColumns selection to filter which columns to display
 */
const DataPreview = ({
  table1,
  table1Data,
  table1CteName,
  table1PreviewColumns = [],
  table2,
  table2Data,
  table2CteName,
  table2PreviewColumns = [],
  showPreview,
  onTogglePreview
}) => {
  // Get sample data
  const table1SampleData = table1Data?.sampleData || [];
  const table2SampleData = table2Data?.sampleData || [];
  
  const hasData = table1SampleData.length > 0 || table2SampleData.length > 0;
  
  if (!table1 || !hasData) {
    return null;
  }

  const cte1Name = table1CteName || `${table1}_filtered`;
  const cte2Name = table2 ? (table2CteName || `${table2}_filtered`) : null;

  // Filter columns based on selection
  const getFilteredColumns = (sampleData, previewColumns) => {
    if (!sampleData || sampleData.length === 0) return [];
    const allColumns = Object.keys(sampleData[0] || {});
    
    // If no columns selected, show all
    if (!previewColumns || previewColumns.length === 0) {
      return allColumns;
    }
    
    // Filter to only selected columns (maintaining original order)
    return allColumns.filter(col => previewColumns.includes(col));
  };

  const table1Columns = getFilteredColumns(table1SampleData, table1PreviewColumns);
  const table2Columns = getFilteredColumns(table2SampleData, table2PreviewColumns);

  return (
    <div className="sql-builder__data-panel">
      <div className="sql-builder__data-panel-header">
        <div className="sql-builder__data-panel-title">
          <TableCellsIcon />
          <span>Data Preview</span>
        </div>
        <button
          type="button"
          className="sql-builder__data-panel-toggle"
          onClick={onTogglePreview}
        >
          {showPreview ? (
            <>
              <EyeSlashIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Hide
            </>
          ) : (
            <>
              <EyeIcon style={{ width: 14, height: 14, display: 'inline', marginRight: 4 }} />
              Show
            </>
          )}
        </button>
      </div>
      
      {showPreview && (
        <div className="sql-builder__data-preview-container">
          {/* Table 1 Preview */}
          {table1SampleData.length > 0 && table1Columns.length > 0 && (
            <div style={{ marginBottom: table2SampleData.length > 0 ? '1.5rem' : 0 }}>
              <div style={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#22d3ee', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
                paddingLeft: '0.5rem'
              }}>
                {cte1Name} (from {table1})
                {table1PreviewColumns.length > 0 && (
                  <span style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>
                    ({table1PreviewColumns.length} of {Object.keys(table1SampleData[0] || {}).length} columns)
                  </span>
                )}
              </div>
              <table className="sql-builder__data-table">
                <thead>
                  <tr>
                    {table1Columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table1SampleData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {table1Columns.map((col) => (
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
            </div>
          )}
          
          {/* Table 2 Preview */}
          {table2 && table2SampleData.length > 0 && table2Columns.length > 0 && (
            <div>
              <div style={{ 
                fontSize: '0.75rem', 
                fontWeight: 600, 
                color: '#22d3ee', 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em',
                marginBottom: '0.5rem',
                paddingLeft: '0.5rem'
              }}>
                {cte2Name} (from {table2})
                {table2PreviewColumns.length > 0 && (
                  <span style={{ fontWeight: 400, marginLeft: '0.5rem', opacity: 0.7 }}>
                    ({table2PreviewColumns.length} of {Object.keys(table2SampleData[0] || {}).length} columns)
                  </span>
                )}
              </div>
              <table className="sql-builder__data-table">
                <thead>
                  <tr>
                    {table2Columns.map(col => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table2SampleData.slice(0, 5).map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {table2Columns.map((col) => (
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataPreview;
