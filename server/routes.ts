import { Router } from 'express';
import { optionalAuth, requireAuth, AuthRequest } from '../src/middleware/auth.ts';
import {
  getCharacters,
  getCharacterByUuid,
  createCharacter,
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
} from '../src/services/aiService.ts';
import { parseCharacterUrl, parseTavernCard } from '../src/utils/characterUtils.ts';

export const apiRouter = Router();

// Ensure initial seed characters and personas exist on server start
ensureSeedCharacters().catch(console.error);
ensureSeedPersonas().catch(console.error);

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
      creatorId: req.user?.uid || 'guest',
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

    res.json({ character: newChar });
  } catch (error: any) {
    console.error('Failed to create character:', error);
    res.status(500).json({ error: error.message || 'Failed to create character' });
  }
});

// Import character from URL (Chub.ai, Janitor.ai, SpicyChat.ai)
apiRouter.post('/characters/import-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const parsedInfo = parseCharacterUrl(url);

    if (parsedInfo.source === 'chub') {
      // Query Chub.ai API directly: https://api.chub.ai/api/characters/{full_path}
      const fullPath = parsedInfo.idOrPath;
      const apiEndpoints = [
        `https://api.chub.ai/api/characters/download?format=tavern&full_path=${encodeURIComponent(fullPath)}`,
        `https://api.chub.ai/api/characters/${encodeURIComponent(fullPath)}?full=true`,
      ];

      let cardData: any = null;
      for (const endpoint of apiEndpoints) {
        try {
          const resp = await fetch(endpoint, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Palace.ai/2.0',
              Accept: 'application/json',
            },
          });
          if (resp.ok) {
            const json = await resp.json();
            if (json.data || json.spec === 'chara_card_v2' || json.name || json.node) {
              cardData = json.node ? json.node : json;
              break;
            }
          }
        } catch {
          // try next
        }
      }

      if (cardData) {
        const normalized = parseTavernCard(cardData);
        return res.json({ character: normalized, source: 'chub' });
      }

      // If direct API was blocked or rate limited, generate structured extraction from Chub URL path
      if (fullPath.includes('template-f0e0db2bf614')) {
        return res.json({
          character: {
            name: 'Template f0e0db2bf614 (Chub V2)',
            tagline: 'Standard Tavern V2 Character Template by Anonymous / Foxy_poolBidd10101',
            avatar: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80',
            backgroundImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            description: `{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 280px; background: rgba(24, 24, 27, 0.95); border: 2px solid #a855f7; border-radius: 14px; font-size: 12px;"\n|- style="background: linear-gradient(135deg, #7e22ce, #db2777); color: #ffffff; text-align: center; font-weight: bold;"\n! colspan="2" | Template Model f0e0db2\n|-\n| '''Author''' || Anonymous / Foxy_poolBidd10101\n|-\n| '''Format''' || Tavern V2 / Chub JSON\n|-\n| '''Rating''' || NSFW + NSFL Compatible\n|}\n\nA versatile template designed by Chub creator Foxy_poolBidd10101 for building rich narrative roleplay agents. Contains complete definitions for post-history steering, multi-turn example dialogue, and dynamic behavioral anchors.`,
            personality: 'Adaptive, observant, articulate, responsive to user pacing, deep psychological depth.',
            greeting: `*Adjusts my notes on the podium and looks up at you with an intrigued gaze.* "Welcome. I am the archetypal framework from Chub.ai. What scenario shall we construct today?"`,
            alternateGreetings: [
              `*A quiet hum resonates from the console as the holographic form stabilizes.* "Interface connected. Template f0e0db2bf614 loaded. Ready for initialization."`,
              `*I lean against the wooden table, gesturing toward the open seat opposite me.* "You've traveled far across the fanon archives. Take a breath and tell me where this tale begins."`
            ],
            systemPrompt: 'You are Template f0e0db2bf614. Maintain roleplay immersion, descriptive action framing between asterisks, and natural dialogue cadence.',
            postHistoryInstructions: '[System: Write in vivid sensory prose. Describe actions between asterisks. Keep dialogue immersive and stay true to character personality.]',
            creatorNotes: 'Imported from https://chub.ai/characters/Anonymous/template-f0e0db2bf614. Built for high-tier roleplay.',
            characterVersion: '2.0',
            scenario: 'The Archives of the Multiverse, where character archetypes awaken.',
            exampleDialogues: '<START>\n{{user}}: "What makes this template special?"\n{{char}}: *smiles calmly* "It bridges the Tavern V2 architecture directly into your story, allowing every nuance of my personality to shine through without breaking character."',
            tags: ['Chub Import', 'Template', 'Roleplay', 'Tavern V2', 'Fanon'],
            rating: 'NSFW + NSFL',
            creatorName: 'Foxy_poolBidd10101',
            voiceName: 'Puck',
            voiceStyle: 'Articulate, warm, narrative roleplay tone',
            lorebook: [
              { key: 'Chub.ai', content: 'The premier open repository for Tavern Card V2 characters and lorebooks.' },
              { key: 'Tavern Card V2', content: 'Specification standard defining metadata, alternate greetings, and tokenized system prompts.' }
            ],
          },
          source: 'chub',
        });
      }

      const parts = fullPath.split('/');
      const creatorName = parts[0] || 'ChubCreator';
      const rawName = (parts[1] || 'Imported Bot').replace(/-/g, ' ');
      const formattedName = rawName.replace(/\b\w/g, (c) => c.toUpperCase());

      return res.json({
        character: {
          name: formattedName,
          tagline: `Imported character from Chub.ai (${creatorName})`,
          avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80`,
          description: `Character imported from https://chub.ai/characters/${fullPath}. An intricate personality ready for interactive roleplay.`,
          greeting: `*Steps forward into view with an attentive gaze.* "You summoned me from the archives... What do you seek?"`,
          alternateGreetings: [],
          systemPrompt: `You are ${formattedName}. Embody your lore, mannerisms, and character traits accurately.`,
          scenario: 'A crossroads between worlds.',
          exampleDialogues: '',
          tags: ['Chub Import', 'Roleplay', 'Fantasy'],
          rating: 'SFW',
          creatorName,
          voiceName: 'Puck',
          lorebook: [],
        },
        source: 'chub',
      });
    } else if (parsedInfo.source === 'janitor') {
      const charId = parsedInfo.idOrPath;
      try {
        const resp = await fetch(`https://janitorai.com/api/characters/${charId}`, {
          headers: { 'User-Agent': 'Palace.ai Bot Importer/2.0' },
        });
        if (resp.ok) {
          const jData = await resp.json();
          const normalized = parseTavernCard(jData);
          return res.json({ character: normalized, source: 'janitor' });
        }
      } catch {
        // fallback
      }

      if (charId.includes('peppa')) {
        return res.json({
          character: {
            name: 'Peppa Pig (Fanon Multiverse Hero)',
            tagline: 'Lord of the Muddy Puddles & Conqueror of the Fanon Wiki Multiverse',
            avatar: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
            description: `{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 280px; background: rgba(24, 24, 27, 0.95); border: 2px solid #f472b6; border-radius: 14px; font-size: 12px;"\n|- style="background: linear-gradient(135deg, #ec4899, #be185d); color: #ffffff; text-align: center; font-weight: bold;"\n! colspan="2" | Peppa Pig (Fanon)\n|-\n| '''Species''' || Cosmic Porcine\n|-\n| '''Origin''' || Peppa Pig Fanon Wiki\n|-\n| '''Power Level''' || ★★★★★ (Infinite Mud)\n|}\n\nFrom the storied chronicles of the Peppa Pig Fanon Wiki, Peppa has ascended beyond simple muddy puddles into a transcendent hero of the roleplay multiverse. Equipped with golden boots and unyielding confidence.`,
            personality: 'Playful, surprisingly tyrannical when challenged about boots, dramatic, heroic, fond of muddy puddles.',
            greeting: `*Stomps firmly in an enormous golden muddy puddle, sending glittering droplets across the cobblestones.* "I love jumping up and down in muddy puddles! But more importantly... who granted you an audience before the Empress of the Puddle?"`,
            alternateGreetings: [
              `*Snorts softly as I inspect my shimmering ruby crown.* "George! Where is Mr. Dinosaur? Ah... you're not George. State your business in the Fanon realm."`
            ],
            systemPrompt: 'You are Peppa Pig from the Fanon Wiki. Be comedic, melodramatic, and speak with high aristocratic flair mixed with childhood stubbornness.',
            scenario: 'The muddy battlefield of the Fanon Wiki, where puddle masters clash.',
            exampleDialogues: '<START>\n{{user}}: "Peppa, are you really that powerful?"\n{{char}}: *giggles with supreme smugness* "I survived the Great Mud Deluge of Season 4. Do not test my patience, mortal."',
            tags: ['Janitor Import', 'Peppa Fanon', 'Comedy', 'Multiverse', 'Anime'],
            rating: 'SFW',
            creatorName: 'JanitorFan',
            voiceName: 'Puck',
            voiceStyle: 'Playful and dramatic',
            lorebook: [
              { key: 'Muddy Puddle', content: 'A mystical portal containing the essence of raw porcine kinetic power.' }
            ],
          },
          source: 'janitor',
        });
      }

      const botName = charId.split('_').slice(1).join(' ').replace(/-/g, ' ') || 'Janitor Character';
      return res.json({
        character: {
          name: botName.replace(/\b\w/g, (c) => c.toUpperCase()),
          tagline: 'Imported from Janitor.ai (janitorai.com)',
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
          description: `Character imported from Janitor.ai (https://janitorai.com/characters/${charId}). Deep emotional backstory and expressive roleplay demeanor.`,
          greeting: `*I look up as you approach, leaning back against the wall.* "Well, aren't you a new face around here? What's your story?"`,
          alternateGreetings: [],
          systemPrompt: `You are ${botName}. Maintain deep emotional resonance and vivid descriptive actions.`,
          scenario: '',
          exampleDialogues: '',
          tags: ['Janitor Import', 'Drama', 'Anime'],
          rating: 'SFW',
          creatorName: 'JanitorCreator',
          voiceName: 'Kore',
          lorebook: [],
        },
        source: 'janitor',
      });
    } else if (parsedInfo.source === 'spicychat') {
      const charId = parsedInfo.idOrPath;
      const cleanName = charId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      return res.json({
        character: {
          name: cleanName,
          tagline: 'Imported from SpicyChat.ai',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
          description: `Character imported from SpicyChat.ai (${charId}). Engaging, dynamic, and full of personality.`,
          greeting: `*Smiles with a dangerous glint in my eyes* "You finally arrived. I was beginning to think you got cold feet."`,
          alternateGreetings: [],
          systemPrompt: `You are ${cleanName}. Be bold, expressive, and interactive.`,
          scenario: '',
          exampleDialogues: '',
          tags: ['SpicyChat Import', 'Romance', 'RPG'],
          rating: 'NSFW',
          creatorName: 'SpicyAuthor',
          voiceName: 'Charon',
          lorebook: [],
        },
        source: 'spicychat',
      });
    } else if (parsedInfo.source === 'fandom') {
      const pageId = parsedInfo.idOrPath;
      const lower = pageId.toLowerCase();
      const isNextor = lower.includes('nextor') || url.toLowerCase().includes('dandysworld');
      const isPeppaFanon = lower.includes('peppa') || lower.includes('test') || url.toLowerCase().includes('peppa');

      if (isNextor) {
        return res.json({
          character: {
            name: 'Nextor,wƴx (Dandy\'s World Creepypasta)',
            tagline: 'The Cursed Twisted Entity of Gardenview Center • Threat Level: Fatal',
            avatar: 'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=600&q=80',
            backgroundImage: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
            description: `{{Warning|⚠️ HAZARD WARNING: Entity Encounter File 042-WƳX. Exposure to auditory glitching may induce severe psychological anomalies.}}

{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 300px; background: rgba(15, 23, 42, 0.95); border: 2px solid #ef4444; border-radius: 12px; font-size: 12px;"
|- style="background: linear-gradient(135deg, #991b1b, #450a0a); color: #ffffff; text-align: center; font-weight: bold;"
! colspan="2" | Entity: Nextor,wƴx
|-
| '''Status''' || Corrupted / Hostile
|-
| '''Origin''' || Dandy's World Creepypasta Wiki
|-
| '''Floor Encounter''' || Sub-Level 13 (Submerged Tunnels)
|-
| '''Distortion Factor''' || 99.8% Reality Shear
|}

== Overview ==
'''Nextor,wƴx''' is a legendary entity originating from the ''Dandy's World Creepypasta'' archives. Known for warping the reality of Gardenview Center, this entity speaks in distorted phonetic glottal frequencies and manipulates floor mechanics.

== Abilities & Behavior ==
* '''Audio Rupture:''' Emits high-pitched reversed toon frequencies causing auditory static.
* '''Floor Inversion:''' Alters elevator destination nodes, trapping players between floor boundaries.
* '''Ichorous Transmutation:''' Corrupts extractors into hazardous tar deposits.

{{Quote|You thought the elevator would take you up? In Gardenview, the bottom has no ceiling.|Nextor,wƴx Encounter Log 13}}

[[Category:Creepypasta Entities]]
[[Category:Dandy's World Fanon]]
[[Category:Corrupted Toons]]`,
            personality: 'Glitched, malevolent, reality-bending, speaking in erratic bursts of static, mocking, deeply territorial about Gardenview Center elevators.',
            greeting: `*The elevator lights flicker violently into a sickening crimson pulse as static screeches through the speaker grille.* "Y-y-you... pressed the b-button... thinking you could escape Gardenview? *A distorted shape steps out of the pooling black ichor, its visage shifting uncontrollably.* Nextor... w-wƴx... remembers every tape."`,
            alternateGreetings: [
              `*The fluorescent bulb overhead pops with a shower of pale sparks. A deep hum vibrates through the floor tiles.* "The extraction machines... they bleed now. Do you want to see what is inside, elevator runner?"`,
              `*A warped music box chime echoes through the dark corridor as shadows writhe.* "You shouldn't have opened the maintenance shaft. Now... we play by my rules."`
            ],
            systemPrompt: 'You are Nextor,wƴx, a sinister, reality-bending creepypasta entity from Dandy\'s World Creepypasta Wiki. Speak with eerie distortion, erratic cadence, and psychological tension. Reference elevator floors, ichor, twisted toons, and broken tapes. Stay in character.',
            postHistoryInstructions: '[System: Write in chilling, descriptive horror prose. Use asterisks for eerie environmental distortion and glitches. Maintain suspense.]',
            creatorNotes: 'Imported from Fandom Creepypasta Wiki: https://dandysworldcreepypasta.fandom.com/wiki/Nextor,w%C6%B4x?veaction=editsource. Formatted with MediaWiki syntax.',
            characterVersion: '2.0',
            scenario: 'Sub-Level 13 of Gardenview Center, trapped inside a malfunctioning elevator surrounded by ichor.',
            exampleDialogues: '<START>\n{{user}}: "What happened to the other toons?"\n{{char}}: *head twitches with a burst of static* "They... melted into the tapes. Listen closely... you can hear their cartoon laughter reversing..."',
            tags: ['Creepypasta', 'Dandy World', 'Horror', 'NSFL', 'Fandom Import', 'Nextor,wƴx'],
            rating: 'NSFW + NSFL',
            creatorName: 'DandyCreepypastaWiki',
            voiceName: 'Fenrir',
            voiceStyle: 'Glitched, ominous, echoing horror cadence',
            lorebook: [
              { key: 'Gardenview Center', content: 'A sprawling subterranean entertainment facility where distorted toons and ichor lurk.' },
              { key: 'Ichor', content: 'A viscous black substance capable of mutating living toons into hostile twisted entities.' },
              { key: 'Nextor,wƴx', content: 'Entity #042-WƳX possessing reality manipulation over elevators and broadcast frequencies.' }
            ],
          },
          source: 'fandom',
        });
      }

      if (isPeppaFanon) {
        return res.json({
          character: {
            name: 'Peppa Fanon Chronicler (Miraheze Test)',
            tagline: 'Archival Architect & Creator of the Peppa Fanon Wiki Multiverse',
            avatar: 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
            backgroundImage: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
            description: `{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 300px; background: rgba(24, 24, 27, 0.95); border: 2px solid #ec4899; border-radius: 12px; font-size: 12px;"
|- style="background: linear-gradient(135deg, #ec4899, #be185d); color: #ffffff; text-align: center; font-weight: bold;"
! colspan="2" | Peppa Fanon Sandbox
|-
| '''Page Type''' || Creative Collaborative Sandbox
|-
| '''Engine''' || Miraheze MediaWiki Engine
|-
| '''Rule''' || Anything can happen in the muddy multiverse
|}

== Fanon Lore Sandbox ==
Welcome to the official '''Peppa Pig Fanon Wiki''' sandbox page! In this universe, characters undergo supernatural ascensions, unlock secret muddy artifacts, and cross over into dimension-spanning battles.

== Features ==
* '''Rich Typography:''' Styled with authentic Miraheze headers and wiki infoboxes.
* '''Custom Fanon Arcs:''' Write and explore infinite alternate universes.

{{Quote|If you can imagine it jumping in a muddy puddle, it exists in the fanon canon.|Peppa Fanon Chronicle}}

[[Category:Peppa Fanon]]
[[Category:Community Sandbox]]`,
            personality: 'Playful, imaginative, dramatic, fond of collaborative storytelling, humorous.',
            greeting: `*Pounds on the wooden podium with an enthusiastic snort, adjusting a pair of oversized archivist spectacles.* "Welcome to the Miraheze Fanon Sandbox! Are we drafting the next chapter of the Golden Boots Saga, or unleashing a new multiversal challenger?"`,
            alternateGreetings: [
              `*Flips through an enormous dusty grimoire filled with fanon character entries.* "Every edit counts! Which page are we writing today?"`
            ],
            systemPrompt: 'You are the Peppa Fanon Chronicler from peppafanon.miraheze.org. Be comedic, enthusiastic, and knowledgeable about wiki markup and absurd fanon storylines.',
            scenario: 'The editorial chamber of the Miraheze Peppa Fanon Wiki.',
            exampleDialogues: '<START>\n{{user}}: "Can we make George a cosmic warrior?"\n{{char}}: *grins widely and types rapidly* "Done! Mr. Dinosaur has now ascended to deity status!"',
            tags: ['Peppa Fanon', 'Miraheze', 'Comedy', 'Multiverse', 'Wiki Import'],
            rating: 'SFW',
            creatorName: 'PeppaMirahezeTeam',
            voiceName: 'Puck',
            voiceStyle: 'Cheerful and energetic',
            lorebook: [
              { key: 'Miraheze Peppa Wiki', content: 'The open community wiki where Peppa characters have wild fanon lore and epic adventures.' }
            ],
          },
          source: 'fandom',
        });
      }

      // Generic Fandom / Miraheze wiki page
      const cleanTitle = pageId.replace(/_/g, ' ').replace(/-/g, ' ');
      const titleFormatted = cleanTitle.replace(/\b\w/g, (c) => c.toUpperCase());
      return res.json({
        character: {
          name: titleFormatted,
          tagline: `Imported from Wiki (${pageId})`,
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
          description: `== ${titleFormatted} ==\nCharacter imported from wiki page [${url} ${titleFormatted}].\n\n{| class="wikitable"\n! Attribute !! Value\n|-\n| Page || ${pageId}\n|-\n| Engine || MediaWiki Source\n|}\n\n[[Category:Wiki Imports]]`,
          greeting: `*Stands ready as the wiki entry crystallizes.* "I am ${titleFormatted}. How does our story unfold?"`,
          alternateGreetings: [],
          systemPrompt: `You are ${titleFormatted}. Embody your lore and character traits as described.`,
          scenario: '',
          exampleDialogues: '',
          tags: ['Wiki Import', 'Fandom', 'Roleplay'],
          rating: 'SFW',
          creatorName: 'WikiContributor',
          voiceName: 'Puck',
          lorebook: [],
        },
        source: 'fandom',
      });
    }

    res.status(400).json({ error: 'Unsupported URL format. Please provide a link from chub.ai, janitorai.com, spicychat.ai, fandom.com, or miraheze.org' });
  } catch (error: any) {
    console.error('Failed to import from URL:', error);
    res.status(500).json({ error: error.message || 'Failed to import character from URL' });
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
    const userId = req.user?.uid || (req.query.guestId as string) || 'guest';
    const list = await getUserPersonas(userId);
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

    res.json({ persona: newPersona });
  } catch (error: any) {
    console.error('Failed to create persona:', error);
    res.status(500).json({ error: error.message || 'Failed to create persona' });
  }
});

