import os
import sys

import requests

BASE = os.environ.get("BASE_URL", "http://localhost:5000")
EMAIL = "smoketest@example.com"
PASSWORD = "smoketest-pass-123"
COURSE = "Smoke test course"

failures = 0
s = requests.Session()   # keeps the login cookie between calls, like a browser


def check(name, resp, expect=(200, 201)):
    global failures
    ok = resp.status_code in expect
    print(f"[{'PASS' if ok else 'FAIL'}] {name} -> {resp.status_code}")
    try:
        body = resp.json()
    except ValueError:
        body = resp.text[:300]
    if not ok:
        failures += 1
        print("        ", body)
        return None
    return body


def main():
    global failures
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    keep = "--keep" in sys.argv
    if not args or not os.path.isfile(args[0]):
        sys.exit('Usage: python smoke_test.py "path\\to\\notes.pdf" [--keep]')
    pdf_path = args[0]

    # 1. Not logged in -> blocked
    check("logged-out request is blocked", requests.get(f"{BASE}/api/courses"), expect=(401,))

    # 2. Register (or log in if the test account already exists)
    r = s.post(f"{BASE}/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
    if r.status_code == 409:
        r = s.post(f"{BASE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
        check("login (account already existed)", r)
    else:
        check("register", r)
    check("who am I", s.get(f"{BASE}/api/auth/me"))

    # 3. Fresh course (remove a leftover one from an earlier run)
    for c in s.get(f"{BASE}/api/courses").json():
        if c["name"] == COURSE:
            s.delete(f"{BASE}/api/courses/{c['id']}")
    course = check("create course", s.post(f"{BASE}/api/courses", json={"name": COURSE}))
    if not course:
        sys.exit("Can't continue without a course.")
    cid = course["id"]

    # 4. Upload
    with open(pdf_path, "rb") as f:
        doc = check("upload PDF", s.post(f"{BASE}/api/courses/{cid}/documents",
                                         files={"file": (os.path.basename(pdf_path), f, "application/pdf")}))
    if not doc:
        sys.exit("Can't continue without an uploaded document.")
    did, pages = doc["id"], doc["page_count"]
    print(f"        {pages} pages, {doc['empty_pages']} without readable text")
    if doc["empty_pages"] == pages:
        sys.exit("This PDF has no selectable text (probably a scan). Try another PDF.")

    # 5. Study the first few pages (report 12 seconds each)
    study = [p for p in range(1, min(pages, 4) + 1)]
    for p in study:
        check(f"view page {p} for 12s", s.post(f"{BASE}/api/documents/{did}/pages/{p}/view", json={"seconds": 12}))
    pend = check("pending pages", s.get(f"{BASE}/api/courses/{cid}/pending-pages"))
    if pend:
        print(f"        {pend['count']} studied pages waiting for cards")

    # 6. Flashcards from Gemini
    gen = check("generate flashcards (Gemini)", s.post(f"{BASE}/api/courses/{cid}/flashcards/generate"))
    cards = gen["cards"] if gen else []
    if cards:
        print(f"        {gen['created']} cards made. First one:")
        print(f"        Q: {cards[0]['question']}")
        print(f"        A: {cards[0]['answer']}")
        check("review a card as correct", s.post(f"{BASE}/api/flashcards/{cards[0]['id']}/review", json={"correct": True}))
        due = check("cards due now", s.get(f"{BASE}/api/courses/{cid}/flashcards/due"))
        if due:
            print(f"        {due['total_due']} due (the one you got right moved to a later box)")

    # 7. Ask the AI about a page
    ans = check("ask the AI about page 1", s.post(f"{BASE}/api/documents/{did}/pages/1/ask",
                                                 json={"question": "Summarise this page in one sentence."}))
    if ans:
        print(f"        {ans['answer'][:200]}")

    # 8. Quick question
    qq = check("quick question", s.post(f"{BASE}/api/courses/{cid}/quick-question"))
    if qq:
        print(f"        Q: {qq['question']}")

    # 9. CAT
    cat = check("create CAT (Gemini)", s.post(f"{BASE}/api/courses/{cid}/cats",
                                              json={"title": "Smoke CAT", "num_questions": 3}))
    if cat:
        n = len(cat["questions"])
        hidden = all("correct_index" not in q for q in cat["questions"])
        print(f"        {n} questions, correct answers hidden before submitting: {hidden}")
        if not hidden:
            failures += 1
        done = check("submit CAT (all answers = option 0)",
                     s.post(f"{BASE}/api/cats/{cat['id']}/submit", json={"answers": [0] * n}))
        if done:
            print(f"        score {done['score']}/{done['total']}")

    # 10. Usage
    use = check("AI usage today", s.get(f"{BASE}/api/ai/usage"))
    if use:
        print(f"        {use['used']} of {use['limit']} used")

    # 11. Cleanup and logout
    if not keep:
        check("delete test course", s.delete(f"{BASE}/api/courses/{cid}"))
    check("logout", s.post(f"{BASE}/api/auth/logout"))
    check("after logout, blocked again", s.get(f"{BASE}/api/courses"), expect=(401,))

    print("\n" + ("ALL CHECKS PASSED" if failures == 0 else f"{failures} CHECK(S) FAILED, see the FAIL lines above"))
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
