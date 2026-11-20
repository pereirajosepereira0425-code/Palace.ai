import { db } from './index.ts';
import { chatSessions, chatMessages, characters } from './schema.ts';
import { desc, eq, and, asc, sql, inArray } from 'drizzle-orm';
import { incrementChatCount } from './characters.ts';
import { applyEditedSwipe } from '../utils/customVoiceUtils.ts';
import { computeCascadeMessageDeletion } from '../utils/chatMemoryUtils.ts';

export async function getOrCreateSession(characterUuid: string, userId: string = 'guest') {
  try {
    const char = await db.select().from(characters).where(eq(characters.uuid, characterUuid)).limit(1);
    if (!char[0]) throw new Error('Character not found');

    const character = char[0];

    // Find latest active session for this user and character
    const existing = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.characterId, character.id), eq(chatSessions.userId, userId)))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(1);

    if (existing[0]) {
      return { session: existing[0], character };
    }

    // Create new session
    const sessionUuid = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    const newSessions = await db.insert(chatSessions).values({
      uuid: sessionUuid,
      userId,
      characterId: character.id,
      title: `Chat with ${character.name}`,
      modelPreference: character.thinkingDefault ? 'gemini-4-argon' : 'gemini-3.8-flash',
      thinkingLevel: character.thinkingDefault ? 'HIGH' : 'OFF',
      searchGrounding: character.searchDefault,
    }).returning();

    const session = newSessions[0];

    // Pre-populate with character greeting
    await db.insert(chatMessages).values({
      sessionId: session.uuid,
      sender: 'character',
      content: character.greeting,
      swipes: JSON.stringify([character.greeting]),
      activeSwipeIndex: 0,
    });

    await incrementChatCount(character.id);

    return { session, character };
  } catch (error) {
    console.error('getOrCreateSession failed:', error);
    throw new Error('Failed to load chat session', { cause: error });
  }
}

export async function getSessionDetails(sessionUuid: string) {
  try {
    const sess = await db.select().from(chatSessions).where(eq(chatSessions.uuid, sessionUuid)).limit(1);
    if (!sess[0]) return null;

    const session = sess[0];
    const char = await db.select().from(characters).where(eq(characters.id, session.characterId)).limit(1);

    const messages = await db.select().from(chatMessages)
      .where(eq(chatMessages.sessionId, session.uuid))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

    return {
      session,
      character: char[0] || null,
      messages: messages.map(m => {
        let swipesList: string[] = [];
        try {
          swipesList = JSON.parse(m.swipes || '[]');
        } catch {
          swipesList = [m.content];
        }
        if (!swipesList.length) swipesList = [m.content];

        let sources = [];
        try {
          sources = JSON.parse(m.groundingSources || '[]');
        } catch {
          sources = [];
        }

        return {
          id: m.id,
          sender: m.sender,
          content: m.content,
          thinkingProcess: m.thinkingProcess,
          groundingSources: sources,
          swipes: swipesList,
          activeSwipeIndex: m.activeSwipeIndex || 0,
          imageUrl: m.imageUrl,
          poseName: m.poseName,
          speakerCharacterUuid: m.speakerCharacterUuid,
          speakerName: m.speakerName,
          speakerAvatar: m.speakerAvatar,
          modelUsed: m.modelUsed,
          createdAt: m.createdAt,
        };
      }),
    };
  } catch (error) {
    console.error('getSessionDetails failed:', error);
    throw new Error('Failed to get session details', { cause: error });
  }
}

export async function getUserSessions(userId: string) {
  try {
    const list = await db.select({
      session: chatSessions,
      character: characters,
    })
      .from(chatSessions)
      .innerJoin(characters, eq(chatSessions.characterId, characters.id))
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt))
      .limit(30);

    return list.map(item => ({
      ...item.session,
      character: item.character,
    }));
  } catch (error) {
    console.error('getUserSessions failed:', error);
    return [];
  }
}

export async function createNewSession(characterUuid: string, userId: string = 'guest', greetingOverride?: string) {
  try {
    const char = await db.select().from(characters).where(eq(characters.uuid, characterUuid)).limit(1);
    if (!char[0]) throw new Error('Character not found');

    const character = char[0];
    const sessionUuid = 'sess_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    
    // Count existing sessions for title numbering
    const countList = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.characterId, character.id), eq(chatSessions.userId, userId)));
    const sessionNum = countList.length + 1;

    const newSessions = await db.insert(chatSessions).values({
      uuid: sessionUuid,
      userId,
      characterId: character.id,
      title: `Chat ${sessionNum} with ${character.name}`,
      modelPreference: character.thinkingDefault ? 'gemini-4-argon' : 'gemini-3.8-flash',
      thinkingLevel: character.thinkingDefault ? 'HIGH' : 'OFF',
      searchGrounding: character.searchDefault,
      summary: '',
      unsavedMessageCount: 0,
      chatSettings: '{}',
    }).returning();

    const session = newSessions[0];
    const initialGreeting = greetingOverride || character.greeting;

    // Pre-populate with character greeting
    await db.insert(chatMessages).values({
      sessionId: session.uuid,
      sender: 'character',
      content: initialGreeting,
      swipes: JSON.stringify([initialGreeting]),
      activeSwipeIndex: 0,
    });

    await incrementChatCount(character.id);

    return { session, character };
  } catch (error) {
    console.error('createNewSession failed:', error);
    throw new Error('Failed to create new chat session', { cause: error });
  }
}

