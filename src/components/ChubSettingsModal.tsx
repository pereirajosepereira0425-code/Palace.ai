import React, { useEffect, useState } from 'react';
import {
  Sliders,
  X,
  Sparkles,
  Bot,
  BrainCircuit,
  Volume2,
  BookOpen,
  Users,
  Globe,
  Check,
  RotateCcw,
  Shield,
  Layers,
  HelpCircle,
  Key,
  ExternalLink,
} from 'lucide-react';
import { ChubChatSettings } from '../types/index.ts';
import {
  CHUB_TTS_APIS,
  CHUB_API_PROVIDERS,
  CHUB_ACTIVE_MODELS,
  CHUB_PROMPT_STRUCTURES,
} from '../utils/chubOptions.ts';

export const DEFAULT_CHUB_SETTINGS: ChubChatSettings = {
  promptStructure: 'tavern_v2',
  apiProvider: 'gemini',
  model: 'gemini-3.8-flash',
  includeNames: true,
  banEmojis: false,
  textStreaming: true,
  legacyStreaming: false,
  v2Spec: true,
  useLorebooks: true,
  useAutoSummarization: true,
  promptNote: '',
  promptNoteDepth: 4,
  preset: 'default',
  repetitionPenalty: 1.15,
  frequencyPenalty: 0.2,
  presencePenalty: 0.2,
  topP: 0.95,
  topK: 40,
  minLength: 10,
  trimIncompleteSentences: true,
  stoppingStrings: '\\n{{user}}:, <START>, \\n\\n',
  maxNewTokens: 450,
  contextSize: 8192,
  lorebookScanDepth: 4,
  lorebookTokenBudget: 1200,
  matchWholeWords: true,
  lorebookRecursiveScanning: true,
  ttsApi: 'gemini_flash_tts',
  defaultModel: 'gemini-3.8-flash',
  defaultVoice: 'Puck',
  autoGeneration: false,
  restrictNarration: false,
  stagingUrl: 'https://api.chub.ai/v1',
  characterViewStyle: 'chub',
  useAvatarAsBackground: false,
  avatarBackgroundFit: 'contain',
  groupChatSettings: {
    joinOrder: 'natural_turn',
    silenceThreshold: 3,
  },
};

interface ChubSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChubChatSettings;
  onSave: (newSettings: ChubChatSettings) => void;
}

