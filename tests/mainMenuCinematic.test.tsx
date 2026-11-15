// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MainMenuScreen } from '../src/features/screens/MainMenuScreen';
import { MainMenuSceneFallback } from '../src/features/main-menu/components/MainMenuSceneFallback';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationContext } from '../src/runtime/SimulationContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Phase 7.3.1: Cinematic Main Menu & 3D Space Scene', () => {
  let runtime: SimulationRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }
    runtime = SimulationRuntime.getOrCreate('EXPEDITION-V-TEST-MENU');
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
  });

  it('renders the authoritative title block and subtitle matching the reference image', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /SECTOR 17/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: /THE LAST EXPEDITION/i })).toBeDefined();
    expect(screen.getByText(/MISSION EXPEDITION-V \(EUROPA SURVEY\)/i)).toBeDefined();
  });

  it('removes unnecessary corner technical text while preserving central orientation marker and legal disclaimer', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    // Verify unnecessary technical labels are removed
    expect(screen.queryByText(/VIEW: INTRO_AETHON_CAM_01/i)).toBeNull();
    expect(screen.queryByText(/ORBITAL STATUS: COLD/i)).toBeNull();
    expect(screen.queryByText(/VERSION 1\.0\.4-BETA/i)).toBeNull();
    expect(screen.queryByText(/SIM_ENGINE_ACTIVE/i)).toBeNull();

    // Verify central orientation marker is preserved
    expect(screen.getByText('▽')).toBeDefined();

    // Verify legal disclaimer is preserved
    expect(
      screen.getByText(/SECTOR 17 is an independent project\. NASA does not endorse SECTOR 17\./i)
    ).toBeDefined();

    // Verify top-right sound control button is preserved
    expect(screen.getByTitle(/Toggle Sound/i)).toBeDefined();
  });

  it('displays Continue as disabled when no campaign save exists', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    const continueBtn = screen.getByRole('button', { name: /Continue/i });
    expect(continueBtn).toHaveProperty('disabled', true);
  });

  it('navigates to /missions when New Expedition is activated', () => {
    const ackSpy = vi.spyOn(runtime, 'acknowledgeBriefing');

    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    const newExpeditionBtn = screen.getByRole('button', { name: /New Expedition/i });
    fireEvent.click(newExpeditionBtn);

    expect(ackSpy).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/missions');
  });

  it('opens and closes the Settings modal with graphics and HUD scale controls', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    const settingsBtn = screen.getByRole('button', { name: /Settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeDefined();
    expect(screen.getByText(/3D GRAPHICS & SCENE FIDELITY/i)).toBeDefined();
    expect(screen.getByText(/HUD CALIPER & SCALE/i)).toBeDefined();

    // Close modal
    const applyBtn = screen.getByRole('button', { name: /Apply & Return/i });
    fireEvent.click(applyBtn);

    expect(screen.queryByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeNull();
  });

  it('opens and closes the Credits modal displaying mission architecture and legal notice', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    const creditsBtn = screen.getByRole('button', { name: /Credits/i });
    fireEvent.click(creditsBtn);

    expect(screen.getByText(/EXPEDITION RECORD \/\/ MISSION CREDITS/i)).toBeDefined();
    expect(screen.getByText(/SCIENTIFIC REFERENCES & INSPIRATION/i)).toBeDefined();
    expect(screen.getByText(/LEGAL & TRADEMARK NOTICE/i)).toBeDefined();

    // Close credits
    const closeBtn = screen.getByRole('button', { name: /Close Credits/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/EXPEDITION RECORD \/\/ MISSION CREDITS/i)).toBeNull();
  });

  it('supports full keyboard navigation (Arrow keys and Enter)', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    // Initially "New Expedition" is active. Press ArrowDown to select Settings.
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Press Enter to open Settings
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(screen.getByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeDefined();

    // Press Escape to close modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeNull();
  });

  it('renders high-fidelity MainMenuSceneFallback without errors', () => {
    const { container } = render(<MainMenuSceneFallback />);
    expect(screen.getByTestId('main-menu-fallback')).toBeDefined();
    expect(container.querySelector('svg')).toBeDefined();
  });

  it('renders the official full-screen hero background image without duplicate 3D meshes', () => {
    render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <MainMenuScreen />
        </SimulationContext.Provider>
      </MemoryRouter>
    );

    const bgContainer = screen.getByTestId('main-menu-hero-bg');
    expect(bgContainer).toBeDefined();

    const img = screen.getByAltText(/AETHON Spacecraft in Jupiter Orbit/i) as HTMLImageElement;
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/assets/images/main_menu_hero.png');
    expect(img.className).toContain('object-cover');
    expect(img.className).toContain('object-center');
  });
});
