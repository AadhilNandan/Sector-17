import React from 'react';
import type { MissionCompletionEvaluation } from '../MissionCompletionEvaluator';
import { sounds } from '../../../utils/soundEffects';

export interface MissionCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDebrief: () => void;
  evaluation: MissionCompletionEvaluation;
  isSubmitting?: boolean;
}

export const MissionCompletionModal: React.FC<MissionCompletionModalProps> = ({
  isOpen,
  onClose,
  onConfirmDebrief,
  evaluation,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-mono select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Mission Completion Evaluation and Finalization"
    >
      <div className="w-full max-w-xl bg-[#080D16] border border-[#F5A623]/50 rounded-lg p-5 shadow-[0_0_50px_rgba(245,166,35,0.2)] flex flex-col gap-4 text-xs">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 className="text-white font-bold text-sm tracking-widest uppercase">
              MISSION DIRECTIVE FINALIZATION // EXPEDITION-V
            </h3>
            <span className="text-[10px] text-[#F5A623]">
              Readiness Audit for Concluding Flight Operations &amp; Mission Debrief
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

        {/* Overview Banner */}
        <div className="flex items-center justify-between p-3.5 rounded bg-black/60 border border-white/10">
          <div>
            <span className="text-[#A5B1C2] text-[10px] block uppercase">Readiness Status</span>
            <span
              className={`text-base font-bold tracking-wider ${
                evaluation.isEligible ? 'text-[#31C48D]' : 'text-[#F5A623]'
              }`}
            >
              {evaluation.status.replace('_', ' ')}
            </span>
          </div>
          <div className="text-right">
            <span className="text-[#A5B1C2] text-[10px] block uppercase">Criteria Fulfilled</span>
            <span className="text-white font-extrabold text-xl">{evaluation.scorePercent}%</span>
          </div>
        </div>

        {/* Criteria Checklist */}
        <div className="space-y-2">
          <span className="text-[#A5B1C2] font-semibold text-[10px] uppercase block">
            Authoritative Completion Criteria
          </span>
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {evaluation.criteria.map((crit) => (
              <div
                key={crit.id}
                className="flex items-start justify-between p-2.5 rounded bg-white/5 border border-white/10 gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold">{crit.label}</span>
                    {crit.isMandatory && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EF6464]/20 text-[#EF6464] border border-[#EF6464]/30 font-semibold">
                        MANDATORY
                      </span>
                    )}
                  </div>
                  <p className="text-[#A5B1C2] text-[10px] mt-0.5 leading-relaxed">
                    {crit.description}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold ${
                    crit.met
                      ? 'bg-[#31C48D]/20 text-[#31C48D] border border-[#31C48D]/40'
                      : 'bg-white/5 text-[#A5B1C2] border border-white/10'
                  }`}
                >
                  {crit.met ? '[✓] SATISFIED' : '[PENDING]'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Notes */}
        <p className="text-[#A5B1C2] text-[11px] leading-relaxed p-2.5 rounded bg-white/5 border border-white/10">
          {evaluation.summary}
        </p>

        {/* Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => {
              sounds.playClick(900);
              onClose();
            }}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 border border-white/15 text-white font-semibold transition-all cursor-pointer"
          >
            CONTINUE FLIGHT OPERATIONS
          </button>
          <button
            type="button"
            disabled={!evaluation.isEligible || isSubmitting}
            onClick={() => {
              sounds.playSuccess();
              onConfirmDebrief();
            }}
            className={`px-5 py-2 rounded font-bold tracking-wider uppercase transition-all cursor-pointer shadow-lg ${
              evaluation.isEligible
                ? 'bg-[#F5A623] hover:bg-[#F5A623]/90 text-black shadow-[0_0_20px_rgba(245,166,35,0.4)]'
                : 'bg-white/10 text-white/40 cursor-not-allowed border border-white/10'
            }`}
          >
            {isSubmitting ? 'FINALIZING...' : 'CONCLUDE MISSION → DEBRIEF'}
          </button>
        </div>
      </div>
    </div>
  );
};
