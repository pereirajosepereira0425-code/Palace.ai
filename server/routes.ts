import express from 'express';
import fs from 'fs';
import path from 'path';
import { optionalAuth, requireAuth, type AuthRequest } from '../src/middleware/auth.ts';
import { createZipBuffer } from '../src/utils/zipBuilder.ts';
import {
  getCharacters,
  getCharacterByUuid,
  getUserCharacters,
  createCharacter,
  updateCharacter,
  attachCharacterLorebook,
  deleteCharacter,
  toggleLike,
  getUserLikedIds,
  ensureSeedCharacters,
} from '../src/db/characters.ts';
import {
  getOrCreateSession,
  createNewSession,
  getAllCharacterSessions,
  getSessionDetails,
  getUserSessions,
  addChatMessage,
  updateMessageSwipe,
  updateChatMessageContent,
  updateSessionSettings,
  updateSessionSummary,
  deleteSession,
  resetSessionMessages,
} from '../src/db/chats.ts';
import {
  getCustomVoices,
  getCustomVoiceByUuid,
  createCustomVoice,
  deleteCustomVoice,
  incrementCustomVoiceUseCount,
} from '../src/db/voices.ts';
import { validateCustomVoiceInput } from '../src/utils/customVoiceUtils.ts';
import {
  getOrCreateUser,
  getUserProfile,
  updateUserPersona,
  updateUserProfile,
  isUsernameAvailable,
  getUserByUsername,
  getUserFollowSummary,
  toggleUserFollow,
} from '../src/db/users.ts';
import {
  getPublicPersonas,
  getUserPersonas,
  createSharedPersona,
  updateSharedPersona,
  attachPersonaLorebook,
  deleteSharedPersona,
  toggleLikePersona,
  incrementPersonaUse,
  ensureSeedPersonas,
} from '../src/db/personas.ts';
import {
  getPublicStages,
  getUserStages,
  createSharedStage,
  updateSharedStage,
  deleteSharedStage,
  toggleLikeStage,
  incrementStageUse,
  ensureSeedStages,
} from '../src/db/stages.ts';
import {
  getPublicLorebooks,
  getUserLorebooks,
  createSharedLorebook,
  updateSharedLorebook,
  deleteSharedLorebook,
  toggleLikeLorebook,
  incrementLorebookUse,
  ensureSeedLorebooks,
} from '../src/db/lorebooks.ts';
import {
  generateCharacterReply,
  generateMultiModelCharacterReply,
  generateSpeechTTS,
  generatePersonaReaction,
  generateChatSummary,
  testExternalApiConnection,
} from '../src/services/aiService.ts';
import { importCharacterFromUrl, UrlImportError } from './urlImporter.ts';
import { ensureSeedTags, getTags, upsertTags } from '../src/db/tags.ts';
import { parsePageParams, slicePaginatedRows } from '../src/utils/viewportUnload.ts';
import { mergeGlobalActiveLorebook } from '../src/utils/communityUtils.ts';
import {
  buildBrawlSystemPrompt,
  selectRespondingCharacters,
  toGroupParticipant,
} from '../src/utils/chatOrchestration.ts';
import type { GroupParticipant } from '../src/types/index.ts';

export const apiRouter = express.Router();

// Ensure initial seed characters, personas, stages, lorebooks, and tags exist on server start
ensureSeedCharacters().catch(console.error);
ensureSeedPersonas().catch(console.error);
ensureSeedStages().catch(console.error);
ensureSeedLorebooks().catch(console.error);
ensureSeedTags().catch(console.error);

// ----------------- TAGS (CHUB.AI DYNAMIC TAXONOMY) -----------------
apiRouter.get('/tags', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const { limit, offset } = parsePageParams({
      limitParam: req.query.limit,
      offsetParam: req.query.offset,
      defaultLimit: 120,
      maxLimit: 300,
    });
    const rows = await getTags({ search, limit: limit + 1, offset });
    const { items, hasMore, nextOffset } = slicePaginatedRows(rows, limit, offset);
    res.json({ tags: items, hasMore, nextOffset });
  } catch (error: any) {
    console.error('Failed to get tags:', error);
    res.status(500).json({ error: error.message || 'Failed to load tags' });
  }
});

apiRouter.post('/tags', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const rawTags: string[] = Array.isArray(req.body.tags)
      ? req.body.tags
      : typeof req.body.tag === 'string'
      ? [req.body.tag]
      : [];

    if (rawTags.length === 0) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const createdBy = req.user?.uid || req.body.guestId || 'guest';
    const incrementUsage = req.body.incrementUsage !== false;
    const saved = await upsertTags(rawTags, createdBy, incrementUsage);
    res.json({ tags: saved });
  } catch (error: any) {
    console.error('Failed to save tags:', error);
    res.status(500).json({ error: error.message || 'Failed to save tags' });
  }
});

// ----------------- CHARACTERS -----------------
apiRouter.get('/characters', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { search, tag, rating, sort } = req.query;
    const { limit, offset } = parsePageParams({
      limitParam: req.query.limit,
      offsetParam: req.query.offset,
      defaultLimit: 24,
      maxLimit: 100,
    });
    const rows = await getCharacters({
      search: typeof search === 'string' ? search : undefined,
      tag: typeof tag === 'string' ? tag : undefined,
      rating: typeof rating === 'string' ? rating : undefined,
      sort: sort === 'latest' || sort === 'chats' || sort === 'popular' ? sort : 'popular',
      limit: limit + 1,
      offset,
    });
    const { items: characters, hasMore, nextOffset } = slicePaginatedRows(rows, limit, offset);

    let likedIds: number[] = [];
    if (req.user?.uid) {
      likedIds = await getUserLikedIds(req.user.uid);
    }

    res.json({ characters, likedIds, hasMore, nextOffset });
  } catch (error: any) {
    console.error('Failed to get characters:', error);
    res.status(500).json({ error: error.message || 'Failed to get characters' });
  }
});

apiRouter.get('/characters/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = (req.query.guestId as string) || '';
    const ids = Array.from(new Set([req.user?.uid || '', guestId, 'guest'].filter(Boolean)));
    const list = await getUserCharacters(ids);
    res.json({ characters: list });
  } catch (error: any) {
    console.error('Failed to get user characters:', error);
    res.status(500).json({ error: error.message || 'Failed to get user characters' });
  }
});

apiRouter.get('/characters/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const char = await getCharacterByUuid(req.params.uuid);
    if (!char) return res.status(404).json({ error: 'Character not found' });

    let isLiked = false;
    if (req.user?.uid) {
      const likedIds = await getUserLikedIds(req.user.uid);
      isLiked = likedIds.includes(char.id);
    }

    res.json({ character: char, isLiked });
  } catch (error: any) {
    console.error('Failed to get character:', error);
    res.status(500).json({ error: error.message || 'Failed to get character' });
  }
});

