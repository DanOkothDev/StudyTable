import { useState } from "react";
import { api } from "./api";
import Logo from "./Logo";

const styles = `
.auth { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.sx { display: grid; grid-template-columns: 1fr 1fr; width: min(100%, 880px); min-height: 540px; background: #fff; border-radius: 30px; overflow: hidden; box-shadow: 0 30px 60px -32px rgba(11, 77, 51, .4); animation: enter .6s var(--ease); }
.sx-panel { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 48px 40px; text-align: center; color: #fff; background: #0e7b50; border-radius: 0 210px 0 0; }
.sx-panel::before, .sx-panel::after { content: ""; position: absolute; border-radius: 50%; background: #0a5e3d; opacity: .55; animation: drift 14s ease-in-out infinite alternate; }
.sx-panel::before { width: 360px; height: 360px; right: -150px; top: -130px; }
.sx-panel::after { width: 240px; height: 240px; left: -90px; bottom: -80px; opacity: .4; animation-delay: -6s; }
@keyframes drift { to { transform: translate(-16px, 18px); } }
.sx-panel > * { position: relative; z-index: 1; }
.sx-logo { width: 176px; height: 99px; padding: 12px; border-radius: 22px; background: #fff; }
.sx-logo .logo-img { width: 100%; height: 100%; object-fit: contain; }
.sx-brand { font-weight: 700; font-size: 1.05rem; }
.sx-copy { margin-top: 24px; animation: enter .5s var(--ease); }
.sx-copy h2 { margin: 0 0 10px; font-size: 2rem; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
.sx-copy p { margin: 0 0 26px; color: rgba(255, 255, 255, .88); font-size: .95rem; }
.ghost { padding: 11px 30px; border: 1.5px solid rgba(255, 255, 255, .85); border-radius: 999px; color: #fff; font-size: .78rem; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; transition: background .25s, color .25s; }
.ghost:hover { background: #fff; color: #0e7b50; }
.sx-form { display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 48px clamp(28px, 6vw, 64px); }
.sx-head { text-align: center; animation: enter .45s var(--ease); }
.sx-head h1 { color: #0e7b50; font-size: 2.4rem; font-weight: 700; letter-spacing: -.03em; }
.sx-head .sub { margin: 8px 0 8px; font-size: .92rem; }
.sx-form label { display: block; }
.sx-form input { width: 100%; padding: 14px 22px; border: 0; border-radius: 999px; background: #cde8da; color: #0b4d33; }
.sx-form input::placeholder { color: #4d7a64; }
.sx-form input:focus { background: #d9f0e5; box-shadow: 0 0 0 4px rgba(20, 163, 110, .25); }
.sx-hint { margin-top: -6px; text-align: center; color: var(--muted); }
.sx-go { align-self: center; min-width: 160px; margin-top: 6px; padding: 13px 34px; border-radius: 999px; background: #14a36e; color: #fff; font-size: .78rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; transition: background .25s, color .25s, transform .15s; }
.sx-go:hover:not(:disabled) { background: var(--mark); color: var(--ink); }
.sx-go:active { transform: scale(.97); }
.sx-go:disabled { opacity: .6; cursor: wait; }
.sx-alt { margin: 4px 0 0; text-align: center; font-size: .88rem; color: var(--muted); }
.sx-alt button { color: #0e7b50; font-weight: 600; }
.sx-alt button:hover { text-decoration: underline; }
@media (max-width: 760px) {
  .sx { grid-template-columns: 1fr; min-height: 0; }
  .sx-panel { padding: 30px 24px 52px; border-radius: 0 0 120px 0; }
  .sx-copy { display: none; }
  .sx-form { padding: 28px 26px 34px; }
  .sx-head h1 { font-size: 2rem; }
  .sx-logo { width: 114px; height: 56px; padding: 3px; border-radius: 10px; }
}
`;

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
      <style>{styles}</style>
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
