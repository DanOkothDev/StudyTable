import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "./api";
import Panel from "./Panel";

const styles = `
.shell.wide { max-width: 1480px; height: 100vh; display: flex; flex-direction: column; overflow: hidden; padding-bottom: 20px; }
.shell.wide .bar { padding-bottom: 16px; }
.shell.wide .page { flex: 1; min-height: 0; }
.reader { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; height: 100%; min-height: 0; grid-template-rows: minmax(0, 1fr); }
.stage { position: relative; display: flex; flex-direction: column; min-width: 0; }
.stage-top { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; min-width: 0; }
.stage-top .back { margin: 0; }
.stage-top .nm { color: var(--muted); font-size: .9rem; }
.sheet { flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding-bottom: 84px; border-radius: 18px; scrollbar-width: thin; }
.sheet canvas { background: #fff; border-radius: 6px; box-shadow: 0 20px 40px -24px rgba(19, 26, 46, .35); animation: fade .3s var(--ease); }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
.page-skel { width: min(100%, 640px); height: 80%; border-radius: 10px; }
.pager { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; padding: 6px; background: var(--ink); color: #fff; border-radius: 999px; box-shadow: 0 14px 30px -12px rgba(19, 26, 46, .5); }
.pager button { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #fff; transition: background .2s; }
.pager button:hover:not(:disabled) { background: rgba(255, 255, 255, .16); }
.pager button:disabled { opacity: .3; cursor: default; }
.pager input { width: 54px; padding: 6px 4px; text-align: center; background: rgba(255, 255, 255, .12); border: 0; border-radius: 10px; color: #fff; -moz-appearance: textfield; }
.pager input::-webkit-inner-spin-button { appearance: none; }
.pager span { font-size: .9rem; opacity: .75; padding-right: 6px; }
.nudge { position: absolute; left: 14px; bottom: 18px; display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 18px; background: var(--mark); border-radius: 999px; font-weight: 500; font-size: .92rem; animation: pop .5s var(--ease); }
@keyframes pop { from { opacity: 0; transform: translateY(16px) scale(.94); } to { opacity: 1; transform: none; } }
.nudge button { padding: 6px 14px; border-radius: 999px; background: var(--ink); color: #fff; font-size: .88rem; }
.nudge .x { padding: 4px 10px; background: transparent; color: var(--ink); font-size: 1.1rem; }
.scan-note { margin: 0 0 10px; padding: 9px 14px; background: #fff3c4; border-radius: 12px; font-size: .88rem; animation: enter .4s var(--ease); }
@media (max-width: 900px) {
  .shell.wide { height: auto; overflow: visible; }
  .reader { grid-template-columns: 1fr; height: auto; }
  .sheet { height: 70vh; flex: none; }
  .side { height: 70vh; }
}
`;

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
const NUDGE_MINUTES = 8; // how often to offer a quick question

export default function Reader({ course, doc, onBack }) {
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [nudge, setNudge] = useState(false);
  const [quizSignal, setQuizSignal] = useState(0);
  const wrap = useRef(null);
  const canvas = useRef(null);
  const start = useRef(Date.now());
  const renderCache = useRef(new Map());

  useEffect(() => {
    const task = pdfjs.getDocument({
      url: `/api/documents/${doc.id}/file`,
      withCredentials: true,
    });
    task.promise.then(setPdf).catch(() => setError("Could not open this PDF."));
    return () => task.destroy();
  }, [doc.id]);

  useEffect(() => {
    if (!pdf) return;
    let job,
      dead = false;
    const cached = renderCache.current.get(page);
    if (cached) {
      const c = canvas.current;
      if (c) {
        c.width = cached.width;
        c.height = cached.height;
        c.style.width = cached.styleWidth;
        c.style.height = cached.styleHeight;
        const ctx = c.getContext("2d");
        ctx.putImageData(cached.imageData, 0, 0);
      }
      return undefined;
    }
    (async () => {
      const p = await pdf.getPage(page);
      if (dead) return;
      const base = p.getViewport({ scale: 1 });
      const fit = Math.min(wrap.current.clientWidth / base.width, 1.3);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const vp = p.getViewport({ scale: fit * dpr });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      c.style.width = vp.width / dpr + "px";
      c.style.height = vp.height / dpr + "px";
      job = p.render({ canvasContext: c.getContext("2d"), viewport: vp });
      await job.promise.catch(() => {});
      if (!dead) {
        renderCache.current.set(page, {
          width: vp.width,
          height: vp.height,
          styleWidth: vp.width / dpr + "px",
          styleHeight: vp.height / dpr + "px",
          imageData: c.getContext("2d").getImageData(0, 0, vp.width, vp.height),
        });
      }
    })();
    return () => {
      dead = true;
      job && job.cancel();
    };
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
      if (document.hidden) {
        post(page);
        start.current = null;
      } else start.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      post(page);
    };
  }, [page]);

  const total = pdf ? pdf.numPages : doc.page_count;
  const go = (n) => n >= 1 && n <= total && setPage(n);
  useEffect(() => {
    const key = (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") go(page + 1);
      if (e.key === "ArrowLeft") go(page - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [page]);

  useEffect(() => {
    const t = setInterval(
      () => !document.hidden && setNudge(true),
      NUDGE_MINUTES * 60000,
    );
    return () => clearInterval(t);
  }, []);

  return (
    <>
    <style>{styles}</style>
    <div className="reader">
      <section className="stage">
        <div className="stage-top">
          <button className="back" onClick={onBack}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 3 5 8l5 5" />
            </svg>
            {course.name}
          </button>
          <span className="nm">{doc.filename}</span>
        </div>
        {doc.empty_pages === doc.page_count && (
          <p className="scan-note">
            This file is a scan, so the AI can't read its pages. You can still
            ask it questions.
          </p>
        )}
        <div className="sheet" ref={wrap}>
          {error ? (
            <p className="error">{error}</p>
          ) : !pdf ? (
            <div className="skeleton page-skel" />
          ) : (
            <canvas key={page} ref={canvas} />
          )}
        </div>
        <div className="pager">
          <button
            onClick={() => go(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
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
              <path d="M10 3 5 8l5 5" />
            </svg>
          </button>
          <input
            type="number"
            min="1"
            max={total}
            value={page}
            aria-label="Page number"
            onFocus={(e) => e.target.select()}
            onChange={(e) => go(+e.target.value)}
          />
          <span>of {total}</span>
          <button
            onClick={() => go(page + 1)}
            disabled={page >= total}
            aria-label="Next page"
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
              <path d="m6 3 5 5-5 5" />
            </svg>
          </button>
        </div>
        {nudge && (
          <div className="nudge" role="status">
            <span>Ready for a quick question?</span>
            <button
              onClick={() => {
                setNudge(false);
                setQuizSignal((n) => n + 1);
              }}
            >
              Ask me
            </button>
            <button
              className="x"
              onClick={() => setNudge(false)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}
      </section>
      <Panel
        course={course}
        doc={doc}
        page={page}
        flush={() => post(page)}
        quizSignal={quizSignal}
      />
    </div>
    </>
  );
}
