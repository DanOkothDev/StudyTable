import os
import re
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import (LoginManager, UserMixin, current_user,
                         login_required, login_user, logout_user)
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
import pypdfium2 as pdfium
from sqlalchemy import func
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

import ai  # noqa: E402  (after load_dotenv so GEMINI_MODEL is read from .env)

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]          # signs the login cookie
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024          # 50 MB per upload
app.config["SESSION_COOKIE_HTTPONLY"] = True                 # JavaScript can't read the cookie
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "0") == "1"  # 1 once on https

CORS(app, supports_credentials=True,
     origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")])

db = SQLAlchemy(app)
migrate = Migrate(app, db)
login_manager = LoginManager(app)
# Rate limiter: slows down password guessing. Counts are kept in memory (reset on restart).
limiter = Limiter(get_remote_address, app=app, default_limits=[], storage_uri="memory://")

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

STUDIED_AFTER_SECONDS = 10                                   # total seconds on a page to count as studied
DAILY_AI_LIMIT = int(os.environ.get("DAILY_AI_LIMIT", "20"))  # Gemini calls per user per day
AI_BURST_LIMIT = int(os.environ.get("AI_BURST_LIMIT", "2"))
AI_BURST_WINDOW_SECONDS = int(os.environ.get("AI_BURST_WINDOW_SECONDS", "10"))
MAX_PAGES_PER_BATCH = 8                                      # pages sent to Gemini per "make cards" click
PAGE_CHAR_LIMIT = 3000                                       # text per page sent to Gemini
CAT_MAX_PAGES = 15                                           # pages sampled for one CAT
CAT_PAGE_CHARS = 2000
BOX_INTERVAL_DAYS = {1: 0, 2: 1, 3: 3, 4: 7, 5: 14}          # Leitner boxes: days until a card returns
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
AI_CALL_LOCK = threading.Lock()
AI_BURST_TIMES = defaultdict(deque)
AI_BURST_LOCK = threading.Lock()


def extract_pages(path):
    """Text of every page. pdfium is far faster than pypdf on real-world PDFs."""
    pdf = pdfium.PdfDocument(str(path))
    try:
        texts = []
        for i in range(len(pdf)):
            page = pdf[i]
            textpage = page.get_textpage()
            # Postgres refuses NUL characters in text, so strip them
            texts.append(textpage.get_text_range().replace("\x00", "").strip())
            textpage.close()
            page.close()
        return texts
    finally:
        pdf.close()


def extract_timetable_layout(path):
    """Preserve PDF text positions so weekly timetable rows and columns stay associated."""
    pdf = pdfium.PdfDocument(str(path))
    try:
        pages = []
        for page_number in range(len(pdf)):
            page = pdf[page_number]
            textpage = page.get_textpage()
            text = textpage.get_text_range().replace("\x00", "").strip()
            width, _ = page.get_size()
            weekdays = {}
            for match in re.finditer(
                    r"\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b",
                    text, re.IGNORECASE):
                boxes = [textpage.get_charbox(i) for i in range(match.start(), match.end())]
                x = sum((box[0] + box[2]) / 2 for box in boxes) / len(boxes)
                y = sum((box[1] + box[3]) / 2 for box in boxes) / len(boxes)
                if x < width * 0.2:
                    weekdays[match.group().capitalize()] = y

            if not weekdays:
                pages.append(text)
                textpage.close()
                page.close()
                continue

            ordered_days = sorted(weekdays.items(), key=lambda item: item[1], reverse=True)
            row_gaps = [ordered_days[i][1] - ordered_days[i + 1][1]
                        for i in range(len(ordered_days) - 1)]
            row_threshold = min(16, min(row_gaps) * 0.46) if row_gaps else 16

            hours = []
            for match in re.finditer(r"\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}", text):
                boxes = [textpage.get_charbox(i) for i in range(match.start(), match.end())]
                left = min(box[0] for box in boxes)
                right = max(box[2] for box in boxes)
                hours.append((left, right, match.group().replace(" ", "")))

            entries = {day: [] for day, _ in ordered_days}
            for line in re.finditer(r"[^\r\n]+", text):
                glyphs = []
                for index in range(line.start(), line.end()):
                    char = text[index]
                    if char.isspace():
                        continue
                    left, bottom, right, top = textpage.get_charbox(index)
                    if right > left and top > bottom:
                        glyphs.append((index, char, left, bottom, right, top))
                segments = []
                current = []
                for glyph in glyphs:
                    if current and glyph[2] - current[-1][4] > 18:
                        segments.append(current)
                        current = []
                    current.append(glyph)
                if current:
                    segments.append(current)

                for segment in segments:
                    start, end = segment[0][0], segment[-1][0] + 1
                    value = text[start:end].strip()
                    if not value:
                        continue
                    center_y = sum((glyph[3] + glyph[5]) / 2 for glyph in segment) / len(segment)
                    center_x = sum((glyph[2] + glyph[4]) / 2 for glyph in segment) / len(segment)
                    day, day_y = min(ordered_days, key=lambda item: abs(item[1] - center_y))
                    if abs(day_y - center_y) > row_threshold or center_x < width * 0.12:
                        continue
                    if re.fullmatch(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)",
                                    value, re.IGNORECASE):
                        continue
                    entries[day].append((center_x, center_y, value))

            lines = ["Weekly timetable layout (PDF x coordinates increase from left to right)."]
            if hours:
                header = ", ".join(
                    f"x={left:.0f}-{right:.0f}: {label}" for left, right, label in sorted(hours))
                lines.append(f"Hour headers: {header}")
            for day, _ in ordered_days:
                fragments = sorted(entries[day], key=lambda item: (-item[1], item[0]))
                if fragments:
                    lines.append(f"{day} row:")
                    lines.extend(
                        f"  x={x:.0f}, y={y:.0f}: {value}" for x, y, value in fragments)
            pages.append("\n".join(lines))
            textpage.close()
            page.close()
        return pages
    finally:
        pdf.close()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)   # UTC, stored without tzinfo


