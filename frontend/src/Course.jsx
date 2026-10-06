import { useEffect, useState } from "react";
import { api } from "./api";
import Cats from "./Cats";
import CatRun from "./CatRun";

const styles = `
.sub.row { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; }
.drop { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 40px 20px; text-align: center; border: 1.5px dashed #c5cbe0; border-radius: 26px; cursor: pointer; transition: border-color .25s, background .25s, transform .3s var(--ease); }
.drop input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.drop span { color: var(--muted); font-size: .92rem; }
.drop:hover, .drop:focus-within { border-color: var(--blue); }
.drop.over { border-color: var(--blue); background: rgba(61, 90, 254, .06); transform: scale(1.01); }
.docs { list-style: none; margin: 26px 0 0; padding: 0; display: grid; gap: 10px; }
.doc { position: relative; overflow: hidden; display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: 14px; padding: 14px 18px; background: #fff; border: 1px solid var(--line); border-radius: 16px; animation: enter .4s var(--ease); }
.ico { width: 26px; height: 32px; border-radius: 6px 10px 6px 6px; background: var(--mark); transform: rotate(-4deg); }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.meta { color: var(--muted); font-size: .88rem; }
.doc.busy::after { content: ""; position: absolute; left: 0; bottom: 0; height: 3px; width: 40%; background: var(--blue); border-radius: 3px; animation: slide 1.2s var(--ease) infinite; }
@keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(250%); } }
.doc.bad .meta { color: var(--err); }
button.doc { width: 100%; text-align: left; transition: transform .25s var(--ease), border-color .2s; }
button.doc:hover { transform: translateY(-2px); border-color: var(--blue); }
.ctabs { display: flex; gap: 22px; margin: 0 0 26px; border-bottom: 1px solid var(--line); }
.ctabs button { position: relative; padding: 8px 2px 12px; color: var(--muted); font-weight: 500; transition: color .2s; }
.ctabs button[aria-selected="true"] { color: var(--ink); }
.ctabs button[aria-selected="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 3px; border-radius: 3px; background: var(--mark); transform-origin: left; animation: grow .35s var(--ease); }
@keyframes grow { from { transform: scaleX(0); } }
.row { display: flex; gap: 8px; align-items: center; }
.row .doc { flex: 1; min-width: 0; }
.del { min-width: 40px; height: 40px; padding: 0 10px; border-radius: 12px; color: var(--muted); opacity: 0; transition: opacity .2s, color .2s, background .2s; }
.row:hover .del, .del:focus-visible { opacity: 1; }
.del:hover { color: var(--err); background: #fdecee; }
.meta.score { color: var(--ink); font-weight: 600; }
@media (max-width: 560px) {
  .doc { grid-template-columns: 34px 1fr; }
  .doc .meta { grid-column: 2; }
}
`;

export default function Course({
  course,
  year,
  sem,
  onBack,
  onOpenDoc,
  onMoved,
}) {
  const [docs, setDocs] = useState(null);
  const [queue, setQueue] = useState([]);
  const [over, setOver] = useState(false);
  const [tab, setTab] = useState("files");
  const [catId, setCatId] = useState(null);
  const [years, setYears] = useState([]);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    api
      .documents(course.id)
      .then(setDocs)
      .catch(() => setDocs([]));
  }, [course.id]);

  useEffect(() => {
    api
      .years()
      .then(setYears)
      .catch(() => {});
  }, []);

  async function move(e) {
    const id = +e.target.value;
    try {
      await api.moveCourse(course.id, id);
    } catch {
      return;
    }
    for (const y of years) {
      const s = y.semesters.find((x) => x.id === id);
      if (s)
        return onMoved(
          { id: y.id, number: y.number },
          { id: s.id, number: s.number },
        );
    }
  }

  function removeDoc(id) {
    if (confirm !== id) {
      setConfirm(id);
      setTimeout(() => setConfirm((c) => (c === id ? null : c)), 3000);
      return;
    }
    api.deleteDocument(id).catch(() => {});
    setDocs((d) => d.filter((x) => x.id !== id));
    setConfirm(null);
  }

  async function addFiles(files) {
    const pdfs = [...files].filter((f) =>
      f.name.toLowerCase().endsWith(".pdf"),
    );
    const workers = 2;
    let index = 0;

    const runNext = async () => {
      if (index >= pdfs.length) return;
      const file = pdfs[index++];
      const key = crypto.randomUUID();
      setQueue((q) => [...q, { key, name: file.name }]);
      try {
        const doc = await api.upload(course.id, file);
        setDocs((d) => [...(d || []), doc]);
        setQueue((q) => q.filter((x) => x.key !== key));
      } catch (err) {
        setQueue((q) =>
          q.map((x) => (x.key === key ? { ...x, error: err.message } : x)),
        );
      }
      await runNext();
    };

    await Promise.all(Array.from({ length: Math.min(workers, pdfs.length) }, runNext));
  }

  if (catId) return <><style>{styles}</style><CatRun id={catId} onBack={() => setCatId(null)} /></>;

  const count = docs ? docs.length : 0;

  return (
    <>
      <style>{styles}</style>
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
        Semester {sem.number}
      </button>
      <h1>{course.name}</h1>
      <div className="sub row">
        <span>
          {docs ? `${count} ${count === 1 ? "file" : "files"}` : "\u00A0"}
        </span>
        <select
          className="pill"
          aria-label="Move this unit to another semester"
          value={sem.id}
          onChange={move}
        >
          {years.flatMap((y) =>
            y.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Year {y.number}, Semester {s.number}
              </option>
            )),
          )}
        </select>
      </div>

      <div className="ctabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "files"}
          onClick={() => setTab("files")}
        >
          Files
        </button>
        <button
          role="tab"
          aria-selected={tab === "cats"}
          onClick={() => setTab("cats")}
        >
          CATs
        </button>
      </div>

      {tab === "cats" ? (
        <Cats course={course} docs={docs || []} onOpen={setCatId} />
      ) : (
        <>
          <label
            className={"drop" + (over ? " over" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept="application/pdf"
              multiple
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <strong>Drop PDFs here</strong>
            <span>or click to choose files</span>
          </label>

          <ul className="docs">
            {queue.map((q) => (
              <li className={"doc " + (q.error ? "bad" : "busy")} key={q.key}>
                <span className="ico" />
                <span className="nm">{q.name}</span>
                <span className="meta">{q.error || "Reading pages…"}</span>
              </li>
            ))}
            {(docs || []).map((d) => (
              <li className="row" key={d.id}>
                <button className="doc open" onClick={() => onOpenDoc(d)}>
                  <span className="ico" />
                  <span className="nm">{d.filename}</span>
                  <span className="meta">
                    {d.page_count} pages
                    {d.empty_pages === d.page_count
                      ? ", scanned"
                      : d.empty_pages
                        ? `, ${d.empty_pages} scanned`
                        : ""}
                  </span>
                </button>
                <button
                  className="del"
                  onClick={() => removeDoc(d.id)}
                  aria-label="Delete file"
                  title={
                    confirm === d.id ? "Also deletes its flashcards" : undefined
                  }
                >
                  {confirm === d.id ? "Sure?" : "×"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
