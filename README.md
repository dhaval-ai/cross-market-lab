# Cross-Market Lab

A configurable web app for correlating **US market/macro metrics** against **India metrics** using **live data from authentic sources**:

- **FRED** (Federal Reserve Bank of St. Louis) — US equities (S&P 500, NASDAQ, Dow), VIX, Treasury yields, Fed Funds, mortgage rates, CPI, Case-Shiller home prices, unemployment, M2, industrial production, plus **USD/INR, gold, and crude oil**.
- **World Bank Open Data** (keyless) — India GDP, GDP growth, CPI inflation, lending & real interest rates, FDI, market cap, exports, broad money; plus US GDP comparators.

Everything is **configurable from the UI**: toggle any metric on/off, choose the year range, switch between **levels** and **year-over-year moves**, and pick any pair to analyze.

## What it does

- **Correlation matrix** across every selected metric (color-coded, blue = positive, orange = inverse).
- **Strongest cross-market links** — auto-ranked relationships between *different* regions/assets (e.g. does the Fed Funds rate track India's lending rate?).
- **Pair & lead-lag** — scatter + Pearson r, plus a lead/lag scan that tests whether metric X *moves before* metric Y (finds the lag with the strongest correlation).
- **Rolling correlation** — how a relationship *changes over time*, so you can spot regime shifts (markets that decoupled or flipped sign).
- **Normalized overlay** — every series rebased to 100 to compare growth paths / wealth creation directly, stripping out scale and currency.

## Configurability — adding metrics

Open `shared-catalog.js` and add a row. It appears in the app automatically.

```js
// FRED example (needs the free key):
{ id: "us_ppi", label: "US PPI", region: "US", unit: "idx", source: "fred", series: "PPIACO", agg: "avg" },

// World Bank example (keyless). Find codes at data.worldbank.org/indicator:
{ id: "in_unemp", label: "India Unemployment", region: "India", unit: "%",
  source: "worldbank", series: "SL.UEM.TOTL.ZS", country: "IND" },
```

- FRED series IDs: browse https://fred.stlouisfed.org/
- World Bank indicator codes: browse https://data.worldbank.org/indicator

## Run locally

1. Get a free FRED API key (30 seconds): https://fred.stlouisfed.org/docs/api/api_key.html
2. Install and build:
   ```bash
   npm run install:all
   npm run build
   ```
3. Start with your key:
   ```bash
   FRED_API_KEY=your_key_here npm start
   ```
4. Open http://localhost:8080

For live-reload development, run the backend (`FRED_API_KEY=... npm run dev:server`) and, in another terminal, the client (`npm run dev:client`), then open the Vite URL it prints.

## Deploy so others can review

The app is one Node service that serves both the API and the built frontend. Any of these work:

### Render (simple, free tier)
1. Push this folder to a GitHub repo.
2. New → Web Service → connect the repo.
3. Build command: `npm run install:all && npm run build`
4. Start command: `npm start`
5. Add environment variable `FRED_API_KEY` = your key.
6. Deploy → share the `https://...onrender.com` URL.

### Railway
1. New Project → Deploy from GitHub repo.
2. Add variable `FRED_API_KEY`.
3. Railway auto-detects `npm start`. Set build to `npm run install:all && npm run build`.

### Fly.io / Docker
A `Dockerfile` is included. `fly launch`, set the `FRED_API_KEY` secret (`fly secrets set FRED_API_KEY=...`), and deploy.

## Notes on honesty & limits

- **Correlation is not causation.** Annual samples are small (a 20-year window is ~20 points), so lead/lag and rolling results are **hypotheses to investigate**, not trading signals.
- **Levels vs moves matters.** Correlating raw index *levels* mostly captures shared upward trend and overstates how related things are. **YoY moves** is the more honest default.
- Data is cached server-side for 12h to stay well under FRED's rate limit (120 req/min).
- Not investment advice.
