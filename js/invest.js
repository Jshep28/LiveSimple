
function toggleCurrencyPicker() {
  const picker = document.getElementById('currencyPicker');
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}
function pickCurrency(code, label) {
  document.getElementById('currencyBtnLabel').textContent = label;
  document.getElementById('currencyPicker').style.display = 'none';
  // Highlight active option
  document.querySelectorAll('.curr-opt').forEach(el => {
    el.classList.toggle('active', el.textContent.trim() === label.trim());
  });
  setCurrency(code);
}
// Close picker when clicking outside
document.addEventListener('click', e => {
  const dd = document.getElementById('currencyDropdown');
  if (dd && !dd.contains(e.target)) {
    document.getElementById('currencyPicker').style.display = 'none';
  }
});
function closeInfo() {
  document.getElementById('infoPopup').classList.add('hidden');
  document.getElementById('infoFab').classList.remove('hidden');
}
function openInfo() {
  document.getElementById('infoPopup').classList.remove('hidden');
  document.getElementById('infoFab').classList.add('hidden');
}
// Always show popup on load — slide in after a short delay so it animates in
document.getElementById('infoPopup').classList.add('hidden');
setTimeout(() => {
  document.getElementById('infoPopup').classList.remove('hidden');
}, 800);



// ============================================================
//  STATE
// ============================================================
const COLORS = ['#004562','#ff6b5b','#0097a7','#f59e0b','#8b5cf6','#22c55e','#ef4444','#3b82f6','#ec4899','#14b8a6'];

function getState() {
  try { return JSON.parse(localStorage.getItem('ls_invest_v1') || '{}'); } catch(e) { return {}; }
}
function saveState(s) { localStorage.setItem('ls_invest_v1', JSON.stringify(s)); }
function getHoldings() {
  const s = getState();
  if (!s.holdings) s.holdings = [
    { ticker: 'AAPL', units: 4, buyPrice: 172.40, livePrice: null, currency: 'USD', isCustom: false },
    { ticker: 'MSFT', units: 4, buyPrice: 200.00, livePrice: null, currency: 'USD', isCustom: false },
    { ticker: 'IVV.AX', units: 4, buyPrice: 30.00, livePrice: null, currency: 'AUD', isCustom: false },
    { ticker: 'GOOGL', units: 12, buyPrice: 220.00, livePrice: null, currency: 'USD', isCustom: false },
  ];
  const today = new Date().toISOString().slice(0, 10);
  // Backfill dateAdded for any existing holding that doesn't have one
  s.holdings = s.holdings.map(h => ({ isCustom: false, dateAdded: today, ...h }));
  return s.holdings;
}
function saveHoldings(h) { const s = getState(); s.holdings = h; saveState(s); historyCache = null; }
function getGoalSettings() {
  const s = getState(); return s.goal || { target: '', contrib: '' };
}
function saveGoalSettings(g) { const s = getState(); s.goal = g; saveState(s); }

// ── Realised trades ───────────────────────────────────────────
function getRealisedTrades() { const s = getState(); return s.realisedTrades || []; }
function saveRealisedTrades(t) { const s = getState(); s.realisedTrades = t; saveState(s); }

// ── Dividends ─────────────────────────────────────────────────
function getDividends() { const s = getState(); return s.dividends || []; }
function saveDividends(d) { const s = getState(); s.dividends = d; saveState(s); }

// ── Watchlist ─────────────────────────────────────────────────
function getWatchlist() { const s = getState(); return s.watchlist || []; }
function saveWatchlist(w) { const s = getState(); s.watchlist = w; saveState(s); }

// ── Target allocations ────────────────────────────────────────
function getTargetAlloc() { const s = getState(); return s.targetAlloc || {}; }
function saveTargetAlloc() {
  const inputs = document.querySelectorAll('.alloc-target-input');
  const alloc = {};
  inputs.forEach(inp => { alloc[inp.dataset.type] = parseFloat(inp.value) || 0; });
  const s = getState(); s.targetAlloc = alloc; saveState(s);
  renderOverview(); // refresh drift chart
  alert('Target allocation saved.');
}

function fmt(n, dp=2) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const abs = Math.abs(n);
  const str = abs.toFixed(dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (n < 0 ? '-$' : '$') + str;
}
function fmtK(n) {
  if (Math.abs(n) >= 1000000) return '$' + (n/1000000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return '$' + (n/1000).toFixed(1) + 'k';
  return fmt(n);
}

// ============================================================
//  LIVE PRICES — Yahoo Finance via CORS proxies
// ============================================================
// ============================================================
//  MULTI-CURRENCY SYSTEM
// ============================================================

// All exchange rates stored as X per 1 USD (updated from Yahoo)
const FX_RATES = {
  USD: 1,
  AUD: 1 / 0.7117,
  GBP: 0.79,
  EUR: 0.92,
  HKD: 7.82,
  JPY: 149.5,
  CAD: 1.36,
  SGD: 1.34,
  CNY: 7.24,
  NZD: 1.63,
};

// Currency display symbols
const CURRENCY_SYMBOLS = {
  USD: '$', AUD: 'A$', GBP: '£', EUR: '€',
  HKD: 'HK$', JPY: '¥', CAD: 'C$', SGD: 'S$',
  CNY: '¥', NZD: 'NZ$',
};

// Yahoo Finance FX tickers to fetch (vs USD)
const FX_TICKERS = {
  AUD: 'AUDUSD=X', GBP: 'GBPUSD=X', EUR: 'EURUSD=X',
  HKD: 'HKDUSD=X', JPY: 'JPYUSD=X', CAD: 'CADUSD=X',
  SGD: 'SGDUSD=X', CNY: 'CNHUSD=X', NZD: 'NZDUSD=X',
};

// Exchange suffix → native currency mapping
const EXCHANGE_CURRENCY = {
  '.AX': 'AUD',  // Australia
  '.L':  'GBP',  // London
  '.PA': 'EUR',  // Paris
  '.DE': 'EUR',  // Germany (XETRA)
  '.AS': 'EUR',  // Amsterdam
  '.MI': 'EUR',  // Milan
  '.BR': 'EUR',  // Brussels
  '.HK': 'HKD',  // Hong Kong
  '.T':  'JPY',  // Tokyo
  '.TO': 'CAD',  // Toronto
  '.SI': 'SGD',  // Singapore
  '.SS': 'CNY',  // Shanghai
  '.SZ': 'CNY',  // Shenzhen
  '.NZ': 'NZD',  // New Zealand
};

// Exchange suffix → region label
const EXCHANGE_REGION = {
  '.AX': 'Australia', '.L': 'United Kingdom', '.PA': 'France',
  '.DE': 'Germany', '.AS': 'Netherlands', '.MI': 'Italy',
  '.HK': 'Hong Kong', '.T': 'Japan', '.TO': 'Canada',
  '.SI': 'Singapore', '.SS': 'China', '.SZ': 'China', '.NZ': 'New Zealand',
};

let fxRate = 1 / 0.7117; // AUD per USD — legacy, kept for AUD calcs
let displayCurrency = 'USD';

// Get the native currency for a ticker based on its suffix
function getNativeCurrency(ticker) {
  for (const [suffix, curr] of Object.entries(EXCHANGE_CURRENCY)) {
    if (ticker.toUpperCase().endsWith(suffix.toUpperCase())) return curr;
  }
  return 'USD';
}

// Get region for a ticker
function getRegionFromTicker(ticker) {
  for (const [suffix, region] of Object.entries(EXCHANGE_REGION)) {
    if (ticker.toUpperCase().endsWith(suffix.toUpperCase())) return region;
  }
  return 'United States';
}

// Convert from native currency to USD
function toUSD(amount, nativeCurrency) {
  if (nativeCurrency === 'USD') return amount;
  const ratePerUSD = FX_RATES[nativeCurrency] || 1;
  return amount / ratePerUSD;
}

// Convert from USD to display currency
function fromUSD(usdAmount) {
  return usdAmount * (FX_RATES[displayCurrency] || 1);
}

function setCurrency(code) {
  displayCurrency = code;
  const sym = CURRENCY_SYMBOLS[code] || '$';
  // Update all currency symbol spans
  ['goal-currency-sym','goal-contrib-sym','calc-init-sym','calc-contrib-sym'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = sym;
  });
  renderAll();
  updateGoal();
  calcUpdate();
}

// Format a USD amount in the display currency
function fmtDisplay(usdAmount, dp=2) {
  if (usdAmount === null || usdAmount === undefined || isNaN(usdAmount)) return '—';
  const val = fromUSD(usdAmount);
  const abs = Math.abs(val);
  const sym = CURRENCY_SYMBOLS[displayCurrency] || '$';
  const decimals = displayCurrency === 'JPY' ? 0 : dp;
  const str = abs.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (val < 0 ? '-' : '') + sym + str;
}

function fmtKDisplay(usdAmount) {
  const val = fromUSD(usdAmount);
  const sym = CURRENCY_SYMBOLS[displayCurrency] || '$';
  const abs = Math.abs(val);
  if (abs >= 1000000) return sym + (val/1000000).toFixed(2) + 'M';
  if (abs >= 1000) return sym + (val/1000).toFixed(1) + 'k';
  return fmtDisplay(usdAmount);
}

// Format a native-currency price with its currency label
function fmtNative(amount, nativeCurrency) {
  if (!amount) return '—';
  const sym = CURRENCY_SYMBOLS[nativeCurrency] || '$';
  const decimals = nativeCurrency === 'JPY' ? 0 : 2;
  const str = Math.abs(amount).toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const label = nativeCurrency !== 'USD' ? `<span style="font-size:9px;color:#6b7a8d;font-family:Montserrat,sans-serif;font-weight:700;margin-right:2px;">${nativeCurrency}</span>` : '';
  return label + sym + str;
}

// Update goal/calc currency symbols in the UI
function updateCurrencySymbols() {
  const sym = CURRENCY_SYMBOLS[displayCurrency] || '$';
  document.querySelectorAll('.goal-input-wrap > span, .calc-currency-sym').forEach(el => {
    el.textContent = sym;
  });
}

