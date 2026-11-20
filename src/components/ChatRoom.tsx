import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  BrainCircuit,
  Globe,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Edit2,
  Trash2,
  Settings2,
  User,
  Info,
  BookOpen,
  Square,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Palette,
  Sliders,
  MessageSquare,
  GitBranch,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Box,
  RefreshCw,
  PlusCircle,
  List,
  Eye,
  Save,
  X,
  Users,
  Layers,
  Swords,
} from 'lucide-react';
import {
  BrawlCombatState,
  BrawlTriggerMode,
  Character,
  ChatMessage,
  ChatSession,
  ChubChatSettings,
  GroupParticipant,
  ModelEnsembleConfig,
} from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { formatRoleplaySegments, exportTavernCard } from '../utils/characterUtils.ts';
import { Stage } from './StagesManager.tsx';
import { ChatTreeModal } from './ChatTreeModal.tsx';
import { ChubSettingsModal, DEFAULT_CHUB_SETTINGS } from './ChubSettingsModal.tsx';
import {
  classifyHttpApiError,
  isChubUrlOrProvider,
  isLocalProviderOrUrl,
  safeParseJsonResponse,
  tryBrowserExternalCompletion,
} from '../utils/apiErrorUtils.ts';
import { isBuiltInFreeProvider } from '../utils/chubOptions.ts';
import { ThreeAvatarViewer } from './ThreeAvatarViewer.tsx';
import { ViewportSlot } from './ViewportSlot.tsx';
import { mergeGlobalActiveLorebook } from '../utils/communityUtils.ts';
import {
  BrawlArenaHud,
  GroupRosterModal,
  MultiModelModal,
} from './ChatCollaborationPanels.tsx';
import {
  type BrawlMoveType,
  type ResponderSelectionMode,
  addParticipantToRoster,
  createInitialBrawlState,
  detectCombatTrigger,
  inferBrawlMoveFromText,
  normalizeEnsembleConfig,
  removeParticipantFromRoster,
  resolveBrawlExchange,
  toGroupParticipant,
} from '../utils/chatOrchestration.ts';
import { playTTSResponseData, stopActiveTTSPlayback } from '../utils/ttsPlayer.ts';
import { applyEditedSwipe, normalizeEditedMessageText } from '../utils/customVoiceUtils.ts';
import {
  computeCascadeMessageDeletion,
  shouldFallbackToBuiltInFreeOnExternalError,
} from '../utils/chatMemoryUtils.ts';
import {
  CHUB_SETTINGS_STORAGE_KEY,
  PRESETS_STORAGE_KEY,
  PRESETS_UPDATED_EVENT,
  hydrateChatSettingsOnSessionLoad,
  mergeSettingsFromPresets,
  resolveEffectiveChatApiConfig,
} from '../utils/settingsSync.ts';
import { ensureNonEmptyRoleplayReply } from '../utils/roleplayEngine.ts';

