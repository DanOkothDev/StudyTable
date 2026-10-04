import os
import re
import uuid
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_migrate import Migrate
from flask_login import (LoginManager, UserMixin, current_user,
                         login_required, login_user, logout_user)
from flask_sqlalchemy import SQLAlchemy
from pypdf import PdfReader
from werkzeug.security import check_password_hash, generate_password_hash

load_dotenv()

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ["DATABASE_URL"]
app.config["SECRET_KEY"] = os.environ["SECRET_KEY"]          # signs the login cookie
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024          # 50 MB per upload
app.config["SESSION_COOKIE_HTTPONLY"] = True                 # JavaScript can't read the cookie
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("COOKIE_SECURE", "0") == "1"  # set to 1 once on https

# CORS (rules for which website may call this API): only your React app, and with cookies
CORS(app, supports_credentials=True,
     origins=[os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")])

db = SQLAlchemy(app)
migrate = Migrate(app, db)   # tracks table changes as versioned migration files
login_manager = LoginManager(app)

UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "uploads"))
UPLOAD_DIR.mkdir(exist_ok=True)

STUDIED_AFTER_SECONDS = 10   # total seconds on a page before it counts as "studied"
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- Models (tables) ----------

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)   # never the real password
    courses = db.relationship("Course", backref="user", cascade="all, delete-orphan")


class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    documents = db.relationship("Document", backref="course", cascade="all, delete-orphan")
    __table_args__ = (db.UniqueConstraint("user_id", "name"),)   # unique per person, not global


class Document(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    stored_name = db.Column(db.String(255), nullable=False)
    page_count = db.Column(db.Integer, nullable=False)
    pages = db.relationship("Page", backref="document", cascade="all, delete-orphan")


class Page(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey("document.id"), nullable=False)
    page_number = db.Column(db.Integer, nullable=False)       # starts at 1
    text = db.Column(db.Text, nullable=False, default="")
    seconds_spent = db.Column(db.Integer, nullable=False, default=0)
    studied = db.Column(db.Boolean, nullable=False, default=False)
    cards_made = db.Column(db.Boolean, nullable=False, default=False)
    __table_args__ = (db.UniqueConstraint("document_id", "page_number"),)


# ---------- Login plumbing ----------

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(error="login required"), 401   # JSON, not a redirect, because React is the client


# ---------- Ownership checks ----------
# Every lookup filters by current_user. A record that isn't yours returns 404
# (not 403), so nobody can even tell whether someone else's ID exists.

def owned_course_or_404(course_id):
    return Course.query.filter_by(id=course_id, user_id=current_user.id).first_or_404()


def owned_document_or_404(doc_id):
    return (Document.query.join(Course)
            .filter(Document.id == doc_id, Course.user_id == current_user.id)
            .first_or_404())


def owned_page_or_404(doc_id, page_number):
    doc = owned_document_or_404(doc_id)
    return Page.query.filter_by(document_id=doc.id, page_number=page_number).first_or_404()


def doc_json(d):
    return {"id": d.id, "course_id": d.course_id, "filename": d.filename, "page_count": d.page_count}


# ---------- Auth ----------

@app.post("/api/auth/register")
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
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    user = User.query.filter_by(email=email).first()
    # Same message for "no such email" and "wrong password" so it doesn't reveal which emails exist
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
    courses = Course.query.filter_by(user_id=current_user.id).order_by(Course.name)
    return jsonify([{"id": c.id, "name": c.name, "document_count": len(c.documents)} for c in courses])


@app.post("/api/courses")
@login_required
def create_course():
    name = (request.get_json(silent=True) or {}).get("name", "").strip()
    if not name:
        return jsonify(error="name is required"), 400
    if Course.query.filter_by(user_id=current_user.id, name=name).first():
        return jsonify(error="you already have a course with that name"), 409
    course = Course(user_id=current_user.id, name=name)
    db.session.add(course)
    db.session.commit()
    return jsonify(id=course.id, name=course.name), 201


# ---------- Documents ----------

@app.get("/api/courses/<int:course_id>/documents")
@login_required
def list_documents(course_id):
    course = owned_course_or_404(course_id)
    return jsonify([doc_json(d) for d in course.documents])


@app.post("/api/courses/<int:course_id>/documents")
@login_required
def upload_document(course_id):
    owned_course_or_404(course_id)
    file = request.files.get("file")
    if not file or not file.filename.lower().endswith(".pdf"):
        return jsonify(error="upload a .pdf file in the 'file' field"), 400

    stored_name = f"{uuid.uuid4().hex}.pdf"   # random name on disk, so names can't be guessed or clash
    path = UPLOAD_DIR / stored_name
    file.save(path)

    try:
        reader = PdfReader(path)
        texts = [(p.extract_text() or "").strip() for p in reader.pages]
    except Exception:
        path.unlink(missing_ok=True)
        return jsonify(error="could not read that PDF"), 400

    doc = Document(course_id=course_id, filename=file.filename,
                   stored_name=stored_name, page_count=len(texts))
    doc.pages = [Page(page_number=i, text=t) for i, t in enumerate(texts, start=1)]
    db.session.add(doc)
    db.session.commit()

    empty = sum(1 for t in texts if not t)    # scanned pages have no text layer
    return jsonify(**doc_json(doc), empty_pages=empty), 201


@app.get("/api/documents/<int:doc_id>/file")
@login_required
def get_document_file(doc_id):
    doc = owned_document_or_404(doc_id)
    return send_from_directory(UPLOAD_DIR.resolve(), doc.stored_name, mimetype="application/pdf")


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


@app.get("/api/courses/<int:course_id>/pending-pages")
@login_required
def pending_pages(course_id):
    owned_course_or_404(course_id)
    rows = (Page.query.join(Document)
            .filter(Document.course_id == course_id, Page.studied.is_(True),
                    Page.cards_made.is_(False), Page.text != "")
            .order_by(Page.document_id, Page.page_number).all())
    return jsonify(count=len(rows),
                   pages=[{"document_id": p.document_id, "page_number": p.page_number} for p in rows])


if __name__ == "__main__":
    # Tables are created by migrations (flask db upgrade), not here
    app.run(debug=True, port=5000)