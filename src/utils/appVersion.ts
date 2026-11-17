declare const __PALACE_APP_VERSION__: string | undefined;

export const CLIENT_APP_VERSION: string =
  typeof __PALACE_APP_VERSION__ !== 'undefined' && __PALACE_APP_VERSION__
    ? __PALACE_APP_VERSION__
    : '2.5.0';

export interface AppUpdateState {
  currentVersion: string;
  serverVersion: string;
  needRefresh: boolean;
  offlineReady: boolean;
  checking: boolean;
  lastCheckedAt: string | null;
  statusMessage: string | null;
}

let state: AppUpdateState = {
  currentVersion: CLIENT_APP_VERSION,
  serverVersion: CLIENT_APP_VERSION,
  needRefresh: false,
  offlineReady: false,
  checking: false,
  lastCheckedAt: null,
  statusMessage: null,
};

let swRegistration: ServiceWorkerRegistration | null = null;
let updateSWCallback: ((reloadPage?: boolean) => Promise<void>) | null = null;
const listeners = new Set<(next: AppUpdateState) => void>();

function notify() {
  const snapshot = { ...state };
  listeners.forEach((fn) => fn(snapshot));
}

export function subscribeAppUpdate(fn: (next: AppUpdateState) => void): () => void {
  listeners.add(fn);
  fn({ ...state });
  return () => {
    listeners.delete(fn);
  };
}

export function bindServiceWorkerUpdater(params: {
  registration?: ServiceWorkerRegistration | null;
  updateSW?: (reloadPage?: boolean) => Promise<void>;
  needRefresh?: boolean;
  offlineReady?: boolean;
}) {
  if (params.registration) swRegistration = params.registration;
  if (params.updateSW) updateSWCallback = params.updateSW;
  if (typeof params.needRefresh === 'boolean') {
    state = {
      ...state,
      needRefresh: params.needRefresh,
      ...(params.needRefresh
        ? { statusMessage: 'A new Palace.ai update is ready to install!' }
        : {}),
    };
  }
  if (typeof params.offlineReady === 'boolean') {
    state = { ...state, offlineReady: params.offlineReady };
  }
  notify();
}

export function compareSemverStrings(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da > db ? 1 : -1;
  }
  return 0;
}

export async function checkForPalaceUpdates(): Promise<AppUpdateState> {
  state = { ...state, checking: true, statusMessage: 'Checking Palace.ai servers for updates...' };
  notify();

  let serverVersion = state.serverVersion;
  let serverHasNewer = false;

  try {
    const res = await fetch('/api/app/version', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.version === 'string' && data.version.trim()) {
        serverVersion = data.version.trim();
        serverHasNewer = compareSemverStrings(serverVersion, state.currentVersion) > 0;
      }
    }
  } catch {
    // Offline or server unreachable; still check SW registration if present
  }

  let swWaitingFound = state.needRefresh;
  try {
    const reg =
      swRegistration ||
      (typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistration()
        : null);
    if (reg) {
      swRegistration = reg;
      await reg.update();
      if (reg.waiting || reg.installing) {
        swWaitingFound = true;
      }
    }
  } catch {
    // ignore SW update check error in dev/iframe mode
  }

  const hasUpdate = swWaitingFound || serverHasNewer;
  state = {
    ...state,
    serverVersion,
    needRefresh: hasUpdate,
    checking: false,
    lastCheckedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    statusMessage: hasUpdate
      ? `Update available (v${serverVersion})! Tap "Update App Now" to apply.`
      : `Palace.ai v${state.currentVersion} is completely up to date!`,
  };
  notify();
  return { ...state };
}

export async function applyPalaceUpdate(): Promise<void> {
  state = { ...state, checking: true, statusMessage: 'Installing latest Palace.ai update...' };
  notify();

  try {
    if (updateSWCallback) {
      await updateSWCallback(true);
    }
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore cache clear error
  }

  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}
