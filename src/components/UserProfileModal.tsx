import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Upload,
  Sparkles,
  Check,
  Save,
  AtSign,
  Palette,
  Image as ImageIcon,
  AlertTriangle,
  FileCode,
  Pin,
  Layers,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Character } from '../types/index.ts';
import {
  PROFILE_THEMES,
  PROFILE_BACKGROUND_PRESETS,
  ProfileVisualCustomization,
  parseSocialAndCustomization,
  serializeSocialAndCustomization,
} from '../utils/profileCustomization.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_BADGES = [
  'Chub Creator',
  'Lorekeeper',
  'Tavern Master',
  'Palace Explorer',
  'Verified Bot Author',
  'RP Veteran',
  'Early Adopter',
  'Story Architect',
  '3D Sculptor',
  'Code Wizard',
];

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
];

const BANNER_PRESETS = [
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1600&q=80',
];

const CSS_SNIPPETS = [
  {
    label: '✨ Neon Text Glow',
    css: '.palace-profile-display-name { text-shadow: 0 0 18px rgba(217, 70, 239, 0.75); }',
  },
  {
    label: '👑 Royal Gold Title',
    css: '.palace-profile-display-name { background: linear-gradient(90deg, #fde68a, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }',
  },
  {
    label: '📺 Cyber Scanlines',
    css: '.palace-profile-header-card::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px); }',
  },
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, user } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_PRESETS[0]);
  const [bannerUrl, setBannerUrl] = useState(profile?.bannerUrl || BANNER_PRESETS[0]);
  const [profileBgUrl, setProfileBgUrl] = useState(PROFILE_BACKGROUND_PRESETS[1].url);
  const [bgBlur, setBgBlur] = useState<number>(4);
  const [bgDim, setBgDim] = useState<number>(0.65);
  const [avatarFrame, setAvatarFrame] =
    useState<ProfileVisualCustomization['avatarFrame']>('neon_ring');
  const [cardEffect, setCardEffect] =
    useState<ProfileVisualCustomization['cardEffect']>('glass');
  const [fontStyle, setFontStyle] =
    useState<ProfileVisualCustomization['fontStyle']>('sans');
  const [favoriteTagsText, setFavoriteTagsText] = useState('');
  const [pinnedCharacterUuid, setPinnedCharacterUuid] = useState('');
  const [customCss, setCustomCss] = useState('');

  const [bio, setBio] = useState(profile?.bio || '');
  const [pronouns, setPronouns] = useState(profile?.pronouns || 'They/Them');
  const [customPronouns, setCustomPronouns] = useState('');
  const [gender, setGender] = useState(profile?.gender || 'Non-Binary');
  const [customGender, setCustomGender] = useState('');
  const [theme, setTheme] = useState(profile?.theme || 'purple');
  const [statusMessage, setStatusMessage] = useState(profile?.statusMessage || '');
  const [featuredQuote, setFeaturedQuote] = useState(profile?.featuredQuote || '');
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);
  const [discord, setDiscord] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [website, setWebsite] = useState('');
  const [patreon, setPatreon] = useState('');

  const [availableCharacters, setAvailableCharacters] = useState<Character[]>([]);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/characters?sort=popular')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.characters) setAvailableCharacters(data.characters);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.displayName || '');
      setAvatarUrl(profile.avatarUrl || AVATAR_PRESETS[0]);
      setBannerUrl(profile.bannerUrl || BANNER_PRESETS[0]);
      setBio(profile.bio || '');
      setPronouns(profile.pronouns || 'They/Them');
      setGender(profile.gender || 'Non-Binary');
      setTheme(profile.theme || 'purple');
      setStatusMessage(profile.statusMessage || '');
      setFeaturedQuote(profile.featuredQuote || '');
      setPinnedCharacterUuid(profile.pinnedCharacterUuid || '');
      setCustomCss(profile.customCss || '');

      try {
        const b = typeof profile.badges === 'string' ? JSON.parse(profile.badges) : profile.badges || [];
        setSelectedBadges(b);
      } catch {
        setSelectedBadges(['Chub Creator', 'Palace Explorer']);
      }

      const parsed = parseSocialAndCustomization(profile.socialLinks);
      setDiscord(parsed.socials.discord || '');
      setTwitter(parsed.socials.twitter || '');
      setGithub(parsed.socials.github || '');
      setWebsite(parsed.socials.website || '');
      setPatreon(parsed.socials.patreon || '');

      setProfileBgUrl(parsed.customization.profileBackgroundUrl ?? PROFILE_BACKGROUND_PRESETS[1].url);
      setBgBlur(parsed.customization.backgroundBlur ?? 4);
      setBgDim(parsed.customization.backgroundDim ?? 0.65);
      setAvatarFrame(parsed.customization.avatarFrame || 'neon_ring');
      setCardEffect(parsed.customization.cardEffect || 'glass');
      setFontStyle(parsed.customization.fontStyle || 'sans');
      setFavoriteTagsText((parsed.customization.favoriteTags || []).join(', '));
    }
  }, [profile, isOpen]);

  // Handle availability debounced check
  useEffect(() => {
    if (!username || username === profile?.username || !user) {
      setHandleAvailable(true);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setCheckingHandle(true);
        const res = await fetch(`/api/user/check-username?username=${encodeURIComponent(username)}`);
        if (res.ok) {
          const data = await res.json();
          setHandleAvailable(data.available);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingHandle(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [username, profile?.username, user]);

  if (!isOpen) return null;

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'avatar' | 'banner' | 'background'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (target === 'avatar') setAvatarUrl(result);
      else if (target === 'banner') setBannerUrl(result);
      else setProfileBgUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const toggleBadge = (b: string) => {
    if (selectedBadges.includes(b)) {
      setSelectedBadges(selectedBadges.filter((item) => item !== b));
    } else {
      setSelectedBadges([...selectedBadges, b]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (user && handleAvailable === false) {
      setErrorMsg(`@${username} is already taken. Please choose another username handle.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const effectivePronouns = pronouns === 'Custom' ? customPronouns || 'They/Them' : pronouns;
      const effectiveGender = gender === 'Custom' ? customGender || 'Non-Binary' : gender;

      const parsedTags = favoriteTagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);

      const packedSocials = serializeSocialAndCustomization(
        {
          discord,
          twitter,
          github,
          website,
          patreon,
        },
        {
          profileBackgroundUrl: profileBgUrl.trim(),
          backgroundBlur: bgBlur,
          backgroundDim: bgDim,
          avatarFrame,
          cardEffect,
          fontStyle,
          favoriteTags: parsedTags,
        }
      );

      await updateProfile({
        username: username.trim() || 'guest_wanderer',
        displayName: displayName.trim() || 'Guest Wanderer',
        avatarUrl: avatarUrl.trim() || AVATAR_PRESETS[0],
        bannerUrl: bannerUrl.trim() || BANNER_PRESETS[0],
        bio: bio.trim(),
        pronouns: effectivePronouns,
        gender: effectiveGender,
        theme,
        customCss: customCss.trim(),
        pinnedCharacterUuid: pinnedCharacterUuid || null,
        statusMessage: statusMessage.trim(),
        featuredQuote: featuredQuote.trim(),
        badges: selectedBadges,
        socialLinks: packedSocials as any,
      });

      setSuccessMsg('✨ Profile & background saved successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 650);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const previewTheme = PROFILE_THEMES[theme] || PROFILE_THEMES.purple;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex flex-col h-[92vh] w-full max-w-4xl rounded-3xl border border-purple-500/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-purple-900/40 px-6 py-4 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 border border-purple-500/30">
              <Palette className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>🎨 Customize Profile, Background &amp; Style</span>
                <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-mono">
                  @{username || 'handle'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Customize your avatar, banner, full-page wallpaper, theme, frame, pinned bot &amp; custom CSS.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close Profile Customizer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-2xl border border-rose-500/50 bg-rose-950/30 p-3.5 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/30 p-3.5 text-xs text-emerald-300 flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Live Preview Shell with Full-Page Background + Banner + Avatar */}
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800 p-4 sm:p-5 bg-zinc-950">
            {profileBgUrl && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <img
                  src={profileBgUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ filter: `blur(${bgBlur}px)` }}
                />
                <div className="absolute inset-0 bg-zinc-950" style={{ opacity: bgDim }} />
              </div>
            )}

            <div className={`relative z-10 rounded-2xl overflow-hidden border ${previewTheme.accentBorder} ${previewTheme.cardBg} shadow-xl`}>
              {/* Banner Background */}
              <div className="relative h-40 w-full bg-zinc-950 overflow-hidden">
                <img
                  src={bannerUrl}
                  alt="Banner"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />

                <label className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl bg-black/75 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90 cursor-pointer backdrop-blur-md shadow-lg transition-all">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Banner</span>
                  <input
                    type="file"
                    accept="*/*"
                    onChange={(e) => handleFileUpload(e, 'banner')}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Avatar & Identity Preview */}
              <div className="relative -mt-14 px-5 pb-5 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                  <div
                    className={`relative h-24 w-24 rounded-2xl overflow-hidden border-4 shadow-2xl bg-zinc-900 shrink-0 group ${
                      avatarFrame === 'royal_gold'
                        ? 'border-amber-400 ring-2 ring-amber-300/60'
                        : avatarFrame === 'sakura_glow'
                          ? 'border-pink-400 ring-2 ring-pink-400/60'
                          : avatarFrame === 'cyber_hex'
                            ? 'border-cyan-400 ring-2 ring-fuchsia-500/60'
                            : avatarFrame === 'chromatic_pulse'
                              ? 'border-fuchsia-400 ring-4 ring-purple-500/40'
                              : previewTheme.avatarBorder
                    }`}
                  >
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="h-full w-full object-cover object-top"
                    />
                    <label className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-bold text-white transition-opacity cursor-pointer">
                      <Upload className="h-4 w-4 mb-1" />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="*/*"
                        onChange={(e) => handleFileUpload(e, 'avatar')}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div
                    className={`text-center sm:text-left space-y-1 ${
                      fontStyle === 'serif' ? 'font-serif' : fontStyle === 'mono' ? 'font-mono' : 'font-sans'
                    }`}
                  >
                    <h3 className="text-xl font-black text-white">{displayName || 'Display Name'}</h3>
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-purple-300">
                      <span>@{username || 'handle'}</span>
                      <span>&bull;</span>
                      <span className="text-zinc-300">{pronouns}</span>
                      <span>&bull;</span>
                      <span className="text-amber-300">{gender}</span>
                    </div>
                    {statusMessage && (
                      <div className="text-xs text-zinc-300 italic pt-0.5">
                        &quot;{statusMessage}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Image URLs & Presets: Avatar, Banner, and Full-Page Profile Background Wallpaper */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4" />
              <span>Profile Images: Avatar, Header Banner &amp; Full-Page Background</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Avatar URL + Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">Profile Avatar URL</label>
                <input
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... or upload via avatar above"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {AVATAR_PRESETS.map((p, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAvatarUrl(p)}
                      className={`h-10 w-10 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        avatarUrl === p ? 'border-purple-400 scale-105' : 'border-zinc-800 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={p} alt="Preset Avatar" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Header Banner URL + Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-zinc-300">Header Banner URL</label>
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder="https://... or upload banner"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                />
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {BANNER_PRESETS.map((b, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBannerUrl(b)}
                      className={`h-10 w-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                        bannerUrl === b ? 'border-purple-400 scale-105' : 'border-zinc-800 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <img src={b} alt="Preset Banner" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Full-Page Profile Background Wallpaper */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-purple-300">
                  🖼️ Full-Page Profile Background Wallpaper
                </label>
                <label className="flex items-center gap-1.5 rounded-xl border border-purple-500/40 bg-purple-600/20 px-3 py-1 text-[11px] font-bold text-purple-200 hover:bg-purple-600/40 cursor-pointer">
                  <Upload className="h-3.5 w-3.5" />
                  <span>Upload Background File</span>
                  <input
                    type="file"
                    accept="*/*"
                    onChange={(e) => handleFileUpload(e, 'background')}
                    className="hidden"
                  />
                </label>
              </div>

              <input
                type="text"
                value={profileBgUrl}
                onChange={(e) => setProfileBgUrl(e.target.value)}
                placeholder="Paste any background image/GIF URL or pick a preset below..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
              />

              <div className="flex flex-wrap gap-2">
                {PROFILE_BACKGROUND_PRESETS.map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setProfileBgUrl(bg.url)}
                    className={`rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-all cursor-pointer ${
                      profileBgUrl === bg.url
                        ? 'border-purple-400 bg-purple-600/30 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {bg.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                    <span>Background Blur</span>
                    <span className="font-mono text-purple-400">{bgBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={bgBlur}
                    onChange={(e) => setBgBlur(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                    <span>Darkness Overlay</span>
                    <span className="font-mono text-purple-400">{Math.round(bgDim * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="0.95"
                    step="0.05"
                    value={bgDim}
                    onChange={(e) => setBgDim(parseFloat(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Core Credentials: Username (@) & Display Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Unique @Handle * (Must be distinct from all other users)
              </label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="biguswigus, author_name..."
                  className={`w-full rounded-xl border bg-zinc-900 py-2.5 pl-9 pr-8 text-xs font-bold text-white focus:outline-none transition-all ${
                    handleAvailable === true
                      ? 'border-emerald-500/70 focus:border-emerald-400'
                      : handleAvailable === false
                        ? 'border-rose-500 focus:border-rose-400'
                        : 'border-zinc-800 focus:border-purple-500'
                  }`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {checkingHandle ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                  ) : handleAvailable === true ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : handleAvailable === false ? (
                    <X className="h-4 w-4 text-rose-500" />
                  ) : null}
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1">
                Public profile link: https://palace.ai/users/{username || 'your_name'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Bigus Wigus, Queen Sylvia"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Gender & Pronouns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Pronouns
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
                {['They/Them', 'He/Him', 'She/Her', 'It/Its', 'Any', 'Custom'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPronouns(p)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition-all border ${
                      pronouns === p
                        ? 'border-purple-500 bg-purple-600/30 text-purple-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {pronouns === 'Custom' && (
                <input
                  type="text"
                  value={customPronouns}
                  onChange={(e) => setCustomPronouns(e.target.value)}
                  placeholder="Enter custom pronouns..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Gender Identity
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                {['Non-Binary', 'Female', 'Male', 'Agender', 'Custom'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition-all border ${
                      gender === g
                        ? 'border-purple-500 bg-purple-600/30 text-purple-200'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {gender === 'Custom' && (
                <input
                  type="text"
                  value={customGender}
                  onChange={(e) => setCustomGender(e.target.value)}
                  placeholder="Enter custom gender identity..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                />
              )}
            </div>
          </div>

          {/* Profile Theme + Avatar Frame + Card Surface + Typography */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                Profile Color Theme ({Object.keys(PROFILE_THEMES).length} Themes)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.values(PROFILE_THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all cursor-pointer ${
                      theme === t.id
                        ? `${t.accentBorder} bg-zinc-900 text-white ring-1 ring-purple-400 shadow-md`
                        : 'border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded-full bg-gradient-to-r ${t.previewGradient} shrink-0`} />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80">
              <div>
                <label className="block text-[11px] font-bold text-purple-300 mb-1.5 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Avatar Frame Effect</span>
                </label>
                <select
                  value={avatarFrame}
                  onChange={(e) => setAvatarFrame(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="default">Standard Theme Border</option>
                  <option value="neon_ring">Neon Aura Ring</option>
                  <option value="royal_gold">👑 Royal Gold Crown</option>
                  <option value="sakura_glow">🌸 Sakura Glow</option>
                  <option value="cyber_hex">⚡ Cyber Prism</option>
                  <option value="chromatic_pulse">🌈 Chromatic Halo</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 mb-1.5 flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Card Surface Style</span>
                </label>
                <select
                  value={cardEffect}
                  onChange={(e) => setCardEffect(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="glass">Frosted Backdrop Glass</option>
                  <option value="neon_border">Neon Rim Glow</option>
                  <option value="obsidian_solid">Deep Obsidian Matte</option>
                  <option value="aurora_glow">Aurora Gradient Mist</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 mb-1.5">
                  Profile Typography
                </label>
                <select
                  value={fontStyle}
                  onChange={(e) => setFontStyle(e.target.value as any)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="sans">Modern Sans (Clean)</option>
                  <option value="serif">Literary Serif (Roleplay)</option>
                  <option value="mono">Cyber Terminal Mono</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status Mood, Featured Quote & Pinned Character */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Status Mood
              </label>
              <input
                type="text"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="e.g. ⚔️ Creating dark fantasy RPG bots"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Featured Quote
              </label>
              <input
                type="text"
                value={featuredQuote}
                onChange={(e) => setFeaturedQuote(e.target.value)}
                placeholder="e.g. Every prompt is a key..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none font-serif italic"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1 flex items-center gap-1">
                <Pin className="h-3.5 w-3.5" />
                <span>Pinned Character Showcase</span>
              </label>
              <select
                value={pinnedCharacterUuid}
                onChange={(e) => setPinnedCharacterUuid(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              >
                <option value="">None (No pinned character)</option>
                {availableCharacters.map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {c.name} — {c.tagline.slice(0, 32)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bio & Favorite Tags */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                About Me / Bio (Supports Wiki &amp; Markdown Formatting)
              </label>
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Introduce yourself, your bot writing style, lore universes, or rules..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Favorite RP Tags / Genres (comma separated)
              </label>
              <input
                type="text"
                value={favoriteTagsText}
                onChange={(e) => setFavoriteTagsText(e.target.value)}
                placeholder="Dark Fantasy, Cyberpunk, Slow Burn, RPG, Lorebook..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Badges Showcase */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Showcase Badges ({selectedBadges.length} selected)
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_BADGES.map((b) => {
                const isSelected = selectedBadges.includes(b);
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => toggleBadge(b)}
                    className={`rounded-xl px-3 py-1 text-xs font-bold transition-all border ${
                      isSelected
                        ? 'border-purple-500 bg-purple-600/30 text-purple-200 shadow-sm'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {b}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Social Links &amp; Creator Support
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="text"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="Discord: username#0000"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="Twitter / X: @username"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="GitHub: username or URL"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Website / Portfolio URL"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
              <input
                type="url"
                value={patreon}
                onChange={(e) => setPatreon(e.target.value)}
                placeholder="Patreon / Ko-fi link"
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none sm:col-span-2 lg:col-span-2"
              />
            </div>
          </div>

          {/* Custom CSS Studio */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <FileCode className="h-4 w-4" />
                <span>Custom Profile CSS (Chub Creator Styling)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {CSS_SNIPPETS.map((snip) => (
                  <button
                    key={snip.label}
                    type="button"
                    onClick={() =>
                      setCustomCss((prev) => (prev.trim() ? `${prev.trim()}\n${snip.css}` : snip.css))
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-[10px] font-bold text-zinc-300 hover:border-purple-500 hover:text-white cursor-pointer"
                  >
                    + {snip.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              placeholder=".palace-profile-display-name { text-shadow: 0 0 18px rgba(217, 70, 239, 0.75); }"
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-[11px] font-mono text-purple-200 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-purple-900/40 hover:from-purple-500 hover:to-amber-400 disabled:opacity-50 transition-all cursor-pointer"
            >
              {saving ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{saving ? 'Saving...' : 'Save Customization'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
