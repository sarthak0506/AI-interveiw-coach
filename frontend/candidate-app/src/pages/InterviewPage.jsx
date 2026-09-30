import DailyIframe from "@daily-co/daily-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchJson } from "../api/client";
import PageShell from "../components/PageShell";

function PracticePanel({ token, matchScore, matchReport, questionCount }) {
  const [attempts, setAttempts] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState("");
  const [report, setReport] = useState(null);
  const [scoreChange, setScoreChange] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetchJson(`/interview/${encodeURIComponent(token)}/attempts`)
      .then((data) => {
        if (!active) return;
        setAttempts(data);
        const inProgress = data.find((item) => item.status === "in_progress");
        if (inProgress) {
          setAttempt(inProgress);
          setCurrentQuestion(inProgress.current_question);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => {
      active = false;
    };
  }, [token]);

  const beginPractice = async () => {
    setBusy(true);
    setError("");
    try {
      const nextAttempt = await fetchJson(`/interview/${encodeURIComponent(token)}/attempts`, {
        method: "POST",
      });
      setAttempt(nextAttempt);
      setCurrentQuestion(nextAttempt.current_question);
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
    if (!answer.trim() || !attempt || !currentQuestion) return;
    setBusy(true);
    setError("");
    const submittedAnswer = answer.trim();
    const answeredQuestion = currentQuestion.text;
    try {
      const result = await fetchJson(
        `/interview/${encodeURIComponent(token)}/attempts/${attempt.id}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answer: submittedAnswer }),
        },
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
        const previousScore = attempts.find((item) => item.status === "completed")?.score;
        setScoreChange(previousScore == null ? null : result.report.score - previousScore);
        setReport(result.report);
        setAttempt(null);
        setCurrentQuestion(null);
        setAttempts((current) => [
          { ...result.attempt, answers },
          ...current.filter((item) => item.id !== result.attempt.id),
        ]);
      } else {
        setAttempt({ ...attempt, answers, current_question_index: result.question_index });
        setCurrentQuestion(result.question);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const completedAttempts = attempts.filter((item) => item.status === "completed");

  return (
    <section className="mb-7 border-y border-slate-200 py-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-calm-700">Practice studio</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Learn by answering</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Answer role-specific questions, review coaching notes after each response, then retry and compare your progress.
          </p>
        </div>
        {matchScore != null && (
          <div className="shrink-0 border-l-2 border-calm-600 pl-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resume match</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{matchScore}<span className="text-sm font-medium text-slate-500"> / 100</span></p>
          </div>
        )}
      </div>

      {matchReport && (
        <div className="mt-5 grid gap-4 border-b border-slate-200 pb-5 sm:grid-cols-3">
          <InsightList title="Your strengths" items={matchReport.strengths} />
          <InsightList title="Build these skills" items={matchReport.gaps} />
          <InsightList title="Preparation plan" items={matchReport.study_plan} />
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm font-medium text-red-700">{error}</p>}

      {!attempt && !report && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={beginPractice} disabled={busy} className="btn-primary">
            {busy ? "Opening practice…" : completedAttempts.length ? "Start another practice round" : "Start AI practice interview"}
          </button>
          <p className="text-sm text-slate-500">Your answers are saved with this invite so you can review feedback and compare rounds.</p>
        </div>
      )}

      {attempt && currentQuestion && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-700">
                Round {attempt.attempt_number} · Question {attempt.current_question_index + 1} of {questionCount}
              </p>
              <span className="text-sm tabular-nums text-slate-500">{attempt.answers?.length || 0} answered</span>
            </div>
            <div className="mb-5 h-1.5 overflow-hidden bg-slate-200">
              <div
                className="h-full bg-calm-600 transition-[width]"
                style={{ width: `${((attempt.current_question_index + 1) / questionCount) * 100}%` }}
              />
            </div>
            <ol className="space-y-4">
              {(attempt.answers || []).map((item, index) => (
                <li key={`${attempt.id}-${index}`} className="border-l-2 border-emerald-500 pl-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Question {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item.question}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.answer}</p>
                  <AnswerFeedback feedback={item.feedback} />
                </li>
              ))}
            </ol>
            <form onSubmit={submitAnswer} className="mt-6 border-t border-slate-200 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-calm-700">Question {attempt.current_question_index + 1}</p>
              <h3 className="mt-2 text-lg font-semibold leading-7 text-slate-900">{currentQuestion.text}</h3>
              <label htmlFor="practice-answer" className="sr-only">Your answer</label>
              <textarea
                id="practice-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                rows={5}
                maxLength={12000}
                className="field-input mt-4 resize-y"
                placeholder="Structure your example: situation, task, action, and result…"
                required
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-500">{answer.length} / 12,000 characters</span>
                <button type="submit" disabled={busy || !answer.trim()} className="btn-primary">
                  {busy ? "Reviewing your answer…" : "Submit answer"}
                </button>
              </div>
            </form>
          </div>
          <aside className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <h3 className="text-sm font-semibold text-slate-900">Previous rounds</h3>
            <AttemptHistory attempts={completedAttempts} />
          </aside>
        </div>
      )}

      {report && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-calm-700">Round complete</p>
              <h3 className="mt-1 text-xl font-bold text-slate-900">Your next steps</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{report.summary}</p>
              {scoreChange != null && (
                <p className={`mt-2 text-sm font-semibold ${scoreChange >= 0 ? "text-emerald-700" : "text-amber-700"}`}>
                  {scoreChange >= 0 ? "+" : ""}{scoreChange} points from your previous round
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold tabular-nums text-slate-900">{report.score}</span>
              <span className="text-sm text-slate-500"> / 100</span>
            </div>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <InsightList title="What is working" items={report.strengths} />
            <InsightList title="Practice next" items={report.growth_areas} />
            <InsightList title="Action plan" items={report.next_steps} />
          </div>
          {report.practice_prompt && <p className="mt-5 border-l-2 border-calm-600 pl-3 text-sm font-medium text-slate-700">{report.practice_prompt}</p>}
          <button type="button" onClick={beginPractice} disabled={busy} className="btn-primary mt-5">
            {busy ? "Opening practice…" : "Practice again"}
          </button>
        </div>
      )}

      {!attempt && !report && completedAttempts.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-900">Practice history</h3>
          <AttemptHistory attempts={completedAttempts} />
        </div>
      )}
    </section>
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
      ) : <p className="mt-2 text-sm text-slate-500">No notes yet.</p>}
    </div>
  );
}

function AnswerFeedback({ feedback }) {
  if (!feedback) return null;
  return (
    <div className="mt-3 border-l-2 border-calm-500 bg-slate-50 px-3 py-3">
      <p className="text-sm font-semibold text-slate-800">Answer score: {feedback.score} / 100</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <InsightList title="Strong points" items={feedback.strengths} />
        <InsightList title="Try next time" items={feedback.improvements} />
      </div>
      {feedback.example_answer && <p className="mt-3 text-sm leading-6 text-slate-600"><span className="font-semibold text-slate-700">Example structure: </span>{feedback.example_answer}</p>}
      {feedback.delivery_tip && <p className="mt-2 text-sm text-slate-600"><span className="font-semibold text-slate-700">Delivery tip: </span>{feedback.delivery_tip}</p>}
    </div>
  );
}

function AttemptHistory({ attempts }) {
  if (!attempts.length) return <p className="mt-2 text-sm text-slate-500">Your completed rounds will appear here.</p>;
  return (
    <ol className="mt-3 space-y-3">
      {attempts.map((item) => (
        <li key={item.id} className="border-b border-slate-200 pb-3 last:border-0">
          <details>
            <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">Round {item.attempt_number}</span>
              <span className="font-bold tabular-nums text-slate-900">{item.score} / 100</span>
            </summary>
            {item.report?.summary && <p className="mt-2 text-sm leading-5 text-slate-600">{item.report.summary}</p>}
            <div className="mt-3 space-y-4">
              {(item.answers || []).map((answer, index) => (
                <div key={`${item.id}-${index}`}>
                  <p className="text-xs font-semibold text-slate-700">Q{index + 1}: {answer.question}</p>
                  <AnswerFeedback feedback={answer.feedback} />
                </div>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}

export default function InterviewPage() {
  const { token } = useParams();
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);
  const [callVisible, setCallVisible] = useState(false);
  const callContainerRef = useRef(null);
  const callFrameRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetchJson(`/interview/${encodeURIComponent(token)}`)
      .then((data) => {
        if (active) setInterview(data);
      })
      .catch((requestError) => {
        if (!active) return;
        if (requestError.status === 404) {
          setError(
            "This interview link is invalid or has expired. Please contact the recruiter who sent you this link.",
          );
        } else {
          setError(
            "We could not load your interview right now. Please try again in a few moments.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(
    () => () => {
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    },
    [],
  );

  const orderedQuestions = useMemo(
    () => [...(interview?.questions || [])].sort((first, second) => first.order - second.order),
    [interview],
  );

  const closeCall = () => {
    const frame = callFrameRef.current;
    callFrameRef.current = null;
    if (frame) {
      frame.destroy();
    }
    setCallVisible(false);
    setJoining(false);
  };

  const startInterview = async () => {
    setJoinError("");
    setJoining(true);
    setCallVisible(true);

    try {
      const credentials = await fetchJson(
        `/interview/${encodeURIComponent(token)}/join`,
        { method: "POST" },
      );

      const frame = DailyIframe.createFrame(callContainerRef.current, {
        showLeaveButton: true,
        iframeStyle: {
          width: "100%",
          height: "100%",
          border: "0",
          borderRadius: "16px",
        },
      });
      callFrameRef.current = frame;

      const dailyIframe = callContainerRef.current.querySelector("iframe");
      dailyIframe?.setAttribute(
        "allow",
        "camera; microphone; display-capture; autoplay",
      );

      frame.on("left-meeting", closeCall);
      frame.on("error", (event) => {
        console.error("Daily call error event:", event);
        setJoinError(
          event?.errorMsg ||
            "The video call could not start. Check your camera and microphone permissions and try again.",
        );
      });
      frame.on("camera-error", (event) => {
        console.error("Daily camera/microphone permission error:", event);
        setJoinError(
          "Camera or microphone access failed. Check this site's browser permissions and try again.",
        );
      });

      await frame.join({
        url: credentials.room_url,
        token: credentials.token,
      });
      setJoining(false);
    } catch (requestError) {
      console.error("Failed to join Daily interview room:", requestError);
      const frame = callFrameRef.current;
      callFrameRef.current = null;
      if (frame) {
        frame.destroy();
      }
      setCallVisible(false);
      setJoining(false);
      setJoinError(
        requestError.message ||
          "The video call could not start. Check your camera and microphone permissions and try again.",
      );
    }
  };

  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-72 flex-col items-center justify-center text-center">
          <div
            className="h-9 w-9 animate-spin rounded-full border-4 border-calm-100 border-t-calm-600"
            aria-hidden="true"
          />
          <p className="mt-4 text-sm font-medium text-slate-600">Loading your interview…</p>
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <section className="mx-auto max-w-xl py-14 text-center sm:py-20">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl text-amber-700">
            !
          </div>
          <h1 className="text-2xl font-bold text-slate-900">We couldn’t open this interview</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{error}</p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={callVisible ? "hidden" : "block"}>
        <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-calm-700">
          Interview preparation
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Prepare, practice, improve
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Use the tailored practice interview to build stronger answers and track your progress. Your feedback is for learning, not a hiring decision.
        </p>
        </header>

        <PracticePanel
          token={token}
          matchScore={interview.match_score}
          matchReport={interview.match_report}
          questionCount={orderedQuestions.length}
        />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
        <h2 className="text-lg font-bold text-slate-900">About the role</h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700 sm:text-base">
          {interview.jd_text}
        </p>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">Interview questions</h2>
          <span className="text-sm text-slate-500">
            {orderedQuestions.length} {orderedQuestions.length === 1 ? "question" : "questions"}
          </span>
        </div>

        {orderedQuestions.length > 0 ? (
          <ol className="mt-5 space-y-4">
            {orderedQuestions.map((question, index) => (
              <li key={question.id} className="flex gap-4 border-t border-slate-100 pt-4 first:border-0 first:pt-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-calm-50 text-sm font-bold text-calm-700">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-slate-700 sm:text-base">
                  {question.text}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-5 text-sm text-slate-600">
            No questions have been added to this interview yet.
          </p>
        )}
        </section>

        <section className="mt-8 text-center">
        {interview.status === "draft" ? (
          <>
            <button
              type="button"
              onClick={startInterview}
              disabled={joining}
              className="inline-flex w-full items-center justify-center rounded-xl bg-calm-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-calm-700 sm:w-auto sm:min-w-56"
            >
              {joining ? "Joining video room…" : "Open optional video room"}
            </button>
            {joinError && (
              <p role="alert" className="mt-4 text-sm font-medium text-red-700">
                {joinError}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-5 py-4 font-medium text-slate-700">
            This interview has already been completed.
          </div>
        )}
        </section>
      </div>

      <section className={callVisible ? "block" : "hidden"}>
        <div className="mb-4">
          <p className="text-sm font-semibold uppercase tracking-wider text-calm-700">
            Live interview
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Your video room
          </h1>
          {joining && (
            <p className="mt-2 text-sm text-slate-600">
              Connecting to the room and requesting camera and microphone access…
            </p>
          )}
          {joinError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {joinError}
            </p>
          )}
        </div>
        <div
          ref={callContainerRef}
          className="h-[70vh] min-h-[480px] overflow-hidden rounded-2xl bg-slate-950 shadow-panel"
        />
      </section>
    </PageShell>
  );
}
