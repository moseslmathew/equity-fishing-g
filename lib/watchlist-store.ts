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

export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const db = database();
  const rows = await db
    .prepare("SELECT id, user_id as \"userId\", item_type as \"itemType\", item_key as \"itemKey\", item_title as \"itemTitle\", item_subtitle as \"itemSubtitle\", notes, created_at as \"createdAt\", updated_at as \"updatedAt\" FROM user_watchlists WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<WatchlistItem>();

  return rows.results || [];
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

export async function removeFromWatchlist(userId: string, itemType: "stock" | "fund", itemKey: string): Promise<boolean> {
  const db = database();
  await db
    .prepare("DELETE FROM user_watchlists WHERE user_id = ? AND item_type = ? AND item_key = ?")
    .bind(userId, itemType, itemKey)
    .run();
  return true;
}