// Well-known sector/type lookup — covers most common tickers
// Used as fallback when Yahoo doesn't return sector/quoteType
const TICKER_META = {
  // US Tech
  'AAPL':{'sector':'Technology','type':'Stock'},
  'MSFT':{'sector':'Technology','type':'Stock'},
  'GOOGL':{'sector':'Technology','type':'Stock'},
  'GOOG':{'sector':'Technology','type':'Stock'},
  'NVDA':{'sector':'Technology','type':'Stock'},
  'META':{'sector':'Technology','type':'Stock'},
  'AMZN':{'sector':'Consumer Cyclical','type':'Stock'},
  'TSLA':{'sector':'Consumer Cyclical','type':'Stock'},
  'NFLX':{'sector':'Communication','type':'Stock'},
  'AMD':{'sector':'Technology','type':'Stock'},
  'INTC':{'sector':'Technology','type':'Stock'},
  'CRM':{'sector':'Technology','type':'Stock'},
  'ORCL':{'sector':'Technology','type':'Stock'},
  'ADBE':{'sector':'Technology','type':'Stock'},
  // US Finance
  'JPM':{'sector':'Financial Services','type':'Stock'},
  'BAC':{'sector':'Financial Services','type':'Stock'},
  'GS':{'sector':'Financial Services','type':'Stock'},
  'V':{'sector':'Financial Services','type':'Stock'},
  'MA':{'sector':'Financial Services','type':'Stock'},
  'BRK.B':{'sector':'Financial Services','type':'Stock'},
  // US Healthcare
  'JNJ':{'sector':'Healthcare','type':'Stock'},
  'UNH':{'sector':'Healthcare','type':'Stock'},
  'PFE':{'sector':'Healthcare','type':'Stock'},
  'ABBV':{'sector':'Healthcare','type':'Stock'},
  // US Energy
  'XOM':{'sector':'Energy','type':'Stock'},
  'CVX':{'sector':'Energy','type':'Stock'},
  // US Consumer
  'WMT':{'sector':'Consumer Defensive','type':'Stock'},
  'KO':{'sector':'Consumer Defensive','type':'Stock'},
  'PG':{'sector':'Consumer Defensive','type':'Stock'},
  'MCD':{'sector':'Consumer Cyclical','type':'Stock'},
  // US ETFs
  'SPY':{'sector':'ETF / Index','type':'ETF'},
  'QQQ':{'sector':'ETF / Index','type':'ETF'},
  'IVV':{'sector':'ETF / Index','type':'ETF'},
  'VOO':{'sector':'ETF / Index','type':'ETF'},
  'VTI':{'sector':'ETF / Index','type':'ETF'},
  'VGT':{'sector':'ETF / Technology','type':'ETF'},
  'XLK':{'sector':'ETF / Technology','type':'ETF'},
  'GLD':{'sector':'ETF / Commodities','type':'ETF'},
  'SLV':{'sector':'ETF / Commodities','type':'ETF'},
  'TLT':{'sector':'ETF / Bonds','type':'ETF'},
  'BND':{'sector':'ETF / Bonds','type':'ETF'},
  // ASX ETFs
  'IVV.AX':{'sector':'ETF / Index','type':'ETF'},
  'VAS.AX':{'sector':'ETF / Index','type':'ETF'},
  'NDQ.AX':{'sector':'ETF / Index','type':'ETF'},
  'VGS.AX':{'sector':'ETF / Index','type':'ETF'},
  'A200.AX':{'sector':'ETF / Index','type':'ETF'},
  'IOZ.AX':{'sector':'ETF / Index','type':'ETF'},
  'ETHI.AX':{'sector':'ETF / ESG','type':'ETF'},
  // ASX Stocks
  'BHP.AX':{'sector':'Materials','type':'Stock'},
  'CBA.AX':{'sector':'Financial Services','type':'Stock'},
  'CSL.AX':{'sector':'Healthcare','type':'Stock'},
  'NAB.AX':{'sector':'Financial Services','type':'Stock'},
  'ANZ.AX':{'sector':'Financial Services','type':'Stock'},
  'WBC.AX':{'sector':'Financial Services','type':'Stock'},
  'WES.AX':{'sector':'Consumer Cyclical','type':'Stock'},
  'WOW.AX':{'sector':'Consumer Defensive','type':'Stock'},
  'RIO.AX':{'sector':'Materials','type':'Stock'},
  'FMG.AX':{'sector':'Materials','type':'Stock'},
  'MQG.AX':{'sector':'Financial Services','type':'Stock'},
  'TLS.AX':{'sector':'Communication','type':'Stock'},
  'APX.AX':{'sector':'Technology','type':'Stock'},
  // Crypto
  'BTC-USD':{'sector':'Crypto','type':'Crypto'},
  'ETH-USD':{'sector':'Crypto','type':'Crypto'},
  'SOL-USD':{'sector':'Crypto','type':'Crypto'},
};

function inferMeta(ticker, quoteType, sector) {
  const upper = ticker.toUpperCase();
  const known = TICKER_META[upper];
  // Use Yahoo data if present
  const qt = (quoteType || '').toUpperCase();
  let type = qt === 'ETF' ? 'ETF'
    : qt === 'CRYPTOCURRENCY' ? 'Crypto'
    : qt === 'MUTUALFUND' ? 'Fund'
    : qt === 'EQUITY' ? 'Stock'
    : known?.type || null;

  let sec = sector || known?.sector || null;

  // Infer ETF from common patterns if still unknown
  if (!type) {
    if (upper.includes('-USD') || upper.includes('-AUD')) type = 'Crypto';
    else if (upper.endsWith('.AX')) type = 'Stock'; // will be overridden by known lookup
    else type = 'Stock';
  }
  if (type === 'ETF' && !sec) sec = 'ETF / Index';
  if (!sec) sec = 'Unknown';

  return { type, sector: sec };
}

// Fetch all tickers via our own Netlify serverless function — no CORS issues
async function fetchAllPricesFromYahoo(tickers) {
  const symbols = tickers.join(',');
  try {
    const r = await fetch(`/api/prices?symbols=${encodeURIComponent(symbols)}`, {
      signal: AbortSignal.timeout(20000)
    });
    const map = await r.json();
    if (map.error) {
      console.warn('Price function error:', map.error);
      return {};
    }
    // Enrich with inferred metadata
    for (const [symbol, q] of Object.entries(map)) {
      if (symbol.startsWith('_')) continue; // skip debug keys
      const { type: assetType, sector } = inferMeta(symbol, q.quoteType, q.sector);
      q.assetType = assetType;
      q.sector = sector;
      q.region = getRegionFromTicker(symbol);
    }
    return map;
  } catch(e) {
    console.warn('Prices fetch failed:', e.message);
    return {};
  }
}

async function fetchFX() {
  try {
    const pairs = Object.values(FX_TICKERS).join(',');
    const r = await fetch(`/api/prices?symbols=${encodeURIComponent(pairs)}`, {
      signal: AbortSignal.timeout(10000)
    });
    const map = await r.json();
    // Each pair is e.g. AUDUSD=X → price is how many USD per 1 AUD
    // We want FX_RATES[AUD] = AUD per 1 USD = 1 / (USD per AUD)
    for (const [currency, ticker] of Object.entries(FX_TICKERS)) {
      const price = map[ticker]?.price;
      if (price && price > 0) {
        FX_RATES[currency] = 1 / price; // convert: price = USD per foreign → we want foreign per USD
      }
    }
    // Keep legacy fxRate in sync for any remaining references
    fxRate = FX_RATES['AUD'] || (1 / 0.7117);
  } catch(e) {
    console.warn('FX fetch failed, using fallback rates');
  }
}

async function fetchAllPrices() {
  const btn = document.getElementById('refreshBtn');
  const icon = document.getElementById('refreshIcon');
  if (btn) btn.classList.add('loading');
  if (icon) icon.innerHTML = '<span class="spin">↻</span>';
  setStatus('loading', 'Fetching prices...');

  await fetchFX();

  const holdings = getHoldings();
  const tickers = holdings.filter(h => !h.isCustom).map(h => h.ticker);

  if (!tickers.length) {
    if (btn) btn.classList.remove('loading');
    if (icon) icon.textContent = '↻';
    renderAll();
    return;
  }

  setStatus('loading', `Loading ${tickers.length} stock${tickers.length > 1 ? 's' : ''}...`);
  const priceMap = await fetchAllPricesFromYahoo(tickers);

  let success = 0, anyLive = false;
  for (const h of holdings) {
    if (h.isCustom) continue;
    const result = priceMap[h.ticker];
    if (result) {
      h.livePrice = result.price;
      h.currency = result.currency;
      h.prevClose = result.prevClose;
      h.marketState = result.marketState;
      h.dayChange = result.dayChange;
      h.dayChangePct = result.dayChangePct;
      h.sector = result.sector || h.sector || 'Unknown';
      h.assetType = result.assetType || h.assetType || 'Stock';
      h.region = result.region || h.region || 'United States';
      h.name = result.name || h.name || h.ticker;
      success++;
      if (result.marketState === 'REGULAR') anyLive = true;
    }
  }

  saveHoldings(holdings);
  const now = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
  if (success > 0) {
    setStatus(anyLive ? 'live' : 'stale', anyLive ? `Live · ${now}` : `Last close · ${now}`);
  } else {
    setStatus('error', `Failed · tap refresh to retry`);
  }

  updateMarketStatus();
  if (btn) btn.classList.remove('loading');
  if (icon) icon.textContent = '↻';
  renderAll();
}

function setStatus(state, text) {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  dot.className = 'status-dot ' + (state === 'live' ? 'live' : state === 'error' ? 'error' : 'stale');
  txt.textContent = text;
}

