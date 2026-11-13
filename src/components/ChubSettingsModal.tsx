import React, { useState } from 'react';
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
} from 'lucide-react';
import { ChubChatSettings } from '../types/index.ts';

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
  stagingUrl: 'https://chub.ai/api/v1',
  characterViewStyle: 'chub',
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

  if (!isOpen) return null;

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
                    Prompt Structure
                  </label>
                  <select
                    value={current.promptStructure}
                    onChange={(e) => setCurrent({ ...current, promptStructure: e.target.value as any })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="tavern_v2">Tavern V2 (Standard Chub)</option>
                    <option value="roleplay_classic">Classic Roleplay</option>
                    <option value="instruct">Instruct / Alpaca Mode</option>
                    <option value="chatml">ChatML</option>
                    <option value="vicuna">Vicuna</option>
                  </select>
                </div>

                {/* API Provider */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    API Provider
                  </label>
                  <select
                    value={current.apiProvider}
                    onChange={(e) => setCurrent({ ...current, apiProvider: e.target.value as any })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="gemini">Google Gemini AI (3.8 Flash &amp; 4 Argon)</option>
                    <option value="chub_mars">Chub.ai Mars API</option>
                    <option value="custom_openai">Custom OpenAI / Kobold Endpoint</option>
                  </select>
                </div>

                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Active Model
                  </label>
                  <select
                    value={current.model}
                    onChange={(e) => setCurrent({ ...current, model: e.target.value })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Fast &amp; Grounded)</option>
                    <option value="gemini-4-argon">gemini-4-argon (High Thinking Reasoning)</option>
                    <option value="chub-mars">chub-mars (Chub Roleplay Engine)</option>
                    <option value="chub-mercury">chub-mercury</option>
                    <option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
                  </select>
                </div>

                {/* Text-To-Speech API */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                    Text-To-Speech (TTS) API
                  </label>
                  <select
                    value={current.ttsApi}
                    onChange={(e) => setCurrent({ ...current, ttsApi: e.target.value as any })}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                  >
                    <option value="gemini_flash_tts">Gemini Flash TTS (gemini-3.8-flash-tts)</option>
                    <option value="gemini_flash_lite_tts">Gemini Flash Lite TTS</option>
                    <option value="chub_voice">Chub.ai Voice Synthesis API</option>
                    <option value="custom_tts">ElevenLabs / Custom Endpoint</option>
                  </select>
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
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Staging Endpoint URL
                </label>
                <input
                  type="url"
                  value={current.stagingUrl || ''}
                  onChange={(e) => setCurrent({ ...current, stagingUrl: e.target.value })}
                  placeholder="https://chub.ai/api/v1 or custom proxy"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none font-mono"
                />
                <span className="text-[10px] text-zinc-500">Staging URL from Chub.ai for connecting third-party roleplay proxies</span>
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
