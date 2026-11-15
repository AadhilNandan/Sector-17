import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimulationRuntime, useSimulationSnapshot, useCampaign } from '../../runtime/SimulationContext';
import { DebriefHeader } from '../mission-debrief/components/DebriefHeader';
import { DebriefParchmentReport } from '../mission-debrief/components/DebriefParchmentReport';
import { DebriefFooter } from '../mission-debrief/components/DebriefFooter';
import { sounds } from '../../utils/soundEffects';

export const MissionDebriefScreen: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useSimulationRuntime();
  const snapshot = useSimulationSnapshot();
  const campaign = useCampaign();
  const [isArchived, setIsArchived] = useState(false);

  // Play triumphant debrief fanfare and ensure evaluation is computed on mount
  useEffect(() => {
    sounds.playSuccess();
    if (!snapshot.missionEvaluation) {
      runtime.evaluateMissionOutcome();
    }
  }, [runtime, snapshot.missionEvaluation]);

  // Handle expedition archiving
  const handleArchive = () => {
    if (isArchived) return;
    runtime.archiveMissionDebrief();
    try {
      campaign.saveCampaign();
    } catch {
      // safe fallback if storage is mock
    }
    setIsArchived(true);
  };

  const handleReturnToMenu = () => {
    navigate('/');
  };

  const handleBackToOperations = () => {
    navigate('/operations');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#060A10] flex flex-col justify-between select-none">
      {/* Subtle deep space background atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#0C121E]/60 via-[#060A10] to-[#04060A] pointer-events-none" />

      {/* 1. TOP HEADER */}
      <DebriefHeader
        onBack={handleBackToOperations}
        onSettings={() => {}}
        missionName="EXPEDITION-V (EUROPA SURVEY)"
      />

      {/* 2. CENTRAL PARCHMENT DOSSIER */}
      <main className="relative flex-1 w-full overflow-y-auto flex items-center justify-center p-2 sm:p-4 z-10">
        <DebriefParchmentReport snapshot={snapshot} />
      </main>

      {/* 3. BOTTOM FOOTER & ACTIONS */}
      <DebriefFooter
        onArchive={handleArchive}
        onReturnToMenu={handleReturnToMenu}
        isArchived={isArchived}
      />
    </div>
  );
};
