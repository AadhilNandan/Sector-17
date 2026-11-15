/**
 * SECTOR 17 — Interactive Tutorial System Type Definitions
 * Phase 9.1.2 Production Implementation
 *
 * Grounded in the authoritative Phase 9.1.1 Architecture Blueprint.
 * Defines strongly typed contracts for modules, steps, verification conditions,
 * state persistence, and Mission Handbook technical articles.
 */

import type { SimulationSnapshot } from '../../runtime/types';
import type { SimulationRuntime } from '../../runtime/simulationRuntime';
import type { CampaignStageId } from '../../campaign/campaignTypes';

/**
 * Five primary campaign tutorial module identifiers.
 */
export type TutorialModuleId =
  | 'MODULE_01_BRIEFING'
  | 'MODULE_02_ENGINEERING'
  | 'MODULE_03_TRAJECTORY'
  | 'MODULE_04_OPERATIONS'
  | 'MODULE_05_DEBRIEF';

/**
 * Operating modes for the tutorial subsystem.
 */
export type TutorialMode = 'INACTIVE' | 'GUIDED' | 'INSPECT' | 'HANDBOOK';

/**
 * Discrete verification mechanisms supported by the action verification engine.
 */
export type VerificationType =
  | 'USER_ACKNOWLEDGEMENT'
  | 'ROUTE_MATCH'
  | 'CAMPAIGN_STAGE'
  | 'SNAPSHOT_BOOLEAN'
  | 'SNAPSHOT_VALUE'
  | 'EVENT_AFTER_BASELINE'
  | 'CONFIGURATION_STATUS'
  | 'DOM_INTERACTION_SIGNAL';

/**
 * Condition definitions for step verification.
 */
export type VerificationCondition =
  | { readonly type: 'USER_ACKNOWLEDGEMENT' }
  | { readonly type: 'ROUTE_MATCH'; readonly expectedRoute: string }
  | { readonly type: 'CAMPAIGN_STAGE'; readonly expectedStageId: CampaignStageId; readonly allowLaterStages?: boolean }
  | {
      readonly type: 'SNAPSHOT_BOOLEAN';
      readonly property: 'briefingAcknowledged' | 'isReadinessCertified' | 'isLaunchAuthorized';
      readonly expectedValue?: boolean;
    }
  | {
      readonly type: 'SNAPSHOT_VALUE';
      readonly property: string;
      readonly expectedValue: unknown;
      readonly comparator?: 'equals' | 'gte' | 'lte' | 'includes';
    }
  | {
      readonly type: 'EVENT_AFTER_BASELINE';
      readonly eventType: string;
      readonly status?: 'EXECUTED' | 'FAILED' | 'SKIPPED';
    }
  | {
      readonly type: 'CONFIGURATION_STATUS';
      readonly allowedStatuses: readonly ('PASS' | 'WARNING')[];
    }
  | {
      readonly type: 'DOM_INTERACTION_SIGNAL';
      readonly signalKey: string;
    };

/**
 * Runtime context provided to the verification engine for evaluating step completion.
 */
export interface VerificationContext {
  readonly snapshot: SimulationSnapshot;
  readonly runtime?: SimulationRuntime | null;
  readonly currentRoute: string;
  readonly stepBaselineMET?: number;
  readonly stepBaselineEventCount?: number;
  readonly interactionSignals?: Readonly<Record<string, boolean>>;
  readonly domElementFound?: boolean;
}

/**
 * Structured result returned by the verification engine.
 */
export interface VerificationResult {
  readonly verified: boolean;
  readonly reason?: string;
  readonly recoveryHint?: string;
  readonly autoAdvance?: boolean;
}

/**
 * Expected user action classification.
 */
export type ExpectedAction =
  | 'CLICK'
  | 'INPUT'
  | 'HOVER'
  | 'SELECT'
  | 'READ'
  | 'NAVIGATE'
  | 'VALIDATE'
  | 'STEP_TIME';

/**
 * Authoritative tutorial step definition.
 */
export interface TutorialStep {
  readonly id: string;
  readonly moduleId: TutorialModuleId;
  readonly order: number;
  readonly route: string;
  readonly title: string;
  readonly instruction: string;
  readonly detailedExplanation: string;
  readonly technicalContext?: string;
  readonly targetId: string;
  readonly expectedAction: ExpectedAction;
  readonly verification: VerificationCondition;
  readonly successMessage: string;
  readonly recoveryGuidance?: string;
  readonly handbookArticleId?: string;
  readonly canSkip?: boolean;
  readonly autoAdvanceOnVerify?: boolean;
}

/**
 * Tutorial module definition grouping a sequence of steps.
 */
export interface TutorialModule {
  readonly id: TutorialModuleId;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly route: string;
  readonly order: number;
  readonly stepIds: readonly string[];
}

/**
 * Central state tracked by TutorialProvider.
 */
export interface TutorialState {
  readonly mode: TutorialMode;
  readonly isActive: boolean;
  readonly isTutorialMinimized: boolean;
  readonly currentModuleId: TutorialModuleId;
  readonly currentStepId: string;
  readonly isPaused: boolean;
  readonly completedStepIds: readonly string[];
  readonly completedModuleIds: readonly TutorialModuleId[];
  readonly overallCompletion: boolean;
  readonly handbookOpen: boolean;
  readonly activeHandbookArticleId?: string;
  readonly inspectModeActive: boolean;
  readonly lastUpdatedTimestamp: number;
  readonly stepBaselineMET: number;
  readonly stepBaselineEventCount: number;
  readonly interactionSignals: Readonly<Record<string, boolean>>;
}

/**
 * Serialized tutorial progress for browser persistence.
 */
export interface TutorialStorageSchema {
  readonly version: number;
  readonly hasCompletedTutorial: boolean;
  readonly currentModuleId: TutorialModuleId;
  readonly currentStepId: string;
  readonly completedStepIds: readonly string[];
  readonly completedModuleIds: readonly TutorialModuleId[];
  readonly lastUpdatedTimestamp: number;
}

/**
 * Handbook scientific provenance classification.
 */
export type HandbookProvenance = 'VERIFIED_PHYSICS' | 'SIMPLIFIED_MODEL' | 'GAMEPLAY_ABSTRACTION';

/**
 * Handbook subject categories.
 */
export type HandbookCategory = 'MISSION' | 'ASTRODYNAMICS' | 'ENGINEERING' | 'OPERATIONS' | 'SCIENCE';

/**
 * Equation metadata rendered within handbook technical articles.
 */
export interface HandbookEquation {
  readonly name: string;
  readonly formula: string;
  readonly explanation: string;
  readonly variables: Readonly<Record<string, string>>;
}

/**
 * Official technical reference citation for Mission Handbook articles.
 */
export interface HandbookNasaReference {
  readonly title: string;
  readonly organization: string;
  readonly url?: string;
  readonly description?: string;
  readonly verified: boolean;
}

/**
 * Full Mission Handbook reference article.
 */
export interface HandbookArticle {
  readonly id: string;
  readonly chapterNumber: number;
  readonly title: string;
  readonly category: HandbookCategory;
  readonly summary: string;
  readonly content: string;
  readonly keyTerms: readonly string[];
  readonly equations?: readonly HandbookEquation[];
  readonly practicalInterpretation: string;
  readonly provenance: HandbookProvenance;
  readonly nasaReference?: HandbookNasaReference;
}
