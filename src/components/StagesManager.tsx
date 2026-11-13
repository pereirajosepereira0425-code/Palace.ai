import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  Image as ImageIcon,
  Compass,
  Palette,
  Eye,
  Sliders,
} from 'lucide-react';

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

interface StagesManagerProps {
  activeStageId: string;
  onSelectStage: (stage: Stage) => void;
}

export const StagesManager: React.FC<StagesManagerProps> = ({
  activeStageId,
  onSelectStage,
}) => {
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

  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [previewStage, setPreviewStage] = useState<Stage | null>(null);

  // New stage form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Fantasy');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newBlur, setNewBlur] = useState(2);
  const [newOpacity, setNewOpacity] = useState(0.65);

  const categories = ['All', ...Array.from(new Set(stages.map((s) => s.category)))];

  const handleCreateStage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newImageUrl.trim()) return;

    const newStage: Stage = {
      id: 'custom-' + Date.now(),
      name: newName.trim(),
      category: newCategory.trim() || 'Custom',
      imageUrl: newImageUrl.trim(),
      description: newDescription.trim() || 'A custom atmosphere for roleplay.',
      blurLevel: newBlur,
      overlayOpacity: newOpacity,
    };

    const updated = [newStage, ...stages];
    setStages(updated);

    // Save custom ones to localStorage
    const customOnly = updated.filter((s) => s.id.startsWith('custom-'));
    try {
      localStorage.setItem('palace_custom_stages', JSON.stringify(customOnly));
    } catch (err) {
      console.error(err);
    }

    onSelectStage(newStage);
    setIsAddingNew(false);
    setNewName('');
    setNewImageUrl('');
    setNewDescription('');
  };

  const handleDeleteStage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = stages.filter((s) => s.id !== id);
    setStages(updated);
    const customOnly = updated.filter((s) => s.id.startsWith('custom-'));
    localStorage.setItem('palace_custom_stages', JSON.stringify(customOnly));
  };

  const filteredStages =
    selectedCategory === 'All'
      ? stages
      : stages.filter((s) => s.category === selectedCategory);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header Banner */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-purple-900/40 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
            <span>Stages &amp; Chat Atmospheres</span>
            <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
              /my_stages
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Transform your roleplay chambers with dynamic visual stages, blur effects, and immersive backdrops.
          </p>
        </div>

        <button
          onClick={() => setIsAddingNew(!isAddingNew)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/30 hover:from-purple-500 hover:to-amber-400 transition-all self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>{isAddingNew ? 'Close Form' : 'Create Custom Stage'}</span>
        </button>
      </div>

      {/* New Stage Creator Drawer */}
      {isAddingNew && (
        <form
          onSubmit={handleCreateStage}
          className="mb-8 rounded-3xl border border-purple-500/30 bg-zinc-900/70 p-6 backdrop-blur-xl space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <Palette className="h-4 w-4" />
            <span>Design New Stage</span>
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white hover:bg-purple-500"
            >
              <Check className="h-4 w-4" />
              <span>Save &amp; Activate Stage</span>
            </button>
          </div>
        </form>
      )}

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
        {filteredStages.map((stage) => {
          const isActive = activeStageId === stage.id;
          return (
            <div
              key={stage.id}
              onClick={() => onSelectStage(stage)}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border transition-all cursor-pointer shadow-lg ${
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
                  <button
                    onClick={(e) => handleDeleteStage(stage.id, e)}
                    className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                    title="Delete custom stage"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
