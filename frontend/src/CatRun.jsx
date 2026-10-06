import { useEffect, useState } from 'react';
import { api } from './api';

const styles = `
.hint { color: var(--muted); font-size: .92rem; margin: 0; }
.progress { height: 5px; margin: 22px 0 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
.progress span { display: block; height: 100%; background: var(--blue); border-radius: 5px; transition: width .45s var(--ease); }
.qpanel { max-width: 760px; animation: enter .4s var(--ease); }
.qpanel h2 { margin: 0 0 22px; font-size: clamp(1.25rem, 2.4vw, 1.6rem); font-weight: 600; line-height: 1.3; letter-spacing: -.015em; }
.opts { display: grid; gap: 10px; }
.opt, .ropt { display: flex; align-items: center; gap: 14px; padding: 15px 18px; text-align: left; background: #fff; border: 1.5px solid var(--line); border-radius: 16px; }
.opt { transition: border-color .2s, background .2s, transform .2s var(--ease); }
.opt:hover { border-color: #b9c1dd; transform: translateX(3px); }
.opt.on { border-color: var(--blue); background: rgba(61, 90, 254, .06); }
.opt b, .ropt b { flex: none; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: var(--paper); font-size: .9rem; transition: background .2s, color .2s; }
.opt.on b { background: var(--blue); color: #fff; }
.runbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; max-width: 760px; margin-top: 26px; }
.result { display: flex; align-items: center; gap: 24px; margin: 28px 0 36px; }
.result strong { display: block; font-size: 2.2rem; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; }
.result span { color: var(--muted); }
.ring-bg, .ring-fg { fill: none; stroke-width: 9; }
.ring-bg { stroke: var(--line); }
.ring-fg { stroke: var(--blue); stroke-linecap: round; stroke-dasharray: 276.46; stroke-dashoffset: 276.46; transform: rotate(-90deg); transform-origin: 50% 50%; animation: draw 1.1s var(--ease) .2s forwards; }
@keyframes draw { to { stroke-dashoffset: var(--off); } }
.review { list-style: none; margin: 0; padding: 0; display: grid; gap: 30px; max-width: 760px; }
.review h3 { margin: 0 0 12px; font-size: 1.08rem; font-weight: 600; line-height: 1.35; }
.review li { display: grid; gap: 8px; }
.ropt { padding: 11px 14px; border-radius: 14px; font-size: .96rem; }
.ropt small { margin-left: auto; font-weight: 600; font-size: .8rem; }
.ropt.ok { background: #e4f6ec; border-color: #9fd9b9; }
.ropt.ok b { background: #1f9d63; color: #fff; }
.ropt.no { background: #fdecee; border-color: #f0b4ba; }
.ropt.no b { background: var(--err); color: #fff; }
.ropt.ok small { color: #157347; }
.ropt.no small { color: var(--err); }
.why { margin: 4px 0 0; padding: 12px 14px; background: var(--paper); border-radius: 14px; color: #3c4563; font-size: .94rem; }
@media (max-width: 560px) {
  .result { flex-direction: column; align-items: flex-start; }
}
`;

const LETTERS = ['A', 'B', 'C', 'D'];
const C = 2 * Math.PI * 44;

const Back = ({ onBack }) => (
  <button className="back" onClick={onBack}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
    CATs
  </button>
);

export default function CatRun({ id, onBack }) {
  const [cat, setCat] = useState(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.cat(id).then((c) => { setCat(c); setAnswers(c.questions.map(() => null)); })
      .catch((e) => setError(e.message));
  }, [id]);

  const taking = cat && !cat.submitted;
  const total = cat ? cat.questions.length : 0;
  const pick = (k) => setAnswers((a) => a.map((v, j) => (j === i ? k : v)));
  const next = () => setI((x) => Math.min(x + 1, total - 1));
  const prev = () => setI((x) => Math.max(x - 1, 0));

  useEffect(() => {
    if (!taking) return;
    const key = (e) => {
      const idx = e.key.length === 1 ? '1234abcd'.indexOf(e.key.toLowerCase()) : -1;
      if (idx >= 0) pick(idx % 4);
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  async function submit() {
    setBusy(true); setError('');
    try { setCat(await api.submitCat(id, answers)); } catch (e) { setError(e.message); }
    setBusy(false);
  }

  if (!cat) return (<><style>{styles}</style><Back onBack={onBack} />{error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 260, borderRadius: 24 }} />}</>);

  if (taking) {
    const q = cat.questions[i];
    const left = answers.filter((a) => a === null).length;
    return (
      <>
        <style>{styles}</style>
        <Back onBack={onBack} />
        <h1>{cat.title}</h1>
        <div className="progress"><span style={{ width: `${((i + 1) / total) * 100}%` }} /></div>
        <p className="sub">Question {i + 1} of {total}</p>
        <div className="qpanel" key={i}>
          <h2>{q.question}</h2>
          <div className="opts">
            {q.options.map((o, k) => (
              <button key={k} className={'opt' + (answers[i] === k ? ' on' : '')} onClick={() => pick(k)}>
                <b>{LETTERS[k]}</b><span>{o}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="runbar">
          <button className="link" onClick={prev} disabled={i === 0}>Previous</button>
          <span className="hint">{left ? `${left} unanswered` : 'All answered'}</span>
          {i === total - 1
            ? <button className="primary go" onClick={submit} disabled={busy}>{busy ? 'Marking…' : 'Submit'}</button>
            : <button className="primary go" onClick={next}>Next</button>}
        </div>
      </>
    );
  }

  const pct = Math.round((cat.score / cat.total) * 100);
  const note = pct >= 80 ? 'Strong work.' : pct >= 50 ? 'Getting there. Check the ones you missed.' : 'Worth another pass through your notes.';
  return (
    <>
      <style>{styles}</style>
      <Back onBack={onBack} />
      <h1>{cat.title}</h1>
      <div className="result">
        <svg width="112" height="112" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" className="ring-bg" />
          <circle cx="50" cy="50" r="44" className="ring-fg" style={{ '--off': C * (1 - pct / 100) }} />
        </svg>
        <div><strong>{cat.score} / {cat.total}</strong><span>{pct}%. {note}</span></div>
      </div>
      <ol className="review">
        {cat.questions.map((q) => (
          <li key={q.id}>
            <h3>{q.question}</h3>
            {q.chosen_index === null && <p className="hint">You skipped this one.</p>}
            {q.options.map((o, k) => {
              const right = k === q.correct_index, mine = k === q.chosen_index;
              return (
                <div key={k} className={'ropt' + (right ? ' ok' : mine ? ' no' : '')}>
                  <b>{LETTERS[k]}</b><span>{o}</span>
                  {right ? <small>Correct answer</small> : mine ? <small>Your answer</small> : null}
                </div>
              );
            })}
            {q.explanation && <p className="why">{q.explanation}</p>}
          </li>
        ))}
      </ol>
    </>
  );
}
