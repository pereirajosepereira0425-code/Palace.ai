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
} from 'lucide-react';

export interface GenerationPresets {
  apiProvider: 'gemini' | 'chub' | 'openrouter' | 'custom';
  chubApiUrl: string;
  chubApiKey: string;
  customModel: string;
  temperature: number;
  topP: number;
  maxContextTokens: number;
  highThinking: boolean;
  searchGrounding: boolean;
  voiceName: string;
}

export const DEFAULT_PRESETS: GenerationPresets = {
  apiProvider: 'gemini',
  chubApiUrl: 'https://api.chub.ai/v1',
  chubApiKey: '',
  customModel: 'gemini-4-argon',
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

  useEffect(() => {
    setFormData(presets);
  }, [presets, isOpen]);

  if (!isOpen) return null;

  const handleProviderSelect = (provider: GenerationPresets['apiProvider']) => {
    let defaultUrl = formData.chubApiUrl;
    let defaultModel = formData.customModel;

    if (provider === 'chub') {
      defaultUrl = 'https://api.chub.ai/v1';
      defaultModel = 'mars-70b';
    } else if (provider === 'openrouter') {
      defaultUrl = 'https://openrouter.ai/api/v1';
      defaultModel = 'anthropic/claude-3.5-sonnet';
    } else if (provider === 'gemini') {
      defaultUrl = '';
      defaultModel = 'gemini-4-argon';
    }

    setFormData({
      ...formData,
      apiProvider: provider,
      chubApiUrl: defaultUrl,
      customModel: defaultModel,
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSavePresets(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const handleReset = () => {
    setFormData(DEFAULT_PRESETS);
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
                Configure Chub.ai Mars/Mercury API, Gemini engine, thinking parameters, and context.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-all"
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
          {/* Provider Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Model Engine / API Source
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'gemini', label: 'Gemini Palace', sub: 'Native High-Thinking' },
                { id: 'chub', label: 'Chub.ai API', sub: 'Mars / Mercury' },
                { id: 'openrouter', label: 'OpenRouter', sub: '300+ LLM Hub' },
                { id: 'custom', label: 'Custom URL', sub: 'OpenAI-Compatible' },
              ].map((prov) => {
                const isSelected = formData.apiProvider === prov.id;
                return (
                  <button
                    key={prov.id}
                    type="button"
                    onClick={() => handleProviderSelect(prov.id as any)}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-600/20 text-white ring-1 ring-purple-500'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    <div className="font-bold text-xs">{prov.label}</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{prov.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chub / Custom API configuration fields */}
          {formData.apiProvider !== 'gemini' && (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <Key className="h-4 w-4" />
                  Custom Endpoint Credentials
                </span>
                {formData.apiProvider === 'chub' && (
                  <a
                    href="https://chub.ai/profile"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-purple-400 hover:underline"
                  >
                    <span>Get Chub API Key</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  API Base URL
                </label>
                <input
                  type="url"
                  required
                  value={formData.chubApiUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, chubApiUrl: e.target.value })
                  }
                  placeholder="https://api.chub.ai/v1"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.chubApiKey}
                  onChange={(e) =>
                    setFormData({ ...formData, chubApiKey: e.target.value })
                  }
                  placeholder="Paste your Chub Mars/Mercury or OpenRouter Key..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1">
                  Target Model Name
                </label>
                <input
                  type="text"
                  value={formData.customModel}
                  onChange={(e) =>
                    setFormData({ ...formData, customModel: e.target.value })
                  }
                  placeholder="e.g. mars-70b, mercury, anthropic/claude-3.5-sonnet"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
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
