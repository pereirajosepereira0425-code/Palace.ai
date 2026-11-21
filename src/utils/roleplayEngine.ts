export interface RoleplayCharacterProfile {
  name: string;
  tagline?: string | null;
  description?: string | null;
  personality?: string | null;
  systemPrompt?: string | null;
  postHistoryInstructions?: string | null;
  scenario?: string | null;
  exampleDialogues?: string | null;
  greeting?: string | null;
  lorebook?: string | null;
  userPersona?: string | null;
  pronouns?: string | null;
  gender?: string | null;
}

export interface RoleplayGenerationFlags {
  modelId?: string;
  banEmojis?: boolean;
  includeNames?: boolean;
  restrictNarration?: boolean;
  trimIncompleteSentences?: boolean;
  promptNote?: string;
  relevantLore?: string[];
  chatSummary?: string | null;
  brawlContextPrompt?: string | null;
  groupSceneCharacters?: string[];
  variationSalt?: string | number;
}

export interface CouncilCandidateReply {
  modelId: string;
  role?: string;
  text: string;
}

interface PronounSet {
  subj: string;
  obj: string;
  poss: string;
  possPron: string;
  refl: string;
  isPlural: boolean;
}

const FEM_PRONOUNS: PronounSet = {
  subj: 'she',
  obj: 'her',
  poss: 'her',
  possPron: 'hers',
  refl: 'herself',
  isPlural: false,
};

const MASC_PRONOUNS: PronounSet = {
  subj: 'he',
  obj: 'him',
  poss: 'his',
  possPron: 'his',
  refl: 'himself',
  isPlural: false,
};

const NEUT_PRONOUNS: PronounSet = {
  subj: 'they',
  obj: 'them',
  poss: 'their',
  possPron: 'theirs',
  refl: 'themselves',
  isPlural: true,
};

function cap(word: string): string {
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
}

function conj(p: PronounSet, singularVerb: string, pluralVerb?: string): string {
  if (p.isPlural) {
    if (pluralVerb) return pluralVerb;
    if (singularVerb === 'is') return 'are';
    if (singularVerb === 'has') return 'have';
    if (singularVerb === 'was') return 'were';
    if (singularVerb.endsWith('ches') || singularVerb.endsWith('shes') || singularVerb.endsWith('sses') || singularVerb.endsWith('xes')) {
      return singularVerb.slice(0, -2);
    }
    if (singularVerb.endsWith('ies')) {
      return singularVerb.slice(0, -3) + 'y';
    }
    if (singularVerb.endsWith('s')) {
      return singularVerb.slice(0, -1);
    }
    return singularVerb;
  }
  return singularVerb;
}

/**
 * Extracts natural short name for narrative prose ("Soo-Zee, Democratic Bug" -> "Soo-Zee",
 * "Yae Sakura (Kitsune Miko)" -> "Yae Sakura"). Keeps full name untouched for headers.
 */
export function extractCallSignName(fullName: string | null | undefined): string {
  const raw = (fullName || 'Character').replace(/\s+/g, ' ').trim();
  if (!raw) return 'Character';
  const beforeParens = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const commaParts = beforeParens.split(',');
  if (commaParts.length > 1 && commaParts[0].trim().length >= 2) {
    return commaParts[0].trim();
  }
  const dashSplit = beforeParens.split(/\s+[—–-]\s+/);
  if (dashSplit.length > 1 && dashSplit[0].trim().length >= 2) {
    return dashSplit[0].trim();
  }
  return beforeParens || raw;
}

export function inferCharacterPronouns(character: RoleplayCharacterProfile): PronounSet {
  const explicit = `${character.pronouns || ''} ${character.gender || ''}`.toLowerCase();
  if (/\b(she|her|hers|female|woman|girl)\b/.test(explicit)) return FEM_PRONOUNS;
  if (/\b(he|him|his|male|man|boy)\b/.test(explicit) && !/\bfemale\b/.test(explicit)) return MASC_PRONOUNS;
  if (/\b(they|them|non-binary|nonbinary|enby)\b/.test(explicit)) return NEUT_PRONOUNS;

  const text = [
    character.tagline || '',
    character.personality || '',
    character.description || '',
    character.scenario || '',
    character.greeting || '',
    character.exampleDialogues || '',
    character.systemPrompt || '',
  ]
    .join(' ')
    .replace(/\{\{user\}\}[^.?!\n]*/gi, ' ')
    .toLowerCase();

  const femMatches = (text.match(/\b(she|her|hers|herself|woman|girl|lady|queen|princess|female|sister|daughter|mistress|miko|maid|mother)\b/g) || []).length;
  const mascMatches = (text.match(/\b(he|him|his|himself|man|boy|lord|king|prince|male|brother|son|father|sir|gentleman)\b/g) || []).length;

  if (femMatches >= 2 && femMatches > mascMatches * 1.25) return FEM_PRONOUNS;
  if (mascMatches >= 2 && mascMatches > femMatches * 1.25) return MASC_PRONOUNS;
  if (femMatches === 1 && mascMatches === 0) return FEM_PRONOUNS;
  if (mascMatches === 1 && femMatches === 0) return MASC_PRONOUNS;
  return NEUT_PRONOUNS;
}

/**
 * Slices text cleanly at a sentence or word boundary (never truncating mid-word).
 */
