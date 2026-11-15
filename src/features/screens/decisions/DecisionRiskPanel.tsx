/**
 * SECTOR 17 — Decision Risk Assessment Panel
 * Visualizes deterministic aerospace risk ratings, constraint violations,
 * subsystem limitations, and mitigation recommendations.
 */

import React from 'react';
import { ShieldAlert, Shield, CheckCircle2 } from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import type { RiskAssessmentReport, RiskSeverity } from '../../../simulation/missionDecision/types';

interface DecisionRiskPanelProps {
  riskAssessment: RiskAssessmentReport;
  title?: string;
}

export const DecisionRiskPanel: React.FC<DecisionRiskPanelProps> = ({
  riskAssessment,
  title = 'Aerospace Risk Assessment',
}) => {
  const { compositeRiskScore, highestSeverity, hasHardConstraintViolation, risks, isAcceptableForExecution } =
    riskAssessment;

  const getSeverityBadge = (sev: RiskSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return 'text-[#EF6464] bg-[#EF6464]/15 border-[#EF6464]/30';
      case 'HIGH':
        return 'text-[#F5A623] bg-[#F5A623]/15 border-[#F5A623]/30';
      case 'MODERATE':
        return 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20';
      case 'LOW':
        return 'text-[#35C6F4] bg-[#35C6F4]/10 border-[#35C6F4]/20';
      case 'NEGLIGIBLE':
      default:
        return 'text-[#31C48D] bg-[#31C48D]/10 border-[#31C48D]/20';
    }
  };

  return (
    <GamePanel
      title={title}
      subtitle="Deterministic Spacecraft Safety & Engineering Risk Rating"
      className="border-white/10"
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Composite Score & Severity Hero */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield size={16} className={hasHardConstraintViolation ? 'text-[#EF6464]' : 'text-[#35C6F4]'} />
              <span className="font-sans font-bold text-sm text-[#F1F5FA]">Composite Risk Index</span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getSeverityBadge(highestSeverity)}`}>
                {highestSeverity} SEVERITY
              </span>

              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                  isAcceptableForExecution
                    ? 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30'
                    : 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30'
                }`}
              >
                {isAcceptableForExecution ? 'ACCEPTABLE' : 'UNACCEPTABLE'}
              </span>
            </div>
          </div>

          {/* Risk Score Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-[#A5B1C2]">Rating Score</span>
              <span className="font-bold text-[#F1F5FA]">{compositeRiskScore.toFixed(1)} / 100.0</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  compositeRiskScore > 70
                    ? 'bg-[#EF6464]'
                    : compositeRiskScore > 40
                    ? 'bg-[#F5A623]'
                    : 'bg-[#31C48D]'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, compositeRiskScore))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Hard Aerospace Constraint Alert */}
        {hasHardConstraintViolation && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464]">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <div className="space-y-1 font-sans">
              <div className="text-xs font-bold uppercase tracking-wide">
                Hard Aerospace Constraint Violation
              </div>
              <p className="text-[11px] text-[#FCA5A5] leading-relaxed">
                This response option breaches mandatory flight software safety constraints (e.g., active critical hardware faults or restricted safe-mode state). It cannot be overridden by high scientific returns.
              </p>
            </div>
          </div>
        )}

        {/* Individual Risk Items */}
        <div className="space-y-2">
          <div className="text-[11px] text-[#A5B1C2] font-semibold uppercase tracking-wider">
            Risk Factors & Mitigations ({risks.length})
          </div>

          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            {risks.length > 0 ? (
              risks.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-[#F1F5FA] uppercase">{item.category}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${getSeverityBadge(item.severity)}`}>
                        {item.severity}
                      </span>
                      {item.isHardConstraint && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[#EF6464]/20 text-[#EF6464] border border-[#EF6464]/40">
                          HARD CONSTRAINT
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#A5B1C2] font-mono">
                      Weight: {typeof item.deterministicRiskScore === 'number' ? item.deterministicRiskScore.toFixed(0) : 0}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#CBD5E1] font-sans leading-relaxed">
                    {item.explanation}
                  </p>

                  {item.mitigation && (
                    <div className="flex items-start gap-1.5 pt-1 border-t border-white/5 text-[10px] text-[#35C6F4] font-sans">
                      <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-[#31C48D]" />
                      <span><strong>Mitigation:</strong> {item.mitigation}</span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-[#6D7A8D] bg-white/[0.02] rounded-lg border border-white/5">
                No active operational risk factors identified for this option.
              </div>
            )}
          </div>
        </div>
      </div>
    </GamePanel>
  );
};
