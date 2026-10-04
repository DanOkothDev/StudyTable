import { useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./Auth";
import Dashboard from "./Dashboard";
import Course from "./Course";
import Reader from "./Reader";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking the cookie
  const [course, setCourse] = useState(null);
  const [doc, setDoc] = useState(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined)
    return (
      <div className="boot">
        <span />
      </div>
    );
  if (!user) return <Auth onDone={setUser} />;

  async function logout() {
    await api.logout();
    setUser(null);
    setCourse(null);
    setDoc(null);
  }
  const home = () => {
    setCourse(null);
    setDoc(null);
  };
  const reading = course && doc;

  return (
    <div className={"shell" + (reading ? " wide" : "")}>
      <header className="bar">
        <button className="mark" onClick={home}>
          StudyTable
        </button>
        <button className="avatar" onClick={logout} aria-label="Log out">
          <span className="initial">{user.email[0].toUpperCase()}</span>
          <span className="out">Log out</span>
        </button>
      </header>
      <main
        className="page"
        key={reading ? "d" + doc.id : course ? "c" + course.id : "home"}
      >
        {reading ? (
          <Reader course={course} doc={doc} onBack={() => setDoc(null)} />
        ) : course ? (
          <Course course={course} onBack={home} onOpenDoc={setDoc} />
        ) : (
          <Dashboard onOpen={setCourse} />
        )}
      </main>
    </div>
  );
}
