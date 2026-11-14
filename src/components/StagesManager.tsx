import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Trash2,
  Check,
  Palette,
  Edit3,
  Globe,
  Heart,
  Flame,
  Clock,
  Sparkles,
  Search,
  Share2,
  User as UserIcon,
} from 'lucide-react';
import { ViewportSlot } from './ViewportSlot.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { SharedStageRecord } from '../types/index.ts';
import { isOwnedByRequester } from '../utils/ownership.ts';

export interface Stage {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  description: string;
  blurLevel: number; // 0 to 20 px
  overlayOpacity: number; // 0.1 to 0.9
}

export const DEFAULT_STAGES: Stage[] = [
  {
    id: 'use-character-avatar',
    name: "Character's Avatar (Full Uncropped)",
    category: 'Character',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1600&q=80',
    description: "Automatically uses the active character's full avatar image as your chat background.",
    blurLevel: 1,
    overlayOpacity: 0.68,
  },
  {
    id: 'cyberpunk-neon',
    name: 'Neo-Tokyo Rainy Alley',
    category: 'Cyberpunk',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=80',
    description: 'Neon billboards reflecting in puddles beneath towering holographic spires.',
    blurLevel: 2,
    overlayOpacity: 0.65,
  },
  {
    id: 'gothic-cathedral',
    name: 'Obsidian Citadel Archives',
    category: 'Dark Fantasy',
    imageUrl: 'https://images.unsplash.com/photo-1548625361-195fe57904d6?auto=format&fit=crop&w=1600&q=80',
    description: 'Candlelit stained glass, ancient tomes, and towering vaulted arches.',
    blurLevel: 3,
    overlayOpacity: 0.7,
  },
  {
    id: 'starry-observatory',
    name: 'Celestial Observatory',
    category: 'Sci-Fi',
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1600&q=80',
    description: 'A glass dome gazing into the spiral arms of a distant nebula.',
    blurLevel: 1,
    overlayOpacity: 0.6,
  },
  {
    id: 'cozy-tavern',
    name: 'Moonlight Hearth Tavern',
    category: 'Fantasy',
    imageUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1600&q=80',
    description: 'Warm crackling fireplace, oak tables, and soft violin music.',
    blurLevel: 2,
    overlayOpacity: 0.65,
  },
  {
    id: 'zen-sanctuary',
    name: 'Misty Bamboo Shrine',
    category: 'Spiritual',
    imageUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=80',
    description: 'Stone lanterns glowing softly through the morning mountain fog.',
    blurLevel: 2,
    overlayOpacity: 0.6,
  },
  {
    id: 'modern-penthouse',
    name: 'Midnight Skyline Penthouse',
    category: 'Modern',
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80',
    description: 'Floor-to-ceiling glass overlooking the sprawling metropolis below.',
    blurLevel: 2,
    overlayOpacity: 0.7,
  },
];

const STAGE_PAGE_SIZE = 24;

interface StagesManagerProps {
  activeStageId: string;
  onSelectStage: (stage: Stage) => void;
  onViewCreator?: (username: string) => void;
}

