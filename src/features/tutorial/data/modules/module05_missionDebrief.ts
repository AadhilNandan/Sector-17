/**
 * SECTOR 17 — Tutorial Module 05: Mission Debrief & Archival Closure
 * Phase 9.1.2 Production Implementation
 *
 * Page: /debrief
 * Teaches: Archival parchment report layout, dynamic evidence-based findings,
 * 2D trajectory replay diagram, decision-chain timeline, and permanently
 * committing the expedition record to the archives.
 */

import type { TutorialStep, TutorialModule } from '../../types';

export const MODULE_05_METADATA: TutorialModule = {
  id: 'MODULE_05_DEBRIEF',
  title: 'Mission Debrief & Archival Closure',
  subtitle: 'Expedition Synthesis & Archival Commit',
  description: 'Analyze dynamic scientific findings, inspect trajectory replays, and permanently seal Expedition-V in the archives.',
  route: '/debrief',
  order: 5,
  stepIds: [
    'tut-05-debrief-overview',
    'tut-05-evidence-synthesis',
    'tut-05-trajectory-replay',
    'tut-05-archive-expedition',
  ],
};

export const MODULE_05_STEPS: readonly TutorialStep[] = [
  {
    id: 'tut-05-debrief-overview',
    moduleId: 'MODULE_05_DEBRIEF',
    order: 1,
    route: '/debrief',
    title: 'The Archival Debrief Report',
    instruction: 'Inspect the parchment mission debrief dossier.',
    detailedExplanation:
      'The Mission Debrief presents the final synthesized record of Expedition-V. Styled as an archival aerospace document, it displays the Concept Maturity readiness assessment, mission outcome stamp (FULL SUCCESS, PARTIAL SUCCESS, or MISSION FAILED), and total MET duration.',
    technicalContext:
      'Inspired by NASA Concept Maturity Level (CML) frameworks used in mission concept formulation, evaluating trade space fidelity from early architecture to operational flight.',
    targetId: 'doc-parchment-report',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Debrief overview verified. Examining dynamic scientific returns.',
    handbookArticleId: 'art-14-mission-evaluation',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-05-evidence-synthesis',
    moduleId: 'MODULE_05_DEBRIEF',
    order: 2,
    route: '/debrief',
    title: 'Dynamic Evidence-Based Findings',
    instruction: 'Review the Science Returned and Anomaly Findings sections.',
    detailedExplanation:
      'Scientific claims in SECTOR 17 reflect actual simulation evidence: Confirmed findings (such as liquid water detection at 12–18 km depth) are generated only if science packets were processed and downlinked to Earth. If instruments were unpowered or downlinks unperformed, the debrief records UNKNOWN / NOT RECORDED.',
    technicalContext:
      'Scientific integrity requires distinguishing between unverified hypothesis and empirically validated data supported by instrument telemetry.',
    targetId: 'section-science-returned',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Evidence-based reporting verified. Reviewing astrodynamic replay.',
    handbookArticleId: 'art-14-mission-evaluation',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-05-trajectory-replay',
    moduleId: 'MODULE_05_DEBRIEF',
    order: 3,
    route: '/debrief',
    title: '2D Trajectory Replay & Decision Chain',
    instruction: 'Inspect the 2D flight diagram and decision-chain timeline in the right panel.',
    detailedExplanation:
      'The right panel contains two historical artifacts: The 2D Trajectory Replay (illustrating the heliocentric cruise from Earth past Mars gravity assist to Jovian capture and Europa orbit) and the Decision-Chain Timeline (tracking the operational pipeline: Objective -> Instrument -> Validation -> Acquisition -> Processing -> Results).',
    targetId: 'diagram-trajectory-replay',
    expectedAction: 'READ',
    verification: {
      type: 'USER_ACKNOWLEDGEMENT',
    },
    successMessage: 'Trajectory replay and decision chain timeline verified.',
    handbookArticleId: 'art-08-trajectory-maneuvers',
    canSkip: false,
    autoAdvanceOnVerify: false,
  },
  {
    id: 'tut-05-archive-expedition',
    moduleId: 'MODULE_05_DEBRIEF',
    order: 4,
    route: '/debrief',
    title: 'Seal & Archive the Expedition Record',
    instruction: 'Click [ ARCHIVE THIS EXPEDITION ] to permanently commit the flight record.',
    detailedExplanation:
      'Clicking Archive commits the debrief into permanent storage, transitions the campaign state machine to CAMPAIGN_COMPLETED, and applies the official RECORD CLOSED stamp. You have successfully completed the SECTOR 17 flight curriculum!',
    targetId: 'btn-archive-expedition',
    expectedAction: 'CLICK',
    verification: {
      type: 'EVENT_AFTER_BASELINE',
      eventType: 'MISSION_DEBRIEF_ARCHIVED',
    },
    successMessage: 'Expedition-V permanently archived! Training curriculum complete. Outstanding command, Director.',
    recoveryGuidance: 'Click the [ ARCHIVE THIS EXPEDITION ] button in the lower debrief action bar.',
    handbookArticleId: 'art-15-glossary-attribution',
    canSkip: false,
    autoAdvanceOnVerify: true,
  },
];