apiRouter.post('/characters', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.tagline || !body.greeting) {
      return res.status(400).json({ error: 'Name, tagline, and greeting are required' });
    }

    const uuid = 'char_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const validRating = ['SFW', 'NSFW', 'NSFL', 'NSFW + NSFL'].includes(body.rating)
      ? body.rating
      : 'SFW';

    const newChar = await createCharacter({
      uuid,
      name: body.name,
      tagline: body.tagline,
      avatar: body.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      backgroundImage: body.backgroundImage || '',
      description: body.description || body.tagline,
      personality: body.personality || '',
      greeting: body.greeting,
      alternateGreetings: typeof body.alternateGreetings === 'string'
        ? body.alternateGreetings
        : JSON.stringify(body.alternateGreetings || []),
      systemPrompt: body.systemPrompt || `You are ${body.name}. Stay in character.`,
      postHistoryInstructions: body.postHistoryInstructions || '',
      creatorNotes: body.creatorNotes || '',
      characterVersion: body.characterVersion || '1.0',
      scenario: body.scenario || '',
      exampleDialogues: body.exampleDialogues || '',
      tags: typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags || []),
      rating: validRating,
      creatorId: req.user?.uid || body.guestId || 'guest',
      creatorName: req.user?.name || req.user?.email?.split('@')[0] || body.creatorName || 'Anonymous',
      voiceName: body.voiceName || 'Puck',
      voiceStyle: body.voiceStyle || 'Expressive, natural character dialogue',
      customVoiceUuid: body.customVoiceUuid || null,
      thinkingDefault: Boolean(body.thinkingDefault),
      searchDefault: Boolean(body.searchDefault),
      lorebook: typeof body.lorebook === 'string' ? body.lorebook : JSON.stringify(body.lorebook || []),
      gender: body.gender || 'Unknown',
      pronouns: body.pronouns || 'They/Them',
      model3dUrl: body.model3dUrl || null,
      model3dPose: body.model3dPose || 'neutral',
    });

    // Save any custom or preset tags to the global Chub.ai tag database
    try {
      const parsedTags: string[] = Array.isArray(body.tags)
        ? body.tags
        : typeof body.tags === 'string'
        ? JSON.parse(body.tags)
        : [];
      if (parsedTags.length > 0) {
        await upsertTags(parsedTags, req.user?.uid || body.guestId || 'guest', true);
      }
    } catch (tagErr) {
      console.warn('Tag sync on character create failed:', tagErr);
    }

    res.json({ character: newChar });
  } catch (error: any) {
    console.error('Failed to create character:', error);
    res.status(500).json({ error: error.message || 'Failed to create character' });
  }
});

apiRouter.put('/characters/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    if (!body.name || !body.tagline || !body.greeting) {
      return res.status(400).json({ error: 'Name, tagline, and greeting are required' });
    }

    const validRating = ['SFW', 'NSFW', 'NSFL', 'NSFW + NSFL'].includes(body.rating)
      ? body.rating
      : undefined;

    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof body.guestId === 'string' && body.guestId) || null,
    };

    const result = await updateCharacter(req.params.uuid, requester, {
      name: body.name,
      tagline: body.tagline,
      avatar: body.avatar,
      backgroundImage: body.backgroundImage,
      description: body.description,
      personality: body.personality,
      greeting: body.greeting,
      alternateGreetings:
        body.alternateGreetings !== undefined
          ? typeof body.alternateGreetings === 'string'
            ? body.alternateGreetings
            : JSON.stringify(body.alternateGreetings || [])
          : undefined,
      systemPrompt: body.systemPrompt,
      postHistoryInstructions: body.postHistoryInstructions,
      creatorNotes: body.creatorNotes,
      characterVersion: body.characterVersion,
      scenario: body.scenario,
      exampleDialogues: body.exampleDialogues,
      tags:
        body.tags !== undefined
          ? typeof body.tags === 'string'
            ? body.tags
            : JSON.stringify(body.tags || [])
          : undefined,
      rating: validRating,
      voiceName: body.voiceName,
      voiceStyle: body.voiceStyle,
      customVoiceUuid: body.customVoiceUuid,
      thinkingDefault: body.thinkingDefault !== undefined ? Boolean(body.thinkingDefault) : undefined,
      searchDefault: body.searchDefault !== undefined ? Boolean(body.searchDefault) : undefined,
      lorebook:
        body.lorebook !== undefined
          ? typeof body.lorebook === 'string'
            ? body.lorebook
            : JSON.stringify(body.lorebook || [])
          : undefined,
      gender: body.gender,
      pronouns: body.pronouns,
      model3dUrl: body.model3dUrl,
      model3dPose: body.model3dPose,
    });

    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Character not found' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'You can only edit characters you created' });
    }

    try {
      const parsedTags: string[] = Array.isArray(body.tags)
        ? body.tags
        : typeof body.tags === 'string'
        ? JSON.parse(body.tags)
        : [];
      if (parsedTags.length > 0) {
        await upsertTags(parsedTags, req.user?.uid || requester.guestId || 'guest', false);
      }
    } catch (tagErr) {
      console.warn('Tag sync on character update failed:', tagErr);
    }

    res.json({ character: result.character });
  } catch (error: any) {
    console.error('Failed to update character:', error);
    res.status(500).json({ error: error.message || 'Failed to update character' });
  }
});

apiRouter.patch('/characters/:uuid/lorebook', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof req.body?.guestId === 'string' && req.body.guestId) || null,
    };
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const result = await attachCharacterLorebook(
      req.params.uuid,
      requester,
      req.body?.entries ?? req.body?.lorebook ?? [],
      mode
    );
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Character not found' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'You can only modify characters you created' });
    }
    res.json({
      character: result.character,
      addedCount: result.addedCount,
      totalEntries: result.totalEntries,
    });
  } catch (error: any) {
    console.error('Failed to attach character lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to attach lorebook to character' });
  }
});

apiRouter.delete('/characters/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId:
        (typeof req.query.guestId === 'string' && req.query.guestId) ||
        (typeof req.body?.guestId === 'string' && req.body.guestId) ||
        null,
    };

    const result = await deleteCharacter(req.params.uuid, requester);
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Character not found' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'You can only delete characters you created' });
    }

    res.json({ success: true, uuid: req.params.uuid });
  } catch (error: any) {
    console.error('Failed to delete character:', error);
    res.status(500).json({ error: error.message || 'Failed to delete character' });
  }
});

// Import character from URL (Chub.ai, Janitor.ai, SpicyChat.ai, Fandom/Miraheze)
apiRouter.post('/characters/import-url', async (req, res) => {
  try {
    const { url, authToken, rawDefinition } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await importCharacterFromUrl(url, fetch, {
      authToken: typeof authToken === 'string' && authToken.trim() ? authToken.trim() : undefined,
      rawDefinition:
        typeof rawDefinition === 'string' && rawDefinition.trim() ? rawDefinition.trim() : undefined,
    });

    // Sync any newly discovered tags from the imported card into the global Chub.ai tag database
    if (Array.isArray(result.character.tags) && result.character.tags.length > 0) {
      upsertTags(result.character.tags, 'chub-import', false).catch((err) =>
        console.warn('Failed to sync imported tags:', err)
      );
    }

    return res.json(result);
  } catch (error: any) {
    if (error instanceof UrlImportError) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error('Failed to import from URL:', error);
    return res.status(500).json({ error: error.message || 'Failed to import character from URL' });
  }
});

apiRouter.post('/characters/:id/like', requireAuth, async (req: AuthRequest, res) => {
  try {
    const charId = parseInt(req.params.id, 10);
    const userId = req.user!.uid;
    const result = await toggleLike(charId, userId);
    res.json(result);
  } catch (error: any) {
    console.error('Failed to toggle like:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle like' });
  }
});

// ----------------- PERSONA SHARING SYSTEM -----------------
apiRouter.get('/personas', async (req, res) => {
  try {
    const { search, sort } = req.query;
    const { limit, offset } = parsePageParams({
      limitParam: req.query.limit,
      offsetParam: req.query.offset,
      defaultLimit: 24,
      maxLimit: 100,
    });
    const rows = await getPublicPersonas({
      search: typeof search === 'string' ? search : undefined,
      sort: sort === 'latest' || sort === 'used' || sort === 'popular' ? sort : 'popular',
      limit: limit + 1,
      offset,
    });
    const { items: list, hasMore, nextOffset } = slicePaginatedRows(rows, limit, offset);
    res.json({ personas: list, hasMore, nextOffset });
  } catch (error: any) {
    console.error('Failed to get public personas:', error);
    res.status(500).json({ error: error.message || 'Failed to get personas' });
  }
});

