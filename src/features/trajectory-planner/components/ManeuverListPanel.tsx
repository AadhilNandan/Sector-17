import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Flame, ArrowRight, Check } from 'lucide-react';
import type { ManeuverPlan, ManeuverValidationReport } from '../../../simulation/navigation/types';

export type ScenarioComparisonMode = 'current' | 'optimized' | 'high_thrust';

export interface ManeuverListPanelProps {
  maneuvers: readonly ManeuverPlan[];
  selectedManeuverId: string;
  onSelectManeuver: (id: string) => void;
  validationReport?: ManeuverValidationReport;
  onValidateManeuver: (id: string) => void;
  onExecuteManeuver: (id: string) => Promise<void>;
  isExecuting?: boolean;
  onCertifyOrProceed?: () => void;
  isReadinessCertified?: boolean;
  propellantRemainingKg?: number;
  propellantCapacityKg?: number;
  isParkingOrbitBypassActive?: boolean;
  onAuthorizeBypass?: () => void;
}

export const ManeuverListPanel: React.FC<ManeuverListPanelProps> = ({
  maneuvers,
  selectedManeuverId,
  onSelectManeuver,
  validationReport,
  onValidateManeuver,
  onExecuteManeuver,
  isExecuting = false,
  onCertifyOrProceed,
  isReadinessCertified = false,
  propellantRemainingKg = 2425,
  propellantCapacityKg = 2450,
  isParkingOrbitBypassActive = false,
  onAuthorizeBypass,
}) => {
  // Maneuver adjustment offsets
  const [progradeDelta, setProgradeDelta] = useState(0);
  const [normalDelta, setNormalDelta] = useState(0);
  const [scenarioMode, setScenarioMode] = useState<ScenarioComparisonMode>('current');

  const selectedManeuver = maneuvers.find((m) => m.id === selectedManeuverId) || maneuvers[0];

  // Adjusted delta-v with prograde/normal fine-tuning
  const adjustedDeltaV = selectedManeuver
    ? Math.max(10, selectedManeuver.deltaVMps + progradeDelta * 2.5 + Math.abs(normalDelta) * 1.5)
    : 320;

  return (
    <aside className="w-full md:w-[360px] lg:w-[400px] h-full bg-[#080B10]/95 border-l border-[#1F2733] flex flex-col font-sans text-[#E6E2D6] z-20 overflow-y-auto select-none shrink-0">
      {/* 1. Header: MANOEUVRE LIST */}
      <div className="px-5 py-4 border-b border-[#1F2733] flex items-center justify-between">
        <h2 className="font-display text-sm font-bold tracking-[0.16em] uppercase text-[#E6E2D6]">
          MANOEUVRE LIST
        </h2>
        <span className="font-mono text-[10px] text-[#7FB7D4] tracking-wider">
          EXP-V ASTRODYNAMICS
        </span>
      </div>

      {/* 2. Maneuver Sequence Items */}
      <div className="p-4 space-y-2.5">
        {maneuvers.length === 0 ? (
          <div className="p-3 text-center font-mono text-xs text-[#6B757D]">
            No maneuvers currently available.
          </div>
        ) : (
          maneuvers.map((m, index) => {
            const isSelected = m.id === selectedManeuverId;
            const itemNum = String(index + 1).padStart(2, '0');

            // Status label formatting
            let statusBadge = (
              <span className="text-[#7FB7D4] font-mono text-[10px]">[ PLANNED ]</span>
            );
            if (m.isExecuted) {
              statusBadge = (
                <span className="text-[#31C48D] font-mono text-[10px] flex items-center gap-1">
                  [ <Check size={11} /> COMPLETED ]
                </span>
              );
            } else if (isSelected) {
              statusBadge = (
                <span className="text-[#7FB7D4] font-mono text-[10px] font-bold">
                  [ ▶ ACTIVE ]
                </span>
              );
            } else if (m.type === 'LANDER_POWERED_DESCENT') {
              statusBadge = isParkingOrbitBypassActive ? (
                <span className="text-[#F5A623] font-mono text-[10px]">[ BYPASS STAGED ]</span>
              ) : (
                <span className="text-[#7FB7D4] font-mono text-[10px]">[ PLANNED ]</span>
              );
            }

            const isEoiBurn = m.id === 'mnv-flyby-01' || m.id === 'item-maneuver-eoi' || m.title.includes('EOI');

            return (
              <div
                key={m.id}
                data-tutorial-id={isEoiBurn ? 'item-maneuver-eoi' : undefined}
                onClick={() => onSelectManeuver(m.id)}
                className={`relative p-3 rounded-xs border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#111720] border-[#7FB7D4] shadow-[0_0_12px_rgba(127,183,212,0.15)]'
                    : 'bg-[#0D1116] border-[#1F2733] hover:border-[#2B3642]'
                }`}
              >
                {/* Tech selection brackets for active item */}
                {isSelected && (
                  <>
                    <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-[#7FB7D4]" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-[#7FB7D4]" />
                    <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-[#7FB7D4]" />
                    <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-[#7FB7D4]" />
                  </>
                )}

                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#E6E2D6] uppercase tracking-wide">
                    {itemNum}. {m.title.length > 20 ? m.title.substring(0, 18) + '...' : m.title}
                  </span>
                  <span className="text-[#A9B0B5] font-bold">
                    Δv: {m.deltaVMps.toFixed(0)} m/s
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1 text-[11px]">
                  {statusBadge}
                  <span className="text-[10px] text-[#6B757D] font-mono">
                    TARGET: {m.targetBody}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. [ ADJUST MANOEUVRE ] Controls */}
      <div className="px-4 py-3 mx-4 my-1 rounded-xs bg-[#0D1116] border border-[#1F2733] space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px] font-bold text-[#E6E2D6] tracking-wider uppercase">
          <span>[ ADJUST MANOEUVRE ]</span>
          <span className="text-[#7FB7D4]">
            {selectedManeuver ? selectedManeuver.title : 'NO MANEUVER'}
          </span>
        </div>
        <div className="text-[9px] text-[#6B757D] font-mono -mt-1.5">
          PLANNING ESTIMATE // ASTRODYNAMIC TRIMS
        </div>

        {/* Prograde / Retrograde Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#8D96A0]">
            <span>RETROGRADE</span>
            <span className="font-bold text-[#E6E2D6]">
              {progradeDelta >= 0 ? `+${progradeDelta}` : progradeDelta} m/s
            </span>
            <span>PROGRADE</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={progradeDelta}
            onChange={(e) => setProgradeDelta(Number(e.target.value))}
            className="w-full accent-[#7FB7D4] cursor-pointer"
          />
        </div>

        {/* Normal / Antinormal Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-[#8D96A0]">
            <span>ANTINORMAL</span>
            <span className="font-bold text-[#E6E2D6]">
              {normalDelta >= 0 ? `+${normalDelta}` : normalDelta} m/s
            </span>
            <span>NORMAL</span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={normalDelta}
            onChange={(e) => setNormalDelta(Number(e.target.value))}
            className="w-full accent-[#7FB7D4] cursor-pointer"
          />
        </div>

        <div className="pt-2 border-t border-[#1F2733] flex justify-between text-[11px]">
          <span className="text-[#8D96A0]">Computed Total Δv:</span>
          <span className="text-[#31C48D] font-bold">{adjustedDeltaV.toFixed(1)} m/s</span>
        </div>

        {/* Europa Staging / Controlled Gameplay Bypass Banner */}
        {selectedManeuver?.type === 'LANDER_POWERED_DESCENT' && (
          <div className="mt-2 p-2 rounded-xs bg-[#151D28] border border-[#F5A623]/40 text-[10px] font-mono text-[#F5A623] space-y-1.5">
            <div className="flex items-center justify-between font-bold">
              <span>EUROPA STAGING ARCHITECTURE</span>
              <span className={isParkingOrbitBypassActive ? 'text-[#31C48D]' : 'text-[#F5A623]'}>
                {isParkingOrbitBypassActive ? '[ BYPASS ACTIVE ]' : '[ BYPASS READY ]'}
              </span>
            </div>
            <p className="text-[#A9B0B5] text-[9px] leading-relaxed">
              [GAMEPLAY ABSTRACTION]: 100 km circular parking orbit staging is authorized under campaign flight rules without physical orbital capture insertion.
            </p>
            {!isParkingOrbitBypassActive && onAuthorizeBypass && (
              <button
                type="button"
                onClick={onAuthorizeBypass}
                className="w-full py-1 px-2 rounded-xs bg-[#F5A623]/20 hover:bg-[#F5A623]/30 border border-[#F5A623] text-[#F5A623] font-bold text-[9px] uppercase tracking-wider cursor-pointer transition-colors"
              >
                AUTHORIZE MISSION-FLOW BYPASS
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. SCENARIO COMPARISON */}
      <div className="px-4 py-3 mx-4 my-2 rounded-xs bg-[#0D1116] border border-[#1F2733] space-y-2 font-mono text-xs">
        <div className="text-[10px] font-bold text-[#6B757D] uppercase tracking-[0.16em]">
          SCENARIO COMPARISON
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setScenarioMode('current')}
            className={`py-1 px-1.5 rounded-xs text-[10px] uppercase font-bold transition-colors cursor-pointer text-center ${
              scenarioMode === 'current'
                ? 'bg-[#1C2530] text-[#7FB7D4] border border-[#7FB7D4]/60'
                : 'bg-[#11161D] text-[#6B757D] hover:text-[#A9B0B5] border border-[#1F2733]'
            }`}
          >
            [ CURRENT PLAN ]
          </button>
          <button
            type="button"
            onClick={() => setScenarioMode('optimized')}
            className={`py-1 px-1.5 rounded-xs text-[10px] uppercase font-bold transition-colors cursor-pointer text-center ${
              scenarioMode === 'optimized'
                ? 'bg-[#1C2530] text-[#7FB7D4] border border-[#7FB7D4]/60'
                : 'bg-[#11161D] text-[#6B757D] hover:text-[#A9B0B5] border border-[#1F2733]'
            }`}
          >
            [ OPTIMIZED Δv ]
          </button>
          <button
            type="button"
            onClick={() => setScenarioMode('high_thrust')}
            className={`py-1 px-1.5 rounded-xs text-[10px] uppercase font-bold transition-colors cursor-pointer text-center ${
              scenarioMode === 'high_thrust'
                ? 'bg-[#1C2530] text-[#7FB7D4] border border-[#7FB7D4]/60'
                : 'bg-[#11161D] text-[#6B757D] hover:text-[#A9B0B5] border border-[#1F2733]'
            }`}
          >
            [ HIGH THRUST ]
          </button>
        </div>
      </div>

      {/* 5. Usable Propellant Summary */}
      <div className="px-5 py-2 font-mono text-xs space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8D96A0] flex items-center gap-1">
            <Flame size={12} className="text-[#31C48D]" /> AETHON Propellant:
          </span>
          <span className="text-[#31C48D] font-bold">
            {propellantRemainingKg.toFixed(1)} / {propellantCapacityKg} kg
          </span>
        </div>
        <div className="w-full h-1 bg-[#1F2733] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#31C48D]"
            style={{
              width: `${Math.min(100, Math.max(0, (propellantRemainingKg / propellantCapacityKg) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* 6. Validation Report Notification */}
      {validationReport && (
        <div
          className={`mx-4 my-2 p-2.5 rounded-xs border font-mono text-[11px] space-y-1 ${
            validationReport.status === 'PASS'
              ? 'bg-[#31C48D]/15 border-[#31C48D]/40 text-[#31C48D]'
              : validationReport.status === 'WARNING'
              ? 'bg-[#F5A623]/15 border-[#F5A623]/40 text-[#F5A623]'
              : 'bg-[#FF5555]/15 border-[#FF5555]/40 text-[#FF5555]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold">
            {validationReport.status === 'PASS' ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
            <span>
              VALIDATION: {validationReport.status}
              {validationReport.status === 'WARNING' && ' (GAMEPLAY ABSTRACTION)'}
            </span>
          </div>
          <div className="text-[10px] opacity-90">
            {validationReport.reasons.map((r, i) => (
              <div key={i}>• {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Action Buttons at Bottom */}
      <div className="p-4 mt-auto border-t border-[#1F2733] space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-tutorial-id="btn-validate-trajectory"
            onClick={() => selectedManeuver && onValidateManeuver(selectedManeuver.id)}
            disabled={!selectedManeuver || selectedManeuver.isExecuted}
            className="py-2 px-3 rounded-xs bg-[#11161D] hover:bg-[#1C2530] border border-[#2B3642] hover:border-[#7FB7D4] text-[#E6E2D6] font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            [ VALIDATE ]
          </button>

          <button
            type="button"
            onClick={() => selectedManeuver && onExecuteManeuver(selectedManeuver.id)}
            disabled={
              !selectedManeuver ||
              selectedManeuver.isExecuted ||
              isExecuting ||
              (validationReport && !validationReport.isFeasible)
            }
            className="py-2 px-3 rounded-xs bg-[#7FB7D4]/20 hover:bg-[#7FB7D4]/30 border border-[#7FB7D4] text-[#7FB7D4] hover:text-[#FFFFFF] font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isExecuting ? 'BURNING...' : '[ EXECUTE BURN ]'}
          </button>
        </div>

        {onCertifyOrProceed && (
          <button
            type="button"
            data-tutorial-id="btn-certify-authorize"
            onClick={onCertifyOrProceed}
            className="w-full py-2.5 px-4 rounded-xs bg-[#E6E2D6] hover:bg-[#FFFFFF] text-[#0A0D12] font-mono text-xs font-bold uppercase tracking-[0.16em] flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-lg"
          >
            <span>{isReadinessCertified ? 'PROCEED TO OPERATIONS' : 'CERTIFY FLIGHT READINESS'}</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </aside>
  );
};
