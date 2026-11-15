// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SpacecraftWorkshopScreen } from '../src/features/screens/SpacecraftWorkshopScreen';
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

describe('Phase 7.3.3: Spacecraft Workshop — Engineering Configuration Bay', () => {
  let runtime: SimulationRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    SimulationRuntime.resetAll();
    runtime = SimulationRuntime.getOrCreate('EXPEDITION-V-WORKSHOP-TEST');
    runtime.acknowledgeBriefing();
    runtime.getCampaignManager().advanceToStage('SPACECRAFT_DESIGN');
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
  });

  const renderWorkshop = () => {
    return render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <ExpeditionProvider>
            <SpacecraftWorkshopScreen />
          </ExpeditionProvider>
        </SimulationContext.Provider>
      </MemoryRouter>
    );
  };

  it('renders the warm ivory header, return button, title, and countdown', () => {
    renderWorkshop();

    expect(
      screen.getByText(/EXPEDITION-V: EUROPA SURVEY \/\/ SPACECRAFT AETHON CONFIGURATION/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /\[ < RETURN TO ARCHIVE \]/i })).toBeDefined();
    expect(screen.getByText(/T-MINUS/i)).toBeDefined();
  });

  it('renders the Sector 17 readiness maturity strip with Point Design active', () => {
    renderWorkshop();

    expect(screen.getByText(/SECTOR 17 READINESS/i)).toBeDefined();
    expect(screen.getByText(/\[ Point Design \]/i)).toBeDefined();
  });

  it('renders the Component Catalogue with expandable subsystem disciplines', () => {
    renderWorkshop();

    expect(screen.getByText(/COMPONENT CATALOGUE \/\/ DISCIPLINE FILTER/i)).toBeDefined();
    expect(screen.getAllByText('POWER').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PROPULSION')).toBeDefined();
    expect(screen.getByText('INSTRUMENTS')).toBeDefined();
  });

  it('renders Resource Budgets & Constraint Checker with live telemetry metrics', () => {
    renderWorkshop();

    expect(screen.getByText(/RESOURCE BUDGETS & CONSTRAINT CHECKER/i)).toBeDefined();
    expect(screen.getByText('THERMAL EQUILIBRIUM')).toBeDefined();
    expect(screen.getByText(/PROPULSION \/ DELTA-V/i)).toBeDefined();
    expect(screen.getByText(/CONSEQUENCES & CRITICAL FAULTS/i)).toBeDefined();
    expect(screen.getByText(/Launch-mass ceiling limit/i)).toBeDefined();
  });

  it('supports selecting different launch vehicles from the right panel', () => {
    renderWorkshop();

    expect(screen.getByText(/LAUNCH VEHICLE SELECTION/i)).toBeDefined();
    const falconOption = screen.getByText(/Falcon Heavy Exp/i);
    expect(falconOption).toBeDefined();

    fireEvent.click(falconOption);
    expect(screen.getByText(/6,200 kg/i)).toBeDefined();
  });

  it('opens and closes the Configuration Comparison diff modal', () => {
    renderWorkshop();

    const compareBtn = screen.getByRole('button', { name: /\[ SHOW PREVIOUS vs\. CURRENT \]/i });
    fireEvent.click(compareBtn);

    expect(screen.getByText(/AETHON \/\/ BASELINE vs\. CURRENT CONFIGURATION DIFF/i)).toBeDefined();
    expect(screen.getByText(/Mass Delta/i)).toBeDefined();
    expect(screen.getByText(/Net Power Delta/i)).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /Close Diff/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/AETHON \/\/ BASELINE vs\. CURRENT CONFIGURATION DIFF/i)).toBeNull();
  });

  it('camera view preset buttons update active drafting view mode', () => {
    renderWorkshop();

    const frontBtn = screen.getByRole('button', { name: /front/i });
    fireEvent.click(frontBtn);
    expect(frontBtn.className).toContain('text-[#7FB7D4]');

    const isoBtn = screen.getByRole('button', { name: /3\/4 ISO/i });
    fireEvent.click(isoBtn);
    expect(isoBtn.className).toContain('text-[#7FB7D4]');
  });

  it('clicking Validate and Lock Configuration advances campaign to ENGINEERING_VALIDATION and navigates to /trajectory', () => {
    renderWorkshop();

    const lockBtn = screen.getByRole('button', { name: /\[ VALIDATE AND LOCK CONFIGURATION \]/i });
    expect(lockBtn).toBeDefined();
    expect(lockBtn).not.toHaveProperty('disabled', true);

    fireEvent.click(lockBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/trajectory');
    const stageId = runtime.getCampaignManager().getCurrentStageId();
    expect(['ENGINEERING_VALIDATION', 'MISSION_READINESS']).toContain(stageId);
  });

  it('clicking Return to Archive navigates to /missions', () => {
    renderWorkshop();

    const returnBtn = screen.getByRole('button', { name: /\[ < RETURN TO ARCHIVE \]/i });
    fireEvent.click(returnBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/missions');
  });

  it('guarantees unobstructed 3D viewport: no floating PREVIEWING label and no BoxHelper in model graph', async () => {
    const { createAethonEngineeringModel } = await import(
      '../src/features/spacecraft-workshop/components/AethonEngineeringMesh'
    );
    const bundle = createAethonEngineeringModel();

    // Verify no BoxHelper attached to rootGroup
    const boxHelpers = bundle.rootGroup.children.filter((child) => child.type === 'BoxHelper');
    expect(boxHelpers.length).toBe(0);
    bundle.dispose();

    renderWorkshop();

    // Verify no floating preview text rendered in DOM
    expect(screen.queryByText(/PREVIEWING:/i)).toBeNull();
    expect(screen.queryByText(/INSTALLATION \]/i)).toBeNull();
  });
});
