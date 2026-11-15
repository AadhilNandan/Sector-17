import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameHeader } from '../../components/ui/GameHeader';
import { SceneContainer } from '../../components/ui/SceneContainer';
import { GamePanel } from '../../components/ui/GamePanel';
import { GameButton } from '../../components/ui/GameButton';
import { AnomalyChamberScene } from '../../components/scenes/AnomalyChamberScene';
import { useExpedition } from '../../context/ExpeditionContext';
import { useSimulationRuntime } from '../../runtime';
import type { AnomalyDecision } from '../../types/game';
import { sounds } from '../../utils/soundEffects';
import {
  Zap,
  Scan,
  FlaskConical,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const AnomalyDetectedScreen: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useSimulationRuntime();
  const { anomalyDecision, makeAnomalyDecision } = useExpedition();
  const [selectedLocal, setSelectedLocal] = useState<AnomalyDecision>(
    anomalyDecision ?? 'analyze'
  );

  // Trigger ominous alert sound on mount
  useEffect(() => {
    sounds.playAlert();
  }, []);

  const handleDecision = (decision: AnomalyDecision) => {
    sounds.playClick();
    setSelectedLocal(decision);
    makeAnomalyDecision(decision);
    try {
      runtime.executeAnomalyDecision(decision);
    } catch {
      // Stage safety fallback
    }
  };

  const handleProceedToDebrief = () => {
    sounds.playClick();
    try {
      runtime.queueAllStoredScienceForDownlink();
      runtime.executeDsnDownlinkStep(3600);
      runtime.evaluateMissionOutcome();
    } catch {
      // Stage safety fallback
    }
    navigate('/debrief');
  };

  const decisionConsequences: Record<AnomalyDecision, { title: string; text: string; statImpact: string }> = {
    analyze: {
      title: 'Active Structural Resonance Scan',
      text: 'Radar beams penetrated the aperture. Unprecedented harmonic pulses recorded. Maximum scientific yield.',
      statImpact: '+20% Scientific Value · -6% Risk Margin',
    },
    sample: {
      title: 'Physical Extraterrestrial Alloy Retrieval',
      text: 'Drill arm extracted crystalline slivers from outer ring. Unique isotopic lattice confirmed.',
      statImpact: '+15% Material Science · Material Sample Acquired',
    },
    withdraw: {
      title: 'Safe Standoff Vector Maintained',
      text: 'Vessel pulled back to safe orbital radius. Complete crew and telemetry safety prioritized.',
      statImpact: '+18% Risk Handling · Standoff Telemetry Logged',
    },
  };

  const activeConsequence = decisionConsequences[selectedLocal];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05070B] flex flex-col">
      {/* Game Header */}
      <GameHeader
        title="ANOMALY DETECTED"
        subtitle="Classification: Relic-Omega · Non-Natural Torus Singularity"
        icon={<Zap size={18} className="text-[#F5A623]" />}
        backTo="/surface"
        backLabel="SURFACE"
      />

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* 2D Colossal Alien Portal Chamber Scene */}
        <SceneContainer>
          <AnomalyChamberScene />
        </SceneContainer>

        {/* Floating Decision Panel (Right side, matching reference) */}
        <div className="absolute right-6 md:right-12 top-8 z-20 w-80 sm:w-96 space-y-4">
          <GamePanel
            title="Unknown Structure"
            subtitle="Extraterrestrial Precursor Artifact"
            variant="highlight"
            className="border-[#F5A623]/40"
          >
            {/* Scientific Description */}
            <p className="font-mono text-xs text-[#A5B1C2] leading-relaxed mb-6">
              A non-natural structure of unknown origin. Energy signatures detected. Gravitational harmonics shifting within interior aperture.
            </p>

            {/* Decision Action Buttons Stack (Exactly as in screenshot) */}
            <div className="space-y-3 mb-6">
              {/* Option 1: Analyze the structure (Primary amber button) */}
              <button
                type="button"
                onClick={() => handleDecision('analyze')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left font-sans cursor-pointer transition-all ${
                  selectedLocal === 'analyze'
                    ? 'btn-amber-gold shadow-lg font-bold'
                    : 'bg-white/5 border-white/10 text-[#A5B1C2] hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <Scan size={18} className={selectedLocal === 'analyze' ? 'text-[#05070B]' : 'text-[#F5A623]'} />
                <span className={`text-xs uppercase tracking-wider ${selectedLocal === 'analyze' ? 'text-[#05070B] font-bold' : 'text-white'}`}>
                  Analyze the structure
                </span>
              </button>

              {/* Option 2: Collect samples (Secondary pill button) */}
              <button
                type="button"
                onClick={() => handleDecision('sample')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left font-sans cursor-pointer transition-all ${
                  selectedLocal === 'sample'
                    ? 'bg-[#D88A18]/30 border-[#F5A623] text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-[#A5B1C2] hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <FlaskConical size={18} className="text-[#35C6F4]" />
                <span className="font-semibold text-xs uppercase tracking-wider text-white">
                  Collect samples
                </span>
              </button>

              {/* Option 3: Report and withdraw (Secondary pill button) */}
              <button
                type="button"
                onClick={() => handleDecision('withdraw')}
                className={`w-full flex items-center gap-3 p-3.5 rounded-lg border text-left font-sans cursor-pointer transition-all ${
                  selectedLocal === 'withdraw'
                    ? 'bg-[#D88A18]/30 border-[#F5A623] text-white shadow-lg'
                    : 'bg-white/5 border-white/10 text-[#A5B1C2] hover:border-white/25 hover:bg-white/10'
                }`}
              >
                <ShieldAlert size={18} className="text-[#31C48D]" />
                <span className="font-semibold text-xs uppercase tracking-wider text-white">
                  Report and withdraw
                </span>
              </button>
            </div>

            {/* Consequence Feedback Box */}
            <div className="p-3 bg-black/60 rounded-lg border border-white/10 mb-6 space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-[#F5A623] font-bold">
                <CheckCircle2 size={13} />
                <span>{activeConsequence.title}</span>
              </div>
              <p className="text-[#A5B1C2] leading-normal">{activeConsequence.text}</p>
              <div className="text-[#35C6F4] text-[10px] pt-1 border-t border-white/5">
                IMPACT: {activeConsequence.statImpact}
              </div>
            </div>

            {/* Advance to Debrief CTA */}
            <GameButton
              variant="amber"
              size="md"
              fullWidth
              onClick={handleProceedToDebrief}
              icon={<ArrowRight size={15} />}
              iconPosition="right"
              className="h-11 font-bold text-xs tracking-widest shadow-lg"
            >
              PROCEED TO MISSION DEBRIEF
            </GameButton>
          </GamePanel>
        </div>
      </div>
    </div>
  );
};
