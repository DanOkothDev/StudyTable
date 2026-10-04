import { useState } from "react";
import { api } from "./api";
import Logo from "./Logo";

const COPY = {
  login: {
    hi: "Welcome back!",
    text: "Pick up where you left off. Your notes, cards and CATs are waiting.",
    swap: "Create account",
    title: "welcome",
    sub: "Log in to your account to continue",
    go: "Log in",
    alt: "Don't have an account?",
    altLink: "Sign up",
  },
  signup: {
    hi: "Hello, friend!",
    text: "Make a space for every year, semester and unit you study.",
    swap: "I have an account",
    title: "get started",
    sub: "Create your account to continue",
    go: "Create account",
    alt: "Already have an account?",
    altLink: "Log in",
  },
};

export default function Auth({ onDone }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const t = COPY[mode];

  const flip = () => {
    setMode(signup ? "login" : "signup");
    setError("");
  };

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await (signup ? api.register : api.login)(email, password));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="sx">
        <aside className="sx-panel">
          <div className="sx-logo">
            <Logo />
          </div>
          <div className="sx-brand">StudyTable</div>
          <div className="sx-copy" key={mode}>
            <h2>{t.hi}</h2>
            <p>{t.text}</p>
            <button type="button" className="ghost" onClick={flip}>
              {t.swap}
            </button>
          </div>
        </aside>

        <form className="sx-form" onSubmit={submit}>
          <div className="sx-head" key={mode}>
            <h1>{t.title}</h1>
            <p className="sub">{t.sub}</p>
          </div>
          <label>
            <span className="sr">Email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span className="sr">Password</span>
            <input
              type="password"
              required
              minLength={signup ? 8 : undefined}
              placeholder="Password"
              autoComplete={signup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {signup && <small className="sx-hint">At least 8 characters</small>}
          {error && (
            <p
              className="error"
              role="alert"
              style={{ textAlign: "center", margin: 0 }}
            >
              {error}
            </p>
          )}
          <button className="sx-go" disabled={busy}>
            {busy ? "One moment…" : t.go}
          </button>
          <p className="sx-alt">
            {t.alt}{" "}
            <button type="button" onClick={flip}>
              {t.altLink}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
