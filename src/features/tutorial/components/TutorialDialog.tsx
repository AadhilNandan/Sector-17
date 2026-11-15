/**
 * SECTOR 17 — Tutorial Dialog Component
 * Phase 9.1.3 Production Implementation
 *
 * Floating aerospace directive card rendering current instructional context,
 * action requirements, verification state, and flight director controls.
 * Intelligently docks to non-obscuring screen quadrants.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { TutorialStep, TutorialModule, VerificationResult } from '../types';
import { TutorialProgressBar } from './TutorialProgressBar';
import {
  HelpCircle,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Pause,
  Play,
  CheckCircle2,
  AlertCircle,
  Minimize2,
  GripHorizontal,
  RotateCcw,
} from 'lucide-react';

export interface TutorialDialogProps {
  readonly currentModule: TutorialModule | undefined;
  readonly currentStep: TutorialStep | undefined;
  readonly completedStepIds: readonly string[];
  readonly verificationResult: VerificationResult | undefined;
  readonly isPaused: boolean;
  readonly targetFound: boolean;
  readonly position?: { x: number; y: number } | null;
  readonly onPositionChange?: (position: { x: number; y: number } | null) => void;
  readonly onAdvance: () => void;
  readonly onPrevious: () => void;
  readonly onPauseToggle: () => void;
  readonly onSkip: () => void;
  readonly onOpenHandbook: (articleId?: string) => void;
  readonly onMinimize?: () => void;
}

export const TutorialDialog: React.FC<TutorialDialogProps> = ({
  currentModule,
  currentStep,
  completedStepIds,
  verificationResult,
  isPaused,
  targetFound,
  position: propPosition,
  onPositionChange,
  onAdvance,
  onPrevious,
  onPauseToggle,
  onSkip,
  onOpenHandbook,
  onMinimize,
}) => {
  const [internalPosition, setInternalPosition] = useState<{ x: number; y: number } | null>(null);
  const position = propPosition !== undefined ? propPosition : internalPosition;

  const [isDragging, setIsDragging] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const cleanupListenersRef = useRef<(() => void) | null>(null);

  // Clean up global drag listeners on unmount
  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
    };
  }, []);

  // Viewport resize boundary adjustment
  useEffect(() => {
    if (!position || !dialogRef.current) return;
    const handleResize = () => {
      if (!dialogRef.current || !position) return;
      const rect = dialogRef.current.getBoundingClientRect();
      const dialogWidth = rect.width || 440;
      const dialogHeight = rect.height || 300;
      const winWidth = window.innerWidth || 1024;
      const winHeight = window.innerHeight || 768;

      const margin = 8;
      const maxLeft = Math.max(margin, winWidth - dialogWidth - margin);
      const maxTop = Math.max(margin, winHeight - dialogHeight - margin);

      const clampedX = Math.max(margin, Math.min(maxLeft, position.x));
      const clampedY = Math.max(margin, Math.min(maxTop, position.y));

      if (clampedX !== position.x || clampedY !== position.y) {
        const next = { x: Math.round(clampedX), y: Math.round(clampedY) };
        if (propPosition === undefined) setInternalPosition(next);
        onPositionChange?.(next);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, propPosition, onPositionChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!dialogRef.current) return;

    const rect = dialogRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
    };
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current || !dialogRef.current) return;
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;

      const rectNow = dialogRef.current.getBoundingClientRect();
      const dialogWidth = rectNow.width || 440;
      const dialogHeight = rectNow.height || 300;
      const winWidth = window.innerWidth || 1024;
      const winHeight = window.innerHeight || 768;

      const newX = dragRef.current.origX + deltaX;
      const newY = dragRef.current.origY + deltaY;

      const margin = 8;
      const maxLeft = Math.max(margin, winWidth - dialogWidth - margin);
      const maxTop = Math.max(margin, winHeight - dialogHeight - margin);

      const clampedX = Math.max(margin, Math.min(maxLeft, newX));
      const clampedY = Math.max(margin, Math.min(maxTop, newY));

      const newPos = { x: Math.round(clampedX), y: Math.round(clampedY) };
      if (propPosition === undefined) {
        setInternalPosition(newPos);
      }
      onPositionChange?.(newPos);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      cleanupListenersRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    cleanupListenersRef.current = onPointerUp;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const handleResetPosition = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (propPosition === undefined) {
      setInternalPosition(null);
    }
    onPositionChange?.(null);
  };

  // Determine whether the user is permitted to click Next
  // For action-required steps, Next is enabled ONLY if the step has been verified
  const isActionRequired =
    currentStep?.verification.type !== 'USER_ACKNOWLEDGEMENT' &&
    currentStep?.verification.type !== 'ROUTE_MATCH';

  const isVerified = verificationResult?.verified ?? false;
  const canProceed = !isActionRequired || isVerified;

  // Determine action badge text
  const actionBadge = useMemo(() => {
    if (!currentStep) return 'DIRECTIVE';
    switch (currentStep.expectedAction) {
      case 'READ':
        return 'REVIEW BRIEFING';
      case 'CLICK':
        return 'CLICK TARGET';
      case 'SELECT':
        return 'SELECT OPTION';
      case 'VALIDATE':
        return 'VALIDATE MARGINS';
      case 'STEP_TIME':
        return 'ADVANCE TIME';
      default:
        return 'OPERATE CONTROL';
    }
  }, [currentStep]);

  if (!currentStep) {
    return null;
  }

  return (
    <div
      ref={dialogRef}
      role="region"
      aria-label="Tutorial Directive"
      aria-live="polite"
      className={`fixed z-50 pointer-events-auto w-[90vw] max-w-[440px] bg-[#0D1116]/95 border border-[#2B3642] rounded shadow-2xl backdrop-blur-md flex flex-col font-sans select-none text-[#E6E2D6] ${
        position ? '' : 'bottom-6 right-6'
      } ${isDragging ? 'cursor-grabbing transition-none' : 'transition-[box-shadow,border-color] duration-200'}`}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: 'auto',
              bottom: 'auto',
            }
          : undefined
      }
      data-testid="tutorial-dialog"
    >
      {/* Top Banner: Progress Bar, Drag Grip & Controls */}
      <div
        className="p-3.5 pb-2.5 border-b border-[#2B3642]/80 bg-[#151B22]/50 flex items-start justify-between gap-3 cursor-grab active:cursor-grabbing select-none touch-none"
        onPointerDown={handlePointerDown}
        onDoubleClick={handleResetPosition}
        title="Drag to move directive window • Double-click to reset position"
        data-testid="tutorial-dialog-drag-handle"
      >
        <div className="flex-1 min-w-0 pointer-events-none">
          <TutorialProgressBar
            currentModule={currentModule}
            currentStep={currentStep}
            completedStepIds={completedStepIds}
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {position && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleResetPosition}
              className="p-1 rounded bg-[#1C242D] hover:bg-[#2B3642] text-[#A9B0B5] hover:text-[#7FB7D4] border border-[#2B3642] transition-colors cursor-pointer shrink-0"
              title="Reset window position"
              aria-label="Reset window position"
              data-testid="tutorial-reset-position-button"
            >
              <RotateCcw size={12} />
            </button>
          )}
          {onMinimize && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onMinimize}
              className="p-1 rounded bg-[#1C242D] hover:bg-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6] border border-[#2B3642] transition-colors cursor-pointer shrink-0"
              title="Minimize Tutorial (M)"
              aria-label="Minimize Tutorial"
              data-testid="tutorial-minimize-button"
            >
              <Minimize2 size={13} />
            </button>
          )}
          <div
            className="p-1 text-[#6B757D] hover:text-[#A9B0B5] transition-colors"
            title="Drag window"
            aria-hidden="true"
            data-testid="tutorial-drag-grip"
          >
            <GripHorizontal size={14} />
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
        {/* Step Title & Action Badge */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-[#E6E2D6] leading-snug">
            {currentStep.title}
          </h2>
          <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-[#1C242D] text-[#7FB7D4] border border-[#7FB7D4]/40">
            {actionBadge}
          </span>
        </div>

        {/* Primary Instruction */}
        <p className="text-xs font-mono text-[#7FB7D4] bg-[#07090C]/60 p-2.5 rounded border border-[#7FB7D4]/30 leading-relaxed">
          {currentStep.instruction}
        </p>

        {/* Detailed Explanation */}
        <p className="text-xs text-[#A9B0B5] leading-relaxed">
          {currentStep.detailedExplanation}
        </p>

        {/* Target Missing Notice (Safe Fallback) */}
        {!targetFound && isActionRequired && (
          <div className="p-2 rounded bg-[#1C242D] border border-[#E0A43A]/40 text-[#E0A43A] text-[11px] font-mono flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-[#E0A43A]" />
            <span>Target control ({currentStep.targetId}) is loading or located on {currentStep.route}.</span>
          </div>
        )}

        {/* Verification Status Banner */}
        {isVerified && (
          <div className="p-2 rounded bg-[#0A1A12] border border-[#6FAE7C]/50 text-[#6FAE7C] text-[11px] font-mono flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{currentStep.successMessage || 'Action confirmed. Ready to advance.'}</span>
          </div>
        )}

        {/* Technical Context Collapsible */}
        {currentStep.technicalContext && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails((prev) => !prev)}
              className="text-[10px] font-mono text-[#A9B0B5] hover:text-[#7FB7D4] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <HelpCircle size={12} />
              <span>{showTechnicalDetails ? 'HIDE AEROSPACE CONTEXT' : 'SHOW AEROSPACE CONTEXT'}</span>
            </button>
            {showTechnicalDetails && (
              <p className="mt-1.5 p-2 rounded bg-[#151B22] border border-[#2B3642] text-[11px] text-[#A9B0B5] font-mono leading-relaxed">
                {currentStep.technicalContext}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="p-3 bg-[#07090C]/80 border-t border-[#2B3642] flex items-center justify-between gap-2">
        {/* Left Utilities: Pause, Handbook, Skip */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPauseToggle}
            className="p-1.5 rounded bg-[#151B22] hover:bg-[#1C242D] text-[#A9B0B5] hover:text-[#E6E2D6] border border-[#2B3642] transition-colors cursor-pointer"
            title={isPaused ? 'Resume Tutorial' : 'Pause Tutorial'}
            aria-label={isPaused ? 'Resume Tutorial' : 'Pause Tutorial'}
          >
            {isPaused ? <Play size={13} className="text-[#6FAE7C]" /> : <Pause size={13} />}
          </button>

          {currentStep.handbookArticleId && (
            <button
              type="button"
              onClick={() => onOpenHandbook(currentStep.handbookArticleId)}
              className="p-1.5 rounded bg-[#151B22] hover:bg-[#1C242D] text-[#7FB7D4] hover:text-[#E6E2D6] border border-[#2B3642] transition-colors cursor-pointer flex items-center gap-1 text-[10px] font-mono"
              title="Open Handbook Article"
            >
              <BookOpen size={13} />
              <span className="hidden sm:inline">HANDBOOK</span>
            </button>
          )}

          <button
            type="button"
            onClick={onSkip}
            className="px-2 py-1.5 rounded bg-[#151B22] hover:bg-[#1C242D] text-[#6B757D] hover:text-[#D8503F] border border-[#2B3642] text-[10px] font-mono uppercase tracking-wider transition-colors cursor-pointer"
            title="Exit / Skip Tutorial"
          >
            EXIT
          </button>
        </div>

        {/* Right Navigation: Previous & Next */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            className="px-2.5 py-1.5 rounded bg-[#151B22] hover:bg-[#1C242D] text-[#A9B0B5] hover:text-[#E6E2D6] border border-[#2B3642] text-xs font-mono flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={currentStep.order === 1 && currentModule?.order === 1}
          >
            <ChevronLeft size={13} />
            <span className="hidden sm:inline">BACK</span>
          </button>

          <button
            type="button"
            onClick={onAdvance}
            disabled={!canProceed}
            className={`px-3 py-1.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              canProceed
                ? 'bg-[#7FB7D4] text-[#07090C] hover:bg-[#8FB8CC] shadow-md shadow-[#7FB7D4]/20'
                : 'bg-[#1C242D] text-[#6B757D] border border-[#2B3642] cursor-not-allowed opacity-60'
            }`}
          >
            <span>{isVerified ? 'CONTINUE' : isActionRequired ? 'AWAITING ACTION' : 'NEXT'}</span>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
