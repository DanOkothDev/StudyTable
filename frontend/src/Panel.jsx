import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export default function Panel({ course, doc, page, flush, quizSignal }) {
  const [tab, setTab] = useState('ask');
  const [chat, setChat] = useState([]); // {q, a, page, quiz?, error?}
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => { end.current && end.current.scrollIntoView({ behavior: 'smooth' }); }, [chat, busy]);

  async function run(item, call) {
    setTab('ask'); setBusy(true);
    setChat((c) => [...c, item]);
    try {
      const r = await call();
      setChat((c) => [...c.slice(0, -1), { ...item, ...r }]);
    } catch (e) {
      setChat((c) => [...c.slice(0, -1), { ...item, a: e.message, error: true }]);
    }
    setBusy(false);
  }
  const ask = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText('');
    run({ q, page }, async () => ({ a: (await api.ask(doc.id, page, q)).answer }));
  };
  const quiz = () => !busy && run({ q: 'Quick question', quiz: true, page }, async () => {
    const r = await api.quick(course.id);
    return { q: r.question, a: r.answer, hidden: true, page: r.page_number };
  });
  useEffect(() => { if (quizSignal) quiz(); }, [quizSignal]);

  return (
    <aside className="side">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}>Ask</button>
        <button role="tab" aria-selected={tab === 'cards'} onClick={() => setTab('cards')}>Cards</button>
      </div>
      {tab === 'ask' ? (
        <>
          <div className="chat">
            {chat.length === 0 && <p className="hint">Ask anything about page {page}, or let me quiz you.</p>}
            {chat.map((m, i) => (
              <div className="msg" key={i}>
                <p className="q">{m.q}</p>
                {m.a === undefined ? <div className="skeleton line" />
                  : m.hidden ? <Reveal answer={m.a} />
                  : <p className={'a' + (m.error ? ' error' : '')}>{m.a}</p>}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={ask}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Ask about page ${page}`} />
            <button type="button" className="chip" onClick={quiz} disabled={busy}>Quiz me</button>
          </form>
        </>
      ) : <Cards course={course} flush={flush} />}
    </aside>
  );
}

function Reveal({ answer }) {
  const [open, setOpen] = useState(false);
  return open ? <p className="a">{answer}</p> : <button className="chip" onClick={() => setOpen(true)}>Show answer</button>;
}

function Cards({ course, flush }) {
  const [pending, setPending] = useState(null);
  const [due, setDue] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    await flush();
    const [p, d] = await Promise.all([api.pending(course.id), api.due(course.id)]);
    setPending(p.count); setDue(d); setFlipped(false);
  };
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function make() {
    setBusy(true); setError('');
    try { await api.generate(course.id); await load(); } catch (e) { setError(e.message); }
    setBusy(false);
  }
  async function rate(correct) {
    const card = due.cards[0];
    setDue({ total_due: due.total_due - 1, cards: due.cards.slice(1) });
    setFlipped(false);
    api.review(card.id, correct).catch(() => {});
  }

  if (due === null && !error) return <div className="deck"><div className="skeleton line" /></div>;
  const card = due && due.cards[0];
  return (
    <div className="deck">
      {error && <p className="error" role="alert">{error}</p>}
      {card ? (
        <>
          <button className={'qcard' + (flipped ? ' flipped' : '')} onClick={() => setFlipped(true)} key={card.id}>
            <span className="qt">{card.question}</span>
            {flipped ? <span className="at">{card.answer}</span> : <span className="tap">Tap to see the answer</span>}
          </button>
          {flipped && (
            <div className="rate">
              <button onClick={() => rate(false)}>Again</button>
              <button className="good" onClick={() => rate(true)}>Got it</button>
            </div>
          )}
          <p className="hint">{due.total_due} to go</p>
        </>
      ) : due && <p className="hint">{pending > 0 ? 'New pages are ready for cards.' : 'All caught up. Read a page for 10 seconds and it will show up here.'}</p>}
      {pending > 0 && (
        <button className="primary" onClick={make} disabled={busy}>
          {busy ? 'Writing cards…' : `Make cards from ${pending} ${pending === 1 ? 'page' : 'pages'}`}
        </button>
      )}
    </div>
  );
}
