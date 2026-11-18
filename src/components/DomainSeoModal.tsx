import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe,
  Search,
  ExternalLink,
  Copy,
  Check,
  Download,
  X,
  CheckCircle2,
  Sparkles,
  FileCode2,
  Info,
} from 'lucide-react';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  SITE_DESCRIPTION,
  SITE_TITLE,
  buildFreeComPortOptions,
  sanitizeDomainSlug,
} from '../utils/seoUtils.ts';

interface DomainSeoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DomainSeoModal: React.FC<DomainSeoModalProps> = ({ isOpen, onClose }) => {
  const [brandSlug, setBrandSlug] = useState('palaceai');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentOrigin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return `https://${firebaseConfig.projectId}.firebaseapp.com`;
  }, []);

  const cleanSlug = useMemo(() => sanitizeDomainSlug(brandSlug), [brandSlug]);
  const portOptions = useMemo(
    () => buildFreeComPortOptions(cleanSlug, currentOrigin, firebaseConfig.projectId),
    [cleanSlug, currentOrigin]
  );

  const sitemapUrl = `${currentOrigin}/sitemap.xml`;
  const robotsUrl = `${currentOrigin}/robots.txt`;
  const kitDownloadUrl = `/api/seo/com-domain-kit.zip?slug=${encodeURIComponent(
    cleanSlug
  )}&origin=${encodeURIComponent(currentOrigin)}`;

  if (!isOpen || typeof document === 'undefined') return null;

  const handleCopy = (id: string, value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
  };

  return createPortal(
    <div
      data-testid="domain-seo-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="domain-seo-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-cyan-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500/30 via-purple-500/30 to-amber-500/20 border border-cyan-400/40">
              <Globe className="h-5 w-5 text-cyan-300" />
            </div>
            <div>
              <h2 id="domain-seo-title" className="text-base font-bold text-white flex items-center gap-2">
                <span>Free .com Domain Port &amp; Google Search SEO</span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                  $0 FOREVER
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Launch Palace.ai on a free .com host and index directly in Google Search
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close .com Domain & Google SEO Modal"
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Honest root .com explanation + custom slug builder */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5 text-amber-100">
              <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-amber-300">How free .com websites work:</strong> Standalone root domains like{' '}
                <code className="text-amber-200">PalaceAi.com</code> always require paid ICANN registrar fees (~$10–$15/yr), so nobody can register an unowned root <code className="text-amber-200">.com</code> for free. Instead,{' '}
                <strong>Firebase Hosting</strong> and <strong>Render</strong> let you publish Palace.ai on a real{' '}
                <strong className="text-emerald-300">.com</strong> subdomain (like{' '}
                <code className="text-cyan-300">https://{cleanSlug}.firebaseapp.com</code>) for{' '}
                <strong>$0 unlimited time</strong>!
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
              <label htmlFor="com-slug-input" className="text-[11px] font-semibold text-zinc-300 shrink-0">
                Your .com Subdomain Name:
              </label>
              <div className="flex flex-1 items-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5">
                <input
                  id="com-slug-input"
                  type="text"
                  value={brandSlug}
                  onChange={(e) => setBrandSlug(e.target.value)}
                  placeholder="palaceai"
                  className="w-full bg-transparent text-xs font-mono text-cyan-200 focus:outline-none"
                />
                <span className="text-[11px] font-mono text-zinc-400 shrink-0">.firebaseapp.com</span>
              </div>
            </div>
          </div>

          {/* .com Website Links & Free Porting Targets */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
              <span>Palace.ai Public Web &amp; Free .com Links</span>
            </h3>

            <div className="space-y-2">
              {portOptions.map((opt) => (
                <div
                  key={opt.id}
                  data-testid={`com-option-${opt.id}`}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-zinc-100">{opt.provider}</span>
                      <span className="rounded-md bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                        {opt.badge}
                      </span>
                      <span className="text-[10px] text-emerald-400 font-semibold">{opt.cost}</span>
                    </div>
                    <div className="font-mono text-[11px] text-cyan-300 truncate">{opt.url}</div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{opt.notes}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(opt.id, opt.url)}
                      className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 font-semibold text-zinc-200 hover:bg-zinc-700 cursor-pointer"
                      aria-label={`Copy ${opt.provider} URL`}
                    >
                      {copiedId === opt.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <a
                      href={opt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-xl border border-cyan-500/40 bg-cyan-600/20 px-2.5 py-1.5 font-bold text-cyan-200 hover:bg-cyan-600/35 transition-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* One-Click Free .com Hosting & SEO Kit Download */}
          <div className="rounded-2xl border border-purple-500/35 bg-purple-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-purple-200 flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4 text-purple-400" />
                <span>Free .com Hosting &amp; Google SEO Deploy Kit (.zip)</span>
              </div>
              <span className="font-mono text-[10px] text-purple-300">firebase.json + render.yaml</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Includes ready-to-deploy <code>firebase.json</code> &amp; <code>.firebaserc</code> (for{' '}
              <code>https://{cleanSlug}.firebaseapp.com</code>), <code>render.yaml</code> (for{' '}
              <code>https://{cleanSlug}.onrender.com</code>), plus live <code>robots.txt</code> and{' '}
              <code>sitemap.xml</code> with all Palace.ai characters.
            </p>
            <a
              href={kitDownloadUrl}
              download={`${cleanSlug}-free-com-seo-kit.zip`}
              data-testid="download-com-kit-link"
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-purple-600 to-fuchsia-600 px-4 py-2.5 font-bold text-white shadow-lg hover:from-cyan-500 hover:to-fuchsia-500 transition-all"
            >
              <Download className="h-4 w-4" />
              <span>Download Free .com Hosting &amp; SEO Kit (.zip)</span>
            </a>
          </div>

          {/* Google Search Readiness & Live Snippet Preview */}
          <div className="rounded-2xl border border-emerald-500/35 bg-zinc-900/80 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-emerald-300 flex items-center gap-1.5">
                <Search className="h-4 w-4" />
                <span>Google Search Engine Preview &amp; Sitemap</span>
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3" />
                <span>SEO &amp; JSON-LD Active</span>
              </span>
            </div>

            {/* Google Search Result Card Preview */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
              <div className="text-[11px] text-zinc-400 truncate">
                https://{cleanSlug}.firebaseapp.com &rsaquo; explore
              </div>
              <div className="text-sm font-semibold text-sky-400 leading-snug">{SITE_TITLE}</div>
              <p className="text-[11px] text-zinc-300 leading-relaxed">{SITE_DESCRIPTION}</p>
            </div>

            {/* Live Crawl Files & Search Console Submit */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <a
                href="/sitemap.xml"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="view-sitemap-link"
                className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200 hover:border-emerald-400/50 hover:text-emerald-200 transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                <span>Inspect /sitemap.xml</span>
              </a>

              <a
                href="/robots.txt"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="view-robots-link"
                className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200 hover:border-emerald-400/50 hover:text-emerald-200 transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                <span>Inspect /robots.txt</span>
              </a>

              <button
                type="button"
                onClick={() => handleCopy('sitemap', sitemapUrl)}
                className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-semibold text-zinc-200 hover:bg-zinc-700 cursor-pointer"
              >
                {copiedId === 'sitemap' ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copied Sitemap URL</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Sitemap URL</span>
                  </>
                )}
              </button>

              <a
                href="https://search.google.com/search-console/welcome"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-500 transition-all ml-auto"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Submit to Google Search Console</span>
              </a>
            </div>
            <p className="text-[10px] text-zinc-500">
              Robots policy: <code className="text-zinc-400">{robotsUrl}</code> &bull; Dynamic character sitemap:{' '}
              <code className="text-zinc-400">{sitemapUrl}</code>
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
