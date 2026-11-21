import React, { useMemo } from 'react';
import { formatRoleplaySegments, type RoleplaySegment } from '../utils/characterUtils.ts';

interface RichMessageContentProps {
  content: string;
  fallbackText?: string;
  className?: string;
  textClassName?: string;
  actionClassName?: string;
  imageClassName?: string;
}

export const RichMessageContent: React.FC<RichMessageContentProps> = ({
  content,
  fallbackText,
  className = 'space-y-2',
  textClassName = 'font-sans leading-relaxed text-zinc-100 whitespace-pre-wrap break-words',
  actionClassName = 'font-serif italic text-purple-300/95 leading-relaxed whitespace-pre-wrap break-words',
  imageClassName = 'max-h-96 max-w-full rounded-2xl border border-zinc-700/70 bg-zinc-950/60 object-contain shadow-md',
}) => {
  const segments: RoleplaySegment[] = useMemo(
    () => formatRoleplaySegments(content || ''),
    [content]
  );

  const hasRenderable = segments.some(
    (s) => s.type === 'image' || s.text.trim().length > 0
  );

  if (!hasRenderable) {
    return (
      <p className={textClassName}>
        {fallbackText ?? content}
      </p>
    );
  }

  return (
    <div className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === 'image' && seg.src) {
          const imgEl = (
            <img
              src={seg.src}
              alt={seg.alt || 'Embedded Image'}
              referrerPolicy="no-referrer"
              loading="lazy"
              className={imageClassName}
            />
          );
          return (
            <div key={idx} className="my-2">
              {seg.href ? (
                <a
                  href={seg.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block max-w-full"
                >
                  {imgEl}
                </a>
              ) : (
                imgEl
              )}
              {seg.alt &&
                seg.alt !== 'Embedded Image' &&
                !seg.alt.startsWith('http') &&
                !seg.alt.startsWith('data:image') && (
                  <p className="mt-1 text-[11px] text-zinc-400 italic">{seg.alt}</p>
                )}
            </div>
          );
        }

        if (seg.type === 'action') {
          return (
            <p key={idx} className={actionClassName}>
              *{seg.text}*
            </p>
          );
        }

        if (!seg.text.trim() && seg.text.includes('\n')) {
          return null;
        }

        return (
          <p key={idx} className={textClassName}>
            {seg.text}
          </p>
        );
      })}
    </div>
  );
};
