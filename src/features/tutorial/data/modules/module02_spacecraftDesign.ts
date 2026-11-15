/**
 * SECTOR 17 — Tutorial Module 02: Spacecraft Engineering & Resource Budgets
 * Phase 9.1.2 Production Implementation
 *
 * Page: /workshop
 * Teaches: 3-column engineering layout, 3D viewport controls, power trade-offs
 * (solar falloff at 5.2 AU vs RTG), science instruments, launch vehicle payload
 * margins, constraint validation, and advancing to trajectory planning.
 */

import type { TutorialStep, TutorialModule } from '../../types';

export const MODULE_02_METADATA: TutorialModule = {
  id: 'MODULE_02_ENGINEERING',
  title: 'Spacecraft Engineering & Resource Budgets',
  subtitle: 'AETHON Architecture & Margin Validation',
  description: 'Balance dry mass, inverse-square solar power, launch vehicle capacity, and mission budget in the 3D workshop bay.',
  route: '/workshop',
  order: 2,
  stepIds: [
    'tut-02-workshop-overview',
    'tut-02-camera-presets',
    'tut-02-power-subsystem',
    'tut-02-science-payload',
    'tut-02-launch-vehicle',
    'tut-02-budget-validation',
    'tut-02-proceed-trajectory',
  ],
};

