# SECTOR 17 — Simulation Physics Engine
## Phase 1: Core Astrodynamics & Rocket Equation Module

The `src/simulation/` package provides a standalone, framework-independent mathematical foundation for simulating space mission trajectories, velocity budgets, and rocket propulsion systems.

All modules are written in pure TypeScript, have zero React or DOM dependencies, and operate strictly in standard SI units internally.

---

## 1. Mathematical Equations & Formulations

### A. Tsiolkovsky Rocket Equation
Computes the velocity increment ($\Delta V$) achievable by a rocket stage in vacuum without gravity or aerodynamic drag:

$$\Delta V = I_{sp} \cdot g_0 \cdot \ln\left(\frac{m_0}{m_f}\right) = c \cdot \ln\left(\frac{m_0}{m_f}\right)$$

Where:
- $m_0$: Initial total wet mass (dry structure + payload + propellant) $[\text{kg}]$
- $m_f$: Final burnout dry mass $[\text{kg}]$
- $I_{sp}$: Specific impulse $[\text{s}]$
- $g_0$: Standard acceleration of gravity on Earth ($9.80665 \text{ m/s}^2$)
- $c = I_{sp} \cdot g_0$: Effective exhaust velocity $[\text{m/s}]$

#### Inverted Relations:
- **Mass Ratio:**
  $$R = \frac{m_0}{m_f} = e^{\frac{\Delta V}{I_{sp} \cdot g_0}}$$
- **Required Propellant Mass:**
  $$m_{\text{prop}} = m_{\text{dry}} \cdot \left(e^{\frac{\Delta V}{I_{sp} \cdot g_0}} - 1\right)$$
- **Propellant Mass Fraction:**
  $$\zeta = \frac{m_{\text{prop}}}{m_0} = 1 - \frac{1}{R}$$

---

### B. Vis-Viva Equation
Computes instantaneous orbital speed of an object moving under a central gravitational field:

$$v = \sqrt{\mu \cdot \left(\frac{2}{r} - \frac{1}{a}\right)}$$

Where:
- $v$: Orbital speed $[\text{m/s}]$
- $\mu = G \cdot M$: Standard gravitational parameter of the central body $[\text{m}^3/\text{s}^2]$ ($\mu_\odot = 1.32712440018 \times 10^{20} \text{ m}^3/\text{s}^2$ for the Sun)
- $r$: Current radial distance from the central body center of mass $[\text{m}]$
- $a$: Semi-major axis of the orbit $[\text{m}]$ ($a > 0$ for elliptical orbits, $a < 0$ for hyperbolic)

---

### C. Idealized Two-Body Hohmann Transfer
Computes the elliptical transfer orbit between two concentric, coplanar circular orbits:

- **Transfer Orbit Semi-Major Axis:**
  $$a_{\text{trans}} = \frac{r_1 + r_2}{2}$$
- **One-Way Transfer Duration:**
  $$T_{\text{trans}} = \frac{P}{2} = \pi \sqrt{\frac{a_{\text{trans}}^3}{\mu}}$$
- **Circular Orbital Velocities:**
  $$v_{c1} = \sqrt{\frac{\mu}{r_1}}, \quad v_{c2} = \sqrt{\frac{\mu}{r_2}}$$
- **Perihelion & Aphelion Transfer Velocities:**
  $$v_{t1} = \sqrt{\mu \left(\frac{2}{r_1} - \frac{1}{a_{\text{trans}}}\right)}, \quad v_{t2} = \sqrt{\mu \left(\frac{2}{r_2} - \frac{1}{a_{\text{trans}}}\right)}$$
- **Impulsive Delta-V Burns:**
  $$\Delta V_1 = |v_{t1} - v_{c1}|, \quad \Delta V_2 = |v_{c2} - v_{t2}|, \quad \Delta V_{\text{total}} = \Delta V_1 + \Delta V_2$$

---

### D. Hyperbolic Excess Velocity ($v_\infty$) & Characteristic Energy ($C_3$)
Relates hyperbolic departure or arrival asymptotes to launch injection energy:

$$C_3 = v_\infty^2, \quad v_\infty = \sqrt{C_3}$$

Where $C_3$ is expressed in $\text{m}^2/\text{s}^2$ (SI) or $\text{km}^2/\text{s}^2$ (standard aerospace notation).

---

## 2. API Reference & Available Functions

### `physics/rocketEquation.ts`
- `calculateEffectiveExhaustVelocity(ispSeconds: number): number`
- `calculateMassRatio(deltaVMps: number, ispSeconds: number): number`
- `calculatePropellantMass(dryMassKg: number, deltaVMps: number, ispSeconds: number): number`
- `calculateFinalMass(initialMassKg: number, propellantMassKg: number): number`
- `calculateDeltaV(initialMassKg: number, finalMassKg: number, ispSeconds: number): number`
- `calculatePropellantFraction(propellantMassKg: number, initialMassKg: number): number`
- `calculateRocketPerformance(dryMassKg: number, deltaVMps: number, ispSeconds: number): RocketPerformanceResult`

### `physics/orbitalMechanics.ts`
- `auToMetres(au: number): number`
- `metresToAu(metres: number): number`
- `secondsToDays(seconds: number): number`
- `daysToYears(days: number): number`
- `kmPerSecToMetersPerSec(kmPerSec: number): number`
- `metersPerSecToKmPerSec(metersPerSec: number): number`
- `calculateVisVivaVelocity(r: number, a: number, mu?: number): number`
- `calculateC3FromVInfinity(vInfinityMps: number): number`
- `calculateVInfinityFromC3(c3M2ps2: number): number`
- `km2ps2ToM2ps2(c3Km2ps2: number): number`
- `m2ps2ToKm2ps2(c3M2ps2: number): number`
- `calculateHohmannTransfer(params: HohmannTransferParams): HohmannTransferResult`

---

## 3. Assumptions and Known Limitations

### Rocket Propulsion Assumptions
1. **Single-Stage Vacuum Burns:** Calculations model a single stage with constant specific impulse. Multi-stage separation and staging drop-offs are not included in the basic equations.
2. **Impulsive Burn Approximation:** Assumes maneuvers occur instantaneously without gravity gradient losses ($\Delta V_{\text{grav}} = 0$).
3. **Vacuum Operation:** No aerodynamic drag losses are modeled ($\Delta V_{\text{drag}} = 0$).
4. **100% Usable Propellant:** Assumes complete fuel burn without unburnable ullage or residual reserves unless explicitly budgeted.

### Astrodynamics Assumptions
1. **Two-Body Point Mass Gravity:** Only the central body's gravitational field is modeled. N-body gravitational perturbations from other planets, non-spherical planetary mass distributions ($J_2$), and solar radiation pressure are omitted.
2. **Coplanar Circular Orbits:** Assumes departure and arrival planetary orbits are perfectly circular and lie in the same orbital plane (zero inclination $i = 0$ and zero eccentricity $e = 0$).
3. **Heliocentric Transfer Benchmarks:** The Hohmann transfer computes orbital velocity between heliocentric orbits, and does not include planetary gravity assist trajectories (e.g., Mars-Earth Gravity Assists [MEGA] used by Europa Clipper).

