import React from 'react';
import { sounds } from '../../../utils/soundEffects';

export interface ScienceProcessingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessScience: () => void;
  collectedGb?: number;
  processedGb?: number;
  totalCapacityGb?: number;
  instrumentsStatus?: Record<string, { status: string; powerW: number }>;
}

export const ScienceProcessingModal: React.FC<ScienceProcessingModalProps> = ({
  isOpen,
  onClose,
  onProcessScience,
  collectedGb = 4.2,
  processedGb = 1.8,
  totalCapacityGb = 64,
  instrumentsStatus = {
    'IPR-3 Ice-Penetrating Radar': { status: 'STANDBY', powerW: 42 },
    'MASPEX Plume Spectrometer': { status: 'SAMPLING', powerW: 36 },
    'REASON Deep Radar Sounder': { status: 'OPERATIONAL', powerW: 55 },
    'PIMS Magnetospheric Sensor': { status: 'ONLINE', powerW: 18 },
  },
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-mono select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Science Data Processing Console"
    >
      <div className="w-full max-w-xl bg-[#080D16] border border-[#35C6F4]/40 rounded-lg p-5 shadow-[0_0_40px_rgba(53,198,244,0.15)] flex flex-col gap-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase">
              SCIENCE PAYLOAD // ONBOARD SSDR PROCESSING
            </h3>
            <span className="text-[10px] text-[#A5B1C2]">
              Europa Plume Sampling, Radar Sounding &amp; Subsurface Analysis
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

        {/* Storage Capacity Gauge */}
        <div className="p-3 rounded bg-black/50 border border-white/10 space-y-2">
          <div className="flex justify-between text-[#A5B1C2]">
            <span className="font-semibold uppercase text-[10px]">Solid-State Data Recorder (SSDR)</span>
            <span className="text-white font-bold">
              {collectedGb.toFixed(1)} GB / {totalCapacityGb} GB
            </span>
          </div>
          <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/15 flex">
            <div
              className="h-full bg-[#31C48D]"
              style={{ width: `${(processedGb / totalCapacityGb) * 100}%` }}
              title={`Processed: ${processedGb.toFixed(1)} GB`}
            />
            <div
              className="h-full bg-[#35C6F4]"
              style={{ width: `${((collectedGb - processedGb) / totalCapacityGb) * 100}%` }}
              title={`Raw Queued: ${(collectedGb - processedGb).toFixed(1)} GB`}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#A5B1C2]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#31C48D]" />
              Processed: {processedGb.toFixed(1)} GB
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#35C6F4]" />
              Raw Queued: {(collectedGb - processedGb).toFixed(1)} GB
            </span>
          </div>
        </div>

        {/* Instruments List */}
        <div className="space-y-1.5">
          <span className="text-[#A5B1C2] font-semibold text-[10px] uppercase block">
            Payload Instrument Status
          </span>
          <div className="space-y-1">
            {Object.entries(instrumentsStatus).map(([name, data]) => (
              <div
                key={name}
                className="flex items-center justify-between p-2 rounded bg-white/5 border border-white/10"
              >
                <span className="text-white font-semibold">{name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-[#A5B1C2] text-[10px]">{data.powerW} W</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#31C48D]/15 text-[#31C48D] border border-[#31C48D]/30">
                    {data.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <button
            type="button"
            data-tutorial-id="btn-process-observation-batch"
            onClick={() => {
              sounds.playClick(1300);
              onProcessScience();
            }}
            className="px-4 py-2 rounded bg-[#31C48D]/20 hover:bg-[#31C48D]/30 border border-[#31C48D]/40 text-[#31C48D] font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
          >
            PROCESS OBSERVATION BATCH
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
