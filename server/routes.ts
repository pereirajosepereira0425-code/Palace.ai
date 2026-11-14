import express from 'express';
import { optionalAuth, requireAuth, type AuthRequest } from '../src/middleware/auth.ts';
import {
  getCharacters,
  getCharacterByUuid,
  createCharacter,
  updateCharacter,
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
  updateSessionSettings,
  updateSessionSummary,
  deleteSession,
  resetSessionMessages,
} from '../src/db/chats.ts';
import {
  getOrCreateUser,
  getUserProfile,
  updateUserPersona,
  updateUserProfile,
  isUsernameAvailable,
  getUserByUsername,
} from '../src/db/users.ts';
import {
  getPublicPersonas,
  getUserPersonas,
  createSharedPersona,
  updateSharedPersona,
  deleteSharedPersona,
  toggleLikePersona,
  incrementPersonaUse,
  ensureSeedPersonas,
} from '../src/db/personas.ts';
import {
  generateCharacterReply,
  generateSpeechTTS,
  generatePersonaReaction,
  generateChatSummary,
  testExternalApiConnection,
} from '../src/services/aiService.ts';
import { importCharacterFromUrl, UrlImportError } from './urlImporter.ts';
import { ensureSeedTags, getTags, upsertTags } from '../src/db/tags.ts';

export const apiRouter = express.Router();

// Ensure initial seed characters, personas, and tags exist on server start
ensureSeedCharacters().catch(console.error);
ensureSeedPersonas().catch(console.error);
ensureSeedTags().catch(console.error);

