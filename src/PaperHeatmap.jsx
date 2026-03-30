import { useState, useMemo, useCallback, useEffect } from "react";

// --- Color palettes (auto-assigned to members) ---
const PALETTE_POOL = [
  ["#0e1117", "#0e4429", "#006d32", "#26a641", "#39d353"], // green
  ["#0e1117", "#1a1040", "#2e1a6e", "#5b34b5", "#8957e5"], // purple
  ["#0e1117", "#3b1218", "#6e1d28", "#b5344a", "#e55775"], // pink
  ["#0e1117", "#0d2d4a", "#144d7e", "#1a7fc4", "#40b0f0"], // blue
  ["#0e1117", "#3b2e10", "#6e5418", "#b58b26", "#e5b840"], // gold
  ["#0e1117", "#0e3b3b", "#146e6e", "#26b5a1", "#39e5c8"], // teal
  ["#0e1117", "#3b2010", "#6e3d18", "#b56426", "#e58840"], // orange
];

// --- Dummy data (프로토타입/fallback용) ---
const DUMMY_MEMBERS = ["Member_A", "Member_B", "Member_C", "Member_D"];
const TOPICS = ["VLM", "Diffusion", "RL", "NLP", "3D Vision"];
function generateDummy() {
  const entries = [];
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 365);
  DUMMY_MEMBERS.forEach((member) => {
    const freq = 0.12 + Math.random() * 0.2;
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      if (Math.random() < freq) {
        const count = Math.random() < 0.12 ? 2 : 1;
        for (let i = 0; i < count; i++) {
          entries.push({
            date: new Date(d).toISOString().slice(0, 10),
            member,
            title: `Paper_${Math.floor(Math.random() * 9000 + 1000)}`,
            keywords: [TOPICS[Math.floor(Math.random() * TOPICS.length)]],
            venues: [],
            link: "",
          });
        }
      }
    }
  });
  return { members: DUMMY_MEMBERS, entries, total_papers: entries.length, last_synced: null };
}

// --- Calendar helpers ---
function getWeeks(year) {
  const weeks = [];
  const end = new Date(year, 11, 31);
  const s = new Date(year, 0, 1);
  s.setDate(s.getDate() - s.getDay());
  let cur = new Date(s);
  while (cur <= end || weeks.length < 52) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: cur.toISOString().slice(0, 10), inYear: cur.getFullYear() === year });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > end && weeks.length >= 52) break;
  }
  return weeks;
}