export const StagesManager: React.FC<StagesManagerProps> = ({
  activeStageId,
  onSelectStage,
  onViewCreator,
}) => {
  const { user, profile, guestId, getIdToken } = useAuth();

  const [viewMode, setViewMode] = useState<'local' | 'community'>('local');
  const [stages, setStages] = useState<Stage[]>(() => {
    try {
      const saved = localStorage.getItem('palace_custom_stages');
      if (saved) {
        const parsed = JSON.parse(saved);
        return [...DEFAULT_STAGES, ...parsed];
      }
    } catch {
      // fallback
    }
    return DEFAULT_STAGES;
  });

  // Community shared stages state
  const [communityStages, setCommunityStages] = useState<SharedStageRecord[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [loadingMoreCommunity, setLoadingMoreCommunity] = useState(false);
  const [hasMoreCommunity, setHasMoreCommunity] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [debouncedCommunitySearch, setDebouncedCommunitySearch] = useState('');
  const [communitySort, setCommunitySort] = useState<'popular' | 'used' | 'latest'>('popular');
  const [communityCategory, setCommunityCategory] = useState<string>('All');
  const nextOffsetRef = useRef(0);
  const fetchingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingSharedUuid, setEditingSharedUuid] = useState<string | null>(null);
  const [confirmDeleteStageId, setConfirmDeleteStageId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // New / Edit stage form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Fantasy');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newBlur, setNewBlur] = useState(2);
  const [newOpacity, setNewOpacity] = useState(0.65);
  const [sharePublicly, setSharePublicly] = useState(true);
  const [savingStage, setSavingStage] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCommunitySearch(communitySearch.trim()), 180);
    return () => clearTimeout(t);
  }, [communitySearch]);

  const showNotice = (msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice((curr) => (curr === msg ? null : curr)), 4000);
  };

  const fetchCommunityStages = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      if (append && fetchingMoreRef.current) return;
      try {
        if (append) {
          fetchingMoreRef.current = true;
          setLoadingMoreCommunity(true);
        } else {
          setCommunityLoading(true);
        }

        const params = new URLSearchParams();
        if (debouncedCommunitySearch) params.append('search', debouncedCommunitySearch);
        if (communityCategory !== 'All') params.append('category', communityCategory);
        params.append('sort', communitySort);
        params.append('limit', String(STAGE_PAGE_SIZE));
        params.append('offset', String(offset));

        const res = await fetch(`/api/stages?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: SharedStageRecord[] = data.stages || [];
          setCommunityStages((prev) => {
            if (!append) return incoming;
            const seen = new Set(prev.map((s) => s.uuid));
            return [...prev, ...incoming.filter((s) => !seen.has(s.uuid))];
          });
          setHasMoreCommunity(Boolean(data.hasMore));
          nextOffsetRef.current =
            typeof data.nextOffset === 'number' ? data.nextOffset : offset + incoming.length;
        }
      } catch (err) {
        console.error('Failed to load community stages:', err);
      } finally {
        fetchingMoreRef.current = false;
        setLoadingMoreCommunity(false);
        setCommunityLoading(false);
      }
    },
    [debouncedCommunitySearch, communityCategory, communitySort]
  );

  useEffect(() => {
    nextOffsetRef.current = 0;
    fetchCommunityStages(0, false);
  }, [fetchCommunityStages]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreCommunity || communityLoading || viewMode !== 'community') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMoreCommunity && !fetchingMoreRef.current) {
          fetchCommunityStages(nextOffsetRef.current, true);
        }
      },
      { rootMargin: '400px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreCommunity, communityLoading, viewMode, fetchCommunityStages]);

  const categories = ['All', ...Array.from(new Set(stages.map((s) => s.category)))];
  const communityCategories = [
    'All',
    'Cyberpunk',
    'Fantasy',
    'Dark Fantasy',
    'Sci-Fi',
    'Romance',
    'Modern',
    'Custom',
  ];

  const resetStageForm = () => {
    setEditingStageId(null);
    setEditingSharedUuid(null);
    setNewName('');
    setNewCategory('Fantasy');
    setNewImageUrl('');
    setNewDescription('');
    setNewTags('');
    setNewBlur(2);
    setNewOpacity(0.65);
    setSharePublicly(true);
  };

  const handleStartEditStage = (stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSharedUuid(null);
    setEditingStageId(stage.id);
    setNewName(stage.name);
    setNewCategory(stage.category || 'Custom');
    setNewImageUrl(stage.imageUrl);
    setNewDescription(stage.description || '');
    setNewTags('');
    setNewBlur(stage.blurLevel);
    setNewOpacity(stage.overlayOpacity);
    setSharePublicly(true);
    setIsAddingNew(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartEditSharedStage = (shared: SharedStageRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStageId(null);
    setEditingSharedUuid(shared.uuid);
    setNewName(shared.name);
    setNewCategory(shared.category || 'Custom');
    setNewImageUrl(shared.imageUrl);
    setNewDescription(shared.description || '');
    try {
      const parsedTags = typeof shared.tags === 'string' ? JSON.parse(shared.tags) : shared.tags || [];
      setNewTags(Array.isArray(parsedTags) ? parsedTags.join(', ') : '');
    } catch {
      setNewTags('');
    }
    setNewBlur(shared.blurLevel);
    setNewOpacity(shared.overlayOpacity);
    setSharePublicly(shared.isPublic);
    setIsAddingNew(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const publishStageToCloud = async (payload: {
    name: string;
    category: string;
    imageUrl: string;
    description: string;
    blurLevel: number;
    overlayOpacity: number;
    tags: string[];
    isPublic: boolean;
  }) => {
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/stages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        guestId,
        creatorName: profile?.username || profile?.displayName || user?.displayName || 'Community',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.stage) {
        setCommunityStages((prev) => [data.stage, ...prev]);
        return data.stage as SharedStageRecord;
      }
    }
    return null;
  };

  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newImageUrl.trim()) return;
    setSavingStage(true);

    try {
      const parsedTags = newTags
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean);

      if (editingSharedUuid) {
        const token = await getIdToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const res = await fetch(`/api/stages/${encodeURIComponent(editingSharedUuid)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            name: newName.trim(),
            category: newCategory.trim() || 'Custom',
            imageUrl: newImageUrl.trim(),
            description: newDescription.trim() || 'A custom atmosphere for roleplay.',
            blurLevel: newBlur,
            overlayOpacity: newOpacity,
            tags: parsedTags,
            isPublic: sharePublicly,
            guestId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.stage) {
            setCommunityStages((prev) =>
              prev.map((s) => (s.uuid === editingSharedUuid ? data.stage : s))
            );
            onSelectStage({
              id: data.stage.uuid,
              name: data.stage.name,
              category: data.stage.category,
              imageUrl: data.stage.imageUrl,
              description: data.stage.description,
              blurLevel: data.stage.blurLevel,
              overlayOpacity: data.stage.overlayOpacity,
            });
            showNotice(`✨ Updated community stage "${data.stage.name}"!`);
          }
        }
        setIsAddingNew(false);
        resetStageForm();
        return;
      }

      let updated: Stage[];
      let targetStage: Stage;

      if (editingStageId) {
        targetStage = {
          id: editingStageId,
          name: newName.trim(),
          category: newCategory.trim() || 'Custom',
          imageUrl: newImageUrl.trim(),
          description: newDescription.trim() || 'A custom atmosphere for roleplay.',
          blurLevel: newBlur,
          overlayOpacity: newOpacity,
        };
        updated = stages.map((s) => (s.id === editingStageId ? targetStage : s));
      } else {
        targetStage = {
          id: 'custom-' + Date.now(),
          name: newName.trim(),
          category: newCategory.trim() || 'Custom',
          imageUrl: newImageUrl.trim(),
          description: newDescription.trim() || 'A custom atmosphere for roleplay.',
          blurLevel: newBlur,
          overlayOpacity: newOpacity,
        };
        updated = [targetStage, ...stages];
      }

      setStages(updated);
      const customOnly = updated.filter((s) => s.id.startsWith('custom-'));
      try {
        localStorage.setItem('palace_custom_stages', JSON.stringify(customOnly));
      } catch (err) {
        console.error(err);
      }

      if (sharePublicly && !editingStageId) {
        const published = await publishStageToCloud({
          name: targetStage.name,
          category: targetStage.category,
          imageUrl: targetStage.imageUrl,
          description: targetStage.description,
          blurLevel: targetStage.blurLevel,
          overlayOpacity: targetStage.overlayOpacity,
          tags: parsedTags,
          isPublic: true,
        });
        if (published) {
          showNotice(`🌐 Saved & shared "${published.name}" with the Palace community!`);
        }
      } else {
        showNotice(`✅ Stage "${targetStage.name}" saved & activated!`);
      }

      onSelectStage(targetStage);
      setIsAddingNew(false);
      resetStageForm();
    } finally {
      setSavingStage(false);
    }
  };

  const handleShareLocalStage = async (stage: Stage, e: React.MouseEvent) => {
    e.stopPropagation();
    const published = await publishStageToCloud({
      name: stage.name,
      category: stage.category,
      imageUrl: stage.imageUrl,
      description: stage.description,
      blurLevel: stage.blurLevel,
      overlayOpacity: stage.overlayOpacity,
      tags: [stage.category].filter(Boolean),
      isPublic: true,
    });
    if (published) {
      showNotice(`🌐 Shared "${stage.name}" to Community Stages!`);
      setViewMode('community');
    }
  };

  const handleDeleteStage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteStageId !== id) {
      setConfirmDeleteStageId(id);
      setTimeout(() => setConfirmDeleteStageId((curr) => (curr === id ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteStageId(null);
    const updated = stages.filter((s) => s.id !== id);
    setStages(updated);
    const customOnly = updated.filter((s) => s.id.startsWith('custom-'));
    localStorage.setItem('palace_custom_stages', JSON.stringify(customOnly));
    if (editingStageId === id) {
      setIsAddingNew(false);
      resetStageForm();
    }
  };

  const handleUseCommunityStage = (shared: SharedStageRecord) => {
    onSelectStage({
      id: shared.uuid,
      name: shared.name,
      category: shared.category,
      imageUrl: shared.imageUrl,
      description: shared.description,
      blurLevel: shared.blurLevel,
      overlayOpacity: shared.overlayOpacity,
    });
    setCommunityStages((prev) =>
      prev.map((s) => (s.uuid === shared.uuid ? { ...s, useCount: s.useCount + 1 } : s))
    );
    fetch(`/api/stages/${encodeURIComponent(shared.uuid)}/use`, { method: 'POST' }).catch(
      console.error
    );
    showNotice(`🎭 Activated community stage "${shared.name}"!`);
  };

  const handleLikeCommunityStage = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCommunityStages((prev) =>
      prev.map((s) => (s.uuid === uuid ? { ...s, likeCount: s.likeCount + 1 } : s))
    );
    await fetch(`/api/stages/${encodeURIComponent(uuid)}/like`, { method: 'POST' }).catch(
      console.error
    );
  };

  const handleDeleteSharedStage = async (uuid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDeleteStageId !== uuid) {
      setConfirmDeleteStageId(uuid);
      setTimeout(() => setConfirmDeleteStageId((curr) => (curr === uuid ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteStageId(null);
    const token = await getIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `/api/stages/${encodeURIComponent(uuid)}?guestId=${encodeURIComponent(guestId)}`,
      { method: 'DELETE', headers }
    );
    if (res.ok) {
      setCommunityStages((prev) => prev.filter((s) => s.uuid !== uuid));
      showNotice('🗑️ Removed shared stage.');
    }
  };

  const filteredStages =
    selectedCategory === 'All'
      ? stages
      : stages.filter((s) => s.category === selectedCategory);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Stages &amp; Chat Atmospheres</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              /stages &bull; Share &amp; Explore
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Transform your roleplay chambers with dynamic visual stages, or share your own custom backdrops with the Palace community.
          </p>
        </div>

        <button
          onClick={() => {
            if (isAddingNew) {
              setIsAddingNew(false);
              resetStageForm();
            } else {
              resetStageForm();
              setIsAddingNew(true);
            }
          }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-amber-400 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{isAddingNew ? 'Close Form' : 'Create & Share Stage'}</span>
        </button>
      </div>

      {/* View Switcher Tabs */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1.5">
          <button
            type="button"
            onClick={() => setViewMode('local')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'local'
                ? 'bg-purple-600/35 text-purple-100 border border-purple-500/50 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>My &amp; Default Stages ({stages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('community')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'community'
                ? 'bg-gradient-to-r from-purple-600/40 to-amber-500/30 text-amber-100 border border-amber-400/40 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5 text-amber-300" />
            <span>Community Shared Stages ({communityStages.length}{hasMoreCommunity ? '+' : ''})</span>
          </button>
        </div>

        {statusNotice && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-200">
            {statusNotice}
          </div>
        )}
      </div>

      {/* New / Edit Stage Creator Drawer */}
      {isAddingNew && (
        <form
          onSubmit={handleSaveStage}
          className="mb-8 rounded-3xl border border-purple-500/30 bg-zinc-900/70 p-6 backdrop-blur-xl space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <Palette className="h-4 w-4" />
            <span>
              {editingSharedUuid
                ? 'Edit Community Stage'
                : editingStageId
                ? 'Edit Custom Stage'
                : 'Design & Share New Stage'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Stage Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Neon Cyber Cafe, Whispering Forest"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Category</label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Fantasy, Cyberpunk, Modern, Sci-Fi..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-300 mb-1">Background Image URL *</label>
            <input
              type="url"
              required
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/... or direct image link"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">Mood Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Atmospheric sensory details..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-300 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="Cyberpunk, Rain, Cozy, Tavern..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Sliders for Blur & Overlay */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
            <div>
              <div className="flex justify-between text-xs text-zinc-300 font-medium mb-1">
                <span>Backdrop Blur</span>
                <span className="text-purple-400">{newBlur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={newBlur}
                onChange={(e) => setNewBlur(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-zinc-300 font-medium mb-1">
                <span>Dark Shade Overlay</span>
                <span className="text-purple-400">{Math.round(newOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.9"
                step="0.05"
                value={newOpacity}
                onChange={(e) => setNewOpacity(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          </div>

          {/* Live Preview if URL provided */}
          {newImageUrl && (
            <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-purple-500/40">
              <img
                src={newImageUrl}
                alt="Preview"
                className="h-full w-full object-cover"
                style={{ filter: `blur(${newBlur}px)` }}
              />
              <div
                className="absolute inset-0 bg-zinc-950"
                style={{ opacity: newOpacity }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow">
                  Sample Chat Text Overlay Preview
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={sharePublicly}
                onChange={(e) => setSharePublicly(e.target.checked)}
                className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
              />
              <Globe className="h-3.5 w-3.5 text-amber-300" />
              <span>Share publicly to Community Stages</span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingNew(false);
                  resetStageForm();
                }}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStage}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500 disabled:opacity-60 cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>
                  {savingStage
                    ? 'Saving...'
                    : editingSharedUuid
                    ? 'Update Shared Stage'
                    : editingStageId
                    ? 'Update & Activate Stage'
                    : sharePublicly
                    ? 'Save, Share & Activate Stage'
                    : 'Save & Activate Stage'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}

      {viewMode === 'local' ? (
        <>
          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all border ${
                  selectedCategory === cat
                    ? 'border-purple-500 bg-purple-600/30 text-purple-200 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Stages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStages.map((stage, idx) => {
              const isActive = activeStageId === stage.id;
              return (
                <ViewportSlot
                  key={stage.id}
                  estimatedHeight={252}
                  rootMargin="500px 0px"
                  initialVisible={idx < 6}
                  testId="stage-slot"
                >
                  <div
                    onClick={() => onSelectStage(stage)}
                    className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border transition-all cursor-pointer shadow-lg ${
                      isActive
                        ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-amber-950/30 scale-[1.02]'
                        : 'border-zinc-800/80 hover:border-purple-500/50 hover:shadow-purple-950/20'
                    }`}
                  >
                    {/* Background Backdrop Image */}
                    <div className="relative h-48 w-full overflow-hidden bg-zinc-950">
                      <img
                        src={stage.imageUrl}
                        alt={stage.name}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        style={{ filter: `blur(${stage.blurLevel}px)` }}
                      />
                      <div
                        className="absolute inset-0 bg-zinc-950"
                        style={{ opacity: stage.overlayOpacity }}
                      />

                      {/* Badges on top */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                        <span className="rounded-full bg-zinc-950/70 border border-zinc-700/60 px-2.5 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-md">
                          {stage.category}
                        </span>

                        {isActive ? (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[10px] font-extrabold text-zinc-950 shadow">
                            <Check className="h-3 w-3 stroke-[3]" />
                            ACTIVE STAGE
                          </span>
                        ) : (
                          <span className="opacity-0 group-hover:opacity-100 rounded-full bg-purple-600/80 px-2 py-0.5 text-[10px] font-bold text-white transition-opacity">
                            Click to Apply
                          </span>
                        )}
                      </div>

                      {/* Stage Info inside card */}
                      <div className="absolute bottom-3 left-3 right-3">
                        <h3 className="text-sm font-bold text-white drop-shadow-md">
                          {stage.name}
                        </h3>
                        <p className="text-[11px] text-zinc-300 line-clamp-2 mt-0.5 drop-shadow">
                          {stage.description}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Card Controls */}
                    <div className="flex items-center justify-between border-t border-zinc-800/60 bg-zinc-900/90 px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
                        <span>Blur: {stage.blurLevel}px</span>
                        <span>Shade: {Math.round(stage.overlayOpacity * 100)}%</span>
                      </div>

                      {stage.id.startsWith('custom-') && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleShareLocalStage(stage, e)}
                            className="flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/15 px-2 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-500/30 transition-colors"
                            title="Publish to Community Stages"
                          >
                            <Share2 className="h-3 w-3" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleStartEditStage(stage, e)}
                            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 transition-colors"
                            title="Edit custom stage"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteStage(stage.id, e)}
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition-colors ${
                              confirmDeleteStageId === stage.id
                                ? 'border-rose-500 bg-rose-600 text-white'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                            }`}
                            title={
                              confirmDeleteStageId === stage.id
                                ? 'Click again to delete stage'
                                : 'Delete custom stage'
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>{confirmDeleteStageId === stage.id ? 'Confirm' : 'Delete'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </ViewportSlot>
              );
            })}
          </div>
        </>
      ) : (
        /* Community Shared Stages View */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                placeholder="Search community stages by title, creator, mood, or tag..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 pl-10 pr-4 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 self-start">
              {[
                { id: 'popular', label: 'Popular', icon: Flame },
                { id: 'used', label: 'Most Used', icon: Sparkles },
                { id: 'latest', label: 'Newest', icon: Clock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCommunitySort(item.id as 'popular' | 'used' | 'latest')}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      communitySort === item.id
                        ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {communityCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCommunityCategory(cat)}
                className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all border cursor-pointer ${
                  communityCategory === cat
                    ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {communityLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : communityStages.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400 space-y-2">
              <Globe className="h-10 w-10 text-purple-400 mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-white">No Community Stages Found</h3>
              <p className="text-xs text-zinc-400">
                Be the first to design and share an atmospheric stage in this category!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {communityStages.map((shared, idx) => {
                  const isActive = activeStageId === shared.uuid;
                  const canEdit = isOwnedByRequester(shared.userId, {
                    userUid: user?.uid,
                    guestId,
                  });
                  let parsedTags: string[] = [];
                  try {
                    parsedTags = shared.tags ? JSON.parse(shared.tags) : [];
                  } catch {
                    parsedTags = [];
                  }

                  return (
                    <ViewportSlot
                      key={shared.uuid}
                      estimatedHeight={280}
                      rootMargin="500px 0px"
                      initialVisible={idx < 6}
                      testId="community-stage-slot"
                    >
                      <div
                        className={`group flex h-full flex-col justify-between overflow-hidden rounded-3xl border transition-all shadow-lg ${
                          isActive
                            ? 'border-amber-400 ring-2 ring-amber-400/40 bg-zinc-900/90'
                            : 'border-zinc-800/90 bg-zinc-900/75 hover:border-purple-500/50'
                        }`}
                      >
                        <div className="relative h-44 w-full overflow-hidden bg-zinc-950">
                          <img
                            src={shared.imageUrl}
                            alt={shared.name}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            style={{ filter: `blur(${shared.blurLevel}px)` }}
                          />
                          <div
                            className="absolute inset-0 bg-zinc-950"
                            style={{ opacity: shared.overlayOpacity }}
                          />

                          <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                            <span className="rounded-full bg-zinc-950/75 border border-zinc-700/60 px-2.5 py-0.5 text-[10px] font-bold text-zinc-200 backdrop-blur-md">
                              {shared.category}
                            </span>
                            {isActive && (
                              <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold text-zinc-950 shadow">
                                <Check className="h-3 w-3 stroke-[3]" />
                                ACTIVE
                              </span>
                            )}
                          </div>

                          <div className="absolute bottom-3 left-3 right-3">
                            <h3 className="text-sm font-bold text-white drop-shadow-md truncate">
                              {shared.name}
                            </h3>
                            <p className="text-[11px] text-zinc-300 line-clamp-2 mt-0.5">
                              {shared.description}
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 space-y-2.5 bg-zinc-900/95 border-t border-zinc-800/70">
                          <div className="flex items-center justify-between text-[11px] text-zinc-400">
                            <button
                              type="button"
                              onClick={() => onViewCreator?.(shared.creatorName)}
                              className="flex items-center gap-1 font-semibold text-purple-300 hover:text-purple-200 truncate cursor-pointer"
                            >
                              <UserIcon className="h-3 w-3 shrink-0" />
                              <span className="truncate">@{shared.creatorName}</span>
                            </button>
                            <span className="font-mono text-[10px] text-zinc-500 shrink-0">
                              {shared.useCount} uses &bull; Blur {shared.blurLevel}px
                            </span>
                          </div>

                          {parsedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {parsedTags.slice(0, 3).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-md bg-zinc-950 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleLikeCommunityStage(shared.uuid, e)}
                                className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-900/30 transition-colors cursor-pointer"
                              >
                                <Heart className="h-3 w-3" />
                                <span>{shared.likeCount}</span>
                              </button>

                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartEditSharedStage(shared, e)}
                                    className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-1.5 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                                    title="Edit shared stage"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSharedStage(shared.uuid, e)}
                                    className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                                      confirmDeleteStageId === shared.uuid
                                        ? 'border-rose-500 bg-rose-600 text-white'
                                        : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                                    }`}
                                    title="Delete shared stage"
                                  >
                                    {confirmDeleteStageId === shared.uuid ? (
                                      'Confirm'
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUseCommunityStage(shared)}
                              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-amber-500 text-zinc-950'
                                  : 'bg-purple-600 text-white hover:bg-purple-500'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>{isActive ? 'Active Stage' : 'Use Stage'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </ViewportSlot>
                  );
                })}
              </div>

              {hasMoreCommunity && (
                <div ref={sentinelRef} className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => fetchCommunityStages(nextOffsetRef.current, true)}
                    disabled={loadingMoreCommunity}
                    className="rounded-xl border border-purple-500/40 bg-zinc-900/90 px-5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-900/40 cursor-pointer"
                  >
                    {loadingMoreCommunity ? 'Loading more stages...' : 'Load More Stages'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
