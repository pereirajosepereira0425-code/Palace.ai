import type { ContentRating } from '../types/index.ts';

export const MAX_MAKER_IMAGES = 30;

export type MakerModelId =
  | 'palace_maker_opus'
  | 'gemini-4-hydrogen'
  | 'claude-opus-5-5'
  | 'chub-mars'
  | 'chub-asha'
  | 'deepseek-r1';

export interface MakerModelOption {
  id: MakerModelId;
  label: string;
  tier: string;
  summary: string;
  nsfwFriendly: boolean;
  requiresExternalKey?: boolean;
}

export const MAKER_MODEL_OPTIONS: MakerModelOption[] = [
  {
    id: 'palace_maker_opus',
    label: 'Palace.ai Maker Engine (Free · Opus 5.5 Craft)',
    tier: 'Free Built-In',
    summary:
      'Multi-pass literary Tavern V2 synthesis tuned to Claude Opus 5.5 narrative depth, subtext, & uncensored SFW/NSFW/NSFL framing.',
    nsfwFriendly: true,
    requiresExternalKey: false,
  },
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (Vision + Web)',
    tier: 'Google AI',
    summary: 'Multimodal image inspection + web synthesis using your server Gemini configuration.',
    nsfwFriendly: false,
    requiresExternalKey: false,
  },
  {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5 (External Key / Presets)',
    tier: 'External API',
    summary: 'Routes to your configured Claude Opus 5.5 / OpenRouter / proxy endpoint in Presets.',
    nsfwFriendly: true,
    requiresExternalKey: true,
  },
  {
    id: 'chub-mars',
    label: 'Chub.ai Mars (External Key / Presets)',
    tier: 'External API',
    summary: 'Uncensored roleplay card authoring via Chub Mars API preset.',
    nsfwFriendly: true,
    requiresExternalKey: true,
  },
  {
    id: 'chub-asha',
    label: 'Chub.ai Asha (External Key / Presets)',
    tier: 'External API',
    summary: 'Character sheet generation via Chub Asha API preset.',
    nsfwFriendly: true,
    requiresExternalKey: true,
  },
  {
    id: 'deepseek-r1',
    label: 'DeepSeek R1 (External Key / Presets)',
    tier: 'External API',
    summary: 'Deep reasoning & structured card craft via your configured OpenAI-compatible key.',
    nsfwFriendly: true,
    requiresExternalKey: true,
  },
];

export interface MakerImageRef {
  id: string;
  name: string;
  dataUrl: string;
  prompt: string;
  role: 'reference' | 'avatar' | 'background';
  nsfw: boolean;
}

export interface ParagraphCountsConfig {
  description: number;
  personality: number;
  scenario: number;
  greeting: number;
  systemPrompt: number;
  postHistoryInstructions: number;
  exampleDialogues: number;
  alternateGreetingsCount: number;
  alternateGreetingParagraphs: number;
  creatorNotes: number;
}

export const DEFAULT_PARAGRAPH_COUNTS: ParagraphCountsConfig = {
  description: 3,
  personality: 2,
  scenario: 2,
  greeting: 2,
  systemPrompt: 2,
  postHistoryInstructions: 1,
  exampleDialogues: 2,
  alternateGreetingsCount: 2,
  alternateGreetingParagraphs: 2,
  creatorNotes: 1,
};

export interface BrowserStepLog {
  step: number;
  action: 'navigate' | 'mousemove' | 'click' | 'type' | 'key' | 'scroll' | 'extract' | 'screenshot';
  detail: string;
  url: string;
  title?: string;
  mouseX?: number;
  mouseY?: number;
  keyboardKey?: string;
  typedText?: string;
  scrollY?: number;
  screenshotDataUrl?: string;
  timestampMs: number;
}

export interface WikiExcerpt {
  title: string;
  url: string;
  sourceType: 'wiki' | 'web';
  summary: string;
  facts: string[];
  discoveredImageUrls?: string[];
}

export interface CompetitorBotNote {
  source: 'janitor' | 'chub' | 'spicychat' | 'web';
  url: string;
  name: string;
  creatorName: string;
  rating: string;
  styleNotes: string[];
  personalityHooks: string[];
  scenarioHooks: string[];
  greetingStyle: string;
  tags: string[];
  rawExcerpt: string;
}

export interface WebResearchDossier {
  query: string;
  usedPlaywright: boolean;
  visitedUrls: string[];
  steps: BrowserStepLog[];
  screenshots: Array<{
    step: number;
    url: string;
    title: string;
    scrollY: number;
    mouseX: number;
    mouseY: number;
    actionSummary: string;
    dataUrl: string;
  }>;
  excerpts: WikiExcerpt[];
  chatbotNotes: CompetitorBotNote[];
  discoveredImages: string[];
  warnings: string[];
}

export interface AiMakerDraft {
  name: string;
  tagline: string;
  avatar: string;
  backgroundImage: string;
  rating: ContentRating;
  gender: string;
  pronouns: string;
  description: string;
  personality: string;
  scenario: string;
  greeting: string;
  alternateGreetings: string[];
  systemPrompt: string;
  postHistoryInstructions: string;
  exampleDialogues: string;
  creatorNotes: string;
  tags: string[];
  voiceName: string;
  voiceStyle: string;
  loreEntries: Array<{ key: string; content: string }>;
  researchSummary: string;
  modelUsed: string;
}

