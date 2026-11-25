"""Datanaut demo backend.

Same REST contract as the original Flask/MySQL and FastAPI/BigQuery servers, running on an
embedded DuckDB warehouse filled with synthetic data. Saved datasets persist in Vercel Blob.
"""
import json
import os
import re
import sys
import threading
import time
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import duckdb
from flask import Flask, jsonify, request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _seed  # noqa: E402
import _store  # noqa: E402

app = Flask(__name__)
app.json.sort_keys = False

PROJECT_ID = "datanaut"
DATANAUT_DATASET = "saved_tables"
DATA_SCHEMAS = ["sales", "marketing"]
QUERY_TIMEOUT_SECONDS = 120          # product rule (same as production)
PLATFORM_TIMEOUT_SECONDS = 50        # serverless function limit for this demo
MAX_BYTES_ALLOWED = 200 * 1024 * 1024  # 200 MB, same as the BigQuery dry-run guard
MAX_RESPONSE_BYTES = 3_800_000       # keep JSON responses under the platform payload limit

_db_lock = threading.Lock()
_db = {"con": None, "stats": None, "built_at": None, "build_ms": None}


# ---------------------------------------------------------------- warehouse

def _type_to_bq(t):
    t = (t or "").upper()
    if any(x in t for x in ("INT", "HUGEINT")):
        return "INT64"
    if any(x in t for x in ("DOUBLE", "FLOAT", "DECIMAL", "REAL", "NUMERIC")):
        return "FLOAT64"
    if t.startswith("BOOL"):
        return "BOOL"
    if t.startswith("TIMESTAMP"):
        return "TIMESTAMP"
    if t == "DATE":
        return "DATE"
    if t.startswith("TIME"):
        return "TIME"
    return "STRING"


def _bq_bytes(bq_type, avg_len):
    # BigQuery logical sizes: 8 bytes for numbers/dates/timestamps, 1 for BOOL, 2 + length for STRING
    if bq_type == "BOOL":
        return 1
    if bq_type == "STRING":
        return 2 + (avg_len or 0)
    return 8


def _build():
    t0 = time.time()
    con = duckdb.connect(":memory:")
    con.execute("SET threads=2")
    con.execute("SET preserve_insertion_order=false")
    con.execute("SET enable_progress_bar=false")
    con.execute("ATTACH ':memory:' AS datanaut")
    _seed.build(con)

    stats = {}
    cols = con.execute("""
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_catalog = 'datanaut' AND table_schema IN ('sales','marketing')
        ORDER BY table_schema, table_name, ordinal_position
    """).fetchall()
    for schema, table, col, dtype in cols:
        key = (schema, table)
        if key not in stats:
            rows = con.execute(f"SELECT count(*) FROM datanaut.{schema}.{table}").fetchone()[0]
            stats[key] = {"rows": rows, "columns": {}, "types": {}}
        bq = _type_to_bq(dtype)
        avg_len = None
        if bq == "STRING":
            avg_len = con.execute(
                f'SELECT coalesce(avg(strlen("{col}")), 0) FROM datanaut.{schema}.{table}'
            ).fetchone()[0]
        stats[key]["columns"][col] = _bq_bytes(bq, avg_len) * stats[key]["rows"]
        stats[key]["types"][col] = bq
    _db.update(con=con, stats=stats, built_at=datetime.utcnow().isoformat() + "Z",
               build_ms=round((time.time() - t0) * 1000))


def db():
    if _db["con"] is None:
        with _db_lock:
            if _db["con"] is None:
                _build()
    return _db["con"].cursor()


# ---------------------------------------------------------------- helpers

def serialize_value(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        h, r = divmod(total, 3600)
        m, s = divmod(r, 60)
        return f"{h:02d}:{m:02d}:{s:02d}"
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, float):
        if value != value:  # NaN
            return None
        return round(value, 4)
    return value


def format_bytes(n):
    if n < 1024:
        return f"{n} B"
    if n < 1024 ** 2:
        return f"{n / 1024:.1f} KB"
    if n < 1024 ** 3:
        return f"{n / 1024 ** 2:.2f} MB"
    return f"{n / 1024 ** 3:.2f} GB"


