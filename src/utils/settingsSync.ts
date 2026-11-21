import type { ChubChatSettings } from '../types/index.ts';

export const PRESETS_STORAGE_KEY = 'palace_generation_presets';
export const CHUB_SETTINGS_STORAGE_KEY = 'palace_chub_chat_settings';
export const PRESETS_UPDATED_EVENT = 'palace-presets-updated';

export interface SyncablePresets {
  apiProvider: string;
  chubApiUrl: string;
  chubApiKey: string;
  customModel: string;
  promptStructure: string;
  ttsApi: string;
  temperature: number;
  topP: number;
  maxContextTokens: number;
  highThinking: boolean;
  searchGrounding: boolean;
  voiceName: string;
  customVoiceUuid?: string;
  ttsEndpointUrl?: string;
  ttsApiKey?: string;
  updatedAt?: number;
}

/**
 * Generates a free unlimited Palace API key accepted seamlessly by Palace's Chub-compatible /v1 gateway.
 */
export function generateFreePalaceApiKey(): string {
  const rand =
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 10);
  return `pk-palace-free-${rand}`;
}

export function isPalaceFreeApiKey(key?: string | null): boolean {
  const trimmed = (key || '').trim().toLowerCase();
  return !trimmed || trimmed.startsWith('pk-palace-free-') || trimmed === 'free';
}

/**
 * Merges newly saved PresetsModal fields cleanly into ChubChatSettings so user changes
 * (provider, model, temperature, topP, contextSize, voice, TTS, stagingUrl) always take effect.
 */
export function mergeSettingsFromPresets(
  existingSettings: ChubChatSettings,
  presets: Partial<SyncablePresets>
): ChubChatSettings {
  return {
    ...existingSettings,
    ...(presets.apiProvider ? { apiProvider: presets.apiProvider } : {}),
    ...(presets.customModel
      ? { model: presets.customModel, defaultModel: presets.customModel }
      : {}),
    ...(presets.promptStructure ? { promptStructure: presets.promptStructure } : {}),
    ...(presets.ttsApi ? { ttsApi: presets.ttsApi } : {}),
    ...(presets.voiceName ? { defaultVoice: presets.voiceName } : {}),
    ...(presets.customVoiceUuid !== undefined ? { customVoiceUuid: presets.customVoiceUuid || '' } : {}),
    ...(presets.ttsEndpointUrl !== undefined ? { ttsEndpointUrl: presets.ttsEndpointUrl || '' } : {}),
    ...(presets.ttsApiKey !== undefined ? { ttsApiKey: presets.ttsApiKey || '' } : {}),
    ...(typeof presets.maxContextTokens === 'number' && presets.maxContextTokens > 0
      ? { contextSize: presets.maxContextTokens }
      : {}),
    ...(presets.chubApiUrl !== undefined ? { stagingUrl: presets.chubApiUrl } : {}),
    ...(typeof presets.temperature === 'number' ? { temperature: presets.temperature } : {}),
    ...(typeof presets.topP === 'number' ? { topP: presets.topP } : {}),
    ...(typeof presets.updatedAt === 'number' ? { updatedAt: presets.updatedAt } : {}),
  };
}

/**
 * Extracts global preset updates when the user saves inside ChubSettingsModal so both modals stay 100% in sync.
 */
export function extractPresetsFromSettings(
  existingPresets: SyncablePresets,
  settings: ChubChatSettings,
  apiKeyInput?: string
): SyncablePresets {
  return {
    ...existingPresets,
    apiProvider: settings.apiProvider || existingPresets.apiProvider,
    chubApiUrl:
      settings.stagingUrl !== undefined ? settings.stagingUrl : existingPresets.chubApiUrl,
    chubApiKey: apiKeyInput !== undefined ? apiKeyInput : existingPresets.chubApiKey,
    customModel: settings.model || existingPresets.customModel,
    promptStructure: settings.promptStructure || existingPresets.promptStructure,
    ttsApi: settings.ttsApi || existingPresets.ttsApi,
    maxContextTokens: settings.contextSize || existingPresets.maxContextTokens,
    voiceName: settings.defaultVoice || existingPresets.voiceName,
    customVoiceUuid:
      settings.customVoiceUuid !== undefined
        ? settings.customVoiceUuid || ''
        : existingPresets.customVoiceUuid,
    ttsEndpointUrl:
      settings.ttsEndpointUrl !== undefined
        ? settings.ttsEndpointUrl
        : existingPresets.ttsEndpointUrl,
    ttsApiKey:
      settings.ttsApiKey !== undefined ? settings.ttsApiKey : existingPresets.ttsApiKey,
    temperature:
      typeof settings.temperature === 'number'
        ? settings.temperature
        : existingPresets.temperature,
    topP: typeof settings.topP === 'number' ? settings.topP : existingPresets.topP,
    updatedAt: typeof settings.updatedAt === 'number' ? settings.updatedAt : Date.now(),
  };
}

