/**
 * SECTOR 17 — Mission Decision & Response Screen
 * Interactive flight computer authorization station for candidate decision options,
 * evidence auditing, risk validation, commander directives, and authoritative consequence tracking.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  Layers,
  FileText,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { GameHeader } from '../../components/ui/GameHeader';
import { GameButton } from '../../components/ui/GameButton';
import {
  useSimulationSnapshot,
  useSimulationDecisions,
} from '../../runtime';
import { sounds } from '../../utils/soundEffects';

import { DecisionOverviewPanel } from './decisions/DecisionOverviewPanel';
import { DecisionOptionCard } from './decisions/DecisionOptionCard';
import { DecisionEvidencePanel } from './decisions/DecisionEvidencePanel';
import { DecisionRiskPanel } from './decisions/DecisionRiskPanel';
import { DecisionAuthorizationPanel } from './decisions/DecisionAuthorizationPanel';
import { DecisionConsequencePanel } from './decisions/DecisionConsequencePanel';
import { DecisionHistoryPanel } from './decisions/DecisionHistoryPanel';
import type {
  DecisionOption,
  DecisionRecord,
} from '../../simulation/missionDecision/types';

type MainViewTab = 'options' | 'pending' | 'history' | 'evidence';
type DetailSubTab = 'authorization' | 'risk' | 'evidence' | 'consequences';

export const MissionDecisionScreen: React.FC = () => {
  const navigate = useNavigate();
  const snap = useSimulationSnapshot();
  const { availableDecisions, decisionHistory, evidenceItems, proposeDecision, authorizeDecision, executeDecision } =
    useSimulationDecisions();

  const [mainTab, setMainTab] = useState<MainViewTab>('options');
  const [detailTab, setDetailTab] = useState<DetailSubTab>('authorization');
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [localFeedback, setLocalFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Proposed & Approved records
  const pendingRecords = decisionHistory.filter((d) => d.status === 'PROPOSED');
  const approvedRecords = decisionHistory.filter((d) => d.status === 'APPROVED');
  const activeDirectives = [...pendingRecords, ...approvedRecords];

  // Resolve selected item (either candidate option or historical record)
  const selectedRecord: DecisionRecord | undefined = decisionHistory.find(
    (d) => d.decisionId === selectedDecisionId
  );
  const selectedCandidate: DecisionOption | undefined = availableDecisions.find(
    (o) => o.id === selectedDecisionId
  );

  let selectedItem: DecisionOption | DecisionRecord | undefined =
    selectedRecord ?? selectedCandidate;

  if (!selectedItem) {
    if (mainTab === 'pending' && activeDirectives.length > 0) {
      selectedItem = activeDirectives[0];
    } else if (mainTab === 'history' && decisionHistory.length > 0) {
      selectedItem = decisionHistory[0];
    } else if (availableDecisions.length > 0) {
      selectedItem = availableDecisions[0];
    }
  }

  const activeOption: DecisionOption | undefined = selectedItem
    ? ('status' in selectedItem ? selectedItem.option : selectedItem)
    : undefined;

  const handleSelectDecision = (id: string) => {
    sounds.playClick(1100);
    setSelectedDecisionId(id);
    setLocalFeedback(null);
  };

  const handlePropose = (optionId: string) => {
    sounds.playClick(1300);
    setLocalFeedback(null);
    try {
      const rec = proposeDecision(optionId);
      setSelectedDecisionId(rec.decisionId);
      setMainTab('pending');
      setLocalFeedback({
        message: `Decision '${rec.option.title}' proposed successfully. Ready for commander review.`,
        type: 'success',
      });
    } catch (err: any) {
      setLocalFeedback({
        message: err?.message ?? String(err),
        type: 'error',
      });
    }
  };

  const handleAuthorize = (approved: boolean, reason?: string) => {
    if (!selectedItem) return;
    const decisionId = 'decisionId' in selectedItem ? selectedItem.decisionId : selectedItem.id;
    setLocalFeedback(null);

    try {
      const rec = authorizeDecision(decisionId, approved, reason);
      setSelectedDecisionId(rec.decisionId);
      setLocalFeedback({
        message: approved
          ? `Directive authorized. Pre-flight checks passed.`
          : `Decision rejected by Flight Director.`,
        type: 'success',
      });
    } catch (err: any) {
      setLocalFeedback({
        message: err?.message ?? String(err),
        type: 'error',
      });
    }
  };

  const handleExecute = async () => {
    if (!selectedItem) return;
    const decisionId = 'decisionId' in selectedItem ? selectedItem.decisionId : selectedItem.id;
    setIsExecuting(true);
    setLocalFeedback(null);

    try {
      const result = await executeDecision(decisionId);
      if (result.success) {
        setDetailTab('consequences');
        setLocalFeedback({
          message: `Execution complete. Applied ${result.consequences.length} physical consequences.`,
          type: 'success',
        });
      } else {
        setLocalFeedback({
          message: result.errorMessage ?? 'Decision execution was rejected by flight computer.',
          type: 'error',
        });
      }
    } catch (err: any) {
      setLocalFeedback({
        message: err?.message ?? String(err),
        type: 'error',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070B] flex flex-col select-none">
      {/* 1. Header */}
      <GameHeader
        title="SECTOR 17 · MISSION DECISION & RESPONSE STATION"
        subtitle="EXPEDITION-V — THE EUROPA SURVEY · SPACECRAFT AETHON"
        icon={<Compass size={18} className="text-[#35C6F4]" />}
        backTo="/operations"
        backLabel="OPERATIONS"
        rightElement={
          <div className="flex items-center gap-3">
            {/* Formatted MET Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 font-mono text-xs text-[#35C6F4] font-bold tracking-widest shadow-inner">
              <span className="text-[10px] text-[#A5B1C2] uppercase">MET</span>
              <span>{snap.formattedMET}</span>
            </div>

            {/* Flight State Pill */}
            <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono font-semibold uppercase text-[#31C48D]">
              {snap.flightState}
            </div>
          </div>
        }
      />

      {/* 2. Feedback / Alert Notification Banner */}
      {snap.isLaunchAuthorized && (
        <div className="mx-4 md:mx-6 mt-3 px-4 py-2.5 rounded-lg bg-[#31C48D]/20 border border-[#31C48D]/50 text-[#31C48D] text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="font-bold">LAUNCH AUTHORIZATION GRANTED — Systems nominal for countdown.</span>
          </div>
          <GameButton
            variant="amber"
            size="sm"
            onClick={() => navigate('/operations')}
            className="h-8 text-[11px] font-bold"
          >
            PROCEED TO LAUNCH OPERATIONS
          </GameButton>
        </div>
      )}

      {localFeedback && (
        <div
          className={`px-4 py-2 border-b flex items-center justify-between text-xs font-mono z-30 transition-all ${
            localFeedback.type === 'error'
              ? 'bg-[#EF6464]/20 border-[#EF6464]/40 text-[#EF6464]'
              : 'bg-[#31C48D]/20 border-[#31C48D]/40 text-[#31C48D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {localFeedback.type === 'error' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />}
            <span>{localFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalFeedback(null)}
            className="text-[10px] underline uppercase cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. Main Workspace */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col p-4 md:p-6 gap-4">
        {/* Top Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#080D16]/90 border border-white/10 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                sounds.playClick(1000);
                setSelectedDecisionId(null);
                setMainTab('options');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[11px] ${
                mainTab === 'options'
                  ? 'bg-[#35C6F4]/20 text-[#35C6F4] border border-[#35C6F4]/30'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              <Layers size={13} />
              <span>Available Options ({availableDecisions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick(1000);
                setSelectedDecisionId(null);
                setMainTab('pending');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[11px] ${
                mainTab === 'pending'
                  ? 'bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              <Clock size={13} className={pendingRecords.length > 0 ? 'animate-pulse text-[#F5A623]' : ''} />
              <span>Active Directives ({activeDirectives.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick(1000);
                setSelectedDecisionId(null);
                setMainTab('history');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[11px] ${
                mainTab === 'history'
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              <FileText size={13} />
              <span>Audit History ({decisionHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick(1000);
                setSelectedDecisionId(null);
                setMainTab('evidence');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold uppercase text-[11px] ${
                mainTab === 'evidence'
                  ? 'bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30'
                  : 'text-[#A5B1C2] hover:text-white'
              }`}
            >
              <Sparkles size={13} />
              <span>Evidence Archive ({evidenceItems.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <GameButton
              variant="ghost"
              size="sm"
              onClick={() => navigate('/operations')}
              className="text-xs font-mono font-bold"
            >
              RETURN TO OPERATIONS HUD
            </GameButton>
          </div>
        </div>

        {/* Content View Container */}
        <div className="flex-1 w-full min-h-0 overflow-y-auto">
          {mainTab === 'history' ? (
            <div className="max-w-[1400px] mx-auto pb-6">
              <DecisionHistoryPanel
                records={decisionHistory}
                selectedDecisionId={selectedDecisionId ?? undefined}
                onSelectRecord={(rec) => {
                  setSelectedDecisionId(rec.decisionId);
                  setMainTab('options');
                  setDetailTab('consequences');
                }}
              />
            </div>
          ) : mainTab === 'evidence' ? (
            <div className="max-w-[1400px] mx-auto pb-6">
              <DecisionEvidencePanel evidenceList={evidenceItems} />
            </div>
          ) : (
            /* Split View: Left List / Right Deep Detail */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-[1700px] mx-auto pb-6 h-full">
              {/* Left Column: Overview + Decision Cards List (Col 1-5) */}
              <div className="lg:col-span-5 flex flex-col gap-3 min-h-0">
                <DecisionOverviewPanel
                  activeFilter={mainTab === 'pending' ? 'pending' : 'all'}
                  onFilterChange={(f) => {
                    if (f === 'pending') setMainTab('pending');
                    else if (f === 'history') setMainTab('history');
                    else setMainTab('options');
                  }}
                />

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {mainTab === 'options' ? (
                    availableDecisions.length > 0 ? (
                      availableDecisions.map((opt) => {
                        const existingRecord = decisionHistory.find((d) => d.decisionId === opt.id);
                        return (
                          <DecisionOptionCard
                            key={opt.id}
                            option={opt}
                            status={existingRecord?.status}
                            isSelected={selectedItem ? ('decisionId' in selectedItem ? selectedItem.decisionId === opt.id : selectedItem.id === opt.id) : false}
                            onSelect={() => handleSelectDecision(opt.id)}
                            onQuickAction={() => handlePropose(opt.id)}
                            quickActionLabel="Propose"
                          />
                        );
                      })
                    ) : (
                      <div className="p-8 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-xl border border-white/5">
                        NO CANDIDATE DECISION OPTIONS GENERATED
                      </div>
                    )
                  ) : activeDirectives.length > 0 ? (
                    activeDirectives.map((rec) => (
                      <DecisionOptionCard
                        key={rec.decisionId}
                        option={rec.option}
                        status={rec.status}
                        isSelected={selectedDecisionId === rec.decisionId}
                        onSelect={() => handleSelectDecision(rec.decisionId)}
                        onQuickAction={
                          rec.status === 'APPROVED' ? handleExecute : undefined
                        }
                        quickActionLabel={rec.status === 'APPROVED' ? 'Execute' : undefined}
                      />
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-xl border border-white/5">
                      NO ACTIVE PROPOSED OR AUTHORIZED DIRECTIVES
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Deep Inspection & Execution Workbench (Col 6-12) */}
              <div className="lg:col-span-7 flex flex-col gap-3 min-h-0">
                {activeOption && selectedItem ? (
                  <div className="flex flex-col gap-3 h-full">
                    {/* Detail Sub-Tabs */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#080D16]/90 border border-white/10 font-mono text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick(900);
                          setDetailTab('authorization');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[11px] transition-all cursor-pointer ${
                          detailTab === 'authorization'
                            ? 'bg-[#35C6F4]/20 text-[#35C6F4] border border-[#35C6F4]/30'
                            : 'text-[#A5B1C2] hover:text-white'
                        }`}
                      >
                        Authorization Station
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick(900);
                          setDetailTab('risk');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[11px] transition-all cursor-pointer ${
                          detailTab === 'risk'
                            ? 'bg-[#35C6F4]/20 text-[#35C6F4] border border-[#35C6F4]/30'
                            : 'text-[#A5B1C2] hover:text-white'
                        }`}
                      >
                        Risk Analysis ({activeOption.riskAssessment.highestSeverity})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          sounds.playClick(900);
                          setDetailTab('evidence');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[11px] transition-all cursor-pointer ${
                          detailTab === 'evidence'
                            ? 'bg-[#35C6F4]/20 text-[#35C6F4] border border-[#35C6F4]/30'
                            : 'text-[#A5B1C2] hover:text-white'
                        }`}
                      >
                        Evidence ({activeOption.evidenceReferences.length})
                      </button>

                      {'executionResult' in selectedItem && selectedItem.executionResult && (
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick(900);
                            setDetailTab('consequences');
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold uppercase text-[11px] transition-all cursor-pointer ${
                            detailTab === 'consequences'
                              ? 'bg-[#31C48D]/20 text-[#31C48D] border border-[#31C48D]/30'
                              : 'text-[#A5B1C2] hover:text-white'
                          }`}
                        >
                          Consequences ({selectedItem.executionResult.consequences.length})
                        </button>
                      )}
                    </div>

                    {/* Active Sub-Panel */}
                    <div className="flex-1 overflow-y-auto pr-1">
                      {detailTab === 'authorization' && (
                        <DecisionAuthorizationPanel
                          decision={selectedItem}
                          onAuthorize={handleAuthorize}
                          onExecute={handleExecute}
                          onPropose={() => handlePropose(activeOption.id)}
                          isExecuting={isExecuting}
                        />
                      )}

                      {detailTab === 'risk' && (
                        <DecisionRiskPanel riskAssessment={activeOption.riskAssessment} />
                      )}

                      {detailTab === 'evidence' && (
                        <DecisionEvidencePanel
                          evidenceList={evidenceItems}
                          selectedEvidenceIds={activeOption.evidenceReferences}
                          title={`Supporting Evidence (${activeOption.evidenceReferences.length})`}
                        />
                      )}

                      {detailTab === 'consequences' && (
                        <DecisionConsequencePanel
                          executionResult={
                            'executionResult' in selectedItem ? selectedItem.executionResult : undefined
                          }
                          consequences={
                            'consequences' in selectedItem ? selectedItem.consequences : undefined
                          }
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs font-mono text-[#6D7A8D] bg-white/[0.02] rounded-xl border border-white/5 h-full flex flex-col items-center justify-center">
                    <Compass size={32} className="opacity-30 mb-3" />
                    <div className="font-bold text-sm text-[#A5B1C2]">NO DECISION SELECTED</div>
                    <div className="text-[11px] mt-1 text-[#6D7A8D]">
                      Select a candidate response option or active directive from the list to review risk, audit evidence, and authorize dispatch.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
