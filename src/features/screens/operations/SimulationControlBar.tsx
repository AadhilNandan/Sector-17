/**
 * SECTOR 17 — Simulation Control Bar
 * Authoritative controls for deterministic simulation execution,
 * pause/resume, discrete SI stepping (+1s, +10s, +60s), and error containment.
 */

import React, { useState } from 'react';
import { Play, Pause, FastForward, AlertCircle, Clock, ShieldAlert } from 'lucide-react';
import { useSimulationRuntime, useSimulationSnapshot, useSimulationTime } from '../../../runtime';
import { sounds } from '../../../utils/soundEffects';

export const SimulationControlBar: React.FC = () => {
  const runtime = useSimulationRuntime();
  const snap = useSimulationSnapshot();
  const { isRunning, isPaused, start, pause, resume, clearError } = useSimulationTime();
  const [stepping, setStepping] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDismissError = () => {
    setLocalError(null);
    clearError();
  };

  const handleStart = () => {
    sounds.playClick(1000);
    setLocalError(null);
    start({ tickIntervalMs: 1000, stepSizeSeconds: 1 });
  };

  const handlePause = () => {
    sounds.playClick(800);
    pause();
  };

  const handleResume = () => {
    sounds.playClick(1000);
    setLocalError(null);
    resume();
  };

  const handleAdvance = async (seconds: number) => {
    if (isPaused || stepping) return;
    setStepping(true);
    setLocalError(null);
    sounds.playClick(1400);

    try {
      await runtime.advanceTime(seconds);
    } catch (err: any) {
      setLocalError(err?.message ?? String(err));
    } finally {
      setStepping(false);
    }
  };

  const activeError = localError || snap.error;

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Control Bar Container */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-[#080D16]/90 backdrop-blur-md border border-white/10 shadow-2xl">
        {/* Left: Lifecycle & Flight State Status */}
        <div className="flex items-center gap-3">
          {/* Clock & MET Display */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 border border-white/10 font-mono text-xs">
            <Clock size={13} className="text-[#35C6F4]" />
            <span className="text-[#A5B1C2] tracking-wider uppercase text-[10px]">MET</span>
            <span className="text-[#35C6F4] font-bold tracking-widest">{snap.formattedMET}</span>
          </div>

          {/* Flight State Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider font-semibold border ${
              snap.flightState === 'ACTIVE'
                ? 'bg-[#31C48D]/15 text-[#31C48D] border-[#31C48D]/30'
                : snap.flightState === 'SAFE_MODE' || snap.flightState === 'PRELAUNCH_HOLD'
                ? 'bg-[#EF6464]/15 text-[#EF6464] border-[#EF6464]/30'
                : 'bg-[#F5A623]/15 text-[#F5A623] border-[#F5A623]/30'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                snap.flightState === 'ACTIVE'
                  ? 'bg-[#31C48D] shadow-[0_0_6px_rgba(49,196,141,0.8)]'
                  : 'bg-[#EF6464] shadow-[0_0_6px_rgba(239,100,100,0.8)]'
              }`}
            />
            <span>{snap.flightState}</span>
          </div>

          {/* Runtime Lifecycle Pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-[#A5B1C2] uppercase">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isRunning
                  ? 'bg-[#31C48D] animate-pulse'
                  : isPaused
                  ? 'bg-[#F5A623]'
                  : 'bg-[#35C6F4]'
              }`}
            />
            <span>{snap.lifecycle}</span>
          </div>

          {/* Critical Fault Indicator */}
          {snap.faults.criticalCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#EF6464]/20 border border-[#EF6464]/40 text-[#EF6464] font-mono text-[10px] animate-pulse">
              <ShieldAlert size={12} />
              <span>{snap.faults.criticalCount} CRITICAL FAULT</span>
            </div>
          )}
        </div>

        {/* Right: Functional Control Buttons */}
        <div className="flex items-center gap-2">
          {/* Play / Resume */}
          {isPaused ? (
            <button
              type="button"
              onClick={handleResume}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#31C48D]/20 hover:bg-[#31C48D]/30 border border-[#31C48D]/40 text-[#31C48D] text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
              title="Resume automatic simulation progression"
            >
              <Play size={13} fill="currentColor" />
              <span>Resume</span>
            </button>
          ) : isRunning ? (
            <button
              type="button"
              onClick={handlePause}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5A623]/20 hover:bg-[#F5A623]/30 border border-[#F5A623]/40 text-[#F5A623] text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
              title="Pause simulation progression"
            >
              <Pause size={13} fill="currentColor" />
              <span>Pause</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#35C6F4]/20 hover:bg-[#35C6F4]/30 border border-[#35C6F4]/40 text-[#35C6F4] text-xs font-mono font-bold tracking-wider uppercase transition-all cursor-pointer shadow-md"
              title="Start simulation ticker"
            >
              <Play size={13} fill="currentColor" />
              <span>Start</span>
            </button>
          )}

          {/* Manual Step Advancement Controls */}
          <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5">
            <button
              type="button"
              onClick={() => handleAdvance(1)}
              disabled={isPaused || stepping}
              className="px-2 py-1 text-[11px] font-mono font-semibold rounded hover:bg-white/10 text-[#F1F5FA] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Advance 1 SI second"
            >
              +1s
            </button>
            <div className="w-[1px] h-3.5 bg-white/10" />
            <button
              type="button"
              onClick={() => handleAdvance(10)}
              disabled={isPaused || stepping}
              className="px-2 py-1 text-[11px] font-mono font-semibold rounded hover:bg-white/10 text-[#F1F5FA] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Advance 10 SI seconds"
            >
              +10s
            </button>
            <div className="w-[1px] h-3.5 bg-white/10" />
            <button
              type="button"
              onClick={() => handleAdvance(60)}
              disabled={isPaused || stepping}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold rounded hover:bg-white/10 text-[#35C6F4] disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Advance 60 SI seconds (1 minute)"
            >
              <FastForward size={11} />
              <span>+60s</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Alert Banner */}
      {activeError && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#EF6464]/15 border border-[#EF6464]/30 text-[#EF6464] font-mono text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{activeError}</span>
          </div>
          <button
            type="button"
            onClick={handleDismissError}
            className="text-[10px] underline uppercase tracking-wider hover:text-white cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};
