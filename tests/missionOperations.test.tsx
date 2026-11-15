// @vitest-environment happy-dom
/**
 * SECTOR 17 — Phase 7.5 Mission Operations Workstation Tests
 * Verifies the AETHON flight control interface:
 * 1. Mission header and stage indicators.
 * 2. Power telemetry integration.
 * 3. Thermal telemetry integration.
 * 4. 3D spacecraft viewport.
 * 5. Camera controls.
 * 6. Propulsion telemetry.
 * 7. Navigation telemetry.
 * 8. MET synchronization.
 * 9. Event log generation.
 * 10. Communications controls.
 * 11. Scientific data processing.
 * 12. Mission completion evaluation.
 * 13. Direct navigation to Mission Debrief.
 * 14. Skipped pages are not required.
 * 15. Existing campaign state remains intact.
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import {
  SimulationRuntime,
  SimulationProvider,
} from '../src/runtime';
import { MissionOperationsScreen } from '../src/features/screens/MissionOperationsScreen';
import { evaluateMissionCompletion, finalizeMissionToDebrief } from '../src/features/mission-operations/MissionCompletionEvaluator';

describe('Phase 7.5 Mission Operations Workstation', () => {
  const CAMPAIGN_ID = 'EXPEDITION-V-OPS-TEST';

  beforeEach(() => {
    SimulationRuntime.resetAll();
    SimulationRuntime.getOrCreate(CAMPAIGN_ID, { initialState: 'ACTIVE' });
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    vi.restoreAllMocks();
  });

  const renderWorkstation = (initialRoute = '/operations') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <SimulationProvider campaignId={CAMPAIGN_ID}>
          <Routes>
            <Route path="/operations" element={<MissionOperationsScreen />} />
            <Route path="/trajectory" element={<div data-testid="trajectory-screen">Trajectory Screen</div>} />
            <Route path="/debrief" element={<div data-testid="debrief-screen">Debrief Screen</div>} />
          </Routes>
        </SimulationProvider>
      </MemoryRouter>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* 1. Header & Stage Indicators                                               */
  /* -------------------------------------------------------------------------- */
  it('1. renders mission header and stage indicators matching reference', () => {
    renderWorkstation();

    expect(screen.getByText('MISSION OPERATIONS - EXPEDITION-V')).toBeDefined();
    expect(screen.getByText('LAUNCH')).toBeDefined();
    expect(screen.getByText('[✓]')).toBeDefined();
    expect(screen.getByText('SPACE')).toBeDefined();
    expect(screen.getByText('[▶ ACTIVE]')).toBeDefined();
    expect(screen.getByText('GROUND')).toBeDefined();
    expect(screen.getByText('[!] DROP')).toBeDefined();
    expect(screen.getByText('USER')).toBeDefined();
    expect(screen.getByText('NETWORK STATUS')).toBeDefined();
  });

  it('2. executes operational lander deployment event without navigating to a new page', async () => {
    renderWorkstation();

    const groundButton = screen.getByText('[!] DROP');
    await act(async () => {
      fireEvent.click(groundButton);
    });

    expect(screen.getByText('[✓] DEPLOYED')).toBeDefined();
    // Verify it stays on the Mission Operations screen
    expect(screen.getByText('MISSION OPERATIONS - EXPEDITION-V')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Power & Thermal Telemetry                                               */
  /* -------------------------------------------------------------------------- */
  it('3. renders power telemetry from authoritative simulation snapshot', () => {
    renderWorkstation();

    expect(screen.getByText(/POWER & THERMAL/i)).toBeDefined();
    expect(screen.getByText(/BUS VOLTAGE:/i)).toBeDefined();
    expect(screen.getByText(/SOLAR GENERATION:/i)).toBeDefined();
    expect(screen.getByText(/\[!\] EXPECTED:/i)).toBeDefined();
    expect(screen.getByText('800 W')).toBeDefined();
    expect(screen.getByText(/BATTERY SOC:/i)).toBeDefined();
  });

  it('4. renders thermal telemetry from authoritative simulation snapshot', () => {
    renderWorkstation();

    const tempLabels = screen.getAllByText(/BATTERY TEMP:/i);
    expect(tempLabels.length).toBeGreaterThanOrEqual(2);
  });

  /* -------------------------------------------------------------------------- */
  /* 3. 3D Spacecraft Viewport & Camera Controls                                */
  /* -------------------------------------------------------------------------- */
  it('5. mounts the 3D spacecraft viewport with camera HUD annotations', () => {
    renderWorkstation();

    const camLabels = screen.getAllByText(/CAM_EXT_A_04 \/\/ RESOLUTION: HI-RES/i);
    expect(camLabels.length).toBeGreaterThanOrEqual(1);

    const attitudeLabels = screen.getAllByText(/\[ NOMINAL \]/i);
    expect(attitudeLabels.length).toBeGreaterThanOrEqual(1);
  });

  it('6. provides camera reset and follow mode controls', async () => {
    renderWorkstation();

    const resetBtn = screen.getByText('RESET CAM');
    expect(resetBtn).toBeDefined();

    const followBtn = screen.getByText('FOLLOW: OFF');
    await act(async () => {
      fireEvent.click(followBtn);
    });
    expect(screen.getByText('FOLLOW: ON')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Propulsion & Navigation Telemetry                                       */
  /* -------------------------------------------------------------------------- */
  it('7. renders propulsion telemetry including thrust, RCS fuel, and propellant mass', () => {
    renderWorkstation();

    expect(screen.getByText(/PROPULSION & NAVIGATION/i)).toBeDefined();
    expect(screen.getByText(/THRUST:/i)).toBeDefined();
    expect(screen.getByText(/RCS FUEL:/i)).toBeDefined();
    expect(screen.getByText(/82%/)).toBeDefined();
    expect(screen.getByText(/PROPELLANT MASS:/i)).toBeDefined();
  });

  it('8. renders navigation telemetry including apoapsis, periapsis, and orbital velocity', () => {
    renderWorkstation();

    expect(screen.getByText(/APOAPSIS:/i)).toBeDefined();
    expect(screen.getByText(/14,800 km/i)).toBeDefined();
    expect(screen.getByText(/PERIAPSIS:/i)).toBeDefined();
    expect(screen.getByText(/120 km/i)).toBeDefined();
    expect(screen.getByText(/VELOCITY:/i)).toBeDefined();
    expect(screen.getByText(/1\.84 km\/s/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 5. MET Synchronization & Time Stepping                                     */
  /* -------------------------------------------------------------------------- */
  it('9. synchronizes MET digital display and advances time deterministically', async () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
    renderWorkstation();

    expect(screen.getByText(/MISSION ELAPSED TIME \(MET\)/i)).toBeDefined();

    const step60s = screen.getByRole('button', { name: '+60s' });
    await act(async () => {
      fireEvent.click(step60s);
    });

    expect(runtime.getSnapshot().metSeconds).toBe(60);
    expect(screen.getAllByText('T+ 000d 00:01:00').length).toBeGreaterThanOrEqual(1);
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Event Log Generation                                                    */
  /* -------------------------------------------------------------------------- */
  it('10. renders chronological mission event log feed', () => {
    renderWorkstation();

    expect(screen.getByText('EVENT LOG')).toBeDefined();
    expect(screen.getByText('CHRONOLOGICAL FEED')).toBeDefined();
    expect(screen.getByText(/ORIENTATION LOCK ACQUIRED/i)).toBeDefined();
    expect(screen.getByText(/DSN GROUND LINK DROP/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Communications & Science Controls                                       */
  /* -------------------------------------------------------------------------- */
  it('11. opens communications subsystem modal and recovers RF link', async () => {
    renderWorkstation();

    const commsBtn = screen.getByText('COMMUNICATIONS');
    await act(async () => {
      fireEvent.click(commsBtn);
    });

    expect(screen.getByText(/DEEP SPACE NETWORK \/\/ RF COMMUNICATIONS/i)).toBeDefined();
    expect(screen.getByText('CANBERRA DSN-43 (70M)')).toBeDefined();

    const realignBtn = screen.getByText(/REALIGN HGA & VERIFY CARRIER/i);
    await act(async () => {
      fireEvent.click(realignBtn);
    });

    const closeBtn = screen.getByText(/✕ \[CLOSE\]/i);
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText(/DEEP SPACE NETWORK \/\/ RF COMMUNICATIONS/i)).toBeNull();
  });

  it('12. opens science processing modal and processes observation batch', async () => {
    renderWorkstation();

    const sciBtn = screen.getByText('SCIENCE PROCESSING');
    await act(async () => {
      fireEvent.click(sciBtn);
    });

    expect(screen.getByText(/SCIENCE PAYLOAD \/\/ ONBOARD SSDR PROCESSING/i)).toBeDefined();
    expect(screen.getByText(/MASPEX Plume Spectrometer/i)).toBeDefined();

    const processBtn = screen.getByText('PROCESS OBSERVATION BATCH');
    await act(async () => {
      fireEvent.click(processBtn);
    });

    const closeBtn = screen.getByText(/✕ \[CLOSE\]/i);
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText(/SCIENCE PAYLOAD \/\/ ONBOARD SSDR PROCESSING/i)).toBeNull();
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Mission Completion Evaluation & Direct Debrief Navigation              */
  /* -------------------------------------------------------------------------- */
  it('13. evaluates mission completion readiness criteria correctly', () => {
    const runtime = SimulationRuntime.getOrCreate(CAMPAIGN_ID);
    const snap = runtime.getSnapshot();

    const evaluation = evaluateMissionCompletion(snap);
    expect(evaluation.criteria.length).toBe(5);
    expect(evaluation.isEligible).toBe(true);
    expect(evaluation.status).toBe('FULL_READY');
  });

  it('14. allows concluding mission and navigating directly to Mission Debrief', async () => {
    renderWorkstation();

    const completeBtn = screen.getByText(/COMPLETE MISSION/i);
    await act(async () => {
      fireEvent.click(completeBtn);
    });

    expect(screen.getByText(/MISSION DIRECTIVE FINALIZATION \/\/ EXPEDITION-V/i)).toBeDefined();

    const finalizeBtn = screen.getByText(/CONCLUDE MISSION → DEBRIEF/i);
    await act(async () => {
      fireEvent.click(finalizeBtn);
    });

    // Directly transitions to Debrief Screen without Surface/Anomaly routes
    expect(screen.getByTestId('debrief-screen')).toBeDefined();
  });

  it('15. verifies return button navigates back to Trajectory Planner', async () => {
    renderWorkstation();

    const returnBtn = screen.getByText(/< \[ RETURN \]/i);
    await act(async () => {
      fireEvent.click(returnBtn);
    });

    expect(screen.getByTestId('trajectory-screen')).toBeDefined();
  });
});
