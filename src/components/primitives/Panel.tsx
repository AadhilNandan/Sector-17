import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AccentVariant } from '../../types';

export interface PanelProps {
  title: string;
  badge?: string;
  badgeVariant?: AccentVariant;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  badge,
  badgeVariant = 'cyan',
  children,
  collapsible = false,
  defaultExpanded = true,
  action,
  icon,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const badgeColors: Record<AccentVariant, string> = {
    cyan: 'bg-[rgba(0,240,255,0.1)] text-[#00f0ff] border-[rgba(0,240,255,0.3)]',
    amber: 'bg-[rgba(245,158,11,0.1)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]',
    red: 'bg-[rgba(239,68,68,0.1)] text-[#ef4444] border-[rgba(239,68,68,0.35)]',
    graphite: 'bg-[#181e2b] text-slate-400 border-[#1e2637]',
  };

  return (
    <div
      className={cn(
        'border border-[#1e2637] bg-[#0d1017]/85 backdrop-blur-md rounded-xs overflow-hidden',
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#12161f] border-b border-[#1e2637] select-none">
        <div className="flex items-center gap-2">
          {icon && <span className="text-[#00f0ff]">{icon}</span>}
          <span className="font-mono text-xs font-semibold tracking-wider uppercase text-slate-200">
            {title}
          </span>
          {badge && (
            <span
              className={cn(
                'px-1.5 py-0.2 text-[10px] font-mono uppercase tracking-wider border rounded-xs',
                badgeColors[badgeVariant]
              )}
            >
              {badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {action}
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-400 hover:text-white p-1 rounded-xs hover:bg-[#181e2b] transition-colors"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {(!collapsible || isExpanded) && <div className="p-3.5">{children}</div>}
    </div>
  );
};

