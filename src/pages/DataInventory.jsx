import { useEffect, useState } from "react";
import { RectangleStackIcon } from "@heroicons/react/24/outline";

const DATA_API_BASE_URL = (() => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return "";
})().replace(/\/$/, "");
const INVENTORY_LIMIT = 3;
const DEFAULT_INVENTORY_QUERY = "payment";

function DataInventory() {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);
  const [inventoryQuery, setInventoryQuery] = useState(DEFAULT_INVENTORY_QUERY);
  const [pendingInventoryQuery, setPendingInventoryQuery] = useState(DEFAULT_INVENTORY_QUERY);
  const funFacts = [
    "There are more stars in the universe than grains of sand on all of Earth's beaches.",
    "One day on Venus lasts longer than one year on Venus.",
    "Neutron stars can spin at 600 rotations per second.",
    "A single teaspoon of a neutron star would weigh about a billion tons.",
    "The footprints left on the Moon will be there for millions of years."
  ];
  const getRandomFunFact = () => funFacts[Math.floor(Math.random() * funFacts.length)];

  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const extractEntry = (result) => {
      if (!result || typeof result !== "object") {
        return {};
      }
      if (result.entry && typeof result.entry === "object") {
        return result.entry;
      }
      if (result.dataplexEntry && typeof result.dataplexEntry === "object") {
        return result.dataplexEntry;
      }
      return result;
    };

    const fetchInventory = async () => {
      const normalizedQuery = (inventoryQuery ?? "").trim() || "*";
      setInventoryLoading(true);
      try {
        const response = await fetch(
          `${DATA_API_BASE_URL}/v1/dataplex/search?query=${encodeURIComponent(
            normalizedQuery
          )}&pageSize=${INVENTORY_LIMIT}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Failed to load inventory (${response.status})`);
        }
        const payload = await response.json();
        const normalized =
          payload?.results?.map((result) => {
            const entry = extractEntry(result);
            const entrySource = entry.entrySource ?? entry.entry_source ?? {};
            return {
              displayName:
                entry.displayName ??
                entry.display_name ??
                entrySource.displayName ??
                entrySource.display_name ??
                null,
              description: entry.description ?? entrySource.description ?? null,
              location: entry.location ?? entrySource.location ?? entry.asset?.location ?? null,
              system: entry.system ?? entrySource.system ?? null,
              updateTime:
                entry.updateTime ??
                entry.update_time ??
                entrySource.updateTime ??
                entrySource.update_time ??
                null
            };
          }) ?? [];
        if (!controller.signal.aborted) {
          setInventoryItems(normalized);
          setInventoryError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load data inventory", error);
        setInventoryError("Unable to reach the catalog service.");
      } finally {
        if (!controller.signal.aborted) {
          setInventoryLoading(false);
        }
      }
    };

    fetchInventory();
    return () => controller.abort();
  }, [inventoryQuery]);

  const handleInventorySearch = (event) => {
    event.preventDefault();
    const trimmed = pendingInventoryQuery.trim();
    setInventoryQuery(trimmed || "*");
  };

  const handlePreviewRequest = async (item) => {
    if (!item?.displayName) {
      setPreviewError("No preview available for this asset.");
      setPreviewData(null);
      setPreviewTarget(null);
      return;
    }
    const displayName = item.displayName;
    setPreviewTarget(displayName);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewData(null);
    try {
      const response = await fetch(
        `${DATA_API_BASE_URL}/v1/dataPreview?name=${encodeURIComponent(displayName)}`
      );
      if (!response.ok) {
        throw new Error(`Preview failed (${response.status})`);
      }
      const payload = await response.json();
      setPreviewData(payload);
    } catch (error) {
      console.error("Failed to load data preview", error);
      setPreviewError("Preview unavailable. Try another entry.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatUpdateTime = (timestamp) => {
    if (!timestamp) {
      return "Updated time unknown";
    }
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) {
      return `Updated ${timestamp}`;
    }
    const diff = Math.max(0, Date.now() - parsed.getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return `Updated ${minutes || 1}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `Updated ${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `Updated ${days}d ago`;
  };

  return (
    <section className="inventory-page">
      <article className="home__inventory-card">
        <div className="home__inventory-head">
          <RectangleStackIcon aria-hidden="true" />
          <div>
            <p>Data Inventory</p>
            <strong>Latest catalog assets</strong>
            <span className="home__inventory-query">
              {inventoryQuery === "*" ? "Showing all systems" : `Query: ${inventoryQuery}`}
            </span>
          </div>
        </div>
        <form className="home__inventory-search" onSubmit={handleInventorySearch}>
          <label htmlFor="inventory-query" className="sr-only">
            Inventory search query
          </label>
          <input
            id="inventory-query"
            type="text"
            value={pendingInventoryQuery}
            onChange={(event) => setPendingInventoryQuery(event.target.value)}
            placeholder="Search catalog (e.g., payments)"
          />
          <button type="submit" disabled={inventoryLoading}>
            {inventoryLoading ? "Scanning..." : "Search"}
          </button>
        </form>
        <div className="home__inventory-body">
          {inventoryLoading && (
            <div className="home__inventory-loading">
              <div className="space-loader" aria-hidden="true">
                <span className="space-loader__rocket">▲</span>
                <span className="space-loader__trail" />
                <span className="space-loader__star space-loader__star--1">✦</span>
                <span className="space-loader__star space-loader__star--2">✦</span>
                <span className="space-loader__star space-loader__star--3">✦</span>
              </div>
              <p className="home__inventory-status">
                Loading catalog signals... Did you know? {getRandomFunFact()}
              </p>
            </div>
          )}
          {!inventoryLoading && inventoryError && (
            <p className="home__inventory-status home__inventory-status--error">{inventoryError}</p>
          )}
          {!inventoryLoading && !inventoryError && inventoryItems.length === 0 && (
            <p className="home__inventory-status">No catalog entries detected.</p>
          )}
          {!inventoryLoading && !inventoryError && inventoryItems.length > 0 && (
            <ul className="home__inventory-list">
              {inventoryItems.map((item, index) => (
                <li key={`${item.displayName ?? "asset"}-${index}`} className="home__inventory-item">
                  <div className="home__inventory-item-head">
                    <p className="home__inventory-name">{item.displayName ?? "Unnamed asset"}</p>
                    <span>{item.system ?? "Unknown system"}</span>
                  </div>
                  <p className="home__inventory-description">
                    {item.description ?? "No description available."}
                  </p>
                  <div className="home__inventory-meta">
                    <span>{item.location ?? "Unknown location"}</span>
                    <span>{formatUpdateTime(item.updateTime)}</span>
                  </div>
                  <button
                    type="button"
                    className="home__inventory-preview-btn"
                    onClick={() => handlePreviewRequest(item)}
                    disabled={!item.displayName || previewLoading}
                  >
                    {previewLoading && previewTarget === item.displayName ? "Loading..." : "Preview data"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(previewLoading || previewData || previewError) && (
          <div className="home__inventory-preview">
            <div className="home__inventory-preview-head">
              <h3>Preview</h3>
              <span>{previewTarget ?? "No asset selected"}</span>
            </div>
            {previewLoading && (
              <p className="home__inventory-status">
                Fetching preview... Fun fact: {getRandomFunFact()}
              </p>
            )}
            {!previewLoading && previewError && (
              <p className="home__inventory-status home__inventory-status--error">{previewError}</p>
            )}
            {!previewLoading && previewData && (
              <div className="home__inventory-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {previewData.columns?.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows?.map((row, index) => (
                      <tr key={`${previewTarget ?? "row"}-${index}`}>
                        {row.map((value, cellIndex) => (
                          <td key={`${previewTarget ?? "cell"}-${index}-${cellIndex}`}>
                            {value == null ? "—" : String(value)}
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
      </article>
    </section>
  );
}

export default DataInventory;
