import { useEffect, useMemo, useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import SplashScreen from "./components/SplashScreen.jsx";
import StarCursor from "./components/StarCursor.jsx";
import DatanautHome from "./pages/DatanautHome.jsx";
import ViewPermissions from "./pages/ViewPermissions.jsx";
import DataInventory from "./pages/DataInventory.jsx";
import UserJourney from "./pages/UserJourney.jsx";
import SQLBuilder from "./pages/SQLBuilder.jsx";
import "./pages/styles/SQLBuilder.css";
import { organizations } from "./data/organizations.js";
import Logo from "./assets/Logo.png";
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  BoltIcon,
  CodeBracketIcon
} from "@heroicons/react/24/outline";
// import {
//   logoutCurrentUser,
//   updateCurrentUserIdToken,
//   updateCurrentUserInfo,
//   updateCurrentUserRefreshToken
// } from "./Auth/Utils/currentUser";


const HOME_PATH = "/home";

const session = {
  userInfo: { name: "Demo User" }
};

function App() {
  const [isBooting, setIsBooting] = useState(true);
  const [selectedOrg, setSelectedOrg] = useState("All Organizations");
  const [activeView, setActiveView] = useState("home");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), 1200);
    return () => clearTimeout(timer);
  }, []);



  const navigation = [
    { id: "home", label: "Dashboard", Icon: HomeIcon },
    { id: "inventory", label: "Data inventory", Icon: RectangleStackIcon },
    { id: "journey", label: "User journey", Icon: BoltIcon },
    { id: "permissions", label: "View permissions", Icon: ShieldCheckIcon },
    { id: "sqlbuilder", label: "SQL Builder", Icon: CodeBracketIcon }
  ];



  return (
    <div className="app-shell">
      <StarCursor />
      <div className="app-shell__sidebar-wrapper">
        <aside className={`app-shell__sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`}>
          <button
            type="button"
            className="app-shell__sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? "Collapse navigation" : "Expand navigation"}
          >
            {sidebarOpen ? <XMarkIcon /> : <Bars3Icon />}
          </button>
        <div className="app-shell__logo">
          <img src={Logo} alt="Datanaut logo" />
          <div className="app-shell__logo-text">
            <p className="app-shell__title">Datanaut</p>
            <p className="app-shell__subtitle">Self-serve data, zero SQL</p>
          </div>
        </div>
        <nav className="app-shell__nav" aria-label="Primary">
          {navigation.map((item) => (
            <button
              key={item.id}
              type="button"
              className="app-shell__nav-link"
              data-active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
            >
              <item.Icon aria-hidden="true" />
              <span className="app-shell__nav-text">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="app-shell__sidebar-footer">
          <button type="button" className="logout-btn" disabled>
  <ArrowLeftOnRectangleIcon />
  <span className="app-shell__nav-text">Log out</span>
</button>
        </div>
        </aside>
      </div>
      <div className={`app-shell__main ${sidebarOpen ? "" : "is-sidebar-collapsed"}`}>
        {isBooting && <SplashScreen />}
        <main className="app-shell__content">
          <div className="app-shell__content-inner">
            {activeView === "home" && (
              <DatanautHome
                selectedOrg={selectedOrg}
                session={session}
                onOpenPermissions={() => setActiveView("permissions")}
                onOpenInventory={() => setActiveView("inventory")}
                onOpenEvents={() => setActiveView("journey")}
              />
            )}
            {activeView === "inventory" && <DataInventory />}
            {activeView === "journey" && <UserJourney />}
            {activeView === "permissions" && <ViewPermissions />}
            {activeView === "sqlbuilder" && <SQLBuilder />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
