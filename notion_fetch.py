"""
Notion Paper Tracker - Data Fetcher
DB Schema:
  Paper (title), Member (people), Date (date), Year (number),
  Conference/Journal (multi_select), Keyword (multi_select), Link (rich_text)

사용법:
  export NOTION_TOKEN=ntn_xxxxx
  python notion_fetch.py
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime

DATABASE_ID = "330d8ee7f3d580fbb0e3cb846fb1c48b"
NOTION_VERSION = "2022-06-28"


def notion_request(endpoint, body=None):
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        print("❌ NOTION_TOKEN 환경변수를 설정해주세요.")
        exit(1)

    url = f"https://api.notion.com/v1/{endpoint}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST" if body else "GET")

    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"❌ API Error {e.code}: {e.read().decode()}")
        exit(1)


def parse_page(page):
    """Notion page → heatmap record"""
    props = page["properties"]

    # Paper (title)
    title = "".join(t["plain_text"] for t in props["Paper"]["title"]) if props["Paper"]["title"] else ""

    # Member (people) → list of names
    members = [p.get("name", "Unknown") for p in props["Member"]["people"]]

    # Date (date) → "YYYY-MM-DD"
    date_val = None
    if props["Date"]["date"]:
        date_val = props["Date"]["date"]["start"][:10]

    # Year (number)
    year = props["Year"]["number"]

    # Conference/Journal (multi_select)
    venues = [s["name"] for s in props["Conference/Journal"]["multi_select"]]

    # Keyword (multi_select)
    keywords = [s["name"] for s in props["Keyword"]["multi_select"]]

    # Link (rich_text)
    link = "".join(t["plain_text"] for t in props["Link"]["rich_text"]) if props["Link"]["rich_text"] else ""

    return {
        "title": title,
        "members": members,
        "date": date_val,
        "year": year,
        "venues": venues,
        "keywords": keywords,
        "link": link,
    }


def fetch_all():
    print("🔄 Fetching from Notion...")

    all_results = []
    has_more = True
    next_cursor = None

    while has_more:
        body = {"page_size": 100}
        if next_cursor:
            body["start_cursor"] = next_cursor
        result = notion_request(f"databases/{DATABASE_ID}/query", body)
        all_results.extend(result["results"])
        has_more = result.get("has_more", False)
        next_cursor = result.get("next_cursor")

    print(f"   → {len(all_results)} pages found")

    records = []
    all_members = set()

    for page in all_results:
        rec = parse_page(page)
        records.append(rec)
        all_members.update(rec["members"])

    # 한 논문에 member가 여러명이면 각각 entry로 분리 (공동 reading 반영)
    heatmap_entries = []
    for rec in records:
        if not rec["date"]:
            continue
        for member in rec["members"]:
            heatmap_entries.append({
                "date": rec["date"],
                "member": member,
                "title": rec["title"],
                "keywords": rec["keywords"],
                "venues": rec["venues"],
                "link": rec["link"],
            })

    output = {
        "last_synced": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_papers": len(records),
        "members": sorted(all_members),
        "entries": heatmap_entries,
    }

    os.makedirs("public", exist_ok=True)
    with open("public/data.json", "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"✅ data.json 생성 ({len(heatmap_entries)} heatmap entries, {len(all_members)} members)")
    print(f"   Members: {sorted(all_members)}")


if __name__ == "__main__":
    fetch_all()
