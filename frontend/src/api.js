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
  profile: () => req("/profile"),
  saveProfile: (profile) => req("/profile", send("PUT", profile)),
  todayInsight: () => req("/insights/today"),
  courses: () => req("/courses"),
  createCourse: (name) => req("/courses", send("POST", { name })),
  documents: (courseId) => req(`/courses/${courseId}/documents`),
  view: (docId, page, seconds) =>
    req(`/documents/${docId}/pages/${page}/view`, send("POST", { seconds })),
  ask: (docId, page, question, history = []) =>
    req(
      `/documents/${docId}/pages/${page}/ask`,
      send("POST", { question, history }),
    ),
  pending: (courseId) => req(`/courses/${courseId}/pending-pages`),
  generate: (courseId) =>
    req(`/courses/${courseId}/flashcards/generate`, { method: "POST" }),
  due: (courseId) => req(`/courses/${courseId}/flashcards/due`),
  review: (cardId, correct) =>
    req(`/flashcards/${cardId}/review`, send("POST", { correct })),
  quick: (courseId) =>
    req(`/courses/${courseId}/quick-question`, { method: "POST" }),
  cats: (courseId) => req(`/courses/${courseId}/cats`),
  createCat: (courseId, body) =>
    req(`/courses/${courseId}/cats`, send("POST", body)),
  cat: (id) => req(`/cats/${id}`),
  submitCat: (id, answers) =>
    req(`/cats/${id}/submit`, send("POST", { answers })),
  deleteCat: (id) => req(`/cats/${id}`, { method: "DELETE" }),
  years: () => req("/years"),
  createYear: (number) => req("/years", send("POST", number ? { number } : {})),
  createSemester: (yearId) =>
    req(`/years/${yearId}/semesters`, send("POST", {})),
  semester: (id) => req(`/semesters/${id}`),
  updateSemester: (id, number) =>
    req(`/semesters/${id}`, send("PATCH", { number })),
  deleteSemester: (id) => req(`/semesters/${id}`, { method: "DELETE" }),
  classes: (date) => req(`/classes?date=${encodeURIComponent(date)}`),
  classRecap: (id) => req(`/classes/${id}/recap`, { method: "POST" }),
  uploadTimetable: (semesterId, file) => {
    const form = new FormData();
    form.append("file", file);
    return req(`/semesters/${semesterId}/timetable`, {
      method: "POST",
      body: form,
    });
  },
  uploadExamTimetable: (semesterId, file) => {
    const form = new FormData();
    form.append("file", file);
    return req(`/semesters/${semesterId}/exam-timetable`, {
      method: "POST",
      body: form,
    });
  },
  examStudyPlan: (semesterId, understanding) =>
    req(`/semesters/${semesterId}/study-plan`, send("POST", { understanding })),
  createUnit: (semesterId, name) =>
    req("/courses", send("POST", { name, semester_id: semesterId })),
  updateUnit: (id, name) => req(`/courses/${id}`, send("PATCH", { name })),
  deleteUnit: (id) => req(`/courses/${id}`, { method: "DELETE" }),
  moveCourse: (id, semesterId) =>
    req(`/courses/${id}`, send("PATCH", { semester_id: semesterId })),
  deleteDocument: (id) => req(`/documents/${id}`, { method: "DELETE" }),
  upload: (courseId, file) => {
    const form = new FormData();
    form.append("file", file);
    return req(`/courses/${courseId}/documents`, {
      method: "POST",
      body: form,
    });
  },
};
