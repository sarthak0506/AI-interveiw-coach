import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { fetchJson } from "../api/client";
import AppShell from "../components/AppShell";

const emptyQuestion = () => ({
  id: crypto.randomUUID(),
  text: "",
  type: "behavioral",
});

export default function CreateSessionPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    jd_text: "",
    candidate_name: "",
    candidate_email: "",
    tts_provider: "sarvam",
    stt_provider: "whisper",
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdSession, setCreatedSession] = useState(null);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const updateQuestion = (id, field, value) => {
    setQuestions((current) =>
      current.map((question) =>
        question.id === id ? { ...question, [field]: value } : question,
      ),
    );
  };

  const removeQuestion = (id) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    setCreatedSession(null);

    let session;
    try {
      session = await fetchJson("/sessions", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setCreatedSession(session);
    } catch (requestError) {
      setError(`Session creation failed: ${requestError.message}`);
      setSubmitting(false);
      return;
    }

    const questionsToCreate = questions.filter((question) => question.text.trim());
    for (let index = 0; index < questionsToCreate.length; index += 1) {
      const question = questionsToCreate[index];
      try {
        await fetchJson(`/sessions/${session.id}/questions`, {
          method: "POST",
          body: JSON.stringify({
            text: question.text.trim(),
            type: question.type,
            order: index,
          }),
        });
      } catch (requestError) {
        setError(
          `The session was created, but question ${index + 1} of ${questionsToCreate.length} failed: ${requestError.message}. ` +
            "The session is saved; review it from the dashboard before trying again.",
        );
        setSubmitting(false);
        return;
      }
    }

    navigate("/dashboard", {
      replace: true,
      state: { inviteToken: session.invite_token },
    });
  };

  return (
    <AppShell>
      <div className="mb-8">
        <Link to="/dashboard" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to sessions
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Create interview session
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure the interview and add the questions the candidate should receive.
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{error}</p>
          {createdSession && (
            <Link to="/dashboard" className="mt-3 inline-block font-semibold underline">
              Go to dashboard
            </Link>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-panel">
          <h2 className="text-lg font-semibold text-slate-900">Session details</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="candidate_name" className="field-label">Candidate name</label>
              <input
                id="candidate_name"
                name="candidate_name"
                required
                value={form.candidate_name}
                onChange={updateField}
                className="field-input"
                placeholder="Aarav Mehta"
              />
            </div>
            <div>
              <label htmlFor="candidate_email" className="field-label">Candidate email</label>
              <input
                id="candidate_email"
                name="candidate_email"
                type="email"
                required
                value={form.candidate_email}
                onChange={updateField}
                className="field-input"
                placeholder="candidate@example.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="jd_text" className="field-label">Job description</label>
              <textarea
                id="jd_text"
                name="jd_text"
                required
                rows={8}
                value={form.jd_text}
                onChange={updateField}
                className="field-input resize-y"
                placeholder="Paste the complete job description here…"
              />
            </div>
            <div>
              <label htmlFor="tts_provider" className="field-label">Voice provider</label>
              <select
                id="tts_provider"
                name="tts_provider"
                value={form.tts_provider}
                onChange={updateField}
                className="field-input"
              >
                <option value="sarvam">Sarvam</option>
                <option value="supertonic">Supertonic</option>
              </select>
            </div>
            <div>
              <label htmlFor="stt_provider" className="field-label">Transcription provider</label>
              <select
                id="stt_provider"
                name="stt_provider"
                value={form.stt_provider}
                onChange={updateField}
                className="field-input"
              >
                <option value="whisper">Whisper</option>
                <option value="seamless">Seamless</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Questions</h2>
              <p className="mt-1 text-sm text-slate-500">Blank questions are skipped.</p>
            </div>
            <button
              type="button"
              onClick={() => setQuestions((current) => [...current, emptyQuestion()])}
              className="btn-secondary shrink-0"
            >
              Add question
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {questions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                No questions added. You can still create the session.
              </p>
            ) : (
              questions.map((question, index) => (
                <div
                  key={question.id}
                  className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end"
                >
                  <div>
                    <label htmlFor={`question-${question.id}`} className="field-label">
                      Question {index + 1}
                    </label>
                    <input
                      id={`question-${question.id}`}
                      value={question.text}
                      onChange={(event) => updateQuestion(question.id, "text", event.target.value)}
                      className="field-input"
                      placeholder="Tell me about a challenging project…"
                    />
                  </div>
                  <div>
                    <label htmlFor={`type-${question.id}`} className="field-label">Type</label>
                    <select
                      id={`type-${question.id}`}
                      value={question.type}
                      onChange={(event) => updateQuestion(question.id, "type", event.target.value)}
                      className="field-input"
                    >
                      <option value="behavioral">Behavioral</option>
                      <option value="depth_probe">Depth probe</option>
                      <option value="gap_check">Gap check</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQuestion(question.id)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    aria-label={`Remove question ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link to="/dashboard" className="btn-secondary">Cancel</Link>
          <button type="submit" disabled={submitting || Boolean(createdSession)} className="btn-primary">
            {submitting ? "Creating session…" : "Create session"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
