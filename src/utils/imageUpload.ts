export interface ProcessedImageResult {
  dataUrl: string;
  width?: number;
  height?: number;
}

const MAX_DIRECT_DATA_URL_BYTES = 1_500_000; // ~1.5 MB base64 reads cleanly & fits fast in Postgres/JSON
const MAX_CANVAS_DIMENSION = 1600;

/**
 * Reads any user-selected image file into a Data URL.
 * Animated GIFs and SVGs or compact images (<1.5MB) are kept completely lossless.
 * Oversized static raster photos (e.g. 5MB+ 4K camera PNG/JPGs) are safely
 * downscaled to <=1600px WebP/JPEG on an offscreen canvas so uploads never hit
 * server request limits or slow down chat rendering.
 */
export async function readImageFileAsDataUrl(file: File): Promise<ProcessedImageResult> {
  if (!file) {
    throw new Error('No file was selected.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length > 0) {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the image file.'));
    reader.readAsDataURL(file);
  });

  const mime = (file.type || '').toLowerCase();
  const isSvgOrGif = mime.includes('svg') || mime.includes('gif');

  if (typeof Image === 'undefined' || isSvgOrGif) {
    return { dataUrl: rawDataUrl };
  }

  return await new Promise<ProcessedImageResult>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || undefined;
      const h = img.naturalHeight || undefined;

      if (
        rawDataUrl.length <= MAX_DIRECT_DATA_URL_BYTES &&
        (!w || w <= MAX_CANVAS_DIMENSION) &&
        (!h || h <= MAX_CANVAS_DIMENSION)
      ) {
        resolve({ dataUrl: rawDataUrl, width: w, height: h });
        return;
      }

      if (!w || !h || typeof document === 'undefined') {
        resolve({ dataUrl: rawDataUrl, width: w, height: h });
        return;
      }

      try {
        const scale = Math.min(1, MAX_CANVAS_DIMENSION / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: rawDataUrl, width: w, height: h });
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressed = canvas.toDataURL('image/webp', 0.9);
        if (compressed && compressed.startsWith('data:image/') && compressed.length < rawDataUrl.length) {
          resolve({ dataUrl: compressed, width: targetW, height: targetH });
          return;
        }
      } catch {
        // Fallback to rawDataUrl if canvas export isn't available
      }

      resolve({ dataUrl: rawDataUrl, width: w, height: h });
    };
    img.onerror = () => {
      // Allow non-standard or custom files through with rawDataUrl if user picked custom asset
      resolve({ dataUrl: rawDataUrl });
    };
    img.src = rawDataUrl;
  });
}
