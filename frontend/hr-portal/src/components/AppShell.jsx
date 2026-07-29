import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function AppShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const navClass = ({ isActive }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-brand-50 text-brand-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="text-base font-bold text-slate-900">
              AI Interview Coach
              <span className="ml-2 text-xs font-medium text-slate-500">HR Portal</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink to="/dashboard" className={navClass}>
                Sessions
              </NavLink>
              <NavLink to="/sessions/new" className={navClass}>
                Create session
              </NavLink>
            </nav>
          </div>
          <button type="button" onClick={handleLogout} className="btn-secondary py-2">
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
