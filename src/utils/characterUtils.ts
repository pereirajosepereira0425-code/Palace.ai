import type { ContentRating } from '../types/index.ts';

export interface TavernCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, any>;
    character_book?: {
      name?: string;
      description?: string;
      entries: Array<{
        keys: string[];
        content: string;
        enabled?: boolean;
        insertion_order?: number;
      }>;
    };
  };
}

export interface NormalizedCharacter {
  name: string;
  tagline: string;
  avatar: string;
  backgroundImage?: string;
  description: string;
  personality?: string;
  greeting: string;
  alternateGreetings: string[];
  systemPrompt: string;
  postHistoryInstructions?: string;
  creatorNotes?: string;
  characterVersion?: string;
  scenario: string;
  exampleDialogues: string;
  tags: string[];
  rating: ContentRating;
  creatorName: string;
  voiceName: string;
  voiceStyle?: string;
  gender?: string;
  pronouns?: string;
  lorebook: Array<{ key: string; content: string }>;
}

// Complete tag taxonomy from Chub.ai (https://chub.ai/create_character)
export const CHUB_ALL_TAGS = [
  'Anime',
  'Original Character (OC)',
  'Female',
  'Male',
  'Non-Binary',
  'Multiple Characters',
  'Monster',
  'Monster Girl',
  'Monster Boy',
  'Fantasy',
  'Dark Fantasy',
  'Sci-Fi',
  'Cyberpunk',
  'RPG',
  'Gaming',
  'Horror',
  'Romance',
  'Dominant',
  'Submissive',
  'Switch',
  'Tsundere',
  'Yandere',
  'Kuudere',
  'Deredere',
  'Femboy',
  'Tomboy',
  'Furry',
  'Historical',
  'Modern',
  'Superheroes',
  'Villains',
  'Royalty',
  'VTuber',
  'Mystery',
  'Detective',
  'Wholesome',
  'Comedy',
  'Dark',
  'Slice of Life',
  'Military',
  'Supernatural',
  'Vampire',
  'Werewolf',
  'Android / Cyborg',
  'Elf',
  'Demon',
  'Angel',
  'Ghost',
  'Witch / Wizard',
  'Celebrity',
  'NSFW',
  'NSFL',
];

const DEFAULT_PLACEHOLDER_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

/**
 * Parses and normalizes Chub.ai / Janitor.ai / TavernAI V1, V2, and V3 character JSON specs
 */
export function parseTavernCard(
  jsonInput: string | object,
  fallbackAvatarUrl?: string
): NormalizedCharacter {
  let parsed: any;
  if (typeof jsonInput === 'string') {
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      throw new Error('Invalid JSON format');
    }
  } else {
    parsed = jsonInput;
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Card data is empty or invalid');
  }

  const resolvedFallbackAvatar = fallbackAvatarUrl?.trim() || DEFAULT_PLACEHOLDER_AVATAR;

  // Handle Character Card V2 / V3 format (Chub / Tavern V2 / CCv3)
  const isWrappedCard =
    (parsed.spec === 'chara_card_v2' || parsed.spec === 'chara_card_v3' || Boolean(parsed.data)) &&
    parsed.data &&
    typeof parsed.data === 'object';

  if (isWrappedCard) {
    const d = parsed.data;
    const lorebookEntries: Array<{ key: string; content: string }> = [];

    if (d.character_book && Array.isArray(d.character_book.entries)) {
      for (const entry of d.character_book.entries) {
        if (entry.keys?.length && entry.content) {
          lorebookEntries.push({
            key: entry.keys[0],
            content: entry.content,
          });
        }
      }
    }

    const rawTags: string[] = Array.isArray(d.tags)
      ? d.tags.filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
      : [];
    const upperTags = rawTags.map((t) => t.toUpperCase());
    const ratingVal =
      d.extensions?.rating ||
      (upperTags.includes('NSFL') && upperTags.includes('NSFW')
        ? 'NSFW + NSFL'
        : upperTags.includes('NSFL')
        ? 'NSFL'
        : upperTags.includes('NSFW')
        ? 'NSFW'
        : 'SFW');
    const validRating: ContentRating =
      ratingVal === 'NSFL' || ratingVal === 'NSFW + NSFL' || ratingVal === 'NSFW' ? ratingVal : 'SFW';

    const extAvatar =
      typeof d.extensions?.avatar_url === 'string' && /^https?:\/\//i.test(d.extensions.avatar_url)
        ? d.extensions.avatar_url
        : typeof d.extensions?.chub?.avatar_url === 'string' && /^https?:\/\//i.test(d.extensions.chub.avatar_url)
        ? d.extensions.chub.avatar_url
        : typeof parsed.avatar_url === 'string' && /^https?:\/\//i.test(parsed.avatar_url)
        ? parsed.avatar_url
        : '';

    const chubTagline = typeof d.extensions?.chub?.tagline === 'string' ? d.extensions.chub.tagline.trim() : '';

    return {
      name: d.name?.trim() || 'Unnamed Character',
      tagline:
        chubTagline ||
        d.creator_notes?.trim()?.slice(0, 140) ||
        d.description?.slice(0, 120)?.trim() ||
        'Imported character card',
      avatar: extAvatar || resolvedFallbackAvatar,
      backgroundImage: d.extensions?.background_image || '',
      description: d.description || 'No description provided.',
      personality: d.personality || '',
      greeting: d.first_mes?.trim() || '*Smiles warmly* Hello there.',
      alternateGreetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [],
      systemPrompt: d.system_prompt?.trim() || `You are ${d.name || 'this character'}. Stay in character.`,
      postHistoryInstructions: d.post_history_instructions?.trim() || '',
      creatorNotes: d.creator_notes?.trim() || '',
      characterVersion: d.character_version || '1.0',
      scenario: d.scenario?.trim() || '',
      exampleDialogues: d.mes_example?.trim() || '',
      tags: rawTags.length > 0 ? rawTags : ['Original', 'RPG'],
      rating: validRating,
      creatorName: d.creator?.trim() || 'Community',
      voiceName: d.extensions?.voiceName || 'Puck',
      voiceStyle: d.extensions?.voiceStyle || undefined,
      gender: d.extensions?.gender || undefined,
      pronouns: d.extensions?.pronouns || undefined,
      lorebook: lorebookEntries,
    };
  }

  // Handle Legacy V1 / Chub API node / Janitor format
  const name = parsed.name?.trim() || 'Unnamed Character';
  const rawTags: string[] = Array.isArray(parsed.tags)
    ? parsed.tags.filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
    : Array.isArray(parsed.topics)
    ? parsed.topics.filter((t: unknown) => typeof t === 'string' && t.trim().length > 0)
    : [];
  const legacyRating: ContentRating =
    parsed.rating === 'NSFL' || parsed.rating === 'NSFW + NSFL' || parsed.rating === 'NSFW'
      ? parsed.rating
      : parsed.nsfw_image || rawTags.some((t) => t.toUpperCase() === 'NSFW')
      ? 'NSFW'
      : 'SFW';

  const legacyAvatar =
    (typeof parsed.max_res_url === 'string' && /^https?:\/\//i.test(parsed.max_res_url) && parsed.max_res_url) ||
    (typeof parsed.avatar_url === 'string' && /^https?:\/\//i.test(parsed.avatar_url) && parsed.avatar_url) ||
    (typeof parsed.avatar === 'string' && /^https?:\/\//i.test(parsed.avatar) && parsed.avatar) ||
    resolvedFallbackAvatar;

  return {
    name,
    tagline:
      parsed.tagline?.trim() ||
      parsed.creator_notes?.trim()?.slice(0, 140) ||
      parsed.description?.slice(0, 120)?.trim() ||
      'A unique character',
    avatar: legacyAvatar,
    backgroundImage: parsed.backgroundImage || parsed.background || '',
    description: parsed.description || parsed.definition?.description || 'No description provided.',
    personality: parsed.personality || parsed.definition?.personality || '',
    greeting:
      parsed.first_mes ||
      parsed.greeting ||
      parsed.definition?.first_mes ||
      '*Looks at you attentively.* Hello.',
    alternateGreetings: Array.isArray(parsed.alternate_greetings || parsed.alternateGreetings)
      ? parsed.alternate_greetings || parsed.alternateGreetings
      : [],
    systemPrompt:
      parsed.system_prompt ||
      parsed.prompt ||
      parsed.definition?.system_prompt ||
      `You are ${name}. Maintain character immersion.`,
    postHistoryInstructions: parsed.post_history_instructions || parsed.postHistoryInstructions || '',
    creatorNotes: parsed.creator_notes || parsed.creatorNotes || '',
    characterVersion: parsed.character_version || '1.0',
    scenario: parsed.scenario || parsed.definition?.scenario || '',
    exampleDialogues: parsed.mes_example || parsed.exampleDialogues || parsed.definition?.mes_example || '',
    tags: rawTags.length > 0 ? rawTags : ['Roleplay', 'Fantasy'],
    rating: legacyRating,
    creatorName: parsed.creator || parsed.fullPath?.split('/')?.[0] || 'Community',
    voiceName: parsed.voiceName || 'Puck',
    lorebook: Array.isArray(parsed.lorebook) ? parsed.lorebook : [],
  };
}

/**
 * Exports a character into standard Chub / Tavern Character Card V2 JSON
 */
export function exportTavernCard(char: {
  name: string;
  tagline: string;
  avatar: string;
  backgroundImage?: string | null;
  description: string;
  personality?: string | null;
  greeting: string;
  alternateGreetings?: string | string[] | null;
  systemPrompt: string;
  postHistoryInstructions?: string | null;
  creatorNotes?: string | null;
  characterVersion?: string | null;
  scenario?: string | null;
  exampleDialogues?: string | null;
  tags?: string | string[] | null;
  rating?: string | null;
  creatorName?: string | null;
  voiceName?: string | null;
  lorebook?: string | Array<{ key: string; content: string }> | null;
}): TavernCardV2 {
  let parsedTags: string[] = [];
  if (Array.isArray(char.tags)) {
    parsedTags = char.tags;
  } else if (typeof char.tags === 'string') {
    try {
      parsedTags = JSON.parse(char.tags);
    } catch {
      parsedTags = [char.tags];
    }
  }

  let alternateGreetings: string[] = [];
  if (Array.isArray(char.alternateGreetings)) {
    alternateGreetings = char.alternateGreetings;
  } else if (typeof char.alternateGreetings === 'string') {
    try {
      alternateGreetings = JSON.parse(char.alternateGreetings);
    } catch {
      alternateGreetings = [];
    }
  }

  let loreEntries: Array<{ key: string; content: string }> = [];
  if (Array.isArray(char.lorebook)) {
    loreEntries = char.lorebook;
  } else if (typeof char.lorebook === 'string') {
    try {
      loreEntries = JSON.parse(char.lorebook);
    } catch {
      loreEntries = [];
    }
  }

  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: char.name,
      description: char.description,
      personality: char.personality || '',
      scenario: char.scenario || '',
      first_mes: char.greeting,
      mes_example: char.exampleDialogues || '',
      creator_notes: char.creatorNotes || char.tagline,
      system_prompt: char.systemPrompt,
      post_history_instructions: char.postHistoryInstructions || '',
      alternate_greetings: alternateGreetings,
      tags: parsedTags,
      creator: char.creatorName || 'Palace.ai User',
      character_version: char.characterVersion || '1.0',
      extensions: {
        avatar_url: char.avatar,
        background_image: char.backgroundImage || '',
        rating: char.rating || 'SFW',
        voiceName: char.voiceName || 'Puck',
      },
      character_book: {
        name: `${char.name} World Lore`,
        entries: loreEntries.map((l, i) => ({
          keys: [l.key],
          content: l.content,
          enabled: true,
          insertion_order: i + 1,
        })),
      },
    },
  };
}

