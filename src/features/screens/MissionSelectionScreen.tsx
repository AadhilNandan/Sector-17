import React, { useState, useContext, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationContext } from '../../runtime/SimulationContext';
import { useExpedition } from '../../context/ExpeditionContext';
import { HISTORICAL_DOSSIERS, type ExpeditionDossier, type SegmentStatus } from '../mission-selection/dossierData';
import { DossierCard } from '../mission-selection/components/DossierCard';
import { ExpeditionArchiveHeader } from '../mission-selection/components/ExpeditionArchiveHeader';
import { ExpeditionArchiveFooter } from '../mission-selection/components/ExpeditionArchiveFooter';
import { SettingsModal } from '../main-menu/components/SettingsModal';
import { CAMPAIGN_STAGE_CONFIGS } from '../../campaign/campaignStages';
import { sounds } from '../../utils/soundEffects';

export const MissionSelectionScreen: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useContext(SimulationContext);
  const { selectMission } = useExpedition();

  const [selectedId, setSelectedId] = useState<string>('expedition-5');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [muted, setMuted] = useState(sounds.getMuted());

  // Sound toggle handler
  const handleToggleSound = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    sounds.setMuted(nextMuted);
    if (!nextMuted) {
      sounds.playClick();
    }
  }, [muted]);

  // Derive dynamic segments and status for Expedition-V from authoritative campaign state
  const campaignSnapshot = runtime?.getSnapshot().campaign;
  const currentStageId = campaignSnapshot?.currentStageId ?? 'MISSION_SELECTION';
  const stageOrder = CAMPAIGN_STAGE_CONFIGS[currentStageId]?.order ?? 1;

  const dynamicExpedition5: ExpeditionDossier = useMemo(() => {
    const base = HISTORICAL_DOSSIERS['expedition-5'];

    // LAUNCH segment
    let launchStatus: SegmentStatus = 'PENDING';
    let launchText = '[PENDING]';
    if (stageOrder === 6) {
      launchStatus = 'ACTIVE';
      launchText = '[ACTIVE]';
    } else if (stageOrder > 6) {
      launchStatus = 'COMPLETED';
      launchText = '[OK]';
    }

    // SPACE segment
    let spaceStatus: SegmentStatus = 'PENDING';
    let spaceText = '[PENDING]';
    if (stageOrder >= 7 && stageOrder <= 9) {
      spaceStatus = 'ACTIVE';
      spaceText = '[ACTIVE]';
    } else if (stageOrder > 9) {
      spaceStatus = 'COMPLETED';
      spaceText = '[OK]';
    }

    // GROUND segment
    let groundStatus: SegmentStatus = 'PENDING';
    let groundText = '[PENDING]';
    if (stageOrder >= 10 && stageOrder <= 13) {
      groundStatus = 'ACTIVE';
      groundText = '[ACTIVE]';
    } else if (stageOrder > 13) {
      groundStatus = 'COMPLETED';
      groundText = '[OK]';
    }

    // USER segment
    let userStatus: SegmentStatus = 'PENDING';
    let userText = '[PENDING]';
    if (stageOrder >= 14 && stageOrder < 17) {
      userStatus = 'ACTIVE';
      userText = '[ACTIVE]';
    } else if (stageOrder >= 17) {
      userStatus = 'COMPLETED';
      userText = '[OK]';
    }

    return {
      ...base,
      segments: [
        { id: 'launch', label: 'LAUNCH', status: launchStatus, statusText: launchText },
        { id: 'space', label: 'SPACE', status: spaceStatus, statusText: spaceText },
        { id: 'ground', label: 'GROUND', status: groundStatus, statusText: groundText },
        { id: 'user', label: 'USER', status: userStatus, statusText: userText },
      ],
    };
  }, [stageOrder]);

  const allDossiers: ExpeditionDossier[] = useMemo(() => {
    return [
      HISTORICAL_DOSSIERS['expedition-3'],
      HISTORICAL_DOSSIERS['expedition-4'],
      dynamicExpedition5,
    ];
  }, [dynamicExpedition5]);

  const selectedDossier = useMemo(() => {
    return allDossiers.find((d) => d.id === selectedId) ?? dynamicExpedition5;
  }, [allDossiers, selectedId, dynamicExpedition5]);

  // Derive status label for the footer
  const statusLabel = useMemo(() => {
    if (!selectedDossier.isPlayable) {
      return selectedDossier.outcomeStamp.label;
    }
    if (campaignSnapshot?.isCampaignCompleted) {
      return 'EXPEDITION COMPLETED';
    }
    if (stageOrder <= 5) {
      return 'READY FOR LAUNCH';
    }
    if (stageOrder <= 9) {
      return 'IN FLIGHT // CRUISE';
    }
    return 'ACTIVE SURFACE PROTOCOL';
  }, [selectedDossier, campaignSnapshot, stageOrder]);

  const handleSelect = (id: string) => {
    sounds.playHover();
    setSelectedId(id);
  };

  const handleBeginExpedition = useCallback(() => {
    if (!selectedDossier.isPlayable) return;
    sounds.playClick();

    // Set authoritative mission ID in context
    selectMission('europa-survey');

    // Advance campaign stage if currently at MISSION_SELECTION
    if (runtime) {
      const manager = runtime.getCampaignManager();
      if (manager.getCurrentStageId() === 'MISSION_SELECTION') {
        try {
          manager.advanceToStage('SPACECRAFT_DESIGN');
        } catch (err) {
          console.warn('Failed to advance campaign to SPACECRAFT_DESIGN:', err);
        }
      }
    }

    // Navigate to Spacecraft Workshop
    navigate('/workshop');
  }, [selectedDossier, selectMission, runtime, navigate]);

  const handleReturn = useCallback(() => {
    sounds.playClick();
    navigate('/');
  }, [navigate]);

  // Keyboard navigation across the three dossier cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen) {
        if (e.key === 'Escape') {
          setSettingsOpen(false);
          sounds.playClick();
        }
        return;
      }

      const dossierIds = ['expedition-3', 'expedition-4', 'expedition-5'];
      const currentIndex = dossierIds.indexOf(selectedId);

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        sounds.playHover();
        const next = dossierIds[(currentIndex + 1) % dossierIds.length];
        setSelectedId(next);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        sounds.playHover();
        const prev = dossierIds[(currentIndex - 1 + dossierIds.length) % dossierIds.length];
        setSelectedId(prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedDossier.isPlayable) {
          handleBeginExpedition();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleReturn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, selectedId, selectedDossier, handleBeginExpedition, handleReturn]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090C] text-[#E6E2D6] flex flex-col justify-between select-none">
      {/* Background Starfield */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-45" xmlns="http://www.w3.org/2000/svg">
        {Array.from({ length: 90 }).map((_, i) => (
          <circle
            key={i}
            cx={`${(i * 73) % 100}%`}
            cy={`${(i * 37) % 100}%`}
            r={((i % 3) + 1) * 0.5}
            fill="#FFFFFF"
            opacity={((i % 4) + 2) / 10}
          />
        ))}
      </svg>

      {/* 1. Header Bar */}
      <ExpeditionArchiveHeader
        onReturn={handleReturn}
        onOpenSettings={() => {
          sounds.playClick();
          setSettingsOpen(true);
        }}
      />

      {/* 2. Main Viewport — Three Expedition Dossiers */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 md:px-8 py-4 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl w-full items-stretch justify-items-center">
          {allDossiers.map((dossier) => (
            <DossierCard
              key={dossier.id}
              dossier={dossier}
              isSelected={selectedId === dossier.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </main>

      {/* 3. Footer Bar */}
      <ExpeditionArchiveFooter
        selectedDossier={selectedDossier}
        statusLabel={statusLabel}
        onBeginExpedition={handleBeginExpedition}
      />

      {/* 4. Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        muted={muted}
        onToggleMute={handleToggleSound}
      />
    </div>
  );
};
