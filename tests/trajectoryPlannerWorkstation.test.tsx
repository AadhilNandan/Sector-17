// @vitest-environment happy-dom
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { TrajectoryPlannerScreen } from '../src/features/screens/TrajectoryPlannerScreen';
import { SimulationRuntime } from '../src/runtime/simulationRuntime';
import { SimulationContext } from '../src/runtime/SimulationContext';
import { ExpeditionProvider } from '../src/context/ExpeditionContext';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Phase 7.3.4: Trajectory Planner // Mission Navigation Workstation', () => {
  let runtime: SimulationRuntime;

  beforeEach(() => {
    vi.clearAllMocks();
    SimulationRuntime.resetAll();
    runtime = SimulationRuntime.getOrCreate('EXPEDITION-V-TRAJECTORY-TEST');
    runtime.acknowledgeBriefing();
    runtime.getCampaignManager().advanceToStage('SPACECRAFT_DESIGN');
    runtime.getCampaignManager().advanceToStage('ENGINEERING_VALIDATION');
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
  });

  const renderPlanner = () => {
    return render(
      <MemoryRouter>
        <SimulationContext.Provider value={runtime}>
          <ExpeditionProvider>
            <TrajectoryPlannerScreen />
          </ExpeditionProvider>
        </SimulationContext.Provider>
      </MemoryRouter>
    );
  };

  it('renders the top header with title, return button, MET, and scale toggle', () => {
    renderPlanner();

    expect(
      screen.getByText(/TRAJECTORY PLANNER \/\/ EXPEDITION-V/i)
    ).toBeDefined();
    expect(screen.getByRole('button', { name: /\[ < RETURN TO WORKSHOP \]/i })).toBeDefined();
    expect(screen.getByText(/MET:/i)).toBeDefined();
    expect(screen.getByText(/\[ SCHEMATIC \]/i)).toBeDefined();
    expect(screen.getByText(/TRUE/i)).toBeDefined();
  });

  it('toggles scale mode between Schematic and True', () => {
    renderPlanner();

    const trueBtn = screen.getByRole('button', { name: /^TRUE$/i });
    fireEvent.click(trueBtn);
    expect(screen.getByText(/Physical proportional scale active/i)).toBeDefined();

    const schematicBtn = screen.getByRole('button', { name: /\[ SCHEMATIC \]/i });
    fireEvent.click(schematicBtn);
    expect(screen.getByText(/Schematic scale enabled for visualization/i)).toBeDefined();
  });

  it('renders the Maneuver List panel with sequence items and delta-v values', () => {
    renderPlanner();

    expect(screen.getByText(/MANOEUVRE LIST/i)).toBeDefined();
    expect(screen.getByText(/JOI BURN/i)).toBeDefined();
    expect(screen.getAllByText(/Δv:/i).length).toBeGreaterThanOrEqual(1);
  });

  it('supports selecting a maneuver and adjusting prograde/normal delta-v', () => {
    renderPlanner();

    const joiOption = screen.getByText(/JOI BURN/i);
    fireEvent.click(joiOption);

    expect(screen.getByText(/\[ ADJUST MANOEUVRE \]/i)).toBeDefined();
    expect(screen.getByText(/PROGRADE/i)).toBeDefined();
    expect(screen.getByText(/RETROGRADE/i)).toBeDefined();
    expect(screen.getByText(/^NORMAL$/i)).toBeDefined();
    expect(screen.getByText(/^ANTINORMAL$/i)).toBeDefined();
  });

  it('allows switching between scenario comparison modes', () => {
    renderPlanner();

    expect(screen.getByText(/SCENARIO COMPARISON/i)).toBeDefined();
    const optBtn = screen.getByRole('button', { name: /\[ OPTIMIZED Δv \]/i });
    fireEvent.click(optBtn);
    expect(optBtn.className).toContain('text-[#7FB7D4]');

    const highThrustBtn = screen.getByRole('button', { name: /\[ HIGH THRUST \]/i });
    fireEvent.click(highThrustBtn);
    expect(highThrustBtn.className).toContain('text-[#7FB7D4]');
  });

  it('validates planned maneuver and displays validation status banner', () => {
    renderPlanner();

    const validateBtn = screen.getByRole('button', { name: /\[ VALIDATE \]/i });
    fireEvent.click(validateBtn);

    expect(screen.getByText(/VALIDATION:/i)).toBeDefined();
  });

  it('renders the bottom mission timeline bar with day ticks, milestones, and telemetry', () => {
    renderPlanner();

    expect(screen.getByText(/MET DAY 180 to 195/i)).toBeDefined();
    expect(screen.getByText(/AETHON ARRIVAL/i)).toBeDefined();
    expect(screen.getByText(/EUROPA INFLUENCE/i)).toBeDefined();
    expect(screen.getByText(/ROVER DEPLOYMENT/i)).toBeDefined();
    expect(screen.getByText(/DISTANCE TO EUROPA:/i)).toBeDefined();
    expect(screen.getByText(/SPEED:/i)).toBeDefined();
  });

  it('renders viewport annotations: TMI, JOI, EOC, Europa target, and closest approach', () => {
    renderPlanner();

    expect(screen.getByText(/TMI BURN/i)).toBeDefined();
    expect(screen.getByText(/JOI \(JUPITER ORBIT INSERTION\)/i)).toBeDefined();
    expect(screen.getByText(/EOC \(EUROPA ORBIT INSERTION\) BURN/i)).toBeDefined();
    expect(screen.getAllByText(/TARGET: EUROPA/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/CLOSEST APPROACH: 420 km/i)).toBeDefined();
    expect(screen.getByText(/GIMBAL COMPASS/i)).toBeDefined();
  });

  it('supports layer toggles: Delta-V, Comm Windows, Radiation, and Follow Aethon', () => {
    renderPlanner();

    const radBtn = screen.getByRole('button', { name: /\[ RADIATION ON \]/i });
    fireEvent.click(radBtn);
    expect(screen.getByRole('button', { name: /\[ RADIATION OFF \]/i })).toBeDefined();

    const followBtn = screen.getByRole('button', { name: /FOLLOW AETHON/i });
    fireEvent.click(followBtn);
    expect(followBtn.className).toContain('text-[#7FB7D4]');
  });

  it('opens and closes the NASA/JPL scientific references modal', () => {
    renderPlanner();

    const refBtn = screen.getByRole('button', { name: /NASA References/i });
    fireEvent.click(refBtn);

    expect(screen.getByText(/NASA \/ JPL Scientific Resources & Ephemeris Attribution/i)).toBeDefined();
    expect(screen.getAllByText(/NASA Eyes on the Solar System/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/JPL Horizons On-Line Solar System Data Service/i)).toBeDefined();
    expect(screen.getByText(/NASA NAIF SPICE/i)).toBeDefined();
    expect(screen.getByText(/General Mission Analysis Tool/i)).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /Close References/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/NASA \/ JPL Scientific Resources & Ephemeris Attribution/i)).toBeNull();
  });

  it('clicking Return to Workshop navigates to /workshop', () => {
    renderPlanner();

    const returnBtn = screen.getByRole('button', { name: /\[ < RETURN TO WORKSHOP \]/i });
    fireEvent.click(returnBtn);

    expect(mockNavigate).toHaveBeenCalledWith('/workshop');
  });

  it('renders projected 3D world-to-screen annotations with translate3d positioning', () => {
    renderPlanner();

    const aethonBadge = screen.getByText(/^YOU ARE$/i).closest('.will-change-transform');
    expect(aethonBadge).toBeDefined();
    expect(aethonBadge?.getAttribute('style')).toContain('translate3d');

    const joiBadge = screen.getByText(/JOI \(JUPITER ORBIT INSERTION\)/i).closest('.will-change-transform');
    expect(joiBadge).toBeDefined();
    expect(joiBadge?.getAttribute('style')).toContain('translate3d');
  });

  it('displays true physical scale optical targeting indicator when True Scale mode is activated', () => {
    renderPlanner();

    const trueBtn = screen.getByRole('button', { name: /^TRUE$/i });
    fireEvent.click(trueBtn);

    expect(screen.getByText(/\[ ⌖ 1:1 TRUE SCALE \]/i)).toBeDefined();
  });
});