/**
 * Hydrates ChatRoom's ChubChatSettings cleanly from:
 * 1. defaults
 * 2. global saved presets / localStorage settings
 * 3. DB session chatSettings (per-session saved overrides like promptNote, custom model, checkboxes)
 * When global presets were explicitly saved MORE RECENTLY than the DB session's timestamp,
 * global model/provider/generation choices apply cleanly without wiping session promptNote/roster/brawl state.
 */
export function hydrateChatSettingsOnSessionLoad(params: {
  defaults: ChubChatSettings;
  localSettings?: Partial<ChubChatSettings> | null;
  localPresets?: Partial<SyncablePresets> | null;
  sessionChatSettings?: Partial<ChubChatSettings> | string | null;
}): ChubChatSettings {
  let parsedSession: Partial<ChubChatSettings> = {};
  if (typeof params.sessionChatSettings === 'string') {
    try {
      const obj = JSON.parse(params.sessionChatSettings || '{}');
      if (obj && typeof obj === 'object') parsedSession = obj;
    } catch {
      parsedSession = {};
    }
  } else if (params.sessionChatSettings && typeof params.sessionChatSettings === 'object') {
    parsedSession = params.sessionChatSettings;
  }

  const withLocal: ChubChatSettings = {
    ...params.defaults,
    ...(params.localSettings || {}),
  };

  const withPresets = params.localPresets
    ? mergeSettingsFromPresets(withLocal, params.localPresets)
    : withLocal;

  // Apply explicit session-level overrides stored in PostgreSQL on top (ignoring undefined keys)
  const cleanSessionOverrides: Record<string, any> = {};
  for (const [k, v] of Object.entries(parsedSession)) {
    if (v !== undefined) {
      cleanSessionOverrides[k] = v;
    }
  }

  const presetsTs = typeof params.localPresets?.updatedAt === 'number' ? params.localPresets.updatedAt : 0;
  const sessionTs = typeof parsedSession.updatedAt === 'number' ? parsedSession.updatedAt : 0;
  const presetsAreNewerThanSession = presetsTs > 0 && presetsTs > sessionTs;

  const baseMerged: ChubChatSettings = {
    ...withPresets,
    ...cleanSessionOverrides,
  };

  if (presetsAreNewerThanSession && params.localPresets) {
    return mergeSettingsFromPresets(baseMerged, params.localPresets);
  }

  return baseMerged;
}

/**
 * Resolves the effective API payload for ChatRoom message/swipe requests without letting
 * DEFAULT_CHUB_SETTINGS block updated Presets choices.
 */
export function resolveEffectiveChatApiConfig(params: {
  defaults: ChubChatSettings;
  liveSettings: ChubChatSettings;
  localSettings?: Partial<ChubChatSettings> | null;
  localPresets?: Partial<SyncablePresets> | null;
  isBuiltInFreeFn: (providerId?: string | null) => boolean;
}): {
  chubApiKey: string | undefined;
  chubApiUrl: string | undefined;
  mergedSettings: ChubChatSettings;
} {
  const presets = params.localPresets || {};
  const mergedSettings: ChubChatSettings = {
    ...params.defaults,
    ...(params.localSettings || {}),
    ...params.liveSettings,
  };

  if (!mergedSettings.contextSize && presets.maxContextTokens) {
    mergedSettings.contextSize = presets.maxContextTokens;
  }
  if (typeof mergedSettings.temperature !== 'number' && typeof presets.temperature === 'number') {
    mergedSettings.temperature = presets.temperature;
  }
  if (typeof mergedSettings.topP !== 'number' && typeof presets.topP === 'number') {
    mergedSettings.topP = presets.topP;
  }

  const chubApiKey = (presets.chubApiKey || '').trim() || undefined;
  const activeProvider = mergedSettings.apiProvider || presets.apiProvider;
  const chubApiUrl =
    !params.isBuiltInFreeFn(activeProvider)
      ? (mergedSettings.stagingUrl || presets.chubApiUrl || '').trim() || undefined
      : undefined;

  return { chubApiKey, chubApiUrl, mergedSettings };
}
