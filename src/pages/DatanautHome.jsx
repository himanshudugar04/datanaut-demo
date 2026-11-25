import { useEffect, useRef, useState } from "react";
import {
  ChartBarIcon,
  CommandLineIcon,
  RectangleStackIcon,
  QueueListIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  SparklesIcon
} from "@heroicons/react/24/outline";

const missionTabs = [
  {
    id: "approvals",
    label: "Access Bay",
    sup: "Orbit approvals",
    Icon: ShieldCheckIcon,
    accent: "rgba(79, 70, 229, 0.65)",
    description: "Triage and approve access requests with automated lineage snapshots before they dock.",
    metrics: [
      { label: "Pending queue", value: "12 requests", delta: "+3 vs last orbit" },
      { label: "Median SLA", value: "3m 42s", delta: "↘︎ 18% faster" },
      { label: "High priority", value: "2 critical", delta: "Revenue Ops, Core ML" }
    ],
    highlights: [
      "Flagged tickets already include scope diff + owner confirmation",
      "Decision memos sync back to the team workspace once approved",
      "Escalations route automatically to Duty Officer"
    ],
    actionLabel: "Launch approval stack"
  },
  {
    id: "telemetry",
    label: "Telemetry Mesh",
    sup: "Live observability",
    Icon: QueueListIcon,
    accent: "rgba(14, 165, 233, 0.65)",
    description: "Monitor your warehouse signals, anomaly alerts, and incident traffic from one console.",
    metrics: [
      { label: "Signals online", value: "48 streams", delta: "4 undergoing recalibration" },
      { label: "Incident load", value: "Low", delta: "Only 1 minor jitter" },
      { label: "Data freshness", value: "99.3%", delta: "Target 99.0%" }
    ],
    highlights: [
      "New drift monitor launched for product analytics mart",
      "Observability beacons sweeping every 2 minutes",
      "Latency budget recalibrated automatically overnight"
    ],
    actionLabel: "Review telemetry"
  },
  {
    id: "automation",
    label: "Automation Lab",
    sup: "Workflow engines",
    Icon: RocketLaunchIcon,
    accent: "rgba(248, 113, 113, 0.65)",
    description: "Deploy pre-built policy automations to keep your crew focused on higher-orbit missions.",
    metrics: [
      { label: "Routines active", value: "23", delta: "3 paused for tuning" },
      { label: "Time saved", value: "18 hrs/orbit", delta: "+6 vs last week" },
      { label: "Manual overrides", value: "1", delta: "Triggered at 02:16 UTC" }
    ],
    highlights: [
      "Dynamic masking roll-out completed for Finance pod",
      "Service accounts now inherit incident context automatically",
      "Next-gen auto-remediations staged for preview"
    ],
    actionLabel: "Deploy automation"
  }
];

const quickActions = [
  {
    title: "Approve Database Requests",
    description: "Snap lineage intel + scopes into each request before clearing it.",
    Icon: ShieldCheckIcon,
    comingSoon: true
  },
  {
    title: "View Permissions",
    description: "Audit team access, scopes, and request history from a single screen.",
    Icon: ChartBarIcon,
    navigate: "permissions"
  },
  {
    title: "Launch Incident Macro",
    description: "Spin up a ready-made mitigation checklist for on-call datanauts.",
    Icon: CommandLineIcon,
    comingSoon: true
  },
  {
    title: "Install Automation",
    description: "Drop in preflight-tested policies for zero touch governance.",
    Icon: SparklesIcon,
    comingSoon: true
  },
  {
    title: "Explore Data Inventory",
    description: "Search catalog assets and preview live data samples.",
    Icon: RectangleStackIcon,
    navigate: "inventory"
  },
  {
    title: "User Journey",
    description: "Monitor realtime signals flowing from your customer experiences.",
    Icon: QueueListIcon,
    navigate: "journey"
  }
];

function DatanautHome({ selectedOrg, session, onOpenPermissions, onOpenInventory, onOpenEvents }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState(missionTabs[0].id);
  const [rocketPosition, setRocketPosition] = useState({ x: 0, y: 0 });
  const homeRef = useRef(null);

  useEffect(() => {
    setCurrentUser(session?.userInfo ?? null);
  }, [session]);

  const handleFeatureLaunch = (event) => {
    if (launching) return;
    const homeBounds = homeRef.current?.getBoundingClientRect();
    if (homeBounds) {
      if (event?.clientX != null && event?.clientY != null) {
        setRocketPosition({
          x: event.clientX - homeBounds.left,
          y: event.clientY - homeBounds.top
        });
      } else {
        setRocketPosition({ x: homeBounds.width / 2, y: homeBounds.height / 2 });
      }
    }
    setLaunching(true);
    setTimeout(() => {
      setLaunching(false);
      alert("Feature coming soon 🚀");
    }, 900);
  };

  const handleQuickAction = (feature, event) => {
    if (feature.navigate === "permissions") {
      onOpenPermissions?.();
      return;
    }
    if (feature.navigate === "inventory") {
      onOpenInventory?.();
      return;
    }
    if (feature.navigate === "journey") {
      onOpenEvents?.();
      return;
    }
    handleFeatureLaunch(event);
  };

  const firstName = currentUser?.name?.split(" ")[0] ?? "Explorer";
  const currentTab = missionTabs.find((tab) => tab.id === activeTab) ?? missionTabs[0];

  return (
    <section className="home" ref={homeRef}>
      {launching && (
        <div
          className="rocket-launch"
          aria-hidden="true"
          style={{ left: `${rocketPosition.x}px`, top: `${rocketPosition.y}px` }}
        >
          <span className="rocket-launch__smoke rocket-launch__smoke--1" />
          <span className="rocket-launch__smoke rocket-launch__smoke--2" />
          <span className="rocket-launch__smoke rocket-launch__smoke--3" />
          <span className="rocket-launch__trail" />
          <span className="rocket-launch__icon">🚀</span>
        </div>
      )}

      <div className="home__hero">
        <div className="home__hero-content">
          <p className="home__hero-sup">Mission Control</p>
          <h1>Welcome aboard, {firstName}</h1>
          <p className="home__hero-tagline">
            Monitoring <span>{selectedOrg}</span> telemetry. Keep your sensors tuned for fresh alerts.
          </p>
        </div>

        <div className="home__telemetry">
          {quickActions.map((feature) => (
            <button
              key={feature.title}
              className="home__telemetry-card"
              onClick={(event) => handleQuickAction(feature, event)}
              type="button"
              disabled={feature.comingSoon}
            >
              <feature.Icon aria-hidden="true" />
              <div>
                <p>{feature.title}</p>
                <span>
                  {feature.description}
                  {feature.comingSoon ? " (Coming soon)" : ""}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default DatanautHome;
