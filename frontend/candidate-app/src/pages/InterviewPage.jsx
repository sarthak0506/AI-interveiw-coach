import DailyIframe from "@daily-co/daily-js";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import { fetchJson } from "../api/client";
import PageShell from "../components/PageShell";

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
          Interview overview
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Before you begin
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Review the role and interview questions below. Take your time and begin
          when you feel ready.
        </p>
        </header>

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
              {joining ? "Joining interview…" : "Start Interview"}
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
