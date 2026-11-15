/**
 * SECTOR 17 — Decision Authorization Panel
 * Commander's authorization gating station.
 * Enforces pre-flight validation, confirmation dialogues, and prevents unauthorized execution.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Play,
  Zap,
  Fuel,
  Database,
  Radio,
} from 'lucide-react';
import { GamePanel } from '../../../components/ui/GamePanel';
import { GameButton } from '../../../components/ui/GameButton';
import { sounds } from '../../../utils/soundEffects';
import type {
  DecisionOption,
  DecisionRecord,
  DecisionValidationStatus,
} from '../../../simulation/missionDecision/types';

interface DecisionAuthorizationPanelProps {
  decision: DecisionOption | DecisionRecord;
  onAuthorize: (approved: boolean, reason?: string) => void;
  onExecute: () => void;
  onPropose?: () => void;
  isExecuting?: boolean;
}

export const DecisionAuthorizationPanel: React.FC<DecisionAuthorizationPanelProps> = ({
  decision,
  onAuthorize,
  onExecute,
  onPropose,
  isExecuting = false,
}) => {
  const isRecord = 'status' in decision;
  const status = isRecord ? (decision as DecisionRecord).status : 'CANDIDATE';
  const option: DecisionOption = isRecord ? (decision as DecisionRecord).option : (decision as DecisionOption);

  const valStatus: DecisionValidationStatus = option.validationResult?.status ?? 'FEASIBLE';
  const isFeasible = valStatus === 'FEASIBLE';
  const isExpired = valStatus === 'EXPIRED' || status === 'EXPIRED';

  const [authReason, setAuthReason] = useState('Authorized by Flight Director');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleApproveClick = () => {
    sounds.playClick(1200);
    setShowConfirm(true);
  };

  const handleConfirmApproval = () => {
    sounds.playClick(1400);
    setShowConfirm(false);
    onAuthorize(true, authReason);
  };

  const handleRejectClick = () => {
    sounds.playClick(800);
    const reason =
      authReason && authReason.trim().length > 0 && authReason !== 'Authorized by Flight Director'
        ? authReason.trim()
        : 'Rejected by Flight Director based on risk assessment';
    onAuthorize(false, reason);
  };

  const handleExecuteClick = () => {
    sounds.playClick(1500);
    onExecute();
  };

  return (
    <GamePanel
      title="Commander Authorization Station"
      subtitle="Operational Safety Gating & Flight Computer Dispatch"
      className="border-white/10"
    >
      <div className="space-y-4 font-mono text-xs">
        {/* Status Hero */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[#A5B1C2] text-[10px] uppercase tracking-wider">Lifecycle Status</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                status === 'APPROVED'
                  ? 'bg-[#31C48D]/20 text-[#31C48D] border-[#31C48D]/40'
                  : status === 'PROPOSED'
                  ? 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/40'
                  : status === 'EXECUTED'
                  ? 'bg-white/10 text-white border-white/20'
                  : status === 'REJECTED' || status === 'FAILED'
                  ? 'bg-[#EF6464]/20 text-[#EF6464] border-[#EF6464]/40'
                  : 'bg-[#35C6F4]/15 text-[#35C6F4] border-[#35C6F4]/30'
              }`}
            >
              {status}
            </span>
          </div>

          <div className="text-sm font-bold text-[#F1F5FA] font-sans">
            {option.title}
          </div>
        </div>

        {/* Validation Reasons & Infeasibility Callout */}
        {!isFeasible && (
          <div className="p-3 rounded-xl bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464] space-y-1.5 font-sans">
            <div className="flex items-center gap-1.5 font-bold text-xs uppercase">
              <ShieldAlert size={14} className="shrink-0" />
              <span>Validation Gate: {valStatus}</span>
            </div>
            <ul className="text-[11px] list-disc list-inside space-y-1 text-[#FCA5A5]">
              {option.validationResult?.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
              {option.validationResult?.constraintViolations.map((c, i) => (
                <li key={`cv-${i}`}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Projected Resource Consequences */}
        <div className="space-y-2">
          <div className="text-[11px] text-[#A5B1C2] uppercase tracking-wider font-semibold">
            Projected Resource Expenditure
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-[#A5B1C2] flex items-center gap-1">
                <Zap size={11} className="text-[#35C6F4]" /> Power Load
              </span>
              <span className="text-[#F1F5FA] font-bold">
                {option.resourceRequirements.estimatedPowerWatts !== undefined
                  ? `${option.resourceRequirements.estimatedPowerWatts.toFixed(0)} W`
                  : '0 W'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-[#A5B1C2] flex items-center gap-1">
                <Fuel size={11} className="text-[#F5A623]" /> Propellant Burn
              </span>
              <span className="text-[#F1F5FA] font-bold">
                {option.resourceRequirements.estimatedPropellantKg !== undefined
                  ? `${option.resourceRequirements.estimatedPropellantKg.toFixed(1)} kg`
                  : '0.0 kg'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-[#A5B1C2] flex items-center gap-1">
                <Database size={11} className="text-[#31C48D]" /> Storage Buffer
              </span>
              <span className="text-[#F1F5FA] font-bold">
                {option.resourceRequirements.estimatedStorageBytes !== undefined
                  ? `${(option.resourceRequirements.estimatedStorageBytes / 1024).toFixed(0)} KB`
                  : '0 KB'}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-[#A5B1C2] flex items-center gap-1">
                <Radio size={11} className="text-[#60A5FA]" /> DSN Window
              </span>
              <span className="text-[#F1F5FA] font-bold">
                {option.resourceRequirements.requiresActiveCommWindow ? 'MANDATORY' : 'Not Required'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Workflow by Status */}
        {status === 'CANDIDATE' && onPropose && (
          <div className="pt-2">
            <GameButton
              variant="cyan"
              size="md"
              fullWidth
              onClick={onPropose}
              disabled={!isFeasible || isExpired}
              className="h-10 text-xs font-bold tracking-wider"
            >
              PROPOSE DECISION FOR AUTHORIZATION
            </GameButton>
          </div>
        )}

        {status === 'PROPOSED' && !showConfirm && (
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-[#A5B1C2] uppercase tracking-wider">
                Commander Directive / Authorization Reason:
              </label>
              <input
                type="text"
                value={authReason}
                onChange={(e) => setAuthReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-[#F1F5FA] focus:outline-none focus:border-[#35C6F4]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <GameButton
                variant="amber"
                size="md"
                onClick={handleApproveClick}
                disabled={!isFeasible || isExpired}
                icon={<CheckCircle2 size={13} />}
                className="h-10 text-xs font-bold tracking-wider"
              >
                AUTHORIZE (APPROVE)
              </GameButton>

              <GameButton
                variant="danger"
                size="md"
                onClick={handleRejectClick}
                disabled={isExpired}
                icon={<XCircle size={13} />}
                className="h-10 text-xs font-bold tracking-wider"
              >
                REJECT DECISION
              </GameButton>
            </div>
          </div>
        )}

        {/* Explicit Confirmation Dialog before Approval */}
        {showConfirm && (
          <div className="p-3.5 rounded-xl bg-[#F5A623]/15 border border-[#F5A623]/30 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F5A623] uppercase">
              <AlertTriangle size={15} />
              <span>Confirm Commander Authorization</span>
            </div>
            <p className="text-[11px] text-[#F1F5FA] font-sans leading-relaxed">
              Are you sure you want to authorize <strong>{option.title}</strong>? Once approved, the directive is entered into the flight computer telecommand queue.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <GameButton
                variant="amber"
                size="sm"
                onClick={handleConfirmApproval}
                className="flex-1 font-bold text-xs"
              >
                CONFIRM APPROVAL
              </GameButton>
              <GameButton
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirm(false)}
                className="flex-1 text-xs"
              >
                CANCEL
              </GameButton>
            </div>
          </div>
        )}

        {status === 'APPROVED' && (
          <div className="space-y-3 pt-2">
            <div className="p-2.5 rounded-lg bg-[#31C48D]/15 border border-[#31C48D]/30 text-[#31C48D] text-xs flex items-center gap-2">
              <ShieldCheck size={16} className="shrink-0" />
              <span>Decision authorized. Pre-flight gates satisfied. Ready for immediate execution.</span>
            </div>

            <GameButton
              variant="cyan"
              size="md"
              fullWidth
              onClick={handleExecuteClick}
              disabled={isExecuting}
              icon={<Play size={14} fill="currentColor" />}
              className="h-11 text-xs font-bold tracking-widest shadow-lg"
            >
              {isExecuting ? 'DISPATCHING TO FLIGHT COMPUTER...' : 'EXECUTE AUTHORIZED DECISION'}
            </GameButton>
          </div>
        )}

        {status === 'EXECUTED' && (
          <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-[#31C48D] text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>Execution completed successfully. Subsystem and telemetry consequences applied.</span>
          </div>
        )}

        {(status === 'REJECTED' || status === 'FAILED') && (
          <div className="p-3 rounded-lg bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464] text-xs flex items-center gap-2">
            <XCircle size={16} className="shrink-0" />
            <span>
              Decision {status.toLowerCase()}.{' '}
              {isRecord && (decision as DecisionRecord).failureReason
                ? (decision as DecisionRecord).failureReason
                : 'Execution inhibited by safety gates.'}
            </span>
          </div>
        )}
      </div>
    </GamePanel>
  );
};
