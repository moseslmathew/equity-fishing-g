import { readerAllowed, deny } from "../../../../lib/access";

export const dynamic = "force-dynamic";

export type ChartPoint = {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartResponse = {
  symbol: string;
  range: string;
  currency: string;
  points: ChartPoint[];
  meta: {
    firstTradeDate?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    regularMarketPrice?: number;
    periodHigh: number;
    periodLow: number;
    periodChange: number;
    periodChangePercent: number;
  };
};

const cache = new Map<string, { expiresAt: number; data: ChartResponse }>();

const RANGE_CONFIG: Record<string, { range: string; interval: string; ttlMs: number }> = {
  "1D": { range: "1d", interval: "5m", ttlMs: 60_000 },
  "5D": { range: "5d", interval: "15m", ttlMs: 120_000 },
  "1M": { range: "1mo", interval: "1d", ttlMs: 300_000 },
  "6M": { range: "6mo", interval: "1d", ttlMs: 600_000 },
  "1Y": { range: "1y", interval: "1d", ttlMs: 600_000 },
  "5Y": { range: "5y", interval: "1wk", ttlMs: 1_800_000 },
  "ALL": { range: "max", interval: "1mo", ttlMs: 3_600_000 },
};

async function fetchFromYahoo(ticker: string, range: string, interval: string): Promise<any> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) return null;
  return response.json();
}

export async function GET(request: Request) {
  if (!(await readerAllowed(request.headers))) return deny();

  const url = new URL(request.url);
  const rawSymbol = (url.searchParams.get("symbol") || "").trim().toUpperCase();
  const rangeKey = (url.searchParams.get("range") || "1Y").trim().toUpperCase();

  const cleanSymbol = rawSymbol.replace(/[^A-Z0-9&_-]/g, "");
  if (!cleanSymbol) {
    return Response.json({ error: "Missing or invalid symbol" }, { status: 400 });
  }

  const config = RANGE_CONFIG[rangeKey] || RANGE_CONFIG["1Y"];
  const cacheKey = `${cleanSymbol}:${rangeKey}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Response.json(cached.data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Cache": "HIT",
      },
    });
  }

  try {
    // Try NSE (.NS) first, fallback to BSE (.BO) if needed
    let json = await fetchFromYahoo(`${cleanSymbol}.NS`, config.range, config.interval);
    if (!json?.chart?.result?.[0]?.timestamp?.length) {
      json = await fetchFromYahoo(`${cleanSymbol}.BO`, config.range, config.interval);
    }

    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp?.length) {
      return Response.json(
        { error: `No historical chart data available for ${cleanSymbol}` },
        { status: 404 }
      );
    }

    const timestamps: number[] = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const opens: (number | null)[] = quotes.open || [];
    const highs: (number | null)[] = quotes.high || [];
    const lows: (number | null)[] = quotes.low || [];
    const closes: (number | null)[] = quotes.close || [];
    const volumes: (number | null)[] = quotes.volume || [];

    const points: ChartPoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c == null || !Number.isFinite(c)) continue;
      const o = opens[i] != null && Number.isFinite(opens[i]) ? (opens[i] as number) : c;
      const h = highs[i] != null && Number.isFinite(highs[i]) ? (highs[i] as number) : Math.max(o, c);
      const l = lows[i] != null && Number.isFinite(lows[i]) ? (lows[i] as number) : Math.min(o, c);
      const v = volumes[i] != null && Number.isFinite(volumes[i]) ? Math.max(0, volumes[i] as number) : 0;

      points.push({
        time: timestamps[i],
        open: Math.round(o * 100) / 100,
        high: Math.round(h * 100) / 100,
        low: Math.round(l * 100) / 100,
        close: Math.round(c * 100) / 100,
        volume: v,
      });
    }

    if (points.length === 0) {
      return Response.json(
        { error: `No valid trading points found for ${cleanSymbol}` },
        { status: 404 }
      );
    }

    const firstClose = points[0].close;
    const lastClose = points[points.length - 1].close;
    const periodHigh = Math.max(...points.map((p) => p.high));
    const periodLow = Math.min(...points.map((p) => p.low));
    const periodChange = Math.round((lastClose - firstClose) * 100) / 100;
    const periodChangePercent =
      firstClose > 0 ? Math.round(((lastClose - firstClose) / firstClose) * 10000) / 100 : 0;

    const meta = result.meta || {};
    const chartData: ChartResponse = {
      symbol: cleanSymbol,
      range: rangeKey,
      currency: meta.currency || "INR",
      points,
      meta: {
        firstTradeDate: meta.firstTradeDate,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
        regularMarketPrice: meta.regularMarketPrice ?? lastClose,
        periodHigh,
        periodLow,
        periodChange,
        periodChangePercent,
      },
    };

    cache.set(cacheKey, {
      expiresAt: Date.now() + config.ttlMs,
      data: chartData,
    });

    if (cache.size > 200) {
      const now = Date.now();
      for (const [k, v] of cache.entries()) {
        if (v.expiresAt < now) cache.delete(k);
      }
    }

    return Response.json(chartData, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error fetching historical chart data:", error);
    return Response.json(
      { error: "Historical chart data is temporarily unavailable" },
      { status: 502 }
    );
  }
}
