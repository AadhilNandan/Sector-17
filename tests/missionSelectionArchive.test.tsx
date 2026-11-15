// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { MissionSelectionScreen } from '../src/features/screens/MissionSelectionScreen';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationContext } from '../src/runtime/SimulationContext';
import { ExpeditionProvider } from '../src/context/ExpeditionContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Phase 7.3.2: Mission Selection — Expedition Archive', () => {
  let runtime: SimulationRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    SimulationRuntime.resetAll();
    runtime = SimulationRuntime.getOrCreate('EXPEDITION-V-ARCHIVE-TEST');
    runtime.acknowledgeBriefing();
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
  });

  const renderScreen = () => {
    return render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <ExpeditionProvider>
            <MissionSelectionScreen />
          </ExpeditionProvider>
        </SimulationContext.Provider>
      </MemoryRouter>
    );
  };

  it('renders the header with title, return button, settings, and system time', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: /EXPEDITION ARCHIVE/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\[ < RETURN \]/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /\[ SETTINGS \]/i })).toBeDefined();
    expect(screen.getByText(/SYSTEM TIME/i)).toBeDefined();
  });

  it('renders all three physical expedition dossiers matching the reference image', () => {
    renderScreen();

    // Titles
    expect(screen.getByRole('heading', { level: 2, name: /EXPEDITION-III/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: /EXPEDITION-IV/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: /EXPEDITION-V/i })).toBeDefined();

    // Destinations
    expect(screen.getByRole('heading', { level: 3, name: /GANYMEDE/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: /CALLISTO/i })).toBeDefined();
    expect(screen.getByRole('heading', { level: 3, name: /EUROPA SURVEY/i })).toBeDefined();

    // Physical outcome stamps
    expect(screen.getByText('COMPLETED')).toBeDefined();
    expect(screen.getByText('PARTIAL FAILURE')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();

    // Handwritten annotation on Expedition-IV
    expect(screen.getByText(/Telemetry lost at 80m/i)).toBeDefined();

    // Four mission segments on cards
    const launchLabels = screen.getAllByText('LAUNCH');
    expect(launchLabels.length).toBe(3);
    const spaceLabels = screen.getAllByText('SPACE');
    expect(spaceLabels.length).toBe(3);
    const groundLabels = screen.getAllByText('GROUND');
    expect(groundLabels.length).toBe(3);
    const userLabels = screen.getAllByText('USER');
    expect(userLabels.length).toBe(3);
  });

  it('defaults to selecting EXPEDITION-V and updates the footer accordingly', () => {
    renderScreen();

    const beginBtn = screen.getByRole('button', { name: /BEGIN EXPEDITION/i });
    expect(beginBtn).toBeDefined();

    // Footer shows EXPEDITION-V info
    expect(screen.getByText(/SELECTED:/i)).toBeDefined();
    expect(screen.getByText(/READY FOR LAUNCH/i)).toBeDefined();
  });

  it('selecting a historical dossier updates footer and disables Begin Expedition', () => {
    renderScreen();

    // Click on EXPEDITION-III
    const exp3Card = screen.getByRole('heading', { level: 2, name: /EXPEDITION-III/i });
    fireEvent.click(exp3Card);

    // Footer now displays historical vessel and read-only button
    expect(screen.getByText(/HERMES-II/i)).toBeDefined();
    const readOnlyBtn = screen.getByRole('button', { name: /\[ HISTORICAL ARCHIVE — READ ONLY \]/i });
    expect(readOnlyBtn).toBeDefined();
    expect(readOnlyBtn).toHaveProperty('disabled', true);

    // Clicking readOnlyBtn does not navigate
    fireEvent.click(readOnlyBtn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('clicking Begin Expedition on Expedition-V advances stage and navigates to /workshop', () => {
    renderScreen();

    const beginBtn = screen.getByRole('button', { name: /BEGIN EXPEDITION/i });
    fireEvent.click(beginBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/workshop');
    expect(runtime.getCampaignManager().getCurrentStageId()).toBe('SPACECRAFT_DESIGN');
  });

  it('clicking Return navigates to Main Menu /', () => {
    renderScreen();

    const returnBtn = screen.getByRole('button', { name: /\[ < RETURN \]/i });
    fireEvent.click(returnBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('opens and closes the Settings modal', () => {
    renderScreen();

    const settingsBtn = screen.getByRole('button', { name: /\[ SETTINGS \]/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeDefined();

    const applyBtn = screen.getByRole('button', { name: /Apply & Return/i });
    fireEvent.click(applyBtn);

    expect(screen.queryByText(/SYSTEM CONFIGURATION \/\/ FLIGHT TERMINAL/i)).toBeNull();
  });

  it('supports keyboard navigation across dossiers', () => {
    renderScreen();

    // Initially expedition-5 is selected. ArrowRight wraps to expedition-3.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/\[ HISTORICAL ARCHIVE — READ ONLY \]/i)).toBeDefined();

    // ArrowRight moves to expedition-4
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText(/ORION-IV/i)).toBeDefined();

    // ArrowRight moves back to expedition-5
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /BEGIN EXPEDITION/i })).toBeDefined();

    // Enter activates Begin Expedition
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(mockNavigate).toHaveBeenCalledWith('/workshop');
  });
});
