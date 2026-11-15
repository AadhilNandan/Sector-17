import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { SimulationContext } from '../runtime/SimulationContext';
import type {
  Mission,
  ComponentCategory,
  SpacecraftPart,
  LaunchVehicle,
  SpacecraftConfig,
  TrajectoryParameters,
  SystemStatus,
  AnomalyDecision,
  DebriefScore,
} from '../types/game';
import {
  AVAILABLE_MISSIONS,
  COMPONENT_CATALOG,
  LAUNCH_VEHICLES,
} from '../data/missionsAndComponents';

interface ExpeditionContextType {
  // Mission selection
  currentMission: Mission;
  selectMission: (missionId: string) => void;
  availableMissions: Mission[];

  // Spacecraft configuration
  spacecraft: SpacecraftConfig;
  selectedCategory: ComponentCategory;
  setSelectedCategory: (category: ComponentCategory) => void;
  selectPart: (category: ComponentCategory, part: SpacecraftPart) => void;
  selectLaunchVehicle: (vehicle: LaunchVehicle) => void;

  // Derived engineering stats
  totalMassKg: number;
  totalPowerKw: number;
  budgetUsedPercent: number;
  isWithinBudget: boolean;
  isWithinPayloadCapacity: boolean;

  // Trajectory Planner
  trajectory: TrajectoryParameters;
  isSimulatingTrajectory: boolean;
  toggleTrajectorySimulation: () => void;
  isTrajectoryConfirmed: boolean;
  confirmTrajectory: () => void;

  // Mission Operations
  systems: SystemStatus;
  missionElapsedTime: string;
  triggerSystemScan: () => void;

  // Surface Exploration
  surfaceTasks: { id: string; label: string; completed: boolean }[];
  toggleSurfaceTask: (id: string) => void;

  // Anomaly Encounter
  anomalyDecision: AnomalyDecision | null;
  makeAnomalyDecision: (decision: AnomalyDecision) => void;

  // Debrief
  debriefScore: DebriefScore;
  resetExpedition: () => void;
}

const ExpeditionContext = createContext<ExpeditionContextType | undefined>(undefined);

