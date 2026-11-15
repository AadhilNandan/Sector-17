/**
 * SECTOR 17 — Mission Objectives Telemetry Panel
 * Directly sources live evaluation reports from MissionObjectiveEvaluator.
 * Avoids any duplicate evaluation engine in React.
 */

import React from 'react';
import { Target, CheckCircle2, AlertOctagon, Clock, Lock } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot } from '../../../runtime';
import type { ObjectiveState, ObjectivePriority } from '../../../simulation/missionDecision/types';

export const MissionObjectivesPanel: React.FC = () => {
  const snap = useSimulationSnapshot();
  const objectives = snap.objectives;

  const getStateBadge = (state: ObjectiveState) => {
    switch (state) {
      case 'COMPLETED':
        return {
          pillClass: 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30',
          icon: <CheckCircle2 size={11} className="text-[#31C48D]" />,
          label: 'COMPLETED',
        };
      case 'IN_PROGRESS':
        return {
          pillClass: 'bg-[#35C6F4]/15 text-[#35C6F4] border-[#35C6F4]/30',
          icon: <Target size={11} className="text-[#35C6F4]" />,
          label: 'IN PROGRESS',
        };
      case 'BLOCKED':
        return {
          pillClass: 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30',
          icon: <Lock size={11} className="text-[#F5A623]" />,
          label: 'BLOCKED',
        };
      case 'FAILED':
        return {
          pillClass: 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30',
          icon: <AlertOctagon size={11} className="text-[#EF6464]" />,
          label: 'FAILED',
        };
      case 'NOT_STARTED':
      default:
        return {
          pillClass: 'bg-white/5 text-[#A5B1C2] border-white/10',
          icon: <Clock size={11} className="text-[#A5B1C2]" />,
          label: 'PENDING',
        };
    }
  };

  const getPriorityBadge = (priority: ObjectivePriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'text-[#EF6464] bg-[#EF6464]/10 border-[#EF6464]/20';
      case 'PRIMARY':
        return 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/20';
      case 'SECONDARY':
        return 'text-[#35C6F4] bg-[#35C6F4]/10 border-[#35C6F4]/20';
      default:
        return 'text-[#A5B1C2] bg-white/5 border-white/10';
    }
  };

  return (
    <GamePanel
      title="Mission Objectives"
      subtitle="Expedition-V Primary Scientific Milestones"
      className="border-white/10"
    >
      <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
        {objectives && objectives.length > 0 ? (
          objectives.map((obj) => {
            const stateBadge = getStateBadge(obj.state);
            const priorityClass = getPriorityBadge(obj.priority);

            return (
              <div
                key={obj.id}
                className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all space-y-2"
              >
                {/* Header: Title and Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase border ${priorityClass}`}>
                        {obj.priority}
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#F1F5FA] tracking-wide">
                        {obj.title}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-[#A5B1C2] leading-tight line-clamp-2">
                      {obj.description}
                    </p>
                  </div>

                  <div className={`shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${stateBadge.pillClass}`}>
                    {stateBadge.icon}
                    <span>{stateBadge.label}</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        obj.state === 'COMPLETED'
                          ? 'bg-[#31C48D]'
                          : obj.state === 'BLOCKED'
                          ? 'bg-[#F5A623]'
                          : obj.state === 'FAILED'
                          ? 'bg-[#EF6464]'
                          : 'bg-[#35C6F4]'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, obj.progressPercent))}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-mono text-[#6D7A8D]">
                    <span>
                      {obj.unsatisfiedPrerequisites && obj.unsatisfiedPrerequisites.length > 0
                        ? `Prereqs: ${obj.unsatisfiedPrerequisites.join(', ')}`
                        : 'Prerequisites Met'}
                    </span>
                    <span className="font-bold text-[#A5B1C2]">
                      {obj.progressPercent.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-3 text-center text-xs font-mono text-[#A5B1C2] bg-white/5 rounded-lg border border-white/10">
            NO OBJECTIVES INDEXED
          </div>
        )}
      </div>
    </GamePanel>
  );
};

