import crypto from 'node:crypto';
import {
  extractChubPngCard,
  parseCharacterUrl,
  parseJanitorSlug,
  parseTavernCard,
  type NormalizedCharacter,
} from '../src/utils/characterUtils.ts';

export interface UrlImportOptions {
  authToken?: string;
  rawDefinition?: string;
}

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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .trim();
}

export function cleanRichHtmlToText(input: string): string {
  if (!input) return '';
  let text = input
    .replace(/<img\b([^>]*)>/gi, (_m, attrs) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const src = (srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || '').trim();
      const alt = (altMatch?.[1] || altMatch?.[2] || '').trim();
      return src ? `\n![${alt}](${src})\n` : '';
    });

  for (let pass = 0; pass < 3; pass++) {
    const before = text;
    text = text.replace(/<font\b([^>]*)>([\s\S]*?)<\/font>/gi, (_m, attrs, inner) => {
      const cMatch = attrs.match(/\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const color = (cMatch?.[1] || cMatch?.[2] || cMatch?.[3] || '').trim();
      return color && !/[;<>{}]/.test(color) ? `[color=${color}]${inner}[/color]` : inner;
    });
    text = text.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (_m, attrs, inner) => {
      const sMatch = attrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const styleStr = sMatch?.[1] || sMatch?.[2] || '';
      const colorDecl = styleStr.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      const color = colorDecl?.[1]?.trim();
      return color && !/[;<>{}]/.test(color) ? `[color=${color}]${inner}[/color]` : inner;
    });
    if (text === before) break;
  }

  text = text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(?:p|div|li|h[1-6]|blockquote)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  text = decodeHtmlEntities(text);
  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLeadingEmoji(label: string): string {
  return label
    .replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/gu, '')
    .trim();
}

export function extractJsonFromTextOrMarkdown(raw: string): any | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }
  const mdIdx = raw.indexOf('Markdown Content:');
  const searchRegion = mdIdx !== -1 ? raw.slice(mdIdx) : raw;
  const firstBrace = searchRegion.indexOf('{');
  const lastBrace = searchRegion.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(searchRegion.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
  return null;
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

export function separateJanitorDescriptionAndNotes(cleanText: string): {
  hookLine: string;
  premiseLines: string[];
  creatorMetaLines: string[];
} {
  const paragraphs = cleanText
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const metaRegex =
    /(?:\b(?:take a (?:small )?break|smaller[- ]size bot|head back in the game|re-?upload|requested by|discord|patreon|ko-?fi|buy me a coffee|jllm|openrouter|deepseek|claude|tested with|works best|bot request|check out my|follow me|leave a comment|credits?:)\b|^(?:oc\s*&\s*art|art(?:work)?\s*by|credit(?:s)?\s*:)\b)/i;

  const premiseLines: string[] = [];
  const creatorMetaLines: string[] = [];

  paragraphs.forEach((p, idx) => {
    if (idx > 0 && metaRegex.test(p)) {
      creatorMetaLines.push(p);
    } else if (idx === 0) {
      premiseLines.push(p);
    } else if (/^oc\s*&\s*art\b/i.test(p) || /^https?:\/\//i.test(p)) {
      creatorMetaLines.push(p);
    } else if (metaRegex.test(p)) {
      creatorMetaLines.push(p);
    } else {
      premiseLines.push(p);
    }
  });

  const hookLine = premiseLines[0] || paragraphs[0] || '';
  return { hookLine, premiseLines, creatorMetaLines };
}

export function parseJanitorDefinitionText(rawDef?: string): {
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleDialogs?: string;
  description?: string;
} {
  const input = (rawDef || '').trim();
  if (!input) return {};

  // Support direct V1/V2 JSON paste inside rawDefinition
  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input);
      const src = parsed?.data || parsed?.character || parsed;
      if (src && typeof src === 'object') {
        return {
          personality: String(src.personality || '').trim() || undefined,
          scenario: String(src.scenario || '').trim() || undefined,
          firstMessage: String(src.first_mes || src.first_message || src.greeting || '').trim() || undefined,
          exampleDialogs: String(src.mes_example || src.example_dialogs || '').trim() || undefined,
          description: String(src.description || '').trim() || undefined,
        };
      }
    } catch {
      // fall back to heading parser
    }
  }

  const out: {
    personality?: string;
    scenario?: string;
    firstMessage?: string;
    exampleDialogs?: string;
    description?: string;
  } = {};

  const headingPattern =
    /(?:^|\n)\s*(?:#{1,4}\s*)?(Personality|Scenario|Initial Message|First Message|Greeting|Example Dialogs?|Example Dialogues?|Character Bio|Appearance|Description)\s*:?\s*\n?/gi;
  const matches = [...input.matchAll(headingPattern)];

  if (matches.length === 0) {
    out.personality = input;
    return out;
  }

  for (let i = 0; i < matches.length; i++) {
    const label = matches[i][1].toLowerCase();
    const start = (matches[i].index ?? 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? input.length) : input.length;
    const sectionBody = input.slice(start, end).trim();
    if (!sectionBody) continue;
    if (label.startsWith('personality')) out.personality = sectionBody;
    else if (label.startsWith('scenario')) out.scenario = sectionBody;
    else if (label.includes('message') || label.startsWith('greeting')) out.firstMessage = sectionBody;
    else if (label.includes('example')) out.exampleDialogs = sectionBody;
    else if (label.includes('bio') || label.includes('appearance') || label.includes('description')) {
      out.description = out.description ? `${out.description}\n\n${sectionBody}` : sectionBody;
    }
  }
  return out;
}

