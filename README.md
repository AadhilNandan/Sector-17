# SECTOR 17 — THE LAST EXPEDITION
## Cinematic 2.5D Space Mission Simulator & Exploration Interface

A cinematic science-fiction space exploration game interface built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS v4**, inspired by NASA Eyes on the Solar System, SpaceX flight interfaces, and NASA JPL interactive applications.

---

## Visual Direction & Aesthetic

- **Atmosphere**: Deep space void (`#05070B`), deep space navy (`#080D16`), and dark metallic panel surfaces (`#101925`).
- **Accents**: Mission amber (`#F5A623`) and warm gold (`#D88A18`) for primary actions; technical cyan (`#35C6F4`) for telemetry and navigation vectors; success green (`#31C48D`) for nominal systems; critical red (`#EF6464`) for alerts.
- **Typography**:
  - **Display**: Space Grotesk (Main title, screen titles, section headings, large numerical highlights)
  - **Interface**: Inter (Navigation, buttons, descriptions, objectives)
  - **Technical**: IBM Plex Mono (Telemetry, coordinates, engineering values, mission timestamps)
- **Restrained Glassmorphism**: High-performance floating panels with `backdrop-filter: blur(20px)`, `rgba(10, 17, 29, 0.78)` surfaces, and subtle white boundary highlights.
- **Genuine NASA Imagery**: Real public-domain scientific imagery from NASA Cassini (Jupiter), NASA Galileo (Europa & Conamara Chaos ice terrain), Apollo 17 (Blue Marble Earth), NASA Cleanroom Bay, and JWST (Carina Nebula).
- **Procedural Sound Engine**: Zero-dependency Web Audio API synthesizer for tactile mechanical clicks, radar sweeps, ion thruster rumbles, anomaly harmonic alarms, and mission debrief fanfares.
- **Modular 3D Readiness**: All scenes are isolated in [`SceneContainer`](src/components/ui/SceneContainer.tsx) viewports with strict aspect preservation, ready for Three.js / React Three Fiber in Phase 2B.

---

## 8 Implemented Game Screens

| Screen | Route | Visual Composition & Interactive Controls |
| :--- | :--- | :--- |
| **1. Main Menu** | `/` | JWST Carina nebula starfield, shadowed gas giant with rings and terminator, expedition astronaut & landed craft; `START EXPEDITION`, `MISSION ARCHIVE`, and `SETTINGS` modal dialogs with audio mute toggle. |
| **2. Mission Selection** | `/missions` | Photographic Cassini Jupiter globe, Galileo Europa with targeting reticle, Jovian moon orbital tracks; mission details panel for *The Europa Survey* (objectives, difficulty, duration) & `PLAN MISSION`. |
| **3. Spacecraft Workshop** | `/workshop` | Cleanroom assembly bay background with gantry crane; vertical category selector (*Structure, Propulsion, Power, Instruments, Comm, Thermal*) updating dynamic stats (Mass: 2,340 kg, Power: 3.2 kW, Budget: 78%) & Launch Vehicle selector (*Atlas V*). |
| **4. Trajectory Planner** | `/trajectory` | 2D Hohmann orbital transfer arc between Earth and Europa with 4 maneuver nodes (TJI, MCC-1, Jovian Flyby, EOI); interactive `Simulate Path` animated probe transit and `Confirm Trajectory` action. |
| **5. Mission Operations** | `/operations` | Deep space cruise with active blue ion thruster plumes against Jupiter & Europa; floating subsystem telemetry (*Power 92%, Thermal 88%, Comm 100%, Fuel 71%*), radar sweep, thruster trim, and descent trigger. |
| **6. Surface Exploration** | `/surface` | Europan glacial ice shelf using Galileo Conamara Chaos imagery, subsurface glowing cyan crevasses, 6-wheeled rover with dual headlight beams, and distant mysterious ring portal; task checklist & `Investigate Anomaly`. |
| **7. Anomaly Detected** | `/anomaly` | Close-up of colossal alien toroidal portal with concentric runic energy rings and glowing singularity core; consequential player choices (*Analyze the structure, Collect samples, Report and withdraw*) with automated alarm audio. |
| **8. Mission Debrief** | `/debrief` | Photographic Europa globe receding as spacecraft departs into orbit; `SUCCESS` status, scientific discoveries checklist, final score breakdown (8,420 / 10,000), archive viewer, `Next Expedition` restart loop, and victory fanfare. |

