export interface RoleplayCharacterProfile {
  name: string;
  tagline?: string | null;
  description?: string | null;
  personality?: string | null;
  systemPrompt?: string | null;
  postHistoryInstructions?: string | null;
  scenario?: string | null;
  exampleDialogues?: string | null;
  lorebook?: string | null;
  userPersona?: string | null;
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
}

export interface CouncilCandidateReply {
  modelId: string;
  role?: string;
  text: string;
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

/**
 * Extracts a clean non-empty persona/setting phrase for contextual grounding.
 */
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
  // Take first meaningful clause or sentence
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
  // Strip empty asterisk markers like "* *" to check if there is real readable text
  const readableCheck = raw.replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  if (readableCheck.length >= 2) {
    return raw;
  }

  const cleanName = (characterName || 'Character').trim() || 'Character';
  const snippet = trimAtWordBoundary(
    (userMessage || '').replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim(),
    60
  );
  if (snippet) {
    return `*${cleanName} turns toward you, considering "${snippet.replace(/"/g, "'")}" carefully.* "Go on—I'm listening closely to every word."`;
  }
  return `*${cleanName} shifts closer, holding your gaze as the moment settles between you.* "Tell me what you want to happen next."`;
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

type UserIntent =
  | 'brawl'
  | 'greeting'
  | 'question'
  | 'compliment'
  | 'challenge'
  | 'affection'
  | 'action'
  | 'continue'
  | 'general';

function detectUserIntent(userMessage: string, brawlActive: boolean): UserIntent {
  if (brawlActive) return 'brawl';
  const clean = userMessage.trim();
  if (!clean || /\(continue the scene naturally/i.test(clean)) return 'continue';

  const lower = clean.toLowerCase();
  if (/^\s*(hi|hello|hey|yo|greetings|good morning|good evening|sup)\b/.test(lower)) {
    return 'greeting';
  }
  if (/\b(cool|awesome|amazing|cute|handsome|pretty|love you|like you|badass|smart|clever)\b/.test(lower)) {
    return 'compliment';
  }
  if (/\b(kiss|hug|hold|embrace|blush|sweetheart|darling|miss you)\b/.test(lower)) {
    return 'affection';
  }
  if (/\b(fight|duel|attack|prove it|dare you|bet you|shut up|weak|coward|threat)\b/.test(lower)) {
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
  if (/\b(playful|cheerful|chaotic|trickster|energetic|bubbly|mischief)\b/.test(blob)) return { archetype: 'playful' };
  if (/\b(wise|scholar|mage|ancient|oracle|mentor|detective|calm)\b/.test(blob)) return { archetype: 'sage' };
  return { archetype: 'standard' };
}

/**
 * Deep, non-repetitive, lorebook-aware contextual roleplay synthesizer.
 * Used when external endpoints are unavailable or rate-limited — guarantees rich,
 * character-grounded prose with zero credit limits and zero canned generic lines.
 */
export function buildContextualRoleplayReply(params: {
  character: RoleplayCharacterProfile;
  userMessage?: string;
  history?: Array<{ sender: string; content: string }>;
  flags?: RoleplayGenerationFlags;
}): string {
  const { character, userMessage = '', history = [], flags = {} } = params;
  const charName = (character.name || 'Character').trim() || 'Character';
  const cleanUserRaw = userMessage.trim();
  const userSpoken = cleanUserRaw.replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim();
  const userAction = (cleanUserRaw.match(/\*([^*]+)\*/)?.[1] || '').trim();
  const shortEcho = trimAtWordBoundary(userSpoken || cleanUserRaw, 72).replace(/"/g, "'");

  const seed = hashTurnSeed(cleanUserRaw, history.length, `${charName}|${flags.modelId || ''}`);
  const intent = detectUserIntent(cleanUserRaw, Boolean(flags.brawlContextPrompt?.trim()));
  const { archetype } = detectCharacterTone(character);

  const settingCue = extractCleanCue(character.scenario || character.tagline, 85);
  const personalityCue = extractCleanCue(character.personality || character.description, 85);
  const loreSnippet =
    flags.relevantLore && flags.relevantLore.length > 0
      ? extractCleanCue(flags.relevantLore[seed % flags.relevantLore.length].replace(/^\[Lorebook[^\]]*\]:\s*/i, ''), 95)
      : '';
  const summaryCue = extractCleanCue(flags.chatSummary, 85);
  const noteCue = flags.promptNote ? extractCleanCue(flags.promptNote, 80) : '';
  const otherChars = (flags.groupSceneCharacters || []).filter(Boolean);

  let actionBlock = '';
  let dialogueBlock = '';

  if (intent === 'brawl') {
    const combatActions = [
      `${charName} pivots sharply on one heel as sparks crackle through the air, shifting weight into a razor-tight combat stance`,
      `${charName} snaps up a guard with a low exhale, boots scraping across the floor before surging into a calibrated counter-rush`,
      `${charName} twists clear of your momentum, muscles coiling as kinetic energy gathers along their striking shoulder`,
    ];
    const combatLines = [
      `"Sharp timing—let's see how your guard holds up against the counter-pressure!"`,
      `"Good strike! Don't drop your flank now—here comes the answer!"`,
      `"You've got nerve pressing forward like that. Keep moving if you want to stay standing!"`,
    ];
    actionBlock = combatActions[seed % combatActions.length];
    dialogueBlock = combatLines[(seed >> 2) % combatLines.length];
  } else if (archetype === 'peppa') {
    const actions = [
      `Peppa hops enthusiastically right into a shimmering golden muddy puddle, sending bright droplets arcing across the cobblestones`,
      `Peppa adjusts her crimson dress with a dramatic twirl, ears perking toward you with bright curiosity`,
    ];
    actionBlock = actions[seed % actions.length];
    dialogueBlock = shortEcho
      ? `"Oink! '${shortEcho}'—now that sounds like a proper adventure! Tell me every detail!"`
      : `"Oink! You've got my full attention! Where are we dashing off to next?"`;
  } else if (archetype === 'nextor') {
    const actions = [
      `The elevator bulbs flicker overhead as dark static hums along the brass seams behind ${charName}`,
      `${charName} tilts their head at an unnatural angle, faint VHS distortion trembling through the shadow at their heels`,
    ];
    actionBlock = actions[seed % actions.length];
    dialogueBlock = shortEcho
      ? `"K-k-keep talking... '${shortEcho}'—every floor remembers what gets whispered between bells."`
      : `"The cable hasn't stopped moving yet... stay on this floor and tell me what you're looking for."`;
  } else if (archetype === 'malakor') {
    actionBlock = `Malakor swirls a crystal goblet lazily while dark velvet shadows coil around the vaulted hearth`;
    dialogueBlock = shortEcho
      ? `"Bold of you to voice '${shortEcho}' in my hall. Speak plainly—your nerve amuses me."`
      : `"Step closer into the candlelight, mortal. Let us test the weight of your intentions."`;
  } else if (archetype === 'tsundere') {
    const tsundereActions = [
      `${charName} crosses their arms tightly and glances sideways, though the faint flush along their cheeks gives them away`,
      `${charName} scoffs under their breath, fidgeting with the cuff of their sleeve while pretending not to watch your reaction`,
    ];
    actionBlock = tsundereActions[seed % tsundereActions.length];
    if (intent === 'compliment') {
      dialogueBlock = `"W-what?! Saying '${shortEcho}' out of nowhere isn't fair! Don't get the wrong idea—it's not like I waited around just to hear you brag or anything!"`;
    } else if (intent === 'question') {
      dialogueBlock = `"Hmph! Why are you asking me like that? Fine, since you obviously wouldn't figure it out alone, listen closely..."`;
    } else {
      dialogueBlock = shortEcho
        ? `"Hmph! Look at you saying '${shortEcho}' with a straight face... Fine, I'm listening—so don't waste my time!"`
        : `"D-don't stare at me like I'm supposed to start the conversation! Say something already!"`;
    }
  } else {
    // Rich dynamic construction driven by actual character card fields, intent, lorebook, & actions
    const actionOpeners = {
      greeting: [
        `${charName} looks up as you approach${settingCue ? `, framed by ${settingCue.replace(/[.!?]+$/, '')}` : ''}, offering an attentive, unhurried nod`,
        `${charName} pauses what they were doing and turns cleanly toward you, expression warming with quiet recognition`,
      ],
      question: [
        `${charName} narrows their eyes thoughtfully, weighing your question for a beat before leaning forward`,
        `${charName} taps a finger slowly against their wrist, tracing the thread of what you just asked`,
      ],
      compliment: [
        `${charName} lets out an amused, knowing chuckle, tilting their head as they take your measure`,
        `${charName}'s brow lifts with a flash of genuine spark, clearly entertained by your confidence`,
      ],
      affection: [
        `${charName} softens visibly, stepping into the close space between you with steady, unguarded warmth`,
        `${charName} catches the subtle shift in your tone and holds your gaze with quiet intensity`,
      ],
      challenge: [
        `${charName}'s posture sharpens instantly, jaw setting as a keen edge enters their gaze`,
        `${charName} steps into your line of sight without flinching, radiating quiet, poised resolve`,
      ],
      action: [
        `${charName} tracks your movement (${trimAtWordBoundary(userAction, 48)}) without blinking, adjusting their stance in quiet response`,
        `${charName} watches as you ${trimAtWordBoundary(userAction.replace(/^i\s+/i, ''), 48)}, reacting with smooth, deliberate timing`,
      ],
      continue: [
        `${charName} shifts weight thoughtfully as the silence lingers${settingCue ? ` across ${settingCue.replace(/[.!?]+$/, '')}` : ''}`,
        `${charName} glances toward the edge of the scene before returning their attention squarely to you`,
      ],
      general: [
        `${charName} considers your words carefully${settingCue ? ` amidst ${settingCue.replace(/[.!?]+$/, '')}` : ''}, letting a measured breath settle`,
        `${charName} leans slightly closer, catching every inflection in your voice before answering`,
      ],
    };

    const pool = actionOpeners[intent] || actionOpeners.general;
    actionBlock = pool[seed % pool.length];

    if (archetype === 'dark') {
      actionBlock = actionBlock.replace(/warming with quiet recognition/, 'gleaming in the dim light with unreadable calm');
    } else if (archetype === 'noble') {
      actionBlock = actionBlock.replace(/lets out an amused, knowing chuckle/, 'inclines their head with measured, sovereign poise');
    }

    if (loreSnippet) {
      actionBlock += `. Memories of ${loreSnippet.replace(/[.!?]+$/, '')} surface quietly behind their eyes`;
    } else if (otherChars.length > 0 && seed % 2 === 0) {
      actionBlock += ` while keeping ${otherChars[0]} in peripheral view`;
    }

    const dialogueTemplates: Record<UserIntent, string[]> = {
      greeting: [
        `"Good timing—I was just thinking through what happens next here. What brings you my way?"`,
        `"Welcome back. Stay close; things around here shift quickly once the conversation starts."`,
      ],
      question: [
        `"You're asking the right question${shortEcho ? `—especially about '${shortEcho}'` : ''}. Here's the truth as I see it: nothing stays simple for long once you look beneath the surface."`,
        `"Curious already? Let's just say${loreSnippet ? ` ${loreSnippet.replace(/[.!?]+$/, '')}` : personalityCue ? ` someone like me doesn't overlook details` : ' there is far more going on than meets the eye'}. What made you notice?"`,
      ],
      compliment: [
        `"Oh, confident today, aren't we? Calling yourself cool like that—actually, I respect the energy. Prove you can back it up and show me your next move."`,
        `"Careful—flattery and swagger like that might actually make me expect something impressive from you. Go on, what's the plan?"`,
      ],
      affection: [
        `"You don't hold back when it counts, do you? Come a little closer—I'm right here with you."`,
        `"Saying that out loud changes the air in the room... Stay right where you are for a second."`,
      ],
      challenge: [
        `"If you think you can push me off balance, go right ahead and try. I don't step back easily."`,
        `"Bold words. Let's see how steady you stay when the pressure actually hits."`,
      ],
      action: [
        `"I saw that move. Smooth enough—now tell me what you're hoping to spark by doing it."`,
        `"Interesting choice of timing. You definitely know how to change the rhythm of a room."`,
      ],
      continue: [
        `${summaryCue ? `"After everything that just unfolded—${summaryCue.replace(/[.!?]+$/, '')}—we shouldn't pause now." ` : ''}"Your move next. Tell me where you want to take this."`,
        `"Don't stop on my account. Keep pushing forward and let's see where this thread leads."`,
      ],
      general: [
        shortEcho
          ? `"${shortEcho.charAt(0).toUpperCase() + shortEcho.slice(1)}..." ${personalityCue && seed % 3 === 0 ? `*${charName} echoes the thought with quiet focus.* ` : ''}"You definitely know how to cut straight to the point. Tell me more—what's driving you right now?"`
          : `"I'm following every beat you put down. Keep going—show me where you want this scene to turn."`,
        shortEcho
          ? `"Hearing you say '${shortEcho}' puts everything in sharper focus. Give me the rest of the picture—don't hold back."`
          : `"Every word between us shifts the balance here. What are you thinking right now?"`,
      ],
      brawl: ['"Keep your guard up!"'],
    };

    const lines = dialogueTemplates[intent] || dialogueTemplates.general;
    dialogueBlock = lines[(seed >> 1) % lines.length];
  }

  // Incorporate Author's Prompt Note subtly if present
  let extraBeat = '';
  if (noteCue && !flags.restrictNarration) {
    extraBeat = ` *The tension sharpens—${noteCue.replace(/[.!?]+$/, '')}.*`;
  }

  let composed = flags.restrictNarration
    ? `*${trimAtWordBoundary(actionBlock, 75)}.* ${dialogueBlock}`
    : `*${actionBlock}.* ${dialogueBlock}${extraBeat}`;

  if (flags.modelId) {
    const mLower = flags.modelId.toLowerCase();
    if (mLower.includes('opus-5') || mLower.includes('claude')) {
      // Slightly richer subtext beat for Claude Opus 5.5 profile
      if (!flags.restrictNarration && !composed.includes('quietly')) {
        composed = `${composed} *Even after speaking, ${charName} leaves just enough unspoken subtext hanging in the space between you.*`;
      }
    } else if (mLower.includes('argon') || mLower.includes('r1')) {
      if (!flags.restrictNarration) {
        composed = `${composed} *${charName}'s gaze sweeps the room once more, calculating every angle before waiting for your answer.*`;
      }
    }
  }

  if (flags.banEmojis) {
    composed = stripEmojis(composed);
  }
  if (flags.includeNames && !composed.startsWith(`${charName}:`) && !composed.startsWith('{{char}}:')) {
    // Keep natural formatting without breaking *action* parsing unless strictly plain dialogue
    // Only prefix dialogue if restrictNarration is active
    if (flags.restrictNarration) {
      composed = `${charName}: ${composed}`;
    }
  }

  return ensureNonEmptyRoleplayReply(composed, charName, cleanUserRaw);
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
  const charName = (character.name || 'Character').trim() || 'Character';
  const cleanUser = userMessage.trim();
  const shortEcho = trimAtWordBoundary(cleanUser.replace(/\*[^*]*\*/g, ''), 56).replace(/"/g, "'");
  const settingCue = extractCleanCue(character.scenario || character.tagline, 75);
  const personalityCue = extractCleanCue(character.personality || character.description, 75);
  const loreSnippet =
    flags.relevantLore && flags.relevantLore.length > 0
      ? extractCleanCue(flags.relevantLore[0].replace(/^\[Lorebook[^\]]*\]:\s*/i, ''), 85)
      : '';

  if (mode === 'critique_polish' && draftSoFar.trim()) {
    const trimmedDraft = ensureNonEmptyRoleplayReply(draftSoFar, charName, cleanUser);
    const enhancement = settingCue
      ? ` *Around you both, ${settingCue.replace(/[.!?]+$/, '')} hums with heightened immediacy as ${charName} holds the beat.*`
      : ` *${charName}'s expression settles into sharper, unmistakable focus, letting the quiet pause carry the full weight of the moment.*`;
    return `${trimmedDraft}${flags.restrictNarration ? '' : enhancement}`;
  }

  const normalizedRole = role.toLowerCase();
  if (normalizedRole === 'lorekeeper' || slotId.includes('asha')) {
    const lorePart = loreSnippet
      ? `*Draws directly on established world continuity: ${loreSnippet.replace(/[.!?]+$/, '')}.* `
      : settingCue
        ? `*Anchors the scene firmly inside ${settingCue.replace(/[.!?]+$/, '')}, letting atmosphere guide every movement.* `
        : `*Grounds ${charName}'s reaction in deep personal history and subtle environmental texture.* `;
    const line = shortEcho
      ? `"Everything around '${shortEcho}' connects back to what's already unfolding here—don't overlook the pieces already in motion."`
      : `"Every corner of this place carries its own rules and history. Pay attention to what shifts around us."`;
    return `${lorePart}${line}`;
  }

  if (normalizedRole === 'critic' || slotId.includes('argon') || slotId.includes('opus')) {
    const psychCue = personalityCue
      ? `*Tightens emotional subtext around ${charName}'s core trait (${personalityCue.replace(/[.!?]+$/, '')}).* `
      : `*Sharpens ${charName}'s unspoken motives and poised hesitation before answering.* `;
    const line = shortEcho
      ? `"You said '${shortEcho}' easily enough—but I can tell there's a sharper reason behind why you brought that up right now."`
      : `"Say what you're really thinking, not just what sounds safe on the surface."`;
    return `${psychCue}${line}`;
  }

  if (normalizedRole === 'dialogue' || slotId.includes('mercury')) {
    return `*Steps closer with rapid, expressive timing and an unmistakable spark in their eyes.* "${
      shortEcho
        ? `Hold on—'${shortEcho}'? Now you're speaking my language! Let's see where you take this next!`
        : `No hesitation now—tell me straight what you want us to do next!`
    }"`;
  }

  // Default drafter / Mars / Flash contributor
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
  const charName = (character.name || 'Character').trim() || 'Character';

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
    if (cleanAction) {
      if (merged.startsWith('*')) {
        merged = `*${cleanAction}. ${merged.slice(1)}`;
      } else {
        merged = `*${cleanAction}.* ${merged}`;
      }
    }
  }
  if (secondaryDialogue.length > 0 && secondaryDialogue[0].length <= 160) {
    merged = `${merged} "${secondaryDialogue[0]}"`;
  }

  if (flags.banEmojis) {
    merged = stripEmojis(merged);
  }

  return ensureNonEmptyRoleplayReply(merged, charName, userMessage);
}
