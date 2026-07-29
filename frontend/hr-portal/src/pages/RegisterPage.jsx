import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { fetchJson } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Alert, AuthLayout } from "./LoginPage";

export default function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await fetchJson("/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      navigate("/login", { replace: true, state: { registered: true } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create HR account" subtitle="Set up access to the interview portal.">
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="full_name" className="field-label">Full name</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            autoComplete="name"
            required
            value={form.full_name}
            onChange={updateField}
            className="field-input"
            placeholder="Priya Sharma"
          />
        </div>
        <div>
          <label htmlFor="email" className="field-label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={updateField}
            className="field-input"
            placeholder="hr@company.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="field-label">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={form.password}
            onChange={updateField}
            className="field-input"
          />
          <p className="mt-1.5 text-xs text-slate-500">Use at least 8 characters.</p>
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Already registered?{" "}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
