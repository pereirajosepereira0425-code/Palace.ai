import React, { useState, useEffect } from 'react';
import {
  User,
  Heart,
  Sparkles,
  Plus,
  Search,
  Share2,
  Check,
  Flame,
  Clock,
  Copy,
  Tag,
  Shield,
  Edit3,
  Trash2,
} from 'lucide-react';
import { SharedPersona } from '../types/index.ts';
import { isOwnedByRequester } from '../utils/ownership.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface PersonaGalleryProps {
  onSelectPersona: (persona: { name: string; bio: string }) => void;
  onOpenCreateModal: () => void;
  onEditPersona?: (persona: SharedPersona) => void;
  refreshKey?: number;
}

export const PersonaGallery: React.FC<PersonaGalleryProps> = ({
  onSelectPersona,
  onOpenCreateModal,
  onEditPersona,
  refreshKey = 0,
}) => {
  const { persona: activePersona, setPersona, savePersonaToCloud, guestId, user, getIdToken } = useAuth();

  const [personas, setPersonas] = useState<SharedPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'popular' | 'latest' | 'used'>('popular');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [appliedId, setAppliedId] = useState<number | null>(null);
  const [confirmDeleteUuid, setConfirmDeleteUuid] = useState<string | null>(null);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      params.append('sort', sortOrder);

      const res = await fetch(`/api/personas?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPersonas(data.personas || []);
      }
    } catch (err) {
      console.error('Failed to load personas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [searchQuery, sortOrder, refreshKey]);

  const handleLike = async (personaId: number) => {
    try {
      const res = await fetch(`/api/personas/${personaId}/like`, { method: 'POST' });
      if (res.ok) {
        setPersonas((prev) =>
          prev.map((p) => (p.id === personaId ? { ...p, likeCount: p.likeCount + 1 } : p))
        );
      }
    } catch (err) {
      console.error('Failed to like persona:', err);
    }
  };

  const handleDelete = async (p: SharedPersona) => {
    if (confirmDeleteUuid !== p.uuid) {
      setConfirmDeleteUuid(p.uuid);
      setTimeout(() => setConfirmDeleteUuid((curr) => (curr === p.uuid ? null : curr)), 3500);
      return;
    }
    setConfirmDeleteUuid(null);
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/personas/${p.uuid}?guestId=${encodeURIComponent(guestId)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setPersonas((prev) => prev.filter((item) => item.uuid !== p.uuid));
      }
    } catch (err) {
      console.error('Failed to delete persona:', err);
    }
  };

  const handleUsePersona = async (p: SharedPersona) => {
    savePersonaToCloud(p.name, p.bio);
    setAppliedId(p.id);
    setTimeout(() => setAppliedId(null), 2000);

    fetch(`/api/personas/${p.id}/use`, { method: 'POST' }).catch(console.error);
    onSelectPersona({ name: p.name, bio: p.bio });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Community Personas</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              Chub &bull; Palace Sharing
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Discover and share public roleplay personas. Adopt any persona with one click to shape how characters see you!
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/40 hover:from-purple-500 hover:to-fuchsia-500 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Share Your Persona</span>
        </button>
      </div>

      {/* Currently Active Persona Highlight */}
      <div className="mb-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-zinc-900/60 to-purple-950/20 p-4 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <User className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Your Current Active RP Identity
            </span>
            <h3 className="font-bold text-sm text-zinc-100">
              {activePersona.name}{' '}
              <span className="text-xs font-normal text-zinc-400">
                &mdash; {activePersona.bio.slice(0, 80)}...
              </span>
            </h3>
          </div>
        </div>

        <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1 rounded-xl self-start sm:self-auto">
          Active in Chat
        </span>
      </div>

      {/* Search and Sort Toolbar */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search public personas, traits..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 text-xs">
          <button
            onClick={() => setSortOrder('popular')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              sortOrder === 'popular'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>Most Liked</span>
          </button>
          <button
            onClick={() => setSortOrder('used')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              sortOrder === 'used'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-purple-400" />
            <span>Most Used</span>
          </button>
          <button
            onClick={() => setSortOrder('latest')}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-semibold transition-all ${
              sortOrder === 'latest'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Newest</span>
          </button>
        </div>
      </div>

      {/* Personas Grid */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        </div>
      ) : personas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <User className="h-10 w-10 text-purple-400 mb-3 opacity-60" />
          <h3 className="font-bold text-zinc-100 text-base mb-1">No Personas Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Be the first to create and share a public roleplay persona with the Palace community!
          </p>
          <button
            onClick={onOpenCreateModal}
            className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white"
          >
            Create Persona
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {personas.map((p) => {
            let tagsList: string[] = [];
            try {
              tagsList = JSON.parse(p.tags || '[]');
            } catch {
              tagsList = [];
            }

            const isCurrent = activePersona.name === p.name;

            return (
              <div
                key={p.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all backdrop-blur-md ${
                  isCurrent
                    ? 'border-amber-500/50 bg-amber-950/15 shadow-lg shadow-amber-950/30'
                    : 'border-zinc-800/80 bg-zinc-900/60 hover:border-purple-500/40 hover:bg-zinc-900/90'
                }`}
              >
                <div>
                  {/* Avatar + Top details */}
                  <div className="flex items-start gap-3.5 mb-3">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="h-13 w-13 rounded-xl object-cover border border-purple-500/40 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-bold text-sm text-zinc-100 truncate">{p.name}</h3>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300">
                          {p.pronouns}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-medium">
                        By <span className="text-zinc-300">{p.creatorName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Bio / Appearance */}
                  <p className="text-xs text-zinc-300 leading-relaxed mb-3 line-clamp-3 bg-zinc-950/50 p-2.5 rounded-xl border border-zinc-800/60 font-serif italic">
                    &quot;{p.bio}&quot;
                  </p>

                  {/* Tags */}
                  {tagsList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tagsList.map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300 border border-zinc-700/50"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Controls: Likes, Uses, Edit/Delete, Adopt */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLike(p.id)}
                      className="flex items-center gap-1 text-zinc-400 hover:text-pink-400 transition-colors"
                      title="Like persona"
                    >
                      <Heart className="h-3.5 w-3.5 fill-pink-500/20 text-pink-400" />
                      <span className="text-[11px] font-semibold">{p.likeCount}</span>
                    </button>
                    <span className="text-[10px] text-zinc-500 font-medium">
                      &bull; {p.useCount} uses
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isOwnedByRequester(p.userId, { userUid: user?.uid, guestId }) && (
                      <>
                        {onEditPersona && (
                          <button
                            type="button"
                            onClick={() => onEditPersona(p)}
                            className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                            title="Edit your persona"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                            confirmDeleteUuid === p.uuid
                              ? 'border-rose-500 bg-rose-600 text-white'
                              : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                          }`}
                          title={confirmDeleteUuid === p.uuid ? 'Click again to delete persona' : 'Delete your persona'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{confirmDeleteUuid === p.uuid ? 'Confirm' : 'Delete'}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleUsePersona(p)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${
                        isCurrent
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : appliedId === p.id
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:from-purple-500 hover:to-fuchsia-500'
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-amber-400" />
                          <span>Active</span>
                        </>
                      ) : appliedId === p.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Applied!</span>
                        </>
                      ) : (
                        <>
                          <User className="h-3.5 w-3.5" />
                          <span>Use Persona</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
