import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  variant?: 'cyan' | 'amber';
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  className,
  variant = 'cyan',
}) => {
  const activeClass =
    variant === 'cyan'
      ? 'text-[#00f0ff] border-b-2 border-[#00f0ff] bg-[rgba(0,240,255,0.06)]'
      : 'text-[#f59e0b] border-b-2 border-[#f59e0b] bg-[rgba(245,158,11,0.06)]';

  return (
    <div className={cn('flex items-center border-b border-[#1e2637] gap-1 select-none', className)}>
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3.5 py-2 font-mono text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer rounded-t-xs',
              isActive
                ? activeClass
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#181e2b]/50 border-b-2 border-transparent'
            )}
          >
            {tab.icon && <span className="inline-flex shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.2 text-[10px] rounded-xs font-mono',
                  isActive
                    ? 'bg-[#00f0ff]/20 text-[#00f0ff]'
                    : 'bg-[#181e2b] text-slate-400'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

