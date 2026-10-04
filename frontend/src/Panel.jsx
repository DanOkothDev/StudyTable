import { useEffect, useRef, useState } from "react";
import { api } from "./api";

export default function Panel({ course, doc, page, flush, quizSignal }) {
  const [tab, setTab] = useState("ask");
  const [chat, setChat] = useState([]); // {q, a, page, quiz?, error?}
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    end.current && end.current.scrollIntoView({ behavior: "smooth" });
  }, [chat, busy]);

  async function run(item, call) {
    setTab("ask");
    setBusy(true);
    setChat((c) => [...c, item]);
    try {
      const r = await call();
      setChat((c) => [...c.slice(0, -1), { ...item, ...r }]);
    } catch (e) {
      setChat((c) => [
        ...c.slice(0, -1),
        { ...item, a: e.message, error: true },
      ]);
    }
    setBusy(false);
  }
  const ask = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    const history = chat
      .filter((m) => !m.quiz && !m.error && m.a !== undefined)
      .slice(-6)
      .map((m) => ({ q: m.q, a: m.a, page: m.page }));
    run({ q, page }, async () => ({
      a: (await api.ask(doc.id, page, q, history)).answer,
    }));
  };
  const quiz = () =>
    !busy &&
    run({ q: "Quick question", quiz: true, page }, async () => {
      const r = await api.quick(course.id);
      return { q: r.question, a: r.answer, hidden: true, page: r.page_number };
    });
  useEffect(() => {
    if (quizSignal) quiz();
  }, [quizSignal]);

  return (
    <aside className="side">
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "ask"}
          onClick={() => setTab("ask")}
        >
          Ask
        </button>
        <button
          role="tab"
          aria-selected={tab === "cards"}
          onClick={() => setTab("cards")}
        >
          Cards
        </button>
      </div>
      {tab === "ask" ? (
        <>
          <div className="chat">
            {chat.length === 0 && (
              <p className="hint">
                Ask anything about page {page}, or follow up on an earlier
                answer.
              </p>
            )}
            {chat.map((m, i) => (
              <div className="msg" key={i}>
                <p className="q">{m.q}</p>
                {m.a === undefined ? (
                  <div className="skeleton line" />
                ) : m.hidden ? (
                  <Reveal answer={m.a} />
                ) : (
                  <p className={"a" + (m.error ? " error" : "")}>{m.a}</p>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={ask}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder={`Ask about page ${page}`}
            />
            <button
              className="send"
              disabled={busy || !text.trim()}
              aria-label="Send"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
              </svg>
            </button>
          </form>
        </>
      ) : (
        <Cards course={course} flush={flush} onQuiz={quiz} />
      )}
    </aside>
  );
}

function Reveal({ answer }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <p className="a">{answer}</p>
  ) : (
    <button className="chip" onClick={() => setOpen(true)}>
      Show answer
    </button>
  );
}

function Cards({ course, flush, onQuiz }) {
  const [pending, setPending] = useState(null);
  const [due, setDue] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    await flush();
    const [p, d] = await Promise.all([
      api.pending(course.id),
      api.due(course.id),
    ]);
    setPending(p.count);
    setDue(d);
    setFlipped(false);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function make() {
    setBusy(true);
    setError("");
    try {
      await api.generate(course.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }
  async function rate(correct) {
    const card = due.cards[0];
    setDue({ total_due: due.total_due - 1, cards: due.cards.slice(1) });
    setFlipped(false);
    api.review(card.id, correct).catch(() => {});
  }

  if (due === null && !error)
    return (
      <div className="deck">
        <div className="skeleton line" />
      </div>
    );
  const card = due && due.cards[0];
  return (
    <div className="deck">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {card ? (
        <>
          <button
            className={"qcard" + (flipped ? " flipped" : "")}
            onClick={() => setFlipped(true)}
            key={card.id}
          >
            <span className="qt">{card.question}</span>
            {flipped ? (
              <span className="at">{card.answer}</span>
            ) : (
              <span className="tap">Tap to see the answer</span>
            )}
          </button>
          {flipped && (
            <div className="rate">
              <button onClick={() => rate(false)}>Again</button>
              <button className="good" onClick={() => rate(true)}>
                Got it
              </button>
            </div>
          )}
          <p className="hint">{due.total_due} to go</p>
        </>
      ) : (
        due && (
          <p className="hint">
            {pending > 0
              ? "New pages are ready for cards."
              : "All caught up. Read a page for 10 seconds and it will show up here."}
          </p>
        )
      )}
      {pending > 0 && (
        <button className="primary" onClick={make} disabled={busy}>
          {busy
            ? "Writing cards…"
            : `Make cards from ${pending} ${pending === 1 ? "page" : "pages"}`}
        </button>
      )}
      <button className="chip" onClick={onQuiz}>
        Quiz me on what I've studied
      </button>
    </div>
  );
}
