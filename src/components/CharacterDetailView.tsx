import React, { useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Sparkles,
  Download,
  Share2,
  Heart,
  Eye,
  EyeOff,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Box,
  Copy,
  Check,
  Play,
  RotateCcw,
  Tag,
  User,
  ArrowLeft,
  Star,
  GitFork,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Layers,
  Image as ImageIcon,
  Plus,
  Send,
  Zap,
  Shield,
  Users,
  Edit3,
  Trash2,
  Globe,
  Search,
  AudioWaveform,
} from 'lucide-react';
import { Character, ChatSession, CustomVoiceRecord, SharedLorebookRecord } from '../types/index.ts';
import { ThreeAvatarViewer } from './ThreeAvatarViewer.tsx';
import {
  renderWikiMarkup,
  calculateTokenBreakdown,
  exportTavernCard,
} from '../utils/characterUtils.ts';
import { mergeCharacterLoreEntries, parseLorebookEntries } from '../utils/communityUtils.ts';
import { isOwnedByRequester } from '../utils/ownership.ts';
import { useAuth } from '../context/AuthContext.tsx';

export interface StartChatOptions {
  greetingOverride?: string;
  sessionUuid?: string;
  startNew?: boolean;
}

interface CharacterDetailViewProps {
  character: Character;
  onStartChat: (char: Character, options?: StartChatOptions) => void;
  onBack: () => void;
  onLikeToggle?: (charId: number) => void;
  onForkCharacter?: (char: Character) => void;
  onEditCharacter?: (char: Character) => void;
  onCharacterUpdated?: (char: Character) => void;
  onDeleteCharacter?: (char: Character) => void;
  onViewCreator?: (creatorName: string) => void;
  isLiked?: boolean;
}

interface LocalReview {
  id: string;
  author: string;
  rating: number; // 1-5
  thumb: 'up' | 'down';
  comment: string;
  createdAt: string;
}

/**
 * Generates an actual Tavern V2 PNG file with an embedded 'chara' tEXt chunk (Chub.ai PNG Card download)
 */
