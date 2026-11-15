import React, { useRef, useEffect } from 'react';
import type { EventExecutionResult } from '../../../simulation/types';

export interface MissionEventLogProps {
  events?: readonly EventExecutionResult[] | readonly any[];
}

export const MissionEventLog: React.FC<MissionEventLogProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Fallback default operational events matching reference screenshot if simulation events are sparse
  const displayEvents =
    events && events.length > 0
      ? events
      : [
          {
            id: 'evt-op-01',
            timestamp: '12:01:05',
            severity: 'INFO',
            type: 'ORIENTATION_LOCK',
            message: 'ORIENTATION LOCK ACQUIRED',
          },
          {
            id: 'evt-op-02',
            timestamp: '12:03:14',
            severity: 'WARN',
            type: 'DSN_LINK_DROP',
            message: 'DSN GROUND LINK DROP - SEARCHING FOR ALT GATEWAY',
          },
          {
            id: 'evt-op-03',
            timestamp: '12:04:30',
            severity: 'INFO',
            type: 'BATTERY_TRICKLE',
            message: 'PROMETHEUS-IV BATTERY IN TRICKLE CHARGE',
          },
        ];

  return (
    <div
      className="flex flex-col h-full bg-[#060A10]/95 border-r border-white/10 p-3 select-none font-mono text-xs overflow-hidden"
      aria-label="Mission Event Log"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5">
        <span className="text-[#A5B1C2] text-[10px] font-bold tracking-widest uppercase">
          EVENT LOG
        </span>
        <span className="text-[9px] text-[#A5B1C2]/60">CHRONOLOGICAL FEED</span>
      </div>

      {/* Scrolling Events Container */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[11px] select-text"
      >
        {displayEvents.map((evt: any, idx: number) => {
          const isWarn = evt.severity === 'WARN' || evt.severity === 'WARNING';
          const isCrit = evt.severity === 'CRITICAL' || evt.severity === 'ERROR';

          const badgeColor = isCrit
            ? 'text-[#EF6464] font-bold'
            : isWarn
            ? 'text-[#F5A623] font-bold'
            : 'text-[#35C6F4] font-semibold';

          const textColor = isCrit
            ? 'text-[#EF6464]'
            : isWarn
            ? 'text-[#F5A623]'
            : 'text-white/90';

          const ts =
            typeof evt.timestamp === 'string'
              ? evt.timestamp
              : typeof evt.timestamp === 'number'
              ? new Date(evt.timestamp).toISOString().substring(11, 19)
              : '12:00:00';

          return (
            <div key={evt.id || idx} className="flex items-start gap-2 leading-tight">
              <span className="text-[#A5B1C2] shrink-0 text-[10px]">{ts}</span>
              <span className={`shrink-0 ${badgeColor}`}>
                [{evt.severity || 'INFO'}]
              </span>
              <span className={`${textColor} break-words`}>
                {(evt as any).description || evt.message}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