export interface InlineTextStyle {
  color?: string;
  backgroundColor?: string;
  background?: string;
  WebkitBackgroundClip?: string;
  WebkitTextFillColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  mark?: boolean;
  textShadow?: string;
}

export interface InlineTextRun {
  text: string;
  style?: InlineTextStyle;
}

export interface RoleplaySegment {
  type: 'action' | 'dialogue' | 'thought' | 'image';
  text: string;
  runs?: InlineTextRun[];
  src?: string;
  alt?: string;
  href?: string;
}

export function isSafeMediaUrl(url: string): boolean {
  const trimmed = (url || '').trim();
  if (!trimmed) return false;
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp|avif|svg\+xml|bmp);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) {
    return true;
  }
  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) return true;
  if (/^\/(?!\/)[^\s<>"']*$/i.test(trimmed)) return true;
  return false;
}

const DISALLOWED_CSS_RE = /(?:url\s*\(|expression\s*\(|javascript\s*:|vbscript\s*:|@import|-moz-binding|behavior\s*:|[;<>{}])/i;

export function isSafeCssColor(rawValue: string): boolean {
  const val = (rawValue || '').trim().replace(/\s*!important\s*$/i, '').trim();
  if (!val || val.length > 260) return false;
  if (DISALLOWED_CSS_RE.test(val)) return false;

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val)) return true;
  if (/^[a-z]{3,24}$/i.test(val)) return true;
  if (/^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\(\s*[-+0-9.%\s,/degturnrad]+\s*\)$/i.test(val)) {
    return true;
  }
  if (/^(?:repeating-)?(?:linear|radial|conic)-gradient\(\s*[^;{}<>]+\)$/i.test(val)) {
    return true;
  }
  return false;
}

function splitCssDeclarations(rawStyle: string): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  if (!rawStyle) return result;
  let current = '';
  let parenDepth = 0;
  for (let i = 0; i < rawStyle.length; i++) {
    const ch = rawStyle[i];
    if (ch === '(') parenDepth++;
    else if (ch === ')' && parenDepth > 0) parenDepth--;
    if (ch === ';' && parenDepth === 0) {
      const colonIdx = current.indexOf(':');
      if (colonIdx > 0) {
        result.push([current.slice(0, colonIdx).trim().toLowerCase(), current.slice(colonIdx + 1).trim()]);
      }
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    const colonIdx = current.indexOf(':');
    if (colonIdx > 0) {
      result.push([current.slice(0, colonIdx).trim().toLowerCase(), current.slice(colonIdx + 1).trim()]);
    }
  }
  return result;
}

const SAFE_WIKI_STYLE_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'background-clip',
  '-webkit-background-clip',
  '-webkit-text-fill-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-decoration',
  'text-align',
  'text-shadow',
  'text-transform',
  'letter-spacing',
  'line-height',
  'padding',
  'padding-left',
  'padding-right',
  'padding-top',
  'padding-bottom',
  'margin',
  'margin-left',
  'margin-right',
  'margin-top',
  'margin-bottom',
  'border',
  'border-left',
  'border-right',
  'border-top',
  'border-bottom',
  'border-radius',
  'box-shadow',
  'float',
  'width',
  'max-width',
  'min-width',
  'display',
  'overflow',
  'opacity',
  'vertical-align',
]);

