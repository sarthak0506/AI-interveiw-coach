import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { fetchBlob, fetchJson } from "../api/client";
import AppShell from "../components/AppShell";

export default function PracticePage() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState(null);
  const [scoreChange, setScoreChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson(`/interview/sessions/${sessionId}`),
      fetchJson(`/interview/sessions/${sessionId}/attempts`),
    ])
      .then(([sessionData, attemptData]) => {
        if (!active) return;
        setSession(sessionData);
        setAttempts(attemptData);
        const unfinished = attemptData.find((item) => item.status === "in_progress");
        if (unfinished) {
          setAttempt(unfinished);
          setQuestion(unfinished.current_question);
        } else {
          setReport(attemptData.find((item) => item.status === "completed")?.report || null);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    audioRef.current?.pause();
  }, []);

  const playQuestion = async () => {
    setBusy(true);
    setError("");
    setVoiceMessage("");
    try {
      const audioBlob = await fetchBlob(`/interview/sessions/${sessionId}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question?.text || "" }),
      });
      audioRef.current?.pause();
      const player = new Audio(URL.createObjectURL(audioBlob));
      audioRef.current = player;
      player.addEventListener("ended", () => URL.revokeObjectURL(player.src), { once: true });
      await player.play();
    } catch (requestError) {
      setError(`${requestError.message} You can read the question on screen.`);
    } finally {
      setBusy(false);
    }
  };

  const recordAnswer = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording is not supported in this browser. You can type your answer instead.");
      return;
    }

    setError("");
    setVoiceMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      const chunks = [];
      recorderRef.current = recorder;
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      recorder.addEventListener("error", () => {
        setError("The recording failed. You can type your answer instead.");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
      });
      recorder.addEventListener("stop", async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        const audioBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (!audioBlob.size) {
          setError("No audio was recorded. Try again or type your answer.");
          return;
        }
        if (audioBlob.size > 15 * 1024 * 1024) {
          setError("That recording is over 15 MB. Record a shorter answer or type it instead.");
          return;
        }

        const extension = audioBlob.type.includes("mp4") ? "mp4"
          : audioBlob.type.includes("ogg") ? "ogg"
            : audioBlob.type.includes("mpeg") ? "mp3" : "webm";
        const body = new FormData();
        body.append("audio", audioBlob, `answer.${extension}`);
        setBusy(true);
        setVoiceMessage("Transcribing your recording…");
        try {
          const result = await fetchJson(`/interview/sessions/${sessionId}/transcribe`, {
            method: "POST",
            body,
          });
          setAnswer((current) => current ? `${current} ${result.transcription}` : result.transcription);
          setVoiceMessage("Transcript ready. Review or edit it before submitting.");
        } catch (requestError) {
          setVoiceMessage("");
          setError(`${requestError.message} You can type your answer instead.`);
        } finally {
          setBusy(false);
        }
      }, { once: true });
      recorder.start();
      setRecording(true);
      setVoiceMessage("Recording. Stop when you have finished your answer.");
    } catch {
      setError("Microphone access was denied or unavailable. Check browser permissions or type your answer.");
    }
  };

  const startPractice = async () => {
    setBusy(true);
    setError("");
    try {
      const nextAttempt = await fetchJson(`/interview/sessions/${sessionId}/attempts`, {
        method: "POST",
      });
      setAttempt(nextAttempt);
      setQuestion(nextAttempt.current_question);
      setAnswer("");
      setReport(null);
      setScoreChange(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async (event) => {
    event.preventDefault();
    if (!attempt || !question || !answer.trim()) return;
    setBusy(true);
    setError("");
    const submittedAnswer = answer.trim();
    const answeredQuestion = question.text;
    try {
      const result = await fetchJson(
        `/interview/sessions/${sessionId}/attempts/${attempt.id}/answers`,
        { method: "POST", body: JSON.stringify({ answer: submittedAnswer }) },
      );
      const answers = [
        ...(attempt.answers || []),
        {
          question: answeredQuestion,
          answer: submittedAnswer,
          score: result.evaluation.score,
          feedback: result.evaluation,
        },
      ];
      setAnswer("");
      if (result.completed) {
        const oldScore = attempts.find((item) => item.status === "completed")?.score;
        setScoreChange(oldScore == null ? null : result.report.score - oldScore);
        setReport(result.report);
        setAttempts((current) => [
          { ...result.attempt, answers },
          ...current.filter((item) => item.id !== result.attempt.id),
        ]);
        setAttempt(null);
        setQuestion(null);
      } else {
        setAttempt({ ...attempt, answers, current_question_index: result.question_index });
        setQuestion(result.question);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <AppShell><p className="py-16 text-center text-sm text-slate-600">Loading your practice…</p></AppShell>;
  }

  if (!session) {
    return (
      <AppShell>
        <section className="py-16 text-center">
          <h1 className="text-xl font-bold text-slate-900">Practice session unavailable</h1>
          <p role="alert" className="mt-3 text-sm text-red-700">{error || "This practice session could not be found."}</p>
          <Link to="/dashboard" className="btn-secondary mt-5">Back to my practice</Link>
        </section>
      </AppShell>
    );
  }

  const completedAttempts = attempts.filter((item) => item.status === "completed");

  return (
    <AppShell>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/dashboard" className="text-sm font-medium text-brand-700 hover:underline">← My practice</Link>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">Interview practice</h1>
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{session.jd_text}</p>
        </div>
        {session.match_score != null && (
          <div className="border-l-2 border-brand-600 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resume match</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{session.match_score}<span className="text-sm font-medium text-slate-500"> / 100</span></p>
          </div>
        )}
      </div>

      {session.match_report && <div className="mb-7 grid gap-5 border-y border-slate-200 py-5 sm:grid-cols-3">
        <InsightList title="Relevant strengths" items={session.match_report.strengths} />
        <InsightList title="Skills to build" items={session.match_report.gaps} />
        <InsightList title="Study plan" items={session.match_report.study_plan} />
      </div>}

      {error && <p role="alert" className="mb-5 text-sm font-medium text-red-700">{error}</p>}

      {attempt && question ? (
        <section className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <p className="text-sm font-semibold text-slate-600">Round {attempt.attempt_number} · Question {attempt.current_question_index + 1} of {session.questions.length}</p>
            <div className="mt-3 h-1.5 bg-slate-200"><div className="h-full bg-brand-600" style={{ width: `${((attempt.current_question_index + 1) / session.questions.length) * 100}%` }} /></div>
            <ol className="mt-5 space-y-5">
              {(attempt.answers || []).map((item, index) => <li key={`${attempt.id}-${index}`} className="border-l-2 border-emerald-500 pl-4">
                <p className="text-xs font-semibold uppercase text-slate-500">Question {index + 1}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{item.question}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.answer}</p>
                <AnswerFeedback feedback={item.feedback} />
              </li>)}
            </ol>
            <form onSubmit={submitAnswer} className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Question {attempt.current_question_index + 1}</p>
              <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-900">{question.text}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={playQuestion} disabled={busy || recording} className="btn-secondary">
                  {busy && !recording ? "Preparing audio…" : "Listen to question"}
                </button>
                <button type="button" onClick={recordAnswer} disabled={busy} className={recording ? "btn-primary" : "btn-secondary"}>
                  {recording ? "Stop and transcribe" : "Record answer"}
                </button>
              </div>
              {voiceMessage && <p aria-live="polite" className="mt-2 text-sm text-slate-600">{voiceMessage}</p>}
              <label htmlFor="practice-answer" className="sr-only">Your answer</label>
              <textarea id="practice-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} maxLength={12000} required className="field-input mt-4 resize-y" placeholder="Structure your example: situation, task, action, and result…" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{answer.length} / 12,000 characters</span>
                <button type="submit" disabled={busy || !answer.trim()} className="btn-primary">{busy ? "Reviewing answer…" : "Submit answer"}</button>
              </div>
            </form>
          </div>
          <aside className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <h2 className="text-sm font-semibold text-slate-900">Previous rounds</h2>
            <AttemptHistory attempts={completedAttempts} />
          </aside>
        </section>
      ) : report ? (
        <section className="border-t border-slate-200 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Round complete</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Your next steps</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{report.summary}</p>
              {scoreChange != null && <p className={`mt-2 text-sm font-semibold ${scoreChange >= 0 ? "text-emerald-700" : "text-amber-700"}`}>{scoreChange >= 0 ? "+" : ""}{scoreChange} points from your previous round</p>}
            </div>
            <p className="text-3xl font-bold tabular-nums text-slate-900">{report.score}<span className="text-sm font-medium text-slate-500"> / 100</span></p>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <InsightList title="What is working" items={report.strengths} />
            <InsightList title="Practice next" items={report.growth_areas} />
            <InsightList title="Action plan" items={report.next_steps} />
          </div>
          <RubricFeedback rubric={report.rubric} />
          <button type="button" onClick={startPractice} disabled={busy} className="btn-primary mt-5">{busy ? "Opening practice…" : "Practice again"}</button>
          <AttemptHistory attempts={completedAttempts} />
        </section>
      ) : (
        <section className="border-y border-slate-200 py-6">
          <h2 className="text-lg font-semibold text-slate-900">Your practice interview</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{session.questions.length} questions tailored to the role and your resume. Each answer receives specific feedback and a score to help you improve.</p>
          <button type="button" onClick={startPractice} disabled={busy || !session.questions.length} className="btn-primary mt-5">{busy ? "Opening practice…" : "Start practice interview"}</button>
          {session.questions.length === 0 && <p className="mt-3 text-sm text-amber-700">This session has no questions yet.</p>}
          <AttemptHistory attempts={completedAttempts} />
        </section>
      )}
    </AppShell>
  );
}

function InsightList({ title, items }) {
  return <div><h3 className="text-sm font-semibold text-slate-800">{title}</h3>{items?.length ? <ul className="mt-2 space-y-1.5 text-sm leading-5 text-slate-600">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No notes yet.</p>}</div>;
}

function AnswerFeedback({ feedback }) {
  if (!feedback) return null;
  return <div className="mt-3 border-l-2 border-brand-500 bg-slate-50 px-3 py-3">
    <p className="text-sm font-semibold text-slate-800">Practice score: {feedback.score} / 100</p>
    <RubricFeedback rubric={feedback.rubric} />
    <div className="mt-2 grid gap-3 sm:grid-cols-2"><InsightList title="Strong points" items={feedback.strengths} /><InsightList title="Try next time" items={feedback.improvements} /></div>
    {feedback.example_answer && <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-700">Example structure: </span>{feedback.example_answer}</p>}
    {feedback.delivery_tip && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-700">Tip: </span>{feedback.delivery_tip}</p>}
  </div>;
}

function RubricFeedback({ rubric }) {
  const dimensions = [
    ["relevance", "Role relevance"],
    ["evidence", "Specific evidence"],
    ["structure", "Answer structure"],
    ["clarity", "Clarity"],
  ];
  if (!rubric || !dimensions.some(([key]) => rubric[key])) {
    return <p className="mt-3 text-xs text-slate-500">Rubric breakdown is not available for this round.</p>;
  }
  return <div className="mt-4" aria-label="Answer scoring rubric">
    <p className="mb-3 text-xs text-slate-500">Each dimension is scored from 0 to 10 and contributes equally to your practice score.</p>
    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
    {dimensions.map(([key, label]) => {
      const item = rubric[key];
      if (!item) return null;
      const score = Math.max(0, Math.min(10, Number(item.score) || 0));
      return <div key={key}>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">{label}</span>
          <span className="shrink-0 tabular-nums text-slate-600">{score} / 10</span>
        </div>
        <div className="mt-1.5 h-1.5 bg-slate-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={score}>
          <div className="h-full bg-brand-600" style={{ width: `${score * 10}%` }} />
        </div>
        {item.feedback && <p className="mt-1.5 text-xs leading-5 text-slate-600">{item.feedback}</p>}
      </div>;
    })}
    </div>
  </div>;
}

function AttemptHistory({ attempts }) {
  if (!attempts.length) return null;
  return <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="text-sm font-semibold text-slate-900">Previous rounds</h3><ol className="mt-3 space-y-3">{attempts.map((item) => <li key={item.id} className="border-b border-slate-200 pb-3 last:border-0"><details><summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 text-sm"><span className="font-medium text-slate-700">Round {item.attempt_number}</span><span className="font-bold tabular-nums text-slate-900">{item.score} / 100</span></summary>{item.report?.summary && <p className="mt-2 text-sm leading-5 text-slate-600">{item.report.summary}</p>}<RubricFeedback rubric={item.report?.rubric} /><div className="mt-3 space-y-4">{(item.answers || []).map((saved, index) => <div key={`${item.id}-${index}`}><p className="text-xs font-semibold text-slate-700">Q{index + 1}: {saved.question}</p><AnswerFeedback feedback={saved.feedback} /></div>)}</div></details></li>)}</ol></div>;
}