---

## Quick Screen Navigation

On all operational screens (2–8), use the **EXPEDITION STAGES** jumper in the top header to instantly switch between any of the 8 screens for evaluation.

---

## Development Commands

```bash
# Install dependencies
npm install

# Start Vite dev server with HMR
npm run dev

# Run Vitest test suite (575 passing tests across 47 suites)
npm test

# Run TypeScript compilation & production build
npm run build

# Preview production build locally
npm run preview
```

---

## NASA Space Apps Challenge Submission Overview

### 1. Mission Context: Expedition V — The Europa Survey
**SECTOR 17 — THE LAST EXPEDITION** is a browser-based aerospace mission simulation and exploration game. Players step into the role of Mission Director and Flight Operations Lead for *Expedition V*, guiding the deep-space spacecraft **AETHON** from initial configuration in a cleanroom bay through launch, interplanetary cruise, Jupiter orbital capture, Europa reconnaissance, surface landing, micro-rover traverse, and the investigation of an unexpected precursor anomaly.

### 2. Scientific Modeling vs. Gameplay Abstractions

| Domain | Scientific Aerospace Models | Gameplay Abstractions & Narrative Elements |
| :--- | :--- | :--- |
| **Orbital Mechanics** | Tsiolkovsky Rocket Equation, Vis-Viva equation, Keplerian two-body propagation, continuous delta-V and mass depletion tracking. | Discrete maneuver planning phases (TJI, TCM-1, Jupiter Hill sphere ingress, JOI) with automated guidance execution. |
| **Deep Space Communications** | Friis transmission formula, antenna diameter aperture gain, FSPL, Shannon capacity, DSN ground stations (Goldstone, Madrid, Canberra) with Earth-rotation line-of-sight elevation masks, and relativistic One-Way Light Time ($OWLT = d/c$). | Packetized storage-and-forward telemetry queue with accelerated manual DSN pass trigger for player convenience. |
| **Power & Thermal** | Inverse-square solar irradiance attenuation ($P(r) \propto 1/r^2$, yielding ~3.7% solar flux at Jupiter compared to 1 AU), distance-invariant RTG Plutonium thermoelectric generation, Stefan-Boltzmann radiative equilibrium. | Lumped thermal node equilibrium across spacecraft bus with discrete operating states (NOMINAL, SAFE, DEGRADED). |
| **Science Instruments** | Modeling inspired by NASA Europa Clipper: REASON ice-penetrating radar sounding (dielectric permittivity, subsurface reflector detection) and MASPEX volatile mass spectrometer. | Accelerated Level 0 to Level 2 automated pipeline and anomaly classification. |
| **Europa Surface & Rover** | Cryogenic vacuum regolith physical properties, terrain slope traversal hazards, wheel mechanical wear, and ionizing radiation accumulation. | 2D discrete orthogonal/diagonal grid kinematics and stylized 2.5D visual scenes. |
| **Precursor Anomaly** | Real-world telemetry constraints, sensor payload handling, and systematic risk management decisions. | **Fictional narrative construct**: The *Relic-Omega Torus Singularity* represents an unknown extraterrestrial precursor artifact, driving player decisions and multi-ending campaign outcomes. |

### 3. Architecture & Technologies
- **Front-End & UI**: React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React icons.
- **Simulation Engine**: Client-side authoritative runtime (`SimulationRuntime`) coordinating flight computer, navigation manager, surface manager, communications manager, and mission decision engine.
- **Sound Design**: Procedural Web Audio API synthesizer generating real-time telemetry beeps, engine rumbles, alarms, and fanfare without external audio assets.
- **Campaign State Machine**: 18 deterministic campaign stages with strict precondition guards, route protection, event bridging, and complete save/restore serialization.
- **Verification**: 575 automated unit and integration tests across 47 test files with 100% pass rate.
