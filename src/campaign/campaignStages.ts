/**
 * SECTOR 17 — Campaign Stages Definition
 * Metadata, routing, entry gates, completion criteria, and failure conditions
 * for all 18 expedition stages.
 */

import type { CampaignStageConfig, CampaignStageId } from './campaignTypes';

export const CAMPAIGN_STAGES_SEQUENCE: readonly CampaignStageId[] = [
  'CAMPAIGN_INTRO',
  'MISSION_SELECTION',
  'SPACECRAFT_DESIGN',
  'ENGINEERING_VALIDATION',
  'MISSION_READINESS',
  'LAUNCH_AUTHORIZATION',
  'LAUNCH',
  'INTERPLANETARY_CRUISE',
  'JUPITER_ARRIVAL',
  'EUROPA_RECONNAISSANCE',
  'SURFACE_MISSION_PREPARATION',
  'LANDER_DEPLOYMENT',
  'SURFACE_OPERATIONS',
  'ANOMALY_INVESTIGATION',
  'FINAL_DATA_TRANSMISSION',
  'MISSION_EVALUATION',
  'MISSION_DEBRIEF',
  'CAMPAIGN_COMPLETED',
] as const;

export const CAMPAIGN_STAGE_CONFIGS: Record<CampaignStageId, CampaignStageConfig> = {
  CAMPAIGN_INTRO: {
    stageId: 'CAMPAIGN_INTRO',
    order: 0,
    title: 'Expedition Briefing',
    subtitle: 'Sector 17 Protocol Activation',
    description: 'Initial mission directive review and mission commander onboarding.',
    associatedRoute: '/',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-intro-viewed',
        title: 'Directive Acknowledged',
        description: 'Command parameters and mission profile reviewed.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const acked =
            ctx.processedEventTypes.has('EVT_BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventIds.has('EVT_BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventTypes.has('BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventIds.has('BRIEFING_ACKNOWLEDGED') ||
            ctx.snapshot?.briefingAcknowledged === true;
          return {
            satisfied: acked,
            reason: !acked ? 'Expedition briefing directive has not been acknowledged' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['CAMPAIGN_INITIALIZED', 'EVT_BRIEFING_ACKNOWLEDGED', 'BRIEFING_ACKNOWLEDGED'],
  },

  MISSION_SELECTION: {
    stageId: 'MISSION_SELECTION',
    order: 1,
    title: 'Mission Selection',
    subtitle: 'Expedition-V — The Europa Survey',
    description: 'Designate the target solar system body and primary scientific objectives.',
    associatedRoute: '/missions',
    entryRequirements: [
      {
        id: 'req-sel-entry',
        title: 'Campaign Directive Active',
        description: 'Requires completion of briefing.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const acked =
            ctx.processedEventTypes.has('EVT_BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventIds.has('EVT_BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventTypes.has('BRIEFING_ACKNOWLEDGED') ||
            ctx.processedEventIds.has('BRIEFING_ACKNOWLEDGED') ||
            ctx.snapshot?.briefingAcknowledged === true;
          return {
            satisfied: acked,
            reason: !acked ? 'Requires directive briefing acknowledgment' : undefined,
          };
        },
      },
    ],
    completionRequirements: [
      {
        id: 'req-sel-complete',
        title: 'Expedition-V Target Confirmed',
        description: 'Europa designated as target survey destination.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const selected =
            ctx.processedEventTypes.has('MISSION_SELECTED') ||
            ctx.processedEventIds.has('MISSION_SELECTED') ||
            Boolean(ctx.snapshot?.selectedMissionId);
          return {
            satisfied: selected,
            reason: !selected ? 'Mission destination target not confirmed' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['MISSION_SELECTED'],
  },

  SPACECRAFT_DESIGN: {
    stageId: 'SPACECRAFT_DESIGN',
    order: 2,
    title: 'Spacecraft Architecture',
    subtitle: 'AETHON Deep-Space Explorer',
    description: 'Configure bus structures, avionics, science instruments, and propulsion loadouts.',
    associatedRoute: '/workshop',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-design-complete',
        title: 'Subsystem Loadout Configured',
        description: 'Essential bus, communications, and power subsystems integrated.',
        type: 'SUBSYSTEM_STATE',
        isMandatory: true,
        evaluator: (ctx) => {
          if (!ctx.snapshot && !ctx.flightComputer) {
            return { satisfied: true };
          }
          const statuses = (ctx.snapshot?.subsystems ?? ctx.flightComputer?.getSubsystemManager().getStatuses()) as Record<string, string> | undefined;
          const hasComms = statuses?.['COMMUNICATIONS'] !== undefined;
          const hasEps = statuses?.['EPS'] !== undefined;
          return {
            satisfied: hasComms && hasEps,
            reason: !hasComms || !hasEps ? 'Required EPS or Comms subsystems missing from design' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['SPACECRAFT_CONFIGURED'],
  },

  ENGINEERING_VALIDATION: {
    stageId: 'ENGINEERING_VALIDATION',
    order: 3,
    title: 'Engineering Validation',
    subtitle: 'Physical Integrity & Margin Analysis',
    description: 'Validate delta-V, electrical power generation, mass budgets, and thermal balance.',
    associatedRoute: '/workshop',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-val-subsystems',
        title: 'No Critical Subsystem Faults',
        description: 'Subsystems must not exhibit fatal engineering faults.',
        type: 'SUBSYSTEM_STATE',
        isMandatory: true,
        evaluator: (ctx) => {
          const snapshotFaults = ctx.snapshot?.faults?.criticalCount;
          const liveFaults = ctx.flightComputer?.getFaultManager().getFaultsBySeverity('CRITICAL').length;
          const faults = Math.max(snapshotFaults ?? 0, liveFaults ?? 0);
          return {
            satisfied: faults === 0,
            reason: faults > 0 ? `Unresolved critical faults present (${faults})` : undefined,
          };
        },
      },
      {
        id: 'req-val-propellant',
        title: 'Propellant Reserve Verified',
        description: 'Spacecraft must carry sufficient propellant for Jovian transfer and capture.',
        type: 'PROPELLANT',
        isMandatory: true,
        evaluator: (ctx) => {
          const snapshotProp = ctx.snapshot?.propellantRemainingKg;
          const liveProp = (ctx.flightComputer?.getSubsystemManager().getSubsystem('PROPULSION') as any)?.getPropellantRemainingKg();
          const prop = snapshotProp !== undefined && liveProp !== undefined
            ? Math.min(snapshotProp, liveProp)
            : (snapshotProp ?? liveProp ?? 0);
          const capacity = ctx.snapshot?.propellantCapacityKg ?? 2450.0;
          const minReserve = capacity * 0.10;
          return {
            satisfied: prop >= minReserve,
            reason: prop < minReserve ? `Propellant mass below minimum cruise margin (${prop.toFixed(1)} kg < ${minReserve.toFixed(1)} kg)` : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['VALIDATION_COMPLETED'],
  },

  MISSION_READINESS: {
    stageId: 'MISSION_READINESS',
    order: 4,
    title: 'Mission Readiness Review',
    subtitle: 'Trajectory & Ground Station Verification',
    description: 'Confirm planetary ephemeris alignment, Deep Space Network schedule, and launch constraints.',
    associatedRoute: '/trajectory',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-ready-window',
        title: 'Launch Window Verified',
        description: 'Orbital trajectory solution computed and ground stations nominal.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const commsSubsystem = ctx.snapshot?.subsystems?.['COMMUNICATIONS'];
          const isOperational = commsSubsystem !== 'FAULT' && commsSubsystem !== 'OFF';
          return {
            satisfied: isOperational,
            reason: !isOperational ? 'Communications subsystem unavailable for launch window tracking' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['READINESS_CERTIFIED'],
  },

  LAUNCH_AUTHORIZATION: {
    stageId: 'LAUNCH_AUTHORIZATION',
    order: 5,
    title: 'Launch Authorization',
    subtitle: 'Flight Director Go/No-Go Poll',
    description: 'Formal operational review and commander authorization to initiate launch countdown.',
    associatedRoute: '/decisions',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-launch-auth',
        title: 'Launch Authorization Approved',
        description: 'Flight Director approval recorded.',
        type: 'DECISION_EXECUTED',
        isMandatory: true,
        evaluator: (ctx) => {
          const history = ctx.snapshot?.decisionHistory ?? [];
          const hasLaunchAuth =
            history.some(
              (h) =>
                (h.option?.category === 'LAUNCH_AUTHORIZATION' || h.decisionId.startsWith('opt-launch-authorization')) &&
                (h.status === 'APPROVED' || h.status === 'EXECUTED')
            ) ||
            ctx.processedEventTypes.has('LAUNCH_AUTHORIZED') ||
            ctx.processedEventIds.has('LAUNCH_AUTHORIZED');
          return {
            satisfied: hasLaunchAuth,
            reason: !hasLaunchAuth ? 'Launch authorization not yet granted' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['LAUNCH_AUTHORIZED'],
  },

  LAUNCH: {
    stageId: 'LAUNCH',
    order: 6,
    title: 'Launch & Ascent',
    subtitle: 'Ascent to Planetary Escape Velocity',
    description: 'Atmospheric escape, stage separation, and solar array/antenna deployment.',
    associatedRoute: '/operations',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-launch-complete',
        title: 'Liftoff & Ascent Staging Complete',
        description: 'Spacecraft operational in active flight state.',
        type: 'FLIGHT_STATE',
        isMandatory: true,
        evaluator: (ctx) => {
          const state =
            ctx.flightComputer?.getExecutionController().getState() ??
            ctx.snapshot?.flightState ??
            'PRELAUNCH_HOLD';
          const isReleased = state === 'ACTIVE';
          return {
            satisfied: isReleased,
            reason: !isReleased ? `Spacecraft still in ${state}` : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['LAUNCH_INITIATED', 'LAUNCH_COMPLETE'],
    failureConditions: [
      {
        id: 'fail-launch-abort',
        description: 'Catastrophic launch abort triggered.',
        evaluator: (ctx) => ({
          triggered: ctx.snapshot?.flightState === 'ABORTED',
          failureReason: 'Catastrophic launch vehicle failure during ascent.',
        }),
      },
    ],
  },

  INTERPLANETARY_CRUISE: {
    stageId: 'INTERPLANETARY_CRUISE',
    order: 7,
    title: 'Interplanetary Cruise',
    subtitle: 'Heliocentric Transfer to Jupiter',
    description: 'Trajectory correction maneuvers, payload in-flight calibrations, and system monitoring.',
    associatedRoute: '/operations',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-cruise-arrival',
        title: 'Jupiter Hill Sphere Ingress',
        description: 'Spacecraft reaches Jupiter arrival boundary.',
        type: 'EVENT_PROCESSED',
        isMandatory: true,
        evaluator: (ctx) => {
          const arrived =
            ctx.processedEventTypes.has('JUPITER_ARRIVAL') ||
            ctx.processedEventIds.has('JUPITER_ARRIVAL');
          return {
            satisfied: arrived,
            reason: !arrived ? 'Interplanetary cruise in progress' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['CRUISE_PHASE_ENTERED', 'MIDCOURSE_CORRECTION_COMPLETE', 'JUPITER_ARRIVAL'],
  },

  JUPITER_ARRIVAL: {
    stageId: 'JUPITER_ARRIVAL',
    order: 8,
    title: 'Jupiter System Arrival',
    subtitle: 'Jovian Orbit Insertion (JOI)',
    description: 'Execute main engine deceleration burn for Jupiter orbital capture into a resonant tour orbit.',
    associatedRoute: '/operations',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-joi-complete',
        title: 'Orbital Insertion Burn Complete',
        description: 'Successful engine burn placing AETHON into Jovian system tour.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const captureDone =
            ctx.processedEventTypes.has('JUPITER_ORBIT_INSERTION_COMPLETE') ||
            ctx.processedEventIds.has('JUPITER_ORBIT_INSERTION_COMPLETE') ||
            ctx.processedEventTypes.has('ORBIT_INSERTION_COMPLETE') ||
            ctx.processedEventIds.has('ORBIT_INSERTION_COMPLETE') ||
            (ctx.snapshot?.navigation?.jupiterCapture.isCaptured ?? false);
          return {
            satisfied: captureDone,
            reason: !captureDone ? 'Awaiting Jupiter Orbit Insertion burn' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: [
      'JUPITER_ORBIT_INSERTION_COMPLETE',
      'ORBIT_INSERTION_COMPLETE',
      'JUPITER_CAPTURE_CONFIRMED',
      'JUPITER_ARRIVAL',
    ],
  },

  EUROPA_RECONNAISSANCE: {
    stageId: 'EUROPA_RECONNAISSANCE',
    order: 9,
    title: 'Europa Reconnaissance & Flybys',
    subtitle: 'Orbital Sounding & Plume Sampling',
    description: 'Conduct targeted flybys from Jovian orbit utilizing REASON ice-penetrating radar and MASPEX plume spectrometer. AETHON remains in Jupiter orbit.',
    associatedRoute: '/operations',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-recon-science',
        title: 'Primary Europa Reconnaissance Objectives Completed',
        description: 'Evaluate subsurface ocean boundary and confirm plume venting evidence.',
        type: 'OBJECTIVE',
        isMandatory: true,
        evaluator: (ctx) => {
          const objs = ctx.snapshot?.objectives ?? [];
          const obj1 = objs.find((o) => o.id === 'EXP-V-OBJ-01');
          const completed =
            obj1?.state === 'COMPLETED' ||
            (ctx.snapshot?.scienceProducts.totalCount ?? 0) >= 1 ||
            (ctx.snapshot?.navigation?.europaFlyby.reconnaissanceDataAcquired ?? false) ||
            ctx.processedEventTypes.has('RECONNAISSANCE_DATA_ACQUIRED') ||
            ctx.processedEventTypes.has('EUROPA_FLYBY_COMPLETE') ||
            ctx.processedEventIds.has('EUROPA_FLYBY_COMPLETE');
          return {
            satisfied: completed,
            reason: !completed ? 'Reconnaissance radar sounding or ocean basal detection pending' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: ['EXP-V-OBJ-01'],
    relevantEventTypes: ['EUROPA_FLYBY_COMPLETE', 'RECONNAISSANCE_DATA_ACQUIRED', 'SCIENCE_DATA_PROCESSED'],
  },

  SURFACE_MISSION_PREPARATION: {
    stageId: 'SURFACE_MISSION_PREPARATION',
    order: 10,
    title: 'Surface Mission Preparation',
    subtitle: 'Landing Site Targeting & Descent Planning',
    description: 'Select landing zone based on subsurface radar profiles and verify separate lander package readiness.',
    associatedRoute: '/decisions',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-surf-site-prep',
        title: 'Landing Site Selected & Validated',
        description: 'Chaos terrain / ridged plains target confirmed.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const siteReady =
            ctx.processedEventTypes.has('LANDING_SITE_SELECTED') ||
            ctx.processedEventIds.has('LANDING_SITE_SELECTED') ||
            (ctx.snapshot?.navigation?.lander.flightState !== 'STOWED' && ctx.snapshot?.navigation?.lander !== undefined) ||
            (ctx.snapshot?.decisionHistory.some(
              (h) => h.option.category === 'DEPLOY_LANDER' || h.decisionId.includes('lander')
            ) ?? false);
          return {
            satisfied: siteReady,
            reason: !siteReady ? 'Landing zone candidate analysis incomplete' : undefined,
          };
        },
      },
      {
        id: 'req-parking-orbit-auth',
        title: 'Europa Parking-Orbit Prerequisite Authorized',
        description: 'Explicit operational acknowledgment of 100 km circular parking orbit staging assumption.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const authorized =
            ctx.snapshot?.navigation?.lander.parkingOrbitPrerequisiteMet === true ||
            ctx.snapshot?.surface?.parkingOrbitPrerequisiteMet === true ||
            ctx.snapshot?.navigation?.isParkingOrbitBypassActive === true ||
            ctx.processedEventTypes.has('PARKING_ORBIT_ASSUMPTION_AUTHORIZED') ||
            ctx.processedEventIds.has('PARKING_ORBIT_ASSUMPTION_AUTHORIZED') ||
            ctx.processedEventTypes.has('PARKING_ORBIT_BYPASS_AUTHORIZED') ||
            ctx.processedEventIds.has('PARKING_ORBIT_BYPASS_AUTHORIZED') ||
            (ctx.snapshot?.decisionHistory.some(
              (h) =>
                (h.status === 'APPROVED' || h.status === 'EXECUTED') &&
                (h.option.id.includes('parking-orbit') || h.decisionId.includes('parking-orbit'))
            ) ?? false);
          return {
            satisfied: authorized,
            reason: !authorized
              ? 'Europa 100 km circular parking-orbit prerequisite unacknowledged'
              : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['LANDING_SITE_SELECTED', 'PARKING_ORBIT_ASSUMPTION_AUTHORIZED', 'PARKING_ORBIT_BYPASS_AUTHORIZED'],
  },

  LANDER_DEPLOYMENT: {
    stageId: 'LANDER_DEPLOYMENT',
    order: 11,
    title: 'Lander Deployment & Powered Descent',
    subtitle: 'Autonomous Near-Vacuum Deorbit & Powered Descent',
    description: 'Separate independent lander package and execute terminal rocket descent to Europa ice surface without atmospheric deceleration.',
    associatedRoute: '/decisions',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-lander-touchdown',
        title: 'Surface Package Soft Touchdown Confirmed',
        description: 'Independent lander package executes rocket powered descent and confirms soft touchdown.',
        type: 'EVENT_PROCESSED',
        isMandatory: true,
        evaluator: (ctx) => {
          const landed =
            ctx.processedEventTypes.has('LANDER_TOUCHDOWN') ||
            ctx.processedEventIds.has('LANDER_TOUCHDOWN') ||
            ctx.snapshot?.navigation?.lander.flightState === 'TOUCHDOWN' ||
            ctx.processedEventTypes.has('LANDER_DEPLOYMENT_COMPLETE') ||
            ctx.processedEventIds.has('LANDER_DEPLOYMENT_COMPLETE') ||
            (ctx.snapshot?.decisionHistory.some((h) => h.option.category === 'DEPLOY_LANDER') ?? false);
          return {
            satisfied: landed,
            reason: !landed ? 'Lander deorbit and touchdown sequence in progress' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: [
      'LANDER_DEPLOYED',
      'LANDER_DEPLOYMENT_COMPLETE',
      'LANDER_DESCENT_STARTED',
      'LANDER_TOUCHDOWN',
    ],
    failureConditions: [
      {
        id: 'fail-lander-crash',
        description: 'Lander terminal descent propulsion failure or crash.',
        evaluator: (ctx) => ({
          triggered:
            ctx.processedEventTypes.has('LANDER_DESCENT_FAILURE') ||
            ctx.processedEventIds.has('LANDER_DESCENT_FAILURE') ||
            ctx.snapshot?.navigation?.lander.flightState === 'CRASHED',
          failureReason: 'Lander terminal descent propulsion failure or excessive touchdown velocity.',
        }),
      },
    ],
  },

  SURFACE_OPERATIONS: {
    stageId: 'SURFACE_OPERATIONS',
    order: 12,
    title: 'Europa Surface Operations',
    subtitle: 'Cryogenic Ice Sampling & In-Situ Analysis',
    description: 'Deploy surface micro-rover and conduct spectroscopic analysis of pristine surface ice.',
    associatedRoute: '/surface',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-surf-sampling',
        title: 'Surface Analysis Conducted',
        description: 'Direct chemical / isotopic signatures analyzed.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const done =
            ctx.processedEventTypes.has('SURFACE_SAMPLING_COMPLETE') ||
            ctx.processedEventIds.has('SURFACE_SAMPLING_COMPLETE') ||
            ctx.processedEventTypes.has('SURFACE_OBSERVATION_ACQUIRED') ||
            ctx.processedEventIds.has('SURFACE_OBSERVATION_ACQUIRED') ||
            ((ctx.snapshot?.surface?.rover.observations.length ?? 0) >= 1) ||
            ctx.processedEventTypes.has('ROVER_DEPLOYMENT_COMPLETE') ||
            ctx.processedEventIds.has('ROVER_DEPLOYMENT_COMPLETE');
          return {
            satisfied: done,
            reason: !done ? 'Surface robotic sampling active' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: [
      'SURFACE_SAMPLING_COMPLETE',
      'ROVER_DEPLOYMENT_COMPLETE',
      'SURFACE_OBSERVATION_ACQUIRED',
      'SURFACE_TRAVERSE_COMPLETED',
    ],
  },

  ANOMALY_INVESTIGATION: {
    stageId: 'ANOMALY_INVESTIGATION',
    order: 13,
    title: 'Anomaly Investigation',
    subtitle: 'High-Resolution Target Profiling',
    description: 'Investigate unexpected cryovolcanic thermal or basal dielectric signatures.',
    associatedRoute: '/anomaly',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-anomaly-done',
        title: 'Anomaly Signatures Characterized',
        description: 'Spectral anomaly matched against astrobiological / geologic databases.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: (ctx) => {
          const evaluated =
            ctx.processedEventTypes.has('ANOMALY_INVESTIGATED') ||
            ctx.processedEventIds.has('ANOMALY_INVESTIGATED') ||
            (ctx.snapshot?.decisionHistory.some((h) => h.option.category === 'PRIORITIZE_ANOMALY') ?? false);
          return {
            satisfied: evaluated,
            reason: !evaluated ? 'Anomaly investigation still acquiring corroborating evidence' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['ANOMALY_DETECTED', 'ANOMALY_INVESTIGATED'],
  },

  FINAL_DATA_TRANSMISSION: {
    stageId: 'FINAL_DATA_TRANSMISSION',
    order: 14,
    title: 'Final Science Downlink',
    subtitle: 'DSN Deep Space Link Telemetry Dump',
    description: 'Downlink all high-resolution science, radar data, and engineering telemetry to Earth.',
    associatedRoute: '/operations',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-downlink-complete',
        title: 'Telemetry Downlink Complete',
        description: 'Onboard SSDR storage successfully downlinked to Deep Space Network.',
        type: 'COMM_WINDOW',
        isMandatory: true,
        evaluator: (ctx) => {
          const downlinked =
            ctx.processedEventTypes.has('DATA_TRANSMISSION_COMPLETE') ||
            ctx.processedEventIds.has('DATA_TRANSMISSION_COMPLETE');
          return {
            satisfied: downlinked,
            reason: !downlinked ? 'Transmission downlink pass active' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['DATA_TRANSMISSION_COMPLETE'],
  },

  MISSION_EVALUATION: {
    stageId: 'MISSION_EVALUATION',
    order: 15,
    title: 'Mission Evaluation & Scoring',
    subtitle: 'Primary & Secondary Objectives Verification',
    description: 'Evaluate comprehensive scientific yield, spacecraft survival, and data fidelity.',
    associatedRoute: '/decisions',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-eval-complete',
        title: 'Evaluation Confirmed',
        description: 'Mission director sign-off on final scientific return.',
        type: 'DECISION_EXECUTED',
        isMandatory: true,
        evaluator: (ctx) => {
          const evaluated =
            ctx.processedEventTypes.has('MISSION_OBJECTIVES_EVALUATED') ||
            ctx.processedEventIds.has('MISSION_OBJECTIVES_EVALUATED') ||
            ((ctx.snapshot?.objectives.length ?? 0) > 0 &&
              (ctx.snapshot?.objectives.every((o) => o.isCompleted || o.isFailed) ?? false));
          return {
            satisfied: evaluated,
            reason: !evaluated ? 'Mission scoring in progress' : undefined,
          };
        },
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['MISSION_OBJECTIVES_EVALUATED'],
  },

  MISSION_DEBRIEF: {
    stageId: 'MISSION_DEBRIEF',
    order: 16,
    title: 'Expedition Debrief',
    subtitle: 'Flight Telemetry & Scientific Archive',
    description: 'Formal operational review, anomaly root-cause summary, and crew debriefing.',
    associatedRoute: '/debrief',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-debrief-reviewed',
        title: 'Debrief Archive Finalized',
        description: 'Mission logs submitted to deep-space archives.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: () => ({ satisfied: true }),
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['MISSION_DEBRIEF_ARCHIVED'],
  },

  CAMPAIGN_COMPLETED: {
    stageId: 'CAMPAIGN_COMPLETED',
    order: 17,
    title: 'Campaign Completed',
    subtitle: 'Expedition-V Closed Nominal',
    description: 'The Europa Survey has concluded. Telemetry and science permanently archived.',
    associatedRoute: '/debrief',
    entryRequirements: [],
    completionRequirements: [
      {
        id: 'req-campaign-all-done',
        title: 'Expedition Completed',
        description: 'Final milestone reached.',
        type: 'CUSTOM',
        isMandatory: true,
        evaluator: () => ({ satisfied: true }),
      },
    ],
    requiredObjectiveIds: [],
    relevantEventTypes: ['CAMPAIGN_COMPLETED'],
  },
};
