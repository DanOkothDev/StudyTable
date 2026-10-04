# StudyTable

StudyTable is a student study app built to help you organize coursework, upload PDFs, track study progress, and turn course material into revision tools powered by Gemini AI.

The app combines a Flask backend with a React frontend so students can manage a year/semester structure, keep notes as course documents, and review material through flashcards, quick quizzes, and CAT-style assessments.

## What the app does

### 1. User accounts and study organization
- Register and log in with email/password authentication.
- Organize coursework by academic year, semester, and unit/course.
- Keep multiple PDFs attached to each course.
- Move courses between semesters when plans change.

### 2. PDF upload and reading workflow
- Upload PDF documents to a course.
- Extract readable text from each page using `pypdfium2`.
- Store page text in the database so the app can later search and analyse it.
- Display PDFs in the browser with `pdfjs-dist`.
- Track each page’s reading time and mark it as studied after a threshold is reached.

### 3. Study tracking and flashcards
- Record how long a student has spent on a page.
- Mark pages as studied once they pass the study threshold.
- Generate flashcards from studied pages that have not yet been converted.
- Review flashcards with a Leitner-style due system (`box` progression and due dates).
- Keep track of right/wrong answers and reschedule future review dates.

### 4. AI-powered tutoring and revision
The app uses Google Gemini for these functions:
- Ask questions about a page currently open in the reader.
- Get a short quick-question quiz while studying.
- Generate flashcards from course material.
- Generate CAT (Continuous Assessment Test) questions from course notes.
- Extract recurring semester classes from lecture timetables and generate pre-class recaps.
- Daily AI usage limits are enforced per user.

### 5. CAT assessments
- Build a CAT from selected course material.
- Generate multiple-choice questions with options and answer explanations.
- Submit answers and score each CAT.
- Keep a record of the CAT results and submitted state.

### 6. Lecture timetable reminders and preparation
- Upload a text-based PDF semester lecture timetable.
- Timetable PDFs must contain selectable text; scanned/image-only PDFs are not OCRed.
- Extract recurring class days, times, and course names with Gemini.
- See tomorrow's classes on the home page.
- Open a pre-class recap based on readable course PDFs, or on general knowledge when no readable course material is available.

## App architecture

### Backend
- Python + Flask
- SQLAlchemy for data models and queries
- Flask-Login for authentication
- Flask-Limiter for request throttling
- Flask-Migrate for schema migrations
- Local upload storage for PDFs
- Google GenAI integration in `ai.py`

### Frontend
- React + Vite
- PDF viewer powered by `pdfjs-dist`
- API requests are sent to `/api` with cookie-based session authentication

## Main project structure

- `app.py` – main Flask app, database models, routes, and study logic
- `ai.py` – Gemini prompt wrappers and response parsing
- `frontend/` – React frontend and assets
- `migrations/` – database migration scripts
- `uploads/` – uploaded PDF files
- `smoke_test.py` – basic end-to-end API smoke test

## Typical user flow

1. Create an account and log in.
2. Add a year and semester.
3. Create a course/unit.
4. Upload PDF files for that course.
5. Open a PDF and read pages.
6. The app records study time and populates pending pages.
7. Generate flashcards from studied material.
8. Use the AI tutor to ask questions about the current page.
9. Review cards until they are due again.
10. Generate CAT quizzes or quick questions when revision is needed.
11. Upload a lecture timetable to a semester and open next-day class preparation recaps from Home.

## Configuration

The app expects environment variables in a `.env` file. Typical values include:

- `DATABASE_URL`
- `SECRET_KEY`
- `FRONTEND_ORIGIN`
- `UPLOAD_DIR`
- `COOKIE_SECURE`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `DAILY_AI_LIMIT`

Example structure:

```env
FLASK_APP=app.py
DATABASE_URL=postgresql://user:password@localhost:5432/studytable
SECRET_KEY=change-me
FRONTEND_ORIGIN=http://localhost:5173
UPLOAD_DIR=uploads
COOKIE_SECURE=0
GEMINI_API_KEY=your-key
GEMINI_MODEL=gemini-3.8-flash
DAILY_AI_LIMIT=20
```

## Running the app

### Backend
```bash
pip install -r requirements.txt
flask db upgrade
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend typically runs on `http://localhost:5173` and the API runs on `http://localhost:5000`.

## Notes

- PDF uploads are accepted only as `.pdf` files.
- The app marks pages as studied after a fixed threshold (`STUDIED_AFTER_SECONDS`, currently 10 seconds).
- AI calls are rate-limited per user per day.
- Document text extraction is intentionally done using `pypdfium2` because it handles real-world PDFs efficiently compared with some simpler libraries.

## Summary

StudyTable is a study companion for organizing notes, tracking reading time, generating revision cards, and using AI to support learning from uploaded course material.
