import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend, ReferenceLine, BarChart, Bar, Cell, Area, AreaChart,
} from "recharts";

const REGION_COLORS = { US: "#4ea1ff", India: "#ff7a45", FX: "#c792ea", Global: "#f5c542" };

/* ---------- stats ---------- */
const pearson = (a, b) => {
  const n = a.length; if (n < 3) return NaN;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  const den = Math.sqrt(da * db); return den === 0 ? NaN : num / den;
};
const toReturns = (v) => v.slice(1).map((x, i) => (v[i] === 0 ? 0 : (x - v[i]) / Math.abs(v[i]) * 100));
const normalize = (v) => { const b = v.find((x) => x != null); return v.map((x) => (b ? (x / b) * 100 : x)); };
const strength = (r) => { const a = Math.abs(r); return a >= .8 ? "very strong" : a >= .6 ? "strong" : a >= .4 ? "moderate" : a >= .2 ? "weak" : "negligible"; };
const shortLabel = (l) => l.replace(/\s*\(.*?\)\s*/g, " ").trim();

export default function App() {
  const [catalog, setCatalog] = useState([]);
  const [raw, setRaw] = useState({});         // id -> {year: value}
  const [years, setYears] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState([2005, new Date().getFullYear() - 1]);
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState("returns");
  const [tab, setTab] = useState("matrix");
  const [xKey, setXKey] = useState("us_gdpgr_wb");
  const [yKey, setYKey] = useState("in_gdp_growth");
  const [maxLag, setMaxLag] = useState(3);
  const [rollWin, setRollWin] = useState(6);

  // load catalog once
  const [allIds, setAllIds] = useState([]);

  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((c) => {
      setCatalog(c);
      setAllIds(c.map((m) => m.id));
      setSelected(c.slice(0, 8).map((m) => m.id));
      if (c.length) {
        const first = c[0].id;
        const firstIndia = (c.find((m) => m.region === "India") || c[0]).id;
        setXKey((k) => (c.some((m) => m.id === k) ? k : first));
        setYKey((k) => (c.some((m) => m.id === k) ? k : firstIndia));
      }
    }).catch(() => setCatalog([]));
  }, []);

  // load data for a set of ids over the range
  const load = useCallback(async (ids, [s, e]) => {
    if (!ids.length) return;
    setLoading(true);
    try {
      const chunks = [];
      for (let i = 0; i < ids.length; i += 8) chunks.push(ids.slice(i, i + 8));
      let start = s, end = e; const merged = {}; const errs = {};
      for (const ch of chunks) {
        const r = await fetch(`/api/data?ids=${ch.join(",")}&start=${s}&end=${e}`);
        const j = await r.json();
        Object.assign(merged, j.series || {});
        Object.assign(errs, j.errors || {});
        start = j.start; end = j.end;
      }
      setRaw((prev) => ({ ...prev, ...merged }));
      setErrors(errs);
      const ys = []; for (let y = start; y <= end; y++) ys.push(y);
      setYears(ys);
    } finally { setLoading(false); }
  }, []);

  // fetch ALL catalog metrics once loaded, and whenever the year range changes.
  // Toggling chips then only controls what's DISPLAYED, not what's fetched —
  // so every metric (incl. picker choices in other tabs) always has data.
  useEffect(() => { if (allIds.length) load(allIds, range); }, [allIds, range, load]);

  // once data is in, make sure the pair points at metrics that actually returned data
  useEffect(() => {
    const withData = Object.keys(raw).filter((id) => Object.keys(raw[id] || {}).length > 0);
    if (!withData.length) return;
    setXKey((k) => (Object.keys(raw[k] || {}).length ? k : (withData.find((id) => meta[id]?.region === "US") || withData[0])));
    setYKey((k) => (Object.keys(raw[k] || {}).length ? k : (withData.find((id) => meta[id]?.region === "India") || withData[0])));
  }, [raw, meta]);

  const meta = useMemo(() => Object.fromEntries(catalog.map((m) => [m.id, m])), [catalog]);

  // aligned value arrays over the year axis (nulls where missing)
  const aligned = useMemo(() => {
    const out = {};
    for (const id of selected) out[id] = years.map((y) => (raw[id]?.[y] ?? null));
    return out;
  }, [selected, years, raw]);

  // build a common-support pair (drop years where either is null), then optionally to returns
  const pairSeries = useCallback((idA, idB) => {
    const A = [], B = [];
    for (const y of years) {
      const a = raw[idA]?.[y], b = raw[idB]?.[y];
      if (a != null && b != null) { A.push(a); B.push(b); }
    }
    if (mode === "returns") return [toReturns(A), toReturns(B)];
    return [A, B];
  }, [years, raw, mode]);

  const selMeta = selected.map((id) => meta[id]).filter(Boolean);

  const matrix = useMemo(() =>
    selected.map((r) => selected.map((c) => { const [a, b] = pairSeries(r, c); return pearson(a, b); })),
    [selected, pairSeries]);

  const insights = useMemo(() => {
    const out = [];
    for (let i = 0; i < selected.length; i++)
      for (let j = i + 1; j < selected.length; j++) {
        const a = meta[selected[i]], b = meta[selected[j]];
        if (!a || !b || a.region === b.region) continue;
        const [sa, sb] = pairSeries(selected[i], selected[j]);
        const r = pearson(sa, sb);
        if (!isNaN(r)) out.push({ a: selected[i], b: selected[j], r });
      }
    return out.sort((p, q) => Math.abs(q.r) - Math.abs(p.r)).slice(0, 8);
  }, [selected, meta, pairSeries]);

  const [px, py] = pairSeries(xKey, yKey);
  const pairR = pearson(px, py);
  const scatter = px.map((x, i) => ({ x, y: py[i] }));
  const xHasData = Object.keys(raw[xKey] || {}).length > 0;
  const yHasData = Object.keys(raw[yKey] || {}).length > 0;
  const pairPlottable = scatter.length >= 2;

  const lagScan = useMemo(() => {
    const xs = raw[xKey] || {}, ys = raw[yKey] || {};
    const out = [];
    for (let L = -maxLag; L <= maxLag; L++) {
      const A = [], B = [];
      for (const y of years) { const a = xs[y], b = ys[y + L]; if (a != null && b != null) { A.push(a); B.push(b); } }
      out.push({ lag: L, r: pearson(mode === "returns" ? toReturns(A) : A, mode === "returns" ? toReturns(B) : B) });
    }
    return out;
  }, [raw, xKey, yKey, years, maxLag, mode]);
  const bestLag = lagScan.reduce((b, c) => (Math.abs(c.r || 0) > Math.abs(b.r || 0) ? c : b), { lag: 0, r: 0 });

  // rolling correlation of the X/Y pair
  const rolling = useMemo(() => {
    const rows = [];
    const xs = years.map((y) => raw[xKey]?.[y] ?? null);
    const ys = years.map((y) => raw[yKey]?.[y] ?? null);
    const rx = mode === "returns" ? [null, ...toReturns(xs.map((v) => v ?? 0))] : xs;
    const ry = mode === "returns" ? [null, ...toReturns(ys.map((v) => v ?? 0))] : ys;
    for (let i = 0; i < years.length; i++) {
      if (i + 1 < rollWin) { rows.push({ year: years[i], r: null }); continue; }
      const A = [], B = [];
      for (let k = i - rollWin + 1; k <= i; k++) if (rx[k] != null && ry[k] != null) { A.push(rx[k]); B.push(ry[k]); }
      rows.push({ year: years[i], r: A.length >= 3 ? pearson(A, B) : null });
    }
    return rows;
  }, [years, raw, xKey, yKey, mode, rollWin]);

  const normData = useMemo(() => years.map((y, i) => {
    const row = { year: y };
    for (const id of selected) { const v = aligned[id]; row[id] = normalize(v)[i]; }
    return row;
  }), [years, selected, aligned]);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const cellColor = (r) => { if (isNaN(r)) return "#1b1f2a"; const a = Math.abs(r); return `hsl(${r >= 0 ? 205 : 14} 70% ${18 + a * 34}%)`; };

  // ---- VALIDATION: per-metric health ----
  const health = useMemo(() => catalog.map((m) => {
    const pts = raw[m.id] ? Object.keys(raw[m.id]).length : 0;
    const ys = raw[m.id] ? Object.keys(raw[m.id]).map(Number).sort((a, b) => a - b) : [];
    let status = "ok";
    if (errors[m.id]) status = "error";
    else if (pts === 0) status = (loading ? "loading" : "empty");
    else if (pts < 3) status = "sparse";
    return { ...m, pts, first: ys[0], last: ys[ys.length - 1], status, error: errors[m.id] || null };
  }), [catalog, raw, errors, loading]);

  // ---- VALIDATION: per-source rollup ----
  const sourceHealth = useMemo(() => {
    const groups = {};
    for (const h of health) {
      const key = h.source === "fred" ? "FRED" : "World Bank";
      (groups[key] ||= { total: 0, ok: 0, empty: 0, error: 0 });
      groups[key].total++;
      if (h.status === "ok" || h.status === "sparse") groups[key].ok++;
      else if (h.status === "error") groups[key].error++;
      else if (h.status === "empty") groups[key].empty++;
    }
    return groups;
  }, [health]);

  // ---- VALIDATION: is each tab's current view actually plottable? ----
  const hasData = (id) => (raw[id] ? Object.keys(raw[id]).length > 0 : false);
  const selectedWithData = selected.filter(hasData);
  const tabStatus = {
    matrix: selectedWithData.length >= 2
      ? { ok: true, msg: `${selectedWithData.length} metrics with data` }
      : { ok: false, msg: "Select at least 2 metrics that have data" },
    pair: (hasData(xKey) && hasData(yKey))
      ? { ok: true, msg: `${shortLabel(meta[xKey]?.label || "X")} & ${shortLabel(meta[yKey]?.label || "Y")} loaded` }
      : { ok: false, msg: `Missing data: ${!hasData(xKey) ? shortLabel(meta[xKey]?.label || "X") : ""}${!hasData(xKey) && !hasData(yKey) ? " & " : ""}${!hasData(yKey) ? shortLabel(meta[yKey]?.label || "Y") : ""}` },
    rolling: (hasData(xKey) && hasData(yKey))
      ? { ok: true, msg: `pair loaded` }
      : { ok: false, msg: `Missing data for the selected pair` },
    normalize: selectedWithData.length >= 1
      ? { ok: true, msg: `${selectedWithData.length} metrics with data` }
      : { ok: false, msg: "No selected metrics have data" },
    health: { ok: true, msg: "" },
  };
  const statusColor = { ok: "#3fb950", sparse: "#d29922", empty: "#8b949e", error: "#f85149", loading: "#4ea1ff" };
  const statusLabel = { ok: "OK", sparse: "Sparse", empty: "No data", error: "Error", loading: "Loading" };

  const refresh = () => { setRaw({}); if (allIds.length) load(allIds, range); };

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <header style={S.header}>
        <div>
          <div style={S.kicker}>CROSS-MARKET LAB · LIVE DATA</div>
          <h1 style={S.h1}>US <span style={{ color: "#5b6472" }}>&harr;</span> India correlation console</h1>
          <p style={S.sub}>Live series from FRED (US markets, rates, commodities, USD/INR) and the World Bank (India & US macro). Configure metrics, switch levels vs YoY moves, and surface lead/lag and regime shifts.</p>
        </div>
        <div style={S.modeWrap}>
          <span style={S.modeLabel}>Analyze on</span>
          <div style={S.seg}>{["returns", "levels"].map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ ...S.segBtn, ...(mode === m ? S.segOn : {}) }}>{m === "returns" ? "YoY moves" : "Levels"}</button>
          ))}</div>
          <div style={S.rangeRow}>
            <span style={S.modeLabel}>Years</span>
            <input type="number" value={range[0]} min={1980} max={range[1]} onChange={(e) => setRange([+e.target.value, range[1]])} style={S.yearInput} />
            <span style={{ color: "#5b6472" }}>–</span>
            <input type="number" value={range[1]} min={range[0]} max={new Date().getFullYear()} onChange={(e) => setRange([range[0], +e.target.value])} style={S.yearInput} />
          </div>
        </div>
      </header>

      {/* SOURCE HEALTH STRIP — always visible validation of data pulls */}
      <section style={S.srcStrip}>
        {Object.entries(sourceHealth).map(([name, s]) => {
          const allOk = s.ok === s.total, someOk = s.ok > 0;
          const col = loading ? "#4ea1ff" : allOk ? "#3fb950" : someOk ? "#d29922" : "#f85149";
          return (
            <div key={name} style={S.srcPill} title={`${name}: ${s.ok}/${s.total} series returned data`}>
              <span style={{ ...S.srcDot, background: col }} />
              <b style={S.srcName}>{name}</b>
              <span style={S.srcCount}>{loading ? "checking…" : `${s.ok}/${s.total} live`}</span>
              {!loading && s.error > 0 && <span style={S.srcErr}>{s.error} err</span>}
              {!loading && s.empty > 0 && <span style={S.srcEmpty}>{s.empty} empty</span>}
            </div>
          );
        })}
        <button onClick={refresh} style={S.refreshBtn} disabled={loading}>{loading ? "Loading…" : "↻ Refresh"}</button>
        <button onClick={() => setTab("health")} style={S.detailBtn}>Data health →</button>
      </section>

      {Object.keys(errors).length > 0 && !loading && (
        <div style={S.errBox}>Series that returned no data: {Object.entries(errors).map(([k, v]) => `${meta[k]?.label || k} (${v})`).join(" · ")}</div>
      )}

      {/* metric chips grouped by region */}
      <section style={S.chips}>
        {catalog.map((m) => {
          const on = selected.includes(m.id); const c = REGION_COLORS[m.region];
          const h = health.find((x) => x.id === m.id);
          const bad = h && (h.status === "empty" || h.status === "error");
          return (
            <button key={m.id} onClick={() => toggle(m.id)} title={h ? `${statusLabel[h.status]}${h.pts ? ` · ${h.pts} yrs (${h.first}–${h.last})` : ""}${h.error ? ` · ${h.error}` : ""}` : ""}
              style={{ ...S.chip, borderColor: on ? c : "#2a2f3c", background: on ? `${c}22` : "transparent", color: on ? "#e8ecf3" : "#7c8595", opacity: bad ? 0.55 : 1 }}>
              <span style={{ ...S.dot, background: bad ? "#f85149" : c, opacity: on ? 1 : .35 }} />{m.label}
              {bad && <span style={S.chipWarn}>⚠</span>}
            </button>
          );
        })}
      </section>

      <nav style={S.tabs}>
        {[["matrix", "Correlation matrix"], ["pair", "Pair & lead-lag"], ["rolling", "Rolling correlation"], ["normalize", "Normalized overlay"], ["health", "Data health"]].map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ ...S.tab, ...(tab === id ? S.tabOn : {}) }}>{l}</button>
        ))}
      </nav>

      {/* PER-TAB READINESS BANNER */}
      {tab !== "health" && (
        <div style={{ ...S.readyBanner, borderColor: tabStatus[tab].ok ? "#1a3a24" : "#4a2318", background: tabStatus[tab].ok ? "#0f1f14" : "#1f1410" }}>
          <span style={{ ...S.srcDot, background: tabStatus[tab].ok ? "#3fb950" : "#f85149" }} />
          <span style={S.readyMsg}>{tabStatus[tab].ok ? "Ready — " : "Can't plot — "}{tabStatus[tab].msg}</span>
        </div>
      )}

      {tab === "matrix" && (
        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.cardTitle}>Correlation matrix <span style={S.muted}>· {mode === "returns" ? "YoY moves" : "levels"} · {selected.length} metrics</span></div>
            <div style={{ overflowX: "auto" }}>
              <table style={S.matrix}><thead><tr><th style={S.matCorner} />{selMeta.map((m) => <th key={m.id} style={S.matColH}>{shortLabel(m.label)}</th>)}</tr></thead>
                <tbody>{selMeta.map((rm, ri) => (
                  <tr key={rm.id}><th style={S.matRowH}>{shortLabel(rm.label)}</th>
                    {selMeta.map((cm, ci) => { const r = matrix[ri][ci]; return (
                      <td key={cm.id} style={{ ...S.matCell, background: cellColor(r) }} title={`${rm.label} vs ${cm.label}: ${isNaN(r) ? "n/a" : r.toFixed(2)}`}>{isNaN(r) ? "–" : r.toFixed(2)}</td>
                    ); })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={S.legend}><span style={{ color: "#ff7a45" }}>■</span> inverse <span style={{ margin: "0 6px", color: "#5b6472" }}>—</span> <span style={{ color: "#4ea1ff" }}>■</span> positive · intensity = strength</div>
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Strongest cross-market links</div>
            <p style={S.muted}>Tightest relationships between different regions/assets. Click to inspect.</p>
            <div style={S.insList}>{insights.map((p, i) => (
              <button key={i} style={S.insRow} onClick={() => { setXKey(p.a); setYKey(p.b); setTab("pair"); }}>
                <span style={{ ...S.rBadge, background: cellColor(p.r) }}>{p.r >= 0 ? "+" : ""}{p.r.toFixed(2)}</span>
                <span style={S.insTxt}><b>{shortLabel(meta[p.a].label)}</b> &harr; <b>{shortLabel(meta[p.b].label)}</b><span style={S.insMeta}>{strength(p.r)} {p.r >= 0 ? "positive" : "inverse"}</span></span>
                <span style={S.arrow}>&rarr;</span>
              </button>
            ))}</div>
          </div>
        </div>
      )}

      {tab === "pair" && (
        <div>
          <div style={S.pairPick}>
            <Picker label="Metric X" value={xKey} onChange={setXKey} catalog={catalog} />
            <span style={S.vs}>vs</span>
            <Picker label="Metric Y" value={yKey} onChange={setYKey} catalog={catalog} />
            <div style={S.rStat}><span style={S.rStatLabel}>PEARSON r</span>
              <span style={{ ...S.rStatVal, color: isNaN(pairR) ? "#7c8595" : pairR >= 0 ? "#4ea1ff" : "#ff7a45" }}>{isNaN(pairR) ? "–" : pairR.toFixed(2)}</span>
              <span style={S.rStatSub}>{isNaN(pairR) ? "insufficient overlap" : `${strength(pairR)} · n=${px.length}`}</span>
            </div>
          </div>
          <div style={S.grid2}>
            <div style={S.card}><div style={S.cardTitle}>Scatter <span style={S.muted}>· each point = one year</span></div>
              {pairPlottable ? (
              <ResponsiveContainer width="100%" height={300}><ScatterChart margin={{ top: 10, right: 16, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="#232838" /><XAxis type="number" dataKey="x" stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} label={{ value: shortLabel(meta[xKey]?.label || ""), position: "bottom", fill: "#8b94a3", fontSize: 11 }} />
                <YAxis type="number" dataKey="y" stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} /><ZAxis range={[70, 70]} />
                <Tooltip contentStyle={S.tip} formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)} labelFormatter={() => ""} />
                <Scatter data={scatter}>{scatter.map((_, i) => <Cell key={i} fill={`hsl(205 70% ${45 + i * 2}%)`} />)}</Scatter>
              </ScatterChart></ResponsiveContainer>
              ) : (
                <div style={S.noData}>
                  No overlapping data to plot.<br />
                  {!xHasData && <span>{shortLabel(meta[xKey]?.label || "X")} has no data{meta[xKey]?.source === "fred" ? " (check FRED_API_KEY)" : ""}. </span>}
                  {!yHasData && <span>{shortLabel(meta[yKey]?.label || "Y")} has no data{meta[yKey]?.source === "fred" ? " (check FRED_API_KEY)" : ""}. </span>}
                  {xHasData && yHasData && <span>The two series don't share any years in this range — try widening the year range.</span>}
                </div>
              )}
            </div>
            <div style={S.card}><div style={S.cardTitle}>Lead / lag scan <span style={S.muted}>· does X move before Y?</span></div>
              <div style={S.lagCtrl}><label style={S.muted}>Max lag (yrs): {maxLag}</label><input type="range" min={1} max={6} value={maxLag} onChange={(e) => setMaxLag(+e.target.value)} style={{ width: 130 }} /></div>
              <ResponsiveContainer width="100%" height={230}><BarChart data={lagScan} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid stroke="#232838" /><XAxis dataKey="lag" stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} /><YAxis domain={[-1, 1]} stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} />
                <ReferenceLine y={0} stroke="#3a4152" /><Tooltip contentStyle={S.tip} formatter={(v) => (v == null ? "n/a" : v.toFixed(2))} />
                <Bar dataKey="r" radius={[3, 3, 0, 0]}>{lagScan.map((d, i) => <Cell key={i} fill={d.lag === bestLag.lag ? "#f5c542" : (d.r || 0) >= 0 ? "#4ea1ff" : "#ff7a45"} />)}</Bar>
              </BarChart></ResponsiveContainer>
              <div style={S.lagNote}>Strongest at <b style={{ color: "#f5c542" }}>lag {bestLag.lag}</b> (r={(bestLag.r || 0).toFixed(2)}). {bestLag.lag > 0 ? `${shortLabel(meta[xKey]?.label)} tends to lead by ~${bestLag.lag}yr.` : bestLag.lag < 0 ? `${shortLabel(meta[yKey]?.label)} tends to lead by ~${Math.abs(bestLag.lag)}yr.` : "No clear leader."}</div>
            </div>
          </div>
        </div>
      )}

      {tab === "rolling" && (
        <div style={S.card}>
          <div style={S.cardTitle}>Rolling correlation <span style={S.muted}>· {shortLabel(meta[xKey]?.label || "")} vs {shortLabel(meta[yKey]?.label || "")} · {rollWin}-yr window</span></div>
          <div style={S.pairPick}>
            <Picker label="Metric X" value={xKey} onChange={setXKey} catalog={catalog} />
            <Picker label="Metric Y" value={yKey} onChange={setYKey} catalog={catalog} />
            <div style={S.lagCtrl}><label style={S.muted}>Window: {rollWin}yr</label><input type="range" min={3} max={10} value={rollWin} onChange={(e) => setRollWin(+e.target.value)} style={{ width: 130 }} /></div>
          </div>
          {rolling.some((d) => d.r != null) ? (
          <ResponsiveContainer width="100%" height={340}><AreaChart data={rolling} margin={{ top: 10, right: 20, bottom: 4, left: 0 }}>
            <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4ea1ff" stopOpacity={.5} /><stop offset="100%" stopColor="#4ea1ff" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="#232838" /><XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} /><YAxis domain={[-1, 1]} stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} />
            <ReferenceLine y={0} stroke="#3a4152" /><Tooltip contentStyle={S.tip} formatter={(v) => (v == null ? "n/a" : v.toFixed(2))} />
            <Area dataKey="r" stroke="#4ea1ff" strokeWidth={2} fill="url(#g)" connectNulls />
          </AreaChart></ResponsiveContainer>
          ) : (
            <div style={{ ...S.noData, height: 340 }}>
              Not enough overlapping data for a {rollWin}-year rolling window.<br />
              {!xHasData && <span>{shortLabel(meta[xKey]?.label || "X")} has no data{meta[xKey]?.source === "fred" ? " (check FRED_API_KEY)" : ""}. </span>}
              {!yHasData && <span>{shortLabel(meta[yKey]?.label || "Y")} has no data{meta[yKey]?.source === "fred" ? " (check FRED_API_KEY)" : ""}. </span>}
              {xHasData && yHasData && <span>Try a smaller window or a wider year range.</span>}
            </div>
          )}
          <div style={S.muted}>Shows how the relationship <i>changes</i> over time. A line that swings from positive to negative signals a regime shift — the two markets decoupled or flipped. Flat high values mean a stable link you can lean on.</div>
        </div>
      )}

      {tab === "normalize" && (
        <div style={S.card}>
          <div style={S.cardTitle}>Rebased to 100 <span style={S.muted}>· growth paths of selected metrics</span></div>
          <ResponsiveContainer width="100%" height={430}><LineChart data={normData} margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#232838" /><XAxis dataKey="year" stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} /><YAxis stroke="#6b7280" tick={{ fontSize: 11, fill: "#8b94a3" }} />
            <Tooltip contentStyle={S.tip} formatter={(v) => (v == null ? "–" : v.toFixed(0))} /><Legend wrapperStyle={{ fontSize: 11 }} />
            {selected.map((id) => <Line key={id} dataKey={id} name={shortLabel(meta[id]?.label || id)} stroke={REGION_COLORS[meta[id]?.region]} dot={false} strokeWidth={1.8} connectNulls />)}
          </LineChart></ResponsiveContainer>
          <div style={S.muted}>Everything starts at 100 in {years[0]}. Steeper = faster compounding. Strips out scale and currency so you can compare wealth creation directly.</div>
        </div>
      )}

      {tab === "health" && (
        <div style={S.card}>
          <div style={S.cardTitle}>Data health <span style={S.muted}>· live validation of every source & metric · range {range[0]}–{range[1]}</span></div>
          <div style={S.healthSummary}>
            {Object.entries(sourceHealth).map(([name, s]) => (
              <div key={name} style={S.healthCard}>
                <div style={S.healthCardName}>{name}</div>
                <div style={S.healthCardBig}>{s.ok}<span style={S.healthCardTot}>/{s.total}</span></div>
                <div style={S.healthCardSub}>series returned data</div>
                <div style={S.healthCardBreak}>
                  {s.error > 0 && <span style={{ color: "#f85149" }}>{s.error} error</span>}
                  {s.empty > 0 && <span style={{ color: "#8b949e" }}>{s.empty} empty</span>}
                  {s.error === 0 && s.empty === 0 && <span style={{ color: "#3fb950" }}>all healthy</span>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ overflowX: "auto", marginTop: 6 }}>
            <table style={S.healthTable}>
              <thead><tr>
                <th style={S.hTh}>Metric</th><th style={S.hTh}>Region</th><th style={S.hTh}>Source</th>
                <th style={S.hTh}>Status</th><th style={S.hTh}>Years</th><th style={S.hTh}>Range</th><th style={S.hTh}>Detail</th>
              </tr></thead>
              <tbody>
                {health.map((h) => (
                  <tr key={h.id} style={{ opacity: h.status === "empty" || h.status === "error" ? 0.85 : 1 }}>
                    <td style={S.hTd}>{h.label}</td>
                    <td style={S.hTd}><span style={{ ...S.dot, background: REGION_COLORS[h.region] }} /> {h.region}</td>
                    <td style={S.hTdMono}>{h.source === "fred" ? "FRED" : "World Bank"}</td>
                    <td style={S.hTd}><span style={{ ...S.statusPill, background: `${statusColor[h.status]}22`, color: statusColor[h.status], borderColor: `${statusColor[h.status]}55` }}>{statusLabel[h.status]}</span></td>
                    <td style={S.hTdMono}>{h.pts || "–"}</td>
                    <td style={S.hTdMono}>{h.first ? `${h.first}–${h.last}` : "–"}</td>
                    <td style={S.hTdDetail}>{h.error || (h.status === "sparse" ? "few points; correlations unreliable" : h.status === "empty" ? (h.source === "fred" ? "no data — check FRED_API_KEY or year range" : "no data for this range (WB may lag 1–2 yrs)") : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.healthNote}>
            <b>How to read this:</b> Each metric is pulled live when the app loads. <span style={{ color: "#3fb950" }}>OK</span> = data returned. <span style={{ color: "#d29922" }}>Sparse</span> = fewer than 3 years (correlations shaky). <span style={{ color: "#8b949e" }}>No data</span> = the source returned nothing for this range. <span style={{ color: "#f85149" }}>Error</span> = the request failed (message shown in Detail). If <b>all FRED rows</b> are empty, the server's <code>FRED_API_KEY</code> isn't set or is invalid. If <b>only recent years</b> are missing for World Bank India series, that's normal reporting lag, not a fault. Use <b>Refresh</b> above to re-pull.
          </div>
        </div>
      )}
    </div>
  );
}

function Picker({ label, value, onChange, catalog }) {
  return (<label style={S.pickLabel}><span style={S.muted}>{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} style={S.select}>
      {catalog.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
    </select></label>);
}

const S = {
  root: { background: "#0c0e14", color: "#e8ecf3", fontFamily: "'DM Sans',system-ui,sans-serif", minHeight: "100vh", padding: "26px 22px 40px", maxWidth: 1180, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 18 },
  kicker: { fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: ".28em", color: "#5b6472", marginBottom: 8 },
  h1: { fontFamily: "'Space Grotesk','DM Sans',sans-serif", fontSize: 30, fontWeight: 600, margin: 0, lineHeight: 1.1, letterSpacing: "-.02em" },
  sub: { color: "#8b94a3", fontSize: 13.5, maxWidth: 580, marginTop: 10, lineHeight: 1.5 },
  modeWrap: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" },
  modeLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: ".2em", color: "#5b6472" },
  seg: { display: "flex", border: "1px solid #2a2f3c", borderRadius: 10, overflow: "hidden" },
  segBtn: { background: "transparent", color: "#8b94a3", border: "none", padding: "8px 14px", fontSize: 12.5, cursor: "pointer", fontWeight: 500 },
  segOn: { background: "#1a1f2b", color: "#e8ecf3" },
  rangeRow: { display: "flex", alignItems: "center", gap: 6, marginTop: 4 },
  yearInput: { width: 62, background: "#11141d", color: "#e8ecf3", border: "1px solid #2a2f3c", borderRadius: 8, padding: "6px 8px", fontSize: 12 },
  loading: { color: "#4ea1ff", fontSize: 12, marginBottom: 10, fontFamily: "'JetBrains Mono',monospace" },
  errBox: { background: "#2a1a12", border: "1px solid #5a3520", color: "#f5b78a", fontSize: 11.5, borderRadius: 8, padding: "8px 11px", marginBottom: 12 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: { display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 20, border: "1px solid", fontSize: 12, cursor: "pointer", fontWeight: 500 },
  dot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  tabs: { display: "flex", gap: 4, borderBottom: "1px solid #1e232f", marginBottom: 18, flexWrap: "wrap" },
  tab: { background: "transparent", border: "none", borderBottom: "2px solid transparent", color: "#7c8595", padding: "9px 14px", fontSize: 13, cursor: "pointer", fontWeight: 500, marginBottom: -1 },
  tabOn: { color: "#e8ecf3", borderBottomColor: "#4ea1ff" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 },
  card: { background: "#11141d", border: "1px solid #1e232f", borderRadius: 14, padding: 16 },
  cardTitle: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 14.5, fontWeight: 600, marginBottom: 10 },
  muted: { color: "#6b7280", fontSize: 12, fontWeight: 400 },
  matrix: { borderCollapse: "collapse", fontSize: 11, width: "100%" },
  matCorner: { minWidth: 90 }, matColH: { padding: "4px 3px", color: "#8b94a3", fontWeight: 500, textAlign: "center", verticalAlign: "bottom", fontSize: 9, maxWidth: 42 },
  matRowH: { padding: "4px 8px 4px 0", color: "#8b94a3", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap", fontSize: 10 },
  matCell: { textAlign: "center", padding: "7px 4px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "#e8ecf3", borderRadius: 3, minWidth: 34 },
  legend: { marginTop: 10, fontSize: 11, color: "#8b94a3" },
  insList: { display: "flex", flexDirection: "column", gap: 6, marginTop: 12 },
  insRow: { display: "flex", alignItems: "center", gap: 11, background: "#0f131c", border: "1px solid #1e232f", borderRadius: 10, padding: "9px 11px", cursor: "pointer", textAlign: "left", color: "#e8ecf3" },
  rBadge: { fontFamily: "'JetBrains Mono',monospace", fontSize: 12, padding: "3px 7px", borderRadius: 6, minWidth: 46, textAlign: "center", fontWeight: 600 },
  insTxt: { display: "flex", flexDirection: "column", gap: 2, fontSize: 12.5, flex: 1 }, insMeta: { color: "#6b7280", fontSize: 11 }, arrow: { color: "#5b6472" },
  pairPick: { display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 14 },
  pickLabel: { display: "flex", flexDirection: "column", gap: 5 },
  select: { background: "#11141d", color: "#e8ecf3", border: "1px solid #2a2f3c", borderRadius: 9, padding: "9px 11px", fontSize: 13, minWidth: 190 },
  vs: { color: "#5b6472", fontSize: 13, paddingBottom: 10 },
  rStat: { marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 },
  rStatLabel: { fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, letterSpacing: ".18em", color: "#5b6472" },
  rStatVal: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 30, fontWeight: 600, lineHeight: 1 }, rStatSub: { fontSize: 11, color: "#6b7280" },
  tip: { background: "#11141d", border: "1px solid #2a2f3c", borderRadius: 8, fontSize: 12, color: "#e8ecf3" },
  lagCtrl: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }, lagNote: { fontSize: 12, color: "#8b94a3", marginTop: 8, lineHeight: 1.5 },
  noData: { height: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#7c8595", fontSize: 13, lineHeight: 1.7, padding: 20 },
  srcStrip: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 },
  srcPill: { display: "inline-flex", alignItems: "center", gap: 7, background: "#11141d", border: "1px solid #1e232f", borderRadius: 10, padding: "7px 11px", fontSize: 12 },
  srcDot: { width: 9, height: 9, borderRadius: "50%", display: "inline-block", flexShrink: 0 },
  srcName: { fontSize: 12, fontWeight: 600 }, srcCount: { color: "#8b94a3", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace" },
  srcErr: { color: "#f85149", fontSize: 10.5, background: "#f8514918", padding: "1px 6px", borderRadius: 5 },
  srcEmpty: { color: "#8b949e", fontSize: 10.5, background: "#8b949e18", padding: "1px 6px", borderRadius: 5 },
  refreshBtn: { background: "#1a1f2b", border: "1px solid #2a2f3c", color: "#e8ecf3", borderRadius: 9, padding: "7px 12px", fontSize: 12, cursor: "pointer" },
  detailBtn: { background: "transparent", border: "1px solid #2a2f3c", color: "#8b94a3", borderRadius: 9, padding: "7px 12px", fontSize: 12, cursor: "pointer", marginLeft: "auto" },
  chipWarn: { color: "#f85149", marginLeft: 4, fontSize: 11 },
  readyBanner: { display: "flex", alignItems: "center", gap: 9, border: "1px solid", borderRadius: 10, padding: "8px 12px", marginBottom: 14, fontSize: 12.5 },
  readyMsg: { color: "#c9d1d9" },
  healthSummary: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  healthCard: { flex: "1 1 160px", background: "#0f131c", border: "1px solid #1e232f", borderRadius: 12, padding: "14px 16px" },
  healthCardName: { fontSize: 12, color: "#8b94a3", fontWeight: 600, letterSpacing: ".04em" },
  healthCardBig: { fontFamily: "'Space Grotesk',sans-serif", fontSize: 32, fontWeight: 600, lineHeight: 1.1, marginTop: 4 },
  healthCardTot: { fontSize: 18, color: "#5b6472" }, healthCardSub: { fontSize: 11, color: "#6b7280" },
  healthCardBreak: { fontSize: 11, marginTop: 8, display: "flex", gap: 10, fontFamily: "'JetBrains Mono',monospace" },
  healthTable: { borderCollapse: "collapse", fontSize: 12, width: "100%" },
  hTh: { textAlign: "left", padding: "8px 10px", color: "#6b7280", fontWeight: 500, fontSize: 11, borderBottom: "1px solid #1e232f", whiteSpace: "nowrap" },
  hTd: { padding: "7px 10px", borderBottom: "1px solid #161b26", whiteSpace: "nowrap" },
  hTdMono: { padding: "7px 10px", borderBottom: "1px solid #161b26", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#8b94a3" },
  hTdDetail: { padding: "7px 10px", borderBottom: "1px solid #161b26", color: "#6b7280", fontSize: 11, maxWidth: 260, whiteSpace: "normal" },
  statusPill: { fontSize: 10.5, padding: "2px 8px", borderRadius: 20, border: "1px solid", fontWeight: 600, fontFamily: "'JetBrains Mono',monospace" },
  healthNote: { marginTop: 16, fontSize: 11.5, color: "#8b94a3", lineHeight: 1.7, background: "#0f131c", border: "1px solid #1e232f", borderRadius: 10, padding: "12px 14px" },
  footer: { marginTop: 26, color: "#4b5261", fontSize: 11.5, lineHeight: 1.6, borderTop: "1px solid #161b26", paddingTop: 14 },
};
const CSS = `@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{box-sizing:border-box}input:focus,select:focus{outline:1px solid #4ea1ff}input[type=range]{accent-color:#4ea1ff}
@media(max-width:780px){div[style*="grid-template-columns: 1fr 1fr"]{grid-template-columns:1fr !important}}`;
