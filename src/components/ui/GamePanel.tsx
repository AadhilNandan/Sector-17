import React from 'react';
import { cn } from '../../utils/cn';

export interface GamePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
  variant?: 'solid' | 'subtle' | 'highlight' | 'elevated';
}

export const GamePanel: React.FC<GamePanelProps> = ({
  children,
  className,
  title,
  subtitle,
  headerAction,
  variant = 'solid',
  ...props
}) => {
  const variantClass = {
    solid: 'aerospace-panel',
    subtle: 'bg-[#0D1116]/80 border border-[#2B3642]',
    highlight: 'aerospace-panel-highlight',
    elevated: 'aerospace-panel-raised',
  }[variant];

  return (
    <div className={cn('relative rounded-[2px] overflow-hidden', variantClass, className)} {...props}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2B3642] bg-[#0D1116]">
          <div>
            {title && (
              <h3 className="font-display text-xs md:text-sm font-semibold tracking-wider uppercase text-[#E6E2D6]">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-mono text-[10px] text-[#A9B0B5] mt-0.5 tracking-wide">{subtitle}</p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className="p-4">{children}</div>
    </div>
  );
};
