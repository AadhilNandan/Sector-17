import React from 'react';
import { cn } from '../../utils/cn';
import type { AccentVariant } from '../../types';

export interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  variant?: AccentVariant;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit,
  variant = 'cyan',
  onChange,
  className,
  disabled = false,
}) => {
  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const barColor: Record<AccentVariant, string> = {
    cyan: 'bg-[#00f0ff] shadow-[0_0_8px_rgba(0,240,255,0.4)]',
    amber: 'bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.4)]',
    red: 'bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.4)]',
    graphite: 'bg-slate-400',
  };

  const textColor: Record<AccentVariant, string> = {
    cyan: 'text-[#00f0ff]',
    amber: 'text-[#f59e0b]',
    red: 'text-[#ef4444]',
    graphite: 'text-slate-300',
  };

  return (
    <div className={cn('flex flex-col gap-1.5 w-full select-none font-mono', className)}>
      <div className="flex items-center justify-between text-xs">
        {label && (
          <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
        )}
        <span className={cn('text-xs font-semibold', textColor[variant])}>
          {value}
          {unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{unit}</span>}
        </span>
      </div>

      <div className="relative flex items-center h-4">
        {/* Track */}
        <div className="w-full h-1.5 bg-[#0d1017] border border-[#1e2637] rounded-xs overflow-hidden">
          <div
            className={cn('h-full transition-all duration-75', barColor[variant])}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Real HTML range slider positioned invisibly over track */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
};