apiRouter.get('/personas/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = (req.query.guestId as string) || '';
    const ids = Array.from(new Set([req.user?.uid || '', guestId, 'guest'].filter(Boolean)));
    const list = await getUserPersonas(ids);
    res.json({ personas: list });
  } catch (error: any) {
    console.error('Failed to get user personas:', error);
    res.status(500).json({ error: error.message || 'Failed to get user personas' });
  }
});

apiRouter.post('/personas', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      displayName,
      bio,
      gender,
      pronouns,
      avatar,
      backgroundImage,
      description,
      personality,
      greeting,
      alternateGreetings,
      systemPrompt,
      postHistoryInstructions,
      scenario,
      exampleDialogues,
      creatorNotes,
      lorebook,
      model3dUrl,
      model3dPose,
      isPublic,
      tags,
    } = req.body;

    if (!name || !bio) {
      return res.status(400).json({ error: 'Persona Name and Bio are required' });
    }

    const userId = req.user?.uid || req.body.guestId || 'guest';
    const creatorName = req.user?.name || req.user?.email?.split('@')[0] || 'Community';

    const newPersona = await createSharedPersona({
      userId,
      creatorName,
      name,
      displayName,
      bio,
      gender: gender || 'Non-Binary',
      pronouns: pronouns || 'They/Them',
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      backgroundImage,
      description,
      personality,
      greeting,
      alternateGreetings: Array.isArray(alternateGreetings) ? alternateGreetings : [],
      systemPrompt,
      postHistoryInstructions,
      scenario,
      exampleDialogues,
      creatorNotes,
      lorebook: Array.isArray(lorebook) ? lorebook : [],
      model3dUrl,
      model3dPose,
      isPublic: Boolean(isPublic),
      tags: tags || [],
    });

    if (Array.isArray(tags) && tags.length > 0) {
      upsertTags(tags, userId, true).catch(console.warn);
    }

    res.json({ persona: newPersona });
  } catch (error: any) {
    console.error('Failed to create persona:', error);
    res.status(500).json({ error: error.message || 'Failed to create persona' });
  }
});

apiRouter.put('/personas/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof req.body.guestId === 'string' && req.body.guestId) || null,
    };
    const updated = await updateSharedPersona(req.params.uuid, requester, req.body);
    if (!updated) return res.status(404).json({ error: 'Persona not found' });
    if (Array.isArray(req.body.tags) && req.body.tags.length > 0) {
      upsertTags(req.body.tags, requester.userUid || requester.guestId || 'guest', false).catch(console.warn);
    }
    res.json({ persona: updated });
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only edit personas you created' });
    }
    console.error('Failed to update persona:', error);
    res.status(500).json({ error: error.message || 'Failed to update persona' });
  }
});

apiRouter.patch('/personas/:uuid/lorebook', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof req.body?.guestId === 'string' && req.body.guestId) || null,
    };
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
    const result = await attachPersonaLorebook(
      req.params.uuid,
      requester,
      req.body?.entries ?? req.body?.lorebook ?? [],
      mode
    );
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Persona not found' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'You can only modify personas you created' });
    }
    res.json({
      persona: result.persona,
      addedCount: result.addedCount,
      totalEntries: result.totalEntries,
    });
  } catch (error: any) {
    console.error('Failed to attach persona lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to attach lorebook to persona' });
  }
});

apiRouter.delete('/personas/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId:
        (typeof req.query.guestId === 'string' && req.query.guestId) ||
        (typeof req.body?.guestId === 'string' && req.body.guestId) ||
        null,
    };
    const result = await deleteSharedPersona(req.params.uuid, requester);
    if (result?.notFound) {
      return res.status(404).json({ error: 'Persona not found' });
    }
    res.json(result);
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only delete personas you created' });
    }
    console.error('Failed to delete persona:', error);
    res.status(500).json({ error: error.message || 'Failed to delete persona' });
  }
});

// AI Persona Suggestion / Auto-React
apiRouter.post('/persona/reaction', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { persona, characterName, lastMessage } = req.body;
    if (!persona || !characterName || !lastMessage) {
      return res.status(400).json({ error: 'persona, characterName, and lastMessage are required' });
    }

    const result = await generatePersonaReaction({
      persona,
      characterName,
      lastMessage,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Failed to generate persona reaction:', error);
    res.status(500).json({ error: error.message || 'Failed to generate persona reaction' });
  }
});

apiRouter.post('/personas/:id/like', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const updated = await toggleLikePersona(id);
    res.json({ persona: updated });
  } catch (error: any) {
    console.error('Failed to like persona:', error);
    res.status(500).json({ error: error.message || 'Failed to like persona' });
  }
});

apiRouter.post('/personas/:id/use', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await incrementPersonaUse(id);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to use persona:', error);
    res.status(500).json({ error: error.message || 'Failed to increment use' });
  }
});

// ----------------- USER PROFILE & PERSONA -----------------
apiRouter.post('/user/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { uid, email, name, picture } = req.user!;
    const user = await getOrCreateUser(uid, email || '', name, picture);
    res.json({ user });
  } catch (error: any) {
    console.error('Failed to sync user:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

apiRouter.get('/user/profile', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.uid) {
      const user = await getUserProfile(req.user.uid);
      return res.json({ user });
    }
    // Guest fallback profile
    res.json({
      user: {
        uid: 'guest',
        email: 'guest@palace.ai',
        username: 'guest_wanderer',
        displayName: 'Guest Wanderer',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
        bio: 'Explorer in the Palace multiverse.',
        pronouns: 'They/Them',
        gender: 'Unknown',
        theme: 'purple',
        statusMessage: 'Venturing through new realms 🌌',
        badges: JSON.stringify(['Palace Explorer', 'Guest']),
        socialLinks: JSON.stringify({}),
      },
    });
  } catch (error: any) {
    console.error('Failed to get user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to get profile' });
  }
});

apiRouter.put('/user/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const updated = await updateUserProfile(req.user!.uid, req.body);
    res.json({ user: updated });
  } catch (error: any) {
    console.error('Failed to update user profile:', error);
    res.status(400).json({ error: error.message || 'Failed to update profile' });
  }
});

apiRouter.get('/user/check-username', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const username = req.query.username as string;
    if (!username) return res.json({ available: false });
    const available = await isUsernameAvailable(username, req.user?.uid);
    res.json({ available, username: username.toLowerCase().trim().replace(/^@/, '') });
  } catch (error: any) {
    console.error('Check username failed:', error);
    res.status(500).json({ error: 'Failed to check username' });
  }
});

// ----------------- STAGE SHARING SYSTEM -----------------
apiRouter.get('/stages', async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    const { limit, offset } = parsePageParams({
      limitParam: req.query.limit,
      offsetParam: req.query.offset,
      defaultLimit: 24,
      maxLimit: 100,
    });
    const rows = await getPublicStages({
      search: typeof search === 'string' ? search : undefined,
      category: typeof category === 'string' ? category : undefined,
      sort: sort === 'latest' || sort === 'used' || sort === 'popular' ? sort : 'popular',
      limit: limit + 1,
      offset,
    });
    const { items: stages, hasMore, nextOffset } = slicePaginatedRows(rows, limit, offset);
    res.json({ stages, hasMore, nextOffset });
  } catch (error: any) {
    console.error('Failed to get shared stages:', error);
    res.status(500).json({ error: error.message || 'Failed to get stages' });
  }
});

apiRouter.get('/stages/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = (req.query.guestId as string) || '';
    const ids = Array.from(new Set([req.user?.uid || '', guestId, 'guest'].filter(Boolean)));
    const stages = await getUserStages(ids);
    res.json({ stages });
  } catch (error: any) {
    console.error('Failed to get user stages:', error);
    res.status(500).json({ error: error.message || 'Failed to get user stages' });
  }
});

