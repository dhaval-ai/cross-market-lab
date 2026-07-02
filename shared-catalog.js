// catalog.js — the single source of truth for available metrics.
// Add a metric here and it appears in the app automatically. This is the
// "configurability" layer: source, id, region, unit, and how to fetch it.
//
// source "fred"      -> pulled from FRED (needs FRED_API_KEY on the server)
// source "worldbank" -> pulled from World Bank Open Data (keyless)
//
// FRED series browser:  https://fred.stlouisfed.org/
// World Bank browser:   https://data.worldbank.org/indicator

export const CATALOG = [
  // ---------- US: markets & rates (FRED, monthly/daily -> annual) ----------
  { id: "us_sp500",     label: "S&P 500",                region: "US",     unit: "idx", source: "fred", series: "SP500",       agg: "avg" },
  { id: "us_nasdaq",    label: "NASDAQ Composite",       region: "US",     unit: "idx", source: "fred", series: "NASDAQCOM",   agg: "avg" },
  { id: "us_dowjones",  label: "Dow Jones Industrial",   region: "US",     unit: "idx", source: "fred", series: "DJIA",        agg: "avg" },
  { id: "us_vix",       label: "VIX (volatility)",       region: "US",     unit: "idx", source: "fred", series: "VIXCLS",      agg: "avg" },
  { id: "us_10y",       label: "US 10Y Treasury",        region: "US",     unit: "%",   source: "fred", series: "DGS10",       agg: "avg" },
  { id: "us_2y",        label: "US 2Y Treasury",         region: "US",     unit: "%",   source: "fred", series: "DGS2",        agg: "avg" },
  { id: "us_fedfunds",  label: "US Fed Funds Rate",      region: "US",     unit: "%",   source: "fred", series: "FEDFUNDS",    agg: "avg" },
  { id: "us_mortgage",  label: "US 30Y Mortgage Rate",   region: "US",     unit: "%",   source: "fred", series: "MORTGAGE30US",agg: "avg" },

  // ---------- US: real economy & housing (FRED) ----------
  { id: "us_cpi",       label: "US CPI (index)",         region: "US",     unit: "idx", source: "fred", series: "CPIAUCSL",    agg: "avg" },
  { id: "us_homeprice", label: "US Home Price (Case-Shiller)", region: "US", unit: "idx", source: "fred", series: "CSUSHPISA", agg: "avg" },
  { id: "us_unemp",     label: "US Unemployment Rate",   region: "US",     unit: "%",   source: "fred", series: "UNRATE",      agg: "avg" },
  { id: "us_m2",        label: "US M2 Money Supply",     region: "US",     unit: "$bn", source: "fred", series: "M2SL",        agg: "avg" },
  { id: "us_indpro",    label: "US Industrial Production",region: "US",    unit: "idx", source: "fred", series: "INDPRO",      agg: "avg" },
  { id: "us_sentiment", label: "US Consumer Sentiment",  region: "US",     unit: "idx", source: "fred", series: "UMCSENT",     agg: "avg" },

  // ---------- Global / FX / commodities (FRED, keyed) ----------
  { id: "usd_inr",      label: "USD/INR",                region: "FX",     unit: "rate",source: "fred", series: "DEXINUS",     agg: "avg" },
  { id: "gold",         label: "Gold ($/oz, London PM)", region: "Global", unit: "$",   source: "fred", series: "GOLDPMGBD228NLBM", agg: "avg" },
  { id: "wti_oil",      label: "Crude Oil (WTI $/bbl)",  region: "Global", unit: "$",   source: "fred", series: "DCOILWTICO",  agg: "avg" },
  { id: "brent_oil",    label: "Crude Oil (Brent $/bbl)",region: "Global", unit: "$",   source: "fred", series: "DCOILBRENTEU",agg: "avg" },

  // ---------- India (World Bank, keyless, annual) ----------
  { id: "in_gdp",       label: "India GDP (current US$)",region: "India",  unit: "$",   source: "worldbank", series: "NY.GDP.MKTP.CD",    country: "IND" },
  { id: "in_gdp_growth",label: "India GDP Growth",       region: "India",  unit: "%",   source: "worldbank", series: "NY.GDP.MKTP.KD.ZG", country: "IND" },
  { id: "in_cpi_infl",  label: "India CPI Inflation",    region: "India",  unit: "%",   source: "worldbank", series: "FP.CPI.TOTL.ZG",    country: "IND" },
  { id: "in_lending",   label: "India Lending Rate",     region: "India",  unit: "%",   source: "worldbank", series: "FR.INR.LEND",       country: "IND" },
  { id: "in_realint",   label: "India Real Interest Rate",region: "India", unit: "%",   source: "worldbank", series: "FR.INR.RINR",       country: "IND" },
  { id: "in_fdi",       label: "India FDI Inflows",      region: "India",  unit: "$",   source: "worldbank", series: "BX.KLT.DINV.CD.WD",  country: "IND" },
  { id: "in_mktcap",    label: "India Mkt Cap (% GDP)",  region: "India",  unit: "%",   source: "worldbank", series: "CM.MKT.LCAP.GD.ZS",  country: "IND" },
  { id: "in_exports",   label: "India Exports (% GDP)",  region: "India",  unit: "%",   source: "worldbank", series: "NE.EXP.GNFS.ZS",     country: "IND" },
  { id: "in_broadmoney",label: "India Broad Money Growth",region: "India", unit: "%",   source: "worldbank", series: "FM.LBL.BMNY.ZG",     country: "IND" },

  // ---------- US comparators from World Bank (so US & India align on same annual basis) ----------
  { id: "us_gdp_wb",    label: "US GDP (current US$)",   region: "US",     unit: "$",   source: "worldbank", series: "NY.GDP.MKTP.CD",    country: "USA" },
  { id: "us_gdpgr_wb",  label: "US GDP Growth",          region: "US",     unit: "%",   source: "worldbank", series: "NY.GDP.MKTP.KD.ZG", country: "USA" },
];

export const REGION_COLORS = { US: "#4ea1ff", India: "#ff7a45", FX: "#c792ea", Global: "#f5c542" };
