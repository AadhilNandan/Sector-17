// @vitest-environment happy-dom
/**
 * SECTOR 17 — Phase 7.6 / 8.1 Mission Debrief // Final Expedition Report Tests
 * Verifies the archival aerospace parchment dossier:
 * 1. Debrief header and branding typography.
 * 2. Readiness assessment banner & disclaimer.
 * 3. Authoritative outcome banner matching simulation state.
 * 4. Rotated rubber stamp ("RECORD CLOSED", reliability assessment).
 * 5. Dynamic telemetry strip (MET, data resolved, budget exp, anomaly resolution).
 * 6. Engineering decisions narrative.
 * 7. Dynamic science returned narrative based on recorded evidence.
 * 8. Dynamic anomaly findings narrative based on investigation evidence.
 * 9. Lessons learned narrative.
 * 10. 2D trajectory replay diagram.
 * 11. Decision-chain timeline.
 * 12. Non-endorsement disclaimer.
 * 13. Archive expedition action and double-click prevention.
 * 14. Return to main menu navigation.
 * 15. Header back navigation to flight operations console.
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
import { MissionDebriefScreen } from '../src/features/screens/MissionDebriefScreen';

describe('Phase 7.6 / 8.1 Mission Debrief Dossier', () => {
  const CAMPAIGN_ID = 'EXPEDITION-V-DEBRIEF-TEST';

  beforeEach(() => {
    SimulationRuntime.resetAll();
    SimulationRuntime.getOrCreate(CAMPAIGN_ID, { initialState: 'ACTIVE' });
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    vi.restoreAllMocks();
  });

  const renderDebrief = (initialRoute = '/debrief') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <SimulationProvider campaignId={CAMPAIGN_ID}>
          <Routes>
            <Route path="/debrief" element={<MissionDebriefScreen />} />
            <Route path="/operations" element={<div data-testid="operations-screen">Operations Console</div>} />
            <Route path="/" element={<div data-testid="main-menu-screen">Main Menu</div>} />
          </Routes>
        </SimulationProvider>
      </MemoryRouter>
    );
  };

  /* -------------------------------------------------------------------------- */
  /* 1. Header & Typography                                                     */
  /* -------------------------------------------------------------------------- */
  it('1. renders header matching reference with Barlow Condensed and system date', () => {
    renderDebrief();

    expect(screen.getByText('MISSION DEBRIEF')).toBeDefined();
    expect(screen.getByText('BARLOW CONDENSED')).toBeDefined();
    expect(screen.getByText('EXPEDITION-V (EUROPA SURVEY)')).toBeDefined();
    expect(screen.getByText('SYSTEM DATE')).toBeDefined();
    expect(screen.getByText(/DEBRIEF OVERVIEW/)).toBeDefined();
    expect(screen.getByText('[ BACK ]')).toBeDefined();
    expect(screen.getByText('[ SETTINGS ]')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Readiness Assessment & Disclaimer                                       */
  /* -------------------------------------------------------------------------- */
  it('2. displays Sector 17 readiness assessment with concept maturity disclaimer', () => {
    renderDebrief();

    expect(
      screen.getByText(/SECTOR 17 READINESS ASSESSMENT \/\/ PRE-ARCHIVE STATUS/i)
    ).toBeDefined();
    expect(
      screen.getByText(/Inspired by NASA concept maturity levels, NOT an official NASA CML score/i)
    ).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Outcome Headline & Stamp                                                */
  /* -------------------------------------------------------------------------- */
  it('3. renders authoritative mission outcome headline and rotated rubber stamp', () => {
    renderDebrief();

    // The headline corresponds to the real simulation outcome
    expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
    expect(screen.getByText(/OR COMPLETED \/\/ ARCHIVED WITH THE FINAL MISSION STAMP/i)).toBeDefined();
    expect(screen.getByText('RECORD CLOSED')).toBeDefined();
    expect(screen.getByText(/RELIABILITY ASSESS:/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Telemetry Metrics Strip                                                 */
  /* -------------------------------------------------------------------------- */
  it('4. displays authoritative mission telemetry strip (MET, Data, Budget, Anomaly)', () => {
    renderDebrief();

    expect(screen.getByText(/MET:/i)).toBeDefined();
    expect(screen.getByText(/DATA RESOLVED:/i)).toBeDefined();
    expect(screen.getByText(/BUDGET EXP.:/i)).toBeDefined();
    expect(screen.getByText(/ANOMALY RESOLUTION:/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Left Column: Report Narratives (Scientific Integrity)                   */
  /* -------------------------------------------------------------------------- */
  it('5. renders all four engineering and scientific report sections honestly', () => {
    renderDebrief();

    expect(screen.getByText('ENGINEERING DECISIONS')).toBeDefined();
    expect(screen.getByText('SCIENCE RETURNED')).toBeDefined();
    expect(screen.getByText('ANOMALY FINDINGS')).toBeDefined();
    expect(screen.getByText('LESSONS LEARNED')).toBeDefined();

    // In a default initial state without downlinked science data, it must not fabricate discoveries
    expect(screen.getAllByText(/UNKNOWN \/ NOT RECORDED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/UNVERIFIED/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Mission failure analysis|Power and mass margins/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Right Column: 2D Trajectory Replay & Decision Chain                     */
  /* -------------------------------------------------------------------------- */
  it('6. renders 2D Trajectory Replay and Decision-Chain Timeline', () => {
    renderDebrief();

    expect(screen.getByText('2D TRAJECTORY REPLAY')).toBeDefined();
    expect(screen.getByText('JOI')).toBeDefined();
    expect(screen.getByText('EOI')).toBeDefined();

    expect(screen.getByText('DECISION-CHAIN TIMELINE')).toBeDefined();
    expect(screen.getByText(/OBJECTIVE → INSTRUMENT/i)).toBeDefined();
    expect(screen.getByText(/VALIDATION → AETHON/i)).toBeDefined();
    expect(screen.getByText(/ACQUISITION →/i)).toBeDefined();
    expect(screen.getByText(/PROCESSING →/i)).toBeDefined();
    expect(screen.getByText(/RESULTS →/i)).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 7. Footer & Non-endorsement Disclaimer                                     */
  /* -------------------------------------------------------------------------- */
  it('7. displays mandatory non-endorsement disclaimer', () => {
    renderDebrief();

    expect(
      screen.getByText('SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.')
    ).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 8. Archive Expedition Action & Double-Click Protection                     */
  /* -------------------------------------------------------------------------- */
  it('8. clicking archive commits debrief and disables subsequent clicks', () => {
    renderDebrief();

    const archiveBtn = screen.getByText('[ ARCHIVE THIS EXPEDITION ]');
    expect(archiveBtn).toBeDefined();

    act(() => {
      fireEvent.click(archiveBtn);
    });

    // Should now display archived state
    expect(screen.getByText('[ EXPEDITION ARCHIVED ]')).toBeDefined();

    // Clicking again should not crash or trigger duplicate events
    act(() => {
      fireEvent.click(screen.getByText('[ EXPEDITION ARCHIVED ]'));
    });
    expect(screen.getByText('[ EXPEDITION ARCHIVED ]')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 9. Return to Main Menu Navigation                                          */
  /* -------------------------------------------------------------------------- */
  it('9. navigates to main menu on Return to Main Menu click', () => {
    renderDebrief();

    const returnBtn = screen.getByText('[ RETURN TO MAIN MENU ]');
    act(() => {
      fireEvent.click(returnBtn);
    });

    expect(screen.getByTestId('main-menu-screen')).toBeDefined();
  });

  /* -------------------------------------------------------------------------- */
  /* 10. Back Navigation to Flight Operations Console                           */
  /* -------------------------------------------------------------------------- */
  it('10. navigates back to operations console on [ BACK ] click', () => {
    renderDebrief();

    const backBtn = screen.getByText('[ BACK ]');
    act(() => {
      fireEvent.click(backBtn);
    });

    expect(screen.getByTestId('operations-screen')).toBeDefined();
  });
});
