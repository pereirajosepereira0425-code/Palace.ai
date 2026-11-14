import { db } from './index.ts';
import { sharedStages } from './schema.ts';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { SharedStageRecord } from '../types/index.ts';
import { isOwnedByRequester, type RequesterIdentity } from '../utils/ownership.ts';
import { clampBlurLevel, normalizeOverlayOpacity } from '../utils/communityUtils.ts';

function mapStageRow(row: typeof sharedStages.$inferSelect): SharedStageRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    userId: row.userId,
    creatorName: row.creatorName,
    name: row.name,
    category: row.category,
    imageUrl: row.imageUrl,
    description: row.description,
    blurLevel: row.blurLevel,
    overlayOpacity: Number(((row.overlayOpacityPct ?? 65) / 100).toFixed(2)),
    tags: row.tags,
    isPublic: row.isPublic,
    likeCount: row.likeCount,
    useCount: row.useCount,
    createdAt: row.createdAt ? row.createdAt.toISOString() : undefined,
  };
}

export async function getPublicStages(options: {
  search?: string;
  category?: string;
  sort?: 'popular' | 'latest' | 'used';
  limit?: number;
  offset?: number;
}): Promise<SharedStageRecord[]> {
  try {
    const { search, category, sort = 'popular', limit = 24, offset = 0 } = options;
    let query = db.select().from(sharedStages).$dynamic();
    const conditions = [eq(sharedStages.isPublic, true)];

    if (category && category !== 'All') {
      conditions.push(eq(sharedStages.category, category));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        sql`(${sharedStages.name} ILIKE ${pattern} OR ${sharedStages.description} ILIKE ${pattern} OR ${sharedStages.creatorName} ILIKE ${pattern} OR ${sharedStages.tags} ILIKE ${pattern})`
      );
    }

    query = query.where(and(...conditions));

    if (sort === 'popular') {
      query = query.orderBy(desc(sharedStages.likeCount), desc(sharedStages.useCount), desc(sharedStages.createdAt));
    } else if (sort === 'used') {
      query = query.orderBy(desc(sharedStages.useCount), desc(sharedStages.likeCount));
    } else {
      query = query.orderBy(desc(sharedStages.createdAt));
    }

    const rows = await query.limit(limit).offset(offset);
    return rows.map(mapStageRow);
  } catch (error) {
    console.error('getPublicStages failed:', error);
    return [];
  }
}

export async function getUserStages(userIds: string | string[]): Promise<SharedStageRecord[]> {
  try {
    const idList = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
    if (idList.length === 0) return [];
    const rows = await db
      .select()
      .from(sharedStages)
      .where(inArray(sharedStages.userId, idList))
      .orderBy(desc(sharedStages.createdAt));
    return rows.map(mapStageRow);
  } catch (error) {
    console.error('getUserStages failed:', error);
    return [];
  }
}

export async function createSharedStage(data: {
  userId: string;
  creatorName: string;
  name: string;
  category?: string;
  imageUrl: string;
  description?: string;
  blurLevel?: number;
  overlayOpacity?: number;
  tags?: string[] | string;
  isPublic?: boolean;
}): Promise<SharedStageRecord> {
  try {
    const uuid = 'stage_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const { pct } = normalizeOverlayOpacity(data.overlayOpacity, 65);
    const blur = clampBlurLevel(data.blurLevel, 2);
    const tagsStr = Array.isArray(data.tags)
      ? JSON.stringify(data.tags)
      : typeof data.tags === 'string'
      ? data.tags
      : '[]';

    const inserted = await db
      .insert(sharedStages)
      .values({
        uuid,
        userId: data.userId || 'guest',
        creatorName: data.creatorName || 'Anonymous',
        name: data.name.trim(),
        category: (data.category || 'Custom').trim(),
        imageUrl: data.imageUrl.trim(),
        description: (data.description || 'Atmospheric visual stage for immersive roleplay.').trim(),
        blurLevel: blur,
        overlayOpacityPct: pct,
        tags: tagsStr,
        isPublic: data.isPublic ?? true,
      })
      .returning();

    return mapStageRow(inserted[0]);
  } catch (error) {
    console.error('createSharedStage failed:', error);
    throw new Error('Failed to create shared stage', { cause: error });
  }
}

