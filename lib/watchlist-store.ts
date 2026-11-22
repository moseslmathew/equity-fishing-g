import { database, DatabaseClient } from "./database-store";

export type WatchlistItem = {
  id: string;
  userId: string;
  itemType: "stock" | "fund";
  itemKey: string;
  itemTitle: string;
  itemSubtitle?: string;
  notes?: string;
  sortOrder?: number;
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
            sort_order INTEGER DEFAULT 0,
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
      try {
        await db.prepare("ALTER TABLE user_watchlists ADD COLUMN sort_order INTEGER DEFAULT 0").run();
      } catch {
        // column already exists
      }
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
      'SELECT id, user_id as "userId", item_type as "itemType", item_key as "itemKey", item_title as "itemTitle", item_subtitle as "itemSubtitle", notes, COALESCE(sort_order, 0) as "sortOrder", created_at as "createdAt", updated_at as "updatedAt" FROM user_watchlists WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC'
    )
    .bind(userId)
    .all<WatchlistItem>();

  let list = (rows.results || []).map((r: any) => ({
    ...r,
    sortOrder: typeof r.sortOrder === "number" ? r.sortOrder : 0,
    createdAt: typeof r.createdAt === "object" && r.createdAt?.toISOString ? r.createdAt.toISOString() : String(r.createdAt || new Date().toISOString()),
    updatedAt: typeof r.updatedAt === "object" && r.updatedAt?.toISOString ? r.updatedAt.toISOString() : String(r.updatedAt || new Date().toISOString()),
  }));

  // If a signed-in user has no items yet, copy any existing items from default-user into their account so their additions persist
  if (list.length === 0 && userId !== "default-user") {
    const defaultRows = await db
      .prepare(
        'SELECT id, user_id as "userId", item_type as "itemType", item_key as "itemKey", item_title as "itemTitle", item_subtitle as "itemSubtitle", notes, COALESCE(sort_order, 0) as "sortOrder", created_at as "createdAt", updated_at as "updatedAt" FROM user_watchlists WHERE user_id = ? ORDER BY sort_order ASC, created_at DESC'
      )
      .bind("default-user")
      .all<WatchlistItem>();
    const defaults = defaultRows.results || [];
    for (let i = 0; i < defaults.length; i++) {
      const item = defaults[i];
      await addToWatchlist({
        userId,
        itemType: item.itemType,
        itemKey: item.itemKey,
        itemTitle: item.itemTitle,
        itemSubtitle: item.itemSubtitle,
        notes: item.notes,
        sortOrder: item.sortOrder ?? i,
      });
    }
    list = defaults.map((d: any, idx: number) => ({
      ...d,
      userId,
      id: `${userId}:${d.itemType}:${d.itemKey}`,
      sortOrder: typeof d.sortOrder === "number" ? d.sortOrder : idx,
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
  sortOrder?: number;
}): Promise<WatchlistItem> {
  const db = database();
  await ensureWatchlistTable(db);
  const id = `${item.userId}:${item.itemType}:${item.itemKey}`;
  const now = new Date().toISOString();

  let sortOrder = item.sortOrder;
  if (sortOrder === undefined) {
    try {
      const maxRow = await db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) as "maxOrder" FROM user_watchlists WHERE user_id = ?')
        .bind(item.userId)
        .first<{ maxOrder: number }>();
      sortOrder = (maxRow?.maxOrder ?? -1) + 1;
    } catch {
      sortOrder = 0;
    }
  }

  await db
    .prepare(`
      INSERT INTO user_watchlists (id, user_id, item_type, item_key, item_title, item_subtitle, notes, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      sortOrder,
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
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

export async function reorderWatchlist(
  userId: string,
  orderedItems: Array<{ itemType: "stock" | "fund"; itemKey: string }>
): Promise<void> {
  const db = database();
  await ensureWatchlistTable(db);
  const now = new Date().toISOString();
  for (let i = 0; i < orderedItems.length; i++) {
    const item = orderedItems[i];
    await db
      .prepare(
        "UPDATE user_watchlists SET sort_order = ?, updated_at = ? WHERE user_id = ? AND item_type = ? AND item_key = ?"
      )
      .bind(i, now, userId, item.itemType, item.itemKey)
      .run();
  }
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