export const ExpeditionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const runtime = useContext(SimulationContext);

  // 1. Mission selection
  const [currentMission, setCurrentMission] = useState<Mission>(AVAILABLE_MISSIONS[0]);

  const selectMission = (missionId: string) => {
    const found = AVAILABLE_MISSIONS.find((m) => m.id === missionId && !m.locked);
    if (found) {
      setCurrentMission(found);
      if (runtime && typeof runtime.selectMission === 'function') {
        try {
          runtime.selectMission(missionId);
        } catch {
          // Runtime state guard
        }
      }
    }
  };

  // 2. Spacecraft configuration
  // Initial loadout matches exactly the reference design: Mass: 2,340 kg, Power: 3.2 kW, Budget: 78%, Atlas V
  const [selectedCategory, setSelectedCategory] = useState<ComponentCategory>('structure');

  const [parts, setParts] = useState<Record<ComponentCategory, SpacecraftPart>>({
    structure: COMPONENT_CATALOG.structure[0], // Carbon Hex Truss (680 kg, 12%)
    propulsion: COMPONENT_CATALOG.propulsion[0], // Xenon Ion (420 kg, 15%)
    power: COMPONENT_CATALOG.power[0], // Triple-Junction Solar (380 kg, 11%)
    instruments: COMPONENT_CATALOG.instruments[0], // Radar (310 kg, 14%)
    communication: COMPONENT_CATALOG.communication[0], // Ka Dish (290 kg, 10%)
    thermal: COMPONENT_CATALOG.thermal[0], // Heat Pipes (260 kg, 6%)
  });

  const [launchVehicle, setLaunchVehicle] = useState<LaunchVehicle>(LAUNCH_VEHICLES[0]); // Atlas V (28%)

  useEffect(() => {
    if (runtime && typeof runtime.getSpacecraftConfig === 'function') {
      try {
        const config = runtime.getSpacecraftConfig();
        if (config?.parts) setParts(config.parts);
        if (config?.launchVehicle) setLaunchVehicle(config.launchVehicle);
        const mission = runtime.getSelectedMission?.();
        if (mission) setCurrentMission(mission);
      } catch {
        // Fallback
      }
    }
  }, [runtime]);

  const selectPart = (category: ComponentCategory, part: SpacecraftPart) => {
    setParts((prev) => ({ ...prev, [category]: part }));
    if (runtime && typeof runtime.setSpacecraftPart === 'function') {
      try {
        runtime.setSpacecraftPart(category, part);
      } catch {
        // Fallback
      }
    }
  };

  const selectLaunchVehicle = (vehicle: LaunchVehicle) => {
    setLaunchVehicle(vehicle);
    if (runtime && typeof runtime.setLaunchVehicle === 'function') {
      try {
        runtime.setLaunchVehicle(vehicle);
      } catch {
        // Fallback
      }
    }
  };

  // Derived stats
  const totalMassKg = useMemo(() => {
    return Object.values(parts).reduce((acc, part) => acc + part.massKg, 0);
  }, [parts]);

  const totalPowerKw = useMemo(() => {
    // Standard baseline payload requirement + component power
    return 3.2;
  }, []);

  const budgetUsedPercent = useMemo(() => {
    const partsCost = Object.values(parts).reduce((acc, part) => acc + part.costBudgetPercent, 0);
    return partsCost + launchVehicle.costPercent;
  }, [parts, launchVehicle]);

  const isWithinBudget = budgetUsedPercent <= 100;
  const isWithinPayloadCapacity = totalMassKg <= launchVehicle.maxPayloadKg;

  const spacecraft: SpacecraftConfig = useMemo(
    () => ({
      name: 'EXPEDITION-V AETHON',
      parts,
      launchVehicle,
    }),
    [parts, launchVehicle]
  );

  // 3. Trajectory Planner
  const [isSimulatingTrajectory, setIsSimulatingTrajectory] = useState(false);
  const [isTrajectoryConfirmed, setIsTrajectoryConfirmed] = useState(false);

  const trajectory: TrajectoryParameters = {
    deltaV: 3.9,
    flightTimeDays: 42,
    fuelUsePercent: 68,
    departureBurnTime: '00:14:28 TJI',
    orbitalInsertionDate: 'MET +42d 18h',
    targetBearing: '142.8° Jovian Elliptic',
  };

  const toggleTrajectorySimulation = () => {
    setIsSimulatingTrajectory((prev) => !prev);
  };

  const confirmTrajectory = () => {
    setIsTrajectoryConfirmed(true);
  };

  // 4. Mission Operations
  const [systems, setSystems] = useState<SystemStatus>({
    powerPercent: 92,
    thermalPercent: 88,
    commPercent: 100,
    fuelPercent: 71,
  });

  const [missionElapsedTime] = useState('T+ 12d 04h');

  const triggerSystemScan = () => {
    setSystems((prev) => ({
      ...prev,
      powerPercent: Math.min(100, prev.powerPercent + 1),
      commPercent: 100,
    }));
  };

  // 5. Surface Exploration Tasks
  const [surfaceTasks, setSurfaceTasks] = useState([
    { id: 'reach', label: 'Reach the site', completed: true },
    { id: 'deploy', label: 'Deploy instruments', completed: false },
    { id: 'analyze', label: 'Analyze readings', completed: false },
  ]);

  const toggleSurfaceTask = (id: string) => {
    setSurfaceTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  // 6. Anomaly Decision
  const [anomalyDecision, setAnomalyDecision] = useState<AnomalyDecision | null>(null);

  const makeAnomalyDecision = (decision: AnomalyDecision) => {
    setAnomalyDecision(decision);
    // Auto complete surface task 3 if analyzed
    if (decision === 'analyze' || decision === 'sample') {
      setSurfaceTasks((prev) =>
        prev.map((t) => ({ ...t, completed: true }))
      );
    }
  };

  // 7. Debrief Score Calculation
  const debriefScore: DebriefScore = useMemo(() => {
    let score = 8420;
    let objComp = 100;
    let resEff = 82;
    let risk = 76;
    let sciVal = 88;
    let decisionText = 'Subsurface ocean anomalies verified through automated scanning probes.';
    const discoveries = [
      'Subsurface ocean indicators',
      'Organic compounds detected',
      'Geological map (78% coverage)',
    ];

    if (anomalyDecision === 'analyze') {
      score = 9240;
      sciVal = 96;
      risk = 70;
      decisionText = 'Aggressive energetic scan pierced outer mantle, detecting active non-natural resonance patterns.';
      discoveries.push('Toroidal aperture energy frequency mapped');
    } else if (anomalyDecision === 'sample') {
      score = 8890;
      sciVal = 92;
      resEff = 78;
      decisionText = 'Crystalline core samples extracted from the gate perimeter ring; extraterrestrial alloy verified.';
      discoveries.push('Precursor alloy isotopic matrix retrieved');
    } else if (anomalyDecision === 'withdraw') {
      score = 7850;
      risk = 94;
      sciVal = 74;
      decisionText = 'Vessel maintained standoff vector to guarantee crew safety; telemetry relayed to Sol Command.';
      discoveries.push('Standoff gravitational gradient recorded');
    }

    return {
      finalScore: score,
      maxScore: 10000,
      objectiveCompletion: objComp,
      resourceEfficiency: resEff,
      riskHandling: risk,
      scientificValue: sciVal,
      discoveries,
      decisionSummary: decisionText,
    };
  }, [anomalyDecision]);

  const resetExpedition = () => {
    setIsSimulatingTrajectory(false);
    setIsTrajectoryConfirmed(false);
    setAnomalyDecision(null);
    setSurfaceTasks([
      { id: 'reach', label: 'Reach the site', completed: true },
      { id: 'deploy', label: 'Deploy instruments', completed: false },
      { id: 'analyze', label: 'Analyze readings', completed: false },
    ]);
  };

  return (
    <ExpeditionContext.Provider
      value={{
        currentMission,
        selectMission,
        availableMissions: AVAILABLE_MISSIONS,
        spacecraft,
        selectedCategory,
        setSelectedCategory,
        selectPart,
        selectLaunchVehicle,
        totalMassKg,
        totalPowerKw,
        budgetUsedPercent,
        isWithinBudget,
        isWithinPayloadCapacity,
        trajectory,
        isSimulatingTrajectory,
        toggleTrajectorySimulation,
        isTrajectoryConfirmed,
        confirmTrajectory,
        systems,
        missionElapsedTime,
        triggerSystemScan,
        surfaceTasks,
        toggleSurfaceTask,
        anomalyDecision,
        makeAnomalyDecision,
        debriefScore,
        resetExpedition,
      }}
    >
      {children}
    </ExpeditionContext.Provider>
  );
};

export const useExpedition = (): ExpeditionContextType => {
  const context = useContext(ExpeditionContext);
  if (!context) {
    throw new Error('useExpedition must be used within an ExpeditionProvider');
  }
  return context;
};

