import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCampaign } from '../runtime/SimulationContext';

export interface CampaignRouteGuardProps {
  children: React.ReactNode;
  canAccessRoute?: (pathname: string) => { allowed: boolean; reason?: string };
}

/**
 * Route guard component protecting stage-gated routes (/surface, /anomaly, /debrief).
 * Checks CampaignManager.canAccessRoute(location.pathname) and redirects to /campaign
 * if current campaign stage prerequisites are not satisfied.
 */
export const CampaignRouteGuard: React.FC<CampaignRouteGuardProps> = ({
  children,
  canAccessRoute: overrideCanAccess,
}) => {
  const location = useLocation();
  let accessCheck = overrideCanAccess;

  if (!accessCheck) {
    try {
      const campaign = useCampaign();
      accessCheck = (route) => campaign.canAccessRoute(route);
    } catch {
      // Fallback if rendered outside SimulationProvider
      accessCheck = () => ({ allowed: true });
    }
  }

  const access = accessCheck(location.pathname);

  if (!access.allowed) {
    return (
      <Navigate
        to="/campaign"
        replace
        state={{
          lockedRoute: location.pathname,
          lockReason: access.reason ?? 'Route is locked by current campaign stage prerequisites.',
        }}
      />
    );
  }

  return <>{children}</>;
};
