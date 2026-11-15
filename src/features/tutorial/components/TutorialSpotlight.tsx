/**
 * SECTOR 17 — Tutorial Spotlight Component
 * Phase 9.1.3 Production Implementation
 *
 * Highlights the active tutorial target with an aerospace reticle cutout.
 *
 * CRITICAL POINTER-EVENT GUARANTEE:
 * The cutout area surrounding the target element contains ZERO blocking DOM layers.
 * The reticle uses 'pointer-events: none', ensuring clicks, hover, and keyboard focus
 * pass directly and unimpeded to the underlying application control.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

export interface TutorialSpotlightProps {
  readonly targetId: string;
  readonly padding?: number;
  readonly onTargetFound?: (found: boolean) => void;
}

interface TargetRect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  readonly bottom: number;
  readonly right: number;
}

export const TutorialSpotlight: React.FC<TutorialSpotlightProps> = ({
  targetId,
  padding = 8,
  onTargetFound,
}) => {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const targetElementRef = useRef<Element | null>(null);

  // Locate the target DOM element
  const resolveTarget = useCallback((): Element | null => {
    if (typeof document === 'undefined') return null;

    // 1. Check data-tutorial-id attribute
    let el = document.querySelector(`[data-tutorial-id="${targetId}"]`);
    if (el) return el;

    // 2. Check id attribute
    el = document.getElementById(targetId);
    if (el) return el;

    // 3. Check class selector fallback
    try {
      el = document.querySelector(`.${targetId}`);
      if (el) return el;
    } catch {
      // Invalid selector fallback
    }

    return null;
  }, [targetId]);

  // Update target bounding rect
  const updateRect = useCallback(() => {
    const el = resolveTarget();
    targetElementRef.current = el;

    if (!el) {
      setTargetRect(null);
      onTargetFound?.(false);
      return;
    }

    const rect = el.getBoundingClientRect();

    // Check if element is currently rendered with visible dimensions
    if (rect.width > 0 && rect.height > 0) {
      setTargetRect({
        top: Math.max(0, rect.top - padding),
        left: Math.max(0, rect.left - padding),
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        bottom: rect.bottom + padding,
        right: rect.right + padding,
      });
      onTargetFound?.(true);
    } else {
      setTargetRect(null);
      onTargetFound?.(false);
    }
  }, [resolveTarget, padding, onTargetFound]);

  useEffect(() => {
    updateRect();

    // Resize and scroll listeners to dynamically track viewport movement
    const handleScrollOrResize = () => {
      window.requestAnimationFrame(updateRect);
    };

    window.addEventListener('resize', handleScrollOrResize, { passive: true });
    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });

    // MutationObserver to detect dynamically mounted modals/tabs
    const observer = new MutationObserver(() => {
      updateRect();
    });

    if (typeof document !== 'undefined' && document.body) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      observer.disconnect();
    };
  }, [updateRect]);

  if (!targetRect) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 pointer-events-none overflow-hidden select-none"
      data-testid="tutorial-spotlight-overlay"
      aria-hidden="true"
    >
      {/* 4-Panel Scrim: Surrounds target without covering it */}
      <div
        className="fixed top-0 left-0 right-0 bg-[#04060A]/70 pointer-events-none transition-all duration-150"
        style={{ height: `${targetRect.top}px` }}
      />
      <div
        className="fixed left-0 right-0 bottom-0 bg-[#04060A]/70 pointer-events-none transition-all duration-150"
        style={{ top: `${targetRect.bottom}px` }}
      />
      <div
        className="fixed bg-[#04060A]/70 pointer-events-none transition-all duration-150"
        style={{
          top: `${targetRect.top}px`,
          left: 0,
          width: `${targetRect.left}px`,
          height: `${targetRect.height}px`,
        }}
      />
      <div
        className="fixed right-0 bg-[#04060A]/70 pointer-events-none transition-all duration-150"
        style={{
          top: `${targetRect.top}px`,
          left: `${targetRect.right}px`,
          height: `${targetRect.height}px`,
        }}
      />

      {/* Target Reticle Frame: Pulsing cyan border & technical corner brackets */}
      <div
        className="fixed pointer-events-none rounded transition-all duration-150"
        style={{
          top: `${targetRect.top}px`,
          left: `${targetRect.left}px`,
          width: `${targetRect.width}px`,
          height: `${targetRect.height}px`,
          boxShadow: '0 0 16px rgba(127, 183, 212, 0.4), inset 0 0 8px rgba(127, 183, 212, 0.2)',
          border: '1.5px solid rgba(127, 183, 212, 0.85)',
        }}
      >
        {/* Corner Brackets */}
        <span className="absolute -top-1 -left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
        <span className="absolute -bottom-1 -left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
        <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
      </div>
    </div>
  );
};
