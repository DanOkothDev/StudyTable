import { useEffect, useState } from "react";
import { api } from "./api";
import FormattedText from "./FormattedText";

const styles = `
.recap { max-width: 760px; padding: 24px; border: 1px solid var(--line); border-radius: 22px; background: #fff; }
.recap h2 { margin: 0 0 8px; font-size: 1.18rem; font-weight: 600; }
.recap-source { margin: 0 0 22px; color: var(--muted); font-size: .9rem; }
.recap-content { color: #303954; }
.recap-retry { margin-top: 8px; }
`;

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
      <style>{styles}</style>
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
