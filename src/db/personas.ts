import { db } from './index.ts';
import { personas } from './schema.ts';
import { desc, eq, and, inArray, sql } from 'drizzle-orm';
import type { SharedPersona } from '../types/index.ts';
import { isOwnedByRequester, type RequesterIdentity } from '../utils/ownership.ts';
import { mergeCharacterLoreEntries } from '../utils/communityUtils.ts';

export async function getPublicPersonas(options: {
  search?: string;
  sort?: 'popular' | 'latest' | 'used';
  limit?: number;
  offset?: number;
}) {
  try {
    const { search, sort = 'popular', limit = 40, offset = 0 } = options;
    let query = db.select().from(personas).$dynamic();
    const conditions = [eq(personas.isPublic, true)];

    if (search) {
      conditions.push(
        sql`(${personas.name} ILIKE ${'%' + search + '%'} OR ${personas.bio} ILIKE ${'%' + search + '%'})`
      );
    }

    query = query.where(and(...conditions));

    if (sort === 'popular') {
      query = query.orderBy(desc(personas.likeCount), desc(personas.useCount));
    } else if (sort === 'used') {
      query = query.orderBy(desc(personas.useCount));
    } else {
      query = query.orderBy(desc(personas.createdAt));
    }

    return await query.limit(limit).offset(offset);
  } catch (error) {
    console.error('getPublicPersonas failed:', error);
    return [];
  }
}

export async function getUserPersonas(userIds: string | string[]) {
  try {
    const idList = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
    if (idList.length === 0) return [];
    return await db
      .select()
      .from(personas)
      .where(inArray(personas.userId, idList))
      .orderBy(desc(personas.createdAt));
  } catch (error) {
    console.error('getUserPersonas failed:', error);
    return [];
  }
}

export async function createSharedPersona(data: {
  userId: string;
  creatorName: string;
  name: string;
  displayName?: string;
  avatar?: string;
  backgroundImage?: string;
  bio: string;
  gender?: string;
  pronouns?: string;
  description?: string;
  personality?: string;
  greeting?: string;
  alternateGreetings?: string[];
  systemPrompt?: string;
  postHistoryInstructions?: string;
  scenario?: string;
  exampleDialogues?: string;
  creatorNotes?: string;
  lorebook?: Array<{ key: string; content: string }>;
  model3dUrl?: string;
  model3dPose?: string;
  isPublic?: boolean;
  tags?: string[];
}) {
  try {
    const uuid = 'pers_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const result = await db.insert(personas).values({
      uuid,
      userId: data.userId,
      creatorName: data.creatorName || 'Anonymous',
      name: data.name,
      displayName: data.displayName || data.name,
      avatar: data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      backgroundImage: data.backgroundImage || null,
      bio: data.bio,
      gender: data.gender || 'Non-Binary',
      pronouns: data.pronouns || 'They/Them',
      description: data.description || data.bio,
      personality: data.personality || '',
      greeting: data.greeting || '',
      alternateGreetings: JSON.stringify(data.alternateGreetings || []),
      systemPrompt: data.systemPrompt || '',
      postHistoryInstructions: data.postHistoryInstructions || '',
      scenario: data.scenario || '',
      exampleDialogues: data.exampleDialogues || '',
      creatorNotes: data.creatorNotes || '',
      lorebook: typeof data.lorebook === 'string' ? data.lorebook : JSON.stringify(data.lorebook || []),
      model3dUrl: data.model3dUrl || null,
      model3dPose: data.model3dPose || 'neutral',
      isPublic: data.isPublic ?? false,
      tags: JSON.stringify(data.tags || []),
    }).returning();
    return result[0];
  } catch (error) {
    console.error('createSharedPersona failed:', error);
    throw new Error('Failed to create persona', { cause: error });
  }
}

export async function updateSharedPersona(
  uuid: string,
  requester: string | RequesterIdentity,
  data: Partial<{
    name: string;
    displayName: string;
    avatar: string;
    backgroundImage: string;
    bio: string;
    gender: string;
    pronouns: string;
    description: string;
    personality: string;
    greeting: string;
    alternateGreetings: string[];
    systemPrompt: string;
    postHistoryInstructions: string;
    scenario: string;
    exampleDialogues: string;
    creatorNotes: string;
    lorebook: Array<{ key: string; content: string }>;
    model3dUrl: string;
    model3dPose: string;
    isPublic: boolean;
    tags: string[];
  }>
) {
  try {
    const existingList = await db.select().from(personas).where(eq(personas.uuid, uuid)).limit(1);
    const existing = existingList[0];
    if (!existing) return null;

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      throw new Error('FORBIDDEN');
    }

    const updatePayload: any = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.displayName !== undefined) updatePayload.displayName = data.displayName;
    if (data.avatar !== undefined) updatePayload.avatar = data.avatar;
    if (data.backgroundImage !== undefined) updatePayload.backgroundImage = data.backgroundImage;
    if (data.bio !== undefined) updatePayload.bio = data.bio;
    if (data.gender !== undefined) updatePayload.gender = data.gender;
    if (data.pronouns !== undefined) updatePayload.pronouns = data.pronouns;
    if (data.description !== undefined) updatePayload.description = data.description;
    if (data.personality !== undefined) updatePayload.personality = data.personality;
    if (data.greeting !== undefined) updatePayload.greeting = data.greeting;
    if (data.alternateGreetings !== undefined) updatePayload.alternateGreetings = JSON.stringify(data.alternateGreetings);
    if (data.systemPrompt !== undefined) updatePayload.systemPrompt = data.systemPrompt;
    if (data.postHistoryInstructions !== undefined) updatePayload.postHistoryInstructions = data.postHistoryInstructions;
    if (data.scenario !== undefined) updatePayload.scenario = data.scenario;
    if (data.exampleDialogues !== undefined) updatePayload.exampleDialogues = data.exampleDialogues;
    if (data.creatorNotes !== undefined) updatePayload.creatorNotes = data.creatorNotes;
    if (data.lorebook !== undefined) {
      updatePayload.lorebook =
        typeof data.lorebook === 'string' ? data.lorebook : JSON.stringify(data.lorebook);
    }
    if (data.model3dUrl !== undefined) updatePayload.model3dUrl = data.model3dUrl;
    if (data.model3dPose !== undefined) updatePayload.model3dPose = data.model3dPose;
    if (data.isPublic !== undefined) updatePayload.isPublic = data.isPublic;
    if (data.tags !== undefined) {
      updatePayload.tags = typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags);
    }

    const result = await db
      .update(personas)
      .set(updatePayload)
      .where(eq(personas.id, existing.id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('updateSharedPersona failed:', error);
    throw error;
  }
}

