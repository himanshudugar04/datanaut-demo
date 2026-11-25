import { useMemo } from "react";

const datasetPermissions = [
  {
    dataset: "warehouse.analytics",
    steward: "Nova Patel",
    classification: "Sensitive",
    updated: "2 minutes ago",
    access: [
      {
        table: "events_page_views",
        subject: "Growth Ops",
        type: "Team scope",
        permission: "READ",
        expires: "Indefinite"
      },
      {
        table: "events_page_views",
        subject: "Experimentation pod",
        type: "Service account",
        permission: "READ / WRITE",
        expires: "Apr 09"
      },
      {
        table: "events_conversions",
        subject: "Revenue Ops",
        type: "Team scope",
        permission: "READ",
        expires: "May 01"
      }
    ]
  },
  {
    dataset: "warehouse.product",
    steward: "Amelia Cho",
    classification: "Internal",
    updated: "8 minutes ago",
    access: [
      {
        table: "feature_flags",
        subject: "Feature Platform",
        type: "Service account",
        permission: "ADMIN",
        expires: "Indefinite"
      },
      {
        table: "session_rollups",
        subject: "Product Analytics",
        type: "Team scope",
        permission: "READ",
        expires: "Jun 14"
      },
      {
        table: "session_rollups",
        subject: "Self-serve BI",
        type: "User group",
        permission: "READ",
        expires: "Jul 01"
      }
    ]
  },
  {
    dataset: "warehouse.finance",
    steward: "Luca Marin",
    classification: "Restricted",
    updated: "15 minutes ago",
    access: [
      {
        table: "ledger_actuals",
        subject: "Finance Leadership",
        type: "User group",
        permission: "READ / WRITE",
        expires: "Quarter end"
      },
      {
        table: "ledger_actuals",
        subject: "Audit Bot",
        type: "Service account",
        permission: "READ",
        expires: "Indefinite"
      },
      {
        table: "payment_failures",
        subject: "Risk & Compliance",
        type: "Team scope",
        permission: "READ",
        expires: "May 22"
      }
    ]
  }
];

function ViewPermissions() {
  const summary = useMemo(() => {
    const totalTables = datasetPermissions.reduce((sum, dataset) => sum + dataset.access.length, 0);
    return [
      { label: "Datasets", value: datasetPermissions.length },
      { label: "Grants tracked", value: totalTables },
      { label: "Stewards", value: new Set(datasetPermissions.map((dataset) => dataset.steward)).size }
    ];
  }, []);

  const flattened = useMemo(() => {
    return datasetPermissions.flatMap((dataset) =>
      dataset.access.map((entry) => ({
        dataset: dataset.dataset,
        steward: dataset.steward,
        classification: dataset.classification,
        updated: dataset.updated,
        ...entry
      }))
    );
  }, []);

  return (
    <section className="permissions">
      <header className="permissions__hero">
        <div>
          <p className="permissions__hero-sup">Permission Observatory</p>
          <h1>View permissions</h1>
          <p>
            Inspect who can access each mission-critical dataset, how they were granted entry, and when
            the access expires.
          </p>
        </div>
        <div className="permissions__stats">
          {summary.map((stat) => (
            <div key={stat.label}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </header>

      <div className="permissions__table-wrap">
        <table className="permissions__table permissions__table--full">
          <thead>
            <tr>
              <th>Dataset</th>
              <th>Table</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Permission</th>
              <th>Expires</th>
              <th>Steward</th>
            </tr>
          </thead>
          <tbody>
            {flattened.map((row) => (
              <tr key={`${row.dataset}-${row.table}-${row.subject}`}>
                <td>
                  <div className="permissions__dataset">
                    <strong>{row.dataset}</strong>
                    <span>
                      <span
                        className={`permissions__chip permissions__chip--${row.classification.toLowerCase()}`}
                      >
                        {row.classification}
                      </span>
                      Synced {row.updated}
                    </span>
                  </div>
                </td>
                <td>{row.table}</td>
                <td>{row.subject}</td>
                <td>{row.type}</td>
                <td className="permissions__pill">{row.permission}</td>
                <td>{row.expires}</td>
                <td>{row.steward}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default ViewPermissions;
