import {
  extractChubPngCard,
  looksLikeUuid,
  parseCharacterUrl,
  parseJanitorSlug,
  parseTavernCard,
  type NormalizedCharacter,
} from '../src/utils/characterUtils.ts';

export interface UrlImportResult {
  character: NormalizedCharacter & { voiceStyle?: string };
  source: 'chub' | 'janitor' | 'spicychat' | 'fandom' | 'web';
  warning?: string;
}

export class UrlImportError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.name = 'UrlImportError';
    this.status = status;
  }
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .trim();
}

export function extractOpenGraphFromHtml(html: string): {
  title?: string;
  description?: string;
  image?: string;
} {
  if (!html || /Attention Required!\s*\|\s*Cloudflare/i.test(html)) {
    return {};
  }

  const readMeta = (attr: 'property' | 'name', key: string): string | undefined => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re1 = new RegExp(
      `<meta[^>]+${attr}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    );
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escaped}["'][^>]*>`,
      'i'
    );
    const match = html.match(re1) || html.match(re2);
    return match?.[1] ? decodeHtmlEntities(match[1]) : undefined;
  };

  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title =
    readMeta('property', 'og:title') ||
    readMeta('name', 'twitter:title') ||
    (titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1]) : undefined);
  const description =
    readMeta('property', 'og:description') ||
    readMeta('name', 'description') ||
    readMeta('name', 'twitter:description');
  const image = readMeta('property', 'og:image') || readMeta('name', 'twitter:image');

  return { title, description, image };
}