apiRouter.post('/stages', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      category,
      imageUrl,
      description,
      blurLevel,
      overlayOpacity,
      tags,
      isPublic,
      creatorName: bodyCreatorName,
      guestId,
    } = req.body || {};

    if (!name || !imageUrl) {
      return res.status(400).json({ error: 'Stage name and image URL are required' });
    }

    const userId = req.user?.uid || guestId || 'guest';
    const syncedUser = req.user?.uid ? await getUserProfile(req.user.uid) : null;
    const creatorName =
      syncedUser?.username ||
      syncedUser?.displayName ||
      req.user?.name ||
      req.user?.email?.split('@')[0] ||
      bodyCreatorName ||
      'Community';

    const stage = await createSharedStage({
      userId,
      creatorName,
      name,
      category,
      imageUrl,
      description,
      blurLevel,
      overlayOpacity,
      tags,
      isPublic: isPublic ?? true,
    });

    if (Array.isArray(tags) && tags.length > 0) {
      upsertTags(tags, userId, true).catch(console.warn);
    }

    res.json({ stage });
  } catch (error: any) {
    console.error('Failed to create shared stage:', error);
    res.status(500).json({ error: error.message || 'Failed to share stage' });
  }
});

apiRouter.put('/stages/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof req.body?.guestId === 'string' && req.body.guestId) || null,
    };
    const updated = await updateSharedStage(req.params.uuid, requester, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Stage not found' });
    res.json({ stage: updated });
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only edit stages you created' });
    }
    console.error('Failed to update shared stage:', error);
    res.status(500).json({ error: error.message || 'Failed to update stage' });
  }
});

apiRouter.delete('/stages/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId:
        (typeof req.query.guestId === 'string' && req.query.guestId) ||
        (typeof req.body?.guestId === 'string' && req.body.guestId) ||
        null,
    };
    const result = await deleteSharedStage(req.params.uuid, requester);
    if (result.notFound) return res.status(404).json({ error: 'Stage not found' });
    res.json(result);
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only delete stages you created' });
    }
    console.error('Failed to delete shared stage:', error);
    res.status(500).json({ error: error.message || 'Failed to delete stage' });
  }
});

apiRouter.post('/stages/:uuid/like', async (req, res) => {
  try {
    const stage = await toggleLikeStage(req.params.uuid);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    res.json({ stage });
  } catch (error: any) {
    console.error('Failed to like stage:', error);
    res.status(500).json({ error: error.message || 'Failed to like stage' });
  }
});

apiRouter.post('/stages/:uuid/use', async (req, res) => {
  try {
    const stage = await incrementStageUse(req.params.uuid);
    if (!stage) return res.status(404).json({ error: 'Stage not found' });
    res.json({ stage });
  } catch (error: any) {
    console.error('Failed to track stage use:', error);
    res.status(500).json({ error: error.message || 'Failed to increment stage use' });
  }
});

// ----------------- LOREBOOK SHARING SYSTEM -----------------
apiRouter.get('/lorebooks', async (req, res) => {
  try {
    const { search, sort } = req.query;
    const { limit, offset } = parsePageParams({
      limitParam: req.query.limit,
      offsetParam: req.query.offset,
      defaultLimit: 24,
      maxLimit: 100,
    });
    const rows = await getPublicLorebooks({
      search: typeof search === 'string' ? search : undefined,
      sort: sort === 'latest' || sort === 'used' || sort === 'popular' ? sort : 'popular',
      limit: limit + 1,
      offset,
    });
    const { items: lorebooks, hasMore, nextOffset } = slicePaginatedRows(rows, limit, offset);
    res.json({ lorebooks, hasMore, nextOffset });
  } catch (error: any) {
    console.error('Failed to get shared lorebooks:', error);
    res.status(500).json({ error: error.message || 'Failed to get lorebooks' });
  }
});

apiRouter.get('/lorebooks/me', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = (req.query.guestId as string) || '';
    const ids = Array.from(new Set([req.user?.uid || '', guestId, 'guest'].filter(Boolean)));
    const lorebooks = await getUserLorebooks(ids);
    res.json({ lorebooks });
  } catch (error: any) {
    console.error('Failed to get user lorebooks:', error);
    res.status(500).json({ error: error.message || 'Failed to get user lorebooks' });
  }
});

apiRouter.post('/lorebooks', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      scanDepth,
      entries,
      tags,
      isPublic,
      creatorName: bodyCreatorName,
      guestId,
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'Lorebook name is required' });
    }

    const userId = req.user?.uid || guestId || 'guest';
    const syncedUser = req.user?.uid ? await getUserProfile(req.user.uid) : null;
    const creatorName =
      syncedUser?.username ||
      syncedUser?.displayName ||
      req.user?.name ||
      req.user?.email?.split('@')[0] ||
      bodyCreatorName ||
      'Community';

    const lorebook = await createSharedLorebook({
      userId,
      creatorName,
      name,
      description,
      scanDepth,
      entries: entries || [],
      tags,
      isPublic: isPublic ?? true,
    });

    if (Array.isArray(tags) && tags.length > 0) {
      upsertTags(tags, userId, true).catch(console.warn);
    }

    res.json({ lorebook });
  } catch (error: any) {
    console.error('Failed to create shared lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to share lorebook' });
  }
});

apiRouter.put('/lorebooks/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (typeof req.body?.guestId === 'string' && req.body.guestId) || null,
    };
    const updated = await updateSharedLorebook(req.params.uuid, requester, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Lorebook not found' });
    res.json({ lorebook: updated });
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only edit lorebooks you created' });
    }
    console.error('Failed to update shared lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to update lorebook' });
  }
});

apiRouter.delete('/lorebooks/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId:
        (typeof req.query.guestId === 'string' && req.query.guestId) ||
        (typeof req.body?.guestId === 'string' && req.body.guestId) ||
        null,
    };
    const result = await deleteSharedLorebook(req.params.uuid, requester);
    if (result.notFound) return res.status(404).json({ error: 'Lorebook not found' });
    res.json(result);
  } catch (error: any) {
    if (error?.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You can only delete lorebooks you created' });
    }
    console.error('Failed to delete shared lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to delete lorebook' });
  }
});

apiRouter.post('/lorebooks/:uuid/like', async (req, res) => {
  try {
    const lorebook = await toggleLikeLorebook(req.params.uuid);
    if (!lorebook) return res.status(404).json({ error: 'Lorebook not found' });
    res.json({ lorebook });
  } catch (error: any) {
    console.error('Failed to like lorebook:', error);
    res.status(500).json({ error: error.message || 'Failed to like lorebook' });
  }
});

apiRouter.post('/lorebooks/:uuid/use', async (req, res) => {
  try {
    const lorebook = await incrementLorebookUse(req.params.uuid);
    if (!lorebook) return res.status(404).json({ error: 'Lorebook not found' });
    res.json({ lorebook });
  } catch (error: any) {
    console.error('Failed to track lorebook use:', error);
    res.status(500).json({ error: error.message || 'Failed to increment lorebook use' });
  }
});

// Public Chub User Profile endpoint (e.g. https://chub.ai/users/biguswigus)
apiRouter.get('/users/:username', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = typeof req.query.guestId === 'string' ? req.query.guestId : '';
    const viewerIds = [req.user?.uid || '', guestId].filter(Boolean);
    const data = await getUserByUsername(req.params.username, viewerIds);
    if (!data) {
      return res.status(404).json({ error: `User @${req.params.username} not found` });
    }
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get public user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to get user profile' });
  }
});

// Follower & Following Graph endpoints
apiRouter.get('/users/:targetUid/follows', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const guestId = typeof req.query.guestId === 'string' ? req.query.guestId : '';
    const viewerIds = [req.user?.uid || '', guestId].filter(Boolean);
    const summary = await getUserFollowSummary(req.params.targetUid, viewerIds);
    res.json(summary);
  } catch (error: any) {
    console.error('Failed to get user follow summary:', error);
    res.status(500).json({ error: error.message || 'Failed to load followers' });
  }
});

