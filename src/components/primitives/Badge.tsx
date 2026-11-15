import React from 'react';
import { cn } from '../../utils/cn';
import type { AccentVariant } from '../../types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: AccentVariant;
  dot?: boolean;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'cyan',
  dot = true,
  pulse = false,
  ...props
}) => {
  const variantStyles: Record<AccentVariant, { badge: string; dot: string }> = {
    cyan: {
      badge: 'bg-[rgba(0,240,255,0.08)] text-[#00f0ff] border-[rgba(0,240,255,0.3)]',
      dot: 'bg-[#00f0ff]',
    },
    amber: {
      badge: 'bg-[rgba(245,158,11,0.08)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
      dot: 'bg-[#f59e0b]',
    },
    red: {
      badge: 'bg-[rgba(239,68,68,0.1)] text-[#ef4444] border-[rgba(239,68,68,0.35)]',
      dot: 'bg-[#ef4444]',
    },
    graphite: {
      badge: 'bg-[#181e2b] text-slate-400 border-[#1e2637]',
      dot: 'bg-slate-500',
    },
  };

  const style = variantStyles[variant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono tracking-wider uppercase border rounded-xs select-none',
        style.badge,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            style.dot,
            pulse && 'animate-ping'
          )}
        />
      )}
      <span>{children}</span>
    </span>
  );
};

