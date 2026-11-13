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
  Link as LinkIcon,
  Globe,
  Tag,
  Shield,
  AlertTriangle,
  Smile,
  FileCode,
  Heart,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { UserProfile } from '../types/index.ts';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEME_OPTIONS = [
  { id: 'purple', name: '🔮 Twilight Palace', color: 'from-purple-900 to-indigo-950', border: 'border-purple-500' },
  { id: 'neon_cyberpunk', name: '⚡ Cyberpunk Neon', color: 'from-cyan-950 to-pink-950', border: 'border-cyan-400' },
  { id: 'dark_obsidian', name: '🖤 Obsidian Void', color: 'from-zinc-950 to-red-950', border: 'border-red-500' },
  { id: 'royal_gold', name: '👑 Royal Sovereign', color: 'from-amber-950 to-zinc-950', border: 'border-amber-400' },
  { id: 'rose_blossom', name: '🌸 Sakura Blossom', color: 'from-pink-950 to-rose-950', border: 'border-pink-400' },
  { id: 'emerald', name: '🌲 Emerald Enchanter', color: 'from-emerald-950 to-teal-950', border: 'border-emerald-400' },
];

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

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { profile, updateProfile, user } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || AVATAR_PRESETS[0]);
  const [bannerUrl, setBannerUrl] = useState(profile?.bannerUrl || BANNER_PRESETS[0]);
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
  const [website, setWebsite] = useState('');
  const [patreon, setPatreon] = useState('');

  // Handle checking
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [checkingHandle, setCheckingHandle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

      try {
        const b = typeof profile.badges === 'string' ? JSON.parse(profile.badges) : profile.badges || [];
        setSelectedBadges(b);
      } catch {
        setSelectedBadges(['Chub Creator', 'Palace Explorer']);
      }

      try {
        const s = typeof profile.socialLinks === 'string' ? JSON.parse(profile.socialLinks) : profile.socialLinks || {};
        setDiscord(s.discord || '');
        setTwitter(s.twitter || '');
        setWebsite(s.website || '');
        setPatreon(s.patreon || '');
      } catch {
        // default
      }
    }
  }, [profile, isOpen]);

  // Handle availability debounced check
  useEffect(() => {
    if (!username || username === profile?.username) {
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
  }, [username, profile?.username]);

  if (!isOpen) return null;

  // File upload handler converting ANY file to base64 Data URL
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (target === 'avatar') {
        setAvatarUrl(result);
      } else {
        setBannerUrl(result);
      }
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
    if (!user) {
      setErrorMsg('Please sign in to customize and save your permanent profile.');
      return;
    }

    if (handleAvailable === false) {
      setErrorMsg(`@${username} is already taken. Please choose another username handle.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const effectivePronouns = pronouns === 'Custom' ? customPronouns || 'They/Them' : pronouns;
      const effectiveGender = gender === 'Custom' ? customGender || 'Non-Binary' : gender;

      await updateProfile({
        username: username.trim(),
        displayName: displayName.trim(),
        avatarUrl,
        bannerUrl,
        bio: bio.trim(),
        pronouns: effectivePronouns,
        gender: effectiveGender,
        theme,
        statusMessage: statusMessage.trim(),
        featuredQuote: featuredQuote.trim(),
        badges: selectedBadges,
        socialLinks: {
          discord: discord.trim(),
          twitter: twitter.trim(),
          website: website.trim(),
          patreon: patreon.trim(),
        },
      });

      setSuccessMsg('Profile saved successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in">
      <div className="relative flex flex-col h-[90vh] w-full max-w-4xl rounded-3xl border border-purple-500/40 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-purple-900/40 px-6 py-4 bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-600/20 p-2 border border-purple-500/30">
              <User className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Customize Your Chub.ai Profile</span>
                <span className="rounded-md bg-purple-900/60 border border-purple-500/30 px-2 py-0.5 text-[10px] text-purple-300 font-mono">
                  @{username || 'handle'}
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Personalize your public presence inspired by https://chub.ai/users/biguswigus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 hover:text-white transition-colors"
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

          {/* Banner & Avatar Live Preview */}
          <div className="relative rounded-3xl overflow-hidden border border-zinc-800 shadow-xl bg-zinc-900">
            {/* Banner Background */}
            <div className="relative h-44 w-full bg-zinc-950 overflow-hidden">
              <img
                src={bannerUrl}
                alt="Banner"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />

              <label className="absolute top-3 right-3 flex items-center gap-1.5 rounded-xl bg-black/70 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/90 cursor-pointer backdrop-blur-md shadow-lg transition-all">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Banner (Any file)</span>
                <input
                  type="file"
                  accept="*/*"
                  onChange={(e) => handleFileUpload(e, 'banner')}
                  className="hidden"
                />
              </label>
            </div>

            {/* Avatar & Core Bio Overlay */}
            <div className="relative -mt-16 px-6 pb-6 flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <div className="relative h-28 w-28 rounded-2xl overflow-hidden border-4 border-purple-500 shadow-2xl bg-zinc-900 shrink-0 group">
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover object-top"
                  />
                  <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-[10px] font-bold text-white transition-opacity cursor-pointer">
                    <Upload className="h-5 w-5 mb-1" />
                    <span>Upload Any File</span>
                    <input
                      type="file"
                      accept="*/*"
                      onChange={(e) => handleFileUpload(e, 'avatar')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="text-center sm:text-left space-y-1">
                  <h3 className="text-xl font-black text-white">{displayName || 'Display Name'}</h3>
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-purple-300">
                    <span>@{username || 'handle'}</span>
                    <span>&bull;</span>
                    <span className="text-zinc-400">{pronouns}</span>
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

          {/* Quick Preset Pickers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                Preset Avatars
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {AVATAR_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAvatarUrl(p)}
                    className={`h-11 w-11 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      avatarUrl === p ? 'border-purple-400 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={p} alt="Preset" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
                Preset Banners
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {BANNER_PRESETS.map((b, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setBannerUrl(b)}
                    className={`h-11 w-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                      bannerUrl === b ? 'border-purple-400 scale-105' : 'border-zinc-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={b} alt="Preset" className="h-full w-full object-cover" />
                  </button>
                ))}
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
                  placeholder="Enter custom pronouns (e.g. Fae/Faer, Ze/Zir)..."
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

          {/* Status Mood & Featured Quote */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Status Message / Current Mood
              </label>
              <input
                type="text"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder="e.g. ⚔️ Creating immersive dark fantasy RPG bots"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
                Featured Profile Quote
              </label>
              <input
                type="text"
                value={featuredQuote}
                onChange={(e) => setFeaturedQuote(e.target.value)}
                placeholder="e.g. In the kingdom of words, every prompt is a key."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none font-serif italic"
              />
            </div>
          </div>

          {/* Bio / About Me with Wiki Editor Support */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-1">
              About Me / Bio (Supports Wiki &amp; Markdown Formatting)
            </label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Introduce yourself, your bot writing style, lore universes, favorite tags, or rules for chatting with your characters..."
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Profile Theme Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
              Profile Color Theme &amp; Atmosphere
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {THEME_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                    theme === t.id
                      ? `${t.border} bg-zinc-900 text-white ring-1 ring-purple-400 shadow-md`
                      : 'border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className={`h-4 w-4 rounded-full bg-gradient-to-r ${t.color}`} />
                  <span>{t.name}</span>
                </button>
              ))}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="Discord: username#0000 or server invite"
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
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
              />
            </div>
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
              {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Save className="h-4 w-4" />}
              <span>{saving ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