def rewrite_query(sql):
    """BigQuery dialect -> DuckDB: drop identifier backticks (project.dataset.table maps 1:1)."""
    return sql.replace("`", "").strip().rstrip(";")


_TABLE_RE = re.compile(r"\bdatanaut\.(\w+)\.(\w+)\b", re.IGNORECASE)


def estimate_bytes(sql):
    """Dry-run equivalent: BigQuery bills the referenced columns of each scanned table."""
    stats = _db["stats"]
    total, scanned = 0, []
    seen = set()
    for schema, table in _TABLE_RE.findall(sql):
        key = (schema.lower(), table.lower())
        if key in seen or key not in stats:
            continue
        seen.add(key)
        st = stats[key]
        star = re.search(rf"SELECT\s+(DISTINCT\s+)?\*\s+FROM\s+datanaut\.{schema}\.{table}\b", sql, re.I)
        used = list(st["columns"]) if star else [
            c for c in st["columns"] if re.search(rf"\b{re.escape(c)}\b", sql, re.I)
        ]
        b = sum(st["columns"][c] for c in used)
        total += b
        scanned.append({"table": f"{PROJECT_ID}.{key[0]}.{key[1]}", "columns": used, "bytes": b})
    return total, scanned


def run_query(sql, max_results=None, timeout=None):
    """Execute with a hard timeout; returns rows (dicts), columns, timing, truncated flag."""
    timing = {}
    t0 = time.time()
    cur = db()
    timer = None
    if timeout:
        timer = threading.Timer(timeout, cur.interrupt)
        timer.start()
    try:
        cur.execute(sql)
        timing["execute_query"] = round((time.time() - t0) * 1000, 2)
        columns = []
        for d in (cur.description or []):
            name, n = d[0], 1
            while name in columns:  # BigQuery-style de-duplication: customer_id, customer_id_1
                name = f"{d[0]}_{n}"
                n += 1
            columns.append(name)
        rows, size, truncated = [], 0, False
        f0 = time.time()
        while True:
            want = 2000 if max_results is None else min(2000, max_results - len(rows))
            if want <= 0:
                break
            chunk = cur.fetchmany(want)
            if not chunk:
                break
            for r in chunk:
                d = {c: serialize_value(v) for c, v in zip(columns, r)}
                size += len(json.dumps(d, default=str))
                rows.append(d)
                if size > MAX_RESPONSE_BYTES:
                    truncated = True
                    break
            if truncated:
                break
        timing["fetch_results"] = round((time.time() - f0) * 1000, 2)
    finally:
        if timer:
            timer.cancel()
        timing["total"] = round((time.time() - t0) * 1000, 2)
    return rows, columns, timing, truncated


def err(status, error, message=None, **extra):
    body = {"error": error}
    if message:
        body["message"] = message
    body.update(extra)
    return jsonify(body), status


# ---------------------------------------------------------------- health

def _store_status():
    try:
        count = len(_store.load_all(fresh=True))
    except Exception:
        count = None
    return {"saved_datasets": count, **_store.status}



@app.route("/api/health")
@app.route("/api/healthz")
def health():
    db()
    return jsonify({
        "status": "ok",
        "database": "duckdb-demo-warehouse",
        "saved_dataset_store": _store.backend_name(),
        "saved_dataset_store_status": _store_status(),
        "warehouse_built_at": _db["built_at"],
        "warehouse_build_ms": _db["build_ms"],
        "tables": {f"{s}.{t}": v["rows"] for (s, t), v in _db["stats"].items()},
    })


# ---------------------------------------------------------------- catalog

@app.route("/api/db/projects")
def get_projects():
    return jsonify([{"id": PROJECT_ID, "name": PROJECT_ID}])


def _saved_tables_entries():
    out = []
    for r in _store.load_all():
        out.append({
            "id": f"saved_{r['dataset_id']}",
            "name": r["dataset_name"],
            "is_saved_dataset": True,
            "dataset_id": str(r["dataset_id"]),
            "column_info": r.get("column_info", []),
        })
    return out


