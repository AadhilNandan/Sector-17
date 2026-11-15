import React from 'react';
import { cn } from '../../utils/cn';
import type { MissionStatus } from '../../types';

export interface DataFieldProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  status?: MissionStatus;
  sublabel?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const DataField: React.FC<DataFieldProps> = ({
  label,
  value,
  unit,
  status = 'nominal',
  sublabel,
  className,
  size = 'md',
}) => {
  const valueColorMap: Record<MissionStatus, string> = {
    nominal: 'text-[#00f0ff]',
    standby: 'text-[#f59e0b]',
    warning: 'text-[#f59e0b]',
    critical: 'text-[#ef4444]',
    offline: 'text-slate-500',
  };

  const sizeMap = {
    sm: {
      value: 'text-base font-semibold',
      label: 'text-[10px]',
      unit: 'text-[10px]',
    },
    md: {
      value: 'text-xl font-bold',
      label: 'text-[11px]',
      unit: 'text-xs',
    },
    lg: {
      value: 'text-3xl font-extrabold',
      label: 'text-xs',
      unit: 'text-sm',
    },
  };

  return (
    <div className={cn('flex flex-col select-none', className)}>
      <span className={cn('font-mono uppercase tracking-widest text-slate-400', sizeMap[size].label)}>
        {label}
      </span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={cn('font-mono tracking-tight', sizeMap[size].value, valueColorMap[status])}>
          {value}
        </span>
        {unit && (
          <span className={cn('font-mono font-normal text-slate-400', sizeMap[size].unit)}>
            {unit}
          </span>
        )}
      </div>
      {sublabel && (
        <span className="font-mono text-[10px] text-slate-400 mt-0.5">{sublabel}</span>
      )}
    </div>
  );
};