export async function getAllCharacterSessions(characterUuid: string, userId: string = 'guest') {
  try {
    const char = await db.select().from(characters).where(eq(characters.uuid, characterUuid)).limit(1);
    if (!char[0]) return [];

    const list = await db.select().from(chatSessions)
      .where(and(eq(chatSessions.characterId, char[0].id), eq(chatSessions.userId, userId)))
      .orderBy(desc(chatSessions.updatedAt));

    return list;
  } catch (error) {
    console.error('getAllCharacterSessions failed:', error);
    return [];
  }
}

export async function updateSessionSummary(sessionUuid: string, summary: string) {
  try {
    const res = await db.update(chatSessions)
      .set({
        summary,
        unsavedMessageCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.uuid, sessionUuid))
      .returning();
    return res[0];
  } catch (error) {
    console.error('updateSessionSummary failed:', error);
    throw new Error('Failed to update summary', { cause: error });
  }
}

export async function addChatMessage(params: {
  sessionId: string;
  sender: 'user' | 'character' | 'system';
  content: string;
  parentId?: number | null;
  thinkingProcess?: string;
  groundingSources?: string;
  swipes?: string;
  imageUrl?: string | null;
  poseName?: string | null;
  speakerCharacterUuid?: string | null;
  speakerName?: string | null;
  speakerAvatar?: string | null;
  modelUsed?: string | null;
}) {
  try {
    const res = await db.insert(chatMessages).values({
      sessionId: params.sessionId,
      sender: params.sender,
      parentId: params.parentId || null,
      content: params.content,
      thinkingProcess: params.thinkingProcess || null,
      groundingSources: params.groundingSources || null,
      swipes: params.swipes || JSON.stringify([params.content]),
      activeSwipeIndex: 0,
      imageUrl: params.imageUrl || null,
      poseName: params.poseName || null,
      speakerCharacterUuid: params.speakerCharacterUuid || null,
      speakerName: params.speakerName || null,
      speakerAvatar: params.speakerAvatar || null,
      modelUsed: params.modelUsed || null,
    }).returning();

    // Increment unsaved messages counter for chat summarization tracking
    await db.update(chatSessions)
      .set({
        updatedAt: new Date(),
        unsavedMessageCount: sql`${chatSessions.unsavedMessageCount} + 1`,
      })
      .where(eq(chatSessions.uuid, params.sessionId));

    return res[0];
  } catch (error) {
    console.error('addChatMessage failed:', error);
    throw new Error('Failed to save message', { cause: error });
  }
}

export async function updateMessageSwipe(messageId: number, swipes: string[], activeSwipeIndex: number) {
  try {
    const activeContent = swipes[activeSwipeIndex] || swipes[0] || '';
    const res = await db.update(chatMessages)
      .set({
        swipes: JSON.stringify(swipes),
        activeSwipeIndex,
        content: activeContent,
      })
      .where(eq(chatMessages.id, messageId))
      .returning();

    return res[0];
  } catch (error) {
    console.error('updateMessageSwipe failed:', error);
    throw new Error('Failed to update swipe', { cause: error });
  }
}

export async function updateSessionSettings(sessionUuid: string, settings: {
  modelPreference?: string;
  thinkingLevel?: string;
  searchGrounding?: boolean;
  userPersona?: string;
  chatSettings?: string;
  showAiImages?: boolean;
}) {
  try {
    const res = await db.update(chatSessions)
      .set(settings)
      .where(eq(chatSessions.uuid, sessionUuid))
      .returning();
    return res[0];
  } catch (error) {
    console.error('updateSessionSettings failed:', error);
    throw new Error('Failed to update session settings', { cause: error });
  }
}

export async function deleteSession(sessionUuid: string) {
  try {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionUuid));
    await db.delete(chatSessions).where(eq(chatSessions.uuid, sessionUuid));
    return { success: true };
  } catch (error) {
    console.error('deleteSession failed:', error);
    throw new Error('Failed to delete session', { cause: error });
  }
}

export async function updateChatMessageContent(
  messageId: number,
  sessionUuid: string,
  newContent: string
) {
  try {
    const existingList = await db
      .select()
      .from(chatMessages)
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.sessionId, sessionUuid)))
      .limit(1);

    const existing = existingList[0];
    if (!existing) return null;

    const applied = applyEditedSwipe({
      swipesJsonOrArray: existing.swipes,
      activeSwipeIndex: existing.activeSwipeIndex,
      newContent,
    });

    const res = await db
      .update(chatMessages)
      .set({
        content: applied.content,
        swipes: applied.swipesJson,
        activeSwipeIndex: applied.activeSwipeIndex,
      })
      .where(eq(chatMessages.id, existing.id))
      .returning();

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.uuid, sessionUuid));

    const updated = res[0];
    return {
      ...updated,
      swipes: applied.swipes,
      activeSwipeIndex: applied.activeSwipeIndex,
    };
  } catch (error) {
    console.error('updateChatMessageContent failed:', error);
    throw new Error('Failed to update chat message', { cause: error });
  }
}

