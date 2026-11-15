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
} from 'lucide-react';
import type { CustomVoiceRecord } from '../types/index.ts';

import {
  CHUB_API_PROVIDERS,
  CHUB_ACTIVE_MODELS,
  CHUB_PROMPT_STRUCTURES,
  CHUB_TTS_APIS,
} from '../utils/chubOptions.ts';
import {
  CHUB_CREATE_TOKEN_URL,
  CHUB_SUBSCRIPTIONS_URL,
  getProviderApiKeyInfo,
} from '../utils/promptBudget.ts';
import {
  type ApiConnectionTestResult,
  fetchEndpointModels,
  isChubUrlOrProvider,
  runSmartConnectionTest,
} from '../utils/apiErrorUtils.ts';

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
  const [liveModels, setLiveModels] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<ApiConnectionTestResult | null>(null);
  const [customVoices, setCustomVoices] = useState<CustomVoiceRecord[]>([]);

  useEffect(() => {
    setFormData(presets);
    setTestResult(null);
    setLiveModels([]);
    if (isOpen) {
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
    setFormData({
      ...formData,
      apiProvider: providerId,
      chubApiUrl: prov?.defaultUrl !== undefined ? prov.defaultUrl : formData.chubApiUrl,
      customModel: prov?.defaultModel || formData.customModel,
    });
    setTestResult(null);
    setLiveModels([]);
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
            hint: 'Try picking one of the model-specific Chub Gateways below (Inference Soji, Mars Asha, Mars Soji, Mix /v1).',
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
          ...(cleanBase ? { chubApiUrl: cleanBase } : {}),
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
    onSavePresets(formData);
    // Sync key Chub settings into localStorage so ChatRoom & ChubSettingsModal share the selection
    try {
      const existingRaw = localStorage.getItem('palace_chub_chat_settings');
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(
        'palace_chub_chat_settings',
        JSON.stringify({
          ...existing,
          apiProvider: formData.apiProvider,
          model: formData.customModel,
          promptStructure: formData.promptStructure || existing.promptStructure || 'tavern_v2',
          ttsApi: formData.ttsApi || existing.ttsApi || 'gemini_flash_tts',
          defaultVoice: formData.voiceName,
          customVoiceUuid: formData.customVoiceUuid || '',
          ttsEndpointUrl: formData.ttsEndpointUrl || '',
          ttsApiKey: formData.ttsApiKey || '',
          contextSize: formData.maxContextTokens || existing.contextSize || 8192,
          stagingUrl: formData.chubApiUrl || existing.stagingUrl,
        })
      );
    } catch {
      // ignore storage error
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
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
          {/* Always-visible Chub.ai API Key Quick Access */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/35 bg-gradient-to-r from-purple-950/50 via-zinc-900/80 to-fuchsia-950/40 p-3.5">
            <div className="space-y-0.5">
              <div className="font-bold text-purple-200 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-amber-300" />
                <span>Chub.ai Tokens, Mars &amp; Provider Keys</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Create Chub tokens at <span className="font-mono text-zinc-300">my_stages?active=tokens</span>, or get Mars/OpenRouter/OpenAI keys directly.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {formData.apiProvider === 'gemini' && (
                <button
                  type="button"
                  onClick={() => handleProviderSelect('chub_mars')}
                  className="rounded-xl border border-purple-500/40 bg-purple-900/40 px-3 py-2 text-[11px] font-bold text-purple-200 hover:bg-purple-800/50 transition-all cursor-pointer"
                >
                  Use Chub API
                </button>
              )}
              <a
                href={CHUB_CREATE_TOKEN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3.5 py-2 text-[11px] font-bold text-white shadow-md hover:from-purple-500 hover:to-fuchsia-500 transition-all"
              >
                <span>🔑 Create Chub.ai Token</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={CHUB_SUBSCRIPTIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl border border-fuchsia-500/35 bg-zinc-900/80 px-2.5 py-2 text-[11px] font-semibold text-fuchsia-200 hover:bg-zinc-800 transition-all"
              >
                <span>🪐 Mars Plan</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
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

          {/* Chub / Custom API configuration fields */}
          {formData.apiProvider !== 'gemini' && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Key className="h-4 w-4" />
                  Provider Endpoint Credentials ({formData.apiProvider})
                </span>
                <div className="flex flex-wrap items-center gap-2">
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
                  placeholder="Paste your Chub Mars/Mercury Token (CH-API-KEY), OpenAI, Anthropic, or OpenRouter Key..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>
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
