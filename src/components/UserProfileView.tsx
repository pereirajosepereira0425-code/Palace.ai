import React, { useState, useEffect } from 'react';
import {
  User,
  Sparkles,
  Check,
  Copy,
  Globe,
  Edit3,
  ExternalLink,
  ArrowLeft,
  Send,
  MessageCircle,
  Trash2,
  Pin,
  MessageSquare,
  Heart,
} from 'lucide-react';
import { UserProfile, Character, SharedPersona } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { CharacterCard } from './CharacterCard.tsx';
import { renderWikiMarkup } from '../utils/characterUtils.ts';
import { isOwnedByRequester } from '../utils/ownership.ts';
import {
  getProfileTheme,
  parseSocialAndCustomization,
  sanitizeCustomCss,
} from '../utils/profileCustomization.ts';

interface UserProfileViewProps {
  targetUsername?: string;
  onSelectCharacter: (char: Character) => void;
  onQuickViewCharacter?: (char: Character) => void;
  onEditCharacter?: (char: Character) => void;
  onDeleteCharacter?: (char: Character) => void;
  onEditPersona?: (persona: SharedPersona) => void;
  onOpenEditModal: () => void;
  onBack?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({
  targetUsername,
  onSelectCharacter,
  onQuickViewCharacter,
  onEditCharacter,
  onDeleteCharacter,
  onEditPersona,
  onOpenEditModal,
  onBack,
}) => {
  const { user: authUser, profile: myProfile, guestId, getIdToken } = useAuth();
  const [confirmDeletePersonaUuid, setConfirmDeletePersonaUuid] = useState<string | null>(null);

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [createdBots, setCreatedBots] = useState<Character[]>([]);
  const [userPersonas, setUserPersonas] = useState<SharedPersona[]>([]);
  const [pinnedBot, setPinnedBot] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bots' | 'personas' | 'about' | 'wall'>('bots');
  const [copiedLink, setCopiedLink] = useState(false);

  // Guestbook Wall state
  const [wallComments, setWallComments] = useState<Array<{ name: string; message: string; date: string }>>([
    {
      name: 'Foxy_poolBidd10101',
      message: 'Love your dark fantasy characters! Sylvia Thorne is incredible.',
      date: 'Yesterday at 4:20 PM',
    },
    {
      name: 'Anonymous_Writer',
      message: 'Best lorebook formatting on the Palace. Keep them coming!',
      date: '2 days ago',
    },
  ]);
  const [newComment, setNewComment] = useState('');

  const effectiveHandle = targetUsername || myProfile?.username || 'guest_wanderer';
  const isOwner = Boolean(
    !targetUsername ||
      (myProfile?.username && targetUsername.toLowerCase() === myProfile.username.toLowerCase()) ||
      (!authUser && targetUsername?.toLowerCase() === 'guest_wanderer')
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // If viewing own guest profile without targetUsername, show myProfile and also load user's created bots/personas
      if (!authUser && isOwner && myProfile) {
        setProfileData(myProfile);
        const [charsRes, personasRes] = await Promise.all([
          fetch('/api/characters'),
          fetch(`/api/personas/me?guestId=${encodeURIComponent(guestId)}`),
        ]);
        if (charsRes.ok) {
          const cData = await charsRes.json();
          const allChars: Character[] = cData.characters || [];
          setCreatedBots(
            allChars.filter((c) => isOwnedByRequester(c.creatorId, { userUid: null, guestId }))
          );
          if (myProfile.pinnedCharacterUuid) {
            setPinnedBot(allChars.find((c) => c.uuid === myProfile.pinnedCharacterUuid) || null);
          } else {
            setPinnedBot(null);
          }
        }
        if (personasRes.ok) {
          const pData = await personasRes.json();
          setUserPersonas(pData.personas || []);
        }
        return;
      }

      const res = await fetch(`/api/users/${encodeURIComponent(effectiveHandle)}`);
      if (res.ok) {
        const data = await res.json();
        setProfileData(data.user);
        setCreatedBots(data.createdBots || []);
        setUserPersonas(data.userPersonas || []);
        if (data.user?.pinnedCharacterUuid) {
          const match = (data.createdBots || []).find(
            (c: Character) => c.uuid === data.user.pinnedCharacterUuid
          );
          if (match) {
            setPinnedBot(match);
          } else {
            const cRes = await fetch(`/api/characters/${encodeURIComponent(data.user.pinnedCharacterUuid)}`);
            if (cRes.ok) {
              const cJson = await cRes.json();
              setPinnedBot(cJson.character || null);
            }
          }
        } else {
          setPinnedBot(null);
        }
      } else if (isOwner && myProfile) {
        setProfileData(myProfile);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      if (isOwner && myProfile) setProfileData(myProfile);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [effectiveHandle, myProfile, authUser, guestId]);

  const handleCopyProfileLink = () => {
    const url = `${window.location.origin}/users/${profileData?.username || effectiveHandle}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setWallComments((prev) => [
      {
        name: myProfile?.displayName || authUser?.displayName || 'Anonymous Guest',
        message: newComment.trim(),
        date: 'Just now',
      },
      ...prev,
    ]);
    setNewComment('');
  };

  if (loading && !profileData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading Chub.ai Profile...</p>
        </div>
      </div>
    );
  }

  const p = isOwner && myProfile ? myProfile : profileData || myProfile;
  if (!p) return null;

  const theme = getProfileTheme(p.theme);
  const { socials, customization } = parseSocialAndCustomization(p.socialLinks);
  const safeCss = sanitizeCustomCss(p.customCss);

  // Badges
  let badgesList: string[] = [];
  try {
    badgesList = typeof p.badges === 'string' ? JSON.parse(p.badges) : p.badges || [];
  } catch {
    badgesList = ['Chub Creator', 'Palace Explorer'];
  }

  const fontClass =
    customization.fontStyle === 'serif'
      ? 'font-serif'
      : customization.fontStyle === 'mono'
        ? 'font-mono'
        : 'font-sans';

  const cardSurfaceClass =
    customization.cardEffect === 'obsidian_solid'
      ? 'bg-black/95 backdrop-blur-none'
      : customization.cardEffect === 'aurora_glow'
        ? 'bg-zinc-950/85 backdrop-blur-xl ring-1 ring-white/10'
        : customization.cardEffect === 'neon_border'
          ? 'bg-zinc-950/90 backdrop-blur-xl ring-1 ring-purple-400/50'
          : `${theme.cardBg} backdrop-blur-xl`;

  const avatarFrameClass =
    customization.avatarFrame === 'royal_gold'
      ? 'border-amber-400 ring-2 ring-amber-300/60 shadow-amber-900/50'
      : customization.avatarFrame === 'sakura_glow'
        ? 'border-pink-400 ring-2 ring-pink-400/60 shadow-pink-900/50'
        : customization.avatarFrame === 'cyber_hex'
          ? 'border-cyan-400 ring-2 ring-fuchsia-500/60 shadow-cyan-900/50'
          : customization.avatarFrame === 'chromatic_pulse'
            ? 'border-fuchsia-400 ring-4 ring-purple-500/50 shadow-fuchsia-900/50'
            : customization.avatarFrame === 'neon_ring'
              ? `${theme.avatarBorder} ring-2 ring-purple-400/50`
              : theme.avatarBorder;

  return (
    <div
      data-testid="user-profile-root"
      data-theme={theme.id}
      data-has-bg={customization.profileBackgroundUrl ? 'true' : 'false'}
      className={`palace-custom-profile-root relative min-h-[calc(100vh-4rem)] w-full overflow-hidden ${fontClass}`}
    >
      {safeCss && <style>{safeCss}</style>}

      {/* Full-Page Profile Background Wallpaper */}
      {customization.profileBackgroundUrl && (
        <div
          data-testid="profile-page-background"
          className="fixed inset-0 top-16 pointer-events-none z-0 overflow-hidden"
        >
          <img
            src={customization.profileBackgroundUrl}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
            style={{ filter: `blur(${customization.backgroundBlur ?? 4}px)` }}
          />
          <div
            className="absolute inset-0 bg-zinc-950"
            style={{ opacity: customization.backgroundDim ?? 0.65 }}
          />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 animate-in fade-in duration-300 space-y-6">
        {/* Top Breadcrumb & Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all shadow-sm backdrop-blur-md cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyProfileLink}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/90 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all backdrop-blur-md cursor-pointer"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-purple-400" />
              )}
              <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
            </button>

            {isOwner && (
              <button
                onClick={onOpenEditModal}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all cursor-pointer ${theme.primaryButton}`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>✨ Customize Profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Profile Header Card (Chub biguswigus style with active Theme) */}
        <div
          className={`palace-profile-header-card relative rounded-3xl overflow-hidden border ${theme.accentBorder} ${cardSurfaceClass} shadow-2xl ${theme.glowShadow}`}
        >
          {/* Banner Wallpaper */}
          <div className="relative h-56 sm:h-72 w-full bg-zinc-900 overflow-hidden">
            <img
              src={
                p.bannerUrl ||
                'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1600&q=80'
              }
              alt="Profile Banner"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />
          </div>

          {/* User Identity Row */}
          <div className="relative -mt-20 px-6 sm:px-10 pb-8 flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
              {/* Avatar */}
              <div
                className={`relative h-32 w-32 sm:h-36 sm:w-36 rounded-3xl overflow-hidden border-4 shadow-2xl bg-zinc-900 shrink-0 ${avatarFrameClass}`}
              >
                <img
                  src={
                    p.avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
                  }
                  alt={p.displayName}
                  className="h-full w-full object-cover object-top"
                />
              </div>

              {/* Names & Taglines */}
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <h1 className="palace-profile-display-name text-2xl sm:text-4xl font-black text-white">
                    {p.displayName}
                  </h1>
                  <span
                    className={`rounded-full border px-3 py-0.5 text-xs font-bold ${theme.pillBg} ${theme.pillText}`}
                  >
                    @{p.username || 'user'}
                  </span>
                </div>

                {/* Pronouns, Gender & Status */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 text-xs font-medium text-zinc-400">
                  <span className={`${theme.statAccent} font-semibold`}>{p.pronouns || 'They/Them'}</span>
                  <span>&bull;</span>
                  <span className="text-amber-300 font-semibold">{p.gender || 'Unknown'}</span>
                  {p.statusMessage && (
                    <>
                      <span>&bull;</span>
                      <span className="text-zinc-200 italic">&quot;{p.statusMessage}&quot;</span>
                    </>
                  )}
                </div>

                {/* Badges Tray */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-1.5 pt-1">
                  {badgesList.map((badge, idx) => (
                    <span
                      key={idx}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-bold shadow-sm ${theme.pillBg} ${theme.pillText}`}
                    >
                      <Sparkles className="h-3 w-3 text-amber-300" />
                      <span>{badge}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Social Links & Stats */}
            <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {socials.discord && (
                  <span className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-indigo-300 shadow-sm">
                    Discord: {socials.discord}
                  </span>
                )}
                {socials.twitter && (
                  <a
                    href={
                      socials.twitter.startsWith('http')
                        ? socials.twitter
                        : `https://twitter.com/${socials.twitter.replace(/^@/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-sky-400 hover:text-white transition-colors"
                    title="Twitter / X"
                  >
                    𝕏
                  </a>
                )}
                {socials.github && (
                  <a
                    href={
                      socials.github.startsWith('http')
                        ? socials.github
                        : `https://github.com/${socials.github.replace(/^@/, '')}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-200 hover:text-white transition-colors"
                    title="GitHub"
                  >
                    GitHub
                  </a>
                )}
                {socials.patreon && (
                  <a
                    href={socials.patreon}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-rose-950/60 border border-rose-500/40 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:text-white transition-colors flex items-center gap-1"
                    title="Support Creator"
                  >
                    <Heart className="h-3 w-3" />
                    <span>Support</span>
                  </a>
                )}
                {socials.website && (
                  <a
                    href={socials.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-zinc-900 border border-zinc-800 p-2 text-purple-400 hover:text-white transition-colors"
                    title="Website / Portfolio"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-3 text-xs bg-zinc-900/90 border border-zinc-800 px-4 py-2 rounded-2xl backdrop-blur-md">
                <div className="text-center">
                  <div className="font-bold text-white text-sm">{createdBots.length}</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Bots</div>
                </div>
                <div className="h-6 w-px bg-zinc-800" />
                <div className="text-center">
                  <div className={`font-bold text-sm ${theme.statAccent}`}>{userPersonas.length}</div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Personas</div>
                </div>
                <div className="h-6 w-px bg-zinc-800" />
                <div className="text-center">
                  <div className="font-bold text-amber-300 text-sm">
                    {createdBots.reduce((acc, b) => acc + (b.chatCount || 0), 0)}
                  </div>
                  <div className="text-[10px] text-zinc-400 uppercase font-semibold">Chats</div>
                </div>
              </div>
            </div>
          </div>

          {/* Favorite Tags Strip */}
          {customization.favoriteTags && customization.favoriteTags.length > 0 && (
            <div className="mx-6 sm:mx-10 mb-5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-zinc-400 mr-1">Favorite Genres:</span>
              {customization.favoriteTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-200"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Featured Quote Callout Banner */}
          {p.featuredQuote && (
            <div
              className={`mx-6 sm:mx-10 mb-6 rounded-2xl border p-4 text-center text-xs font-serif italic ${theme.quoteBanner}`}
            >
              &quot;{p.featuredQuote}&quot;
            </div>
          )}

          {/* Pinned Character Spotlight */}
          {pinnedBot && (
            <div className="mx-6 sm:mx-10 mb-6 rounded-2xl border border-amber-500/35 bg-zinc-900/75 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <img
                  src={pinnedBot.avatar}
                  alt={pinnedBot.name}
                  className="h-16 w-16 rounded-2xl object-cover border border-amber-400/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    <Pin className="h-3 w-3" />
                    <span>Featured Pinned Bot</span>
                  </div>
                  <h4 className="text-base font-black text-white truncate">{pinnedBot.name}</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1">{pinnedBot.tagline}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onQuickViewCharacter && (
                  <button
                    type="button"
                    onClick={() => onQuickViewCharacter(pinnedBot)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                  >
                    View Card
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectCharacter(pinnedBot)}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md cursor-pointer ${theme.primaryButton}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Chat Now</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-t border-zinc-800/80 bg-zinc-900/50 px-6 sm:px-10 py-3 overflow-x-auto no-scrollbar">
            {[
              { id: 'bots', label: `Characters (${createdBots.length})` },
              { id: 'personas', label: `Personas (${userPersonas.length})` },
              { id: 'about', label: 'About & Wiki Lore' },
              { id: 'wall', label: `Profile Wall (${wallComments.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? theme.activeTab
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Contents */}
        {activeTab === 'bots' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                Characters created by <strong className="text-white">@{p.username}</strong>
              </span>
            </div>

            {createdBots.length === 0 ? (
              <div className={`rounded-3xl border ${theme.accentBorder} ${cardSurfaceClass} p-12 text-center text-zinc-400`}>
                <User className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-white mb-1">No Characters Published Yet</h3>
                <p className="text-xs text-zinc-400">
                  This user hasn&apos;t shared any public bots to the Palace yet.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {createdBots.map((char) => (
                  <CharacterCard
                    key={char.id}
                    character={char}
                    canEdit={isOwnedByRequester(char.creatorId, {
                      userUid: authUser?.uid,
                      guestId,
                    })}
                    onEditCharacter={onEditCharacter}
                    onDeleteCharacter={
                      onDeleteCharacter
                        ? (c) => {
                            onDeleteCharacter(c);
                            setCreatedBots((prev) => prev.filter((item) => item.uuid !== c.uuid));
                          }
                        : undefined
                    }
                    onSelectCharacter={onSelectCharacter}
                    onQuickView={onQuickViewCharacter || onSelectCharacter}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'personas' && (
          <div className="space-y-4">
            {userPersonas.length === 0 ? (
              <div className={`rounded-3xl border ${theme.accentBorder} ${cardSurfaceClass} p-12 text-center text-zinc-400`}>
                <User className="h-10 w-10 text-purple-400 mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-white mb-1">No Personas Shared</h3>
                <p className="text-xs text-zinc-400">
                  No public roleplay personas have been published by this creator.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {userPersonas.map((persona) => {
                  const canModifyPersona = isOwnedByRequester(persona.userId, {
                    userUid: authUser?.uid,
                    guestId,
                  });
                  return (
                    <div
                      key={persona.id}
                      className={`rounded-2xl border ${theme.accentBorder} ${cardSurfaceClass} p-4 space-y-3`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={persona.avatar}
                          alt={persona.name}
                          className="h-12 w-12 rounded-xl object-cover border border-purple-500/40"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{persona.name}</h4>
                          <div className={`text-[11px] ${theme.statAccent}`}>{persona.pronouns}</div>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-300 line-clamp-3 italic bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-800/60">
                        &quot;{persona.bio}&quot;
                      </p>
                      {canModifyPersona && (
                        <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-800/80">
                          {onEditPersona && (
                            <button
                              type="button"
                              onClick={() => onEditPersona(persona)}
                              className="flex items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition-all"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirmDeletePersonaUuid !== persona.uuid) {
                                setConfirmDeletePersonaUuid(persona.uuid);
                                setTimeout(
                                  () =>
                                    setConfirmDeletePersonaUuid((c) =>
                                      c === persona.uuid ? null : c
                                    ),
                                  3500
                                );
                                return;
                              }
                              setConfirmDeletePersonaUuid(null);
                              const token = await getIdToken();
                              const headers: Record<string, string> = {};
                              if (token) headers['Authorization'] = `Bearer ${token}`;
                              const res = await fetch(
                                `/api/personas/${persona.uuid}?guestId=${encodeURIComponent(guestId)}`,
                                { method: 'DELETE', headers }
                              );
                              if (res.ok) {
                                setUserPersonas((prev) =>
                                  prev.filter((item) => item.uuid !== persona.uuid)
                                );
                              }
                            }}
                            className={`flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                              confirmDeletePersonaUuid === persona.uuid
                                ? 'border-rose-500 bg-rose-600 text-white'
                                : 'border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40'
                            }`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>
                              {confirmDeletePersonaUuid === persona.uuid ? 'Confirm' : 'Delete'}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'about' && (
          <div className={`rounded-3xl border ${theme.accentBorder} ${cardSurfaceClass} p-6 sm:p-8 space-y-6`}>
            <div>
              <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 ${theme.statAccent}`}>
                About &bull; Creator Biography
              </h3>
              <div className="wiki-rendered-content text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">
                {renderWikiMarkup(p.bio || 'No biography written yet.')}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'wall' && (
          <div className={`rounded-3xl border ${theme.accentBorder} ${cardSurfaceClass} p-6 sm:p-8 space-y-6`}>
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-purple-400" />
                  <span>Profile Wall &amp; Guestbook</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Leave a note or sign @{p.username}&apos;s profile
                </p>
              </div>
            </div>

            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Write a public message on @${p.username}'s wall...`}
                className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer ${theme.primaryButton}`}
              >
                <Send className="h-3.5 w-3.5" />
                <span>Sign Wall</span>
              </button>
            </form>

            <div className="space-y-3">
              {wallComments.map((comment, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${theme.statAccent}`}>{comment.name}</span>
                    <span className="text-[10px] text-zinc-500">{comment.date}</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">{comment.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
