/**
 * SECTOR 17 — Persistent Draggable Tutorial HUD Control Button
 * Phase 9.1.3 & Usability Stability Implementation
 *
 * Draggable, non-obstructive command pill floating in the application HUD.
 * - Supports drag-and-drop repositioning anywhere within visible viewport boundaries.
 * - Clamps position during dragging and on window resize so button is never lost.
 * - Distinguishes clicks from drags using Euclidean distance threshold (DRAG_THRESHOLD).
 * - Persists coordinates across route changes and browser refreshes in localStorage.
 * - Dynamically orients options popover to keep dropdown within viewport boundaries.
 * - Provides instant access to Guided Walkthroughs, Mission Handbook, and reset utilities.
 * - Supports keyboard accessibility (? or H hotkeys, Escape, Enter/Space).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTutorial } from '../context/TutorialContext';
import { HelpCircle, BookOpen, Play, RotateCcw, X, Trash2, GripVertical } from 'lucide-react';

const STORAGE_KEY = 'sector17_hud_button_pos_v1';
const DRAG_THRESHOLD = 5; // px

interface Position {
  x: number;
  y: number;
}

const clampCoordinates = (x: number, y: number, btnWidth = 180, btnHeight = 36): Position => {
  if (typeof window === 'undefined') return { x, y };
  const maxX = Math.max(0, window.innerWidth - btnWidth);
  const maxY = Math.max(0, window.innerHeight - btnHeight);
  return {
    x: Math.max(0, Math.min(x, maxX)),
    y: Math.max(0, Math.min(y, maxY)),
  };
};

const getDefaultPosition = (): Position => {
  if (typeof window === 'undefined') {
    return { x: 1000, y: 12 };
  }
  const btnWidth = 185;
  const initialX = Math.max(16, window.innerWidth - btnWidth - 96);
  const initialY = 12;
  return { x: initialX, y: initialY };
};

const getInitialPosition = (): Position => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        isFinite(parsed.x) &&
        isFinite(parsed.y)
      ) {
        return clampCoordinates(parsed.x, parsed.y);
      }
    }
  } catch {
    // Non-fatal, fallback to default
  }
  return getDefaultPosition();
};

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
  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    initialPosX: number;
    initialPosY: number;
    hasMoved: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

  // Position reference to avoid stale closures in window event listeners
  const positionRef = useRef<Position>(position);
  positionRef.current = position;

  // Window resize handler: clamp position to updated viewport boundaries
  useEffect(() => {
    const handleResize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 185;
      const h = rect?.height || 36;
      const clamped = clampCoordinates(positionRef.current.x, positionRef.current.y, w, h);
      if (clamped.x !== positionRef.current.x || clamped.y !== positionRef.current.y) {
        setPosition(clamped);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
        } catch {
          // Non-fatal
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Global pointer move and up listeners while dragging
  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;

    if (!dragStartRef.current.hasMoved) {
      if (Math.hypot(dx, dy) >= DRAG_THRESHOLD) {
        dragStartRef.current.hasMoved = true;
        justDraggedRef.current = true;
        setIsDragging(true);
        setMenuOpen(false);
      }
    }

    if (dragStartRef.current.hasMoved) {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 185;
      const h = rect?.height || 36;
      const nextX = dragStartRef.current.initialPosX + dx;
      const nextY = dragStartRef.current.initialPosY + dy;
      const clamped = clampCoordinates(nextX, nextY, w, h);
      setPosition(clamped);
    }
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!dragStartRef.current) return;
    const wasDragging = dragStartRef.current.hasMoved;

    if (wasDragging) {
      const rect = containerRef.current?.getBoundingClientRect();
      const w = rect?.width || 185;
      const h = rect?.height || 36;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const finalX = dragStartRef.current.initialPosX + dx;
      const finalY = dragStartRef.current.initialPosY + dy;
      const clamped = clampCoordinates(finalX, finalY, w, h);
      setPosition(clamped);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
      } catch {
        // Non-fatal
      }

      // Small debounce to prevent click handler from reopening menu on drag release
      setTimeout(() => {
        justDraggedRef.current = false;
      }, 80);
    } else {
      justDraggedRef.current = false;
    }

    dragStartRef.current = null;
    setIsDragging(false);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    window.removeEventListener('pointercancel', handlePointerUp);
  }, [handlePointerMove]);

  // Pointer down initiator on the HUD container
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary click/touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Don't drag when interacting with menu options
    if ((e.target as HTMLElement).closest('[role="menu"]')) return;

    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y,
      hasMoved: false,
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      // Don't trigger if typing into input or textarea
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

  const handleToggleClick = () => {
    if (justDraggedRef.current) return;
    setMenuOpen((prev) => !prev);
  };

  // Compute adaptive popover orientation so it remains within viewport
  const isNearLeftEdge = position.x < 260;
  const isNearBottomEdge =
    typeof window !== 'undefined' ? position.y > window.innerHeight - 280 : false;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className={`fixed z-50 font-mono text-xs select-none transition-shadow ${
        isDragging ? 'cursor-grabbing ring-2 ring-[#7FB7D4] shadow-2xl opacity-90' : 'cursor-grab'
      }`}
      data-testid="tutorial-hud-container"
      title="Click to toggle menu, or drag to reposition HUD button"
    >
      {/* Primary HUD Pill */}
      <button
        type="button"
        onClick={handleToggleClick}
        aria-expanded={menuOpen}
        aria-haspopup="true"
        aria-label="Tutorial and Handbook Menu"
        className={`px-2.5 py-1 rounded bg-[#0D1116]/90 hover:bg-[#151B22] border transition-all flex items-center gap-1.5 backdrop-blur-md shadow-lg ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } ${
          state.isActive
            ? 'border-[#7FB7D4] text-[#7FB7D4] shadow-[#7FB7D4]/15'
            : 'border-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6]'
        }`}
      >
        <GripVertical size={11} className="text-[#6B757D] opacity-70 -mr-0.5" aria-hidden="true" />
        <HelpCircle size={13} className={state.isActive ? 'text-[#7FB7D4]' : 'text-[#A9B0B5]'} />
        <span className="font-semibold tracking-wider text-[11px] whitespace-nowrap">
          {state.isActive ? 'TUTORIAL ACTIVE' : 'TUTORIAL / HANDBOOK'}
        </span>
      </button>

      {/* Popover Aerospace Menu (Adaptive placement based on button position) */}
      {menuOpen && (
        <div
          role="menu"
          aria-label="Tutorial Options"
          className={`absolute w-60 bg-[#0D1116]/95 border border-[#2B3642] rounded shadow-2xl backdrop-blur-md p-1.5 flex flex-col gap-1 z-50 text-[#E6E2D6] ${
            isNearLeftEdge ? 'left-0' : 'right-0'
          } ${isNearBottomEdge ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}`}
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
