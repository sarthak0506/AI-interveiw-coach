import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { fetchJson } from "../api/client";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountAction, setAccountAction] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const newSessionId = location.state?.sessionId;

  useEffect(() => {
    let active = true;
    fetchJson("/sessions")
      .then((data) => {
        if (active) setSessions(data);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.message === "Could not validate credentials") {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [logout, navigate]);

  const exportData = async () => {
    try {
      setAccountAction(true);
      const data = await fetchJson("/auth/me/export");
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "interview-practice-data.json";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setAccountAction(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm("Delete your account, resumes, interviews, answers, and feedback? This cannot be undone.")) return;
    setAccountAction(true);
    try {
      await fetchJson("/auth/me", { method: "DELETE" });
      logout();
      navigate("/register", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
      setAccountAction(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your practice</h1>
          <p className="mt-1 text-sm text-slate-600">
            Prepare for roles, practice your answers, and follow your progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportData} disabled={accountAction} className="btn-secondary">Export my data</button>
          <button type="button" onClick={deleteAccount} disabled={accountAction} className="btn-secondary text-red-700">Delete account</button>
          <Link to="/sessions/new" className="btn-primary">Start new practice</Link>
        </div>
      </div>

      {newSessionId && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900">Practice plan created</p>
              <p className="mt-1 text-sm text-emerald-800">Your new interview is saved in this account.</p>
            </div>
            <Link to={`/practice/${newSessionId}`} className="btn-secondary shrink-0">Open practice</Link>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading sessions…
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <h2 className="font-semibold text-slate-900">No practice sessions yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload a job description and resume to build your first role-specific practice interview.
          </p>
          <Link to="/sessions/new" className="btn-primary mt-5">
            Create a practice interview
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function SessionCard({ session }) {
  const jdPreview =
    session.jd_text.length > 100
      ? `${session.jd_text.slice(0, 100).trimEnd()}…`
      : session.jd_text;
  const createdAt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(session.created_at));

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-panel">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
          {session.status.replaceAll("_", " ")}
        </span>
        <span className="text-xs text-slate-500">{createdAt}</span>
      </div>
      <p className="min-h-12 text-sm leading-6 text-slate-700">{jdPreview}</p>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Resume match</dt>
          <dd className="mt-1 font-medium text-slate-800">{session.match_score == null ? "Not assessed" : `${session.match_score} / 100`}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Practice status</dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">{session.status.replaceAll("_", " ")}</dd>
        </div>
      </dl>
      <Link to={`/practice/${session.id}`} className="btn-secondary mt-5 w-full">
        Open practice
      </Link>
    </article>
  );
}
