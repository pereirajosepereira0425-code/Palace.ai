import React, { useState } from 'react';
import {
  Heart,
  MessageSquare,
  Sparkles,
  Download,
  BrainCircuit,
  Globe,
  Volume2,
  Share2,
  Edit3,
  Trash2,
} from 'lucide-react';
import { Character } from '../types/index.ts';
import { exportTavernCard } from '../utils/characterUtils.ts';

interface CharacterCardProps {
  character: Character;
  isLiked?: boolean;
  canEdit?: boolean;
  onLikeToggle?: (charId: number) => void;
  onSelectCharacter: (char: Character) => void;
  onQuickView: (char: Character) => void;
  onEditCharacter?: (char: Character) => void;
  onDeleteCharacter?: (char: Character) => void;
}

const CharacterCardInner: React.FC<CharacterCardProps> = ({
  character,
  isLiked = false,
  canEdit = false,
  onLikeToggle,
  onSelectCharacter,
  onQuickView,
  onEditCharacter,
  onDeleteCharacter,
}) => {
  const [likeCount, setLikeCount] = useState(character.likeCount);
  const [liked, setLiked] = useState(isLiked);
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    setLiked(isLiked);
  }, [isLiked]);

  React.useEffect(() => {
    setLikeCount(character.likeCount);
  }, [character.likeCount]);

  // Parse tags once per tags value
  const tagList = React.useMemo<string[]>(() => {
    try {
      const parsed = Array.isArray(character.tags)
        ? character.tags
        : JSON.parse(character.tags || '[]');
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      return character.tags ? [character.tags] : [];
    }
  }, [character.tags]);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLiked(!liked);
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
    if (onLikeToggle) {
      onLikeToggle(character.id);
    }
  };

  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    const tavernData = exportTavernCard(character);
    const blob = new Blob([JSON.stringify(tavernData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_tavern_v2.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      onClick={() => onQuickView(character)}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/50 hover:bg-zinc-900/90 hover:shadow-xl hover:shadow-purple-950/30 cursor-pointer"
    >
      {/* Character Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
        <img
          src={character.avatar}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover blur-xl scale-110 opacity-35 pointer-events-none"
        />
        <img
          src={character.avatar}
          alt={character.name}
          referrerPolicy="no-referrer"
          className="relative z-10 h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            // fallback if avatar link breaks
            (e.target as HTMLImageElement).src =
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';
          }}
        />

        {/* Gradient Scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />

        {/* Top Floating Badges */}
        <div className="absolute left-3 top-3 right-24 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border backdrop-blur-md ${
              character.rating === 'NSFW'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {character.rating}
          </span>

          {character.pronouns && (
            <span className="rounded-md bg-purple-950/70 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-200 backdrop-blur-md">
              {character.pronouns}
            </span>
          )}

          {character.model3dUrl && (
            <span className="rounded-md bg-indigo-500/30 border border-indigo-400/40 px-2 py-0.5 text-[10px] font-bold text-indigo-200 backdrop-blur-md flex items-center gap-1">
              <span>3D</span>
            </span>
          )}

          {character.thinkingDefault && (
            <span
              className="flex items-center gap-1 rounded-md bg-purple-500/30 px-2 py-0.5 text-[10px] font-semibold text-purple-200 border border-purple-400/40 backdrop-blur-md"
              title="Gemini 4 Argon High-Thinking Enabled"
            >
              <BrainCircuit className="h-3 w-3" />
              Thinking
            </span>
          )}

          {character.searchDefault && (
            <span
              className="flex items-center gap-1 rounded-md bg-sky-500/30 px-2 py-0.5 text-[10px] font-semibold text-sky-200 border border-sky-400/40 backdrop-blur-md"
              title="Google Search Grounding Enabled"
            >
              <Globe className="h-3 w-3" />
              Search
            </span>
          )}
        </div>

        {/* Top Right Quick Actions */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {/* Tavern JSON Export Button */}
          <button
            onClick={handleExportJson}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900/80 text-zinc-300 backdrop-blur-md border border-zinc-700/60 hover:bg-purple-600 hover:text-white transition-all shadow-md"
            title="Download Tavern / Chub JSON Card"
            aria-label="Download character JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {/* Like Heart Button */}
          <button
            onClick={handleLike}
            className={`flex h-8 items-center gap-1 rounded-xl px-2.5 backdrop-blur-md border transition-all shadow-md ${
              liked
                ? 'bg-pink-600/30 text-pink-400 border-pink-500/60'
                : 'bg-zinc-900/80 text-zinc-300 border-zinc-700/60 hover:text-pink-400'
            }`}
            aria-label="Like character"
          >
            <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-pink-500 text-pink-500' : ''}`} />
            <span className="text-[11px] font-bold">{likeCount}</span>
          </button>
        </div>

        {/* Bottom stats inside image */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-300">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-900/80 px-2 py-1 backdrop-blur-md border border-zinc-800">
            <MessageSquare className="h-3 w-3 text-fuchsia-400" />
            <span className="font-semibold">{character.chatCount.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-zinc-900/80 px-2 py-1 backdrop-blur-md border border-zinc-800 text-amber-300">
            <Volume2 className="h-3 w-3" />
            <span className="text-[11px] font-medium">{character.voiceName}</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          {/* Character Name & Creator */}
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-bold text-zinc-100 group-hover:text-purple-300 transition-colors line-clamp-1 text-base">
              {character.name}
            </h3>
          </div>
          <p className="text-[11px] text-zinc-400 font-medium mb-1.5">
            By <span className="text-zinc-300 font-semibold">{character.creatorName}</span>
          </p>

          {/* Tagline */}
          <p className="text-xs text-zinc-300 line-clamp-2 leading-relaxed mb-3">
            {character.tagline}
          </p>
        </div>

        {/* Tag pills & Action buttons */}
        <div>
          <div className="flex flex-wrap gap-1 mb-3">
            {tagList.slice(0, 3).map((tag, i) => (
              <span
                key={i}
                className="rounded-md bg-zinc-800/90 px-2 py-0.5 text-[10px] font-medium text-zinc-300 border border-zinc-700/50"
              >
                #{tag}
              </span>
            ))}
            {tagList.length > 3 && (
              <span className="rounded-md bg-zinc-800/60 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                +{tagList.length - 3}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-2 border-t border-zinc-800/80">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickView(character);
              }}
              className="flex-1 rounded-xl border border-zinc-700/80 bg-zinc-800/80 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all text-center"
            >
              Details
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectCharacter(character);
              }}
              className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-2 text-xs font-semibold text-white shadow-md shadow-purple-900/30 hover:from-purple-500 hover:to-fuchsia-500 transition-all text-center"
            >
              Chat
            </button>
            {canEdit && onEditCharacter && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditCharacter(character);
                }}
                aria-label={`Edit ${character.name}`}
                title="Edit your character"
                className="flex items-center justify-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all shrink-0"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
            )}
            {canEdit && onDeleteCharacter && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirmDelete) {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 3500);
                    return;
                  }
                  setConfirmDelete(false);
                  onDeleteCharacter(character);
                }}
                aria-label={`Delete ${character.name}`}
                title={confirmDelete ? 'Click again to permanently delete' : 'Delete your character'}
                className={`flex items-center justify-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-bold transition-all shrink-0 ${
                  confirmDelete
                    ? 'border-rose-500 bg-rose-600 text-white shadow-md'
                    : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmDelete && <span>Confirm</span>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CharacterCard = React.memo(CharacterCardInner);
