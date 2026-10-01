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
    resume_text: "",
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [createdSession, setCreatedSession] = useState(null);
  const [files, setFiles] = useState({ job_description: null, resume: null });
  const [analysis, setAnalysis] = useState(null);

  const updateField = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (event.target.name === "jd_text") setAnalysis(null);
  };

  const analyzeDocuments = async () => {
    if (!files.job_description || !files.resume) {
      setError("Choose both a job description and a resume before analyzing.");
      return;
    }
    setError("");
    setAnalyzing(true);
    const body = new FormData();
    body.append("job_description", files.job_description);
    body.append("resume", files.resume);

    try {
      const result = await fetchJson("/sessions/analyze", { method: "POST", body });
      setForm((current) => ({
        ...current,
        jd_text: result.jd_text,
        resume_text: result.resume_text,
      }));
      setAnalysis(result.assessment);
      setQuestions(result.assessment.questions.map((question) => ({
        ...question,
        id: crypto.randomUUID(),
      })));
    } catch (requestError) {
      setError(`Document analysis failed: ${requestError.message}`);
    } finally {
      setAnalyzing(false);
    }
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
        body: JSON.stringify({
          ...form,
          assessment: analysis,
        }),
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

    navigate(`/practice/${session.id}`, {
      replace: true,
      state: { sessionId: session.id },
    });
  };

  return (
    <AppShell>
      <div className="mb-8">
        <Link to="/dashboard" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to my practice
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
          Create practice interview
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a role and resume, review the AI match, then practice the questions it drafts.
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
          <h2 className="text-lg font-semibold text-slate-900">Role and resume</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="job_description_file" className="field-label">Job description file</label>
              <input
                id="job_description_file"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(event) => {
                  setFiles((current) => ({ ...current, job_description: event.target.files?.[0] || null }));
                  setAnalysis(null);
                }}
                className="field-input file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold"
              />
            </div>
            <div>
              <label htmlFor="resume_file" className="field-label">Resume file</label>
              <input
                id="resume_file"
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={(event) => {
                  setFiles((current) => ({ ...current, resume: event.target.files?.[0] || null }));
                  setAnalysis(null);
                }}
                className="field-input file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-semibold"
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={analyzeDocuments}
                disabled={analyzing || !files.job_description || !files.resume}
                className="btn-primary"
              >
                {analyzing ? "Reviewing documents…" : "Analyze and draft questions"}
              </button>
              <p className="text-sm text-slate-500">PDF, DOCX, or TXT; 8 MB max per file.</p>
            </div>
            {analysis && (
              <div className="sm:col-span-2 border-y border-slate-200 py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Resume and role match</p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{analysis.summary}</p>
                  </div>
                  <div className="min-w-24 text-right">
                    <span className="text-3xl font-bold tabular-nums text-slate-900">{analysis.score}</span>
                    <span className="text-sm text-slate-500"> / 100</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-5 md:grid-cols-3">
                  <InsightList title="Relevant strengths" items={analysis.strengths} />
                  <InsightList title="Skills to build" items={analysis.gaps} />
                  <InsightList title="Study plan" items={analysis.study_plan} />
                </div>
              </div>
            )}
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
            {submitting ? "Saving practice…" : "Create practice interview"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}

function InsightList({ title, items }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {items?.length ? (
        <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-600">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No clear evidence found in these documents.</p>
      )}
    </div>
  );
}
