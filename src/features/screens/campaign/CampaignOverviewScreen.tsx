/**
 * SECTOR 17 — Campaign Overview Screen
 * Mission orchestration dashboard showing the 18 expedition stages,
 * active blockers, telemetry state, flight log, and campaign persistence.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  useSimulationSnapshot,
  useSimulationRuntime,
  useCampaign,
} from '../../../runtime/SimulationContext';
import { CampaignProgressPanel } from './CampaignProgressPanel';
import { CampaignObjectivesPanel } from './CampaignObjectivesPanel';
import { CampaignHistoryPanel } from './CampaignHistoryPanel';
import { CampaignContinueButton } from './CampaignContinueButton';
import { CAMPAIGN_STAGE_CONFIGS } from '../../../campaign/campaignStages';
import type { CampaignStageId } from '../../../campaign/campaignTypes';
import {
  Compass,
  Save,
  RotateCcw,
  Clock,
  ArrowLeft,
  Activity,
  ShieldAlert,
} from 'lucide-react';

export const CampaignOverviewScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const lockInfo = location.state as { lockedRoute?: string; lockReason?: string } | null;
  const snapshot = useSimulationSnapshot();
  const runtime = useSimulationRuntime();
  const {
    campaign,
    currentStageId,
    currentStageStatus,
    overallProgressPercent,
    isCompleted,
    isFailed,
    activeBlockers,
    advanceStage,
    saveCampaign,
    loadCampaign,
  } = useCampaign();

  const [selectedStageId, setSelectedStageId] = useState<CampaignStageId>(currentStageId);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dismissedLockAlert, setDismissedLockAlert] = useState(false);

  const selectedStageConfig = CAMPAIGN_STAGE_CONFIGS[selectedStageId] ?? CAMPAIGN_STAGE_CONFIGS[currentStageId];
  const advanceCheck = runtime.getCampaignManager().canAdvanceToNextStage();
  const canAdvance = advanceCheck.canAdvance;

  const handleSave = async () => {
    try {
      const ok = await saveCampaign();
      setSaveMessage(ok ? 'CAMPAIGN CHECKPOINT SAVED' : 'SAVE FAILED');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`SAVE ERROR: ${err.message}`);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleLoad = async () => {
    try {
      const ok = await loadCampaign();
      setSaveMessage(ok ? 'CAMPAIGN RESTORED' : 'RESTORE FAILED (NO SAVE FOUND)');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage(`LOAD ERROR: ${err.message}`);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleAdvance = () => {
    const result = advanceStage();
    if (result.success) {
      setSelectedStageId(result.toStage);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#05070B] text-slate-100 font-sans select-none">
      {/* Top Navigation & Status Bar */}
      <header className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-[#070A10]/95 z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/operations')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            title="Return to Operations Dashboard"
          >
            <ArrowLeft size={14} />
            <span>OPERATIONS</span>
          </button>

          <div className="h-4 w-px bg-white/10" />

          <div className="flex items-center gap-2.5">
            <Compass size={18} className="text-[#35C6F4]" />
            <div>
              <div className="text-xs font-mono font-bold tracking-widest text-[#35C6F4] uppercase">
                EXPEDITION-V // EUROPA SURVEY
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Campaign Orchestration & Stage Progression
              </div>
            </div>
          </div>
        </div>

        {/* Center Progress & MET */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-300">
            <Clock size={13} className="text-[#35C6F4]" />
            <span className="text-slate-400">MET:</span>
            <span className="font-semibold text-slate-100">{snapshot.formattedMET}</span>
          </div>

          <div className="flex items-center gap-3 w-56">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-400">
                <span>EXPEDITION PROGRESS</span>
                <span className="text-[#35C6F4] font-semibold">{overallProgressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#35C6F4] transition-all duration-300"
                  style={{ width: `${overallProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Persistence Actions */}
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-1 rounded border border-amber-400/20 animate-fade-in">
              {saveMessage}
            </span>
          )}

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
            data-testid="campaign-save-button"
            title="Save Checkpoint to Local Storage"
          >
            <Save size={13} className="text-[#35C6F4]" />
            <span>SAVE</span>
          </button>

          <button
            onClick={handleLoad}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
            data-testid="campaign-load-button"
            title="Restore Checkpoint from Local Storage"
          >
            <RotateCcw size={13} className="text-[#F5A623]" />
            <span>LOAD</span>
          </button>
        </div>
      </header>

      {/* Route Guard Locked Route Notification & Clear Navigation Actions */}
      {!dismissedLockAlert && lockInfo?.lockReason && (
        <div
          data-testid="campaign-route-guard-alert"
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/40 text-amber-300 font-mono text-xs select-none animate-fade-in shadow-lg"
        >
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <ShieldAlert size={16} className="text-amber-400 shrink-0" />
            <div className="truncate">
              <span className="font-bold uppercase tracking-wider text-amber-200">
                ACCESS RESTRICTED [{lockInfo.lockedRoute}]:{' '}
              </span>
              <span className="text-amber-300/90">{lockInfo.lockReason}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(CAMPAIGN_STAGE_CONFIGS[currentStageId]?.associatedRoute || '/')}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
              data-testid="alert-proceed-current-btn"
            >
              PROCEED TO CURRENT STAGE
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[11px] transition-colors cursor-pointer"
              data-testid="alert-main-menu-btn"
            >
              MAIN MENU
            </button>
            <button
              type="button"
              onClick={() => setDismissedLockAlert(true)}
              className="p-1 rounded text-amber-400/70 hover:text-amber-200 transition-colors cursor-pointer"
              title="Dismiss Notice"
              aria-label="Dismiss Notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Column Expedition Grid */}
      <main className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left: 18-Stage Flight Sequence (4 cols) */}
        <section className="md:col-span-4 h-full overflow-hidden">
          <CampaignProgressPanel
            currentStageId={currentStageId}
            currentStageStatus={currentStageStatus}
            completedStages={campaign?.completedStageIds ?? []}
            selectedStageId={selectedStageId}
            onSelectStage={setSelectedStageId}
          />
        </section>

        {/* Center: Stage Gates & Mission Objectives (5 cols) */}
        <section className="md:col-span-5 h-full overflow-hidden">
          <CampaignObjectivesPanel
            stage={selectedStageConfig}
            status={
              selectedStageId === currentStageId
                ? currentStageStatus
                : campaign?.completedStageIds.includes(selectedStageId)
                ? 'COMPLETED'
                : 'LOCKED'
            }
            activeBlockers={selectedStageId === currentStageId ? activeBlockers : []}
            objectives={snapshot.objectives}
            isCurrentStage={selectedStageId === currentStageId}
          />
        </section>

        {/* Right: History & Telemetry Summary (3 cols) */}
        <section className="md:col-span-3 h-full flex flex-col gap-4 overflow-hidden">
          {/* Telemetry Snapshot Box */}
          <div className="p-3.5 rounded-xl bg-[#0B0F17]/80 border border-white/10 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300 uppercase tracking-wider">
              <Activity size={14} className="text-[#35C6F4]" />
              <span>Spacecraft State</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <div className="text-slate-400">FLIGHT STATE</div>
                <div className="font-bold text-slate-200">{snapshot.flightState}</div>
              </div>

              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <div className="text-slate-400">FAULTS</div>
                <div className={`font-bold ${snapshot.faults.criticalCount > 0 ? 'text-red-400' : 'text-slate-200'}`}>
                  {snapshot.faults.criticalCount} Critical
                </div>
              </div>

              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <div className="text-slate-400">PROPELLANT</div>
                <div className="font-bold text-slate-200">{snapshot.propellantRemainingKg.toFixed(1)} kg</div>
              </div>

              <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                <div className="text-slate-400">SSDR STORAGE</div>
                <div className="font-bold text-slate-200">
                  {Math.round(snapshot.storage.utilizationPercent)}%
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Stage Log */}
          <div className="flex-1 overflow-hidden">
            <CampaignHistoryPanel history={campaign?.stageHistory ?? []} />
          </div>
        </section>
      </main>

      {/* Bottom Campaign Continue Action Bar */}
      <footer className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-[#070A10]/95 z-20">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">CURRENT EXPEDITION STAGE:</span>
          <span className="text-xs font-mono font-bold text-[#35C6F4]">
            {CAMPAIGN_STAGE_CONFIGS[currentStageId].title}
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-xs font-mono text-slate-400">STATUS:</span>
          <span className="text-xs font-mono font-bold text-slate-200">{currentStageStatus}</span>
        </div>

        <CampaignContinueButton
          currentStage={CAMPAIGN_STAGE_CONFIGS[currentStageId]}
          status={currentStageStatus}
          canAdvance={canAdvance}
          blockers={activeBlockers}
          isCompleted={isCompleted}
          isFailed={isFailed}
          onAdvanceStage={handleAdvance}
        />
      </footer>
    </div>
  );
};
