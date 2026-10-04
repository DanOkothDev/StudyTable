import { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { api } from './api';
import Panel from './Panel';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const NUDGE_MINUTES = 8; // how often to offer a quick question

export default function Reader({ course, doc, onBack }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [nudge, setNudge] = useState(false);
  const [quizSignal, setQuizSignal] = useState(0);
  const wrap = useRef(null);
  const canvas = useRef(null);
  const start = useRef(Date.now());

  useEffect(() => {
    const task = pdfjs.getDocument({ url: `/api/documents/${doc.id}/file`, withCredentials: true });
    task.promise.then(setPdf).catch(() => setError('Could not open this PDF.'));
    return () => task.destroy();
  }, [doc.id]);

  useEffect(() => {
    if (!pdf) return;
    let job, dead = false;
    (async () => {
      const p = await pdf.getPage(page);
      if (dead) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(wrap.current.clientWidth / base.width, 1.7);
      const dpr = window.devicePixelRatio || 1;
      const vp = p.getViewport({ scale: fit * dpr });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      c.style.width = vp.width / dpr + 'px'; c.style.height = vp.height / dpr + 'px';
      job = p.render({ canvasContext: c.getContext('2d'), viewport: vp });
      await job.promise.catch(() => {});
    })();
    return () => { dead = true; job && job.cancel(); };
  }, [pdf, page]);

  // Report how long each page was open. The server marks a page "studied" after 10 seconds.
  const post = (p) => {
    if (start.current == null) return Promise.resolve();
    const s = Math.round((Date.now() - start.current) / 1000);
    start.current = Date.now();
    return s > 0 ? api.view(doc.id, p, s).catch(() => {}) : Promise.resolve();
  };
  useEffect(() => {
    start.current = Date.now();
    const onVis = () => {
      if (document.hidden) { post(page); start.current = null; } else start.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); post(page); };
  }, [page]);

  const total = pdf ? pdf.numPages : doc.page_count;
  const go = (n) => n >= 1 && n <= total && setPage(n);
  useEffect(() => {
    const key = (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(page + 1);
      if (e.key === 'ArrowLeft') go(page - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  useEffect(() => {
    const t = setInterval(() => !document.hidden && setNudge(true), NUDGE_MINUTES * 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="reader">
      <section className="stage">
        <div className="stage-top">
          <button className="back" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
            {course.name}
          </button>
          <span className="nm">{doc.filename}</span>
        </div>
        <div className="sheet" ref={wrap}>
          {error ? <p className="error">{error}</p> : !pdf ? <div className="skeleton page-skel" /> : <canvas key={page} ref={canvas} />}
        </div>
        <div className="pager">
          <button onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <input type="number" min="1" max={total} value={page} aria-label="Page number"
                 onFocus={(e) => e.target.select()} onChange={(e) => go(+e.target.value)} />
          <span>of {total}</span>
          <button onClick={() => go(page + 1)} disabled={page >= total} aria-label="Next page">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        </div>
        {nudge && (
          <div className="nudge" role="status">
            <span>Ready for a quick question?</span>
            <button onClick={() => { setNudge(false); setQuizSignal((n) => n + 1); }}>Ask me</button>
            <button className="x" onClick={() => setNudge(false)} aria-label="Dismiss">×</button>
          </div>
        )}
      </section>
      <Panel course={course} doc={doc} page={page} flush={() => post(page)} quizSignal={quizSignal} />
    </div>
  );
}
