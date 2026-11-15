// @vitest-environment happy-dom
/**
 * SECTOR 17 — Live Mission Dashboard Integration & StrictMode Verification Tests
 * Verifies live UI telemetry mapping, simulation time stepping controls, fault reflection,
 * resource consumption updates, DATA UNAVAILABLE handling, route navigation state preservation,
 * and React StrictMode double-mounting stability (closing Phase 6.1 Audit Finding C-01).
 */

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { StrictMode } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';

import * as runtimeModule from '../src/runtime';
import {
  SimulationRuntime,
  SimulationProvider,
} from '../src/runtime';
import type { PropulsionSubsystem } from '../src/simulation/flightSoftware/subsystemManager';
import { MissionOperationsScreen } from '../src/features/screens/MissionOperationsScreen';
import { SimulationControlBar } from '../src/features/screens/operations/SimulationControlBar';
import { SubsystemsPanel } from '../src/features/screens/operations/SubsystemsPanel';
import { PowerThermalPanel } from '../src/features/screens/operations/PowerThermalPanel';
import { PropulsionStoragePanel } from '../src/features/screens/operations/PropulsionStoragePanel';
import { CommunicationsPanel } from '../src/features/screens/operations/CommunicationsPanel';
import { MissionObjectivesPanel } from '../src/features/screens/operations/MissionObjectivesPanel';
import { MissionEventLogPanel } from '../src/features/screens/operations/MissionEventLogPanel';

