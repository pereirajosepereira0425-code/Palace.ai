import React, { useEffect, useRef, useState } from 'react';
import { resolveSlotDimension } from '../utils/viewportUnload.ts';

export interface ViewportSlotProps {
  children: React.ReactNode;
  estimatedHeight?: number;
  estimatedWidth?: number;
  axis?: 'vertical' | 'horizontal';
  rootRef?: React.RefObject<Element | null>;
  rootMargin?: string;
  forceMounted?: boolean;
  initialVisible?: boolean;
  className?: string;
  placeholderClassName?: string;
  testId?: string;
}

type VisibilityHandler = (isIntersecting: boolean) => void;

interface ObserverPoolBucket {
  observer: IntersectionObserver;
  listeners: Map<Element, VisibilityHandler>;
}

const windowObserverPool = new Map<string, ObserverPoolBucket>();
const elementObserverPools = new WeakMap<Element, Map<string, ObserverPoolBucket>>();

function getOrCreateBucket(
  root: Element | null,
  rootMargin: string
): { bucket: ObserverPoolBucket; deleteIfEmpty: () => void } {
  const poolMap = root
    ? elementObserverPools.get(root) ??
      (() => {
        const created = new Map<string, ObserverPoolBucket>();
        elementObserverPools.set(root, created);
        return created;
      })()
    : windowObserverPool;

  let bucket = poolMap.get(rootMargin);
  if (!bucket) {
    const listeners = new Map<Element, VisibilityHandler>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = listeners.get(entry.target);
          if (cb) cb(entry.isIntersecting);
        }
      },
      { root, rootMargin, threshold: 0 }
    );
    bucket = { observer, listeners };
    poolMap.set(rootMargin, bucket);
  }

  const targetBucket = bucket;
  return {
    bucket: targetBucket,
    deleteIfEmpty: () => {
      if (targetBucket.listeners.size === 0) {
        targetBucket.observer.disconnect();
        poolMap.delete(rootMargin);
      }
    },
  };
}

function observePooledIntersection(
  el: Element,
  root: Element | null,
  rootMargin: string,
  onVisibilityChange: VisibilityHandler
): () => void {
  const { bucket, deleteIfEmpty } = getOrCreateBucket(root, rootMargin);
  bucket.listeners.set(el, onVisibilityChange);
  bucket.observer.observe(el);

  return () => {
    bucket.listeners.delete(el);
    bucket.observer.unobserve(el);
    deleteIfEmpty();
  };
}

/**
 * Unmounts heavy child DOM nodes (images, textareas, SVG trees, nested cards)
 * once an item scrolls outside the viewport + tight overscan margin, sharing a
 * single pooled IntersectionObserver per scroll container and locking measured
 * pixel dimensions on exit so scrolling stays fluid with zero layout shift.
 */
export const ViewportSlot: React.FC<ViewportSlotProps> = ({
  children,
  estimatedHeight = 320,
  estimatedWidth,
  axis = 'vertical',
  rootRef,
  rootMargin,
  forceMounted = false,
  initialVisible = false,
  className = '',
  placeholderClassName = 'rounded-2xl border border-zinc-800/30 bg-zinc-900/20',
  testId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measuredHeightRef = useRef<number | null>(null);
  const measuredWidthRef = useRef<number | null>(null);

  const [inViewport, setInViewport] = useState<boolean>(initialVisible || forceMounted);
  const [lockedSize, setLockedSize] = useState<{ height: number; width?: number } | null>(null);

  const effectiveMargin =
    rootMargin ?? (axis === 'horizontal' ? '0px 100px' : '120px 0px');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }

    return observePooledIntersection(
      el,
      rootRef?.current ?? null,
      effectiveMargin,
      (isIntersecting) => {
        if (isIntersecting) {
          setLockedSize(null);
          setInViewport(true);
        } else {
          const rect = el.getBoundingClientRect();
          const nextHeight = resolveSlotDimension(
            rect.height || measuredHeightRef.current,
            estimatedHeight
          );
          const nextWidth =
            axis === 'horizontal'
              ? resolveSlotDimension(
                  rect.width || measuredWidthRef.current,
                  estimatedWidth ?? 360
                )
              : undefined;

          measuredHeightRef.current = nextHeight;
          if (nextWidth !== undefined) {
            measuredWidthRef.current = nextWidth;
          }

          setLockedSize({ height: nextHeight, width: nextWidth });
          setInViewport(false);
        }
      }
    );
  }, [rootRef, effectiveMargin, axis, estimatedHeight, estimatedWidth]);

  const isMounted = forceMounted || inViewport;

  const slotStyle: React.CSSProperties = !isMounted
    ? {
        height: lockedSize?.height ?? measuredHeightRef.current ?? estimatedHeight,
        ...(axis === 'horizontal'
          ? {
              width:
                lockedSize?.width ??
                measuredWidthRef.current ??
                estimatedWidth ??
                360,
              flexShrink: 0,
            }
          : {}),
        contain: 'strict',
      }
    : {
        minHeight: axis === 'vertical' ? measuredHeightRef.current ?? undefined : undefined,
        ...(axis === 'horizontal' ? { flexShrink: 0 } : {}),
        contain: 'layout style',
      };

  return (
    <div
      ref={containerRef}
      style={slotStyle}
      data-testid={testId}
      data-unloaded={isMounted ? 'false' : 'true'}
      className={className}
    >
      {isMounted ? (
        children
      ) : (
        <div
          aria-hidden="true"
          className={`h-full w-full ${placeholderClassName}`}
        />
      )}
    </div>
  );
};