export function sanitizeCssStyleString(rawStyle: string): string {
  const decls = splitCssDeclarations(rawStyle);
  const safeParts: string[] = [];
  for (const [prop, rawVal] of decls) {
    if (!SAFE_WIKI_STYLE_PROPS.has(prop)) continue;
    const val = rawVal.replace(/\s*!important\s*$/i, '').trim();
    if (!val || /url\s*\(|expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:|[<>{}]/i.test(val)) {
      continue;
    }
    if (prop === 'color' || prop === 'background-color' || prop === '-webkit-text-fill-color') {
      if (!isSafeCssColor(val)) continue;
    } else if (prop === 'background') {
      if (!isSafeCssColor(val)) continue;
    } else if (prop === 'background-clip' || prop === '-webkit-background-clip') {
      if (!/^(?:text|border-box|padding-box|content-box)$/i.test(val)) continue;
    }
    safeParts.push(`${prop}: ${val}`);
  }
  return safeParts.join('; ');
}

function sanitizeInlineStyleToTextStyle(rawStyle: string, base?: InlineTextStyle): InlineTextStyle {
  const next: InlineTextStyle = { ...(base || {}) };
  for (const [prop, rawVal] of splitCssDeclarations(rawStyle)) {
    const val = rawVal.replace(/\s*!important\s*$/i, '').trim();
    if (!val || /url\s*\(|expression\s*\(|javascript\s*:|[<>{}]/i.test(val)) continue;
    if (prop === 'color' && isSafeCssColor(val)) {
      next.color = val;
    } else if (prop === 'background-color' && isSafeCssColor(val)) {
      next.backgroundColor = val;
    } else if (prop === 'background' && isSafeCssColor(val)) {
      next.background = val;
    } else if (prop === '-webkit-background-clip' || prop === 'background-clip') {
      if (/^(?:text|border-box|padding-box|content-box)$/i.test(val)) {
        next.WebkitBackgroundClip = val;
      }
    } else if (prop === '-webkit-text-fill-color' && isSafeCssColor(val)) {
      next.WebkitTextFillColor = val;
    } else if (prop === 'font-weight' && /^(?:bold|bolder|[6-9]00)$/i.test(val)) {
      next.bold = true;
    } else if (prop === 'font-style' && /^(?:italic|oblique)$/i.test(val)) {
      next.italic = true;
    } else if (prop === 'text-decoration') {
      if (/underline/i.test(val)) next.underline = true;
      if (/line-through/i.test(val)) next.strike = true;
    } else if (prop === 'text-shadow' && val.length <= 120) {
      next.textShadow = val;
    }
  }
  return next;
}

const DECODABLE_SAFE_TAGS_RE =
  /&lt;(\/?(?:img|span|font|mark|strong|b|em|i|u|del|s|sup|sub|br|div|p|blockquote)\b[\s\S]*?)&gt;/gi;

function decodeEscapedRichTags(input: string): string {
  if (!input || !input.includes('&lt;')) return input;
  return input.replace(DECODABLE_SAFE_TAGS_RE, (_m, inner) => {
    const decodedAttrs = inner
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&#x27;/gi, "'")
      .replace(/&amp;/gi, '&');
    if (/\bon[a-z]+\s*=/i.test(decodedAttrs) || /javascript\s*:/i.test(decodedAttrs)) {
      const cleaned = decodedAttrs
        .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, '');
      return `<${cleaned}>`;
    }
    return `<${decodedAttrs}>`;
  });
}

function findMatchingClosingTag(str: string, openTagEnd: number, tagName: string): number {
  const openRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let depth = 1;
  let pos = openTagEnd;
  while (pos < str.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(str);
    const nextClose = closeRe.exec(str);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      pos = nextClose.index + nextClose[0].length;
    }
  }
  return -1;
}

function findMatchingBbClose(str: string, openTagEnd: number, tagName: string): number {
  const openRe = new RegExp(`\\[${tagName}(?:=[^\\]]*)?\\]`, 'gi');
  const closeRe = new RegExp(`\\[\\/${tagName}\\]`, 'gi');
  let depth = 1;
  let pos = openTagEnd;
  while (pos < str.length) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const nextOpen = openRe.exec(str);
    const nextClose = closeRe.exec(str);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + nextOpen[0].length;
    } else {
      depth--;
      if (depth === 0) return nextClose.index;
      pos = nextClose.index + nextClose[0].length;
    }
  }
  return -1;
}

function hasTextStyle(s?: InlineTextStyle): boolean {
  if (!s) return false;
  return Boolean(
    s.color ||
      s.backgroundColor ||
      s.background ||
      s.WebkitBackgroundClip ||
      s.WebkitTextFillColor ||
      s.bold ||
      s.italic ||
      s.underline ||
      s.strike ||
      s.mark ||
      s.textShadow
  );
}

function stylesEqual(a?: InlineTextStyle, b?: InlineTextStyle): boolean {
  if (!hasTextStyle(a) && !hasTextStyle(b)) return true;
  if (!a || !b) return false;
  return (
    a.color === b.color &&
    a.backgroundColor === b.backgroundColor &&
    a.background === b.background &&
    a.WebkitBackgroundClip === b.WebkitBackgroundClip &&
    a.WebkitTextFillColor === b.WebkitTextFillColor &&
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.strike) === Boolean(b.strike) &&
    Boolean(a.mark) === Boolean(b.mark) &&
    a.textShadow === b.textShadow
  );
}

function pushInlineRun(runs: InlineTextRun[], text: string, style?: InlineTextStyle): void {
  if (!text) return;
  const normalizedStyle = hasTextStyle(style) ? { ...style } : undefined;
  const prev = runs[runs.length - 1];
  if (prev && stylesEqual(prev.style, normalizedStyle)) {
    prev.text += text;
  } else {
    runs.push(normalizedStyle ? { text, style: normalizedStyle } : { text });
  }
}

export function parseInlineRuns(text: string, inheritedStyle?: InlineTextStyle): InlineTextRun[] {
  if (!text) return [];
  const runs: InlineTextRun[] = [];
  const tokenRe =
    /<(span|font|mark|strong|b|em|i|u|del|s)\b([^>]*)>|\[(color|bgcolor|highlight)\s*=\s*("[^"]+"|'[^']+'|[^\]\s]+)\s*\]|\{\{(?:color|colour|fg|highlight)\s*\|\s*([^|}]+)\s*\|\s*([\s\S]*?)\}\}|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*\n]+)\*|~~([^~\n]+)~~|==([^=\n]+)==/gi;

  let pos = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    const start = match.index;
    if (start < pos) continue;

    if (match[1]) {
      // HTML inline tag: <span|font|mark|strong|b|em|i|u|del|s ...>
      const tagName = match[1].toLowerCase();
      const attrs = match[2] || '';
      const openEnd = tokenRe.lastIndex;
      const closeIdx = findMatchingClosingTag(text, openEnd, tagName);
      if (start > pos) {
        pushInlineRun(runs, text.slice(pos, start), inheritedStyle);
      }

      const nextStyle: InlineTextStyle = { ...(inheritedStyle || {}) };
      const styleMatch = attrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const rawInlineStyle = styleMatch?.[1] || styleMatch?.[2] || '';
      if (rawInlineStyle) {
        Object.assign(nextStyle, sanitizeInlineStyleToTextStyle(rawInlineStyle, nextStyle));
      }

      if (tagName === 'font') {
        const colorMatch = attrs.match(/\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        const fontColor = (colorMatch?.[1] || colorMatch?.[2] || colorMatch?.[3] || '').trim();
        if (isSafeCssColor(fontColor)) {
          nextStyle.color = fontColor;
        }
      } else if (tagName === 'mark') {
        nextStyle.mark = true;
      } else if (tagName === 'strong' || tagName === 'b') {
        nextStyle.bold = true;
      } else if (tagName === 'em' || tagName === 'i') {
        nextStyle.italic = true;
      } else if (tagName === 'u') {
        nextStyle.underline = true;
      } else if (tagName === 'del' || tagName === 's') {
        nextStyle.strike = true;
      }

      if (closeIdx === -1) {
        const inner = text.slice(openEnd);
        const innerRuns = parseInlineRuns(inner, nextStyle);
        for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);
        pos = text.length;
        break;
      }

      const inner = text.slice(openEnd, closeIdx);
      const innerRuns = parseInlineRuns(inner, nextStyle);
      for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);

      const closeTagLen = `</${tagName}>`.length;
      const afterClose = text.indexOf('>', closeIdx) + 1;
      pos = afterClose > closeIdx ? afterClose : closeIdx + closeTagLen;
      tokenRe.lastIndex = pos;
      continue;
    }

    if (match[3]) {
      // BBCode [color=...], [bgcolor=...], [highlight=...]
      const bbTag = match[3].toLowerCase();
      const rawVal = (match[4] || '').replace(/^["']|["']$/g, '').trim();
      const openEnd = tokenRe.lastIndex;
      const closeIdx = findMatchingBbClose(text, openEnd, bbTag);
      if (!isSafeCssColor(rawVal)) {
        continue;
      }
      if (start > pos) {
        pushInlineRun(runs, text.slice(pos, start), inheritedStyle);
      }

      const nextStyle: InlineTextStyle = { ...(inheritedStyle || {}) };
      if (bbTag === 'color') {
        nextStyle.color = rawVal;
      } else {
        nextStyle.backgroundColor = rawVal;
        nextStyle.mark = true;
      }

      if (closeIdx === -1) {
        const inner = text.slice(openEnd);
        const innerRuns = parseInlineRuns(inner, nextStyle);
        for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);
        pos = text.length;
        break;
      }

      const inner = text.slice(openEnd, closeIdx);
      const innerRuns = parseInlineRuns(inner, nextStyle);
      for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);

      pos = closeIdx + `[/${bbTag}]`.length;
      tokenRe.lastIndex = pos;
      continue;
    }

    if (match[5] !== undefined) {
      // Wiki template {{Color|color|text}} or {{Highlight|color|text}}
      const fullRaw = match[0];
      const rawColor = match[5].trim();
      const inner = match[6] ?? '';
      if (!isSafeCssColor(rawColor)) {
        continue;
      }
      if (start > pos) {
        pushInlineRun(runs, text.slice(pos, start), inheritedStyle);
      }
      const nextStyle: InlineTextStyle = { ...(inheritedStyle || {}) };
      if (/^\{\{\s*highlight\b/i.test(fullRaw)) {
        nextStyle.backgroundColor = rawColor;
        nextStyle.mark = true;
      } else {
        nextStyle.color = rawColor;
      }
      const innerRuns = parseInlineRuns(inner, nextStyle);
      for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);
      pos = tokenRe.lastIndex;
      continue;
    }

    // Markdown inline styles: ***, **, *, ~~, ==
    if (start > pos) {
      pushInlineRun(runs, text.slice(pos, start), inheritedStyle);
    }
    const nextStyle: InlineTextStyle = { ...(inheritedStyle || {}) };
    let inner = '';
    if (match[7] !== undefined) {
      nextStyle.bold = true;
      nextStyle.italic = true;
      inner = match[7];
    } else if (match[8] !== undefined) {
      nextStyle.bold = true;
      inner = match[8];
    } else if (match[9] !== undefined) {
      nextStyle.italic = true;
      inner = match[9];
    } else if (match[10] !== undefined) {
      nextStyle.strike = true;
      inner = match[10];
    } else if (match[11] !== undefined) {
      nextStyle.mark = true;
      inner = match[11];
    }
    const innerRuns = parseInlineRuns(inner, nextStyle);
    for (const r of innerRuns) pushInlineRun(runs, r.text, r.style);
    pos = tokenRe.lastIndex;
  }

  if (pos < text.length) {
    pushInlineRun(runs, text.slice(pos), inheritedStyle);
  }

  return runs;
}

