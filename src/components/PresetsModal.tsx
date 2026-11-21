import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Key,
  Globe,
  BrainCircuit,
  Volume2,
  Check,
  RefreshCw,
  Sparkles,
  Shield,
  HelpCircle,
  ExternalLink,
  AudioWaveform,
  MonitorSmartphone,
} from 'lucide-react';
import type { CustomVoiceRecord } from '../types/index.ts';

import {
  CHUB_API_PROVIDERS,
  CHUB_ACTIVE_MODELS,
  CHUB_PROMPT_STRUCTURES,
  CHUB_TTS_APIS,
  isBuiltInFreeProvider,
} from '../utils/chubOptions.ts';
import {
  CHUB_CREATE_TOKEN_URL,
  getProviderApiKeyInfo,
} from '../utils/promptBudget.ts';
import {
  type ApiConnectionTestResult,
  fetchEndpointModels,
  fetchFreePalaceApiKey,
  getSameOriginV1Url,
  isChubUrlOrProvider,
  runSmartConnectionTest,
} from '../utils/apiErrorUtils.ts';
import {
  CHUB_SETTINGS_STORAGE_KEY,
  PRESETS_UPDATED_EVENT,
  isPalaceFreeApiKey,
  mergeSettingsFromPresets,
} from '../utils/settingsSync.ts';
import {
  loadSavedViewportWidth,
  parseCustomViewportWidth,
  saveViewportWidth,
} from '../utils/viewportWidth.ts';

export interface GenerationPresets {
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
}

export const DEFAULT_PRESETS: GenerationPresets = {
  apiProvider: 'gemini',
  chubApiUrl: 'https://mars.chub.ai/v1',
  chubApiKey: '',
  customModel: 'gemini-3.8-flash',
  promptStructure: 'tavern_v2',
  ttsApi: 'gemini_flash_tts',
  temperature: 0.85,
  topP: 0.95,
  maxContextTokens: 8192,
  highThinking: false,
  searchGrounding: false,
  voiceName: 'Puck',
};

interface PresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: GenerationPresets;
  onSavePresets: (newPresets: GenerationPresets) => void;
}

