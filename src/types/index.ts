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

