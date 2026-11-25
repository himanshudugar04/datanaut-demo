# Datanaut — No-code SQL Builder (demo)

A visual query builder for a BigQuery-style warehouse: pick a table, add chained filters,
GROUP BY + aggregations + HAVING, join a second table, preview the generated CTE SQL live,
save any query as a reusable dataset, and download results as CSV.

All data in this demo is synthetic.

## Architecture
- **Frontend**: React + Vite (`src/`)
- **API**: Flask serverless function (`api/index.py`) with the same REST contract as the
  production FastAPI/BigQuery service
- **Warehouse**: embedded DuckDB, generated deterministically on cold start (`api/_seed.py`)
  - `datanaut.sales.customers` 50k · `orders` 500k · `order_items` ~900k · `products` 2.5k
  - `datanaut.marketing.app_events` 2.5M · `campaigns` 300
- **Saved datasets**: persisted in Vercel Blob (`api/_store.py`)

## Guards (mirroring production)
- Only single `SELECT` / `WITH` statements
- Dry run before execution: validates SQL and estimates bytes scanned (referenced columns only,
  BigQuery-style); queries over **200 MB** are blocked
- Runtime cap (120 s in production; capped lower by the serverless platform here)

## Run locally
```bash
pip install -r requirements.txt && python api/index.py      # API on :3001
npm install && npm run dev                                   # UI on :8080 (proxies /api)
```
