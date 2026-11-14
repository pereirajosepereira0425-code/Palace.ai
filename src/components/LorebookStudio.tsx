import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  Save,
  Check,
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
import { LorebookEntryItem, SharedLorebookRecord } from '../types/index.ts';
import { isOwnedByRequester } from '../utils/ownership.ts';
import { parseLorebookEntries } from '../utils/communityUtils.ts';

export type LoreEntry = LorebookEntryItem;

export interface SavedLorebook {
  id: string;
  name: string;
  description: string;
  scanDepth: number;
  entries: LoreEntry[];
  updatedAt: string;
}

const LOREBOOK_PAGE_SIZE = 24;

interface LorebookStudioProps {
  onViewCreator?: (username: string) => void;
}

export const LorebookStudio: React.FC<LorebookStudioProps> = ({ onViewCreator }) => {
  const { user, profile, guestId, getIdToken } = useAuth();

  const [viewMode, setViewMode] = useState<'editor' | 'community'>('editor');
  const [editingLorebookId, setEditingLorebookId] = useState<string | null>(null);
  const [editingSharedUuid, setEditingSharedUuid] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(null);

  const [activeLorebookName, setActiveLorebookName] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('palace_active_lorebook');
      if (raw) return JSON.parse(raw).name || '';
    } catch {}
    return '';
  });

  const [savedLorebooks, setSavedLorebooks] = useState<SavedLorebook[]>(() => {
    try {
      const raw = localStorage.getItem('palace_saved_lorebooks');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Community shared lorebooks state
  const [communityLorebooks, setCommunityLorebooks] = useState<SharedLorebookRecord[]>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [loadingMoreCommunity, setLoadingMoreCommunity] = useState(false);
  const [hasMoreCommunity, setHasMoreCommunity] = useState(false);
  const [communitySearch, setCommunitySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [communitySort, setCommunitySort] = useState<'popular' | 'used' | 'latest'>('popular');
  const nextOffsetRef = useRef(0);
  const fetchingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState('New World Lorebook');
  const [description, setDescription] = useState('Comprehensive world info and lore triggers.');
  const [scanDepth, setScanDepth] = useState(4);
  const [tagsInput, setTagsInput] = useState('');
  const [sharePublicly, setSharePublicly] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const [entries, setEntries] = useState<LoreEntry[]>([
    {
      id: '1',
      keys: 'Neo-Veridia, Megalopolis',
      secondaryKeys: '',
      content: 'A high-vertical cyberpunk metropolis built on seven tectonic spires, ruled by the SynthGen syndicate.',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    },
    {
      id: '2',
      keys: 'Obsidian Citadel, Nightshade',
      secondaryKeys: '',
      content: 'The ancient gothic basalt fortress carved into Mount Umbra. Home to the vampire court of Malakor.',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    },
  ]);

  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(communitySearch.trim()), 180);
    return () => clearTimeout(t);
  }, [communitySearch]);

  const showNotice = (msg: string) => {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg((curr) => (curr === msg ? '' : curr)), 4000);
  };

  const fetchCommunityLorebooks = useCallback(
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
        if (debouncedSearch) params.append('search', debouncedSearch);
        params.append('sort', communitySort);
        params.append('limit', String(LOREBOOK_PAGE_SIZE));
        params.append('offset', String(offset));

        const res = await fetch(`/api/lorebooks?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: SharedLorebookRecord[] = data.lorebooks || [];
          setCommunityLorebooks((prev) => {
            if (!append) return incoming;
            const seen = new Set(prev.map((lb) => lb.uuid));
            return [...prev, ...incoming.filter((lb) => !seen.has(lb.uuid))];
          });
          setHasMoreCommunity(Boolean(data.hasMore));
          nextOffsetRef.current =
            typeof data.nextOffset === 'number' ? data.nextOffset : offset + incoming.length;
        }
      } catch (err) {
        console.error('Failed to load community lorebooks:', err);
      } finally {
        fetchingMoreRef.current = false;
        setLoadingMoreCommunity(false);
        setCommunityLoading(false);
      }
    },
    [debouncedSearch, communitySort]
  );

  useEffect(() => {
    nextOffsetRef.current = 0;
    fetchCommunityLorebooks(0, false);
  }, [fetchCommunityLorebooks]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMoreCommunity || communityLoading || viewMode !== 'community') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entriesList) => {
        if (entriesList[0]?.isIntersecting && hasMoreCommunity && !fetchingMoreRef.current) {
          fetchCommunityLorebooks(nextOffsetRef.current, true);
        }
      },
      { rootMargin: '400px 0px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreCommunity, communityLoading, viewMode, fetchCommunityLorebooks]);

  const addEntry = () => {
    const newEntry: LoreEntry = {
      id: Math.random().toString(36).substring(2, 9),
      keys: '',
      secondaryKeys: '',
      content: '',
      insertionOrder: 100,
      enabled: true,
      constant: false,
      caseSensitive: false,
    };
    setEntries([...entries, newEntry]);
  };

  const updateEntry = (id: string, updates: Partial<LoreEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  const removeEntry = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);

        setName(parsed.name || parsed.title || 'Imported Lorebook');
        setDescription(parsed.description || '');

        const importedEntries: LoreEntry[] = [];
        const rawEntries = parsed.entries || (parsed.character_book && parsed.character_book.entries) || [];

        for (const item of rawEntries) {
          const keysStr = Array.isArray(item.keys) ? item.keys.join(', ') : item.keys || item.key || '';
          importedEntries.push({
            id: Math.random().toString(36).substring(2, 9),
            keys: keysStr,
            secondaryKeys: Array.isArray(item.secondary_keys) ? item.secondary_keys.join(', ') : '',
            content: item.content || item.value || '',
            insertionOrder: item.insertion_order || 100,
            enabled: item.enabled !== false,
            constant: Boolean(item.constant),
            caseSensitive: Boolean(item.case_sensitive),
          });
        }

        if (importedEntries.length > 0) {
          setEntries(importedEntries);
        }

        showNotice(`Imported ${importedEntries.length} lore entries successfully!`);
      } catch (err: any) {
        showNotice(`Invalid lorebook JSON: ${err?.message || 'Unable to parse file'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExportJson = () => {
    const exportData = {
      name,
      description,
      scan_depth: scanDepth,
      entries: entries.map((e, index) => ({
        keys: e.keys.split(',').map((k) => k.trim()).filter(Boolean),
        secondary_keys: e.secondaryKeys?.split(',').map((k) => k.trim()).filter(Boolean) || [],
        content: e.content,
        insertion_order: e.insertionOrder,
        enabled: e.enabled,
        constant: e.constant,
        case_sensitive: e.caseSensitive,
        id: index + 1,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_lorebook.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activateLorebookForChats = (lbName: string, lbDesc: string, lbEntries: LoreEntry[]) => {
    localStorage.setItem(
      'palace_active_lorebook',
      JSON.stringify({ name: lbName, description: lbDesc, entries: lbEntries })
    );
    setActiveLorebookName(lbName);
  };

  const handleSaveToBrowser = () => {
    const id = editingLorebookId || `lb_${Date.now()}`;
    const record: SavedLorebook = {
      id,
      name: name.trim() || 'Untitled Lorebook',
      description: description.trim(),
      scanDepth,
      entries,
      updatedAt: new Date().toISOString(),
    };
    const nextList = editingLorebookId
      ? savedLorebooks.map((lb) => (lb.id === id ? record : lb))
      : [record, ...savedLorebooks];
    setSavedLorebooks(nextList);
    setEditingLorebookId(id);
    localStorage.setItem('palace_saved_lorebooks', JSON.stringify(nextList));
    activateLorebookForChats(record.name, record.description, entries);
    showNotice(editingLorebookId ? `Updated "${record.name}"!` : `Saved "${record.name}" & activated for chats!`);
  };

  const handlePublishToCommunity = async () => {
    if (!name.trim()) return;
    setPublishing(true);
    try {
      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#+/, ''))
        .filter(Boolean);

      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        name: name.trim(),
        description: description.trim() || 'Community lorebook codex.',
        scanDepth,
        entries,
        tags: parsedTags,
        isPublic: sharePublicly,
        guestId,
        creatorName: profile?.username || profile?.displayName || user?.displayName || 'Community',
      };

      if (editingSharedUuid) {
        const res = await fetch(`/api/lorebooks/${encodeURIComponent(editingSharedUuid)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.lorebook) {
            setCommunityLorebooks((prev) =>
              prev.map((lb) => (lb.uuid === editingSharedUuid ? data.lorebook : lb))
            );
            activateLorebookForChats(data.lorebook.name, data.lorebook.description, entries);
            showNotice(`🌐 Updated shared lorebook "${data.lorebook.name}"!`);
          }
        }
      } else {
        const res = await fetch('/api/lorebooks', {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.lorebook) {
            setEditingSharedUuid(data.lorebook.uuid);
            setCommunityLorebooks((prev) => [data.lorebook, ...prev]);
            activateLorebookForChats(data.lorebook.name, data.lorebook.description, entries);
            showNotice(`🌐 Published "${data.lorebook.name}" to Community Lorebooks!`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to publish lorebook:', err);
      showNotice('Could not publish lorebook. Please check your connection.');
    } finally {
      setPublishing(false);
    }
  };

  const handleShareSavedLorebook = async (lb: SavedLorebook) => {
    const token = await getIdToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/lorebooks', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: lb.name,
        description: lb.description,
        scanDepth: lb.scanDepth || 4,
        entries: lb.entries,
        tags: ['World Info'],
        isPublic: true,
        guestId,
        creatorName: profile?.username || profile?.displayName || user?.displayName || 'Community',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.lorebook) {
        setCommunityLorebooks((prev) => [data.lorebook, ...prev]);
        showNotice(`🌐 Shared "${lb.name}" to Community Lorebooks!`);
        setViewMode('community');
      }
    }
  };

  const handleLoadForEdit = (lb: SavedLorebook) => {
    setEditingSharedUuid(null);
    setEditingLorebookId(lb.id);
    setName(lb.name);
    setDescription(lb.description);
    setScanDepth(lb.scanDepth || 4);
    setEntries(lb.entries || []);
    setViewMode('editor');
    showNotice(`✏️ Editing "${lb.name}"`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEditSharedLorebook = (shared: SharedLorebookRecord) => {
    setEditingLorebookId(null);
    setEditingSharedUuid(shared.uuid);
    setName(shared.name);
    setDescription(shared.description);
    setScanDepth(shared.scanDepth || 4);
    setEntries(parseLorebookEntries(shared.entries));
    try {
      const parsedTags = typeof shared.tags === 'string' ? JSON.parse(shared.tags) : shared.tags || [];
      setTagsInput(Array.isArray(parsedTags) ? parsedTags.join(', ') : '');
    } catch {
      setTagsInput('');
    }
    setSharePublicly(shared.isPublic);
    setViewMode('editor');
    showNotice(`✏️ Editing shared lorebook "${shared.name}"`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUseCommunityLorebook = (shared: SharedLorebookRecord) => {
    const parsedEntries = parseLorebookEntries(shared.entries);
    setName(shared.name);
    setDescription(shared.description);
    setScanDepth(shared.scanDepth || 4);
    setEntries(parsedEntries);
    activateLorebookForChats(shared.name, shared.description, parsedEntries);
    setCommunityLorebooks((prev) =>
      prev.map((lb) => (lb.uuid === shared.uuid ? { ...lb, useCount: lb.useCount + 1 } : lb))
    );
    fetch(`/api/lorebooks/${encodeURIComponent(shared.uuid)}/use`, { method: 'POST' }).catch(
      console.error
    );
    showNotice(`📚 Activated community lorebook "${shared.name}" for all your chats!`);
  };

  const handleLikeCommunityLorebook = async (uuid: string) => {
    setCommunityLorebooks((prev) =>
      prev.map((lb) => (lb.uuid === uuid ? { ...lb, likeCount: lb.likeCount + 1 } : lb))
    );
    await fetch(`/api/lorebooks/${encodeURIComponent(uuid)}/like`, { method: 'POST' }).catch(
      console.error
    );
  };

  const handleDeleteSharedLorebook = async (uuid: string) => {
    if (confirmDeleteId !== uuid) {
      setConfirmDeleteId(uuid);
      setTimeout(() => setConfirmDeleteId((curr) => (curr === uuid ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteId(null);
    const token = await getIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `/api/lorebooks/${encodeURIComponent(uuid)}?guestId=${encodeURIComponent(guestId)}`,
      { method: 'DELETE', headers }
    );
    if (res.ok) {
      setCommunityLorebooks((prev) => prev.filter((lb) => lb.uuid !== uuid));
      if (editingSharedUuid === uuid) setEditingSharedUuid(null);
      showNotice('🗑️ Removed shared lorebook.');
    }
  };

  const handleStartNewLorebook = () => {
    setEditingLorebookId(null);
    setEditingSharedUuid(null);
    setName('New World Lorebook');
    setDescription('Comprehensive world info and lore triggers.');
    setScanDepth(4);
    setTagsInput('');
    setEntries([]);
  };

  const handleDeleteLorebook = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId((curr) => (curr === id ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteId(null);
    const nextList = savedLorebooks.filter((lb) => lb.id !== id);
    setSavedLorebooks(nextList);
    localStorage.setItem('palace_saved_lorebooks', JSON.stringify(nextList));
    if (editingLorebookId === id) {
      handleStartNewLorebook();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Title & Import/Export Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Lorebook Studio</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              Chub &bull; World Info
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Build standalone lorebooks with trigger keywords, or browse &amp; share community world info codices for live chats.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-purple-500/40 bg-purple-950/30 px-3.5 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-900/40 transition-all shadow-sm">
            <Upload className="h-4 w-4" />
            <span>Import Lorebook</span>
            <input type="file" accept="*/*" onChange={handleImportJson} className="hidden" />
          </label>

          <button
            onClick={handleExportJson}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-purple-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-1.5">
          <button
            type="button"
            onClick={() => setViewMode('editor')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'editor'
                ? 'bg-purple-600/35 text-purple-100 border border-purple-500/50 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Lorebook Editor &amp; Saved</span>
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
            <span>
              Community Lorebooks ({communityLorebooks.length}
              {hasMoreCommunity ? '+' : ''})
            </span>
          </button>
        </div>

        {activeLorebookName && (
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Active in Chats: {activeLorebookName}</span>
          </div>
        )}
      </div>

      {savedMsg && (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
          {savedMsg}
        </div>
      )}

      {viewMode === 'editor' ? (
        <>
          {/* Meta Configuration Card */}
          <div className="mb-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Lorebook Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Scan Depth (Messages)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={scanDepth}
                  onChange={(e) => setScanDepth(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-sm font-semibold text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Fantasy, Cyberpunk, Magic, Academy..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Entries List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-400" />
                <span>Lorebook Entries ({entries.length})</span>
              </h2>

              <button
                onClick={addEntry}
                className="flex items-center gap-1.5 rounded-xl bg-purple-600/30 border border-purple-500/50 px-3.5 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/50 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add New Entry</span>
              </button>
            </div>

            <div className="space-y-4">
              {entries.map((entry, index) => (
                <ViewportSlot
                  key={entry.id}
                  estimatedHeight={158}
                  rootMargin="500px 0px"
                  initialVisible={index < 6}
                  forceMounted={focusedEntryId === entry.id}
                  testId="lore-entry-slot"
                >
                  <div
                    onFocus={() => setFocusedEntryId(entry.id)}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setFocusedEntryId((curr) => (curr === entry.id ? null : curr));
                      }
                    }}
                    className={`rounded-2xl border p-4 space-y-3 transition-all backdrop-blur-md ${
                      entry.enabled
                        ? 'border-zinc-800 bg-zinc-900/60'
                        : 'border-zinc-800/40 bg-zinc-950/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-purple-500/20 text-[10px] font-bold text-purple-300">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={entry.keys}
                          onChange={(e) => updateEntry(entry.id, { keys: e.target.value })}
                          placeholder="Primary Keywords (comma-separated, e.g. Citadel, Malakor)"
                          className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs font-semibold text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none w-64 sm:w-80"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.constant}
                            onChange={(e) => updateEntry(entry.id, { constant: e.target.checked })}
                            className="rounded border-zinc-700 text-purple-600"
                          />
                          <span>Constant</span>
                        </label>

                        <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.enabled}
                            onChange={(e) => updateEntry(entry.id, { enabled: e.target.checked })}
                            className="rounded border-zinc-700 text-purple-600"
                          />
                          <span>Enabled</span>
                        </label>

                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={entry.content}
                        onChange={(e) => updateEntry(entry.id, { content: e.target.value })}
                        placeholder="The knowledge or background injected into character context when the keywords are matched..."
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-200 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </ViewportSlot>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sharePublicly}
                  onChange={(e) => setSharePublicly(e.target.checked)}
                  className="rounded border-zinc-700 text-purple-600 focus:ring-purple-500"
                />
                <Globe className="h-3.5 w-3.5 text-amber-300" />
                <span>Public in Community Lorebooks</span>
              </label>

              <div className="flex flex-wrap items-center justify-end gap-2.5">
                {(editingLorebookId || editingSharedUuid) && (
                  <button
                    type="button"
                    onClick={handleStartNewLorebook}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    + New Lorebook
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveToBrowser}
                  className="flex items-center gap-2 rounded-xl border border-purple-500/40 bg-zinc-900 px-5 py-2.5 text-xs font-bold text-purple-200 hover:bg-purple-950/50 transition-all cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>{editingLorebookId ? 'Update Local' : 'Save & Use Locally'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePublishToCommunity}
                  disabled={publishing || !name.trim()}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:from-purple-500 hover:to-amber-400 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <Globe className="h-4 w-4" />
                  <span>
                    {publishing
                      ? 'Publishing...'
                      : editingSharedUuid
                      ? 'Update Community Lorebook'
                      : 'Publish to Community'}
                  </span>
                </button>
              </div>
            </div>

            {/* Saved Lorebooks List with Edit, Share & Delete */}
            {savedLorebooks.length > 0 && (
              <div className="pt-6 border-t border-zinc-800/80 space-y-3">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-purple-400" />
                  <span>Your Saved Lorebooks ({savedLorebooks.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {savedLorebooks.map((lb, idx) => (
                    <ViewportSlot
                      key={lb.id}
                      estimatedHeight={76}
                      rootMargin="450px 0px"
                      initialVisible={idx < 6}
                      testId="saved-lorebook-slot"
                    >
                      <div
                        className={`rounded-2xl border p-4 flex items-center justify-between gap-3 ${
                          editingLorebookId === lb.id
                            ? 'border-purple-500/60 bg-purple-950/20'
                            : 'border-zinc-800 bg-zinc-900/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{lb.name}</div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {lb.entries.length} entries &bull; Scan depth {lb.scanDepth}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleShareSavedLorebook(lb)}
                            className="flex items-center gap-1 rounded-xl border border-purple-500/40 bg-purple-500/15 px-2.5 py-1.5 text-xs font-bold text-purple-200 hover:bg-purple-500/30 transition-all cursor-pointer"
                            title="Publish to Community Lorebooks"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span>Share</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadForEdit(lb)}
                            className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteLorebook(lb.id)}
                            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                              confirmDeleteId === lb.id
                                ? 'border-rose-500 bg-rose-600 text-white'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{confirmDeleteId === lb.id ? 'Confirm' : 'Delete'}</span>
                          </button>
                        </div>
                      </div>
                    </ViewportSlot>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Community Shared Lorebooks View */
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={communitySearch}
                onChange={(e) => setCommunitySearch(e.target.value)}
                placeholder="Search community lorebooks by world name, creator, or tag..."
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

          {communityLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : communityLorebooks.length === 0 ? (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-zinc-400 space-y-2">
              <BookOpen className="h-10 w-10 text-purple-400 mx-auto opacity-60" />
              <h3 className="text-sm font-bold text-white">No Community Lorebooks Found</h3>
              <p className="text-xs text-zinc-400">
                Publish your own lorebook in the Editor tab to share worldbuilding with other Palace creators!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {communityLorebooks.map((shared, idx) => {
                  const parsedEntries = parseLorebookEntries(shared.entries);
                  const isActive = activeLorebookName === shared.name;
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
                      estimatedHeight={220}
                      rootMargin="450px 0px"
                      initialVisible={idx < 6}
                      testId="community-lorebook-slot"
                    >
                      <div
                        className={`flex h-full flex-col justify-between rounded-3xl border p-5 transition-all space-y-4 ${
                          isActive
                            ? 'border-amber-400/70 bg-amber-950/15 ring-1 ring-amber-400/30'
                            : 'border-zinc-800 bg-zinc-900/70 hover:border-purple-500/40'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-base font-black text-white truncate">
                                {shared.name}
                              </h3>
                              <button
                                type="button"
                                onClick={() => onViewCreator?.(shared.creatorName)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-purple-300 hover:text-purple-200 mt-0.5 cursor-pointer"
                              >
                                <UserIcon className="h-3 w-3" />
                                <span>@{shared.creatorName}</span>
                              </button>
                            </div>
                            <span className="shrink-0 rounded-full border border-purple-500/30 bg-purple-950/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-200">
                              {parsedEntries.length} entries &bull; Depth {shared.scanDepth}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed">
                            {shared.description}
                          </p>

                          {parsedEntries.length > 0 && (
                            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 text-[11px] text-zinc-400 space-y-1">
                              <div className="font-bold text-zinc-300 truncate">
                                Triggers: {parsedEntries.slice(0, 3).map((e) => e.keys).filter(Boolean).join(' • ')}
                              </div>
                              <div className="line-clamp-1 italic text-zinc-500">
                                {parsedEntries[0]?.content}
                              </div>
                            </div>
                          )}

                          {parsedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {parsedTags.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] font-semibold text-zinc-300"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/70">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLikeCommunityLorebook(shared.uuid)}
                              className="flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/20 px-2.5 py-1.5 text-[11px] font-bold text-rose-300 hover:bg-rose-900/30 cursor-pointer"
                            >
                              <Heart className="h-3 w-3" />
                              <span>{shared.likeCount}</span>
                            </button>
                            <span className="text-[11px] text-zinc-500 font-mono">
                              {shared.useCount} uses
                            </span>
                            {canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditSharedLorebook(shared)}
                                  className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-1.5 text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                                  title="Edit shared lorebook"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSharedLorebook(shared.uuid)}
                                  className={`rounded-xl border px-2 py-1.5 text-[11px] font-bold cursor-pointer ${
                                    confirmDeleteId === shared.uuid
                                      ? 'border-rose-500 bg-rose-600 text-white'
                                      : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                                  }`}
                                  title="Delete shared lorebook"
                                >
                                  {confirmDeleteId === shared.uuid ? (
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
                            onClick={() => handleUseCommunityLorebook(shared)}
                            className={`flex items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-amber-500 text-zinc-950'
                                : 'bg-purple-600 text-white hover:bg-purple-500'
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>{isActive ? 'Active in Chats' : 'Use Lorebook'}</span>
                          </button>
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
                    onClick={() => fetchCommunityLorebooks(nextOffsetRef.current, true)}
                    disabled={loadingMoreCommunity}
                    className="rounded-xl border border-purple-500/40 bg-zinc-900/90 px-5 py-2 text-xs font-bold text-purple-200 hover:bg-purple-900/40 cursor-pointer"
                  >
                    {loadingMoreCommunity ? 'Loading more lorebooks...' : 'Load More Lorebooks'}
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