export const ChubSettingsModal: React.FC<ChubSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [activeSection, setActiveSection] = useState<
    'chat' | 'presets' | 'generation' | 'lorebook' | 'group' | 'staging'
  >('chat');

  const [current, setCurrent] = useState<ChubChatSettings>({
    ...DEFAULT_CHUB_SETTINGS,
    ...settings,
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrent({
        ...DEFAULT_CHUB_SETTINGS,
        ...settings,
      });
      setTestResult(null);
      try {
        const rawPresets = localStorage.getItem('palace_generation_presets');
        if (rawPresets) {
          const parsed = JSON.parse(rawPresets);
          setApiKeyInput(parsed.chubApiKey || '');
        }
      } catch {
        // ignore
      }
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    try {
      setTestingConn(true);
      setTestResult(null);
      const res = await fetch('/api/config/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiProvider: current.apiProvider,
          apiUrl: current.stagingUrl,
          apiKey: apiKeyInput,
          model: current.model,
        }),
      });
      const data = await res.json();
      setTestResult({ ok: Boolean(data.ok), message: data.message || 'Checked.' });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.message || 'Test failed.' });
    } finally {
      setTestingConn(false);
    }
  };

  const handleApplyPreset = (presetName: 'default' | 'storyteller' | 'strict_rp' | 'chaotic' | 'speed') => {
    let updated: Partial<ChubChatSettings> = { preset: presetName };
    if (presetName === 'storyteller') {
      updated = {
        preset: 'storyteller',
        repetitionPenalty: 1.1,
        topP: 0.98,
        topK: 50,
        maxNewTokens: 650,
        restrictNarration: false,
      };
    } else if (presetName === 'strict_rp') {
      updated = {
        preset: 'strict_rp',
        repetitionPenalty: 1.25,
        topP: 0.9,
        topK: 30,
        banEmojis: true,
        includeNames: true,
      };
    } else if (presetName === 'chaotic') {
      updated = {
        preset: 'chaotic',
        repetitionPenalty: 1.05,
        topP: 1.0,
        topK: 80,
      };
    } else if (presetName === 'speed') {
      updated = {
        preset: 'speed',
        model: 'gemini-3.8-flash',
        maxNewTokens: 250,
      };
    } else {
      updated = { ...DEFAULT_CHUB_SETTINGS, preset: 'default' };
    }

    setCurrent((prev) => ({ ...prev, ...updated }));
  };

  const handleSaveAndClose = () => {
    // Sync API Key & provider back to palace_generation_presets
    try {
      const rawPresets = localStorage.getItem('palace_generation_presets');
      const existingPresets = rawPresets ? JSON.parse(rawPresets) : {};
      localStorage.setItem(
        'palace_generation_presets',
        JSON.stringify({
          ...existingPresets,
          apiProvider: current.apiProvider,
          chubApiUrl: current.stagingUrl || existingPresets.chubApiUrl || 'https://api.chub.ai/v1',
          chubApiKey: apiKeyInput,
          customModel: current.model,
          promptStructure: current.promptStructure,
          ttsApi: current.ttsApi,
          maxContextTokens: current.contextSize,
        })
      );
    } catch {
      // ignore storage error
    }

    onSave(current);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-3xl border border-purple-500/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-900/40 px-6 py-4 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 border border-purple-500/30">
              <Sliders className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Chub.ai Chat Settings &amp; Generation Options</span>
                <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-mono">
                  Spec V2.0
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Complete configuration parameters from https://chub.ai/chats/177970478
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800/80 bg-zinc-900/40 px-6 py-2 overflow-x-auto no-scrollbar">
          {[
            { id: 'chat', label: 'Chat Settings', icon: Bot },
            { id: 'generation', label: 'Generation & Penalties', icon: BrainCircuit },
            { id: 'lorebook', label: 'Lorebook Settings', icon: BookOpen },
            { id: 'group', label: 'Group Chat Settings', icon: Users },
            { id: 'staging', label: 'Staging URL & API', icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: CHAT SETTINGS */}
          {activeSection === 'chat' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prompt Structure */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Prompt Structure ({CHUB_PROMPT_STRUCTURES.length} Chub / Tavern Formats)
                  </label>
                  <select
                    value={current.promptStructure}
                    onChange={(e) => setCurrent({ ...current, promptStructure: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    {CHUB_PROMPT_STRUCTURES.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {ps.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {CHUB_PROMPT_STRUCTURES.find((p) => p.id === current.promptStructure)?.description ||
                      'Select how system prompt, definitions, and chat turns are structured.'}
                  </p>
                </div>

                {/* API Provider */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    API Provider ({CHUB_API_PROVIDERS.length} Supported Providers)
                  </label>
                  <select
                    value={current.apiProvider}
                    onChange={(e) => {
                      const nextProvider = e.target.value;
                      const match = CHUB_API_PROVIDERS.find((p) => p.id === nextProvider);
                      setCurrent({
                        ...current,
                        apiProvider: nextProvider,
                        model: match?.defaultModel || current.model,
                        stagingUrl: match?.defaultUrl || current.stagingUrl,
                      });
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    {CHUB_API_PROVIDERS.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    {CHUB_API_PROVIDERS.find((p) => p.id === current.apiProvider)?.description ||
                      'Select the backend inference provider.'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <a
                      href="https://chub.ai/profile"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-fuchsia-600/30 border border-purple-500/40 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/50 transition-all"
                    >
                      <Key className="h-3 w-3 text-amber-300" />
                      <span>Create Chub.ai API Key</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveSection('staging')}
                      className="rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
                    >
                      Configure Key &amp; URL
                    </button>
                  </div>
                </div>

                {/* Active Model Selector + Custom Model ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                    Active Model ({CHUB_ACTIVE_MODELS.length}+ Chub &amp; External Models)
                  </label>
                  <select
                    value={
                      CHUB_ACTIVE_MODELS.some((m) => m.id === current.model) ? current.model : '__custom__'
                    }
                    onChange={(e) => {
                      if (e.target.value !== '__custom__') {
                        setCurrent({ ...current, model: e.target.value, defaultModel: e.target.value });
                      }
                    }}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    {Array.from(new Set(CHUB_ACTIVE_MODELS.map((m) => m.provider || 'Other'))).map(
                      (providerGroup) => (
                        <optgroup key={providerGroup} label={providerGroup}>
                          {CHUB_ACTIVE_MODELS.filter((m) => (m.provider || 'Other') === providerGroup).map(
                            (m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            )
                          )}
                        </optgroup>
                      )
                    )}
                    <option value="__custom__">Custom Model ID (Type Below)</option>
                  </select>
                  <input
                    type="text"
                    value={current.model}
                    onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                    placeholder="Or enter exact model slug (e.g. mars-70b, deepseek/deepseek-chat)..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                {/* Text-To-Speech API */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
                    Text-To-Speech (TTS) API ({CHUB_TTS_APIS.length} Engines)
                  </label>
                  <select
                    value={current.ttsApi}
                    onChange={(e) => setCurrent({ ...current, ttsApi: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    {CHUB_TTS_APIS.map((tts) => (
                      <option key={tts.id} value={tts.id}>
                        {tts.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-500">
                    {CHUB_TTS_APIS.find((t) => t.id === current.ttsApi)?.description ||
                      'Select TTS voice synthesis backend.'}
                  </p>
                  {['elevenlabs', 'openai_tts', 'silero', 'alltalk', 'xttsv2', 'kokoro', 'edge_tts', 'custom_tts'].includes(
                    current.ttsApi
                  ) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <input
                        type="url"
                        value={current.ttsEndpointUrl || ''}
                        onChange={(e) => setCurrent({ ...current, ttsEndpointUrl: e.target.value })}
                        placeholder="TTS Server URL (optional)"
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-purple-500 focus:outline-none"
                      />
                      <input
                        type="password"
                        value={current.ttsApiKey || ''}
                        onChange={(e) => setCurrent({ ...current, ttsApiKey: e.target.value })}
                        placeholder="TTS API Key (e.g. ElevenLabs / OpenAI)"
                        className="rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-[11px] font-mono text-zinc-200 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Toggles Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                {[
                  { key: 'includeNames', label: 'Include Names ({{char}}:)', desc: 'Prefix spoken turns with names' },
                  { key: 'banEmojis', label: 'Ban Emojis', desc: 'Directs model not to emit emoji icons' },
                  { key: 'textStreaming', label: 'Text Streaming', desc: 'Stream replies token-by-token' },
                  { key: 'legacyStreaming', label: 'Legacy Streaming', desc: 'Compatibility with older WebSocket clients' },
                  { key: 'v2Spec', label: 'V2 Spec Compliant', desc: 'Enforce Tavern Card V2 token formatting' },
                  { key: 'useLorebooks', label: 'Use Lorebooks', desc: 'Scan memory for trigger keywords' },
                  { key: 'useAutoSummarization', label: 'Use Auto Summarization', desc: 'Track long-term chat memory' },
                  { key: 'trimIncompleteSentences', label: 'Trim Incompl. Sentences', desc: 'Cut trailing unfinished thoughts' },
                  { key: 'autoGeneration', label: 'Auto Generation', desc: 'Automatically proceed on enter' },
                  { key: 'restrictNarration', label: 'Restrict Narration', desc: 'Prioritize dialogue over purple prose' },
                  { key: 'useAvatarAsBackground', label: 'Avatar Chat Background', desc: "Use the character's avatar as chat background" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean((current as any)[item.key])}
                      onChange={(e) => setCurrent({ ...current, [item.key]: e.target.checked })}
                      className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-zinc-200">{item.label}</div>
                      <div className="text-[10px] text-zinc-500">{item.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {current.useAvatarAsBackground && (
                <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-purple-200">🖼️ Avatar Background Framing</div>
                    <div className="text-[11px] text-zinc-400">
                      Choose whether to display the full uncropped avatar or fill the entire screen.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {(
                      [
                        { id: 'contain', label: 'Full Image (Uncropped)' },
                        { id: 'cover', label: 'Fill Screen (Cover)' },
                      ] as const
                    ).map((fit) => (
                      <button
                        key={fit.id}
                        type="button"
                        onClick={() => setCurrent({ ...current, avatarBackgroundFit: fit.id })}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                          (current.avatarBackgroundFit || 'contain') === fit.id
                            ? 'border-purple-400 bg-purple-600 text-white shadow-sm'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                        }`}
                      >
                        {fit.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt Note & Depth */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Prompt Note (Injected Directive)
                  </label>
                  <input
                    type="text"
                    value={current.promptNote}
                    onChange={(e) => setCurrent({ ...current, promptNote: e.target.value })}
                    placeholder="e.g. [Write with vivid descriptions, maintain intense psychological tension]"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Prompt Note Depth
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={current.promptNoteDepth}
                    onChange={(e) => setCurrent({ ...current, promptNoteDepth: parseInt(e.target.value, 10) || 4 })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 2: GENERATION & PENALTIES */}
          {activeSection === 'generation' && (
            <div className="space-y-6">
              {/* Preset Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                  Chub Generation Preset
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['default', 'storyteller', 'strict_rp', 'chaotic', 'speed'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`rounded-xl border p-2 text-center text-xs font-bold capitalize transition-all ${
                        current.preset === preset
                          ? 'border-purple-500 bg-purple-600/30 text-white shadow-md'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {preset.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                    <span>Repetition Penalty</span>
                    <span className="font-mono text-purple-400">{current.repetitionPenalty}</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.05"
                    value={current.repetitionPenalty}
                    onChange={(e) => setCurrent({ ...current, repetitionPenalty: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                    <span>Top P</span>
                    <span className="font-mono text-purple-400">{current.topP}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={current.topP}
                    onChange={(e) => setCurrent({ ...current, topP: parseFloat(e.target.value) })}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                    <span>Top K</span>
                    <span className="font-mono text-purple-400">{current.topK}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={current.topK}
                    onChange={(e) => setCurrent({ ...current, topK: parseInt(e.target.value, 10) })}
                    className="w-full accent-purple-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-zinc-300 mb-1">
                    <span>Max New Tokens</span>
                    <span className="font-mono text-purple-400">{current.maxNewTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2048"
                    step="50"
                    value={current.maxNewTokens}
                    onChange={(e) => setCurrent({ ...current, maxNewTokens: parseInt(e.target.value, 10) })}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>

              {/* Stopping Strings */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Stopping Strings (Comma separated)
                </label>
                <input
                  type="text"
                  value={current.stoppingStrings}
                  onChange={(e) => setCurrent({ ...current, stoppingStrings: e.target.value })}
                  placeholder="\n{{user}}:, <START>, \n\n"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SECTION 3: LOREBOOK SETTINGS */}
          {activeSection === 'lorebook' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Lorebook Scan Depth
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={current.lorebookScanDepth}
                    onChange={(e) => setCurrent({ ...current, lorebookScanDepth: parseInt(e.target.value, 10) || 4 })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">How many recent message turns to scan for trigger keys</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Lorebook Token Budget
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="4000"
                    step="100"
                    value={current.lorebookTokenBudget}
                    onChange={(e) => setCurrent({ ...current, lorebookTokenBudget: parseInt(e.target.value, 10) || 1200 })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Max tokens allocated for injected world lore</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.matchWholeWords}
                    onChange={(e) => setCurrent({ ...current, matchWholeWords: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-zinc-200">Match Whole Words</div>
                    <div className="text-[10px] text-zinc-500">Prevent partial word triggering</div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3 hover:border-zinc-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={current.lorebookRecursiveScanning}
                    onChange={(e) => setCurrent({ ...current, lorebookRecursiveScanning: e.target.checked })}
                    className="rounded border-zinc-700 bg-zinc-800 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-zinc-200">Recursive Scanning</div>
                    <div className="text-[10px] text-zinc-500">Allows lore entries to trigger other lore entries</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* SECTION 4: GROUP CHAT SETTINGS */}
          {activeSection === 'group' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-purple-900/30 bg-purple-950/20 p-4 text-xs text-zinc-300">
                <h4 className="font-bold text-purple-300 mb-1">Group Roleplay Coordination</h4>
                Configure turn progression and round-robin speaker assignment when multiple bots are active in the same channel.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Bot Speaking Order
                  </label>
                  <select
                    value={current.groupChatSettings?.joinOrder || 'natural_turn'}
                    onChange={(e) =>
                      setCurrent({
                        ...current,
                        groupChatSettings: {
                          ...current.groupChatSettings,
                          joinOrder: e.target.value as any,
                          silenceThreshold: current.groupChatSettings?.silenceThreshold || 3,
                        },
                      })
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="natural_turn">Natural Contextual Order (AI decides)</option>
                    <option value="round_robin">Round Robin (Strict Sequential)</option>
                    <option value="manual">Manual Callout Only (@Name)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Silence Threshold (Turns)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={current.groupChatSettings?.silenceThreshold || 3}
                    onChange={(e) =>
                      setCurrent({
                        ...current,
                        groupChatSettings: {
                          ...current.groupChatSettings,
                          silenceThreshold: parseInt(e.target.value, 10) || 3,
                          joinOrder: current.groupChatSettings?.joinOrder || 'natural_turn',
                        },
                      })
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* SECTION 5: STAGING URL & API */}
          {activeSection === 'staging' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-fuchsia-500/35 bg-gradient-to-r from-purple-950/50 via-zinc-900/80 to-fuchsia-950/40 p-4">
                <div>
                  <h4 className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                    <Key className="h-4 w-4 text-amber-300" />
                    <span>Chub.ai Mars / Mercury API Key</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Generate or manage your Chub.ai account secrets &amp; subscription API access on Chub.ai.
                  </p>
                </div>
                <a
                  href="https://chub.ai/profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-fuchsia-500 transition-all shrink-0"
                >
                  <span>🔑 Create Chub.ai API Key</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    API / Staging Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={current.stagingUrl || ''}
                    onChange={(e) => setCurrent({ ...current, stagingUrl: e.target.value })}
                    placeholder="https://api.chub.ai/v1"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-zinc-500">Default Chub API base: https://api.chub.ai/v1</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    API Key (Chub / OpenRouter / OpenAI)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Paste your Chub / external API key..."
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-zinc-500">Synced with Presets &amp; used when API Provider is not Gemini</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3.5">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Context Size Budget (High-Token Speed Control)</div>
                  <div className="text-[10px] text-zinc-400">
                    Caps giant character definitions &amp; history windows so responses stay fast like Chub.ai
                  </div>
                </div>
                <select
                  value={current.contextSize || 8192}
                  onChange={(e) => setCurrent({ ...current, contextSize: parseInt(e.target.value, 10) || 8192 })}
                  className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value={4096}>4,096 tokens (Ultra Fast)</option>
                  <option value={8192}>8,192 tokens (Balanced)</option>
                  <option value={16384}>16,384 tokens (Long RP)</option>
                  <option value={32768}>32,768 tokens (Max Context)</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConn}
                  className="rounded-xl border border-purple-500/40 bg-purple-600/20 px-4 py-2 text-xs font-bold text-purple-200 hover:bg-purple-600/40 disabled:opacity-50 cursor-pointer"
                >
                  {testingConn ? 'Testing Connection...' : 'Test API Connection'}
                </button>
                {testResult && (
                  <span className={`text-xs font-semibold ${testResult.ok ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-900/80">
          <button
            onClick={() => setCurrent(DEFAULT_CHUB_SETTINGS)}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset to Defaults</span>
          </button>

          <button
            onClick={handleSaveAndClose}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:bg-purple-500 transition-all cursor-pointer"
          >
            {savedSuccess ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4 text-amber-300" />}
            <span>Save &amp; Apply Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
