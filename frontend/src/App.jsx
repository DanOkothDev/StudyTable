import { useEffect, useState } from "react";
import { api } from "./api";
import Logo from "./Logo";
import Auth from "./Auth";
import { Years, YearView, SemesterView } from "./Browse";
import Course from "./Course";
import Reader from "./Reader";

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = still checking the cookie
  const [nav, setNav] = useState({}); // { year, sem, course, doc }, as deep as you have gone

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  if (user === undefined)
    return (
      <div className="boot">
        <Logo size={64} alt="StudyTable" />
      </div>
    );
  if (!user) return <Auth onDone={setUser} />;

  async function logout() {
    await api.logout();
    setUser(null);
    setNav({});
  }

  const { year, sem, course, doc } = nav;
  const reading = course && doc;
  const crumbs = [];
  if (year) crumbs.push([`Year ${year.number}`, { year }]);
  if (sem) crumbs.push([`Semester ${sem.number}`, { year, sem }]);
  if (course) crumbs.push([course.name, { year, sem, course }]);

  return (
    <div className={"shell" + (reading ? " wide" : "")}>
      <header className="bar">
        <button className="mark logo" onClick={() => setNav({})}>
          <Logo size={30} />
          StudyTable
        </button>
        <button className="avatar" onClick={logout} aria-label="Log out">
          <span className="initial">{user.email[0].toUpperCase()}</span>
          <span className="out">Log out</span>
        </button>
      </header>
      {!reading && crumbs.length > 0 && (
        <nav className="crumbs" aria-label="Breadcrumb">
          <button onClick={() => setNav({})}>Home</button>
          {crumbs.map(([label, to], i) => (
            <span key={i}>
              <span className="sep">/</span>
              {i < crumbs.length - 1 ? (
                <button onClick={() => setNav(to)}>{label}</button>
              ) : (
                <span className="here">{label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <main
        className="page"
        key={[year?.id, sem?.id, course?.id, doc?.id].join("-")}
      >
        {reading ? (
          <Reader
            course={course}
            doc={doc}
            onBack={() => setNav({ year, sem, course })}
          />
        ) : course ? (
          <Course
            course={course}
            year={year}
            sem={sem}
            onBack={() => setNav({ year, sem })}
            onOpenDoc={(d) => setNav({ year, sem, course, doc: d })}
            onMoved={(y, s) => setNav({ year: y, sem: s, course })}
          />
        ) : sem ? (
          <SemesterView
            sem={sem}
            onOpen={(c) => setNav({ year, sem, course: c })}
          />
        ) : year ? (
          <YearView year={year} onOpen={(s) => setNav({ year, sem: s })} />
        ) : (
          <Years onOpen={(y) => setNav({ year: y })} />
        )}
      </main>
    </div>
  );
}