@app.route("/api/db/projects/<project_id>/tables")
def get_tables(project_id):
    try:
        cur = db()
        response = []
        for schema in DATA_SCHEMAS:
            tables = cur.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_catalog='datanaut' AND table_schema=? ORDER BY table_name", [schema]
            ).fetchall()
            response.append({"id": schema, "name": schema,
                             "tables": [{"id": t[0], "name": t[0]} for t in tables]})
        try:
            saved = _saved_tables_entries()
        except Exception:
            saved = []
        response.append({"id": DATANAUT_DATASET, "name": DATANAUT_DATASET, "tables": saved})
        return jsonify(response)
    except Exception as e:
        return err(500, f"Failed to fetch tables: {e}")


@app.route("/api/db/projects/<project_id>/tables/<table_id>/columns")
def get_table_columns(project_id, table_id):
    dataset = request.args.get("dataset")
    if not dataset:
        return err(400, "dataset query param is required")
    try:
        rows = db().execute(
            "SELECT column_name, data_type, is_nullable FROM information_schema.columns "
            "WHERE table_catalog='datanaut' AND table_schema=? AND table_name=? ORDER BY ordinal_position",
            [dataset, table_id],
        ).fetchall()
        if not rows:
            return err(404, f"Table {dataset}.{table_id} not found")
        return jsonify([{
            "id": c, "name": c, "type": _type_to_bq(t), "nullable": n == "YES",
            "isPrimaryKey": c == f"{table_id.rstrip('s')}_id" or c == "event_id",
        } for c, t, n in rows])
    except Exception as e:
        return err(500, f"Failed to fetch columns: {e}")


@app.route("/api/db/projects/<project_id>/tables/<table_id>/preview")
def get_preview(project_id, table_id):
    dataset = request.args.get("dataset")
    limit = min(request.args.get("limit", 5, type=int), 1000)
    if not dataset or not re.fullmatch(r"\w+", dataset) or not re.fullmatch(r"\w+", table_id):
        return err(400, "valid dataset query param is required")
    rows, _, _, _ = run_query(f"SELECT * FROM datanaut.{dataset}.{table_id} ORDER BY 1 LIMIT {limit}", max_results=limit)
    return jsonify(rows)


# ---------------------------------------------------------------- execute

@app.route("/api/db/execute", methods=["POST"])
def execute_sql():
    data = request.get_json(silent=True) or {}
    query = data.get("query")
    row_limit = data.get("limit")
    if not query:
        return err(400, "Query is required")

    trimmed = query.strip().upper()
    if not (trimmed.startswith("SELECT") or trimmed.startswith("WITH")):
        return err(403, "Only SELECT queries are allowed")
    sql = rewrite_query(query)
    if ";" in sql:
        return err(403, "Only a single SELECT statement is allowed")

    # ---------- DRY RUN (validate + estimate bytes) ----------
    dry_start = time.time()
    try:
        db().execute(f"EXPLAIN {sql}")
    except Exception as exc:
        return err(400, "Query validation failed", str(exc).split("\n")[0])
    bytes_to_process, scanned = estimate_bytes(sql)
    dry_run_ms = round((time.time() - dry_start) * 1000, 2)

    # ---------- SIZE GUARD ----------
    if bytes_to_process > MAX_BYTES_ALLOWED:
        return err(403, "Query exceeds size limit",
                   "The table/query is too large to preview or download. "
                   "Please contact the data team for further information or refined data access.",
                   blocked=True, bytesEstimated=bytes_to_process,
                   bytesFormatted=format_bytes(bytes_to_process), maxAllowed="200 MB",
                   scanned=scanned, sql=query)

    # ---------- EXECUTION ----------
    timeout = min(QUERY_TIMEOUT_SECONDS, PLATFORM_TIMEOUT_SECONDS)
    try:
        rows, columns, timing, truncated = run_query(sql, max_results=row_limit, timeout=timeout)
    except duckdb.InterruptException:
        return err(408, "Query timed out", f"Query exceeded the {timeout}s runtime cap and was cancelled.")
    except Exception as exc:
        return err(400, "Query failed", str(exc).split("\n")[0])

    ser_start = time.time()
    payload = {
        "data": rows,
        "columns": [{"name": c, "type": None} for c in columns],
        "rowCount": len(rows),
        "totalRows": len(rows),
        "truncated": truncated,
        "executionTime": int(timing.get("total", 0)),
        "bytesProcessed": bytes_to_process,
        "bytesProcessedFormatted": format_bytes(bytes_to_process),
        "timing": {"warehouse": timing, "dry_run_ms": dry_run_ms},
    }
    payload["timing"]["serialize_ms"] = round((time.time() - ser_start) * 1000, 2)
    payload["timing"]["total_api_ms"] = round(dry_run_ms + timing.get("total", 0), 2)
    return jsonify(payload)


