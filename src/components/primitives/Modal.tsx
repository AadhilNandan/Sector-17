import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { AccentVariant } from '../../types';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: AccentVariant;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  accent = 'cyan',
  children,
  footer,
  maxWidth = 'md',
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthMap = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  const accentBorder: Record<AccentVariant, string> = {
    cyan: 'border-[rgba(0,240,255,0.4)] shadow-[0_0_25px_rgba(0,240,255,0.15)]',
    amber: 'border-[rgba(245,158,11,0.4)] shadow-[0_0_25px_rgba(245,158,11,0.15)]',
    red: 'border-[rgba(239,68,68,0.5)] shadow-[0_0_25px_rgba(239,68,68,0.2)]',
    graphite: 'border-[#1e2637] shadow-[0_0_20px_rgba(0,0,0,0.8)]',
  };

  const cornerColor: Record<AccentVariant, string> = {
    cyan: 'border-[#00f0ff]',
    amber: 'border-[#f59e0b]',
    red: 'border-[#ef4444]',
    graphite: 'border-slate-500',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#05070a]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={cn(
          'relative w-full bg-[#12161f] border rounded-xs z-10 overflow-hidden font-sans',
          accentBorder[accent],
          maxWidthMap[maxWidth]
        )}
      >
        {/* Sci-fi corner brackets */}
        <span className={cn('absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2 pointer-events-none', cornerColor[accent])} />
        <span className={cn('absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2 pointer-events-none', cornerColor[accent])} />
        <span className={cn('absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2 pointer-events-none', cornerColor[accent])} />
        <span className={cn('absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2 pointer-events-none', cornerColor[accent])} />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d1017] border-b border-[#1e2637]">
          <div>
            <h3 className="font-mono text-xs font-bold tracking-wider uppercase text-slate-100">
              {title}
            </h3>
            {subtitle && (
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xs hover:bg-[#181e2b] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#0d1017] border-t border-[#1e2637]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

