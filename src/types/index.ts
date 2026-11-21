export type ContentRating = 'SFW' | 'NSFW' | 'NSFL' | 'NSFW + NSFL';

export interface Character {
  id: number;
  uuid: string;
  name: string;
  tagline: string;
  avatar: string;
  backgroundImage?: string | null;
  description: string;
  personality?: string | null;
  greeting: string;
  alternateGreetings?: string | null; // JSON string or array of greetings
  systemPrompt: string;
  postHistoryInstructions?: string | null;
  creatorNotes?: string | null;
  characterVersion?: string | null;
  scenario?: string | null;
  exampleDialogues?: string | null;
  tags: string; // JSON string or array
  rating: ContentRating;
  creatorId: string;
  creatorName: string;
  chatCount: number;
  likeCount: number;
  voiceName: string;
  voiceStyle?: string | null;
  customVoiceUuid?: string | null;
  thinkingDefault: boolean;
  searchDefault: boolean;
  lorebook?: string | null;
  gender?: string | null;
  pronouns?: string | null;
  model3dUrl?: string | null;
  model3dPose?: string | null;
  createdAt?: string;
}

export interface SharedPersona {
  id: number;
  uuid: string;
  userId: string;
  creatorName: string;
  name: string;
  displayName?: string | null;
  avatar: string;
  backgroundImage?: string | null;
  bio: string;
  gender?: string | null;
  pronouns: string;
  description?: string | null;
  personality?: string | null;
  greeting?: string | null;
  alternateGreetings?: string | null;
  systemPrompt?: string | null;
  postHistoryInstructions?: string | null;
  scenario?: string | null;
  exampleDialogues?: string | null;
  creatorNotes?: string | null;
  lorebook?: string | null;
  model3dUrl?: string | null;
  model3dPose?: string | null;
  isPublic: boolean;
  likeCount: number;
  useCount: number;
  tags?: string;
  createdAt?: string;
}

export interface UserProfile {
  id?: number;
  uid: string;
  email: string;
  username: string; // @handle
  displayName: string;
  avatarUrl: string;
  bannerUrl?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  gender?: string | null;
  theme?: string | null;
  customCss?: string | null;
  statusMessage?: string | null;
  badges?: string[];
  socialLinks?: {
    discord?: string;
    twitter?: string;
    github?: string;
    website?: string;
    patreon?: string;
  };
  pinnedCharacterUuid?: string | null;
  featuredQuote?: string | null;
  personaName?: string | null;
  personaBio?: string | null;
  createdAt?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  parentId?: number | null;
  sender: 'user' | 'character' | 'system';
  content: string;
  thinkingProcess?: string | null;
  groundingSources?: GroundingSource[];
  swipes?: string[];
  activeSwipeIndex?: number;
  imageUrl?: string | null;
  poseName?: string | null;
  speakerCharacterUuid?: string | null;
  speakerName?: string | null;
  speakerAvatar?: string | null;
  modelUsed?: string | null;
  createdAt?: string;
}

export interface TagRecord {
  id: number;
  name: string;
  slug: string;
  usageCount: number;
  createdBy: string;
  createdAt?: string;
}

export interface GroupParticipant {
  uuid: string;
  name: string;
  avatar: string;
  tagline: string;
  description?: string;
  personality?: string | null;
  systemPrompt?: string;
  scenario?: string | null;
  lorebook?: string | null;
  muted?: boolean;
  isHost?: boolean;
}

export interface EnsembleModelSlot {
  id: string;
  label?: string;
  role?: 'drafter' | 'critic' | 'lorekeeper' | 'dialogue' | 'synthesizer';
  apiProvider?: string;
  apiUrl?: string;
  apiKey?: string;
}

export interface ModelEnsembleConfig {
  enabled: boolean;
  mode: 'single' | 'council' | 'critique_polish' | 'specialist_split';
  models: EnsembleModelSlot[];
  synthesizerModelId: string;
}

export type BrawlTriggerMode = 'auto' | 'manual' | 'off';

export interface BrawlFighterState {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  stance: 'balanced' | 'aggressive' | 'guarding' | 'evasive' | 'berserk';
  statuses: string[];
  atk: number;
  def: number;
}

