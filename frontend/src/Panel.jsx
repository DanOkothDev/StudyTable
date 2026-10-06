import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import FormattedText from "./FormattedText";

const styles = `
.side { display: flex; flex-direction: column; min-height: 0; background: #fff; border: 1px solid var(--line); border-radius: 24px; overflow: hidden; }
.tabs { display: flex; gap: 4px; padding: 8px; margin: 12px 12px 0; background: var(--paper); border-radius: 14px; }
.tabs button { flex: 1; padding: 8px; border-radius: 10px; color: var(--muted); font-weight: 500; transition: background .25s, color .25s; }
.tabs button[aria-selected="true"] { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(19, 26, 46, .12); }
.chat, .deck { flex: 1; overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 16px; min-height: 0; }
.hint { color: var(--muted); font-size: .92rem; margin: 0; }
.msg { display: grid; gap: 8px; animation: enter .35s var(--ease); }
.msg .q { margin: 0; font-weight: 600; }
.msg .a { margin: 0; padding: 12px 14px; background: var(--paper); border-radius: 4px 16px 16px 16px; }
.msg .a.error { background: #fdecee; }
.skeleton.line { height: 46px; border-radius: 4px 16px 16px 16px; }
.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); }
.composer input { flex: 1; min-width: 0; }
.chip { align-self: flex-start; padding: 9px 14px; border-radius: 999px; background: var(--paper); font-size: .9rem; font-weight: 500; white-space: nowrap; transition: background .2s; }
.chip:hover:not(:disabled) { background: var(--mark); }
.chip:disabled { opacity: .5; }
.send { flex: none; width: 46px; display: grid; place-items: center; border-radius: 14px; background: var(--ink); color: #fff; transition: background .2s, color .2s, opacity .2s; }
.send:hover:not(:disabled) { background: var(--mark); color: var(--ink); }
.send:disabled { opacity: .3; cursor: default; }
.qcard { display: flex; flex-direction: column; gap: 14px; padding: 24px; min-height: 180px; justify-content: center; text-align: left; background: var(--paper); border-radius: 20px; animation: pop .45s var(--ease); }
.qt { font-size: 1.15rem; font-weight: 600; line-height: 1.35; }
.at { padding-top: 14px; border-top: 1.5px solid var(--line); animation: enter .35s var(--ease); }
.tap { color: var(--muted); font-size: .88rem; }
.rate { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; animation: enter .3s var(--ease); }
.rate button { padding: 12px; border-radius: 14px; background: var(--paper); font-weight: 600; transition: background .2s; }
.rate button:hover { background: #e9ecf6; }
.rate .good { background: var(--mark); }
.rate .good:hover { background: #ffd633; }
`;

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
      <style>{styles}</style>
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
                  <FormattedText className={"a" + (m.error ? " error" : "")}>
                    {m.a}
                  </FormattedText>
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
    <FormattedText className="a">{answer}</FormattedText>
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
