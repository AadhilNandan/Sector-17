import React from 'react';
import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'critical' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  glowing?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  glowing = false,
  disabled,
  ...props
}) => {
  const baseClasses =
    'relative inline-flex items-center justify-center font-mono font-medium tracking-wider uppercase transition-all duration-150 select-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'text-xs px-2.5 py-1 gap-1.5 rounded-sm',
    md: 'text-xs px-3.5 py-1.5 gap-2 rounded-sm',
    lg: 'text-sm px-5 py-2.5 gap-2.5 rounded-sm',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    // Cyan primary accent
    primary: cn(
      'bg-[rgba(0,240,255,0.12)] text-[#00f0ff] border border-[rgba(0,240,255,0.45)] hover:bg-[rgba(0,240,255,0.22)] active:bg-[rgba(0,240,255,0.3)]',
      glowing && 'sci-fi-glow-cyan'
    ),
    // Amber secondary accent
    secondary: cn(
      'bg-[rgba(245,158,11,0.12)] text-[#f59e0b] border border-[rgba(245,158,11,0.45)] hover:bg-[rgba(245,158,11,0.22)] active:bg-[rgba(245,158,11,0.3)]',
      glowing && 'sci-fi-glow-amber'
    ),
    // Red critical status
    critical: cn(
      'bg-[rgba(239,68,68,0.14)] text-[#ef4444] border border-[rgba(239,68,68,0.5)] hover:bg-[rgba(239,68,68,0.25)] active:bg-[rgba(239,68,68,0.35)]',
      glowing && 'sci-fi-glow-red'
    ),
    // Graphite surfaces
    outline:
      'bg-[#12161f] text-slate-300 border border-[#1e2637] hover:border-[#2f3c54] hover:text-white hover:bg-[#181e2b]',
    ghost:
      'bg-transparent text-slate-400 hover:text-slate-100 hover:bg-[#181e2b] border border-transparent',
  };

  return (
    <button
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      disabled={disabled}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>}
      <span>{children}</span>
      {icon && iconPosition === 'right' && <span className="inline-flex shrink-0">{icon}</span>}
    </button>
  );
};