apiRouter.post('/users/:targetUid/follow', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const targetUid = req.params.targetUid;
    const guestId = typeof req.body?.guestId === 'string' ? req.body.guestId.trim() : '';
    const followerId = req.user?.uid || guestId;
    if (!followerId) {
      return res.status(400).json({ error: 'Follower identity is required' });
    }

    const syncedFollower = req.user?.uid ? await getUserProfile(req.user.uid) : null;
    const followerUsername =
      syncedFollower?.username ||
      (typeof req.body?.followerUsername === 'string' ? req.body.followerUsername : null) ||
      null;
    const followerName =
      syncedFollower?.displayName ||
      req.user?.name ||
      (typeof req.body?.followerName === 'string' ? req.body.followerName : null) ||
      'Palace Explorer';
    const followerAvatar =
      syncedFollower?.avatarUrl ||
      req.user?.picture ||
      (typeof req.body?.followerAvatar === 'string' ? req.body.followerAvatar : null) ||
      null;

    const result = await toggleUserFollow({
      followerId,
      followerUsername,
      followerName,
      followerAvatar,
      targetUid,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Failed to toggle follow:', error);
    res.status(400).json({ error: error.message || 'Failed to toggle follow' });
  }
});

apiRouter.post('/user/persona', requireAuth, async (req: AuthRequest, res) => {
  try {
    const { personaName, personaBio } = req.body;
    const user = await updateUserPersona(req.user!.uid, personaName || '', personaBio || '');
    res.json({ user });
  } catch (error: any) {
    console.error('Failed to update persona:', error);
    res.status(500).json({ error: error.message || 'Failed to update persona' });
  }
});

apiRouter.get('/user/chats', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.uid || 'guest';
    const sessions = await getUserSessions(userId);
    res.json({ sessions });
  } catch (error: any) {
    console.error('Failed to get user sessions:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

apiRouter.post('/chat/session', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { characterUuid } = req.body;
    if (!characterUuid) return res.status(400).json({ error: 'characterUuid is required' });

    const userId = req.user?.uid || req.body.guestId || 'guest';
    const sessionData = await getOrCreateSession(characterUuid, userId);
    res.json(sessionData);
  } catch (error: any) {
    console.error('Failed to create session:', error);
    res.status(500).json({ error: error.message || 'Failed to create session' });
  }
});

// Explicit "New Chat" endpoint to start a separate parallel session
apiRouter.post('/chat/session/new', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { characterUuid, greetingOverride } = req.body;
    if (!characterUuid) return res.status(400).json({ error: 'characterUuid is required' });

    const userId = req.user?.uid || req.body.guestId || 'guest';
    const sessionData = await createNewSession(characterUuid, userId, greetingOverride);
    res.json(sessionData);
  } catch (error: any) {
    console.error('Failed to create new session:', error);
    res.status(500).json({ error: error.message || 'Failed to create new session' });
  }
});

// "All Chats" endpoint: View all chat sessions for a specific character
apiRouter.get('/chat/character/:characterUuid/all', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.uid || (req.query.guestId as string) || 'guest';
    const list = await getAllCharacterSessions(req.params.characterUuid, userId);
    res.json({ sessions: list });
  } catch (error: any) {
    console.error('Failed to get character sessions:', error);
    res.status(500).json({ error: error.message || 'Failed to get sessions' });
  }
});

apiRouter.get('/chat/session/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const details = await getSessionDetails(req.params.uuid);
    if (!details) return res.status(404).json({ error: 'Session not found' });
    res.json(details);
  } catch (error: any) {
    console.error('Failed to get session details:', error);
    res.status(500).json({ error: error.message || 'Failed to get session' });
  }
});

apiRouter.put('/chat/settings/:sessionUuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      modelPreference,
      thinkingLevel,
      searchGrounding,
      userPersona,
      chatSettings,
      showAiImages,
      chubApiKey,
      chubApiUrl,
    } = req.body;

    const updated = await updateSessionSettings(req.params.sessionUuid, {
      modelPreference,
      thinkingLevel,
      searchGrounding,
      userPersona,
      chatSettings: typeof chatSettings === 'string' ? chatSettings : chatSettings ? JSON.stringify(chatSettings) : undefined,
      showAiImages: typeof showAiImages === 'boolean' ? showAiImages : undefined,
    });

    res.json({ session: { ...updated, chubApiKey, chubApiUrl } });
  } catch (error: any) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update settings' });
  }
});

// Chat Summary endpoint: AI auto-summarization and manual summary persistence
apiRouter.post('/chat/summary', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionUuid, characterName, personaName, messages, manualSummary } = req.body;
    if (!sessionUuid) return res.status(400).json({ error: 'sessionUuid is required' });

    let summaryText = manualSummary;
    if (!summaryText && messages && messages.length > 0) {
      summaryText = await generateChatSummary({
        characterName: characterName || 'Character',
        personaName: personaName || 'User',
        messages,
      });
    }

    const updated = await updateSessionSummary(sessionUuid, summaryText || '');
    res.json({ session: updated, summary: summaryText });
  } catch (error: any) {
    console.error('Failed to update chat summary:', error);
    res.status(500).json({ error: error.message || 'Failed to update chat summary' });
  }
});

