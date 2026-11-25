import { LinkIcon, PlusIcon } from "@heroicons/react/24/outline";
import JoinRow from "./JoinRow";

/**
 * Joins Section component
 */
const JoinsSection = ({
  selectedTable,
  joins,
  availableTables,
  availableColumns,
  getJoinTableColumns,
  addJoin,
  updateJoin,
  removeJoin
}) => {
  return (
    <div className="sql-builder__section">
      <div className="sql-builder__section-header">
        <LinkIcon />
        <span>Join with another table</span>
        <span className="sql-builder__optional">- after filtering</span>
      </div>
      
      <div className="sql-builder__joins">
        {joins.map((join) => (
          <JoinRow
            key={join.id}
            join={join}
            selectedTable={selectedTable}
            availableTables={availableTables}
            availableColumns={availableColumns}
            getJoinTableColumns={getJoinTableColumns}
            updateJoin={updateJoin}
            removeJoin={removeJoin}
          />
        ))}
        
        <button
          type="button"
          className="sql-builder__add-join"
          onClick={addJoin}
        >
          <PlusIcon />
          <span>Add Join</span>
        </button>
      </div>
    </div>
  );
};

export default JoinsSection;

