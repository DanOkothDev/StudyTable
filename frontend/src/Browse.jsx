import { useEffect, useState } from 'react';
import { api } from './api';
import FormattedText from './FormattedText';

const TINTS = ['#FFD3BF', '#CFDCFF', '#CDEFD9', '#F9D5E8', '#FFEBA3', '#DCD2FA'];
const gridStyles = `
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 34px 22px; }
.folder { position: relative; margin-top: 18px; min-height: 132px; padding: 20px 22px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; text-align: left; background: #fff; border: 1px solid var(--line); border-radius: 6px 22px 22px 22px; animation: enter .5s var(--ease) both; animation-delay: calc(var(--i, 0) * 60ms); transition: transform .3s var(--ease), box-shadow .3s var(--ease); }
.folder::before { content: ""; position: absolute; left: -1px; top: -18px; width: 84px; height: 19px; background: var(--tint, var(--line)); border-radius: 10px 10px 0 0; transition: width .3s var(--ease); }
.folder strong { font-size: 1.15rem; font-weight: 600; letter-spacing: -.01em; overflow-wrap: anywhere; }
.folder span { color: var(--muted); font-size: .9rem; }
button.folder:hover { transform: translateY(-5px); box-shadow: 0 18px 32px -16px rgba(19, 26, 46, .3); }
button.folder:hover::before { width: 112px; }
button.folder:active { transform: scale(.98); }
.folder.new { border: 1.5px dashed #c5cbe0; background: transparent; justify-content: center; align-items: center; }
.folder.new::before { display: none; }
.folder.new strong { color: var(--muted); font-weight: 500; }
button.folder.new:hover { border-color: var(--blue); }
button.folder.new:hover strong { color: var(--blue); }
.folder.new.open { align-items: stretch; background: #fff; border-style: solid; border-color: var(--blue); gap: 8px; }
.folder.new.open .chips { margin-top: 6px; }
.folder-card { position: relative; min-width: 0; margin-top: 18px; }
.folder-card > .folder { width: 100%; height: 100%; margin: 0; }
.folder-actions { position: absolute; z-index: 2; top: 6px; right: 8px; display: flex; gap: 2px; }
.folder-action { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: var(--muted); background: rgba(255, 255, 255, .88); }
.folder-action:hover { color: var(--blue); background: #fff; }
.folder-action.delete:hover { color: var(--err); }
.folder-edit { display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.folder-edit input { width: 100%; min-width: 0; }
.folder-edit-controls { display: flex; justify-content: flex-end; gap: 6px; }
.folder-edit-controls button { padding: 5px 10px; border-radius: 9px; background: var(--paper); color: var(--muted); font-size: .88rem; }
.folder-edit-controls button[type="submit"] { background: var(--ink); color: #fff; }
.folder-edit-error { color: var(--err); font-size: .82rem; overflow-wrap: anywhere; }
`;
const yearsStyles = `
.tomorrow { margin: 0 0 34px; padding: 22px 24px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
.tomorrow h2 { margin: 0 0 8px; font-size: 1.18rem; font-weight: 600; }
.tomorrow > p { margin: 0; color: var(--muted); }
.assessment-alert { width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; padding: 13px 0; text-align: left; border-top: 1px solid var(--line); }
.assessment-alert strong { font-weight: 600; }
.assessment-alert span { color: var(--muted); font-size: .92rem; }
.assessment-alert:hover strong { color: var(--blue); }
`;
const semesterStyles = `
.timetable { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 0 0 22px; padding: 18px 22px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
.timetable h2 { margin: 0 0 2px; font-size: 1.18rem; font-weight: 600; }
.timetable p { margin: 0; color: var(--muted); font-size: .92rem; overflow-wrap: anywhere; }
.timetable-upload { position: relative; flex: none; padding: 10px 16px; border-radius: 999px; background: var(--ink); color: #fff; cursor: pointer; font-size: .9rem; font-weight: 600; }
.timetable-upload:hover { background: var(--blue); }
.timetable-upload input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.class-schedule { margin: 0 0 28px; padding: 18px 22px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
.class-schedule > h2, .exam-panel h2 { margin: 0; font-size: 1.18rem; font-weight: 600; }
.class-day { display: grid; grid-template-columns: 126px minmax(0, 1fr); gap: 18px; padding: 13px 0; border-top: 1px solid var(--line); }
.class-day:first-of-type { margin-top: 12px; }
.class-day h3 { margin: 0; font-size: .94rem; font-weight: 600; }
.class-day-sessions { display: grid; gap: 7px; }
.class-session { display: grid; grid-template-columns: 128px minmax(130px, 1fr) minmax(100px, 1fr); align-items: baseline; gap: 14px; }
.class-session time, .class-session span { color: var(--muted); font-size: .9rem; }
.assessment-empty { margin: 0 0 28px; color: var(--muted); font-size: .92rem; }
.exam-panel { margin: 0 0 30px; padding: 22px 24px; border: 1px solid var(--line); border-radius: 20px; background: #fff; }
.exam-panel-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.exam-panel-head p { margin: 5px 0 0; color: var(--muted); font-size: .92rem; overflow-wrap: anywhere; }
.exam-list { list-style: none; margin: 18px 0 0; padding: 0; border-top: 1px solid var(--line); }
.exam-list li { display: grid; grid-template-columns: 190px minmax(0, 1fr) 80px; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.exam-list time, .exam-list li span { color: var(--muted); font-size: .9rem; }
.exam-list strong { font-weight: 600; }
.understanding { display: grid; gap: 16px; margin-top: 22px; }
.understanding h3, .study-plan h3 { margin: 0 0 4px; font-size: 1rem; font-weight: 600; }
.understanding p { margin: 0; color: var(--muted); font-size: .9rem; }
.understanding-list { display: grid; gap: 8px; }
.understanding-row { display: grid; grid-template-columns: minmax(140px, 1fr) minmax(240px, 1.2fr); align-items: center; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.understanding-row .pill { justify-self: stretch; min-width: 0; }
.study-plan { margin-top: 22px; padding: 18px 20px; border-radius: 16px; background: var(--paper); }
.study-plan .formatted-text { color: #303954; }
.study-plan .recap-source { margin: 10px 0 14px; }
@media (max-width: 560px) {
  .timetable { align-items: flex-start; flex-direction: column; }
  .exam-panel-head { align-items: flex-start; flex-direction: column; }
  .exam-list li { grid-template-columns: 1fr auto; }
  .exam-list strong { grid-column: 1 / -1; grid-row: 2; }
  .understanding-row { grid-template-columns: 1fr; gap: 7px; }
  .class-day { grid-template-columns: 1fr; gap: 8px; }
  .class-session { grid-template-columns: 1fr 1fr; gap: 2px 12px; }
  .class-session span { grid-column: 2; }
}
`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const yearsCache = { promise: null, data: null };
const semesterCache = new Map();