export async function resetSessionMessages(sessionUuid: string, characterGreeting: string) {
  try {
    await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionUuid));
    const inserted = await db
      .insert(chatMessages)
      .values({
        sessionId: sessionUuid,
        sender: 'character',
        content: characterGreeting,
        swipes: JSON.stringify([characterGreeting]),
        activeSwipeIndex: 0,
      })
      .returning();
    await db
      .update(chatSessions)
      .set({
        summary: '',
        unsavedMessageCount: 0,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.uuid, sessionUuid));
    return { success: true, message: inserted[0] || null };
  } catch (error) {
    console.error('resetSessionMessages failed:', error);
    throw new Error('Failed to reset messages', { cause: error });
  }
}

function formatMessageRow(m: typeof chatMessages.$inferSelect) {
  let swipesList: string[] = [];
  try {
    swipesList = JSON.parse(m.swipes || '[]');
  } catch {
    swipesList = [m.content];
  }
  if (!swipesList.length) swipesList = [m.content];

  let sources = [];
  try {
    sources = JSON.parse(m.groundingSources || '[]');
  } catch {
    sources = [];
  }

  return {
    id: m.id,
    sessionId: m.sessionId,
    sender: m.sender,
    content: m.content,
    thinkingProcess: m.thinkingProcess,
    groundingSources: sources,
    swipes: swipesList,
    activeSwipeIndex: m.activeSwipeIndex || 0,
    imageUrl: m.imageUrl,
    poseName: m.poseName,
    speakerCharacterUuid: m.speakerCharacterUuid,
    speakerName: m.speakerName,
    speakerAvatar: m.speakerAvatar,
    modelUsed: m.modelUsed,
    createdAt: m.createdAt,
  };
}

/**
 * Deletes a message and EVERY message after it (including user, character, and system messages)
 * from PostgreSQL and wipes affected long-term summary memory from the session so the AI
 * has zero memory of the deleted turns.
 */
export async function deleteMessagesFrom(params: {
  sessionUuid: string;
  messageId?: number | null;
  afterMessageId?: number | null;
}) {
  try {
    const sessRows = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.uuid, params.sessionUuid))
      .limit(1);
    const session = sessRows[0];
    if (!session) return null;

    const allMessages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, params.sessionUuid))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));

    let effectiveTargetId: number | null = null;
    if (typeof params.messageId === 'number' && Number.isFinite(params.messageId)) {
      const exact = allMessages.find((m) => m.id === params.messageId);
      if (exact) effectiveTargetId = exact.id;
    }

    if (
      effectiveTargetId === null &&
      typeof params.afterMessageId === 'number' &&
      Number.isFinite(params.afterMessageId)
    ) {
      const afterIdx = allMessages.findIndex((m) => m.id === params.afterMessageId);
      if (afterIdx >= 0 && afterIdx + 1 < allMessages.length) {
        effectiveTargetId = allMessages[afterIdx + 1].id;
      }
    }

    const cascade =
      effectiveTargetId !== null
        ? computeCascadeMessageDeletion({
            messages: allMessages,
            targetMessageId: effectiveTargetId,
            summary: session.summary,
            unsavedCount: session.unsavedMessageCount,
          })
        : {
            found: false,
            targetIndex: -1,
            remainingMessages: allMessages,
            deletedMessages: [],
            deletedIds: [] as number[],
            deletedCount: 0,
            removedSystemCount: 0,
            summary: session.summary || '',
            unsavedCount: Math.max(0, Number(session.unsavedMessageCount || 0)),
          };

    if (cascade.deletedIds.length > 0) {
      await db
        .delete(chatMessages)
        .where(
          and(
            eq(chatMessages.sessionId, params.sessionUuid),
            inArray(chatMessages.id, cascade.deletedIds)
          )
        );

      await db
        .update(chatSessions)
        .set({
          summary: cascade.summary,
          unsavedMessageCount: cascade.unsavedCount,
          updatedAt: new Date(),
        })
        .where(eq(chatSessions.uuid, params.sessionUuid));
    }

    return {
      remainingMessages: cascade.remainingMessages.map(formatMessageRow),
      deletedIds: cascade.deletedIds,
      deletedCount: cascade.deletedCount,
      removedSystemCount: cascade.removedSystemCount,
      summary: cascade.summary,
      unsavedMessageCount: cascade.unsavedCount,
    };
  } catch (error) {
    console.error('deleteMessagesFrom failed:', error);
    throw new Error('Failed to delete messages', { cause: error });
  }
}
