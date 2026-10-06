import { useEffect, useState } from 'react';
import { api } from './api';

const styles = `
.hint { color: var(--muted); font-size: .92rem; margin: 0; }
.newcat { width: 100%; padding: 22px; border: 1.5px dashed #c5cbe0; border-radius: 22px; color: var(--muted); font-weight: 500; transition: border-color .2s, color .2s; }
.newcat:hover:not(:disabled) { border-color: var(--blue); color: var(--blue); }
.newcat:disabled { cursor: default; opacity: .7; }
.creator { display: grid; gap: 16px; padding: 22px; background: #fff; border: 1px solid var(--line); border-radius: 24px; animation: enter .4s var(--ease); }
.seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 4px; background: var(--paper); border-radius: 14px; }
.seg button { padding: 9px; border-radius: 10px; color: var(--muted); font-weight: 500; transition: background .2s, color .2s; }
.seg button[aria-checked="true"] { background: #fff; color: var(--ink); box-shadow: 0 1px 3px rgba(19, 26, 46, .12); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.fchip { max-width: 100%; padding: 8px 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-radius: 999px; border: 1.5px solid var(--line); color: var(--muted); font-size: .9rem; transition: all .2s; }
.fchip.on { background: var(--mark); border-color: var(--mark); color: var(--ink); }
.creator-go { display: flex; justify-content: flex-end; align-items: center; gap: 10px; }
.primary.go { padding: 12px 26px; }
`;

export default function Cats({ course, docs, onOpen }) {
  const [cats, setCats] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [n, setN] = useState(5);
  const [off, setOff] = useState([]); // files switched off for this CAT
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    api.cats(course.id).then(setCats).catch((e) => setError(e.message));
  }, [course.id]);

  async function create(e) {
    e.preventDefault();
    const ids = docs.map((d) => d.id).filter((id) => !off.includes(id));
    if (ids.length === 0) return setError('Pick at least one file for the questions.');
    setBusy(true); setError('');
    try {
      const cat = await api.createCat(course.id, { title: title.trim(), num_questions: n, document_ids: ids });
      onOpen(cat.id);
    } catch (err) {
      setError(err.message); setBusy(false);
    }
  }

  function remove(id) {
    if (confirm !== id) {
      setConfirm(id);
      setTimeout(() => setConfirm((c) => (c === id ? null : c)), 3000);
      return;
    }
    api.deleteCat(id).catch(() => {});
    setCats((c) => c.filter((x) => x.id !== id));
    setConfirm(null);
  }

  return (
    <>
      <style>{styles}</style>
      {error && <p className="error" role="alert">{error}</p>}
      {creating ? (
        <form className="creator" onSubmit={create}>
          <input placeholder="Title (optional)" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} />
          <div className="seg" role="radiogroup" aria-label="Number of questions">
            {[5, 10, 15].map((k) => (
              <button type="button" key={k} role="radio" aria-checked={n === k} onClick={() => setN(k)}>{k} questions</button>
            ))}
          </div>
          <p className="hint">Questions come from the files you leave switched on.</p>
          <div className="chips">
            {docs.map((d) => {
              const on = !off.includes(d.id);
              return (
                <button type="button" key={d.id} aria-pressed={on} className={'fchip' + (on ? ' on' : '')}
                        onClick={() => setOff(on ? [...off, d.id] : off.filter((x) => x !== d.id))}>
                  {d.filename}
                </button>
              );
            })}
          </div>
          <div className="creator-go">
            <button type="button" className="link" onClick={() => setCreating(false)} disabled={busy}>Cancel</button>
            <button className="primary go" disabled={busy}>{busy ? 'Writing your CAT…' : 'Create CAT'}</button>
          </div>
        </form>
      ) : (
        <button className="newcat" onClick={() => setCreating(true)} disabled={!docs.length}>
          {docs.length ? 'New CAT' : 'Upload a PDF first'}
        </button>
      )}

      <ul className="docs">
        {cats === null && <li className="doc skeleton" style={{ height: 66 }} />}
        {cats && cats.map((c) => (
          <li className="row" key={c.id}>
            <button className="doc open" onClick={() => onOpen(c.id)}>
              <span className="ico" /><span className="nm">{c.title}</span>
              <span className={'meta' + (c.submitted ? ' score' : '')}>
                {c.submitted ? `${c.score} / ${c.total}` : `${c.total} questions`}
              </span>
            </button>
            <button className="del" onClick={() => remove(c.id)} aria-label="Delete CAT">
              {confirm === c.id ? 'Sure?' : '×'}
            </button>
          </li>
        ))}
        {cats && cats.length === 0 && !creating && <li className="hint">No CATs yet. Create one from your notes and test yourself.</li>}
      </ul>
    </>
  );
}