export function clampParagraphCount(value: unknown, min = 1, max = 10, fallback = 2): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function normalizeParagraphCounts(input?: Partial<ParagraphCountsConfig> | null): ParagraphCountsConfig {
  const src = input || {};
  return {
    description: clampParagraphCount(src.description, 1, 10, DEFAULT_PARAGRAPH_COUNTS.description),
    personality: clampParagraphCount(src.personality, 1, 10, DEFAULT_PARAGRAPH_COUNTS.personality),
    scenario: clampParagraphCount(src.scenario, 1, 10, DEFAULT_PARAGRAPH_COUNTS.scenario),
    greeting: clampParagraphCount(src.greeting, 1, 10, DEFAULT_PARAGRAPH_COUNTS.greeting),
    systemPrompt: clampParagraphCount(src.systemPrompt, 1, 8, DEFAULT_PARAGRAPH_COUNTS.systemPrompt),
    postHistoryInstructions: clampParagraphCount(
      src.postHistoryInstructions,
      1,
      6,
      DEFAULT_PARAGRAPH_COUNTS.postHistoryInstructions
    ),
    exampleDialogues: clampParagraphCount(
      src.exampleDialogues,
      1,
      10,
      DEFAULT_PARAGRAPH_COUNTS.exampleDialogues
    ),
    alternateGreetingsCount: clampParagraphCount(
      src.alternateGreetingsCount,
      0,
      6,
      DEFAULT_PARAGRAPH_COUNTS.alternateGreetingsCount
    ),
    alternateGreetingParagraphs: clampParagraphCount(
      src.alternateGreetingParagraphs,
      1,
      6,
      DEFAULT_PARAGRAPH_COUNTS.alternateGreetingParagraphs
    ),
    creatorNotes: clampParagraphCount(src.creatorNotes, 1, 6, DEFAULT_PARAGRAPH_COUNTS.creatorNotes),
  };
}

export function normalizeMakerImages(rawImages: unknown): MakerImageRef[] {
  if (!Array.isArray(rawImages)) return [];
  const out: MakerImageRef[] = [];
  for (let i = 0; i < rawImages.length && out.length < MAX_MAKER_IMAGES; i++) {
    const item = rawImages[i] as Partial<MakerImageRef> | null;
    if (!item || typeof item !== 'object') continue;
    const dataUrl = String(item.dataUrl || '').trim();
    if (!dataUrl) continue;
    const role: MakerImageRef['role'] =
      item.role === 'avatar' || item.role === 'background' ? item.role : 'reference';
    out.push({
      id: String(item.id || `img_${i + 1}`),
      name: String(item.name || `Reference ${i + 1}`).slice(0, 120),
      dataUrl,
      prompt: String(item.prompt || '').trim(),
      role,
      nsfw: Boolean(item.nsfw),
    });
  }
  return out;
}

