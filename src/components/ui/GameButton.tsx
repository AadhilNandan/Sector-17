import React from 'react';
import { cn } from '../../utils/cn';
import { sounds } from '../../utils/soundEffects';

export type GameButtonVariant = 'amber' | 'glass' | 'cyan' | 'ghost' | 'danger';
export type GameButtonSize = 'sm' | 'md' | 'lg';

export interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GameButtonVariant;
  size?: GameButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  suppressSound?: boolean;
}

export const GameButton: React.FC<GameButtonProps> = ({
  children,
  className,
  variant = 'glass',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  suppressSound = false,
  disabled,
  onClick,
  onMouseEnter,
  ...props
}) => {
  const sizeClasses: Record<GameButtonSize, string> = {
    sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-[2px]',
    md: 'text-xs px-4 py-2 gap-2 rounded-[2px]',
    lg: 'text-sm px-6 py-2.5 gap-2.5 rounded-[2px] font-semibold',
  };

  const variantClasses: Record<GameButtonVariant, string> = {
    amber: 'btn-amber-gold text-[#07090C] font-bold',
    glass: 'btn-glass-pill',
    cyan: 'bg-[#151B22] border border-[#7FB7D4] text-[#7FB7D4] hover:bg-[#1C242D] hover:text-white transition-all font-medium uppercase tracking-wider rounded-[2px]',
    danger:
      'bg-[#151B22] border border-[#D8503F] text-[#D8503F] hover:bg-[#D8503F]/20 hover:text-red-200 transition-all font-medium uppercase tracking-wider rounded-[2px]',
    ghost:
      'bg-transparent text-[#A9B0B5] hover:text-[#E6E2D6] hover:bg-[#1C242D] border border-transparent transition-all uppercase tracking-wider rounded-[2px]',
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressSound && !disabled) {
      if (variant === 'amber') {
        sounds.playClick(1400);
      } else {
        sounds.playClick(1100);
      }
    }
    if (onClick) onClick(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!suppressSound && !disabled) {
      sounds.playHover();
    }
    if (onMouseEnter) onMouseEnter(e);
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#7FB7D4] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150',
        sizeClasses[size],
        variantClasses[variant],
        fullWidth && 'w-full',
        className
      )}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {icon && iconPosition === 'left' && <span className="inline-flex shrink-0">{icon}</span>}
      <span className="truncate">{children}</span>
      {icon && iconPosition === 'right' && <span className="inline-flex shrink-0">{icon}</span>}
    </button>
  );
};
