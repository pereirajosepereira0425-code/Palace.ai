import React, { useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Wand2,
  Download,
  Copy,
  Check,
  Palette,
  ExternalLink,
} from 'lucide-react';

interface ImagineStudioProps {
  onUseAsAvatar?: (imageUrl: string) => void;
}

const STYLE_PRESETS = [
  { name: 'Anime Masterpiece', promptAdd: 'vibrant anime style, detailed eyes, studio quality, digital illustration, sharp focus' },
  { name: 'Cyberpunk Neon', promptAdd: 'neon lighting, rain reflections, cybernetic implants, chromatic aberration, futuristic high-tech' },
  { name: 'Dark Fantasy', promptAdd: 'gothic fantasy oil painting, dark brooding atmosphere, candlelit, dramatic shadows, regal attire' },
  { name: 'Retro 90s Manga', promptAdd: 'cel-shaded classic anime, screentone shading, nostalgic 90s aesthetic, bold outlines' },
  { name: 'Photorealistic Cinematic', promptAdd: 'cinematic lighting, 85mm lens, photorealistic portrait, depth of field, 4k render' },
  { name: 'Ethereal Watercolor', promptAdd: 'soft watercolor brushstrokes, pastel tones, flowing light particles, dreamy aesthetic' },
];

const CURATED_GENERATIONS = [
  {
    title: 'Neon Ronin',
    style: 'Cyberpunk',
    url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80',
    prompt: 'Female cyborg bounty hunter with glowing pink visor standing in rain-slicked Tokyo street',
  },
  {
    title: 'Silver Sorceress',
    style: 'Dark Fantasy',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    prompt: 'Ancient silver-haired high elf holding glowing celestial crystal in dark cathedral',
  },
  {
    title: 'Vampire Monarch',
    style: 'Gothic',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    prompt: 'Aristocratic vampire lord in black velvet coat drinking wine before gothic stained glass',
  },
  {
    title: 'Academy Prodigy',
    style: 'Anime',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    prompt: 'Student council president in stylish academy uniform on cherry blossom rooftop',
  },
  {
    title: 'Magma Smith',
    style: 'RPG Fantasy',
    url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    prompt: 'Dwarven blacksmith striking incandescent broadsword on subterranean magma anvil',
  },
  {
    title: 'Astral Priestess',
    style: 'Ethereal',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    prompt: 'High oracle draped in starry nebula robes consulting golden astronomical orrery',
  },
];

export const ImagineStudio: React.FC<ImagineStudioProps> = ({ onUseAsAvatar }) => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLE_PRESETS[0]);
  const [aspectRatio, setAspectRatio] = useState<'3:4' | '1:1' | '16:9'>('3:4');
  const [gallery, setGallery] = useState(CURATED_GENERATIONS);
  const [generating, setGenerating] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setTimeout(() => {
      // Pick dynamic aesthetic match from curated library
      const randomSeed = Math.floor(Math.random() * 1000);
      const newImg = {
        title: prompt.slice(0, 24),
        style: selectedStyle.name,
        url: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80&sig=${randomSeed}`,
        prompt: `${prompt}, ${selectedStyle.promptAdd}`,
      };

      setGallery([newImg, ...gallery]);
      setGenerating(false);
    }, 1500);
  };

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 border-b border-purple-900/40 pb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 flex items-center gap-2">
          <span>Imagine Studio</span>
          <span className="rounded-lg bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300 border border-purple-500/30 font-semibold">
            Chub &bull; Imagine
          </span>
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Generate custom character avatars, portraits, and scenic backgrounds for your roleplay bots.
        </p>
      </div>

      {/* Generator Prompt Box */}
      <div className="mb-10 rounded-3xl border border-purple-900/50 bg-gradient-to-br from-purple-950/30 via-zinc-900/70 to-zinc-950 p-6 backdrop-blur-xl shadow-xl space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1.5 flex items-center gap-1.5">
            <Wand2 className="h-4 w-4" />
            <span>Character Appearance Prompt</span>
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe character features, clothing, expression, lighting (e.g. A cybernetic detective with amber eyes, scarred cheek, smoking clove cigarette under neon acid rain)..."
            className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        {/* Style Presets */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            <span>Aesthetic Style Preset</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {STYLE_PRESETS.map((style) => (
              <button
                key={style.name}
                type="button"
                onClick={() => setSelectedStyle(style)}
                className={`rounded-xl border p-2 text-left text-xs font-semibold transition-all ${
                  selectedStyle.name === style.name
                    ? 'border-purple-400 bg-purple-500/25 text-purple-200 shadow-md'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {style.name}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Button Row */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            {(['3:4', '1:1', '16:9'] as const).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => setAspectRatio(ratio)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                  aspectRatio === ratio
                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-950/50 hover:from-purple-500 hover:to-amber-400 disabled:opacity-40 transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span>{generating ? 'Generating...' : 'Imagine Portrait'}</span>
          </button>
        </div>
      </div>

      {/* Generated Gallery */}
      <div>
        <h2 className="text-base font-bold text-zinc-100 mb-4 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-purple-400" />
          <span>Imagine Gallery & Ready Avatars</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-6">
          {gallery.map((item, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md transition-all hover:border-purple-500/50 hover:shadow-xl"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
                <img
                  src={item.url}
                  alt={item.title}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-2.5 left-2.5 rounded-md bg-zinc-900/80 px-2 py-0.5 text-[10px] font-bold text-purple-300 border border-zinc-700/80 backdrop-blur-md">
                  {item.style}
                </span>

                {/* Hover overlay with action buttons */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end gap-2">
                  <p className="text-xs text-zinc-200 line-clamp-2 italic font-serif">
                    &quot;{item.prompt}&quot;
                  </p>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleCopy(item.url)}
                      className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-zinc-800/90 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition-all"
                    >
                      {copiedUrl === item.url ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedUrl === item.url ? 'Copied' : 'Copy URL'}</span>
                    </button>

                    {onUseAsAvatar && (
                      <button
                        onClick={() => onUseAsAvatar(item.url)}
                        className="flex-1 flex items-center justify-center gap-1 rounded-xl bg-purple-600 py-1.5 text-xs font-bold text-white hover:bg-purple-500 transition-all"
                      >
                        <span>Use Avatar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3">
                <h4 className="font-bold text-xs text-zinc-100">{item.title}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