// ----------------- TAGS (CHUB.AI DYNAMIC TAXONOMY) -----------------
apiRouter.get('/tags', async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 250;
    const list = await getTags({ search, limit: Number.isFinite(limit) ? limit : 250 });
    res.json({ tags: list });
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
    const characters = await getCharacters({
      search: typeof search === 'string' ? search : undefined,
      tag: typeof tag === 'string' ? tag : undefined,
      rating: typeof rating === 'string' ? rating : undefined,
      sort: sort === 'latest' || sort === 'chats' || sort === 'popular' ? sort : 'popular',
    });

    let likedIds: number[] = [];
    if (req.user?.uid) {
      likedIds = await getUserLikedIds(req.user.uid);
    }

    res.json({ characters, likedIds });
  } catch (error: any) {
    console.error('Failed to get characters:', error);
    res.status(500).json({ error: error.message || 'Failed to get characters' });
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
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await importCharacterFromUrl(url);

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
    const list = await getPublicPersonas({
      search: typeof search === 'string' ? search : undefined,
      sort: sort === 'latest' || sort === 'used' || sort === 'popular' ? sort : 'popular',
    });
    res.json({ personas: list });
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

// Public Chub User Profile endpoint (e.g. https://chub.ai/users/biguswigus)
apiRouter.get('/users/:username', async (req, res) => {
  try {
    const data = await getUserByUsername(req.params.username);
    if (!data) {
      return res.status(404).json({ error: `User @${req.params.username} not found` });
    }
    res.json(data);
  } catch (error: any) {
    console.error('Failed to get public user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to get user profile' });
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
    const { sessionUuid, content, userPersona, chubApiKey, chubApiUrl, parentId, chatSettings: reqChatSettings, showAiImages: reqShowImages } = req.body;
    if (!sessionUuid || !content?.trim()) {
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

    // 1. Save user message to database
    const userMsg = await addChatMessage({
      sessionId: session.uuid,
      sender: 'user',
      content: content.trim(),
      parentId: parentId || null,
    });

    // 2. Build conversation history for Gemini or Chub API
    const history = messages.map(m => ({
      sender: m.sender as 'user' | 'character' | 'system',
      content: m.content,
    }));

    // 3. Generate Character Reply with AI (Gemini or Chub.ai API)
    const effectivePersona = userPersona || session.userPersona || (req.user ? `${req.user.name || 'User'}` : null);
    const aiResult = await generateCharacterReply({
      character: {
        name: character.name,
        tagline: character.tagline,
        description: character.description,
        personality: character.personality,
        systemPrompt: character.systemPrompt,
        postHistoryInstructions: character.postHistoryInstructions,
        scenario: character.scenario,
        exampleDialogues: character.exampleDialogues,
        lorebook: character.lorebook,
        userPersona: effectivePersona,
      },
      history,
      userMessage: content.trim(),
      modelPreference: parsedSettings.model || session.modelPreference,
      thinkingLevel: session.thinkingLevel as 'HIGH' | 'OFF',
      searchGrounding: session.searchGrounding,
      chubApiKey,
      chubApiUrl,
      chatSummary: session.summary,
      chatSettings: parsedSettings,
    });

    const isImageRequested = reqShowImages !== undefined ? reqShowImages : session.showAiImages;
    let sceneImageUrl: string | null = null;
    let poseName: string = character.model3dPose || 'neutral';

    if (isImageRequested) {
      // Determine pose based on dialogue/action
      const lowerReply = aiResult.reply.toLowerCase();
      if (lowerReply.includes('combat') || lowerReply.includes('blade') || lowerReply.includes('fight') || lowerReply.includes('weapon')) {
        poseName = 'combat';
      } else if (lowerReply.includes('magic') || lowerReply.includes('spell') || lowerReply.includes('power') || lowerReply.includes('ichor')) {
        poseName = 'spellcasting';
      } else if (lowerReply.includes('lean') || lowerReply.includes('whisper') || lowerReply.includes('curious')) {
        poseName = 'inquisitive';
      } else if (lowerReply.includes('sit') || lowerReply.includes('rest') || lowerReply.includes('chair')) {
        poseName = 'relaxed';
      }

      // Provide scenario illustration
      sceneImageUrl = character.backgroundImage || character.avatar;
    }

    // 4. Save character message to database (with initial swipe candidate)
    const charMsg = await addChatMessage({
      sessionId: session.uuid,
      sender: 'character',
      content: aiResult.reply,
      parentId: userMsg.id,
      thinkingProcess: aiResult.thinkingProcess,
      groundingSources: JSON.stringify(aiResult.groundingSources),
      swipes: JSON.stringify([aiResult.reply]),
      imageUrl: sceneImageUrl,
      poseName,
    });

    res.json({
      userMessage: userMsg,
      characterMessage: {
        ...charMsg,
        swipes: [aiResult.reply],
        activeSwipeIndex: 0,
        groundingSources: aiResult.groundingSources,
        imageUrl: sceneImageUrl,
        poseName,
      },
      modelUsed: aiResult.modelUsed,
      unsavedMessageCount: (session.unsavedMessageCount || 0) + 2,
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
    const { sessionUuid, messageId, generateNew, targetIndex, chubApiKey, chubApiUrl, chatSettings: reqChatSettings } = req.body;
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

      const aiResult = await generateCharacterReply({
        character: {
          name: sessionDetails.character.name,
          tagline: sessionDetails.character.tagline,
          description: sessionDetails.character.description,
          personality: sessionDetails.character.personality,
          systemPrompt: sessionDetails.character.systemPrompt,
          postHistoryInstructions: sessionDetails.character.postHistoryInstructions,
          scenario: sessionDetails.character.scenario,
          exampleDialogues: sessionDetails.character.exampleDialogues,
          lorebook: sessionDetails.character.lorebook,
          userPersona: sessionDetails.session.userPersona,
        },
        history: previousHistory,
        modelPreference: parsedSettings.model || sessionDetails.session.modelPreference,
        thinkingLevel: sessionDetails.session.thinkingLevel as 'HIGH' | 'OFF',
        searchGrounding: sessionDetails.session.searchGrounding,
        chubApiKey,
        chubApiUrl,
        chatSummary: sessionDetails.session.summary,
        chatSettings: parsedSettings,
      });

      swipes.push(aiResult.reply);
      newIndex = swipes.length - 1;
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

    await resetSessionMessages(req.params.sessionUuid, details.character.greeting);
    res.json({ success: true, greeting: details.character.greeting });
  } catch (error: any) {
    console.error('Failed to reset session:', error);
    res.status(500).json({ error: error.message || 'Failed to reset session' });
  }
});

apiRouter.delete('/chat/session/:sessionUuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await deleteSession(req.params.sessionUuid);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: error.message || 'Failed to delete session' });
  }
});

// ----------------- TEXT-TO-SPEECH (TTS) -----------------
// Uses model gemini-3.8-flash-tts
apiRouter.post('/tts', async (req, res) => {
  try {
    const { text, voiceName, voiceStyle } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required for TTS' });
    }

    const audioBase64 = await generateSpeechTTS(text, voiceName || 'Puck', voiceStyle);
    res.json({
      audioBase64,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    console.error('TTS generation failed:', error);
    res.status(500).json({ error: error.message || 'TTS generation failed' });
  }
});
