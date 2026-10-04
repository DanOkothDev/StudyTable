import { useEffect, useState } from 'react';
import { api } from './api';

const TINTS = ['#FFD3BF', '#CFDCFF', '#CDEFD9', '#F9D5E8', '#FFEBA3', '#DCD2FA'];

export default function Dashboard({ onOpen }) {
  const [courses, setCourses] = useState(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.courses().then(setCourses).catch((e) => setError(e.message));
  }, []);

  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return setAdding(false);
    try {
      const course = await api.createCourse(name.trim());
      setCourses([...courses, { ...course, document_count: 0 }]);
      setName('');
      setAdding(false);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1>{hello}</h1>
      <p className="sub">
        {courses && courses.length === 0 ? 'Make a box for each course, then drop your PDFs in.' : 'Pick a course to keep studying.'}
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="grid">
        {courses === null && [0, 1, 2].map((i) => <div className="folder skeleton" key={i} />)}
        {courses && courses.map((c, i) => (
          <button className="folder" key={c.id} onClick={() => onOpen(c)}
                  style={{ '--tint': TINTS[c.id % TINTS.length], '--i': i }}>
            <strong>{c.name}</strong>
            <span>{c.document_count === 0 ? 'No files yet' : `${c.document_count} ${c.document_count === 1 ? 'file' : 'files'}`}</span>
          </button>
        ))}
        {courses && (adding ? (
          <form className="folder new open" onSubmit={add} style={{ '--i': courses.length }}>
            <input autoFocus placeholder="Course name" value={name} maxLength={120}
                   onChange={(e) => setName(e.target.value)}
                   onBlur={() => !name.trim() && setAdding(false)}
                   onKeyDown={(e) => e.key === 'Escape' && setAdding(false)} />
            <span>Press Enter to save</span>
          </form>
        ) : (
          <button className="folder new" onClick={() => setAdding(true)} style={{ '--i': courses.length }}>
            <strong>New course</strong>
          </button>
        ))}
      </div>
    </>
  );
}