function runsToPlainText(runs: InlineTextRun[], fallback: string): string {
  const joined = runs.map((r) => r.text).join('');
  return joined || fallback;
}

function splitRoleplayTextChunk(
  text: string,
  state: { inDoubleQuotes: boolean },
  segments: RoleplaySegment[]
): void {
  if (!text) return;

  // Temporarily protect inline color/formatting blocks so *action* splitting never cuts a tag in half
  const protectedBlocks: string[] = [];
  let masked = text;
  const protectBlock = (pattern: RegExp) => {
    masked = masked.replace(pattern, (m) => {
      protectedBlocks.push(m);
      return `%%INLINE_BLOCK_${protectedBlocks.length - 1}%%`;
    });
  };

  protectBlock(/<(span|font|mark|strong|b|em|i|u|del|s)\b[^>]*>[\s\S]*?<\/\1>/gi);
  protectBlock(/\[(color|bgcolor|highlight)\s*=[^\]]+\][\s\S]*?\[\/\1\]/gi);
  protectBlock(/\{\{(?:color|colour|fg|highlight)\s*\|[^|}]+\|[\s\S]*?\}\}/gi);

  const unmask = (s: string): string => {
    let out = s;
    for (let pass = 0; pass < 3 && out.includes('%%INLINE_BLOCK_'); pass++) {
      out = out.replace(/%%INLINE_BLOCK_(\d+)%%/g, (_m, idx) => protectedBlocks[Number(idx)] || '');
    }
    return out;
  };

  const regex = /(\*[^*]+\*)/g;
  const parts = masked.split(regex);

  for (const rawPart of parts) {
    if (!rawPart) continue;
    const isOuterAction = rawPart.startsWith('*') && rawPart.endsWith('*') && !state.inDoubleQuotes;
    const part = unmask(rawPart);

    if (isOuterAction) {
      const innerRaw = part.slice(1, -1);
      const runs = parseInlineRuns(innerRaw, { italic: true });
      segments.push({
        type: 'action',
        text: runsToPlainText(runs, innerRaw),
        runs,
      });
    } else {
      const cleanPart = rawPart.startsWith('*') && rawPart.endsWith('*') ? part.slice(1, -1) : part;
      const quoteCount = (cleanPart.match(/"/g) || []).length;
      if (quoteCount % 2 === 1) {
        state.inDoubleQuotes = !state.inDoubleQuotes;
      }

      const runs = parseInlineRuns(cleanPart);
      const plain = runsToPlainText(runs, cleanPart);
      const prev = segments[segments.length - 1];
      if (prev && prev.type === 'dialogue') {
        prev.text += plain;
        const mergedRuns = [...(prev.runs || [])];
        for (const r of runs) pushInlineRun(mergedRuns, r.text, r.style);
        prev.runs = mergedRuns;
      } else {
        segments.push({
          type: 'dialogue',
          text: plain,
          runs,
        });
      }
    }
  }
}

const BALANCED_MD_IMG_URL =
  '(?:data:image\\/(?:[^\\s()]+|\\([^)\\s]*\\))+|(?:https?:\\/\\/|\\/)(?:[^\\s()]+|\\([^)\\s]*\\))+)';
const BALANCED_MD_HREF_URL =
  '(?:https?:\\/\\/|\\/)(?:[^\\s()]+|\\([^)\\s]*\\))+';
const STANDALONE_IMG_URL =
  '(?:https?:\\/\\/[^\\s<>()"\']+\\.(?:png|jpe?g|gif|webp|avif|svg)(?:\\/revision\\/[^\\s<>()"\']*)?(?:\\?[^\\s<>()"\']*)?(?:#[^\\s<>()"\']*)?|https?:\\/\\/pbs\\.twimg\\.com\\/media\\/[^\\s<>()"\']+\\?[^\\s<>()"\']*\\bformat=(?:png|jpe?g|webp)[^\\s<>()"\']*|https?:\\/\\/images\\.unsplash\\.com\\/photo-[^\\s<>()"\']+|https?:\\/\\/(?:media\\.discordapp\\.net|cdn\\.discordapp\\.com)\\/attachments\\/[^\\s<>()"\']+\\.(?:png|jpe?g|gif|webp|avif)(?:\\?[^\\s<>()"\']*)?)';

/**
 * Splits text into roleplay action blocks (*action*), styled/colored dialogue, and embedded images
 */
export function formatRoleplaySegments(content: string): RoleplaySegment[] {
  if (!content) return [];
  const normalizedContent = decodeEscapedRichTags(content)
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  const segments: RoleplaySegment[] = [];
  const state = { inDoubleQuotes: false };

  // Match clickable markdown image, markdown image, HTML <img>, BBCode [img], data:image URI, or standalone image URL
  const imageTokenRegex = new RegExp(
    `\\[!\\[([^\\]]*)\\]\\((${BALANCED_MD_IMG_URL})(?:\\s+"[^"]*")?\\)\\]\\((${BALANCED_MD_HREF_URL})\\)|!\\[([^\\]]*)\\]\\((${BALANCED_MD_IMG_URL})(?:\\s+"[^"]*")?\\)|<img\\b([^>]*)>|\\[img\\]((?:data:image\\/|https?:\\/\\/|\\/)[^\\[]+?)\\[\\/img\\]|(data:image\\/(?:png|jpeg|jpg|gif|webp|avif|svg\\+xml|bmp);base64,[A-Za-z0-9+/=]+)|((?:^|(?<=[\\s\\n<]))${STANDALONE_IMG_URL})`,
    'gi'
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageTokenRegex.exec(normalizedContent)) !== null) {
    const matchStart = match.index;
    const matchEnd = imageTokenRegex.lastIndex;

    let src = '';
    let alt = '';
    let href: string | undefined;

    if (match[2]) {
      alt = (match[1] || '').trim();
      src = match[2].trim();
      href = match[3]?.trim();
    } else if (match[5]) {
      alt = (match[4] || '').trim();
      src = match[5].trim();
    } else if (match[6] !== undefined) {
      const attrs = match[6];
      const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      src = (srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || '').trim();
      alt = (altMatch?.[1] || altMatch?.[2] || '').trim();
    } else if (match[7]) {
      src = match[7].trim();
    } else if (match[8]) {
      src = match[8].trim();
    } else if (match[9]) {
      src = match[9].trim();
    }

    if (!isSafeMediaUrl(src)) {
      continue;
    }

    if (matchStart > lastIndex) {
      splitRoleplayTextChunk(normalizedContent.slice(lastIndex, matchStart), state, segments);
    }

    segments.push({
      type: 'image',
      text: alt || src,
      src,
      alt: alt || 'Embedded Image',
      href: href && /^https?:\/\/|^\/(?!\/)/i.test(href) ? href : undefined,
    });

    lastIndex = matchEnd;
  }

  if (lastIndex < normalizedContent.length) {
    splitRoleplayTextChunk(normalizedContent.slice(lastIndex), state, segments);
  }

  return segments;
}

