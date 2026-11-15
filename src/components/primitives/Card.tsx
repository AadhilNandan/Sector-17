import React from 'react';
import { cn } from '../../utils/cn';
import type { AccentVariant } from '../../types';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  accent?: AccentVariant;
  headerTitle?: string;
  headerSubtitle?: string;
  headerAction?: React.ReactNode;
  cornerAccents?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  accent = 'graphite',
  headerTitle,
  headerSubtitle,
  headerAction,
  cornerAccents = true,
  ...props
}) => {
  const accentBorder: Record<AccentVariant, string> = {
    cyan: 'border-[rgba(0,240,255,0.4)] shadow-[0_0_12px_rgba(0,240,255,0.08)]',
    amber: 'border-[rgba(245,158,11,0.4)] shadow-[0_0_12px_rgba(245,158,11,0.08)]',
    red: 'border-[rgba(239,68,68,0.45)] shadow-[0_0_12px_rgba(239,68,68,0.1)]',
    graphite: 'border-[#1e2637] hover:border-[#2f3c54]',
  };

  const cornerColor: Record<AccentVariant, string> = {
    cyan: 'border-[#00f0ff]',
    amber: 'border-[#f59e0b]',
    red: 'border-[#ef4444]',
    graphite: 'border-slate-600',
  };

  return (
    <div
      className={cn(
        'relative bg-[#12161f]/90 backdrop-blur-md border rounded-xs transition-colors duration-200',
        accentBorder[accent],
        className
      )}
      {...props}
    >
      {/* Sci-fi corner brackets */}
      {cornerAccents && (
        <>
          <span
            className={cn(
              'absolute -top-px -left-px w-2 h-2 border-t-2 border-l-2 pointer-events-none',
              cornerColor[accent]
            )}
          />
          <span
            className={cn(
              'absolute -top-px -right-px w-2 h-2 border-t-2 border-r-2 pointer-events-none',
              cornerColor[accent]
            )}
          />
          <span
            className={cn(
              'absolute -bottom-px -left-px w-2 h-2 border-b-2 border-l-2 pointer-events-none',
              cornerColor[accent]
            )}
          />
          <span
            className={cn(
              'absolute -bottom-px -right-px w-2 h-2 border-b-2 border-r-2 pointer-events-none',
              cornerColor[accent]
            )}
          />
        </>
      )}

      {/* Header section if provided */}
      {(headerTitle || headerAction) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2637] bg-[#0d1017]/70">
          <div>
            {headerTitle && (
              <h3 className="font-mono text-xs font-semibold tracking-wider uppercase text-slate-200">
                {headerTitle}
              </h3>
            )}
            {headerSubtitle && (
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">{headerSubtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      {/* Body */}
      <div className="p-4">{children}</div>
    </div>
  );
};

