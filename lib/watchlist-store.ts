import { database, DatabaseClient } from "./database-store";

export type WatchlistItem = {
  id: string;
  userId: string;
  itemType: "stock" | "fund";
  itemKey: string;
  itemTitle: string;
  itemSubtitle?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

let ensuredWatchlistTable: Promise<void> | null = null;

/**
 * Ensures the `user_watchlists` table and its unique `(user_id, item_type, item_key)`
 * index exist on both Neon PostgreSQL and local Cloudflare D1 SQLite.
 */
async function ensureWatchlistTable(db: DatabaseClient): Promise<void> {
  if (!ensuredWatchlistTable) {
    ensuredWatchlistTable = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS user_watchlists (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_key TEXT NOT NULL,
            item_title TEXT,
            item_subtitle TEXT,
            notes TEXT,
            created_at TEXT,
            updated_at TEXT
          )`
        )
        .run();
      await db
        .prepare("CREATE INDEX IF NOT EXISTS idx_user_watchlists_user_id ON user_watchlists (user_id)")
        .run();
      await db
        .prepare(
          "CREATE UNIQUE INDEX IF NOT EXISTS idx_user_watchlists_unique ON user_watchlists (user_id, item_type, item_key)"
        )
        .run();
    })().catch((err) => {
      ensuredWatchlistTable = null;
      throw err;
    });
  }
  await ensuredWatchlistTable;
}

export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const db = database();
  await ensureWatchlistTable(db);
  const rows = await db
    .prepare(
      'SELECT id, user_id as "userId", item_type as "itemType", item_key as "itemKey", item_title as "itemTitle", item_subtitle as "itemSubtitle", notes, created_at as "createdAt", updated_at as "updatedAt" FROM user_watchlists WHERE user_id = ? ORDER BY created_at DESC'
    )
    .bind(userId)
    .all<WatchlistItem>();

  let list = (rows.results || []).map((r: any) => ({
    ...r,
    createdAt: typeof r.createdAt === "object" && r.createdAt?.toISOString ? r.createdAt.toISOString() : String(r.createdAt || new Date().toISOString()),
    updatedAt: typeof r.updatedAt === "object" && r.updatedAt?.toISOString ? r.updatedAt.toISOString() : String(r.updatedAt || new Date().toISOString()),
  }));

  // If a signed-in user has no items yet, copy any existing items from default-user into their account so their additions persist
  if (list.length === 0 && userId !== "default-user") {
    const defaultRows = await db
      .prepare(
        'SELECT id, user_id as "userId", item_type as "itemType", item_key as "itemKey", item_title as "itemTitle", item_subtitle as "itemSubtitle", notes, created_at as "createdAt", updated_at as "updatedAt" FROM user_watchlists WHERE user_id = ? ORDER BY created_at DESC'
      )
      .bind("default-user")
      .all<WatchlistItem>();
    const defaults = defaultRows.results || [];
    for (const item of defaults) {
      await addToWatchlist({
        userId,
        itemType: item.itemType,
        itemKey: item.itemKey,
        itemTitle: item.itemTitle,
        itemSubtitle: item.itemSubtitle,
        notes: item.notes,
      });
    }
    list = defaults.map((d: any) => ({
      ...d,
      userId,
      id: `${userId}:${d.itemType}:${d.itemKey}`,
      createdAt: typeof d.createdAt === "object" && d.createdAt?.toISOString ? d.createdAt.toISOString() : String(d.createdAt || new Date().toISOString()),
      updatedAt: typeof d.updatedAt === "object" && d.updatedAt?.toISOString ? d.updatedAt.toISOString() : String(d.updatedAt || new Date().toISOString()),
    }));
  }

  return list;
}

export async function addToWatchlist(item: {
  userId: string;
  itemType: "stock" | "fund";
  itemKey: string;
  itemTitle: string;
  itemSubtitle?: string;
  notes?: string;
}): Promise<WatchlistItem> {
  const db = database();
  await ensureWatchlistTable(db);
  const id = `${item.userId}:${item.itemType}:${item.itemKey}`;
  const now = new Date().toISOString();

  await db
    .prepare(`
      INSERT INTO user_watchlists (id, user_id, item_type, item_key, item_title, item_subtitle, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, item_type, item_key)
      DO UPDATE SET item_title = excluded.item_title, item_subtitle = excluded.item_subtitle, notes = excluded.notes, updated_at = excluded.updated_at
    `)
    .bind(
      id,
      item.userId,
      item.itemType,
      item.itemKey,
      item.itemTitle,
      item.itemSubtitle || "",
      item.notes || "",
      now,
      now
    )
    .run();

  return {
    id,
    userId: item.userId,
    itemType: item.itemType,
    itemKey: item.itemKey,
    itemTitle: item.itemTitle,
    itemSubtitle: item.itemSubtitle,
    notes: item.notes,
    createdAt: now,
    updatedAt: now,
  };
}

export async function removeFromWatchlist(
  userId: string,
  itemType: "stock" | "fund",
  itemKey: string
): Promise<boolean> {
  const db = database();
  await ensureWatchlistTable(db);
  await db
    .prepare("DELETE FROM user_watchlists WHERE user_id = ? AND item_type = ? AND item_key = ?")
    .bind(userId, itemType, itemKey)
    .run();
  return true;
}