apiRouter.post('/chat/message', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      sessionUuid,
      content,
      userPersona,
      chubApiKey,
      chubApiUrl,
      parentId,
      chatSettings: reqChatSettings,
      showAiImages: reqShowImages,
      extraLorebook,
      personaLorebook,
      preGeneratedReply,
      preGeneratedModelUsed,
      respondingCharacterUuids,
      respondingCharacterUuid,
      triggerWithoutUserMessage,
      ensembleConfig: reqEnsembleConfig,
      brawlState: reqBrawlState,
    } = req.body;
    const trimmedContent = typeof content === 'string' ? content.trim() : '';
    if (!sessionUuid || (!trimmedContent && !triggerWithoutUserMessage)) {
      return res.status(400).json({ error: 'sessionUuid and content are required' });
    }

    const sessionDetails = await getSessionDetails(sessionUuid);
    if (!sessionDetails || !sessionDetails.character) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    const { session, character, messages } = sessionDetails;

    // Parse stored or requested chatSettings
    let parsedSettings: any = {};
    try {
      parsedSettings = reqChatSettings || (session.chatSettings ? JSON.parse(session.chatSettings) : {});
    } catch {
      parsedSettings = {};
    }

    // 1. Save user message to database unless user explicitly triggered an NPC turn without text
    let userMsg: any = null;
    if (!triggerWithoutUserMessage && trimmedContent) {
      userMsg = await addChatMessage({
        sessionId: session.uuid,
        sender: 'user',
        content: trimmedContent,
        parentId: parentId || null,
      });
    }

    // 2. Resolve Group Chat Roster & Target Responding Character(s)
    const hostParticipant = toGroupParticipant(character as any, true);
    const rawRoster: GroupParticipant[] =
      Array.isArray(parsedSettings.groupParticipants) && parsedSettings.groupParticipants.length > 0
        ? parsedSettings.groupParticipants
        : [hostParticipant];
    const roster: GroupParticipant[] = rawRoster.some((p) => p.uuid === character.uuid)
      ? rawRoster
      : [hostParticipant, ...rawRoster];

    const lastSpeakerMsg = [...messages].reverse().find((m) => m.sender === 'character');
    let targetSpeakers: GroupParticipant[] = [];

    if (Array.isArray(respondingCharacterUuids) && respondingCharacterUuids.length > 0) {
      targetSpeakers = respondingCharacterUuids
        .map((uid: string) => roster.find((p) => p.uuid === uid))
        .filter((p): p is GroupParticipant => Boolean(p));
    } else if (typeof respondingCharacterUuid === 'string' && respondingCharacterUuid.trim()) {
      const foundInRoster = roster.find((p) => p.uuid === respondingCharacterUuid.trim());
      if (foundInRoster) {
        targetSpeakers = [foundInRoster];
      }
    }

    if (targetSpeakers.length === 0) {
      targetSpeakers = selectRespondingCharacters({
        roster,
        mode: parsedSettings.responderMode || 'auto',
        selectedUuid: parsedSettings.selectedResponderUuid || character.uuid,
        userMessage: trimmedContent,
        lastSpeakerUuid: lastSpeakerMsg?.speakerCharacterUuid || character.uuid,
      });
    }
    if (targetSpeakers.length === 0) {
      targetSpeakers = [hostParticipant];
    }

    // Hydrate full DB details for any non-host participant missing full prompt fields
    const hydratedSpeakers = await Promise.all(
      targetSpeakers.map(async (sp) => {
        if (sp.uuid === character.uuid) {
          return {
            uuid: character.uuid,
            name: character.name,
            avatar: character.avatar,
            tagline: character.tagline,
            description: character.description,
            personality: character.personality,
            systemPrompt: character.systemPrompt,
            postHistoryInstructions: character.postHistoryInstructions,
            scenario: character.scenario,
            exampleDialogues: character.exampleDialogues,
            lorebook: character.lorebook,
            backgroundImage: character.backgroundImage,
            model3dPose: character.model3dPose,
          };
        }
        const dbChar = await getCharacterByUuid(sp.uuid).catch(() => null);
        return dbChar
          ? {
              uuid: dbChar.uuid,
              name: dbChar.name,
              avatar: dbChar.avatar,
              tagline: dbChar.tagline,
              description: dbChar.description,
              personality: dbChar.personality,
              systemPrompt: dbChar.systemPrompt,
              postHistoryInstructions: dbChar.postHistoryInstructions,
              scenario: dbChar.scenario,
              exampleDialogues: dbChar.exampleDialogues,
              lorebook: dbChar.lorebook,
              backgroundImage: dbChar.backgroundImage,
              model3dPose: dbChar.model3dPose,
            }
          : {
              uuid: sp.uuid,
              name: sp.name,
              avatar: sp.avatar,
              tagline: sp.tagline,
              description: sp.description || sp.tagline,
              personality: sp.personality,
              systemPrompt: sp.systemPrompt || `You are ${sp.name}. Stay in character.`,
              postHistoryInstructions: null,
              scenario: sp.scenario,
              exampleDialogues: null,
              lorebook: sp.lorebook,
              backgroundImage: null,
              model3dPose: 'neutral',
            };
      })
    );

    // 3. Build conversation history (attributing group speakers cleanly)
    const rollingHistory = messages.map((m) => ({
      sender: m.sender as 'user' | 'character' | 'system',
      content:
        m.sender === 'character' && m.speakerName && roster.length > 1
          ? `[${m.speakerName}]: ${m.content}`
          : m.content,
    }));

    const effectivePersona =
      userPersona || session.userPersona || (req.user ? `${req.user.name || 'User'}` : null);
    const activeEnsemble = reqEnsembleConfig || parsedSettings.ensembleConfig || null;
    const activeBrawl = reqBrawlState || parsedSettings.brawlState || null;
    const brawlContextPrompt =
      activeBrawl && activeBrawl.active ? buildBrawlSystemPrompt(activeBrawl) : '';

    const isImageRequested = reqShowImages !== undefined ? reqShowImages : session.showAiImages;
    const generatedMessages: any[] = [];
    let lastModelUsed = '';

    for (let sIdx = 0; sIdx < hydratedSpeakers.length; sIdx++) {
      const speaker = hydratedSpeakers[sIdx];
      const effectiveLorebook = mergeGlobalActiveLorebook(
        speaker.lorebook,
        extraLorebook,
        personaLorebook
      );
      const otherSceneNames = roster
        .filter((p) => p.uuid !== speaker.uuid && !p.muted)
        .map((p) => p.name);

      const usePreGenerated =
        sIdx === 0 && typeof preGeneratedReply === 'string' && preGeneratedReply.trim();

      const replyOptions = {
        character: {
          name: speaker.name,
          tagline: speaker.tagline,
          description: speaker.description,
          personality: speaker.personality,
          systemPrompt: speaker.systemPrompt,
          postHistoryInstructions: speaker.postHistoryInstructions,
          scenario: speaker.scenario,
          exampleDialogues: speaker.exampleDialogues,
          lorebook: effectiveLorebook,
          userPersona: effectivePersona,
        },
        history: rollingHistory,
        userMessage:
          trimmedContent ||
          `(Continue the scene naturally and react now as ${speaker.name}.)`,
        modelPreference: parsedSettings.model || session.modelPreference,
        thinkingLevel: session.thinkingLevel as 'HIGH' | 'OFF',
        searchGrounding: session.searchGrounding,
        chubApiKey,
        chubApiUrl,
        chatSummary: session.summary,
        groupSceneCharacters: otherSceneNames,
        brawlContextPrompt,
        ensembleConfig: activeEnsemble,
        chatSettings: parsedSettings,
      };

      const aiResult = usePreGenerated
        ? {
            reply: preGeneratedReply.trim(),
            thinkingProcess: undefined,
            groundingSources: [] as Array<{ title: string; uri: string }>,
            modelUsed:
              typeof preGeneratedModelUsed === 'string' && preGeneratedModelUsed.trim()
                ? preGeneratedModelUsed.trim()
                : 'Chub.ai / Direct Browser API',
          }
        : activeEnsemble?.enabled
          ? await generateMultiModelCharacterReply(replyOptions)
          : await generateCharacterReply(replyOptions);

      let sceneImageUrl: string | null = null;
      let poseName: string = speaker.model3dPose || 'neutral';

      if (isImageRequested) {
        const lowerReply = aiResult.reply.toLowerCase();
        if (
          lowerReply.includes('combat') ||
          lowerReply.includes('blade') ||
          lowerReply.includes('fight') ||
          lowerReply.includes('weapon') ||
          activeBrawl?.active
        ) {
          poseName = 'combat';
        } else if (
          lowerReply.includes('magic') ||
          lowerReply.includes('spell') ||
          lowerReply.includes('power') ||
          lowerReply.includes('ichor')
        ) {
          poseName = 'spellcasting';
        } else if (
          lowerReply.includes('lean') ||
          lowerReply.includes('whisper') ||
          lowerReply.includes('curious')
        ) {
          poseName = 'inquisitive';
        } else if (
          lowerReply.includes('sit') ||
          lowerReply.includes('rest') ||
          lowerReply.includes('chair')
        ) {
          poseName = 'relaxed';
        }
        sceneImageUrl = speaker.backgroundImage || speaker.avatar;
      }

      const charMsg = await addChatMessage({
        sessionId: session.uuid,
        sender: 'character',
        content: aiResult.reply,
        parentId: userMsg ? userMsg.id : lastSpeakerMsg?.id || null,
        thinkingProcess: aiResult.thinkingProcess,
        groundingSources: JSON.stringify(aiResult.groundingSources),
        swipes: JSON.stringify([aiResult.reply]),
        imageUrl: sceneImageUrl,
        poseName,
        speakerCharacterUuid: speaker.uuid,
        speakerName: speaker.name,
        speakerAvatar: speaker.avatar,
        modelUsed: aiResult.modelUsed,
      });

      const formattedMsg = {
        ...charMsg,
        swipes: [aiResult.reply],
        activeSwipeIndex: 0,
        groundingSources: aiResult.groundingSources,
        imageUrl: sceneImageUrl,
        poseName,
        speakerCharacterUuid: speaker.uuid,
        speakerName: speaker.name,
        speakerAvatar: speaker.avatar,
        modelUsed: aiResult.modelUsed,
      };
      generatedMessages.push(formattedMsg);
      lastModelUsed = aiResult.modelUsed;

      // Append this speaker's reply so next character in 'all' mode sees it immediately
      rollingHistory.push({
        sender: 'character',
        content: roster.length > 1 ? `[${speaker.name}]: ${aiResult.reply}` : aiResult.reply,
      });
    }

    res.json({
      userMessage: userMsg,
      characterMessage: generatedMessages[0],
      generatedMessages,
      modelUsed: lastModelUsed,
      unsavedMessageCount: (session.unsavedMessageCount || 0) + (userMsg ? 1 : 0) + generatedMessages.length,
    });
  } catch (error: any) {
    console.error('Failed to process message:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

// Test external Chub / OpenAI-compatible API connection
apiRouter.post('/config/test-connection', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { apiProvider, apiUrl, apiKey, model } = req.body || {};
    const result = await testExternalApiConnection({ apiProvider, apiUrl, apiKey, model });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, status: 500, endpoint: '', message: error?.message || 'Test failed' });
  }
});