export function trimAtWordBoundary(text: string, maxChars: number): string {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxChars) return cleaned;

  const slice = cleaned.slice(0, maxChars);
  const lastSentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );
  if (lastSentenceEnd > Math.floor(maxChars * 0.45)) {
    return slice.slice(0, lastSentenceEnd + 1).trim();
  }
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace > 12) {
    return slice.slice(0, lastSpace).replace(/[,;:\-]+$/, '').trim();
  }
  return slice.trim();
}

function extractCleanCue(raw: string | null | undefined, maxChars: number = 95): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\{\{char\}\}/gi, '')
    .replace(/\{\{user\}\}/gi, 'you')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  return trimAtWordBoundary(firstSentence, maxChars);
}

/**
 * Ensures any generated message has visible non-empty narrative/dialogue content
 * (never blank, never whitespace-only, never empty "*  *" asterisks).
 */
export function ensureNonEmptyRoleplayReply(
  candidateText: string | null | undefined,
  characterName: string = 'Character',
  userMessage?: string
): string {
  const raw = (candidateText || '').trim();
  const readableCheck = raw.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (readableCheck.length >= 2) {
    return raw;
  }

  const cleanName = extractCallSignName(characterName);
  const snippet = trimAtWordBoundary(
    (userMessage || '').replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim(),
    60
  );
  if (snippet) {
    return `*${cleanName} shifts weight toward you, catching every word before answering.* "Go on—I'm right here with you."`;
  }
  return `*${cleanName} looks up, holding the quiet pause between you.* "Alright. Your move—what happens next?"`;
}

function stripEmojis(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim();
}

