// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TutorialProvider, useTutorial } from '../src/features/tutorial/context/TutorialContext';
import { TutorialOverlay } from '../src/features/tutorial/components/TutorialOverlay';
import { TutorialHUDButton } from '../src/features/tutorial/components/TutorialHUDButton';
import { RootTutorialLayout } from '../src/router/RootTutorialLayout';
import { tutorialPersistence } from '../src/features/tutorial/services/tutorialPersistence';

describe('Phase 9.1.3: Tutorial Overlay & HUD Button Controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tutorialPersistence.reset();
  });

  afterEach(() => {
    cleanup();
    tutorialPersistence.reset();
  });

  it('1. TutorialOverlay renders null when tutorial is inactive', () => {
    const { container } = render(
      <MemoryRouter>
        <TutorialProvider autoLoadPersistence={false}>
          <TutorialOverlay />
        </TutorialProvider>
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('2. TutorialOverlay renders dialog when tutorial is started', () => {
    const TestComponent: React.FC = () => {
      const { startTutorial } = useTutorial();
      return (
        <div>
          <button type="button" onClick={() => startTutorial()}>
            Launch
          </button>
          <TutorialOverlay />
        </div>
      );
    };

    render(
      <MemoryRouter>
        <TutorialProvider autoLoadPersistence={false}>
          <TestComponent />
        </TutorialProvider>
      </MemoryRouter>
    );

    // Initially null
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();

    // Launch tutorial
    fireEvent.click(screen.getByText('Launch'));
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
    expect(screen.getByText('Command Directive & Mission Briefing')).toBeDefined();
  });

  it('3. TutorialHUDButton toggles popover menu and triggers start tutorial', () => {
    render(
      <MemoryRouter>
        <TutorialProvider autoLoadPersistence={false}>
          <TutorialHUDButton />
          <TutorialOverlay />
        </TutorialProvider>
      </MemoryRouter>
    );

    const hudBtn = screen.getByRole('button', { name: /Tutorial and Handbook Menu/i });
    expect(hudBtn).toBeDefined();

    // Click to open menu
    fireEvent.click(hudBtn);
    expect(screen.getByRole('menu', { name: /Tutorial Options/i })).toBeDefined();

    // Click Start Guided Walkthrough
    const startItem = screen.getByRole('menuitem', { name: /Start Guided Walkthrough/i });
    fireEvent.click(startItem);

    // Overlay dialog should now be visible
    expect(screen.getByTestId('tutorial-dialog')).toBeDefined();
  });

  it('4. keyboard hotkey "?" toggles the HUD menu', () => {
    render(
      <MemoryRouter>
        <TutorialProvider autoLoadPersistence={false}>
          <TutorialHUDButton />
        </TutorialProvider>
      </MemoryRouter>
    );

    expect(screen.queryByRole('menu', { name: /Tutorial Options/i })).toBeNull();

    // Press '?'
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByRole('menu', { name: /Tutorial Options/i })).toBeDefined();

    // Press 'Escape' to close
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /Tutorial Options/i })).toBeNull();
  });

  it('5. RootTutorialLayout integrates provider, overlay, and HUD cleanly', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <RootTutorialLayout />
      </MemoryRouter>
    );

    // HUD button should be present in root layout
    expect(screen.getByTestId('tutorial-hud-container')).toBeDefined();
    // Inactive overlay should be null
    expect(screen.queryByTestId('tutorial-dialog')).toBeNull();
  });
});
