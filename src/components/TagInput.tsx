import React, { useState, useEffect, useMemo } from 'react';
import { Tag, Plus, X, Search, Sparkles, Check } from 'lucide-react';
import { TagRecord } from '../types/index.ts';
import { CHUB_ALL_TAGS } from '../utils/characterUtils.ts';
import { normalizeTagName, parseTagListInput } from '../utils/chubOptions.ts';

interface TagInputProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  title?: string;
  subtitle?: string;
  guestId?: string;
  compact?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  selectedTags,
  onChange,
  title = 'Chub.ai Tag Database',
  subtitle = 'Type any custom tag and press Enter (saved to the global tag database) or click existing tags below.',
  guestId,
  compact = false,
}) => {
  const [dbTags, setDbTags] = useState<TagRecord[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [savingTag, setSavingTag] = useState(false);
  const [notice, setNotice] = useState('');

  const loadTags = async () => {
    try {
      const res = await fetch('/api/tags?limit=300');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tags)) {
          setDbTags(data.tags);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch tags from database:', err);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  // Merge DB tags with fallback CHUB_ALL_TAGS so picker is always richly populated
  const mergedTagList = useMemo(() => {
    const map = new Map<string, { name: string; usageCount: number; isCustom: boolean }>();
    for (const t of dbTags) {
      map.set(t.name.toLowerCase(), {
        name: t.name,
        usageCount: t.usageCount,
        isCustom: t.createdBy !== 'system',
      });
    }
    for (const fallback of CHUB_ALL_TAGS) {
      if (!map.has(fallback.toLowerCase())) {
        map.set(fallback.toLowerCase(), {
          name: fallback,
          usageCount: 0,
          isCustom: false,
        });
      }
    }
    return Array.from(map.values());
  }, [dbTags]);

  const filteredSuggestions = useMemo(() => {
    const q = normalizeTagName(inputValue).toLowerCase();
    if (!q) return mergedTagList;
    return mergedTagList.filter((item) => item.name.toLowerCase().includes(q));
  }, [mergedTagList, inputValue]);

  const exactMatchExists = useMemo(() => {
    const q = normalizeTagName(inputValue).toLowerCase();
    if (!q) return true;
    return mergedTagList.some((item) => item.name.toLowerCase() === q);
  }, [mergedTagList, inputValue]);

  const addCustomTags = async (rawInput: string) => {
    const parsed = parseTagListInput(rawInput);
    if (parsed.length === 0) return;

    const existingLower = new Set(selectedTags.map((t) => t.toLowerCase()));
    const nextSelected = [...selectedTags];
    const newlyAdded: string[] = [];

    for (const candidate of parsed) {
      // Match existing canonical capitalization if it exists in DB
      const canonical =
        mergedTagList.find((m) => m.name.toLowerCase() === candidate.toLowerCase())?.name ||
        candidate;

      if (!existingLower.has(canonical.toLowerCase())) {
        existingLower.add(canonical.toLowerCase());
        nextSelected.push(canonical);
        newlyAdded.push(canonical);
      }
    }

    onChange(nextSelected);
    setInputValue('');

    // Persist any newly typed tags straight into the Cloud SQL tags database
    try {
      setSavingTag(true);
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tags: parsed,
          guestId,
          incrementUsage: false,
        }),
      });
      if (res.ok) {
        await loadTags();
        if (newlyAdded.length > 0) {
          setNotice(`Saved "${newlyAdded.join(', ')}" to Chub Tag DB`);
          setTimeout(() => setNotice(''), 2500);
        }
      }
    } catch (err) {
      console.warn('Could not persist custom tag:', err);
    } finally {
      setSavingTag(false);
    }
  };

  const toggleTag = (tagName: string) => {
    const exists = selectedTags.some((t) => t.toLowerCase() === tagName.toLowerCase());
    if (exists) {
      onChange(selectedTags.filter((t) => t.toLowerCase() !== tagName.toLowerCase()));
    } else {
      onChange([...selectedTags, tagName]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addCustomTags(inputValue);
      }
    }
  };

  return (
    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5 sm:p-6 backdrop-blur-md space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-400">
            <Tag className="h-3.5 w-3.5" />
            <span>
              {title} ({selectedTags.length} selected &bull; {mergedTagList.length} in DB)
            </span>
          </label>
          <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
        </div>

        {notice && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <Check className="h-3 w-3" />
            {notice}
          </span>
        )}
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-purple-500/20 bg-zinc-950/70 p-2.5">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/50 bg-purple-600/25 px-2.5 py-1 text-xs font-bold text-purple-100 shadow-sm"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => toggleTag(tag)}
                className="rounded-md p-0.5 text-purple-300 hover:bg-purple-500/30 hover:text-white transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Type Any Custom Tag Input + Add Button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type ANY custom tag (e.g. Dandy's World, Slow Burn, Space Pirate) & press Enter..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={!normalizeTagName(inputValue) || savingTag}
          onClick={() => addCustomTags(inputValue)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-500 disabled:opacity-40 transition-all cursor-pointer shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{savingTag ? 'Saving...' : 'Add & Save Tag'}</span>
        </button>
      </div>

      {/* Create New Tag Highlight Pill if typed tag isn't in DB yet */}
      {normalizeTagName(inputValue) && !exactMatchExists && (
        <button
          type="button"
          onClick={() => addCustomTags(inputValue)}
          className="flex items-center gap-2 w-full rounded-xl border border-dashed border-amber-400/60 bg-amber-500/10 px-3.5 py-2 text-left text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-all cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-300 shrink-0" />
          <span>
            Create &amp; save new tag to database:{' '}
            <strong className="text-white">#{normalizeTagName(inputValue)}</strong>
          </span>
        </button>
      )}

      {/* Existing Database Tags Cloud */}
      <div className={`flex flex-wrap gap-1.5 overflow-y-auto p-1 ${compact ? 'max-h-36' : 'max-h-48'}`}>
        {filteredSuggestions.map((item) => {
          const isSelected = selectedTags.some(
            (t) => t.toLowerCase() === item.name.toLowerCase()
          );
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => toggleTag(item.name)}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                isSelected
                  ? 'border-purple-500 bg-purple-500/20 text-purple-200 shadow-sm'
                  : item.isCustom
                  ? 'border-amber-500/30 bg-amber-950/20 text-amber-200 hover:border-amber-400/60'
                  : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <span>#{item.name}</span>
              {item.usageCount > 0 && (
                <span className="text-[10px] opacity-60 font-mono">{item.usageCount}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
