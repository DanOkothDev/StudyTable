import { useEffect, useState } from 'react';
import { api } from './api';
import Auth from './Auth';
import Dashboard from './Dashboard';
import Course from './Course';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking the cookie
  const [course, setCourse] = useState(null);

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="boot"><span /></div>;
  if (!user) return <Auth onDone={setUser} />;

  async function logout() {
    await api.logout();
    setUser(null);
    setCourse(null);
  }

  return (
    <div className="shell">
      <header className="bar">
        <button className="mark" onClick={() => setCourse(null)}>StudyTable</button>
        <button className="avatar" onClick={logout} aria-label="Log out">
          <span className="initial">{user.email[0].toUpperCase()}</span>
          <span className="out">Log out</span>
        </button>
      </header>
      <main className="page" key={course ? course.id : 'home'}>
        {course
          ? <Course course={course} onBack={() => setCourse(null)} />
          : <Dashboard onOpen={setCourse} />}
      </main>
    </div>
  );
}