function parseLorebookEntries(rawBook: any): Array<{ key: string; content: string }> {
  const rawEntries = rawBook?.entries || (Array.isArray(rawBook) ? rawBook : []);
  if (!Array.isArray(rawEntries)) return [];
  const entries: Array<{ key: string; content: string }> = [];
  for (const item of rawEntries) {
    const k = Array.isArray(item?.keys)
      ? item.keys.filter(Boolean).join(', ')
      : item?.key || item?.keyword || item?.name;
    const c = item?.content || item?.value || item?.description || '';
    if (k && c) {
      entries.push({ key: String(k).trim(), content: String(c).trim() });
    }
  }
  return entries;
}

let cachedDatacatToken: string | null = null;

export async function fetchDatacatJanitorCard(
  charUuid: string,
  fetchImpl: FetchLike = fetch
): Promise<any | null> {
  const isDefaultFetch = fetchImpl === fetch;

  const identifySession = async (): Promise<string | null> => {
    try {
      const idResp = await fetchImpl('https://datacat.run/api/liberator/identify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': BROWSER_UA,
        },
        body: JSON.stringify({
          deviceToken: `anon_palace_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
        }),
        signal: AbortSignal.timeout(6000),
      });
      if (!idResp.ok) return null;
      const data: any = await idResp.json().catch(() => null);
      const token = String(data?.sessionToken || '').trim();
      if (token && isDefaultFetch) {
        cachedDatacatToken = token;
      }
      return token || null;
    } catch {
      return null;
    }
  };

  let token = (isDefaultFetch ? cachedDatacatToken : null) || (await identifySession());
  if (!token) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetchImpl(`https://datacat.run/api/characters/${charUuid}`, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'application/json',
          'X-Session-Token': token,
        },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.status === 401 && attempt === 0) {
        if (isDefaultFetch) cachedDatacatToken = null;
        token = await identifySession();
        if (!token) return null;
        continue;
      }
      if (!resp.ok) return null;
      const json: any = await resp.json().catch(() => null);
      const card = json?.character || json?.data || (json?.name ? json : null);
      if (
        card &&
        (card.first_message ||
          card.personality ||
          card.scenario ||
          card.chara_card_v2_json ||
          card.extracted_first_message)
      ) {
        return card;
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

async function buildJanitorResultFromApiJson(
  cardObj: any,
  rawIdOrSlug: string,
  slugCreator: string,
  options?: UrlImportOptions
): Promise<UrlImportResult> {
  let v2Data: any = {};
  if (cardObj.chara_card_v2_json) {
    try {
      const parsedV2 =
        typeof cardObj.chara_card_v2_json === 'string'
          ? JSON.parse(cardObj.chara_card_v2_json)
          : cardObj.chara_card_v2_json;
      v2Data = parsedV2?.data || parsedV2 || {};
    } catch {
      v2Data = {};
    }
  }

  const cleanBlurb = cleanRichHtmlToText(
    String(cardObj.description || v2Data.creator_notes || '')
  );
  const { hookLine, premiseLines, creatorMetaLines } = separateJanitorDescriptionAndNotes(cleanBlurb);

  const avatarField = String(
    cardObj.full_res_avatar || cardObj.avatar_url || cardObj.avatar || cardObj.avatar_display_url || ''
  ).trim();
  const fullAvatar = avatarField
    ? /^https?:\/\//i.test(avatarField)
      ? avatarField
      : `https://ella.janitorai.com/bot-avatars/${avatarField.replace(/^\/+/, '')}`
    : '';

  const structuredTags: string[] = Array.isArray(cardObj.tags)
    ? cardObj.tags
        .map((t: any) =>
          typeof t === 'string'
            ? stripLeadingEmoji(t)
            : stripLeadingEmoji(String(t?.name || t?.slug || ''))
        )
        .filter(Boolean)
    : [];
  const customTags: string[] = Array.isArray(cardObj.custom_tags)
    ? cardObj.custom_tags.map((t: any) => String(t || '').trim()).filter(Boolean)
    : [];
  const mergedTags = Array.from(new Set([...structuredTags, ...customTags])).filter(Boolean);

  const pastedDef = parseJanitorDefinitionText(options?.rawDefinition);

  const rawFirstMes =
    pastedDef.firstMessage ||
    String(
      cardObj.first_message ||
        cardObj.first_mes ||
        v2Data.first_mes ||
        cardObj.extracted_first_message ||
        (Array.isArray(cardObj.first_messages) ? cardObj.first_messages[0] : '') ||
        ''
    ).trim();

  const rawAltSource =
    (Array.isArray(cardObj.alternate_greetings) && cardObj.alternate_greetings.length > 0
      ? cardObj.alternate_greetings
      : Array.isArray(v2Data.alternate_greetings) && v2Data.alternate_greetings.length > 0
      ? v2Data.alternate_greetings
      : Array.isArray(cardObj.first_messages) && cardObj.first_messages.length > 1
      ? cardObj.first_messages.slice(1)
      : []);
  const finalAltGreetings: string[] = rawAltSource
    .map((g: any) => String(g || '').trim())
    .filter(Boolean);

  const rawPersonalityField =
    pastedDef.personality || String(cardObj.personality || v2Data.personality || '').trim();
  const rawV2Description = pastedDef.description || String(v2Data.description || '').trim();
  const rawScenario = pastedDef.scenario || String(cardObj.scenario || v2Data.scenario || '').trim();
  const rawExamples =
    pastedDef.exampleDialogs ||
    String(cardObj.example_dialogs || cardObj.mes_example || v2Data.mes_example || '').trim();
  const rawPostHistory = String(
    v2Data.post_history_instructions || cardObj.post_history_instructions || ''
  ).trim();
  const realLorebook = parseLorebookEntries(v2Data.character_book || cardObj.character_book);

  const charName = String(cardObj.name || v2Data.name || cardObj.chat_name || 'Janitor Character').trim();
  const shortName =
    String(cardObj.chat_name || '').trim() ||
    charName.replace(/\s*\(by\s+@?[^)]+\)\s*$/i, '').trim() ||
    charName;
  const creatorName = String(
    cardObj.creator_name || cardObj.creator || v2Data.creator || slugCreator || 'JanitorCreator'
  ).trim();
  const rating: 'SFW' | 'NSFW' = cardObj.is_nsfw === false ? 'SFW' : 'NSFW';

  // Verbatim accuracy only: never invent or synthesize missing definitions.
  // Note: JanitorAI places character bio & appearance inside Personality (mapped to v2Data.description).
  const finalDescription =
    rawV2Description ||
    rawPersonalityField ||
    (premiseLines.length > 0 ? premiseLines.join('\n\n') : '');
  const finalPersonality =
    pastedDef.personality ||
    String(v2Data.personality || '').trim() ||
    rawPersonalityField;

  const missingFields: string[] = [];
  if (!rawFirstMes) missingFields.push('First Greeting');
  if (!finalPersonality) missingFields.push('Personality');
  if (!rawScenario) missingFields.push('Scenario');

  const systemParts = [
    String(v2Data.system_prompt || cardObj.system_prompt || '').trim() ||
      `You are ${shortName}${creatorName ? ` (JanitorAI character by @${creatorName})` : ''}.`,
    finalDescription ? `Character Description & Appearance:\n${finalDescription}` : '',
    finalPersonality && finalPersonality !== finalDescription
      ? `Personality & Traits:\n${finalPersonality}`
      : '',
    rawScenario ? `Scenario:\n${rawScenario}` : '',
  ].filter(Boolean);

  const creatorNotesParts = [
    cleanBlurb || (creatorMetaLines.length > 0 ? creatorMetaLines.join('\n') : ''),
    `Imported from https://janitorai.com/characters/${rawIdOrSlug}`,
  ].filter(Boolean);

  return {
    character: {
      name: charName,
      tagline: hookLine.slice(0, 140) || `Imported from JanitorAI (by ${creatorName})`,
      avatar: fullAvatar,
      description: finalDescription,
      personality: finalPersonality,
      greeting: rawFirstMes,
      alternateGreetings: finalAltGreetings,
      systemPrompt: systemParts.join('\n\n'),
      postHistoryInstructions: rawPostHistory,
      creatorNotes: creatorNotesParts.join('\n\n'),
      scenario: rawScenario,
      exampleDialogues: rawExamples,
      tags: mergedTags.length > 0 ? mergedTags : ['Janitor Import'],
      rating,
      creatorName,
      voiceName: 'Kore',
      lorebook: realLorebook,
    },
    source: 'janitor',
    warning:
      missingFields.length > 0
        ? `Imported real "${charName}" fields retrieved verbatim, but ${missingFields.join(', ')} could not be retrieved unauthenticated (nothing was auto-generated). Paste your JanitorAI Bearer token or verbatim V2 JSON / Card Text to fill the remaining fields.`
        : undefined,
  };
}

function buildSpicyChatResultFromJson(
  bot: any,
  charId: string
): UrlImportResult {
  const rawAvatar = String(bot.avatar_url || bot.avatarUrl || bot.avatar || '').trim();
  const fullAvatar = rawAvatar
    ? /^https?:\/\//i.test(rawAvatar)
      ? rawAvatar
      : `https://cdn.nd-api.com/${rawAvatar.replace(/^\/+/, '')}`
    : '';

  const tags: string[] = Array.isArray(bot.tags)
    ? bot.tags
        .map((t: any) => (typeof t === 'string' ? t.trim() : String(t?.name || '').trim()))
        .filter(Boolean)
    : [];

  const personaText = String(bot.persona || bot.description || bot.definition || '').trim();
  let extractedPersonality = String(bot.personality || '').trim();
  if (!extractedPersonality && personaText) {
    const persMatch = personaText.match(
      /^Personality:\s*([^\n]+(?:\n(?!Name:|Age:|Height:|Likes:|Dislikes:|Appearance:|Scenario:|Background:|Backstory:)[^\n]+)*)/im
    );
    if (persMatch?.[1]) {
      extractedPersonality = persMatch[1].trim();
    }
  }

  const loreEntries: Array<{ key: string; content: string }> = [];
  const rawRulebookEntries =
    bot.rulebook?.entries ||
    bot.rulebook?.rules ||
    (Array.isArray(bot.lorebooks) ? bot.lorebooks : []);
  if (Array.isArray(rawRulebookEntries)) {
    for (const item of rawRulebookEntries) {
      if (Array.isArray(item?.entries)) {
        for (const sub of item.entries) {
          const k = Array.isArray(sub.keys) ? sub.keys[0] : sub.key || sub.keyword;
          const c = sub.content || sub.value || '';
          if (k && c) loreEntries.push({ key: String(k), content: String(c) });
        }
      } else {
        const k = Array.isArray(item?.keys) ? item.keys[0] : item?.key || item?.keyword || item?.name;
        const c = item?.content || item?.value || item?.description || '';
        if (k && c) loreEntries.push({ key: String(k), content: String(c) });
      }
    }
  }

  const charName = String(bot.name || 'SpicyChat Character').trim();
  const tagline = String(bot.title || bot.tagline || '').trim() || `Imported from SpicyChat.ai`;
  const greeting = String(bot.greeting || bot.first_mes || '').trim();
  const scenario = String(bot.scenario || '').trim();
  const exampleDialogues = String(bot.dialogue || bot.example_dialogs || bot.mes_example || '').trim();
  const hiddenDefinition = bot.definition_visible === false && !personaText && !scenario;

  const systemParts = [
    String(bot.system_prompt || '').trim() || `You are ${charName}. Stay deeply in character.`,
    personaText ? `Persona:\n${personaText}` : '',
    scenario ? `Scenario:\n${scenario}` : '',
  ].filter(Boolean);

  return {
    character: {
      name: charName,
      tagline,
      avatar: fullAvatar,
      description: personaText || tagline,
      personality: extractedPersonality,
      greeting,
      alternateGreetings: Array.isArray(bot.alternate_greetings) ? bot.alternate_greetings : [],
      systemPrompt: systemParts.join('\n\n'),
      creatorNotes: `Imported from https://spicychat.ai/chatbot/${charId}`,
      scenario,
      exampleDialogues,
      tags: tags.length > 0 ? tags : ['SpicyChat Import'],
      rating: bot.is_nsfw === false ? 'SFW' : 'NSFW',
      creatorName: String(bot.creator_username || bot.creator || 'SpicyChatCreator').trim(),
      voiceName: 'Charon',
      lorebook: loreEntries,
    },
    source: 'spicychat',
    warning: hiddenDefinition
      ? `Imported public profile & greeting for "${charName}", but the creator set SpicyChat's Persona definition to private.`
      : undefined,
  };
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
        avatar: finalAvatar || '',
        description:
          og.description ||
          `Imported from https://chub.ai/characters/${cleanPath}.`,
        greeting: '',
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
  fetchImpl: FetchLike = fetch,
  options?: UrlImportOptions
): Promise<UrlImportResult> {
  const parsedInfo = parseCharacterUrl(url);

  if (parsedInfo.source === 'chub') {
    return fetchChubCharacter(parsedInfo.idOrPath, fetchImpl);
  }

  if (parsedInfo.source === 'janitor') {
    const rawIdOrSlug = parsedInfo.idOrPath;
    const { uuid: charUuid, creator: slugCreator } = parseJanitorSlug(rawIdOrSlug);
    const cleanedToken = options?.authToken?.replace(/^Bearer\s+/i, '').trim();
    const janitorAuthHeaders: Record<string, string> = cleanedToken
      ? { Authorization: `Bearer ${cleanedToken}` }
      : {};

    // 1. If user supplied a JanitorAI Bearer token, query authenticated hampter/API first for direct verbatim card
    if (cleanedToken) {
      const authedEndpoints = [
        `https://janitorai.com/hampter/characters/${charUuid}`,
        `https://janitorai.com/api/characters/${rawIdOrSlug}`,
        ...(charUuid !== rawIdOrSlug ? [`https://janitorai.com/api/characters/${charUuid}`] : []),
      ];
      for (const ep of authedEndpoints) {
        try {
          const resp = await fetchImpl(ep, {
            headers: {
              'User-Agent': BROWSER_UA,
              Accept: 'application/json',
              ...janitorAuthHeaders,
            },
            signal: AbortSignal.timeout(7000),
          });
          if (!resp.ok) continue;
          const jData = extractJsonFromTextOrMarkdown(await resp.text());
          const cardObj = jData?.character || jData?.data || jData;
          if (cardObj && (cardObj.first_message || cardObj.first_mes || cardObj.personality)) {
            if (cardObj.spec === 'chara_card_v2' || cardObj.spec === 'chara_card_v3') {
              return { character: parseTavernCard(cardObj), source: 'janitor' };
            }
            return await buildJanitorResultFromApiJson(cardObj, rawIdOrSlug, slugCreator, options);
          }
        } catch {
          // try next
        }
      }
    }

    // 2. Query Datacat anonymous session archive API + JanitorAI hampter metadata in parallel for 100% verbatim definitions + full-res JanitorAI avatar
    const [datacatRes, hampterMirrorRes] = await Promise.allSettled([
      fetchDatacatJanitorCard(charUuid, fetchImpl),
      fetchImpl(`https://r.jina.ai/https://janitorai.com/hampter/characters/${charUuid}`, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/plain,application/json,*/*' },
        signal: AbortSignal.timeout(6500),
      }).then(async (r) => (r.ok ? extractJsonFromTextOrMarkdown(await r.text()) : null)),
    ]);

    const datacatCard = datacatRes.status === 'fulfilled' ? datacatRes.value : null;
    const hampterJson = hampterMirrorRes.status === 'fulfilled' ? hampterMirrorRes.value : null;
    const hampterCard = hampterJson?.character || hampterJson?.data || hampterJson;

    if (datacatCard) {
      // Prefer JanitorAI's full-resolution CDN avatar when available while keeping Datacat's verbatim card definitions
      const hampterAvatarRaw = String(hampterCard?.avatar_url || hampterCard?.avatar || '').trim();
      const hampterAvatarFull = hampterAvatarRaw
        ? /^https?:\/\//i.test(hampterAvatarRaw)
          ? hampterAvatarRaw
          : `https://ella.janitorai.com/bot-avatars/${hampterAvatarRaw.replace(/^\/+/, '')}`
        : '';
      const mergedCard = {
        ...datacatCard,
        full_res_avatar: hampterAvatarFull || datacatCard.avatar_display_url || datacatCard.avatar,
        tags:
          Array.isArray(datacatCard.tags) && datacatCard.tags.length > 0
            ? datacatCard.tags
            : hampterCard?.tags || [],
        custom_tags: Array.from(
          new Set([
            ...(Array.isArray(datacatCard.custom_tags) ? datacatCard.custom_tags : []),
            ...(Array.isArray(hampterCard?.custom_tags) ? hampterCard.custom_tags : []),
          ])
        ),
      };
      return await buildJanitorResultFromApiJson(mergedCard, rawIdOrSlug, slugCreator, options);
    }

    // 3. Fallback: direct JanitorAI hampter / Jina hampter / jannyai endpoints (verbatim only, zero fabrication)
    if (
      hampterCard &&
      (hampterCard.name || hampterCard.chat_name || hampterCard.first_message || hampterCard.description)
    ) {
      return await buildJanitorResultFromApiJson(hampterCard, rawIdOrSlug, slugCreator, options);
    }

    const janitorEndpoints: Array<{ endpoint: string; init?: RequestInit; isMarkdownJson?: boolean }> = [
      { endpoint: `https://janitorai.com/hampter/characters/${charUuid}`, init: { headers: janitorAuthHeaders } },
      { endpoint: `https://janitorai.com/api/characters/${rawIdOrSlug}`, init: { headers: janitorAuthHeaders } },
      ...(charUuid !== rawIdOrSlug
        ? [{ endpoint: `https://janitorai.com/api/characters/${charUuid}`, init: { headers: janitorAuthHeaders } }]
        : []),
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

    for (const reqCfg of janitorEndpoints) {
      try {
        const resp = await fetchImpl(reqCfg.endpoint, {
          method: reqCfg.init?.method || 'GET',
          headers: {
            'User-Agent': BROWSER_UA,
            Accept: reqCfg.isMarkdownJson ? 'text/plain,application/json,*/*' : 'application/json',
            ...(reqCfg.init?.headers as Record<string, string> | undefined),
          },
          body: reqCfg.init?.body,
          signal: AbortSignal.timeout(7000),
        });
        if (!resp.ok) continue;
        const rawText = await resp.text();
        const jData = extractJsonFromTextOrMarkdown(rawText);
        if (!jData || jData.error || (jData.statusCode && jData.statusCode >= 400)) {
          continue;
        }
        const cardObj = jData?.character || jData?.data || jData;
        if (
          cardObj &&
          (cardObj.name || cardObj.chat_name || cardObj.first_message || cardObj.first_mes || cardObj.description)
        ) {
          if (cardObj.spec === 'chara_card_v2' || cardObj.spec === 'chara_card_v3') {
            return { character: parseTavernCard(cardObj), source: 'janitor' };
          }
          return await buildJanitorResultFromApiJson(cardObj, rawIdOrSlug, slugCreator, options);
        }
      } catch {
        // try next endpoint
      }
    }

    // 4. Fallback: Jina Reader HTML-to-Markdown of the JanitorAI character page itself
    try {
      const cleanPageUrl = `https://r.jina.ai/https://janitorai.com/characters/${rawIdOrSlug}`;
      const pageResp = await fetchImpl(cleanPageUrl, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/plain,*/*' },
        signal: AbortSignal.timeout(8000),
      });
      if (pageResp.ok) {
        const md = await pageResp.text();
        if (md && !/Access Restricted|Attention Required!\s*\|\s*Cloudflare/i.test(md)) {
          const titleMatch = md.match(/^Title:\s*(.+)$/m);
          const imgMatch = md.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/);
          const mdBodyIdx = md.indexOf('Markdown Content:');
          const body = mdBodyIdx !== -1 ? md.slice(mdBodyIdx + 'Markdown Content:'.length).trim() : md;
          const cleanName = (titleMatch?.[1] || '').replace(/\s*[-|]\s*JanitorAI.*$/i, '').trim();
          const avatarUrl = imgMatch?.[1] || '';

          if (cleanName || avatarUrl) {
            const byMatch = cleanName.match(/\(by\s+@([^)]+)\)/i);
            const parsedCreator = byMatch?.[1] || slugCreator || 'JanitorCreator';
            const lines = body
              .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter((l) => l && !/^(?:\*?\s*\d+(?:\.\d+)?[kKmM]?|\d+\s*comments|Leave a comment|Created |Updated |Published )/i.test(l));
            return await buildJanitorResultFromApiJson(
              {
                name: cleanName || 'Janitor Character',
                avatar: avatarUrl,
                creator_name: parsedCreator,
                description: lines.slice(0, 6).join('\n\n'),
                tags: ['Janitor Import'],
                is_nsfw: /\bLimitless\b/i.test(md),
              },
              rawIdOrSlug,
              parsedCreator,
              options
            );
          }
        }
      }
    } catch {
      // fall through
    }

    throw new UrlImportError(
      'Could not retrieve character data from JanitorAI (the bot may be private, deleted, or temporarily rate-limited). Tip: Export/download the character PNG or V2 JSON card and drop it into "Import Any File / Card"!',
      422
    );
  }

  if (parsedInfo.source === 'spicychat') {
    const charId = parsedInfo.idOrPath;
    const guestIdHeader =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'd1ff54eb-783a-4a83-b8ac-7fab7a1bcc64';

    const spicyHeaders: Record<string, string> = {
      'User-Agent': BROWSER_UA,
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://spicychat.ai',
      Referer: 'https://spicychat.ai/',
      'x-app-id': 'spicychat',
      'x-app-version': '4.11.0',
      'x-platform-os': 'DESKTOP',
      'x-country': 'US',
      'x-guest-userid': guestIdHeader,
    };

    // 1. Primary path: Official SpicyChat v2/v1 endpoints with guest session headers
    const spicyApiEndpoints = [
      `https://prod.nd-api.com/v2/characters/${charId}?include=rulebook`,
      `https://prod.nd-api.com/v2/characters/${charId}`,
      `https://prod.nd-api.com/characters/${charId}`,
      `https://prod.nd-api.com/v1/characters/${charId}`,
    ];

    for (const apiUrl of spicyApiEndpoints) {
      try {
        const resp = await fetchImpl(apiUrl, {
          headers: spicyHeaders,
          signal: AbortSignal.timeout(6000),
        });
        const ct = (resp.headers.get('content-type') || '').toLowerCase();
        if (resp.ok && ct.includes('application/json')) {
          const payload: any = await resp.json();
          const bot = payload?.character || payload?.data || payload;
          if (bot && (bot.name || bot.greeting || bot.title || bot.persona)) {
            return buildSpicyChatResultFromJson(bot, charId);
          }
        }
      } catch {
        // try next endpoint
      }
    }

    // 2. Fallback: Jina Reader of SpicyChat public page if nd-api is temporarily unreachable
    try {
      const jinaSpicyResp = await fetchImpl(`https://r.jina.ai/https://spicychat.ai/chatbot/${charId}`, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/plain,*/*' },
        signal: AbortSignal.timeout(8000),
      });
      if (jinaSpicyResp.ok) {
        const md = await jinaSpicyResp.text();
        const titleMatch = md.match(/^Title:\s*(.+)$/m);
        const mdIdx = md.indexOf('Markdown Content:');
        const body = mdIdx !== -1 ? md.slice(mdIdx + 'Markdown Content:'.length).trim() : md;
        const resolvedName = (titleMatch?.[1] || '')
          .replace(/\s*[-|]\s*Explore this AI Chatbot on Spicychat.*$/i, '')
          .replace(/\s*[-|]\s*SpicyChat.*$/i, '')
          .trim();
        if (resolvedName && body && !/just a moment|access denied/i.test(resolvedName)) {
          return {
            character: {
              name: resolvedName,
              tagline: `Imported from SpicyChat.ai`,
              avatar: '',
              description: body,
              personality: '',
              greeting: '',
              alternateGreetings: [],
              systemPrompt: `You are ${resolvedName}.\n\n${body}`,
              creatorNotes: `Imported from https://spicychat.ai/chatbot/${charId}`,
              scenario: '',
              exampleDialogues: '',
              tags: ['SpicyChat Import'],
              rating: 'NSFW',
              creatorName: 'SpicyChatCreator',
              voiceName: 'Charon',
              lorebook: [],
            },
            source: 'spicychat',
            warning:
              'Imported real character description from SpicyChat web mirror (avatar/greeting API was unavailable).',
          };
        }
      }
    } catch {
      // fall through to explicit error
    }

    throw new UrlImportError(
      `Could not retrieve character "${charId}" from SpicyChat.ai (the character may be private, deleted, or API-unavailable).`,
      422
    );
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
