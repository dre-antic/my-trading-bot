import { NavLink, Route, Routes } from "react-router-dom";
import { CreatePage } from "./pages/Create";
import { JobsPage } from "./pages/Jobs";
import { JobPage } from "./pages/Job";
import { SettingsPage } from "./pages/Settings";
import { LicensesPage } from "./pages/Licenses";

export function App() {
  return (
    <div className="app">
      <aside className="rail">
        <h2 className="brand">
          AE<span>THER</span>
        </h2>
        <div className="tag">Video Director · topic in, film out</div>
        <nav className="nav">
          <NavLink to="/" end>
            Create video
          </NavLink>
          <NavLink to="/jobs">Jobs</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/licenses">Licenses</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<CreatePage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/jobs/:id" element={<JobPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/licenses" element={<LicensesPage />} />
        </Routes>
      </main>
    </div>
  );
}
