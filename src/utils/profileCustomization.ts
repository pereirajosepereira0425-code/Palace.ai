export interface ProfileVisualCustomization {
  profileBackgroundUrl?: string;
  backgroundBlur?: number;
  backgroundDim?: number;
  avatarFrame?: 'default' | 'neon_ring' | 'royal_gold' | 'sakura_glow' | 'cyber_hex' | 'chromatic_pulse';
  cardEffect?: 'glass' | 'neon_border' | 'obsidian_solid' | 'aurora_glow';
  fontStyle?: 'sans' | 'serif' | 'mono';
  accentColor?: string;
  favoriteTags?: string[];
  featuredQuoteStyle?: 'classic' | 'neon' | 'scroll';
}

export interface ProfileThemeTokens {
  id: string;
  name: string;
  previewGradient: string;
  accentBorder: string;
  avatarBorder: string;
  cardBg: string;
  pillBg: string;
  pillText: string;
  activeTab: string;
  primaryButton: string;
  quoteBanner: string;
  statAccent: string;
  glowShadow: string;
}

export const PROFILE_THEMES: Record<string, ProfileThemeTokens> = {
  purple: {
    id: 'purple',
    name: '🔮 Twilight Palace',
    previewGradient: 'from-purple-900 to-indigo-950',
    accentBorder: 'border-purple-500/45',
    avatarBorder: 'border-purple-500',
    cardBg: 'bg-zinc-950/90',
    pillBg: 'bg-purple-500/20 border-purple-500/40',
    pillText: 'text-purple-200',
    activeTab: 'bg-purple-600 text-white shadow-md shadow-purple-900/40',
    primaryButton: 'bg-purple-600 hover:bg-purple-500 shadow-purple-900/40',
    quoteBanner: 'border-amber-500/35 bg-amber-950/25 text-amber-200',
    statAccent: 'text-purple-300',
    glowShadow: 'shadow-purple-950/50',
  },
  neon_cyberpunk: {
    id: 'neon_cyberpunk',
    name: '⚡ Cyberpunk Neon',
    previewGradient: 'from-cyan-950 to-pink-950',
    accentBorder: 'border-cyan-400/55',
    avatarBorder: 'border-cyan-400',
    cardBg: 'bg-slate-950/90',
    pillBg: 'bg-cyan-500/20 border-cyan-400/40',
    pillText: 'text-cyan-200',
    activeTab: 'bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-white shadow-md shadow-cyan-900/40',
    primaryButton: 'bg-gradient-to-r from-cyan-500 to-pink-600 hover:from-cyan-400 hover:to-pink-500 shadow-cyan-900/40',
    quoteBanner: 'border-pink-500/40 bg-pink-950/25 text-pink-200',
    statAccent: 'text-cyan-300',
    glowShadow: 'shadow-cyan-950/60',
  },
  dark_obsidian: {
    id: 'dark_obsidian',
    name: '🖤 Obsidian Void',
    previewGradient: 'from-zinc-950 to-red-950',
    accentBorder: 'border-red-500/45',
    avatarBorder: 'border-red-500',
    cardBg: 'bg-black/92',
    pillBg: 'bg-red-500/20 border-red-500/40',
    pillText: 'text-red-200',
    activeTab: 'bg-red-600 text-white shadow-md shadow-red-950/50',
    primaryButton: 'bg-red-600 hover:bg-red-500 shadow-red-950/50',
    quoteBanner: 'border-red-500/35 bg-red-950/25 text-red-200',
    statAccent: 'text-red-400',
    glowShadow: 'shadow-red-950/50',
  },
  royal_gold: {
    id: 'royal_gold',
    name: '👑 Royal Sovereign',
    previewGradient: 'from-amber-950 to-zinc-950',
    accentBorder: 'border-amber-400/50',
    avatarBorder: 'border-amber-400',
    cardBg: 'bg-stone-950/90',
    pillBg: 'bg-amber-500/20 border-amber-400/40',
    pillText: 'text-amber-200',
    activeTab: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-zinc-950 font-black shadow-md shadow-amber-900/40',
    primaryButton: 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-900/40',
    quoteBanner: 'border-amber-400/45 bg-amber-950/30 text-amber-100',
    statAccent: 'text-amber-300',
    glowShadow: 'shadow-amber-950/50',
  },
  rose_blossom: {
    id: 'rose_blossom',
    name: '🌸 Sakura Blossom',
    previewGradient: 'from-pink-950 to-rose-950',
    accentBorder: 'border-pink-400/50',
    avatarBorder: 'border-pink-400',
    cardBg: 'bg-zinc-950/90',
    pillBg: 'bg-pink-500/20 border-pink-400/40',
    pillText: 'text-pink-200',
    activeTab: 'bg-pink-600 text-white shadow-md shadow-pink-900/40',
    primaryButton: 'bg-pink-600 hover:bg-pink-500 shadow-pink-900/40',
    quoteBanner: 'border-pink-400/40 bg-pink-950/25 text-pink-100',
    statAccent: 'text-pink-300',
    glowShadow: 'shadow-pink-950/50',
  },
  emerald: {
    id: 'emerald',
    name: '🌲 Emerald Enchanter',
    previewGradient: 'from-emerald-950 to-teal-950',
    accentBorder: 'border-emerald-400/50',
    avatarBorder: 'border-emerald-400',
    cardBg: 'bg-zinc-950/90',
    pillBg: 'bg-emerald-500/20 border-emerald-400/40',
    pillText: 'text-emerald-200',
    activeTab: 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40',
    primaryButton: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40',
    quoteBanner: 'border-emerald-400/40 bg-emerald-950/25 text-emerald-100',
    statAccent: 'text-emerald-300',
    glowShadow: 'shadow-emerald-950/50',
  },
  midnight_aurora: {
    id: 'midnight_aurora',
    name: '🌌 Midnight Aurora',
    previewGradient: 'from-indigo-950 via-teal-950 to-violet-950',
    accentBorder: 'border-teal-400/50',
    avatarBorder: 'border-teal-400',
    cardBg: 'bg-slate-950/90',
    pillBg: 'bg-teal-500/20 border-teal-400/40',
    pillText: 'text-teal-200',
    activeTab: 'bg-gradient-to-r from-teal-500 to-indigo-600 text-white shadow-md shadow-teal-900/40',
    primaryButton: 'bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 shadow-teal-900/40',
    quoteBanner: 'border-teal-400/40 bg-teal-950/25 text-teal-100',
    statAccent: 'text-teal-300',
    glowShadow: 'shadow-teal-950/50',
  },
  vaporwave: {
    id: 'vaporwave',
    name: '🌆 Synthwave Sunset',
    previewGradient: 'from-fuchsia-950 via-purple-950 to-orange-950',
    accentBorder: 'border-fuchsia-400/55',
    avatarBorder: 'border-fuchsia-400',
    cardBg: 'bg-zinc-950/90',
    pillBg: 'bg-fuchsia-500/20 border-fuchsia-400/40',
    pillText: 'text-fuchsia-200',
    activeTab: 'bg-gradient-to-r from-fuchsia-600 to-amber-500 text-white shadow-md shadow-fuchsia-900/40',
    primaryButton: 'bg-gradient-to-r from-fuchsia-600 to-amber-500 hover:from-fuchsia-500 hover:to-amber-400 shadow-fuchsia-900/40',
    quoteBanner: 'border-amber-400/40 bg-fuchsia-950/30 text-amber-100',
    statAccent: 'text-fuchsia-300',
    glowShadow: 'shadow-fuchsia-950/50',
  },
};

