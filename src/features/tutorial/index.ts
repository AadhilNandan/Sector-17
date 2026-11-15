/**
 * SECTOR 17 — Interactive Tutorial System Public API
 * Phase 9.1.3 Production Implementation
 *
 * Re-exports the complete core tutorial architecture and visual UI layer:
 * - Types and state contracts
 * - TutorialContext and useTutorial hook
 * - Persistence and verification engines
 * - Step and module registries
 * - Mission Handbook reference articles
 * - Visual UI components: Spotlight, Dialog, ProgressBar, Overlay, HUDButton, HandbookModal
 */

export * from './types';
export * from './context/TutorialContext';
export * from './services/tutorialPersistence';
export * from './services/stepVerificationEngine';
export * from './data/stepRegistry';
export * from './data/handbookArticles';
export * from './data/modules/module01_missionBriefing';
export * from './data/modules/module02_spacecraftDesign';
export * from './data/modules/module03_trajectoryPlanning';
export * from './data/modules/module04_flightOperations';
export * from './data/modules/module05_missionDebrief';

// Visual UI Components (Phase 9.1.3)
export * from './components/TutorialSpotlight';
export * from './components/TutorialDialog';
export * from './components/TutorialProgressBar';
export * from './components/TutorialOverlay';
export * from './components/TutorialHUDButton';
export * from './components/handbook/MissionHandbookModal';
