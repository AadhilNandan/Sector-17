import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  prefixElement?: React.ReactNode;
  suffixElement?: React.ReactNode;
  size?: 'sm' | 'md';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  prefixElement,
  suffixElement,
  size = 'md',
  className,
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5',
    md: 'text-xs px-3 py-2',
  };

  return (
    <div className="flex flex-col gap-1 w-full select-none">
      {label && (
        <label className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {label}
        </label>
      )}

      <div
        className={cn(
          'relative flex items-center bg-[#0d1017] border rounded-xs transition-all duration-150',
          error
            ? 'border-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.2)]'
            : 'border-[#1e2637] focus-within:border-[#00f0ff] focus-within:shadow-[0_0_10px_rgba(0,240,255,0.15)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {prefixElement && (
          <span className="pl-2.5 text-slate-400 inline-flex items-center shrink-0">
            {prefixElement}
          </span>
        )}

        <input
          className={cn(
            'w-full bg-transparent font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:cursor-not-allowed',
            sizeClasses[size],
            prefixElement ? 'pl-2' : '',
            suffixElement ? 'pr-2' : '',
            className
          )}
          disabled={disabled}
          {...props}
        />

        {suffixElement && (
          <span className="pr-2.5 text-slate-400 inline-flex items-center shrink-0 font-mono text-[10px]">
            {suffixElement}
          </span>
        )}
      </div>

      {error && (
        <span className="font-mono text-[10px] text-[#ef4444] tracking-wide mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
};
