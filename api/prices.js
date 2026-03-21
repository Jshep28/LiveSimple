exports.handler = async (event) => {
  const symbols = event.queryStringParameters?.symbols || '';
  if (!symbols) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No symbols provided' }) };
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  const buildMap = (results) => {
    const map = {};
    for (const q of results) {
      if (!q.regularMarketPrice) continue;
      const price = q.regularMarketPrice;
      const prevClose = q.regularMarketPreviousClose || price;
      map[q.symbol] = {
        price, prevClose,
        currency: q.currency || 'USD',
        marketState: q.marketState || 'CLOSED',
        exchangeName: q.exchangeName || '',
        dayChange: price - prevClose,
        dayChangePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
        quoteType: q.quoteType || '',
        sector: q.sector || '',
        name: q.shortName || q.longName || q.symbol,
      };
    }
    return map;
  };

  // Attempt 1: crumb-authenticated v7 quote
  try {
    const cookieRes = await fetch('https://finance.yahoo.com/', { headers: baseHeaders });
    const cookies = cookieRes.headers.get('set-cookie') || '';
    const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
      headers: { ...baseHeaders, 'Cookie': cookies }
    });
    const crumb = await crumbRes.text();
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`;
    const quoteRes = await fetch(url, { headers: { ...baseHeaders, 'Cookie': cookies } });
    const data = await quoteRes.json();
    const results = data?.quoteResponse?.result || [];
    if (results.length) {
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(buildMap(results)) };
    }
  } catch(e) {}

  // Attempt 2: v8 chart per symbol (no auth needed)
  try {
    const symbolList = symbols.split(',').map(s => s.trim()).slice(0, 20);
    const map = {};
    for (const symbol of symbolList) {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const r = await fetch(url, { headers: baseHeaders });
        const d = await r.json();
        const m = d?.chart?.result?.[0]?.meta;
        if (!m?.regularMarketPrice) continue;
        const price = m.regularMarketPrice;
        const prevClose = m.chartPreviousClose || m.regularMarketPreviousClose || price;
        map[symbol] = {
          price, prevClose,
          currency: m.currency || 'USD',
          marketState: m.marketState || 'CLOSED',
          exchangeName: m.exchangeName || '',
          dayChange: price - prevClose,
          dayChangePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
          quoteType: m.instrumentType || '',
          sector: '',
          name: symbol,
        };
      } catch(e) {}
    }
    if (Object.keys(map).length) {
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(map) };
    }
  } catch(e) {}

  return {
    statusCode: 500,
    headers: responseHeaders,
    body: JSON.stringify({ error: 'All fetch attempts failed' }),
  };
};