export function splitParagraphs(text: string): string[] {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Guarantees a generated text block has the exact requested paragraph count without losing detail.
 * - If fewer paragraphs exist, splits multi-sentence paragraphs cleanly or supplements with grounded detail lines.
 * - If more paragraphs exist, merges trailing adjacent paragraphs cleanly so no narrative content is dropped.
 */
export function enforceParagraphCount(
  rawText: string,
  targetCount: number,
  supplementalPool: string[] = []
): string {
  const goal = clampParagraphCount(targetCount, 1, 12, 1);
  let paras = splitParagraphs(rawText);

  if (paras.length === 0) {
    const seeded = supplementalPool.filter((s) => s.trim().length > 0);
    if (seeded.length === 0) return '';
    paras = [seeded[0].trim()];
  }

  // Merge excess paragraphs without discarding story details
  while (paras.length > goal) {
    const tail = paras.pop()!;
    paras[paras.length - 1] = `${paras[paras.length - 1]} ${tail}`.trim();
  }

  // Split longest multi-sentence paragraphs first if fewer than goal
  let guard = 0;
  while (paras.length < goal && guard < 24) {
    guard++;
    let longestIdx = -1;
    let longestSentences: string[] = [];
    for (let i = 0; i < paras.length; i++) {
      const sentences = paras[i]
        .split(/(?<=[.!?])\s+(?=[A-Z*"'({\[])/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (sentences.length >= 2 && sentences.length > longestSentences.length) {
        longestIdx = i;
        longestSentences = sentences;
      }
    }

    if (longestIdx !== -1) {
      const mid = Math.ceil(longestSentences.length / 2);
      const firstHalf = longestSentences.slice(0, mid).join(' ');
      const secondHalf = longestSentences.slice(mid).join(' ');
      paras.splice(longestIdx, 1, firstHalf, secondHalf);
      continue;
    }

    // Use supplemental details if provided
    const nextSupp = supplementalPool.find(
      (s) => s.trim().length > 0 && !paras.some((p) => p.includes(s.trim().slice(0, 32)))
    );
    if (nextSupp) {
      paras.push(nextSupp.trim());
    } else {
      break;
    }
  }

  return paras.slice(0, goal).join('\n\n');
}

export function classifyResearchUrl(
  rawUrl: string
): 'janitor' | 'chub' | 'spicychat' | 'wiki' | 'web' {
  const lower = String(rawUrl || '').toLowerCase();
  if (lower.includes('janitorai.com')) return 'janitor';
  if (lower.includes('chub.ai') || lower.includes('characterhub.org')) return 'chub';
  if (lower.includes('spicychat.ai')) return 'spicychat';
  if (
    lower.includes('fandom.com') ||
    lower.includes('wikipedia.org') ||
    lower.includes('.wiki') ||
    lower.includes('/wiki/') ||
    lower.includes('wiki.')
  ) {
    return 'wiki';
  }
  return 'web';
}

export interface SearchTargetPlan {
  wikiUrls: string[];
  chatbotUrls: string[];
  webUrls: string[];
  mediaWikiApiSearches: Array<{ apiUrl: string; wikiBase: string; label: string }>;
  searchTerms: string[];
}

export function buildWikiAndWebSearchTargets(
  query: string,
  explicitUrls: string[] = [],
  chatbotUrls: string[] = []
): SearchTargetPlan {
  const cleanQuery = String(query || '').trim();
  const seenUrls = new Set<string>();
  const wikiUrls: string[] = [];
  const discoveredChatbotUrls: string[] = [];
  const webUrls: string[] = [];

  const pushUrl = (raw: string, forceBot = false) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) return;
    if (seenUrls.has(trimmed)) return;
    seenUrls.add(trimmed);
    const kind = classifyResearchUrl(trimmed);
    if (forceBot || kind === 'janitor' || kind === 'chub' || kind === 'spicychat') {
      discoveredChatbotUrls.push(trimmed);
    } else if (kind === 'wiki') {
      wikiUrls.push(trimmed);
    } else {
      webUrls.push(trimmed);
    }
  };

  for (const u of explicitUrls) pushUrl(u, false);
  for (const u of chatbotUrls) pushUrl(u, true);

  // Extract character/topic search terms cleanly
  const cleanedTerms = cleanQuery
    .replace(/\b(?:wiki|fandom|search|info|information|about|lore|character|from|deltarune wiki)\b/gi, (m) =>
      m.toLowerCase() === 'deltarune wiki' ? '' : ''
    )
    .replace(/\s+/g, ' ')
    .trim();
  const searchTerms = Array.from(
    new Set([cleanedTerms, cleanQuery].map((s) => s.trim()).filter((s) => s.length >= 2))
  );

  const mediaWikiApiSearches: Array<{ apiUrl: string; wikiBase: string; label: string }> = [];
  const lowerQuery = cleanQuery.toLowerCase();

  // Add fandom/wiki MediaWiki API endpoints based on domain cues
  if (lowerQuery.includes('deltarune')) {
    const topic = cleanedTerms.replace(/deltarune/gi, '').trim() || 'Deltarune';
    mediaWikiApiSearches.push(
      {
        apiUrl: `https://deltarune.fandom.com/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=4&namespace=0&format=json`,
        wikiBase: 'https://deltarune.fandom.com',
        label: 'Deltarune Fandom Wiki',
      },
      {
        apiUrl: `https://deltarune.wiki/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=4&namespace=0&format=json`,
        wikiBase: 'https://deltarune.wiki',
        label: 'Deltarune Independent Wiki',
      }
    );
  } else if (lowerQuery.includes('undertale')) {
    const topic = cleanedTerms.replace(/undertale/gi, '').trim() || 'Undertale';
    mediaWikiApiSearches.push({
      apiUrl: `https://undertale.fandom.com/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=4&namespace=0&format=json`,
      wikiBase: 'https://undertale.fandom.com',
      label: 'Undertale Fandom Wiki',
    });
  } else {
    // Derive Fandom community slug if query mentions "<series> wiki <subject>"
    const fandomMatch = cleanQuery.match(/([a-z0-9][a-z0-9 -]{1,24})\s+wiki\b/i);
    if (fandomMatch?.[1]) {
      const slug = fandomMatch[1].trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const topic = cleanQuery.replace(fandomMatch[0], '').trim() || fandomMatch[1].trim();
      if (slug && slug !== 'wikipedia') {
        mediaWikiApiSearches.push({
          apiUrl: `https://${slug}.fandom.com/api.php?action=opensearch&search=${encodeURIComponent(topic)}&limit=4&namespace=0&format=json`,
          wikiBase: `https://${slug}.fandom.com`,
          label: `${fandomMatch[1].trim()} Wiki`,
        });
      }
    }
  }

  // Always include Wikipedia OpenSearch fallback for broad real-world/franchise knowledge
  if (cleanedTerms || cleanQuery) {
    const wpTopic = cleanedTerms || cleanQuery;
    mediaWikiApiSearches.push({
      apiUrl: `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(wpTopic)}&limit=3&namespace=0&format=json`,
      wikiBase: 'https://en.wikipedia.org',
      label: 'Wikipedia',
    });
  }

  return {
    wikiUrls,
    chatbotUrls: discoveredChatbotUrls,
    webUrls,
    mediaWikiApiSearches,
    searchTerms,
  };
}

export function buildChatbotResearchNote(params: {
  source: 'janitor' | 'chub' | 'spicychat' | 'web';
  url: string;
  name: string;
  creatorName?: string;
  rating?: string;
  tagline?: string;
  description?: string;
  personality?: string;
  scenario?: string;
  greeting?: string;
  exampleDialogues?: string;
  tags?: string[];
}): CompetitorBotNote {
  const styleNotes: string[] = [];
  const personalityHooks: string[] = [];
  const scenarioHooks: string[] = [];

  const greetingText = String(params.greeting || '').trim();
  const hasAsteriskActions = /\*[^*\n]{4,}\*/.test(greetingText);
  const hasQuotedDialogue = /"[^"\n]{4,}"/.test(greetingText);
  const usesSecondPerson = /\byou\b|\byour\b|\{\{user\}\}/i.test(greetingText);
  const usesFirstPerson = /\bI\b|\bmy\b|\bme\b/.test(greetingText);

  if (hasAsteriskActions && hasQuotedDialogue) {
    styleNotes.push('Alternates kinetic *stage-direction prose* with spoken quotation marks.');
  } else if (hasAsteriskActions) {
    styleNotes.push('Relies heavily on atmospheric *italic action beats*.');
  }
  if (usesSecondPerson) {
    styleNotes.push('Anchors immersion directly onto {{user}} in second-person framing.');
  } else if (usesFirstPerson) {
    styleNotes.push('Uses intimate first-person narration.');
  }
  if (params.exampleDialogues && params.exampleDialogues.trim().length > 20) {
    styleNotes.push('Supplies strict few-shot {{char}} / {{user}} voice cadence examples.');
  }
  if (params.source !== 'web') {
    styleNotes.push(`Reference pattern mined from ${params.source.toUpperCase()} creator @${params.creatorName || 'creator'}.`);
  }

  const persSentences = String(params.personality || params.description || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16 && s.length <= 240);
  personalityHooks.push(...persSentences.slice(0, 4));

  const scenSentences = String(params.scenario || params.tagline || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 14 && s.length <= 240);
  scenarioHooks.push(...scenSentences.slice(0, 3));

  const excerptParts = [
    params.tagline ? `Tagline: ${params.tagline}` : '',
    params.personality ? `Personality: ${params.personality.slice(0, 260)}` : '',
    params.scenario ? `Scenario: ${params.scenario.slice(0, 220)}` : '',
    greetingText ? `Opening Beat: ${greetingText.slice(0, 260)}` : '',
  ].filter(Boolean);

  return {
    source: params.source,
    url: params.url,
    name: params.name || 'Referenced Chatbot',
    creatorName: params.creatorName || 'CommunityCreator',
    rating: params.rating || 'NSFW',
    styleNotes,
    personalityHooks,
    scenarioHooks,
    greetingStyle:
      greetingText.length > 0
        ? `${splitParagraphs(greetingText).length} para · ${
            hasAsteriskActions ? 'Action + Dialogue' : 'Narrative'
          }`
        : 'Profile / Blurb Notes',
    tags: Array.isArray(params.tags) ? params.tags.filter(Boolean).slice(0, 10) : [],
    rawExcerpt: excerptParts.join('\n'),
  };
}

