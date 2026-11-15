import type {
  BrawlCombatState,
  BrawlTriggerMode,
  Character,
  EnsembleModelSlot,
  GroupParticipant,
  ModelEnsembleConfig,
} from '../types/index.ts';

export type ResponderSelectionMode = 'auto' | 'specific' | 'round_robin' | 'all';

export type BrawlMoveType =
  | 'strike'
  | 'combo'
  | 'guard'
  | 'special'
  | 'dodge'
  | 'recover'
  | 'flee'
  | 'custom';

export const DEFAULT_ENSEMBLE_CONFIG: ModelEnsembleConfig = {
  enabled: false,
  mode: 'council',
  models: [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', role: 'drafter' },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', role: 'critic' },
  ],
  synthesizerModelId: 'gemini-3.8-flash',
};

export function toGroupParticipant(
  char: Pick<
    Character,
    | 'uuid'
    | 'name'
    | 'avatar'
    | 'tagline'
    | 'description'
    | 'personality'
    | 'systemPrompt'
    | 'scenario'
    | 'lorebook'
  >,
  isHost: boolean = false
): GroupParticipant {
  return {
    uuid: char.uuid,
    name: char.name,
    avatar: char.avatar,
    tagline: char.tagline,
    description: char.description,
    personality: char.personality ?? null,
    systemPrompt: char.systemPrompt,
    scenario: char.scenario ?? null,
    lorebook: char.lorebook ?? null,
    muted: false,
    isHost,
  };
}

export function addParticipantToRoster(
  roster: GroupParticipant[],
  candidate: GroupParticipant
): GroupParticipant[] {
  if (!candidate.uuid) return roster;
  const existingIdx = roster.findIndex((p) => p.uuid === candidate.uuid);
  if (existingIdx >= 0) {
    return roster.map((p, idx) =>
      idx === existingIdx ? { ...p, muted: false } : p
    );
  }
  return [...roster, { ...candidate, muted: false }];
}

export function removeParticipantFromRoster(
  roster: GroupParticipant[],
  uuidToRemove: string
): {
  nextRoster: GroupParticipant[];
  removed: boolean;
} {
  if (roster.length <= 1) {
    return { nextRoster: roster, removed: false };
  }
  const target = roster.find((p) => p.uuid === uuidToRemove);
  if (!target) {
    return { nextRoster: roster, removed: false };
  }
  const remaining = roster.filter((p) => p.uuid !== uuidToRemove);
  if (remaining.length === 0) {
    return { nextRoster: roster, removed: false };
  }
  // Ensure there is always one host participant if the host was removed
  const hasHost = remaining.some((p) => p.isHost);
  const nextRoster = hasHost
    ? remaining
    : remaining.map((p, idx) => (idx === 0 ? { ...p, isHost: true } : p));
  return { nextRoster, removed: true };
}

