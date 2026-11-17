import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Share,
  MonitorDown,
  CheckCircle2,
  X,
  ExternalLink,
  RefreshCw,
  Package,
  Sparkles,
} from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall.ts';

export const PWAInstallButton: React.FC = () => {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isEmbeddedFrame,
    install,
    appUpdate,
    checkForUpdates,
    applyUpdate,
  } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installAttemptMsg, setInstallAttemptMsg] = useState<string | null>(null);

  const handleClick = async () => {
    if (!isInstalled && isInstallable) {
      const accepted = await install();
      if (accepted) {
        setInstallAttemptMsg('Palace.ai app installed!');
      }
    }
    setShowGuideModal(true);
    checkForUpdates().catch(() => {});
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="pwa-install-btn"
        className={`relative flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
          appUpdate.needRefresh
            ? 'border-emerald-400/60 bg-gradient-to-r from-emerald-600/25 to-teal-500/20 text-emerald-200 hover:border-emerald-300'
            : 'border-orange-500/40 bg-gradient-to-r from-orange-600/20 to-amber-500/15 text-orange-200 hover:border-orange-400 hover:bg-orange-600/30'
        }`}
        title={`Download & Update Palace.ai App (v${appUpdate.currentVersion})`}
      >
        <img
          src="/assets/aistudio/Screenshot_20261115_142839_Chrome_45bd0e27.jpg"
          alt="Palace.ai App Icon"
          className="h-4 w-4 rounded object-cover ring-1 ring-orange-400/50"
        />
        {appUpdate.needRefresh ? (
          <RefreshCw className="h-3.5 w-3.5 text-emerald-400 animate-spin shrink-0" />
        ) : (
          <Download className="h-3.5 w-3.5 text-orange-400 shrink-0" />
        )}
        <span className="hidden xl:inline">
          {appUpdate.needRefresh
            ? 'Update Ready'
            : isInstalled
              ? `App v${appUpdate.currentVersion}`
              : 'Get App'}
        </span>
        {appUpdate.needRefresh && (
          <span
            className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"
            aria-hidden="true"
          />
        )}
      </button>

      {showGuideModal && typeof document !== 'undefined' && createPortal(
        <div
          data-testid="pwa-install-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-orange-500/40 bg-zinc-950 text-zinc-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-900/80">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Palace.ai App Icon"
                  className="h-11 w-11 rounded-2xl object-cover ring-2 ring-orange-500/50 shadow-lg"
                />
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <span>Download &amp; Update Palace.ai</span>
                    <span className="rounded-md bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-mono text-orange-300 border border-orange-500/30">
                      v{appUpdate.currentVersion}
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Android WebAPK, Desktop App, APK Kit &amp; Live Updater
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

              {/* Live In-App Updater Card */}
              <div
                data-testid="palace-updater-card"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-emerald-200 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>Palace.ai App Updater</span>
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400">
                    Installed: v{appUpdate.currentVersion} &bull; Server: v{appUpdate.serverVersion}
                  </span>
                </div>

                {appUpdate.statusMessage && (
                  <p className="text-[11px] text-emerald-100/90 leading-relaxed">
                    {appUpdate.statusMessage}
                    {appUpdate.lastCheckedAt ? ` (Checked ${appUpdate.lastCheckedAt})` : ''}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => checkForUpdates()}
                    disabled={appUpdate.checking}
                    data-testid="check-updates-btn"
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-zinc-900 px-3 py-2 font-bold text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${appUpdate.checking ? 'animate-spin' : ''}`}
                    />
                    <span>{appUpdate.checking ? 'Checking...' : 'Check for Updates'}</span>
                  </button>

                  {appUpdate.needRefresh ? (
                    <button
                      type="button"
                      onClick={() => applyUpdate()}
                      data-testid="apply-update-btn"
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2 font-bold text-white shadow-md hover:from-emerald-500 hover:to-teal-400 transition-all cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Update App Now &amp; Reload</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => applyUpdate()}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Refresh App Cache</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 1-Tap WebAPK / Standalone Install */}
              {isInstalled ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-zinc-900/70 p-3.5 text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    Palace.ai is running in standalone installed mode. Use the Updater above anytime to pull new releases!
                  </span>
                </div>
              ) : isInstallable ? (
                <button
                  type="button"
                  onClick={install}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 py-3 font-bold text-white shadow-lg hover:from-orange-500 hover:to-amber-400 transition-all cursor-pointer"
                >
                  <MonitorDown className="h-4 w-4" />
                  <span>Install Palace.ai App Now</span>
                </button>
              ) : isIOS ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Smartphone className="h-4 w-4" />
                    <span>Install Palace.ai on iPhone / iPad (Safari)</span>
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
                      Confirm <strong>Palace.ai</strong> to launch fullscreen with your orange logo icon.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 font-bold text-orange-300">
                    <Smartphone className="h-4 w-4" />
                    <span>Install on Android (1-Tap WebAPK) &amp; Desktop</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1.5 text-zinc-300 leading-relaxed">
                    {isEmbeddedFrame && (
                      <li>
                        Open Palace.ai in a full browser tab first (embedded preview frames hide Chrome&apos;s install prompt):
                      </li>
                    )}
                    <li>
                      <strong>On Android Chrome:</strong> Tap <strong>⋮ → Add to Home screen → Install</strong>. Chrome generates a native Android WebAPK package with your Palace.ai app icon in your app drawer!
                    </li>
                    <li>
                      <strong>On Desktop Chrome / Edge:</strong> Click the <strong>Install Palace.ai</strong> (<Download className="inline h-3 w-3 text-orange-400" />) icon in the address bar.
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

              {/* Downloadable Android APK Builder Kit (.zip) */}
              <div
                data-testid="android-apk-kit-card"
                className="rounded-2xl border border-orange-500/30 bg-orange-950/15 p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-orange-200">
                    <Package className="h-4 w-4 text-orange-400" />
                    <span>Android APK Builder Kit (.zip)</span>
                  </div>
                  <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-300 border border-orange-500/30">
                    TWA / Bubblewrap
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Android <code className="text-orange-300">.apk</code> binaries require Java JDK &amp; the Android SDK compiler (not installed inside browser sandboxes). Download this ready-to-compile TWA APK kit with <code className="text-zinc-300">twa-manifest.json</code>, <code className="text-zinc-300">AndroidManifest.xml</code>, your Palace.ai icons, and <code className="text-zinc-300">build-apk.sh</code>, or use Chrome&apos;s 1-tap Android WebAPK install above!
                </p>
                <a
                  href="/api/app/android-apk-kit.zip"
                  download="palace-ai-android-apk-kit.zip"
                  data-testid="download-apk-kit-link"
                  className="flex items-center justify-center gap-2 rounded-xl border border-orange-400/50 bg-gradient-to-r from-orange-600/30 to-amber-600/25 px-4 py-2.5 font-bold text-orange-100 hover:from-orange-600/45 hover:to-amber-600/40 transition-all"
                >
                  <Download className="h-4 w-4 text-orange-300" />
                  <span>Download Android APK Builder Kit (.zip)</span>
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
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
