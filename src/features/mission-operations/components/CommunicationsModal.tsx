import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface CommunicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecoverLink: () => void;
  linkStatus?: string;
  signalDbm?: number;
  downlinkRateKbps?: number;
}

export const CommunicationsModal: React.FC<CommunicationsModalProps> = ({
  isOpen,
  onClose,
  onRecoverLink,
  linkStatus = 'CONNECTED',
  signalDbm = -114.2,
  downlinkRateKbps = 128,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 font-mono select-none overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Communications Subsystem Control Console"
    >
      <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] bg-[#080D16] border border-[#35C6F4]/40 rounded-lg shadow-[0_0_40px_rgba(53,198,244,0.15)] flex flex-col text-xs overflow-hidden">
        {/* Header - Anchored */}
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 p-4 bg-[#080D16]">
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase">
              DEEP SPACE NETWORK // RF COMMUNICATIONS
            </h3>
            <span className="text-[10px] text-[#A5B1C2]">
              Dorsal High-Gain Antenna (HGA) &amp; Ground Gateway Terminal
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              sounds.playClick(900);
              onClose();
            }}
            className="text-[#A5B1C2] hover:text-white px-2 py-1 rounded bg-white/5 border border-white/10 cursor-pointer"
          >
            ✕ [CLOSE]
          </button>
        </div>

        {/* Scrollable Body - Independently bounded */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded bg-black/50 border border-white/10">
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">DSN Gateway</span>
              <span className="text-white font-semibold">CANBERRA DSN-43 (70M)</span>
            </div>
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">Link State</span>
              <span className="text-[#31C48D] font-bold">{linkStatus}</span>
            </div>
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">Carrier Band</span>
              <span className="text-white font-semibold">X-BAND (8.4 GHz)</span>
            </div>
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">Received Signal Strength</span>
              <span className="text-[#35C6F4] font-bold">{signalDbm.toFixed(1)} dBm</span>
            </div>
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">Downlink Rate</span>
              <span className="text-white font-semibold">{downlinkRateKbps} kbps</span>
            </div>
            <div>
              <span className="text-[#A5B1C2] text-[10px] block uppercase">Round-Trip Light Time (RTLT)</span>
              <span className="text-[#F5A623] font-semibold">43m 22s</span>
            </div>
          </div>

          {/* Antenna Pointing Summary */}
          <div className="space-y-1.5 p-3 rounded bg-white/5 border border-white/10 text-[11px]">
            <div className="flex justify-between text-[#A5B1C2]">
              <span>ANTENNA GIMBAL ATTITUDE:</span>
              <span className="text-[#31C48D] font-bold">AZ: 142.4° // EL: +38.1° [TRACKING]</span>
            </div>
            <div className="flex justify-between text-[#A5B1C2]">
              <span>EARTH BORESIGHT OFFSET:</span>
              <span className="text-white font-semibold">0.04° (Within 0.1° Beamwidth)</span>
            </div>
            <div className="flex justify-between text-[#A5B1C2]">
              <span>COMMAND QUEUE STATUS:</span>
              <span className="text-white font-semibold">0 PENDING // 142 EXECUTED</span>
            </div>
          </div>
        </div>

        {/* Actions - Anchored Footer */}
        <div className="shrink-0 flex justify-between items-center p-4 border-t border-white/10 bg-[#060A10]">
          <button
            type="button"
            onClick={() => {
              sounds.playClick(1200);
              onRecoverLink();
            }}
            className="px-4 py-2 rounded bg-[#35C6F4]/20 hover:bg-[#35C6F4]/30 border border-[#35C6F4]/40 text-[#35C6F4] font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
          >
            REALIGN HGA &amp; VERIFY CARRIER
          </button>
          <button
            type="button"
            onClick={() => {
              sounds.playClick(900);
              onClose();
            }}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold transition-all cursor-pointer"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
