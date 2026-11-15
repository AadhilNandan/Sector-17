/**
 * SECTOR 17 — Persistent Tutorial HUD Control Button
 * Phase 9.1.3 Production Implementation
 *
 * Persistent, non-obstructive command pill floating in the upper-right application HUD.
 * Provides instant access to Guided Walkthroughs, the Mission Handbook, and reset utilities.
 * Supports keyboard accessibility and hotkeys (? or H).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { HelpCircle, BookOpen, Play, RotateCcw, X, Trash2 } from 'lucide-react';

export const TutorialHUDButton: React.FC = () => {
  const {
    state,
    isTutorialMinimized,
    restoreTutorial,
    startTutorial,
    resumeTutorial,
    restartTutorial,
    resetTutorialProgress,
    openHandbook,
  } = useTutorial();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Global hotkeys (? or H)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing into an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === '?' || (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setMenuOpen((prev) => !prev);
      } else if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <div
      ref={menuRef}
      className="fixed top-3 right-20 sm:right-24 z-40 font-mono text-xs select-none"
      data-testid="tutorial-hud-container"
    >
      {/* Primary HUD Pill */}
      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label="Tutorial and Handbook Menu"
        className={`px-2.5 py-1 rounded bg-[#0D1116]/85 hover:bg-[#151B22] border transition-all cursor-pointer flex items-center gap-1.5 backdrop-blur-sm shadow-md ${
          state.isActive
            ? 'border-[#7FB7D4] text-[#7FB7D4] shadow-[#7FB7D4]/10'
            : 'border-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6]'
        }`}
      >
        <HelpCircle size={13} className={state.isActive ? 'text-[#7FB7D4]' : 'text-[#A9B0B5]'} />
        <span className="font-semibold tracking-wider text-[11px]">
          {state.isActive ? 'TUTORIAL ACTIVE' : 'TUTORIAL / HANDBOOK'}
        </span>
      </button>

      {/* Popover Aerospace Menu */}
      {menuOpen && (
        <div
          role="menu"
          aria-label="Tutorial Options"
          className="absolute right-0 mt-1.5 w-60 bg-[#0D1116]/95 border border-[#2B3642] rounded shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-1 z-50 text-[#E6E2D6]"
        >
          {/* Header */}
          <div className="px-2 py-1.5 border-b border-[#2B3642]/60 flex items-center justify-between text-[10px] text-[#A9B0B5] uppercase tracking-wider">
            <span>FLIGHT TRAINING MANUAL</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="text-[#6B757D] hover:text-[#E6E2D6] p-0.5 rounded cursor-pointer"
              title="Close menu"
            >
              <X size={12} />
            </button>
          </div>

          {/* Action 1: Guided Walkthrough */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              if (state.isActive) {
                if (state.isPaused) {
                  resumeTutorial();
                }
                if (isTutorialMinimized) {
                  restoreTutorial();
                }
              } else {
                startTutorial();
              }
            }}
            className="w-full px-2.5 py-1.5 rounded text-left text-xs hover:bg-[#1C242D] text-[#7FB7D4] flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Play size={13} />
            <span>{state.isActive ? 'Resume Guided Mission' : 'Start Guided Walkthrough'}</span>
          </button>

          {/* Action 2: Open Handbook */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              openHandbook();
            }}
            className="w-full px-2.5 py-1.5 rounded text-left text-xs hover:bg-[#1C242D] text-[#E6E2D6] flex items-center gap-2 cursor-pointer transition-colors"
          >
            <BookOpen size={13} className="text-[#8FB8CC]" />
            <span>Mission Handbook (15 Ch)</span>
          </button>

          {/* Action 3: Restart */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              restartTutorial();
            }}
            className="w-full px-2.5 py-1.5 rounded text-left text-xs hover:bg-[#1C242D] text-[#A9B0B5] hover:text-[#E6E2D6] flex items-center gap-2 cursor-pointer transition-colors"
          >
            <RotateCcw size={13} />
            <span>Restart Training Curriculum</span>
          </button>

          <div className="h-px bg-[#2B3642]/40 my-0.5" />

          {/* Action 4: Reset Storage */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              resetTutorialProgress();
            }}
            className="w-full px-2.5 py-1.5 rounded text-left text-[11px] text-[#6B757D] hover:text-[#D8503F] hover:bg-[#1C242D] flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Trash2 size={12} />
            <span>Reset Tutorial Progress</span>
          </button>
        </div>
      )}
    </div>
  );
};