/**
 * Extracts UUID, human-readable name, and creator handle from a JanitorAI character path segment.
 * Example: "683af453-907c-42b9-b72a-1d850818193e_character-velvet-by-arzy-parz"
 *   -> { uuid: "683af453-...", name: "Velvet", creator: "Arzy Parz", rawCreatorSlug: "arzy-parz" }
 */
export function parseJanitorSlug(idOrSlug: string): {
  uuid: string;
  name: string;
  creator: string;
  rawCreatorSlug: string;
} {
  const trimmed = decodeURIComponent((idOrSlug || '').trim());
  const uuidMatch = trimmed.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  const uuid = uuidMatch ? uuidMatch[1] : trimmed.split('_')[0] || trimmed;

  const afterUuid = trimmed
    .replace(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_?/i, '')
    .replace(/^character[-_]/i, '');

  let nameSlug = afterUuid;
  let creatorSlug = '';
  const byIdx = afterUuid.lastIndexOf('-by-');
  if (byIdx > 0) {
    nameSlug = afterUuid.slice(0, byIdx);
    creatorSlug = afterUuid.slice(byIdx + 4);
  }

  const formatWords = (s: string) =>
    s
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const name = formatWords(nameSlug) || 'Janitor Character';
  const creator = formatWords(creatorSlug) || 'JanitorCreator';

  return {
    uuid,
    name,
    creator,
    rawCreatorSlug: creatorSlug,
  };
}

export function looksLikeUuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test((value || '').trim());
}

/**
 * Normalizes accidentally prefixed pasted URLs (e.g. "yhttps://spicychat.ai/..." -> "https://spicychat.ai/...")
 */
export function normalizePastedUrl(url: string): string {
  const trimmed = url.trim();
  const accidentalPrefix = trimmed.match(/^[^\s]{1,4}(https?:\/\/\S+)/i);
  if (accidentalPrefix && !/^https?:\/\//i.test(trimmed)) {
    return accidentalPrefix[1];
  }
  return trimmed;
}

/**
 * Parses and identifies character identifiers from Chub.ai, Janitor.ai, SpicyChat.ai, or Fandom/Miraheze URLs
 */