async function loadYears() {
  if (yearsCache.data) return yearsCache.data;
  if (!yearsCache.promise) {
    yearsCache.promise = api.years().then((items) => {
      yearsCache.data = items;
      return items;
    });
  }
  return yearsCache.promise;
}

async function loadSemester(id) {
  if (semesterCache.has(id)) return semesterCache.get(id);
  const promise = api.semester(id);
  semesterCache.set(id, promise);
  return promise;
}

export function invalidateYears() {
  yearsCache.data = null;
  yearsCache.promise = null;
}

export function invalidateSemester(id) {
  semesterCache.delete(id);
}

function GridItem({ item, index, onOpen, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.editValue ?? item.name);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setError('Name cannot be empty.');
      return;
    }
    try {
      await onEdit(item, nextName);
      setEditing(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    const message = item.removeMessage || `Remove "${item.name}"? This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      await onDelete(item);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="folder-card">
      {editing ? (
        <form className="folder new open folder-edit" onSubmit={save}>
          <input
            autoFocus
            value={name}
            maxLength={item.maxLength || 120}
            onChange={(e) => setName(e.target.value)}
            aria-label={`Edit ${item.editLabel || item.name}`}
          />
          {error && <span className="folder-edit-error" role="alert">{error}</span>}
          <div className="folder-edit-controls">
            <button type="button" onClick={() => { setEditing(false); setName(item.name); setError(''); }}>Cancel</button>
            <button type="submit">Save</button>
          </div>
        </form>
      ) : (
        <>
          <button
            className="folder"
            onClick={() => onOpen(item)}
            style={{ '--tint': TINTS[item.id % TINTS.length], '--i': index }}
          >
            <strong>{item.name}</strong>
            <span>{item.meta}</span>
          </button>
          {onEdit && onDelete && (
            <div className="folder-actions">
              <button
                className="folder-action"
                type="button"
                title={`Edit ${item.editLabel || item.name}`}
                aria-label={`Edit ${item.editLabel || item.name}`}
                onClick={() => { setName(item.editValue ?? item.name); setEditing(true); setError(''); }}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m10.8 2.8 2.4 2.4M3 13l2.8-.6 7.5-7.5a1.7 1.7 0 0 0-2.4-2.4l-7.5 7.5L3 13Z" />
                </svg>
              </button>
              <button
                className="folder-action delete"
                type="button"
                title={`Remove ${item.name}`}
                aria-label={`Remove ${item.name}`}
                onClick={remove}
              >
                <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M2.5 4h11M6 4V2.5h4V4m2.5 0-.6 9.5H4.1L3.5 4m3 2.5v4m3-4v4" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
      {!editing && error && <span className="folder-edit-error" role="alert">{error}</span>}
    </div>
  );
}

function Grid({ items, onOpen, add, onEdit, onDelete }) {
  return (
    <>
      <style>{gridStyles}</style>
      <div className="grid">
      {items === null && [0, 1, 2].map((i) => <div className="folder skeleton" key={i} />)}
      {items && items.map((it, i) => (
        <GridItem
          key={it.id}
          item={it}
          index={i}
          onOpen={() => onOpen(it)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
      {items && add}
      </div>
    </>
  );
}

const AddTile = ({ label, onClick, i }) => (
  <button className="folder new" onClick={onClick} style={{ '--i': i }}><strong>{label}</strong></button>
);

export function Years({ onOpen }) {
  const [years, setYears] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadYears().then(setYears).catch((e) => setError(e.message));
  }, []);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [classes, setClasses] = useState(null);

  useEffect(() => {
    api.classes(todayKey)
      .then(setClasses)
      .catch((e) => setError(e.message));
  }, [todayKey]);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const free = years ? [1, 2, 3, 4, 5, 6].filter((n) => !years.some((y) => y.number === n)) : [];

  async function add(n) {
    try {
      const y = await api.createYear(n);
      const next = [...(years || []), y].sort((a, b) => a.number - b.number);
      yearsCache.data = next;
      yearsCache.promise = Promise.resolve(next);
      setYears(next);
      setAdding(false); setError('');
    } catch (e) { setError(e.message); }
  }

  const slot = adding ? (
    <div className="folder new open" style={{ '--i': years ? years.length : 0 }}>
      <strong>Which year?</strong>
      <div className="chips">
        {free.map((n) => <button key={n} className="fchip" onClick={() => add(n)}>Year {n}</button>)}
      </div>
    </div>
  ) : free.length > 0 && <AddTile label="Add year" i={years ? years.length : 0} onClick={() => setAdding(true)} />;

  return (
    <>
      <style>{yearsStyles}</style>
      <h1>{hello}</h1>
      <p className="sub">{years && years.length === 0 ? 'Start by adding the year you are in.' : 'Pick a year to keep studying.'}</p>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="tomorrow">
        <h2>Today&apos;s classes</h2>
        {classes === null ? <p>Checking your timetable…</p> : classes.length === 0 ? (
          <p>No classes scheduled for today.</p>
        ) : classes.map((item) => (
          <button className="assessment-alert" key={item.id} onClick={() => onOpen(item)}>
            <strong>{item.course_name} — {item.title}</strong>
            <span>{item.start_time ? `${item.start_time} · ` : ''}Review before class</span>
          </button>
        ))}
      </section>
      <Grid onOpen={(it) => onOpen({ id: it.id, number: it.raw.number })} add={slot}
            items={years && years.map((y) => ({
              id: y.id, name: `Year ${y.number}`, raw: y,
              meta: plural(y.semesters.reduce((a, s) => a + s.unit_count, 0), 'unit'),
            }))} />
    </>
  );
}

export function YearView({ year, onOpen }) {
  const [y, setY] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    loadYears().then((ys) => setY(ys.find((x) => x.id === year.id) || null));
  }, [year.id]);

  function saveYear(next) {
    setY(next);
    if (yearsCache.data) {
      yearsCache.data = yearsCache.data.map((item) => item.id === next.id ? next : item);
      yearsCache.promise = Promise.resolve(yearsCache.data);
    }
  }

  async function editSemester(item, value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Enter a positive semester number.');
    }
    const updated = await api.updateSemester(item.id, number);
    saveYear({
      ...y,
      semesters: y.semesters.map((semester) =>
        semester.id === item.id ? { ...semester, number: updated.number } : semester,
      ).sort((a, b) => a.number - b.number),
    });
  }

  async function removeSemester(item) {
    await api.deleteSemester(item.id);
    invalidateSemester(item.id);
    saveYear({ ...y, semesters: y.semesters.filter((semester) => semester.id !== item.id) });
  }

  async function addSemester() {
    setError('');
    try {
      const semester = await api.createSemester(year.id);
      saveYear({
        ...y,
        semesters: [...y.semesters, semester].sort((a, b) => a.number - b.number),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1>Year {year.number}</h1>
      <p className="sub">Choose a semester.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <Grid onOpen={(it) => onOpen({ id: it.id, number: it.raw.number })}
            onEdit={editSemester}
            onDelete={removeSemester}
            add={y && <AddTile label="Add semester" i={y.semesters.length} onClick={addSemester} />}
            items={y && y.semesters.map((s) => ({
              id: s.id,
              name: `Semester ${s.number}`,
              editValue: String(s.number),
              editLabel: `Semester ${s.number} number`,
              removeMessage: `Remove Semester ${s.number} and permanently delete its units, uploaded PDFs, CATs, timetable, and exam data?`,
              raw: s,
              meta: s.unit_count ? plural(s.unit_count, 'unit') : 'No units yet',
            }))} />
    </>
  );
}

function NewUnit({ onCreate, i }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setAdding(false);
    try { await onCreate(name.trim()); setName(''); setAdding(false); setError(''); }
    catch (err) { setError(err.message); }
  }
  if (!adding) return <AddTile label="New unit" i={i} onClick={() => setAdding(true)} />;
  return (
    <form className="folder new open" onSubmit={submit} style={{ '--i': i }}>
      <input autoFocus placeholder="Unit name" value={name} maxLength={120}
             onChange={(e) => setName(e.target.value)}
             onBlur={() => !name.trim() && setAdding(false)}
             onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} />
      <span style={error ? { color: 'var(--err)' } : undefined}>{error || 'Press Enter to save'}</span>
    </form>
  );
}

export function SemesterView({ sem, onOpen }) {
  const [units, setUnits] = useState(null);
  const [semester, setSemester] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingExams, setUploadingExams] = useState(false);
  const [understanding, setUnderstanding] = useState({});
  const [studyPlan, setStudyPlan] = useState('');
  const [studyPlanSource, setStudyPlanSource] = useState('');
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    loadSemester(sem.id).then((s) => {
      setUnits(s.courses);
      setSemester(s);
    }).catch((e) => setError(e.message));
  }, [sem.id]);

  async function uploadTimetable(file) {
    setUploading(true);
    setError('');
    try {
      const result = await api.uploadTimetable(sem.id, file);
      const nextCourses = result.courses || semester.courses;
      setUnits(nextCourses);
      const next = {
        ...semester,
        courses: nextCourses,
        timetable_filename: result.timetable_filename,
        classes: result.classes,
      };
      setSemester(next);
      semesterCache.set(sem.id, Promise.resolve(next));
      invalidateYears();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function uploadExamTimetable(file) {
    setUploadingExams(true);
    setError('');
    try {
      const result = await api.uploadExamTimetable(sem.id, file);
      setStudyPlan('');
      setStudyPlanSource('');
      setUnderstanding({});
      const next = {
        ...semester,
        exam_timetable_filename: result.exam_timetable_filename,
        assessments: result.assessments,
      };
      setSemester(next);
      semesterCache.set(sem.id, Promise.resolve(next));
    } catch (e) {
      setError(e.message);
    } finally {
      setUploadingExams(false);
    }
  }

  async function createStudyPlan() {
    setGeneratingPlan(true);
    setError('');
    setStudyPlan('');
    setStudyPlanSource('');
    try {
      const result = await api.examStudyPlan(sem.id, understanding);
      setStudyPlan(result.plan);
      setStudyPlanSource(result.source);
    } catch (e) {
      setError(e.message);
    } finally {
      setGeneratingPlan(false);
    }
  }

  async function renameUnit(unit, name) {
    const updated = await api.updateUnit(unit.id, name);
    const nextUnits = units.map((item) =>
      item.id === unit.id ? { ...item, name: updated.name } : item,
    );
    setUnits(nextUnits);
    const nextSemester = { ...semester, courses: nextUnits };
    setSemester(nextSemester);
    semesterCache.set(sem.id, Promise.resolve(nextSemester));
  }

  async function removeUnit(unit) {
    await api.deleteUnit(unit.id);
    const nextUnits = units.filter((item) => item.id !== unit.id);
    setUnits(nextUnits);
    const nextSemester = { ...semester, courses: nextUnits };
    setSemester(nextSemester);
    semesterCache.set(sem.id, Promise.resolve(nextSemester));
    invalidateYears();
  }

  const classDays = WEEKDAYS.map((name, weekday) => ({
    name,
    sessions: (semester?.classes || []).filter((item) => item.weekday === weekday),
  })).filter((day) => day.sessions.length > 0);
  const assessments = semester?.assessments || [];
  const allUnitsRated = Boolean(units?.length) && units.every((unit) => understanding[unit.id]);

  return (
    <>
      <style>{semesterStyles}</style>
      <h1>Semester {sem.number}</h1>
      <p className="sub">{units && units.length === 0 ? 'Add a unit, then drop your PDFs in.' : 'Pick a unit to keep studying.'}</p>
      <section className="timetable">
        <div>
          <h2>Class timetable</h2>
          <p>{semester?.timetable_filename || 'Upload this semester’s lecture timetable to get reminders and pre-class recaps.'}</p>
        </div>
        <label className="timetable-upload">
          <input type="file" accept="application/pdf,.pdf" disabled={uploading || !semester}
                 onChange={(e) => {
                   const file = e.target.files[0];
                   if (file) uploadTimetable(file);
                   e.target.value = '';
                 }} />
          {uploading ? 'Reading timetable…' : semester?.timetable_filename ? 'Replace PDF' : 'Upload PDF'}
        </label>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
      {classDays.length > 0 && (
        <section className="class-schedule" aria-label="Weekly lecture schedule">
          <h2>Weekly lecture schedule</h2>
          {classDays.map((day) => (
            <div className="class-day" key={day.name}>
              <h3>{day.name}</h3>
              <div className="class-day-sessions">
                {day.sessions.map((item) => (
                  <div className="class-session" key={item.id}>
                    <time>
                      {item.start_time || 'Time not set'}
                      {item.end_time ? `–${item.end_time}` : ''}
                    </time>
                    <strong>{item.course_name}</strong>
                    <span>{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      {semester?.timetable_filename && semester.classes.length === 0 && (
        <p className="assessment-empty">No classes were extracted yet. Replace or re-upload this PDF to try the updated timetable reader.</p>
      )}
      <section className="exam-panel">
        <div className="exam-panel-head">
          <div>
            <h2>Exam planner</h2>
            <p>{semester?.exam_timetable_filename || 'Upload this semester’s exam timetable to create a personalized revision plan.'}</p>
          </div>
          <label className="timetable-upload">
            <input type="file" accept="application/pdf,.pdf" disabled={uploadingExams || !semester}
                   onChange={(e) => {
                     const file = e.target.files[0];
                     if (file) uploadExamTimetable(file);
                     e.target.value = '';
                   }} />
            {uploadingExams ? 'Reading exam timetable…' : semester?.exam_timetable_filename ? 'Replace PDF' : 'Upload exam PDF'}
          </label>
        </div>
        {assessments.length > 0 && (
          <>
            <ul className="exam-list">
              {assessments.map((item) => (
                <li key={item.id}>
                  <time dateTime={item.date}>
                    {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </time>
                  <strong>{item.course_name} — {item.title}</strong>
                  {item.start_time && <span>{item.start_time}</span>}
                </li>
              ))}
            </ul>
            {units?.length > 0 && (
              <div className="understanding">
                <div>
                  <h3>How well do you understand each unit?</h3>
                  <p>Rate every unit so your revision plan can focus on what needs the most work.</p>
                </div>
                <div className="understanding-list">
                  {units.map((unit) => (
                    <label className="understanding-row" key={unit.id}>
                      <span>{unit.name}</span>
                      <select
                        className="pill"
                        aria-label={`Understanding level for ${unit.name}`}
                        value={understanding[unit.id] || ''}
                        onChange={(e) => {
                          setUnderstanding((current) => ({
                            ...current,
                            [unit.id]: Number(e.target.value),
                          }));
                          setStudyPlan('');
                        }}
                      >
                        <option value="">Choose a level</option>
                        <option value="1">1 — I do not understand it yet</option>
                        <option value="2">2 — I understand a little</option>
                        <option value="3">3 — I understand some topics</option>
                        <option value="4">4 — I understand most topics</option>
                        <option value="5">5 — I understand it well</option>
                      </select>
                    </label>
                  ))}
                </div>
                <button className="primary" disabled={!allUnitsRated || generatingPlan}
                        onClick={createStudyPlan}>
                  {generatingPlan ? 'Building your revision plan…' : 'Create my revision plan'}
                </button>
              </div>
            )}
            {units?.length === 0 && (
              <p className="assessment-empty">Add this semester’s units below before creating a revision plan.</p>
            )}
          </>
        )}
        {studyPlan && (
          <article className="study-plan">
            <h3>Your exam-period revision plan</h3>
            <p className="recap-source">
              {studyPlanSource === 'course_documents'
                ? 'Uses readable lecturer PDFs where available; general knowledge fills any gaps.'
                : 'No readable lecturer PDFs were found; this plan uses general knowledge.'}
            </p>
            <FormattedText>{studyPlan}</FormattedText>
          </article>
        )}
      </section>
      <Grid onOpen={(it) => onOpen({ id: it.id, name: it.name })}
            onEdit={renameUnit}
            onDelete={removeUnit}
            items={units && units.map((c) => ({
              id: c.id,
              name: c.name,
              editLabel: `unit ${c.name}`,
              removeMessage: `Remove "${c.name}" and permanently delete its uploaded PDFs and CATs?`,
              meta: c.document_count ? plural(c.document_count, 'file') : 'No files yet',
            }))}
            add={<NewUnit i={units ? units.length : 0}
                          onCreate={async (name) => {
                            const c = await api.createUnit(sem.id, name);
                            const nextUnits = [...units, { ...c, document_count: 0 }];
                            const nextSemester = { ...semester, courses: nextUnits };
                            setUnits(nextUnits);
                            setSemester(nextSemester);
                            semesterCache.set(sem.id, Promise.resolve(nextSemester));
                            invalidateYears();
                          }} />} />
    </>
  );
}
