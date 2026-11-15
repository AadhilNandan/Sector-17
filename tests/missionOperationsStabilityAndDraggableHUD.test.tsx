// @vitest-environment happy-dom
/**
 * SECTOR 17 — Mission Operations UI Stability & Draggable Tutorial HUD Regression Tests
 * Verifies:
 * 1. Main application shell bounds and non-expanding container properties.
 * 2. Dedicated action controls anchored in the right panel and remaining visible.
 * 3. Modals (Communications, Science, Finalize) with fixed header/footer and independently scrollable bodies.
 * 4. Modal open/close lifecycle and layout preservation.
 * 5. Draggable Tutorial / Handbook HUD button:
 *    a. Initial position calculation and localStorage persistence.
 *    b. Drag threshold detection (click vs. drag).
 *    c. Viewport boundary clamping on drag and window resize.
 *    d. Safe fallback on corrupt localStorage data.
 *    e. Full preservation of tutorial menu, handbook trigger, and keyboard accessibility.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import { SimulationRuntime, SimulationProvider } from '../src/runtime';
import { MissionOperationsScreen } from '../src/features/screens/MissionOperationsScreen';
import { TutorialHUDButton } from '../src/features/tutorial/components/TutorialHUDButton';
import { TutorialProvider } from '../src/features/tutorial/context/TutorialContext';

describe('Mission Operations UI Stability & Draggable Tutorial HUD', () => {
  const CAMPAIGN_ID = 'EXPEDITION-V-STABILITY-TEST';

  beforeEach(() => {
    localStorage.clear();
    SimulationRuntime.resetAll();
    SimulationRuntime.getOrCreate(CAMPAIGN_ID, { initialState: 'ACTIVE' });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    SimulationRuntime.resetAll();
  });

  const renderOperationsScreen = () => {
    return render(
      <MemoryRouter initialEntries={['/operations']}>
        <SimulationProvider campaignId={CAMPAIGN_ID}>
          <Routes>
            <Route path="/operations" element={<MissionOperationsScreen />} />
            <Route path="/debrief" element={<div data-testid="debrief-view">Debrief</div>} />
            <Route path="/trajectory" element={<div data-testid="trajectory-view">Trajectory</div>} />
          </Routes>
        </SimulationProvider>
      </MemoryRouter>
    );
  };

  const renderHUDButton = (route = '/operations') => {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <TutorialProvider currentRoute={route}>
          <TutorialHUDButton />
        </TutorialProvider>
      </MemoryRouter>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* WORKSTREAM A: Mission Operations UI Stability                              */
  /* -------------------------------------------------------------------------- */
  describe('Workstream A: Mission Operations Layout Stability', () => {
    it('1. shell occupies bounded viewport with max-h-screen and overflow-hidden', () => {
      const { container } = renderOperationsScreen();
      const shell = container.firstElementChild as HTMLElement;
      expect(shell).toBeTruthy();
      expect(shell.className).toContain('w-screen');
      expect(shell.className).toContain('h-screen');
      expect(shell.className).toContain('max-h-screen');
      expect(shell.className).toContain('overflow-hidden');
    });

    it('2. action controls remain persistently anchored in right-side panel', () => {
      renderOperationsScreen();
      const commsBtn = screen.getByTestId('btn-open-communications');
      const scienceBtn = screen.getByTestId('btn-open-science');
      const finalizeBtn = screen.getByTestId('btn-finalize-expedition');

      expect(commsBtn).toBeDefined();
      expect(scienceBtn).toBeDefined();
      expect(finalizeBtn).toBeDefined();

      // Parent container must have shrink-0 so it is never displaced or squeezed
      const actionContainer = commsBtn.closest('.shrink-0');
      expect(actionContainer).toBeTruthy();
    });

    it('3. opening communications modal retains bounded layout and does not expand page', () => {
      renderOperationsScreen();
      const commsBtn = screen.getByTestId('btn-open-communications');

      act(() => {
        fireEvent.click(commsBtn);
      });

      const modal = screen.getByRole('dialog', { name: 'Communications Subsystem Control Console' });
      expect(modal).toBeDefined();

      // Modal container has fixed overlay with overflow-hidden
      expect(modal.className).toContain('fixed');
      expect(modal.className).toContain('inset-0');

      // Modal card has max-h bounded to viewport
      const modalBox = modal.firstElementChild as HTMLElement;
      expect(modalBox.className).toContain('max-h-[calc(100vh-2rem)]');
      expect(modalBox.className).toContain('overflow-hidden');

      // Close modal
      const closeBtn = screen.getByRole('button', { name: '✕ [CLOSE]' });
      act(() => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByRole('dialog', { name: 'Communications Subsystem Control Console' })).toBeNull();
    });

    it('4. opening science processing modal provides scrollable body with anchored actions', () => {
      renderOperationsScreen();
      const scienceBtn = screen.getByTestId('btn-open-science');

      act(() => {
        fireEvent.click(scienceBtn);
      });

      const modal = screen.getByRole('dialog', { name: 'Science Data Processing Console' });
      expect(modal).toBeDefined();

      const modalBox = modal.firstElementChild as HTMLElement;
      expect(modalBox.className).toContain('max-h-[calc(100vh-2rem)]');

      const processBtn = screen.getByTestId('btn-process-observation-batch');
      expect(processBtn).toBeDefined();

      // Trigger process and close
      act(() => {
        fireEvent.click(processBtn);
      });

      const closeBtn = screen.getByRole('button', { name: '✕ [CLOSE]' });
      act(() => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByRole('dialog', { name: 'Science Data Processing Console' })).toBeNull();
    });

    it('5. opening mission completion modal preserves anchored debrief actions and close restore', () => {
      renderOperationsScreen();
      const finalizeBtn = screen.getByTestId('btn-finalize-expedition');

      act(() => {
        fireEvent.click(finalizeBtn);
      });

      const modal = screen.getByRole('dialog', { name: 'Mission Completion Evaluation and Finalization' });
      expect(modal).toBeDefined();

      const modalBox = modal.firstElementChild as HTMLElement;
      expect(modalBox.className).toContain('max-h-[calc(100vh-2rem)]');

      const continueBtn = screen.getByText('CONTINUE FLIGHT OPERATIONS');
      act(() => {
        fireEvent.click(continueBtn);
      });

      expect(screen.queryByRole('dialog', { name: 'Mission Completion Evaluation and Finalization' })).toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* WORKSTREAM B: Draggable Tutorial / Handbook HUD Button                     */
  /* -------------------------------------------------------------------------- */
  describe('Workstream B: Draggable Tutorial HUD Button', () => {
    it('1. renders HUD button in default viewport position when localStorage is empty', () => {
      renderHUDButton();
      const hudContainer = screen.getByTestId('tutorial-hud-container');
      expect(hudContainer).toBeDefined();
      expect(hudContainer.style.left).toBeDefined();
      expect(hudContainer.style.top).toBe('12px');
    });

    it('2. distinguishes click from drag: click (< 5px) toggles tutorial menu', () => {
      renderHUDButton();
      const hudContainer = screen.getByTestId('tutorial-hud-container');
      const button = screen.getByRole('button', { name: 'Tutorial and Handbook Menu' });

      // Simulate slight mouse movement under 5px threshold (e.g. 2px jitter)
      act(() => {
        fireEvent.pointerDown(hudContainer, { clientX: 500, clientY: 100, button: 0 });
        fireEvent.pointerMove(window, { clientX: 502, clientY: 101 });
        fireEvent.pointerUp(window, { clientX: 502, clientY: 101 });
      });

      // Regular click opens the menu
      act(() => {
        fireEvent.click(button);
      });

      expect(screen.getByRole('menu', { name: 'Tutorial Options' })).toBeDefined();
      expect(screen.getByText('FLIGHT TRAINING MANUAL')).toBeDefined();
      expect(screen.getByText('Mission Handbook (15 Ch)')).toBeDefined();
    });

    it('3. dragging (> 5px) moves HUD button and prevents opening the menu upon release', () => {
      renderHUDButton();
      const hudContainer = screen.getByTestId('tutorial-hud-container');
      const button = screen.getByRole('button', { name: 'Tutorial and Handbook Menu' });

      const startLeft = parseFloat(hudContainer.style.left);
      const startTop = parseFloat(hudContainer.style.top);

      // Drag 100px left and 50px down
      act(() => {
        fireEvent.pointerDown(hudContainer, { clientX: 600, clientY: 200, button: 0 });
        fireEvent.pointerMove(window, { clientX: 500, clientY: 250 });
        fireEvent.pointerUp(window, { clientX: 500, clientY: 250 });
      });

      const newLeft = parseFloat(hudContainer.style.left);
      const newTop = parseFloat(hudContainer.style.top);

      expect(newLeft).toBeLessThan(startLeft);
      expect(newTop).toBeGreaterThan(startTop);

      // Attempt click immediately after drag — should be prevented
      act(() => {
        fireEvent.click(button);
      });

      expect(screen.queryByRole('menu', { name: 'Tutorial Options' })).toBeNull();
    });

    it('4. persists valid coordinates to localStorage under versioned key', () => {
      renderHUDButton();
      const hudContainer = screen.getByTestId('tutorial-hud-container');

      act(() => {
        fireEvent.pointerDown(hudContainer, { clientX: 400, clientY: 300, button: 0 });
        fireEvent.pointerMove(window, { clientX: 450, clientY: 350 });
        fireEvent.pointerUp(window, { clientX: 450, clientY: 350 });
      });

      const saved = localStorage.getItem('sector17_hud_button_pos_v1');
      expect(saved).toBeTruthy();
      const parsed = JSON.parse(saved!);
      expect(typeof parsed.x).toBe('number');
      expect(typeof parsed.y).toBe('number');
      expect(parsed.x).toBeGreaterThan(0);
      expect(parsed.y).toBeGreaterThan(0);
    });

    it('5. restores saved position from localStorage on component remount', () => {
      localStorage.setItem('sector17_hud_button_pos_v1', JSON.stringify({ x: 120, y: 80 }));
      renderHUDButton();

      const hudContainer = screen.getByTestId('tutorial-hud-container');
      expect(hudContainer.style.left).toBe('120px');
      expect(hudContainer.style.top).toBe('80px');
    });

    it('6. safely falls back to default coordinates when localStorage data is corrupt', () => {
      localStorage.setItem('sector17_hud_button_pos_v1', '{ corrupt json');
      renderHUDButton();

      const hudContainer = screen.getByTestId('tutorial-hud-container');
      expect(hudContainer.style.top).toBe('12px');
    });

    it('7. clamps coordinates within viewport boundaries on window resize', () => {
      // Position near far bottom right
      localStorage.setItem('sector17_hud_button_pos_v1', JSON.stringify({ x: 1900, y: 1050 }));
      renderHUDButton();

      const hudContainer = screen.getByTestId('tutorial-hud-container');

      // Trigger resize to a smaller viewport (1280 x 720)
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
      vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(720);

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      const clampedX = parseFloat(hudContainer.style.left);
      const clampedY = parseFloat(hudContainer.style.top);

      expect(clampedX).toBeLessThanOrEqual(1280);
      expect(clampedY).toBeLessThanOrEqual(720);
    });

    it('8. preserves keyboard hotkey accessibility (? or H) and Escape to close', () => {
      renderHUDButton();

      // Press ? to open
      act(() => {
        fireEvent.keyDown(window, { key: '?' });
      });
      expect(screen.getByRole('menu', { name: 'Tutorial Options' })).toBeDefined();

      // Press Escape to close
      act(() => {
        fireEvent.keyDown(window, { key: 'Escape' });
      });
      expect(screen.queryByRole('menu', { name: 'Tutorial Options' })).toBeNull();

      // Press H to open
      act(() => {
        fireEvent.keyDown(window, { key: 'h' });
      });
      expect(screen.getByRole('menu', { name: 'Tutorial Options' })).toBeDefined();
    });
  });
});
