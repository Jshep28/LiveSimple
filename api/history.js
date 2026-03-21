// api/history.js — Vercel serverless function
// Fetches 1-year monthly historical prices from Yahoo Finance

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbols = req.query.symbols || '';
  if (!symbols) return res.status(400).json({ error: 'No symbols' });

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  const symbolList = symbols.split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - (365 * 24 * 60 * 60);

  // Include S&P 500 and NASDAQ 100 for comparison charts
  const allSymbols = [...new Set([...symbolList, '^GSPC', '^NDX'])];

  const results = {};

  for (const symbol of allSymbols) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1mo&period1=${oneYearAgo}&period2=${now}`;
      const r = await fetch(url, { headers: baseHeaders });
      const d = await r.json();
      const chart = d?.chart?.result?.[0];
      if (!chart) continue;

      const timestamps = chart.timestamps || chart.timestamp || [];
      const closes = chart.indicators?.quote?.[0]?.close || [];

      const monthly = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = closes[i];
        if (!close) continue;
        const date = new Date(timestamps[i] * 1000);
        monthly.push({
          date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          close: Math.round(close * 100) / 100,
        });
      }

      if (monthly.length) results[symbol] = monthly;
    } catch (e) {
      console.log(`History fetch failed for ${symbol}:`, e.message);
    }
  }

  return res.status(200).json(results);
}