export async function updateSharedStage(
  uuid: string,
  requester: string | RequesterIdentity,
  data: Partial<{
    name: string;
    category: string;
    imageUrl: string;
    description: string;
    blurLevel: number;
    overlayOpacity: number;
    tags: string[] | string;
    isPublic: boolean;
  }>
): Promise<SharedStageRecord | null> {
  try {
    const existingList = await db
      .select()
      .from(sharedStages)
      .where(eq(sharedStages.uuid, uuid))
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
    if (data.category !== undefined) updatePayload.category = data.category.trim() || 'Custom';
    if (data.imageUrl !== undefined) updatePayload.imageUrl = data.imageUrl.trim();
    if (data.description !== undefined) updatePayload.description = data.description.trim();
    if (data.blurLevel !== undefined) updatePayload.blurLevel = clampBlurLevel(data.blurLevel, existing.blurLevel);
    if (data.overlayOpacity !== undefined) {
      updatePayload.overlayOpacityPct = normalizeOverlayOpacity(
        data.overlayOpacity,
        existing.overlayOpacityPct
      ).pct;
    }
    if (data.tags !== undefined) {
      updatePayload.tags = Array.isArray(data.tags) ? JSON.stringify(data.tags) : data.tags;
    }
    if (data.isPublic !== undefined) updatePayload.isPublic = Boolean(data.isPublic);

    const updated = await db
      .update(sharedStages)
      .set(updatePayload)
      .where(eq(sharedStages.id, existing.id))
      .returning();

    return mapStageRow(updated[0]);
  } catch (error) {
    console.error('updateSharedStage failed:', error);
    throw error;
  }
}

export async function deleteSharedStage(
  uuid: string,
  requester: string | RequesterIdentity
): Promise<{ success: boolean; notFound?: boolean }> {
  try {
    const existingList = await db
      .select()
      .from(sharedStages)
      .where(eq(sharedStages.uuid, uuid))
      .limit(1);
    const existing = existingList[0];
    if (!existing) return { success: false, notFound: true };

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      throw new Error('FORBIDDEN');
    }

    await db.delete(sharedStages).where(eq(sharedStages.id, existing.id));
    return { success: true };
  } catch (error) {
    console.error('deleteSharedStage failed:', error);
    throw error;
  }
}

export async function toggleLikeStage(uuid: string): Promise<SharedStageRecord | null> {
  try {
    const updated = await db
      .update(sharedStages)
      .set({ likeCount: sql`${sharedStages.likeCount} + 1` })
      .where(eq(sharedStages.uuid, uuid))
      .returning();
    return updated[0] ? mapStageRow(updated[0]) : null;
  } catch (error) {
    console.error('toggleLikeStage failed:', error);
    return null;
  }
}

export async function incrementStageUse(uuid: string): Promise<SharedStageRecord | null> {
  try {
    const updated = await db
      .update(sharedStages)
      .set({ useCount: sql`${sharedStages.useCount} + 1` })
      .where(eq(sharedStages.uuid, uuid))
      .returning();
    return updated[0] ? mapStageRow(updated[0]) : null;
  } catch (error) {
    console.error('incrementStageUse failed:', error);
    return null;
  }
}

export async function ensureSeedStages() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(sharedStages);
    if (Number(existing[0]?.count || 0) > 0) return;

    const seeds = [
      {
        userId: 'seed-biguswigus-creator',
        creatorName: 'biguswigus',
        name: 'Crimson Neon Ramen Bar',
        category: 'Cyberpunk',
        imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
        description: 'Steaming broth stalls, rain-slicked asphalt, and red lantern reflections under megacorporation towers.',
        blurLevel: 2,
        overlayOpacity: 0.65,
        tags: ['Cyberpunk', 'Slice of Life', 'Night'],
        isPublic: true,
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Astral Library of Eternity',
        category: 'Fantasy',
        imageUrl: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=80',
        description: 'Infinite tiered bookshelves floating in a violet starlight nebula where forbidden lorebooks whisper.',
        blurLevel: 2,
        overlayOpacity: 0.68,
        tags: ['Fantasy', 'Magic', 'Lore'],
        isPublic: true,
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Crimson Velvet Lounge',
        category: 'Romance',
        imageUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1600&q=80',
        description: 'Dim chandelier glow, jazz vinyl crackling softly, and velvet booths overlooking a midnight skyline.',
        blurLevel: 3,
        overlayOpacity: 0.72,
        tags: ['Romance', 'Modern', 'Slow Burn'],
        isPublic: true,
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Sunken Abyssal Research Deck',
        category: 'Sci-Fi',
        imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1600&q=80',
        description: 'Reinforced pressure glass surrounded by bioluminescent deep-sea trenches and sonar pings.',
        blurLevel: 2,
        overlayOpacity: 0.64,
        tags: ['Sci-Fi', 'Mystery', 'Horror'],
        isPublic: true,
      },
    ];

    for (const s of seeds) {
      await createSharedStage(s);
    }
  } catch (error) {
    console.error('ensureSeedStages failed:', error);
  }
}