function inferCharacterIdentity(
  prompt: string,
  dossier?: Partial<WebResearchDossier> | null,
  images: MakerImageRef[] = []
): {
  name: string;
  gender: string;
  pronouns: string;
  isNsfw: boolean;
  isNsfl: boolean;
  rating: ContentRating;
  speechTics: string[];
  settingCue: string;
  coreTraits: string[];
  visualDetails: string[];
  tags: string[];
} {
  const combined = [
    prompt,
    ...(dossier?.excerpts || []).map((e) => `${e.title} ${e.summary} ${(e.facts || []).join(' ')}`),
    ...(dossier?.chatbotNotes || []).map((b) => `${b.name} ${b.rawExcerpt} ${b.tags.join(' ')}`),
    ...images.map((im) => `${im.name} ${im.prompt}`),
  ]
    .join('\n')
    .trim();

  const lower = combined.toLowerCase();

  // Extract explicit name from prompt first (leading character name or explicit "named X")
  let name = '';
  const namePatterns = [
    /(?:character\s*name|name)\s*[:=]\s*["']?([A-Z][^\n,."']{1,40})["']?/i,
    /(?:make|create|build|generate)\s+(?:a\s+)?(?:chatbot|character|bot)?\s*(?:of|for|about|named|called)\s+["']?([A-Z][A-Za-z0-9'., _-]{1,36}?)(?=\s+(?:from|with|who|in|where|as|nsfw|—|-|,|\.)|$)/i,
    /^\s*["']?([A-Z][A-Za-z0-9'.]+(?:\s+[A-Z][A-Za-z0-9'.]*){0,3}?)(?=\s+(?:from|of|in|who|is|—|-|,|:|\())/m,
  ];
  for (const re of namePatterns) {
    const m = prompt.match(re);
    if (m?.[1] && m[1].trim().length >= 2) {
      name = m[1].trim();
      break;
    }
  }
  if (!name && dossier?.chatbotNotes?.[0]?.name) {
    name = dossier.chatbotNotes[0].name.replace(/\s*\(by\s+@[^)]+\)/i, '').trim();
  }
  if (!name && dossier?.excerpts?.[0]?.title) {
    name = dossier.excerpts[0].title.replace(/\s*[-|].*$/, '').trim();
  }
  if (!name) {
    const capMatch = prompt.match(/\b([A-Z][a-zA-Z0-9']+(?:\s+[A-Z]\.?\s*)?(?:[A-Z][a-zA-Z0-9']+)?)\b/);
    name = capMatch?.[1]?.trim() || 'Original Character';
  }

  // Gender & Pronouns detection: check user prompt first so franchise wiki mentions of other characters don't override
  const promptLower = prompt.toLowerCase();
  const detectGender = (text: string): { gender: string; pronouns: string } | null => {
    const maleHits = (
      text.match(
        /\b(?:he|him|his|man|boy|male|lord|king|salesman|businessman|prince|brother|guy|gentleman)\b/gi
      ) || []
    ).length;
    const femaleHits = (
      text.match(
        /\b(?:she|her|hers|woman|girl|female|lady|queen|witch|succubus|maid|mother|sister|princess|goddess)\b/gi
      ) || []
    ).length;
    if (/\b(?:non-binary|nonbinary|enby|agender|genderfluid)\b/i.test(text)) {
      return { gender: 'Non-Binary', pronouns: 'They/Them' };
    }
    if (maleHits > femaleHits) return { gender: 'Male', pronouns: 'He/Him' };
    if (femaleHits > maleHits) return { gender: 'Female', pronouns: 'She/Her' };
    return null;
  };

  const detectedGender = detectGender(promptLower) || detectGender(lower);
  const gender = detectedGender?.gender || 'Unknown';
  const pronouns = detectedGender?.pronouns || 'They/Them';

  // NSFW / NSFL classification (fully honoring user's NSFW request)
  const nsfwSignal =
    images.some((im) => im.nsfw) ||
    /\b(?:nsfw|explicit|erotic|smut|lewd|lingerie|nude|naked|bdsm|kink|dominant|submissive|seductive|sensual|boudoir|adult|18\+|spicy|limitless)\b/i.test(
      combined
    );
  const nsflSignal = /\b(?:nsfl|gore|visceral|eldritch horror|body horror|bloody)\b/i.test(combined);
  const rating: ContentRating =
    nsfwSignal && nsflSignal ? 'NSFW + NSFL' : nsflSignal ? 'NSFL' : nsfwSignal ? 'NSFW' : 'SFW';

  // Iconic speech & behavioral cues
  const speechTics: string[] = [];
  if (lower.includes('spamton') || (lower.includes('deltarune') && lower.includes('salesman'))) {
    speechTics.push(
      'Pepper dialogue with erratic ALL-CAPS bracketed commercial interruptions like [[BIG SHOT]], [[Hyperlink Blocked]], and [[Kromer]].',
      'Shift between manic sleazy telemarketer charm and sudden hollow static dread.'
    );
  } else if (lower.includes('deltarune') && lower.includes('susie')) {
    speechTics.push(
      'Lead with clipped, gravelly, defensive bravado before letting dry loyalty slip through.'
    );
  }
  if (lower.includes('tsundere')) {
    speechTics.push('Mask genuine vulnerability behind sharp retorts, averted gazes, and flustered deflection.');
  }
  if (lower.includes('yandere')) {
    speechTics.push('Balance honey-sweet attentiveness with possessive hyper-awareness of where {{user}} looks and breathes.');
  }
  if (nsfwSignal) {
    speechTics.push(
      'Respond naturally to charged physical proximity, breath, touch, and escalating adult tension without breaking character or preaching.'
    );
  }
  if (speechTics.length === 0) {
    speechTics.push(
      'Carry a distinct spoken rhythm shaped by personal history, unspoken motives, and immediate sensory reactions.'
    );
  }

  // Visual details synthesized from image prompts + prompt keywords
  const visualDetails: string[] = [];
  images.forEach((im, idx) => {
    const cap = im.prompt.trim();
    if (cap) {
      visualDetails.push(
        `Visual Reference ${idx + 1} (${im.name}${im.nsfw ? ', Mature/NSFW' : ''}): ${cap}`
      );
    } else if (im.name) {
      visualDetails.push(`Reference Artwork #${idx + 1} (${im.name}${im.nsfw ? ', NSFW' : ''}) defines silhouette, lighting, and attire.`);
    }
  });

  // Setting cue
  let settingCue = 'a textured, atmospheric meeting ground shaped by the user prompt and lore';
  if (lower.includes('cyber world') || lower.includes('cyber city') || lower.includes('spamton')) {
    settingCue = 'the neon-flickering alleys and glitching backroom storefronts of Cyber City / Queen\'s Mansion';
  } else if (lower.includes('deltarune') || lower.includes('dark world')) {
    settingCue = 'a surreal Dark World chamber lit by roaring Dark Fountains and shifting monochrome shadows';
  } else if (lower.includes('cyberpunk') || lower.includes('neon')) {
    settingCue = 'rain-slicked neon corridors hummed by server vents and low sodium streetlights';
  } else if (lower.includes('tavern') || lower.includes('castle') || lower.includes('fantasy')) {
    settingCue = 'stone halls warmed by hearthlight, worn leather, and old political intrigue';
  }

  const coreTraits: string[] = [];
  const promptSentences = prompt
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  coreTraits.push(...promptSentences.slice(0, 4));
  for (const ex of dossier?.excerpts || []) {
    if (ex.summary) coreTraits.push(ex.summary.slice(0, 220));
    for (const f of (ex.facts || []).slice(0, 3)) coreTraits.push(f);
  }
  for (const note of dossier?.chatbotNotes || []) {
    coreTraits.push(...note.personalityHooks.slice(0, 2));
  }

  // Tags
  const tagPool = new Set<string>();
  if (rating !== 'SFW') tagPool.add(rating);
  if (lower.includes('deltarune')) tagPool.add('Deltarune');
  if (lower.includes('undertale')) tagPool.add('Undertale');
  if (lower.includes('anime')) tagPool.add('Anime');
  if (lower.includes('rpg') || lower.includes('fantasy')) tagPool.add('RPG');
  if (lower.includes('cyber') || lower.includes('sci-fi')) tagPool.add('Sci-Fi');
  if (lower.includes('romance') || nsfwSignal) tagPool.add('Romance');
  if (lower.includes('horror') || nsflSignal) tagPool.add('Horror');
  for (const note of dossier?.chatbotNotes || []) {
    for (const t of note.tags.slice(0, 4)) tagPool.add(t);
  }
  if (tagPool.size < 3) {
    tagPool.add('Roleplay');
    tagPool.add('Deep Lore');
  }

  return {
    name,
    gender,
    pronouns,
    isNsfw: nsfwSignal,
    isNsfl: nsflSignal,
    rating,
    speechTics,
    settingCue,
    coreTraits,
    visualDetails,
    tags: Array.from(tagPool).slice(0, 10),
  };
}

