import { useEffect, useState } from 'react';
import { api } from './api';

const TINTS = ['#FFD3BF', '#CFDCFF', '#CDEFD9', '#F9D5E8', '#FFEBA3', '#DCD2FA'];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

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

  useEffect(() => { api.years().then(setYears).catch((e) => setError(e.message)); }, []);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const free = years ? [1, 2, 3, 4, 5, 6].filter((n) => !years.some((y) => y.number === n)) : [];

  async function add(n) {
    try {
      const y = await api.createYear(n);
      setYears([...years, y].sort((a, b) => a.number - b.number));
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
  useEffect(() => { api.years().then((ys) => setY(ys.find((x) => x.id === year.id) || null)); }, [year.id]);
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
  useEffect(() => { api.semester(sem.id).then((s) => setUnits(s.courses)); }, [sem.id]);
  return (
    <>
      <h1>Semester {sem.number}</h1>
      <p className="sub">{units && units.length === 0 ? 'Add a unit, then drop your PDFs in.' : 'Pick a unit to keep studying.'}</p>
      <Grid onOpen={(it) => onOpen({ id: it.id, name: it.name })}
            items={units && units.map((c) => ({
              id: c.id, name: c.name, meta: c.document_count ? plural(c.document_count, 'file') : 'No files yet',
            }))}
            add={<NewUnit i={units ? units.length : 0}
                          onCreate={async (name) => {
                            const c = await api.createUnit(sem.id, name);
                            setUnits([...units, { ...c, document_count: 0 }]);
                          }} />} />
    </>
  );
}
