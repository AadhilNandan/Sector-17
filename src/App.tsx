import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ExpeditionProvider } from './context/ExpeditionContext';
import { SimulationProvider } from './runtime';

export const App: React.FC = () => {
  return (
    <SimulationProvider campaignId="EXPEDITION-V" config={{ initialState: 'INITIALIZED', autoPersistCampaign: true }}>
      <ExpeditionProvider>
        <RouterProvider router={router} />
      </ExpeditionProvider>
    </SimulationProvider>
  );
};

export default App;