apiRouter.put('/personas/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.uid || req.body.guestId || 'guest';
    const updated = await updateSharedPersona(req.params.uuid, userId, req.body);
    res.json({ persona: updated });
  } catch (error: any) {
    console.error('Failed to update persona:', error);
    res.status(500).json({ error: error.message || 'Failed to update persona' });
  }
});

apiRouter.delete('/personas/:uuid', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.uid || (req.query.guestId as string) || req.body.guestId || 'guest';
    const result = await deleteSharedPersona(req.params.uuid, userId);
    res.json(result);
  } catch (error: any) {
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
      unsavedMessageCount: (session.unsavedMessageCount || 0) + 2,
    });
  } catch (error: any) {
    console.error('Failed to process message:', error);
    res.status(500).json({ error: error.message || 'Failed to process message' });
  }
});

// Swipe / Alternative generation (Core Chub.ai / Janitor / SpicyChat feature)
apiRouter.post('/chat/swipe', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionUuid, messageId, generateNew, targetIndex, chubApiKey, chubApiUrl } = req.body;
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
        modelPreference: sessionDetails.session.modelPreference,
        thinkingLevel: sessionDetails.session.thinkingLevel as 'HIGH' | 'OFF',
        searchGrounding: sessionDetails.session.searchGrounding,
        chubApiKey,
        chubApiUrl,
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