export function parseCharacterUrl(url: string): {
  source: 'chub' | 'janitor' | 'spicychat' | 'fandom' | 'unknown';
  idOrPath: string;
} {
  const clean = normalizePastedUrl(url);

  // Fandom & Miraheze Wikis (e.g. dandysworldcreepypasta.fandom.com/wiki/Nextor,w%C6%B4x or peppafanon.miraheze.org)
  const wikiMatch = clean.match(/(?:fandom\.com|miraheze\.org)\/wiki\/([^?#\s]+)/i);
  if (wikiMatch) {
    try {
      return { source: 'fandom', idOrPath: decodeURIComponent(wikiMatch[1]) };
    } catch {
      return { source: 'fandom', idOrPath: wikiMatch[1] };
    }
  }

  // Chub.ai / Characterhub / Venus.chub.ai:
  // e.g. https://chub.ai/characters/username/bot-name, https://www.chub.ai/characters/user/slug/?foo=bar, etc.
  const chubMatch = clean.match(
    /(?:www\.|venus\.)?(?:chub\.ai|characterhub\.org)\/characters\/([^\/\s?#]+)\/([^\/\s?#]+)/i
  );
  if (chubMatch) {
    const creator = chubMatch[1].replace(/\/+$/, '');
    const slug = chubMatch[2].replace(/\/+$/, '');
    return { source: 'chub', idOrPath: `${creator}/${slug}` };
  }

  // JanitorAI: https://janitorai.com/characters/uuid_or_name or https://janitorai.com/es/characters/...
  const janitorMatch = clean.match(
    /(?:www\.|kim\.)?(?:janitorai\.com|janitor\.ai)\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:profiles\/[^\/]+\/)?characters\/([^\s/?#]+)/i
  );
  if (janitorMatch) {
    return { source: 'janitor', idOrPath: janitorMatch[1] };
  }

  // SpicyChat: https://spicychat.ai/chatbot/uuid, /chat/bot-id, /characters/bot-id, /bot/bot-id
  const spicyMatch = clean.match(
    /(?:www\.|beta\.)?spicychat\.ai\/(?:chatbot|chat|characters?|bot|story)\/([^\s/?#]+)/i
  );
  if (spicyMatch) {
    return { source: 'spicychat', idOrPath: spicyMatch[1] };
  }

  return { source: 'unknown', idOrPath: clean };
}

function escapeHtmlAttr(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildResponsiveWikiImg(src: string, alt: string = '', width?: string): string {
  const safeSrc = escapeHtmlAttr(src.trim());
  const safeAlt = escapeHtmlAttr(alt.trim() || 'Embedded Image');
  const widthCss = width && /^\d+(?:px|%)$/i.test(width.trim()) ? `width: ${width.trim()}; ` : '';
  return `<img src="${safeSrc}" alt="${safeAlt}" referrerpolicy="no-referrer" loading="lazy" style="${widthCss}max-width: 100%; max-height: 440px; height: auto; object-fit: contain; border-radius: 12px; margin: 8px 0; display: block; box-shadow: 0 4px 14px rgba(0,0,0,0.4);" />`;
}

function splitWikiCellAttrsAndText(rawCell: string): { attrs: string; content: string } {
  let inQuotes: '"' | "'" | null = null;
  let tagDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < rawCell.length; i++) {
    const ch = rawCell[i];
    if (inQuotes) {
      if (ch === inQuotes) inQuotes = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuotes = ch;
    } else if (ch === '<') {
      tagDepth++;
    } else if (ch === '>' && tagDepth > 0) {
      tagDepth--;
    } else if (ch === '[' && rawCell[i + 1] === '[') {
      bracketDepth++;
      i++;
    } else if (ch === ']' && rawCell[i + 1] === ']' && bracketDepth > 0) {
      bracketDepth--;
      i++;
    } else if (ch === '|' && rawCell[i + 1] !== '|' && tagDepth === 0 && bracketDepth === 0) {
      const left = rawCell.slice(0, i).trim();
      const right = rawCell.slice(i + 1).trim();
      if (/\b(?:style|colspan|rowspan|align|valign|class|width|bgcolor|color)\s*=/i.test(left)) {
        return { attrs: left, content: right };
      }
      break;
    }
  }
  return { attrs: '', content: rawCell.trim() };
}

function extractSafeCellAttrs(attrString: string): {
  colspan: string;
  rowspan: string;
  style: string;
} {
  if (!attrString) return { colspan: '', rowspan: '', style: '' };
  const colspanMatch = attrString.match(/\bcolspan\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))/i);
  const rowspanMatch = attrString.match(/\browspan\s*=\s*(?:"(\d+)"|'(\d+)'|(\d+))/i);
  const styleMatch = attrString.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  const alignMatch = attrString.match(/\balign\s*=\s*(?:"(left|center|right)"|'(left|center|right)'|(left|center|right))/i);
  const bgcolorMatch = attrString.match(/\bbgcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/i);

  let style = sanitizeCssStyleString(styleMatch?.[1] || styleMatch?.[2] || '');
  const align = alignMatch?.[1] || alignMatch?.[2] || alignMatch?.[3] || '';
  if (align && !/\btext-align\s*:/i.test(style)) {
    style = style ? `${style}; text-align: ${align}` : `text-align: ${align}`;
  }
  const bgcolor = (bgcolorMatch?.[1] || bgcolorMatch?.[2] || bgcolorMatch?.[3] || '').trim();
  if (bgcolor && isSafeCssColor(bgcolor) && !/\bbackground(?:-color)?\s*:/i.test(style)) {
    style = style ? `${style}; background-color: ${bgcolor}` : `background-color: ${bgcolor}`;
  }

  return {
    colspan: colspanMatch?.[1] || colspanMatch?.[2] || colspanMatch?.[3] || '',
    rowspan: rowspanMatch?.[1] || rowspanMatch?.[2] || rowspanMatch?.[3] || '',
    style,
  };
}

/**
 * Converts Fandom Wikia / Miraheze / MediaWiki / Markdown markup, inline colors, & embedded images into clean safe styled HTML
 */
export function renderWikiMarkup(text: string, characterName: string = 'Character'): string {
  if (!text) return '';
  let html = decodeEscapedRichTags(text);

  // Strip dangerous script tags / inline JS event handlers / javascript: URLs
  html = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript\s*:/gi, '');

  // Sanitize inline style="..." attributes on existing HTML tags to prevent CSS injection
  html = html.replace(/\bstyle\s*=\s*("([^"]*)"|'([^']*)')/gi, (_m, _q, dq, sq) => {
    const safe = sanitizeCssStyleString(dq ?? sq ?? '');
    return safe ? `style="${escapeHtmlAttr(safe)}"` : '';
  });

  // Protect <nowiki> content temporarily
  const nowikis: string[] = [];
  html = html.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (_m, content) => {
    nowikis.push(content);
    return `%%NOWIKI_${nowikis.length - 1}%%`;
  });

  // Normalize legacy <font color="..."> tags into safe <span style="color: ..."> (multiple passes for nested)
  for (let pass = 0; pass < 4 && /<font\b/i.test(html); pass++) {
    html = html.replace(/<font\b([^>]*)>([\s\S]*?)<\/font>/gi, (_m, attrs, inner) => {
      const colorMatch = attrs.match(/\bcolor\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const styleMatch = attrs.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const rawColor = (colorMatch?.[1] || colorMatch?.[2] || colorMatch?.[3] || '').trim();
      let safeStyle = sanitizeCssStyleString(styleMatch?.[1] || styleMatch?.[2] || '');
      if (isSafeCssColor(rawColor)) {
        safeStyle = `color: ${rawColor}${safeStyle ? `; ${safeStyle}` : ''}`;
      }
      return safeStyle ? `<span style="${escapeHtmlAttr(safeStyle)}">${inner}</span>` : inner;
    });
  }

  // Convert BBCode [color=...], [bgcolor=...], [highlight=...] & Wiki {{Color|...}} templates into styled spans
  for (let pass = 0; pass < 4; pass++) {
    const before = html;
    html = html.replace(
      /\[color\s*=\s*("[^"]+"|'[^']+'|[^\]\s]+)\s*\]([\s\S]*?)\[\/color\]/gi,
      (_m, rawColor, inner) => {
        const cleanColor = String(rawColor).replace(/^["']|["']$/g, '').trim();
        return isSafeCssColor(cleanColor)
          ? `<span style="color: ${escapeHtmlAttr(cleanColor)};">${inner}</span>`
          : inner;
      }
    );
    html = html.replace(
      /\[(?:bgcolor|highlight)\s*=\s*("[^"]+"|'[^']+'|[^\]\s]+)\s*\]([\s\S]*?)\[\/(?:bgcolor|highlight)\]/gi,
      (_m, rawColor, inner) => {
        const cleanColor = String(rawColor).replace(/^["']|["']$/g, '').trim();
        return isSafeCssColor(cleanColor)
          ? `<span style="background-color: ${escapeHtmlAttr(cleanColor)}; padding: 1px 5px; border-radius: 4px;">${inner}</span>`
          : inner;
      }
    );
    html = html.replace(
      /\{\{(color|colour|fg|highlight)\s*\|\s*([^|}]+)\s*\|\s*([\s\S]*?)\}\}/gi,
      (_m, tmpl, rawColor, inner) => {
        const cleanColor = String(rawColor).trim();
        if (!isSafeCssColor(cleanColor)) return inner;
        if (/highlight/i.test(tmpl)) {
          return `<span style="background-color: ${escapeHtmlAttr(cleanColor)}; padding: 1px 5px; border-radius: 4px;">${inner}</span>`;
        }
        return `<span style="color: ${escapeHtmlAttr(cleanColor)};">${inner}</span>`;
      }
    );
    if (html === before) break;
  }

  // Protect media blocks (images, galleries, audio, video) BEFORE italic/link/linebreak transforms
  const mediaBlocks: string[] = [];
  const stashMedia = (snippet: string): string => {
    mediaBlocks.push(snippet);
    return `%%MEDIA_${mediaBlocks.length - 1}%%`;
  };

  // Wiki Image Gallery: <gallery> ... </gallery>
  html = html.replace(/<gallery(?:[^>]*)>([\s\S]*?)<\/gallery>/gi, (_m, galleryContent) => {
    const lines = galleryContent.trim().split('\n');
    let galleryHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin: 14px 0; background: rgba(24, 24, 27, 0.6); padding: 12px; border-radius: 12px; border: 1px solid rgba(63,63,70,0.6);">';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|');
      const filePart = parts[0].replace(/^File:|^Image:/i, '').trim();
      const caption = parts[1] || filePart;
      const placeholderImg = isSafeMediaUrl(filePart)
        ? filePart
        : 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80';
      galleryHtml += `<div style="display: flex; flex-direction: column; align-items: center; background: rgba(9, 9, 11, 0.8); border: 1px solid rgba(168,85,247,0.3); border-radius: 10px; overflow: hidden; padding: 6px;"><img src="${escapeHtmlAttr(placeholderImg)}" alt="${escapeHtmlAttr(caption)}" referrerpolicy="no-referrer" loading="lazy" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px;" /><span style="font-size: 10px; color: #d4d4d8; text-align: center; margin-top: 4px; line-height: 1.2;">${escapeHtmlAttr(caption)}</span></div>`;
    }
    galleryHtml += '</div>';
    return stashMedia(galleryHtml);
  });

  // Protect existing HTML <video> and <audio> tags
  html = html.replace(/<(video|audio)\b[\s\S]*?<\/\1>/gi, (m) => stashMedia(m));

  // Protect & normalize existing HTML <img ...> tags (adding referrerPolicy & responsive styling if missing)
  html = html.replace(/<img\b([^>]*)>/gi, (fullTag, attrs) => {
    const srcMatch = attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const src = (srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || '').trim();
    if (!isSafeMediaUrl(src)) return '';
    const altMatch = attrs.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    const widthMatch = attrs.match(/\bwidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const alt = altMatch?.[1] || altMatch?.[2] || '';
    const rawW = widthMatch?.[1] || widthMatch?.[2] || widthMatch?.[3] || '';
    const width = /^\d+$/.test(rawW) ? `${rawW}px` : rawW;
    if (/\bstyle\s*=/i.test(attrs)) {
      const normalizedTag = /\breferrerpolicy\s*=/i.test(attrs)
        ? fullTag
        : fullTag.replace(/^<img\b/i, '<img referrerpolicy="no-referrer"');
      return stashMedia(normalizedTag);
    }
    return stashMedia(buildResponsiveWikiImg(src, alt, width));
  });

  // Clickable Markdown Images: [![alt](imgUrl)](linkUrl)
  html = html.replace(
    new RegExp(
      `\\[!\\[([^\\]]*)\\]\\((${BALANCED_MD_IMG_URL})(?:\\s+"[^"]*")?\\)\\]\\((${BALANCED_MD_HREF_URL})\\)`,
      'gi'
    ),
    (_m, alt, imgSrc, href) => {
      if (!isSafeMediaUrl(imgSrc)) return _m;
      return stashMedia(
        `<a href="${escapeHtmlAttr(href)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; max-width: 100%;">${buildResponsiveWikiImg(imgSrc, alt)}</a>`
      );
    }
  );

  // Markdown Images: ![alt](imgUrl)
  html = html.replace(
    new RegExp(`!\\[([^\\]]*)\\]\\((${BALANCED_MD_IMG_URL})(?:\\s+"[^"]*")?\\)`, 'gi'),
    (_m, alt, imgSrc) => {
      if (!isSafeMediaUrl(imgSrc)) return _m;
      return stashMedia(buildResponsiveWikiImg(imgSrc, alt));
    }
  );

  // BBCode Images: [img]url[/img]
  html = html.replace(
    /\[img\]((?:data:image\/|https?:\/\/|\/)[^\[]+?)\[\/img\]/gi,
    (_m, imgSrc) => {
      if (!isSafeMediaUrl(imgSrc)) return _m;
      return stashMedia(buildResponsiveWikiImg(imgSrc, 'Embedded Image'));
    }
  );

  // MediaWiki File/Image embeds: [[File:...|...]] or [[Image:...|...]]
  html = html.replace(/\[\[(?:File|Image):([^\]]+)\]\]/gi, (_m, inner) => {
    const parts = inner.split('|').map((s: string) => s.trim()).filter(Boolean);
    const target = parts[0] || '';
    const widthPart = parts.find((p: string) => /^\d+px$/i.test(p));
    const captionPart = parts.find(
      (p: string, idx: number) =>
        idx > 0 && !/^(?:thumb|thumbnail|frame|frameless|left|right|center|none|\d+px)$/i.test(p)
    );
    if (isSafeMediaUrl(target)) {
      return stashMedia(buildResponsiveWikiImg(target, captionPart || 'Wiki Image', widthPart));
    }
    return stashMedia(
      `<div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(24,24,27,0.8); border: 1px solid rgba(168,85,247,0.35); border-radius: 10px; padding: 6px 10px; font-size: 12px; color: #e9d5ff; margin: 4px 0;">🖼️ <span>${escapeHtmlAttr(captionPart || target)}</span></div>`
    );
  });

  // Standalone image URLs or bare data:image/... URIs on their own line
  html = html.replace(
    new RegExp(
      `(^|\\n)[ \\t]*((?:data:image\\/(?:png|jpeg|jpg|gif|webp|avif|svg\\+xml|bmp);base64,[A-Za-z0-9+/=]+)|${STANDALONE_IMG_URL})[ \\t]*(?=\\n|$)`,
      'gi'
    ),
    (_m, lead, imgSrc) => {
      if (!isSafeMediaUrl(imgSrc)) return _m;
      return `${lead}${stashMedia(buildResponsiveWikiImg(imgSrc, 'Image'))}`;
    }
  );

  // MediaWiki Headings (Level 2 to 5)
  html = html.replace(/^=====\s*(.*?)\s*=====$/gim, '<h5 style="font-size: 0.95rem; font-weight: 700; color: #e9d5ff; margin-top: 10px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">$1</h5>');
  html = html.replace(/^====\s*(.*?)\s*====$/gim, '<h4 style="font-size: 1.05rem; font-weight: 700; color: #d8b4fe; margin-top: 12px; margin-bottom: 6px; border-bottom: 1px dashed rgba(168,85,247,0.25); padding-bottom: 3px;">$1</h4>');
  html = html.replace(/^===\s*(.*?)\s*===$/gim, '<h3 style="font-size: 1.2rem; font-weight: 800; color: #f3e8ff; margin-top: 16px; margin-bottom: 6px; border-bottom: 1px solid rgba(168,85,247,0.35); padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^==\s*(.*?)\s*==$/gim, '<h2 style="font-size: 1.45rem; font-weight: 900; color: #faf5ff; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #a855f7; padding-bottom: 6px; display: flex; align-items: center; gap: 8px;"><span style="color: #c084fc;">§</span> $1</h2>');

  // Markdown Headings fallback
  html = html.replace(/^### (.*$)/gim, '<h3 style="font-size: 1.2rem; font-weight: 800; color: #f3e8ff; margin-top: 16px; margin-bottom: 6px; border-bottom: 1px solid rgba(168,85,247,0.35); padding-bottom: 4px;">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 style="font-size: 1.45rem; font-weight: 900; color: #faf5ff; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #a855f7; padding-bottom: 6px;">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 style="font-size: 1.75rem; font-weight: 900; color: #ffffff; margin-top: 22px; margin-bottom: 10px; border-bottom: 3px solid #9333ea; padding-bottom: 8px;">$1</h1>');

  // Horizontal divider ----
  html = html.replace(/^----$/gim, '<hr style="border: 0; border-top: 1px solid rgba(168,85,247,0.3); margin: 16px 0;" />');

  // Wiki Templates: {{Warning|...}} & {{Quote|...}}
  html = html.replace(/\{\{Warning\|([\s\S]*?)\}\}/gi, (_m, warningText) => {
    return `<div style="background: rgba(225, 29, 72, 0.15); border: 2px solid #f43f5e; border-radius: 12px; padding: 10px 14px; margin: 12px 0; color: #ffe4e6; display: flex; align-items: center; gap: 10px;"><span style="font-size: 20px;">⚠️</span><div><strong style="color: #fb7185; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; display: block;">Fanon / Warning Notice</strong><span style="font-size: 12px;">${warningText}</span></div></div>`;
  });

  html = html.replace(/\{\{Quote\|([\s\S]*?)(?:\|(.*?))?\}\}/gi, (_m, quoteText, author) => {
    return `<div style="background: rgba(39, 39, 42, 0.7); border-left: 4px solid #a855f7; border-radius: 0 12px 12px 0; padding: 10px 14px; margin: 12px 0; font-style: italic; color: #f4f4f5;"><p style="margin: 0; font-size: 13px;">&ldquo;${quoteText}&rdquo;</p>${author ? `<p style="margin-top: 6px; margin-bottom: 0; font-size: 11px; font-weight: bold; color: #d8b4fe; font-style: normal;">— ${author}</p>` : ''}</div>`;
  });

  // Category tags: [[Category:Peppa Fanon]]
  html = html.replace(/\[\[Category:\s*([^\]]+)\]\]/gi, (_m, categoryName) => {
    return `<span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(168,85,247,0.2); border: 1px solid rgba(168,85,247,0.4); border-radius: 6px; padding: 2px 8px; font-size: 11px; color: #e9d5ff; margin-right: 6px; margin-bottom: 4px;">🏷️ ${categoryName}</span>`;
  });

  // Internal Wiki Links: [[Target|Label]] or [[Target]]
  html = html.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => {
    const display = label || target;
    return `<span style="color: #c084fc; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-weight: 500;" title="Wiki link to ${target}">${display}</span>`;
  });

  // Markdown Links: [Label](https://...)
  html = html.replace(
    /\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 500;">$1 ↗</a>'
  );

  // External MediaWiki Links: [http://... Display Text]
  html = html.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 500;">$2 ↗</a>');

  // References: <ref>...</ref>
  html = html.replace(/<ref>([\s\S]*?)<\/ref>/gi, '<sup><span style="color: #c084fc; font-weight: bold; font-size: 10px; background: rgba(168,85,247,0.15); padding: 0 4px; border-radius: 3px; cursor: help;" title="$1">[ref]</span></sup>');

  // Protect HTML opening/closing tags so bold/italic/highlight transforms never corrupt attributes like style="..."
  const htmlTagStash: string[] = [];
  html = html.replace(/<\/?[a-z][a-z0-9]*(?:\s+[^<>]*)?\/?>/gi, (tag) => {
    htmlTagStash.push(tag);
    return `%%HTAG_${htmlTagStash.length - 1}%%`;
  });

  // Bold & Italic (using <em> without hardcoded color so parent colors inherit cleanly; CSS colors default em)
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/'''''([^']+)'''''/g, '<strong><em>$1</em></strong>');
  html = html.replace(/'''([^']+)'''/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/''([^']+)''/g, '<em>$1</em>');

  // Strikethrough & Highlight
  html = html.replace(/~~([^~]+)~~/g, '<del style="opacity: 0.6;">$1</del>');
  html = html.replace(/==([^=]+)==/g, '<mark style="background: rgba(234, 179, 8, 0.25); color: #fde047; padding: 2px 6px; border-radius: 4px;">$1</mark>');

  // Restore stashed HTML tags
  html = html.replace(/%%HTAG_(\d+)%%/g, (_m, idx) => htmlTagStash[Number(idx)] || '');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid #c084fc; padding-left: 12px; margin: 10px 0; color: #e9d5ff; font-style: italic; background: rgba(168,85,247,0.06); padding: 8px 12px; border-radius: 0 8px 8px 0;">$1</blockquote>');

  // Dialogue macros: {{user}}, {{char}}, <START>
  html = html.replace(/\{\{user\}\}/gi, '<span style="color: #f59e0b; font-weight: bold; background: rgba(245,158,11,0.15); padding: 1px 5px; border-radius: 4px;">{{user}}</span>');
  html = html.replace(/\{\{char\}\}/gi, `<span style="color: #a855f7; font-weight: bold; background: rgba(168,85,247,0.15); padding: 1px 5px; border-radius: 4px;">${characterName}</span>`);
  html = html.replace(/<START>/gi, '<div style="margin: 12px 0; padding: 4px 10px; background: rgba(168, 85, 247, 0.2); border-left: 3px solid #a855f7; font-family: monospace; font-size: 11px; color: #d8b4fe; border-radius: 0 6px 6px 0;">&lt;START OF DIALOGUE&gt;</div>');

  // Wikitables & Fandom Infoboxes (preserving table, row |- style="...", and cell | style="..." | colors)
  if (html.includes('{|')) {
    html = html.replace(/\{\|([^\n]*)\n([\s\S]*?)\|\}/g, (_match, tableAttrLine, tableContent) => {
      const tableAttrInfo = extractSafeCellAttrs(tableAttrLine || '');
      const defaultTableStyle =
        'width: 100%; border-collapse: collapse; margin: 12px 0; background: rgba(24, 24, 27, 0.95); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 12px; overflow: hidden; font-size: 12px;';
      const tableStyle = tableAttrInfo.style
        ? `border-collapse: collapse; overflow: hidden; ${tableAttrInfo.style}`
        : defaultTableStyle;

      const rowBlocks = tableContent.split(/^\s*\|-/m);
      let tableHtml = `<table style="${escapeHtmlAttr(tableStyle)}">`;

      for (const rawRow of rowBlocks) {
        const trimmed = rawRow.trim();
        if (!trimmed) continue;

        const firstNewline = rawRow.indexOf('\n');
        let rowStyle = '';
        let rowBody = rawRow;
        if (firstNewline !== -1) {
          const firstLine = rawRow.slice(0, firstNewline).trim();
          if (firstLine && !firstLine.startsWith('!') && !firstLine.startsWith('|')) {
            rowStyle = extractSafeCellAttrs(firstLine).style;
            rowBody = rawRow.slice(firstNewline + 1);
          }
        } else if (!trimmed.startsWith('!') && !trimmed.startsWith('|')) {
          continue;
        }

        const lines = rowBody.split('\n').map((l: string) => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        tableHtml += rowStyle ? `<tr style="${escapeHtmlAttr(rowStyle)}">` : '<tr>';
        for (const lTrim of lines) {
          if (lTrim.startsWith('!')) {
            const cellContent = lTrim.replace(/^!+/, '').trim();
            const cells = cellContent.split('!!');
            for (const c of cells) {
              const { attrs, content } = splitWikiCellAttrsAndText(c);
              const parsed = extractSafeCellAttrs(attrs);
              const colspanAttr = parsed.colspan ? ` colspan="${parsed.colspan}"` : '';
              const rowspanAttr = parsed.rowspan ? ` rowspan="${parsed.rowspan}"` : '';
              const baseHeaderStyle = parsed.colspan
                ? 'background: linear-gradient(135deg, rgba(168,85,247,0.4), rgba(219,39,119,0.3)); color: #ffffff; text-align: center; font-weight: bold; padding: 8px 10px; font-size: 13px;'
                : 'background: rgba(168,85,247,0.2); color: #e9d5ff; font-weight: bold; padding: 6px 10px; text-align: left;';
              const thStyle = parsed.style
                ? `padding: 6px 10px; font-weight: bold; ${parsed.style}`
                : rowStyle
                ? 'padding: 8px 10px; font-weight: bold;'
                : baseHeaderStyle;
              tableHtml += `<th${colspanAttr}${rowspanAttr} style="${escapeHtmlAttr(thStyle)}">${content}</th>`;
            }
          } else if (lTrim.startsWith('|')) {
            const rowContent = lTrim.replace(/^\|+/, '').trim();
            const cells = rowContent.split('||');
            for (const c of cells) {
              const { attrs, content } = splitWikiCellAttrsAndText(c);
              const parsed = extractSafeCellAttrs(attrs);
              const colspanAttr = parsed.colspan ? ` colspan="${parsed.colspan}"` : '';
              const rowspanAttr = parsed.rowspan ? ` rowspan="${parsed.rowspan}"` : '';
              const baseTdStyle = 'padding: 6px 10px; border-bottom: 1px solid rgba(63,63,70,0.5);';
              const tdStyle = parsed.style ? `${baseTdStyle} ${parsed.style}` : baseTdStyle;
              tableHtml += `<td${colspanAttr}${rowspanAttr} style="${escapeHtmlAttr(tdStyle)}">${content}</td>`;
            }
          }
        }
        tableHtml += '</tr>';
      }
      tableHtml += '</table>';
      return tableHtml;
    });
  }

  // Restore <nowiki> content
  html = html.replace(/%%NOWIKI_(\d+)%%/g, (_m, idx) => {
    return `<code>${nowikis[Number(idx)] || ''}</code>`;
  });

  // Convert newlines to paragraphs, then restore protected media blocks
  const wrapped = html
    .split('\n\n')
    .map((p) => {
      const trimmed = p.trim();
      if (/^%%MEDIA_\d+%%$/.test(trimmed)) {
        return trimmed;
      }
      if (/^<(?:table|div|h[1-6]|blockquote|hr)\b/i.test(trimmed)) {
        return trimmed;
      }
      return `<p style="margin-bottom: 8px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');

  return wrapped.replace(/%%MEDIA_(\d+)%%/g, (_m, idx) => mediaBlocks[Number(idx)] || '');
}

export interface TokenBreakdown {
  description: number;
  personality: number;
  scenario: number;
  greeting: number;
  exampleDialogues: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  permanent: number;
  total: number;
}

const estimateTokens = (text?: string | null): number => {
  if (!text) return 0;
  return Math.max(0, Math.round(text.trim().length / 3.8));
};

/**
 * Computes Chub.ai / Janitor.ai style per-field token breakdown
 */
export function calculateTokenBreakdown(character: {
  description?: string | null;
  personality?: string | null;
  scenario?: string | null;
  greeting?: string | null;
  exampleDialogues?: string | null;
  systemPrompt?: string | null;
  postHistoryInstructions?: string | null;
}): TokenBreakdown {
  const description = estimateTokens(character.description);
  const personality = estimateTokens(character.personality);
  const scenario = estimateTokens(character.scenario);
  const greeting = estimateTokens(character.greeting);
  const exampleDialogues = estimateTokens(character.exampleDialogues);
  const systemPrompt = estimateTokens(character.systemPrompt);
  const postHistoryInstructions = estimateTokens(character.postHistoryInstructions);

  const permanent = description + personality + scenario + systemPrompt + postHistoryInstructions;
  const total = permanent + greeting + exampleDialogues;

  return {
    description,
    personality,
    scenario,
    greeting,
    exampleDialogues,
    systemPrompt,
    postHistoryInstructions,
    permanent,
    total,
  };
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.trim());
  const utf8Bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    utf8Bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(utf8Bytes);
}

/**
 * Extracts a Chub/Tavern V1/V2/V3 JSON card embedded inside a PNG tEXt or iTXt ('chara' or 'ccv3') chunk
 */
export function extractChubPngCard(
  buffer: ArrayBuffer,
  fallbackAvatarUrl?: string
): NormalizedCharacter | null {
  try {
    const bytes = new Uint8Array(buffer);
    // Check PNG signature: 89 50 4E 47
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      return null;
    }

    const candidates: { ccv3?: string; chara?: string } = {};
    let offset = 8;
    const latin1Decoder = new TextDecoder('latin1');
    const utf8Decoder = new TextDecoder('utf-8');

    while (offset + 8 <= bytes.length) {
      const length =
        ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>>
        0;
      const type = latin1Decoder.decode(bytes.subarray(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > bytes.length) break;

      if (type === 'tEXt') {
        const chunkBytes = bytes.subarray(dataStart, dataEnd);
        const nullIdx = chunkBytes.indexOf(0);
        if (nullIdx !== -1) {
          const keyword = latin1Decoder.decode(chunkBytes.subarray(0, nullIdx)).toLowerCase();
          if (keyword === 'chara' || keyword === 'ccv3') {
            const b64 = latin1Decoder.decode(chunkBytes.subarray(nullIdx + 1));
            const jsonText = decodeBase64Utf8(b64);
            if (keyword === 'ccv3') candidates.ccv3 = jsonText;
            else candidates.chara = jsonText;
          }
        }
      } else if (type === 'iTXt') {
        const chunkBytes = bytes.subarray(dataStart, dataEnd);
        const nullIdx = chunkBytes.indexOf(0);
        if (nullIdx !== -1) {
          const keyword = latin1Decoder.decode(chunkBytes.subarray(0, nullIdx)).toLowerCase();
          if ((keyword === 'chara' || keyword === 'ccv3') && nullIdx + 3 < chunkBytes.length) {
            const compressionFlag = chunkBytes[nullIdx + 1];
            if (compressionFlag === 0) {
              // Skip language tag (\0) and translated keyword (\0)
              const langEnd = chunkBytes.indexOf(0, nullIdx + 3);
              const transEnd = langEnd !== -1 ? chunkBytes.indexOf(0, langEnd + 1) : -1;
              if (transEnd !== -1) {
                const rawText = utf8Decoder.decode(chunkBytes.subarray(transEnd + 1)).trim();
                const jsonText = rawText.startsWith('{') ? rawText : decodeBase64Utf8(rawText);
                if (keyword === 'ccv3') candidates.ccv3 = jsonText;
                else candidates.chara = jsonText;
              }
            }
          }
        }
      }

      offset = dataEnd + 4; // skip 4-byte CRC
      if (type === 'IEND') break;
    }

    const chosenJson = candidates.ccv3 || candidates.chara;
    if (chosenJson) {
      return parseTavernCard(chosenJson, fallbackAvatarUrl);
    }
  } catch {
    return null;
  }
  return null;
}


