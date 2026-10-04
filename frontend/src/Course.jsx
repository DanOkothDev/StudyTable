import { useEffect, useState } from 'react';
import { api } from './api';

export default function Course({ course, onBack }) {
  const [docs, setDocs] = useState(null);
  const [queue, setQueue] = useState([]);
  const [over, setOver] = useState(false);

  useEffect(() => {
    api.documents(course.id).then(setDocs).catch(() => setDocs([]));
  }, [course.id]);

  async function addFiles(files) {
    const pdfs = [...files].filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    for (const file of pdfs) {
      const key = crypto.randomUUID();
      setQueue((q) => [...q, { key, name: file.name }]);
      try {
        const doc = await api.upload(course.id, file);
        setDocs((d) => [...(d || []), doc]);
        setQueue((q) => q.filter((x) => x.key !== key));
      } catch (err) {
        setQueue((q) => q.map((x) => (x.key === key ? { ...x, error: err.message } : x)));
      }
    }
  }

  const count = docs ? docs.length : 0;

  return (
    <>
      <button className="back" onClick={onBack}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
        Courses
      </button>
      <h1>{course.name}</h1>
      <p className="sub">{docs ? `${count} ${count === 1 ? 'file' : 'files'}` : '\u00A0'}</p>

      <label className={'drop' + (over ? ' over' : '')}
             onDragOver={(e) => { e.preventDefault(); setOver(true); }}
             onDragLeave={() => setOver(false)}
             onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
        <input type="file" accept="application/pdf" multiple
               onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
        <strong>Drop PDFs here</strong>
        <span>or click to choose files</span>
      </label>

      <ul className="docs">
        {queue.map((q) => (
          <li className={'doc ' + (q.error ? 'bad' : 'busy')} key={q.key}>
            <span className="ico" /><span className="nm">{q.name}</span>
            <span className="meta">{q.error || 'Reading pages…'}</span>
          </li>
        ))}
        {(docs || []).map((d) => (
          <li className="doc" key={d.id}>
            <span className="ico" /><span className="nm">{d.filename}</span>
            <span className="meta">
              {d.page_count} pages{d.empty_pages ? `, ${d.empty_pages} without text` : ''}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
