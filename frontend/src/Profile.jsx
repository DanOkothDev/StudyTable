import { useEffect, useState } from "react";
import { api } from "./api";
import FormattedText from "./FormattedText";

const emptyProfile = {
  school: "",
  program: "",
  year_of_study: "",
  interests: "",
};

export default function Profile({ email, onBack, onLogout }) {
  const [profile, setProfile] = useState(emptyProfile);
  const [loaded, setLoaded] = useState(false);
  const [insight, setInsight] = useState(null);
  const [error, setError] = useState("");
  const [insightError, setInsightError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);

  async function loadInsight() {
    setLoadingInsight(true);
    setInsightError("");
    try {
      setInsight(await api.todayInsight());
    } catch (e) {
      setInsightError(e.message);
    } finally {
      setLoadingInsight(false);
    }
  }

  useEffect(() => {
    let active = true;
    api.profile()
      .then((data) => {
        if (!active) return;
        setProfile({
          ...emptyProfile,
          ...data,
          year_of_study: data.year_of_study || "",
        });
        setLoaded(true);
        if (data.school && data.program) {
          setLoadingInsight(true);
          api.todayInsight()
            .then((result) => active && setInsight(result))
            .catch((e) => active && setInsightError(e.message))
            .finally(() => active && setLoadingInsight(false));
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoaded(true);
        }
      });
    return () => { active = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setInsight(null);
    setInsightError("");
    try {
      const saved = await api.saveProfile({
        ...profile,
        year_of_study: profile.year_of_study ? Number(profile.year_of_study) : null,
      });
      setProfile({
        ...saved,
        year_of_study: saved.year_of_study || "",
      });
      await loadInsight();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p role="status">Loading your profile…</p>;

  const complete = Boolean(profile.school && profile.program);

  return (
    <>
      <button className="back" onClick={onBack}>Back home</button>
      <h1>Your profile</h1>
      <p className="sub">Personalize your study support and daily course insights.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <form className="profile-form" onSubmit={submit}>
        <p className="profile-email">Signed in as {email}</p>
        <label>
          School or university
          <input required maxLength={160} value={profile.school}
                 placeholder="e.g. University of Nairobi"
                 onChange={(e) => setProfile({ ...profile, school: e.target.value })} />
        </label>
        <label>
          Course or program
          <input required maxLength={160} value={profile.program}
                 placeholder="e.g. Bachelor of Information Technology"
                 onChange={(e) => setProfile({ ...profile, program: e.target.value })} />
        </label>
        <label>
          Year of study <small>Optional</small>
          <input type="number" min="1" max="12" value={profile.year_of_study}
                 placeholder="e.g. 2"
                 onChange={(e) => setProfile({ ...profile, year_of_study: e.target.value })} />
        </label>
        <label>
          Areas you are interested in <small>Optional; separate topics with commas</small>
          <input maxLength={500} value={profile.interests}
                 placeholder="e.g. cybersecurity, cloud computing, data science"
                 onChange={(e) => setProfile({ ...profile, interests: e.target.value })} />
        </label>
        <div className="profile-actions">
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving and researching…" : "Save profile"}
          </button>
          <button className="profile-logout" type="button" onClick={onLogout}>Log out</button>
        </div>
      </form>
      <section className="daily-insight" aria-labelledby="daily-insight-title">
        <div className="daily-insight-head">
          <div>
            <h2 id="daily-insight-title">Daily course insight</h2>
            <p>Course and career guidance. Gemini insights include live search sources.</p>
          </div>
        </div>
        {!complete ? (
          <p className="insight-hint">Add your school and course above to get a personalized insight.</p>
        ) : insight ? (
          <article>
            <p className="insight-date">
              Today · {new Date(`${insight.generated_for}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long", month: "long", day: "numeric",
              })}
            </p>
            <p className="insight-provider">
              {insight.provider === "Gemini" && insight.sources.length
                ? "Live web research · Gemini"
                : `${insight.provider} · Based on model knowledge, not live web search`}
            </p>
            <FormattedText className="insight-content">{insight.content}</FormattedText>
            {insight.sources.length > 0 && (
              <>
                <h3>Sources</h3>
                <ul className="insight-sources">
                  {insight.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </article>
        ) : loadingInsight ? (
          <p role="status">Preparing today&apos;s course insight…</p>
        ) : insightError ? (
          <div>
            <p className="error" role="alert">{insightError}</p>
            <button className="primary" onClick={loadInsight}>Try again</button>
          </div>
        ) : null}
      </section>
    </>
  );
}
