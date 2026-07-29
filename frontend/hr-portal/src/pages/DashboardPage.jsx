import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { fetchJson } from "../api/client";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";

const CANDIDATE_APP_URL = "http://localhost:3000/interview";

function inviteUrl(token) {
  return `${CANDIDATE_APP_URL}/${token}`;
}

export default function DashboardPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedToken, setCopiedToken] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const newInviteToken = location.state?.inviteToken;

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

  const copyInvite = async (token) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(""), 1800);
    } catch {
      setError("Could not copy the invite link. Please copy it manually.");
    }
  };

  return (
    <AppShell>
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Interview sessions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Create interviews and share candidate invite links.
          </p>
        </div>
        <Link to="/sessions/new" className="btn-primary">
          Create New Session
        </Link>
      </div>

      {newInviteToken && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="font-semibold text-emerald-900">Session created successfully</p>
              <p className="mt-1 truncate text-sm text-emerald-800">
                {inviteUrl(newInviteToken)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => copyInvite(newInviteToken)}
              className="btn-secondary shrink-0"
            >
              {copiedToken === newInviteToken ? "Copied!" : "Copy invite link"}
            </button>
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
          <h2 className="font-semibold text-slate-900">No interview sessions yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Create your first session to generate a candidate invite.
          </p>
          <Link to="/sessions/new" className="btn-primary mt-5">
            Create a session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              copied={copiedToken === session.invite_token}
              onCopy={() => copyInvite(session.invite_token)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function SessionCard({ session, copied, onCopy }) {
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
          <dt className="text-xs uppercase tracking-wide text-slate-500">Voice</dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">{session.tts_provider}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">Transcription</dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">{session.stt_provider}</dd>
        </div>
      </dl>
      <button type="button" onClick={onCopy} className="btn-secondary mt-5 w-full">
        {copied ? "Invite link copied!" : "Copy invite link"}
      </button>
    </article>
  );
}
