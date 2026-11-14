export interface PageParamsResult {
  limit: number;
  offset: number;
}

export interface PaginatedSliceResult<T> {
  items: T[];
  hasMore: boolean;
  nextOffset: number;
}

export interface VirtualWindowResult {
  startIndex: number;
  endIndex: number;
  paddingBefore: number;
  paddingAfter: number;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function parsePageParams(options: {
  limitParam?: unknown;
  offsetParam?: unknown;
  defaultLimit?: number;
  maxLimit?: number;
}): PageParamsResult {
  const defaultLimit = options.defaultLimit ?? 24;
  const maxLimit = options.maxLimit ?? 200;

  const rawLimit =
    typeof options.limitParam === 'string'
      ? parseInt(options.limitParam, 10)
      : typeof options.limitParam === 'number'
      ? options.limitParam
      : defaultLimit;

  const rawOffset =
    typeof options.offsetParam === 'string'
      ? parseInt(options.offsetParam, 10)
      : typeof options.offsetParam === 'number'
      ? options.offsetParam
      : 0;

  const limit = Number.isFinite(rawLimit)
    ? clampNumber(Math.trunc(rawLimit), 1, maxLimit)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.trunc(rawOffset))
    : 0;

  return { limit, offset };
}

export function slicePaginatedRows<T>(
  rowsPlusOne: T[],
  limit: number,
  offset: number
): PaginatedSliceResult<T> {
  const safeLimit = Math.max(1, Math.trunc(limit));
  const safeOffset = Math.max(0, Math.trunc(offset));
  const hasMore = rowsPlusOne.length > safeLimit;
  const items = hasMore ? rowsPlusOne.slice(0, safeLimit) : rowsPlusOne;
  return {
    items,
    hasMore,
    nextOffset: safeOffset + items.length,
  };
}

export function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const size = Math.max(1, Math.trunc(chunkSize));
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function computeVirtualWindow(options: {
  totalCount: number;
  scrollOffset: number;
  viewportSize: number;
  itemSize: number;
  overscanCount?: number;
}): VirtualWindowResult {
  const totalCount = Math.max(0, Math.trunc(options.totalCount));
  const itemSize = Math.max(1, options.itemSize);
  const overscanCount = Math.max(0, Math.trunc(options.overscanCount ?? 4));
  const scrollOffset = Math.max(0, options.scrollOffset);
  const viewportSize = Math.max(0, options.viewportSize);

  if (totalCount === 0) {
    return { startIndex: 0, endIndex: -1, paddingBefore: 0, paddingAfter: 0 };
  }

  const rawStart = Math.floor(scrollOffset / itemSize);
  const rawEnd = Math.ceil((scrollOffset + viewportSize) / itemSize);

  const startIndex = clampNumber(rawStart - overscanCount, 0, totalCount - 1);
  const endIndex = clampNumber(rawEnd + overscanCount, startIndex, totalCount - 1);

  const paddingBefore = startIndex * itemSize;
  const remainingAfter = Math.max(0, totalCount - 1 - endIndex);
  const paddingAfter = remainingAfter * itemSize;

  return { startIndex, endIndex, paddingBefore, paddingAfter };
}

export function resolveSlotDimension(
  measuredPx: number | null | undefined,
  estimatedPx: number
): number {
  if (typeof measuredPx === 'number' && Number.isFinite(measuredPx) && measuredPx > 0) {
    return Math.round(measuredPx);
  }
  return Math.max(1, Math.round(estimatedPx));
}
