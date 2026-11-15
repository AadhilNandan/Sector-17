/**
 * SECTOR 17 — Decision Consequence Panel
 * Displays authentic consequences resulting from executed mission decisions,
 * including resource consumption, objective milestone progress, and avionics state changes.
 */

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  Fuel,
  Database,
  Target,
  Terminal,
  Activity,
  Layers,
} from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { formatMET } from '../../../simulation/operations/missionClock';
import type {
  DecisionExecutionResult,
  MissionConsequence,
  ConsequenceType,
} from '../../../simulation/missionDecision/types';

interface DecisionConsequencePanelProps {
  executionResult?: DecisionExecutionResult;
  consequences?: readonly MissionConsequence[];
  title?: string;
}

export const DecisionConsequencePanel: React.FC<DecisionConsequencePanelProps> = ({
  executionResult,
  consequences: directConsequences,
  title = 'Simulation Consequence Report',
}) => {
  const isFailed = executionResult && !executionResult.success;
  const consequences = executionResult?.consequences ?? directConsequences ?? [];

  const getConsequenceIcon = (type: ConsequenceType) => {
    switch (type) {
      case 'RESOURCE_EXPENDITURE':
        return <Fuel size={13} className="text-[#F5A623]" />;
      case 'OBJECTIVE_PROGRESS':
        return <Target size={13} className="text-[#31C48D]" />;
      case 'SUBSYSTEM_STATE_CHANGE':
        return <Activity size={13} className="text-[#35C6F4]" />;
      case 'TELEMETRY_QUEUED':
        return <Database size={13} className="text-[#60A5FA]" />;
      case 'COMMAND_DISPATCHED':
        return <Terminal size={13} className="text-[#A78BFA]" />;
      case 'TIMELINE_EVENT_SCHEDULED':
      default:
        return <Layers size={13} className="text-[#A5B1C2]" />;
    }
  };

  const getConsequenceBadge = (type: ConsequenceType) => {
    switch (type) {
      case 'RESOURCE_EXPENDITURE':
        return 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/30';
      case 'OBJECTIVE_PROGRESS':
        return 'text-[#31C48D] bg-[#31C48D]/10 border-[#31C48D]/30';
      case 'SUBSYSTEM_STATE_CHANGE':
        return 'text-[#35C6F4] bg-[#35C6F4]/10 border-[#35C6F4]/30';
      case 'TELEMETRY_QUEUED':
        return 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/30';
      case 'COMMAND_DISPATCHED':
        return 'text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30';
      default:
        return 'text-[#A5B1C2] bg-white/5 border-white/10';
    }
  };

  return (
    <GamePanel
      title={title}
      subtitle="Authoritative Physical & Operational Engine Consequence Audit"
      className="border-white/10"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Execution Result Banner */}
        {executionResult && (
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
              executionResult.success
                ? 'bg-[#31C48D]/15 border-[#31C48D]/30 text-[#31C48D]'
                : 'bg-[#EF6464]/15 border-[#EF6464]/30 text-[#EF6464]'
            }`}
          >
            <div className="flex items-center gap-2">
              {executionResult.success ? (
                <CheckCircle2 size={16} className="shrink-0" />
              ) : (
                <XCircle size={16} className="shrink-0" />
              )}
              <div>
                <div className="font-bold text-xs uppercase">
                  {executionResult.success ? 'EXECUTION SUCCESSFUL' : 'EXECUTION FAILED'}
                </div>
                <div className="text-[10px] text-[#A5B1C2]">
                  Executed at {formatMET(executionResult.executedAtMET)}
                </div>
              </div>
            </div>

            {executionResult.dispatchedCommandId && (
              <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-[#F1F5FA]">
                CMD: {executionResult.dispatchedCommandId}
              </span>
            )}
          </div>
        )}

        {/* Failure Explanation */}
        {isFailed && executionResult?.errorMessage && (
          <div className="p-3 rounded-xl bg-[#EF6464]/10 border border-[#EF6464]/20 text-[#EF6464] space-y-1 font-sans">
            <div className="text-xs font-bold uppercase">Failure Root Cause</div>
            <p className="text-[11px] text-[#FCA5A5] leading-relaxed">
              {executionResult.errorMessage}
            </p>
          </div>
        )}

        {/* Applied Consequences List */}
        <div className="space-y-2">
          <div className="text-[11px] text-[#A5B1C2] uppercase tracking-wider font-semibold">
            Applied Simulation Consequences ({consequences.length})
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {consequences.length > 0 ? (
              consequences.map((cons, idx) => (
                <div
                  key={`${cons.affectedTarget}-${idx}`}
                  className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {getConsequenceIcon(cons.type)}
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getConsequenceBadge(cons.type)}`}>
                        {cons.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-semibold text-[#F1F5FA]">
                        {cons.affectedTarget}
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-[#35C6F4]">
                      {String(cons.deltaOrValue)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#CBD5E1] font-sans leading-relaxed">
                    {cons.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[#6D7A8D] bg-white/[0.02] rounded-lg border border-white/5">
                No active simulation consequence records available.
              </div>
            )}
          </div>
        </div>
      </div>
    </GamePanel>
  );
};