# ---------- Models (tables) ----------

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    courses = db.relationship("Course", backref="user", cascade="all, delete-orphan")
    __table_args__ = (db.Index("ix_user_email", "email"),)


class Year(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    number = db.Column(db.Integer, nullable=False)              # 1 = Year 1
    semesters = db.relationship("Semester", backref="year", cascade="all, delete-orphan",
                                order_by="Semester.number")
    __table_args__ = (db.UniqueConstraint("user_id", "number"),
                      db.Index("ix_year_user_number", "user_id", "number"))


class Semester(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    year_id = db.Column(db.Integer, db.ForeignKey("year.id"), nullable=False)
    number = db.Column(db.Integer, nullable=False)              # 1 or 2
    courses = db.relationship("Course", backref="semester")     # a unit is a Course
    timetable_filename = db.Column(db.String(255), nullable=True)
    timetable_stored_name = db.Column(db.String(255), nullable=True)
    assessments = db.relationship("Assessment", backref="semester", cascade="all, delete-orphan",
                                  order_by="Assessment.date")
    classes = db.relationship("ClassSession", backref="semester", cascade="all, delete-orphan",
                              order_by="ClassSession.weekday, ClassSession.start_time")
    __table_args__ = (db.UniqueConstraint("year_id", "number"),
                      db.Index("ix_semester_year_number", "year_id", "number"))


class Assessment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey("semester.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=True)
    course_name = db.Column(db.String(120), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    date = db.Column(db.Date, nullable=False)
    __table_args__ = (db.Index("ix_assessment_semester_date", "semester_id", "date"),
                      db.Index("ix_assessment_date", "date"))


class ClassSession(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    semester_id = db.Column(db.Integer, db.ForeignKey("semester.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=True)
    course_name = db.Column(db.String(120), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    weekday = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    __table_args__ = (db.Index("ix_class_session_semester_weekday", "semester_id", "weekday"),
                      db.Index("ix_class_session_weekday", "weekday"))


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    semester_id = db.Column(db.Integer, db.ForeignKey("semester.id"), nullable=True)
    name = db.Column(db.String(120), nullable=False)
    documents = db.relationship("Document", backref="course", cascade="all, delete-orphan")
    cats = db.relationship("Cat", backref="course", cascade="all, delete-orphan")
    class_sessions = db.relationship("ClassSession", backref="course")
    __table_args__ = (db.UniqueConstraint("user_id", "name"),
                      db.Index("ix_course_user_name", "user_id", "name"),
                      db.Index("ix_course_user_semester", "user_id", "semester_id"))


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    page_count = db.Column(db.Integer, nullable=False)
    pages = db.relationship("Page", backref="document", cascade="all, delete-orphan")
    flashcards = db.relationship("Flashcard", backref="document", cascade="all, delete-orphan")
    __table_args__ = (db.Index("ix_document_course_id", "course_id"),)


class Page(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("document.id"), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)       # starts at 1
    text = db.Column(db.Text, nullable=False, default="")
    seconds_spent = db.Column(db.Integer, nullable=False, default=0)
    studied = db.Column(db.Boolean, nullable=False, default=False)
    cards_made = db.Column(db.Boolean, nullable=False, default=False)
    __table_args__ = (db.UniqueConstraint("document_id", "page_number"),
                      db.Index("ix_page_document_page", "document_id", "page_number"),
                      db.Index("ix_page_study_cards", "document_id", "studied", "cards_made"),
                      db.Index("ix_page_document_studied", "document_id", "studied"),
                      db.Index("ix_page_document_cards_made", "document_id", "cards_made"))


class Flashcard(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("document.id"), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    box = db.Column(db.Integer, nullable=False, default=1)          # Leitner box 1 (new/weak) to 5 (known)
    times_right = db.Column(db.Integer, nullable=False, default=0)
    times_wrong = db.Column(db.Integer, nullable=False, default=0)
    due_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    __table_args__ = (db.Index("ix_flashcard_document_page", "document_id", "page_number"),
                      db.Index("ix_flashcard_due_at", "due_at"),
                      db.Index("ix_flashcard_document_due", "document_id", "due_at"))


class AiUsage(db.Model):
    """How many Gemini calls a user has made on a given day (UTC)."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    day = db.Column(db.Date, nullable=False)
    count = db.Column(db.Integer, nullable=False, default=0)
    __table_args__ = (db.UniqueConstraint("user_id", "day"),
                      db.Index("ix_ai_usage_user_day", "user_id", "day"))


class Cat(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    score = db.Column(db.Integer, nullable=True)                    # number correct
    questions = db.relationship("CatQuestion", backref="cat", cascade="all, delete-orphan",
                                order_by="CatQuestion.position")
    __table_args__ = (db.Index("ix_cat_course_created", "course_id", "created_at"),)


class CatQuestion(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    cat_id = db.Column(db.Integer, db.ForeignKey("cat.id"), nullable=False)
    position = db.Column(db.Integer, nullable=False)
    question = db.Column(db.Text, nullable=False)
    options = db.Column(db.JSON, nullable=False)                    # list of 4 strings
    correct_index = db.Column(db.Integer, nullable=False)
    explanation = db.Column(db.Text, nullable=False, default="")
    chosen_index = db.Column(db.Integer, nullable=True)
    __table_args__ = (db.Index("ix_cat_question_cat_position", "cat_id", "position"),)


# ---------- Login plumbing and errors ----------

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(error="login required"), 401


@app.errorhandler(404)
def not_found(_):
    return jsonify(error="not found"), 404


@app.errorhandler(405)
def bad_method(_):
    return jsonify(error="method not allowed"), 405


@app.errorhandler(413)
def too_large(_):
    return jsonify(error="file is too large (limit is 50 MB)"), 413


@app.errorhandler(429)
def too_many(_):
    return jsonify(error="too many attempts, wait a bit and try again"), 429


# ---------- Ownership checks (a record that isn't yours returns 404) ----------

def owned_course_or_404(course_id):
    return Course.query.filter_by(id=course_id, user_id=current_user.id).first_or_404()


def owned_semester_or_404(semester_id):
    return (Semester.query.join(Year)
            .filter(Semester.id == semester_id, Year.user_id == current_user.id).first_or_404())


def new_year(number):
    year = Year(user_id=current_user.id, number=number)
    year.semesters = [Semester(number=1), Semester(number=2)]
    db.session.add(year)
    return year


def adopt_orphans():
    """Units made before years existed (no semester yet) are filed under Year 2, Semester 1."""
    orphans = Course.query.filter_by(user_id=current_user.id, semester_id=None).all()
    if not orphans:
        return
    year = Year.query.filter_by(user_id=current_user.id, number=2).first() or new_year(2)
    sem = next(s for s in year.semesters if s.number == 1)
    for c in orphans:
        c.semester = sem
    db.session.commit()


def year_json(y):
    return {"id": y.id, "number": y.number,
            "semesters": [{"id": s.id, "number": s.number, "unit_count": len(s.courses)} for s in y.semesters]}


def owned_document_or_404(doc_id):
    return (Document.query.join(Course)
            .filter(Document.id == doc_id, Course.user_id == current_user.id).first_or_404())


def owned_page_or_404(doc_id, page_number):
    doc = owned_document_or_404(doc_id)
    return Page.query.filter_by(document_id=doc.id, page_number=page_number).first_or_404()


def owned_flashcard_or_404(card_id):
    return (Flashcard.query.join(Document, Flashcard.document_id == Document.id)
            .join(Course, Document.course_id == Course.id)
            .filter(Flashcard.id == card_id, Course.user_id == current_user.id).first_or_404())


def owned_cat_or_404(cat_id):
    return (Cat.query.join(Course)
            .filter(Cat.id == cat_id, Course.user_id == current_user.id).first_or_404())


# ---------- Daily AI limit ----------

def ai_calls_today():
    row = AiUsage.query.filter_by(user_id=current_user.id, day=utcnow().date()).first()
    return row.count if row else 0


def ai_burst_block():
    """Protect against rapid bursts of AI requests from a single user."""
    now = time.monotonic()
    with AI_BURST_LOCK:
        bucket = AI_BURST_TIMES[current_user.id]
        while bucket and bucket[0] <= now - AI_BURST_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= AI_BURST_LIMIT:
            return jsonify(error="Too many AI requests right now. Please wait a moment."), 429
        bucket.append(now)
    return None


def quota_block():
    """Returns an error response if the user is out of AI calls today, else None."""
    if ai_calls_today() >= DAILY_AI_LIMIT:
        return jsonify(error=f"You've used your {DAILY_AI_LIMIT} AI requests for today. "
                             "They reset at midnight UTC."), 429
    return ai_burst_block()


def record_ai_call():
    """Adds one to today's count. The caller commits."""
    row = AiUsage.query.filter_by(user_id=current_user.id, day=utcnow().date()).first()
    if row is None:
        row = AiUsage(user_id=current_user.id, day=utcnow().date(), count=0)
        db.session.add(row)
    row.count += 1


@app.get("/api/ai/usage")
@login_required
def ai_usage():
    return jsonify(used=ai_calls_today(), limit=DAILY_AI_LIMIT)


# ---------- JSON helpers ----------

def course_document_counts(course_ids):
    if not course_ids:
        return {}
    rows = (db.session.query(Document.course_id, func.count(Document.id).label("count"))
            .filter(Document.course_id.in_(course_ids))
            .group_by(Document.course_id).all())
    return {course_id: count for course_id, count in rows}


def empty_page_counts(document_ids):
    if not document_ids:
        return {}
    rows = (db.session.query(Page.document_id, func.count(Page.id).label("count"))
            .filter(Page.document_id.in_(document_ids), Page.text == "")
            .group_by(Page.document_id).all())
    return {document_id: count for document_id, count in rows}


def doc_json(d, empty_pages=None):
    scanned = empty_pages if empty_pages is not None else Page.query.filter_by(document_id=d.id, text="").count()
    return {"id": d.id, "course_id": d.course_id, "filename": d.filename,
            "page_count": d.page_count, "empty_pages": scanned}


def card_json(c):
    return {"id": c.id, "document_id": c.document_id, "page_number": c.page_number,
            "question": c.question, "answer": c.answer, "box": c.box,
            "times_right": c.times_right, "times_wrong": c.times_wrong,
            "due_at": c.due_at.isoformat()}


def cat_summary(c):
    return {"id": c.id, "course_id": c.course_id, "title": c.title,
            "created_at": c.created_at.isoformat(), "total": len(c.questions),
            "submitted": c.submitted_at is not None, "score": c.score}


def assessment_json(assessment):
    return {"id": assessment.id, "semester_id": assessment.semester_id,
            "course_id": assessment.course_id, "course_name": assessment.course_name,
            "title": assessment.title, "date": assessment.date.isoformat()}


def class_session_json(session):
    return {"id": session.id, "semester_id": session.semester_id,
            "course_id": session.course_id, "course_name": session.course_name,
            "title": session.title, "weekday": session.weekday,
            "start_time": session.start_time.strftime("%H:%M") if session.start_time else None,
            "end_time": session.end_time.strftime("%H:%M") if session.end_time else None}


def cat_json(c, reveal):
    out = cat_summary(c)
    qs = []
    for q in c.questions:
        item = {"id": q.id, "position": q.position, "question": q.question, "options": q.options}
        if reveal:
            item.update(correct_index=q.correct_index, explanation=q.explanation,
                        chosen_index=q.chosen_index)
        qs.append(item)
    out["questions"] = qs
    return out


def ai_failure(err):
    return jsonify(error=str(err)), 502


# ---------- Auth ----------

@app.post("/api/auth/register")
@limiter.limit("10 per hour")
def register():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not EMAIL_RE.match(email):
        return jsonify(error="enter a valid email"), 400
    if len(password) < 8:
        return jsonify(error="password must be at least 8 characters"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="that email is already registered"), 409
    user = User(email=email, password_hash=generate_password_hash(password))
    db.session.add(user)
    db.session.commit()
    login_user(user)
    return jsonify(id=user.id, email=user.email), 201


@app.post("/api/auth/login")
@limiter.limit("10 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify(error="invalid email or password"), 401
    login_user(user)
    return jsonify(id=user.id, email=user.email)


@app.post("/api/auth/logout")
@login_required
def logout():
    logout_user()
    return jsonify(ok=True)


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify(id=current_user.id, email=current_user.email)


# ---------- Courses ----------

@app.get("/api/courses")
@login_required
def list_courses():
    courses = Course.query.filter_by(user_id=current_user.id).order_by(Course.name).all()
    counts = course_document_counts([c.id for c in courses])
    return jsonify([{"id": c.id, "name": c.name, "document_count": counts.get(c.id, 0)} for c in courses])


@app.get("/api/years")
@login_required
def list_years():
    adopt_orphans()
    years = Year.query.filter_by(user_id=current_user.id).order_by(Year.number).all()
    return jsonify([year_json(y) for y in years])


@app.post("/api/years")
@login_required
def create_year():
    taken = [y.number for y in Year.query.filter_by(user_id=current_user.id)]
    number = (request.get_json(silent=True) or {}).get("number")
    if number is None:
        number = max(taken, default=0) + 1
    if not isinstance(number, int) or isinstance(number, bool) or not 1 <= number <= 8:
        return jsonify(error="year must be a number from 1 to 8"), 400
    if number in taken:
        return jsonify(error=f"Year {number} already exists"), 409
    year = new_year(number)
    db.session.commit()
    return jsonify(year_json(year)), 201


@app.get("/api/semesters/<int:semester_id>")
@login_required
def get_semester(semester_id):
    sem = owned_semester_or_404(semester_id)
    units = sorted(sem.courses, key=lambda c: c.name.lower())
    return jsonify(id=sem.id, number=sem.number, year={"id": sem.year.id, "number": sem.year.number},
                   courses=[{"id": c.id, "name": c.name, "document_count": len(c.documents)} for c in units],
                   timetable_filename=sem.timetable_filename,
                   classes=[class_session_json(session) for session in sem.classes])


@app.post("/api/semesters/<int:semester_id>/timetable")
@login_required
def upload_timetable(semester_id):
    sem = owned_semester_or_404(semester_id)
    file = request.files.get("file")
    if not file or not file.filename.lower().endswith(".pdf"):
        return jsonify(error="upload a .pdf timetable in the 'file' field"), 400

    stored_name = f"{uuid.uuid4().hex}.pdf"
    path = UPLOAD_DIR / stored_name
    file.save(path)
    try:
        pages = extract_timetable_layout(path)
    except Exception:
        path.unlink(missing_ok=True)
        return jsonify(error="could not read that timetable PDF"), 400
    timetable_text = "\n\n".join(text for text in pages if text).strip()
    if not timetable_text:
        path.unlink(missing_ok=True)
        return jsonify(error="this PDF has no readable text; upload a text-based timetable PDF"), 400

    blocked = quota_block()
    if blocked:
        path.unlink(missing_ok=True)
        return blocked

    courses = sorted(sem.courses, key=lambda c: c.name.lower())
    try:
        parsed = ai.extract_classes([course.name for course in courses], timetable_text[:30000])
    except ai.AIError as e:
        path.unlink(missing_ok=True)
        return ai_failure(e)

    matched_courses = {course.name.casefold(): course for course in courses}
    classes = []
    seen = set()
    for item in parsed:
        name = item["course_name"]
        title = item["title"]
        weekday = item["weekday"]
        start_time = datetime.strptime(item["start_time"], "%H:%M").time() if item["start_time"] else None
        end_time = datetime.strptime(item["end_time"], "%H:%M").time() if item["end_time"] else None
        course = matched_courses.get(name.casefold())
        key = (weekday, (course.id if course else None), title.casefold(), start_time)
        if key in seen:
            continue
        seen.add(key)
        classes.append(ClassSession(
            course_id=course.id if course else None,
            course_name=course.name if course else name,
            title=title,
            weekday=weekday,
            start_time=start_time,
            end_time=end_time,
        ))

    if not classes:
        path.unlink(missing_ok=True)
        return jsonify(error="no recurring classes were detected; upload a lecture timetable with course names and weekdays"), 422

    previous_path = UPLOAD_DIR / sem.timetable_stored_name if sem.timetable_stored_name else None
    try:
        ClassSession.query.filter_by(semester_id=sem.id).delete()
        sem.classes = classes
        sem.timetable_filename = file.filename[:255]
        sem.timetable_stored_name = stored_name
        record_ai_call()
        db.session.commit()
    except Exception:
        db.session.rollback()
        path.unlink(missing_ok=True)
        raise

    if previous_path and previous_path != path:
        previous_path.unlink(missing_ok=True)
    return jsonify(timetable_filename=sem.timetable_filename,
                   classes=[class_session_json(session) for session in sem.classes]), 201


@app.get("/api/classes")
@login_required
def list_classes_for_date():
    date_value = request.args.get("date", "")
    try:
        target_date = date.fromisoformat(date_value)
    except ValueError:
        return jsonify(error="date must use YYYY-MM-DD format"), 400
    if target_date.isoformat() != date_value:
        return jsonify(error="date must use YYYY-MM-DD format"), 400
    weekday = target_date.weekday()
    classes = (ClassSession.query.join(Semester).join(Year)
               .filter(Year.user_id == current_user.id, ClassSession.weekday == weekday)
               .order_by(ClassSession.start_time, ClassSession.course_name, ClassSession.title).all())
    return jsonify([class_session_json(session) for session in classes])


@app.post("/api/classes/<int:session_id>/recap")
@login_required
def generate_class_recap(session_id):
    session = (ClassSession.query.join(Semester).join(Year)
                  .filter(ClassSession.id == session_id, Year.user_id == current_user.id)
                  .first_or_404())
    course = db.session.get(Course, session.course_id) if session.course_id else None
    if course is None:
        course = next((item for item in session.semester.courses
                       if item.name.casefold() == session.course_name.casefold()), None)
    pages = []
    if course:
        pages = (Page.query.join(Document)
                 .filter(Document.course_id == course.id, Page.text != "")
                 .order_by(Page.document_id, Page.page_number).all())
    material = "\n\n".join(
        f"[{page.document.filename}, page {page.page_number}]\n{page.text[:1200]}"
        for page in pages[:20]
    )[:18000]

    blocked = quota_block()
    if blocked:
        return blocked
    try:
        recap = ai.generate_class_recap(
            session.course_name, session.title, session.start_time.strftime("%H:%M") if session.start_time else None,
            material)
    except ai.AIError as e:
        return ai_failure(e)
    record_ai_call()
    db.session.commit()
    return jsonify(recap=recap, source="course_documents" if material else "general_knowledge")


@app.post("/api/courses")
@login_required
def create_course():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name or len(name) > 120:
        return jsonify(error="name is required (max 120 characters)"), 400
    sem = None
    if data.get("semester_id") is not None:
        sid = data["semester_id"]
        if not isinstance(sid, int) or isinstance(sid, bool):
            return jsonify(error="semester_id must be a number"), 400
        sem = owned_semester_or_404(sid)
    if Course.query.filter_by(user_id=current_user.id, name=name).first():
        return jsonify(error="you already have a unit with that name"), 409
    course = Course(user_id=current_user.id, name=name, semester_id=sem.id if sem else None)
    db.session.add(course)
    db.session.commit()
    return jsonify(id=course.id, name=course.name), 201


@app.patch("/api/courses/<int:course_id>")
@login_required
def move_course(course_id):
    """Move a unit to another semester."""
    course = owned_course_or_404(course_id)
    sid = (request.get_json(silent=True) or {}).get("semester_id")
    if not isinstance(sid, int) or isinstance(sid, bool):
        return jsonify(error="semester_id must be a number"), 400
    sem = owned_semester_or_404(sid)
    course.semester_id = sem.id
    db.session.commit()
    return jsonify(id=course.id, name=course.name, semester_id=sem.id)


@app.delete("/api/courses/<int:course_id>")
@login_required
def delete_course(course_id):
    course = owned_course_or_404(course_id)
    for d in course.documents:
        (UPLOAD_DIR / d.stored_name).unlink(missing_ok=True)
    Assessment.query.filter_by(course_id=course.id).update({Assessment.course_id: None})
    ClassSession.query.filter_by(course_id=course.id).update({ClassSession.course_id: None})
    db.session.delete(course)
    db.session.commit()
    return jsonify(ok=True)


# ---------- Documents ----------

@app.get("/api/courses/<int:course_id>/documents")
@login_required
def list_documents(course_id):
    course = owned_course_or_404(course_id)
    empty_counts = empty_page_counts([d.id for d in course.documents])
    return jsonify([doc_json(d, empty_counts.get(d.id, 0)) for d in course.documents])


@app.post("/api/courses/<int:course_id>/documents")
@login_required
def upload_document(course_id):
    owned_course_or_404(course_id)
    file = request.files.get("file")
    if not file or not file.filename.lower().endswith(".pdf"):
        return jsonify(error="upload a .pdf file in the 'file' field"), 400

    stored_name = f"{uuid.uuid4().hex}.pdf"
    path = UPLOAD_DIR / stored_name
    file.save(path)
    try:
        texts = extract_pages(path)
    except Exception:
        path.unlink(missing_ok=True)
        return jsonify(error="could not read that PDF"), 400

    doc = Document(course_id=course_id, filename=file.filename[:255],
                   stored_name=stored_name, page_count=len(texts))
    doc.pages = [Page(page_number=i, text=t) for i, t in enumerate(texts, start=1)]
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc_json(doc)), 201


@app.get("/api/documents/<int:doc_id>/file")
@login_required
def get_document_file(doc_id):
    doc = owned_document_or_404(doc_id)
    return send_from_directory(UPLOAD_DIR.resolve(), doc.stored_name, mimetype="application/pdf")


@app.delete("/api/documents/<int:doc_id>")
@login_required
def delete_document(doc_id):
    doc = owned_document_or_404(doc_id)
    (UPLOAD_DIR / doc.stored_name).unlink(missing_ok=True)
    db.session.delete(doc)
    db.session.commit()
    return jsonify(ok=True)


# ---------- Pages and study tracking ----------

@app.get("/api/documents/<int:doc_id>/pages/<int:page_number>")
@login_required
def get_page(doc_id, page_number):
    page = owned_page_or_404(doc_id, page_number)
    return jsonify(page_number=page.page_number, text=page.text,
                   studied=page.studied, cards_made=page.cards_made)


@app.post("/api/documents/<int:doc_id>/pages/<int:page_number>/view")
@login_required
def record_view(doc_id, page_number):
    page = owned_page_or_404(doc_id, page_number)
    seconds = (request.get_json(silent=True) or {}).get("seconds", 0)
    if not isinstance(seconds, int) or isinstance(seconds, bool) or seconds < 0:
        return jsonify(error="seconds must be a non-negative integer"), 400
    page.seconds_spent += seconds
    if page.seconds_spent >= STUDIED_AFTER_SECONDS:
        page.studied = True
    db.session.commit()
    return jsonify(seconds_spent=page.seconds_spent, studied=page.studied)


def pending_query(course_id):
    return (Page.query.join(Document)
            .filter(Document.course_id == course_id, Page.studied.is_(True),
                    Page.cards_made.is_(False), Page.text != "")
            .order_by(Page.document_id, Page.page_number))


@app.get("/api/courses/<int:course_id>/pending-pages")
@login_required
def pending_pages(course_id):
    owned_course_or_404(course_id)
    rows = pending_query(course_id).all()
    return jsonify(count=len(rows),
                   pages=[{"document_id": p.document_id, "page_number": p.page_number} for p in rows])


# ---------- Flashcards ----------

@app.post("/api/courses/<int:course_id>/flashcards/generate")
@login_required
def generate_flashcards(course_id):
    """Turns studied pages that have no cards yet into flashcards, in ONE Gemini call."""
    course = owned_course_or_404(course_id)
    pages = pending_query(course_id).limit(MAX_PAGES_PER_BATCH).all()
    if not pages:
        return jsonify(created=0, cards=[], remaining=0,
                       message="No studied pages are waiting for cards. Read some pages first.")
    blocked = quota_block()
    if blocked:
        return blocked

    refs = {f"P{i}": p for i, p in enumerate(pages, start=1)}
    payload = [{"ref": r, "text": p.text[:PAGE_CHAR_LIMIT]} for r, p in refs.items()]
    try:
        raw = ai.generate_flashcards(course.name, payload)
    except ai.AIError as e:
        return ai_failure(e)

    cards = []
    for item in raw:
        page = refs.get(item["ref"])
        if page is None:
            continue
        cards.append(Flashcard(document_id=page.document_id, page_number=page.page_number,
                               question=item["question"], answer=item["answer"], due_at=utcnow()))
    if not cards:
        return ai_failure(ai.AIError("The AI didn't produce any usable cards. Try again."))

    db.session.add_all(cards)
    for p in pages:
        p.cards_made = True
    record_ai_call()
    db.session.commit()
    remaining = pending_query(course_id).count()
    return jsonify(created=len(cards), cards=[card_json(c) for c in cards], remaining=remaining), 201


def course_cards_query(course_id):
    return (Flashcard.query.join(Document, Flashcard.document_id == Document.id)
            .filter(Document.course_id == course_id))


@app.get("/api/courses/<int:course_id>/flashcards")
@login_required
def list_flashcards(course_id):
    owned_course_or_404(course_id)
    cards = course_cards_query(course_id).order_by(Flashcard.document_id, Flashcard.page_number, Flashcard.id)
    return jsonify([card_json(c) for c in cards])


@app.get("/api/courses/<int:course_id>/flashcards/due")
@login_required
def due_flashcards(course_id):
    owned_course_or_404(course_id)
    limit = min(max(request.args.get("limit", 20, type=int), 1), 100)
    base_query = course_cards_query(course_id).filter(Flashcard.due_at <= utcnow())
    cards = base_query.order_by(Flashcard.due_at).limit(limit).all()
    total_due = base_query.count()
    return jsonify(total_due=total_due, cards=[card_json(c) for c in cards])


@app.post("/api/flashcards/<int:card_id>/review")
@login_required
def review_flashcard(card_id):
    card = owned_flashcard_or_404(card_id)
    correct = (request.get_json(silent=True) or {}).get("correct")
    if not isinstance(correct, bool):
        return jsonify(error="'correct' must be true or false"), 400
    if correct:
        card.box = min(card.box + 1, 5)
        card.times_right += 1
    else:
        card.box = 1
        card.times_wrong += 1
    card.due_at = utcnow() + timedelta(days=BOX_INTERVAL_DAYS[card.box])
    db.session.commit()
    return jsonify(card_json(card))


@app.delete("/api/flashcards/<int:card_id>")
@login_required
def delete_flashcard(card_id):
    card = owned_flashcard_or_404(card_id)
    db.session.delete(card)
    db.session.commit()
    return jsonify(ok=True)


# ---------- Ask the AI / quick question ----------

@app.post("/api/documents/<int:doc_id>/pages/<int:page_number>/ask")
@login_required
def ask_ai(doc_id, page_number):
    page = owned_page_or_404(doc_id, page_number)
    data = request.get_json(silent=True) or {}
    question = str(data.get("question", "")).strip()
    history = []
    raw = data.get("history")
    if isinstance(raw, list):   # earlier turns of this chat, so follow-up questions make sense
        for h in raw[-6:]:
            if isinstance(h, dict) and isinstance(h.get("q"), str) and isinstance(h.get("a"), str):
                pg = h.get("page") if isinstance(h.get("page"), int) else page_number
                history.append({"q": h["q"][:600], "a": h["a"][:1200], "page": pg})
    if not question or len(question) > 1000:
        return jsonify(error="write a question (max 1000 characters)"), 400
    blocked = quota_block()
    if blocked:
        return blocked
    try:
        answer = ai.ask(page.document.course.name, page.text[:PAGE_CHAR_LIMIT], question,
                        history, page_number)
    except ai.AIError as e:
        return ai_failure(e)
    record_ai_call()
    db.session.commit()
    return jsonify(answer=answer)


@app.post("/api/courses/<int:course_id>/quick-question")
@login_required
def quick_question(course_id):
    """One question from a random page you've studied. The reader calls this on a timer."""
    course = owned_course_or_404(course_id)
    page = (Page.query.join(Document)
            .filter(Document.course_id == course_id, Page.studied.is_(True), Page.text != "")
            .order_by(func.random()).first())
    if page is None:
        return jsonify(error="study a few pages first, then I can quiz you"), 404
    blocked = quota_block()
    if blocked:
        return blocked
    try:
        qa = ai.quick_question(course.name, page.text[:PAGE_CHAR_LIMIT])
    except ai.AIError as e:
        return ai_failure(e)
    record_ai_call()
    db.session.commit()
    return jsonify(**qa, document_id=page.document_id, page_number=page.page_number)


# ---------- CATs ----------

def cat_material(course_id, document_ids):
    q = (Page.query.join(Document)
         .filter(Document.course_id == course_id, Page.text != "")
         .order_by(Page.document_id, Page.page_number))
    if document_ids:
        q = q.filter(Document.id.in_(document_ids))
    pages = q.all()
    if len(pages) > CAT_MAX_PAGES:   # spread the sample across all the material
        pages = [pages[int(i * len(pages) / CAT_MAX_PAGES)] for i in range(CAT_MAX_PAGES)]
    return "\n\n".join(f"[{p.document.filename}, page {p.page_number}]\n{p.text[:CAT_PAGE_CHARS]}"
                       for p in pages)


@app.get("/api/courses/<int:course_id>/cats")
@login_required
def list_cats(course_id):
    owned_course_or_404(course_id)
    cats = Cat.query.filter_by(course_id=course_id).order_by(Cat.created_at.desc())
    return jsonify([cat_summary(c) for c in cats])


@app.post("/api/courses/<int:course_id>/cats")
@login_required
def create_cat(course_id):
    course = owned_course_or_404(course_id)
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()[:160] or f"{course.name} CAT"
    n = data.get("num_questions", 5)
    if not isinstance(n, int) or isinstance(n, bool) or not 3 <= n <= 15:
        return jsonify(error="num_questions must be a whole number from 3 to 15"), 400
    doc_ids = data.get("document_ids") or []
    if not isinstance(doc_ids, list) or not all(isinstance(i, int) for i in doc_ids):
        return jsonify(error="document_ids must be a list of numbers"), 400

    material = cat_material(course_id, doc_ids)
    if not material:
        return jsonify(error="no readable text found. Upload PDFs to this course first."), 400
    blocked = quota_block()
    if blocked:
        return blocked
    try:
        questions = ai.generate_cat(course.name, material, n)
    except ai.AIError as e:
        return ai_failure(e)

    cat = Cat(course_id=course_id, title=title)
    cat.questions = [CatQuestion(position=i, question=q["question"], options=q["options"],
                                 correct_index=q["correct_index"], explanation=q["explanation"])
                     for i, q in enumerate(questions, start=1)]
    db.session.add(cat)
    record_ai_call()
    db.session.commit()
    return jsonify(cat_json(cat, reveal=False)), 201


@app.get("/api/cats/<int:cat_id>")
@login_required
def get_cat(cat_id):
    cat = owned_cat_or_404(cat_id)
    return jsonify(cat_json(cat, reveal=cat.submitted_at is not None))


@app.post("/api/cats/<int:cat_id>/submit")
@login_required
def submit_cat(cat_id):
    cat = owned_cat_or_404(cat_id)
    if cat.submitted_at is not None:
        return jsonify(error="this CAT was already submitted"), 409
    answers = (request.get_json(silent=True) or {}).get("answers")
    if (not isinstance(answers, list) or len(answers) != len(cat.questions)
            or not all(a is None or (isinstance(a, int) and not isinstance(a, bool) and 0 <= a <= 3)
                       for a in answers)):
        return jsonify(error=f"send 'answers': a list of {len(cat.questions)} items, "
                             "each 0 to 3 (or null to skip)"), 400
    score = 0
    for q, a in zip(cat.questions, answers):
        q.chosen_index = a
        score += 1 if a == q.correct_index else 0
    cat.score = score
    cat.submitted_at = utcnow()
    db.session.commit()
    return jsonify(cat_json(cat, reveal=True))


@app.delete("/api/cats/<int:cat_id>")
@login_required
def delete_cat(cat_id):
    cat = owned_cat_or_404(cat_id)
    db.session.delete(cat)
    db.session.commit()
    return jsonify(ok=True)


if __name__ == "__main__":
    # Tables are created by migrations (flask db upgrade), not here
    app.run(debug=True, port=5000)