import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationContext } from '../../runtime/SimulationContext';
import { SettingsModal } from '../main-menu/components/SettingsModal';
import { CreditsModal } from '../main-menu/components/CreditsModal';
import { sounds } from '../../utils/soundEffects';
import { Volume2, VolumeX } from 'lucide-react';

type MenuItemId = 'continue' | 'new-expedition' | 'settings' | 'credits';

export const MainMenuScreen: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useContext(SimulationContext);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [muted, setMuted] = useState(sounds.getMuted());
  const [selectedItem, setSelectedItem] = useState<MenuItemId>('new-expedition');
  const [hasSave, setHasSave] = useState(false);

  // Check if a saved campaign exists to enable/disable "Continue"
  useEffect(() => {
    let saveFound = false;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith('sector17_campaign_save_')) {
            saveFound = true;
            break;
          }
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    if (!saveFound && runtime) {
      const snapshot = runtime.getSnapshot();
      if (snapshot.campaign && snapshot.campaign.currentStageId !== 'CAMPAIGN_INTRO') {
        saveFound = true;
      }
    }

    setHasSave(saveFound);
  }, [runtime]);

  const handleToggleSound = useCallback(() => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    sounds.setMuted(nextMuted);
    if (!nextMuted) {
      sounds.playClick();
    }
  }, [muted]);

  const handleContinue = useCallback(async () => {
    if (!hasSave) return;
    sounds.playClick();

    if (runtime) {
      try {
        const manager = runtime.getCampaignManager();
        await manager.load();
        const route = manager.getCurrentStageConfig().associatedRoute || '/operations';
        navigate(route);
        return;
      } catch (err) {
        console.warn('Failed to load campaign save:', err);
      }
    }
    navigate('/operations');
  }, [hasSave, runtime, navigate]);

  const handleNewExpedition = useCallback(() => {
    sounds.playClick();
    if (runtime && typeof runtime.acknowledgeBriefing === 'function') {
      try {
        runtime.acknowledgeBriefing();
      } catch (err) {
        console.warn('Briefing acknowledgement error:', err);
      }
    }
    navigate('/missions');
  }, [runtime, navigate]);

  const handleOpenSettings = useCallback(() => {
    sounds.playClick();
    setSettingsOpen(true);
  }, []);

  const handleOpenCredits = useCallback(() => {
    sounds.playClick();
    setCreditsOpen(true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (settingsOpen || creditsOpen) {
        if (e.key === 'Escape') {
          setSettingsOpen(false);
          setCreditsOpen(false);
          sounds.playClick();
        }
        return;
      }

      const activeItems: MenuItemId[] = hasSave
        ? ['continue', 'new-expedition', 'settings', 'credits']
        : ['new-expedition', 'settings', 'credits'];

      const currentIndex = activeItems.indexOf(selectedItem);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        sounds.playHover();
        const nextIndex = (currentIndex + 1) % activeItems.length;
        setSelectedItem(activeItems[nextIndex]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        sounds.playHover();
        const prevIndex = (currentIndex - 1 + activeItems.length) % activeItems.length;
        setSelectedItem(activeItems[prevIndex]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedItem === 'continue') handleContinue();
        else if (selectedItem === 'new-expedition') handleNewExpedition();
        else if (selectedItem === 'settings') handleOpenSettings();
        else if (selectedItem === 'credits') handleOpenCredits();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    settingsOpen,
    creditsOpen,
    selectedItem,
    hasSave,
    handleContinue,
    handleNewExpedition,
    handleOpenSettings,
    handleOpenCredits,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#040609] select-none text-[#E6E2D6]">
      {/* 1. Official Cinematic Hero Background (AETHON against Jupiter) */}
      <div
        className="absolute inset-0 w-full h-full overflow-hidden bg-[#040609] select-none"
        data-testid="main-menu-hero-bg"
      >
        <img
          src="/assets/images/main_menu_hero.png"
          alt="AETHON Spacecraft in Jupiter Orbit"
          className="w-full h-full object-cover object-center pointer-events-none"
        />
      </div>

      {/* 2. Technical HUD Frame & Reticle Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 p-6 md:p-8 flex flex-col justify-between">
        {/* Top Edge HUD */}
        <div className="flex items-start justify-between">
          {/* Top-Left Corner Reticle Mark */}
          <div className="flex flex-col gap-1.5">
            <div className="w-4 h-2 border-t border-l border-[#7FB7D4]/40" />
          </div>

          {/* Top Border Center Reticle */}
          <div className="hidden sm:block font-mono text-[#7FB7D4]/30 text-xs">┬</div>

          {/* Top-Right Sound Toggle */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleSound}
              className="pointer-events-auto p-1.5 rounded bg-white/5 hover:bg-white/10 text-[#A9B0B5] hover:text-white transition-colors cursor-pointer border border-[#2B3642]/60"
              title="Toggle Sound"
            >
              {muted ? <VolumeX size={14} className="text-[#D8503F]" /> : <Volume2 size={14} className="text-[#7FB7D4]" />}
            </button>
          </div>
        </div>

        {/* Center Edge Reticles */}
        <div className="flex items-center justify-between text-[#7FB7D4]/25 font-mono text-sm">
          <span>├</span>
          <span>┤</span>
        </div>

        {/* Bottom Edge HUD */}
        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            {/* Bottom-Left Reticle Placeholder */}
            <div className="w-24">
              <div className="w-4 h-2 border-b border-l border-[#7FB7D4]/40" />
            </div>

            {/* Bottom-Center Caliper Pitch & Azimuth Scale */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-[10px] text-[#7FB7D4]/80 font-mono">▽</div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-[#6B757D]/70 tracking-widest">
                <span>. . .</span>
                <span className="text-[#7FB7D4]/80">|</span>
                <span>. . .</span>
                <span className="text-[#E6E2D6] font-bold">|</span>
                <span>. . .</span>
                <span className="text-[#7FB7D4]/80">|</span>
                <span>. . .</span>
              </div>
            </div>

            {/* Bottom-Right Legal Disclaimer */}
            <div className="flex flex-col items-end gap-1">
              <div className="font-sans text-[10px] text-[#6B757D] max-w-[340px] text-right leading-tight">
                SECTOR 17 is an independent project. NASA does not endorse SECTOR 17.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Left-Aligned Brand Block & Minimal Vertical Navigation */}
      <div className="relative z-20 flex flex-col justify-center h-full px-8 md:px-16 lg:px-20 max-w-xl">
        {/* Title Block */}
        <div className="space-y-1.5 mb-10" data-tutorial-id="header-directive">
          <h1 className="font-display text-6xl md:text-7xl lg:text-8xl font-bold tracking-[0.04em] text-[#E6E2D6] uppercase leading-none drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
            SECTOR 17
          </h1>
          <h2 className="font-display text-xl md:text-2xl lg:text-3xl tracking-[0.18em] text-[#E6E2D6] font-semibold uppercase">
            THE LAST EXPEDITION
          </h2>
          <p className="font-mono text-[11px] md:text-xs tracking-[0.24em] text-[#7FB7D4]/90 uppercase pt-1">
            MISSION EXPEDITION-V (EUROPA SURVEY)
          </p>
        </div>

        {/* Minimal Vertical Text Navigation */}
        <nav className="flex flex-col items-start gap-4" aria-label="Main Navigation">
          {/* Continue (Disabled if no campaign save exists) */}
          <button
            type="button"
            disabled={!hasSave}
            onClick={handleContinue}
            onMouseEnter={() => {
              if (hasSave) {
                setSelectedItem('continue');
                sounds.playHover();
              }
            }}
            className={`font-display text-2xl md:text-3xl tracking-[0.08em] transition-all duration-150 text-left outline-none cursor-pointer ${
              !hasSave
                ? 'text-[#3E4756] cursor-not-allowed opacity-60'
                : selectedItem === 'continue'
                  ? 'text-[#FFFFFF]'
                  : 'text-[#A9B0B5] hover:text-[#E6E2D6]'
            }`}
          >
            {selectedItem === 'continue' && hasSave ? (
              <span className="relative inline-flex items-center px-3.5 py-1">
                {/* Cyan corner brackets */}
                <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
                Continue
              </span>
            ) : (
              <span className="px-3.5 py-1">Continue</span>
            )}
          </button>

          {/* New Expedition (Active / Selected by default) */}
          <button
            type="button"
            data-tutorial-id="btn-new-expedition"
            onClick={handleNewExpedition}
            onMouseEnter={() => {
              setSelectedItem('new-expedition');
              sounds.playHover();
            }}
            className={`font-display text-2xl md:text-3xl tracking-[0.08em] transition-all duration-150 text-left outline-none cursor-pointer ${
              selectedItem === 'new-expedition'
                ? 'text-[#FFFFFF]'
                : 'text-[#A9B0B5] hover:text-[#E6E2D6]'
            }`}
          >
            {selectedItem === 'new-expedition' ? (
              <span className="relative inline-flex items-center px-3.5 py-1">
                {/* Cyan corner brackets */}
                <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
                New Expedition
              </span>
            ) : (
              <span className="px-3.5 py-1">New Expedition</span>
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={handleOpenSettings}
            onMouseEnter={() => {
              setSelectedItem('settings');
              sounds.playHover();
            }}
            className={`font-display text-2xl md:text-3xl tracking-[0.08em] transition-all duration-150 text-left outline-none cursor-pointer ${
              selectedItem === 'settings'
                ? 'text-[#FFFFFF]'
                : 'text-[#A9B0B5] hover:text-[#E6E2D6]'
            }`}
          >
            {selectedItem === 'settings' ? (
              <span className="relative inline-flex items-center px-3.5 py-1">
                <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
                Settings
              </span>
            ) : (
              <span className="px-3.5 py-1">Settings</span>
            )}
          </button>

          {/* Credits */}
          <button
            type="button"
            onClick={handleOpenCredits}
            onMouseEnter={() => {
              setSelectedItem('credits');
              sounds.playHover();
            }}
            className={`font-display text-2xl md:text-3xl tracking-[0.08em] transition-all duration-150 text-left outline-none cursor-pointer ${
              selectedItem === 'credits'
                ? 'text-[#FFFFFF]'
                : 'text-[#A9B0B5] hover:text-[#E6E2D6]'
            }`}
          >
            {selectedItem === 'credits' ? (
              <span className="relative inline-flex items-center px-3.5 py-1">
                <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#7FB7D4]" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#7FB7D4]" />
                Credits
              </span>
            ) : (
              <span className="px-3.5 py-1">Credits</span>
            )}
          </button>
        </nav>
      </div>

      {/* 4. Configuration & Credits Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        muted={muted}
        onToggleMute={handleToggleSound}
      />

      <CreditsModal
        isOpen={creditsOpen}
        onClose={() => setCreditsOpen(false)}
      />
    </div>
  );
};