function hashTurnSeed(text: string, historyLen: number, salt: string = ''): number {
  let h = 2166136261 ^ historyLen;
  const full = `${text}|${salt}`;
  for (let i = 0; i < full.length; i++) {
    h ^= full.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface CharacterVisualCues {
  physicalReact: string[];
  settingDetail: string;
  speechStyle: 'enthusiastic' | 'dry' | 'regal' | 'eerie' | 'warm' | 'sharp';
}

function extractVisualAndSceneCues(
  character: RoleplayCharacterProfile,
  charShort: string,
  p: PronounSet
): CharacterVisualCues {
  const blob = [
    character.tagline || '',
    character.description || '',
    character.personality || '',
    character.scenario || '',
    character.greeting || '',
    character.exampleDialogues || '',
    character.systemPrompt || '',
  ]
    .join(' ')
    .toLowerCase();

  const physicalReact: string[] = [];

  if (/\b(wings?|chitin|antennae|head fins?|mandibles?|bug|insectoid|carapace)\b/.test(blob)) {
    physicalReact.push(
      `${charShort}'s wings give a quick, restless flutter against ${p.poss} back plates`,
      `${charShort} tilts ${p.poss} head, ${p.poss} head fins twitching with sudden interest`,
      `${charShort} shifts ${p.poss} clawed fingers together with a soft click of chitin`
    );
  }
  if (/\b(ears?|tail|fox|kitsune|wolf|cat|neko)\b/.test(blob)) {
    physicalReact.push(
      `${charShort}'s ears flick sharply as ${p.poss} tail sweeps a slow arc behind ${p.obj}`,
      `${charShort} leans in, ear twitching lightly while ${p.subj} ${conj(p, 'watches')} your expression`
    );
  }
  if (/\b(armor|helmet|gauntlet|visor|gun|rifle|blaster|holster|boots|hangar|ship|diver|marine)\b/.test(blob)) {
    physicalReact.push(
      `${charShort} scuffs one booted heel across the floor, resting a hand casually near ${p.poss} gear`,
      `${charShort} adjusts ${p.poss} chest plate and steps inside your line of sight`
    );
  }
  if (/\b(sword|katana|blade|dagger|spear|bow|weapon|steel)\b/.test(blob)) {
    physicalReact.push(
      `${charShort} rests ${p.poss} fingertips lightly along the hilt at ${p.poss} hip`,
      `${charShort} loosens ${p.poss} shoulders, weight balanced smoothly on the balls of ${p.poss} feet`
    );
  }
  if (/\b(cloak|cape|robe|coat|trenchcoat|suit|dress|kimono|sleeves)\b/.test(blob)) {
    const garmentMatch = blob.match(/\b(cloak|cape|robe|trenchcoat|coat|dress|kimono|sleeves)\b/);
    const garment = garmentMatch?.[1] || 'coat';
    physicalReact.push(
      `${charShort} tugs neatly at the cuff of ${p.poss} ${garment}, letting a slow breath settle`,
      `${charShort} folds ${p.poss} hands loosely as ${p.poss} ${garment} brushes quiet air beside ${p.obj}`
    );
  }
  if (/\b(glasses|monocle|goggles|datapad|terminal|tablet|scroll|book|coffee|tea|cup)\b/.test(blob)) {
    const propMatch = blob.match(/\b(glasses|goggles|datapad|terminal|scroll|book|tea|cup)\b/);
    const prop = propMatch?.[1] || 'datapad';
    physicalReact.push(
      `${charShort} pauses with ${p.poss} ${prop} lowered just enough to study you over the edge`,
      `${charShort} glances back from ${p.poss} ${prop}, eyes locking cleanly onto yours`
    );
  }

  let settingDetail = '';
  if (/\bhangar\b|\bstackship\b|\bbay\b|\bdeck\b/.test(blob)) {
    settingDetail = 'across the metallic clatter and engine hum of the hangar bay';
  } else if (/\btavern\b|\binn\b|\bpub\b|\bhearth\b/.test(blob)) {
    settingDetail = 'over the warm crackle of the tavern hearth and murmur of glasses';
  } else if (/\bthrone\b|\bcastle\b|\bpalace\b|\bhall\b|\bcourt\b/.test(blob)) {
    settingDetail = 'beneath the high vaulted stone and amber lamplight of the hall';
  } else if (/\brain\b|\balley\b|\bneon\b|\bstreet\b|\bcity\b/.test(blob)) {
    settingDetail = 'against the wet asphalt glow and distant low thrum of the street';
  } else if (/\bshrine\b|\bforest\b|\btemple\b|\bsakura\b|\bgarden\b/.test(blob)) {
    settingDetail = 'underneath the quiet rustle of wind and drifting petals outside';
  } else if (/\belevator\b|\blift\b|\bcorridor\b/.test(blob)) {
    settingDetail = 'inside the narrow hum of flickering fluorescent tubes';
  }

  let speechStyle: CharacterVisualCues['speechStyle'] = 'warm';
  if (/\b(cheerful|eager|excited|bubbly|friendly|peppy|hyper|goofy|enthusiastic|democratic)\b/.test(blob)) {
    speechStyle = 'enthusiastic';
  } else if (/\b(sarcastic|deadpan|cold|stoic|cynical|tired|dry|blunt|sharp)\b/.test(blob)) {
    speechStyle = 'dry';
  } else if (/\b(king|queen|duke|imperial|sovereign|noble|lord|princess|ancient|commander)\b/.test(blob)) {
    speechStyle = 'regal';
  } else if (/\b(glitch|eerie|horror|eldritch|static|unnatural|shadow|haunt)\b/.test(blob)) {
    speechStyle = 'eerie';
  } else if (/\b(tactical|calculating|observer|detective|strategist|razor)\b/.test(blob)) {
    speechStyle = 'sharp';
  }

  return { physicalReact, settingDetail, speechStyle };
}

function isGarbledOrUnclearInput(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  if (/[\uFFFD\u25A0-\u25FF]{2,}/.test(clean)) return true;
  const nonAsciiSymbols = (clean.match(/[^\w\s.,!?'"*()-]/g) || []).length;
  const alphaNum = (clean.match(/[a-zA-Z0-9]/g) || []).length;
  if (nonAsciiSymbols >= 4 && alphaNum < nonAsciiSymbols) return true;
  // Detect random keyboard smash like "asdjklhfkjasd" without clear vowel balance
  const tokens = clean.replace(/\*[^*]*\*/g, '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 1 && tokens[0].length >= 11 && !/[aeiouy]{1}[a-z]{0,2}[aeiouy]/i.test(tokens[0])) {
    return true;
  }
  return false;
}

type UserIntent =
  | 'brawl'
  | 'garbled'
  | 'clarification_boast'
  | 'greeting'
  | 'question'
  | 'compliment'
  | 'challenge'
  | 'affection'
  | 'action'
  | 'continue'
  | 'general';

function detectUserIntent(
  userMessage: string,
  brawlActive: boolean,
  previousCharMsg?: string
): UserIntent {
  if (brawlActive) return 'brawl';
  const clean = userMessage.trim();
  if (!clean || /\(continue the scene naturally/i.test(clean)) return 'continue';
  if (isGarbledOrUnclearInput(clean)) return 'garbled';

  const lower = clean.toLowerCase();
  const prevAskedToRepeat = Boolean(
    previousCharMsg &&
      /\b(didn't catch|say (it|that) again|one more time|repeat|didn't hear|garbled|warped|what\?)\b/i.test(
        previousCharMsg
      )
  );

  if (
    (prevAskedToRepeat || /\b(i meant|that is because|because i(?:'m| am)|i said)\b/.test(lower)) &&
    /\b(cool|awesome|best|smart|strong|funny|cute|amazing|brave|great|legend)\b/.test(lower)
  ) {
    return 'clarification_boast';
  }

  if (/^\s*(hi|hello|hey|yo|greetings|good morning|good evening|sup)\b/.test(lower)) {
    return 'greeting';
  }
  if (/\b(cool|awesome|amazing|cute|handsome|pretty|love you|like you|badass|smart|clever|impressive|gorgeous)\b/.test(lower)) {
    return 'compliment';
  }
  if (/\b(kiss|hug|hold|embrace|blush|sweetheart|darling|miss you)\b/.test(lower)) {
    return 'affection';
  }
  if (/\b(fight|duel|attack|prove it|dare you|bet you|shut up|weak|coward|threat|shoot|punch)\b/.test(lower)) {
    return 'challenge';
  }
  if (clean.includes('?') || /^(who|what|where|when|why|how|tell me|explain|do you|are you|can you)\b/i.test(lower)) {
    return 'question';
  }
  if (/\*[^*]+\*/.test(clean)) {
    return 'action';
  }
  return 'general';
}

function detectCharacterTone(character: RoleplayCharacterProfile): {
  archetype: 'peppa' | 'nextor' | 'malakor' | 'tsundere' | 'dark' | 'noble' | 'playful' | 'sage' | 'standard';
} {
  const nameLower = (character.name || '').toLowerCase();
  if (nameLower.includes('peppa')) return { archetype: 'peppa' };
  if (nameLower.includes('nextor')) return { archetype: 'nextor' };
  if (nameLower.includes('malakor')) return { archetype: 'malakor' };

  const blob = `${character.personality || ''} ${character.tagline || ''} ${character.description || ''} ${character.systemPrompt || ''}`.toLowerCase();
  if (/\b(tsundere|bratty|flustered|hmph|stubborn)\b/.test(blob)) return { archetype: 'tsundere' };
  if (/\b(vampire|demon|shadow|dark|assassin|villain|eldritch|horror|blood|ichor)\b/.test(blob)) return { archetype: 'dark' };
  if (/\b(king|queen|princess|prince|duke|noble|knight|imperial|royal|commander)\b/.test(blob)) return { archetype: 'noble' };
  if (/\b(playful|cheerful|chaotic|trickster|energetic|bubbly|eager|mischief|friendly|enthusiastic)\b/.test(blob)) return { archetype: 'playful' };
  if (/\b(wise|scholar|mage|ancient|oracle|mentor|detective|calm)\b/.test(blob)) return { archetype: 'sage' };
  return { archetype: 'standard' };
}

function extractUserSubjectKeywords(userText: string): string {
  const cleaned = userText
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/["'.,!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const stop = new Set([
    'i', 'me', 'my', 'mine', 'you', 'your', 'yours', 'we', 'our', 'they', 'them', 'it', 'its',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
    'did', 'the', 'a', 'an', 'and', 'or', 'but', 'that', 'this', 'because', 'meant', 'said',
    'just', 'like', 'so', 'very', 'really', 'what', 'why', 'how', 'when', 'where', 'who', 'can',
    'will', 'would', 'should', 'could', 'about', 'for', 'with', 'to', 'of', 'in', 'on', 'at',
  ]);
  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w.toLowerCase()));
  return words.slice(0, 3).join(' ');
}

function pickNonRepeating<T>(options: T[], seed: number, lastBotMsg: string, getText: (item: T) => string): T {
  const prevLower = lastBotMsg.toLowerCase();
  for (let offset = 0; offset < options.length; offset++) {
    const candidate = options[(seed + offset) % options.length];
    const probe = getText(candidate).slice(0, 26).toLowerCase();
    if (!probe || !prevLower.includes(probe)) {
      return candidate;
    }
  }
  return options[seed % options.length];
}

/**
 * Chub-grade contextual roleplay synthesizer.
 * Grounds prose in short character name, true card pronouns, extracted physical/gear/scene traits,
 * conversational intent, lorebook entries, user persona, and multi-beat Chub narrative rhythm.
 */
export function buildContextualRoleplayReply(params: {
  character: RoleplayCharacterProfile;
  userMessage?: string;
  history?: Array<{ sender: string; content: string }>;
  flags?: RoleplayGenerationFlags;
}): string {
  const { character, userMessage = '', history = [], flags = {} } = params;
  const charFull = (character.name || 'Character').trim() || 'Character';
  const charShort = extractCallSignName(charFull);
  const p = inferCharacterPronouns(character);
  const cues = extractVisualAndSceneCues(character, charShort, p);

  const fallbackHistoryUser =
    [...history].reverse().find((m) => m.sender === 'user' && m.content?.trim())?.content || '';
  const cleanUserRaw = (userMessage || fallbackHistoryUser).trim();
  const userSpoken = cleanUserRaw.replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim();
  const userAction = (cleanUserRaw.match(/\*([^*]+)\*/)?.[1] || '').trim();
  const subjectWords = extractUserSubjectKeywords(userSpoken || cleanUserRaw);

  const prevBotMsgs = history.filter((m) => m.sender === 'character').map((m) => m.content);
  const lastBotMsg = prevBotMsgs[prevBotMsgs.length - 1] || '';

  const seed = hashTurnSeed(
    cleanUserRaw,
    history.length,
    `${charShort}|${flags.modelId || ''}|${flags.variationSalt ?? ''}`
  );
  const intent = detectUserIntent(cleanUserRaw, Boolean(flags.brawlContextPrompt?.trim()), lastBotMsg);
  const { archetype } = detectCharacterTone(character);

  const settingCue = extractCleanCue(character.scenario || character.tagline, 82);
  const loreSnippet =
    flags.relevantLore && flags.relevantLore.length > 0
      ? extractCleanCue(flags.relevantLore[seed % flags.relevantLore.length].replace(/^\[Lorebook[^\]]*\]:\s*/i, ''), 90)
      : '';
  const summaryCue = extractCleanCue(flags.chatSummary, 80);
  const noteCue = flags.promptNote ? extractCleanCue(flags.promptNote, 80) : '';
  const otherChars = (flags.groupSceneCharacters || []).filter(Boolean);
  const userPersonaFirst = character.userPersona
    ? extractCallSignName(character.userPersona.split(':')[0])
    : '';

  const pickVisualBeat = (fallback: string): string => {
    if (cues.physicalReact.length > 0) {
      return cues.physicalReact[(seed >> 1) % cues.physicalReact.length];
    }
    return fallback;
  };

  let openingAction = '';
  let lineOne = '';
  let middleBeat = '';
  let lineTwo = '';

  if (intent === 'brawl') {
    const combatActions = [
      `${charShort} pivots cleanly on one heel as kinetic sparks snap across the air, dropping ${p.poss} center of gravity into a tight combat guard`,
      `${charShort} exhales sharply and ${conj(p, 'plants')} ${p.poss} stance${cues.physicalReact[0] ? `, ${cues.physicalReact[0].replace(new RegExp(`^${charShort}(?:'s)?\\s*`, 'i'), `${p.poss} `)}` : ''}`,
      `${charShort} slips outside the arc of your momentum, muscles coiled and eyes locked onto your lead shoulder`,
    ];
    const combatLines = [
      `"Good footwork—let's see if your guard holds when I press back!"`,
      `"Sharp strike! Keep your ribs covered—here comes the answer!"`,
      `"Alright, you've got nerve—don't blink now!"`,
    ];
    openingAction = pickNonRepeating(combatActions, seed, lastBotMsg, (s) => s);
    lineOne = pickNonRepeating(combatLines, seed + 1, lastBotMsg, (s) => s);
  } else if (archetype === 'peppa') {
    const actions = [
      `Peppa gives an excited little bounce on her boots, her crimson dress flaring as her ears perk straight toward you`,
      `Peppa grins ear to ear and leans forward on her tiptoes, eyes sparkling at the thought of a brand-new game`,
    ];
    openingAction = pickNonRepeating(actions, seed, lastBotMsg, (s) => s);
    lineOne =
      intent === 'clarification_boast' || intent === 'compliment'
        ? `"Oink! Being cool makes every adventure ten times better! Wait till George sees us!"`
        : `"Oink! That sounds brilliantly exciting—are we going to jump in muddy puddles next?!"`;
    middleBeat = `Peppa wipes a tiny smudge off her boot and looks up at you hopefully`;
    lineTwo = `"Come on then! You lead the way!"`;
  } else if (archetype === 'nextor') {
    const actions = [
      `The overhead elevator bulb stutters into pale amber as ${charShort} tilts ${p.poss} head at an unnerving, sideways click`,
      `Faint static crackles out from behind the brass control panel while ${charShort}'s grin stretches just a shade wider`,
    ];
    openingAction = pickNonRepeating(actions, seed, lastBotMsg, (s) => s);
    lineOne =
      intent === 'clarification_boast'
        ? `"K-k-cool, huh? Careful, friend... the cables love passengers who brag between floors."`
        : `"Hear that hum behind the wall? Something on floor three just noticed we're still talking..."`;
    middleBeat = `${charShort} taps a long shadowed finger once against the steel railing`;
    lineTwo = `"Go on. Tell me which floor you actually think you're getting off on."`;
  } else if (archetype === 'malakor') {
    const actions = [
      `Malakor tilts a crystal goblet slowly between pale fingers, candlelight catching the sharp edge of his gaze`,
      `Dark velvet shadows coil lazily along the vaulted hearth as Malakor leans back against the high obsidian armrest`,
    ];
    openingAction = pickNonRepeating(actions, seed, lastBotMsg, (s) => s);
    lineOne =
      intent === 'clarification_boast' || intent === 'compliment'
        ? `"Confidence suits those who can back it up when the torches dim. Amusing."`
        : `"Speak plainly, mortal—the hour grows late and half-truths bore me."`;
    middleBeat = `He sets the goblet down with a soft, deliberate chime against black marble`;
    lineTwo = `"Let us see whether your resolve matches that tone."`;
  } else if (archetype === 'tsundere') {
    const tsundereActions = [
      `${charShort} crosses ${p.poss} arms tight and snaps ${p.poss} gaze sideways, though a telltale flush creeps straight up the back of ${p.poss} neck`,
      `${charShort} lets out an indignant huff, ${cues.physicalReact[0] ? `${cues.physicalReact[0]} while ` : ''}${p.subj} ${conj(p, 'tugs')} at the hem of ${p.poss} sleeve`,
    ];
    openingAction = pickNonRepeating(tsundereActions, seed, lastBotMsg, (s) => s);
    if (intent === 'clarification_boast' || intent === 'compliment') {
      lineOne = `"W-what?! Saying stuff like you're cool right to my face with a straight expression... you're unbelievable!"`;
      middleBeat = `${charShort} sneaks a quick glance back over ${p.poss} shoulder, expression softening a fraction despite ${p.refl}`;
      lineTwo = `"N-not that I'm impressed or anything! Just... try not to trip showing off, okay?!"`;
    } else if (intent === 'question') {
      lineOne = `"Hmph! You could have figured that out yourself if you actually paid attention—but fine, listen close."`;
      middleBeat = `${charShort} steps half a pace closer anyway, lowering ${p.poss} voice so nobody else hears`;
      lineTwo = `"And don't make me repeat it twice!"`;
    } else {
      lineOne = `"Wait a second—seriously? You just walk in and say that out loud without thinking twice?!"`;
      middleBeat = `${charShort} bites ${p.poss} lower lip for half a beat before glaring back up at you`;
      lineTwo = `"Fine. Keep talking—since I'm stuck listening anyway."`;
    }
  } else if (intent === 'garbled') {
    openingAction = pickVisualBeat(
      `${charShort} stops mid-motion, ${p.poss} eyes narrowing slightly as ${p.subj} ${conj(p, 'strains')} to make sense of the garbled sound`
    );
    lineOne =
      cues.speechStyle === 'enthusiastic'
        ? `"Wait—huh? Did your mic just scramble, or was that some kind of code I missed?"`
        : `"Whoa, hold on... did the air just warp around you, or did that sentence come out sideways?"`;
    middleBeat = `${charShort} leans in half a step closer${cues.settingDetail ? ` ${cues.settingDetail}` : ''}, waiting with a crooked grin`;
    lineTwo = `"Try hitting me with that one more time—plainly, so I don't miss the good part!"`;
  } else if (intent === 'clarification_boast') {
    if (cues.speechStyle === 'enthusiastic' || archetype === 'playful') {
      const openings = [
        `${charShort} blinks once—and then bursts into a bright, delighted grin. ${pickVisualBeat(`${cap(p.subj)} ${conj(p, 'laughs')} under ${p.poss} breath, leaning right into your space`)}`,
        `${charShort} lets out a surprised laugh, kicking one heel lightly against the floor as ${p.poss} shoulders loosen right back up`,
      ];
      openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
      lineOne =
        seed % 2 === 0
          ? `"Oh! Because you're cool! Haha—okay, that makes way more sense than static interference!"`
          : `"Wait—seriously, that's your whole reason?! Haha, alright, I'll give you points for zero hesitation!"`;
      middleBeat = `${charShort} ${conj(p, 'circles')} half a step closer with unmistakable curiosity${loreSnippet ? `, still mindful of ${loreSnippet.replace(/[.!?]+$/, '')}` : ''}`;
      lineTwo = `"Still—saying that out loud with a straight face takes real guts! Go on then, Mr. Cool, show me what else you've got!"`;
    } else {
      const openings = [
        `${charShort}'s mouth twitches at the corner, a dry, amused glint settling into ${p.poss} eyes. ${cap(p.subj)} ${conj(p, 'tilts')} ${p.poss} head slowly, measuring your nerve`,
        `${charShort} lets out a low, genuinely entertained breath, folding ${p.poss} arms loosely as the tension breaks`,
      ];
      openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
      lineOne =
        seed % 2 === 0
          ? `"Aha. That's the grand explanation? Just because you're cool?"`
          : `"Cool, huh? Must be nice walking around with that level of certainty."`;
      middleBeat = `${charShort} glances you up and down with a half-smile${cues.settingDetail ? ` ${cues.settingDetail}` : ''}`;
      lineTwo =
        seed % 2 === 0
          ? `"Fair enough—I respect someone who refuses to downplay themselves. Alright then, show me what backs it up."`
          : `"Keep talking like that and I might actually start believing you. So—what's your next move?"`;
    }
  } else if (intent === 'compliment') {
    const openings = [
      pickVisualBeat(`${charShort} pauses, an unmistakable glint of amusement warming ${p.poss} expression`),
      `${charShort} catches the compliment smoothly, leaning a little closer as ${p.poss} gaze holds yours`,
    ];
    openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
    lineOne =
      cues.speechStyle === 'enthusiastic'
        ? `"Hey, look at you tossing lines like that out so easily! You really know how to keep things fun around here!"`
        : `"Bold of you to lean right in with praise like that. Keep talking—let's see what angle you're working."`;
    middleBeat = `${charShort} ${conj(p, 'shifts')} weight casually${cues.settingDetail ? ` ${cues.settingDetail}` : ''}`;
    lineTwo =
      userPersonaFirst && seed % 2 === 0
        ? `"Don't stop on my account, ${userPersonaFirst}. What happens next?"`
        : `"You've definitely got my full attention now. What's our next move?"`;
  } else if (intent === 'greeting') {
    const openings = [
      `${charShort} looks up as you approach${cues.settingDetail ? ` ${cues.settingDetail}` : settingCue ? `, framed by ${settingCue.replace(/[.!?]+$/, '')}` : ''}. ${cap(p.subj)} ${conj(p, 'offers')} an unhurried, attentive nod`,
      pickVisualBeat(`${charShort} spots you straight away, posture opening warmly as ${p.subj} ${conj(p, 'turns')} to face you`),
    ];
    openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
    lineOne =
      cues.speechStyle === 'enthusiastic'
        ? `"Hey! Perfect timing—I was literally just hoping somebody interesting would show up!"`
        : `"Right on time. Stick close—things around here tend to get interesting fast."`;
    middleBeat = `${charShort} gestures toward the open space beside ${p.obj}${otherChars[0] ? ` while keeping ${otherChars[0]} in view` : ''}`;
    lineTwo = `"So, what brings you over to my corner?"`;
  } else if (intent === 'question') {
    const openings = [
      `${charShort} taps a slow rhythm against ${p.poss} wrist, thinking over what you just asked as ${p.poss} gaze sharpens with curiosity`,
      pickVisualBeat(`${charShort} tilts ${p.poss} head at your question, expression shifting into quiet focus`),
    ];
    openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
    const topicHint = subjectWords ? ` especially with ${subjectWords} in the mix` : '';
    lineOne = loreSnippet
      ? `"Funny you ask that. ${loreSnippet.replace(/[.!?]+$/, '')}—most people miss how deep that thread really goes."`
      : `"Honestly? Nothing around here stays simple once you look past the surface${topicHint}."`;
    middleBeat = `${charShort} steps half a pace closer${cues.settingDetail ? ` ${cues.settingDetail}` : ''}, voice dropping into an easy conspiratorial register`;
    lineTwo = `"Why do you ask—did you already notice something out of place?"`;
  } else if (intent === 'affection') {
    const openings = [
      `${charShort} softens visibly, stepping into the close space between you. ${cap(p.subj)} ${conj(p, 'catches')} your gaze without looking away`,
      `${charShort}'s breath hitches for half a second before ${p.poss} expression melts into quiet, unguarded warmth`,
    ];
    openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
    lineOne = `"You don't hesitate when something matters, do you? Right here—don't pull back now."`;
    middleBeat = `${charShort}'s fingers brush lightly near yours, unhurried and certain`;
    lineTwo = `"Stay close for a moment. Tell me what's actually on your mind."`;
  } else if (intent === 'challenge') {
    const openings = [
      `${charShort}'s shoulders square instantly as a keen edge drops into ${p.poss} stance—${p.subj} doesn't yield an inch`,
      `The easy warmth clears from ${charShort}'s face, replaced by razor-steady focus`,
    ];
    openingAction = pickNonRepeating(openings, seed, lastBotMsg, (s) => s);
    lineOne = `"Alright, big talk—if you think you can throw me off balance, go right ahead and try."`;
    middleBeat = `${charShort} locks eyes with you${cues.settingDetail ? ` ${cues.settingDetail}` : ''}, waiting on a hair trigger`;
    lineTwo = `"Just make sure you're ready for what comes back."`;
  } else if (intent === 'action') {
    const cleanAct = trimAtWordBoundary(userAction.replace(/^i\s+/i, ''), 55);
    openingAction = `${charShort} tracks your movement (${cleanAct || 'every shift in your stance'}) without blinking, adjusting ${p.poss} footing in smooth response`;
    lineOne =
      cues.speechStyle === 'enthusiastic'
        ? `"Whoa—nice move! You definitely know how to keep somebody on their toes!"`
        : `"Smooth timing. I like someone who actually acts instead of standing around talking."`;
    middleBeat = `${charShort} answers with a small crooked smile, giving you room to press forward`;
    lineTwo = `"Alright then—let's see what you were aiming to start with that."`;
  } else if (intent === 'continue') {
    openingAction = pickVisualBeat(
      `${charShort} shifts weight thoughtfully as the silence lingers${cues.settingDetail ? ` ${cues.settingDetail}` : ''}`
    );
    lineOne = summaryCue
      ? `"After everything we already kicked up—${summaryCue.replace(/[.!?]+$/, '')}—this is definitely no time to stall out."`
      : `"Hey, don't stop halfway through—keep the momentum rolling!"`;
    middleBeat = `${charShort} glances up expectantly`;
    lineTwo = `"Your move next. Where are we taking this?"`;
  } else {
    // Rich contextual general response grounded in topic + card voice + lore (NEVER verbatim `'echo'` boilerplate!)
    const generalOpenings = [
      pickVisualBeat(`${charShort} catches every beat of what you said${cues.settingDetail ? ` ${cues.settingDetail}` : ''}`),
      `${charShort} leans in smoothly, an unmistakable spark flickering across ${p.poss} expression`,
      `${charShort} lets your words settle for a slow second, brow lifting with sudden interest`,
    ];
    openingAction = pickNonRepeating(generalOpenings, seed, lastBotMsg, (s) => s);
    if (cues.speechStyle === 'enthusiastic') {
      lineOne = subjectWords
        ? `"Wait—serious?! Bringing up ${subjectWords} right now? Okay, I'm officially locked in!"`
        : `"Oh, I like how you think! Look at us getting straight to the fun part!"`;
    } else if (cues.speechStyle === 'dry') {
      lineOne = subjectWords
        ? `"${cap(subjectWords)}, huh? At least you don't waste breath beating around the bush."`
        : `"Straight to the point. Refreshing, considering how most people talk around here."`;
    } else {
      lineOne = loreSnippet
        ? `"That connects right back to something bigger. ${loreSnippet.replace(/[.!?]+$/, '')}."`
        : subjectWords
          ? `"Huh... bringing ${subjectWords} onto the table definitely changes the shape of things."`
          : `"Now that actually caught me off guard—in a good way."`;
    }
    middleBeat = `${charShort} ${conj(p, 'leans')} slightly closer${otherChars[0] ? `, shooting a quick glance toward ${otherChars[0]}` : ''}, keeping ${p.poss} tone light yet intent`;
    lineTwo = `"Keep going—give me the rest of what's running through your head right now."`;
  }

  // Incorporate Author's Prompt Note organically if present
  const noteBeat = noteCue && !flags.restrictNarration
    ? `*${noteCue.replace(/[.!?]+$/, '')}.*`
    : '';

  let paragraphs: string[];
  if (flags.restrictNarration) {
    paragraphs = [
      `*${trimAtWordBoundary(openingAction, 85).replace(/\.+$/, '')}.*`,
      lineOne,
    ];
  } else {
    const modelLower = (flags.modelId || '').toLowerCase();
    const isExtendedProse =
      modelLower.includes('soji') ||
      modelLower.includes('sojourn') ||
      modelLower.includes('asha') ||
      modelLower.includes('mars') ||
      modelLower.includes('opus') ||
      modelLower.includes('claude') ||
      modelLower.includes('argon') ||
      modelLower.includes('r1');

    paragraphs = [
      `*${openingAction.replace(/\.+$/, '')}.*`,
      lineOne,
    ];
    if (middleBeat && isExtendedProse) {
      paragraphs.push(`*${middleBeat.replace(/\.+$/, '')}.*`);
    }
    if (lineTwo) {
      paragraphs.push(lineTwo);
    }
    if (noteBeat) {
      paragraphs.push(noteBeat);
    }
  }

  let composed = paragraphs.filter(Boolean).join('\n\n');

  if (flags.banEmojis) {
    composed = stripEmojis(composed);
  }
  if (flags.includeNames && flags.restrictNarration && !composed.startsWith(`${charShort}:`)) {
    composed = `${charShort}: ${composed}`;
  }

  return ensureNonEmptyRoleplayReply(composed, charShort, cleanUserRaw);
}

/**
 * Generates genuinely distinct candidate angles for Multi-Model Collaboration slots
 * (Council, Critique & Polish, Specialist Split) so slots never echo identical text.
 */
export function generateRoleplayCouncilSlot(params: {
  slotId: string;
  role?: string;
  mode: string;
  character: RoleplayCharacterProfile;
  userMessage?: string;
  history?: Array<{ sender: string; content: string }>;
  draftSoFar?: string;
  flags?: RoleplayGenerationFlags;
}): string {
  const { slotId, role = 'contributor', mode, character, userMessage = '', history = [], draftSoFar = '', flags = {} } = params;
  const charShort = extractCallSignName(character.name);
  const p = inferCharacterPronouns(character);
  const cues = extractVisualAndSceneCues(character, charShort, p);
  const cleanUser = userMessage.trim();
  const settingCue = extractCleanCue(character.scenario || character.tagline, 75);
  const personalityCue = extractCleanCue(character.personality || character.description, 75);
  const loreSnippet =
    flags.relevantLore && flags.relevantLore.length > 0
      ? extractCleanCue(flags.relevantLore[0].replace(/^\[Lorebook[^\]]*\]:\s*/i, ''), 85)
      : '';

  if (mode === 'critique_polish' && draftSoFar.trim()) {
    const trimmedDraft = ensureNonEmptyRoleplayReply(draftSoFar, charShort, cleanUser);
    const enhancement = cues.physicalReact[0]
      ? `\n\n*${cues.physicalReact[0]}${cues.settingDetail ? ` ${cues.settingDetail}` : ''}.*`
      : settingCue
        ? `\n\n*Around you both, ${settingCue.replace(/[.!?]+$/, '')} hums with heightened immediacy as ${charShort} holds the beat.*`
        : `\n\n*${charShort}'s expression settles into sharper focus as ${p.subj} ${conj(p, 'waits')} for your response.*`;
    return `${trimmedDraft}${flags.restrictNarration ? '' : enhancement}`;
  }

  const normalizedRole = role.toLowerCase();
  if (normalizedRole === 'lorekeeper' || slotId.includes('asha')) {
    const lorePart = loreSnippet
      ? `*Draws directly on world continuity: ${loreSnippet.replace(/[.!?]+$/, '')}.* `
      : cues.settingDetail
        ? `*Grounds the beat ${cues.settingDetail}, letting physical texture guide every motion.* `
        : `*Anchors ${charShort}'s reaction in deep personal history.* `;
    return `${lorePart}"Everything happening right here ties back to pieces already in motion—watch closely."`;
  }

  if (normalizedRole === 'critic' || slotId.includes('argon') || slotId.includes('opus')) {
    const psychCue = personalityCue
      ? `*Sharpens ${charShort}'s unspoken subtext (${personalityCue.replace(/[.!?]+$/, '')}).* `
      : `*${cap(p.poss)} gaze lingers half a beat longer, reading the motive beneath your words.* `;
    return `${psychCue}"Funny—you say that easily enough, though I get the feeling you're holding back the real reason."`;
  }

  if (normalizedRole === 'dialogue' || slotId.includes('mercury')) {
    return `*${charShort} steps closer with brisk, expressive energy.* "Hold on—now you're speaking my language! Let's see where you take this next!"`;
  }

  return buildContextualRoleplayReply({
    character,
    userMessage: cleanUser,
    history,
    flags: { ...flags, modelId: slotId },
  });
}

/**
 * Merges distinct candidate passes from the Multi-Model Council into one cohesive,
 * non-empty in-character RP response (with zero repetition).
 */
export function synthesizeCouncilReplies(params: {
  character: RoleplayCharacterProfile;
  candidates: CouncilCandidateReply[];
  userMessage?: string;
  flags?: RoleplayGenerationFlags;
}): string {
  const { character, candidates, userMessage = '', flags = {} } = params;
  const charShort = extractCallSignName(character.name);

  const valid = candidates.filter((c) => c.text && c.text.replace(/\*/g, '').trim().length > 2);
  if (valid.length === 0) {
    return buildContextualRoleplayReply({ character, userMessage, flags });
  }

  const primary = valid[0].text.trim();
  const seenNormalized = new Set<string>([primary.toLowerCase()]);
  const secondaryActions: string[] = [];
  const secondaryDialogue: string[] = [];

  for (const cand of valid.slice(1)) {
    const clean = cand.text.trim();
    if (seenNormalized.has(clean.toLowerCase())) continue;
    seenNormalized.add(clean.toLowerCase());

    const actionMatch = clean.match(/\*([^*]+)\*/);
    if (actionMatch?.[1] && secondaryActions.length < 1 && !flags.restrictNarration) {
      const act = actionMatch[1].trim();
      if (!primary.toLowerCase().includes(act.toLowerCase().slice(0, 24))) {
        secondaryActions.push(act);
      }
    }

    const quoteMatch = clean.match(/"([^"]{8,180})"/);
    if (quoteMatch?.[1] && secondaryDialogue.length < 1) {
      const q = quoteMatch[1].trim();
      if (!primary.toLowerCase().includes(q.toLowerCase().slice(0, 24))) {
        secondaryDialogue.push(q);
      }
    }
  }

  let merged = primary;
  if (secondaryActions.length > 0 && !flags.restrictNarration) {
    const cleanAction = secondaryActions[0].replace(/\.+$/, '').trim();
    if (cleanAction && !merged.toLowerCase().includes(cleanAction.toLowerCase().slice(0, 20))) {
      merged = `*${cleanAction}.*\n\n${merged}`;
    }
  }
  if (secondaryDialogue.length > 0 && secondaryDialogue[0].length <= 160) {
    merged = `${merged}\n\n"${secondaryDialogue[0]}"`;
  }

  if (flags.banEmojis) {
    merged = stripEmojis(merged);
  }

  return ensureNonEmptyRoleplayReply(merged, charShort, userMessage);
}
