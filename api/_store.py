"""Persistent store for saved datasets.

Production (Vercel): one JSON index file in a private Vercel Blob store
(BLOB_READ_WRITE_TOKEN is injected by Vercel when the store is connected).
Local / no token: a JSON file on disk.
"""
import json
import os
import threading
import time
import urllib.parse
import urllib.request

INDEX_PATH = "datanaut/saved_datasets.json"
LOCAL_FILE = os.getenv("DATANAUT_LOCAL_STORE", "/tmp/datanaut_saved_datasets.json")
API_BASE = "https://vercel.com/api/blob"
API_VERSION = "13"

_lock = threading.Lock()
_cache = {"data": None, "at": 0.0}
CACHE_SECONDS = 3


def _token():
    return os.getenv("BLOB_READ_WRITE_TOKEN")


def _store_id(token):
    parts = token.split("_")
    return parts[3] if len(parts) > 3 else ""


def backend_name():
    return "vercel-blob" if _token() else "local-file"


def _blob_read():
    token = _token()
    store = _store_id(token)
    url = f"https://{store}.private.blob.vercel-storage.com/{INDEX_PATH}?cache=0"
    req = urllib.request.Request(url, headers={"authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return []
        raise


def _blob_write(items):
    token = _token()
    body = json.dumps(items).encode("utf-8")
    url = f"{API_BASE}/?{urllib.parse.urlencode({'pathname': INDEX_PATH})}"
    req = urllib.request.Request(url, data=body, method="PUT", headers={
        "authorization": f"Bearer {token}",
        "x-api-version": API_VERSION,
        "x-vercel-blob-store-id": _store_id(token),
        "x-vercel-blob-access": "private",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-content-type": "application/json",
        "content-type": "application/json",
    })
    with urllib.request.urlopen(req, timeout=20) as r:
        r.read()


def _local_read():
    if not os.path.exists(LOCAL_FILE):
        return []
    with open(LOCAL_FILE, encoding="utf-8") as f:
        return json.load(f)


def _local_write(items):
    with open(LOCAL_FILE, "w", encoding="utf-8") as f:
        json.dump(items, f)


def load_all(fresh=False):
    now = time.time()
    if not fresh and _cache["data"] is not None and now - _cache["at"] < CACHE_SECONDS:
        return list(_cache["data"])
    items = _blob_read() if _token() else _local_read()
    _cache.update(data=items, at=now)
    return list(items)


def add(record):
    """Append a record; returns False if the name already exists (case-insensitive)."""
    with _lock:
        items = load_all(fresh=True)
        if any(i["dataset_name"].lower() == record["dataset_name"].lower() for i in items):
            return False
        items.insert(0, record)
        if _token():
            _blob_write(items)
        else:
            _local_write(items)
        _cache.update(data=items, at=time.time())
        return True


def get(dataset_id):
    for i in load_all():
        if str(i["dataset_id"]) == str(dataset_id):
            return i
    for i in load_all(fresh=True):
        if str(i["dataset_id"]) == str(dataset_id):
            return i
    return None
