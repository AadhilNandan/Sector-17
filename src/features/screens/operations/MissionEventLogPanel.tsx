/**
 * SECTOR 17 — Mission Operations Event Log Panel
 * Chronological audit feed of mission events recorded by MissionEventEngine.
 * Strictly avoids fictional filler events.
 */

import React, { useState } from 'react';
import { Terminal, ShieldAlert, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot } from '../../../runtime';
import { formatMET } from '../../../simulation/operations/missionClock';

export const MissionEventLogPanel: React.FC = () => {
  const snap = useSimulationSnapshot();
  const [showAll, setShowAll] = useState(false);
  const events = snap.recentEvents;

  // Display recent entries in reverse-chronological order (newest first)
  const sorted = [...events].reverse();
  const displayed = showAll ? sorted : sorted.slice(0, 6);

  const getEventBadge = (type: string, success: boolean) => {
    if (!success) {
      return {
        icon: <ShieldAlert size={12} className="text-[#EF6464]" />,
        pillClass: 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30',
        label: 'FAIL',
      };
    }
    if (type.includes('ANOMALY') || type.includes('FAULT')) {
      return {
        icon: <AlertTriangle size={12} className="text-[#F5A623]" />,
        pillClass: 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30',
        label: 'WARN',
      };
    }
    if (type.includes('OBJECTIVE') || type.includes('DECISION') || type.includes('COMPLETED')) {
      return {
        icon: <CheckCircle2 size={12} className="text-[#31C48D]" />,
        pillClass: 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30',
        label: 'OK',
      };
    }
    return {
      icon: <Info size={12} className="text-[#35C6F4]" />,
      pillClass: 'bg-[#35C6F4]/15 text-[#35C6F4] border-[#35C6F4]/30',
      label: 'INFO',
    };
  };

  return (
    <GamePanel
      title="Mission Event Log"
      subtitle="Avionics & Operations Chronological Audit"
      headerAction={
        events.length > 6 ? (
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-[10px] font-mono text-[#35C6F4] hover:underline uppercase tracking-wider cursor-pointer"
          >
            {showAll ? 'Show Recent (6)' : `View All (${events.length})`}
          </button>
        ) : undefined
      }
      className="border-white/10"
    >
      <div className="space-y-2 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
        {displayed.length > 0 ? (
          displayed.map((evt, idx) => {
            const badge = getEventBadge(evt.eventType, evt.success);
            return (
              <div
                key={`${evt.eventId}-${idx}`}
                className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all text-[11px]"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="shrink-0">{badge.icon}</div>
                  <span className="text-[#35C6F4] shrink-0 text-[10px]">
                    {formatMET(evt.executedAtSeconds)}
                  </span>
                  <span className="text-[#F1F5FA] font-medium truncate">
                    {evt.eventType}
                  </span>
                </div>

                <div
                  className={`shrink-0 ml-2 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${badge.pillClass}`}
                >
                  {badge.label}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-4 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-lg border border-white/5">
            <Terminal size={16} className="mx-auto mb-1.5 opacity-50" />
            <div>NO RECENT TIMELINE EVENTS</div>
            <div className="text-[10px] mt-0.5">
              Advance simulation time to process scheduled milestones and telecommands.
            </div>
          </div>
        )}
      </div>
    </GamePanel>
  );
};

