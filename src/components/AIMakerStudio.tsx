import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Keyboard,
  Loader2,
  MousePointer2,
  Play,
  RefreshCw,
  Rocket,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { Character, ContentRating } from '../types/index.ts';
import type { GenerationPresets } from './PresetsModal.tsx';
import {
  DEFAULT_PARAGRAPH_COUNTS,
  MAKER_MODEL_OPTIONS,
  MAX_MAKER_IMAGES,
  clampParagraphCount,
  splitParagraphs,
  type AiMakerDraft,
  type MakerImageRef,
  type MakerModelId,
  type ParagraphCountsConfig,
  type WebResearchDossier,
} from '../utils/aiMakerUtils.ts';

interface AIMakerStudioProps {
  presets: GenerationPresets;
  onOpenInCharacterStudio: (draft: AiMakerDraft) => void;
  onCharacterPublished: (character: Character) => void;
  onCancel: () => void;
}

const DEFAULT_FALLBACK_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

function parseUrlLines(raw: string): string[] {
  return String(raw || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

async function compressImageFileToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Could not read image "${file.name}"`));
    reader.readAsDataURL(file);
  });

  if (typeof Image === 'undefined' || rawDataUrl.length <= 280_000) {
    return rawDataUrl;
  }

  return await new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 960;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export const AIMakerStudio: React.FC<AIMakerStudioProps> = ({
  presets,
  onOpenInCharacterStudio,
  onCharacterPublished,
  onCancel,
}) => {
  const { getIdToken, guestId } = useAuth();

  // Core Maker Form State
  const [prompt, setPrompt] = useState('');
  const [makerModel, setMakerModel] = useState<MakerModelId>('palace_maker_opus');
  const [ratingOverride, setRatingOverride] = useState<ContentRating | 'AUTO'>('AUTO');
  const [nsfwAllowed, setNsfwAllowed] = useState<boolean>(true);
  const [paragraphCounts, setParagraphCounts] = useState<ParagraphCountsConfig>({
    ...DEFAULT_PARAGRAPH_COUNTS,
  });

  // Up to 30 Reference Images + Per-Image Prompts
  const [images, setImages] = useState<MakerImageRef[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageUrlPrompt, setImageUrlPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Web Research + Competitor Bot Sources
  const [searchQuery, setSearchQuery] = useState('');
  const [wikiUrlsText, setWikiUrlsText] = useState('');
  const [chatbotUrlsText, setChatbotUrlsText] = useState('');

  // Execution & Live Browser State
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [dossier, setDossier] = useState<WebResearchDossier | null>(null);
  const [draft, setDraft] = useState<AiMakerDraft | null>(null);
  const [rightTab, setRightTab] = useState<'browser' | 'notes' | 'output'>('browser');

  // Virtual Browser Replay State
  const [activeScreenshotIdx, setActiveScreenshotIdx] = useState(0);
  const [replaying, setReplaying] = useState(false);

  const selectedModelMeta = useMemo(
    () => MAKER_MODEL_OPTIONS.find((m) => m.id === makerModel) || MAKER_MODEL_OPTIONS[0],
    [makerModel]
  );

  useEffect(() => {
    if (!replaying || !dossier || dossier.screenshots.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveScreenshotIdx((prev) => {
        if (prev + 1 >= dossier.screenshots.length) {
          setReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1100);
    return () => window.clearInterval(timer);
  }, [replaying, dossier]);

  const handleParagraphChange = (key: keyof ParagraphCountsConfig, rawVal: string | number) => {
    const min = key === 'alternateGreetingsCount' ? 0 : 1;
    const max = key === 'systemPrompt' ? 8 : key.includes('alternate') || key === 'creatorNotes' || key === 'postHistoryInstructions' ? 6 : 10;
    setParagraphCounts((prev) => ({
      ...prev,
      [key]: clampParagraphCount(rawVal, min, max, prev[key]),
    }));
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMsg('');
    const remainingSlots = MAX_MAKER_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setErrorMsg(`Maximum of ${MAX_MAKER_IMAGES} reference images reached.`);
      return;
    }
    const picked = Array.from(fileList).slice(0, remainingSlots);
    const added: MakerImageRef[] = [];
    for (let i = 0; i < picked.length; i++) {
      const f = picked[i];
      try {
        const dataUrl = await compressImageFileToDataUrl(f);
        const autoRole: MakerImageRef['role'] =
          images.length === 0 && i === 0
            ? 'avatar'
            : images.length <= 1 && i === 1
            ? 'background'
            : 'reference';
        added.push({
          id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${i}`,
          name: f.name,
          dataUrl,
          prompt: '',
          role: autoRole,
          nsfw: nsfwAllowed && /nsfw|lewd|explicit|nude/i.test(f.name),
        });
      } catch (err: any) {
        setErrorMsg(err?.message || `Failed to load ${f.name}`);
      }
    }
    if (added.length > 0) {
      setImages((prev) => [...prev, ...added].slice(0, MAX_MAKER_IMAGES));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddImageUrl = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    if (images.length >= MAX_MAKER_IMAGES) {
      setErrorMsg(`Maximum of ${MAX_MAKER_IMAGES} reference images reached.`);
      return;
    }
    const autoRole: MakerImageRef['role'] =
      images.length === 0 ? 'avatar' : images.length === 1 ? 'background' : 'reference';
    setImages((prev) => [
      ...prev,
      {
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: url.split('/').pop()?.split('?')[0] || `Image ${prev.length + 1}`,
        dataUrl: url,
        prompt: imageUrlPrompt.trim(),
        role: autoRole,
        nsfw: nsfwAllowed,
      },
    ]);
    setImageUrlInput('');
    setImageUrlPrompt('');
  };

  const updateImageField = (id: string, patch: Partial<MakerImageRef>) => {
    setImages((prev) =>
      prev.map((item) => {
        if (item.id === id) return { ...item, ...patch };
        if (patch.role === 'avatar' && item.role === 'avatar') return { ...item, role: 'reference' };
        if (patch.role === 'background' && item.role === 'background') return { ...item, role: 'reference' };
        return item;
      })
    );
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((item) => item.id !== id));
  };

  const runBrowserResearch = async (): Promise<WebResearchDossier | null> => {
    const query = searchQuery.trim() || prompt.trim().slice(0, 120);
    const explicitUrls = parseUrlLines(wikiUrlsText);
    const chatbotUrls = parseUrlLines(chatbotUrlsText);

    if (!query && explicitUrls.length === 0 && chatbotUrls.length === 0) {
      setErrorMsg('Enter a web/wiki search query or URL before running browser research.');
      return null;
    }

    setResearching(true);
    setErrorMsg('');
    setStatusMsg('Launching headless Chromium agent: moving cursor, typing, scrolling, and capturing screenshots...');
    setRightTab('browser');

    try {
      const res = await fetch('/api/ai-maker/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          explicitUrls,
          chatbotUrls,
          maxPages: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Web research agent failed.');
      }
      const fetchedDossier: WebResearchDossier = data.dossier;
      setDossier(fetchedDossier);
      setActiveScreenshotIdx(0);
      setReplaying(fetchedDossier.screenshots.length > 1);
      setStatusMsg(
        `Visited ${fetchedDossier.visitedUrls.length} page(s), captured ${fetchedDossier.screenshots.length} screenshot(s), extracted ${fetchedDossier.excerpts.length} lore excerpt(s) and ${fetchedDossier.chatbotNotes.length} bot note(s).`
      );
      return fetchedDossier;
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not complete live browser research.');
      return null;
    } finally {
      setResearching(false);
    }
  };

  const handleGenerateCharacter = async (runResearchFirst: boolean) => {
    if (!prompt.trim()) {
      setErrorMsg('Please enter a character prompt first.');
      return;
    }
    setErrorMsg('');

    let activeDossier = dossier;
    if (runResearchFirst) {
      const researched = await runBrowserResearch();
      if (researched) {
        activeDossier = researched;
      }
    }

    setGenerating(true);
    setStatusMsg(`Synthesizing Tavern V2 character sheet via ${selectedModelMeta.label}...`);
    try {
      const res = await fetch('/api/ai-maker/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          makerModel,
          nsfwAllowed,
          ratingOverride,
          paragraphCounts,
          images,
          dossier: activeDossier,
          externalApiKey: presets.chubApiKey || undefined,
          externalApiUrl: presets.chubApiUrl || undefined,
          externalApiProvider: presets.apiProvider || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Character synthesis failed.');
      }
      setDraft(data.draft);
      setRightTab('output');
      setStatusMsg(`Generated complete Tavern V2 character "${data.draft.name}" (${data.draft.rating}).`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to synthesize character sheet.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublishDirectly = async () => {
    if (!draft) return;
    setPublishing(true);
    setErrorMsg('');
    try {
      const token = await getIdToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: draft.name.trim() || 'Generated Character',
          tagline: draft.tagline.trim() || draft.name,
          avatar: draft.avatar || DEFAULT_FALLBACK_AVATAR,
          backgroundImage: draft.backgroundImage || '',
          rating: draft.rating || (nsfwAllowed ? 'NSFW' : 'SFW'),
          description: draft.description,
          personality: draft.personality,
          greeting: draft.greeting,
          alternateGreetings: JSON.stringify(draft.alternateGreetings || []),
          systemPrompt: draft.systemPrompt,
          postHistoryInstructions: draft.postHistoryInstructions,
          creatorNotes: draft.creatorNotes,
          characterVersion: '1.0',
          scenario: draft.scenario,
          exampleDialogues: draft.exampleDialogues,
          tags: JSON.stringify(draft.tags || []),
          voiceName: draft.voiceName || 'Puck',
          voiceStyle: draft.voiceStyle || 'Expressive character voice',
          thinkingDefault: true,
          searchDefault: false,
          gender: draft.gender || 'Unknown',
          pronouns: draft.pronouns || 'They/Them',
          lorebook: JSON.stringify(draft.loreEntries || []),
          guestId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to publish character.');
      }
      setStatusMsg(`Published "${data.character.name}" to Palace.ai!`);
      onCharacterPublished(data.character);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to publish generated character.');
    } finally {
      setPublishing(false);
    }
  };

  const loadSampleDeltarunePreset = () => {
    setPrompt(
      'Spamton G. Spamton from Deltarune Cyber World — sleazy yet haunted glitching salesman speaking in bracketed commercial static, desperate for [[Hyperlink Blocked]], wearing black suit & pink-and-yellow Dealmaker glasses.'
    );
    setSearchQuery('Deltarune wiki Spamton');
    setWikiUrlsText('https://deltarune.fandom.com/wiki/Spamton');
    setStatusMsg('Loaded Deltarune sample prompt & wiki target. Ready to research & generate.');
  };

  const activeShot =
    dossier && dossier.screenshots.length > 0
      ? dossier.screenshots[Math.min(activeScreenshotIdx, dossier.screenshots.length - 1)]
      : null;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Top Studio Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Palace Studio</span>
            <span aria-hidden="true">·</span>
            <span>AI Character Maker</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{images.length}/{MAX_MAKER_IMAGES} Images</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            AI Character Maker &amp; Autonomous Web Researcher
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl">
            Combine a character prompt, up to 30 captioned SFW/NSFW images, live virtual browser research (wikis &amp; JanitorAI/Chub/SpicyChat bot notes), and exact paragraph counts per Tavern V2 field.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadSampleDeltarunePreset}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            Load Deltarune Example
          </button>
          <button
            type="button"
            onClick={() => handleGenerateCharacter(true)}
            disabled={researching || generating}
            data-testid="run-full-maker-btn"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            {researching || generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>
              {researching
                ? 'Browsing Web...'
                : generating
                ? 'Synthesizing...'
                : 'Research Web & Generate All'}
            </span>
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            Back
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {(errorMsg || statusMsg) && (
        <div
          role={errorMsg ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            errorMsg
              ? 'border-red-500/40 bg-red-950/30 text-red-200'
              : 'border-zinc-700 bg-zinc-900/80 text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {(researching || generating) && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            )}
            <span>{errorMsg || statusMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setErrorMsg('');
              setStatusMsg('');
            }}
            aria-label="Dismiss notification"
            className="text-zinc-400 hover:text-white cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Prompt, Model, Paragraph Counts, 30 Images, Research Targets */}
        <div className="xl:col-span-5 space-y-5">
          {/* 1. Prompt, Model & Maturity Controls */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">01. Prompt &amp; Synthesis Engine</h2>
              <span className="text-xs text-zinc-400 font-mono">{selectedModelMeta.tier}</span>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-maker-prompt" className="block text-xs font-medium text-zinc-300">
                Master Character Prompt (SFW &amp; NSFW / Mature supported)
              </label>
              <textarea
                id="ai-maker-prompt"
                data-testid="ai-maker-prompt"
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe who the character is, canon fandom or OC lore, speech quirks, dynamic with {{user}}, and any SFW/NSFW/fetish themes..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="ai-maker-model" className="block text-xs font-medium text-zinc-300">
                  AI Maker Model
                </label>
                <select
                  id="ai-maker-model"
                  data-testid="ai-maker-model"
                  value={makerModel}
                  onChange={(e) => setMakerModel(e.target.value as MakerModelId)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  {MAKER_MODEL_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ai-maker-rating" className="block text-xs font-medium text-zinc-300">
                  Target Content Rating
                </label>
                <select
                  id="ai-maker-rating"
                  data-testid="ai-maker-rating"
                  value={ratingOverride}
                  onChange={(e) => setRatingOverride(e.target.value as ContentRating | 'AUTO')}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-purple-500 focus:outline-none"
                >
                  <option value="AUTO">Auto-Detect from Prompt &amp; Images</option>
                  <option value="SFW">SFW</option>
                  <option value="NSFW">NSFW (Mature / Explicit)</option>
                  <option value="NSFL">NSFL (Dark / Horror)</option>
                  <option value="NSFW + NSFL">NSFW + NSFL</option>
                </select>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">{selectedModelMeta.summary}</p>

            <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
              <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nsfwAllowed}
                  onChange={(e) => setNsfwAllowed(e.target.checked)}
                  data-testid="ai-maker-nsfw-toggle"
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-purple-500"
                />
                <span>Accept NSFW Prompts, Images &amp; Uncensored Bot Notes</span>
              </label>

              <button
                type="button"
                onClick={() => handleGenerateCharacter(false)}
                disabled={generating || !prompt.trim()}
                data-testid="synthesize-only-btn"
                className="rounded-lg border border-purple-500/40 bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/35 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
              >
                {generating ? 'Synthesizing...' : 'Generate Sheet Only'}
              </button>
            </div>
          </section>

          {/* 2. Web, Wiki & Reference Chatbot URLs */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">02. Web Browser Agent &amp; Bot Notes</h2>
              <button
                type="button"
                onClick={runBrowserResearch}
                disabled={researching}
                data-testid="run-research-only-btn"
                className="flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {researching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
                <span>Browse &amp; Research Web</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-maker-search-query" className="block text-xs font-medium text-zinc-300">
                Web / Wiki Search Query
              </label>
              <input
                id="ai-maker-search-query"
                data-testid="ai-maker-search-query"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. Deltarune wiki Spamton, Cyberpunk Edgerunners Lucy..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-maker-wiki-urls" className="block text-xs font-medium text-zinc-300">
                Direct Wiki / Website URLs (one per line)
              </label>
              <textarea
                id="ai-maker-wiki-urls"
                rows={2}
                value={wikiUrlsText}
                onChange={(e) => setWikiUrlsText(e.target.value)}
                placeholder="https://deltarune.fandom.com/wiki/Spamton"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-maker-chatbot-urls" className="block text-xs font-medium text-zinc-300">
                Chatbot Links for Style Notes (JanitorAI, Chub.ai, SpicyChat, etc.)
              </label>
              <textarea
                id="ai-maker-chatbot-urls"
                rows={2}
                value={chatbotUrlsText}
                onChange={(e) => setChatbotUrlsText(e.target.value)}
                placeholder="https://chub.ai/characters/... or https://janitorai.com/characters/... or https://spicychat.ai/chatbot/..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
              />
            </div>
          </section>

          {/* 3. Paragraph Count Controls Per Fill-In Field */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">03. Paragraph Count Per Field</h2>
              <button
                type="button"
                onClick={() => setParagraphCounts({ ...DEFAULT_PARAGRAPH_COUNTS })}
                className="text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Reset defaults
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { key: 'description', label: 'Description' },
                { key: 'personality', label: 'Personality' },
                { key: 'scenario', label: 'Scenario' },
                { key: 'greeting', label: 'First Greeting' },
                { key: 'systemPrompt', label: 'System Prompt' },
                { key: 'postHistoryInstructions', label: 'Post-History' },
                { key: 'exampleDialogues', label: 'Example Dialogues' },
                { key: 'creatorNotes', label: 'Creator Notes' },
                { key: 'alternateGreetingsCount', label: 'Alt Greetings (#)' },
                { key: 'alternateGreetingParagraphs', label: 'Alt Greeting Paras' },
              ].map((item) => {
                const k = item.key as keyof ParagraphCountsConfig;
                const minVal = k === 'alternateGreetingsCount' ? 0 : 1;
                return (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2"
                  >
                    <label htmlFor={`para-${k}`} className="text-xs text-zinc-300 truncate pr-2">
                      {item.label}
                    </label>
                    <input
                      id={`para-${k}`}
                      data-testid={`para-count-${k}`}
                      type="number"
                      min={minVal}
                      max={10}
                      value={paragraphCounts[k]}
                      onChange={(e) => handleParagraphChange(k, e.target.value)}
                      className="w-14 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-1 text-right text-xs font-mono tabular-nums text-white focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. Reference Images Vault (Up to 30 Images + Individual Prompts) */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">04. Visual References</h2>
                <p className="text-xs text-zinc-400">
                  Add up to 30 SFW/NSFW images and give each image its own instruction prompt.
                </p>
              </div>
              <span
                data-testid="maker-image-count"
                className="font-mono tabular-nums text-xs font-semibold text-zinc-200"
              >
                {images.length} / {MAX_MAKER_IMAGES}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
                id="ai-maker-image-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= MAX_MAKER_IMAGES}
                data-testid="maker-upload-images-btn"
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Images</span>
              </button>

              <div className="flex flex-1 items-center gap-1.5 min-w-[210px]">
                <input
                  type="url"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  placeholder="Paste image URL..."
                  aria-label="Reference image URL"
                  data-testid="maker-image-url-input"
                  className="flex-1 min-w-0 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddImageUrl}
                  disabled={!imageUrlInput.trim() || images.length >= MAX_MAKER_IMAGES}
                  data-testid="maker-add-image-url-btn"
                  className="flex items-center gap-1 rounded-lg bg-zinc-800 px-2.5 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  <span>Add URL</span>
                </button>
              </div>
            </div>

            {imageUrlInput.trim() && (
              <input
                type="text"
                value={imageUrlPrompt}
                onChange={(e) => setImageUrlPrompt(e.target.value)}
                placeholder="Optional prompt for this URL image before adding..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500"
              />
            )}

            {images.length === 0 ? (
              <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/60 p-6 text-center text-xs text-zinc-500">
                No reference images added yet. Upload files or paste URLs (0 / 30 used).
              </div>
            ) : (
              <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800 border-t border-zinc-800">
                {images.map((im, idx) => (
                  <div key={im.id} className="flex items-start gap-3 py-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-950 border border-zinc-800">
                      <img
                        src={im.dataUrl}
                        alt={im.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-200 truncate">
                          #{idx + 1} · {im.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          {(['reference', 'avatar', 'background'] as const).map((r) => (
                            <button
                              key={r}
                              type="button"
                              onClick={() => updateImageField(im.id, { role: r })}
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer ${
                                im.role === r
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                              }`}
                            >
                              {r === 'background' ? 'BG' : r === 'avatar' ? 'Avatar' : 'Ref'}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => updateImageField(im.id, { nsfw: !im.nsfw })}
                            aria-label={`Toggle NSFW for ${im.name}`}
                            className={`rounded px-1.5 py-0.5 text-[11px] font-medium cursor-pointer ${
                              im.nsfw
                                ? 'bg-rose-600/80 text-white'
                                : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {im.nsfw ? 'NSFW' : 'SFW'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeImage(im.id)}
                            aria-label={`Remove image ${im.name}`}
                            className="p-1 text-zinc-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={im.prompt}
                        onChange={(e) => updateImageField(im.id, { prompt: e.target.value })}
                        placeholder="Prompt for this image (outfit, pose, lore form, expression, NSFW note...)"
                        aria-label={`Prompt for image ${idx + 1}`}
                        data-testid={`maker-image-prompt-${idx}`}
                        className="w-full rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* RIGHT COLUMN: Live Virtual Browser Viewport, Research Notes, Editable Generated Sheet */}
        <div className="xl:col-span-7 space-y-4">
          {/* Sub-Navigation Tabs */}
          <div
            role="tablist"
            aria-label="AI Maker Output Views"
            className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/80 p-1 w-fit"
          >
            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'browser'}
              onClick={() => setRightTab('browser')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                rightTab === 'browser'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Virtual Browser Monitor ({dossier?.screenshots.length || 0})</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'notes'}
              onClick={() => setRightTab('notes')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                rightTab === 'notes'
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>
                Wiki &amp; Bot Notes ({(dossier?.excerpts.length || 0) + (dossier?.chatbotNotes.length || 0)})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={rightTab === 'output'}
              onClick={() => setRightTab('output')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                rightTab === 'output'
                  ? 'bg-purple-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Generated Sheet {draft ? '· Ready' : ''}</span>
            </button>
          </div>

          {/* VIEW 1: LIVE VIRTUAL BROWSER VIEWPORT & MOUSE/KEYBOARD LOG */}
          {rightTab === 'browser' && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
              {!dossier ? (
                <div className="py-16 text-center space-y-3">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Globe className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    Live Chromium Browser Agent Standing By
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Click &ldquo;Browse &amp; Research Web&rdquo; or &ldquo;Research Web &amp; Generate All&rdquo; to watch the agent navigate wikis, scroll sections, drive a virtual mouse and keyboard, capture viewport screenshots, and mine competitor chatbot notes.
                  </p>
                </div>
              ) : (
                <>
                  {/* Browser Address + Telemetry Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-zinc-500 font-mono">URL:</span>
                      <span className="font-mono text-zinc-200 truncate">
                        {activeShot?.url || dossier.visitedUrls[0] || dossier.query}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono tabular-nums text-zinc-400 shrink-0">
                      <span className="flex items-center gap-1">
                        <MousePointer2 className="h-3 w-3 text-purple-400" />
                        {activeShot?.mouseX ?? 640},{activeShot?.mouseY ?? 260}
                      </span>
                      <span className="flex items-center gap-1">
                        <Keyboard className="h-3 w-3 text-amber-400" />
                        Scroll Y:{activeShot?.scrollY ?? 0}px
                      </span>
                    </div>
                  </div>

                  {/* Chromium Screenshot Canvas + Virtual Cursor Reticle */}
                  {activeShot ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black aspect-video">
                        <img
                          src={activeShot.dataUrl}
                          alt={`Virtual browser capture step ${activeShot.step}`}
                          className="h-full w-full object-contain"
                        />
                        {/* Overlaid Virtual Mouse Cursor */}
                        <div
                          aria-hidden="true"
                          style={{
                            left: `${Math.max(2, Math.min(96, ((activeShot.mouseX || 640) / 1280) * 100))}%`,
                            top: `${Math.max(2, Math.min(94, ((activeShot.mouseY || 260) / 720) * 100))}%`,
                          }}
                          className="pointer-events-none absolute -translate-x-1 -translate-y-1 transition-all duration-300"
                        >
                          <div className="flex items-center gap-1 rounded bg-purple-600/90 px-1.5 py-0.5 text-[10px] font-mono text-white shadow">
                            <MousePointer2 className="h-3 w-3" />
                            <span>Virtual Cursor</span>
                          </div>
                        </div>

                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 py-2 text-xs text-zinc-200">
                          {activeShot.actionSummary}
                        </div>
                      </div>

                      {/* Replay Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setReplaying(false);
                              setActiveScreenshotIdx((i) => Math.max(0, i - 1));
                            }}
                            disabled={activeScreenshotIdx === 0}
                            aria-label="Previous screenshot"
                            className="rounded border border-zinc-700 bg-zinc-950 p-1.5 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (activeScreenshotIdx + 1 >= dossier.screenshots.length) {
                                setActiveScreenshotIdx(0);
                              }
                              setReplaying((r) => !r);
                            }}
                            className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                          >
                            <Play className="h-3 w-3" />
                            <span>{replaying ? 'Pause Replay' : 'Replay Steps'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplaying(false);
                              setActiveScreenshotIdx((i) =>
                                Math.min(dossier.screenshots.length - 1, i + 1)
                              );
                            }}
                            disabled={activeScreenshotIdx >= dossier.screenshots.length - 1}
                            aria-label="Next screenshot"
                            className="rounded border border-zinc-700 bg-zinc-950 p-1.5 text-zinc-200 hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <span className="font-mono tabular-nums text-xs text-zinc-400">
                          Capture {activeScreenshotIdx + 1} / {dossier.screenshots.length}
                        </span>
                      </div>

                      {/* Thumbnail Filmstrip */}
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {dossier.screenshots.map((shot, i) => (
                          <button
                            key={`shot-${shot.step}-${i}`}
                            type="button"
                            onClick={() => {
                              setReplaying(false);
                              setActiveScreenshotIdx(i);
                            }}
                            className={`relative h-14 w-24 shrink-0 overflow-hidden rounded border transition-colors cursor-pointer ${
                              i === activeScreenshotIdx
                                ? 'border-purple-400'
                                : 'border-zinc-800 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={shot.dataUrl}
                              alt={`Step ${shot.step}`}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] font-mono text-white">
                              #{shot.step}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-400">
                      Text excerpts &amp; chatbot notes were gathered via fallback HTTP APIs; no interactive screenshot frame was produced for those targets.
                    </div>
                  )}

                  {/* Virtual Mouse & Keyboard Action Log */}
                  <div className="space-y-2 border-t border-zinc-800 pt-3">
                    <h3 className="text-xs font-semibold text-zinc-300">
                      Virtual Mouse &amp; Keyboard Action Timeline ({dossier.steps.length} actions)
                    </h3>
                    <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/70 rounded-lg border border-zinc-800 bg-zinc-950">
                      {dossier.steps.map((s) => (
                        <div
                          key={`step-${s.step}`}
                          className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono tabular-nums text-zinc-500 shrink-0">
                              #{String(s.step).padStart(2, '0')}
                            </span>
                            <span className="font-mono text-purple-300 shrink-0">{s.action}</span>
                            <span className="text-zinc-200 truncate">{s.detail}</span>
                          </div>
                          {typeof s.scrollY === 'number' && (
                            <span className="font-mono tabular-nums text-zinc-500 shrink-0">
                              y={s.scrollY}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* VIEW 2: SCRAPED WIKI TEXT & COMPETITOR BOT NOTES */}
          {rightTab === 'notes' && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-5">
              {!dossier ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  Run web research first to inspect extracted wiki articles and competitor chatbot notes.
                </div>
              ) : (
                <>
                  {/* Chatbot Notes from JanitorAI / Chub.ai / SpicyChat / Web */}
                  <div className="space-y-2.5">
                    <h3 className="text-sm font-semibold text-white">
                      Notes from Reference Chatbots ({dossier.chatbotNotes.length})
                    </h3>
                    {dossier.chatbotNotes.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No competitor bot URLs or matching public cards were scraped yet. Paste a JanitorAI, Chub.ai, or SpicyChat link to analyze its style.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                        {dossier.chatbotNotes.map((note, idx) => (
                          <div key={`bot-note-${idx}`} className="py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-white">
                                {note.name} · @{note.creatorName}
                              </span>
                              <span className="text-zinc-400">
                                {note.source.toUpperCase()} · {note.rating} · {note.greetingStyle}
                              </span>
                            </div>
                            {note.styleNotes.length > 0 && (
                              <p className="text-xs text-purple-200">
                                Craft Notes: {note.styleNotes.join(' ')}
                              </p>
                            )}
                            {note.rawExcerpt && (
                              <p className="text-xs text-zinc-400 whitespace-pre-line line-clamp-4">
                                {note.rawExcerpt}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Wiki & Website Text Excerpts */}
                  <div className="space-y-2.5 border-t border-zinc-800 pt-4">
                    <h3 className="text-sm font-semibold text-white">
                      Read Wiki &amp; Web Excerpts ({dossier.excerpts.length})
                    </h3>
                    {dossier.excerpts.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        No article paragraphs were extracted. Try adding a direct Fandom/Wiki URL or simpler query.
                      </p>
                    ) : (
                      <div className="divide-y divide-zinc-800 border-t border-zinc-800">
                        {dossier.excerpts.map((ex, idx) => (
                          <div key={`excerpt-${idx}`} className="py-3 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white">{ex.title}</span>
                              <a
                                href={ex.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-cyan-400 hover:underline shrink-0"
                              >
                                <span>Source</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                            <p className="text-xs text-zinc-300 leading-relaxed">{ex.summary}</p>
                            {ex.facts.length > 0 && (
                              <ul className="list-disc pl-4 text-xs text-zinc-400 space-y-0.5">
                                {ex.facts.slice(0, 4).map((f, fi) => (
                                  <li key={fi}>{f}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          )}

          {/* VIEW 3: GENERATED EDITABLE TAVERN V2 SHEET & STUDIO/PUBLISH EXPORT */}
          {rightTab === 'output' && (
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
              {!draft ? (
                <div className="py-16 text-center space-y-3">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <Bot className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No Character Sheet Generated Yet</h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Fill in your character prompt and click &ldquo;Generate Sheet Only&rdquo; or &ldquo;Research Web &amp; Generate All&rdquo; to auto-fill every Tavern V2 field cleanly.
                  </p>
                </div>
              ) : (
                <>
                  {/* Output Header + Export Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={draft.avatar || DEFAULT_FALLBACK_AVATAR}
                        alt={draft.name}
                        referrerPolicy="no-referrer"
                        className="h-12 w-12 rounded-lg object-cover border border-zinc-700 shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{draft.name}</h3>
                        <p className="text-xs text-zinc-400 truncate">
                          {draft.rating} · {draft.gender} ({draft.pronouns}) · {draft.modelUsed}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleGenerateCharacter(false)}
                        disabled={generating}
                        className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-800 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenInCharacterStudio(draft)}
                        data-testid="open-in-studio-btn"
                        className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-600/20 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-600/35 cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Open in Create Studio</span>
                      </button>

                      <button
                        type="button"
                        onClick={handlePublishDirectly}
                        disabled={publishing}
                        data-testid="publish-ai-maker-btn"
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
                      >
                        {publishing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Rocket className="h-3.5 w-3.5" />
                        )}
                        <span>{publishing ? 'Publishing...' : 'Publish Character'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Editable Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="draft-name" className="block text-xs font-medium text-zinc-300">
                        Character Name
                      </label>
                      <input
                        id="draft-name"
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="draft-tagline" className="block text-xs font-medium text-zinc-300">
                        Tagline
                      </label>
                      <input
                        id="draft-tagline"
                        type="text"
                        value={draft.tagline}
                        onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {[
                    { key: 'description', label: 'Description', target: paragraphCounts.description, rows: 5 },
                    { key: 'personality', label: 'Personality', target: paragraphCounts.personality, rows: 4 },
                    { key: 'scenario', label: 'Scenario', target: paragraphCounts.scenario, rows: 3 },
                    { key: 'greeting', label: 'First Greeting', target: paragraphCounts.greeting, rows: 4 },
                    { key: 'systemPrompt', label: 'System Prompt', target: paragraphCounts.systemPrompt, rows: 3 },
                    {
                      key: 'postHistoryInstructions',
                      label: 'Post-History Instructions',
                      target: paragraphCounts.postHistoryInstructions,
                      rows: 2,
                    },
                    {
                      key: 'exampleDialogues',
                      label: 'Example Dialogues',
                      target: paragraphCounts.exampleDialogues,
                      rows: 4,
                    },
                    { key: 'creatorNotes', label: 'Creator Notes', target: paragraphCounts.creatorNotes, rows: 2 },
                  ].map((field) => {
                    const val = String((draft as any)[field.key] || '');
                    const actualParas = splitParagraphs(val).length;
                    return (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor={`draft-${field.key}`} className="font-medium text-zinc-300">
                            {field.label}
                          </label>
                          <span className="font-mono tabular-nums text-zinc-400">
                            {actualParas} / {field.target} paragraphs
                          </span>
                        </div>
                        <textarea
                          id={`draft-${field.key}`}
                          data-testid={`draft-field-${field.key}`}
                          rows={field.rows}
                          value={val}
                          onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 leading-relaxed focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                    );
                  })}

                  {/* Alternate Greetings Preview/Edit */}
                  {draft.alternateGreetings.length > 0 && (
                    <div className="space-y-2 border-t border-zinc-800 pt-3">
                      <span className="block text-xs font-semibold text-zinc-300">
                        Alternate Greetings ({draft.alternateGreetings.length})
                      </span>
                      {draft.alternateGreetings.map((alt, i) => (
                        <textarea
                          key={`alt-${i}`}
                          rows={3}
                          value={alt}
                          onChange={(e) => {
                            const next = [...draft.alternateGreetings];
                            next[i] = e.target.value;
                            setDraft({ ...draft, alternateGreetings: next });
                          }}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200"
                        />
                      ))}
                    </div>
                  )}

                  {/* Tags & Lorebook Summary */}
                  <div className="border-t border-zinc-800 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400">
                    <span>Tags: {draft.tags.join(' · ')}</span>
                    <span className="font-mono tabular-nums">
                      Lorebook Entries: {draft.loreEntries.length}
                    </span>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
