import { createBrowserRouter, Navigate } from 'react-router-dom';
import { MainMenuScreen } from '../features/screens/MainMenuScreen';
import { MissionSelectionScreen } from '../features/screens/MissionSelectionScreen';
import { SpacecraftWorkshopScreen } from '../features/screens/SpacecraftWorkshopScreen';
import { TrajectoryPlannerScreen } from '../features/screens/TrajectoryPlannerScreen';
import { MissionOperationsScreen } from '../features/screens/MissionOperationsScreen';
import { MissionDecisionScreen } from '../features/screens/MissionDecisionScreen';
import { CampaignOverviewScreen } from '../features/screens/campaign/CampaignOverviewScreen';
import { SurfaceExplorationScreen } from '../features/screens/SurfaceExplorationScreen';
import { AnomalyDetectedScreen } from '../features/screens/AnomalyDetectedScreen';
import { MissionDebriefScreen } from '../features/screens/MissionDebriefScreen';
import { CampaignRouteGuard } from './CampaignRouteGuard';
import { RootTutorialLayout } from './RootTutorialLayout';

export const router = createBrowserRouter([
  {
    element: <RootTutorialLayout />,
    children: [
      {
        path: '/',
        element: <MainMenuScreen />,
      },
      {
        path: '/missions',
        element: (
          <CampaignRouteGuard>
            <MissionSelectionScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/workshop',
        element: (
          <CampaignRouteGuard>
            <SpacecraftWorkshopScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/trajectory',
        element: (
          <CampaignRouteGuard>
            <TrajectoryPlannerScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/operations',
        element: (
          <CampaignRouteGuard>
            <MissionOperationsScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/decisions',
        element: (
          <CampaignRouteGuard>
            <MissionDecisionScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/campaign',
        element: <CampaignOverviewScreen />,
      },
      {
        path: '/surface',
        element: (
          <CampaignRouteGuard>
            <SurfaceExplorationScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/anomaly',
        element: (
          <CampaignRouteGuard>
            <AnomalyDetectedScreen />
          </CampaignRouteGuard>
        ),
      },
      {
        path: '/debrief',
        element: (
          <CampaignRouteGuard>
            <MissionDebriefScreen />
          </CampaignRouteGuard>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
