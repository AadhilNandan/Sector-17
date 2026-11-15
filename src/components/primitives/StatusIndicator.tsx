import React from 'react';
import { cn } from '../../utils/cn';
import type { MissionStatus } from '../../types';

export interface StatusIndicatorProps {
  status: MissionStatus;
  label?: string;
  className?: string;
  showPing?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className,
  showPing = true,
}) => {
  const statusConfig: Record<MissionStatus, { color: string; pingColor: string; label: string; textClass: string }> = {
    nominal: {
      color: 'bg-[#00f0ff]',
      pingColor: 'bg-[#00f0ff]',
      label: 'NOMINAL',
      textClass: 'text-[#00f0ff]',
    },
    standby: {
      color: 'bg-[#f59e0b]',
      pingColor: 'bg-[#f59e0b]',
      label: 'STANDBY',
      textClass: 'text-[#f59e0b]',
    },
    warning: {
      color: 'bg-[#f59e0b]',
      pingColor: 'bg-[#f59e0b]',
      label: 'WARNING',
      textClass: 'text-[#f59e0b]',
    },
    critical: {
      color: 'bg-[#ef4444]',
      pingColor: 'bg-[#ef4444]',
      label: 'CRITICAL',
      textClass: 'text-[#ef4444]',
    },
    offline: {
      color: 'bg-slate-600',
      pingColor: 'bg-slate-600',
      label: 'OFFLINE',
      textClass: 'text-slate-500',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={cn('inline-flex items-center gap-2 select-none', className)}>
      <span className="relative flex h-2.5 w-2.5">
        {showPing && status !== 'offline' && (
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              config.pingColor
            )}
          />
        )}
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', config.color)} />
      </span>
      <span className={cn('font-mono text-xs tracking-wider uppercase', config.textClass)}>
        {label ?? config.label}
      </span>
    </div>
  );
};

