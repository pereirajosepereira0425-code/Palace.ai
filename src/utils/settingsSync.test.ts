import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChubChatSettings } from '../types/index';
import {
  extractPresetsFromSettings,
  generateFreePalaceApiKey,
  hydrateChatSettingsOnSessionLoad,
  isPalaceFreeApiKey,
  mergeSettingsFromPresets,
  resolveEffectiveChatApiConfig,
} from './settingsSync';
import { DEFAULT_CHUB_SETTINGS } from '../components/ChubSettingsModal';
import { DEFAULT_PRESETS } from '../components/PresetsModal';
import { isBuiltInFreeProvider } from './chubOptions';

test('generateFreePalaceApiKey issues pk-palace-free tokens recognized by isPalaceFreeApiKey', () => {
  const key = generateFreePalaceApiKey();
  assert.ok(key.startsWith('pk-palace-free-'));
  assert.equal(isPalaceFreeApiKey(key), true);
  assert.equal(isPalaceFreeApiKey(''), true);
  assert.equal(isPalaceFreeApiKey('sk-paid-live-key'), false);
});

test('mergeSettingsFromPresets & extractPresetsFromSettings keep ChubSettings and Presets synced', () => {
  const merged = mergeSettingsFromPresets(DEFAULT_CHUB_SETTINGS, {
    ...DEFAULT_PRESETS,
    apiProvider: 'palace_free',
    customModel: 'claude-opus-5-5',
    temperature: 1.1,
    maxContextTokens: 16384,
    voiceName: 'Zephyr',
  });
  assert.equal(merged.apiProvider, 'palace_free');
  assert.equal(merged.model, 'claude-opus-5-5');
  assert.equal(merged.temperature, 1.1);
  assert.equal(merged.contextSize, 16384);
  assert.equal(merged.defaultVoice, 'Zephyr');

  const roundTrip = extractPresetsFromSettings(
    DEFAULT_PRESETS,
    { ...merged, model: 'asha', banEmojis: true, promptNote: 'Stay vivid' },
    'pk-palace-free-test'
  );
  assert.equal(roundTrip.customModel, 'asha');
  assert.equal(roundTrip.chubApiKey, 'pk-palace-free-test');
  assert.equal(roundTrip.temperature, 1.1);
});

test('hydrateChatSettingsOnSessionLoad preserves DB session overrides and local presets without wiping', () => {
  const hydrated = hydrateChatSettingsOnSessionLoad({
    defaults: DEFAULT_CHUB_SETTINGS,
    localSettings: { banEmojis: true, useAvatarAsBackground: true } as Partial<ChubChatSettings>,
    localPresets: { ...DEFAULT_PRESETS, apiProvider: 'palace_free', customModel: 'claude-opus-5-5' },
    sessionChatSettings: JSON.stringify({ model: 'asha', promptNote: 'No mercy' }),
  });

  assert.equal(hydrated.apiProvider, 'palace_free');
  assert.equal(hydrated.banEmojis, true);
  assert.equal(hydrated.useAvatarAsBackground, true);
  assert.equal(hydrated.model, 'asha');
  assert.equal(hydrated.promptNote, 'No mercy');
});

test('resolveEffectiveChatApiConfig passes explicit model/key cleanly while stripping URL for built-in free', () => {
  const resolved = resolveEffectiveChatApiConfig({
    defaults: DEFAULT_CHUB_SETTINGS,
    liveSettings: { ...DEFAULT_CHUB_SETTINGS, apiProvider: 'palace_free', model: 'claude-opus-5-5', temperature: 1.05 },
    localPresets: { ...DEFAULT_PRESETS, chubApiKey: 'pk-palace-free-abc', chubApiUrl: 'http://localhost:3000/v1' },
    isBuiltInFreeFn: isBuiltInFreeProvider,
  });

  assert.equal(resolved.mergedSettings.model, 'claude-opus-5-5');
  assert.equal(resolved.mergedSettings.temperature, 1.05);
  assert.equal(resolved.chubApiKey, 'pk-palace-free-abc');
  assert.equal(resolved.chubApiUrl, undefined);
});