# ---------------------------------------------------------------- saved datasets

@app.route("/api/db/save-dataset", methods=["POST"])
def save_dataset():
    data = request.get_json(silent=True) or {}
    name = (data.get("dataset_name") or "").strip()
    column_info = data.get("column_info") or []
    sql_definition = data.get("sql_definition") or ""
    created_by = data.get("created_by")
    if not name or not sql_definition:
        return err(400, "dataset_name and sql_definition are required")

    try:
        db().execute(f"EXPLAIN {rewrite_query(sql_definition)}")
    except Exception as exc:
        return jsonify({"error": {"message": f"Query validation failed: {str(exc).splitlines()[0]}"}}), 400

    dataset_id = abs(hash(str(uuid.uuid4()))) % (10 ** 9)
    record = {
        "dataset_id": dataset_id,
        "dataset_name": name,
        "column_info": column_info,
        # stored with doubled quotes, exactly like the warehouse-backed versions (frontend unescapes)
        "sql_definition": sql_definition.replace("'", "''"),
        "created_by": created_by,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    try:
        if not _store.add(record):
            return jsonify({"error": {"message": "Please change the name - a table with this name already exists in the database."}}), 400
    except Exception as e:
        return err(500, f"Failed to save dataset: {e}")
    return jsonify({"success": True, "dataset_id": dataset_id, "dataset_name": name,
                    "message": f"Dataset '{name}' saved successfully"})


@app.route("/api/db/saved-datasets")
def get_saved_datasets():
    try:
        return jsonify([{
            "id": str(r["dataset_id"]), "name": r["dataset_name"],
            "column_info": r.get("column_info", []), "created_by": r.get("created_by"),
            "created_at": r.get("created_at"), "is_saved_dataset": True,
        } for r in _store.load_all()])
    except Exception as e:
        print("[saved-datasets] list failed:", e, flush=True)
        return jsonify([])


_BQ_TYPES = {"STRING", "INT64", "FLOAT64", "NUMERIC", "BOOL", "DATE", "TIME", "DATETIME", "TIMESTAMP", "BYTES"}


@app.route("/api/db/saved-datasets/<dataset_id>/columns")
def get_saved_dataset_columns(dataset_id):
    if not dataset_id.isdigit():
        return err(400, "dataset_id must be numeric")
    row = _store.get(dataset_id)
    if not row:
        return err(404, "Dataset not found")
    cols = []
    for col in row.get("column_info") or []:
        if isinstance(col, str):
            col = {"name": col}
        name = col.get("name") or col.get("column") or col.get("id")
        typ = col.get("type") if col.get("type") in _BQ_TYPES else _type_to_bq(col.get("datatype") or col.get("type"))
        cols.append({"id": name, "name": name, "type": typ, "nullable": col.get("nullable", True), "isPrimaryKey": False})
    return jsonify({"columns": cols, "sql_definition": row.get("sql_definition", ""),
                    "dataset_name": row.get("dataset_name", "")})


@app.route("/api/db/saved-datasets/<dataset_id>/sql")
def get_saved_dataset_sql(dataset_id):
    if not dataset_id.isdigit():
        return err(400, "dataset_id must be numeric")
    row = _store.get(dataset_id)
    if not row:
        return err(404, "Dataset not found")
    return jsonify({"sql_definition": row.get("sql_definition", ""),
                    "dataset_name": row.get("dataset_name", ""),
                    "column_info": row.get("column_info", [])})


# ---------------------------------------------------------------- data inventory (catalog search)

@app.route("/v1/dataplex/search")
def catalog_search():
    q = (request.args.get("query") or "*").strip().lower()
    page = request.args.get("pageSize", 25, type=int)
    db()
    now = datetime.utcnow()
    results = []
    for i, ((schema, table), desc) in enumerate(_seed.TABLE_DESCRIPTIONS.items()):
        name = f"{PROJECT_ID}.{schema}.{table}"
        rows = _db["stats"][(schema, table)]["rows"]
        results.append({"entry": {
            "displayName": name, "description": f"{desc} Rows: {rows:,}.",
            "location": "asia-south1", "system": "BIGQUERY",
            "updateTime": (now - timedelta(hours=3 + i * 7)).isoformat() + "Z"}})
    try:
        for r in _store.load_all():
            results.append({"entry": {
                "displayName": f"{PROJECT_ID}.{DATANAUT_DATASET}.{r['dataset_name']}",
                "description": "Saved dataset (virtual table) created in the SQL Builder.",
                "location": "asia-south1", "system": "DATANAUT", "updateTime": r.get("created_at")}})
    except Exception:
        pass
    if q not in ("", "*"):
        results = [r for r in results if q in (r["entry"]["displayName"] + " " + r["entry"]["description"]).lower()]
    return jsonify({"results": results[:page]})


@app.route("/v1/dataPreview")
def data_preview():
    name = request.args.get("name", "")
    m = re.fullmatch(r"datanaut\.(\w+)\.(\w+)", name)
    if not m or m.group(1) not in DATA_SCHEMAS:
        return err(404, "Preview is available for warehouse tables only")
    rows, cols, _, _ = run_query(f"SELECT * FROM datanaut.{m.group(1)}.{m.group(2)} ORDER BY 1 LIMIT 10", max_results=10)
    return jsonify({"columns": cols, "rows": [[r[c] for c in cols] for r in rows]})


# ---------------------------------------------------------------- user journey

@app.route("/api/users")
def user_journey():
    user_key = request.args.get("userKey", "")
    if not user_key.isdigit():
        return err(400, "userKey must be a numeric customer_id (1-50000)")
    try:
        start = datetime.utcfromtimestamp(int(request.args.get("startDate")) / 1000)
        end = datetime.utcfromtimestamp(int(request.args.get("endDate")) / 1000)
    except Exception:
        return err(400, "startDate and endDate must be epoch milliseconds")
    cur = db()
    user = cur.execute("SELECT customer_id, full_name, city, segment, is_premium FROM datanaut.sales.customers WHERE customer_id=?",
                       [int(user_key)]).fetchone()
    if not user:
        return jsonify({"events": []})
    user_obj = dict(zip(["customer_id", "full_name", "city", "segment", "is_premium"], user))
    user_obj["is_premium"] = "Yes" if user_obj["is_premium"] else "No"
    evts = cur.execute("""
        SELECT event_name, CAST(epoch_ms(event_ts) AS BIGINT), source, data_src, event_params, device, app_version
        FROM datanaut.marketing.app_events
        WHERE customer_id = ? AND event_ts BETWEEN ? AND ?
        ORDER BY event_ts LIMIT 500""", [int(user_key), start, end]).fetchall()
    events = [{
        "event": {"event_name": [{"value": n}], "ct": [{"value": str(ms)}],
                  "event_params": [{"value": p}], "data_src": [{"value": ds}],
                  "device": [{"value": dev}], "app_version": [{"value": av}]},
        "cdd": {"src": [{"value": src}]},
        "user": user_obj,
    } for n, ms, src, ds, p, dev, av in evts]
    return jsonify({"events": events})


@app.errorhandler(404)
def not_found(_):
    return err(404, "Not found")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 3001)), debug=False, threaded=True)
