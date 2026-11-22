import { getAuthenticatedUser, deny, readerAllowed } from "../../../lib/access";
import {
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  reorderWatchlist,
} from "../../../lib/watchlist-store";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!(await readerAllowed(request.headers))) return deny();

  const user = await getAuthenticatedUser(request.headers);
  const userId = user?.userId || "default-user";

  try {
    const items = await getUserWatchlist(userId);
    return Response.json({ items }, { headers });
  } catch (error) {
    console.error("Watchlist fetch failed:", error);
    return Response.json({ error: "Failed to retrieve watchlist" }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  if (!(await readerAllowed(request.headers))) return deny();

  const user = await getAuthenticatedUser(request.headers);
  const userId = user?.userId || "default-user";

  try {
    const body = (await request.json()) as {
      itemType?: string;
      itemKey?: string;
      itemTitle?: string;
      itemSubtitle?: string;
      notes?: string;
    };
    const { itemType, itemKey, itemTitle, itemSubtitle, notes } = body;

    if (!itemType || !itemKey || !itemTitle) {
      return Response.json({ error: "Missing required fields (itemType, itemKey, itemTitle)" }, { status: 400, headers });
    }

    if (itemType !== "stock" && itemType !== "fund") {
      return Response.json({ error: "itemType must be 'stock' or 'fund'" }, { status: 400, headers });
    }

    const item = await addToWatchlist({
      userId,
      itemType,
      itemKey,
      itemTitle,
      itemSubtitle,
      notes,
    });

    return Response.json({ success: true, item }, { headers });
  } catch (error) {
    console.error("Watchlist add failed:", error);
    return Response.json({ error: "Failed to add to watchlist" }, { status: 500, headers });
  }
}

export async function PUT(request: Request) {
  if (!(await readerAllowed(request.headers))) return deny();

  const user = await getAuthenticatedUser(request.headers);
  const userId = user?.userId || "default-user";

  try {
    const body = (await request.json()) as {
      orderedItems?: Array<{ itemType: "stock" | "fund"; itemKey: string }>;
    };

    if (!Array.isArray(body.orderedItems)) {
      return Response.json({ error: "orderedItems must be an array" }, { status: 400, headers });
    }

    await reorderWatchlist(userId, body.orderedItems);
    return Response.json({ success: true }, { headers });
  } catch (error) {
    console.error("Watchlist reorder failed:", error);
    return Response.json({ error: "Failed to reorder watchlist" }, { status: 500, headers });
  }
}

export async function DELETE(request: Request) {
  if (!(await readerAllowed(request.headers))) return deny();

  const user = await getAuthenticatedUser(request.headers);
  const userId = user?.userId || "default-user";

  try {
    const url = new URL(request.url);
    const itemType = url.searchParams.get("itemType") as "stock" | "fund";
    const itemKey = url.searchParams.get("itemKey");

    if (!itemType || !itemKey) {
      return Response.json({ error: "Missing itemType or itemKey" }, { status: 400, headers });
    }

    await removeFromWatchlist(userId, itemType, itemKey);
    return Response.json({ success: true }, { headers });
  } catch (error) {
    console.error("Watchlist delete failed:", error);
    return Response.json({ error: "Failed to delete from watchlist" }, { status: 500, headers });
  }
}
