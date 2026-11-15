import React, { useState } from 'react';
import { Download, Smartphone, Share, MonitorDown, CheckCircle2, X, ExternalLink } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isEmbeddedFrame, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installAttemptMsg, setInstallAttemptMsg] = useState<string | null>(null);

  // Suppress install prompt when already running in standalone installed PWA mode
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallAttemptMsg('Chub.ai app installed!');
        return;
      }
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="pwa-install-btn"
        className="flex items-center gap-1.5 rounded-xl border border-orange-500/40 bg-gradient-to-r from-orange-600/20 to-amber-500/15 px-2.5 py-1 text-xs font-semibold text-orange-200 hover:border-orange-400 hover:bg-orange-600/30 transition-all cursor-pointer shrink-0 whitespace-nowrap"
        title="Download Chub.ai as an App"
      >
        <img
          src="/assets/aistudio/Screenshot_20261115_142839_Chrome_45bd0e27.jpg"
          alt="Chub.ai App Icon"
          className="h-4 w-4 rounded object-cover ring-1 ring-orange-400/50"
        />
        <Download className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        <span className="hidden xl:inline">Get App</span>
      </button>

      {showGuideModal && (
        <div
          data-testid="pwa-install-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-orange-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Chub.ai App Icon"
                  className="h-11 w-11 rounded-2xl object-cover ring-2 ring-orange-500/50 shadow-lg"
                />
                <div>
                  <h3 className="font-bold text-base text-white">Download Chub.ai App</h3>
                  <p className="text-[11px] text-zinc-400">
                    Install standalone on Desktop, Android, or iOS
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
                aria-label="Close Download App Modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {installAttemptMsg && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{installAttemptMsg}</span>
                </div>
              )}

              {isInstallable ? (
                <button
                  type="button"
                  onClick={install}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 py-3 font-bold text-white shadow-lg hover:from-orange-500 hover:to-amber-400 transition-all cursor-pointer"
                >
                  <MonitorDown className="h-4 w-4" />
                  <span>Install Chub.ai Now</span>
                </button>
              ) : isIOS ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Smartphone className="h-4 w-4" />
                    <span>Install on iPhone / iPad (Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 leading-relaxed">
                    <li>
                      Tap the <Share className="inline h-3.5 w-3.5 text-sky-400 mx-0.5" />{' '}
                      <strong>Share</strong> icon in Safari&apos;s toolbar.
                    </li>
                    <li>
                      Scroll down and tap <strong>Add to Home Screen</strong>.
                    </li>
                    <li>
                      Confirm <strong>Chub.ai</strong> to launch fullscreen with the orange speech-bubble icon.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-orange-300">
                    <MonitorDown className="h-4 w-4" />
                    <span>Install on Chrome, Edge, or Android</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 leading-relaxed">
                    {isEmbeddedFrame && (
                      <li>
                        Open the app in a standalone browser tab first (preview iframes block browser install prompts):
                      </li>
                    )}
                    <li>
                      Click the <strong>Install Chub.ai</strong> icon (<Download className="inline h-3 w-3 text-orange-400" />) in the address bar or browser menu (<strong>⋮ → Cast, save, and share → Install page as app</strong>).
                    </li>
                    <li>
                      On Android Chrome, tap <strong>⋮ → Add to Home screen → Install</strong>.
                    </li>
                  </ol>

                  {isEmbeddedFrame && typeof window !== 'undefined' && (
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-orange-500/50 bg-orange-600/20 px-4 py-2 font-bold text-orange-200 hover:bg-orange-600/35 transition-all"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Browser Tab to Install</span>
                    </a>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 px-3.5 py-2.5 text-[11px] text-zinc-400">
                <span>Web App Manifest + Offline Service Worker</span>
                <span className="font-semibold text-emerald-400">Ready</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      data-testid="offline-indicator"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-600/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md"
    >
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      <span>Offline Mode — Cached app shell active</span>
    </div>
  );
};