// Swipe / Alternative generation (Core Chub.ai / Janitor / SpicyChat feature)
apiRouter.post('/chat/swipe', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      sessionUuid,
      messageId,
      generateNew,
      targetIndex,
      chubApiKey,
      chubApiUrl,
      chatSettings: reqChatSettings,
      extraLorebook,
      personaLorebook,
      preGeneratedReply,
    } = req.body;
    if (!sessionUuid || !messageId) {
      return res.status(400).json({ error: 'sessionUuid and messageId are required' });
    }

    const sessionDetails = await getSessionDetails(sessionUuid);
    if (!sessionDetails || !sessionDetails.character) {
      return res.status(404).json({ error: 'Chat session not found' });
    }

    const targetMsg = sessionDetails.messages.find(m => m.id === messageId);
    if (!targetMsg || targetMsg.sender !== 'character') {
      return res.status(400).json({ error: 'Can only swipe character messages' });
    }

    let swipes = [...targetMsg.swipes];
    let newIndex = targetMsg.activeSwipeIndex;

    if (generateNew) {
      if (typeof preGeneratedReply === 'string' && preGeneratedReply.trim()) {
        swipes.push(preGeneratedReply.trim());
        newIndex = swipes.length - 1;
      } else {
        let parsedSettings: any = {};
        try {
          parsedSettings = reqChatSettings || (sessionDetails.session.chatSettings ? JSON.parse(sessionDetails.session.chatSettings) : {});
        } catch {
          parsedSettings = {};
        }

        const msgIndex = sessionDetails.messages.findIndex(m => m.id === messageId);
        const previousHistory = sessionDetails.messages.slice(0, msgIndex).map(m => ({
          sender: m.sender as 'user' | 'character' | 'system',
          content: m.content,
        }));

        const targetChar =
          targetMsg.speakerCharacterUuid &&
          targetMsg.speakerCharacterUuid !== sessionDetails.character.uuid
            ? (await getCharacterByUuid(targetMsg.speakerCharacterUuid).catch(() => null)) ||
              sessionDetails.character
            : sessionDetails.character;

        const effectiveLorebook = mergeGlobalActiveLorebook(
          targetChar.lorebook,
          extraLorebook,
          personaLorebook
        );
        const activeEnsemble = reqChatSettings?.ensembleConfig || parsedSettings.ensembleConfig || null;
        const activeBrawl = reqChatSettings?.brawlState || parsedSettings.brawlState || null;
        const brawlContextPrompt =
          activeBrawl && activeBrawl.active ? buildBrawlSystemPrompt(activeBrawl) : '';

        const swipeOpts = {
          character: {
            name: targetChar.name,
            tagline: targetChar.tagline,
            description: targetChar.description,
            personality: targetChar.personality,
            systemPrompt: targetChar.systemPrompt,
            postHistoryInstructions: targetChar.postHistoryInstructions,
            scenario: targetChar.scenario,
            exampleDialogues: targetChar.exampleDialogues,
            lorebook: effectiveLorebook,
            userPersona: sessionDetails.session.userPersona,
          },
          history: previousHistory,
          modelPreference: parsedSettings.model || sessionDetails.session.modelPreference,
          thinkingLevel: sessionDetails.session.thinkingLevel as 'HIGH' | 'OFF',
          searchGrounding: sessionDetails.session.searchGrounding,
          chubApiKey,
          chubApiUrl,
          chatSummary: sessionDetails.session.summary,
          brawlContextPrompt,
          ensembleConfig: activeEnsemble,
          chatSettings: parsedSettings,
        };

        const aiResult = activeEnsemble?.enabled
          ? await generateMultiModelCharacterReply(swipeOpts)
          : await generateCharacterReply(swipeOpts);

        swipes.push(aiResult.reply);
        newIndex = swipes.length - 1;
      }
    } else if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex < swipes.length) {
      newIndex = targetIndex;
    }

    const updated = await updateMessageSwipe(messageId, swipes, newIndex);
    res.json({
      message: {
        ...updated,
        swipes,
        activeSwipeIndex: newIndex,
        content: swipes[newIndex],
        speakerCharacterUuid: targetMsg.speakerCharacterUuid,
        speakerName: targetMsg.speakerName,
        speakerAvatar: targetMsg.speakerAvatar,
        modelUsed: targetMsg.modelUsed,
      },
    });
  } catch (error: any) {
    console.error('Failed to swipe message:', error);
    res.status(500).json({ error: error.message || 'Failed to swipe message' });
  }
});

apiRouter.post('/chat/reset/:sessionUuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const details = await getSessionDetails(req.params.sessionUuid);
    if (!details || !details.character) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const resetResult = await resetSessionMessages(req.params.sessionUuid, details.character.greeting);
    res.json({ success: true, greeting: details.character.greeting, message: resetResult.message });
  } catch (error: any) {
    console.error('Failed to reset session:', error);
    res.status(500).json({ error: error.message || 'Failed to reset session' });
  }
});

// Edit bot or user message text in a chat session (persists content & active swipe)
const handleEditChatMessage = async (req: AuthRequest, res: express.Response) => {
  try {
    const messageId = Number(req.params.messageId);
    const { sessionUuid, content } = req.body || {};
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return res.status(400).json({ error: 'Valid numeric messageId is required' });
    }
    if (!sessionUuid || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'sessionUuid and non-empty content are required' });
    }

    const updated = await updateChatMessageContent(messageId, sessionUuid, content);
    if (!updated) {
      return res.status(404).json({ error: 'Message not found in this chat session' });
    }
    res.json({ message: updated });
  } catch (error: any) {
    console.error('Failed to edit chat message:', error);
    res.status(500).json({ error: error.message || 'Failed to edit chat message' });
  }
};

apiRouter.patch('/chat/message/:messageId', optionalAuth, handleEditChatMessage);
apiRouter.put('/chat/message/:messageId', optionalAuth, handleEditChatMessage);

apiRouter.delete('/chat/session/:sessionUuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await deleteSession(req.params.sessionUuid);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: error.message || 'Failed to delete session' });
  }
});

// ----------------- CHUB.AI CUSTOM VOICES ENGINE -----------------
apiRouter.get('/voices', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.uid || (req.query.guestId as string) || undefined;
    const voices = await getCustomVoices(userId);
    res.json({ voices });
  } catch (error: any) {
    console.error('Failed to list custom voices:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch custom voices' });
  }
});