function updateMarketStatus() {
  // Determine open/closed by checking current time in each market's timezone
  const now = new Date();

  const markets = [
    {
      id: 'nyse',
      name: 'NYSE',
      tz: 'America/New_York',
      open: { h: 9, m: 30 },
      close: { h: 16, m: 0 },
      pre: { h: 4, m: 0 },
      after: { h: 20, m: 0 },
    },
    {
      id: 'nasdaq',
      name: 'NASDAQ',
      tz: 'America/New_York',
      open: { h: 9, m: 30 },
      close: { h: 16, m: 0 },
      pre: { h: 4, m: 0 },
      after: { h: 20, m: 0 },
    },
    {
      id: 'asx',
      name: 'ASX',
      tz: 'Australia/Sydney',
      open: { h: 10, m: 0 },
      close: { h: 16, m: 0 },
      pre: { h: 7, m: 0 },
      after: null,
    },
  ];

  markets.forEach(mkt => {
    // Use two separate calls to avoid browser formatting differences
    const weekday = now.toLocaleDateString('en-US', { timeZone: mkt.tz, weekday: 'short' }); // 'Mon', 'Tue' etc
    const timeStr = now.toLocaleTimeString('en-US', { timeZone: mkt.tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const timeParts = timeStr.split(':');
    const h = parseInt(timeParts[0]);
    const m = parseInt(timeParts[1] || '0');
    const totalMins = h * 60 + m;
    const openMins = mkt.open.h * 60 + mkt.open.m;
    const closeMins = mkt.close.h * 60 + mkt.close.m;
    const preMins = mkt.pre.h * 60 + mkt.pre.m;
    const afterMins = mkt.after ? mkt.after.h * 60 + mkt.after.m : 1440;
    const isWeekend = weekday === 'Sat' || weekday === 'Sun';

    let state, label, timeLabel;
    const localTime = now.toLocaleTimeString('en-AU', { timeZone: mkt.tz, hour: '2-digit', minute: '2-digit' });

    if (isWeekend) {
      state = 'closed'; label = 'Closed (Weekend)';
    } else if (totalMins >= openMins && totalMins < closeMins) {
      state = 'open'; label = 'Open';
    } else if (totalMins >= preMins && totalMins < openMins) {
      state = 'pre'; label = 'Pre-market';
    } else if (mkt.after && totalMins >= closeMins && totalMins < afterMins) {
      state = 'after'; label = 'After-hours';
    } else {
      state = 'closed'; label = 'Closed';
    }

    // Show local market time in 12-hour format with AM/PM for clarity
    timeLabel = now.toLocaleTimeString('en-US', {
      timeZone: mkt.tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const dot = document.getElementById(mkt.id + '-dot');
    const statusEl = document.getElementById(mkt.id + '-status');
    const timeEl = document.getElementById(mkt.id + '-time');
    if (dot) { dot.className = 'market-pill-dot ' + state; }
    if (statusEl) { statusEl.className = 'market-pill-status ' + state; statusEl.textContent = label; }
    if (timeEl) { timeEl.textContent = timeLabel; }
  });

  // Re-clone the ticker so all copies show updated status/times
  if (typeof window.reinitMarquee === 'function') {
    setTimeout(window.reinitMarquee, 50);
  }
}

// ============================================================
//  CALCULATIONS
// ============================================================
function calcHolding(h) {
  const rawPrice = h.livePrice || (h.isCustom ? h.manualPrice : null) || null;
  const nativeCurrency = getNativeCurrency(h.ticker);
  const isNonUSD = nativeCurrency !== 'USD';

  // Native price (in the stock's own currency)
  const nativePrice = rawPrice;
  const nativeBuyPrice = h.buyPrice;

  // Convert to USD for portfolio calculations
  const liveUSD = rawPrice ? toUSD(rawPrice, nativeCurrency) : null;
  const buyUSD = toUSD(h.buyPrice, nativeCurrency);

  const costBasis = buyUSD * h.units;
  const marketValue = liveUSD ? liveUSD * h.units : costBasis;
  const gainLoss = marketValue - costBasis;
  const gainPct = costBasis ? (gainLoss / costBasis) * 100 : 0;
  const priceSource = h.livePrice ? 'api' : (h.isCustom && h.manualPrice) ? 'manual' : 'none';

  return { costBasis, marketValue, gainLoss, gainPct, liveUSD, rawPrice, priceSource, isAUD: nativeCurrency === 'AUD', nativePrice, nativeBuyPrice, nativeCurrency, isNonUSD };
}

function portfolioTotals() {
  const holdings = getHoldings();
  let totalCost = 0, totalValue = 0, totalDayChange = 0, hasDayChange = false;
  holdings.forEach(h => {
    const c = calcHolding(h);
    totalCost += c.costBasis;
    totalValue += c.marketValue;
    // dayChange is in native currency — convert to USD then to display
    if (h.dayChange != null && h.livePrice) {
      const nativeCurrency = getNativeCurrency(h.ticker);
      const dayChangeUSD = toUSD(h.dayChange, nativeCurrency) * h.units;
      totalDayChange += dayChangeUSD;
      hasDayChange = true;
    }
  });
  const dayChangePct = totalValue ? (totalDayChange / (totalValue - totalDayChange)) * 100 : 0;
  return {
    totalCost, totalValue,
    totalGain: totalValue - totalCost,
    gainPct: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
    totalDayChange, dayChangePct, hasDayChange
  };
}

// ============================================================
//  RENDER FUNCTIONS
// ============================================================
let allocChartObj = null, regionChartObj = null, sectorChartObj = null, typeChartObj = null, perfChartObj = null, realPerfChartObj = null, monthlyChartObj = null, calcChartObj = null, goalChartObj = null;

// Build a grouped donut chart from holdings grouped by a key
function buildGroupedDonut(canvasId, legendId, holdings, keyFn, chartObjRef) {
  const total = holdings.reduce((a, h) => a + calcHolding(h).marketValue, 0);
  const groups = {};
  for (const h of holdings) {
    const key = keyFn(h) || 'Other';
    const val = calcHolding(h).marketValue;
    groups[key] = (groups[key] || 0) + val;
  }
  const sorted = Object.entries(groups).sort((a,b) => b[1] - a[1]);
  const labels = sorted.map(g => g[0]);
  const values = sorted.map(g => g[1]);
  const colors = COLORS.slice(0, labels.length);

  const legendEl = document.getElementById(legendId);
  legendEl.innerHTML = sorted.map(([label, val], i) => {
    const pct = total ? ((val/total)*100).toFixed(1) : '0';
    return `<div class="alloc-item">
      <div class="alloc-dot" style="background:${colors[i]}"></div>
      <span class="alloc-name">${label}</span>
      <span class="alloc-pct">${pct}%</span>
    </div>`;
  }).join('') || '<div class="empty-state">No data</div>';

  if (chartObjRef.obj) { chartObjRef.obj.destroy(); chartObjRef.obj = null; }
  if (!values.length) return;
  chartObjRef.obj = new Chart(document.getElementById(canvasId), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmt(ctx.parsed) + ' (' + (total ? (ctx.parsed/total*100).toFixed(1) : 0) + '%)' } } }
    }
  });
}

function renderAll() {
  renderOverview();
  renderHoldings();
  renderRealisedTrades();
  renderDividends();
  renderWatchlist();
  updateGoal();
}

let ovActiveFilters = new Set();

function toggleOvFilter() {
  const panel = document.getElementById('ov-filter-panel');
  const btn = document.getElementById('ov-filter-toggle');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  btn.classList.toggle('panel-open', !isOpen);
}

function toggleOvFilterBtn(btn) {
  const filter = btn.dataset.filter;
  const sortFilters = ['alpha','value','weight','gain','gainpct'];
  const narrowFilters = ['winners','losers'];

  // If clicking a sort, deselect other sorts (only one sort at a time)
  if (sortFilters.includes(filter)) {
    if (ovActiveFilters.has(filter)) {
      ovActiveFilters.delete(filter);
    } else {
      sortFilters.forEach(f => ovActiveFilters.delete(f));
      ovActiveFilters.add(filter);
    }
  }
  // If clicking a narrow filter, deselect the opposite
  if (narrowFilters.includes(filter)) {
    if (ovActiveFilters.has(filter)) {
      ovActiveFilters.delete(filter);
    } else {
      const opposite = filter === 'winners' ? 'losers' : 'winners';
      ovActiveFilters.delete(opposite);
      ovActiveFilters.add(filter);
    }
  }

  // Sync button states
  document.querySelectorAll('.ov-filter-btn').forEach(b => {
    b.classList.toggle('active', ovActiveFilters.has(b.dataset.filter));
  });

  updateOvFilterBadge();
  renderOverview();
}

function resetOvFilters() {
  ovActiveFilters.clear();
  document.querySelectorAll('.ov-filter-btn').forEach(b => b.classList.remove('active'));
  updateOvFilterBadge();
  renderOverview();
}

function updateOvFilterBadge() {
  const badge = document.getElementById('ov-filter-badge');
  const count = ovActiveFilters.size;
  if (count > 0) {
    badge.style.display = 'inline-block';
    badge.textContent = count + ' active';
  } else {
    badge.style.display = 'none';
  }
}