export const MODULE_02_STEPS: readonly TutorialStep[] = [
  {
    id: 'tut-02-workshop-overview',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 1,
    route: '/workshop',
    title: 'The Engineering Workshop Layout',
    instruction: 'Inspect the three-column engineering bay.',
    detailedExplanation:
      'The Spacecraft Workshop divides into three critical zones: Component Catalogue (left column, 6 hardware disciplines), Interactive 3D Viewport (center column, procedural AETHON model), and Resource Budgets (right column, live engineering constraint checker).',
    technicalContext:
      'A successful mission requires simultaneously satisfying structural mass, electrical power, thermal dissipation, financial budget, and launch vehicle injection limits.',
    targetId: 'panel-workshop-bay',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Engineering bay layout acknowledged. Ready to inspect vehicle hardware.',
    handbookArticleId: 'art-02-spacecraft-architecture',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-camera-presets',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 2,
    route: '/workshop',
    title: '3D Spacecraft Inspection & Camera Controls',
    instruction: 'Select a camera preset (3/4 ISO, FRONT, SIDE, or REAR) to inspect AETHON.',
    detailedExplanation:
      'Use the camera preset buttons at the top of the 3D viewport to inspect different spacecraft sub-assemblies. You can also left-click drag to freely orbit, right-click drag to pan, and scroll to zoom.',
    technicalContext:
      'AETHON incorporates massive dual solar wings, an avionics vault shielding sensitive computers from intense Jovian radiation belts, forward radar sounding booms, and a dorsal High-Gain Antenna.',
    targetId: 'bar-camera-presets',
    expectedAction: 'CLICK',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'camera_preset_changed',
    },
    successMessage: 'Viewport camera preset activated. Vehicle geometry inspected.',
    recoveryGuidance: 'Click any camera preset button ([3/4 ISO], [FRONT], [SIDE], or [REAR]) in the 3D viewport.',
    handbookArticleId: 'art-02-spacecraft-architecture',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-power-subsystem',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 3,
    route: '/workshop',
    title: 'Electrical Power & The Inverse-Square Law',
    instruction: 'Click the [ POWER ] category tab to evaluate solar vs. radioisotope options.',
    detailedExplanation:
      'At Jupiter (5.204 AU from the Sun), solar irradiance follows the inverse-square law P = P0 / R^2, reducing sunlight intensity to roughly 1/27th of Earth levels. The Triple-Junction Solar Wings generate ~720W at Jupiter, while the Dual Next-Gen eMMRTG produces a continuous 2.6 kW via Plutonium-238 decay regardless of distance or eclipses.',
    technicalContext:
      'Solar arrays at Jupiter require massive surface area (>90 m²) to generate baseline bus power. Low power margins trigger an active warning (<15% reserve) but remain flight-certifiable if net power is positive.',
    targetId: 'tab-category-power',
    expectedAction: 'SELECT',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'category_power_selected',
    },
    successMessage: 'Power discipline selected. Review the generation vs. consumption balance.',
    recoveryGuidance: 'Click on the [ POWER ] tab in the left-hand Component Catalogue.',
    handbookArticleId: 'art-04-electrical-power',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-science-payload',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 4,
    route: '/workshop',
    title: 'Scientific Instruments Selection',
    instruction: 'Click the [ INSTRUMENTS ] tab to review the science payload packages.',
    detailedExplanation:
      'Expedition-V relies on two primary scientific instrument suites: the REASON Ice-Penetrating Radar (sounding ice interfaces down to 30 km) and the MASPEX High-Resolution Mass Spectrometer (analyzing volatile organics and water vapor plumes). Both instruments consume electrical power and add dry mass.',
    targetId: 'tab-category-instruments',
    expectedAction: 'SELECT',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'category_instruments_selected',
    },
    successMessage: 'Science payload options inspected.',
    recoveryGuidance: 'Click on the [ INSTRUMENTS ] tab in the Component Catalogue.',
    handbookArticleId: 'art-11-reason-radar',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-launch-vehicle',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 5,
    route: '/workshop',
    title: 'Launch Vehicle Injection Limits',
    instruction: 'Select a launch vehicle that provides a positive mass margin.',
    detailedExplanation:
      'The Launch Vehicle selector in the right panel dictates the maximum payload capacity to Trans-Jovian Injection (TJI). Spacecraft wet mass (dry mass + engine propellant) must not exceed the vehicle limit (Atlas V: 3,800 kg; Falcon Heavy Exp: 6,200 kg; Vulcan Centaur: 4,200 kg). If mass margin is negative, authorization is blocked.',
    targetId: 'selector-launch-vehicle',
    expectedAction: 'SELECT',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'launch_vehicle_selected',
    },
    successMessage: 'Launch vehicle selected with verified positive mass margin.',
    recoveryGuidance: 'Select a heavy-lift booster such as Falcon Heavy Exp if your wet mass exceeds 3,800 kg.',
    handbookArticleId: 'art-03-mass-budgets',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-budget-validation',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 6,
    route: '/workshop',
    title: 'Review Engineering Constraint Checker',
    instruction: 'Ensure overall configuration status is PASS or WARNING.',
    detailedExplanation:
      'The Resource Budgets panel evaluates four critical constraints: Mass Margin (>= 0 kg), Power Reserve (nominal if >= 15%, warning if 0–15%), Financial Cost (<= 100%), and Tsiolkovsky Delta-v. Status PASS or WARNING allows proceeding. Status FAIL blocks authorization.',
    technicalContext:
      'Tsiolkovsky rocket equation: Delta-v = Isp * g0 * ln(m0 / mf). Higher specific impulse (Isp) produces greater velocity increment for identical propellant mass.',
    targetId: 'panel-resource-budgets',
    expectedAction: 'VALIDATE',
    verification: {
      type: 'CONFIGURATION_STATUS',
      allowedStatuses: ['PASS', 'WARNING'],
    },
    successMessage: 'Spacecraft configuration verified! All mandatory engineering constraints satisfied.',
    recoveryGuidance: 'If status is FAIL, check for over-mass or cost budget > 100% and swap heavy parts.',
    handbookArticleId: 'art-06-propulsion-rocket-equation',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-02-proceed-trajectory',
    moduleId: 'MODULE_02_ENGINEERING',
    order: 7,
    route: '/workshop',
    title: 'Lock Design & Proceed to Trajectory',
    instruction: 'Click [ PROCEED TO TRAJECTORY REVIEW ] to enter the Astrodynamics Workstation.',
    detailedExplanation:
      'Once engineering constraints are satisfied, clicking proceed locks the current point design, advances the campaign state machine from SPACECRAFT_DESIGN to ENGINEERING_VALIDATION, and navigates to the Trajectory Planner.',
    targetId: 'btn-proceed-trajectory',
    expectedAction: 'CLICK',
    verification: {
      type: 'ROUTE_MATCH',
      expectedRoute: '/trajectory',
    },
    successMessage: 'Design locked. Navigating to the Trajectory Planner workstation.',
    recoveryGuidance: 'Click [ PROCEED TO TRAJECTORY REVIEW ] in the workshop footer.',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
];
