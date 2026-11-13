import { ContentRating } from '../types/index.ts';

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

/**
 * Parses and normalizes Chub.ai / Janitor.ai / TavernAI character JSON specs
 */
export function parseTavernCard(jsonInput: string | object): NormalizedCharacter {
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

  // Handle Character Card V2 format (Chub / Tavern V2)
  if (parsed.spec === 'chara_card_v2' && parsed.data) {
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

    const ratingVal = d.extensions?.rating || (d.tags?.includes('NSFL') ? 'NSFL' : d.tags?.includes('NSFW') ? 'NSFW' : 'SFW');
    const validRating: ContentRating =
      ratingVal === 'NSFL' || ratingVal === 'NSFW + NSFL' || ratingVal === 'NSFW' ? ratingVal : 'SFW';

    return {
      name: d.name?.trim() || 'Unnamed Character',
      tagline: d.creator_notes?.trim() || d.description?.slice(0, 120)?.trim() || 'A mysterious persona',
      avatar: d.extensions?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
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
      tags: Array.isArray(d.tags) && d.tags.length > 0 ? d.tags : ['Original', 'RPG'],
      rating: validRating,
      creatorName: d.creator?.trim() || 'Community',
      voiceName: d.extensions?.voiceName || 'Puck',
      lorebook: lorebookEntries,
    };
  }

  // Handle Legacy V1 / Janitor format
  const name = parsed.name?.trim() || 'Unnamed Character';
  const legacyRating: ContentRating =
    parsed.rating === 'NSFL' || parsed.rating === 'NSFW + NSFL' || parsed.rating === 'NSFW' ? parsed.rating : 'SFW';

  return {
    name,
    tagline: parsed.tagline?.trim() || parsed.description?.slice(0, 120)?.trim() || 'A unique character',
    avatar: parsed.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    backgroundImage: parsed.backgroundImage || parsed.background || '',
    description: parsed.description || 'No description provided.',
    personality: parsed.personality || '',
    greeting: parsed.first_mes || parsed.greeting || '*Looks at you attentively.* Hello.',
    alternateGreetings: Array.isArray(parsed.alternate_greetings || parsed.alternateGreetings)
      ? parsed.alternate_greetings || parsed.alternateGreetings
      : [],
    systemPrompt: parsed.system_prompt || parsed.prompt || `You are ${name}. Maintain character immersion.`,
    postHistoryInstructions: parsed.post_history_instructions || parsed.postHistoryInstructions || '',
    creatorNotes: parsed.creator_notes || parsed.creatorNotes || '',
    characterVersion: parsed.character_version || '1.0',
    scenario: parsed.scenario || '',
    exampleDialogues: parsed.mes_example || parsed.exampleDialogues || '',
    tags: Array.isArray(parsed.tags) ? parsed.tags : ['Roleplay', 'Fantasy'],
    rating: legacyRating,
    creatorName: parsed.creator || 'Community',
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

export interface RoleplaySegment {
  type: 'action' | 'dialogue' | 'thought';
  text: string;
}

/**
 * Splits text into roleplay action blocks (*action*) and spoken dialogue
 */
export function formatRoleplaySegments(content: string): RoleplaySegment[] {
  if (!content) return [];
  const segments: RoleplaySegment[] = [];

  const regex = /(\*[^*]+\*)/g;
  const parts = content.split(regex);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('*') && part.endsWith('*')) {
      segments.push({
        type: 'action',
        text: part.slice(1, -1),
      });
    } else {
      segments.push({
        type: 'dialogue',
        text: part,
      });
    }
  }

  return segments;
}

/**
 * Parses and identifies character identifiers from Chub.ai, Janitor.ai, or SpicyChat.ai URLs
 */
