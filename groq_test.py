import os
from dotenv import load_dotenv
from urllib.request import Request, urlopen
from urllib.error import HTTPError

load_dotenv()

request = Request(
    "https://api.groq.com/openai/v1/models",
    headers={
        "Authorization": "Bearer " + os.getenv("GROQ_API_KEY")
    },
)

try:
    response = urlopen(request, timeout=20)
    print("Status:", response.status)
    print("Body:", response.read().decode())

except HTTPError as e:
    print("Status:", e.code)
    print("Headers:", dict(e.headers))
    print("Body:", e.read().decode("utf-8", errors="replace"))