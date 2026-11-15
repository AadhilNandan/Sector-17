// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { TutorialSpotlight } from '../src/features/tutorial/components/TutorialSpotlight';
import { TutorialDialog } from '../src/features/tutorial/components/TutorialDialog';
import { TutorialProgressBar } from '../src/features/tutorial/components/TutorialProgressBar';
import { stepRegistry } from '../src/features/tutorial/data/stepRegistry';

describe('Phase 9.1.3: Tutorial Spotlight, Dialog & Progress Bar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  describe('TutorialSpotlight', () => {
    it('1. renders null when target element is not found without throwing', () => {
      const onTargetFound = vi.fn();
      const { container } = render(
        <TutorialSpotlight targetId="non-existent-target-id" onTargetFound={onTargetFound} />
      );

      expect(container.firstChild).toBeNull();
      expect(onTargetFound).toHaveBeenCalledWith(false);
    });

    it('2. highlights target and attaches pointer-events none to prevent click interception', () => {
      // Create simulated target in DOM with non-zero dimensions
      const targetDiv = document.createElement('button');
      targetDiv.setAttribute('data-tutorial-id', 'test-target-button');
      targetDiv.getBoundingClientRect = () => ({
        top: 100,
        left: 200,
        width: 150,
        height: 40,
        bottom: 140,
        right: 350,
        x: 200,
        y: 100,
        toJSON: () => {},
      });
      document.body.appendChild(targetDiv);

      const onTargetFound = vi.fn();
      act(() => {
        render(
          <TutorialSpotlight targetId="test-target-button" onTargetFound={onTargetFound} />
        );
      });

      expect(onTargetFound).toHaveBeenCalledWith(true);
      const overlay = screen.getByTestId('tutorial-spotlight-overlay');
      expect(overlay).toBeDefined();
      expect(overlay.className).toContain('pointer-events-none');
    });
  });

  describe('TutorialProgressBar', () => {
    it('3. derives counts dynamically from stepRegistry without hardcoding constants', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_01_BRIEFING');
      const currentStep = stepRegistry.getStepById('tut-01-briefing-directive');

      render(
        <TutorialProgressBar
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={['tut-01-briefing-directive']}
        />
      );

      expect(screen.getByTestId('tutorial-progress-bar')).toBeDefined();
      expect(screen.getByText(/MOD 01: Mission Briefing/i)).toBeDefined();
      expect(screen.getByText(/STEP 1 \/ 4/i)).toBeDefined();
    });
  });

  describe('TutorialDialog', () => {
    it('4. renders step title, instruction, and detailed explanation correctly', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_01_BRIEFING');
      const currentStep = stepRegistry.getStepById('tut-01-briefing-directive');

      render(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: false }}
          isPaused={false}
          targetFound={true}
          onAdvance={vi.fn()}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
        />
      );

      expect(screen.getByText('Command Directive & Mission Briefing')).toBeDefined();
      expect(screen.getByText(/Review the archival directive header/i)).toBeDefined();
      expect(screen.getByText(/SECTOR 17 simulates deep-space reconnaissance/i)).toBeDefined();
    });

    it('5. disables Next button for action-required steps until action is verified', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_01_BRIEFING');
      // Step 2 requires clicking NEW EXPEDITION (CAMPAIGN_STAGE verification)
      const currentStep = stepRegistry.getStepById('tut-01-new-expedition');

      const onAdvance = vi.fn();

      const { rerender } = render(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: false }}
          isPaused={false}
          targetFound={true}
          onAdvance={onAdvance}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
        />
      );

      // Button should indicate AWAITING ACTION and be disabled
      const advanceBtn = screen.getByText('AWAITING ACTION');
      expect(advanceBtn).toBeDefined();
      fireEvent.click(advanceBtn);
      expect(onAdvance).not.toHaveBeenCalled();

      // Rerender with verified: true
      rerender(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: true }}
          isPaused={false}
          targetFound={true}
          onAdvance={onAdvance}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
        />
      );

      const verifiedBtn = screen.getByText('CONTINUE');
      expect(verifiedBtn).toBeDefined();
      fireEvent.click(verifiedBtn);
      expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it('6. displays warning notice when target control is not found in DOM', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_02_ENGINEERING');
      const currentStep = stepRegistry.getStepById('tut-02-power-subsystem');

      render(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: false }}
          isPaused={false}
          targetFound={false} // target not in DOM
          onAdvance={vi.fn()}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
        />
      );

      expect(screen.getByText(/Target control \(tab-category-power\) is loading or located on \/workshop/i)).toBeDefined();
    });

    it('7. provides drag handle and allows drag-repositioning', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_01_BRIEFING');
      const currentStep = stepRegistry.getStepById('tut-01-briefing-directive');
      const onPositionChange = vi.fn();

      render(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: false }}
          isPaused={false}
          targetFound={true}
          onAdvance={vi.fn()}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
          onPositionChange={onPositionChange}
        />
      );

      const dragHandle = screen.getByTestId('tutorial-dialog-drag-handle');
      expect(dragHandle).toBeDefined();
      expect(screen.getByTestId('tutorial-drag-grip')).toBeDefined();

      const dialog = screen.getByTestId('tutorial-dialog');
      // Initially positioned at bottom-6 right-6
      expect(dialog.className).toContain('bottom-6 right-6');

      // Start dragging
      act(() => {
        fireEvent.pointerDown(dragHandle, { button: 0, clientX: 200, clientY: 200 });
      });

      // Move pointer
      act(() => {
        const moveEvt = new Event('pointermove');
        Object.assign(moveEvt, { clientX: 250, clientY: 300 });
        window.dispatchEvent(moveEvt);
      });

      expect(onPositionChange).toHaveBeenCalled();

      // Release pointer
      act(() => {
        const upEvt = new Event('pointerup');
        window.dispatchEvent(upEvt);
      });
    });

    it('8. allows resetting position to default via reset button or double-click', () => {
      const currentModule = stepRegistry.getModuleById('MODULE_01_BRIEFING');
      const currentStep = stepRegistry.getStepById('tut-01-briefing-directive');
      const onPositionChange = vi.fn();

      const { rerender } = render(
        <TutorialDialog
          currentModule={currentModule}
          currentStep={currentStep}
          completedStepIds={[]}
          verificationResult={{ verified: false }}
          isPaused={false}
          targetFound={true}
          position={{ x: 150, y: 120 }}
          onPositionChange={onPositionChange}
          onAdvance={vi.fn()}
          onPrevious={vi.fn()}
          onPauseToggle={vi.fn()}
          onSkip={vi.fn()}
          onOpenHandbook={vi.fn()}
        />
      );

      const dialog = screen.getByTestId('tutorial-dialog');
      expect(dialog.style.left).toBe('150px');
      expect(dialog.style.top).toBe('120px');

      const resetBtn = screen.getByTestId('tutorial-reset-position-button');
      expect(resetBtn).toBeDefined();

      act(() => {
        fireEvent.click(resetBtn);
      });
      expect(onPositionChange).toHaveBeenCalledWith(null);

      // Also verify double clicking the drag handle
      const dragHandle = screen.getByTestId('tutorial-dialog-drag-handle');
      act(() => {
        fireEvent.doubleClick(dragHandle);
      });
      expect(onPositionChange).toHaveBeenCalledWith(null);
    });
  });
});