export function parseCharacterUrl(url: string): {
  source: 'chub' | 'janitor' | 'spicychat' | 'fandom' | 'unknown';
  idOrPath: string;
} {
  const clean = url.trim();

  // Fandom & Miraheze Wikis (e.g. dandysworldcreepypasta.fandom.com/wiki/Nextor,w%C6%B4x or peppafanon.miraheze.org)
  const wikiMatch = clean.match(/(?:fandom\.com|miraheze\.org)\/wiki\/([^?#\s]+)/i);
  if (wikiMatch) {
    return { source: 'fandom', idOrPath: decodeURIComponent(wikiMatch[1]) };
  }

  // Chub.ai / Characterhub: https://chub.ai/characters/username/bot-name or https://characterhub.org/characters/...
  const chubMatch = clean.match(/(?:chub\.ai|characterhub\.org)\/characters\/([^\/\s]+\/[^\/\s\?#]+)/i);
  if (chubMatch) {
    return { source: 'chub', idOrPath: chubMatch[1] };
  }

  // JanitorAI: https://janitorai.com/characters/uuid_or_name or https://janitor.ai/characters/...
  const janitorMatch = clean.match(/(?:janitorai\.com|janitor\.ai)\/(?:profiles\/[^\/]+\/)?characters\/([a-zA-Z0-9_-]+)/i);
  if (janitorMatch) {
    return { source: 'janitor', idOrPath: janitorMatch[1] };
  }

  // SpicyChat: https://spicychat.ai/chat/bot-id or /characters/bot-id
  const spicyMatch = clean.match(/spicychat\.ai\/(?:chat|characters)\/([a-zA-Z0-9_-]+)/i);
  if (spicyMatch) {
    return { source: 'spicychat', idOrPath: spicyMatch[1] };
  }

  return { source: 'unknown', idOrPath: clean };
}

/**
 * Converts Fandom Wikia / Miraheze / MediaWiki markup into clean safe styled HTML
 */
export function renderWikiMarkup(text: string, characterName: string = 'Character'): string {
  if (!text) return '';
  let html = text;

  // Protect <nowiki> content temporarily
  const nowikis: string[] = [];
  html = html.replace(/<nowiki>([\s\S]*?)<\/nowiki>/gi, (_m, content) => {
    nowikis.push(content);
    return `%%NOWIKI_${nowikis.length - 1}%%`;
  });

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
      const placeholderImg = filePart.startsWith('http') ? filePart : 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=80';
      galleryHtml += `<div style="display: flex; flex-direction: column; align-items: center; background: rgba(9, 9, 11, 0.8); border: 1px solid rgba(168,85,247,0.3); border-radius: 10px; overflow: hidden; padding: 6px;"><img src="${placeholderImg}" alt="${caption}" style="width: 100%; height: 90px; object-fit: cover; border-radius: 6px;" /><span style="font-size: 10px; color: #d4d4d8; text-align: center; margin-top: 4px; line-height: 1.2;">${caption}</span></div>`;
    }
    galleryHtml += '</div>';
    return galleryHtml;
  });

  // Internal Wiki Links: [[Target|Label]] or [[Target]]
  html = html.replace(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g, (_m, target, label) => {
    const display = label || target;
    return `<span style="color: #c084fc; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; font-weight: 500;" title="Wiki link to ${target}">${display}</span>`;
  });

  // External Links: [http://... Display Text]
  html = html.replace(/\[(https?:\/\/[^\s\]]+)\s+([^\]]+)\]/g, '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline; font-weight: 500;">$2 ↗</a>');

  // References: <ref>...</ref>
  html = html.replace(/<ref>([\s\S]*?)<\/ref>/gi, '<sup><span style="color: #c084fc; font-weight: bold; font-size: 10px; background: rgba(168,85,247,0.15); padding: 0 4px; border-radius: 3px; cursor: help;" title="$1">[ref]</span></sup>');

  // Bold & Italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/'''''([^']+)'''''/g, '<strong><em>$1</em></strong>');
  html = html.replace(/'''([^']+)'''/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em style="color: #d8b4fe;">$1</em>');
  html = html.replace(/''([^']+)''/g, '<em style="color: #d8b4fe;">$1</em>');

  // Strikethrough & Highlight
  html = html.replace(/~~([^~]+)~~/g, '<del style="opacity: 0.6;">$1</del>');
  html = html.replace(/==([^=]+)==/g, '<mark style="background: rgba(234, 179, 8, 0.25); color: #fde047; padding: 2px 6px; border-radius: 4px;">$1</mark>');

  // Blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote style="border-left: 3px solid #c084fc; padding-left: 12px; margin: 10px 0; color: #e9d5ff; font-style: italic; background: rgba(168,85,247,0.06); padding: 8px 12px; border-radius: 0 8px 8px 0;">$1</blockquote>');

  // Dialogue macros: {{user}}, {{char}}, <START>
  html = html.replace(/\{\{user\}\}/gi, '<span style="color: #f59e0b; font-weight: bold; background: rgba(245,158,11,0.15); padding: 1px 5px; border-radius: 4px;">{{user}}</span>');
  html = html.replace(/\{\{char\}\}/gi, `<span style="color: #a855f7; font-weight: bold; background: rgba(168,85,247,0.15); padding: 1px 5px; border-radius: 4px;">${characterName}</span>`);
  html = html.replace(/<START>/gi, '<div style="margin: 12px 0; padding: 4px 10px; background: rgba(168, 85, 247, 0.2); border-left: 3px solid #a855f7; font-family: monospace; font-size: 11px; color: #d8b4fe; border-radius: 0 6px 6px 0;">&lt;START OF DIALOGUE&gt;</div>');

  // Wikitables & Fandom Infoboxes
  if (html.includes('{|')) {
    html = html.replace(/\{\|([\s\S]*?)\|\}/g, (_match, tableContent) => {
      const parts = tableContent.split('|-');
      const rowParts = parts.length > 1 ? parts.slice(1) : parts;

      let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 12px 0; background: rgba(24, 24, 27, 0.95); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 12px; overflow: hidden; font-size: 12px;">';
      for (const row of rowParts) {
        const trimmed = row.trim();
        if (!trimmed) continue;
        tableHtml += '<tr>';
        const lines = trimmed.split('\n');
        for (const line of lines) {
          const lTrim = line.trim();
          if (!lTrim) continue;
          if (lTrim.startsWith('!')) {
            const cellContent = lTrim.replace(/^!+/, '').trim();
            if (cellContent.includes('colspan')) {
              const [colInfo, ...titleParts] = cellContent.split('|');
              const colspan = colInfo.replace(/\D/g, '') || '2';
              const text = titleParts.join('|').trim();
              tableHtml += `<th colspan="${colspan}" style="background: linear-gradient(135deg, rgba(168,85,247,0.4), rgba(219,39,119,0.3)); color: #ffffff; text-align: center; font-weight: bold; padding: 8px 10px; font-size: 13px;">${text}</th>`;
            } else {
              const cells = cellContent.split('!!');
              for (const c of cells) {
                tableHtml += `<th style="background: rgba(168,85,247,0.2); color: #e9d5ff; font-weight: bold; padding: 6px 10px; text-align: left;">${c.trim()}</th>`;
              }
            }
          } else if (lTrim.startsWith('|')) {
            const rowContent = lTrim.replace(/^\|+/, '').trim();
            const cells = rowContent.split('||');
            for (const c of cells) {
              tableHtml += `<td style="padding: 6px 10px; border-bottom: 1px solid rgba(63,63,70,0.5);">${c.trim()}</td>`;
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

  // Convert newlines to paragraphs
  return html
    .split('\n\n')
    .map((p) => `<p style="margin-bottom: 8px; line-height: 1.6;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
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

/**
 * Attempts to extract a Chub/Tavern V2 JSON card embedded inside a PNG tEXt ('chara') chunk
 */
export function extractChubPngCard(buffer: ArrayBuffer): NormalizedCharacter | null {
  try {
    const bytes = new Uint8Array(buffer);
    // Check PNG signature: 89 50 4E 47
    if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
      return null;
    }

    let offset = 8;
    const decoder = new TextDecoder('latin1');
    while (offset + 8 <= bytes.length) {
      const length =
        ((bytes[offset] << 24) |
          (bytes[offset + 1] << 16) |
          (bytes[offset + 2] << 8) |
          bytes[offset + 3]) >>>
        0;
      const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > bytes.length) break;

      if (type === 'tEXt') {
        const chunkBytes = bytes.subarray(dataStart, dataEnd);
        const nullIdx = chunkBytes.indexOf(0);
        if (nullIdx !== -1) {
          const keyword = decoder.decode(chunkBytes.subarray(0, nullIdx));
          if (keyword.toLowerCase() === 'chara') {
            const b64 = decoder.decode(chunkBytes.subarray(nullIdx + 1));
            const binary = atob(b64.trim());
            const utf8Bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              utf8Bytes[i] = binary.charCodeAt(i);
            }
            const jsonText = new TextDecoder('utf-8').decode(utf8Bytes);
            return parseTavernCard(jsonText);
          }
        }
      }

      offset = dataEnd + 4; // skip 4-byte CRC
      if (type === 'IEND') break;
    }
  } catch {
    return null;
  }
  return null;
}

