import React, { useState } from 'react';
import { ModalDialog } from '../../../components/ui/ModalDialog';
import { GameButton } from '../../../components/ui/GameButton';
import { sounds } from '../../../utils/soundEffects';
import { Volume2, VolumeX, Monitor, Sliders } from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  muted,
  onToggleMute,
}) => {
  const [graphicsQuality, setGraphicsQuality] = useState<'Cinematic' | 'High' | 'Balanced'>('Cinematic');
  const [hudScale, setHudScale] = useState<'90%' | '100%' | '110%'>('100%');

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="SYSTEM CONFIGURATION // FLIGHT TERMINAL"
      subtitle="Visual rendering, audio telemetry, and interface calibration"
      maxWidth="md"
      footer={
        <div className="flex justify-end gap-3 w-full">
          <GameButton
            variant="amber"
            size="sm"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
          >
            Apply & Return
          </GameButton>
        </div>
      }
    >
      <div className="space-y-5 font-mono text-xs">
        {/* Audio Telemetry */}
        <div className="p-3.5 bg-[#0D1116] border border-[#2B3642] rounded space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[#E6E2D6] font-semibold">
              {muted ? <VolumeX size={15} className="text-[#D8503F]" /> : <Volume2 size={15} className="text-[#7FB7D4]" />}
              <span>AUDIO TELEMETRY & SYNTHESIS</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onToggleMute();
              }}
              className={`px-3 py-1 text-[11px] rounded border transition-colors cursor-pointer ${
                muted
                  ? 'bg-[#D8503F]/20 border-[#D8503F] text-[#F1F5FA]'
                  : 'bg-[#7FB7D4]/20 border-[#7FB7D4] text-[#7FB7D4] font-bold'
              }`}
            >
              {muted ? 'MUTED' : 'ENABLED'}
            </button>
          </div>
          <p className="text-[11px] text-[#A9B0B5]">
            Procedural Web Audio synthesizer generating tactical chimes, propulsion burns, and atmospheric resonance.
          </p>
        </div>

        {/* Display Rendering Quality */}
        <div className="p-3.5 bg-[#0D1116] border border-[#2B3642] rounded space-y-2.5">
          <div className="flex items-center gap-2 text-[#E6E2D6] font-semibold">
            <Monitor size={15} className="text-[#E0A43A]" />
            <span>3D GRAPHICS & SCENE FIDELITY</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['Balanced', 'High', 'Cinematic'] as const).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setGraphicsQuality(q);
                }}
                className={`py-2 px-1 text-center text-xs rounded border transition-colors cursor-pointer ${
                  graphicsQuality === q
                    ? 'bg-[#E0A43A]/20 border-[#E0A43A] text-white font-bold'
                    : 'bg-[#151B22] border-[#2B3642] text-[#A9B0B5] hover:text-white hover:border-[#7FB7D4]'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#6B757D]">
            Cinematic enables PBR planetary limb scattering, dynamic albedo bounce, and starfield anti-aliasing.
          </p>
        </div>

        {/* Interface Scale */}
        <div className="p-3.5 bg-[#0D1116] border border-[#2B3642] rounded space-y-2.5">
          <div className="flex items-center gap-2 text-[#E6E2D6] font-semibold">
            <Sliders size={15} className="text-[#6FAE7C]" />
            <span>HUD CALIPER & SCALE</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['90%', '100%', '110%'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  sounds.playClick();
                  setHudScale(s);
                }}
                className={`py-2 px-1 text-center text-xs rounded border transition-colors cursor-pointer ${
                  hudScale === s
                    ? 'bg-[#6FAE7C]/20 border-[#6FAE7C] text-white font-bold'
                    : 'bg-[#151B22] border-[#2B3642] text-[#A9B0B5] hover:text-white hover:border-[#7FB7D4]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalDialog>
  );
};
