import { useEffect, useState } from "react";
import { api } from "./api";
import FormattedText from "./FormattedText";

export default function Recap({ event, onBack }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError("");
    api.classRecap(event.id)
      .then((data) => active && setResult(data))
      .catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [event.id, attempt]);

  return (
    <>
      <button className="back" onClick={onBack}>Back home</button>
      <h1>{event.course_name}</h1>
      <p className="sub">Before class{event.start_time ? ` · ${event.start_time}` : ''} · {event.title}</p>
      {error ? (
        <div>
          <p className="error" role="alert">{error}</p>
          <button className="primary recap-retry" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </div>
      ) : result ? (
        <article className="recap">
          <h2>Get ready for class</h2>
          <p className="recap-source">
            {result.source === "course_documents"
              ? "Based on your uploaded course documents"
              : "Based on general knowledge — no readable course documents were found"}
          </p>
          <FormattedText className="recap-content">{result.recap}</FormattedText>
        </article>
      ) : (
        <p role="status">Preparing your recap…</p>
      )}
    </>
  );
}
