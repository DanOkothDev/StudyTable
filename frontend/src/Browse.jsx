import { useEffect, useState } from 'react';
import { api } from './api';
import FormattedText from './FormattedText';

const TINTS = ['#FFD3BF', '#CFDCFF', '#CDEFD9', '#F9D5E8', '#FFEBA3', '#DCD2FA'];
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

function Grid({ items, onOpen, add }) {
  return (
    <div className="grid">
      {items === null && [0, 1, 2].map((i) => <div className="folder skeleton" key={i} />)}
      {items && items.map((it, i) => (
        <button className="folder" key={it.id} onClick={() => onOpen(it)}
                style={{ '--tint': TINTS[it.id % TINTS.length], '--i': i }}>
          <strong>{it.name}</strong>
          <span>{it.meta}</span>
        </button>
      ))}
      {items && add}
    </div>
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
  useEffect(() => {
    loadYears().then((ys) => setY(ys.find((x) => x.id === year.id) || null));
  }, [year.id]);
  return (
    <>
      <h1>Year {year.number}</h1>
      <p className="sub">Choose a semester.</p>
      <Grid onOpen={(it) => onOpen({ id: it.id, number: it.raw.number })}
            items={y && y.semesters.map((s) => ({
              id: s.id, name: `Semester ${s.number}`, raw: s,
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
      const next = { ...semester, timetable_filename: result.timetable_filename, classes: result.classes };
      setSemester(next);
      semesterCache.set(sem.id, Promise.resolve(next));
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

  const classDays = WEEKDAYS.map((name, weekday) => ({
    name,
    sessions: (semester?.classes || []).filter((item) => item.weekday === weekday),
  })).filter((day) => day.sessions.length > 0);
  const assessments = semester?.assessments || [];
  const allUnitsRated = Boolean(units?.length) && units.every((unit) => understanding[unit.id]);

  return (
    <>
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
            items={units && units.map((c) => ({
              id: c.id, name: c.name, meta: c.document_count ? plural(c.document_count, 'file') : 'No files yet',
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
