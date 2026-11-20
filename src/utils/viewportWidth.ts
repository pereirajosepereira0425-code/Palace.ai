export const VIEWPORT_WIDTH_STORAGE_KEY = 'palace_custom_viewport_width';
export const MIN_CUSTOM_VIEWPORT_WIDTH = 240;

export interface ViewportScaleMetrics {
  customWidth: number | null;
  nativeWidth: number;
  nativeHeight: number;
  scale: number;
  effectiveHeight: number;
  isActive: boolean;
}

/**
 * Parses a user-entered custom website width (Android "Smallest width / dp" style).
 * Returns null for empty / 0 / "auto" (native responsive layout), or a positive integer >= 240
 * with no upper limit so users can make the virtual width as high as they want.
 */
export function parseCustomViewportWidth(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toLowerCase();
  if (!str || str === 'auto' || str === '0' || str === 'native' || str === 'reset') {
    return null;
  }
  const parsed = Math.round(Number(str.replace(/[^0-9.]/g, '')));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(MIN_CUSTOM_VIEWPORT_WIDTH, parsed);
}

/**
 * Computes CSS zoom/scale metrics so the entire layout renders at `customWidth` px
 * and scales cleanly into the device's physical viewport width.
 */
export function computeViewportScaleMetrics(params: {
  customWidth: number | null;
  nativeWidth: number;
  nativeHeight: number;
}): ViewportScaleMetrics {
  const nativeWidth = Math.max(240, Math.round(params.nativeWidth || 1024));
  const nativeHeight = Math.max(240, Math.round(params.nativeHeight || 768));
  const cleanCustom = parseCustomViewportWidth(params.customWidth);

  if (!cleanCustom) {
    return {
      customWidth: null,
      nativeWidth,
      nativeHeight,
      scale: 1,
      effectiveHeight: nativeHeight,
      isActive: false,
    };
  }

  // Clamp scale factor to keep DOM layout numerically stable even at extreme widths (e.g. 10,000px+)
  const rawScale = nativeWidth / cleanCustom;
  const scale = Math.max(0.05, Math.min(4, Number(rawScale.toFixed(4))));
  const effectiveHeight = Math.ceil(nativeHeight / scale);

  return {
    customWidth: cleanCustom,
    nativeWidth,
    nativeHeight,
    scale,
    effectiveHeight,
    isActive: true,
  };
}

export function buildViewportMetaContent(customWidth: number | null): string {
  if (!customWidth) {
    return 'width=device-width, initial-scale=1.0';
  }
  return `width=${customWidth}, initial-scale=1.0`;
}

export function loadSavedViewportWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseCustomViewportWidth(localStorage.getItem(VIEWPORT_WIDTH_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveViewportWidth(width: number | null): number | null {
  const normalized = parseCustomViewportWidth(width);
  if (typeof window !== 'undefined') {
    try {
      if (normalized === null) {
        localStorage.removeItem(VIEWPORT_WIDTH_STORAGE_KEY);
      } else {
        localStorage.setItem(VIEWPORT_WIDTH_STORAGE_KEY, String(normalized));
      }
      window.dispatchEvent(
        new CustomEvent('palace-viewport-width-updated', { detail: { width: normalized } })
      );
    } catch {
      // ignore storage errors
    }
  }
  return normalized;
}
