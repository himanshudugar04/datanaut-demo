import { databaseSchema } from "../../../data/databaseSchema";

/**
 * Selectors component for Project, Dataset, and Table selection
 */
const Selectors = ({
  selectedProject,
  selectedDataset,
  selectedTable,
  availableDatasets,
  availableTables,
  onProjectChange,
  onDatasetChange,
  onTableChange
}) => {
  return (
    <div className="sql-builder__selectors">
      <div className="sql-builder__selector">
        <label>Project</label>
        <select
          value={selectedProject}
          onChange={(e) => onProjectChange(e.target.value)}
        >
          <option value="">Select project...</option>
          {databaseSchema.projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sql-builder__selector">
        <label>Dataset</label>
        <select
          value={selectedDataset}
          onChange={(e) => onDatasetChange(e.target.value)}
          disabled={!selectedProject}
        >
          <option value="">Select dataset...</option>
          {availableDatasets.map(dataset => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.name}
            </option>
          ))}
        </select>
      </div>

      <div className="sql-builder__selector">
        <label>Table</label>
        <select
          value={selectedTable}
          onChange={(e) => onTableChange(e.target.value)}
          disabled={!selectedDataset}
        >
          <option value="">Select table...</option>
          {availableTables.map(table => (
            <option key={table.id} value={table.id}>
              {table.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default Selectors;

