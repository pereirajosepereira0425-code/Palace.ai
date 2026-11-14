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

/**
 * Unmounts heavy child DOM nodes (images, blur layers, textareas, SVG trees)
 * once an item scrolls outside the viewport + overscan margin, while locking
 * its measured pixel dimensions so scrolling stays fluid without layout shifts.
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
    rootMargin ?? (axis === 'horizontal' ? '0px 320px' : '550px 0px');

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          setLockedSize(null);
          setInViewport(true);
        } else {
          // Lock the latest measured pixel footprint before unmounting children
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
      },
      {
        root: rootRef?.current ?? null,
        rootMargin: effectiveMargin,
        threshold: 0,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootRef, effectiveMargin, axis, estimatedHeight, estimatedWidth]);

  const isMounted = forceMounted || inViewport;

  useEffect(() => {
    if (!isMounted) return;
    const el = containerRef.current;
    if (!el) return;

    const recordSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.height > 0) measuredHeightRef.current = Math.round(rect.height);
      if (rect.width > 0) measuredWidthRef.current = Math.round(rect.width);
    };

    recordSize();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recordSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMounted]);

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
