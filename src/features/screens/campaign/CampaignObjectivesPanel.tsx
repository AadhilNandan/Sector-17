/**
 * SECTOR 17 — Campaign Objectives & Requirements Panel
 * Detailed view of entry gates, completion criteria, and simulation objectives for a stage.
 */

import React from 'react';
import type { CampaignStageConfig, CampaignStageStatus } from '../../../campaign/campaignTypes';
import type { MissionObjectiveSnapshot } from '../../../runtime/types';
import { Target, ShieldAlert, CheckCircle2, Circle } from 'lucide-react';

interface CampaignObjectivesPanelProps {
  stage: CampaignStageConfig;
  status: CampaignStageStatus;
  activeBlockers: readonly string[];
  objectives: readonly MissionObjectiveSnapshot[];
  isCurrentStage: boolean;
}

export const CampaignObjectivesPanel: React.FC<CampaignObjectivesPanelProps> = ({
  stage,
  status,
  activeBlockers,
  objectives,
  isCurrentStage,
}) => {
  const relevantObjectives = objectives.filter((o) => stage.requiredObjectiveIds.includes(o.id));

  return (
    <div className="flex flex-col h-full bg-[#0B0F17]/80 rounded-xl border border-white/10 p-5 overflow-y-auto custom-scrollbar space-y-5">
      {/* Stage Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#35C6F4] mb-1">
          <span>STAGE {String(stage.order + 1).padStart(2, '0')}</span>
          <span>·</span>
          <span>{stage.subtitle}</span>
        </div>
        <h2 className="text-lg font-bold text-slate-100 tracking-wide mb-1.5">
          {stage.title}
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          {stage.description}
        </p>
      </div>

      {/* Critical Blockers Alert if any */}
      {isCurrentStage && activeBlockers.length > 0 && (
        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono space-y-1.5" data-testid="campaign-blockers-banner">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-400">
            <ShieldAlert size={15} />
            <span>Operational Stage Blockers</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-amber-200/90">
            {activeBlockers.map((b, idx) => (
              <li key={idx}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Completion Criteria Gates */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 uppercase tracking-wider">
          <Target size={14} className="text-[#F5A623]" />
          <span>Stage Completion Gates</span>
        </div>

        {stage.completionRequirements.length === 0 ? (
          <p className="text-xs text-slate-500 font-mono italic">No explicit completion gates.</p>
        ) : (
          <div className="space-y-2">
            {stage.completionRequirements.map((req) => (
              <div
                key={req.id}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {status === 'COMPLETED' ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : (
                      <Circle size={13} className="text-slate-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-200">{req.title}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                    {req.type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pl-5">{req.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Associated Authoritative Mission Objectives */}
      {relevantObjectives.length > 0 && (
        <div className="space-y-2.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-300 uppercase tracking-wider">
            <span>Authoritative Mission Objectives</span>
            <span className="text-[10px] text-slate-500">{relevantObjectives.length} Linked</span>
          </div>

          <div className="space-y-2">
            {relevantObjectives.map((obj) => (
              <div
                key={obj.id}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#35C6F4]">{obj.id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                      obj.state === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-400 border border-white/10'
                    }`}
                  >
                    {obj.state}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-medium text-slate-200">{obj.title}</div>
                  <div className="text-[11px] text-slate-400">{obj.description}</div>
                </div>

                {/* Objective Progress Bar */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Progress</span>
                    <span>{Math.round(obj.progressPercent)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        obj.state === 'COMPLETED' ? 'bg-emerald-500' : 'bg-[#35C6F4]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, obj.progressPercent))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
