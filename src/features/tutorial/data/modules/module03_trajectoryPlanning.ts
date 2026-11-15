/**
 * SECTOR 17 — Tutorial Module 03: Trajectory Planning & Astrodynamics
 * Phase 9.1.2 Production Implementation
 *
 * Page: /trajectory
 * Teaches: Jovian orbital visualization, schematic vs. true physical scale,
 * maneuver sequencing (JOI, TCM, EOI, Descent), delta-v adjustment and validation,
 * timeline scrubbing, and atomic readiness certification + launch authorization.
 */

import type { TutorialStep, TutorialModule } from '../../types';

export const MODULE_03_METADATA: TutorialModule = {
  id: 'MODULE_03_TRAJECTORY',
  title: 'Trajectory Planning & Astrodynamics',
  subtitle: 'Jovian Capture & Maneuver Sequencing',
  description: 'Plan and validate orbital burns in 3D space, evaluate physical scale, and authorize launch for Expedition-V.',
  route: '/trajectory',
  order: 3,
  stepIds: [
    'tut-03-trajectory-overview',
    'tut-03-scale-mode',
    'tut-03-maneuver-list',
    'tut-03-maneuver-validation',
    'tut-03-timeline-controls',
    'tut-03-authorize-launch',
  ],
};

export const MODULE_03_STEPS: readonly TutorialStep[] = [
  {
    id: 'tut-03-trajectory-overview',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 1,
    route: '/trajectory',
    title: 'The Astrodynamics Workstation',
    instruction: 'Inspect the 3D orbital visualization of Jupiter and Europa.',
    detailedExplanation:
      'The central viewport renders the Jovian system grounded in NASA/JPL Horizons planetary ephemerides and NAIF SPICE coordinate frames. The green and white elliptical paths illustrate AETHON’s planned orbital insertion and flyby corridors.',
    technicalContext:
      'Jupiter gravitational parameter mu_J = 1.266865e17 m^3/s^2; Europa mu_E = 3.20273e12 m^3/s^2. Capturing into Jovian orbit requires shedding excess hyperbolic arrival velocity at perijove.',
    targetId: 'viewport-orbital-3d',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Astrodynamics viewport verified. World-to-screen telemetry anchors active.',
    handbookArticleId: 'art-07-jovian-astrodynamics',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-03-scale-mode',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 2,
    route: '/trajectory',
    title: 'Schematic vs. True Astronomical Scale',
    instruction: 'Toggle the SCALE control in the top-right header between [ SCHEMATIC ] and [ TRUE 1:1 ].',
    detailedExplanation:
      'Because Europa orbits 670,900 km from Jupiter (roughly 9.4 Jupiter radii), rendering true physical proportions makes planetary details microscopic. SCHEMATIC mode scales celestial bodies for operational visual clarity; TRUE 1:1 renders true astronomical geometric proportions.',
    targetId: 'btn-scale-toggle',
    expectedAction: 'CLICK',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'scale_mode_toggled',
    },
    successMessage: 'Orbital scale toggled. Understand the geometric vs operational perspective.',
    recoveryGuidance: 'Click the [ SCHEMATIC ] or [ TRUE 1:1 ] toggle button in the upper right header.',
    handbookArticleId: 'art-07-jovian-astrodynamics',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-03-maneuver-list',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 3,
    route: '/trajectory',
    title: 'Mission Maneuver Sequencing',
    instruction: 'Select burn [ 03. EOI BURN (PLANNED) ] in the right-hand panel.',
    detailedExplanation:
      'The mission plan sequences four staged impulsive burns: 01. JOI BURN (840 m/s Jovian capture at perijove), 02. TRAJECTORY ADJ. (45 m/s trajectory trim), 03. EOI BURN (320 m/s Europa flyby shaping), and 04. DESCENT BURN (180 m/s probe terminal descent).',
    technicalContext:
      'A planned maneuver represents a calculated trajectory target; it does not become an executed burn until fired by the spacecraft in flight operations.',
    targetId: 'item-maneuver-eoi',
    expectedAction: 'SELECT',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'maneuver_eoi_selected',
    },
    successMessage: 'EOI burn selected. Telemetry and burn parameters loaded.',
    recoveryGuidance: 'Click on [ 03. EOI BURN (PLANNED) ] in the right-hand Maneuver List.',
    handbookArticleId: 'art-08-trajectory-maneuvers',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-03-maneuver-validation',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 4,
    route: '/trajectory',
    title: 'Validate Astrodynamic Feasibility',
    instruction: 'Click [ VALIDATE TRAJECTORY ] to calculate burn feasibility and propellant margin.',
    detailedExplanation:
      'The maneuver validation engine calculates whether remaining onboard propellant is sufficient to execute the planned Delta-v, checks capture corridor geometry, and verifies that the spacecraft will not exceed allowable Jovian radiation belt exposure.',
    targetId: 'btn-validate-trajectory',
    expectedAction: 'VALIDATE',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'maneuver_validated',
    },
    successMessage: 'Trajectory validation report generated: Propellant margin >= 15%, corridor nominal.',
    recoveryGuidance: 'Click the [ VALIDATE TRAJECTORY ] button in the maneuver adjustment panel.',
    handbookArticleId: 'art-08-trajectory-maneuvers',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-03-timeline-controls',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 5,
    route: '/trajectory',
    title: 'Mission Timeline & Orbit Scrubbing',
    instruction: 'Interact with the timeline scrubber in the bottom bar to preview flight milestones.',
    detailedExplanation:
      'The bottom timeline maps Mission Elapsed Time (MET) from Day 180 through Day 195. Milestones track: AETHON Arrival, JOI Burn, Current Position (Day 184), Europa Sphere of Influence, and Rover Deployment.',
    targetId: 'bar-mission-timeline',
    expectedAction: 'CLICK',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'timeline_scrubbed',
    },
    successMessage: 'Timeline scrubber updated. Trajectory milestone sequencing verified.',
    recoveryGuidance: 'Click or drag anywhere along the bottom MET timeline bar.',
    handbookArticleId: 'art-09-flight-operations',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-03-authorize-launch',
    moduleId: 'MODULE_03_TRAJECTORY',
    order: 6,
    route: '/trajectory',
    title: 'Certify Flight Readiness & Authorize Launch',
    instruction: 'Click [ CERTIFY MISSION READINESS ] and proceed to Flight Operations.',
    detailedExplanation:
      'Flight rules require an authoritative readiness certification before launch authorization can be granted. Clicking this action executes the certification review, transitions the campaign through stage 5 to stage 6 (LAUNCH), and opens the Mission Operations Console.',
    targetId: 'btn-certify-authorize',
    expectedAction: 'CLICK',
    verification: {
      type: 'SNAPSHOT_BOOLEAN',
      property: 'isLaunchAuthorized',
      expectedValue: true,
    },
    successMessage: 'Launch authorization granted! Spacecraft AETHON cleared for flight operations.',
    recoveryGuidance: 'Click [ CERTIFY MISSION READINESS ] or [ AUTHORIZE LAUNCH & PROCEED ] in the lower right panel.',
    handbookArticleId: 'art-14-mission-evaluation',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
];
