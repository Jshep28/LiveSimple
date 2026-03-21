exports.handler = async (event) => {
  const symbols = event.queryStringParameters?.symbols || '';
  if (!symbols) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols' }) };
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const symbolList = symbols.split(',').map(s => s.trim()).slice(0, 20);
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - (365 * 24 * 60 * 60);

  // Also get S&P 500 and NASDAQ 100 for comparison
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

      // Build monthly array: { date, close }
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
    } catch(e) {}
  }

  return {
    statusCode: 200,
    headers: responseHeaders,
    body: JSON.stringify(results),
  };
};