function renderOverview() {
  const holdings = getHoldings();
  const totals = portfolioTotals();

  document.getElementById('ov-total').textContent = fmtDisplay(totals.totalValue);
  document.getElementById('ov-cost').textContent = fmtDisplay(totals.totalCost);
  document.getElementById('ov-gain').textContent = fmtDisplay(totals.totalGain);

  // Daily change badge
  const dayBadge = document.getElementById('ov-day-badge');
  if (totals.hasDayChange) {
    const up = totals.totalDayChange >= 0;
    dayBadge.className = 'hero-badge ' + (up ? 'up' : 'down');
    dayBadge.textContent = (up ? '▲ +' : '▼ ') + fmtDisplay(Math.abs(totals.totalDayChange))
      + '  (' + (up ? '+' : '') + totals.dayChangePct.toFixed(2) + '%)';
  } else {
    dayBadge.className = 'hero-badge neutral';
    dayBadge.textContent = '— refresh to load today\'s change';
  }

  const gainBadge = document.getElementById('ov-gain-badge');
  const pctBadge = document.getElementById('ov-gainpct-badge');
  const up = totals.totalGain >= 0;
  gainBadge.className = 'hero-badge ' + (up ? 'up' : 'down');
  gainBadge.textContent = (up ? '↑' : '↓') + ' ' + fmtDisplay(Math.abs(totals.totalGain)) + ' total gain';
  pctBadge.className = 'hero-badge ' + (up ? 'up' : 'down');
  pctBadge.textContent = totals.gainPct.toFixed(2) + '% return · ' + displayCurrency;

  // Allocation donut
  const labels = holdings.map(h => h.ticker);
  const values = holdings.map(h => calcHolding(h).marketValue);
  const total = values.reduce((a,b) => a+b, 0);

  const legendEl = document.getElementById('allocLegend');
  if (!holdings.length) {
    legendEl.innerHTML = '<div class="empty-state">No holdings yet</div>';
  } else {
    legendEl.innerHTML = holdings.map((h,i) => {
      const val = values[i];
      const pct = total ? ((val/total)*100).toFixed(1) : '0';
      return `<div class="alloc-item">
        <div class="alloc-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <span class="alloc-name">${h.ticker}</span>
        <span class="alloc-pct">${pct}%</span>
      </div>`;
    }).join('');
  }

  if (allocChartObj) { allocChartObj.destroy(); allocChartObj = null; }
  if (holdings.length) {
    allocChartObj = new Chart(document.getElementById('allocChart'), {
      type: 'doughnut',
      data: {
        labels, datasets: [{
          data: values,
          backgroundColor: COLORS.slice(0, holdings.length),
          borderWidth: 2, borderColor: '#fff'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => ' ' + ctx.label + ': ' + fmtDisplay(ctx.parsed) }
        }}
      }
    });
  }

  // Summary table
  const tbody = document.getElementById('ov-holdings-body');
  if (!holdings.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No holdings yet</td></tr>';
    return;
  }

  // Build enriched list for filtering/sorting
  let rows = holdings.map((h, i) => {
    const c = calcHolding(h);
    const weight = total ? (c.marketValue / total) * 100 : 0;
    return { h, c, i, weight };
  });

  // Step 1: Narrow (filter) — winners/losers
  if (ovActiveFilters.has('winners')) rows = rows.filter(r => r.c.gainLoss >= 0);
  if (ovActiveFilters.has('losers'))  rows = rows.filter(r => r.c.gainLoss < 0);

  // Step 2: Sort
  if (ovActiveFilters.has('alpha'))   rows.sort((a, b) => a.h.ticker.localeCompare(b.h.ticker));
  if (ovActiveFilters.has('value'))   rows.sort((a, b) => b.c.marketValue - a.c.marketValue);
  if (ovActiveFilters.has('weight'))  rows.sort((a, b) => b.weight - a.weight);
  if (ovActiveFilters.has('gain'))    rows.sort((a, b) => b.c.gainLoss - a.c.gainLoss);
  if (ovActiveFilters.has('gainpct')) rows.sort((a, b) => b.c.gainPct - a.c.gainPct);

  tbody.innerHTML = rows.map(({ h, c, i, weight }) => {
    const upDown = c.gainLoss >= 0;
    const priceDisplay = c.nativePrice
      ? (c.isAUD ? `A$${c.nativePrice.toFixed(2)}` : fmtDisplay(c.nativePrice))
      : '<span style="color:#6b7a8d;font-size:11px;">↻ refresh</span>';
    return `<tr>
      <td><div class="ticker-cell">
        <div class="ticker-badge" style="background:${COLORS[i%COLORS.length]}">${h.ticker}</div>
      </div></td>
      <td class="mono">${priceDisplay}</td>
      <td class="mono">${fmtDisplay(c.marketValue)}</td>
      <td class="mono ${upDown ? 'up-val' : 'down-val'}">${c.priceSource==='none' ? '—' : (upDown?'+':'') + fmtDisplay(c.gainLoss)}</td>
      <td class="mono ${upDown ? 'up-val' : 'down-val'}">${c.priceSource==='none' ? '—' : (upDown?'+':'') + c.gainPct.toFixed(2) + '%'}</td>
      <td class="mono">${weight.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  // Region, sector, type charts
  const rRef = { obj: regionChartObj };
  const sRef = { obj: sectorChartObj };
  const tRef = { obj: typeChartObj };
  buildGroupedDonut('regionChart', 'regionLegend', holdings, h => h.region || getRegionFromTicker(h.ticker), rRef);
  buildGroupedDonut('sectorChart', 'sectorLegend', holdings, h => h.sector || (h.assetType === 'ETF' ? 'ETF / Index' : 'Unknown'), sRef);
  buildGroupedDonut('typeChart',   'typeLegend',   holdings, h => h.assetType || 'Stock', tRef);
  regionChartObj = rRef.obj;
  sectorChartObj = sRef.obj;
  typeChartObj = tRef.obj;

  // Target allocation drift
  renderTargetAllocDrift();

  // Realised returns card
  const trades   = getRealisedTrades();
  const divs     = getDividends();
  const salesPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const totalDiv = divs.reduce((a, d) => a + d.amount, 0);
  const grand    = salesPnl + totalDiv;
  const card     = document.getElementById('ov-realised-card');
  if (card) {
    const hasAny = trades.length > 0 || divs.length > 0;
    card.style.display = hasAny ? 'block' : 'none';
    if (hasAny) {
      const grandUp = grand >= 0;
      const salesUp = salesPnl >= 0;
      document.getElementById('ov-realised-total').textContent = (grandUp?'+':'') + fmtDisplay(grand);
      document.getElementById('ov-realised-total').style.color = grandUp ? 'var(--green)' : 'var(--red)';
      document.getElementById('ov-realised-sales').textContent = (salesUp?'+':'') + fmtDisplay(salesPnl);
      document.getElementById('ov-realised-sales').style.color = salesUp ? 'var(--green)' : 'var(--red)';
      document.getElementById('ov-realised-sales-count').textContent = trades.length + ' sale' + (trades.length !== 1 ? 's' : '');
      document.getElementById('ov-realised-divs').textContent = '+' + fmtDisplay(totalDiv);
      document.getElementById('ov-realised-divs-count').textContent = divs.length + ' payment' + (divs.length !== 1 ? 's' : '');
    }
  }
}

function renderHoldings() {
  const holdings = getHoldings();
  const tbody = document.getElementById('holdings-body');
  if (!holdings.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="empty-state">No holdings — add one below</td></tr>';
    return;
  }
  tbody.innerHTML = holdings.map((h, i) => {
    const c = calcHolding(h);
    const upDown = c.gainLoss >= 0;
    const isLive = h.marketState === 'REGULAR';
    const isPre = h.marketState === 'PRE';
    const isAfter = h.marketState === 'POST' || h.marketState === 'POSTPOST';
    const dayUp = (h.dayChange || 0) >= 0;

    // Price label pill
    let priceLabel = '';
    if (h.livePrice) {
      if (isLive)       priceLabel = pill('LIVE',  '#22c55e',  'rgba(34,197,94,0.15)');
      else if (isPre)   priceLabel = pill('PRE',   '#f59e0b',  'rgba(245,158,11,0.15)');
      else if (isAfter) priceLabel = pill('AH',    '#8b5cf6',  'rgba(139,92,246,0.15)');
      else              priceLabel = pill('CLOSE', '#6b7a8d',  'rgba(107,122,141,0.15)');
    }

    // Day change line — in native currency
    const nativeSym = CURRENCY_SYMBOLS[c.nativeCurrency] || '$';
    const dayDecimals = c.nativeCurrency === 'JPY' ? 0 : 2;
    const dayChangeLine = h.livePrice && h.dayChange !== undefined
      ? `<div style="font-size:10px;${dayUp?'color:#22c55e':'color:#ef4444'};font-family:Montserrat,sans-serif;font-weight:600;">${dayUp?'+':''}${nativeSym}${Math.abs(h.dayChange).toFixed(dayDecimals)} (${dayUp?'+':''}${(h.dayChangePct||0).toFixed(2)}%)</div>`
      : '';

    // Price cell — show in native currency with currency label for non-USD
    const nativePriceFmt = c.nativePrice ? fmtNative(c.nativePrice, c.nativeCurrency) : '—';

    let priceCell;
    if (h.livePrice) {
      priceCell = `<span class="mono">${nativePriceFmt}</span>${priceLabel}${dayChangeLine}`;
    } else if (h.isCustom && h.manualPrice) {
      priceCell = `<span class="mono">${fmt(h.manualPrice)}</span>${pill('MANUAL','#f59e0b','rgba(245,158,11,0.15)')}`;
    } else if (h.isCustom) {
      priceCell = `<span style="color:#6b7a8d;font-size:11px;font-style:italic;">Enter price below</span>`;
    } else {
      priceCell = `<span style="color:#6b7a8d;font-size:11px;">↻ tap refresh</span>`;
    }

    // Avg buy price — in native currency
    const avgBuyFmt = fmtNative(h.buyPrice, c.nativeCurrency);

    // Manual price input — only for custom (non-exchange) assets
    const manualInput = h.isCustom
      ? `<input type="number" placeholder="Price" value="${h.manualPrice||''}" min="0" step="any"
           style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-family:Montserrat,sans-serif;font-weight:600;font-size:12px;width:90px;outline:none;color:var(--dark);background:white;"
           onchange="setManualPrice(${i},this.value)"
           onfocus="this.style.borderColor='var(--navy)'" onblur="this.style.borderColor='var(--border)'">`
      : '<span style="color:#d1d5db;font-size:11px;">—</span>';

    return `<tr>
      <td><div class="ticker-cell">
        <div class="ticker-badge" style="background:${COLORS[i%COLORS.length]}">${h.ticker}</div>
        ${h.isCustom ? '<span style="font-size:9px;color:#6b7a8d;margin-left:4px;">custom</span>' : ''}
      </div></td>
      <td class="mono hide-mobile">${h.units}</td>
      <td class="mono hide-mobile">${avgBuyFmt}</td>
      <td class="mono hide-mobile">${fmtDisplay(c.costBasis)}</td>
      <td>${priceCell}</td>
      <td class="mono hide-mobile">${fmtDisplay(c.marketValue)}</td>
      <td class="mono ${upDown ? 'up-val' : 'down-val'}">${upDown?'+':''}${fmtDisplay(c.gainLoss)}</td>
      <td class="mono ${upDown ? 'up-val' : 'down-val'}">${c.priceSource === 'none' ? '—' : (upDown?'+':'') + c.gainPct.toFixed(2) + '%'}</td>
      <td><div class="holding-actions">
        <button class="act-btn add"  onclick="openAddUnits(${i})"  title="Buy more units">+Buy</button>
        <button class="act-btn sell" onclick="openSell(${i})"      title="Record a sale">Sell</button>
        <button class="act-btn div"  onclick="openDividend(${i})"  title="Log dividend">Div</button>
        <button class="act-btn del"  onclick="deleteHolding(${i})" title="Remove holding">×</button>
      </div></td>
    </tr>`;
  }).join('');
}

function pill(text, color, bg) {
  return `<span style="background:${bg};color:${color};font-size:8px;padding:1px 5px;border-radius:10px;font-family:Montserrat,sans-serif;font-weight:700;margin-left:4px;vertical-align:middle;">${text}</span>`;
}

// Cache historical data so we don't re-fetch on every tab switch
let historyCache = null;

async function fetchHistory() {
  const holdings = getHoldings().filter(h => !h.isCustom);
  if (!holdings.length) return null;
  const tickers = holdings.map(h => h.ticker).join(',');
  try {
    const r = await fetch(`/api/history?symbols=${encodeURIComponent(tickers)}`, {
      signal: AbortSignal.timeout(20000)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch(e) {
    console.warn('History fetch failed:', e.message);
    return null;
  }
}

async function renderPerformance() {
  document.getElementById('perf-loading').style.display = 'block';
  document.getElementById('perf-content').style.display = 'none';

  const holdings = getHoldings().filter(h => !h.isCustom);
  if (!holdings.length) {
    document.getElementById('perf-loading').textContent = 'Add holdings to see performance.';
    return;
  }

  if (!historyCache) {
    document.getElementById('perf-loading').textContent = 'Fetching 1 year of historical data...';
    historyCache = await fetchHistory();
  }
  if (!historyCache) {
    document.getElementById('perf-loading').textContent = 'Could not load historical data — tap refresh to retry.';
    return;
  }

  const sp500Data  = historyCache['^GSPC'] || [];
  const nasdaqData = historyCache['^NDX']  || [];
  if (!sp500Data.length) {
    document.getElementById('perf-loading').textContent = 'No historical data available.';
    return;
  }

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const allDates = sp500Data.map(d => d.date);

  // Build price map per holding
  const holdingPrices = {};
  for (const h of holdings) {
    holdingPrices[h.ticker] = {};
    for (const pt of (historyCache[h.ticker] || [])) {
      holdingPrices[h.ticker][pt.date] = pt.close;
    }
  }

  // Portfolio value at each historical month point
  const portfolioValues = allDates.map(date => {
    let val = 0;
    for (const h of holdings) {
      const price = holdingPrices[h.ticker]?.[date];
      if (!price) continue;
      val += toUSD(price, getNativeCurrency(h.ticker)) * h.units;
    }
    return val;
  });

  // Valid indices where we have portfolio data
  const validIdx = portfolioValues.map((v, i) => v > 0 ? i : -1).filter(i => i >= 0);
  if (!validIdx.length) {
    document.getElementById('perf-loading').textContent = 'Not enough historical data for your holdings.';
    return;
  }

  // Index all series to 100 at first valid point
  const fi  = validIdx[0];
  const fV  = portfolioValues[fi];
  const fSP = sp500Data[fi]?.close  || 1;
  const fNQ = nasdaqData[fi]?.close || 1;

  const perfData = validIdx.map(i => {
    const [yr, mo] = allDates[i].split('-');
    return {
      label:     MONTH_NAMES[parseInt(mo) - 1] + ' ' + yr.slice(2),
      portfolio: parseFloat(((portfolioValues[i] / fV)              * 100).toFixed(2)),
      sp500:     sp500Data[i]  ? parseFloat(((sp500Data[i].close  / fSP) * 100).toFixed(2)) : null,
      nasdaq:    nasdaqData[i] ? parseFloat(((nasdaqData[i].close / fNQ) * 100).toFixed(2)) : null,
    };
  });

  document.getElementById('perf-loading').style.display = 'none';
  document.getElementById('perf-content').style.display = 'block';

  const labels = perfData.map(d => d.label);

  // ── Chart 1: Historic Return (indexed) ───────────────────────
  if (perfChartObj) { perfChartObj.destroy(); }
  perfChartObj = new Chart(document.getElementById('perfChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Your Portfolio', data: perfData.map(d => d.portfolio), borderColor: '#ff6b5b', backgroundColor: 'rgba(255,107,91,0.08)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true },
        { label: 'S&P 500',        data: perfData.map(d => d.sp500),     borderColor: '#bdc2d2', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: 'NASDAQ 100',     data: perfData.map(d => d.nasdaq),    borderColor: '#0097a7', borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + ctx.parsed.y?.toFixed(1) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7a8d', font: { size: 10 }, maxTicksLimit: 10, maxRotation: 0 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7a8d', font: { size: 10 }, callback: v => v.toFixed(0) } }
      }
    }
  });

  // Summary cards
  const last = perfData[perfData.length - 1];
  const portRet = (last.portfolio || 100) - 100;
  const spRet   = (last.sp500    || 100) - 100;
  const nqRet   = (last.nasdaq   || 100) - 100;
  document.getElementById('perf-summary').innerHTML = [
    { label: 'Your Portfolio', val: (portRet >= 0 ? '+' : '') + portRet.toFixed(2) + '%', up: portRet >= 0 },
    { label: 'S&P 500',        val: (spRet   >= 0 ? '+' : '') + spRet.toFixed(2)   + '%', up: spRet   >= 0 },
    { label: 'NASDAQ 100',     val: (nqRet   >= 0 ? '+' : '') + nqRet.toFixed(2)   + '%', up: nqRet   >= 0 },
  ].map(c => `
    <div class="calc-result-card">
      <div class="calc-result-label">${c.label}</div>
      <div class="calc-result-val" style="color:${c.up ? 'var(--green)' : 'var(--red)'}">${c.val}</div>
      <div style="font-size:10px;color:var(--mid);margin-top:2px;">1 year</div>
    </div>`).join('');

  // ── Chart 2: Monthly returns ──────────────────────────────────
  const returns = perfData.slice(1).map((d, i) => {
    const prev = perfData[i].portfolio;
    return prev ? parseFloat(((d.portfolio - prev) / prev * 100).toFixed(2)) : 0;
  });

  if (monthlyChartObj) { monthlyChartObj.destroy(); }
  monthlyChartObj = new Chart(document.getElementById('monthlyChart'), {
    type: 'bar',
    data: {
      labels: perfData.slice(1).map(d => d.label),
      datasets: [{ data: returns, backgroundColor: returns.map(r => r >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'), borderRadius: 4 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y.toFixed(2) + '%' } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7a8d', font: { size: 10 }, autoSkip: true, maxTicksLimit: 12, maxRotation: 0 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7a8d', font: { size: 10 }, callback: v => v.toFixed(1) + '%' } }
      }
    }
  });

  // ── Heatmap calendar removed ─────────────────────────────────
}


// ============================================================
//  COMPOUND INTEREST CALCULATOR
// ============================================================
function calcUpdate() {
  const init = Math.max(0, +document.getElementById('c-init').value || 0);
  const contrib = Math.max(0, +document.getElementById('c-contrib').value || 0);
  const rate = +document.getElementById('c-rate').value;
  const years = +document.getElementById('c-years').value;

  document.getElementById('c-rate-out').textContent = rate.toFixed(1) + '%';
  document.getElementById('c-years-out').textContent = years + ' yrs';

  const r = rate / 100 / 12;
  const n = years * 12;
  let balance = init;
  const yearlyBalances = [init];
  const yearlyContribs = [init];

  for (let m = 1; m <= n; m++) {
    balance = r === 0 ? balance + contrib : balance * (1 + r) + contrib;
    if (m % 12 === 0) {
      yearlyBalances.push(Math.round(balance));
      yearlyContribs.push(Math.round(init + contrib * m));
    }
  }

  const totalContrib = init + contrib * n;
  const interest = balance - totalContrib;

  const sym = CURRENCY_SYMBOLS[displayCurrency] || '$';
  const fmtCurr = (n) => {
    const abs = Math.abs(n);
    if (abs >= 1000000) return sym + (n/1000000).toFixed(2) + 'M';
    if (abs >= 1000) return sym + (n/1000).toFixed(1) + 'k';
    return sym + Math.round(abs).toLocaleString();
  };

  document.getElementById('c-final').textContent = fmtCurr(balance);
  document.getElementById('c-contributed').textContent = fmtCurr(totalContrib);
  document.getElementById('c-interest').textContent = fmtCurr(interest);

  const skip = years > 30 ? 5 : years > 15 ? 2 : 1;
  const chartLabels = yearlyBalances.map((_, i) => i === 0 ? 'Now' : `Yr ${i}`).filter((_, i) => i % skip === 0 || i === yearlyBalances.length - 1);
  const chartBal = yearlyBalances.filter((_, i) => i % skip === 0 || i === yearlyBalances.length - 1);
  const chartContr = yearlyContribs.filter((_, i) => i % skip === 0 || i === yearlyBalances.length - 1);

  if (calcChartObj) { calcChartObj.destroy(); }
  calcChartObj = new Chart(document.getElementById('calcChart'), {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        { label: 'Total Value', data: chartBal, backgroundColor: '#004562', borderRadius: 3 },
        { label: 'Contributions', data: chartContr, backgroundColor: '#0097a7', borderRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtCurr(ctx.parsed.y) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7a8d', font: { size: 10 }, autoSkip: true, maxTicksLimit: Math.min(12, Math.max(6, Math.ceil(years / 5))), maxRotation: 0 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7a8d', font: { size: 10 }, callback: v => fmtCurr(v) } }
      }
    }
  });
}

// ============================================================
//  GOAL TRACKER
// ============================================================
function updateGoal() {
  // Goal inputs are in display currency — convert to USD for portfolio comparison
  const targetDisplay = +document.getElementById('goal-target').value || 0;
  const contribDisplay = +document.getElementById('goal-contrib').value || 500;
  const fxMult = FX_RATES[displayCurrency] || 1;
  const targetUSD = targetDisplay / fxMult;
  const contribUSD = contribDisplay / fxMult;

  const totals = portfolioTotals();
  const currentUSD = totals.totalValue;
  const yearlyReturn = (+document.getElementById('goal-rate').value || 7) / 100;
  const monthlyRate = Math.pow(1 + yearlyReturn, 1/12) - 1;

  saveGoalSettings({ target: document.getElementById('goal-target').value, contrib: document.getElementById('goal-contrib').value });

  // Update currency symbols
  const sym = CURRENCY_SYMBOLS[displayCurrency] || '$';
  ['goal-currency-sym','goal-contrib-sym'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = sym;
  });

  document.getElementById('goal-current').textContent = fmtDisplay(currentUSD);
  document.getElementById('goal-target-label').textContent = fmtDisplay(targetUSD);

  const pct = targetUSD ? Math.min((currentUSD / targetUSD) * 100, 100) : 0;
  document.getElementById('goal-pct-label').textContent = pct.toFixed(1) + '%';
  document.getElementById('goal-bar').style.width = pct + '%';

  if (!targetDisplay) {
    document.getElementById('goal-eta').textContent = 'Enter a target to see your projection';
    document.getElementById('goal-yearly-body').innerHTML = '<tr><td colspan="5" class="empty-state">Enter a target above</td></tr>';
    document.getElementById('goal-table-body').innerHTML = '';
    return;
  }

  // Project in USD, display in selected currency
  let bal = currentUSD;
  let months = 0;
  const projData = [{ month: 0, value: currentUSD, contributions: 0, growth: 0 }];

  while (bal < targetUSD && months < 1200) {
    months++;
    bal = bal * (1 + monthlyRate) + contribUSD;
    projData.push({ month: months, value: bal, contributions: contribUSD * months, growth: bal - currentUSD - contribUSD * months });
  }

  if (months < 1200) {
    const yrs = Math.floor(months / 12);
    const mths = months % 12;
    document.getElementById('goal-eta').textContent = `At ${fmtDisplay(contribUSD)}/month you'll reach your goal in ${yrs > 0 ? yrs + ' yr' + (yrs>1?'s':'') + ' ' : ''}${mths > 0 ? mths + ' month' + (mths>1?'s':'') : ''}`;
  } else {
    document.getElementById('goal-eta').textContent = 'Increase contributions to reach this goal within 100 years';
  }

  // Build chart data — yearly points for goals > 3 years, monthly for short goals
  const totalYears = months / 12;
  let show;
  let labelFn;

  if (totalYears > 3) {
    // Sample end-of-year values (month 12, 24, 36…) plus Now and the final point
    const yearlyPoints = projData.filter((d, i) => d.month === 0 || d.month % 12 === 0 || i === projData.length - 1);
    // Cap at ~20 points for readability; if many years, sample every N years
    const step = Math.ceil(yearlyPoints.length / 20);
    show = yearlyPoints.filter((_, i) => i % step === 0 || i === yearlyPoints.length - 1);
    labelFn = d => d.month === 0 ? 'Now' : `Yr ${Math.round(d.month / 12)}`;
  } else {
    // Short goal — use monthly points, sample every 3
    show = projData.filter((_, i) => i % 3 === 0 || i === projData.length - 1).slice(0, 61);
    labelFn = d => d.month === 0 ? 'Now' : `M${d.month}`;
  }

  if (goalChartObj) { goalChartObj.destroy(); }
  goalChartObj = new Chart(document.getElementById('goalChart'), {
    type: 'line',
    data: {
      labels: show.map(labelFn),
      datasets: [
        { label: 'Portfolio Value', data: show.map(d => fromUSD(d.value)), borderColor: '#ff6b5b', backgroundColor: 'rgba(255,107,91,0.08)', borderWidth: 2, pointRadius: 0, tension: 0.4, fill: true },
        { label: 'Target', data: show.map(() => fromUSD(targetUSD)), borderColor: '#22c55e', borderDash: [6,4], borderWidth: 1.5, pointRadius: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ' ' + ctx.dataset.label + ': ' + fmtKDisplay(ctx.parsed.y / (FX_RATES[displayCurrency]||1)) } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#6b7a8d', font: { size: 9 }, autoSkip: true, maxTicksLimit: 8, maxRotation: 0 } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#6b7a8d', font: { size: 10 }, callback: v => fmtKDisplay(v / (FX_RATES[displayCurrency]||1)) } }
      }
    }
  });

  // Yearly summary table
  const yearlyBody = document.getElementById('goal-yearly-body');
  const yearlyData = [];
  for (let y = 1; y * 12 < projData.length; y++) {
    const endPoint = projData[y * 12];
    const startPoint = projData[(y-1) * 12];
    const annualReturn = startPoint.value ? ((endPoint.value - startPoint.value) / startPoint.value * 100) : 0;
    yearlyData.push({ year: y, value: endPoint.value, contributions: endPoint.contributions, growth: endPoint.growth, annualReturn });
  }

  // Calculate goal achieved date
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const goalCard = document.getElementById('goal-achieve-card');

  if (months < 1200 && targetUSD > 0) {
    const achieveDate = new Date(now.getFullYear(), now.getMonth() + months, 1);
    const achieveMonth = MONTH_NAMES[achieveDate.getMonth()];
    const achieveYear = achieveDate.getFullYear();
    const finalPoint = projData[projData.length - 1] || {};
    const finalValue = finalPoint.value || 0;
    const finalContrib = finalPoint.contributions || 0;
    const finalGrowth = finalPoint.growth || 0;
    const totalReturn = currentUSD ? ((finalValue - currentUSD) / currentUSD * 100) : 0;

    if (goalCard) {
      goalCard.style.display = 'block';
      goalCard.innerHTML = `
        <div class="goal-achieve-card-inner">
          <div class="goal-achieve-label">🎯 ${achieveMonth} ${achieveYear}</div>
          <div class="goal-achieve-stats">
            <div class="goal-achieve-stat">
              <span class="goal-achieve-stat-label">End Value</span>
              <span class="goal-achieve-stat-val" style="color:#004562;font-weight:700;">${fmtDisplay(finalValue)}</span>
            </div>
            <div class="goal-achieve-stat">
              <span class="goal-achieve-stat-label">Contributed</span>
              <span class="goal-achieve-stat-val" style="color:#004562;">${fmtDisplay(finalContrib)}</span>
            </div>
            <div class="goal-achieve-stat">
              <span class="goal-achieve-stat-label">Growth</span>
              <span class="goal-achieve-stat-val" style="color:var(--green);">+${fmtDisplay(finalGrowth)}</span>
            </div>
            <div class="goal-achieve-stat">
              <span class="goal-achieve-stat-label">Total Return</span>
              <span class="goal-achieve-stat-val" style="color:var(--green);font-weight:700;">+${totalReturn.toFixed(1)}%</span>
            </div>
          </div>
        </div>`;
    }
  } else {
    if (goalCard) {
      if (months >= 1200 && targetUSD > 0) {
        goalCard.style.display = 'block';
        goalCard.innerHTML = `<div style="background:#fff8f8;border:2px solid var(--red);border-radius:10px;padding:12px 16px;text-align:center;font-size:12px;color:var(--red);font-family:'Montserrat',sans-serif;font-weight:600;">Goal not reachable within 100 years — increase contributions</div>`;
      } else {
        goalCard.style.display = 'none';
      }
    }
  }

  yearlyBody.innerHTML = yearlyData.length ? yearlyData.map(d => {
    const up = d.annualReturn >= 0;
    return `<tr>
      <td style="text-align:left;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;">Year ${d.year}</td>
      <td class="mono">${fmtDisplay(d.value)}</td>
      <td class="mono">${fmtDisplay(d.contributions)}</td>
      <td class="mono up-val">+${fmtDisplay(d.growth)}</td>
      <td class="mono ${up ? 'up-val' : 'down-val'}">${up ? '+' : ''}${d.annualReturn.toFixed(1)}%</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty-state">Enter a target above</td></tr>';

  // Monthly table
  const tbody = document.getElementById('goal-table-body');
  tbody.innerHTML = projData.slice(0, 120).map(d => `
    <tr>
      <td style="text-align:left">${d.month === 0 ? 'Now' : 'Month ' + d.month}</td>
      <td class="mono">${fmtDisplay(d.value)}</td>
      <td class="mono">${fmtDisplay(d.contributions)}</td>
      <td class="mono up-val">+${fmtDisplay(d.growth)}</td>
    </tr>
  `).join('');
}

// ============================================================
//  HOLDINGS CRUD
// ============================================================
function setManualPrice(i, val) {
  const holdings = getHoldings();
  holdings[i].manualPrice = val ? parseFloat(val) : null;
  saveHoldings(holdings);
  renderAll();
}

function addHolding() {
  const ticker = document.getElementById('inp-ticker').value.trim().toUpperCase();
  const units = parseFloat(document.getElementById('inp-units').value);
  const price = parseFloat(document.getElementById('inp-price').value);
  const isCustom = document.getElementById('inp-custom').value === '1';
  if (!ticker || !units || !price) { alert('Please fill in ticker, units, and buy price'); return; }

  const holdings = getHoldings();
  holdings.push({
    ticker, units, buyPrice: price,
    livePrice: null, currency: getNativeCurrency(ticker),
    isCustom,
    dateAdded: new Date().toISOString().slice(0, 10),
  });
  saveHoldings(holdings);
  document.getElementById('inp-ticker').value = '';
  document.getElementById('inp-units').value = '';
  document.getElementById('inp-price').value = '';
  document.getElementById('inp-custom').value = '0';
  renderAll();
  if (!isCustom) fetchAllPrices();
}

function deleteHolding(i) {
  const holdings = getHoldings();
  holdings.splice(i, 1);
  saveHoldings(holdings);
  renderAll();
}

// ── Active drawer state ───────────────────────────────────────
let _drawerHoldingIdx = -1;

function closeInvestDrawer(overlayId, e) {
  if (e && e.target !== document.getElementById(overlayId)) return;
  document.getElementById(overlayId).classList.remove('open');
}

// ── Add More Units ────────────────────────────────────────────
function openAddUnits(i) {
  _drawerHoldingIdx = i;
  const h = getHoldings()[i];
  const c = calcHolding(h);
  const sym = CURRENCY_SYMBOLS[c.nativeCurrency] || '$';
  const curPrice = h.livePrice || h.manualPrice || '';

  document.getElementById('addUnitsTitle').textContent = 'Add More ' + h.ticker;
  // Plain text info — no HTML tags
  document.getElementById('addUnitsCurrentInfo').textContent =
    'Currently: ' + h.units + ' units @ ' + sym + h.buyPrice.toFixed(2) + ' avg'
    + (c.nativeCurrency !== 'USD' ? ' (' + c.nativeCurrency + ')' : '');

  document.getElementById('add-units-qty').value = '';
  // Default price = current live price
  document.getElementById('add-units-price').value = curPrice ? parseFloat(curPrice).toFixed(2) : '';
  document.getElementById('addUnitsPreview').textContent = curPrice
    ? 'Price pre-filled from current market price — change if needed'
    : 'Enter units and price to preview new average';
  document.getElementById('addUnitsOverlay').classList.add('open');
  setTimeout(() => document.getElementById('add-units-qty').focus(), 320);

  // Live preview
  ['add-units-qty','add-units-price'].forEach(id => {
    document.getElementById(id).oninput = function() {
      const addQty   = parseFloat(document.getElementById('add-units-qty').value)   || 0;
      const addPrice = parseFloat(document.getElementById('add-units-price').value) || 0;
      if (!addQty || !addPrice) { document.getElementById('addUnitsPreview').textContent = ''; return; }
      const newUnits = h.units + addQty;
      const newAvg   = ((h.units * h.buyPrice) + (addQty * addPrice)) / newUnits;
      document.getElementById('addUnitsPreview').textContent =
        'New average: ' + sym + newAvg.toFixed(2)
        + (c.nativeCurrency !== 'USD' ? ' ' + c.nativeCurrency : '')
        + '  |  Total units: ' + newUnits.toFixed(4).replace(/\.?0+$/,'');
    };
  });
}

function confirmAddUnits() {
  const addQty   = parseFloat(document.getElementById('add-units-qty').value);
  const addPrice = parseFloat(document.getElementById('add-units-price').value);
  if (!addQty || !addPrice) { alert('Please enter units and price.'); return; }
  const holdings = getHoldings();
  const h = holdings[_drawerHoldingIdx];
  const newUnits = h.units + addQty;
  h.buyPrice = ((h.units * h.buyPrice) + (addQty * addPrice)) / newUnits;
  h.units = newUnits;
  saveHoldings(holdings);
  document.getElementById('addUnitsOverlay').classList.remove('open');
  renderAll();
}

function openSell(i) {
  _drawerHoldingIdx = i;
  const h = getHoldings()[i];
  const c = calcHolding(h);
  const sym     = CURRENCY_SYMBOLS[c.nativeCurrency] || '$';
  const curPrice = h.livePrice || h.manualPrice || '';

  document.getElementById('sellDrawerTitle').textContent = 'Sell ' + h.ticker;
  // Plain text — no HTML spans
  document.getElementById('sellCurrentInfo').textContent =
    h.units + ' units held'
    + '  ·  Avg cost: ' + sym + h.buyPrice.toFixed(2)
    + (c.nativeCurrency !== 'USD' ? ' ' + c.nativeCurrency : '')
    + (curPrice ? '  ·  Current: ' + sym + parseFloat(curPrice).toFixed(2) : '');

  document.getElementById('sell-units').value = '';
  // Default to current live price
  document.getElementById('sell-price').value = curPrice ? parseFloat(curPrice).toFixed(2) : '';
  document.getElementById('sell-date').valueAsDate = new Date();
  document.getElementById('sellPreview').textContent = curPrice
    ? 'Price pre-filled from current market price — change if needed'
    : '';
  document.getElementById('sellDrawerOverlay').classList.add('open');
  setTimeout(() => document.getElementById('sell-units').focus(), 320);

  ['sell-units','sell-price'].forEach(id => {
    document.getElementById(id).oninput = function() {
      const qty   = parseFloat(document.getElementById('sell-units').value)  || 0;
      const price = parseFloat(document.getElementById('sell-price').value) || 0;
      if (!qty || !price) { document.getElementById('sellPreview').textContent = ''; return; }
      const nativeCur = c.nativeCurrency;
      const proceeds  = toUSD(price * qty, nativeCur);
      const costBasis = toUSD(h.buyPrice * qty, nativeCur);
      const pnl       = proceeds - costBasis;
      const pnlPct    = costBasis ? (pnl / costBasis * 100) : 0;
      const sign      = pnl >= 0 ? '+' : '';
      document.getElementById('sellPreview').innerHTML =
        '<strong>P&amp;L:</strong> <span style="color:' + (pnl>=0?'var(--green)':'var(--red)') + '">'
        + sign + fmtDisplay(pnl) + ' (' + sign + pnlPct.toFixed(2) + '%)</span>'
        + '&nbsp;&nbsp;<strong>Proceeds:</strong> ' + fmtDisplay(proceeds);
    };
  });
}

function confirmSell() {
  const qty   = parseFloat(document.getElementById('sell-units').value);
  const price = parseFloat(document.getElementById('sell-price').value);
  const date  = document.getElementById('sell-date').value;
  if (!qty || !price) { alert('Please enter units and sell price.'); return; }
  const holdings = getHoldings();
  const h = holdings[_drawerHoldingIdx];
  if (qty > h.units) { alert('Cannot sell more units than you hold (' + h.units + ').'); return; }

  const nativeCur = getNativeCurrency(h.ticker);
  const proceeds  = toUSD(price * qty, nativeCur);
  const costBasis = toUSD(h.buyPrice * qty, nativeCur);
  const pnl       = proceeds - costBasis;
  const pnlPct    = costBasis ? (pnl / costBasis * 100) : 0;

  // Log realised trade
  const trades = getRealisedTrades();
  trades.unshift({ ticker: h.ticker, date, units: qty, sellPrice: price, avgCost: h.buyPrice, proceeds, costBasis, pnl, pnlPct, nativeCur });
  saveRealisedTrades(trades);

  // Reduce or remove holding
  if (qty >= h.units) {
    holdings.splice(_drawerHoldingIdx, 1);
  } else {
    h.units = parseFloat((h.units - qty).toFixed(8));
  }
  saveHoldings(holdings);
  document.getElementById('sellDrawerOverlay').classList.remove('open');
  renderAll();
  renderRealisedTrades();
}

// ── Dividends ─────────────────────────────────────────────────
function openDividend(i) {
  _drawerHoldingIdx = i;
  const h = getHoldings()[i];
  document.getElementById('divDrawerTitle').textContent = h.ticker + ' — Log Dividend';
  document.getElementById('div-amount').value = '';
  document.getElementById('div-note').value = '';
  document.getElementById('div-date').valueAsDate = new Date();
  document.getElementById('divDrawerOverlay').classList.add('open');
}

function confirmDividend() {
  const amount = parseFloat(document.getElementById('div-amount').value);
  const date   = document.getElementById('div-date').value;
  const note   = document.getElementById('div-note').value.trim();
  if (!amount) { alert('Please enter a dividend amount.'); return; }
  const h = getHoldings()[_drawerHoldingIdx];
  const divs = getDividends();
  divs.unshift({ ticker: h.ticker, date, amount, note });
  saveDividends(divs);
  document.getElementById('divDrawerOverlay').classList.remove('open');
  renderDividends();
  renderOverview(); // update total return
}

// ── Render Realised Trades ────────────────────────────────────
function renderRealisedTrades() {
  const trades = getRealisedTrades();
  const tbody  = document.getElementById('realised-body');
  if (!tbody) return;
  if (!trades.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No sales recorded yet</td></tr>';
    document.getElementById('realised-summary').innerHTML = '';
    return;
  }
  const totalPnl = trades.reduce((a, t) => a + t.pnl, 0);
  document.getElementById('realised-summary').innerHTML = `
    <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;color:${totalPnl>=0?'var(--green)':'var(--red)'}">
      Total P&amp;L: ${totalPnl>=0?'+':''}${fmtDisplay(totalPnl)}
    </div>
    <div style="font-family:'Montserrat',sans-serif;font-size:11px;color:var(--mid);">${trades.length} sale${trades.length!==1?'s':''} recorded</div>`;
  tbody.innerHTML = trades.map((t, i) => {
    const up = t.pnl >= 0;
    return `<tr>
      <td><div class="ticker-badge" style="background:var(--navy);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:10px;padding:3px 7px;border-radius:6px;display:inline-block;">${t.ticker}</div></td>
      <td class="mono" style="color:var(--mid);font-size:11px;">${t.date || '—'}</td>
      <td class="mono">${t.units}</td>
      <td class="mono">${fmtNative(t.sellPrice, t.nativeCur)}</td>
      <td class="mono">${fmtDisplay(t.costBasis)}</td>
      <td class="mono ${up?'up-val':'down-val'}">${up?'+':''}${fmtDisplay(t.pnl)}</td>
      <td class="mono ${up?'up-val':'down-val'}">${up?'+':''}${t.pnlPct.toFixed(2)}%</td>
      <td><button class="act-btn del" onclick="deleteRealisedTrade(${i})">×</button></td>
    </tr>`;
  }).join('');
}

function deleteRealisedTrade(i) {
  const trades = getRealisedTrades();
  trades.splice(i, 1);
  saveRealisedTrades(trades);
  renderRealisedTrades();
}

// ── Render Dividends ──────────────────────────────────────────
function renderDividends() {
  const divs  = getDividends();
  const tbody = document.getElementById('dividend-body');
  if (!tbody) return;
  if (!divs.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No dividends logged yet</td></tr>';
    document.getElementById('dividend-summary').innerHTML = '';
    return;
  }
  const total = divs.reduce((a, d) => a + d.amount, 0);
  document.getElementById('dividend-summary').innerHTML = `
    <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;color:var(--green);">
      Total Dividends: ${fmtDisplay(total)}
    </div>
    <div style="font-family:'Montserrat',sans-serif;font-size:11px;color:var(--mid);">${divs.length} payment${divs.length!==1?'s':''}</div>`;
  tbody.innerHTML = divs.map((d, i) => `
    <tr>
      <td><div class="ticker-badge" style="background:var(--navy);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:10px;padding:3px 7px;border-radius:6px;display:inline-block;">${d.ticker}</div></td>
      <td class="mono" style="color:var(--mid);font-size:11px;">${d.date || '—'}</td>
      <td class="mono up-val">${fmtDisplay(d.amount)}</td>
      <td style="font-size:12px;color:var(--mid);">${d.note || ''}</td>
      <td><button class="act-btn del" onclick="deleteDividend(${i})">×</button></td>
    </tr>`).join('');
}

function deleteDividend(i) {
  const divs = getDividends();
  divs.splice(i, 1);
  saveDividends(divs);
  renderDividends();
  renderOverview();
}

// ── Watchlist ─────────────────────────────────────────────────
function addWatchlistItem() {
  const ticker = (document.getElementById('watch-ticker').value || '').trim().toUpperCase();
  const note   = (document.getElementById('watch-note').value || '').trim();
  if (!ticker) { alert('Enter a ticker symbol.'); return; }
  const wl = getWatchlist();
  if (wl.find(w => w.ticker === ticker)) { alert(ticker + ' is already on your watchlist.'); return; }
  wl.push({ ticker, note, livePrice: null, dayChange: null, dayChangePct: null, prevClose: null });
  saveWatchlist(wl);
  document.getElementById('watch-ticker').value = '';
  document.getElementById('watch-note').value = '';
  renderWatchlist();
  fetchWatchlistPrices();
}

function deleteWatchlistItem(i) {
  const wl = getWatchlist();
  wl.splice(i, 1);
  saveWatchlist(wl);
  renderWatchlist();
}

async function fetchWatchlistPrices() {
  const wl = getWatchlist();
  if (!wl.length) return;
  const tickers = wl.map(w => w.ticker).join(',');
  try {
    const r = await fetch('/api/prices?symbols=' + encodeURIComponent(tickers));
    if (!r.ok) return;
    const data = await r.json();
    wl.forEach((w, i) => {
      const d = data[w.ticker];
      if (d) {
        wl[i].livePrice    = d.price        || null;
        wl[i].dayChange    = d.dayChange    || null;
        wl[i].dayChangePct = d.dayChangePct || null;
        wl[i].prevClose    = d.prevClose    || null;
      }
    });
    saveWatchlist(wl);
    renderWatchlist();
  } catch(e) { console.warn('Watchlist fetch failed', e); }
}

function renderWatchlist() {
  const wl    = getWatchlist();
  const tbody = document.getElementById('watchlist-body');
  if (!tbody) return;
  if (!wl.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Add tickers you\'re watching below</td></tr>';
    return;
  }
  tbody.innerHTML = wl.map((w, i) => {
    const up   = (w.dayChange || 0) >= 0;
    const sym  = CURRENCY_SYMBOLS[getNativeCurrency(w.ticker)] || '$';
    const price = w.livePrice ? sym + w.livePrice.toFixed(2) : '—';
    const chg   = w.dayChange != null
      ? `<span style="color:${up?'var(--green)':'var(--red)'};">${up?'+':''}${sym}${Math.abs(w.dayChange).toFixed(2)} (${up?'+':''}${(w.dayChangePct||0).toFixed(2)}%)</span>`
      : '—';
    const h52 = w.prevClose ? sym + w.prevClose.toFixed(2) : '—';
    return `<tr>
      <td><div class="ticker-badge" style="background:var(--navy);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:10px;padding:3px 7px;border-radius:6px;display:inline-block;">${w.ticker}</div></td>
      <td class="mono">${price}</td>
      <td>${chg}</td>
      <td class="mono" style="color:var(--mid);">${h52}</td>
      <td style="font-size:12px;color:var(--mid);">${w.note||''}</td>
      <td><button class="act-btn del" onclick="deleteWatchlistItem(${i})">×</button></td>
    </tr>`;
  }).join('');
}

// ── Target Allocation (render inputs + drift) ─────────────────
function renderTargetAllocInputs() {
  const holdings   = getHoldings();
  const targets    = getTargetAlloc();
  const assetTypes = [...new Set(holdings.map(h => h.assetType || 'Stock'))];
  // Add common types not yet in portfolio
  ['Stock','ETF','Bond','Cash','Crypto','Property'].forEach(t => { if (!assetTypes.includes(t)) assetTypes.push(t); });
  const el = document.getElementById('target-alloc-inputs');
  if (!el) return;
  el.innerHTML = assetTypes.map(t => `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <label style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;color:var(--dark);width:90px;flex-shrink:0;">${t}</label>
      <input type="number" class="alloc-target-input" data-type="${t}" value="${targets[t]||0}" min="0" max="100" step="1" placeholder="0">
      <span style="font-size:12px;color:var(--mid);">%</span>
    </div>`).join('');
}

function renderTargetAllocDrift() {
  const el = document.getElementById('target-alloc-content');
  if (!el) return;
  const holdings = getHoldings();
  const targets  = getTargetAlloc();
  if (!Object.keys(targets).length || !holdings.length) {
    el.innerHTML = '<div class="empty-state">Set target allocations in ⚙ Settings to see drift analysis</div>';
    return;
  }
  const totals = portfolioTotals();
  const totalVal = totals.totalValue || 1;
  // Group actual by asset type
  const actual = {};
  holdings.forEach(h => {
    const c    = calcHolding(h);
    const type = h.assetType || 'Stock';
    actual[type] = (actual[type] || 0) + c.marketValue;
  });
  const types = [...new Set([...Object.keys(targets), ...Object.keys(actual)])];
  el.innerHTML = types.map(t => {
    const tgt    = targets[t] || 0;
    const actPct = ((actual[t] || 0) / totalVal * 100);
    const drift  = actPct - tgt;
    const driftCol = Math.abs(drift) < 2 ? 'var(--green)' : Math.abs(drift) < 5 ? 'var(--amber, #f59e0b)' : 'var(--red)';
    const barCol   = actPct <= tgt ? 'var(--teal)' : 'var(--coral)';
    return `<div class="alloc-drift-row">
      <div class="alloc-drift-label">${t}</div>
      <div class="alloc-drift-bar-wrap">
        <div class="alloc-drift-bar-actual" style="width:${Math.min(actPct,100)}%;background:${barCol};"></div>
        <div class="alloc-drift-target-line" style="left:${Math.min(tgt,100)}%;"></div>
      </div>
      <div class="alloc-drift-pcts">
        <span style="color:var(--dark);">${actPct.toFixed(1)}%</span>
        <span style="color:var(--mid);">/ ${tgt}%</span>
        <span style="color:${driftCol};margin-left:4px;">(${drift>=0?'+':''}${drift.toFixed(1)}%)</span>
      </div>
    </div>`;
  }).join('');
}

// ── Monthly P&L Heatmap ───────────────────────────────────────
// ============================================================
//  TAB SWITCHING
// ============================================================
function showTab(id, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  btn.classList.add('active');
  if (id === 'performance') renderPerformance();
  if (id === 'watchlist') { renderWatchlist(); fetchWatchlistPrices(); }
  if (id === 'invest-settings') renderTargetAllocInputs();
}

// ── Realised Gains tab ────────────────────────────────────────
function renderRealisedTab() {
  const trades = getRealisedTrades();
  const divs   = getDividends();

  const totalSalesPnl = trades.reduce((a, t) => a + t.pnl, 0);
  const totalDivs     = divs.reduce((a, d) => a + d.amount, 0);
  const grandTotal    = totalSalesPnl + totalDivs;

  // Hero cards
  const grandUp    = grandTotal >= 0;
  const salesUp    = totalSalesPnl >= 0;
  const totalEl    = document.getElementById('rg-total');
  const salesEl    = document.getElementById('rg-sales-total');
  const divEl      = document.getElementById('rg-div-total');
  const salesBadge = document.getElementById('rg-sales-badge');
  const divBadge   = document.getElementById('rg-div-badge');

  if (totalEl) {
    totalEl.textContent = (grandUp ? '+' : '') + fmtDisplay(grandTotal);
    totalEl.style.color = grandUp ? 'var(--green)' : 'var(--red)';
  }
  if (salesEl) {
    salesEl.textContent = (salesUp ? '+' : '') + fmtDisplay(totalSalesPnl);
    salesEl.style.color = salesUp ? 'var(--green)' : 'var(--red)';
  }
  if (divEl) {
    divEl.textContent = fmtDisplay(totalDivs);
    divEl.style.color = 'var(--green)';
  }
  if (salesBadge) {
    salesBadge.className = 'hero-badge ' + (salesUp ? 'up' : 'down');
    salesBadge.textContent = (salesUp ? '+' : '') + fmtDisplay(totalSalesPnl) + ' from sales';
  }
  if (divBadge) {
    divBadge.className = 'hero-badge up';
    divBadge.textContent = fmtDisplay(totalDivs) + ' from dividends';
  }

  // Sales table
  const salesBody = document.getElementById('rg-sales-body');
  if (salesBody) {
    salesBody.innerHTML = trades.length ? trades.map((t, i) => {
      const up  = t.pnl >= 0;
      const sym = CURRENCY_SYMBOLS[t.nativeCur] || '$';
      return `<tr>
        <td><div class="ticker-badge" style="background:var(--navy);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:10px;padding:3px 7px;border-radius:6px;display:inline-block;">${t.ticker}</div></td>
        <td class="mono" style="color:var(--mid);font-size:11px;">${t.date || '—'}</td>
        <td class="mono">${t.units}</td>
        <td class="mono">${sym}${parseFloat(t.sellPrice).toFixed(2)}</td>
        <td class="mono">${sym}${parseFloat(t.avgCost).toFixed(2)}</td>
        <td class="mono">${fmtDisplay(t.proceeds)}</td>
        <td class="mono ${up?'up-val':'down-val'}">${up?'+':''}${fmtDisplay(t.pnl)}</td>
        <td class="mono ${up?'up-val':'down-val'}">${up?'+':''}${t.pnlPct.toFixed(2)}%</td>
        <td><button class="act-btn del" onclick="deleteRealisedTrade(${i});renderRealisedTab()">×</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="9" class="empty-state">No sales recorded yet</td></tr>';
  }

  // Dividends table
  const divBody = document.getElementById('rg-div-body');
  if (divBody) {
    divBody.innerHTML = divs.length ? divs.map((d, i) => `
      <tr>
        <td><div class="ticker-badge" style="background:var(--navy);color:white;font-family:'Montserrat',sans-serif;font-weight:700;font-size:10px;padding:3px 7px;border-radius:6px;display:inline-block;">${d.ticker}</div></td>
        <td class="mono" style="color:var(--mid);font-size:11px;">${d.date || '—'}</td>
        <td class="mono up-val">+${fmtDisplay(d.amount)}</td>
        <td style="font-size:12px;color:var(--mid);">${d.note || ''}</td>
        <td><button class="act-btn del" onclick="deleteDividend(${i});renderRealisedTab()">×</button></td>
      </tr>`).join('') : '<tr><td colspan="5" class="empty-state">No dividends logged yet</td></tr>';
  }
}

function goToInvestSettings() {
  // Find the Settings tab button and activate it
  const btns = document.querySelectorAll('#investTabBar .tab-btn');
  const settingsBtn = Array.from(btns).find(b => b.textContent.includes('Settings'));
  if (settingsBtn) {
    showTab('invest-settings', settingsBtn);
    settingsBtn.scrollIntoView({ inline: 'nearest', behavior: 'smooth' });
  }
}

// ── Invest settings functions ─────────────────────────────────
function exportInvestData() {
  const s = getState();
  const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'livesimple-invest-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
}

function importInvestData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.holdings) { alert('Invalid file — no holdings data found.'); return; }
      const s = getState();
      Object.assign(s, data);
      saveState(s);
      historyCache = null;
      renderAll();
      alert('Holdings imported successfully.');
    } catch (err) {
      alert('Invalid file. Please use a Live Simple Invest backup JSON file.');
    }
  };
  reader.readAsText(file);
  input.value = '';
}

function confirmResetInvest() {
  if (confirm('Reset all holdings and portfolio data? This cannot be undone.')) {
    localStorage.removeItem('ls_invest_v1');
    historyCache = null;
    renderAll();
    // Switch back to overview tab
    const overviewBtn = document.querySelector('.tab-btn');
    if (overviewBtn) showTab('overview', overviewBtn);
  }
}

// ============================================================
//  INIT
// ============================================================
// Restore goal inputs
const gs = getGoalSettings();
if (gs.target) document.getElementById('goal-target').value = gs.target;
if (gs.contrib) document.getElementById('goal-contrib').value = gs.contrib;

renderAll();
calcUpdate();
updateGoal();
updateMarketStatus();
setInterval(updateMarketStatus, 60000); // refresh market open/close status every minute

// Auto-fetch prices on load
fetchAllPrices();