export function selectRespondingCharacters(options: {
  roster: GroupParticipant[];
  mode: ResponderSelectionMode;
  selectedUuid?: string | null;
  userMessage?: string;
  lastSpeakerUuid?: string | null;
  maxAllCount?: number;
}): GroupParticipant[] {
  const {
    roster,
    mode,
    selectedUuid,
    userMessage = '',
    lastSpeakerUuid,
    maxAllCount = 4,
  } = options;

  const active = roster.filter((p) => !p.muted);
  const pool = active.length > 0 ? active : roster;
  if (pool.length === 0) return [];

  if (mode === 'specific' && selectedUuid) {
    const exact = pool.find((p) => p.uuid === selectedUuid);
    if (exact) return [exact];
  }

  if (mode === 'all') {
    return pool.slice(0, maxAllCount);
  }

  if (mode === 'round_robin') {
    if (!lastSpeakerUuid) return [pool[0]];
    const idx = pool.findIndex((p) => p.uuid === lastSpeakerUuid);
    const nextIdx = idx >= 0 ? (idx + 1) % pool.length : 0;
    return [pool[nextIdx]];
  }

  // 'auto': check if user explicitly mentions a participant name or @name
  const normalizedMsg = userMessage.toLowerCase();
  if (normalizedMsg.trim()) {
    const mentioned = pool.filter((p) => {
      const fullName = p.name.toLowerCase().trim();
      const firstName = fullName.split(/\s+/)[0];
      if (normalizedMsg.includes(`@${fullName}`) || normalizedMsg.includes(fullName)) {
        return true;
      }
      if (firstName && firstName.length >= 3) {
        const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(firstName)}(?:$|[^a-z0-9])`, 'i');
        return re.test(normalizedMsg);
      }
      return false;
    });
    if (mentioned.length > 0) {
      return mentioned.slice(0, maxAllCount);
    }
  }

  // Fallback in auto mode: pick selectedUuid if present, else alternate from last speaker
  if (selectedUuid) {
    const picked = pool.find((p) => p.uuid === selectedUuid);
    if (picked) return [picked];
  }
  if (lastSpeakerUuid && pool.length > 1) {
    const idx = pool.findIndex((p) => p.uuid === lastSpeakerUuid);
    if (idx >= 0) {
      return [pool[(idx + 1) % pool.length]];
    }
  }
  return [pool[0]];
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeEnsembleConfig(
  raw?: Partial<ModelEnsembleConfig> | null
): ModelEnsembleConfig {
  if (!raw) {
    return {
      ...DEFAULT_ENSEMBLE_CONFIG,
      models: DEFAULT_ENSEMBLE_CONFIG.models.map((m) => ({ ...m })),
    };
  }
  const seen = new Set<string>();
  const cleanModels: EnsembleModelSlot[] = [];
  for (const slot of raw.models || []) {
    const id = String(slot?.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    cleanModels.push({
      id,
      label: slot.label || id,
      role: slot.role || (cleanModels.length === 0 ? 'drafter' : 'critic'),
      apiProvider: slot.apiProvider,
      apiUrl: slot.apiUrl,
      apiKey: slot.apiKey,
    });
  }
  while (cleanModels.length < 2) {
    const fallback = cleanModels.some((m) => m.id === 'gemini-3.8-flash')
      ? { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', role: 'critic' as const }
      : { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', role: 'drafter' as const };
    if (!cleanModels.some((m) => m.id === fallback.id)) {
      cleanModels.push(fallback);
    } else {
      cleanModels.push({ id: 'gemini-4-argon', label: 'Gemini 4 Argon', role: 'lorekeeper' });
    }
  }

  const validMode =
    raw.mode === 'council' ||
    raw.mode === 'critique_polish' ||
    raw.mode === 'specialist_split' ||
    raw.mode === 'single'
      ? raw.mode
      : 'council';

  return {
    enabled: Boolean(raw.enabled),
    mode: validMode,
    models: cleanModels.slice(0, 4),
    synthesizerModelId: (raw.synthesizerModelId || cleanModels[0].id).trim(),
  };
}

export function buildEnsembleStagePrompt(params: {
  mode: ModelEnsembleConfig['mode'];
  role: EnsembleModelSlot['role'] | string;
  characterName: string;
  userMessage?: string;
  draftSoFar?: string;
}): string {
  const { mode, role, characterName, userMessage = '', draftSoFar = '' } = params;
  if (mode === 'critique_polish' && draftSoFar) {
    return `You are collaborating in a two-pass multi-model writing team for "${characterName}".
Review and elevate this draft reply to the user's message ("${userMessage.slice(0, 220)}"):
--- DRAFT ---
${draftSoFar}
--- END DRAFT ---
Deepen "${characterName}"'s voice, sensory detail, lore consistency, and emotional realism. Output ONLY the final upgraded in-character response.`;
  }

  if (mode === 'specialist_split') {
    if (role === 'lorekeeper') {
      return `Specialist Pass [Scene & Action Choreography] for "${characterName}": Propose 2-3 vivid sensory beats, body language cues, and lore details in response to: "${userMessage.slice(0, 220)}".`;
    }
    return `Specialist Pass [Dialogue & Emotion] for "${characterName}": Craft expressive, emotionally sharp in-character speech and reaction to: "${userMessage.slice(0, 220)}".`;
  }

  return `Model Council Pass (${role || 'contributor'}) for "${characterName}": Write your strongest, deeply in-character response to: "${userMessage.slice(0, 240)}".`;
}

export function buildEnsembleSynthesisPrompt(params: {
  characterName: string;
  mode: ModelEnsembleConfig['mode'];
  candidates: Array<{ modelId: string; role?: string; text: string }>;
  userMessage?: string;
}): string {
  const { characterName, mode, candidates, userMessage = '' } = params;
  const formattedCandidates = candidates
    .map(
      (c, idx) =>
        `[Model ${idx + 1}: ${c.modelId}${c.role ? ` (${c.role})` : ''}]\n${c.text}`
    )
    .join('\n\n---\n\n');

  return `You are the Master Synthesizer uniting ${candidates.length} collaborating AI models (${mode.replace(/_/g, ' ')}) portraying "${characterName}".
User just wrote: "${userMessage.slice(0, 240)}"

Below are the candidate contributions from the participating models:
${formattedCandidates}

Synthesize the strongest imagery, dialogue rhythm, psychological nuance, and lore continuity into ONE cohesive, seamless, vivid response written purely as "${characterName}". Do not mention models, drafts, or collaboration in the final prose.`;
}

// ============================================================================
// BrawlChat.ai-Style Text Fighting Engine
// ============================================================================

export function createInitialBrawlState(
  playerName: string,
  opponentName: string,
  triggerMode: BrawlTriggerMode = 'auto',
  startedBy: 'auto' | 'manual' | null = null
): BrawlCombatState {
  const active = startedBy !== null;
  return {
    active,
    triggerMode,
    round: active ? 1 : 0,
    player: {
      id: 'player',
      name: playerName || 'Challenger',
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      stance: 'balanced',
      statuses: [],
      atk: 16,
      def: 8,
    },
    opponent: {
      id: 'opponent',
      name: opponentName || 'Rival',
      hp: 100,
      maxHp: 100,
      stamina: 100,
      maxStamina: 100,
      stance: 'balanced',
      statuses: [],
      atk: 15,
      def: 8,
    },
    comboStreak: 0,
    log: active
      ? [`⚔️ Text Fight started: ${playerName || 'Challenger'} vs ${opponentName || 'Rival'}!`]
      : [],
    outcome: active ? 'ongoing' : null,
    startedBy,
  };
}

const NON_COMBAT_FALSE_POSITIVES = [
  /fighting\s+game/i,
  /punch\s+the\s+clock/i,
  /talk\s+about\s+(?:fighting|war|combat|battles)/i,
  /history\s+of\s+(?:war|combat|battles)/i,
];

const COMBAT_INITIATION_REGEX =
  /\b(attack|attacks|attacking|punch|punches|kick|kicks|slash|slashes|slashing|stab|stabs|strike|strikes|shoot|shoots|fire\s+(?:at|my|a)|cast\s+(?:fireball|spell|lightning|blast)|duel|brawl|spar|draw\s+(?:my|a)\s+(?:blade|sword|gun|weapon)|lunges?\s+at|charges?\s+at|swing(?:s)?\s+(?:my|a)\s+(?:sword|fist|blade|axe)|tackle|ambush|fight\s+(?:you|me|him|her|them)|throw(?:s)?\s+a\s+punch|uppercut|roundhouse|clash|engage\s+in\s+combat)\b/i;

const BATTLE_END_REGEX =
  /\b(i\s+(?:yield|surrender|forfeit|retreat|flee)|call(?:s)?\s+a\s+truce|ceasefire|battle\s+(?:is\s+)?over|fight\s+(?:is\s+)?over|end\s+(?:the\s+)?(?:fight|battle)|sheathe(?:s)?\s+(?:my|the)\s+(?:blade|sword)|drop(?:s)?\s+(?:my|the)\s+weapon)\b/i;

export function detectCombatTrigger(
  text: string,
  currentlyActive: boolean
): 'start' | 'end' | 'continue' | 'none' {
  const clean = (text || '').trim();
  if (!clean) return currentlyActive ? 'continue' : 'none';

  if (currentlyActive && BATTLE_END_REGEX.test(clean)) {
    return 'end';
  }

  for (const fp of NON_COMBAT_FALSE_POSITIVES) {
    if (fp.test(clean)) {
      return currentlyActive ? 'continue' : 'none';
    }
  }

  if (!currentlyActive && COMBAT_INITIATION_REGEX.test(clean)) {
    return 'start';
  }

  return currentlyActive ? 'continue' : 'none';
}

export function inferBrawlMoveFromText(text: string): BrawlMoveType {
  const lower = (text || '').toLowerCase();
  if (/flee|retreat|escape|run away|disengage/.test(lower)) return 'flee';
  if (/heal|bandage|potion|recover|catch\s+breath|meditate/.test(lower)) return 'recover';
  if (/block|parry|guard|shield|defend|brace/.test(lower)) return 'guard';
  if (/dodge|evade|sidestep|roll|feint|duck/.test(lower)) return 'dodge';
  if (/combo|flurry|rapid|barrage|multi|chain/.test(lower)) return 'combo';
  if (/finisher|ultimate|special|blast|overdrive|magic|spell|fireball|crimson|limit\s+break/.test(lower))
    return 'special';
  if (/strike|punch|kick|slash|stab|swing|attack|hit|cut|shoot|lunge/.test(lower))
    return 'strike';
  return 'custom';
}

export function resolveBrawlExchange(
  state: BrawlCombatState,
  moveType: BrawlMoveType,
  rawActionText: string = '',
  rngSeed?: number
): BrawlCombatState {
  const rollFactor =
    typeof rngSeed === 'number'
      ? Math.max(0.75, Math.min(1.25, rngSeed))
      : 0.85 + ((((state.round + 1) * 7 + rawActionText.length) % 9) * 0.05);

  const nextPlayer = { ...state.player, statuses: [...state.player.statuses] };
  const nextOpp = { ...state.opponent, statuses: [...state.opponent.statuses] };
  let comboStreak = state.comboStreak;
  let round = Math.max(1, state.round) + 1;
  let playerDmgDealt = 0;
  let oppDmgDealt = 0;
  let logLine = '';

  if (moveType === 'flee' || detectCombatTrigger(rawActionText, true) === 'end') {
    const isTruce = /truce|ceasefire|yield|surrender|sheathe/.test(rawActionText.toLowerCase());
    const outcome = isTruce ? 'truce' : 'fled';
    return {
      ...state,
      active: false,
      round,
      outcome,
      log: [
        ...state.log,
        `Round ${state.round}: ${nextPlayer.name} disengaged (${outcome.toUpperCase()}). Text Fight concluded!`,
      ].slice(-12),
    };
  }

  switch (moveType) {
    case 'guard': {
      nextPlayer.stance = 'guarding';
      nextPlayer.stamina = Math.min(nextPlayer.maxStamina, nextPlayer.stamina + 14);
      playerDmgDealt = Math.round(6 * rollFactor);
      oppDmgDealt = Math.max(2, Math.round((nextOpp.atk - nextPlayer.def * 1.4) * rollFactor));
      comboStreak = 0;
      logLine = `Round ${state.round}: ${nextPlayer.name} braced & countered for ${playerDmgDealt} dmg; blocked down to ${oppDmgDealt} dmg.`;
      break;
    }
    case 'dodge': {
      nextPlayer.stance = 'evasive';
      nextPlayer.stamina = Math.max(0, nextPlayer.stamina - 8);
      playerDmgDealt = Math.round(9 * rollFactor);
      oppDmgDealt = rollFactor >= 1.0 ? 0 : Math.round(4 * rollFactor);
      comboStreak += 1;
      logLine =
        oppDmgDealt === 0
          ? `Round ${state.round}: ${nextPlayer.name} cleanly evaded and grazed ${nextOpp.name} for ${playerDmgDealt} dmg!`
          : `Round ${state.round}: ${nextPlayer.name} rolled aside, countering for ${playerDmgDealt} dmg (grazed for ${oppDmgDealt}).`;
      break;
    }
    case 'recover': {
      nextPlayer.stance = 'balanced';
      const healAmount = Math.round(22 * rollFactor);
      nextPlayer.hp = Math.min(nextPlayer.maxHp, nextPlayer.hp + healAmount);
      nextPlayer.stamina = Math.min(nextPlayer.maxStamina, nextPlayer.stamina + 25);
      oppDmgDealt = Math.max(4, Math.round((nextOpp.atk - nextPlayer.def * 0.7) * rollFactor));
      comboStreak = 0;
      logLine = `Round ${state.round}: ${nextPlayer.name} caught breath (+${healAmount} HP, +25 STA) while weathering ${oppDmgDealt} dmg.`;
      break;
    }
    case 'combo': {
      nextPlayer.stance = 'aggressive';
      nextPlayer.stamina = Math.max(0, nextPlayer.stamina - 16);
      comboStreak += 2;
      playerDmgDealt = Math.round((nextPlayer.atk * 1.35 + comboStreak * 2 - nextOpp.def * 0.4) * rollFactor);
      oppDmgDealt = Math.max(4, Math.round((nextOpp.atk - nextPlayer.def * 0.6) * rollFactor));
      logLine = `Round ${state.round}: ${nextPlayer.name} unleashed a ${comboStreak}x Combo for ${playerDmgDealt} dmg! ${nextOpp.name} struck back for ${oppDmgDealt}.`;
      break;
    }
    case 'special': {
      nextPlayer.stance = 'berserk';
      nextPlayer.stamina = Math.max(0, nextPlayer.stamina - 24);
      comboStreak += 1;
      playerDmgDealt = Math.round((nextPlayer.atk * 1.7 - nextOpp.def * 0.3) * rollFactor);
      oppDmgDealt = Math.max(5, Math.round((nextOpp.atk * 1.05 - nextPlayer.def * 0.5) * rollFactor));
      logLine = `Round ${state.round}: ${nextPlayer.name} fired a Signature Technique for ${playerDmgDealt} dmg! Counter hit for ${oppDmgDealt}.`;
      break;
    }
    case 'strike':
    case 'custom':
    default: {
      nextPlayer.stance = 'aggressive';
      nextPlayer.stamina = Math.max(0, nextPlayer.stamina - 10);
      comboStreak += 1;
      playerDmgDealt = Math.max(6, Math.round((nextPlayer.atk * 1.15 - nextOpp.def * 0.5) * rollFactor));
      oppDmgDealt = Math.max(4, Math.round((nextOpp.atk - nextPlayer.def * 0.65) * rollFactor));
      logLine = `Round ${state.round}: ${nextPlayer.name} landed a clean strike for ${playerDmgDealt} dmg; ${nextOpp.name} retaliated for ${oppDmgDealt}.`;
      break;
    }
  }

  nextOpp.hp = Math.max(0, nextOpp.hp - playerDmgDealt);
  nextOpp.stamina = Math.max(10, nextOpp.stamina - 8);
  nextPlayer.hp = Math.max(0, nextPlayer.hp - oppDmgDealt);

  let outcome: BrawlCombatState['outcome'] = 'ongoing';
  let active = true;

  if (nextOpp.hp <= 0) {
    outcome = 'victory';
    active = false;
    logLine += ` 🏆 ${nextOpp.name} is defeated — Battle Over!`;
  } else if (nextPlayer.hp <= 0) {
    outcome = 'defeat';
    active = false;
    logLine += ` 💀 ${nextPlayer.name} collapsed — Battle Over!`;
  }

  return {
    ...state,
    active,
    round,
    player: nextPlayer,
    opponent: nextOpp,
    comboStreak,
    outcome,
    log: [...state.log, logLine].slice(-12),
  };
}

export function buildBrawlSystemPrompt(state: BrawlCombatState): string {
  if (!state.active) return '';
  return `[BRAWLCHAT.AI TEXT-FIGHTING MODE ACTIVE — ROUND ${state.round}]
Current Combat Telemetry:
- Challenger (${state.player.name}): HP ${state.player.hp}/${state.player.maxHp} | Stamina ${state.player.stamina}/${state.player.maxStamina} | Stance: ${state.player.stance}
- Opponent (${state.opponent.name}): HP ${state.opponent.hp}/${state.opponent.maxHp} | Stamina ${state.opponent.stamina}/${state.opponent.maxStamina} | Stance: ${state.opponent.stance}
- Combo Streak: ${state.comboStreak}

TEXT FIGHTING DIRECTIVES:
1. Respond with visceral, kinetic turn-by-turn text-fighting choreography: footwork, parries, impacts, stamina exertion, environmental interaction, and sharp combat banter.
2. React directly to ${state.player.name}'s latest tactical move, showing realistic momentum and counterattacks.
3. Keep the fight tense and fair—do NOT declare the fight over unless ${state.opponent.hp <= 15 ? 'taking a finishing blow' : 'HP reaches 0 or one side yields'}.
4. At the end of your reply, narrate your counter-stance cleanly in character.`;
}
