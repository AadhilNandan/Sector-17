import React from 'react';
import type { SpacecraftConfig } from '../../../types/game';

export interface DebriefDecisionChainProps {
  spacecraftConfig?: Readonly<SpacecraftConfig>;
  outcome?: string;
  anomalyStatus?: string;
}

export const DebriefDecisionChain: React.FC<DebriefDecisionChainProps> = ({
  spacecraftConfig,
  outcome = 'PARTIAL_SUCCESS',
  anomalyStatus = 'UNVERIFIED',
}) => {
  // Extract installed instrument names or fallback to defaults from screenshot
  const instrumentNames = spacecraftConfig?.parts?.instruments?.name
    ? spacecraftConfig.parts.instruments.name
    : 'IPR-3 / MAG-BOOM';

  const isFullSuccess = outcome === 'FULL_SUCCESS';
  const isFailure = outcome === 'MISSION_FAILURE';
  const isAnomalyVerified = anomalyStatus === 'VERIFIED' || anomalyStatus === 'RESOLVED';

  return (
    <div className="flex flex-col gap-1 w-full font-mono select-none text-xs">
      {/* Title */}
      <div className="flex items-baseline gap-2 border-b border-[#2E3440]/20 pb-1">
        <span className="text-[11px] font-bold text-[#2E3440] uppercase tracking-wider">
          DECISION-CHAIN TIMELINE
        </span>
        <span className="text-[9px] text-[#2E3440]/60 lowercase">small Plex Mono</span>
      </div>

      {/* Decision Nodes */}
      <div className="space-y-2 py-1 text-[11px] text-[#2E3440] leading-tight">
        {/* Step 1: OBJECTIVE -> INSTRUMENT */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <span className="font-bold tracking-wider">
              OBJECTIVE &rarr; INSTRUMENT
            </span>
            <span className="text-[10px] text-[#2E3440]/80">
              Europa Survey &bull; {instrumentNames}
            </span>
          </div>
          <div className="text-right text-[10px] font-semibold text-[#2E3440]/80">
            <span>Pass</span>
            <span className="block">Ready</span>
          </div>
        </div>

        {/* Step 2: VALIDATION -> AETHON */}
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-wider">
            VALIDATION &rarr; AETHON
          </span>
          <span className="text-[10px] font-semibold text-[#2E3440]/80">
            Validated Point Design
          </span>
        </div>

        {/* Step 3: ACQUISITION */}
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-wider">
            ACQUISITION &rarr;
          </span>
          <span className="text-[10px] text-[#2E3440]/80">
            {isFailure
              ? 'Loss of signal / Pre-encounter loss'
              : 'Anomalous transmission'}
          </span>
        </div>

        {/* Step 4: PROCESSING */}
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-wider">
            PROCESSING &rarr;
          </span>
          <span className="text-[10px] text-[#2E3440]/80">
            {isFailure
              ? 'Telemetry interrupted'
              : isFullSuccess
                ? 'High-fidelity resolution'
                : 'High distortion'}
          </span>
        </div>

        {/* Step 5: RESULTS */}
        <div className="flex items-center justify-between">
          <span className="font-bold tracking-wider">
            RESULTS &rarr;
          </span>
          <span className="text-[10px] text-[#2E3440]/80">
            {isFailure
              ? 'Incomplete telemetry / Vehicle lost'
              : isAnomalyVerified
                ? 'Complete telemetry / Validated source'
                : 'Partial telemetry / Unverified source'}
          </span>
        </div>
      </div>
    </div>
  );
};
