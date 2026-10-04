async function req(path, opts = {}) {
  const res = await fetch("/api" + path, { credentials: "include", ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Try again.");
    err.status = res.status;
    throw err;
  }
  return data;
}

const send = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  me: () => req("/auth/me"),
  register: (email, password) =>
    req("/auth/register", send("POST", { email, password })),
  login: (email, password) =>
    req("/auth/login", send("POST", { email, password })),
  logout: () => req("/auth/logout", { method: "POST" }),
  courses: () => req("/courses"),
  createCourse: (name) => req("/courses", send("POST", { name })),
  documents: (courseId) => req(`/courses/${courseId}/documents`),
  view: (docId, page, seconds) =>
    req(`/documents/${docId}/pages/${page}/view`, send("POST", { seconds })),
  ask: (docId, page, question) =>
    req(`/documents/${docId}/pages/${page}/ask`, send("POST", { question })),
  pending: (courseId) => req(`/courses/${courseId}/pending-pages`),
  generate: (courseId) =>
    req(`/courses/${courseId}/flashcards/generate`, { method: "POST" }),
  due: (courseId) => req(`/courses/${courseId}/flashcards/due`),
  review: (cardId, correct) =>
    req(`/flashcards/${cardId}/review`, send("POST", { correct })),
  quick: (courseId) =>
    req(`/courses/${courseId}/quick-question`, { method: "POST" }),
  upload: (courseId, file) => {
    const form = new FormData();
    form.append("file", file);
    return req(`/courses/${courseId}/documents`, {
      method: "POST",
      body: form,
    });
  },
};
