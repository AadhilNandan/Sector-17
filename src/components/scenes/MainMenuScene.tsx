import React from 'react';

/**
 * MainMenuScene component wrapper.
 * Displays the official full-screen cinematic hero background (AETHON against Jupiter).
 */
export const MainMenuScene: React.FC = () => {
  return (
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
  );
};