> **IMPORTANT DISTINCTION:** The Hohmann transfer provides the **theoretical minimum-energy benchmark** for interplanetary flight. Real operational outer solar system missions (such as NASA's Europa Clipper, Galileo, or Cassini) use multi-gravity assists and deep-space maneuvers, yielding transfer times of **3 to 6 years**, rather than direct Hohmann transfers.

---

## 4. Validated Reference Examples

### Example 1: Earth-to-Jupiter Hohmann Transfer
- **Inputs:**
  - Initial radius ($r_1$): $1.0\text{ AU} = 149,597,870,700\text{ m}$
  - Final radius ($r_2$): $5.2\text{ AU} = 777,908,927,640\text{ m}$
  - Central gravitational parameter ($\mu_\odot$): $1.32712440018 \times 10^{20}\text{ m}^3/\text{s}^2$
- **Calculated Results:**
  - Transfer semi-major axis ($a$): $3.10\text{ AU} = 463,753,399,170\text{ m}$
  - One-way transfer duration: $86,124,275.5\text{ seconds}$
  - Transfer time in days: **$996.81\text{ days}$** ($\approx 2.73\text{ Julian years}$)
  - Earth circular speed ($v_{c1}$): $29,784.7\text{ m/s}$ ($29.78\text{ km/s}$)
  - Jupiter circular speed ($v_{c2}$): $13,061.5\text{ m/s}$ ($13.06\text{ km/s}$)
  - Heliocentric departure impulse ($\Delta V_1$): $8,791.0\text{ m/s}$ ($8.79\text{ km/s}$)
  - Heliocentric arrival circularization ($\Delta V_2$): $5,643.0\text{ m/s}$ ($5.64\text{ km/s}$)
  - Total heliocentric transfer $\Delta V$: $14,434.1\text{ m/s}$ ($14.43\text{ km/s}$)

---

### Example 2: Spacecraft On-Board Propulsion Budget (SECTOR 17 Reference Case)
- **Inputs:**
  - Dry mass ($m_{\text{dry}}$): $2,340\text{ kg}$
  - Target on-board $\Delta V$: $3,900\text{ m/s}$
  - Engine specific impulse ($I_{sp}$): $325\text{ seconds}$ (Hypergolic bipropellant MMH/NTO)
- **Calculated Results:**
  - Effective exhaust velocity ($c = I_{sp} \cdot g_0$): $3,187.16125\text{ m/s}$
  - Mass ratio ($m_0 / m_f$): **$3.399587$**
  - Required propellant mass ($m_{\text{prop}}$): **$5,615.035\text{ kg}$**
  - Total initial wet mass ($m_0$): **$7,955.035\text{ kg}$**
  - Propellant mass fraction ($\zeta$): **$70.58\%$** ($0.70585$)
  - Check: Achievable $\Delta V = 325 \cdot 9.80665 \cdot \ln(7955.035 / 2340) = 3,900.00\text{ m/s}$ (Exact match).

---

## Phase 2: Spacecraft Engineering Validation Core

The `src/simulation/engineering/` package provides rigorous aerospace engineering evaluation modules for spacecraft mass budgeting, electrical power balance, single-node thermal equilibrium, and multi-subsystem mission feasibility validation.

All modules are written in pure TypeScript, operate strictly in standard SI units (kg, Watts, Kelvin, metres, seconds), and have zero React, DOM, or browser dependencies.

---

## 5. Phase 2 Mathematical Formulations

### A. Spacecraft Mass Budget & Accounting
Spacecraft mass is divided into mutually exclusive, strictly non-overlapping categories to eliminate double-counting:

$$m_{\text{dry}} = m_{\text{bus}} + m_{\text{propDry}} + m_{\text{inst}} + m_{\text{comm}} + m_{\text{power}} + m_{\text{thermal}} + m_{\text{lander}} + m_{\text{rover}} + m_{\text{other}}$$

$$m_{\text{wet}} = m_{\text{dry}} + m_{\text{propellant}}$$

#### Science Payload & Fractions:
In planetary and deep-space science mission design, payload mass comprises scientific instruments, landers, and rovers:
$$m_{\text{payload}} = m_{\text{inst}} + m_{\text{lander}} + m_{\text{rover}}$$

$$\text{Payload Fraction (Wet)} = \frac{m_{\text{payload}}}{m_{\text{wet}}}, \quad \text{Payload Fraction (Dry)} = \frac{m_{\text{payload}}}{m_{\text{dry}}}$$

$$\text{Propellant Fraction} = \zeta = \frac{m_{\text{propellant}}}{m_{\text{wet}}}$$

#### Launch Vehicle Mass Margin:
Against a configured launch vehicle payload capacity limit $m_{\text{launch\_limit}}$:
$$\Delta m_{\text{margin}} = m_{\text{launch\_limit}} - m_{\text{wet}}$$

$$\text{Mass Margin \%} = \frac{\Delta m_{\text{margin}}}{m_{\text{launch\_limit}}} \times 100\%$$

- **Status Assessment:**
  - If $m_{\text{launch\_limit}}$ is undefined: Status is `'UNKNOWN'` (incomplete launch capacity assessment).
  - If $m_{\text{wet}} > m_{\text{launch\_limit}}$: Status is `'EXCEEDED'` (Hard physical limit violation).
  - If $\text{Mass Margin \%} < \text{Threshold}$ (default 10%): Status is `'WARNING'`.
  - Else: Status is `'NOMINAL'`.

---

### B. Electrical Power Budget Engine

#### 1. Solar Array Generation (Inverse-Square Law)
Solar electrical power output scales with the inverse-square of heliocentric distance $r$ from the Sun:

$$P_{\text{solar}}(r) = P_0(1\text{ AU}) \cdot \left(\frac{1\text{ AU}}{r}\right)^2 \cdot \eta_{\text{degradation}} \cdot \eta_{\text{pointing}} \cdot \eta_{\text{operational}}$$

Where:
- $P_0(1\text{ AU})$: Rated electrical power output at 1 Astronomical Unit $[\text{W}]$
- $r$: Heliocentric distance $[\text{AU}]$ ($r > 0$)
- $\eta_{\text{degradation}} \in [0, 1]$: Radiation exposure and micrometeorite cell degradation factor
- $\eta_{\text{pointing}} \in [0, 1]$: Array orientation and sun-tracking cosine efficiency
- $\eta_{\text{operational}} \in [0, 1]$: Thermal derating and operational efficiency

> **Important Distinction:** Solar irradiance ($S_0 \approx 1361 \text{ W/m}^2$) must never be confused with electrical power output ($P$ in Watts), which accounts for total surface area and photovoltaic conversion efficiency.

#### 2. Radioisotope Power Source Generation (RTG / MMRTG)
Radioisotope thermoelectric generators provide continuous power independent of solar distance:

$$P_{\text{RTG}} = P_{\text{rated}} \cdot \eta_{\text{degradation}}$$

Where $P_{\text{rated}}$ is the explicitly specified electrical output in Watts, and $\eta_{\text{degradation}}$ accounts for isotopic radioactive decay (e.g., Pu-238 half-life of 87.7 years) and thermocouple degradation.

> **Engineering Rule:** If an RTG lacks an explicitly verified power output rating, generation is marked as **unknown / incomplete**. Theoretical estimates are never silently invented.

#### 3. Power Consumption & Net Power Balance
Total electrical consumption sums all active subsystem loads:
$$P_{\text{consumption}} = \sum P_{\text{load}, i} = P_{\text{bus}} + P_{\text{comm}} + P_{\text{inst}} + P_{\text{thermal}} + P_{\text{data}} + P_{\text{prop}} + P_{\text{lander}} + P_{\text{rover}} + P_{\text{other}}$$

$$P_{\text{net}} = P_{\text{generation}} - P_{\text{consumption}}$$

$$\text{Power Margin} = P_{\text{net}} \quad [\text{W}]$$

$$\text{Power Reserve \%} = \frac{P_{\text{net}}}{P_{\text{consumption}}} \times 100\% \quad (P_{\text{consumption}} > 0)$$

$$\text{Power Deficit} = \max(0, P_{\text{consumption}} - P_{\text{generation}}) \quad [\text{W}]$$

#### 4. Electric Propulsion Feasibility Constraint
An electric thruster (e.g. gridded ion or Hall thruster) cannot be evaluated from specific impulse ($I_{sp}$) alone. Its electrical input power (Watts) must be explicitly supplied. If missing, electric propulsion feasibility is marked as incomplete.

---

### C. Single-Node Thermal Equilibrium Model

The thermal engine implements a single-node isothermal lumped thermal model in radiative equilibrium with deep space.

#### 1. Solar Thermal Absorption:
$$S(r) = S_0 \cdot \left(\frac{1}{r}\right)^2$$
$$P_{\text{solar\_abs}} = \alpha \cdot A_{\text{projected}} \cdot S(r)$$

Where:
- $S_0 = 1361.0 \text{ W/m}^2$: Solar irradiance constant at 1 AU
- $\alpha \in (0, 1]$: Surface solar absorptivity
- $A_{\text{projected}} > 0$: Cross-sectional area exposed to direct solar flux $[\text{m}^2]$

#### 2. Thermal Energy Input:
$$P_{\text{in}} = P_{\text{solar\_abs}} + Q_{\text{internal}}$$

Where $Q_{\text{internal}}$ is internal electrical waste heat dissipation $[\text{W}]$, assuming electrical power consumed by avionics is dissipated thermally inside the spacecraft node.

#### 3. Stefan-Boltzmann Thermal Radiation:
$$P_{\text{radiated}}(T) = \epsilon \cdot \sigma \cdot A_{\text{radiating}} \cdot (T^4 - T_{\text{space}}^4)$$

Where:
- $\epsilon \in (0, 1]$: Surface infrared emissivity
- $\sigma = 5.670374419 \times 10^{-8} \text{ W}/(\text{m}^2\cdot\text{K}^4)$: Stefan-Boltzmann constant (CODATA 2018)
- $A_{\text{radiating}} > 0$: Total effective radiating surface area $[\text{m}^2]$
- $T$: Spacecraft equilibrium surface temperature $[\text{K}]$
- $T_{\text{space}} = 2.7255 \text{ K}$: Deep space cosmic background temperature

#### 4. Equilibrium Temperature Solver:
Energy conservation at radiative equilibrium requires $f(T) = 0$:

$$f(T) = \epsilon \cdot \sigma \cdot A_{\text{radiating}} \cdot (T^4 - T_{\text{space}}^4) - P_{\text{in}} = 0$$

Solved iteratively using Newton-Raphson:
$$f'(T) = 4 \cdot \epsilon \cdot \sigma \cdot A_{\text{radiating}} \cdot T^3$$

$$T_{k+1} = T_k - \frac{f(T_k)}{f'(T_k)}$$

The solver iterates from an initial guess ($T_0 = 300\text{ K}$) until $|T_{k+1} - T_k| < 10^{-5}\text{ K}$ or reaches 100 iterations, with analytical verification via the closed-form solution:

$$T_{\text{analytical}} = \left( T_{\text{space}}^4 + \frac{P_{\text{in}}}{\epsilon \cdot \sigma \cdot A_{\text{radiating}}} \right)^{1/4}$$

Conversion to Celsius:
$$T_{^\circ\text{C}} = T_{\text{K}} - 273.15$$

---

### D. Spacecraft Engineering Validation Hierarchy

The validation engine synthesizes mass, power, thermal, and completeness into a multi-tiered aerospace gate:

| Status | Definition | Criteria |
| :--- | :--- | :--- |
| **`PASS`** | Flight-Ready Design | All physical constraints met, positive margins, complete specification data. |
| **`WARNING`** | Operational Concern | Technically feasible, but mass margin or power reserve is below configured thresholds. |
| **`FAIL`** | Engineering Violation | Launch mass limit exceeded, power deficit ($P_{\text{net}} < 0$), or thermal limits breached. |
| **`INCOMPLETE`** | Insufficient Data | Required engineering data missing (e.g. unrated source, missing instrument power, undefined thruster input power). **Never promoted to PASS.** |

---

## 6. Phase 2 API Reference

### `engineering/massBudget.ts`
- `validateMassValue(massKg: number, label: string): number`
- `createEmptyMassBreakdown(): Record<MassCategory, number>`
- `calculateMassBudget(input: MassBudgetInput): MassBudgetResult`

### `engineering/powerBudget.ts`
- `validateEfficiencyFactor(factor: number, label: string): number`
- `calculateSolarArrayGeneration(config: SolarArrayConfig): number`
- `calculateRadioisotopeGeneration(config: RadioisotopeSourceConfig): number`
- `createEmptyLoadBreakdown(): Record<PowerLoadCategory, number>`
- `calculatePowerBudget(input: PowerBudgetInput): PowerBudgetResult`

### `engineering/thermalModel.ts`
- `calculateSolarFlux(distanceAu: number): number`
- `calculateRadiatedPower(surfaceEmissivity: number, radiatingAreaM2: number, temperatureKelvin: number, spaceTemperatureKelvin?: number): number`
- `calculateThermalEquilibrium(input: ThermalModelInput): ThermalModelResult`

### `engineering/spacecraftValidator.ts`
- `validateSpacecraft(input: SpacecraftValidationInput): SpacecraftValidationReport`

---

## 7. Assumptions & Engineering Limitations

### Mass Budget Limitations:
1. **Lumped Mass Accounting:** Mass is calculated by major structural and subsystem categories. Center-of-mass travel, moments of inertia, and payload adapter fittings (PAF) are omitted in this phase.
2. **Launch Vehicle Limits:** Launch limits represent generic payload capacity to translunar/interplanetary injection; specific launch vehicle energy curves ($C_3$ vs. payload mass) are modeled separately.

### Power Budget Limitations:
1. **Steady-State Power:** Power calculations model continuous steady-state cruising conditions. Transient peak power demands (e.g., transmitter RF bursts, engine gimbal actuators, battery charging cycles) are not modeled.
2. **Simplified Solar Degradation:** Photovoltaic cell degradation is modeled via an aggregate efficiency factor rather than a detailed Jovian radiation fluence model.

### Thermal Model Limitations:
1. **Single Lumped Node:** Assumes uniform surface temperature across the entire spacecraft body. Real spacecraft engineering employs complex multi-node finite difference networks (e.g., Thermal Desktop, SINDA) with conduction across bus bays and multi-layer insulation (MLI).
2. **Thermal Dissipation:** Assumes 100% of consumed electrical power is dissipated as internal waste heat inside the central node.

---

## 8. Illustrative Worked Example (Demonstration Values)

> **NOTE:** The parameters below are **illustrative demonstration values** designed to demonstrate the simulation calculations and do not represent proprietary or official NASA flight specifications.

### Spacecraft Configuration:
- **Mass Breakdown:**
  - Structure Bus: $1,200\text{ kg}$
  - Propulsion Dry: $400\text{ kg}$
  - Propellant: $1,500\text{ kg}$
  - Science Instruments: $300\text{ kg}$
  - Communication Dish: $200\text{ kg}$
  - Power System: $300\text{ kg}$
  - Thermal Control: $200\text{ kg}$
  - Launch Vehicle Capacity Limit: $6,000\text{ kg}$
- **Electrical Power System:**
  - Radioisotope Generator Output: $3,000\text{ W}$ ($3.0\text{ kW}$)
  - Bus Consumption: $300\text{ W}$
  - Communication Consumption: $500\text{ W}$
  - Instrument Suite Consumption: $800\text{ W}$
  - Thermal Heaters: $200\text{ W}$
- **Thermal Properties:**
  - Solar Absorptivity ($\alpha$): $0.30$
  - Projected Area: $2.0\text{ m}^2$
  - Surface Emissivity ($\epsilon$): $0.80$
  - Radiating Area: $8.0\text{ m}^2$
  - Distance: $1.0\text{ AU}$
  - Internal Heat Dissipation: $500\text{ W}$
  - Operational Limits: $-40^\circ\text{C}$ ($233.15\text{ K}$) to $+60^\circ\text{C}$ ($333.15\text{ K}$)

### Calculated Validation Results:
- **Mass Results:**
  - Total Dry Mass: $1200 + 400 + 300 + 200 + 300 + 200 = \mathbf{2,600\text{ kg}}$
  - Total Wet Mass: $2600 + 1500 = \mathbf{4,100\text{ kg}}$
  - Payload Mass: $\mathbf{300\text{ kg}}$
  - Available Launch Margin: $6000 - 4100 = \mathbf{1,900\text{ kg}}$ ($\mathbf{31.67\%}$)
  - Mass Status: **`NOMINAL`**
- **Power Results:**
  - Total Generation: $\mathbf{3,000\text{ W}}$
  - Total Consumption: $300 + 500 + 800 + 200 = \mathbf{1,800\text{ W}}$
  - Net Available Power: $3000 - 1800 = \mathbf{1,200\text{ W}}$
  - Power Reserve Percentage: $\frac{1200}{1800} \times 100\% = \mathbf{66.67\%}$ ($> 20\%$ threshold)
  - Power Status: **`NOMINAL`**
- **Thermal Results:**
  - Solar Absorbed: $0.30 \times 2.0 \times 1361 = 816.6\text{ W}$
  - Total Heat In: $816.6 + 500 = 1316.6\text{ W}$
  - Radiating Coeff: $0.80 \times 5.67037\times 10^{-8} \times 8.0 = 3.62904\times 10^{-7}\text{ W/K}^4$
  - Equilibrium Temperature: $T = (1316.6 / 3.62904\times 10^{-7})^{0.25} = \mathbf{245.48\text{ K}}$ ($\mathbf{-27.67^\circ\text{C}}$)
  - Operating Limit Check: $-40^\circ\text{C} \le -27.67^\circ\text{C} \le +60^\circ\text{C}$
  - Thermal Status: **`NOMINAL`**
- **Integrated Spacecraft Validation Verdict:** **`PASS`**

---

## Phase 3: Mission Operations Engine

The `src/simulation/operations/` package provides a deterministic, testable, framework-independent simulation engine for progressing spacecraft operations through simulated time, managing chronological operational events, and dispatching handlers with strict error containment.

The engine has zero dependencies on React, browser timers (`setTimeout`, `Date.now()`), or DOM APIs.

---

## 9. Mission Clock & Time Representation

### A. Core Architecture
- **Time Representation:** Standard SI seconds (non-negative, finite numbers).
- **Mission Elapsed Time (MET):** Continuous elapsed duration in seconds since mission epoch ($t = 0$).
- **Simulation Timestamp:** Absolute simulation timestamp in seconds:
  $$\text{Current Timestamp} = \text{Epoch Timestamp} + \text{MET}$$
- **Aerospace MET String Formatting:** Formats seconds into standard mission format:
  $$\text{"T+ DDDd HH:MM:SS"}$$
  Example: $3,673,815\text{ s} \implies \text{"T+ 042d 12:30:15"}$.

### B. Controlled Time Advancement
- Time can be advanced by arbitrary discrete durations: seconds, minutes, hours, or days.
- **State Guard:** When the clock is in the `paused` state (`isRunning = false`), time advancement calls return $0\text{ s}$ advanced without altering simulation time, unless an explicit internal override (`forceWhilePaused: true`) is specified.
- **Reset:** Restores MET to $0\text{ s}$, pauses progression, and resets step counters to their documented baseline.

---

## 10. Event Scheduling & Deterministic Ordering

### A. Event Structure (`MissionEvent<T>`)
Each scheduled mission event contains:
- `id`: Unique string identifier (duplicates are rejected upon scheduling).
- `type`: String event type (e.g. `'COMM_WINDOW_OPEN'`, `'PROPULSION_BURN'`, `'SCIENCE_SCAN'`).
- `scheduledTimeSeconds`: Target MET in seconds when the event should execute.
- `payload`: Protected, frozen event payload data.
- `priority`: Integer priority (default: `100`, higher number = higher execution priority).
- `sequenceNumber`: Monotonically increasing integer assigned upon scheduling for FIFO tie-breaking.
- `status`: Execution state (`'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED'`).
- `createdAtSeconds`: Simulation MET when the event was scheduled.

### B. Deterministic Ordering Rule
When multiple events are due for execution, they are sorted deterministically according to four criteria:
1. **Scheduled Time (Ascending):** Earlier events execute before later events.
2. **Priority (Descending):** At identical timestamps, higher-priority events execute first.
3. **Sequence Number (Ascending):** For identical timestamp and priority, events execute in exact FIFO insertion order.
4. **Event ID (Alphabetical Ascending):** Definitive alphabetical tie-breaker ensuring 100% identical execution across all platforms.

### C. Validation & Cancellation
- **Past-Time Guard:** Scheduling an event for an MET earlier than current simulation time throws a `RangeError`.
- **Duplicate ID Guard:** Registering an event with an existing ID throws an explicit `Error`.
- **Cancellation:** Pending events can be cancelled via `cancel(eventId)`. Cancelled events are marked with `'CANCELLED'` and are strictly excluded from execution.

---

## 11. Mission Event Engine & Execution Dispatch

### A. Execution Dispatch Loop
When `advanceAndProcess(durationSeconds)` is called:
1. Checks pause state.
2. Computes target MET: $t_{\text{target}} = t_{\text{current}} + \Delta t$.
3. Extracts all due pending events satisfying $t_{\text{scheduled}} \le t_{\text{target}}$, sorted by the deterministic ordering rule.
4. Advances the simulation clock to $t_{\text{target}}$.
5. Dispatches events to their registered handlers:
   - Handlers receive the event and a read-only `MissionExecutionContext` (`metSeconds`, `currentTimestampSeconds`, `stepCount`).
   - Succeeded events transition to `'EXECUTED'`.
   - Results are logged into the immutable execution history.
   - Prevents duplicate execution.

### B. Error Containment Boundary
If a registered event handler throws an unhandled exception:
- The error is intercepted within a try/catch boundary.
- The event's status transitions to `'FAILED'`.
- The failure message is captured in `EventExecutionResult`.
- **The scheduler is NOT corrupted.** Subsequent due events continue processing normally.

---

## 12. Phase 3.1 Hardening & Reliability Guarantees

### A. Re-Entrancy Protection
To prevent recursion hazards, state desynchronization, and unpredictable simulation clock jumps:
- `MissionEventEngine` maintains an explicit advancement lock (`isAdvancing`).
- If an event handler invokes `advanceAndProcess()`, `advanceMinutes()`, `advanceHours()`, or `advanceDays()`, the engine immediately throws a descriptive `Error`:
  `"MissionEventEngine: Re-entrant time advancement call detected. advanceAndProcess cannot be invoked recursively from within an event handler."`
- The lock is acquired inside `advanceAndProcess` and guaranteed to be released in a `finally` block, ensuring subsequent simulation steps continue normally even if a handler throws.
- Normal event registration and scheduling (`scheduleEvent`) from within handlers remain fully permitted and unrestricted.

### B. Deep Payload Immutability & Type Protection
Payload immutability is enforced via recursive cloning and freezing (`deepCloneAndFreeze`):
- **Deep Immutability:** Nested plain objects and arrays are recursively cloned and frozen with `Object.freeze()`. Mutations in strict mode throw errors, preventing any handler from corrupting payload state for subsequent observers.
- **Caller Isolation:** The caller's original object reference is never mutated or frozen.
- **Type Whitelist:** Supports all JSON-compatible primitives (`number`, `string`, `boolean`, `null`, `undefined`, `bigint`), plain arrays, and plain objects (`prototype === Object.prototype` or `null`).
- **Strict Type Validation:** Rejects functions, symbols, and non-plain object instances (e.g. `Date`, `Map`, `Set`, `RegExp`, custom class instances) with `TypeError`.
- **Circular Reference Detection:** Employs a `WeakSet` traversal guard to detect and reject circular references with `TypeError`.

### C. Same-Timestamp Chained Scheduling & Step Execution Limit
When an operational event dynamically schedules secondary events at the current simulation timestamp:
- The advancement engine operates an iterative loop: after executing a batch of due events, it checks whether any newly scheduled events have `scheduledTimeSeconds <= currentTimeSeconds`.
- Chained events due at the current timestamp execute in the same simulation step in deterministic priority/FIFO order.
- **Runaway Loop Protection:** To safeguard against infinite loops (e.g., mutually recursive event scheduling), the loop halts when total processed events reach `DEFAULT_MAX_EVENTS_PER_STEP` ($1,000$).
- If the limit is reached, `stepLimitReached` is flagged as `true` in `TimeStepExecutionReport`, and remaining events are preserved in the scheduler with status `'PENDING'` (never cancelled or discarded).

### D. Safe Memory Pruning (History Retention)
Long simulations accumulate large numbers of executed and cancelled records. Explicit, safe pruning methods prevent unbounded memory consumption:
- `EventScheduler.pruneEvents(options?: PruneEventsOptions): number`
- `MissionEventEngine.pruneHistory(options?: PruneHistoryOptions): PruneHistoryResult`
- **Strict Safety Invariant:** Pending events (`status === 'PENDING'`) are **never pruned**, regardless of timestamp filters. Only completed (`'EXECUTED'`), aborted (`'CANCELLED'`), or `'FAILED'` events can be pruned.
- Supports granular filtering by `olderThanMETSeconds`, `removeExecuted`, `removeCancelled`, `removeFailed`, and `pruneExecutionHistory`.

---

## 13. Phase 3 & 3.1 API Reference

### `constants.ts`
- `DEFAULT_MAX_EVENTS_PER_STEP = 1000`: Default maximum events executed within a single advancement step.

### `operations/missionClock.ts`
- `validateTimeIncrement(deltaSeconds: number, label?: string): number`
- `daysToSeconds(days: number): number`
- `hoursToSeconds(hours: number): number`
- `minutesToSeconds(minutes: number): number`
- `metToComponents(metSeconds: number): METComponents`
- `formatMET(metSeconds: number): string`
- `createInitialMissionClockState(epochTimestampSeconds?: number, startRunning?: boolean): MissionClockState`
- `advanceClockState(state: MissionClockState, deltaSeconds: number, forceAdvance?: boolean): MissionClockState`
- `pauseClockState(state: MissionClockState): MissionClockState`
- `resumeClockState(state: MissionClockState): MissionClockState`
- `resetClockState(state: MissionClockState): MissionClockState`
- `class MissionClock`

### `operations/timeController.ts`
- `class TimeController`
  - `advance(durationSeconds: number, options?: AdvanceOptions): TimeStepResult`
  - `advanceMinutes(minutes: number, options?: AdvanceOptions): TimeStepResult`
  - `advanceHours(hours: number, options?: AdvanceOptions): TimeStepResult`
  - `advanceDays(days: number, options?: AdvanceOptions): TimeStepResult`
  - `pause(): void`, `resume(): void`, `reset(): void`
  - `getClockState(): Readonly<MissionClockState>`
  - `getMETSeconds(): number`, `getFormattedMET(): string`
  - `isRunning(): boolean`, `isPaused(): boolean`

### `operations/eventScheduler.ts`
- `compareEvents(a: MissionEvent, b: MissionEvent): number`
- `deepCloneAndFreeze<T>(payload: T, seen?: WeakSet<object>): T`
- `class EventScheduler`
  - `schedule<T>(input: EventScheduleInput<T>, currentMETSeconds?: number): MissionEvent<T>`
  - `cancel(eventId: string): boolean`
  - `getEvent(eventId: string): MissionEvent | undefined`
  - `getAllEvents(): MissionEvent[]`
  - `getPendingEvents(): MissionEvent[]`
  - `extractDueEvents(targetMETSeconds: number): MissionEvent[]`
  - `pruneEvents(options?: PruneEventsOptions): number`
  - `clear(): void`

### `operations/missionEventEngine.ts`
- `class MissionEventEngine`
  - `registerHandler<T, R>(eventType: string, handler: MissionEventHandler<T, R>): void`
  - `unregisterHandler(eventType: string): boolean`
  - `scheduleEvent<T>(input: EventScheduleInput<T>): MissionEvent<T>`
  - `cancelEvent(eventId: string): boolean`
  - `advanceAndProcess(durationSeconds: number, options?: AdvanceAndProcessOptions): TimeStepExecutionReport`
  - `advanceMinutes(minutes: number, options?: AdvanceAndProcessOptions): TimeStepExecutionReport`
  - `advanceHours(hours: number, options?: AdvanceAndProcessOptions): TimeStepExecutionReport`
  - `advanceDays(days: number, options?: AdvanceAndProcessOptions): TimeStepExecutionReport`
  - `getExecutionHistory(): ReadonlyArray<EventExecutionResult>`
  - `pruneHistory(options?: PruneHistoryOptions): PruneHistoryResult`
  - `getMaxEventsPerStep(): number`, `setMaxEventsPerStep(limit: number): void`
  - `isAdvanceLocked(): boolean`
  - `pause(): void`, `resume(): void`, `reset(): void`

---

## 14. Public API Usage Example

```typescript
import { MissionEventEngine } from './simulation';

// Initialize mission operations engine (running at t = 0)
const engine = new MissionEventEngine(0, true);

// 1. Register operational event handlers
engine.registerHandler('COMM_WINDOW', (event, context) => {
  console.log(`[${context.metSeconds}s] Comm window opened with DSN at ${event.payload.bitrate}`);
  return { status: 'LOCKED' };
});

engine.registerHandler('COURSE_CORRECTION', (event, context) => {
  console.log(`[${context.metSeconds}s] Executing TCM burn: ${event.payload.deltaV} m/s`);
});

// 2. Schedule operational milestones
engine.scheduleEvent({
  id: 'tcm-1',
  type: 'COURSE_CORRECTION',
  scheduledTimeSeconds: 86400, // 1 day post-launch
  payload: { deltaV: 12.5 },
  priority: 200,
});

engine.scheduleEvent({
  id: 'dsn-pass-1',
  type: 'COMM_WINDOW',
  scheduledTimeSeconds: 86400, // Identical timestamp; lower priority executes after TCM
  payload: { bitrate: '25 Mbps' },
  priority: 100,
});

// 3. Advance simulation time by 2 days (172,800 seconds)
const report = engine.advanceDays(2);

console.log(engine.getFormattedMET()); // "T+ 002d 00:00:00"
console.log(`Processed ${report.eventsProcessedCount} events.`);
// Output:
// Processed 2 events (both tcm-1 and dsn-pass-1 executed in exact priority order).
```

---

## 15. Implemented Scope vs. Future Campaign Features

| Capability | Phase 3 (Implemented) | Future Phases (Deferred) |
| :--- | :--- | :--- |
| **Simulation Time Progression** | Deterministic MissionClock & TimeController | Dynamic UI time speed selector slider (Phase 5/UI) |
| **Event Dispatch** | Priority/FIFO chronological EventScheduler | Campaign scripted narrative events (Phase 5) |
| **Telemetry & Communications** | Ground stations, Link budget, DSN visibility, Queues (Phase 4) | Interactive UI comm dashboards (Phase 5/UI) |
| **Propulsion & Trajectory** | Pure math engines (Phases 1 & 2) + Event triggers | Operational orbital insertion & Jovian tour flybys (Phase 5) |
| **Science & Surface Recon** | Onboard mass memory & downlink queues (Phase 4) | Level 0-2 science data pipelines & rover milestones (Phase 5) |

---

# Phase 4: Ground Segment & Deep-Space Communications

The `src/simulation/communications/` package models Earth-based deep-space tracking stations, antenna visibility geometry, speed-of-light propagation delays, physical RF link budgets, onboard solid-state mass memory storage, command uplink queues, and telemetry downlink streaming.

---

## 16. Communications Architecture & Mathematical Foundations

### A. Speed-of-Light Signal Propagation
Signals propagate across interplanetary space at the speed of light in vacuum ($c = 299,792,458 \text{ m/s}$):
- **One-Way Light Time (OWLT):**
  $$\tau_{\text{OWLT}} = \frac{d}{c}$$
- **Round-Trip Light Time (RTT / RTLT):**
  $$\tau_{\text{RTT}} = 2 \cdot \tau_{\text{OWLT}} = \frac{2d}{c}$$

> **Important Distinction:** Transmission duration ($\Delta t_{\text{tx}} = \frac{8 \cdot \text{sizeBytes}}{R_{\text{bps}}}$) is the duration required for the transmitter to modulate and emit the packet waveform. Propagation delay ($\tau_{\text{OWLT}}$) is the physical transit time across distance $d$. A packet's final bit arrives at AETHON at:
> $$t_{\text{arrival}} = t_{\text{tx\_start}} + \Delta t_{\text{tx}} + \tau_{\text{OWLT}}$$

---

### B. RF Link Budget Equations
Follows ITU-R, CCSDS, and NASA Deep Space Network (DSN) Telecommunications Link Design standards:

1. **Free-Space Path Loss (FSPL):**
   $$\text{FSPL} = \left(\frac{4\pi d}{\lambda}\right)^2 = \left(\frac{4\pi d f}{c}\right)^2$$
   $$\text{FSPL}_{\text{dB}} = 20 \log_{10}(d) + 20 \log_{10}(f) + 20 \log_{10}\left(\frac{4\pi}{c}\right)$$
2. **Parabolic Dish Antenna Gain:**
   $$G = \eta \left(\frac{\pi D}{\lambda}\right)^2 = \eta \left(\frac{\pi D f}{c}\right)^2$$
   $$G_{\text{dBi}} = 10 \log_{10}(\eta) + 20 \log_{10}\left(\frac{\pi D f}{c}\right)$$
   Where $D$ is aperture diameter $[\text{m}]$, and $\eta$ is aperture illumination efficiency ($0 < \eta \le 1$, default $0.65$).
3. **Equivalent Isotropically Radiated Power (EIRP):**
   $$\text{EIRP}_{\text{dBW}} = P_{t\text{,dBW}} + G_{t\text{,dBi}} - L_{t\text{,dB}}$$
4. **Received Power ($P_r$):**
   $$P_{r\text{,dBW}} = \text{EIRP}_{\text{dBW}} - \text{FSPL}_{\text{dB}} + G_{r\text{,dBi}} - L_{\text{rx,dB}} - L_{\text{atm,dB}} - L_{\text{point,dB}}$$
   $$P_r = 10^{(P_{r\text{,dBW}} / 10)} \quad [\text{Watts}]$$
5. **Thermal Noise Spectral Density ($N_0$):**
   $$N_0 = k_B \cdot T_{\text{sys}} \quad [\text{W/Hz}]$$
   $$N_{0\text{,dBW/Hz}} = 10 \log_{10}(k_B \cdot T_{\text{sys}}) \approx -228.60 + 10 \log_{10}(T_{\text{sys}})$$
   Where $k_B = 1.380649 \times 10^{-23} \text{ J/K}$ (Boltzmann constant) and $T_{\text{sys}}$ is system noise temperature in Kelvin.
6. **Carrier-to-Noise Density Ratio ($C/N_0$):**
   $$\left(\frac{C}{N_0}\right)_{\text{dB-Hz}} = P_{r\text{,dBW}} - N_{0\text{,dBW/Hz}}$$
7. **Energy Per Bit to Noise Density Ratio ($E_b/N_0$):**
   $$\left(\frac{E_b}{N_0}\right)_{\text{dB}} = \left(\frac{C}{N_0}\right)_{\text{dB-Hz}} - 10 \log_{10}(R_b)$$
   Where $R_b$ is transmission bit rate in bits/second.
8. **Operational Link Margin:**
   $$\text{Margin}_{\text{dB}} = \left(\frac{E_b}{N_0}\right)_{\text{achieved}} - \left(\frac{E_b}{N_0}\right)_{\text{required}}$$
9. **Maximum Achievable Bit Rate ($R_{b\text{,max}}$):**
   $$R_{b\text{,max}} = 10^{\frac{(C/N_0)_{\text{dB-Hz}} - (E_b/N_0)_{\text{req,dB}} - \text{Margin}_{\text{req,dB}}}{10}} \quad [\text{bps}]$$
10. **Theoretical Shannon Channel Capacity:**
    $$C_{\text{Shannon}} = B \log_2\left(1 + \frac{P_r}{N_0 B}\right) \quad [\text{bps}]$$

---

## 17. Ground Station & Visibility Models

### A. Ground Station Model (`groundStations.ts`)
Each tracking station enforces physical constraints:
- Latitude in $[-90^\circ, +90^\circ]$, Longitude in $[-180^\circ, +180^\circ]$.
- Antenna diameter $> 0\text{ m}$, Transmit power $\ge 0\text{ W}$, Receiver noise temp $> 0\text{ K}$.
- Horizon mask elevation constraint $[0^\circ, 90^\circ)$ (default $10^\circ$).
- Planned maintenance and blackout window schedules.
- **Deep Space Network (DSN) Illustrative Stations:**
  - Goldstone (DSS-14 70m, California: $35.43^\circ\text{N}, 116.89^\circ\text{W}$)
  - Madrid (DSS-63 70m, Spain: $40.43^\circ\text{N}, 4.25^\circ\text{W}$)
  - Canberra (DSS-43 70m, Australia: $35.40^\circ\text{S}, 148.98^\circ\text{E}$)
  *(Explicitly labeled `isIllustrative: true` for simulation gameplay).*

### B. Geometric Visibility (`communicationWindows.ts`)
- Topocentric elevation angle $E$ from station $(\phi_s, \lambda_s)$ to target $(\phi_t, \lambda_t)$:
  $$\cos\theta = \sin\phi_s \sin\phi_t + \cos\phi_s \cos\phi_t \cos(\lambda_t - \lambda_s)$$
  $$\tan E = \frac{\cos\theta - R_E / r}{\sin\theta}$$
- Visibility is granted if and only if:
  1. $E \ge \text{minElevationDeg}$ (clears local horizon mask).
  2. Station is operational (not in maintenance blackout at current MET).

---

## 18. Onboard Data Storage & Transmission Queues

### A. Solid-State Mass Recorder (SSMR) (`onboardStorage.ts`)
- Strict byte-level capacity accounting (`totalCapacityBytes`, `usedStorageBytes`, `availableStorageBytes`).
- Partitions: `engineering`, `science`, and `critical`.
- **Zero Silent Loss Guarantee:** Writing a packet exceeding available capacity throws `CapacityExceededError`. Packets are never silently dropped.
- **Safe Lifecycle:** Packets transition through `STORED` $\to$ `QUEUED` $\to$ `TRANSMITTING` $\to$ `TRANSMITTED` $\to$ `ACKNOWLEDGED`. Packets are purged from storage only upon verified Earth acknowledgment.

### B. Command Uplink Queue (`commandQueue.ts`)
- Earth-to-spacecraft command sequencing.
- **Arrival Gating Invariant:** A command cannot execute on AETHON before:
  $$t_{\text{arrival}} = t_{\text{tx\_start}} + t_{\text{tx\_duration}} + \tau_{\text{OWLT}}$$
- `getArrivedCommands(currentMET)` returns only arrived commands sorted by priority descending.

### C. Telemetry Downlink Queue (`telemetryQueue.ts`)
- Spacecraft-to-Earth priority streaming (`critical` > `science` > `engineering`, FIFO tie-breaker).
- **Time-Stepped Partial Transfer:** When a communication window closes midway through a transfer, bytes transferred so far are preserved, the packet is flagged `INTERRUPTED`, and transmission automatically resumes on the next window pass.

---

## 19. MissionEventEngine Integration

The communication manager integrates seamlessly with `MissionEventEngine`:
- `COMM_WINDOW_OPEN`: Fired when a ground station acquires visibility.
- `COMM_WINDOW_CLOSE`: Fired when station visibility ends.
- `UPLINK_COMMAND_ARRIVED`: Fired when a command finishes interplanetary transit and arrives at AETHON.
- `DOWNLINK_TRANSMISSION_STARTED`: Fired when telemetry begins downlink.
- `DOWNLINK_DATA_RECEIVED`: Fired when downlinked data arrives at Earth ground station.
- `COMMUNICATION_FAILURE`: Fired on link deficit or transmission disruption.

---

## 20. Public API Usage Example

```typescript
import {
  CommunicationManager,
  MissionEventEngine,
  COMM_EVENT_TYPES,
  ASTRONOMICAL_UNIT_METRES,
} from './simulation';

// 1. Initialize operations engine and communications manager
const engine = new MissionEventEngine(0, true);
const comms = new CommunicationManager();
comms.attachEventEngine(engine);

// 2. Register event handlers
engine.registerHandler(COMM_EVENT_TYPES.WINDOW_OPEN, (event) => {
  console.log(`[T+ ${event.scheduledTimeSeconds}s] Comm window opened: ${event.payload.stationId}`);
});

engine.registerHandler(COMM_EVENT_TYPES.UPLINK_ARRIVED, (event) => {
  console.log(`[T+ ${event.scheduledTimeSeconds}s] Command arrived at AETHON: ${event.payload.commandId}`);
});

// 3. Store and queue scientific observation onboard
comms.getStorage().storeData({
  id: 'obs-europa-surface-01',
  category: 'science',
  sizeBytes: 50_000,
  priority: 150,
});

comms.getTelemetryQueue().enqueue({
  id: 'obs-europa-surface-01',
  category: 'science',
  payload: { instrument: 'ICE_RADAR', depthM: 250 },
  sizeBytes: 50_000,
  priority: 150,
});

// 4. Queue Earth-to-Spacecraft command
comms.getCommandQueue().enqueueCommand({
  id: 'cmd-tcm-burn-1',
  type: 'COURSE_CORRECTION_BURN',
  payload: { deltaVMps: 15.2 },
  priority: 200,
  scheduledTxTimeMET: 1000,
  uplinkDataRateBps: 1000,
  distanceMetres: 5.2 * ASTRONOMICAL_UNIT_METRES, // Jupiter distance
});

// 5. Advance simulation step
const target = {
  subSpacecraftLatitudeDeg: 35.4,
  subSpacecraftLongitudeDeg: -116.9, // in view of Goldstone
  distanceMetres: 5.2 * ASTRONOMICAL_UNIT_METRES,
};

const spacecraft = {
  transmitPowerWatts: 20.0,
  antennaGainDbi: 46.5,
};

comms.processStep(3600, 3600, target, spacecraft);
engine.advanceAndProcess(3600);
```

---

## 21. Scientific & Engineering Parameter Classification

| Parameter / Formulation | Classification | Source / Justification |
| :--- | :--- | :--- |
| **Speed of Light ($c$)** | `VERIFIED` | $299,792,458\text{ m/s}$ (Exact SI / CODATA standard) |
| **Boltzmann Constant ($k_B$)** | `VERIFIED` | $1.380649 \times 10^{-23}\text{ J/K}$ (Exact SI 2019 standard) |
| **Astronomical Unit ($\text{AU}$)** | `VERIFIED` | $149,597,870,700\text{ m}$ (IAU 2012 Resolution B2) |
| **Free-Space Path Loss** | `VERIFIED` | Standard electromagnetic wave attenuation equation $(4\pi d / \lambda)^2$ |
| **Parabolic Antenna Gain** | `VERIFIED` | Classical Cassegrain antenna aperture equation $\eta (\pi D / \lambda)^2$ |
| **DSN Station Coordinates** | `VERIFIED` | Publicly published geographic locations of Goldstone, Madrid, and Canberra |
| **DSN Receiver Noise Temp** | `SIMPLIFIED` | Nominal $18.5 - 20\text{ K}$ cryogenic LNA benchmark (actual varies by weather and elevation) |
| **Earth Central Elevation Model** | `SIMPLIFIED` | Spherical Earth geometric horizon ($R_E = 6,371\text{ km}$); omits atmospheric refraction |
| **Required Link Margin** | `CONFIGURABLE` | Default $3.0\text{ dB}$ (standard NASA deep-space flight rule) |
| **Required $E_b/N_0$** | `CONFIGURABLE` | Default $2.5\text{ dB}$ (typical for CCSDS Turbo/LDPC rate 1/2 forward error correction) |
| **Onboard SSMR Capacity** | `CONFIGURABLE` | Default $128\text{ GB}$ (customizable per spacecraft design) |

---

## 22. Phase 5.1 — Flight Software Core (Avionics Architecture)

Phase 5.1 implements the deterministic flight software execution layer for AETHON under `src/simulation/flightSoftware/`.

### A. Mission Execution State Machine

```
   [ INITIALIZED ] ---------> [ PRELAUNCH_HOLD ] ---------> [ ABORTED ]
          |                           ^                          ^
          v                           |                          |
    [ STANDBY ] ----------------------+                          |
          |                                                      |
          v                                                      |
     [ ACTIVE ] -------------------------------------------------+
       |    ^                                                    |
       |    |                                                    |
       v    |                                                    |
   [ SAFE_MODE ]                                                 |
       |                                                         |
       v                                                         |
   [ RECOVERY ] -------------------------------------------------+
       |
       v (All required objectives complete)
   [ COMPLETED ]
```

- **Valid Transitions:**
  - `INITIALIZED -> STANDBY | PRELAUNCH_HOLD | ABORTED`
  - `STANDBY -> ACTIVE | PRELAUNCH_HOLD | ABORTED`
  - `PRELAUNCH_HOLD -> STANDBY | ABORTED`
  - `ACTIVE -> SAFE_MODE | COMPLETED | ABORTED`
  - `SAFE_MODE -> RECOVERY | ABORTED`
  - `RECOVERY -> ACTIVE | SAFE_MODE | ABORTED`
  - `COMPLETED` & `ABORTED` are strictly terminal.
- **Prelaunch Critical Fault Response:**
  - A critical fault during `INITIALIZED` or `STANDBY` autonomously transitions the mission to `PRELAUNCH_HOLD`.
  - In `PRELAUNCH_HOLD`, all subsystems enter fail-safe mode, and transitions to `ACTIVE` (launch) are strictly blocked.
  - Recovery from `PRELAUNCH_HOLD` back to `STANDBY` requires all active critical faults to be resolved.
- **Completion Guard:** `transitionTo('COMPLETED')` validates that all required `MissionObjective` instances are completed; otherwise rejects with `IncompleteObjectivesError`.
- **Safe Mode Invariant:** Inhibits nominal science operations and uncommanded thruster maneuvers.

### B. Subsystem Coordination & Recovery Guard

| Subsystem | Type Key | Implementation Status | Safe-Mode Action |
| :--- | :--- | :--- | :--- |
| **Electrical Power (EPS)** | `EPS` | `SIMPLIFIED` | Sheds non-essential bus loads |
| **Propulsion System** | `PROPULSION` | `SIMPLIFIED` | Isolates bipropellant thruster valves; inhibits burns |
| **Thermal Control (TCS)** | `TCS` | `SIMPLIFIED` | Activates autonomous survival heaters |
| **Communications (COMMS)** | `COMMUNICATIONS` | `SIMPLIFIED` | Switches to low-gain omni antenna mode |
| **Solid-State Storage** | `STORAGE` | `SIMPLIFIED` | Preserves stored data packets |
| **Guidance & Nav (GNC)** | `GNC` | `NOT_IMPLEMENTED` | Placeholder interface |
| **Science Instruments** | `SCIENCE` | `NOT_IMPLEMENTED` | Phase 5.2 pipeline integration |
| **Lander & Rover** | `LANDER_ROVER` | `NOT_IMPLEMENTED` | Surface expedition interface |

- **Subsystem Recovery Guard:** `SubsystemManager.recoverAll()` and `setSubsystemStatus()` enforce a `SubsystemRecoveryValidator` contract wired to `FaultManager.canRecover()`. External callers are strictly prevented from restoring subsystems to `NOMINAL` while active critical faults remain unresolved.

### C. Coordinate-Frame Contract

- **ECEF Positions (`frame: 'ECEF'`):** Coordinates are already fixed to the rotating Earth. Earth rotation ($\omega_E \cdot t$) is **never** applied.
- **ECI Positions (`frame: 'ECI'`):** Celestial inertial coordinates $(\alpha, \delta)$. Earth sidereal rotation rate ($\omega_E = 7.2921159 \times 10^{-5}\text{ rad/s}$) rotates the geographic coordinate system beneath the spacecraft:
  $$\Delta\theta_E(t) = \left(\omega_E \cdot t \cdot \frac{180^\circ}{\pi} + \theta_0\right) \pmod{360^\circ}$$
  $$\lambda_{\text{ECEF}} = \text{normalize}\left(\alpha - \Delta\theta_E(t)\right), \quad \phi_{\text{ECEF}} = \delta$$

### D. Command Execution & Telemetry Acknowledgements

1. **Arrival Verification:** Commands cannot execute before $t \ge \text{arrivalMETSeconds} = t_{\text{tx}} + \tau_{\text{tx}} + \text{OWLT}$.
2. **Duplicate Prevention:** Status must be `ARRIVED`. Commands in `EXECUTED` or `FAILED` are rejected.
3. **Restricted Mode Protection:** Commands without `allowInSafeMode: true` are rejected when in `SAFE_MODE` or `PRELAUNCH_HOLD`.
4. **Acknowledgement Telemetry:** On execution or rejection, a unique telemetry packet `ack-<cmdId>-<met>` (priority 250, critical category) is queued into `TelemetryQueue`. It downlinks to Earth across the RF channel and arrives only after transmission duration + OWLT.

### E. Storage Retention & Return ACK Round-Trip Lifecycle

```
STORED -> QUEUED -> TRANSMITTING -> TRANSMITTED -> RECEIVED_EARTH -> EARTH_ACK_GENERATED -> ACK_RECEIVED_AETHON -> ELIGIBLE_FOR_PURGE -> DELETED
```

#### Round-Trip Lifecycle Sequence:
1. **Downlink Transmission:** AETHON transmits packet over an active DSN ground station pass.
2. **Downlink Propagation:** Final bit arrives at Earth station at $t_{\text{Earth}} = t_{\text{tx}} + \tau_{\text{tx}} + \text{OWLT}$.
3. **Earth Receipt & Ground ACK Generation:** Earth station logs receipt and generates a typed Ground Receipt Acknowledgement frame (`gack-<pktId>`).
4. **Uplink Return Propagation:** Ground ACK frame uplinks back to AETHON with transmission duration and OWLT.
5. **In-Transit Invariance:** While return ACK is in transit, AETHON has not received confirmation; packet is NOT marked `ACK_RECEIVED_AETHON`, is NOT eligible for purge, and memory is NOT released.
6. **AETHON Receipt:** At $t_{\text{return}} = t_{\text{Earth}} + \tau_{\text{uplink}} + \text{OWLT}$, the ground ACK arrives at AETHON; `ACK_RECEIVED_AETHON` is recorded.
7. **Retention Evaluation:** Retention policy evaluates grace period and critical-data protection.
8. **Explicit Purge:** `purgeEligiblePackets(storage, met)` explicitly erases eligible packets from `OnboardStorage` and frees memory bytes.

---

## 7. Phase 5.2 — Science Data Processing Pipeline

### A. Three-Level Processing Architecture

The Science Data Processing layer transforms raw instrument observations into calibrated data and derived scientific products:

- **Level 0 (Raw Ingestion):**
  - Ingests raw telemetry packets from `OnboardStorage` or sensor acquisition streams.
  - Validates packet headers, finite positive sampling intervals, sample counts, and sample checksums.
  - Preserves raw input data without mutation (deep freeze / defensive cloning).
  - Explicit error handling: Corrupted or malformed packets enter `REJECTED` state with detailed failure reasons; duplicate packet IDs are strictly rejected.
- **Level 1 (Calibration & Quality Assessment):**
  - Instrument-specific, versioned calibration profiles (e.g. `reason-cal-v1.0`, `maspex-cal-v1.0`).
  - Baseline noise floor subtraction and configurable receiver gain scaling.
  - Noise reduction and SNR calculation in decibels (dB).
  - Quality assessment assigning standardized flags: `NOMINAL`, `SATURATED`, `LOW_SNR`, `BASELINE_DRIFT`, `CALIBRATION_SUSPECT`, `UNRESOLVED_PEAKS`.
  - Invariant: A missing or invalid calibration profile strictly throws `MissingCalibrationProfileError` (never produces a false successful calibration).
- **Level 2 (Derived Science Products):**
  - Generates scientifically interpretable products while retaining end-to-end provenance back to Level 1 products and Level 0 raw packets.
  - Strictly preserves uncertainty metrics and embeds mandatory scientific limitations disclaimers.

### B. Instrument Models & Scientific Formulation

#### 1. REASON (Radar for Europa Assessment and Sounding: Ocean to Near-surface)
- **Category:** Dual-frequency ice-penetrating radar.
- **Processing:**
  - Waveform peak detection identifies primary surface reflection and subsequent subsurface reflector horizons.
  - Two-way travel time: $\Delta\tau = t_{\text{reflector}} - t_{\text{surface}}$.
  - Subsurface depth estimation:
    $$\text{depth} = \frac{c \cdot \Delta\tau}{2 \sqrt{\varepsilon_r}}$$
    Where $c = 299,792,458 \text{ m/s}$ and $\varepsilon_r$ is the relative dielectric permittivity of the medium.
  - Permittivity models: Supports configurable models (`COLD_PURE_ICE` $\varepsilon_r \approx 3.15$, `WARM_CONVECTING_ICE` $\varepsilon_r \approx 3.35$, `POROUS_ICE_FIRN` $\varepsilon_r \approx 2.20$, `SALINE_ICE` $\varepsilon_r \approx 4.50$). Higher permittivity yields shallower derived depths for identical travel times.
  - Depth uncertainty propagation (H-01):
    - Timing uncertainty from ADC half-bin discretization: $\sigma_\tau = \frac{\Delta t_{\text{sample}}}{2}$, yielding $\text{termTime} = \frac{c \cdot \Delta t_{\text{sample}}}{4\sqrt{\varepsilon_r}}$.
    - Permittivity uncertainty sensitivity: $\text{termEps} = d \cdot \frac{\sigma_{\varepsilon_r}}{2\varepsilon_r}$.
    - Standard 1-$\sigma$ Root-Sum-Square (RSS) uncertainty:
      $$\sigma_d = \sqrt{\left(\frac{c \cdot \Delta t_{\text{sample}}}{4\sqrt{\varepsilon_r}}\right)^2 + \left(d \cdot \frac{\sigma_{\varepsilon_r}}{2\varepsilon_r}\right)^2}$$
    - Conservative linear worst-case bound:
      $$\delta d_{\text{worst}} = \frac{c \cdot \Delta t_{\text{sample}}}{4\sqrt{\varepsilon_r}} + d \cdot \frac{\sigma_{\varepsilon_r}}{2\varepsilon_r}$$
  - Defensive boundary validation (H-05): Rejects non-positive sampling interval ($\Delta t \le 0$), non-positive relative permittivity ($\varepsilon_r \le 0$), negative permittivity uncertainty ($\sigma_{\varepsilon_r} < 0$), and non-finite echo waveform values with `InvalidRadarProcessingInputError`.
  - Disclaimer: Clearly labeled as a simplified radar model output; does not claim authoritative determination of Europa's actual ice thickness or ocean depth.

#### 2. MASPEX (MAss SPectrometer for Planetary EXploration)
- **Category:** High-resolution time-of-flight mass spectrometer.
- **Processing:**
  - Calibrated spectrum noise reduction and peak detection (measuring centroid $m/z$, intensity, FWHM, and mass resolution $m/\Delta m$).
  - Reference library matching against planetary volatile, organic, and scenario species with explicit tolerance modes (H-02 / C-03):
    - `COMBINED` (default): Candidate species must satisfy both absolute tolerance ($\Delta m \le \text{toleranceU}$, default 0.02 u) AND relative tolerance ($|m_{\text{obs}} - m_{\text{ref}}| / m_{\text{ref}} \times 10^6 \le \text{maxTolerancePpm}$, default 50.0 ppm). When options are omitted or empty, `COMBINED` is enforced by default. Reference-specific absolute tolerance overrides modify the absolute mass window but do not bypass the relative ppm threshold.
    - `ABSOLUTE_ONLY`: Evaluated purely against absolute atomic mass tolerance (explicitly configured via `tolerancePolicy: 'ABSOLUTE_ONLY'`).
    - `PPM_ONLY`: Evaluated purely against relative parts-per-million tolerance (explicitly configured via `tolerancePolicy: 'PPM_ONLY'`).
    - Match confidence scoring strictly reflects the active tolerance mode and boundary distance.
  - Defensive input validation: Rejects non-positive or non-finite mass tolerances and negative peak thresholds with `InvalidSpectrometerProcessingInputError`.
  - Provenance classification: Reference entries explicitly tag whether species are `VERIFIED` (e.g. $\text{H}_2\text{O}$ at 18.010565 u, $\text{CO}_2$ at 43.98983 u, $\text{CH}_4$ at 16.03130 u), `SIMPLIFIED` educational values (e.g. $\text{HCN}$, $\text{HCHO}$), or `FICTIONAL` mission scenario entries.
  - Relative abundance calculation: Total Ion Current (TIC) sum, base peak normalization (100%), and TIC fraction.
  - Disclaimer: Chemical assignments are candidate matches within instrument mass resolution tolerance and never presented as definitive molecular confirmation.

### C. Explainable Anomaly Detection Framework

Evaluates derived Level 2 products using quantitative, deterministic threshold rules:
- **Shallow Conductive Dielectric Anomaly:** Subsurface reflection coefficient $|R|^2 \ge 0.30$ at depth $< 5,000\text{ m}$ (candidate perched brine lens).
- **Basal Dielectric Transition:** Deep reflection $|R|^2 \ge 0.20$ at depth $\ge 15,000\text{ m}$ (candidate ice-ocean convective boundary).
- **Elevated Organics:** Volatile organic TIC fraction $\ge 20\%$.
- **Fictional Scenario Anomalies:** Matches to fictional markers (e.g. candidate organometallic or relic polymer) with confidence score $\ge 0.60$, flagged with `isFictionalScenarioAnomaly: true` and explicit narrative disclaimers.
- **Multi-Instrument Correlation (H-03 / C-01 / C-02 / N-01 / N-02):** Synchronous co-located subsurface radar discontinuity and exospheric organic plume detection generates critical correlated active cryovolcanic venting anomalies under strict gating criteria:
  - *Mandatory Observation Timing (C-01):* Both products must possess valid, non-negative, finite `acquisitionMET` timestamps. Silent fallback to `processingMET` is strictly prohibited. Observations must fall within $|t_{\text{REASON}} - t_{\text{MASPEX}}| \le \Delta MET_{\max}$ (default 600 s / 10 minutes).
  - *Quality Gating:* Strictly rejects correlation if either product carries degraded quality flags (`LOW_SNR`, `SATURATED`, `CALIBRATION_SUSPECT`).
  - *Provenance Verification:* Both products must trace back to valid, registered Level 0 packets.
  - *Mandatory Spatial Co-Location & Haversine Distance (C-02 / N-01):* Great-circle angular separation $\le \theta_{\max}$ (default 5.0°) is mandatory, computed using the numerically stable Haversine formula:
    $$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right), \quad \theta = 2 \operatorname{atan2}(\sqrt{\text{clamp}(a, 0, 1)}, \sqrt{1 - \text{clamp}(a, 0, 1)})$$
    Both observations must provide valid spherical coordinates ($\text{latitude} \in [-90^\circ, +90^\circ]$, $\text{longitude} \in [-180^\circ, +180^\circ]$). Missing or non-finite (`NaN`/`Infinity`) coordinates strictly reject joint correlation. The default $5.0^\circ$ separation limit is an explicit mission simulation/gameplay parameter for Expedition-V, not a formal NASA/JPL science standard.
  - *Threshold Configuration Validation (N-02):* Explicit correlation options (`maxCorrelationDeltaMET` $\ge 0$ and `maxSpatialSeparationDeg` $\in [0, 180]$) are defensively validated with `RangeError`. Zero values retain literal zero meaning (exact synchronization or exact coordinate co-location).

### D. Data Integrity & Checksum Verification (H-04)

- **Fletcher-16 Checksum:** Level 0 raw packets verify data integrity using a standard Fletcher-16 arithmetic checksum algorithm (mod 255), providing lightweight, deterministic data integrity validation across the telemetry ingestion boundary (distinguished from cyclic redundancy checks).

### E. Subsystem, Storage & Communications Integration

- **SAFE_MODE Inhibition:** Entering `SAFE_MODE` automatically commands `SciencePayloadSubsystem` to `SAFE`, powers down active emitters, and strictly blocks science observation execution.
- **Storage Protection:** Observations allocate bytes in `OnboardStorage`. If capacity is exceeded, `CapacityExceededError` is thrown, preventing silent packet loss.
- **Downlink & Purge Invariants:** Science products queued in `TelemetryQueue` downlink during visible DSN passes over OWLT, ground receipt triggers return ACK uplink, and `StorageRetentionManager` preserves data until explicit purge.

---

## 7. Mission Decision & Response Engine (Phase 5.3)

The Mission Decision & Response subsystem (`src/simulation/missionDecision/`) bridges scientific findings and anomaly detections from Phase 5.2 to real spacecraft engineering consequences and flight software command execution.

### A. Architectural Overview

```
                      +---------------------------------------+
                      |       Decision Evidence Manager       |
                      |  (Science Products, Anomalies, Telemetry)
                      +-------------------+-------------------+
                                          |
                                          v
      +-----------------------------------+-----------------------------------+
      |                                   |                                   |
      v                                   v                                   v
+------------------+            +--------------------+              +--------------------+
| Objective        |            | Option Generator   |              | Risk Assessment    |
| Evaluator        |            | & Context Builder  |              | Engine             |
+------------------+            +---------+----------+              +---------+----------+
                                          |                                   |
                                          v                                   v
                                +-----------------------------------------------+
                                |              Decision Validator               |
                                |    (FEASIBLE / INFEASIBLE / INCOMPLETE / EXPIRED)
                                +-----------------------+-----------------------+
                                                        |
                                                        v
                                +-----------------------------------------------+
                                |        Decision Authorization Engine          |
                                |     (PROPOSED -> APPROVED / REJECTED)         |
                                +-----------------------+-----------------------+
                                                        |
                                                        v
                                +-----------------------------------------------+
                                |              Decision Executor                |
                                |   (Pre-flight Revalidation & Safe-Mode Gate)  |
                                +-----------------------+-----------------------+
                                                        |
                                                        +-----------------------------------+
                                                        |                                   |
                                                        v                                   v
                                        +-------------------------------+   +-------------------------------+
                                        |    Consequence Engine         |   |    Decision History Tracker   |
                                        |  (Objectives, Resources,      |   |  (Immutable, Frozen Audit Log |
                                        |   Commands, Telemetry)        |   |   Keyed Strictly by MET)      |
                                        +-------------------------------+   +-------------------------------+
```

### B. Core Subsystem Modules

1. **`decisionEvidence.ts` (DecisionEvidenceManager):**
   - Ingests Level 2 science products, confirmed anomalies, subsystem statuses, and integrated engineering telemetry snapshots.
   - Preserves strict provenance (`VERIFIED`, `SIMPLIFIED`, `FICTIONAL`, `UNVERIFIED`).
   - Missing evidence is never interpreted as confirmed discovery.
   - Fictional constructs (e.g., Relic-Omega narrative elements) are strictly flagged (`isFictionalConstruct: true`) and prevented from fulfilling physical science objectives.

2. **`missionObjectiveEvaluator.ts` (MissionObjectiveEvaluator):**
   - Deterministic evaluation of mission objectives (`NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `COMPLETED`, `FAILED`).
   - Prerequisite gating: Unmet prerequisites lock objectives in `BLOCKED` status.
   - Deadline enforcement: Missing deadlines transitions objectives to `FAILED` with explicit MET failure reasons.
   - Pre-configured with Expedition-V objectives:
     - `EXP-V-OBJ-01`: Subsurface Ocean Acoustic/Radar Characterization (REASON).
     - `EXP-V-OBJ-02`: Plume Volatile & Organic Signature Detection (MASPEX).
     - `EXP-V-OBJ-03`: Co-located Hydrothermal Ocean Anomaly Verification.
     - `EXP-V-OBJ-04`: Deep Space Network Telemetry Downlink.
     - `EXP-V-OBJ-05`: Europa Surface Lander Deployment Readiness.

3. **`riskAssessment.ts` (RiskAssessmentEngine):**
   - Quantitative evaluation of candidate decisions against spacecraft safety, active critical faults, power margins, thermal operating boundaries, propellant budgets, storage headroom, and DSN visibility.
   - Hard aerospace constraints (active critical faults, `SAFE_MODE`, power deficits, thermal breaches) strictly cannot be overridden by high scientific-return scores.
   - Risk scores are explicitly labeled as deterministic engineering heuristics in $[0.0, 100.0]$, not physical or Bayesian probabilities.

4. **`decisionOptionGenerator.ts` (DecisionOptionGenerator):**
   - Contextual synthesis of aerospace response options grounded in verified evidence:
     - `CONTINUE_INVESTIGATION`: Science surveys along current flyby track.
     - `PRIORITIZE_ANOMALY`: Sensor reconfiguration focused on confirmed anomaly features.
     - `PRESERVE_SPACECRAFT`: Load-shedding and thermal conservation.
     - `TRANSMIT_FINDINGS`: Queue science telemetry for Earth downlink.
     - `DEPLOY_LANDER`: Surface lander deployment sequence (strictly requires `LANDER_ROVER` subsystem architecture and surface reconnaissance).
     - `ABORT_OR_SUSPEND`: Controlled operational suspension / transition to `SAFE_MODE`.

5. **`decisionValidator.ts` (DecisionValidator):**
   - Validates options into 4 deterministic states:
     - `FEASIBLE`: All engineering prerequisites, power margins, and safety gates satisfied.
     - `INFEASIBLE`: Hard safety constraints violated or physical resource shortages.
     - `INCOMPLETE`: Missing engineering telemetry measurements (distinguished from resource shortages; incomplete options are NEVER presented as feasible).
     - `EXPIRED`: Operational MET expiration deadline has passed.

6. **`decisionAuthorization.ts` (DecisionAuthorizationEngine):**
   - Enforces the strict decision lifecycle:
     $$\text{PROPOSED} \longrightarrow \text{APPROVED} \Big/ \text{REJECTED} \longrightarrow \text{EXECUTING} \longrightarrow \text{EXECUTED} \Big/ \text{FAILED}$$
   - Only explicitly approved decisions may execute. Rejected or expired decisions cannot execute.
   - Duplicate execution and duplicate proposals are strictly prevented.

7. **`decisionExecutor.ts` (DecisionExecutor):**
   - Executes approved decisions through existing flight software avionics:
     - Dispatches typed `CommandPacket`s through `CommandExecutor`.
     - Reconfigures subsystems through `SubsystemManager` and `SciencePayloadSubsystem`.
     - Queues telemetry frames through `TelemetryQueue` and `CommunicationManager`.
     - Safe-mode authority: SAFE_MODE restrictions remain authoritative.
   - Pre-flight Revalidation Gate: Re-validates spacecraft health immediately prior to execution; if conditions changed (e.g. safe-mode triggered), execution safely aborts.

8. **`missionConsequenceEngine.ts` (MissionConsequenceEngine):**
   - Records explicit, traceable consequences: objective progression, resource expenditure, subsystem state changes, telemetry frames queued, and flight commands dispatched.

9. **`decisionHistory.ts` (DecisionHistoryTracker):**
   - Maintains an append-only, immutable audit log of all decision proposals, validations, authorizations, execution telemetry, and consequences.
   - Keyed strictly by Mission Elapsed Time (MET) seconds, never wall-clock time (`Date.now()`).
   - History snapshots are frozen (`Object.freeze`) to prevent retroactive tampering.

10. **`missionDecisionManager.ts` (MissionDecisionManager):**
    - High-level coordinator wiring all decision modules with `FlightComputer`, `CommunicationManager`, `ScienceProcessingManager`, and `MissionEventEngine`.
