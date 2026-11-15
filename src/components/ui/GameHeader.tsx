import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  Volume2,
  VolumeX,
  Layers,
} from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { GameButton } from './GameButton';
import { sounds } from '../../utils/soundEffects';

export interface GameHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  rightElement?: React.ReactNode;
  className?: string;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  title,
  subtitle,
  icon,
  backTo,
  backLabel,
  rightElement,
  className,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [muted, setMuted] = useState(sounds.getMuted());
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [phaseSelectorOpen, setPhaseSelectorOpen] = useState(false);

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    sounds.setMuted(next);
    if (!next) sounds.playClick(1000);
  };

  const screens = [
    { path: '/', label: '1. Main Menu' },
    { path: '/missions', label: '2. Select Mission' },
    { path: '/workshop', label: '3. Spacecraft Workshop' },
    { path: '/trajectory', label: '4. Trajectory Planner' },
    { path: '/operations', label: '5. Mission Operations' },
    { path: '/surface', label: '6. Surface Exploration' },
    { path: '/anomaly', label: '7. Anomaly Detected' },
    { path: '/debrief', label: '8. Mission Debrief' },
  ];

  const handleNavigate = (path: string) => {
    sounds.playClick(1200);
    navigate(path);
  };

  return (
    <>
      <header
        className={`relative z-30 flex items-center justify-between px-6 py-3 border-b border-[#2B3642] bg-[#07090C] select-none shrink-0 ${
          className ?? ''
        }`}
      >
        {/* Left: Back Navigation & Screen Heading */}
        <div className="flex items-center gap-3.5">
          {backTo && (
            <button
              type="button"
              onClick={() => handleNavigate(backTo)}
              className="flex items-center gap-1.5 text-[#A9B0B5] hover:text-[#E6E2D6] px-2.5 py-1 rounded-[2px] bg-[#151B22] hover:bg-[#1C242D] border border-[#2B3642] hover:border-[#7FB7D4] transition-all cursor-pointer font-mono text-xs uppercase tracking-wider"
            >
              <ChevronLeft size={14} />
              {backLabel ?? 'BACK'}
            </button>
          )}

          <div className="flex items-center gap-2.5">
            {icon && <span className="text-[#E0A43A]">{icon}</span>}
            <div>
              <h1 className="font-display text-base md:text-lg font-bold tracking-widest uppercase text-[#E6E2D6]">
                {title}
              </h1>
              {subtitle && (
                <p className="font-mono text-[10px] text-[#A9B0B5] tracking-wider">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Phase Selector, Custom Telemetry, Audio Toggle */}
        <div className="flex items-center gap-3">
          {rightElement}

          {/* Quick Expedition Stages Jumper */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                sounds.playClick(900);
                setPhaseSelectorOpen(!phaseSelectorOpen);
              }}
              className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-[2px] bg-[#151B22] hover:bg-[#1C242D] border border-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6] transition-all cursor-pointer"
              title="Quick jump across all 8 game screens"
            >
              <Layers size={13} className="text-[#7FB7D4]" />
              <span className="hidden sm:inline">EXPEDITION STAGES</span>
            </button>

            {phaseSelectorOpen && (
              <div
                className="absolute right-0 mt-2 w-60 aerospace-panel-raised border border-[#2B3642] p-1.5 shadow-2xl z-50 text-xs font-mono"
                onClick={() => setPhaseSelectorOpen(false)}
              >
                <div className="px-3 py-1.5 text-[10px] text-[#6B757D] border-b border-[#2B3642] uppercase tracking-wider mb-1">
                  8 Mission Phases
                </div>
                {screens.map((s) => {
                  const isActive = location.pathname === s.path;
                  return (
                    <button
                      key={s.path}
                      onClick={() => handleNavigate(s.path)}
                      className={`w-full text-left px-3 py-2 rounded-[2px] transition-all flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#151B22] text-[#7FB7D4] font-semibold border border-[#7FB7D4]'
                          : 'text-[#A9B0B5] hover:text-[#E6E2D6] hover:bg-[#151B22]'
                      }`}
                    >
                      <span>{s.label}</span>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#7FB7D4]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Atmospheric Audio Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 rounded-[2px] bg-[#151B22] hover:bg-[#1C242D] border border-[#2B3642] text-[#A9B0B5] hover:text-[#E6E2D6] transition-all cursor-pointer"
            title={muted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </header>

      {/* Mission Archive Modal */}
      <ModalDialog
        isOpen={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Mission Archives // Sector 17 Logs"
        subtitle="Declassified records of prior outer-rim reconnaissance flights"
        maxWidth="lg"
        footer={
          <GameButton variant="glass" size="sm" onClick={() => setArchiveModalOpen(false)}>
            Close Archive
          </GameButton>
        }
      >
        <div className="space-y-3 font-mono text-xs">
          <div className="p-3 bg-[#151B22] rounded-[2px] border border-[#2B3642] flex items-center justify-between">
            <div>
              <div className="text-[#E6E2D6] font-semibold">EXPEDITION-IV // CALLISTO OUTPOST</div>
              <div className="text-[#A9B0B5] text-[11px] mt-0.5">MET 118 Days · Discovery: Ancient sub-ice silicate formations</div>
            </div>
            <span className="text-[#6FAE7C] font-semibold">ARCHIVED</span>
          </div>

          <div className="p-3 bg-[#151B22] rounded-[2px] border border-[#2B3642] flex items-center justify-between">
            <div>
              <div className="text-[#E6E2D6] font-semibold">EXPEDITION-III // GANYMEDE MAGNETICS</div>
              <div className="text-[#A9B0B5] text-[11px] mt-0.5">MET 94 Days · Discovery: Aurora flux tube harmonic resonance</div>
            </div>
            <span className="text-[#6FAE7C] font-semibold">ARCHIVED</span>
          </div>

          <div className="p-3 bg-[#151B22] rounded-[2px] border border-[#2B3642] flex items-center justify-between">
            <div>
              <div className="text-[#E0A43A] font-semibold">EXPEDITION-V // THE EUROPA SURVEY</div>
              <div className="text-[#A9B0B5] text-[11px] mt-0.5">MET IN PROGRESS · Target: Subsurface ocean anomaly</div>
            </div>
            <span className="text-[#E0A43A] font-semibold">ACTIVE</span>
          </div>
        </div>
      </ModalDialog>
    </>
  );
};
