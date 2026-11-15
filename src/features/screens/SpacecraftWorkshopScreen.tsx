import React, { useState, useContext, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationContext } from '../../runtime/SimulationContext';
import { useExpedition } from '../../context/ExpeditionContext';
import {
  calculateSpacecraftMetrics,
  evaluateSpacecraftConfiguration,
} from '../../simulation/engineering/spacecraftConfiguration';
import type { ComponentCategory, SpacecraftPart, LaunchVehicle } from '../../types/game';
import { WorkshopHeader } from '../spacecraft-workshop/components/WorkshopHeader';
import { MaturityStrip } from '../spacecraft-workshop/components/MaturityStrip';
import { ComponentCataloguePanel } from '../spacecraft-workshop/components/ComponentCataloguePanel';
import { Workshop3DCanvas, type WorkshopCameraPreset } from '../spacecraft-workshop/components/Workshop3DCanvas';
import { ResourceBudgetsPanel } from '../spacecraft-workshop/components/ResourceBudgetsPanel';
import { WorkshopFooter } from '../spacecraft-workshop/components/WorkshopFooter';
import { ConfigurationComparisonModal } from '../spacecraft-workshop/components/ConfigurationComparisonModal';
import { sounds } from '../../utils/soundEffects';

export const SpacecraftWorkshopScreen: React.FC = () => {
  const navigate = useNavigate();
  const runtime = useContext(SimulationContext);

  const [cameraPreset, setCameraPreset] = useState<WorkshopCameraPreset>('3/4');
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    spacecraft,
    selectedCategory,
    setSelectedCategory,
    selectPart,
    selectLaunchVehicle,
  } = useExpedition();

  // Authoritative calculations from the simulation engineering model
  const liveMetrics = useMemo(() => {
    if (runtime && typeof runtime.getSpacecraftMetrics === 'function') {
      try {
        return runtime.getSpacecraftMetrics();
      } catch {
        // Fallback to calculation
      }
    }
    return calculateSpacecraftMetrics(spacecraft);
  }, [runtime, spacecraft]);

  const validationReport = useMemo(() => {
    if (runtime && typeof runtime.getValidationReport === 'function') {
      try {
        const existing = runtime.getValidationReport();
        if (existing) return existing;
      } catch {
        // Fallback
      }
    }
    return evaluateSpacecraftConfiguration(spacecraft);
  }, [runtime, spacecraft]);

  const activeSelectedPart = spacecraft.parts[selectedCategory];

  const handleSelectPart = (cat: ComponentCategory, part: SpacecraftPart) => {
    sounds.playClick(1200);
    selectPart(cat, part);
    setValidationError(null);
  };

  const handleSelectVehicle = (vehicle: LaunchVehicle) => {
    sounds.playClick(1000);
    selectLaunchVehicle(vehicle);
    setValidationError(null);
  };

  const handleCategoryChange = (cat: ComponentCategory) => {
    sounds.playHover();
    setSelectedCategory(cat);
  };

  const isValidToProceed =
    validationReport.overallStatus === 'PASS' || validationReport.overallStatus === 'WARNING';

  const handleValidateAndLock = useCallback(() => {
    if (runtime && typeof runtime.validateSpacecraftArchitecture === 'function') {
      try {
        runtime.validateSpacecraftArchitecture();
      } catch {
        // Fallback
      }
    }

    if (!isValidToProceed) {
      const msg =
        validationReport.failures?.[0] ||
        validationReport.missingData?.[0] ||
        'Spacecraft configuration constraint violated.';
      setValidationError(msg);
      sounds.playClick(800);
      return;
    }

    setValidationError(null);

    // Advance campaign stage if currently at SPACECRAFT_DESIGN
    if (runtime) {
      const manager = runtime.getCampaignManager();
      if (manager.getCurrentStageId() === 'SPACECRAFT_DESIGN') {
        try {
          manager.advanceToStage('ENGINEERING_VALIDATION');
        } catch (err) {
          console.warn('Failed to advance to ENGINEERING_VALIDATION:', err);
        }
      }
    }

    navigate('/trajectory');
  }, [isValidToProceed, validationReport, runtime, navigate]);

  const handleReturn = () => {
    navigate('/missions');
  };

  // Status text for footer bar
  const footerStatusText = useMemo(() => {
    if (validationReport.overallStatus === 'FAIL') {
      return `CONFIGURATION VIOLATION // ${validationReport.failures?.[0] || 'CRITICAL CONSTRAINTS EXCEEDED'}`;
    }
    if (validationReport.overallStatus === 'INCOMPLETE') {
      return `CONFIGURATION INCOMPLETE // ${validationReport.missingData?.[0] || 'MISSING REQUIRED SUBSYSTEM'}`;
    }
    if (validationReport.overallStatus === 'WARNING') {
      const count = validationReport.warnings?.length || 1;
      return `CONFIGURATION PASSES CRITICAL CHECKS // ${count} ACTIVE WARNING (POWER)`;
    }
    return 'CONFIGURATION NOMINAL // ALL CRITICAL CONSTRAINTS SATISFIED';
  }, [validationReport]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#07090C] text-[#E6E2D6] flex flex-col font-sans select-none">
      {/* 1. Warm Light Ivory Engineering Header */}
      <WorkshopHeader onReturn={handleReturn} countdownMET="12:44:02:18" />

      {/* 2. Readiness Maturity Strip */}
      <MaturityStrip currentStage="point-design" />

      {/* 3. Three-Column Engineering Bay Layout */}
      <div className="relative flex-1 w-full flex flex-col lg:flex-row overflow-hidden" data-tutorial-id="panel-workshop-bay">
        {/* Left Column: Component Catalogue // Discipline Filter (~25%) */}
        <ComponentCataloguePanel
          spacecraft={spacecraft}
          selectedCategory={selectedCategory}
          onSelectCategory={handleCategoryChange}
          onSelectPart={handleSelectPart}
        />

        {/* Centre Column: Interactive 3D AETHON Viewport (~48%) */}
        <main className="flex-1 h-full relative overflow-hidden bg-[#07090C] flex flex-col border-r border-[#2B3642]">
          {/* Viewport Camera Preset Selector */}
          <div className="absolute top-3 left-4 z-20 flex items-center gap-1.5 p-1 bg-[#0D1116]/90 border border-[#2B3642] rounded-xs font-mono text-[10px]" data-tutorial-id="bar-camera-presets">
            {(['3/4', 'front', 'side', 'rear'] as WorkshopCameraPreset[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  sounds.playClick(1000);
                  setCameraPreset(mode);
                }}
                className={`px-2 py-0.5 rounded-xs transition-colors cursor-pointer uppercase ${
                  cameraPreset === mode
                    ? 'bg-[#1C242D] text-[#7FB7D4] border border-[#7FB7D4] font-bold'
                    : 'text-[#A9B0B5] hover:text-[#FFFFFF] border border-transparent'
                }`}
              >
                {mode === '3/4' ? '3/4 ISO' : mode}
              </button>
            ))}
          </div>

          {/* Real 3D Canvas */}
          <div className="relative flex-1 w-full h-full overflow-hidden">
            <Workshop3DCanvas
              spacecraft={spacecraft}
              selectedCategory={selectedCategory}
              cameraPreset={cameraPreset}
              onCameraPresetChange={setCameraPreset}
              activePartName={activeSelectedPart?.name || 'IPR-3'}
            />
          </div>

          {/* Validation Alert Notification if Authorization Blocked */}
          {validationError && (
            <div className="absolute top-12 left-4 right-4 z-30 p-2.5 rounded-xs bg-[#1C242D] border border-[#D8503F] text-[#D8503F] text-xs font-mono shadow-lg flex items-center justify-between">
              <div>
                <strong className="block">AUTHORIZATION BLOCKED:</strong>
                <span>{validationError}</span>
              </div>
              <button
                type="button"
                onClick={() => setValidationError(null)}
                className="text-[#E6E2D6] px-2 py-0.5 hover:bg-white/10 rounded-xs cursor-pointer"
              >
                DISMISS
              </button>
            </div>
          )}
        </main>

        {/* Right Column: Resource Budgets & Constraint Checker (~27%) */}
        <ResourceBudgetsPanel
          spacecraft={spacecraft}
          liveMetrics={liveMetrics}
          validationReport={validationReport}
          onSelectLaunchVehicle={handleSelectVehicle}
        />
      </div>

      {/* 4. Bottom Action Bar */}
      <WorkshopFooter
        onShowComparison={() => setComparisonOpen(true)}
        onValidateAndLock={handleValidateAndLock}
        isValidToProceed={isValidToProceed}
        statusText={footerStatusText}
      />

      {/* 5. Previous vs. Current Diff Comparison Modal */}
      <ConfigurationComparisonModal
        isOpen={comparisonOpen}
        onClose={() => setComparisonOpen(false)}
        currentSpacecraft={spacecraft}
      />
    </div>
  );
};
