import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  UserPlus,
  Trash2,
  Volume2,
  VolumeX,
  Cpu,
  Layers,
  Plus,
  Swords,
  Shield,
  Zap,
  Heart,
  LogOut,
  Trophy,
  Search,
  Check,
} from 'lucide-react';
import type {
  BrawlCombatState,
  BrawlTriggerMode,
  Character,
  GroupParticipant,
  ModelEnsembleConfig,
} from '../types/index.ts';
import { CHUB_ACTIVE_MODELS } from '../utils/chubOptions.ts';
import {
  type BrawlMoveType,
  type ResponderSelectionMode,
  DEFAULT_ENSEMBLE_CONFIG,
  normalizeEnsembleConfig,
} from '../utils/chatOrchestration.ts';

interface GroupRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  hostCharacterUuid: string;
  roster: GroupParticipant[];
  responderMode: ResponderSelectionMode;
  selectedResponderUuid: string | null;
  onChangeResponderMode: (mode: ResponderSelectionMode, selectedUuid?: string | null) => void;
  onAddParticipant: (char: Character) => void;
  onRemoveParticipant: (uuid: string) => void;
  onToggleMute: (uuid: string) => void;
}

export const GroupRosterModal: React.FC<GroupRosterModalProps> = ({
  isOpen,
  onClose,
  hostCharacterUuid,
  roster,
  responderMode,
  selectedResponderUuid,
  onChangeResponderMode,
  onAddParticipant,
  onRemoveParticipant,
  onToggleMute,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState<Character[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const loadChars = async () => {
      try {
        setLoadingCatalog(true);
        const params = new URLSearchParams({ limit: '36', sort: 'popular' });
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        const res = await fetch(`/api/characters?${params.toString()}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setCatalog(Array.isArray(data.characters) ? data.characters : []);
        }
      } catch (err) {
        console.error('Failed to search characters for group chat:', err);
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    };
    const timer = setTimeout(loadChars, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="group-chat-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden rounded-3xl border border-purple-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-300">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Group Chat Characters ({roster.length})</h3>
              <p className="text-[11px] text-zinc-400">
                Add companions, choose who replies when messaging, or remove characters anytime.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
            aria-label="Close Group Characters"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Active Turn Rule */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-zinc-300">
              Who Replies When You Send a Message
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'auto', label: 'Auto (Smart Turn)' },
                  { id: 'specific', label: 'Chosen Character' },
                  { id: 'round_robin', label: 'Round Robin' },
                  { id: 'all', label: 'Everyone Replies' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeResponderMode(opt.id, selectedResponderUuid || roster[0]?.uuid)}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    responderMode === opt.id
                      ? 'border-purple-500 bg-purple-600/30 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Current Roster */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-purple-300">Active Room Roster</h4>
              <span className="text-[11px] text-zinc-500">{roster.length} in scene</span>
            </div>
            <div className="space-y-2">
              {roster.map((p) => {
                const isHost = p.uuid === hostCharacterUuid || p.isHost;
                const isPicked =
                  responderMode === 'specific' &&
                  (selectedResponderUuid || hostCharacterUuid) === p.uuid;
                return (
                  <div
                    key={p.uuid}
                    data-testid={`roster-row-${p.uuid}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl border p-3 transition-colors ${
                      isPicked
                        ? 'border-purple-500/70 bg-purple-950/25'
                        : 'border-zinc-800 bg-zinc-900/70'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={p.avatar}
                        alt={p.name}
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 rounded-xl object-cover object-top border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-100">
                          <span className="truncate">{p.name}</span>
                          {isHost && (
                            <span className="text-[10px] font-medium text-amber-300">· Primary</span>
                          )}
                          {p.muted && (
                            <span className="text-[10px] font-medium text-rose-400">· Muted</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">{p.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onChangeResponderMode('specific', p.uuid)}
                        className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                          isPicked
                            ? 'border-purple-400 bg-purple-600 text-white'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-purple-500/50'
                        }`}
                      >
                        {isPicked ? 'Replying Next' : 'Set Responder'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleMute(p.uuid)}
                        title={p.muted ? 'Unmute character' : 'Mute character'}
                        className="rounded-xl border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                      >
                        {p.muted ? <VolumeX className="h-3.5 w-3.5 text-rose-400" /> : <Volume2 className="h-3.5 w-3.5" />}
                      </button>

                      {roster.length > 1 && (
                        <button
                          type="button"
                          data-testid={`remove-participant-${p.uuid}`}
                          onClick={() => onRemoveParticipant(p.uuid)}
                          title={`Remove ${p.name} from chat`}
                          className="flex items-center gap-1 rounded-xl border border-rose-500/35 bg-rose-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-rose-300 hover:bg-rose-900/50 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Character Catalog */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800">
            <h4 className="text-xs font-bold text-zinc-200">Add Another Character to This Chat</h4>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Palace characters by name..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
              {loadingCatalog ? (
                <p className="col-span-2 text-center text-xs text-zinc-500 py-4">Loading characters...</p>
              ) : catalog.length === 0 ? (
                <p className="col-span-2 text-center text-xs text-zinc-500 py-4">No characters matched.</p>
              ) : (
                catalog.map((char) => {
                  const inRoster = roster.some((p) => p.uuid === char.uuid);
                  return (
                    <div
                      key={char.uuid}
                      className="flex items-center justify-between gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={char.avatar}
                          alt={char.name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-xl object-cover object-top shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-100 truncate">{char.name}</div>
                          <div className="text-[10px] text-zinc-400 truncate">{char.tagline}</div>
                        </div>
                      </div>
                      {inRoster ? (
                        <span className="flex items-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold text-emerald-300 shrink-0">
                          <Check className="h-3 w-3" />
                          <span>In Chat</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          data-testid={`add-participant-${char.uuid}`}
                          onClick={() => onAddParticipant(char)}
                          className="flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-purple-500 cursor-pointer shrink-0"
                        >
                          <UserPlus className="h-3 w-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MultiModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ModelEnsembleConfig;
  onSave: (nextConfig: ModelEnsembleConfig) => void;
}

export const MultiModelModal: React.FC<MultiModelModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [draft, setDraft] = useState<ModelEnsembleConfig>(() => normalizeEnsembleConfig(config));

  useEffect(() => {
    if (isOpen) {
      setDraft(normalizeEnsembleConfig(config));
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleSlotChange = (index: number, modelId: string) => {
    const modelMeta = CHUB_ACTIVE_MODELS.find((m) => m.id === modelId);
    setDraft((prev) => ({
      ...prev,
      models: prev.models.map((m, i) =>
        i === index ? { ...m, id: modelId, label: modelMeta?.label || modelId } : m
      ),
    }));
  };

  const handleRoleChange = (index: number, role: any) => {
    setDraft((prev) => ({
      ...prev,
      models: prev.models.map((m, i) => (i === index ? { ...m, role } : m)),
    }));
  };

  const handleAddSlot = () => {
    if (draft.models.length >= 4) return;
    const candidate =
      CHUB_ACTIVE_MODELS.find((m) => !draft.models.some((s) => s.id === m.id)) ||
      CHUB_ACTIVE_MODELS[0];
    setDraft((prev) => ({
      ...prev,
      models: [
        ...prev.models,
        { id: candidate.id, label: candidate.label, role: 'lorekeeper' },
      ],
    }));
  };

  const handleRemoveSlot = (index: number) => {
    if (draft.models.length <= 2) return;
    setDraft((prev) => ({
      ...prev,
      models: prev.models.filter((_, i) => i !== index),
    }));
  };

  return (
    <div
      data-testid="multi-model-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden rounded-3xl border border-purple-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600/25 border border-indigo-500/40 text-indigo-300">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Multi-Model Collaboration</h3>
              <p className="text-[11px] text-zinc-400">
                Make 2–4 AI models work together on drafts, critique, lore checks &amp; synthesis.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Master Enable Toggle */}
          <label className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5 cursor-pointer">
            <div>
              <div className="font-bold text-zinc-100 flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-indigo-400" />
                <span>Enable Multi-Model Teamwork in This Chat</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Each reply combines your selected models and shows the teamwork trace inside the message drawer.
              </p>
            </div>
            <input
              type="checkbox"
              data-testid="multimodel-enabled-checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="h-4 w-4 accent-purple-500"
            />
          </label>

          {/* Collaboration Strategy */}
          <div className="space-y-2">
            <label className="block font-semibold text-zinc-300">Collaboration Strategy</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  {
                    id: 'council',
                    label: 'Model Council',
                    desc: 'All models draft in parallel, then Synthesizer merges best elements.',
                  },
                  {
                    id: 'critique_polish',
                    label: 'Draft & Polish',
                    desc: 'Model 1 writes the raw scene; Model 2 critiques & refines prose.',
                  },
                  {
                    id: 'specialist_split',
                    label: 'Specialist Split',
                    desc: 'Splits sensory choreography vs character dialogue, then fuses.',
                  },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, mode: m.id, enabled: true })}
                  className={`rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
                    draft.mode === m.id
                      ? 'border-indigo-500 bg-indigo-950/35 text-white'
                      : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-bold text-xs">{m.label}</div>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Model Slots */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-300">
                Collaborating Models ({draft.models.length}/4)
              </span>
              {draft.models.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddSlot}
                  className="flex items-center gap-1 rounded-xl border border-indigo-500/40 bg-indigo-600/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-600/35 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Model</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              {draft.models.map((slot, idx) => (
                <div
                  key={`${slot.id}-${idx}`}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2.5"
                >
                  <span className="font-mono text-[11px] text-indigo-300 w-14 shrink-0">
                    Model {idx + 1}
                  </span>
                  <select
                    aria-label={`Collaborating Model ${idx + 1}`}
                    value={slot.id}
                    onChange={(e) => handleSlotChange(idx, e.target.value)}
                    className="flex-1 min-w-[160px] rounded-xl border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  >
                    {CHUB_ACTIVE_MODELS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Model ${idx + 1} Role`}
                    value={slot.role || 'drafter'}
                    onChange={(e) => handleRoleChange(idx, e.target.value)}
                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-300 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="drafter">Scene Drafter</option>
                    <option value="critic">Critic &amp; Polish</option>
                    <option value="lorekeeper">Lore &amp; Action</option>
                    <option value="dialogue">Voice &amp; Emotion</option>
                  </select>
                  {draft.models.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(idx)}
                      className="rounded-lg p-1.5 text-zinc-500 hover:text-rose-400 cursor-pointer"
                      aria-label={`Remove Model ${idx + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Synthesizer Picker */}
          {draft.mode !== 'critique_polish' && (
            <div>
              <label className="block font-semibold text-zinc-300 mb-1">
                Final Synthesizer Model
              </label>
              <select
                value={draft.synthesizerModelId}
                onChange={(e) => setDraft({ ...draft, synthesizerModelId: e.target.value })}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
              >
                {draft.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label || m.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4 bg-zinc-900/70">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_ENSEMBLE_CONFIG })}
            className="text-xs text-zinc-400 hover:text-white cursor-pointer"
          >
            Reset
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              data-testid="save-multimodel-btn"
              onClick={() => {
                onSave(draft);
                onClose();
              }}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
            >
              Save Model Team
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface BrawlArenaHudProps {
  brawlState: BrawlCombatState;
  onChangeTriggerMode: (mode: BrawlTriggerMode) => void;
  onEndBattle: () => void;
  onDismissSummary: () => void;
  onQuickMove: (move: BrawlMoveType, suggestedText: string) => void;
}

export const BrawlArenaHud: React.FC<BrawlArenaHudProps> = ({
  brawlState,
  onChangeTriggerMode,
  onEndBattle,
  onDismissSummary,
  onQuickMove,
}) => {
  if (!brawlState.active && (!brawlState.outcome || brawlState.outcome === 'ongoing')) {
    return null;
  }

  const playerHpPct = Math.max(0, Math.min(100, Math.round((brawlState.player.hp / brawlState.player.maxHp) * 100)));
  const oppHpPct = Math.max(0, Math.min(100, Math.round((brawlState.opponent.hp / brawlState.opponent.maxHp) * 100)));
  const playerStaPct = Math.max(0, Math.min(100, Math.round((brawlState.player.stamina / brawlState.player.maxStamina) * 100)));
  const oppStaPct = Math.max(0, Math.min(100, Math.round((brawlState.opponent.stamina / brawlState.opponent.maxStamina) * 100)));

  if (!brawlState.active && brawlState.outcome && brawlState.outcome !== 'ongoing') {
    return (
      <div
        data-testid="brawl-arena-hud"
        className="relative z-10 border-b border-amber-500/40 bg-zinc-950/95 px-4 sm:px-6 py-2.5 text-xs"
      >
        <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-amber-200 font-semibold">
            <Trophy className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Text Fight Finished ({brawlState.outcome.toUpperCase()} after {Math.max(1, brawlState.round - 1)} round{brawlState.round > 2 ? 's' : ''})
            </span>
            <span className="text-zinc-400 font-normal hidden sm:inline">
              · {brawlState.log[brawlState.log.length - 1] || 'Returning to normal roleplay.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onDismissSummary}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:text-white cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  const quickMoves: Array<{
    move: BrawlMoveType;
    label: string;
    prompt: string;
    icon: React.ReactNode;
  }> = [
    {
      move: 'strike',
      label: 'Strike',
      icon: <Swords className="h-3 w-3 text-rose-400" />,
      prompt: `*I surge forward and launch a crisp strike straight toward ${brawlState.opponent.name}!*`,
    },
    {
      move: 'combo',
      label: 'Combo',
      icon: <Zap className="h-3 w-3 text-amber-300" />,
      prompt: `*I chain a rapid three-hit combination—feint left, pivot low, and drive a sweeping strike!*`,
    },
    {
      move: 'guard',
      label: 'Guard & Counter',
      icon: <Shield className="h-3 w-3 text-sky-400" />,
      prompt: `*I raise my guard tightly, absorbing the momentum and preparing an immediate riposte.*`,
    },
    {
      move: 'dodge',
      label: 'Evade',
      icon: <Zap className="h-3 w-3 text-emerald-400" />,
      prompt: `*I read the telegraph and sidestep smoothly out of reach, pivoting to flank!*`,
    },
    {
      move: 'special',
      label: 'Finisher',
      icon: <Swords className="h-3 w-3 text-fuchsia-400" />,
      prompt: `*Focusing every ounce of stamina, I unleash my signature finishing technique!*`,
    },
    {
      move: 'recover',
      label: 'Recover',
      icon: <Heart className="h-3 w-3 text-emerald-300" />,
      prompt: `*I create breathing room, steady my stance, and catch my breath to recover stamina.*`,
    },
  ];

  return (
    <div
      data-testid="brawl-arena-hud"
      className="relative z-10 border-b border-rose-500/40 bg-gradient-to-r from-zinc-950 via-rose-950/20 to-zinc-950 px-4 sm:px-6 py-3 backdrop-blur-md"
    >
      <div className="mx-auto max-w-4xl space-y-2.5">
        {/* Top Row: Brawl Header + Round + Trigger Mode + End Fight */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="font-bold text-white">Text Fighting Arena</span>
            <span className="font-mono tabular-nums text-[11px] text-amber-300">
              Round {brawlState.round} · Streak {brawlState.comboStreak}x
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Text Fight Trigger Mode"
              value={brawlState.triggerMode}
              onChange={(e) => onChangeTriggerMode(e.target.value as BrawlTriggerMode)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] font-semibold text-zinc-200 focus:border-rose-500 focus:outline-none"
            >
              <option value="auto">Trigger: Auto on Combat</option>
              <option value="manual">Trigger: Manual Only</option>
              <option value="off">Trigger: Off</option>
            </select>
            <button
              type="button"
              data-testid="brawl-end-btn"
              onClick={onEndBattle}
              className="flex items-center gap-1 rounded-lg border border-rose-500/50 bg-rose-600/25 px-2.5 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-600/40 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-3 w-3" />
              <span>End Fight</span>
            </button>
          </div>
        </div>

        {/* Combatant Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Player Fighter */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-300 truncate">{brawlState.player.name}</span>
              <span className="font-mono tabular-nums text-[11px] text-zinc-300">
                HP {brawlState.player.hp}/{brawlState.player.maxHp} · STA {brawlState.player.stamina}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${playerHpPct}%` }}
              />
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-sky-400 transition-all duration-300"
                style={{ width: `${playerStaPct}%` }}
              />
            </div>
          </div>

          {/* Opponent Fighter */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-rose-300 truncate">{brawlState.opponent.name}</span>
              <span className="font-mono tabular-nums text-[11px] text-zinc-300">
                HP {brawlState.opponent.hp}/{brawlState.opponent.maxHp} · STA {brawlState.opponent.stamina}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${oppHpPct}%` }}
              />
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${oppStaPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Text-Fighting Move Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {quickMoves.map((m) => (
              <button
                key={m.move}
                type="button"
                data-testid={`brawl-move-${m.move}`}
                onClick={() => onQuickMove(m.move, m.prompt)}
                className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-zinc-200 hover:border-rose-500/60 hover:bg-zinc-800 cursor-pointer whitespace-nowrap"
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>
          {brawlState.log.length > 0 && (
            <span className="text-[11px] text-zinc-400 truncate max-w-sm">
              {brawlState.log[brawlState.log.length - 1]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