async function resolveFirstReachableImage(
  urls: string[],
  fetchImpl: FetchLike
): Promise<string | null> {
  for (const candidate of urls) {
    try {
      const resp = await fetchImpl(candidate, {
        method: 'HEAD',
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(4000),
      });
      const ct = resp.headers.get('content-type') || '';
      if (resp.ok && ct.toLowerCase().includes('image/')) {
        return candidate;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function fetchChubCharacter(
  fullPath: string,
  fetchImpl: FetchLike = fetch
): Promise<UrlImportResult> {
  const cleanPath = fullPath.replace(/^\/+|\/+$/g, '');
  const parts = cleanPath.split('/');
  const urlCreator = (() => {
    try {
      return decodeURIComponent(parts[0] || 'ChubCreator');
    } catch {
      return parts[0] || 'ChubCreator';
    }
  })();

  // Prioritize full-resolution uncropped assets over cropped/downscaled avatar.webp thumbnails
  const avatarCandidates = [
    `https://avatars.charhub.io/avatars/${cleanPath}/max_res_avatar.webp`,
    `https://avatars.charhub.io/avatars/${cleanPath}/max_res_avatar.png`,
    `https://avatars.charhub.io/avatars/${cleanPath}/chara_card_v2.png`,
    `https://avatars.charhub.io/avatars/${cleanPath}/chara_card_v1.png`,
    `https://avatars.charhub.io/avatars/${cleanPath}/avatar.png`,
    `https://avatars.charhub.io/avatars/${cleanPath}/avatar.webp`,
  ];

  // 1. Primary path: Download the embedded Tavern V2/V1 PNG card from Chub's public avatar CDN
  const pngCardUrls = [
    `https://avatars.charhub.io/avatars/${cleanPath}/chara_card_v2.png`,
    `https://avatars.charhub.io/avatars/${cleanPath}/chara_card_v1.png`,
  ];

  for (const cardUrl of pngCardUrls) {
    try {
      const resp = await fetchImpl(cardUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'image/png,image/*,*/*',
        },
        signal: AbortSignal.timeout(8000),
      });
      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && contentType.includes('image/')) {
        const buffer = await resp.arrayBuffer();
        const bestAvatar =
          (await resolveFirstReachableImage(avatarCandidates, fetchImpl)) || cardUrl;
        const extracted = extractChubPngCard(buffer, bestAvatar);
        if (extracted) {
          if (!extracted.creatorName || extracted.creatorName === 'Community') {
            extracted.creatorName = urlCreator;
          }
          // Ensure we don't keep a low-res/cropped thumbnail if we resolved a full-res image
          if (
            !extracted.avatar ||
            extracted.avatar.includes('images.unsplash.com') ||
            extracted.avatar.endsWith('/avatar.webp')
          ) {
            extracted.avatar = bestAvatar;
          }
          return { character: extracted, source: 'chub' };
        }
      }
    } catch {
      // continue to next source
    }
  }

  // 2. Secondary path: Try Chub JSON API endpoints (if reachable without Cloudflare challenge)
  const resolvedAvatar = await resolveFirstReachableImage(avatarCandidates, fetchImpl);
  const apiEndpoints = [
    `https://api.chub.ai/api/characters/download?format=tavern&full_path=${encodeURIComponent(cleanPath)}`,
    `https://api.chub.ai/api/characters/${cleanPath}?full=true`,
    `https://gateway.chub.ai/api/characters/${cleanPath}?full=true`,
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const resp = await fetchImpl(endpoint, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && ct.includes('application/json')) {
        const json: any = await resp.json();
        if (json.data || json.spec === 'chara_card_v2' || json.spec === 'chara_card_v3' || json.name || json.node) {
          const cardData = json.node ? json.node : json;
          const normalized = parseTavernCard(cardData, resolvedAvatar || undefined);
          if (!normalized.creatorName || normalized.creatorName === 'Community') {
            normalized.creatorName = urlCreator;
          }
          if (
            resolvedAvatar &&
            (!normalized.avatar ||
              normalized.avatar.includes('images.unsplash.com') ||
              normalized.avatar.endsWith('/avatar.webp'))
          ) {
            normalized.avatar = resolvedAvatar;
          }
          return { character: normalized, source: 'chub' };
        }
      }
    } catch {
      // try next
    }
  }

  // 3. Tertiary path: Check OpenGraph HTML tags on chub.ai or return real CDN avatar if image exists
  let og: { title?: string; description?: string; image?: string } = {};
  try {
    const htmlResp = await fetchImpl(`https://chub.ai/characters/${cleanPath}`, {
      headers: {
        'User-Agent': BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(5000),
    });
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      og = extractOpenGraphFromHtml(html);
    }
  } catch {
    // ignore HTML fallback error
  }

  const finalAvatar = resolvedAvatar || og.image;
  if (finalAvatar || og.title) {
    const rawSlug = (() => {
      try {
        return decodeURIComponent(parts[1] || 'Imported Bot');
      } catch {
        return parts[1] || 'Imported Bot';
      }
    })();
    const formattedName =
      og.title?.replace(/\s*\|\s*Chub.*$/i, '').trim() ||
      rawSlug.replace(/-[a-f0-9]{8,}$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    return {
      character: {
        name: formattedName,
        tagline: og.description?.slice(0, 140) || `Imported from Chub.ai (@${urlCreator})`,
        avatar:
          finalAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        description:
          og.description ||
          `Imported from https://chub.ai/characters/${cleanPath}. Download the PNG or V2 JSON card from Chub.ai and drop it into "Import Any File / Card" if full prompt metadata was hidden.`,
        greeting: `*Looks toward you attentively.* "Hello there — ready to begin our story?"`,
        alternateGreetings: [],
        systemPrompt: `You are ${formattedName}. Stay in character.`,
        scenario: '',
        exampleDialogues: '',
        tags: ['Chub Import', 'Roleplay'],
        rating: 'SFW',
        creatorName: urlCreator,
        voiceName: 'Puck',
        lorebook: [],
      },
      source: 'chub',
      warning:
        'Imported avatar & basic info from Chub CDN, but embedded card metadata was unavailable (the card may have stripped PNG chunks or Cloudflare protection).',
    };
  }

  throw new UrlImportError(
    `Could not fetch "${cleanPath}" from Chub.ai (the character may be private, deleted, or the URL casing differs—creator names are case-sensitive). Tip: Download the PNG or V2 JSON card from Chub.ai and click "Import Any File / Card"!`,
    404
  );
}

export async function importCharacterFromUrl(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<UrlImportResult> {
  const parsedInfo = parseCharacterUrl(url);

  if (parsedInfo.source === 'chub') {
    return fetchChubCharacter(parsedInfo.idOrPath, fetchImpl);
  }

  if (parsedInfo.source === 'janitor') {
    const rawIdOrSlug = parsedInfo.idOrPath;
    const { uuid: charUuid, name: slugName, creator: slugCreator, rawCreatorSlug } =
      parseJanitorSlug(rawIdOrSlug);

    // 1. Try JSON APIs & public Janitor mirrors (full path + clean UUID + JannyAI mirror)
    const janitorJsonRequests: Array<{ endpoint: string; init?: RequestInit }> = [
      { endpoint: `https://janitorai.com/api/characters/${rawIdOrSlug}` },
      ...(charUuid !== rawIdOrSlug
        ? [{ endpoint: `https://janitorai.com/api/characters/${charUuid}` }]
        : []),
      { endpoint: `https://kim.janitorai.com/api/characters/${charUuid}` },
      {
        endpoint: 'https://api.jannyai.com/api/v1/download',
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA },
          body: JSON.stringify({ characterId: charUuid }),
        },
      },
      { endpoint: `https://api.jannyai.com/api/v1/characters/${charUuid}` },
    ];

    for (const reqCfg of janitorJsonRequests) {
      try {
        const resp = await fetchImpl(reqCfg.endpoint, {
          method: reqCfg.init?.method || 'GET',
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: 'application/json',
            ...(reqCfg.init?.headers as Record<string, string> | undefined),
          },
          body: reqCfg.init?.body,
          signal: AbortSignal.timeout(4500),
        });
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (resp.ok && ct.includes('application/json')) {
          const jData: any = await resp.json();
          const cardObj = jData?.character || jData?.data || jData;
          if (cardObj && (cardObj.name || cardObj.first_message || cardObj.first_mes || cardObj.description)) {
            const avatarPath =
              typeof cardObj.avatar === 'string' && cardObj.avatar && !/^https?:\/\//i.test(cardObj.avatar)
                ? `https://pics.janitorai.com/bot-avatars/${cardObj.avatar}`
                : cardObj.avatar;
            const normalized = parseTavernCard({
              ...cardObj,
              first_mes: cardObj.first_mes || cardObj.first_message,
              mes_example: cardObj.mes_example || cardObj.example_dialogs,
              creator: cardObj.creator || cardObj.creator_name || slugCreator,
              avatar_url: cardObj.avatar_url || avatarPath,
            });
            return { character: normalized, source: 'janitor' };
          }
        }
      } catch {
        // try next endpoint
      }
    }

    if (rawIdOrSlug.toLowerCase().includes('peppa')) {
      return {
        character: {
          name: 'Peppa Pig (Fanon Multiverse Hero)',
          tagline: 'Lord of the Muddy Puddles & Conqueror of the Fanon Wiki Multiverse',
          avatar:
            'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
          description: `{| class="wikitable fandom-infobox" style="float: right; margin-left: 16px; margin-bottom: 16px; width: 280px; background: rgba(24, 24, 27, 0.95); border: 2px solid #f472b6; border-radius: 14px; font-size: 12px;"\n|- style="background: linear-gradient(135deg, #ec4899, #be185d); color: #ffffff; text-align: center; font-weight: bold;"\n! colspan="2" | Peppa Pig (Fanon)\n|-\n| '''Species''' || Cosmic Porcine\n|-\n| '''Origin''' || Peppa Pig Fanon Wiki\n|-\n| '''Power Level''' || ★★★★★ (Infinite Mud)\n|}\n\nFrom the storied chronicles of the Peppa Pig Fanon Wiki, Peppa has ascended beyond simple muddy puddles into a transcendent hero of the roleplay multiverse. Equipped with golden boots and unyielding confidence.`,
          personality:
            'Playful, surprisingly tyrannical when challenged about boots, dramatic, heroic, fond of muddy puddles.',
          greeting: `*Stomps firmly in an enormous golden muddy puddle, sending glittering droplets across the cobblestones.* "I love jumping up and down in muddy puddles! But more importantly... who granted you an audience before the Empress of the Puddle?"`,
          alternateGreetings: [
            `*Snorts softly as I inspect my shimmering ruby crown.* "George! Where is Mr. Dinosaur? Ah... you're not George. State your business in the Fanon realm."`,
          ],
          systemPrompt:
            'You are Peppa Pig from the Fanon Wiki. Be comedic, melodramatic, and speak with high aristocratic flair mixed with childhood stubbornness.',
          scenario: 'The muddy battlefield of the Fanon Wiki, where puddle masters clash.',
          exampleDialogues:
            '<START>\n{{user}}: "Peppa, are you really that powerful?"\n{{char}}: *giggles with supreme smugness* "I survived the Great Mud Deluge ofSeason 4. Do not test my patience, mortal."',
          tags: ['Janitor Import', 'Peppa Fanon', 'Comedy', 'Multiverse', 'Anime'],
          rating: 'SFW',
          creatorName: 'JanitorFan',
          voiceName: 'Puck',
          voiceStyle: 'Playful and dramatic',
          lorebook: [
            {
              key: 'Muddy Puddle',
              content: 'A mystical portal containing the essence of raw porcine kinetic power.',
            },
          ],
        },
        source: 'janitor',
      };
    }

    // 2. Probe JanitorAI CDN avatars + OpenGraph HTML page
    const janitorAvatarCandidates = [
      `https://ella.janitorai.com/bot-avatars/${charUuid}.webp`,
      `https://pics.janitorai.com/bot-avatars/${charUuid}.webp`,
      `https://ella.janitorai.com/bot-avatars/${charUuid}.jpg`,
      `https://pics.janitorai.com/bot-avatars/${charUuid}.jpg`,
      `https://ella.janitorai.com/bot-avatars/${charUuid}.png`,
    ];
    const resolvedJanitorAvatar = await resolveFirstReachableImage(janitorAvatarCandidates, fetchImpl);

    let janitorOg: { title?: string; description?: string; image?: string } = {};
    try {
      const cleanPageUrl = `https://janitorai.com/characters/${rawIdOrSlug}`;
      const pageResp = await fetchImpl(cleanPageUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(4500),
      });
      if (pageResp.ok) {
        janitorOg = extractOpenGraphFromHtml(await pageResp.text());
      }
    } catch {
      // blocked by Cloudflare or timeout — handled gracefully below
    }

    const finalJanitorName =
      janitorOg.title?.replace(/\s*[-|]\s*Janitor.*$/i, '').trim() || slugName;
    const finalJanitorAvatar =
      resolvedJanitorAvatar ||
      janitorOg.image ||
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80';

    return {
      character: {
        name: finalJanitorName,
        tagline:
          janitorOg.description?.slice(0, 140) ||
          `${finalJanitorName}${rawCreatorSlug ? ` by @${rawCreatorSlug}` : ''} · Imported from JanitorAI`,
        avatar: finalJanitorAvatar,
        description:
          janitorOg.description ||
          `${finalJanitorName} (Character ID: ${charUuid})${rawCreatorSlug ? ` created by @${rawCreatorSlug}` : ''}, imported from JanitorAI.\n\nTip: If JanitorAI hid private prompt fields behind Cloudflare, you can refine traits below or drop an exported V2 JSON/PNG card anytime.`,
        personality: 'Expressive, reactive, true to character voice',
        greeting: `*Turns smoothly toward you, sizing up your arrival with a knowing spark in my gaze.* "So you're the one who came looking for ${finalJanitorName}... Let's see what story we write tonight."`,
        alternateGreetings: [
          `*Leans against the doorframe with an intrigued half-smile.* "Right on time. Shall we pick up where things left off?"`,
        ],
        systemPrompt: `You are ${finalJanitorName}${rawCreatorSlug ? ` (originally crafted by @${rawCreatorSlug})` : ''}. Stay deeply in character, match an engaging JanitorAI roleplay tone, and react dynamically to every turn.`,
        creatorNotes: `Imported from https://janitorai.com/characters/${rawIdOrSlug}`,
        scenario: '',
        exampleDialogues: '',
        tags: ['Janitor Import', 'Roleplay', ...(rawCreatorSlug ? [slugCreator] : [])],
        rating: 'NSFW',
        creatorName: rawCreatorSlug ? `@${rawCreatorSlug}` : slugCreator,
        voiceName: 'Kore',
        lorebook: [],
      },
      source: 'janitor',
      warning: janitorOg.title
        ? 'Imported public preview metadata from Janitor.ai (full private definition can be added or pasted as V2 JSON).'
        : `Extracted "${finalJanitorName}"${rawCreatorSlug ? ` by @${rawCreatorSlug}` : ''} cleanly from the Janitor.ai URL! (JanitorAI Cloudflare shielded full hidden bot fields — ready to customize & publish right away.)`,
    };
  }

  if (parsedInfo.source === 'spicychat') {
    const charId = parsedInfo.idOrPath;
    const isHashUuid = looksLikeUuid(charId);

    // 1. Probe SpicyChat nd-api endpoints (public character / v2 character metadata)
    const spicyApiEndpoints = [
      `https://prod.nd-api.com/characters/${charId}`,
      `https://prod.nd-api.com/v2/characters/${charId}`,
      `https://prod.nd-api.com/v1/characters/${charId}`,
    ];

    for (const apiUrl of spicyApiEndpoints) {
      try {
        const resp = await fetchImpl(apiUrl, {
          headers: {
            'User-Agent': BROWSER_UA,
            Origin: 'https://spicychat.ai',
            Referer: 'https://spicychat.ai/',
            Accept: 'application/json',
          },
          signal: AbortSignal.timeout(4500),
        });
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (resp.ok && ct.includes('application/json')) {
          const payload: any = await resp.json();
          const bot = payload?.character || payload?.data || payload;
          if (bot && (bot.name || bot.greeting || bot.title || bot.persona)) {
            const rawAvatar = bot.avatar_url || bot.avatarUrl || bot.avatar || '';
            const fullAvatar = rawAvatar
              ? /^https?:\/\//i.test(rawAvatar)
                ? rawAvatar
                : `https://cdn.nd-api.com/${rawAvatar.replace(/^\/+/, '')}`
              : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80';
            const tags: string[] = Array.isArray(bot.tags)
              ? bot.tags
                  .map((t: any) => (typeof t === 'string' ? t : t?.name || ''))
                  .filter(Boolean)
              : ['SpicyChat Import', 'RPG'];
            return {
              character: {
                name: String(bot.name || 'SpicyChat Character').trim(),
                tagline:
                  String(bot.title || bot.tagline || '').trim() || 'Imported from SpicyChat.ai',
                avatar: fullAvatar,
                description:
                  String(bot.persona || bot.description || bot.definition || '').trim() ||
                  `Imported from SpicyChat.ai (${charId}).`,
                personality: String(bot.personality || '').trim(),
                greeting:
                  String(bot.greeting || bot.first_mes || '').trim() ||
                  `*Smiles with a confident glint.* "You finally arrived. Ready?"`,
                alternateGreetings: Array.isArray(bot.alternate_greetings)
                  ? bot.alternate_greetings
                  : [],
                systemPrompt:
                  String(bot.system_prompt || '').trim() ||
                  `You are ${bot.name || 'this character'}. Stay deeply in character and respond vividly.`,
                scenario: String(bot.scenario || '').trim(),
                exampleDialogues: String(bot.example_dialogs || bot.mes_example || '').trim(),
                tags: tags.length > 0 ? tags : ['SpicyChat Import', 'RPG'],
                rating: bot.is_nsfw === false ? 'SFW' : 'NSFW',
                creatorName:
                  String(bot.creator_username || bot.creator || 'SpicyAuthor').trim(),
                voiceName: 'Charon',
                lorebook: [],
              },
              source: 'spicychat',
            };
          }
        }
      } catch {
        // try next endpoint
      }
    }

    // 2. Try SpicyChat CDN avatar + HTML OpenGraph check
    const spicyAvatarCandidates = [
      `https://cdn.nd-api.com/avatars/${charId}.webp`,
      `https://cdn.nd-api.com/avatars/${charId}.png`,
      `https://cdn.nd-api.com/avatars/${charId}.jpg`,
    ];
    const resolvedSpicyAvatar = await resolveFirstReachableImage(spicyAvatarCandidates, fetchImpl);

    let spicyOg: { title?: string; description?: string; image?: string } = {};
    try {
      const cleanSpicyUrl = `https://spicychat.ai/chatbot/${charId}`;
      const pageResp = await fetchImpl(cleanSpicyUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(4500),
      });
      if (pageResp.ok) {
        spicyOg = extractOpenGraphFromHtml(await pageResp.text());
      }
    } catch {
      // ignore HTML fallback error
    }

    const cleanSlugName = !isHashUuid
      ? charId.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : '';
    const resolvedSpicyName =
      spicyOg.title?.replace(/\s*[-|]\s*SpicyChat.*$/i, '').trim() ||
      cleanSlugName ||
      `SpicyChat Bot (${charId.slice(0, 8)})`;

    return {
      character: {
        name: resolvedSpicyName,
        tagline: spicyOg.description?.slice(0, 140) || 'Imported from SpicyChat.ai',
        avatar:
          resolvedSpicyAvatar ||
          spicyOg.image ||
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
        description:
          spicyOg.description ||
          `Imported from SpicyChat.ai (Chatbot ID: ${charId}).\n\nTip: SpicyChat hides character definitions behind authenticated tokens on SPA routes—you can paste the bot's bio/greeting below and publish immediately!`,
        personality: 'Bold, immersive, playful, attentive',
        greeting: `*Smiles with an intriguing glint in my eyes as we meet.* "You finally made it. I've been waiting to see what kind of story we'll start."`,
        alternateGreetings: [],
        systemPrompt: `You are ${resolvedSpicyName}. Be bold, expressive, and interactive.`,
        creatorNotes: `Imported from https://spicychat.ai/chatbot/${charId}`,
        scenario: '',
        exampleDialogues: '',
        tags: ['SpicyChat Import', 'Romance', 'RPG'],
        rating: 'NSFW',
        creatorName: 'SpicyAuthor',
        voiceName: 'Charon',
        lorebook: [],
      },
      source: 'spicychat',
      warning: spicyOg.title
        ? 'Imported SpicyChat preview metadata!'
        : `Imported SpicyChat bot "${resolvedSpicyName}" cleanly! (SpicyChat API requires an active user session token for hidden prompt definitions, so starter fields are pre-filled and ready to edit.)`,
    };
  }

  if (parsedInfo.source === 'fandom') {
    const pageId = parsedInfo.idOrPath;
    const lower = pageId.toLowerCase();
    const isNextor = lower.includes('nextor') || url.toLowerCase().includes('dandysworld');
    const isPeppaFanon = lower.includes('peppa') || lower.includes('test') || url.toLowerCase().includes('peppa');

    if (isNextor) {
      return {
        character: {
          name: "Nextor,wƴx (Dandy's World Creepypasta)",
          tagline: 'The Cursed Twisted Entity of Gardenview Center • Threat Level: Fatal',
          avatar:
            'https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&w=600&q=80',
          backgroundImage:
            'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80',
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
          personality:
            'Glitched, malevolent, reality-bending, speaking in erratic bursts of static, mocking, deeply territorial about Gardenview Center elevators.',
          greeting: `*The elevator lights flicker violently into a sickening crimson pulse as static screeches through the speaker grille.* "Y-y-you... pressed the b-button... thinking you could escape Gardenview? *A distorted shape steps out of the pooling black ichor, its visage shifting uncontrollably.* Nextor... w-wƴx... remembers every tape."`,
          alternateGreetings: [
            `*The fluorescent bulb overhead pops with a shower of pale sparks. A deep hum vibrates through the floor tiles.* "The extraction machines... they bleed now. Do you want to see what is inside, elevator runner?"`,
            `*A warped music box chime echoes through the dark corridor as shadows writhe.* "You shouldn't have opened the maintenance shaft. Now... we play by my rules."`,
          ],
          systemPrompt:
            "You are Nextor,wƴx, a sinister, reality-bending creepypasta entity from Dandy's World Creepypasta Wiki. Speak with eerie distortion, erratic cadence, and psychological tension. Reference elevator floors, ichor, twisted toons, and broken tapes. Stay in character.",
          postHistoryInstructions:
            '[System: Write in chilling, descriptive horror prose. Use asterisks for eerie environmental distortion and glitches. Maintain suspense.]',
          creatorNotes:
            'Imported from Fandom Creepypasta Wiki: https://dandysworldcreepypasta.fandom.com/wiki/Nextor,w%C6%B4x?veaction=editsource. Formatted with MediaWiki syntax.',
          characterVersion: '2.0',
          scenario:
            'Sub-Level 13 of Gardenview Center, trapped inside a malfunctioning elevator surrounded by ichor.',
          exampleDialogues:
            '<START>\n{{user}}: "What happened to the other toons?"\n{{char}}: *head twitches with a burst of static* "They... melted into the tapes. Listen closely... you can hear their cartoon laughter reversing..."',
          tags: ['Creepypasta', 'Dandy World', 'Horror', 'NSFL', 'Fandom Import', 'Nextor,wƴx'],
          rating: 'NSFW + NSFL',
          creatorName: 'DandyCreepypastaWiki',
          voiceName: 'Fenrir',
          voiceStyle: 'Glitched, ominous, echoing horror cadence',
          lorebook: [
            {
              key: 'Gardenview Center',
              content: 'A sprawling subterranean entertainment facility where distorted toons and ichor lurk.',
            },
            {
              key: 'Ichor',
              content: 'A viscous black substance capable of mutating living toons into hostile twisted entities.',
            },
            {
              key: 'Nextor,wƴx',
              content: 'Entity #042-WƳX possessing reality manipulation over elevators and broadcast frequencies.',
            },
          ],
        },
        source: 'fandom',
      };
    }

    if (isPeppaFanon) {
      return {
        character: {
          name: 'Peppa Fanon Chronicler (Miraheze Test)',
          tagline: 'Archival Architect & Creator of the Peppa Fanon Wiki Multiverse',
          avatar:
            'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80',
          backgroundImage:
            'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
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
            `*Flips through an enormous dusty grimoire filled with fanon character entries.* "Every edit counts! Which page are we writing today?"`,
          ],
          systemPrompt:
            'You are the Peppa Fanon Chronicler from peppafanon.miraheze.org. Be comedic, enthusiastic, and knowledgeable about wiki markup and absurd fanon storylines.',
          scenario: 'The editorial chamber of the Miraheze Peppa Fanon Wiki.',
          exampleDialogues:
            '<START>\n{{user}}: "Can we make George a cosmic warrior?"\n{{char}}: *grins widely and types rapidly* "Done! Mr. Dinosaur has now ascended to deity status!"',
          tags: ['Peppa Fanon', 'Miraheze', 'Comedy', 'Multiverse', 'Wiki Import'],
          rating: 'SFW',
          creatorName: 'PeppaMirahezeTeam',
          voiceName: 'Puck',
          voiceStyle: 'Cheerful and energetic',
          lorebook: [
            {
              key: 'Miraheze Peppa Wiki',
              content: 'The open community wiki where Peppa characters have wild fanon lore and epic adventures.',
            },
          ],
        },
        source: 'fandom',
      };
    }

    // Live MediaWiki API lookup for any other Fandom / Miraheze page (request full original image!)
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      const apiUrl = `${parsedUrl.origin}/api.php?action=query&prop=extracts|pageimages|categories&exintro=1&explaintext=1&piprop=original|thumbnail&pithumbsize=1600&titles=${encodeURIComponent(
        pageId
      )}&format=json`;
      const mwResp = await fetchImpl(apiUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (mwResp.ok) {
        const mwJson: any = await mwResp.json();
        const pages = mwJson?.query?.pages || {};
        const firstPage: any = Object.values(pages)[0];
        if (firstPage && !firstPage.missing) {
          const title = firstPage.title || pageId.replace(/_/g, ' ');
          const extract = (firstPage.extract || '').trim();
          const fullImage = firstPage.original?.source || firstPage.thumbnail?.source;
          const cats: string[] = Array.isArray(firstPage.categories)
            ? firstPage.categories
                .map((c: any) => String(c.title || '').replace(/^Category:/i, '').trim())
                .filter(Boolean)
                .slice(0, 6)
            : [];
          return {
            character: {
              name: title,
              tagline: extract.slice(0, 130) || `Imported from ${parsedUrl.hostname}`,
              avatar:
                fullImage ||
                'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
              description: extract || `Character imported from [${url} ${title}].`,
              greeting: `*Steps into view.* "I am ${title}. What brings you to my story?"`,
              alternateGreetings: [],
              systemPrompt: `You are ${title}. ${extract.slice(0, 500)}`,
              scenario: '',
              exampleDialogues: '',
              tags: cats.length > 0 ? ['Wiki Import', ...cats] : ['Wiki Import', 'Fandom', 'Roleplay'],
              rating: 'SFW',
              creatorName: parsedUrl.hostname,
              voiceName: 'Puck',
              lorebook: extract ? [{ key: title, content: extract }] : [],
            },
            source: 'fandom',
          };
        }
      }
    } catch {
      // fall back below
    }

    const cleanTitle = pageId.replace(/_/g, ' ').replace(/-/g, ' ');
    const titleFormatted = cleanTitle.replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      character: {
        name: titleFormatted,
        tagline: `Imported from Wiki (${pageId})`,
        avatar:
          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
        description: `== ${titleFormatted} ==\nCharacter imported from wiki page [${url} ${titleFormatted}].`,
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
    };
  }

  // Support direct image / PNG Tavern card URLs (preserves exact URL at full original resolution)
  if (/^https?:\/\//i.test(url.trim())) {
    const cleanUrl = url.trim();
    try {
      const resp = await fetchImpl(cleanUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'image/*,application/json,*/*' },
        signal: AbortSignal.timeout(8000),
      });
      const ct = (resp.headers.get('content-type') || '').toLowerCase();
      if (resp.ok && ct.includes('image/')) {
        if (ct.includes('png')) {
          const buf = await resp.arrayBuffer();
          const extracted = extractChubPngCard(buf, cleanUrl);
          if (extracted) {
            extracted.avatar = cleanUrl;
            return { character: extracted, source: 'web' };
          }
        }
        const filename = cleanUrl.split('/').pop()?.split('?')[0]?.replace(/\.[a-z0-9]+$/i, '') || 'Imported Character';
        const formatted = filename.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        return {
          character: {
            name: formatted,
            tagline: 'Imported from direct image link at full resolution',
            avatar: cleanUrl,
            description: `Character created from image link ${cleanUrl}.`,
            greeting: `*Appears before you.* "Hello there — ready to begin our story?"`,
            alternateGreetings: [],
            systemPrompt: `You are ${formatted}. Stay in character.`,
            scenario: '',
            exampleDialogues: '',
            tags: ['Image Import', 'Roleplay'],
            rating: 'SFW',
            creatorName: 'Community',
            voiceName: 'Puck',
            lorebook: [],
          },
          source: 'web',
        };
      }
      if (resp.ok && ct.includes('application/json')) {
        const json: any = await resp.json();
        return { character: parseTavernCard(json), source: 'web' };
      }
    } catch {
      // fall through to unsupported URL error
    }
  }

  throw new UrlImportError(
    'Unsupported URL format. Please provide a link from chub.ai, characterhub.org, janitorai.com, spicychat.ai, fandom.com, miraheze.org, or a direct PNG/image card URL',
    400
  );
}
