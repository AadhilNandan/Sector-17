/**
 * SECTOR 17 — Root Tutorial Layout
 * Phase 9.1.3 Production Implementation
 *
 * Ambient root layout route inside React Router context.
 * Mounts TutorialProvider, Outlet, TutorialOverlay, TutorialHUDButton, and MissionHandbookModal.
 * Guarantees zero layout shift and non-blocking ambient interaction.
 */

import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TutorialProvider } from '../features/tutorial/context/TutorialContext';
import { TutorialOverlay } from '../features/tutorial/components/TutorialOverlay';
import { TutorialHUDButton } from '../features/tutorial/components/TutorialHUDButton';
import { MissionHandbookModal } from '../features/tutorial/components/handbook/MissionHandbookModal';

export const RootTutorialLayout: React.FC = () => {
  const location = useLocation();

  return (
    <TutorialProvider currentRoute={location.pathname}>
      <Outlet />
      <TutorialOverlay />
      <TutorialHUDButton />
      <MissionHandbookModal />
    </TutorialProvider>
  );
};