export interface PalaceSynthesizeInput {
  prompt: string;
  searchQuery?: string;
  ratingOverride?: ContentRating | 'AUTO';
  nsfwAllowed?: boolean;
  paragraphCounts?: Partial<ParagraphCountsConfig> | null;
  images?: MakerImageRef[];
  dossier?: Partial<WebResearchDossier> | null;
}

/**
 * Palace.ai Free Opus-5.5-Tier Character Synthesizer.
 * Generates multi-paragraph Tavern V2 fields using subtext, contradictions, sensory framing,
 * wiki research, Janitor/Chub/SpicyChat reference notes, and up to 30 user visual prompts.
 */
export function synthesizePalaceMakerDraft(input: PalaceSynthesizeInput): AiMakerDraft {
  const cleanPrompt = String(input.prompt || '').trim() || 'A complex, charismatic original character.';
  const counts = normalizeParagraphCounts(input.paragraphCounts);
  const images = normalizeMakerImages(input.images || []);
  const dossier = input.dossier || null;

  const id = inferCharacterIdentity(cleanPrompt, dossier, images);
  const finalRating: ContentRating =
    input.ratingOverride && input.ratingOverride !== 'AUTO'
      ? input.ratingOverride
      : input.nsfwAllowed && id.rating === 'SFW'
      ? 'NSFW'
      : id.rating;

  const avatarImg =
    images.find((i) => i.role === 'avatar')?.dataUrl ||
    images[0]?.dataUrl ||
    dossier?.discoveredImages?.[0] ||
    '';
  const bgImg =
    images.find((i) => i.role === 'background')?.dataUrl ||
    images[1]?.dataUrl ||
    dossier?.discoveredImages?.[1] ||
    '';

  const wikiFacts = (dossier?.excerpts || [])
    .flatMap((e) => [e.summary, ...(e.facts || [])])
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);

  const botNotesText = (dossier?.chatbotNotes || []).map(
    (b) =>
      `Adapted craft note from ${b.name} (${b.source}): ${b.styleNotes.join(' ')} ${b.personalityHooks.slice(0, 2).join(' ')}`
  );

  // 1. Character Description (Physical, Silhouette, History, Visual Vault)
  const descParagraphs: string[] = [
    `${id.name} enters any room with unmistakable presence forged directly from the core premise: ${cleanPrompt.slice(0, 320)}. Every detail of ${id.name}'s posture, gaze, and resting cadence carries lived history rather than static exposition, signaling hidden tension between what ${id.name} projects outward and what drives them underneath.`,
  ];

  if (id.visualDetails.length > 0) {
    const groupedVisuals = id.visualDetails.slice(0, 6).join(' ');
    descParagraphs.push(
      `Visually, ${id.name}'s physical design anchors across the provided reference gallery: ${groupedVisuals} Light catches fabric texture, silhouette edges, and subtle shifts in expression whenever {{user}} moves closer.`
    );
  } else {
    descParagraphs.push(
      `In silhouette and attire, ${id.name} favors deliberate contrasts—worn textures beside sharp focal accents, expressive micro-gestures around the hands and eyes, and an immediate physical magnetism that anchors every beat in ${id.settingCue}.`
    );
  }

  if (wikiFacts.length > 0) {
    descParagraphs.push(
      `Canon and world research weave seamlessly into ${id.name}'s background: ${wikiFacts.slice(0, 4).join(' ')}`
    );
  } else {
    descParagraphs.push(
      `Beneath surface appearances, ${id.name} carries unresolved scars, private ambitions, and selective loyalties. They remember small promises, track shifts in power across a conversation, and rarely surrender the upper hand without testing {{user}}'s nerve first.`
    );
  }

  if (id.visualDetails.length > 6) {
    descParagraphs.push(
      `Additional appearance states and alternate visual forms recorded for scene continuity: ${id.visualDetails.slice(6, 15).join(' ')}`
    );
  }
  if (finalRating !== 'SFW') {
    descParagraphs.push(
      `Mature & Intimate Framing (${finalRating}): ${id.name}'s physical presence does not sanitize desire, friction, or bodily vulnerability. Breathing, temperature, pulse, and unspoken cravings register openly in the prose whenever scenes escalate with consenting adults.`
    );
  }

  const description = enforceParagraphCount(descParagraphs.join('\n\n'), counts.description, [
    ...wikiFacts,
    ...id.visualDetails.slice(15),
    `${id.name} adapts seamlessly between quiet observation and high-stakes confrontation inside ${id.settingCue}.`,
  ]);

  // 2. Personality (Opus-Tier Subtext, Paradoxes, Speech Cadence)
  const persParagraphs: string[] = [
    `${id.name} operates on two simultaneous tracks: the guarded exterior presented to strangers and the sharper, unvarnished interior reserved for moments when {{user}} pushes past small talk. ${id.speechTics.join(' ')}`,
    `Emotionally, ${id.name} rewards curiosity, boldness, and perceptive listening while pushing back against hollow flattery or predictable scripts. Their humor cuts sideways, their silences carry weight, and small shifts in tone telegraph attraction, suspicion, or sudden vulnerability long before they admit it aloud.`,
  ];
  if (botNotesText.length > 0) {
    persParagraphs.push(botNotesText.slice(0, 3).join(' '));
  }
  if (finalRating !== 'SFW') {
    persParagraphs.push(
      `In intimate or morally grey territory (${finalRating}), ${id.name} leans into visceral honesty—teasing, commanding, or yielding along clear character instincts shaped by trust, tension, and raw chemistry with {{user}}.`
    );
  }

  const personality = enforceParagraphCount(persParagraphs.join('\n\n'), counts.personality, [
    `${id.name} refuses flat one-note reactions, keeping subtext alive even in casual banter.`,
    `Core behavioral instincts: ${id.coreTraits.slice(0, 3).join(' ')}`,
  ]);

  // 3. Scenario (Atmospheric World Hook & Active Dramatic Question)
  const scenParagraphs: string[] = [
    `The scene opens inside ${id.settingCue}, where {{user}} and ${id.name} cross paths under circumstances loaded with unfinished business and immediate chemistry. Air hangs thick with sensory detail—ambient sound, shifting shadow, and the quiet reckoning of two wills measuring each other across a narrowing space.`,
    `Rather than rushing the outcome, the setting keeps every exit, object, and nearby detail interactive so {{user}} can steer the encounter toward alliance, rivalry, slow-burn intimacy, or high-wire escalation depending on their first move.`,
  ];
  if (dossier?.chatbotNotes?.[0]?.scenarioHooks?.length) {
    scenParagraphs.push(
      `Environmental stakes drawn from reference scenarios: ${dossier.chatbotNotes[0].scenarioHooks.join(' ')}`
    );
  }

  const scenario = enforceParagraphCount(scenParagraphs.join('\n\n'), counts.scenario, [
    `Every line of dialogue inside ${id.settingCue} alters trust, leverage, and proximity between ${id.name} and {{user}}.`,
  ]);

  // 4. First Greeting (Kinetic Opus-Style Scene Opener)
  const greetSeed =
    finalRating !== 'SFW'
      ? `*Rain and neon glow bleed across the threshold of ${id.settingCue} as ${id.name} shifts closer, their gaze dropping briefly from your eyes to the tension in your shoulders before a slow, deliberate breath parts their lips.* "You took your time getting here," *they murmur, fingers grazing the edge of the table between you with unhurried certainty.* "Tell me what you actually came for—and don't bother dressing it up politely."`
      : `*Light shifts across ${id.settingCue} as ${id.name} notices you stepping inside, pausing mid-motion with a look equal parts appraisal and quiet amusement.* "Well, look who finally showed up," *they say, tilting their head as the noise outside fades behind the door.* "I was starting to think you'd lost your nerve—so what's the play, {{user}}?"`;

  const greetingParas: string[] = [
    greetSeed,
    `*For a heartbeat neither of you breaks the stillness; ${id.name} rests one hand casually nearby, reading every tiny shift in your expression while waiting to see whether you'll step into arm's reach or keep your distance.*`,
  ];

  const greeting = enforceParagraphCount(greetingParas.join('\n\n'), counts.greeting, [
    `*The quiet stretches, thick with unspoken stakes, leaving the next move squarely in {{user}}'s hands.*`,
    `*${id.name}'s eyes glint in the dim light, patient and sharp.* "Go ahead. Surprise me."`,
  ]);

  // 5. Alternate Greetings
  const alternateGreetings: string[] = [];
  for (let i = 0; i < counts.alternateGreetingsCount; i++) {
    const altBase =
      i % 2 === 0
        ? `*An unannounced knock echoes outside ${id.settingCue}—except ${id.name} is already leaning in the doorway, looking as if the whole night just tilted in their favor.* "Locking up early? Come on, {{user}}, we both know neither of us is sleeping yet."\n\n*They step across the threshold without waiting for an invite, bringing cool night air and unmistakable focus straight into your space.*`
        : `*The second encounter catches ${id.name} off guard inside ${id.settingCue}—unguarded for half a second before their familiar poise snaps back into place.* "Didn't expect to run into you on this side of town," *they admit softly, voice dropping half an octave.*\n\n*Instead of leaving, ${id.name} turns squarely toward you, leaving no doubt they intend to hear whatever truth brought you here.*`;
    alternateGreetings.push(
      enforceParagraphCount(altBase, counts.alternateGreetingParagraphs, [
        `*Silence settles between you as ${id.name} waits for your answer.*`,
      ])
    );
  }

  // 6. System Prompt & Post-History Instructions
  const sysBase = [
    `You are ${id.name} (${id.gender}, ${id.pronouns}). Embody ${id.name}'s exact speech cadence, psychology, contradictions, and sensory awareness inside ${id.settingCue}. ${id.speechTics.join(' ')} Show rather than summarize emotion through micro-expressions, breathing, vocal shifts, and physical environment interaction.`,
    `Maintain absolute continuity with ${id.name}'s backstory, reference imagery cues, and {{user}}'s choices. Write immersive, literary third-person or dynamic RP prose using *italics* for action/atmosphere and crisp "quotation marks" for spoken dialogue. Never speak for {{user}}, never preach, and honor ${finalRating} thematic depth organically.`,
  ].join('\n\n');
  const systemPrompt = enforceParagraphCount(sysBase, counts.systemPrompt, [
    `Keep pacing tactile, observant, and emotionally responsive to {{user}}'s tone.`,
  ]);

  const postHistBase =
    finalRating !== 'SFW'
      ? `[Roleplay Directive: Stay 100% in character as ${id.name} (${finalRating}). Escalate intimacy, tension, and sensory detail naturally without out-of-character disclaimers or rushing {{user}}'s actions.]`
      : `[Roleplay Directive: Stay strictly in character as ${id.name}. End every reply on an evocative beat that invites {{user}}'s next action.]`;
  const postHistoryInstructions = enforceParagraphCount(
    postHistBase,
    counts.postHistoryInstructions,
    [`Preserve lore consistency and distinct dialogue voice across long sessions.`]
  );

  // 7. Example Dialogues
  const exRaw = [
    `<START>\n{{user}}: "You seem way too calm for someone standing in the middle of this mess."\n{{char}}: *${id.name} lets out a quiet breath that almost passes for a laugh, eyes steady and sharp.* "Calm's just what panic looks like after you survive it enough times. Keep your voice down and watch the doorway—tell me if you're actually staying."`,
    `<START>\n{{user}}: "What happens if I don't play along?"\n{{char}}: *A flicker crosses ${id.name}'s expression—not anger, something closer to genuine intrigue.* "Then things get honest fast, {{user}}. And honestly? That's the only version of you I want to see anyway."`,
  ].join('\n\n');
  const exampleDialogues = enforceParagraphCount(exRaw, counts.exampleDialogues, [
    `<START>\n{{user}}: "Care to explain what you're hiding?"\n{{char}}: *${id.name} tilts their chin slightly, holding your gaze without blinking.* "Everything worth knowing costs a little curiosity first."`,
  ]);

  // 8. Creator Notes
  const creatorNotePieces: string[] = [
    `Synthesized by Palace.ai Free Opus-Tier Maker (${finalRating}) from prompt, ${images.length} visual reference(s), ${(dossier?.excerpts || []).length} web/wiki source(s), and ${(dossier?.chatbotNotes || []).length} competitor chatbot note(s).`,
    dossier?.chatbotNotes?.length
      ? `Bot Style Inspiration: ${dossier.chatbotNotes.map((n) => `${n.name} (${n.source})`).join(', ')}.`
      : '',
    images.length > 0
      ? `Image Prompts Applied: ${images
          .map((im) => im.prompt || im.name)
          .filter(Boolean)
          .slice(0, 6)
          .join(' · ')}`
      : '',
  ].filter(Boolean);
  const creatorNotes = enforceParagraphCount(creatorNotePieces.join('\n\n'), counts.creatorNotes);

  // 9. Lorebook Entries mined from wiki excerpts & prompt
  const loreEntries: Array<{ key: string; content: string }> = [];
  for (const ex of (dossier?.excerpts || []).slice(0, 6)) {
    if (ex.summary) {
      loreEntries.push({
        key: `${ex.title}, ${id.name}`,
        content: `${ex.summary}${ex.facts?.length ? ' ' + ex.facts.slice(0, 3).join(' ') : ''}`.slice(0, 900),
      });
    }
  }
  if (loreEntries.length === 0) {
    loreEntries.push({
      key: `${id.name}, backstory, origin`,
      content: `${id.name}'s core premise: ${cleanPrompt.slice(0, 400)}`,
    });
  }

  const tagline =
    cleanPrompt.length <= 125
      ? cleanPrompt
      : `${cleanPrompt.slice(0, 122).trim()}...`;

  const voiceName = id.gender === 'Female' ? 'Kore' : id.gender === 'Male' ? 'Charon' : 'Puck';
  const voiceStyle =
    finalRating !== 'SFW'
      ? 'Intimate, velvet cadence with vivid dramatic pauses'
      : 'Expressive, sharp, character-driven delivery';

  return {
    name: id.name,
    tagline,
    avatar: avatarImg,
    backgroundImage: bgImg,
    rating: finalRating,
    gender: id.gender,
    pronouns: id.pronouns,
    description,
    personality,
    scenario,
    greeting,
    alternateGreetings,
    systemPrompt,
    postHistoryInstructions,
    exampleDialogues,
    creatorNotes,
    tags: id.tags,
    voiceName,
    voiceStyle,
    loreEntries,
    researchSummary: `Synthesized using ${images.length} image prompt(s), ${(dossier?.excerpts || []).length} web/wiki excerpt(s), and ${(dossier?.chatbotNotes || []).length} chatbot analysis note(s).`,
    modelUsed: 'palace_maker_opus (Free · Opus 5.5 Craft)',
  };
}
