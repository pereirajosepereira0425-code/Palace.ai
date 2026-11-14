import { db } from './index.ts';
import { sharedLorebooks } from './schema.ts';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { LorebookEntryItem, SharedLorebookRecord } from '../types/index.ts';
import { isOwnedByRequester, type RequesterIdentity } from '../utils/ownership.ts';
import { parseLorebookEntries } from '../utils/communityUtils.ts';

function mapLorebookRow(row: typeof sharedLorebooks.$inferSelect): SharedLorebookRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    creatorName: row.creatorName,
    name: row.name,
    description: row.description,
    scanDepth: row.scanDepth,
    entries: row.entries,
    tags: row.tags,
    isPublic: row.isPublic,
    likeCount: row.likeCount,
    useCount: row.useCount,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
  };
}

export async function getPublicLorebooks(options: {
  search?: string;
  sort?: 'popular' | 'latest' | 'used';
  limit?: number;
  offset?: number;
}): Promise<SharedLorebookRecord[]> {
  try {
    const { search, sort = 'popular', limit = 24, offset = 0 } = options;
    let query = db.select().from(sharedLorebooks).$dynamic();
    const conditions = [eq(sharedLorebooks.isPublic, true)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        sql`(${sharedLorebooks.name} ILIKE ${pattern} OR ${sharedLorebooks.description} ILIKE ${pattern} OR ${sharedLorebooks.creatorName} ILIKE ${pattern} OR ${sharedLorebooks.tags} ILIKE ${pattern})`
      );
    }

    query = query.where(and(...conditions));

    if (sort === 'popular') {
      query = query.orderBy(
        desc(sharedLorebooks.likeCount),
        desc(sharedLorebooks.useCount),
        desc(sharedLorebooks.createdAt)
      );
    } else if (sort === 'used') {
      query = query.orderBy(desc(sharedLorebooks.useCount), desc(sharedLorebooks.likeCount));
    } else {
      query = query.orderBy(desc(sharedLorebooks.createdAt));
    }

    const rows = await query.limit(limit).offset(offset);
    return rows.map(mapLorebookRow);
  } catch (error) {
    console.error('getPublicLorebooks failed:', error);
    return [];
  }
}

export async function getUserLorebooks(userIds: string | string[]): Promise<SharedLorebookRecord[]> {
  try {
    const idList = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
    if (idList.length === 0) return [];
    const rows = await db
      .select()
      .from(sharedLorebooks)
      .where(inArray(sharedLorebooks.userId, idList))
      .orderBy(desc(sharedLorebooks.createdAt));
    return rows.map(mapLorebookRow);
  } catch (error) {
    console.error('getUserLorebooks failed:', error);
    return [];
  }
}

export async function createSharedLorebook(data: {
  userId: string;
  creatorName: string;
  name: string;
  description?: string;
  scanDepth?: number;
  entries: LorebookEntryItem[] | string;
  tags?: string[] | string;
  isPublic?: boolean;
}): Promise<SharedLorebookRecord> {
  try {
    const uuid = 'lb_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const normalizedEntries = parseLorebookEntries(data.entries);
    const scanDepth = Math.max(1, Math.min(20, Math.round(Number(data.scanDepth) || 4)));
    const tagsStr = Array.isArray(data.tags)
      ? JSON.stringify(data.tags)
      : typeof data.tags === 'string'
      ? data.tags
      : '[]';

    const inserted = await db
      .insert(sharedLorebooks)
      .values({
        uuid,
        userId: data.userId || 'guest',
        creatorName: data.creatorName || 'Anonymous',
        name: data.name.trim(),
        description: (data.description || 'Community world info & lorebook codex.').trim(),
        scanDepth,
        entries: JSON.stringify(normalizedEntries),
        tags: tagsStr,
        isPublic: data.isPublic ?? true,
      })
      .returning();

    return mapLorebookRow(inserted[0]);
  } catch (error) {
    console.error('createSharedLorebook failed:', error);
    throw new Error('Failed to create shared lorebook', { cause: error });
  }
}

export async function updateSharedLorebook(
  uuid: string,
  requester: string | RequesterIdentity,
  data: Partial<{
    name: string;
    description: string;
    scanDepth: number;
    entries: LorebookEntryItem[] | string;
    tags: string[] | string;
    isPublic: boolean;
  }>
): Promise<SharedLorebookRecord | null> {
  try {
    const existingList = await db
      .select()
      .from(sharedLorebooks)
      .where(eq(sharedLorebooks.uuid, uuid))
      .limit(1);
    const existing = existingList[0];
    if (!existing) return null;

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      throw new Error('FORBIDDEN');
    }

    const updatePayload: Record<string, unknown> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.scanDepth !== undefined) {
      updatePayload.scanDepth = Math.max(1, Math.min(20, Math.round(Number(data.scanDepth) || 4)));
    }
    if (data.entries !== undefined) {
      updatePayload.entries = JSON.stringify(parseLorebookEntries(data.entries));
    }
    if (data.tags !== undefined) {
      updatePayload.tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags;
    }
    if (data.isPublic !== undefined) updatePayload.isPublic = Boolean(data.isPublic);

    const updated = await db
      .update(sharedLorebooks)
      .set(updatePayload)
      .where(eq(sharedLorebooks.id, existing.id))
      .returning();

    return mapLorebookRow(updated[0]);
  } catch (error) {
    console.error('updateSharedLorebook failed:', error);
    throw error;
  }
}