async function downloadChubPngCard(character: Character, tavernCardJson: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 768);
  grad.addColorStop(0, '#1e1033');
  grad.addColorStop(1, '#09090b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 768);

  // Attempt to draw portrait image with CORS
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, 512, 620);
      } catch {
        // ignore
      }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = character.avatar;
  });

  // Footer overlay
  ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
  ctx.fillRect(0, 600, 512, 168);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(character.name.slice(0, 26), 24, 650);
  ctx.fillStyle = '#c084fc';
  ctx.font = '16px sans-serif';
  ctx.fillText(`by @${character.creatorName || 'PalaceCreator'} • Tavern V2`, 24, 686);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '14px sans-serif';
  ctx.fillText((character.tagline || '').slice(0, 58), 24, 722);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return;

  // Inject 'chara' tEXt chunk before IEND so it works as a real Chub/SillyTavern PNG card
  const arrayBuffer = await blob.arrayBuffer();
  const srcBytes = new Uint8Array(arrayBuffer);
  const utf8Bytes = new TextEncoder().encode(tavernCardJson);
  let binaryStr = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryStr += String.fromCharCode(utf8Bytes[i]);
  }
  const b64 = btoa(binaryStr);
  const textPayload = new TextEncoder().encode(`chara\0${b64}`);
  const chunkLen = textPayload.length;
  const textChunk = new Uint8Array(4 + 4 + chunkLen + 4);
  const view = new DataView(textChunk.buffer);
  view.setUint32(0, chunkLen);
  textChunk[4] = 116; // t
  textChunk[5] = 69;  // E
  textChunk[6] = 88;  // X
  textChunk[7] = 116; // t
  textChunk.set(textPayload, 8);
  // Zero CRC placeholder (standard readers accept or we compute quick CRC32)
  let crc = 0xffffffff;
  for (let i = 4; i < 8 + chunkLen; i++) {
    crc ^= textChunk[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  view.setUint32(8 + chunkLen, (crc ^ 0xffffffff) >>> 0);

  // Splice right before the 12-byte IEND chunk
  const iendStart = Math.max(8, srcBytes.length - 12);
  const finalBytes = new Uint8Array(srcBytes.length + textChunk.length);
  finalBytes.set(srcBytes.subarray(0, iendStart), 0);
  finalBytes.set(textChunk, iendStart);
  finalBytes.set(srcBytes.subarray(iendStart), iendStart + textChunk.length);

  const finalBlob = new Blob([finalBytes], { type: 'image/png' });
  const url = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${character.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_chub_card.png`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CharacterDetailView: React.FC<CharacterDetailViewProps> = ({
  character,
  onStartChat,
  onBack,
  onLikeToggle,
  onForkCharacter,
  onEditCharacter,
  onCharacterUpdated,
  onDeleteCharacter,
  onViewCreator,
  isLiked = false,
}) => {
  const { guestId, getIdToken, persona, user } = useAuth();
  const canModify = isOwnedByRequester(character.creatorId, {
    userUid: user?.uid,
    guestId,
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Inline Lorebook Attachment state for character owners
  const [lorePickerTab, setLorePickerTab] = useState<'community' | 'saved'>('community');
  const [communityLorebooks, setCommunityLorebooks] = useState<SharedLorebookRecord[]>([]);
  const [loadingLorebooks, setLoadingLorebooks] = useState(false);
  const [loreSearch, setLoreSearch] = useState('');
  const [attachingLoreUuid, setAttachingLoreUuid] = useState<string | null>(null);
  const [loreAttachMsg, setLoreAttachMsg] = useState('');
  const [loreAttachErr, setLoreAttachErr] = useState('');

  // View mode: 'chub' or 'janitor'
  const [viewStyle, setViewStyle] = useState<'chub' | 'janitor'>(() => {
    return (localStorage.getItem('palace_character_view_style') as 'chub' | 'janitor') || 'chub';
  });

  const [show3dAvatar, setShow3dAvatar] = useState(Boolean(character.model3dUrl));
  const [showDefinitionSpoiler, setShowDefinitionSpoiler] = useState(false);
  const [janitorDefOpen, setJanitorDefOpen] = useState(true);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [selectedGreetingIndex, setSelectedGreetingIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'greetings' | 'lorebook' | 'chats' | 'reviews' | 'timeline'
  >('overview');

  // Chats State (Your active chats for this character + public previews)
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [attachedCustomVoice, setAttachedCustomVoice] = useState<CustomVoiceRecord | null>(null);

  // Follow Creator & Ratings/Reviews State
  const [isFollowingCreator, setIsFollowingCreator] = useState(false);
  const [userStarRating, setUserStarRating] = useState<number>(5);
  const [userThumbVote, setUserThumbVote] = useState<'up' | 'down'>('up');
  const [newReviewText, setNewReviewText] = useState('');
  const [reviews, setReviews] = useState<LocalReview[]>(() => {
    try {
      const saved = localStorage.getItem(`palace_reviews_${character.uuid}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'seed-1',
        author: '@RoleplayEnthusiast',
        rating: 5,
        thumb: 'up',
        comment: `Incredible writing and atmosphere! The alternate greetings and scenario hooks make every replay feel fresh.`,
        createdAt: '2 days ago',
      },
      {
        id: 'seed-2',
        author: '@TavernV2Archivist',
        rating: 5,
        thumb: 'up',
        comment: `Very cleanly formatted card with consistent dialogue style and solid lorebook triggers.`,
        createdAt: '5 days ago',
      },
    ];
  });

  useEffect(() => {
    let active = true;
    const loadSessions = async () => {
      try {
        setLoadingSessions(true);
        const token = await getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `/api/chat/character/${character.uuid}/all?guestId=${encodeURIComponent(guestId)}`,
          { headers }
        );
        if (res.ok && active) {
          const data = await res.json();
          setSessions(data.sessions || []);
        }
      } catch (err) {
        console.error('Failed to load character sessions:', err);
      } finally {
        if (active) setLoadingSessions(false);
      }
    };
    loadSessions();
    return () => {
      active = false;
    };
  }, [character.uuid, guestId, getIdToken]);

  useEffect(() => {
    if (!character.customVoiceUuid) {
      setAttachedCustomVoice(null);
      return;
    }
    let active = true;
    fetch(`/api/voices?guestId=${encodeURIComponent(guestId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !Array.isArray(data?.voices)) return;
        const found = data.voices.find((v: CustomVoiceRecord) => v.uuid === character.customVoiceUuid);
        setAttachedCustomVoice(found || null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [character.customVoiceUuid, guestId]);

  useEffect(() => {
    if (activeTab !== 'lorebook' || !canModify) return;
    let active = true;
    const loadCommunityLore = async () => {
      try {
        setLoadingLorebooks(true);
        const params = new URLSearchParams();
        params.set('limit', '24');
        params.set('sort', 'popular');
        if (loreSearch.trim()) params.set('search', loreSearch.trim());
        const res = await fetch(`/api/lorebooks?${params.toString()}`);
        if (res.ok && active) {
          const data = await res.json();
          setCommunityLorebooks(Array.isArray(data.lorebooks) ? data.lorebooks : []);
        }
      } catch (err) {
        console.warn('Could not load community lorebooks:', err);
      } finally {
        if (active) setLoadingLorebooks(false);
      }
    };
    const t = setTimeout(loadCommunityLore, loreSearch.trim() ? 180 : 0);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [activeTab, canModify, loreSearch]);

  const savedLocalLorebooks = useMemo<
    Array<{ id: string; name: string; description?: string; entries: any[] }>
  >(() => {
    try {
      const raw = localStorage.getItem('palace_saved_lorebooks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  }, [activeTab]);

  const handleAttachLoreToCharacter = async (
    lbName: string,
    lbEntries: unknown,
    idKey: string,
    sharedUuid?: string
  ) => {
    try {
      setAttachingLoreUuid(idKey);
      setLoreAttachErr('');
      setLoreAttachMsg('');
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/characters/${encodeURIComponent(character.uuid)}/lorebook`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          entries: lbEntries,
          mode: 'merge',
          guestId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not attach lorebook to character');
      }
      if (sharedUuid) {
        setCommunityLorebooks((prev) =>
          prev.map((lb) => (lb.uuid === sharedUuid ? { ...lb, useCount: lb.useCount + 1 } : lb))
        );
        fetch(`/api/lorebooks/${encodeURIComponent(sharedUuid)}/use`, { method: 'POST' }).catch(
          console.error
        );
      }
      if (data.character) {
        onCharacterUpdated?.(data.character);
      }
      const added = typeof data.addedCount === 'number' ? data.addedCount : 0;
      setLoreAttachMsg(
        added > 0
          ? `Attached "${lbName}" (+${added} entries) to ${character.name}!`
          : `All entries from "${lbName}" are already in ${character.name}'s lorebook.`
      );
      setTimeout(() => setLoreAttachMsg((curr) => (curr.includes(lbName) ? '' : curr)), 4000);
    } catch (err: any) {
      setLoreAttachErr(err?.message || 'Failed to attach lorebook');
    } finally {
      setAttachingLoreUuid(null);
    }
  };

  const handleToggleViewStyle = (style: 'chub' | 'janitor') => {
    setViewStyle(style);
    localStorage.setItem('palace_character_view_style', style);
  };

  // Parse alternate greetings
  const altGreetings: string[] = useMemo(() => {
    try {
      if (typeof character.alternateGreetings === 'string') {
        const p = JSON.parse(character.alternateGreetings);
        return Array.isArray(p) ? p : [];
      }
      if (Array.isArray(character.alternateGreetings)) {
        return character.alternateGreetings;
      }
    } catch {}
    return [];
  }, [character.alternateGreetings]);

  const allGreetings = useMemo(
    () => [character.greeting, ...altGreetings].filter((g) => Boolean(g && g.trim())),
    [character.greeting, altGreetings]
  );

  // Parse tags
  const tagsList: string[] = useMemo(() => {
    try {
      const p = typeof character.tags === 'string' ? JSON.parse(character.tags) : character.tags;
      return Array.isArray(p) ? p : [];
    } catch {
      return character.tags ? [String(character.tags)] : [];
    }
  }, [character.tags]);

  // Parse lorebook (normalizing legacy { keys, value } or Tavern V2 formats)
  const loreEntries: Array<{ key: string; content: string }> = useMemo(
    () => mergeCharacterLoreEntries([], character.lorebook).entries,
    [character.lorebook]
  );

  // Token breakdown
  const tokens = useMemo(() => calculateTokenBreakdown(character), [character]);

  const currentGreeting = allGreetings[selectedGreetingIndex] || character.greeting;
  const isLimitless = character.rating !== 'SFW';
  const slug = character.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'character';

  const renderedDescriptionHtml = useMemo(
    () => renderWikiMarkup(character.description || character.tagline, character.name),
    [character.description, character.tagline, character.name]
  );

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return '5.0';
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const thumbsUpCount = useMemo(
    () => reviews.filter((r) => r.thumb === 'up').length + (character.likeCount || 0),
    [reviews, character.likeCount]
  );
  const thumbsDownCount = useMemo(
    () => reviews.filter((r) => r.thumb === 'down').length,
    [reviews]
  );

  // Simulated public chats showcase (alongside real user sessions!)
  const publicChats = useMemo(
    () => [
      {
        id: 'pub-1',
        userHandle: '@crimson_scribe',
        turns: 42,
        excerpt: `Opened in the ${character.scenario ? character.scenario.slice(0, 48) + '...' : 'main scenario'} with a diplomatic negotiation twist.`,
        updated: '1d ago',
      },
      {
        id: 'pub-2',
        userHandle: '@starlight_rp',
        turns: 19,
        excerpt: `Explored ${character.name}'s secret backstory and triggered 3 world lorebook events.`,
        updated: '3d ago',
      },
    ],
    [character.name, character.scenario]
  );

  const handleExportV2 = () => {
    const cardData = exportTavernCard({
      name: character.name,
      tagline: character.tagline,
      avatar: character.avatar,
      backgroundImage: character.backgroundImage,
      description: character.description,
      personality: character.personality,
      greeting: currentGreeting,
      alternateGreetings: altGreetings,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
      creatorNotes: character.creatorNotes,
      characterVersion: character.characterVersion,
      scenario: character.scenario,
      exampleDialogues: character.exampleDialogues,
      tags: tagsList,
      rating: character.rating,
      creatorName: character.creatorName,
      voiceName: character.voiceName,
      lorebook: loreEntries,
    });

    const blob = new Blob([JSON.stringify(cardData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}_chub_v2.json`;
    a.click();
    URL.revokeObjectURL(url);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 3000);
  };

  const handleExportPng = async () => {
    const cardData = exportTavernCard({
      name: character.name,
      tagline: character.tagline,
      avatar: character.avatar,
      backgroundImage: character.backgroundImage,
      description: character.description,
      personality: character.personality,
      greeting: currentGreeting,
      alternateGreetings: altGreetings,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
      creatorNotes: character.creatorNotes,
      characterVersion: character.characterVersion,
      scenario: character.scenario,
      exampleDialogues: character.exampleDialogues,
      tags: tagsList,
      rating: character.rating,
      creatorName: character.creatorName,
      voiceName: character.voiceName,
      lorebook: loreEntries,
    });
    await downloadChubPngCard(character, JSON.stringify(cardData));
  };

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}/characters/${encodeURIComponent(character.creatorName || 'Anonymous')}/${slug}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewText.trim()) return;
    const entry: LocalReview = {
      id: `rev_${Date.now()}`,
      author: user?.displayName ? `@${user.displayName.replace(/\s+/g, '')}` : `@${persona.name || 'Wanderer'}`,
      rating: userStarRating,
      thumb: userThumbVote,
      comment: newReviewText.trim(),
      createdAt: 'Just now',
    };
    const next = [entry, ...reviews];
    setReviews(next);
    setNewReviewText('');
    try {
      localStorage.setItem(`palace_reviews_${character.uuid}`, JSON.stringify(next));
    } catch {}
  };

  const latestSession = sessions[0] || null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8 animate-in fade-in duration-300">
      {/* Top Navigation & Authentic View Mode Switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-purple-900/40 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Explore</span>
        </button>

        {/* View Style Switcher (Chub.ai vs Janitor.ai) */}
        <div className="flex items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-1 backdrop-blur-md">
          <span className="text-[11px] font-bold text-zinc-400 pl-2.5 pr-1">View Style:</span>
          <button
            type="button"
            onClick={() => handleToggleViewStyle('chub')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewStyle === 'chub'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            📋 Chub.ai View
          </button>
          <button
            type="button"
            onClick={() => handleToggleViewStyle('janitor')}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
              viewStyle === 'janitor'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-900/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            🌸 Janitor.ai View
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* ===================== CHUB.AI AUTHENTIC VIEW ======================== */}
      {/* ===================================================================== */}
      {viewStyle === 'chub' ? (
        <div className="space-y-6">
          {/* Chub.ai Top Breadcrumb + Share Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400 overflow-x-auto">
              <span className="font-bold text-purple-400">chub.ai</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              <span>characters</span>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              <button
                type="button"
                onClick={() => onViewCreator && onViewCreator(character.creatorName)}
                className="font-semibold text-zinc-200 hover:text-purple-300 transition-colors"
              >
                {character.creatorName || 'Anonymous'}
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
              <span className="font-mono text-purple-300 truncate">{slug}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 hover:border-purple-500/50 hover:text-white transition-all"
              >
                {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Share2 className="h-3 w-3 text-purple-400" />}
                <span>{copiedLink ? 'Copied URL!' : 'Copy URL'}</span>
              </button>
              <span
                className={`rounded-lg px-2 py-0.5 text-[11px] font-black uppercase border ${
                  character.rating === 'NSFW + NSFL'
                    ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                    : character.rating === 'NSFL'
                    ? 'bg-red-950/80 border-red-500 text-red-300'
                    : character.rating === 'NSFW'
                    ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                    : 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                }`}
              >
                {character.rating}
              </span>
            </div>
          </div>

          {/* 2-Column Chub.ai Character Page Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-6 items-start">
            {/* LEFT SIDEBAR: Avatar, Primary Chat CTAs, Actions, Token Breakdown, Metadata */}
            <aside className="space-y-4">
              {/* Portrait + 3D Toggle */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-xl space-y-3">
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border-2 border-purple-500/50 bg-zinc-950 shadow-lg">
                  {show3dAvatar ? (
                    <ThreeAvatarViewer
                      modelUrl={character.model3dUrl}
                      characterName={character.name}
                      avatarUrl={character.avatar}
                      currentPose={character.model3dPose || 'neutral'}
                      className="h-full w-full"
                    />
                  ) : (
                    <>
                      <img
                        src={character.avatar}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-35 pointer-events-none"
                      />
                      <img
                        src={character.avatar}
                        alt={character.name}
                        referrerPolicy="no-referrer"
                        className="relative z-10 h-full w-full object-contain"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShow3dAvatar(!show3dAvatar)}
                    className="absolute top-2.5 right-2.5 rounded-xl bg-black/75 border border-purple-500/40 px-2.5 py-1.5 text-[11px] font-bold text-purple-200 hover:bg-black transition-all backdrop-blur-md flex items-center gap-1 shadow-lg"
                    title="Toggle 3D Avatar Model"
                  >
                    <Box className="h-3.5 w-3.5 text-purple-400" />
                    <span>{show3dAvatar ? '2D' : '3D'}</span>
                  </button>

                  <div className="absolute bottom-2 left-2 rounded-lg bg-black/75 border border-white/15 px-2 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-md">
                    v{character.characterVersion || '1.0'} &bull; Tavern V2
                  </div>
                </div>

                {/* Primary Chat CTA Buttons */}
                <button
                  type="button"
                  onClick={() =>
                    onStartChat(character, {
                      greetingOverride: currentGreeting,
                      sessionUuid: latestSession?.uuid,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-purple-900/40 hover:brightness-110 transition-all cursor-pointer"
                >
                  <MessageSquare className="h-4 w-4 fill-white/20" />
                  <span>{latestSession ? `Continue Chat` : `Chat with ${character.name.split(' ')[0]}`}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onStartChat(character, {
                      greetingOverride: currentGreeting,
                      startNew: true,
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-950/35 px-4 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-900/40 transition-all"
                >
                  <Plus className="h-4 w-4 text-purple-400" />
                  <span>Start New Chat</span>
                </button>

                {/* Secondary Action Row: Favorite, Fork, Download JSON, Download PNG */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onLikeToggle && onLikeToggle(character.id)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                      isLiked
                        ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <Star className={`h-3.5 w-3.5 ${isLiked ? 'fill-amber-400 text-amber-400' : 'text-amber-400'}`} />
                    <span>{isLiked ? 'Starred' : 'Star'} ({character.likeCount || 0})</span>
                  </button>

                  {onForkCharacter && (
                    <button
                      type="button"
                      onClick={() => onForkCharacter(character)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-300 hover:border-purple-500/50 hover:text-purple-200 transition-all"
                    >
                      <GitFork className="h-3.5 w-3.5 text-purple-400" />
                      <span>Fork Card</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportV2}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-all"
                  >
                    {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Download className="h-3.5 w-3.5 text-purple-400" />}
                    <span>JSON V2</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPng}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 transition-all"
                  >
                    <ImageIcon className="h-3.5 w-3.5 text-pink-400" />
                    <span>PNG Card</span>
                  </button>

                  {canModify && onEditCharacter && (
                    <button
                      type="button"
                      onClick={() => onEditCharacter(character)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/50 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit Character</span>
                    </button>
                  )}

                  {canModify && onDeleteCharacter && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmDelete) {
                          setConfirmDelete(true);
                          setTimeout(() => setConfirmDelete(false), 3500);
                          return;
                        }
                        setConfirmDelete(false);
                        onDeleteCharacter(character);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        confirmDelete
                          ? 'border-rose-500 bg-rose-600 text-white shadow-md'
                          : 'border-rose-500/50 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{confirmDelete ? 'Confirm Delete' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chub.ai Metrics & Token Breakdown Card */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    Token Breakdown
                  </span>
                  <span className="font-mono font-bold text-amber-300">{tokens.total} tok</span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-zinc-300 font-semibold">
                    <span>Permanent Tokens</span>
                    <span className="font-mono text-purple-300">{tokens.permanent}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Description / Bio</span>
                    <span className="font-mono">{tokens.description}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Personality</span>
                    <span className="font-mono">{tokens.personality}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Scenario</span>
                    <span className="font-mono">{tokens.scenario}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>First Greeting</span>
                    <span className="font-mono">{tokens.greeting}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Example Dialogs</span>
                    <span className="font-mono">{tokens.exampleDialogues}</span>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-zinc-400">
                    <span>Creator</span>
                    <button
                      type="button"
                      onClick={() => onViewCreator && onViewCreator(character.creatorName)}
                      className="font-bold text-purple-300 hover:underline"
                    >
                      @{character.creatorName || 'Anonymous'}
                    </button>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Gender / Pronouns</span>
                    <span className="text-zinc-200 font-semibold">
                      {character.gender || 'Unknown'} ({character.pronouns || 'They/Them'})
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Voice Persona</span>
                    <span className="text-zinc-200 font-semibold flex items-center gap-1">
                      {attachedCustomVoice ? (
                        <>
                          <AudioWaveform className="h-3 w-3 text-amber-400" />
                          <span>{attachedCustomVoice.name}</span>
                        </>
                      ) : (
                        character.voiceName || 'Puck'
                      )}
                    </span>
                  </div>
                  {attachedCustomVoice?.referenceAudioData && (
                    <div className="pt-1">
                      <audio
                        controls
                        src={attachedCustomVoice.referenceAudioData}
                        className="w-full h-7"
                      />
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400">
                    <span>Rating &amp; Chats</span>
                    <span className="text-amber-300 font-bold">
                      ★ {avgRating} &bull; {(character.chatCount || 0) + sessions.length} chats
                    </span>
                  </div>
                </div>
              </div>

              {/* Chub.ai Tags Sidebar */}
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2.5">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-purple-400" />
                  <span>Tags ({tagsList.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagsList.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-[11px] font-semibold text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </aside>

            {/* RIGHT MAIN AREA: Hero Info + Full Chub.ai Tabs */}
            <main className="space-y-5 min-w-0">
              {/* Character Summary Header */}
              <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/35 via-zinc-900/90 to-zinc-950 p-6 shadow-xl">
                {character.backgroundImage && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-15 blur-sm pointer-events-none"
                    style={{ backgroundImage: `url(${character.backgroundImage})` }}
                  />
                )}
                <div className="relative z-10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-white">{character.name}</h1>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded-lg bg-zinc-950/90 border border-zinc-800 px-2.5 py-1 text-zinc-300 font-semibold">
                        💬 {(character.chatCount || 0) + sessions.length} Chats
                      </span>
                      <span className="rounded-lg bg-zinc-950/90 border border-zinc-800 px-2.5 py-1 text-amber-300 font-semibold">
                        ★ {avgRating} ({reviews.length})
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-purple-100/90 leading-relaxed">{character.tagline}</p>

                  {character.creatorNotes && (
                    <div className="rounded-2xl border border-purple-500/25 bg-black/35 px-4 py-2.5 text-xs text-zinc-300">
                      <strong className="text-purple-300 uppercase text-[10px] tracking-wider block mb-0.5">
                        Creator Notes
                      </strong>
                      {character.creatorNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Chub.ai Navigation Tabs */}
              <div className="rounded-3xl border border-zinc-800/90 bg-zinc-900/50 p-5 sm:p-6 backdrop-blur-md">
                <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-3 mb-5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'overview', label: 'Description & Definition' },
                    { id: 'greetings', label: `Greetings (${allGreetings.length})` },
                    { id: 'lorebook', label: `Lorebooks (${loreEntries.length})` },
                    { id: 'chats', label: `Chats (${sessions.length + publicChats.length})` },
                    { id: 'reviews', label: `Ratings & Comments (${reviews.length})` },
                    { id: 'timeline', label: 'Timeline' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                        activeTab === tab.id
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* TAB 1: Description & Definition */}
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Rendered Description / Wiki Bio (dangerouslySetInnerHTML!) */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                        Character Overview &amp; Lore
                      </h3>
                      <div
                        className="wiki-rendered-content rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:p-5 text-sm leading-relaxed text-zinc-200 overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: renderedDescriptionHtml }}
                      />
                    </div>

                    {/* Personality & Scenario Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                          <span>Personality</span>
                          <span className="font-mono text-[10px] text-zinc-500">{tokens.personality} tok</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {character.personality || 'No explicit personality traits listed.'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                          <span>Scenario</span>
                          <span className="font-mono text-[10px] text-zinc-500">{tokens.scenario} tok</span>
                        </div>
                        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                          {character.scenario || 'Open-ended roleplay scenario.'}
                        </p>
                      </div>
                    </div>

                    {/* Hidden/Spoiler System Definition & Example Dialogs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                          System Prompt, Post-History &amp; Example Dialogues
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDefinitionSpoiler(!showDefinitionSpoiler)}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:border-purple-500/40"
                        >
                          {showDefinitionSpoiler ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          <span>{showDefinitionSpoiler ? 'Hide Definition' : 'Reveal Full Prompt'}</span>
                        </button>
                      </div>

                      <div
                        className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xs font-mono text-zinc-300 space-y-3 transition-all ${
                          !showDefinitionSpoiler ? 'blur-sm select-none' : ''
                        }`}
                      >
                        <div>
                          <div className="text-purple-400 font-bold mb-1">// System Prompt ({tokens.systemPrompt} tok)</div>
                          <pre className="whitespace-pre-wrap leading-relaxed">{character.systemPrompt}</pre>
                        </div>
                        {character.postHistoryInstructions && (
                          <div>
                            <div className="text-amber-400 font-bold mb-1">// Post-History Instructions ({tokens.postHistoryInstructions} tok)</div>
                            <pre className="whitespace-pre-wrap leading-relaxed text-amber-200/80">
                              {character.postHistoryInstructions}
                            </pre>
                          </div>
                        )}
                        {character.exampleDialogues && (
                          <div>
                            <div className="text-emerald-400 font-bold mb-1">// Example Dialogues ({tokens.exampleDialogues} tok)</div>
                            <pre className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                              {character.exampleDialogues}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: Greetings (Primary + Alternates) */}
                {activeTab === 'greetings' && (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400">
                      Select any opening greeting below to preview it or start a fresh chat directly with that scene.
                    </p>
                    <div className="space-y-3">
                      {allGreetings.map((greet, idx) => (
                        <div
                          key={idx}
                          onClick={() => setSelectedGreetingIndex(idx)}
                          className={`rounded-2xl border p-4 transition-all cursor-pointer ${
                            selectedGreetingIndex === idx
                              ? 'border-purple-500 bg-purple-950/35 ring-1 ring-purple-500/60'
                              : 'border-zinc-800 bg-zinc-950/80 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <span className="text-xs font-bold text-purple-300">
                              {idx === 0 ? '🌟 Primary Greeting' : `✨ Alternate Greeting #${idx}`}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onStartChat(character, { greetingOverride: greet, startNew: true });
                              }}
                              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-500 transition-all"
                            >
                              <Play className="h-3 w-3 fill-white" />
                              <span>Chat with this Greeting</span>
                            </button>
                          </div>
                          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap italic">
                            {greet}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: Lorebooks */}
                {activeTab === 'lorebook' && (
                  <div className="space-y-4">
                    {canModify && (
                      <div
                        data-testid="detail-lorebook-attacher"
                        className="rounded-2xl border border-purple-500/30 bg-zinc-950/90 p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-amber-300" />
                              <span>Attach Lorebook to Existing Character</span>
                            </h4>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Attach &amp; save any Community or Saved lorebook directly onto {character.name}.
                            </p>
                          </div>
                          {onEditCharacter && (
                            <button
                              type="button"
                              onClick={() => onEditCharacter(character)}
                              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 transition-all cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit Lore in Studio</span>
                            </button>
                          )}
                        </div>

                        {loreAttachMsg && (
                          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-200 flex items-center gap-1.5">
                            <Check className="h-3.5 w-3.5 shrink-0" />
                            <span>{loreAttachMsg}</span>
                          </div>
                        )}
                        {loreAttachErr && (
                          <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-200">
                            {loreAttachErr}
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900 p-1 self-start">
                            <button
                              type="button"
                              onClick={() => setLorePickerTab('community')}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                                lorePickerTab === 'community'
                                  ? 'bg-purple-600/40 text-purple-100 border border-purple-500/40'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <Globe className="h-3 w-3 text-amber-300" />
                              <span>Community ({communityLorebooks.length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLorePickerTab('saved')}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                                lorePickerTab === 'saved'
                                  ? 'bg-purple-600/40 text-purple-100 border border-purple-500/40'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              <BookOpen className="h-3 w-3 text-purple-300" />
                              <span>Saved ({savedLocalLorebooks.length})</span>
                            </button>
                          </div>

                          {lorePickerTab === 'community' && (
                            <div className="relative flex-1 max-w-xs">
                              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                              <input
                                type="text"
                                value={loreSearch}
                                onChange={(e) => setLoreSearch(e.target.value)}
                                placeholder="Search lorebooks..."
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>

                        {lorePickerTab === 'community' ? (
                          loadingLorebooks ? (
                            <div className="py-4 text-center text-xs text-zinc-400">Loading community lorebooks...</div>
                          ) : communityLorebooks.length === 0 ? (
                            <div className="py-4 text-center text-xs text-zinc-500">
                              No matching community lorebooks found.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                              {communityLorebooks.map((lb) => {
                                const lbEntries = parseLorebookEntries(lb.entries);
                                const isBusy = attachingLoreUuid === lb.uuid;
                                return (
                                  <div
                                    key={lb.uuid}
                                    className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="text-xs font-bold text-white truncate">{lb.name}</div>
                                      <div className="text-[10px] text-zinc-400 truncate">
                                        {lbEntries.length} entries &bull; @{lb.creatorName}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleAttachLoreToCharacter(lb.name, lb.entries, lb.uuid, lb.uuid)
                                      }
                                      className="flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-500 disabled:opacity-50 shrink-0 cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span>{isBusy ? 'Saving...' : 'Attach & Save'}</span>
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        ) : savedLocalLorebooks.length === 0 ? (
                          <div className="py-4 text-center text-xs text-zinc-500">
                            No saved lorebooks found in browser storage.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                            {savedLocalLorebooks.map((lb) => {
                              const isBusy = attachingLoreUuid === lb.id;
                              return (
                                <div
                                  key={lb.id}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-2.5 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-bold text-white truncate">{lb.name}</div>
                                    <div className="text-[10px] text-zinc-400 truncate">
                                      {lb.entries?.length || 0} entries
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() =>
                                      handleAttachLoreToCharacter(lb.name, lb.entries, lb.id)
                                    }
                                    className="flex items-center gap-1 rounded-xl bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-500 disabled:opacity-50 shrink-0 cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>{isBusy ? 'Saving...' : 'Attach & Save'}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {loreEntries.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-4">
                        No character lorebook entries attached. You can attach lorebooks above or in Chat Settings.
                      </p>
                    ) : (
                      loreEntries.map((entry, idx) => (
                        <div key={idx} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                            <span>Trigger Keywords: {entry.key}</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">{entry.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 4: Chats (Your Active Sessions & Public Chats) */}
                {activeTab === 'chats' && (
                  <div className="space-y-6">
                    {/* Your Saved Chats */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4" />
                          <span>Your Chats ({sessions.length})</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            onStartChat(character, { greetingOverride: currentGreeting, startNew: true })
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>New Chat</span>
                        </button>
                      </div>

                      {loadingSessions ? (
                        <div className="text-xs text-zinc-400 py-3">Loading your chats...</div>
                      ) : sessions.length === 0 ? (
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 text-xs text-zinc-400 flex items-center justify-between gap-3">
                          <span>You haven&apos;t started a conversation with {character.name} yet.</span>
                          <button
                            type="button"
                            onClick={() =>
                              onStartChat(character, { greetingOverride: currentGreeting, startNew: true })
                            }
                            className="rounded-xl bg-purple-600 px-3 py-1.5 font-bold text-white shrink-0"
                          >
                            Start First Chat
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {sessions.map((s) => (
                            <div
                              key={s.uuid}
                              onClick={() => onStartChat(character, { sessionUuid: s.uuid })}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3.5 hover:border-purple-500/60 transition-all cursor-pointer"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-white truncate">
                                  {s.title || `Chat Session`}
                                </div>
                                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                                  {s.summary || `Model: ${s.modelPreference || 'gemini'} • Click to resume conversation`}
                                </div>
                              </div>
                              <span className="rounded-xl bg-purple-600/25 border border-purple-500/40 px-3 py-1.5 text-[11px] font-bold text-purple-200 shrink-0">
                                Open Chat →
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Public Community Chats */}
                    <div className="space-y-3 border-t border-zinc-800 pt-4">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-fuchsia-400" />
                        <span>Featured Public Chats ({publicChats.length})</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {publicChats.map((pc) => (
                          <div
                            key={pc.id}
                            className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold text-purple-300">{pc.userHandle}</span>
                              <span className="text-zinc-500">{pc.turns} msgs &bull; {pc.updated}</span>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">{pc.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 5: Ratings & Comments */}
                {activeTab === 'reviews' && (
                  <div className="space-y-5">
                    <form
                      onSubmit={handleSubmitReview}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-purple-300">Leave a Rating &amp; Comment</span>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setUserStarRating(star)}
                              className="p-0.5"
                            >
                              <Star
                                className={`h-4 w-4 ${
                                  star <= userStarRating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'text-zinc-600'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newReviewText}
                          onChange={(e) => setNewReviewText(e.target.value)}
                          placeholder={`Share your experience chatting with ${character.name}...`}
                          className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!newReviewText.trim()}
                          className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-40"
                        >
                          <Send className="h-3.5 w-3.5" />
                          <span>Post</span>
                        </button>
                      </div>
                    </form>

                    <div className="space-y-2.5">
                      {reviews.map((rev) => (
                        <div
                          key={rev.id}
                          className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-purple-300">{rev.author}</span>
                            <div className="flex items-center gap-2 text-zinc-500">
                              <span className="text-amber-400 font-bold">{'★'.repeat(rev.rating)}</span>
                              <span>{rev.createdAt}</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-200 leading-relaxed">{rev.comment}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 6: Timeline */}
                {activeTab === 'timeline' && (
                  <div className="space-y-3 text-xs">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Version {character.characterVersion || '1.0'} (Current)</span>
                        </div>
                        <p className="text-zinc-400 mt-1">
                          Tavern Card V2 Spec &bull; {tokens.total} total tokens &bull; {allGreetings.length} greeting(s)
                        </p>
                      </div>
                      <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                        ACTIVE
                      </span>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                      <div className="font-semibold text-zinc-300">Initial Card Published</div>
                      <p className="text-zinc-500 mt-0.5">Created by @{character.creatorName || 'Anonymous'}</p>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* ==================== JANITOR.AI AUTHENTIC VIEW ====================== */
        /* ===================================================================== */
        <div className="space-y-6">
          {/* Dark Plum Hero Card */}
          <div className="relative overflow-hidden rounded-3xl border border-pink-500/30 bg-[#120d1d] p-6 sm:p-8 shadow-2xl">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 blur-xl pointer-events-none"
              style={{ backgroundImage: `url(${character.backgroundImage || character.avatar})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#120d1d] via-[#120d1d]/75 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row gap-6 lg:gap-8 items-center md:items-start">
              {/* Character Portrait + 3D Toggle */}
              <div className="relative aspect-[3/4] w-52 sm:w-60 overflow-hidden rounded-2xl border-2 border-pink-500/60 shadow-2xl bg-[#090612] shrink-0">
                {show3dAvatar ? (
                  <ThreeAvatarViewer
                    modelUrl={character.model3dUrl}
                    characterName={character.name}
                    avatarUrl={character.avatar}
                    currentPose={character.model3dPose || 'neutral'}
                    className="h-full w-full"
                  />
                ) : (
                  <>
                    <img
                      src={character.avatar}
                      alt=""
                      aria-hidden="true"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-35 pointer-events-none"
                    />
                    <img
                      src={character.avatar}
                      alt={character.name}
                      referrerPolicy="no-referrer"
                      className="relative z-10 h-full w-full object-contain"
                    />
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShow3dAvatar(!show3dAvatar)}
                  className="absolute top-2.5 right-2.5 rounded-xl bg-black/75 border border-pink-500/50 px-2.5 py-1 text-[11px] font-bold text-pink-200 hover:bg-black transition-all flex items-center gap-1"
                >
                  <Box className="h-3.5 w-3.5 text-pink-400" />
                  <span>{show3dAvatar ? '2D' : '3D'}</span>
                </button>
              </div>

              {/* Metadata, Limitless Pill, Token Pill, Actions */}
              <div className="flex-1 text-center md:text-left space-y-4">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h1 className="text-3xl sm:text-4xl font-black text-white">{character.name}</h1>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-black border ${
                      isLimitless
                        ? 'bg-pink-600/25 border-pink-400 text-pink-200'
                        : 'bg-emerald-600/20 border-emerald-400 text-emerald-200'
                    }`}
                  >
                    {isLimitless ? '🔥 Limitless' : '🛡️ Limited'} ({character.rating})
                  </span>
                </div>

                {/* Creator Row + Follow Button */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => onViewCreator && onViewCreator(character.creatorName)}
                    className="flex items-center gap-1.5 font-bold text-pink-300 hover:text-pink-200 hover:underline"
                  >
                    <User className="h-3.5 w-3.5" />
                    <span>@{character.creatorName || 'Anonymous'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFollowingCreator(!isFollowingCreator)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold border transition-all ${
                      isFollowingCreator
                        ? 'bg-pink-600 border-pink-400 text-white'
                        : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-pink-400'
                    }`}
                  >
                    {isFollowingCreator ? '✓ Following' : '+ Follow'}
                  </button>

                  <span className="rounded-full bg-[#1e1630] border border-purple-500/40 px-3 py-1 text-[11px] font-bold text-purple-200">
                    ⚡ {tokens.total} Tokens ({tokens.permanent} permanent)
                  </span>

                  <span className="rounded-full bg-zinc-900/90 border border-zinc-800 px-3 py-1 text-[11px] font-semibold text-zinc-300">
                    💬 {(character.chatCount || 0) + sessions.length} Chats
                  </span>
                </div>

                <p className="text-sm text-zinc-200 leading-relaxed max-w-2xl">
                  {character.tagline}
                </p>

                {/* Tags & Identity Pills */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5">
                  <span className="rounded-full bg-zinc-900 border border-zinc-700 px-3 py-1 text-[11px] text-zinc-200 font-semibold">
                    {character.gender || 'Unknown'} &bull; {character.pronouns || 'They/Them'}
                  </span>
                  {tagsList.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-pink-950/50 border border-pink-600/40 px-3 py-1 text-[11px] text-pink-200 font-semibold"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Janitor.ai Primary Action Bar */}
                <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onStartChat(character, {
                        greetingOverride: currentGreeting,
                        sessionUuid: latestSession?.uuid,
                      })
                    }
                    className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-pink-600 via-fuchsia-600 to-purple-600 px-7 py-3.5 text-sm font-black text-white shadow-xl shadow-pink-900/50 hover:brightness-110 transition-all cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>{latestSession ? `Continue Chat` : `Chat with ${character.name.split(' ')[0]}`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onStartChat(character, { greetingOverride: currentGreeting, startNew: true })
                    }
                    className="flex items-center gap-1.5 rounded-2xl border border-pink-500/40 bg-pink-950/35 px-4 py-3 text-xs font-bold text-pink-200 hover:bg-pink-900/40 transition-all"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Start New Chat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onLikeToggle && onLikeToggle(character.id)}
                    className={`flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-bold transition-all ${
                      isLiked
                        ? 'border-pink-500 bg-pink-500/20 text-pink-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-pink-500/40'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? 'fill-pink-500 text-pink-500' : ''}`} />
                    <span>{character.likeCount || 0}</span>
                  </button>

                  {onForkCharacter && (
                    <button
                      type="button"
                      onClick={() => onForkCharacter(character)}
                      className="flex items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-bold text-zinc-300 hover:border-pink-500/40"
                    >
                      <GitFork className="h-4 w-4 text-pink-400" />
                      <span>Fork</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleExportV2}
                    className="flex items-center gap-1.5 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
                  >
                    <Download className="h-4 w-4 text-pink-400" />
                    <span>JSON</span>
                  </button>

                  {canModify && onEditCharacter && (
                    <button
                      type="button"
                      onClick={() => onEditCharacter(character)}
                      className="flex items-center gap-1.5 rounded-2xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                    >
                      <Edit3 className="h-4 w-4" />
                      <span>Edit</span>
                    </button>
                  )}

                  {canModify && onDeleteCharacter && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!confirmDelete) {
                          setConfirmDelete(true);
                          setTimeout(() => setConfirmDelete(false), 3500);
                          return;
                        }
                        setConfirmDelete(false);
                        onDeleteCharacter(character);
                      }}
                      className={`flex items-center gap-1.5 rounded-2xl border px-4 py-3 text-xs font-bold transition-all ${
                        confirmDelete
                          ? 'border-rose-500 bg-rose-600 text-white shadow-md'
                          : 'border-rose-500/50 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>{confirmDelete ? 'Confirm?' : 'Delete'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Janitor.ai Two-Column Body: Bio/Definition/Chats on Left, Reviews & Quick Info on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">
            <div className="space-y-5">
              {/* Character Bio & Creator's Note */}
              <div className="rounded-3xl border border-pink-900/30 bg-[#141021] p-6 space-y-4">
                <h2 className="text-sm font-black uppercase tracking-wider text-pink-400">
                  Character Bio &amp; Description
                </h2>
                <div
                  className="wiki-rendered-content text-sm text-zinc-200 leading-relaxed overflow-x-auto"
                  dangerouslySetInnerHTML={{ __html: renderedDescriptionHtml }}
                />

                {character.creatorNotes && (
                  <div className="rounded-2xl border border-pink-500/30 bg-pink-950/20 p-4 text-xs text-pink-100">
                    <strong className="block text-[11px] uppercase tracking-wider text-pink-400 mb-1">
                      Creator&apos;s Note
                    </strong>
                    {character.creatorNotes}
                  </div>
                )}
              </div>

              {/* Signature Janitor.ai Collapsible Character Definition Accordion */}
              <div className="rounded-3xl border border-pink-900/30 bg-[#141021] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setJanitorDefOpen(!janitorDefOpen)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-pink-400" />
                    <span className="text-sm font-black text-white">Character Definition</span>
                    <span className="rounded-full bg-pink-500/20 px-2.5 py-0.5 text-[11px] font-bold text-pink-300">
                      {tokens.total} Tokens
                    </span>
                  </div>
                  {janitorDefOpen ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </button>

                {janitorDefOpen && (
                  <div className="px-6 pb-6 space-y-4 border-t border-zinc-800/80 pt-4 text-xs">
                    {/* Personality */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-pink-300">
                        <span>Personality</span>
                        <span className="font-mono text-[10px] text-zinc-500">{tokens.personality} tokens</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {character.personality || 'No personality definition specified.'}
                      </p>
                    </div>

                    {/* Scenario */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-1.5">
                      <div className="flex items-center justify-between font-bold text-purple-300">
                        <span>Scenario</span>
                        <span className="font-mono text-[10px] text-zinc-500">{tokens.scenario} tokens</span>
                      </div>
                      <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {character.scenario || 'Freeform roleplay setting.'}
                      </p>
                    </div>

                    {/* Initial Message + Alternate Greetings Switcher */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-pink-300">
                          Initial Message {allGreetings.length > 1 ? `(${selectedGreetingIndex + 1}/${allGreetings.length})` : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          {allGreetings.length > 1 && (
                            <div className="flex gap-1">
                              {allGreetings.map((_, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setSelectedGreetingIndex(i)}
                                  className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                    selectedGreetingIndex === i
                                      ? 'bg-pink-600 text-white'
                                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                                  }`}
                                >
                                  #{i + 1}
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              onStartChat(character, { greetingOverride: currentGreeting, startNew: true })
                            }
                            className="rounded-lg bg-pink-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-pink-500"
                          >
                            Chat This Intro →
                          </button>
                        </div>
                      </div>
                      <p className="text-zinc-200 leading-relaxed italic whitespace-pre-wrap">
                        {currentGreeting}
                      </p>
                    </div>

                    {/* Example Dialogs */}
                    {character.exampleDialogues && (
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-1.5">
                        <div className="flex items-center justify-between font-bold text-amber-300">
                          <span>Example Dialogs</span>
                          <span className="font-mono text-[10px] text-zinc-500">{tokens.exampleDialogues} tokens</span>
                        </div>
                        <pre className="text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                          {character.exampleDialogues}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Janitor.ai Chats Section (Your Chats + Public Chats) */}
              <div className="rounded-3xl border border-pink-900/30 bg-[#141021] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-black text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-pink-400" />
                    <span>Chats ({sessions.length + publicChats.length})</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() =>
                      onStartChat(character, { greetingOverride: currentGreeting, startNew: true })
                    }
                    className="flex items-center gap-1 rounded-xl bg-pink-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-pink-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Chat</span>
                  </button>
                </div>

                {sessions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-pink-300">
                      Your Active Chats
                    </div>
                    {sessions.map((s) => (
                      <div
                        key={s.uuid}
                        onClick={() => onStartChat(character, { sessionUuid: s.uuid })}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 hover:border-pink-500/60 transition-all cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{s.title}</div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {s.summary || 'Click to jump back into this chat'}
                          </div>
                        </div>
                        <span className="rounded-xl bg-pink-600/25 border border-pink-500/40 px-3 py-1 text-[11px] font-bold text-pink-200 shrink-0">
                          Resume →
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">
                    No saved chats yet. Click <strong className="text-pink-300">Chat with {character.name.split(' ')[0]}</strong> to start one!
                  </p>
                )}

                <div className="border-t border-zinc-800/80 pt-3 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    Public Chats
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {publicChats.map((pc) => (
                      <div key={pc.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 text-xs space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-pink-300">{pc.userHandle}</span>
                          <span className="text-zinc-500">{pc.turns} msgs</span>
                        </div>
                        <p className="text-zinc-300 leading-relaxed">{pc.excerpt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Reviews (Thumbs Up / Down + Comments) */}
            <aside className="rounded-3xl border border-pink-900/30 bg-[#141021] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-black text-white">Reviews ({reviews.length})</h2>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-emerald-300">
                    <ThumbsUp className="h-3 w-3" /> {thumbsUpCount}
                  </span>
                  <span className="flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-rose-300">
                    <ThumbsDown className="h-3 w-3" /> {thumbsDownCount}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setUserThumbVote('up')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                      userThumbVote === 'up'
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" /> Recommend
                  </button>
                  <button
                    type="button"
                    onClick={() => setUserThumbVote('down')}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-1.5 text-xs font-bold transition-all ${
                      userThumbVote === 'down'
                        ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                    }`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" /> Not for me
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={newReviewText}
                  onChange={(e) => setNewReviewText(e.target.value)}
                  placeholder={`Write a review for ${character.name}...`}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-pink-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newReviewText.trim()}
                  className="w-full rounded-xl bg-pink-600 py-2 text-xs font-bold text-white hover:bg-pink-500 disabled:opacity-40 transition-all"
                >
                  Post Review
                </button>
              </form>

              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {reviews.map((rev) => (
                  <div key={rev.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-pink-300">{rev.author}</span>
                      <span className={rev.thumb === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                        {rev.thumb === 'up' ? '👍' : '👎'}
                      </span>
                    </div>
                    <p className="text-zinc-300 leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
};
