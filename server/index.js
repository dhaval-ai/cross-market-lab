// server/index.js — tiny proxy so the browser never sees the FRED key and CORS
// is handled server-side. Also normalizes everything to annual values.
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { CATALOG } from "../shared-catalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;
const FRED_KEY = process.env.FRED_API_KEY || "";

// simple in-memory cache (id -> {ts, data}) to stay well under rate limits
const cache = new Map();
const TTL = 1000 * 60 * 60 * 12; // 12h

const byId = Object.fromEntries(CATALOG.map((m) => [m.id, m]));

// ---- fetch + annualize a FRED series ----
async function fetchFred(m, start, end) {
  if (!FRED_KEY) throw new Error("FRED_API_KEY not set on server");
  const url = new URL("https://api.stlouisfed.org/fred/series/observations");
  url.searchParams.set("series_id", m.series);
  url.searchParams.set("api_key", FRED_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("observation_start", `${start}-01-01`);
  url.searchParams.set("observation_end", `${end}-12-31`);
  url.searchParams.set("frequency", "a"); // annual aggregation
  url.searchParams.set("aggregation_method", m.agg === "eop" ? "eop" : "avg");
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FRED ${m.series} ${r.status}`);
  const j = await r.json();
  const out = {};
  for (const o of j.observations || []) {
    if (o.value === ".") continue;
    out[+o.date.slice(0, 4)] = parseFloat(o.value);
  }
  return out;
}

// ---- fetch a World Bank series (already annual) ----
async function fetchWorldBank(m, start, end) {
  const url = `https://api.worldbank.org/v2/country/${m.country}/indicator/${m.series}?format=json&per_page=20000&date=${start}:${end}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`WB ${m.series} ${r.status}`);
  const j = await r.json();
  const out = {};
  for (const o of j[1] || []) if (o.value != null) out[+o.date] = o.value;
  return out;
}

async function getSeries(id, start, end) {
  const key = `${id}:${start}:${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const m = byId[id];
  if (!m) throw new Error(`unknown metric ${id}`);
  const data = m.source === "fred" ? await fetchFred(m, start, end) : await fetchWorldBank(m, start, end);
  cache.set(key, { ts: Date.now(), data });
  return data;
}

// list available metrics (drives the UI configurability)
app.get("/api/catalog", (_req, res) => {
  res.json(CATALOG.map(({ id, label, region, unit, source }) => ({ id, label, region, unit, source })));
});

// fetch many series at once: /api/data?ids=us_sp500,in_gdp&start=2005&end=2024
app.get("/api/data", async (req, res) => {
  try {
    const ids = String(req.query.ids || "").split(",").filter(Boolean);
    const start = +req.query.start || 2005;
    const end = +req.query.end || new Date().getFullYear();
    const results = {};
    const errors = {};
    await Promise.all(ids.map(async (id) => {
      try { results[id] = await getSeries(id, start, end); }
      catch (e) { errors[id] = e.message; }
    }));
    res.json({ start, end, series: results, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// serve built client
const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));

app.listen(PORT, () => console.log(`Cross-Market Lab on :${PORT} (FRED key: ${FRED_KEY ? "set" : "MISSING"})`));
