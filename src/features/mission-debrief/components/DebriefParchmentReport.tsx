import React from 'react';
import type { SimulationSnapshot } from '../../../runtime/types';
import { DebriefTrajectoryReplay } from './DebriefTrajectoryReplay';
import { DebriefDecisionChain } from './DebriefDecisionChain';

export interface DebriefParchmentReportProps {
  snapshot: SimulationSnapshot;
}

export const DebriefParchmentReport: React.FC<DebriefParchmentReportProps> = ({ snapshot }) => {
  const evalReport = snapshot.missionEvaluation;
  const outcome = evalReport?.outcome ?? 'PARTIAL_SUCCESS';
  const isFailure = outcome === 'MISSION_FAILURE';
  const isFullSuccess = outcome === 'FULL_SUCCESS';
  
  // Format MET: use formattedMET or calculate from seconds
  const formattedMET = snapshot.formattedMET && snapshot.formattedMET !== '000:00:00:00'
    ? snapshot.formattedMET
    : evalReport?.evaluatedAtMET
      ? `${Math.floor(evalReport.evaluatedAtMET / 86400)}:${String(Math.floor((evalReport.evaluatedAtMET % 86400) / 3600)).padStart(2, '0')}:${String(Math.floor((evalReport.evaluatedAtMET % 3600) / 60)).padStart(2, '0')}`
      : '198:04:12';

  // Science bytes: distinguish between acquired (in storage) and returned (downlinked)
  const returnedBytes = evalReport?.scienceBytesReturnedToEarth ?? 0;
  const acquiredBytes = evalReport?.totalScienceBytesAcquired ?? snapshot.storage?.usedBytes ?? 0;

  let dataResolvedDisplay = '0.0 GB';
  if (returnedBytes > 0) {
    dataResolvedDisplay = `${(returnedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  } else if (acquiredBytes > 0) {
    dataResolvedDisplay = `${(acquiredBytes / (1024 * 1024)).toFixed(1)} MB (UNTRANSMITTED)`;
  } else if (isFailure) {
    dataResolvedDisplay = 'UNKNOWN / NOT RECORDED';
  }

  // Budget expenditure: propellant consumed percentage
  const propCapacity = snapshot.propellantCapacityKg > 0 ? snapshot.propellantCapacityKg : 1000;
  const propRemaining = snapshot.propellantRemainingKg >= 0 ? snapshot.propellantRemainingKg : 16;
  const propConsumed = Math.max(0, propCapacity - propRemaining);
  const budgetExpPercent = Math.min(100, Math.max(0, (propConsumed / propCapacity) * 100)).toFixed(1);

  // Anomaly resolution status: strictly based on recorded evidence
  const isAnomalyInvestigated = Boolean(evalReport?.anomalyInvestigated || evalReport?.anomalyDecision);
  const anomalyResolution = isAnomalyInvestigated ? 'VERIFIED' : 'UNVERIFIED';

  // Reliability tag for rubber stamp
  const reliabilityTag = isFullSuccess
    ? 'RELIABILITY ASSESS: NOMINAL'
    : isFailure
      ? 'RELIABILITY ASSESS: CRITICAL'
      : 'RELIABILITY ASSESS: SUB-OPTIMAL';

  // Heading text
  const outcomeHeading = isFullSuccess
    ? 'FULL SUCCESS // DIRECTIVE COMPLETED'
    : isFailure
      ? 'MISSION FAILURE // VEHICLE LOST'
      : 'PARTIAL SUCCESS // DATA ACQUIRED';

  // Subtitle
  const outcomeSubtitle = 'OR COMPLETED // ARCHIVED WITH THE FINAL MISSION STAMP.';

  // Installed parts summary for engineering decisions narrative
  const instrumentsName = snapshot.spacecraftConfig?.parts?.instruments?.name ?? 'ICE-PENETRATING RADAR (IPR-3) and MAG-BOOM';
  const powerSource = snapshot.spacecraftConfig?.parts?.power?.name ?? 'RTG-750W';
  const propulsionName = snapshot.spacecraftConfig?.parts?.propulsion?.name ?? 'Bipropellant Main Engine';
  const launchVehicleName = snapshot.spacecraftConfig?.launchVehicle?.name ?? 'SLS Block 1B';

  // Discoveries list from authoritative evaluation
  const discoveries = evalReport?.discoveries ?? [];

  // Construct dynamic science narrative strictly from recorded evidence
  let scienceReturnedNarrative = '';
  if (isFailure || (returnedBytes === 0 && acquiredBytes === 0)) {
    scienceReturnedNarrative = 'UNKNOWN / NOT RECORDED: Critical vehicle loss or downlink termination occurred prior to scientific data acquisition. No science telemetry packets successfully returned to Earth Ground Stations.';
  } else if (returnedBytes === 0 && acquiredBytes > 0) {
    scienceReturnedNarrative = `DATA UNRESOLVED: Scientific observations (${(acquiredBytes / (1024 * 1024)).toFixed(1)} MB acquired) remain stored in spacecraft solid-state memory, but were not successfully downlinked to Deep Space Network stations prior to mission conclusion. Ground validation pending RF link reacquisition.`;
  } else if (discoveries.length > 0) {
    scienceReturnedNarrative = `Confirmed findings based on ${(returnedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB downlinked science telemetry: ${discoveries.join('. ')}. Subsurface sounding and volatile spectrometry data validated against Earth mission models.`;
  } else {
    scienceReturnedNarrative = `Telemetry of ${(returnedBytes / (1024 * 1024 * 1024)).toFixed(1)} GB successfully downlinked and ingested by the Deep Space Network. Preliminary observation batches logged; detailed ocean conductivity and dielectric interface models remain in processing.`;
  }

  // Construct dynamic anomaly narrative strictly from recorded investigation
  let anomalyNarrative = '';
  if (isAnomalyInvestigated) {
    const decisionStr = evalReport?.anomalyDecision?.toUpperCase() ?? 'ANALYSIS';
    anomalyNarrative = `VERIFIED: Anomalous precursor structure investigated at Target-B. Relic-Omega (FICTIONAL HYPOTHESIS — EXPLORED VIA ${decisionStr}). Artificial structural resonance pattern logged. Classified strictly as anomalous scientific phenomenon; no biological signatures detected.`;
  } else if (isFailure) {
    anomalyNarrative = 'UNVERIFIED / NOT ACCESSIBLE: Spacecraft did not attain Europa orbital survey geometry prior to vehicle loss. Target-B remains unobserved.';
  } else {
    anomalyNarrative = 'UNVERIFIED / NO ON-SITE INVESTIGATION LOGGED: Potential anomalous readings noted at Target-B (Relic-Omega hypothesis). Spacecraft did not conduct dedicated close-range reconnaissance or instrument pointing. Phenomenon remains unverified.';
  }

  // Construct dynamic engineering decisions narrative
  let engineeringNarrative = '';
  if (isFailure) {
    engineeringNarrative = `Spacecraft AETHON was configured with ${instrumentsName}, powered by ${powerSource}, and propelled by ${propulsionName} launched aboard ${launchVehicleName}. Vehicle suffered mission-terminating subsystem failure during flight operations.`;
  } else {
    engineeringNarrative = `The operational selection of ${instrumentsName} coupled with ${powerSource} and ${propulsionName} launched aboard ${launchVehicleName} provided primary telemetry across Jupiter capture and Europa orbital insertion. Power margins remained rigorously managed under low Jovian solar irradiance, maintaining bus voltage stability and thermal balance within specified flight safety envelopes.`;
  }

  // Construct dynamic lessons learned narrative
  let lessonsNarrative = '';
  if (isFailure) {
    const faultNote = evalReport?.activeFaultCount ? `${evalReport.activeFaultCount} active critical fault(s) compromised vehicle integrity.` : 'Propellant exhaustion or trajectory departure prevented directive completion.';
    lessonsNarrative = `Mission failure analysis: Spacecraft margins collapsed under operational stress. ${faultNote} Future Jovian carrier architectures require expanded propellant reserves and redundant telemetry links.`;
  } else if (outcome === 'PARTIAL_SUCCESS') {
    lessonsNarrative = `Power and mass margins are critical. The high weight of the science payload constrained deployment allocations. Propellant expenditure reached ${budgetExpPercent}%, limiting secondary trajectory adjustments. Future Jovian carriers require higher-gain phased array tracking.`;
  } else {
    lessonsNarrative = 'All mission flight envelope constraints satisfied. Balanced power reserves and propellant margins validated point design trade studies. Multi-instrument survey profile successfully validated for future Jovian outer-planet exploration.';
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto my-auto p-2 sm:p-4 select-none">
      {/* Parchment Dossier Card */}
      <div className="relative w-full bg-[#EAE2D2] text-[#2E3440] rounded shadow-[0_25px_50px_-12px_rgba(0,0,0,0.85)] border border-[#3A342A]/40 overflow-hidden flex flex-col md:flex-row" data-tutorial-id="doc-parchment-report">
        
        {/* Vertical Left Tab: [ MISSION REPORT ] */}
        <div className="hidden md:flex flex-col items-center justify-center bg-[#DDD4C2] border-r border-[#2E3440]/25 px-2 py-6 select-none shrink-0">
          <span
            className="font-mono font-black text-xs tracking-widest text-[#2E3440]/80 uppercase"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            MISSION REPORT
          </span>
        </div>

        {/* Parchment Body */}
        <div className="flex-1 p-5 sm:p-7 flex flex-col gap-4 font-mono">
          
          {/* 1. Header Banner & Assessment Disclaimer */}
          <div className="border-b border-[#2E3440]/20 pb-2">
            <span className="text-[10px] text-[#2E3440]/75 tracking-wider uppercase font-mono block">
              SECTOR 17 READINESS ASSESSMENT // PRE-ARCHIVE STATUS (Inspired by NASA concept maturity levels, NOT an official NASA CML score)
            </span>
          </div>

          {/* 2. Outcome Title & Rotated Rubber Stamp */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#2E3440] font-sans tracking-wide uppercase leading-tight">
                {outcomeHeading}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#2E3440]/80 font-mono tracking-wider uppercase mt-1">
                {outcomeSubtitle}
              </p>
            </div>

            {/* Rotated Terracotta Rubber Stamp */}
            <div className="self-end sm:self-center shrink-0 transform -rotate-3 hover:rotate-0 transition-transform duration-200">
              <div className="border-[3px] border-[#A64B2A] rounded px-3 py-1.5 sm:px-4 sm:py-2 flex flex-col items-center justify-center bg-[#A64B2A]/5 shadow-sm">
                <span className="font-sans font-black text-lg sm:text-xl text-[#A64B2A] tracking-widest uppercase leading-tight">
                  RECORD CLOSED
                </span>
                <span className="font-mono font-bold text-[9px] sm:text-[10px] text-[#A64B2A] tracking-wider uppercase mt-0.5">
                  {reliabilityTag}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Authoritative Telemetry Strip */}
          <div className="w-full py-2 px-3 bg-[#E0D7C5]/70 rounded border border-[#2E3440]/15 flex flex-wrap items-center justify-between gap-2 text-xs font-mono font-semibold text-[#2E3440]">
            <div>
              <span className="text-[#2E3440]/60">MET: </span>
              <span>{formattedMET}</span>
            </div>
            <span className="text-[#2E3440]/30 hidden sm:inline">|</span>
            <div>
              <span className="text-[#2E3440]/60">DATA RESOLVED: </span>
              <span>{dataResolvedDisplay}</span>
            </div>
            <span className="text-[#2E3440]/30 hidden sm:inline">|</span>
            <div>
              <span className="text-[#2E3440]/60">BUDGET EXP.: </span>
              <span>{budgetExpPercent}%</span>
            </div>
            <span className="text-[#2E3440]/30 hidden sm:inline">|</span>
            <div>
              <span className="text-[#2E3440]/60">ANOMALY RESOLUTION: </span>
              <span className="font-bold">{anomalyResolution}</span>
            </div>
          </div>

          {/* 4. Two-Column Report Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
            
            {/* Left Column: Mission Report Narratives (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4 max-h-[380px] overflow-y-auto pr-2 text-xs text-[#2E3440]/90 leading-relaxed font-sans">
              
              {/* Engineering Decisions */}
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#2E3440] mb-1">
                  ENGINEERING DECISIONS
                </h3>
                <p>
                  {engineeringNarrative}
                </p>
              </div>

              {/* Science Returned */}
              <div data-tutorial-id="section-science-returned">
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#2E3440] mb-1">
                  SCIENCE RETURNED
                </h3>
                <p>
                  {scienceReturnedNarrative}
                </p>
              </div>

              {/* Anomaly Findings */}
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#2E3440] mb-1">
                  ANOMALY FINDINGS
                </h3>
                <p>
                  {anomalyNarrative}
                </p>
              </div>

              {/* Lessons Learned */}
              <div>
                <h3 className="font-mono font-bold text-xs uppercase tracking-wider text-[#2E3440] mb-1">
                  LESSONS LEARNED
                </h3>
                <p>
                  {lessonsNarrative}
                </p>
              </div>

            </div>

            {/* Right Column: Replay & Decision Chain (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-[#2E3440]/20 pt-4 lg:pt-0 lg:pl-6" data-tutorial-id="diagram-trajectory-replay">
              <DebriefTrajectoryReplay isDescentPerformed={!isFailure} />
              <DebriefDecisionChain
                spacecraftConfig={snapshot.spacecraftConfig}
                outcome={outcome}
                anomalyStatus={anomalyResolution}
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
