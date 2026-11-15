// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TutorialProvider, useTutorial } from '../src/features/tutorial/context/TutorialContext';
import { TutorialOverlay } from '../src/features/tutorial/components/TutorialOverlay';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationProvider } from '../src/runtime/SimulationContext';

// Helper component that starts tutorial and renders a target button and an input
const TestHarness: React.FC = () => {
  const { startTutorial } = useTutorial();
  const [clickCount, setClickCount] = React.useState(0);

  return (
    <div>
      <button
        type="button"
        data-testid="start-tut-btn"
        onClick={() => startTutorial('MODULE_01_BRIEFING', 'tut-01-briefing-directive')}
      >
        Start
      </button>

      {/* Target element for step 1 */}
      <button
        type="button"
        id="tut-directive-card"
        data-tutorial-id="tut-directive-card"
        data-testid="underlying-target-btn"
        onClick={() => setClickCount((c) => c + 1)}
      >
        Click Me ({clickCount})
      </button>

      <input
        type="text"
        data-testid="test-input"
        placeholder="Type here"
      />
      <textarea
        data-testid="test-textarea"
        placeholder="Textarea here"
      />

      <TutorialOverlay />
    </div>
  );
};

describe('Tutorial Minimization Subsystem (Workstream A)', () => {
  const CAMPAIGN_ID = 'test-minimization-campaign';

  const renderHarness = () =>
    render(
      <MemoryRouter>
        <SimulationProvider campaignId={CAMPAIGN_ID}>
          <TutorialProvider autoLoadPersistence={false}>
            <TestHarness />
          </TutorialProvider>
        </SimulationProvider>
      </MemoryRouter>
    );

  beforeEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    try {
      localStorage.clear();
    } catch {
      // Ignore
    }
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
  });

  it('1. renders minimize button in header and starts in un-minimized state', () => {
    renderHarness();

    // Initially tutorial is inactive
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();

    // Start tutorial
    fireEvent.click(screen.getByTestId('start-tut-btn'));

    // Tutorial dialog is visible
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();

    // Minimize button is present
    const minBtn = screen.getByTestId('tutorial-minimize-button');
    expect(minBtn).toBeDefined();
    expect(minBtn.getAttribute('aria-label')).toBe('Minimize Tutorial');
  });

  it('2. clicking minimize button hides dialog & spotlight and displays floating restore control', () => {
    renderHarness();

    fireEvent.click(screen.getByTestId('start-tut-btn'));
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();

    // Click minimize
    fireEvent.click(screen.getByTestId('tutorial-minimize-button'));

    // Dialog & spotlight scrim must be completely unmounted
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();
    expect(screen.queryByTestId('tutorial-spotlight-scrim')).toBeNull();

    // Floating restore button must be displayed
    const restoreBtn = screen.getByTestId('tutorial-restore-button');
    expect(restoreBtn).toBeDefined();
    expect(restoreBtn.textContent).toContain('TUTORIAL — RESUME');
  });

  it('3. clicking floating restore button restores tutorial dialog at exact same step', () => {
    renderHarness();

    fireEvent.click(screen.getByTestId('start-tut-btn'));
    expect(screen.getByText(/MOD 01/i)).toBeDefined();

    // Minimize
    fireEvent.click(screen.getByTestId('tutorial-minimize-button'));
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();

    // Restore
    fireEvent.click(screen.getByTestId('tutorial-restore-button'));

    // Dialog is back with same module & step
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
    expect(screen.getByText(/MOD 01/i)).toBeDefined();
    expect(screen.queryByTestId('tutorial-restore-button')).toBeNull();
  });

  it('4. keyboard shortcut M toggles minimization', () => {
    renderHarness();

    fireEvent.click(screen.getByTestId('start-tut-btn'));
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();

    // Press 'm' to minimize
    fireEvent.keyDown(window, { key: 'm' });
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();
    expect(screen.getByTestId('tutorial-restore-button')).toBeDefined();

    // Press 'M' to restore
    fireEvent.keyDown(window, { key: 'M' });
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
    expect(screen.queryByTestId('tutorial-restore-button')).toBeNull();
  });

  it('5. keyboard shortcut M does NOT trigger when user is typing in input or textarea', () => {
    renderHarness();

    fireEvent.click(screen.getByTestId('start-tut-btn'));
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();

    const input = screen.getByTestId('test-input');
    const textarea = screen.getByTestId('test-textarea');

    // Type 'm' in input
    fireEvent.keyDown(input, { key: 'm' });
    // Still not minimized
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
    expect(screen.queryByTestId('tutorial-restore-button')).toBeNull();

    // Type 'm' in textarea
    fireEvent.keyDown(textarea, { key: 'm' });
    // Still not minimized
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
    expect(screen.queryByTestId('tutorial-restore-button')).toBeNull();
  });

  it('6. underlying controls remain fully interactive and clickable while tutorial is minimized', () => {
    renderHarness();

    fireEvent.click(screen.getByTestId('start-tut-btn'));

    // Minimize
    fireEvent.click(screen.getByTestId('tutorial-minimize-button'));

    // Click underlying target button
    const targetBtn = screen.getByTestId('underlying-target-btn');
    expect(targetBtn.textContent).toContain('Click Me (0)');

    fireEvent.click(targetBtn);
    expect(targetBtn.textContent).toContain('Click Me (1)');

    fireEvent.click(targetBtn);
    expect(targetBtn.textContent).toContain('Click Me (2)');
  });
});