interface ChatRoomProps {
  character: Character;
  activeStage?: Stage | null;
  initialSessionUuid?: string;
  startNewChat?: boolean;
  greetingOverride?: string;
  onBack: () => void;
  onViewCharacterDetails: (char: Character) => void;
  onOpenPersonaModal: () => void;
  onOpenPresets?: () => void;
  onOpenStages?: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  character,
  activeStage,
  initialSessionUuid,
  startNewChat,
  greetingOverride,
  onBack,
  onViewCharacterDetails,
  onOpenPersonaModal,
  onOpenPresets,
  onOpenStages,
}) => {
  const { user, guestId, persona, getIdToken } = useAuth();

  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [swipingId, setSwipingId] = useState<number | null>(null);

  // Modals & Navigation
  const [isChatTreeOpen, setIsChatTreeOpen] = useState(false);
  const [isChubSettingsOpen, setIsChubSettingsOpen] = useState(false);
  const [isAllChatsOpen, setIsAllChatsOpen] = useState(false);
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [preview3dPose, setPreview3dPose] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isMultiModelModalOpen, setIsMultiModelModalOpen] = useState(false);

  // Chub Chat Settings (hydrated cleanly from defaults + saved presets + saved settings)
  const [chubSettings, setChubSettings] = useState<ChubChatSettings>(() => {
    try {
      const savedSettingsRaw = localStorage.getItem(CHUB_SETTINGS_STORAGE_KEY);
      const savedPresetsRaw = localStorage.getItem(PRESETS_STORAGE_KEY);
      return hydrateChatSettingsOnSessionLoad({
        defaults: DEFAULT_CHUB_SETTINGS,
        localSettings: savedSettingsRaw ? JSON.parse(savedSettingsRaw) : null,
        localPresets: savedPresetsRaw ? JSON.parse(savedPresetsRaw) : null,
      });
    } catch {}
    return DEFAULT_CHUB_SETTINGS;
  });

  // Group Chat Roster & Speaker Picker State
  const [roster, setRoster] = useState<GroupParticipant[]>(() => [
    toGroupParticipant(character, true),
  ]);
  const [responderMode, setResponderMode] = useState<ResponderSelectionMode>('auto');
  const [selectedResponderUuid, setSelectedResponderUuid] = useState<string | null>(
    character.uuid
  );

  // Multi-Model Collaboration State
  const [ensembleConfig, setEnsembleConfig] = useState<ModelEnsembleConfig>(() =>
    normalizeEnsembleConfig(chubSettings.ensembleConfig)
  );

  // BrawlChat.ai Text-Fighting Arena State
  const [brawlState, setBrawlState] = useState<BrawlCombatState>(() =>
    createInitialBrawlState(persona.name, character.name, 'auto', null)
  );

  const getEffectiveApiPayload = () => {
    let presetsData: any = null;
    try {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (raw) presetsData = JSON.parse(raw);
    } catch {}

    let localSettings: any = null;
    try {
      const rawSettings = localStorage.getItem(CHUB_SETTINGS_STORAGE_KEY);
      if (rawSettings) localSettings = JSON.parse(rawSettings);
    } catch {}

    return resolveEffectiveChatApiConfig({
      defaults: DEFAULT_CHUB_SETTINGS,
      liveSettings: chubSettings,
      localSettings,
      localPresets: presetsData,
      isBuiltInFreeFn: isBuiltInFreeProvider,
    });
  };

  // Scenario AI Images Toggle
  const [showAiImages, setShowAiImages] = useState<boolean>(() => {
    return localStorage.getItem('palace_show_ai_images') === 'true';
  });

  // Chat Long-Term Summary System
  const [chatSummary, setChatSummary] = useState<string>('');
  const [unsavedCount, setUnsavedCount] = useState<number>(0);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summarySavedNotice, setSummarySavedNotice] = useState<boolean>(false);

  // AI Persona Reaction State ("What would persona do/think?")
  const [personaReaction, setPersonaReaction] = useState<{
    thought: string;
    action: string;
    dialogue: string;
    suggestedReply: string;
  } | null>(null);
  const [generatingReaction, setGeneratingReaction] = useState<boolean>(false);

  // Settings
  const [thinkingLevel, setThinkingLevel] = useState<'HIGH' | 'OFF'>(
    character.thinkingDefault ? 'HIGH' : 'OFF'
  );
  const [searchGrounding, setSearchGrounding] = useState<boolean>(character.searchDefault);
  const [selectedVoice, setSelectedVoice] = useState<string>(character.voiceName || 'Puck');

  // Audio state
  const [activeAudioMessageId, setActiveAudioMessageId] = useState<number | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // Expanded thinking boxes
  const [expandedThinking, setExpandedThinking] = useState<Record<number, boolean>>({});

  // Copied message state
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Inline Message Editing State
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Cascade Message Deletion & Credit-Limit Free Fallback Notice
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<number | null>(null);
  const [deletingMsgId, setDeletingMsgId] = useState<number | null>(null);
  const [externalFallbackNotice, setExternalFallbackNotice] = useState<string | null>(null);

  // Alternate Greetings calculation
  const parsedAlternateGreetings: string[] = useMemo(() => {
    if (Array.isArray(character.alternateGreetings)) {
      return character.alternateGreetings;
    }
    if (typeof character.alternateGreetings === 'string') {
      try {
        const parsed = JSON.parse(character.alternateGreetings);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [character.alternateGreetings]);

  const allGreetings = useMemo(() => {
    return [character.greeting, ...parsedAlternateGreetings].filter((g) => g && g.trim());
  }, [character.greeting, parsedAlternateGreetings]);

  const [activeGreetingIndex, setActiveGreetingIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Load or create chat session
  useEffect(() => {
    const initSession = async () => {
      try {
        setLoading(true);
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        let targetUuid = initialSessionUuid;

        if (!targetUuid) {
          const endpoint =
            startNewChat || greetingOverride ? '/api/chat/session/new' : '/api/chat/session';
          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              characterUuid: character.uuid,
              guestId,
              greetingOverride,
            }),
          });

          if (!res.ok) throw new Error('Failed to initialize session');
          const data = await res.json();
          setSession(data.session);
          setChatSummary(data.session.summary || '');
          setUnsavedCount(data.session.unsavedMessageCount || 0);
          if (data.session.showAiImages !== undefined) {
            setShowAiImages(Boolean(data.session.showAiImages));
          }
          targetUuid = data.session.uuid;
        }

        // Fetch full messages
        const sessRes = await fetch(`/api/chat/session/${targetUuid}`);
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setMessages(sessData.messages || []);
          if (sessData.session) {
            setSession(sessData.session);
            setThinkingLevel(
              sessData.session.thinkingLevel || (character.thinkingDefault ? 'HIGH' : 'OFF')
            );
            setSearchGrounding(Boolean(sessData.session.searchGrounding));
            setChatSummary(sessData.session.summary || '');
            setUnsavedCount(sessData.session.unsavedMessageCount || 0);
            if (sessData.session.showAiImages !== undefined) {
              setShowAiImages(Boolean(sessData.session.showAiImages));
            }
            // Hydrate ALL Chub chatSettings (model, provider, toggles, promptNote, sliders, roster, multi-model, BrawlChat)
            try {
              const savedChatCfg =
                typeof sessData.session.chatSettings === 'string'
                  ? JSON.parse(sessData.session.chatSettings || '{}')
                  : sessData.session.chatSettings || {};

              let localSettings: any = null;
              let localPresets: any = null;
              try {
                const rawSet = localStorage.getItem(CHUB_SETTINGS_STORAGE_KEY);
                if (rawSet) localSettings = JSON.parse(rawSet);
                const rawPre = localStorage.getItem(PRESETS_STORAGE_KEY);
                if (rawPre) localPresets = JSON.parse(rawPre);
              } catch {}

              const hydratedSettings = hydrateChatSettingsOnSessionLoad({
                defaults: DEFAULT_CHUB_SETTINGS,
                localSettings,
                localPresets,
                sessionChatSettings: savedChatCfg,
              });
              setChubSettings(hydratedSettings);
              try {
                localStorage.setItem(CHUB_SETTINGS_STORAGE_KEY, JSON.stringify(hydratedSettings));
              } catch {}

              if (Array.isArray(hydratedSettings.groupParticipants) && hydratedSettings.groupParticipants.length > 0) {
                setRoster(hydratedSettings.groupParticipants);
              } else {
                setRoster([toGroupParticipant(character, true)]);
              }
              if (hydratedSettings.responderMode) setResponderMode(hydratedSettings.responderMode as any);
              if (hydratedSettings.selectedResponderUuid !== undefined) {
                setSelectedResponderUuid(hydratedSettings.selectedResponderUuid || character.uuid);
              }
              if (hydratedSettings.ensembleConfig) {
                setEnsembleConfig(normalizeEnsembleConfig(hydratedSettings.ensembleConfig));
              }
              if (hydratedSettings.brawlState) {
                setBrawlState(hydratedSettings.brawlState);
              } else {
                setBrawlState(createInitialBrawlState(persona.name, character.name, 'auto', null));
              }
            } catch {
              setRoster([toGroupParticipant(character, true)]);
            }
          }
        }
      } catch (err) {
        console.error('Session init error:', err);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [character.uuid, guestId, initialSessionUuid, startNewChat, greetingOverride]);

  // Live sync whenever PresetsModal or ChubSettingsModal broadcasts updated presets/settings
  useEffect(() => {
    const onPresetsUpdated = (e: any) => {
      const updatedPresets = e?.detail;
      if (!updatedPresets || typeof updatedPresets !== 'object') return;
      setChubSettings((prev) => {
        const merged = mergeSettingsFromPresets(prev, updatedPresets);
        try {
          localStorage.setItem(CHUB_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        } catch {}
        if (session?.uuid) {
          fetch(`/api/chat/settings/${session.uuid}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatSettings: merged,
              thinkingLevel: updatedPresets.highThinking ? 'HIGH' : thinkingLevel,
              searchGrounding:
                typeof updatedPresets.searchGrounding === 'boolean'
                  ? updatedPresets.searchGrounding
                  : searchGrounding,
            }),
          }).catch(() => {});
        }
        return merged;
      });
      if (typeof updatedPresets.highThinking === 'boolean') {
        setThinkingLevel(updatedPresets.highThinking ? 'HIGH' : 'OFF');
      }
      if (typeof updatedPresets.searchGrounding === 'boolean') {
        setSearchGrounding(updatedPresets.searchGrounding);
      }
      if (updatedPresets.voiceName) {
        setSelectedVoice(updatedPresets.voiceName);
      }
    };
    window.addEventListener(PRESETS_UPDATED_EVENT, onPresetsUpdated);
    return () => window.removeEventListener(PRESETS_UPDATED_EVENT, onPresetsUpdated);
  }, [session?.uuid, thinkingLevel, searchGrounding]);

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length]);

  // Fetch all chat sessions for this character
  const fetchAllSessions = async () => {
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/chat/character/${character.uuid}/all?guestId=${guestId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAllSessions(data.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch character sessions:', err);
    }
  };

  // Create clean new parallel session
  const handleCreateNewSession = async (greetingOverride?: string) => {
    try {
      setLoading(true);
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/chat/session/new', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          characterUuid: character.uuid,
          guestId,
          greetingOverride,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSession(data.session);
        setChatSummary('');
        setUnsavedCount(0);
        const sessRes = await fetch(`/api/chat/session/${data.session.uuid}`);
        if (sessRes.ok) {
          const sessData = await sessRes.json();
          setMessages(sessData.messages || []);
        } else {
          const initGreet = greetingOverride || character.greeting;
          setMessages([
            {
              id: Date.now(),
              sessionId: data.session.uuid,
              sender: 'character',
              content: initGreet,
              swipes: [initGreet],
              activeSwipeIndex: 0,
            },
          ]);
        }
        persistSessionCollaboration({ baseSettings: chubSettings });
        setIsAllChatsOpen(false);
      }
    } catch (err) {
      console.error('Failed to create new session:', err);
    } finally {
      setLoading(false);
    }
  };

  // Switch to another session
  const handleSwitchSession = async (targetSession: ChatSession) => {
    try {
      setLoading(true);
      setSession(targetSession);
      setChatSummary(targetSession.summary || '');
      setUnsavedCount(targetSession.unsavedMessageCount || 0);

      const sessRes = await fetch(`/api/chat/session/${targetSession.uuid}`);
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setMessages(sessData.messages || []);
        if (sessData.session?.chatSettings) {
          let localSettings: any = null;
          let localPresets: any = null;
          try {
            const rawSet = localStorage.getItem(CHUB_SETTINGS_STORAGE_KEY);
            if (rawSet) localSettings = JSON.parse(rawSet);
            const rawPre = localStorage.getItem(PRESETS_STORAGE_KEY);
            if (rawPre) localPresets = JSON.parse(rawPre);
          } catch {}
          const hydrated = hydrateChatSettingsOnSessionLoad({
            defaults: DEFAULT_CHUB_SETTINGS,
            localSettings,
            localPresets,
            sessionChatSettings: sessData.session.chatSettings,
          });
          setChubSettings(hydrated);
          if (Array.isArray(hydrated.groupParticipants) && hydrated.groupParticipants.length > 0) {
            setRoster(hydrated.groupParticipants);
          }
          if (hydrated.ensembleConfig) {
            setEnsembleConfig(normalizeEnsembleConfig(hydrated.ensembleConfig));
          }
          if (hydrated.brawlState) {
            setBrawlState(hydrated.brawlState);
          }
        }
      }
      setIsAllChatsOpen(false);
    } catch (err) {
      console.error('Failed to switch session:', err);
    } finally {
      setLoading(false);
    }
  };

  // Chat Summarization Handlers
  const handleSaveSummary = async (newSummaryText: string) => {
    if (!session) return;
    try {
      const res = await fetch('/api/chat/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid: session.uuid,
          manualSummary: newSummaryText,
        }),
      });
      if (res.ok) {
        setChatSummary(newSummaryText);
        setUnsavedCount(0);
        setSummarySavedNotice(true);
        setTimeout(() => setSummarySavedNotice(false), 2500);
      }
    } catch (err) {
      console.error('Save summary failed:', err);
    }
  };

  const handleAutoSummarize = async () => {
    if (!session || messages.length === 0) return;
    try {
      setIsSummarizing(true);
      const res = await fetch('/api/chat/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid: session.uuid,
          characterName: character.name,
          personaName: persona.name,
          messages: messages.map((m) => ({ sender: m.sender, content: m.content })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatSummary(data.summary || '');
        setUnsavedCount(0);
        setIsSummaryExpanded(true);
        setSummarySavedNotice(true);
        setTimeout(() => setSummarySavedNotice(false), 3000);
      }
    } catch (err) {
      console.error('Auto summarize failed:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // AI Persona Reaction Generator ("What would persona do/think?")
  const handleGeneratePersonaReaction = async () => {
    const lastCharMsg = [...messages].reverse().find((m) => m.sender === 'character');
    if (!lastCharMsg) return;

    try {
      setGeneratingReaction(true);
      const res = await fetch('/api/persona/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona,
          characterName: character.name,
          lastMessage: lastCharMsg.content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPersonaReaction(data);
      }
    } catch (err) {
      console.error('Generate persona reaction failed:', err);
    } finally {
      setGeneratingReaction(false);
    }
  };

  // Sync settings when changed
  const updateSettings = async (newThinking: 'HIGH' | 'OFF', newSearch: boolean) => {
    setThinkingLevel(newThinking);
    setSearchGrounding(newSearch);
    if (!session) return;

    try {
      await fetch(`/api/chat/settings/${session.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thinkingLevel: newThinking,
          searchGrounding: newSearch,
          modelPreference: newThinking === 'HIGH' ? 'gemini-4-argon' : 'gemini-3.8-flash',
          showAiImages,
        }),
      });
    } catch (err) {
      console.error('Failed to sync chat settings:', err);
    }
  };

  // Toggle Show AI Images
  const handleToggleAiImages = () => {
    const nextVal = !showAiImages;
    setShowAiImages(nextVal);
    localStorage.setItem('palace_show_ai_images', String(nextVal));
    if (session) {
      fetch(`/api/chat/settings/${session.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showAiImages: nextVal }),
      }).catch(console.error);
    }
  };

  // Switch Alternate Greeting on the first message
  const handleSwitchGreeting = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= allGreetings.length) return;
    setActiveGreetingIndex(newIndex);
    const chosenGreeting = allGreetings[newIndex];
    const firstMsg = messages[0];

    setMessages((prev) => {
      if (prev.length === 0) return prev;
      return [
        {
          ...prev[0],
          content: chosenGreeting,
          swipes: [chosenGreeting],
          activeSwipeIndex: 0,
        },
        ...prev.slice(1),
      ];
    });

    if (session?.uuid && firstMsg?.id && firstMsg.id < 1_000_000_000_000) {
      fetch(`/api/chat/message/${firstMsg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionUuid: session.uuid,
          content: chosenGreeting,
        }),
      }).catch(console.error);
    }
  };

  // Persist Group Roster, Multi-Model Config, BrawlState, & ChubSettings onto chatSettings DB
  const persistSessionCollaboration = async (overrides: {
    baseSettings?: ChubChatSettings;
    groupParticipants?: GroupParticipant[];
    responderMode?: ResponderSelectionMode;
    selectedResponderUuid?: string | null;
    ensembleConfig?: ModelEnsembleConfig;
    brawlState?: BrawlCombatState;
  }) => {
    const base = overrides.baseSettings ?? chubSettings;
    const nextSettings: ChubChatSettings = {
      ...base,
      groupParticipants: overrides.groupParticipants ?? base.groupParticipants ?? roster,
      responderMode: overrides.responderMode ?? base.responderMode ?? responderMode,
      selectedResponderUuid:
        overrides.selectedResponderUuid !== undefined
          ? overrides.selectedResponderUuid
          : base.selectedResponderUuid !== undefined
            ? base.selectedResponderUuid
            : selectedResponderUuid,
      ensembleConfig: overrides.ensembleConfig ?? base.ensembleConfig ?? ensembleConfig,
      brawlState: overrides.brawlState ?? base.brawlState ?? brawlState,
    };
    setChubSettings(nextSettings);
    try {
      localStorage.setItem(CHUB_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    } catch {}
    if (session?.uuid) {
      fetch(`/api/chat/settings/${session.uuid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatSettings: nextSettings }),
      }).catch(console.error);
    }
  };

  const handleAddGroupParticipant = (charToAdd: Character) => {
    const nextRoster = addParticipantToRoster(roster, toGroupParticipant(charToAdd, false));
    setRoster(nextRoster);
    persistSessionCollaboration({ groupParticipants: nextRoster });
  };

  const handleRemoveGroupParticipant = (uuidToRemove: string) => {
    const { nextRoster, removed } = removeParticipantFromRoster(roster, uuidToRemove);
    if (!removed) return;
    const nextSelected =
      selectedResponderUuid === uuidToRemove ? nextRoster[0]?.uuid || character.uuid : selectedResponderUuid;
    const nextMode =
      selectedResponderUuid === uuidToRemove && responderMode === 'specific' ? 'auto' : responderMode;
    setRoster(nextRoster);
    setSelectedResponderUuid(nextSelected);
    setResponderMode(nextMode);
    persistSessionCollaboration({
      groupParticipants: nextRoster,
      selectedResponderUuid: nextSelected,
      responderMode: nextMode,
    });
  };

  const handleToggleParticipantMute = (uuid: string) => {
    const nextRoster = roster.map((p) => (p.uuid === uuid ? { ...p, muted: !p.muted } : p));
    setRoster(nextRoster);
    persistSessionCollaboration({ groupParticipants: nextRoster });
  };

  const handleChangeResponderMode = (
    nextMode: ResponderSelectionMode,
    nextUuid?: string | null
  ) => {
    const resolvedUuid = nextUuid !== undefined ? nextUuid : selectedResponderUuid;
    setResponderMode(nextMode);
    setSelectedResponderUuid(resolvedUuid);
    persistSessionCollaboration({
      responderMode: nextMode,
      selectedResponderUuid: resolvedUuid,
    });
  };

  const handleSaveEnsemble = (nextEnsemble: ModelEnsembleConfig) => {
    const normalized = normalizeEnsembleConfig(nextEnsemble);
    setEnsembleConfig(normalized);
    persistSessionCollaboration({ ensembleConfig: normalized });
  };

  const getActiveOpponentName = () => {
    const picked = roster.find((p) => p.uuid === selectedResponderUuid);
    return picked?.name || character.name;
  };

  const handleToggleBrawlManual = () => {
    if (brawlState.active) {
      const ended: BrawlCombatState = {
        ...brawlState,
        active: false,
        outcome: 'truce',
        log: [...brawlState.log, `Fight ended manually — returning to normal roleplay.`].slice(-12),
      };
      setBrawlState(ended);
      persistSessionCollaboration({ brawlState: ended });
    } else {
      const started = createInitialBrawlState(
        persona.name,
        getActiveOpponentName(),
        brawlState.triggerMode === 'off' ? 'manual' : brawlState.triggerMode,
        'manual'
      );
      setBrawlState(started);
      persistSessionCollaboration({ brawlState: started });
    }
  };

  const handleChangeBrawlTriggerMode = (nextMode: BrawlTriggerMode) => {
    const updated: BrawlCombatState = {
      ...brawlState,
      triggerMode: nextMode,
      ...(nextMode === 'off' && brawlState.active ? { active: false, outcome: 'truce' } : {}),
    };
    setBrawlState(updated);
    persistSessionCollaboration({ brawlState: updated });
  };

  // Send message (or prompt a specific speaker directly without typing user text)
  const handleSendMessage = async (
    textToSend?: string,
    opts?: {
      triggerWithoutUserMessage?: boolean;
      explicitMoveType?: BrawlMoveType;
      explicitResponderUuid?: string;
    }
  ) => {
    const triggerOnly = Boolean(opts?.triggerWithoutUserMessage);
    const text = textToSend !== undefined ? textToSend : inputText;
    if ((!text.trim() && !triggerOnly) || sending || !session) return;

    const userText = text.trim();
    if (!triggerOnly) setInputText('');
    setPersonaReaction(null);
    setSending(true);

    // Advance BrawlChat Text Fighting State (Auto or Manual)
    let nextBrawlState = brawlState;
    if (userText) {
      if (brawlState.triggerMode === 'auto') {
        const signal = detectCombatTrigger(userText, brawlState.active);
        if (signal === 'start') {
          const fresh = createInitialBrawlState(
            persona.name,
            getActiveOpponentName(),
            'auto',
            'auto'
          );
          nextBrawlState = resolveBrawlExchange(
            fresh,
            opts?.explicitMoveType || inferBrawlMoveFromText(userText),
            userText
          );
        } else if (signal === 'end') {
          nextBrawlState = {
            ...brawlState,
            active: false,
            outcome: 'truce',
            log: [...brawlState.log, `Fight concluded peacefully — returning to normal RP.`].slice(-12),
          };
        } else if (brawlState.active) {
          nextBrawlState = resolveBrawlExchange(
            brawlState,
            opts?.explicitMoveType || inferBrawlMoveFromText(userText),
            userText
          );
        }
      } else if (brawlState.active) {
        nextBrawlState = resolveBrawlExchange(
          brawlState,
          opts?.explicitMoveType || inferBrawlMoveFromText(userText),
          userText
        );
      }
      if (nextBrawlState !== brawlState) {
        setBrawlState(nextBrawlState);
      }
    }

    const lastMsg = messages[messages.length - 1];
    const tempUserMsg: ChatMessage | null = triggerOnly
      ? null
      : {
          id: Date.now(),
          sessionId: session.uuid,
          sender: 'user',
          content: userText,
          parentId: lastMsg ? lastMsg.id : null,
          createdAt: new Date().toISOString(),
        };
    if (tempUserMsg) {
      setMessages((prev) => [...prev, tempUserMsg]);
    }

    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const { chubApiKey, chubApiUrl, mergedSettings } = getEffectiveApiPayload();
      const effectiveSettings: ChubChatSettings = {
        ...mergedSettings,
        groupParticipants: roster,
        responderMode,
        selectedResponderUuid,
        ensembleConfig,
        brawlState: nextBrawlState,
      };

      let preGeneratedReply: string | undefined;
      let preGeneratedModelUsed: string | undefined;
      let fallbackToBuiltInFree = false;

      const isSingleStandardSpeaker =
        roster.length <= 1 && !ensembleConfig.enabled && !nextBrawlState.active && !triggerOnly;
      const shouldTryBrowserDirect =
        isSingleStandardSpeaker &&
        effectiveSettings.apiProvider &&
        !isBuiltInFreeProvider(effectiveSettings.apiProvider) &&
        (Boolean(chubApiKey) || isLocalProviderOrUrl(effectiveSettings.apiProvider, chubApiUrl)) &&
        (isChubUrlOrProvider(effectiveSettings.apiProvider, chubApiUrl) ||
          isLocalProviderOrUrl(effectiveSettings.apiProvider, chubApiUrl));

      const activeGlobalLoreRaw = localStorage.getItem('palace_active_lorebook');
      const personaLoreRaw = persona.lorebook || null;
      const effectiveLorebook = mergeGlobalActiveLorebook(
        character.lorebook,
        activeGlobalLoreRaw,
        personaLoreRaw
      );

      if (shouldTryBrowserDirect) {
        const directRes = await tryBrowserExternalCompletion({
          character: {
            name: character.name,
            tagline: character.tagline,
            description: character.description,
            personality: character.personality,
            systemPrompt: character.systemPrompt,
            postHistoryInstructions: character.postHistoryInstructions,
            scenario: character.scenario,
            exampleDialogues: character.exampleDialogues,
            lorebook: effectiveLorebook,
            userPersona: `${persona.name}: ${persona.bio}`,
          },
          history: messages.map((m) => ({
            sender: m.sender as 'user' | 'character' | 'system',
            content: m.content,
          })),
          userMessage: userText,
          chatSummary,
          apiProvider: effectiveSettings.apiProvider,
          apiUrl: chubApiUrl,
          apiKey: chubApiKey,
          model: effectiveSettings.model,
          chatSettings: effectiveSettings,
        });

        if (directRes.ok) {
          preGeneratedReply = directRes.reply;
          preGeneratedModelUsed = directRes.modelUsed;
          setExternalFallbackNotice(null);
        } else if (
          shouldFallbackToBuiltInFreeOnExternalError(directRes.error.code, directRes.error.status)
        ) {
          // Never block roleplay on external credit/quota limits (e.g. Chub 429 "You are out of credits")
          fallbackToBuiltInFree = true;
          const isCreditOrQuota =
            directRes.error.code === 'RATE_LIMITED' ||
            directRes.error.code === 'PAYMENT_REQUIRED' ||
            directRes.error.status === 429 ||
            directRes.error.status === 402;
          setExternalFallbackNotice(
            isCreditOrQuota
              ? `Your external API key hit a credit/rate limit (${directRes.error.message}) — seamlessly continuing via Palace Unlimited Free Engine with zero credit limits!`
              : `External endpoint unavailable (${directRes.error.code}) — seamlessly continuing via Palace Unlimited Free Engine!`
          );
        } else if (
          directRes.error.code === 'UNAUTHORIZED' ||
          directRes.error.code === 'BAD_REQUEST' ||
          directRes.error.code === 'CONNECTION_REFUSED'
        ) {
          throw new Error(directRes.error.message);
        }
      }

      const targetUuidForSend =
        opts?.explicitResponderUuid ||
        (responderMode === 'specific' ? selectedResponderUuid || character.uuid : undefined);

      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionUuid: session.uuid,
          content: userText,
          userPersona: `${persona.name}: ${persona.bio}`,
          parentId: lastMsg ? lastMsg.id : null,
          chatSettings: effectiveSettings,
          chubApiKey,
          chubApiUrl,
          showAiImages,
          extraLorebook: activeGlobalLoreRaw,
          personaLorebook: personaLoreRaw,
          preGeneratedReply,
          preGeneratedModelUsed,
          respondingCharacterUuid: targetUuidForSend,
          triggerWithoutUserMessage: triggerOnly,
          ensembleConfig,
          brawlState: nextBrawlState,
          fallbackToBuiltInFree,
        }),
      });

      const parsed = await safeParseJsonResponse(res);
      if (!res.ok || !parsed.data) {
        if (parsed.data?.error) {
          throw new Error(parsed.data.error);
        }
        const classified = classifyHttpApiError({
          status: res.status,
          statusText: res.statusText,
          rawBody: parsed.rawText,
          contentType: res.headers.get('content-type'),
          endpoint: '/api/chat/message',
        });
        throw new Error(classified.message);
      }

      const data = parsed.data;
      const newReplies: ChatMessage[] = Array.isArray(data.generatedMessages)
        ? data.generatedMessages
        : data.characterMessage
          ? [data.characterMessage]
          : [];

      setMessages((prev) => {
        const cleaned = tempUserMsg ? prev.filter((m) => m.id !== tempUserMsg.id) : prev;
        return [
          ...cleaned,
          ...(data.userMessage ? [data.userMessage] : []),
          ...newReplies,
        ];
      });
      setUnsavedCount((prev) => prev + (data.userMessage ? 1 : 0) + newReplies.length);

      if (nextBrawlState !== brawlState) {
        persistSessionCollaboration({ brawlState: nextBrawlState });
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sessionId: session.uuid,
          sender: 'system',
          content: `*A magical tremor interferes with the connection (${err.message}). Continuing story...*`,
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollToBottom(), 100);
    }
  };

  // Swipe / Alternate generation
  const handleSwipe = async (messageId: number, direction: 'prev' | 'next') => {
    if (!session || swipingId) return;

    const target = messages.find((m) => m.id === messageId);
    if (!target || !target.swipes) return;

    const currentIdx = target.activeSwipeIndex || 0;
    const swipesList = target.swipes;

    if (direction === 'prev') {
      if (currentIdx > 0) {
        const newIdx = currentIdx - 1;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, activeSwipeIndex: newIdx, content: swipesList[newIdx] }
              : m
          )
        );
        fetch('/api/chat/swipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionUuid: session.uuid,
            messageId,
            generateNew: false,
            targetIndex: newIdx,
          }),
        }).catch(console.error);
      }
    } else {
      if (currentIdx >= swipesList.length - 1) {
        try {
          setSwipingId(messageId);
          const { chubApiKey, chubApiUrl, mergedSettings } = getEffectiveApiPayload();
          let preGeneratedReply: string | undefined;
          let fallbackToBuiltInFree = false;

          const shouldTryBrowserDirect =
            mergedSettings.apiProvider &&
            !isBuiltInFreeProvider(mergedSettings.apiProvider) &&
            (Boolean(chubApiKey) || isLocalProviderOrUrl(mergedSettings.apiProvider, chubApiUrl)) &&
            (isChubUrlOrProvider(mergedSettings.apiProvider, chubApiUrl) ||
              isLocalProviderOrUrl(mergedSettings.apiProvider, chubApiUrl));

          const activeGlobalLoreRaw = localStorage.getItem('palace_active_lorebook');
          const personaLoreRaw = persona.lorebook || null;
          const effectiveLorebook = mergeGlobalActiveLorebook(
            character.lorebook,
            activeGlobalLoreRaw,
            personaLoreRaw
          );

          if (shouldTryBrowserDirect) {
            const msgIndex = messages.findIndex((m) => m.id === messageId);
            const previousHistory = (msgIndex >= 0 ? messages.slice(0, msgIndex) : messages).map((m) => ({
              sender: m.sender as 'user' | 'character' | 'system',
              content: m.content,
            }));
            const directRes = await tryBrowserExternalCompletion({
              character: {
                name: character.name,
                tagline: character.tagline,
                description: character.description,
                personality: character.personality,
                systemPrompt: character.systemPrompt,
                postHistoryInstructions: character.postHistoryInstructions,
                scenario: character.scenario,
                exampleDialogues: character.exampleDialogues,
                lorebook: effectiveLorebook,
                userPersona: `${persona.name}: ${persona.bio}`,
              },
              history: previousHistory,
              chatSummary,
              apiProvider: mergedSettings.apiProvider,
              apiUrl: chubApiUrl,
              apiKey: chubApiKey,
              model: mergedSettings.model,
              chatSettings: mergedSettings,
            });
            if (directRes.ok) {
              preGeneratedReply = directRes.reply;
              setExternalFallbackNotice(null);
            } else if (
              shouldFallbackToBuiltInFreeOnExternalError(directRes.error.code, directRes.error.status)
            ) {
              fallbackToBuiltInFree = true;
              setExternalFallbackNotice(
                `External API hit ${directRes.error.status || directRes.error.code} — auto-switched swipe to Palace Unlimited Free Engine!`
              );
            }
          }

          const res = await fetch('/api/chat/swipe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionUuid: session.uuid,
              messageId,
              generateNew: true,
              chatSettings: mergedSettings,
              chubApiKey,
              chubApiUrl,
              extraLorebook: activeGlobalLoreRaw,
              personaLorebook: personaLoreRaw,
              preGeneratedReply,
              fallbackToBuiltInFree,
            }),
          });
          const parsedSwipe = await safeParseJsonResponse(res);
          if (res.ok && parsedSwipe.data?.message) {
            setMessages((prev) =>
              prev.map((m) => (m.id === messageId ? parsedSwipe.data.message : m))
            );
          }
        } catch (err) {
          console.error('Failed to generate alternate swipe:', err);
        } finally {
          setSwipingId(null);
        }
      } else {
        const newIdx = currentIdx + 1;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, activeSwipeIndex: newIdx, content: swipesList[newIdx] }
              : m
          )
        );
        fetch('/api/chat/swipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionUuid: session.uuid,
            messageId,
            generateNew: false,
            targetIndex: newIdx,
          }),
        }).catch(console.error);
      }
    }
  };

  // TTS Audio Narration (supports Gemini, Chub.ai Custom Voices Engine, & calibrated fallback)
  const handlePlayTTS = async (message: ChatMessage) => {
    if (chubSettings.ttsApi === 'none') return;

    if (activeAudioMessageId === message.id) {
      stopActiveTTSPlayback(currentAudioRef);
      setActiveAudioMessageId(null);
      return;
    }

    const speakWithBrowserFallback = () => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        message.content.replace(/\*([^*]+)\*/g, '$1').slice(0, 450)
      );
      utterance.onend = () => setActiveAudioMessageId(null);
      utterance.onerror = () => setActiveAudioMessageId(null);
      setActiveAudioMessageId(message.id);
      window.speechSynthesis.speak(utterance);
      return true;
    };

    if (chubSettings.ttsApi === 'browser_speech') {
      speakWithBrowserFallback();
      return;
    }

    try {
      stopActiveTTSPlayback(currentAudioRef);

      setAudioLoadingId(message.id);
      const { chubApiKey, mergedSettings } = getEffectiveApiPayload();
      const effectiveCustomVoiceUuid =
        mergedSettings.customVoiceUuid || character.customVoiceUuid || undefined;
      const effectiveTtsApi =
        effectiveCustomVoiceUuid && (!mergedSettings.ttsApi || mergedSettings.ttsApi === 'gemini_flash_tts')
          ? 'chub_custom_voice'
          : mergedSettings.ttsApi || 'gemini_flash_tts';

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message.content.slice(0, 450),
          voiceName: selectedVoice || mergedSettings.defaultVoice,
          voiceStyle: character.voiceStyle || 'Expressive roleplay dialogue',
          ttsApi: effectiveTtsApi,
          customVoiceUuid: effectiveCustomVoiceUuid,
          ttsEndpointUrl: mergedSettings.ttsEndpointUrl || undefined,
          ttsApiKey: mergedSettings.ttsApiKey || undefined,
          chubApiKey,
        }),
      });

      if (!res.ok) throw new Error('TTS generation failed');
      const data = await res.json();

      await playTTSResponseData(data, message.content, {
        audioRef: currentAudioRef,
        onStart: () => setActiveAudioMessageId(message.id),
        onEnd: () => setActiveAudioMessageId(null),
        onError: () => setActiveAudioMessageId(null),
      });
    } catch (err) {
      console.warn('Cloud TTS unavailable, using browser speech synthesis:', err);
      if (!speakWithBrowserFallback()) {
        setActiveAudioMessageId(null);
      }
    } finally {
      setAudioLoadingId(null);
    }
  };

  const handleResetChat = async () => {
    if (!session) return;
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3500);
      return;
    }
    setConfirmReset(false);

    try {
      const res = await fetch(`/api/chat/reset/${session.uuid}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const greetingMsg: ChatMessage = data.message || {
          id: Date.now(),
          sessionId: session.uuid,
          sender: 'character',
          content: allGreetings[activeGreetingIndex] || character.greeting,
          swipes: [allGreetings[activeGreetingIndex] || character.greeting],
          activeSwipeIndex: 0,
        };
        setEditingMessageId(null);
        setMessages([greetingMsg]);
      }
    } catch (err) {
      console.error('Failed to reset chat:', err);
    }
  };

  const handleCopyMessage = (id: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEditMessage = (message: ChatMessage) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setEditError(null);
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingContent('');
    setEditError(null);
  };

  const handleSaveEditedMessage = async (message: ChatMessage) => {
    const cleaned = normalizeEditedMessageText(editingContent);
    if (!cleaned) {
      setEditError('Message text cannot be empty.');
      return;
    }
    if (!session) return;

    const applied = applyEditedSwipe({
      swipesJsonOrArray: message.swipes,
      activeSwipeIndex: message.activeSwipeIndex,
      newContent: cleaned,
    });

    try {
      setSavingEdit(true);
      setEditError(null);

      if (message.id > 0 && message.id < 1_000_000_000_000) {
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/chat/message/${message.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            sessionUuid: session.uuid,
            content: cleaned,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save message edit');
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  ...data.message,
                  content: data.message?.content || applied.content,
                  swipes: Array.isArray(data.message?.swipes) ? data.message.swipes : applied.swipes,
                  activeSwipeIndex:
                    typeof data.message?.activeSwipeIndex === 'number'
                      ? data.message.activeSwipeIndex
                      : applied.activeSwipeIndex,
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  content: applied.content,
                  swipes: applied.swipes,
                  activeSwipeIndex: applied.activeSwipeIndex,
                }
              : m
          )
        );
      }

      setEditingMessageId(null);
      setEditingContent('');
    } catch (err: any) {
      setEditError(err?.message || 'Failed to save edit');
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete a message AND all messages after it (including system messages) + wipe from AI memory
  const handleDeleteMessage = async (message: ChatMessage, msgIdx: number) => {
    if (!session || deletingMsgId) return;

    if (confirmDeleteMsgId !== message.id) {
      setConfirmDeleteMsgId(message.id);
      setTimeout(() => {
        setConfirmDeleteMsgId((curr) => (curr === message.id ? null : curr));
      }, 4000);
      return;
    }
    setConfirmDeleteMsgId(null);

    const cascade = computeCascadeMessageDeletion({
      messages,
      targetMessageId: message.id,
      summary: chatSummary,
      unsavedCount,
    });
    if (!cascade.found) return;

    const deletedSet = new Set(cascade.deletedIds);
    const prevPersisted = [...messages.slice(0, msgIdx)]
      .reverse()
      .find((m) => m.id > 0 && m.id < 1_000_000_000_000);

    // Immediately wipe from UI state, active editor, audio playback, and AI memory state
    setMessages(cascade.remainingMessages);
    setChatSummary(cascade.summary);
    setUnsavedCount(cascade.unsavedCount);
    setPersonaReaction(null);
    if (editingMessageId && deletedSet.has(editingMessageId)) {
      handleCancelEditMessage();
    }
    if (activeAudioMessageId && deletedSet.has(activeAudioMessageId)) {
      stopActiveTTSPlayback(currentAudioRef);
      setActiveAudioMessageId(null);
    }
    setExpandedThinking((prev) => {
      const next: Record<number, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!deletedSet.has(Number(k))) next[Number(k)] = v;
      }
      return next;
    });

    try {
      setDeletingMsgId(message.id);
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/chat/message/delete', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionUuid: session.uuid,
          messageId: message.id > 0 && message.id < 1_000_000_000_000 ? message.id : null,
          afterMessageId: prevPersisted ? prevPersisted.id : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.remainingMessages)) {
          setMessages(data.remainingMessages);
        }
        if (typeof data.summary === 'string') {
          setChatSummary(data.summary);
        }
        if (typeof data.unsavedMessageCount === 'number') {
          setUnsavedCount(data.unsavedMessageCount);
        }
      }
    } catch (err) {
      console.error('Failed to cascade-delete message from database:', err);
    } finally {
      setDeletingMsgId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickStarters = [
    `*I step forward with a respectful nod* "Greetings, ${character.name}."`,
    `*I look around the room with curiosity* "Tell me, what is this place?"`,
    `"I need your counsel on an urgent matter."`,
    `*Quietly observing you, waiting for your next move*`,
  ];

  const useAvatarBg =
    Boolean(chubSettings.useAvatarAsBackground) || activeStage?.id === 'use-character-avatar';
  const backdropImage = useAvatarBg
    ? character.avatar
    : activeStage?.imageUrl || character.backgroundImage;
  const isUncroppedAvatarBg = useAvatarBg && (chubSettings.avatarBackgroundFit || 'contain') === 'contain';

  const handleToggleAvatarBackground = () => {
    const nextValue = !chubSettings.useAvatarAsBackground;
    const updated: ChubChatSettings = {
      ...chubSettings,
      useAvatarAsBackground: nextValue,
      avatarBackgroundFit: chubSettings.avatarBackgroundFit || 'contain',
    };
    persistSessionCollaboration({ baseSettings: updated });
  };

  return (
    <div className="relative flex h-[calc(var(--palace-vh,100vh)-6.25rem)] md:h-[calc(var(--palace-vh,100vh)-4rem)] w-full flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Background Stage Canvas */}
      {backdropImage && (
        <div
          data-testid="chat-background-layer"
          data-avatar-bg={useAvatarBg ? 'true' : 'false'}
          className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
        >
          {isUncroppedAvatarBg && (
            <img
              src={backdropImage}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover blur-2xl scale-110 opacity-45"
            />
          )}
          <img
            src={backdropImage}
            alt="Chat Background"
            referrerPolicy="no-referrer"
            className={`relative h-full w-full transition-all duration-700 ${
              isUncroppedAvatarBg ? 'object-contain' : 'object-cover'
            }`}
            style={{
              filter: useAvatarBg ? 'blur(0px)' : `blur(${activeStage?.blurLevel ?? 2}px)`,
            }}
          />
          <div
            className="absolute inset-0 bg-zinc-950"
            style={{ opacity: useAvatarBg ? 0.58 : activeStage?.overlayOpacity ?? 0.72 }}
          />
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/80 px-3 sm:px-6 backdrop-blur-xl max-w-full overflow-hidden">
        {/* Left: Back & Character info */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0 max-w-[46%] sm:max-w-none">
          <button
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all"
            aria-label="Back to Explore"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => onViewCharacterDetails(character)}
            className="flex items-center gap-2 sm:gap-2.5 text-left group min-w-0"
          >
            <div className="relative h-9 w-9 sm:h-10 sm:w-10 shrink-0 overflow-hidden rounded-xl border border-purple-500/50 shadow-md">
              <img
                src={character.avatar}
                alt={character.name}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs sm:text-sm text-zinc-100 group-hover:text-purple-300 transition-colors truncate">
                  {character.name}
                </span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-bold text-zinc-400 shrink-0">
                  {character.rating}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-1 max-w-[140px] sm:max-w-xs">
                {character.tagline}
              </p>
            </div>
          </button>
        </div>

        {/* Right: AI Mode Controls, Presets, Tree, & New Chat */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 justify-start sm:justify-end overflow-x-auto no-scrollbar">
          {/* New Chat Button */}
          <button
            onClick={() => handleCreateNewSession()}
            className="flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/50 px-2.5 py-1.5 text-xs text-purple-200 hover:bg-purple-600/50 transition-all shadow-sm cursor-pointer"
            title="Start New Parallel Chat Session"
          >
            <PlusCircle className="h-3.5 w-3.5 text-amber-300" />
            <span className="hidden sm:inline font-bold">New Chat</span>
          </button>

          {/* All Chats Button */}
          <button
            onClick={() => {
              fetchAllSessions();
              setIsAllChatsOpen(true);
            }}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
            title="View All Chats with this Character"
          >
            <List className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline font-semibold">All Chats</span>
          </button>

          {/* Group Characters Manager */}
          <button
            type="button"
            data-testid="open-group-modal-btn"
            onClick={() => setIsGroupModalOpen(true)}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              roster.length > 1
                ? 'border-purple-500/60 bg-purple-600/25 text-purple-100'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Manage Group Chat Characters & Who Replies"
          >
            <Users className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden sm:inline">Group</span>
            <span className="font-mono tabular-nums text-[11px]">({roster.length})</span>
          </button>

          {/* Multi-Model Collaboration Team */}
          <button
            type="button"
            data-testid="open-multimodel-modal-btn"
            onClick={() => setIsMultiModelModalOpen(true)}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              ensembleConfig.enabled
                ? 'border-indigo-500/70 bg-indigo-600/30 text-indigo-100'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:bg-zinc-800'
            }`}
            title="Configure Multiple AI Models Working Together"
          >
            <Layers className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden md:inline">
              {ensembleConfig.enabled ? `Models (${ensembleConfig.models.length})` : 'Models'}
            </span>
          </button>

          {/* BrawlChat Text Fighting Toggle */}
          <button
            type="button"
            data-testid="brawl-toggle-btn"
            onClick={handleToggleBrawlManual}
            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              brawlState.active
                ? 'border-rose-500 bg-rose-600/30 text-rose-100'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-rose-500/40 hover:bg-zinc-800'
            }`}
            title="Start or End BrawlChat.ai Text-Fighting Mode"
          >
            <Swords className="h-3.5 w-3.5 text-rose-400" />
            <span className="hidden md:inline">
              {brawlState.active ? 'End Fight' : 'Text Fight'}
            </span>
          </button>

          {/* Chat Tree Modal Button */}
          <button
            onClick={() => setIsChatTreeOpen(true)}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title="View Full Chat Tree & Alternate Branches"
          >
            <GitBranch className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden xl:inline font-semibold">Tree</span>
          </button>

          {/* Show AI Images Toggle */}
          <button
            onClick={handleToggleAiImages}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              showAiImages
                ? 'border-purple-400 bg-purple-600/30 text-purple-200 shadow-sm'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Toggle AI Scenario Scene Illustrations & 3D Poses"
          >
            <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
            <span className="hidden xl:inline">AI Images:</span>
            <span className="text-[10px] font-bold">{showAiImages ? 'ON' : 'OFF'}</span>
          </button>

          {/* Chub Chat Settings */}
          <button
            onClick={() => setIsChubSettingsOpen(true)}
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-2 text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
            title="Chub.ai Chat Settings (https://chub.ai/chats/177970478)"
          >
            <Settings2 className="h-4 w-4 text-purple-400" />
          </button>

          {/* Avatar as Chat Background Quick Toggle */}
          <button
            type="button"
            onClick={handleToggleAvatarBackground}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              useAvatarBg
                ? 'border-fuchsia-400 bg-fuchsia-600/30 text-fuchsia-100 shadow-sm'
                : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800'
            }`}
            title="Use Character's Avatar as Chat Background"
            aria-pressed={useAvatarBg}
          >
            <ImageIcon className="h-3.5 w-3.5 text-fuchsia-400" />
            <span className="hidden lg:inline">Avatar BG</span>
          </button>

          {/* Stages Quick Switcher */}
          {onOpenStages && (
            <button
              onClick={onOpenStages}
              className="hidden sm:flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 px-2.5 py-1.5 text-xs text-indigo-300 hover:border-indigo-500/50 hover:bg-zinc-800 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Change Atmosphere Stage (/my_stages)"
            >
              <Palette className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden lg:inline font-semibold max-w-[110px] truncate">
                {activeStage ? activeStage.name : 'Stage'}
              </span>
            </button>
          )}

          {/* High-Thinking Toggle (gemini-4-argon) */}
          <button
            onClick={() =>
              updateSettings(
                thinkingLevel === 'HIGH' ? 'OFF' : 'HIGH',
                searchGrounding
              )
            }
            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all ${
              thinkingLevel === 'HIGH'
                ? 'bg-purple-600/30 text-purple-200 border-purple-500 shadow-sm shadow-purple-900/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle High Thinking Mode (gemini-4-argon with ThinkingLevel.HIGH)"
          >
            <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
            <span className="hidden md:inline">Reasoning</span>
            <span
              className={`text-[10px] font-bold uppercase ${
                thinkingLevel === 'HIGH' ? 'text-amber-300' : ''
              }`}
            >
              {thinkingLevel}
            </span>
          </button>

          {/* Search Grounding Toggle */}
          <button
            onClick={() =>
              updateSettings(
                thinkingLevel,
                !searchGrounding
              )
            }
            className={`hidden sm:flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border transition-all ${
              searchGrounding
                ? 'bg-sky-600/30 text-sky-200 border-sky-500 shadow-sm shadow-sky-900/40'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
            }`}
            title="Toggle Google Search Grounding for real-time web knowledge"
          >
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden md:inline">Search</span>
          </button>

          {/* Reset Chat */}
          <button
            onClick={handleResetChat}
            className={`flex items-center justify-center rounded-xl border transition-all cursor-pointer ${
              confirmReset
                ? 'h-9 px-2.5 gap-1 bg-rose-600 border-rose-500 text-white text-xs font-bold'
                : 'h-9 w-9 bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/40'
            }`}
            title={confirmReset ? 'Click again to confirm chat reset' : 'Reset Chat to Initial State'}
            aria-label={confirmReset ? 'Confirm Reset Chat' : 'Reset Chat'}
          >
            <RotateCcw className="h-4 w-4" />
            {confirmReset && <span>Confirm</span>}
          </button>
        </div>
      </div>

      {/* Chat Long-Term Memory Summary Bar (Chub.ai Specification) */}
      <div className="relative z-10 border-b border-purple-900/40 bg-zinc-950/95 px-3 sm:px-6 py-2.5 backdrop-blur-md shadow-sm max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="flex items-center gap-2 text-left group font-semibold text-zinc-300 hover:text-purple-300 transition-colors"
          >
            <FileText className="h-4 w-4 text-purple-400 shrink-0" />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-white">Summary of this chat:</span>
              <span className="text-zinc-400 text-[11px] hidden sm:inline">
                Enter a summary for your chat. This will be included into the prompt as long-term memory.
              </span>
              <span className="rounded-full bg-purple-900/50 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                You have ~{unsavedCount} messages unsaved.
              </span>
            </div>
            {isSummaryExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-1" /> : <ChevronDown className="h-3.5 w-3.5 ml-1" />}
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleAutoSummarize}
              disabled={isSummarizing || messages.length <= 1}
              className="flex items-center gap-1 rounded-xl bg-purple-600/30 border border-purple-500/40 px-3 py-1 text-xs font-bold text-purple-200 hover:bg-purple-600/50 disabled:opacity-40 transition-all cursor-pointer shadow-sm"
              title="Automatically summarize past conversation using AI"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>{isSummarizing ? 'Summarizing...' : 'Auto Summarize'}</span>
            </button>
          </div>
        </div>

        {/* Expanded Summary Box */}
        {isSummaryExpanded && (
          <div className="mt-2.5 space-y-2 pt-2 border-t border-zinc-800/80 animate-in fade-in">
            <textarea
              rows={3}
              value={chatSummary}
              onChange={(e) => setChatSummary(e.target.value)}
              placeholder="Enter a summary for your chat. This will be included into the prompt as long-term memory..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">
                {summarySavedNotice && <span className="text-emerald-400 font-bold">✓ Summary saved into long-term memory!</span>}
              </span>
              <button
                onClick={() => handleSaveSummary(chatSummary)}
                className="flex items-center gap-1 rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition-all cursor-pointer shadow-sm"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Summary</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BrawlChat.ai Text Fighting Arena HUD (Auto on fight or Manual) */}
      <BrawlArenaHud
        brawlState={brawlState}
        onChangeTriggerMode={handleChangeBrawlTriggerMode}
        onEndBattle={handleToggleBrawlManual}
        onDismissSummary={() => {
          const cleared = { ...brawlState, outcome: null };
          setBrawlState(cleared);
          persistSessionCollaboration({ brawlState: cleared });
        }}
        onQuickMove={(move, promptText) =>
          handleSendMessage(promptText, { explicitMoveType: move })
        }
      />

      {/* Main Messages Stream */}
      <div
        ref={messagesContainerRef}
        className="relative z-10 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6"
      >
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <p className="text-xs text-zinc-400 font-medium">Entering Palace Chamber...</p>
            </div>
          </div>
        ) : (
          messages.map((message, msgIdx) => {
            const isCharacter = message.sender === 'character';
            const isUser = message.sender === 'user';
            const isSystem = message.sender === 'system';
            const segments = formatRoleplaySegments(message.content);

            const isInitialGreeting = msgIdx === 0 && isCharacter;
            const hasAlternateGreetings = isInitialGreeting && allGreetings.length > 1;
            const keepMounted =
              msgIdx >= messages.length - 8 ||
              isInitialGreeting ||
              activeAudioMessageId === message.id ||
              editingMessageId === message.id;

            const swipesList = message.swipes || [message.content];
            const currentSwipeIndex = message.activeSwipeIndex || 0;

            return (
              <ViewportSlot
                key={message.id}
                rootRef={messagesContainerRef}
                rootMargin="160px 0px"
                estimatedHeight={150}
                forceMounted={keepMounted}
                initialVisible={keepMounted}
                placeholderClassName="rounded-3xl bg-zinc-900/20 border border-zinc-800/20"
                testId="chat-message-slot"
              >
                <div
                  className={`group flex gap-3.5 max-w-4xl ${
                    isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                  }`}
                >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {isCharacter ? (
                    <img
                      src={message.speakerAvatar || character.avatar}
                      alt={message.speakerName || character.name}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-xl object-cover object-top border border-purple-500/40 shadow-sm"
                    />
                  ) : isUser ? (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 to-amber-500 text-xs font-bold text-white shadow-sm">
                      {persona.name[0] || 'U'}
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  )}
                </div>

                {/* Message Bubble Container */}
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[78%] ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  {/* Sender Name & Alternate Greeting Switcher Bar */}
                  <div className="flex flex-wrap items-center gap-2 mb-1 px-1">
                    <span className="text-xs font-bold text-zinc-300">
                      {isCharacter
                        ? message.speakerName || character.name
                        : isUser
                          ? persona.name
                          : 'Palace System'}
                    </span>
                    {isCharacter && message.modelUsed && (
                      <span className="text-[11px] text-zinc-500">
                        · {message.modelUsed}
                      </span>
                    )}

                    {/* Alternate Greetings Switcher on Message 0 */}
                    {hasAlternateGreetings && (
                      <div className="flex items-center gap-1 rounded-lg bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-[10px] text-purple-200">
                        <MessageSquare className="h-2.5 w-2.5 text-purple-400" />
                        <span>Greeting:</span>
                        <button
                          onClick={() => handleSwitchGreeting(activeGreetingIndex - 1)}
                          disabled={activeGreetingIndex === 0}
                          className="hover:text-white disabled:opacity-30"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <span className="font-bold text-amber-300">
                          {activeGreetingIndex + 1}/{allGreetings.length}
                        </span>
                        <button
                          onClick={() => handleSwitchGreeting(activeGreetingIndex + 1)}
                          disabled={activeGreetingIndex === allGreetings.length - 1}
                          className="hover:text-white disabled:opacity-30"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`relative rounded-3xl p-4 sm:p-5 text-sm leading-relaxed transition-all shadow-md ${
                      isUser
                        ? 'bg-purple-600/30 border border-purple-500/50 text-purple-50 rounded-tr-sm backdrop-blur-md'
                        : isSystem
                        ? 'bg-zinc-900/60 border border-zinc-800 text-zinc-400 rounded-tl-sm italic'
                        : 'bg-zinc-900/85 border border-zinc-800/80 text-zinc-100 rounded-tl-sm backdrop-blur-md'
                    }`}
                  >
                    {/* Collapsible Thinking / Multi-Model Trace */}
                    {message.thinkingProcess && (
                      <div className="mb-3 rounded-2xl border border-purple-500/30 bg-purple-950/30 p-2.5 text-xs text-purple-200">
                        <button
                          onClick={() =>
                            setExpandedThinking((prev) => ({
                              ...prev,
                              [message.id]: !prev[message.id],
                            }))
                          }
                          className="flex items-center justify-between w-full font-bold text-[11px] uppercase tracking-wider text-purple-300 hover:text-purple-100"
                        >
                          <span className="flex items-center gap-1.5">
                            <BrainCircuit className="h-3.5 w-3.5 text-purple-400" />
                            {message.thinkingProcess.includes('Multi-Model Mode:')
                              ? 'Multi-Model Teamwork Trace'
                              : message.modelUsed?.includes('gemini-4-argon')
                                ? 'Reasoning Monologue (gemini-4-argon)'
                                : 'Scene & Engine Note'}
                          </span>
                          {expandedThinking[message.id] ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {expandedThinking[message.id] && (
                          <p className="mt-2 text-zinc-300 leading-relaxed font-mono text-[11px] whitespace-pre-wrap bg-zinc-950/60 p-2.5 rounded-xl border border-purple-900/30">
                            {message.thinkingProcess}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Roleplay Formatted Content OR Inline Text Editor */}
                    {editingMessageId === message.id ? (
                      <div className="space-y-2.5 min-w-[260px] sm:min-w-[420px]">
                        <textarea
                          data-testid={`edit-message-textarea-${message.id}`}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEditedMessage(message);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelEditMessage();
                            }
                          }}
                          rows={Math.max(3, Math.min(12, editingContent.split('\n').length + 1))}
                          className="w-full rounded-2xl border border-purple-500/50 bg-zinc-950/90 p-3 text-sm text-zinc-100 leading-relaxed focus:border-purple-400 focus:outline-none resize-y"
                          autoFocus
                        />
                        {editError && (
                          <p className="text-[11px] font-medium text-rose-300">{editError}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-[10px] text-zinc-500">
                            Ctrl/Cmd+Enter to save &bull; Esc to cancel
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEditMessage}
                              disabled={savingEdit}
                              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1 font-semibold text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              data-testid={`save-edit-message-btn-${message.id}`}
                              onClick={() => handleSaveEditedMessage(message)}
                              disabled={savingEdit}
                              className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1 font-bold text-white hover:bg-purple-500 disabled:opacity-50 cursor-pointer"
                            >
                              <Save className="h-3 w-3" />
                              <span>{savingEdit ? 'Saving...' : 'Save Edit'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {segments.some((s) => s.text.trim()) ? (
                          segments.map((seg, idx) =>
                            seg.type === 'action' ? (
                              <p
                                key={idx}
                                className="font-serif italic text-purple-300/95 leading-relaxed"
                              >
                                *{seg.text}*
                              </p>
                            ) : (
                              <p key={idx} className="font-sans leading-relaxed text-zinc-100">
                                {seg.text}
                              </p>
                            )
                          )
                        ) : (
                          <p className="font-sans leading-relaxed text-zinc-100">
                            {ensureNonEmptyRoleplayReply(
                              message.content,
                              message.speakerName || character.name
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {/* AI Scenario Scene Image Illustration */}
                    {showAiImages && message.imageUrl && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-purple-500/30 shadow-md">
                        <img
                          src={message.imageUrl}
                          alt="Scenario Illustration"
                          className="max-h-72 w-full object-cover transition-transform hover:scale-[1.02] duration-300"
                        />
                      </div>
                    )}

                    {/* 3D Model Pose Badge */}
                    {message.poseName && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          onClick={() => setPreview3dPose(message.poseName || 'neutral')}
                          className="flex items-center gap-1 rounded-lg bg-indigo-950/60 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-900/60 transition-all cursor-pointer"
                          title="View this 3D Pose in Palace Three.js Viewer"
                        >
                          <Box className="h-3 w-3 text-indigo-400" />
                          <span>3D Pose: {message.poseName}</span>
                          <Eye className="h-2.5 w-2.5 ml-0.5" />
                        </button>
                      </div>
                    )}

                    {/* Google Search Grounding Sources */}
                    {message.groundingSources && message.groundingSources.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-zinc-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1 mb-1.5">
                          <Globe className="h-3 w-3" />
                          <span>Google Search Sources</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {message.groundingSources.map((src, i) => (
                            <a
                              key={i}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg bg-sky-950/40 border border-sky-800/50 px-2 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-900/50 hover:text-white transition-all"
                            >
                              <span className="truncate max-w-[140px]">{src.title}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Message Action Footer (Swipes, TTS, Edit, Delete, Copy — wraps cleanly on mobile) */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 px-1 text-zinc-400 text-xs">
                    {/* Swipes Controller (Chub / Janitor / SpicyChat signature) */}
                    {isCharacter && (
                      <div className="flex items-center gap-1 rounded-xl bg-zinc-900/90 border border-zinc-800 px-2 py-0.5">
                        <button
                          onClick={() => handleSwipe(message.id, 'prev')}
                          disabled={currentSwipeIndex === 0}
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors"
                          title="Previous Swipe"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[11px] font-bold text-purple-300 px-1">
                          {currentSwipeIndex + 1} / {swipesList.length}
                        </span>
                        <button
                          onClick={() => handleSwipe(message.id, 'next')}
                          disabled={swipingId === message.id}
                          className="p-0.5 text-zinc-400 hover:text-white transition-colors"
                          title={
                            currentSwipeIndex >= swipesList.length - 1
                              ? 'Swipe: Generate new alternate response'
                              : 'Next Swipe'
                          }
                        >
                          {swipingId === message.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border border-purple-400 border-t-transparent" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Text-to-Speech Play Button (Gemini 3.8 Flash TTS) */}
                    {isCharacter && (
                      <button
                        onClick={() => handlePlayTTS(message)}
                        disabled={audioLoadingId === message.id}
                        className={`flex items-center gap-1 rounded-xl border px-2 py-0.5 transition-all ${
                          activeAudioMessageId === message.id
                            ? 'bg-amber-500/20 text-amber-300 border-amber-400 animate-pulse'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-300'
                        }`}
                        title="Narrate with Gemini 3.8 Flash TTS"
                      >
                        {audioLoadingId === message.id ? (
                          <div className="h-3 w-3 animate-spin rounded-full border border-amber-400 border-t-transparent" />
                        ) : activeAudioMessageId === message.id ? (
                          <Square className="h-3 w-3 fill-current" />
                        ) : (
                          <Volume2 className="h-3 w-3" />
                        )}
                        <span className="text-[10px] font-semibold">
                          {activeAudioMessageId === message.id ? 'Playing' : 'Speak'}
                        </span>
                      </button>
                    )}

                    {/* Edit Bot / Message Text */}
                    {!isSystem && (
                      <button
                        type="button"
                        data-testid={`edit-message-btn-${message.id}`}
                        onClick={() =>
                          editingMessageId === message.id
                            ? handleCancelEditMessage()
                            : handleStartEditMessage(message)
                        }
                        className={`flex items-center gap-1 rounded-xl border px-2 py-0.5 transition-colors cursor-pointer ${
                          editingMessageId === message.id
                            ? 'border-purple-400 bg-purple-600/25 text-purple-200'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-purple-500/40 hover:text-purple-200'
                        }`}
                        title={isCharacter ? 'Edit bot message text' : 'Edit message text'}
                      >
                        <Edit2 className="h-3 w-3" />
                        <span className="text-[10px] font-semibold">Edit</span>
                      </button>
                    )}

                    {/* Delete Message & Wipe Subsequent Messages + AI Memory */}
                    {(isUser || isSystem || msgIdx > 0) && (
                      <button
                        type="button"
                        data-testid={`delete-message-btn-${message.id}`}
                        disabled={deletingMsgId === message.id}
                        onClick={() => handleDeleteMessage(message, msgIdx)}
                        aria-label={
                          confirmDeleteMsgId === message.id
                            ? `Confirm delete message and ${messages.length - msgIdx - 1} following messages`
                            : isUser
                              ? 'Delete this message and all messages after it'
                              : 'Delete this message and any following messages'
                        }
                        title={
                          confirmDeleteMsgId === message.id
                            ? 'Click again to remove this message, all messages after it (including system messages), and wipe them from AI memory'
                            : 'Remove message & all messages after it (wipes from AI memory)'
                        }
                        className={`flex items-center gap-1 rounded-xl border px-2 py-0.5 transition-colors cursor-pointer ${
                          confirmDeleteMsgId === message.id
                            ? 'border-rose-500 bg-rose-600 text-white font-bold shadow-sm'
                            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-rose-500/40 hover:text-rose-300'
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span className="text-[10px] font-semibold">
                          {deletingMsgId === message.id
                            ? 'Wiping...'
                            : confirmDeleteMsgId === message.id
                              ? messages.length - msgIdx > 1
                                ? `Confirm Wipe (${messages.length - msgIdx})`
                                : 'Confirm Delete'
                              : 'Delete'}
                        </span>
                      </button>
                    )}

                    {/* Copy text */}
                    <button
                      onClick={() => handleCopyMessage(message.id, message.content)}
                      className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
                </div>
              </ViewportSlot>
            );
          })
        )}

        {/* Loading Indicator for pending reply */}
        {sending && (
          <div className="flex gap-3.5 max-w-4xl mr-auto animate-in fade-in">
            <img
              src={character.avatar}
              alt={character.name}
              className="h-9 w-9 rounded-xl object-cover object-top border border-purple-500/40"
            />
            <div className="flex items-center gap-2 rounded-3xl bg-zinc-900/80 border border-zinc-800 px-4 py-3 text-xs text-purple-300">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" />
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span className="font-semibold italic">
                {character.name} is formulating a response...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar & Controls */}
      <div className="relative z-10 shrink-0 border-t border-zinc-800/80 bg-zinc-950/90 p-4 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl space-y-3">
          {externalFallbackNotice && (
            <div
              data-testid="external-fallback-notice"
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/35 px-3 py-2 text-[11px] text-emerald-200"
            >
              <span>{externalFallbackNotice}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextSettings: ChubChatSettings = {
                      ...chubSettings,
                      apiProvider: 'palace_free',
                      stagingUrl: '',
                    };
                    setChubSettings(nextSettings);
                    try {
                      localStorage.setItem('palace_chub_chat_settings', JSON.stringify(nextSettings));
                      const rawPresets = localStorage.getItem('palace_generation_presets');
                      if (rawPresets) {
                        const parsed = JSON.parse(rawPresets);
                        localStorage.setItem(
                          'palace_generation_presets',
                          JSON.stringify({ ...parsed, apiProvider: 'palace_free', chubApiUrl: '' })
                        );
                      }
                    } catch {}
                    setExternalFallbackNotice(null);
                  }}
                  className="rounded-lg border border-emerald-400/50 bg-emerald-600/30 px-2 py-0.5 font-bold text-emerald-100 hover:bg-emerald-600/50 cursor-pointer"
                >
                  Use Palace Free Default
                </button>
                <button
                  type="button"
                  onClick={() => setExternalFallbackNotice(null)}
                  className="text-zinc-400 hover:text-white cursor-pointer"
                  aria-label="Dismiss notice"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Quick Scenario Starters Drawer & Persona Reaction Trigger */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {/* Persona Action/Thought Trigger */}
            <button
              onClick={handleGeneratePersonaReaction}
              disabled={generatingReaction || messages.length === 0}
              className="flex items-center gap-1 shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 disabled:opacity-40 transition-all cursor-pointer shadow-sm"
              title="Ask AI what your persona would think or do in response to this character"
            >
              <Lightbulb className="h-3 w-3 text-amber-300" />
              <span>{generatingReaction ? 'Analyzing Persona...' : `What Would ${persona.name} Do?`}</span>
            </button>

            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 shrink-0 ml-1">
              Starters:
            </span>
            {quickStarters.map((starter, i) => (
              <button
                key={i}
                onClick={() => setInputText(starter)}
                className="shrink-0 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-purple-500/50 hover:bg-zinc-800 transition-all"
              >
                {starter.slice(0, 38)}...
              </button>
            ))}
          </div>

          {/* AI Persona Reaction Suggestion Card */}
          {personaReaction && (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs text-zinc-200 space-y-2 backdrop-blur-md animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Persona Reaction Guide: {persona.name}</span>
                </div>
                <button
                  onClick={() => setPersonaReaction(null)}
                  className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {personaReaction.thought && (
                <p className="text-zinc-300 text-[11px]">
                  <strong className="text-purple-300">Internal Thought:</strong> {personaReaction.thought}
                </p>
              )}
              {personaReaction.action && (
                <p className="text-zinc-300 text-[11px]">
                  <strong className="text-amber-300">Physical Action:</strong> *{personaReaction.action}*
                </p>
              )}
              {personaReaction.dialogue && (
                <p className="text-zinc-200 text-xs italic">
                  <strong className="text-emerald-300 not-italic">Dialogue:</strong> "{personaReaction.dialogue}"
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-500/20">
                <button
                  onClick={() => setInputText(personaReaction.suggestedReply)}
                  className="rounded-lg bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Insert into Box
                </button>
                <button
                  onClick={() => {
                    handleSendMessage(personaReaction.suggestedReply);
                    setPersonaReaction(null);
                  }}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Send Directly
                </button>
              </div>
            </div>
          )}

          {/* Chub.ai-Style Who Replies Bar + Multi-Model & Brawl Status */}
          <div
            data-testid="speaker-selector-bar"
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-zinc-400 mr-1">Who Replies:</span>
              <button
                type="button"
                onClick={() => handleChangeResponderMode('auto', selectedResponderUuid)}
                className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  responderMode === 'auto'
                    ? 'border-purple-500 bg-purple-600/35 text-white'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Auto
              </button>

              {roster.map((participant) => {
                const isSelectedSpeaker =
                  responderMode === 'specific' &&
                  (selectedResponderUuid || character.uuid) === participant.uuid;
                const isAddedChar = participant.uuid !== character.uuid;
                return (
                  <div
                    key={participant.uuid}
                    className={`inline-flex items-center rounded-xl border text-[11px] font-semibold transition-colors ${
                      isSelectedSpeaker
                        ? 'border-purple-400 bg-purple-600/40 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <button
                      type="button"
                      data-testid={`speaker-chip-${participant.uuid}`}
                      onClick={() => handleChangeResponderMode('specific', participant.uuid)}
                      className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer whitespace-nowrap"
                    >
                      <img
                        src={participant.avatar}
                        alt={participant.name}
                        referrerPolicy="no-referrer"
                        className="h-4 w-4 rounded-full object-cover object-top"
                      />
                      <span className="max-w-[110px] truncate">{participant.name}</span>
                    </button>
                    {isAddedChar && (
                      <button
                        type="button"
                        data-testid={`quick-remove-chip-${participant.uuid}`}
                        onClick={() => handleRemoveGroupParticipant(participant.uuid)}
                        title={`Remove ${participant.name} from chat`}
                        aria-label={`Remove ${participant.name} from chat`}
                        className="pr-2 pl-0.5 py-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              {roster.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleChangeResponderMode('all', selectedResponderUuid)}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                    responderMode === 'all'
                      ? 'border-amber-500 bg-amber-600/30 text-amber-100'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Everyone
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsGroupModalOpen(true)}
                className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 px-2.5 py-1 text-[11px] text-zinc-400 hover:text-purple-300 hover:border-purple-500/50 cursor-pointer whitespace-nowrap"
              >
                + Add / Manage
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {ensembleConfig.enabled && (
                <button
                  type="button"
                  data-testid="active-ensemble-badge"
                  onClick={() => setIsMultiModelModalOpen(true)}
                  className="text-[11px] font-medium text-indigo-300 hover:text-indigo-200 cursor-pointer whitespace-nowrap"
                >
                  {ensembleConfig.models.length} Models · {ensembleConfig.mode.replace('_', ' ')}
                </button>
              )}

              <button
                type="button"
                data-testid="trigger-speaker-btn"
                disabled={sending}
                onClick={() => handleSendMessage('', { triggerWithoutUserMessage: true })}
                className="rounded-xl border border-purple-500/40 bg-purple-600/20 px-2.5 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/35 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                title="Trigger the selected character(s) to reply right now without typing a message"
              >
                Speak Now
              </button>
            </div>
          </div>

          {/* Active Persona Banner & Text-Fight Mode Switch */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 px-1">
            <button
              onClick={onOpenPersonaModal}
              className="flex items-center gap-1.5 font-medium hover:text-amber-300 transition-colors cursor-pointer"
            >
              <User className="h-3.5 w-3.5 text-amber-400" />
              <span>
                Playing as: <strong className="text-zinc-200">{persona.name}</strong>
              </span>
              <span className="text-[10px] text-zinc-500 underline">(change)</span>
            </button>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span>Text Fight:</span>
                <select
                  data-testid="brawl-mode-select"
                  value={brawlState.triggerMode}
                  onChange={(e) => handleChangeBrawlTriggerMode(e.target.value as BrawlTriggerMode)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-200 focus:border-rose-500 focus:outline-none"
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                  <option value="off">Off</option>
                </select>
              </label>

              <span className="text-[10px] text-zinc-500 hidden sm:inline">
                Shift + Enter for new line &bull; Enter to send
              </span>
            </div>
          </div>

          {/* Input Box */}
          <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 focus-within:border-purple-500 focus-within:ring-1 focus-within:ring-purple-500 transition-all shadow-lg">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Reply to ${character.name}... (e.g. *I glance at you with a curious smile* Hello.)`}
              className="max-h-36 w-full resize-none bg-transparent px-3 py-1.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-600 via-fuchsia-600 to-amber-500 text-white shadow-md shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 disabled:opacity-40 transition-all cursor-pointer"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Modals: Chat Tree Modal */}
      <ChatTreeModal
        isOpen={isChatTreeOpen}
        onClose={() => setIsChatTreeOpen(false)}
        character={character}
        messages={messages}
        onSelectNode={() => {
          setIsChatTreeOpen(false);
        }}
      />

      {/* Modals: Chub.ai Full Settings Modal */}
      <ChubSettingsModal
        isOpen={isChubSettingsOpen}
        onClose={() => setIsChubSettingsOpen(false)}
        settings={chubSettings}
        onSave={(newSettings) => {
          persistSessionCollaboration({ baseSettings: newSettings });
        }}
      />

      {/* Modals: Group Chat Roster & Responder Picker */}
      <GroupRosterModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        hostCharacterUuid={character.uuid}
        roster={roster}
        responderMode={responderMode}
        selectedResponderUuid={selectedResponderUuid}
        onChangeResponderMode={handleChangeResponderMode}
        onAddParticipant={handleAddGroupParticipant}
        onRemoveParticipant={handleRemoveGroupParticipant}
        onToggleMute={handleToggleParticipantMute}
      />

      {/* Modals: Multi-Model Collaboration Team */}
      <MultiModelModal
        isOpen={isMultiModelModalOpen}
        onClose={() => setIsMultiModelModalOpen(false)}
        config={ensembleConfig}
        onSave={handleSaveEnsemble}
      />

      {/* Modals: All Chats Drawer/Modal */}
      {isAllChatsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl text-zinc-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-purple-400" />
                <h3 className="font-bold text-base text-zinc-100">All Chats with {character.name}</h3>
              </div>
              <button
                onClick={() => setIsAllChatsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-400">Total sessions: {allSessions.length}</span>
              <button
                onClick={() => handleCreateNewSession()}
                className="flex items-center gap-1 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition-all cursor-pointer shadow-sm"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Parallel Chat</span>
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {allSessions.length === 0 ? (
                <p className="text-xs text-zinc-500 py-6 text-center">No other sessions found.</p>
              ) : (
                allSessions.map((s) => (
                  <div
                    key={s.uuid}
                    onClick={() => handleSwitchSession(s)}
                    className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                      session?.uuid === s.uuid
                        ? 'border-purple-500 bg-purple-950/30 text-purple-200'
                        : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    <div className="space-y-1 max-w-[80%]">
                      <p className="text-xs font-bold text-zinc-200 truncate">
                        {s.summary ? s.summary.slice(0, 60) + '...' : `Chat from ${new Date(s.createdAt).toLocaleDateString()}`}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Created {new Date(s.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {session?.uuid === s.uuid && (
                      <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                        Current
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals: 3D Scenario Pose Preview Modal */}
      {preview3dPose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-xl rounded-3xl border border-indigo-500/40 bg-zinc-950 p-6 shadow-2xl text-zinc-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-base text-zinc-100">
                  3D Scenario Avatar Pose: <span className="text-indigo-300 capitalize">{preview3dPose}</span>
                </h3>
              </div>
              <button
                onClick={() => setPreview3dPose(null)}
                className="rounded-lg p-1 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-80 w-full rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/50">
              <ThreeAvatarViewer
                modelUrl={character.model3dUrl || (persona as any)?.model3dUrl}
                characterName={character.name}
                avatarUrl={character.avatar}
                pose={preview3dPose}
                interactive={true}
                height={320}
              />
            </div>

            <p className="text-xs text-zinc-400 text-center">
              Drag to rotate 3D view &bull; Scroll to zoom &bull; Posed according to the roleplay scenario action
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
