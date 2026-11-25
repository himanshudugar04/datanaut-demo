import { XMarkIcon } from "@heroicons/react/24/outline";
import { joinTypes } from "../../../data/databaseSchema";

/**
 * Individual Join Row component
 */
const JoinRow = ({
  join,
  selectedTable,
  availableTables,
  availableColumns,
  getJoinTableColumns,
  updateJoin,
  removeJoin
}) => {
  const joinTableColumns = getJoinTableColumns(join.table);

  return (
    <div className="sql-builder__join-row">
      <div className="sql-builder__join-type-selector">
        {joinTypes.map(jt => (
          <button
            key={jt.id}
            type="button"
            className={`sql-builder__join-type-btn ${join.type === jt.id ? "is-active" : ""}`}
            onClick={() => updateJoin(join.id, "type", jt.id)}
            title={jt.label}
          >
            <span className="sql-builder__join-icon">{jt.icon}</span>
            {jt.name.replace(" JOIN", "")}
          </button>
        ))}
      </div>
      
      <div className="sql-builder__join-config">
        <select
          value={join.table}
          onChange={(e) => updateJoin(join.id, "table", e.target.value)}
          className="sql-builder__join-table"
        >
          <option value="">Select table to join...</option>
          {availableTables
            .filter(t => t.id !== selectedTable)
            .map(table => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
        </select>
        
        <span className="sql-builder__join-on">ON</span>
        
        <select
          value={join.leftColumn}
          onChange={(e) => updateJoin(join.id, "leftColumn", e.target.value)}
          className="sql-builder__join-column"
          disabled={!join.table}
        >
          <option value="">{selectedTable}.column</option>
          {availableColumns.map(col => (
            <option key={col.id} value={col.id}>
              {selectedTable}.{col.name}
            </option>
          ))}
        </select>
        
        <span className="sql-builder__join-equals">=</span>
        
        <select
          value={join.rightColumn}
          onChange={(e) => updateJoin(join.id, "rightColumn", e.target.value)}
          className="sql-builder__join-column"
          disabled={!join.table}
        >
          <option value="">{join.table || "table"}.column</option>
          {joinTableColumns.map(col => (
            <option key={col.id} value={col.id}>
              {join.table}.{col.name}
            </option>
          ))}
        </select>
        
        <button
          type="button"
          className="sql-builder__remove-join"
          onClick={() => removeJoin(join.id)}
        >
          <XMarkIcon />
        </button>
      </div>
    </div>
  );
};

export default JoinRow;