export async function deleteSharedLorebook(
  uuid: string,
  requester: string | RequesterIdentity
): Promise<{ success: boolean; notFound?: boolean }> {
  try {
    const existingList = await db
      .select()
      .from(sharedLorebooks)
      .where(eq(sharedLorebooks.uuid, uuid))
      .limit(1);
    const existing = existingList[0];
    if (!existing) return { success: false, notFound: true };

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      throw new Error('FORBIDDEN');
    }

    await db.delete(sharedLorebooks).where(eq(sharedLorebooks.id, existing.id));
    return { success: true };
  } catch (error) {
    console.error('deleteSharedLorebook failed:', error);
    throw error;
  }
}

export async function toggleLikeLorebook(uuid: string): Promise<SharedLorebookRecord | null> {
  try {
    const updated = await db
      .update(sharedLorebooks)
      .set({ likeCount: sql`${sharedLorebooks.likeCount} + 1` })
      .where(eq(sharedLorebooks.uuid, uuid))
      .returning();
    return updated[0] ? mapLorebookRow(updated[0]) : null;
  } catch (error) {
    console.error('toggleLikeLorebook failed:', error);
    return null;
  }
}

export async function incrementLorebookUse(uuid: string): Promise<SharedLorebookRecord | null> {
  try {
    const updated = await db
      .update(sharedLorebooks)
      .set({ useCount: sql`${sharedLorebooks.useCount} + 1` })
      .where(eq(sharedLorebooks.uuid, uuid))
      .returning();
    return updated[0] ? mapLorebookRow(updated[0]) : null;
  } catch (error) {
    console.error('incrementLorebookUse failed:', error);
    return null;
  }
}

export async function ensureSeedLorebooks() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(sharedLorebooks);
    if (Number(existing[0]?.count || 0) > 0) return;

    const seeds = [
      {
        userId: 'seed-biguswigus-creator',
        creatorName: 'biguswigus',
        name: 'Vespera Arcane Academy Codex',
        description: 'Magic ranks, forbidden astral sects, and academy house rivalries for dark fantasy roleplay.',
        scanDepth: 5,
        tags: ['Dark Fantasy', 'Academy', 'Magic'],
        isPublic: true,
        entries: [
          {
            id: 'vespera-1',
            keys: 'Vespera, Academy, Astral',
            secondaryKeys: '',
            content: 'Vespera Academy floats above the Shattered Rift, divided into three rival houses: Obsidian Crown, Aureate Quill, and Umbral Tide.',
            insertionOrder: 100,
            enabled: true,
            constant: false,
            caseSensitive: false,
          },
          {
            id: 'vespera-2',
            keys: 'Aether Debt, Mana Burn',
            secondaryKeys: '',
            content: 'Overcasting astral spells crystallizes veins into violet quartz, requiring silver-thread stabilizer potions to reverse.',
            insertionOrder: 90,
            enabled: true,
            constant: false,
            caseSensitive: false,
          },
        ],
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Neo-Veridia Megacity Worldbook',
        description: 'Spire districts, chrome implants, syndicate territory rules, and netrunner slang.',
        scanDepth: 4,
        tags: ['Cyberpunk', 'Sci-Fi', 'Worldbuilding'],
        isPublic: true,
        entries: [
          {
            id: 'veridia-1',
            keys: 'Neo-Veridia, Spire, Lower Rim',
            secondaryKeys: '',
            content: 'The upper spires bask above toxic cloud strata while the neon-lit Lower Rim runs on black-market neural mods.',
            insertionOrder: 100,
            enabled: true,
            constant: false,
            caseSensitive: false,
          },
          {
            id: 'veridia-2',
            keys: 'SynthGen, Syndicate, Chrome',
            secondaryKeys: '',
            content: 'SynthGen owns 80% of orbital uplinks; crossing them marks your neural ID for corporate sweepers.',
            insertionOrder: 95,
            enabled: true,
            constant: false,
            caseSensitive: false,
          },
        ],
      },
    ];

    for (const lb of seeds) {
      await createSharedLorebook(lb);
    }
  } catch (error) {
    console.error('ensureSeedLorebooks failed:', error);
  }
}