export const PROFILE_BACKGROUND_PRESETS = [
  {
    id: 'none',
    name: 'None (Solid Dark)',
    url: '',
  },
  {
    id: 'nebula',
    name: 'Cosmic Nebula',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=1800&q=80',
  },
  {
    id: 'cyber_city',
    name: 'Neon Rain City',
    url: 'https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1800&q=80',
  },
  {
    id: 'cherry_night',
    name: 'Midnight Sakura',
    url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?auto=format&fit=crop&w=1800&q=80',
  },
  {
    id: 'obsidian_peaks',
    name: 'Obsidian Peaks',
    url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1800&q=80',
  },
  {
    id: 'aurora_sky',
    name: 'Aurora Borealis',
    url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1800&q=80',
  },
];

export function getProfileTheme(themeId?: string | null): ProfileThemeTokens {
  if (themeId && PROFILE_THEMES[themeId]) return PROFILE_THEMES[themeId];
  if (themeId === 'cyan') return PROFILE_THEMES.neon_cyberpunk;
  return PROFILE_THEMES.purple;
}

/**
 * Extracts social links and nested visual customization cleanly from the stored JSON column.
 */
export function parseSocialAndCustomization(rawSocialLinks: unknown): {
  socials: {
    discord?: string;
    twitter?: string;
    github?: string;
    website?: string;
    patreon?: string;
  };
  customization: ProfileVisualCustomization;
} {
  let obj: Record<string, any> = {};
  if (typeof rawSocialLinks === 'string') {
    try {
      obj = JSON.parse(rawSocialLinks) || {};
    } catch {
      obj = {};
    }
  } else if (rawSocialLinks && typeof rawSocialLinks === 'object') {
    obj = rawSocialLinks as Record<string, any>;
  }

  const cust = (obj.__customization && typeof obj.__customization === 'object'
    ? obj.__customization
    : {}) as ProfileVisualCustomization;

  return {
    socials: {
      discord: obj.discord || '',
      twitter: obj.twitter || '',
      github: obj.github || '',
      website: obj.website || '',
      patreon: obj.patreon || '',
    },
    customization: {
      profileBackgroundUrl: cust.profileBackgroundUrl || '',
      backgroundBlur: typeof cust.backgroundBlur === 'number' ? cust.backgroundBlur : 4,
      backgroundDim: typeof cust.backgroundDim === 'number' ? cust.backgroundDim : 0.65,
      avatarFrame: cust.avatarFrame || 'default',
      cardEffect: cust.cardEffect || 'glass',
      fontStyle: cust.fontStyle || 'sans',
      accentColor: cust.accentColor || '',
      favoriteTags: Array.isArray(cust.favoriteTags) ? cust.favoriteTags : [],
      featuredQuoteStyle: cust.featuredQuoteStyle || 'classic',
    },
  };
}

export function serializeSocialAndCustomization(
  socials: Record<string, string | undefined>,
  customization: ProfileVisualCustomization
): Record<string, any> {
  return {
    discord: (socials.discord || '').trim(),
    twitter: (socials.twitter || '').trim(),
    github: (socials.github || '').trim(),
    website: (socials.website || '').trim(),
    patreon: (socials.patreon || '').trim(),
    __customization: customization,
  };
}

/**
 * Sanitizes user Custom CSS for safe injection inside scoped profile container.
 */
export function sanitizeCustomCss(rawCss?: string | null): string {
  if (!rawCss) return '';
  return rawCss
    .replace(/<\/style/gi, '')
    .replace(/@import/gi, '/* @import blocked */')
    .replace(/expression\s*\(/gi, '/* blocked */')
    .replace(/javascript:/gi, '')
    .slice(0, 6000);
}
