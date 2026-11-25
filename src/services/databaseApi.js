import axios from 'axios';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api';

const DEFAULT_TIMEOUT = 30000;
const QUERY_TIMEOUT = 120000;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

const queryApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: QUERY_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});


// // Get all projects (BigQuery projects)
// export const fetchProjects = async () => {
//   const response = await api.get('/db/projects');
//   return response.data;
// };

// // Get datasets and tables for a project
// export const fetchDatasets = async (projectId) => {
//   const response = await api.get(`/db/projects/${projectId}/tables`);
//   return response.data;
// };

// // Get columns for a specific table
// export const fetchColumns = async (projectId, tableId, datasetId) => {
//   const response = await api.get(`/db/projects/${projectId}/tables/${tableId}/columns`, {
//     params: { dataset: datasetId }
//   });
//   return response.data;
// };

// // Alias for fetchColumns with clearer parameter order (project, dataset, table)
// export const fetchTableColumns = async (projectId, datasetId, tableId) => {
//   const response = await api.get(`/db/projects/${projectId}/tables/${tableId}/columns`, {
//     params: { dataset: datasetId }
//   });
//   return response.data;
// };

// // Get sample data for preview
// export const fetchTablePreview = async (projectId, tableId, datasetId, limit = 5) => {
//   const response = await api.get(`/db/projects/${projectId}/tables/${tableId}/preview`, {
//     params: { dataset: datasetId, limit }
//   });
//   return response.data;
// };

// // Execute SQL query with extended timeout
// // limit: number of rows to fetch (null/undefined = no limit, fetch all)
// // - Get Results uses limit=1000 for faster response
// // - Download uses no limit to fetch all data
// export const executeQuery = async (query, limit = null) => {
//   const response = await queryApi.post('/db/execute', { 
//     query,
//     limit: limit  // null = no limit (download), 1000 = preview limit
//   });
//   return response.data;
// };

// // Health check
// export const checkHealth = async () => {
//   const response = await api.get('/health');
//   return response.data;
// };

// // Save a dataset (filtered table) to the database
// export const saveDataset = async ({ datasetName, columnInfo, sqlDefinition, createdBy }) => {
//   const response = await api.post('/db/save-dataset', {
//     dataset_name: datasetName,
//     column_info: columnInfo,
//     sql_definition: sqlDefinition,
//     created_by: createdBy
//   });
//   return response.data;
// };

// // Get all saved datasets
// export const fetchSavedDatasets = async () => {
//   const response = await api.get('/db/saved-datasets');
//   return response.data;
// };

// // Get columns for a saved dataset
// export const fetchSavedDatasetColumns = async (datasetId) => {
//   const response = await api.get(`/db/saved-datasets/${datasetId}/columns`);
//   return response.data;
// };

// // Get SQL definition for a saved dataset
// export const fetchSavedDatasetSQL = async (datasetId) => {
//   const response = await api.get(`/db/saved-datasets/${datasetId}/sql`);
//   return response.data;
// };



export const fetchProjects = async () => api.get('/db/projects').then(res => res.data);
export const fetchDatasets = async (projectId) => api.get(`/db/projects/${projectId}/tables`).then(res => res.data);
export const fetchColumns = async (projectId, tableId, datasetId) =>
  api.get(`/db/projects/${projectId}/tables/${tableId}/columns`, { params: { dataset: datasetId } })
     .then(res => res.data);
export const fetchTableColumns = fetchColumns;
export const fetchTablePreview = async (projectId, tableId, datasetId, limit = 5) =>
  api.get(`/db/projects/${projectId}/tables/${tableId}/preview`, { params: { dataset: datasetId, limit } })
     .then(res => res.data);
export const executeQuery = async (query, limit = null) =>
  queryApi.post('/db/execute', { query, limit }).then(res => res.data);
export const checkHealth = async () => api.get('/healthz').then(res => res.data);
export const saveDataset = async ({ datasetName, columnInfo, sqlDefinition, createdBy }) =>
  api.post('/db/save-dataset', {
    dataset_name: datasetName,
    column_info: columnInfo,
    sql_definition: sqlDefinition,
    created_by: createdBy,
  }).then(res => res.data);
export const fetchSavedDatasets = async () => api.get('/db/saved-datasets').then(res => res.data);
export const fetchSavedDatasetColumns = async (datasetId) =>
  api.get(`/db/saved-datasets/${datasetId}/columns`).then(res => res.data);
export const fetchSavedDatasetSQL = async (datasetId) =>
  api.get(`/db/saved-datasets/${datasetId}/sql`).then(res => res.data);

export default {
  fetchProjects,
  fetchDatasets,
  fetchColumns,
  fetchTableColumns,
  fetchTablePreview,
  executeQuery,
  checkHealth,
  saveDataset,
  fetchSavedDatasets,
  fetchSavedDatasetColumns,
  fetchSavedDatasetSQL
};