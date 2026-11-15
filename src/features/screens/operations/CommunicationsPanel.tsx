/**
 * SECTOR 17 — Deep-Space Communications & DSN Telemetry Panel
 * Real visibility evaluation across Goldstone, Madrid, and Canberra stations.
 * Refrains from claiming an active link when no line-of-sight pass exists.
 */

import React, { useState } from 'react';
import { Radio, ArrowDownCircle, ArrowUpCircle, Clock, Send, Download } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { useSimulationSnapshot, useCommunications } from '../../../runtime';

export const CommunicationsPanel: React.FC = () => {
  const snap = useSimulationSnapshot();
  const comm = snap.communications;
  const { queueAllStoredScienceForDownlink, executeDsnDownlinkStep } = useCommunications();
  const [downlinkStatus, setDownlinkStatus] = useState<string | null>(null);

  const owltSec = comm.oneWayLightTimeSeconds;
  const owltMin = owltSec / 60;

  const handleQueueScience = () => {
    const res = queueAllStoredScienceForDownlink();
    setDownlinkStatus(`Queued ${res.queuedCount} telemetry packet(s) (${(res.totalBytes / 1e6).toFixed(1)} MB).`);
  };

  const handleExecuteDownlink = () => {
    const res = executeDsnDownlinkStep(3600);
    setDownlinkStatus(
      res.success
        ? `DSN Downlink pass executed. Received ${res.newlyReceivedCount} packet(s) at Earth.`
        : 'DSN downlink pending window or transmission.'
    );
  };

  return (
    <GamePanel
      title="Communications & DSN"
      subtitle="Deep Space Network Ground Visibility"
      className="border-white/10"
    >
      <div className="space-y-3 font-mono text-xs">
        {/* Pass Window Hero */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-md border ${
                comm.isWindowActive
                  ? 'bg-[#31C48D]/20 border-[#31C48D]/30 text-[#31C48D]'
                  : 'bg-white/5 border-white/10 text-[#A5B1C2]'
              }`}
            >
              <Radio size={14} className={comm.isWindowActive ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">DSN Link Window</div>
              <div
                className={`text-sm font-bold tracking-wider uppercase ${
                  comm.isWindowActive ? 'text-[#31C48D]' : 'text-[#A5B1C2]'
                }`}
              >
                {comm.isWindowActive ? 'ACTIVE DSN PASS' : 'NO DSN PASS'}
              </div>
            </div>
          </div>

          <div
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
              comm.isWindowActive
                ? 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30'
                : 'bg-white/5 text-[#A5B1C2] border-white/10'
            }`}
          >
            {comm.isWindowActive ? 'CONNECTED' : 'STANDBY'}
          </div>
        </div>

        {/* Visible Ground Stations */}
        <div className="space-y-1">
          <div className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">
            Visible Ground Stations:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {comm.activeStationIds.length > 0 ? (
              comm.activeStationIds.map((stationId) => (
                <span
                  key={stationId}
                  className="px-2 py-0.5 rounded bg-[#35C6F4]/15 border border-[#35C6F4]/30 text-[#35C6F4] text-[10px] font-bold"
                >
                  {stationId}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-[#6D7A8D] italic">None in line-of-sight</span>
            )}
          </div>
        </div>

        {/* Queues & Light-Time Metrics */}
        <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/5 text-center text-[10px]">
          <div className="p-1.5 rounded bg-white/5 border border-white/5">
            <div className="text-[#A5B1C2] flex items-center justify-center gap-1 mb-0.5">
              <ArrowUpCircle size={10} className="text-[#35C6F4]" />
              <span>Uplink</span>
            </div>
            <div className="text-xs font-bold text-[#F1F5FA]">{comm.uplinkQueueLength}</div>
          </div>

          <div className="p-1.5 rounded bg-white/5 border border-white/5">
            <div className="text-[#A5B1C2] flex items-center justify-center gap-1 mb-0.5">
              <ArrowDownCircle size={10} className="text-[#31C48D]" />
              <span>Downlink</span>
            </div>
            <div className="text-xs font-bold text-[#F1F5FA]">{comm.downlinkQueueLength}</div>
          </div>

          <div className="p-1.5 rounded bg-white/5 border border-white/5">
            <div className="text-[#A5B1C2] flex items-center justify-center gap-1 mb-0.5">
              <Clock size={10} className="text-[#F5A623]" />
              <span>OWLT</span>
            </div>
            <div className="text-xs font-bold text-[#F5A623]">{owltMin.toFixed(1)}m</div>
          </div>
        </div>

        {/* Downlink Controls */}
        <div className="pt-2 border-t border-white/5 space-y-1.5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleQueueScience}
              className="flex-1 py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-[10px] text-[#F1F5FA] font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send size={11} className="text-[#35C6F4]" />
              <span>Queue Science</span>
            </button>
            <button
              type="button"
              onClick={handleExecuteDownlink}
              className="flex-1 py-1.5 px-2 bg-[#31C48D]/15 hover:bg-[#31C48D]/25 border border-[#31C48D]/30 hover:border-[#31C48D]/50 rounded text-[10px] text-[#31C48D] font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download size={11} className="text-[#31C48D]" />
              <span>DSN Downlink</span>
            </button>
          </div>
          {downlinkStatus && (
            <div className="text-[10px] text-[#A5B1C2] bg-black/40 p-1.5 rounded border border-white/5 leading-tight">
              {downlinkStatus}
            </div>
          )}
        </div>
      </div>
    </GamePanel>
  );
};

