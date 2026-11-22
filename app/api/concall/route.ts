import { NextRequest, NextResponse } from "next/server";
import { readerAllowed, deny } from "../../../lib/access";
import { getConcallAnalysis } from "../../../lib/concall-analysis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await readerAllowed(request))) {
    return deny();
  }

  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim().toUpperCase();
  const name = searchParams.get("name")?.trim();

  if (!symbol) {
    return NextResponse.json({ error: "Missing required 'symbol' query parameter." }, { status: 400 });
  }

  try {
    const analysis = getConcallAnalysis(symbol, name || undefined);
    return NextResponse.json(analysis, {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load concall analysis" },
      { status: 500 }
    );
  }
}