function getMonthLabels(weeks) {
  const labels = [];
  let last = -1;
  weeks.forEach((w, i) => {
    const f = w.find((d) => d.inYear);
    if (f) {
      const m = new Date(f.date).getMonth();
      if (m !== last) { labels.push({ month: m, col: i }); last = m; }
    }
  });
  return labels;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getColor(count, pal) {
  if (count === 0) return pal[0];
  if (count === 1) return pal[2];
  if (count === 2) return pal[3];
  return pal[4];
}

// --- Tooltip ---
function Tooltip({ x, y, date, count, papers }) {
  return (
    <div style={{
      position: "fixed", left: x + 12, top: y - 10,
      background: "#1c2028", border: "1px solid #30363d", borderRadius: 8,
      padding: "8px 12px", color: "#e6edf3", fontSize: 12,
      fontFamily: "'JetBrains Mono', monospace", pointerEvents: "none",
      zIndex: 1000, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "#8b949e" }}>{date}</div>
      <div>{count === 0 ? "No papers" : `${count} paper${count > 1 ? "s" : ""}`}</div>
      {papers.length > 0 && (
        <div style={{ marginTop: 4, borderTop: "1px solid #30363d", paddingTop: 4 }}>
          {papers.slice(0, 3).map((p, i) => (
            <div key={i} style={{ fontSize: 11, color: "#7d8590", marginTop: 2 }}>
              {p.title}
              {p.keywords?.length > 0 && (
                <span style={{ fontSize: 10, background: "#21262d", padding: "1px 5px", borderRadius: 4, color: "#8b949e", marginLeft: 4 }}>
                  {p.keywords[0]}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Heatmap Grid ---
function HeatmapGrid({ weeks, countMap, paperMap, palette }) {
  const [tooltip, setTooltip] = useState(null);
  const cellSize = 13, cellGap = 3, totalCell = 16;
  const leftPad = 32, topPad = 24;
  const monthLabels = useMemo(() => getMonthLabels(weeks), [weeks]);
  const svgW = leftPad + weeks.length * totalCell + 8;
  const svgH = topPad + 7 * totalCell + 8;

  return (
    <div style={{ position: "relative", overflowX: "auto", paddingBottom: 4 }}>
      <svg width={svgW} height={svgH} style={{ display: "block" }}>
        {monthLabels.map((ml, i) => (
          <text key={i} x={leftPad + ml.col * totalCell} y={topPad - 8} fill="#484f58" fontSize={11} fontFamily="'JetBrains Mono', monospace">{MONTHS[ml.month]}</text>
        ))}
        {[1,3,5].map(d => (
          <text key={d} x={leftPad - 8} y={topPad + d * totalCell + cellSize - 2} fill="#484f58" fontSize={10} textAnchor="end" fontFamily="'JetBrains Mono', monospace">{DAYS[d]}</text>
        ))}
        {weeks.map((week, wi) => week.map((day, di) => {
          if (!day.inYear) return null;
          const count = countMap[day.date] || 0;
          return (
            <rect key={day.date} x={leftPad + wi * totalCell} y={topPad + di * totalCell}
              width={cellSize} height={cellSize} rx={2} ry={2}
              fill={getColor(count, palette)} style={{ cursor: "pointer" }}
              onMouseMove={(e) => {
                const papers = paperMap[day.date] || [];
                setTooltip({ x: e.clientX, y: e.clientY, date: day.date, count, papers });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          );
        }))}
      </svg>
      {tooltip && <Tooltip {...tooltip} />}
    </div>
  );
}

// --- Stat Card ---
function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 10, padding: "14px 18px", minWidth: 120, flex: "1 1 120px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 12, color: "#8b949e", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#484f58", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

// --- Legend ---
function LegendBar({ palette }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
      <span style={{ fontSize: 11, color: "#484f58", marginRight: 4, fontFamily: "'JetBrains Mono', monospace" }}>Less</span>
      {palette.map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />)}
      <span style={{ fontSize: 11, color: "#484f58", marginLeft: 4, fontFamily: "'JetBrains Mono', monospace" }}>More</span>
    </div>
  );
}

// --- Main ---
export default function PaperHeatmap() {
  const [data, setData] = useState(null);
  const [selectedMember, setSelectedMember] = useState("All");
  const [year, setYear] = useState(2026);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try loading data.json from same origin (GitHub Pages)
    fetch("./data.json")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => {
        // Fallback: dummy data for preview
        setData(generateDummy());
        setLoading(false);
      });
  }, []);

  const members = data?.members || [];
  const entries = data?.entries || [];

  const weeks = useMemo(() => getWeeks(year), [year]);

  const filtered = useMemo(
    () => selectedMember === "All" ? entries : entries.filter((e) => e.member === selectedMember),
    [entries, selectedMember]
  );

  const { countMap, paperMap } = useMemo(() => {
    const cm = {}, pm = {};
    filtered.forEach((e) => {
      cm[e.date] = (cm[e.date] || 0) + 1;
      if (!pm[e.date]) pm[e.date] = [];
      pm[e.date].push(e);
    });
    return { countMap: cm, paperMap: pm };
  }, [filtered]);

  const yearEntries = filtered.filter((e) => e.date?.startsWith(String(year)));
  const totalPapers = yearEntries.length;
  const activeDays = new Set(yearEntries.map((e) => e.date)).size;

  const currentStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (countMap[d.toISOString().slice(0, 10)]) streak++;
      else if (i > 0) break;
    }
    return streak;
  }, [countMap]);

  const topKeyword = useMemo(() => {
    const kc = {};
    yearEntries.forEach((e) => (e.keywords || []).forEach((k) => (kc[k] = (kc[k] || 0) + 1)));
    return Object.entries(kc).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
  }, [yearEntries]);

  // Assign palette per member
  const memberPalette = useMemo(() => {
    const mp = {};
    members.forEach((m, i) => { mp[m] = PALETTE_POOL[i % PALETTE_POOL.length]; });
    return mp;
  }, [members]);

  const palette = selectedMember === "All" ? PALETTE_POOL[0] : (memberPalette[selectedMember] || PALETTE_POOL[0]);

  const availableYears = useMemo(() => {
    const yrs = new Set(entries.map((e) => parseInt(e.date?.slice(0, 4))).filter(Boolean));
    yrs.add(2026); // always show current
    return [...yrs].sort();
  }, [entries]);

  if (loading) {
    return (
      <div style={{ background: "#010409", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#484f58", fontFamily: "'JetBrains Mono', monospace" }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ background: "#010409", minHeight: "100vh", padding: "32px 24px", fontFamily: "'JetBrains Mono', 'SF Mono', monospace", color: "#e6edf3" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700;800&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, fontFamily: "'Space Mono', monospace", letterSpacing: "-0.03em" }}>
            📄 Lab Paper Tracker
          </h1>
          <span style={{ fontSize: 12, color: "#484f58" }}>paper reading heatmap</span>
        </div>
        <p style={{ fontSize: 13, color: "#484f58", margin: "4px 0 24px", lineHeight: 1.5 }}>
          {data?.last_synced
            ? `Last synced: ${data.last_synced.slice(0, 16).replace("T", " ")} UTC · ${data.total_papers} papers`
            : "Preview mode — connect to Notion for real data"}
        </p>

        {/* Year + Member selectors */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {availableYears.map((y) => (
            <button key={y} onClick={() => setYear(y)} style={{
              background: year === y ? "#21262d" : "transparent",
              color: year === y ? "#e6edf3" : "#484f58",
              border: `1px solid ${year === y ? "#30363d" : "#21262d"}`,
              borderRadius: 6, padding: "5px 14px", fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace", fontWeight: year === y ? 700 : 400, cursor: "pointer",
            }}>
              {y}
            </button>
          ))}
          <div style={{ width: 1, height: 20, background: "#21262d", margin: "0 4px" }} />
          {["All", ...members].map((m) => (
            <button key={m} onClick={() => setSelectedMember(m)} style={{
              background: selectedMember === m ? "#21262d" : "transparent",
              color: selectedMember === m ? "#e6edf3" : "#484f58",
              border: `1px solid ${selectedMember === m ? "#30363d" : "#21262d"}`,
              borderRadius: 6, padding: "5px 14px", fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace", fontWeight: selectedMember === m ? 700 : 400, cursor: "pointer",
            }}>
              {m === "All" ? "👥 All" : m}
            </button>
          ))}
        </div>

        {/* Heatmap */}
        <div style={{ background: "#0d1117", border: "1px solid #21262d", borderRadius: 12, padding: "20px 16px 12px", marginBottom: 20 }}>
          <HeatmapGrid weeks={weeks} countMap={countMap} paperMap={paperMap} palette={palette} />
          <div style={{ display: "flex", padding: "8px 32px 0" }}>
            <LegendBar palette={palette} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <StatCard label="Total papers" value={totalPapers} accent={palette[3]} />
          <StatCard label="Active days" value={activeDays} sub={`/ ${year === new Date().getFullYear() ? Math.ceil((new Date() - new Date(year,0,1))/86400000) : 365} days`} accent={palette[3]} />
          <StatCard label="Current streak" value={`${currentStreak}d`} accent={palette[4]} />
          <StatCard label="Top keyword" value={topKeyword} accent={palette[2]} />
        </div>

        <div style={{ marginTop: 24, fontSize: 11, color: "#30363d", textAlign: "center" }}>
          Data sourced from Notion DB via API · Updated daily via GitHub Actions
        </div>
      </div>
    </div>
  );
}
