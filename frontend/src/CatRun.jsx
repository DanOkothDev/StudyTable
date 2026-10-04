import { useEffect, useState } from 'react';
import { api } from './api';

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

  if (!cat) return (<><Back onBack={onBack} />{error ? <p className="error">{error}</p> : <div className="skeleton" style={{ height: 260, borderRadius: 24 }} />}</>);

  if (taking) {
    const q = cat.questions[i];
    const left = answers.filter((a) => a === null).length;
    return (
      <>
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