export interface BrawlCombatState {
  active: boolean;
  triggerMode: BrawlTriggerMode;
  round: number;
  player: BrawlFighterState;
  opponent: BrawlFighterState;
  comboStreak: number;
  log: string[];
  outcome: 'ongoing' | 'victory' | 'defeat' | 'truce' | 'fled' | null;
  startedBy: 'auto' | 'manual' | null;
}

export interface ChubChatSettings {
  promptStructure: string;
  apiProvider: string;
  model: string;
  includeNames: boolean;
  banEmojis: boolean;
  textStreaming: boolean;
  legacyStreaming: boolean;
  v2Spec: boolean;
  useLorebooks: boolean;
  useAutoSummarization: boolean;
  promptNote: string;
  promptNoteDepth: number;
  preset: 'default' | 'storyteller' | 'strict_rp' | 'chaotic' | 'speed';
  temperature?: number;
  repetitionPenalty: number;
  frequencyPenalty: number;
  presencePenalty: number;
  topP: number;
  topK: number;
  minLength: number;
  trimIncompleteSentences: boolean;
  stoppingStrings: string;
  maxNewTokens: number;
  contextSize: number;
  lorebookScanDepth: number;
  lorebookTokenBudget: number;
  matchWholeWords: boolean;
  lorebookRecursiveScanning: boolean;
  ttsApi: string;
  ttsEndpointUrl?: string;
  ttsApiKey?: string;
  customVoiceUuid?: string | null;
  defaultModel: string;
  defaultVoice: string;
  autoGeneration: boolean;
  restrictNarration: boolean;
  stagingUrl?: string;
  characterViewStyle?: 'chub' | 'janitor';
  useAvatarAsBackground?: boolean;
  avatarBackgroundFit?: 'contain' | 'cover';
  groupChatSettings?: {
    joinOrder: 'round_robin' | 'natural_turn' | 'manual';
    silenceThreshold: number;
  };
  groupParticipants?: GroupParticipant[];
  responderMode?: 'auto' | 'specific' | 'round_robin' | 'all';
  selectedResponderUuid?: string | null;
  ensembleConfig?: ModelEnsembleConfig;
  brawlState?: BrawlCombatState;
  updatedAt?: number;
}

export interface ChatSession {
  id: number;
  uuid: string;
  userId: string;
  characterId: number;
  title: string;
  userPersona?: string | null;
  modelPreference: string;
  thinkingLevel: 'HIGH' | 'OFF';
  searchGrounding: boolean;
  summary?: string | null;
  unsavedMessageCount?: number;
  chatSettings?: string | ChubChatSettings | null;
  showAiImages?: boolean;
  chubApiKey?: string | null;
  chubApiUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  character?: Character;
}

export interface LorebookEntryItem {
  id: string;
  keys: string;
  secondaryKeys?: string;
  content: string;
  insertionOrder: number;
  enabled: boolean;
  constant: boolean;
  caseSensitive: boolean;
}

export interface SharedStageRecord {
  id: number;
  uuid: string;
  userId: string;
  creatorName: string;
  name: string;
  category: string;
  imageUrl: string;
  description: string;
  blurLevel: number;
  overlayOpacity: number;
  tags?: string;
  isPublic: boolean;
  likeCount: number;
  useCount: number;
  createdAt?: string;
}

export interface SharedLorebookRecord {
  id: number;
  uuid: string;
  userId: string;
  creatorName: string;
  name: string;
  description: string;
  scanDepth: number;
  entries: string | LorebookEntryItem[];
  tags?: string;
  isPublic: boolean;
  likeCount: number;
  useCount: number;
  createdAt?: string;
}

export interface FollowUserSummary {
  uid: string;
  username?: string | null;
  displayName: string;
  avatarUrl: string;
  bio?: string | null;
  followedAt?: string | null;
}

export interface UserFollowSummary {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  followers: FollowUserSummary[];
  following: FollowUserSummary[];
}

export interface CustomVoiceRecord {
  id: number;
  uuid: string;
  userId: string;
  creatorName: string;
  name: string;
  description: string;
  engine: string;
  referenceAudioData: string;
  referenceAudioMime: string;
  referenceDurationSec: number;
  transcript: string;
  pitchShift: number;
  speakingRate: number;
  baseVoiceName: string;
  isPublic: boolean;
  useCount: number;
  createdAt?: string;
}