export const PresetsModal: React.FC<PresetsModalProps> = ({
  isOpen,
  onClose,
  presets,
  onSavePresets,
}) => {
  const [formData, setFormData] = useState<GenerationPresets>(presets);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchingFreeKey, setFetchingFreeKey] = useState(false);
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<ApiConnectionTestResult | null>(null);
  const [customVoices, setCustomVoices] = useState<CustomVoiceRecord[]>([]);
  const [customWidthInput, setCustomWidthInput] = useState<string>(() => {
    const saved = loadSavedViewportWidth();
    return saved ? String(saved) : '';
  });
  const [activeViewportWidth, setActiveViewportWidth] = useState<number | null>(() =>
    loadSavedViewportWidth()
  );

  useEffect(() => {
    setFormData(presets);
    setTestResult(null);
    setLiveModels([]);
    if (isOpen) {
      const savedW = loadSavedViewportWidth();
      setActiveViewportWidth(savedW);
      setCustomWidthInput(savedW ? String(savedW) : '');
      fetch('/api/voices')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data?.voices)) setCustomVoices(data.voices);
        })
        .catch(() => {});
    }
  }, [presets, isOpen]);

  if (!isOpen) return null;

  const handleProviderSelect = (providerId: string) => {
    const prov = CHUB_API_PROVIDERS.find((p) => p.id === providerId);
    const hasExplicitFreeKey =
      Boolean(formData.chubApiKey?.trim()) && isPalaceFreeApiKey(formData.chubApiKey);
    const nextUrl = isBuiltInFreeProvider(providerId)
      ? ''
      : hasExplicitFreeKey
        ? getSameOriginV1Url()
        : prov?.defaultUrl !== undefined
          ? prov.defaultUrl
          : formData.chubApiUrl;
    setFormData({
      ...formData,
      apiProvider: providerId,
      chubApiUrl: nextUrl,
      customModel: prov?.defaultModel || formData.customModel,
    });
    setTestResult(null);
    setLiveModels([]);
  };

  const handleFetchFreeKey = async () => {
    setFetchingFreeKey(true);
    setTestResult(null);
    try {
      const res = await fetchFreePalaceApiKey();
      if (res.models.length > 0) {
        setLiveModels(res.models);
      }
      setFormData((prev) => ({
        ...prev,
        chubApiKey: res.key,
        chubApiUrl: isBuiltInFreeProvider(prev.apiProvider) ? prev.chubApiUrl : res.endpoint,
        customModel: prev.customModel || res.models[0] || 'claude-opus-5-5',
      }));
      setTestResult({
        ok: true,
        status: 200,
        code: 'FREE_KEY_FETCHED',
        endpoint: res.endpoint,
        testedFrom: 'server',
        resolvedModel: formData.customModel || res.models[0] || 'claude-opus-5-5',
        availableModels: res.models,
        message: `${res.message} Key: ${res.key.slice(0, 22)}...`,
        hint: 'Zero credit limits, zero daily quotas — works with Claude Opus 5.5, Chub Mars, Soji, Asha, DeepSeek & Gemini!',
      });
    } finally {
      setFetchingFreeKey(false);
    }
  };

  const handleApplyViewportWidth = (override?: string | number | null) => {
    const parsed =
      override === null
        ? null
        : parseCustomViewportWidth(override !== undefined ? override : customWidthInput);
    const saved = saveViewportWidth(parsed);
    setActiveViewportWidth(saved);
    setCustomWidthInput(saved ? String(saved) : '');
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setTestResult(null);
    try {
      const res = await fetchEndpointModels({
        apiUrl: formData.chubApiUrl,
        apiKey: formData.chubApiKey,
        apiProvider: formData.apiProvider,
      });
      if (res.models.length > 0) {
        setLiveModels(res.models);
        const firstModel = res.models[0];
        setFormData((prev) => ({
          ...prev,
          customModel: res.models.includes(prev.customModel) ? prev.customModel : firstModel,
        }));
        setTestResult({
          ok: true,
          status: res.status || 200,
          code: 'MODELS_LOADED',
          endpoint: res.modelsUrl,
          testedFrom: 'browser',
          availableModels: res.models,
          message: `Found ${res.models.length} live model(s) on ${res.modelsUrl}!`,
        });
      } else {
        setTestResult(
          res.error || {
            ok: false,
            status: res.status || 404,
            code: 'NO_MODELS',
            endpoint: res.modelsUrl,
            testedFrom: 'browser',
            message: `No models listed at ${res.modelsUrl}.`,
            hint: 'Click "🔑 Fetch Free API Key" or pick one of the Chub / Palace Free gateways below.',
          }
        );
      }
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setTestResult(null);
    try {
      const result = await runSmartConnectionTest({
        apiProvider: formData.apiProvider,
        apiUrl: formData.chubApiUrl,
        apiKey: formData.chubApiKey,
        model: formData.customModel,
      });
      if (result.availableModels?.length) {
        setLiveModels(result.availableModels);
      }
      if (result.ok) {
        const cleanBase = result.endpoint.replace(/\/chat\/completions\/?$/i, '');
        setFormData((prev) => ({
          ...prev,
          ...(cleanBase && !isBuiltInFreeProvider(prev.apiProvider)
            ? { chubApiUrl: cleanBase }
            : {}),
          ...(result.resolvedModel ? { customModel: result.resolvedModel } : {}),
        }));
      }
      setTestResult(result);
    } finally {
      setTestingConn(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const stampedPresets: GenerationPresets & { updatedAt: number } = {
      ...formData,
      updatedAt: Date.now(),
    };
    onSavePresets(stampedPresets);
    // Sync key Chub settings into localStorage & broadcast live update to open ChatRoom
    try {
      const existingRaw = localStorage.getItem(CHUB_SETTINGS_STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const merged = mergeSettingsFromPresets(existing, stampedPresets);
      localStorage.setItem(CHUB_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent(PRESETS_UPDATED_EVENT, { detail: stampedPresets }));
    } catch {
      // ignore storage error
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 650);
  };

  const handleReset = () => {
    setFormData(DEFAULT_PRESETS);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-purple-500/40 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Generation &amp; API Presets</span>
                <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                  /my_presets
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Configure Chub.ai Mars/Mercury API, Gemini engine, context budget, and voice.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"
            aria-label="Close Presets"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {savedSuccess && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span>Presets saved and applied successfully!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 text-xs">
          {/* Always-visible Chub.ai & Palace Free API Key Quick Access (unclipped wrapping) */}
          <div className="flex flex-col gap-3 rounded-2xl border border-fuchsia-500/35 bg-gradient-to-r from-purple-950/50 via-zinc-900/80 to-fuchsia-950/40 p-3.5">
            <div className="space-y-0.5">
              <div className="font-bold text-purple-200 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-amber-300" />
                  <span>Chub.ai Tokens, Palace Free API Keys &amp; Models</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-950/45 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200">
                  <span>∞ No Credit Limits · Free</span>
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Fetch an instant Unlimited Palace Free API Key for <span className="font-mono text-emerald-300">Claude Opus 5.5</span> / Chub / Gemini, or create external tokens.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleFetchFreeKey}
                disabled={fetchingFreeKey}
                data-testid="presets-fetch-free-key-btn"
                className="rounded-xl border border-emerald-400/60 bg-gradient-to-r from-emerald-600/35 to-teal-600/35 px-3 py-2 text-[11px] font-bold text-emerald-100 hover:from-emerald-600/55 hover:to-teal-600/55 transition-all cursor-pointer disabled:opacity-50"
              >
                {fetchingFreeKey ? '⏳ Fetching Key...' : '🔑 Fetch Free API Key'}
              </button>
              <button
                type="button"
                onClick={handleFetchModels}
                disabled={fetchingModels || testingConn}
                data-testid="presets-fetch-free-models-btn"
                className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-600/25 px-3 py-2 text-[11px] font-bold text-fuchsia-100 hover:bg-fuchsia-600/40 transition-all cursor-pointer disabled:opacity-50"
              >
                {fetchingModels ? 'Fetching Models...' : '✨ Fetch Free Models'}
              </button>
              {!isBuiltInFreeProvider(formData.apiProvider) ? (
                <button
                  type="button"
                  onClick={() => handleProviderSelect('palace_free')}
                  data-testid="presets-use-free-api-btn"
                  className="rounded-xl border border-emerald-500/50 bg-emerald-600/25 px-3 py-2 text-[11px] font-bold text-emerald-200 hover:bg-emerald-600/40 transition-all cursor-pointer"
                >
                  🎁 Use Free API (No Key)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleProviderSelect('chub_mars')}
                  className="rounded-xl border border-purple-500/40 bg-purple-900/40 px-3 py-2 text-[11px] font-bold text-purple-200 hover:bg-purple-800/50 transition-all cursor-pointer"
                >
                  Use Custom Key
                </button>
              )}
              <a
                href={CHUB_CREATE_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-2 text-[11px] font-bold text-white shadow-md hover:from-purple-500 hover:to-fuchsia-500 transition-all"
              >
                <span>Optional Chub.ai Token</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            {formData.chubApiKey && (
              <div
                data-testid="presets-active-key-preview"
                className="rounded-xl border border-emerald-500/30 bg-zinc-950/80 px-3 py-1.5 text-[11px] font-mono text-emerald-300 flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  Active Key: {formData.chubApiKey.slice(0, 26)}
                  {formData.chubApiKey.length > 26 ? '…' : ''}
                </span>
                <span className="text-[10px] text-emerald-400 font-sans font-bold shrink-0">✓ Saved</span>
              </div>
            )}
          </div>

          {/* API Provider Selector (Full Chub.ai List) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
              API Provider ({CHUB_API_PROVIDERS.length} Chub.ai &amp; External Providers)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
              {CHUB_API_PROVIDERS.map((prov) => {
                const isSelected = formData.apiProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id)}
                    className={`rounded-2xl border p-2.5 text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-600/20 text-white ring-1 ring-purple-500'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-bold text-xs truncate">{prov.label}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5 truncate">{prov.badge}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Model + Prompt Structure + TTS API */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div className="space-y-1.5">
              <label className="block font-bold text-purple-300">
                Active Model ({CHUB_ACTIVE_MODELS.length}+ Models)
              </label>
              <select
                value={
                  CHUB_ACTIVE_MODELS.some((m) => m.id === formData.customModel)
                    ? formData.customModel
                    : '__custom__'
                }
                onChange={(e) => {
                  if (e.target.value !== '__custom__') {
                    setFormData({ ...formData, customModel: e.target.value });
                  }
                }}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
              >
                {Array.from(new Set(CHUB_ACTIVE_MODELS.map((m) => m.provider || 'Other'))).map(
                  (group) => (
                    <optgroup key={group} label={group}>
                      {CHUB_ACTIVE_MODELS.filter((m) => (m.provider || 'Other') === group).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
                <option value="__custom__">Custom Model ID</option>
              </select>
              <input
                type="text"
                value={formData.customModel}
                onChange={(e) => setFormData({ ...formData, customModel: e.target.value })}
                placeholder="e.g. soji, asha, chub-mars, gemini-3.8-flash"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-purple-500 focus:outline-none"
              />
              {liveModels.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1" data-testid="live-models-list">
                  <span className="text-[10px] text-emerald-300 font-semibold mr-1">Live Models:</span>
                  {liveModels.slice(0, 10).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormData({ ...formData, customModel: m })}
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-mono cursor-pointer transition-colors ${
                        formData.customModel === m
                          ? 'border-emerald-400 bg-emerald-600/30 text-emerald-100'
                          : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-emerald-500/60'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
              <div className="pt-1">
                <label className="block font-bold text-purple-300 mb-1">
                  Max Context Window (Speed vs Memory)
                </label>
                <select
                  value={formData.maxContextTokens || 8192}
                  onChange={(e) =>
                    setFormData({ ...formData, maxContextTokens: parseInt(e.target.value, 10) || 8192 })
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value={4096}>4,096 tokens (Fastest for giant cards)</option>
                  <option value={8192}>8,192 tokens (Balanced Chub Standard)</option>
                  <option value={16384}>16,384 tokens (Long Lorebook Roleplay)</option>
                  <option value={32768}>32,768 tokens (Deep Memory)</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-purple-300 mb-1">
                  Prompt Structure ({CHUB_PROMPT_STRUCTURES.length} Formats)
                </label>
                <select
                  value={formData.promptStructure || 'tavern_v2'}
                  onChange={(e) => setFormData({ ...formData, promptStructure: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  {CHUB_PROMPT_STRUCTURES.map((ps) => (
                    <option key={ps.id} value={ps.id}>
                      {ps.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-purple-300 mb-1">
                  Text-To-Speech (TTS) API ({CHUB_TTS_APIS.length} Engines)
                </label>
                <select
                  value={formData.ttsApi || 'gemini_flash_tts'}
                  onChange={(e) => setFormData({ ...formData, ttsApi: e.target.value })}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  {CHUB_TTS_APIS.map((tts) => (
                    <option key={tts.id} value={tts.id}>
                      {tts.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.ttsApi === 'chub_custom_voice' || customVoices.length > 0) && (
                <div className="space-y-1.5">
                  <label className="font-bold text-amber-300 flex items-center gap-1">
                    <AudioWaveform className="h-3.5 w-3.5" />
                    <span>Global Chub Custom Audio Voice</span>
                  </label>
                  <select
                    value={formData.customVoiceUuid || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, customVoiceUuid: e.target.value })
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-400 focus:outline-none"
                  >
                    <option value="">Use Character&apos;s Default / Base Voice</option>
                    {customVoices.map((cv) => (
                      <option key={cv.uuid} value={cv.uuid}>
                        🎙️ {cv.name} ({cv.baseVoiceName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {formData.ttsApi === 'chub_custom_voice' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="url"
                    value={formData.ttsEndpointUrl || ''}
                    onChange={(e) => setFormData({ ...formData, ttsEndpointUrl: e.target.value })}
                    placeholder="Chub / XTTS Clone URL (optional)"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-amber-400 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={formData.ttsApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, ttsApiKey: e.target.value })}
                    placeholder="TTS API Key (optional)"
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Palace Free API Banner OR Chub / External API Credentials */}
          {isBuiltInFreeProvider(formData.apiProvider) ? (
            <div
              data-testid="presets-free-api-active"
              className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/45 via-zinc-900/70 to-teal-950/35 p-4 flex flex-col gap-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>Palace Free API Active — Unlimited · Zero Credit Limits</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Currently routing <span className="font-mono font-bold text-emerald-300">{formData.customModel || 'claude-opus-5-5'}</span> through Palace&apos;s built-in free roleplay engine. Nobody ever has to pay or worry about credits — works for <strong>Claude Opus 5.5</strong>, DeepSeek R1/V3, Chub Mars, GPT-4o &amp; Gemini!
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleFetchFreeKey}
                    disabled={fetchingFreeKey}
                    className="rounded-xl border border-emerald-400/50 bg-emerald-600/25 px-3 py-2 text-[11px] font-bold text-emerald-100 hover:bg-emerald-600/40 cursor-pointer"
                  >
                    {fetchingFreeKey ? 'Fetching...' : '🔑 Fetch Free API Key'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || testingConn}
                    className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-600/25 px-3 py-2 text-[11px] font-bold text-fuchsia-100 hover:bg-fuchsia-600/40 cursor-pointer"
                  >
                    {fetchingModels ? 'Loading...' : 'Fetch Free Models'}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConn}
                    className="rounded-xl border border-emerald-400/50 bg-emerald-600/25 px-3 py-2 text-[11px] font-bold text-emerald-100 hover:bg-emerald-600/40 cursor-pointer"
                  >
                    {testingConn ? 'Verifying...' : 'Verify Free Engine'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-4">
              {!formData.chubApiKey.trim() && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/25 px-3 py-2 text-[11px] text-emerald-200">
                  <span>
                    <strong>No API key entered:</strong> Leave blank or click Fetch Free API Key to run{' '}
                    <span className="font-mono text-emerald-300">{formData.customModel || 'selected model'}</span>{' '}
                    with zero credit limits:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleFetchFreeKey}
                      disabled={fetchingFreeKey}
                      className="rounded-lg bg-emerald-600/35 border border-emerald-400/60 px-2.5 py-1 font-bold text-emerald-100 hover:bg-emerald-600/55 cursor-pointer"
                    >
                      🔑 Fetch Free Key
                    </button>
                    <button
                      type="button"
                      onClick={() => handleProviderSelect('palace_free')}
                      className="rounded-lg bg-emerald-600/30 border border-emerald-400/50 px-2.5 py-1 font-bold text-emerald-100 hover:bg-emerald-600/50 cursor-pointer"
                    >
                      Switch to Free API
                    </button>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Key className="h-4 w-4" />
                  Provider Endpoint Credentials ({formData.apiProvider})
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFetchFreeKey}
                    disabled={fetchingFreeKey}
                    className="rounded-lg border border-emerald-500/50 bg-emerald-600/25 px-2.5 py-1 text-[11px] font-bold text-emerald-200 hover:bg-emerald-600/45 disabled:opacity-50 cursor-pointer"
                  >
                    {fetchingFreeKey ? 'Fetching...' : '🔑 Fetch Free API Key'}
                  </button>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={fetchingModels || testingConn}
                    className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-600/20 px-2.5 py-1 text-[11px] font-bold text-fuchsia-200 hover:bg-fuchsia-600/40 disabled:opacity-50 cursor-pointer"
                  >
                    {fetchingModels ? 'Fetching...' : 'Fetch Models'}
                  </button>
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConn || fetchingModels}
                    className="rounded-lg border border-purple-500/40 bg-purple-600/20 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/40 disabled:opacity-50 cursor-pointer"
                  >
                    {testingConn ? 'Testing...' : 'Test Connection'}
                  </button>
                  <a
                    href={getProviderApiKeyInfo(formData.apiProvider).url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-purple-600/30 border border-purple-400/40 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/50"
                  >
                    <span>{getProviderApiKeyInfo(formData.apiProvider).label}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {testResult && (
                <div
                  data-testid="presets-test-result"
                  className={`rounded-xl border px-3.5 py-2.5 text-[11px] space-y-1 ${
                    testResult.ok
                      ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                      : 'border-amber-500/40 bg-amber-950/30 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-bold">
                    <span>{testResult.message}</span>
                    {testResult.code && (
                      <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider shrink-0">
                        {testResult.code}
                      </span>
                    )}
                  </div>
                  {testResult.hint && (
                    <p className="text-[10px] opacity-85 leading-relaxed">{testResult.hint}</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={formData.chubApiUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, chubApiUrl: e.target.value })
                  }
                  placeholder="https://mars.chub.ai/v1"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none font-mono"
                />
                {isChubUrlOrProvider(formData.apiProvider, formData.chubApiUrl) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="chub-gateway-chips">
                    <span className="text-[10px] text-zinc-400 mr-1">Chub Gateways:</span>
                    {[
                      {
                        label: 'Palace Free /v1',
                        url:
                          typeof window !== 'undefined'
                            ? `${window.location.origin}/v1`
                            : 'http://localhost:3000/v1',
                      },
                      { label: 'Mars /v1', url: 'https://mars.chub.ai/v1' },
                      { label: 'Inference Soji', url: 'https://inference.chub.ai/soji/v1' },
                      { label: 'Mars Asha', url: 'https://mars.chub.ai/chub/asha/v1' },
                      { label: 'Mars Soji', url: 'https://mars.chub.ai/chub/soji/v1' },
                      { label: 'Mix /v1', url: 'https://api.chub.ai/mix/v1' },
                      { label: 'api.chub.ai', url: 'https://api.chub.ai/v1' },
                    ].map((gw) => (
                      <button
                        key={gw.url}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, chubApiUrl: gw.url });
                          setTestResult(null);
                        }}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-mono transition-colors cursor-pointer ${
                          formData.chubApiUrl === gw.url
                            ? 'border-purple-400 bg-purple-600/30 text-purple-100'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-purple-500/50 hover:text-zinc-200'
                        }`}
                      >
                        {gw.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  API Key (CH-API-KEY / Bearer Token)
                </label>
                <input
                  type="password"
                  value={formData.chubApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, chubApiKey: e.target.value })
                  }
                  placeholder="Optional: Paste Chub Token (CH-API-KEY), OpenAI, Anthropic, or OpenRouter Key..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none font-mono"
                />
                <p className="text-[10px] text-emerald-300/90 mt-1.5">
                  No paywall: if your Chub.ai or external key hits a 429/402 credit limit, Palace.ai automatically switches to its Unlimited Free Engine mid-chat with zero interruption.
                </p>
              </div>
            </div>
          )}
          {isBuiltInFreeProvider(formData.apiProvider) && testResult && (
            <div
              data-testid="presets-test-result"
              className={`rounded-xl border px-3.5 py-2.5 text-[11px] space-y-1 ${
                testResult.ok
                  ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                  : 'border-amber-500/40 bg-amber-950/30 text-amber-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 font-bold">
                <span>{testResult.message}</span>
                {testResult.code && (
                  <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider shrink-0">
                    {testResult.code}
                  </span>
                )}
              </div>
              {testResult.hint && (
                <p className="text-[10px] opacity-85 leading-relaxed">{testResult.hint}</p>
              )}
            </div>
          )}

          {/* Temperature & Top P Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            <div>
              <div className="flex justify-between font-semibold text-zinc-300 mb-1">
                <span>Creativity (Temperature)</span>
                <span className="text-purple-400 font-mono">{formData.temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.5"
                step="0.05"
                value={formData.temperature}
                onChange={(e) =>
                  setFormData({ ...formData, temperature: Number(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>Precise (0.1)</span>
                <span>Unfiltered Creative (1.5)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-zinc-300 mb-1">
                <span>Nucleus Sampling (Top P)</span>
                <span className="text-purple-400 font-mono">{formData.topP}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={formData.topP}
                onChange={(e) =>
                  setFormData({ ...formData, topP: Number(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>Focused (0.1)</span>
                <span>Rich Variety (1.0)</span>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                  <BrainCircuit className="h-4 w-4 text-purple-400" />
                  Gemini High-Thinking Mode
                </span>
                <p className="text-[11px] text-zinc-400">
                  Activates deep psychological deliberation with gemini-4-argon before replying
                </p>
              </div>
              <input
                type="checkbox"
                checked={formData.highThinking}
                onChange={(e) =>
                  setFormData({ ...formData, highThinking: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
              />
            </label>

            <div className="border-t border-zinc-800/60 pt-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="space-y-0.5">
                  <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-sky-400" />
                    Google Search Grounding
                  </span>
                  <p className="text-[11px] text-zinc-400">
                    Allows characters to access real-time lore, pop-culture, and facts
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.searchGrounding}
                  onChange={(e) =>
                    setFormData({ ...formData, searchGrounding: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-zinc-700 text-sky-600 focus:ring-sky-500"
                />
              </label>
            </div>
          </div>

          {/* Default Voice TTS */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Volume2 className="h-4 w-4 text-amber-400" />
              Default Speech Voice (Gemini 3.8 Flash TTS)
            </span>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setFormData({ ...formData, voiceName: v })}
                  className={`rounded-xl border py-1.5 text-xs font-semibold transition-all ${
                    formData.voiceName === v
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Developer Mode Custom Website Width (Unbounded Android Smallest Width / dp) */}
          <div
            data-testid="presets-viewport-width-card"
            className="rounded-2xl border border-cyan-500/35 bg-cyan-950/15 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-bold text-cyan-200 flex items-center gap-1.5">
                  <MonitorSmartphone className="h-4 w-4 text-cyan-400" />
                  Developer Website Width (Smallest Width / dp)
                </span>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Set any custom layout width (240px up to any number like 1440, 2400, 3840, or 6000+) — scales live like Android Developer Mode.
                </p>
              </div>
              <span className="rounded-lg border border-cyan-500/40 bg-zinc-950 px-2.5 py-1 text-[11px] font-mono text-cyan-300">
                Active: {activeViewportWidth ? `${activeViewportWidth}dp` : 'Auto'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: 'Auto', val: null },
                { label: '390dp', val: 390 },
                { label: '768dp', val: 768 },
                { label: '1280dp', val: 1280 },
                { label: '1440dp', val: 1440 },
                { label: '2400dp', val: 2400 },
                { label: '3840dp', val: 3840 },
              ].map((chip) => {
                const isSelected = activeViewportWidth === chip.val;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleApplyViewportWidth(chip.val)}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-mono transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-600/35 text-white font-bold'
                        : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/50'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={240}
                step={10}
                value={customWidthInput}
                onChange={(e) => setCustomWidthInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyViewportWidth();
                  }
                }}
                placeholder="Any width in px/dp (e.g. 1600, 2400, 5000)..."
                data-testid="presets-custom-width-input"
                className="flex-1 min-w-[180px] rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:border-cyan-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleApplyViewportWidth()}
                data-testid="presets-apply-width-btn"
                className="rounded-xl border border-cyan-500/50 bg-cyan-600/30 px-3.5 py-2 text-xs font-bold text-cyan-100 hover:bg-cyan-600/50 cursor-pointer"
              >
                Apply Width
              </button>
              <button
                type="button"
                onClick={() => handleApplyViewportWidth(null)}
                data-testid="presets-reset-width-btn"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-purple-900/40">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reset to Defaults</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-amber-400"
              >
                <Check className="h-4 w-4" />
                <span>Save Presets</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
