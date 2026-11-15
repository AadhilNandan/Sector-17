/**
 * SECTOR 17 — Decision Option Card
 * Renders an authoritative candidate response option or active decision record,
 * detailing feasibility status, risk score, resource requirements, and evidence counts.
 */

import React from 'react';
import {
  AlertTriangle,
  Zap,
  Fuel,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from 'lucide-react';
import type {
  DecisionOption,
  DecisionCategory,
  DecisionValidationStatus,
  DecisionAuthorizationStatus,
} from '../../../simulation/missionDecision/types';

interface DecisionOptionCardProps {
  option: DecisionOption;
  status?: DecisionAuthorizationStatus;
  isSelected?: boolean;
  onSelect?: () => void;
  onQuickAction?: () => void;
  quickActionLabel?: string;
}

export const DecisionOptionCard: React.FC<DecisionOptionCardProps> = ({
  option,
  status,
  isSelected = false,
  onSelect,
  onQuickAction,
  quickActionLabel,
}) => {
  const validation = option.validationResult;
  const valStatus: DecisionValidationStatus = validation?.status ?? 'FEASIBLE';
  const risk = option.riskAssessment;

  const getCategoryBadge = (category: DecisionCategory) => {
    switch (category) {
      case 'CONTINUE_INVESTIGATION':
        return { label: 'Science Survey', color: 'text-[#35C6F4] bg-[#35C6F4]/10 border-[#35C6F4]/30' };
      case 'PRIORITIZE_ANOMALY':
        return { label: 'Anomaly Focus', color: 'text-[#A78BFA] bg-[#A78BFA]/10 border-[#A78BFA]/30' };
      case 'PRESERVE_SPACECRAFT':
        return { label: 'Safety & Power', color: 'text-[#F5A623] bg-[#F5A623]/10 border-[#F5A623]/30' };
      case 'TRANSMIT_FINDINGS':
        return { label: 'DSN Telemetry', color: 'text-[#60A5FA] bg-[#60A5FA]/10 border-[#60A5FA]/30' };
      case 'DEPLOY_LANDER':
        return { label: 'Surface Lander', color: 'text-[#31C48D] bg-[#31C48D]/10 border-[#31C48D]/30' };
      case 'ABORT_OR_SUSPEND':
      default:
        return { label: 'Safe Mode / Abort', color: 'text-[#EF6464] bg-[#EF6464]/10 border-[#EF6464]/30' };
    }
  };

  const getFeasibilityBadge = (feas: DecisionValidationStatus) => {
    switch (feas) {
      case 'FEASIBLE':
        return {
          label: 'FEASIBLE',
          pill: 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30',
          icon: <ShieldCheck size={11} />,
        };
      case 'INFEASIBLE':
        return {
          label: 'INFEASIBLE',
          pill: 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30',
          icon: <ShieldAlert size={11} />,
        };
      case 'INCOMPLETE':
        return {
          label: 'INCOMPLETE',
          pill: 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30',
          icon: <AlertTriangle size={11} />,
        };
      case 'EXPIRED':
      default:
        return {
          label: 'EXPIRED',
          pill: 'bg-white/10 text-[#A5B1C2] border-white/20',
          icon: <Clock size={11} />,
        };
    }
  };

  const getStatusBadge = (stat: DecisionAuthorizationStatus) => {
    switch (stat) {
      case 'PROPOSED':
        return 'bg-[#F5A623]/20 text-[#F5A623] border-[#F5A623]/40';
      case 'APPROVED':
        return 'bg-[#31C48D]/20 text-[#31C48D] border-[#31C48D]/40';
      case 'EXECUTED':
        return 'bg-white/10 text-white border-white/20';
      case 'REJECTED':
      case 'FAILED':
        return 'bg-[#EF6464]/20 text-[#EF6464] border-[#EF6464]/40';
      default:
        return 'bg-white/5 text-[#A5B1C2] border-white/10';
    }
  };

  const cat = getCategoryBadge(option.category);
  const feas = getFeasibilityBadge(valStatus);

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer font-mono text-xs ${
        isSelected
          ? 'bg-[#0E1726] border-[#35C6F4] shadow-[0_0_15px_rgba(53,198,244,0.15)] ring-1 ring-[#35C6F4]/50'
          : 'bg-[#080D16]/90 hover:bg-[#0E1726]/80 border-white/10 hover:border-white/20'
      }`}
    >
      {/* Header Row: Category, Feasibility, Status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${cat.color}`}>
            {cat.label}
          </span>

          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${feas.pill}`}>
            {feas.icon}
            <span>{feas.label}</span>
          </span>
        </div>

        {status && (
          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getStatusBadge(status)}`}>
            {status}
          </span>
        )}
      </div>

      {/* Option Title */}
      <h4 className="font-sans text-sm font-bold text-[#F1F5FA] mb-1 leading-snug">
        {option.title}
      </h4>

      {/* Option Description */}
      <p className="text-[11px] text-[#A5B1C2] leading-relaxed mb-3 line-clamp-2">
        {option.description}
      </p>

      {/* Resource & Risk Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-white/5 text-[10px] text-[#A5B1C2]">
        {/* Estimated Power */}
        <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded">
          <Zap size={11} className="text-[#35C6F4]" />
          <span>
            {option.resourceRequirements.estimatedPowerWatts !== undefined
              ? `${option.resourceRequirements.estimatedPowerWatts.toFixed(0)} W`
              : '0 W'}
          </span>
        </div>

        {/* Estimated Propellant */}
        <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded">
          <Fuel size={11} className="text-[#F5A623]" />
          <span>
            {option.resourceRequirements.estimatedPropellantKg !== undefined
              ? `${option.resourceRequirements.estimatedPropellantKg.toFixed(1)} kg`
              : '0.0 kg'}
          </span>
        </div>

        {/* Estimated Duration */}
        <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded">
          <Clock size={11} className="text-[#31C48D]" />
          <span>
            {option.resourceRequirements.estimatedDurationSeconds !== undefined
              ? `${(option.resourceRequirements.estimatedDurationSeconds / 60).toFixed(0)}m`
              : 'Instant'}
          </span>
        </div>

        {/* Risk Score */}
        <div className="flex items-center gap-1 bg-white/[0.02] p-1 rounded justify-end">
          <span className="text-[#A5B1C2]">Risk:</span>
          <span
            className={`font-bold ${
              risk.highestSeverity === 'CRITICAL'
                ? 'text-[#EF6464]'
                : risk.highestSeverity === 'HIGH'
                ? 'text-[#F5A623]'
                : 'text-[#31C48D]'
            }`}
          >
            {risk.compositeRiskScore.toFixed(0)} ({risk.highestSeverity})
          </span>
        </div>
      </div>

      {/* Action / Detail Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
        <div className="text-[10px] text-[#A5B1C2]">
          {option.evidenceReferences.length > 0
            ? `${option.evidenceReferences.length} Evidence source(s)`
            : 'No direct evidence requirements'}
        </div>

        {quickActionLabel && onQuickAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickAction();
            }}
            disabled={valStatus === 'INFEASIBLE' || valStatus === 'EXPIRED'}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#35C6F4]/15 hover:bg-[#35C6F4]/25 border border-[#35C6F4]/30 text-[#35C6F4] text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span>{quickActionLabel}</span>
            <ArrowRight size={10} />
          </button>
        )}
      </div>
    </div>
  );
};