export async function attachPersonaLorebook(
  uuid: string,
  requester: string | RequesterIdentity,
  incomingEntries: unknown,
  mode: 'merge' | 'replace' = 'merge'
) {
  try {
    const existingList = await db.select().from(personas).where(eq(personas.uuid, uuid)).limit(1);
    const existing = existingList[0];
    if (!existing) return { status: 'not_found' as const };

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      return { status: 'forbidden' as const };
    }

    const baseEntries = mode === 'replace' ? [] : mergeCharacterLoreEntries([], existing.lorebook).entries;
    const merged = mergeCharacterLoreEntries(baseEntries, incomingEntries);

    const updated = await db
      .update(personas)
      .set({ lorebook: JSON.stringify(merged.entries) })
      .where(eq(personas.id, existing.id))
      .returning();

    return {
      status: 'ok' as const,
      persona: updated[0],
      addedCount: merged.addedCount,
      totalEntries: merged.entries.length,
    };
  } catch (error) {
    console.error('attachPersonaLorebook failed:', error);
    throw new Error('Failed to attach lorebook to persona', { cause: error });
  }
}

export async function deleteSharedPersona(uuid: string, requester: string | RequesterIdentity) {
  try {
    const existingList = await db.select().from(personas).where(eq(personas.uuid, uuid)).limit(1);
    const existing = existingList[0];
    if (!existing) return { success: false, notFound: true };

    const identity: RequesterIdentity =
      typeof requester === 'string' ? { userUid: requester, guestId: requester } : requester;
    if (!isOwnedByRequester(existing.userId, identity)) {
      throw new Error('FORBIDDEN');
    }

    await db.delete(personas).where(eq(personas.id, existing.id));
    return { success: true };
  } catch (error) {
    console.error('deleteSharedPersona failed:', error);
    throw error;
  }
}

export async function toggleLikePersona(personaId: number) {
  try {
    const updated = await db.update(personas)
      .set({ likeCount: sql`${personas.likeCount} + 1` })
      .where(eq(personas.id, personaId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('toggleLikePersona failed:', error);
  }
}

export async function incrementPersonaUse(personaId: number) {
  try {
    await db.update(personas)
      .set({ useCount: sql`${personas.useCount} + 1` })
      .where(eq(personas.id, personaId));
  } catch (error) {
    console.error('incrementPersonaUse failed:', error);
  }
}

export async function ensureSeedPersonas() {
  try {
    const existing = await db.select({ count: sql<number>`count(*)` }).from(personas);
    if (Number(existing[0]?.count || 0) > 0) return;

    const seedList = [
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Vance Sterling',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
        bio: '28, He/Him. Cybernetically enhanced bounty tracker from the lower rim. Sharp senses, leather duster coat, dry humor.',
        pronouns: 'He/Him',
        isPublic: true,
        tags: ['Cyberpunk', 'Bounty Hunter', 'Mercenary'],
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Lyra Shadowsong',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bio: '22, She/Her. Elven rogue and cartographer. Wears twilight silk cloak, carries dual curved daggers and ancient starmaps.',
        pronouns: 'She/Her',
        isPublic: true,
        tags: ['Fantasy', 'Rogue', 'Elf'],
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Rowan Ashford',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
        bio: '31, He/They. Disgraced court alchemist and scholar of forbidden runes. Wears amber spectacles and ink-stained cuffs.',
        pronouns: 'He/They',
        isPublic: true,
        tags: ['Scholar', 'Mage', 'Mystery'],
      },
      {
        userId: 'system',
        creatorName: 'PalaceCurator',
        name: 'Kira Tanaka',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
        bio: '19, She/Her. Kendo practitioner and spirited transfer student. Athletic, earnest, protective of companions.',
        pronouns: 'She/Her',
        isPublic: true,
        tags: ['Anime', 'Student', 'Slice of Life'],
      },
    ];

    for (const p of seedList) {
      await createSharedPersona(p);
    }
  } catch (error) {
    console.error('ensureSeedPersonas failed:', error);
  }
}
