/**
 * SECTOR 17 — Tutorial Module 01: Mission Briefing & Directive Onboarding
 * Phase 9.1.2 Production Implementation
 *
 * Pages: / and /missions
 * Teaches: Application overview, Expedition-V directive, Europa destination,
 * historical dossiers (Exp-III, Exp-IV), and entering the spacecraft workshop.
 */

import type { TutorialStep, TutorialModule } from '../../types';

export const MODULE_01_METADATA: TutorialModule = {
  id: 'MODULE_01_BRIEFING',
  title: 'Mission Briefing & Directive Onboarding',
  subtitle: 'Expedition-V Protocol Activation',
  description: 'Understand the mission objective to Europa, review historical Jovian survey archives, and target the active expedition.',
  route: '/',
  order: 1,
  stepIds: [
    'tut-01-briefing-directive',
    'tut-01-new-expedition',
    'tut-01-inspect-dossiers',
    'tut-01-configure-spacecraft',
  ],
};

export const MODULE_01_STEPS: readonly TutorialStep[] = [
  {
    id: 'tut-01-briefing-directive',
    moduleId: 'MODULE_01_BRIEFING',
    order: 1,
    route: '/',
    title: 'Command Directive & Mission Briefing',
    instruction: 'Review the archival directive header in the upper command bar.',
    detailedExplanation:
      'SECTOR 17 simulates deep-space reconnaissance operations into the Jovian system. Expedition-V targets Europa, Jupiter’s icy moon, to investigate its subsurface ocean and verify magnetic induction signatures.',
    technicalContext:
      'Europa harbors a global saltwater ocean containing roughly twice the volume of all Earth’s oceans combined, shielded by a 15–25 km thick water-ice crust.',
    targetId: 'header-directive',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Command directive acknowledged. Ready to initiate mission protocol.',
    handbookArticleId: 'art-01-mission-briefing',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-01-new-expedition',
    moduleId: 'MODULE_01_BRIEFING',
    order: 2,
    route: '/',
    title: 'Activate New Expedition',
    instruction: 'Click [ NEW EXPEDITION ] to initialize the Expedition-V campaign directive.',
    detailedExplanation:
      'Selecting New Expedition acknowledges the flight briefing in the flight computer, transitions the campaign state machine from CAMPAIGN_INTRO to MISSION_SELECTION, and opens the Expedition Archive.',
    targetId: 'btn-new-expedition',
    expectedAction: 'CLICK',
    verification: {
      type: 'CAMPAIGN_STAGE',
      expectedStageId: 'MISSION_SELECTION',
      allowLaterStages: true,
    },
    successMessage: 'Directive confirmed. Campaign state transitioned to Mission Selection.',
    recoveryGuidance: 'Click the [ NEW EXPEDITION ] button on the main menu to proceed.',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-01-inspect-dossiers',
    moduleId: 'MODULE_01_BRIEFING',
    order: 3,
    route: '/missions',
    title: 'Inspect Expedition Archives',
    instruction: 'Review historical dossiers and select active EXPEDITION-V.',
    detailedExplanation:
      'The Expedition Archive contains records from prior deep-space attempts: Expedition-III (Ganymede, Completed) and Expedition-IV (Callisto, Partial Failure due to terminal descent loss). Expedition-V (Europa Survey) is the active operational campaign operated by spacecraft AETHON.',
    technicalContext:
      'Each dossier tracks four mission segments: Launch, Space, Ground, and User telemetry. In Expedition-V, these dynamically reflect your live simulation state.',
    targetId: 'dossier-card-expedition-5',
    expectedAction: 'SELECT',
    verification: {
      type: 'DOM_INTERACTION_SIGNAL',
      signalKey: 'dossier_expedition_5_selected',
    },
    successMessage: 'Active mission targeted: EXPEDITION-V — THE EUROPA SURVEY.',
    recoveryGuidance: 'Click on the EXPEDITION-V dossier card to target the Europa survey.',
    handbookArticleId: 'art-01-mission-briefing',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
  {
    id: 'tut-01-configure-spacecraft',
    moduleId: 'MODULE_01_BRIEFING',
    order: 4,
    route: '/missions',
    title: 'Enter Spacecraft Workshop',
    instruction: 'Click [ CONFIGURE SPACECRAFT ] to proceed to the engineering assembly bay.',
    detailedExplanation:
      'Locking in Expedition-V advances the campaign to stage 2 (SPACECRAFT_DESIGN) and opens the 3D Spacecraft Workshop at /workshop where you will architect vehicle AETHON.',
    targetId: 'btn-configure-spacecraft',
    expectedAction: 'CLICK',
    verification: {
      type: 'ROUTE_MATCH',
      expectedRoute: '/workshop',
    },
    successMessage: 'Entering engineering bay. Welcome to the Spacecraft Workshop.',
    recoveryGuidance: 'Click [ CONFIGURE SPACECRAFT ] in the lower right footer.',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
];