describe('Phase 6.2 Live Mission Dashboard Verification', () => {
  const TEST_CAMPAIGN = 'EXPEDITION-V-TEST';

  beforeEach(() => {
    SimulationRuntime.resetAll();
    SimulationRuntime.getOrCreate(TEST_CAMPAIGN, { initialState: 'ACTIVE' });
  });

  afterEach(() => {
    cleanup();
    SimulationRuntime.resetAll();
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* 1. Component Rendering & Authoritative Snapshot Mapping                   */
  /* -------------------------------------------------------------------------- */
  describe('1. Live Dashboard Component Rendering', () => {
    it('renders the Mission Operations screen with live simulation snapshot telemetry', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <MemoryRouter initialEntries={['/operations']}>
          <SimulationProvider campaignId={TEST_CAMPAIGN}>
            <MissionOperationsScreen />
          </SimulationProvider>
        </MemoryRouter>
      );

      // Verify header / title and mission details
      expect(screen.getByText(/SECTOR 17 · LIVE MISSION OPERATIONS/i)).toBeDefined();
      expect(screen.getByText(/EXPEDITION-V — THE EUROPA SURVEY/i)).toBeDefined();

      // Verify formatted MET initially at T+ 000d 00:00:00 (present in header and control bar)
      const metElements = screen.getAllByText('T+ 000d 00:00:00');
      expect(metElements.length).toBeGreaterThanOrEqual(1);

      // Verify flight state and runtime state badges
      expect(screen.getByText('ACTIVE')).toBeDefined();
      expect(screen.getByText('READY')).toBeDefined();

      // Verify core subsystems are rendered
      expect(screen.getAllByText(/Electrical Power/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Main Propulsion/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Thermal Control/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/RF Communications/i).length).toBeGreaterThanOrEqual(1);

      // Verify authoritative propellant mass displayed (2450.0 kg initial)
      expect(screen.getAllByText(/2450\.0/)[0]).toBeDefined();

      // Verify tab navigation buttons
      expect(screen.getByText(/Full HUD/i)).toBeDefined();
      expect(screen.getByText(/Engineering/i)).toBeDefined();
      expect(screen.getByText(/Comms\/Storage/i)).toBeDefined();
      expect(screen.getAllByText(/Objectives/i).length).toBeGreaterThanOrEqual(1);
    });

    it('renders detailed subsystem metrics and operational states accurately', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SubsystemsPanel />
        </SimulationProvider>
      );

      // Verify all 6 subsystem headings are present
      expect(screen.getByText('Electrical Power')).toBeDefined();
      expect(screen.getByText('Main Propulsion')).toBeDefined();
      expect(screen.getByText('Thermal Control')).toBeDefined();
      expect(screen.getByText('RF Communications')).toBeDefined();
      expect(screen.getByText('Solid-State Recorder')).toBeDefined();
      expect(screen.getByText('Science Payload')).toBeDefined();

      // Verify initial nominal operational state badges
      const nominalBadges = screen.getAllByText('NOMINAL');
      expect(nominalBadges.length).toBeGreaterThanOrEqual(5);
    });

    it('renders power and thermal balance values from the physics models', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <PowerThermalPanel />
        </SimulationProvider>
      );

      // Verify power panel titles and generation
      expect(screen.getByText('Electrical Power')).toBeDefined();
      expect(screen.getByText('Generation & Load Budget')).toBeDefined();
      expect(screen.getByText('Generation')).toBeDefined();
      expect(screen.getByText('Net Margin')).toBeDefined();

      // Verify thermal panel titles and equilibrium temperature
      expect(screen.getByText('Thermal Balance')).toBeDefined();
      expect(screen.getByText('Equilibrium Model (Stefan-Boltzmann)')).toBeDefined();
      expect(screen.getByText('Equilibrium Temp')).toBeDefined();
    });

    it('renders communications and visible ground stations', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <CommunicationsPanel />
        </SimulationProvider>
      );

      expect(screen.getByText('Communications & DSN')).toBeDefined();
      expect(screen.getByText('Deep Space Network Ground Visibility')).toBeDefined();
      expect(screen.getByText('DSN Link Window')).toBeDefined();
      expect(screen.getByText(/Visible Ground Stations:/i)).toBeDefined();
    });

    it('renders mission objectives with priority and blocking status', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <MissionObjectivesPanel />
        </SimulationProvider>
      );

      expect(screen.getByText('Mission Objectives')).toBeDefined();
      expect(screen.getByText('Expedition-V Primary Scientific Milestones')).toBeDefined();

      // Verify primary objective titles from EXPEDITION_V_DEFAULT_OBJECTIVES
      expect(screen.getByText('Subsurface Ocean Acoustic/Radar Characterization')).toBeDefined();
      expect(screen.getByText('Plume Volatile & Organic Signature Detection')).toBeDefined();
    });

    it('renders the mission event log feed from MissionEventEngine', () => {
      SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <MissionEventLogPanel />
        </SimulationProvider>
      );

      expect(screen.getByText('Mission Event Log')).toBeDefined();
      expect(screen.getByText('Avionics & Operations Chronological Audit')).toBeDefined();
      expect(screen.getByText('NO RECENT TIMELINE EVENTS')).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Simulation Control Stepping & Runtime State Transition                 */
  /* -------------------------------------------------------------------------- */
  describe('2. Simulation Control Stepping & State Transition', () => {
    it('advances MET deterministically by 1 SI second when clicking +1s', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SimulationControlBar />
        </SimulationProvider>
      );

      expect(screen.getByText('T+ 000d 00:00:00')).toBeDefined();

      const step1sButton = screen.getByRole('button', { name: '+1s' });

      await act(async () => {
        fireEvent.click(step1sButton);
      });

      expect(screen.getByText('T+ 000d 00:00:01')).toBeDefined();
      expect(runtime.getSnapshot().metSeconds).toBe(1);
    });

    it('advances MET deterministically by 10 SI seconds when clicking +10s', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SimulationControlBar />
        </SimulationProvider>
      );

      const step10sButton = screen.getByRole('button', { name: '+10s' });

      await act(async () => {
        fireEvent.click(step10sButton);
      });

      expect(screen.getByText('T+ 000d 00:00:10')).toBeDefined();
      expect(runtime.getSnapshot().metSeconds).toBe(10);
    });

    it('advances MET deterministically by 60 SI seconds when clicking +60s', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SimulationControlBar />
        </SimulationProvider>
      );

      const step60sButton = screen.getByRole('button', { name: '+60s' });

      await act(async () => {
        fireEvent.click(step60sButton);
      });

      expect(screen.getByText('T+ 000d 00:01:00')).toBeDefined();
      expect(runtime.getSnapshot().metSeconds).toBe(60);
    });

    it('pauses and resumes the simulation runtime correctly and gates controls', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SimulationControlBar />
        </SimulationProvider>
      );

      // In READY state, button displays "Start"
      const startButton = screen.getByRole('button', { name: /start/i });
      expect(startButton).toBeDefined();

      // Click to start simulation
      await act(async () => {
        fireEvent.click(startButton);
      });

      expect(runtime.getLifecycle()).toBe('RUNNING');

      // Now the button displays "Pause"
      const pauseButton = screen.getByRole('button', { name: /pause/i });
      expect(pauseButton).toBeDefined();

      // Click to pause
      await act(async () => {
        fireEvent.click(pauseButton);
      });

      expect(runtime.getLifecycle()).toBe('PAUSED');
      expect(screen.getByText('PAUSED')).toBeDefined();

      // In PAUSED state, manual step buttons are disabled to prevent out-of-order execution
      const step1sButton = screen.getByRole('button', { name: '+1s' }) as HTMLButtonElement;
      expect(step1sButton.disabled).toBe(true);

      // Now the button displays "Resume"
      const resumeButton = screen.getByRole('button', { name: /resume/i });
      expect(resumeButton).toBeDefined();

      // Click to resume
      await act(async () => {
        fireEvent.click(resumeButton);
      });

      expect(runtime.getLifecycle()).toBe('RUNNING');
      expect(step1sButton.disabled).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Live Telemetry Reflection & Event Updates                              */
  /* -------------------------------------------------------------------------- */
  describe('3. Live Telemetry Reflection', () => {
    it('updates propellant remaining and consumed when simulation consumes fuel', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <PropulsionStoragePanel />
        </SimulationProvider>
      );

      // Initially remaining mass is 2450.0 kg, consumed is 0.0 kg
      expect(screen.getByText('2450.0')).toBeDefined();
      expect(screen.getByText(/Consumed:\s*0\.0\s*kg/i)).toBeDefined();

      // Authoritatively consume 15.0 kg of propellant via FlightComputer subsystem manager
      await act(async () => {
        const fc = runtime.getFlightComputer();
        const prop = fc.getSubsystemManager().getSubsystem('PROPULSION') as PropulsionSubsystem;
        prop.consumePropellant(15.0);
        await runtime.advanceTime(1);
      });

      // Check updated UI values: 2450 - 15 = 2435.0 kg remaining, 15.0 kg consumed
      expect(screen.getByText('2435.0')).toBeDefined();
      expect(screen.getByText(/Consumed:\s*15\.0\s*kg/i)).toBeDefined();
    });

    it('reflects subsystem faults in the live dashboard when faults occur', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SubsystemsPanel />
        </SimulationProvider>
      );

      // Trigger a fault in Propulsion
      await act(async () => {
        runtime.getFlightComputer().getSubsystemManager().setSubsystemStatus('PROPULSION', 'FAULT');
        await runtime.advanceTime(1);
      });

      // Propulsion should now show FAULT badge
      const faultBadges = screen.getAllByText('FAULT');
      expect(faultBadges.length).toBeGreaterThanOrEqual(1);
    });

    it('updates mission event log dynamically when scheduled events occur', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <MissionEventLogPanel />
        </SimulationProvider>
      );

      // Schedule and execute a mission event
      await act(async () => {
        runtime.getEventEngine().scheduleEvent({
          id: 'EVT-MANEUVER-TEST',
          type: 'ORBITAL_TRIM_MANEUVER',
          scheduledTimeSeconds: 1,
          priority: 10,
          payload: { deltaV: 0.5 },
        });
        await runtime.advanceTime(1);
      });

      expect(screen.getByText('ORBITAL_TRIM_MANEUVER')).toBeDefined();
    });

    it('renders explicit "DATA UNAVAILABLE" fallback when models are not computed', () => {
      const customSnapshot = {
        campaignId: 'NO-DATA-TEST',
        metSeconds: 0,
        formattedMET: 'T+ 000d 00:00:00',
        lifecycle: 'READY' as const,
        flightState: 'ACTIVE' as const,
        subsystems: {} as any,
        massBudget: {} as any,
        propellantRemainingKg: 2450,
        propellantCapacityKg: 2450,
        storage: {
          usedBytes: 0,
          capacityBytes: 512 * 1024 * 1024,
          utilizationPercent: 0,
          isFull: false,
          retentionPolicy: 'FIFO' as const,
          queueDepth: 0,
        },
        communications: {
          groundLinkStatus: 'AOS' as const,
          visibleStations: [],
          downlinkQueueLength: 0,
          uplinkQueueLength: 0,
          owltSeconds: 2700,
          activePass: false,
        },
        // Explicitly undefined powerBudget & thermalModel
        powerBudget: undefined,
        thermalModel: undefined,
        objectives: [],
        events: [],
        pendingDecisions: [],
        decisionHistory: [],
        faults: { criticalCount: 0, warningCount: 0, activeFaults: [] },
      };

      vi.spyOn(runtimeModule, 'useSimulationSnapshot').mockReturnValue(customSnapshot as any);

      render(<PowerThermalPanel />);

      const unavailableBadges = screen.getAllByText('DATA UNAVAILABLE');
      expect(unavailableBadges.length).toBe(2);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. React StrictMode Resilience (Resolving Finding C-01)                  */
  /* -------------------------------------------------------------------------- */
  describe('4. React StrictMode Double-Mount Resilience (Audit Finding C-01)', () => {
    it('mounts inside React StrictMode without duplicate subscriptions, leaks, or desync', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      const { unmount } = render(
        <StrictMode>
          <SimulationProvider campaignId={TEST_CAMPAIGN}>
            <SimulationControlBar />
            <SubsystemsPanel />
          </SimulationProvider>
        </StrictMode>
      );

      // Verify MET renders correctly
      expect(screen.getByText('T+ 000d 00:00:00')).toBeDefined();

      // Step simulation by 1s
      const step1sButton = screen.getByRole('button', { name: '+1s' });
      await act(async () => {
        fireEvent.click(step1sButton);
      });

      // Verify state advanced exactly 1s, not 2s
      expect(screen.getByText('T+ 000d 00:00:01')).toBeDefined();
      expect(runtime.getSnapshot().metSeconds).toBe(1);

      // Unmount cleanly
      unmount();
      expect(runtime.getLifecycle()).toBe('READY');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. Route Navigation State Preservation                                    */
  /* -------------------------------------------------------------------------- */
  describe('5. Route Navigation & Simulation State Preservation', () => {
    it('preserves simulation progression when navigating away from /operations and returning', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      const TestApp = () => (
        <MemoryRouter initialEntries={['/operations']}>
          <SimulationProvider campaignId={TEST_CAMPAIGN}>
            <nav className="p-2 bg-slate-900">
              <Link to="/operations">Nav Operations</Link>
              <Link to="/surface">Nav Surface</Link>
            </nav>
            <Routes>
              <Route path="/operations" element={<MissionOperationsScreen />} />
              <Route path="/surface" element={<div data-testid="surface-screen">Surface Screen Content</div>} />
            </Routes>
          </SimulationProvider>
        </MemoryRouter>
      );

      render(<TestApp />);

      // On /operations, advance time by 60s
      const step60sButton = screen.getByRole('button', { name: '+60s' });
      await act(async () => {
        fireEvent.click(step60sButton);
      });

      expect(screen.getAllByText('T+ 000d 00:01:00').length).toBeGreaterThanOrEqual(1);
      expect(runtime.getSnapshot().metSeconds).toBe(60);

      // Navigate to /surface
      const surfaceLink = screen.getByRole('link', { name: 'Nav Surface' });
      await act(async () => {
        fireEvent.click(surfaceLink);
      });

      expect(screen.getByTestId('surface-screen')).toBeDefined();

      // Advance time while on /surface
      await act(async () => {
        await runtime.advanceTime(60);
      });
      expect(runtime.getSnapshot().metSeconds).toBe(120);

      // Navigate back to /operations
      const opsLink = screen.getByRole('link', { name: 'Nav Operations' });
      await act(async () => {
        fireEvent.click(opsLink);
      });

      // Verify that /operations displays the accumulated MET: T+ 000d 00:02:00
      expect(screen.getAllByText('T+ 000d 00:02:00').length).toBeGreaterThanOrEqual(1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 6. Audit Regression Tests (MIN-01 & MIN-03)                                */
  /* -------------------------------------------------------------------------- */
  describe('6. Audit Hardening & Boundary Tests (MIN-01 & MIN-03)', () => {
    it('dismisses runtime error alert and clears snapshot error (Audit MIN-01)', async () => {
      const runtime = SimulationRuntime.getOrCreate(TEST_CAMPAIGN);

      render(
        <SimulationProvider campaignId={TEST_CAMPAIGN}>
          <SimulationControlBar />
        </SimulationProvider>
      );

      // Simulate a runtime error via mock
      vi.spyOn(runtime.getFlightComputer(), 'step').mockRejectedValueOnce(
        new Error('Subsystem communication timeout')
      );

      const step1sButton = screen.getByRole('button', { name: '+1s' });
      await act(async () => {
        fireEvent.click(step1sButton);
      });

      // Banner should be visible with error text
      expect(screen.getByText('Subsystem communication timeout')).toBeDefined();
      expect(runtime.getSnapshot().error).toBe('Subsystem communication timeout');

      // Click Dismiss
      const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
      await act(async () => {
        fireEvent.click(dismissBtn);
      });

      // Error banner should be gone and snapshot error cleared
      expect(screen.queryByText('Subsystem communication timeout')).toBeNull();
      expect(runtime.getSnapshot().error).toBeUndefined();
    });

    it('consistently applies SSDR storage thresholds across panels (Audit MIN-03)', () => {
      // 1. Boundary: 79.9% -> NOMINAL, Cyan progress bar
      const baseSnap = {
        campaignId: 'SSDR-TEST',
        metSeconds: 0,
        formattedMET: 'T+ 000d 00:00:00',
        lifecycle: 'READY' as const,
        flightState: 'ACTIVE' as const,
        subsystems: {
          EPS: 'NOMINAL',
          PROPULSION: 'NOMINAL',
          TCS: 'NOMINAL',
          COMMUNICATIONS: 'NOMINAL',
          SCIENCE: 'NOMINAL',
        } as any,
        massBudget: {} as any,
        propellantRemainingKg: 2450,
        propellantCapacityKg: 2450,
        storage: {
          usedBytes: 79.9 * 1024 * 1024,
          capacityBytes: 100 * 1024 * 1024,
          utilizationPercent: 79.9,
          isFull: false,
          retentionPolicy: 'FIFO' as const,
          queueDepth: 0,
        },
        communications: {
          isWindowActive: false,
          activeStationIds: [],
          downlinkQueueLength: 0,
          uplinkQueueLength: 0,
          oneWayLightTimeSeconds: 2700,
          totalTransmittedBytes: 0,
        },
        powerBudget: undefined,
        thermalModel: undefined,
        objectives: [],
        events: [],
        pendingDecisions: [],
        decisionHistory: [],
        faults: { criticalCount: 0, warningCount: 0, activeFaults: [] },
        recentEvents: [],
      };

      vi.spyOn(runtimeModule, 'useSimulationSnapshot').mockReturnValue(baseSnap as any);
      const { unmount: unmount1, container: c1 } = render(<PropulsionStoragePanel />);
      // Should have cyan bar (bg-[#35C6F4])
      expect(c1.querySelector('.bg-\\[\\#35C6F4\\]')).not.toBeNull();
      unmount1();

      // 2. Boundary: 80.0% -> DEGRADED, Amber progress bar and warning banner
      const snap80 = {
        ...baseSnap,
        storage: { ...baseSnap.storage, utilizationPercent: 80.0 },
      };
      vi.spyOn(runtimeModule, 'useSimulationSnapshot').mockReturnValue(snap80 as any);
      const { unmount: unmount2, container: c2 } = render(<PropulsionStoragePanel />);
      expect(c2.querySelector('.bg-\\[\\#F5A623\\]')).not.toBeNull();
      expect(screen.getByText(/utilization exceeds 80%/i)).toBeDefined();
      unmount2();

      // 3. Boundary: 95.0% -> FAULT, Red progress bar and critical alert banner
      const snap95 = {
        ...baseSnap,
        storage: { ...baseSnap.storage, utilizationPercent: 95.0 },
      };
      vi.spyOn(runtimeModule, 'useSimulationSnapshot').mockReturnValue(snap95 as any);
      const { unmount: unmount3, container: c3 } = render(<PropulsionStoragePanel />);
      expect(c3.querySelector('.bg-\\[\\#EF6464\\]')).not.toBeNull();
      expect(screen.getByText(/CRITICAL: SSDR capacity nearly exhausted/i)).toBeDefined();
      unmount3();
    });
  });
});