apiRouter.post('/voices', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const validation = validateCustomVoiceInput({
      name: body.name,
      referenceAudioData: body.referenceAudioData,
      referenceDurationSec: body.referenceDurationSec,
    });
    if (!validation.ok || !validation.normalizedAudioData) {
      return res.status(400).json({ error: validation.error || 'Invalid voice sample' });
    }

    const uuid =
      'voice_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const created = await createCustomVoice({
      uuid,
      userId: req.user?.uid || body.guestId || 'guest',
      creatorName:
        req.user?.name || req.user?.email?.split('@')[0] || body.creatorName || 'Anonymous',
      name: String(body.name).trim(),
      description: String(body.description || '').trim(),
      engine: String(body.engine || 'chub_custom_voice'),
      referenceAudioData: validation.normalizedAudioData,
      referenceAudioMime: String(body.referenceAudioMime || validation.mimeType || 'audio/wav'),
      referenceDurationSec: Number(body.referenceDurationSec || 0),
      transcript: String(body.transcript || '').trim(),
      pitchShift: Number(body.pitchShift ?? 0),
      speakingRate: Number(body.speakingRate ?? 100),
      baseVoiceName: String(body.baseVoiceName || 'Puck'),
      isPublic: body.isPublic !== false,
    });

    res.status(201).json({ voice: created });
  } catch (error: any) {
    console.error('Failed to create custom voice:', error);
    res.status(500).json({ error: error.message || 'Failed to create custom voice' });
  }
});

apiRouter.delete('/voices/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const requester = {
      userUid: req.user?.uid || null,
      guestId: (req.query.guestId as string) || (req.body?.guestId as string) || null,
    };
    const result = await deleteCustomVoice(req.params.uuid, requester);
    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Custom voice not found' });
    }
    if (result.status === 'forbidden') {
      return res.status(403).json({ error: 'You can only delete custom voices you created' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete custom voice:', error);
    res.status(500).json({ error: error.message || 'Failed to delete custom voice' });
  }
});

// ----------------- TEXT-TO-SPEECH (TTS & CHUB CUSTOM VOICES) -----------------
apiRouter.post('/tts', async (req, res) => {
  try {
    const {
      text,
      voiceName,
      voiceStyle,
      ttsApi,
      customVoiceUuid,
      ttsEndpointUrl,
      ttsApiKey,
      chubApiKey,
    } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    let customVoice: any = null;
    if (typeof customVoiceUuid === 'string' && customVoiceUuid.trim()) {
      customVoice = await getCustomVoiceByUuid(customVoiceUuid.trim());
      if (customVoice) {
        await incrementCustomVoiceUseCount(customVoice.uuid);
      }
    }

    const result = await generateSpeechTTS(text, voiceName || 'Puck', voiceStyle, {
      ttsApi,
      ttsEndpointUrl,
      ttsApiKey,
      chubApiKey,
      customVoice,
    });

    res.json(result);
  } catch (error: any) {
    console.error('TTS generation failed:', error);
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});

// ----------------- PALACE.AI APP VERSION & ANDROID APK KIT -----------------
function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return String(pkg.version || '2.5.0');
  } catch {
    return '2.5.0';
  }
}

apiRouter.get('/app/version', (_req, res) => {
  const version = readPackageVersion();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    appName: 'Palace.ai',
    packageId: 'ai.palace.app',
    version,
    releaseNotes: [
      'Palace Free Built-In API for all models (including Claude Opus 5.5) with zero API key needed',
      'JanitorAI (/characters/...) and SpicyChat (/chatbot/...) URL importers upgraded',
      'Chub.ai Custom Voices Engine + Inline Chat Message Editing',
      'Palace.ai Brand Logo & Android WebAPK / TWA Builder Kit',
    ],
    supportsWebApkInstall: true,
    twaKitDownloadUrl: '/api/app/android-apk-kit.zip',
  });
});

apiRouter.get('/app/android-apk-kit.zip', (req, res) => {
  try {
    const version = readPackageVersion();
    const hostHeader = req.get('host') || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const origin = `${Array.isArray(proto) ? proto[0] : proto}://${hostHeader}`;

    const entries: Array<{ name: string; content: string | Buffer }> = [
      {
        name: 'palace-ai-android-twa/twa-manifest.json',
        content: JSON.stringify(
          {
            packageId: 'ai.palace.app',
            host: hostHeader.split(':')[0],
            name: 'Palace.ai',
            launcherName: 'Palace.ai',
            display: 'standalone',
            themeColor: '#09090B',
            navigationColor: '#09090B',
            backgroundColor: '#EDF6FF',
            enableNotifications: true,
            startUrl: '/',
            iconUrl: `${origin}/pwa-512x512.png`,
            maskableIconUrl: `${origin}/pwa-maskable-512x512.png`,
            appVersionName: version,
            appVersionCode: 250,
            shortcuts: [],
            generatorApp: 'Palace.ai TWA Kit',
          },
          null,
          2
        ),
      },
      {
        name: 'palace-ai-android-twa/build-apk.sh',
        content: `#!/usr/bin/env bash
set -euo pipefail
echo "Building Palace.ai v${version} signed Android APK via Bubblewrap..."
npx @bubblewrap/cli init --manifest="${origin}/manifest.webmanifest"
npx @bubblewrap/cli build
echo "Done! Install app-release-signed.apk onto your Android device."
`,
      },
      {
        name: 'palace-ai-android-twa/AndroidManifest.xml',
        content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="ai.palace.app"
    android:versionCode="250"
    android:versionName="${version}">
    <uses-permission android:name="android.permission.INTERNET" />
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="Palace.ai"
        android:theme="@android:style/Theme.Translucent.NoTitleBar">
        <activity
            android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
            android:exported="true"
            android:label="Palace.ai">
            <meta-data
                android:name="android.support.customtabs.trusted.DEFAULT_URL"
                android:value="${origin}/" />
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
`,
      },
      {
        name: 'palace-ai-android-twa/README_BUILD_APK.md',
        content: `# Palace.ai Android APK Builder Kit (v${version})

## Fast Option 1: Install Instantly on Android (Zero Computer Required)
1. Open **${origin}** in **Google Chrome** or **Edge** on Android.
2. Tap **Get App** -> **Install Palace.ai Now** (or tap Chrome's menu \`⋮ -> Add to Home screen -> Install\`).
3. Android Chrome automatically builds and installs a signed **WebAPK** on your phone with the Palace.ai app icon.

## Option 2: Compile a Standalone Distributable .apk File
Because compiling & signing a binary Android \`.apk\` requires Java JDK 17+ and Android SDK Build-Tools (\`aapt2\` / \`apksigner\`), run this bundle on any Mac, Windows, or Linux machine:

\`\`\`bash
npx @bubblewrap/cli init --manifest="${origin}/manifest.webmanifest"
npx @bubblewrap/cli build
\`\`\`

This compiles and signs \`app-release-signed.apk\` pointing to **Palace.ai** (${origin}) using your Palace.ai icon assets!
`,
      },
    ];

    const iconFiles = [
      { disk: 'public/pwa-192x192.png', zip: 'palace-ai-android-twa/res/mipmap-xxxhdpi/ic_launcher.png' },
      { disk: 'public/pwa-512x512.png', zip: 'palace-ai-android-twa/icon-512x512.png' },
    ];
    for (const ic of iconFiles) {
      const abs = path.resolve(process.cwd(), ic.disk);
      if (fs.existsSync(abs)) {
        entries.push({ name: ic.zip, content: fs.readFileSync(abs) });
      }
    }

    const zipBuf = createZipBuffer(entries);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="palace-ai-android-apk-kit-v${version}.zip"`
    );
    res.setHeader('Content-Length', String(zipBuf.length));
    res.send(zipBuf);
  } catch (error: any) {
    console.error('Failed to build Android APK kit:', error);
    res.status(500).json({ error: error.message || 'Failed to build Android APK kit' });
  }
});
