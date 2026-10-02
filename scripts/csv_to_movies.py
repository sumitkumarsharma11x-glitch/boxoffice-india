import csv
import json
import os
import urllib.request
from io import StringIO

URL = os.environ.get("MOVIES_CSV_URL")
if not URL:
    raise SystemExit("MOVIES_CSV_URL is not configured")

with urllib.request.urlopen(URL, timeout=30) as response:
    text = response.read().decode("utf-8-sig")

rows = csv.DictReader(StringIO(text))
movies = []

for r in rows:
    if not r.get("id") or not r.get("title"):
        continue

    days = []
    for n in range(1, 8):
        lo = (r.get(f"Day{n}_lo") or "").strip()
        hi = (r.get(f"Day{n}_hi") or "").strip()
        if lo and hi:
            days.append({"d": f"Day {n}", "lo": float(lo), "hi": float(hi)})

    movies.append({
        "id": str(r["id"]).strip(),
        "title": r["title"].strip(),
        "lang": r.get("lang", "").strip(),
        "release": r.get("release", "").strip(),
        "budget": r.get("budget", "").strip(),
        "verdict": r.get("verdict", "").strip(),
        "label": r.get("label", "Estimated").strip(),
        "updated": r.get("updated", "").strip(),
        "puja": (r.get("puja", "").strip().upper() == "TRUE"),
        "days": days,
        "analysis": r.get("analysis", "").strip()
    })

with open("data/movies.json", "w", encoding="utf-8") as f:
    json.dump(movies, f, ensure_ascii=False, separators=(",", ":"))
    f.write("\n")

print(f"Generated data/movies.json with {len(movies)} films")
