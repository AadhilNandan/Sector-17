/**
 * SECTOR 17 — Deep-Space Communications & Ground Segment Types
 * Strict typing for ground stations, signal propagation, RF link budgets,
 * data queues, onboard storage, and event integration.
 */

export type FrequencyBand = 'S' | 'X' | 'Ka';

export interface StationBlackoutPeriod {
  startMETSeconds: number;
  endMETSeconds: number;
  reason?: string;
}

export interface GroundStation {
  /** Unique station identifier (e.g. 'DSN-GOLDSTONE-70M') */
  id: string;
  /** Human-readable station name */
  name: string;
  /** Geographic latitude in degrees [-90, +90] */
  latitudeDeg: number;
  /** Geographic longitude in degrees [-180, +180] */
  longitudeDeg: number;
  /** Altitude above sea level in metres */
  altitudeMetres?: number;
  /** Primary antenna aperture diameter in metres */
  antennaDiameterMetres: number;
  /** Supported deep space frequency bands */
  supportedBands: FrequencyBand[];
  /** Maximum RF power amplifier output in Watts */
  maxTransmitPowerWatts: number;
  /** Antenna aperture efficiency [0, 1] (default: 0.65) */
  antennaEfficiency?: number;
  /** Explicit calibrated antenna gain in dBi if known */
  antennaGainDbi?: number;
  /** Total receiver system noise temperature in Kelvin (T_sys > 0) */
  systemNoiseTempKelvin: number;
  /** Minimum allowable elevation angle above horizon in degrees [0, 90) */
  minElevationDeg: number;
  /** Operational availability factor [0, 1] */
  operationalAvailability: number;
  /** Planned maintenance or outage time windows */
  blackouts?: StationBlackoutPeriod[];
  /** Flag denoting illustrative / educational reference parameters */
  isIllustrative?: boolean;
}

export interface SpacecraftPointingTarget {
  /** Sub-spacecraft latitude on Earth in degrees [-90, 90] */
  subSpacecraftLatitudeDeg: number;
  /** Sub-spacecraft longitude on Earth in degrees [-180, 180] */
  subSpacecraftLongitudeDeg: number;
  /** Distance from Earth center to spacecraft in metres */
  distanceMetres: number;
}

export interface VisibilityResult {
  stationId: string;
  isVisible: boolean;
  elevationDeg: number;
  azimuthDeg?: number;
  reason?: string;
}

export interface CommunicationWindow {
  id: string;
  stationId: string;
  startMETSeconds: number;
  endMETSeconds: number;
  durationSeconds: number;
  maxElevationDeg: number;
  averageDistanceMetres: number;
}

/* -------------------------------------------------------------------------- */
/* Signal Propagation Types                                                   */
/* -------------------------------------------------------------------------- */

export interface PropagationDelayResult {
  distanceMetres: number;
  distanceKm: number;
  distanceAu: number;
  oneWayLightTimeSeconds: number;
  roundTripLightTimeSeconds: number;
}

export interface SignalTimelineInput {
  txStartTimeMETSeconds: number;
  dataSizeBytes: number;
  dataRateBps: number;
  distanceMetres: number;
  processingDelaySeconds?: number;
  ackSizeBytes?: number;
  ackDataRateBps?: number;
}

export interface SignalTimelineResult {
  txStartTimeMETSeconds: number;
  txDurationSeconds: number;
  txEndTimeMETSeconds: number;
  rxStartTimeMETSeconds: number;
  rxEndTimeMETSeconds: number;
  oneWayLightTimeSeconds: number;
  roundTripLightTimeSeconds: number;
  processingDelaySeconds: number;
  ackTxStartTimeMETSeconds?: number;
  ackTxEndTimeMETSeconds?: number;
  ackRxEndTimeMETSeconds?: number;
}

/* -------------------------------------------------------------------------- */
/* RF Link Budget Types                                                       */
/* -------------------------------------------------------------------------- */

export interface LinkBudgetInput {
  /** RF Transmitter power in Watts (P_t > 0) */
  transmitPowerWatts: number;
  /** Transmit antenna diameter in metres (used to calculate gain if not specified) */
  transmitAntennaDiameterMetres?: number;
  /** Transmit antenna efficiency [0, 1] */
  transmitAntennaEfficiency?: number;
  /** Explicit transmit antenna gain in dBi (takes precedence over diameter) */
  transmitAntennaGainDbi?: number;

  /** Receive antenna diameter in metres */
  receiveAntennaDiameterMetres?: number;
  /** Receive antenna efficiency [0, 1] */
  receiveAntennaEfficiency?: number;
  /** Explicit receive antenna gain in dBi (takes precedence over diameter) */
  receiveAntennaGainDbi?: number;

  /** Operating carrier frequency in Hertz (f > 0) */
  carrierFrequencyHz: number;
  /** Transmission slant distance in metres (d > 0) */
  distanceMetres: number;
  /** Equivalent receiver system noise temperature in Kelvin (T_sys > 0) */
  systemNoiseTempKelvin: number;

  /** Target transmission data rate in bits per second */
  dataRateBps?: number;
  /** Transmitter line / feeder losses in dB (positive value, subtracted) */
  transmitLossesDb?: number;
  /** Receiver feeder losses in dB */
  receiveLossesDb?: number;
  /** Atmospheric / tropospheric / ionospheric absorption losses in dB */
  atmosphericLossesDb?: number;
  /** Antenna pointing mispointing losses in dB */
  pointingLossesDb?: number;

  /** Required Energy per Bit to Noise Power Spectral Density ratio in dB */
  requiredEbN0Db?: number;
  /** Required operational link margin in dB (default: 3.0 dB) */
  requiredMarginDb?: number;
  /** Channel receiver bandwidth in Hertz for SNR and Shannon capacity */
  bandwidthHz?: number;
}

export interface LinkBudgetResult {
  carrierFrequencyHz: number;
  wavelengthMetres: number;
  distanceMetres: number;
  freeSpacePathLossDb: number;
  transmitGainDbi: number;
  receiveGainDbi: number;
  eirpDbw: number;
  totalLossesDb: number;
  receivedPowerDbw: number;
  receivedPowerWatts: number;
  noiseSpectralDensityDbwHz: number;
  carrierToNoiseDensityDbHz: number;
  achievedEbN0Db?: number;
  requiredEbN0Db: number;
  linkMarginDb?: number;
  requiredMarginDb: number;
  isFeasible: boolean;
  maxAchievableDataRateBps: number;
  shannonCapacityBps?: number;
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Data Storage & Queues Types                                                */
/* -------------------------------------------------------------------------- */

export type DataCategory = 'engineering' | 'science' | 'critical';

export type PacketState = 'STORED' | 'QUEUED' | 'TRANSMITTING' | 'TRANSMITTED' | 'ACKNOWLEDGED';

export interface StoragePacket<T = unknown> {
  id: string;
  category: DataCategory;
  sizeBytes: number;
  priority: number;
  createdAtMETSeconds: number;
  payload?: T;
  state: PacketState;
}

export interface StorageState {
  totalCapacityBytes: number;
  usedStorageBytes: number;
  availableStorageBytes: number;
  packetCount: number;
  categoryBreakdownBytes: Record<DataCategory, number>;
}

export type CommandStatus =
  | 'QUEUED'
  | 'TRANSMITTING'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'EXECUTED'
  | 'FAILED';

export interface CommandPacket<T = unknown> {
  id: string;
  type: string;
  payload: T;
  priority: number;
  sizeBytes: number;
  scheduledTxTimeMET: number;
  txDurationSeconds: number;
  oneWayLightTimeSeconds: number;
  arrivalMETSeconds: number;
  status: CommandStatus;
  executionError?: string;
  result?: unknown;
}

export type TelemetryStatus =
  | 'QUEUED'
  | 'TRANSMITTING'
  | 'IN_TRANSIT'
  | 'RECEIVED_EARTH'
  | 'ACKNOWLEDGED'
  | 'INTERRUPTED';

export interface TelemetryPacket<T = unknown> {
  id: string;
  category: DataCategory;
  payload: T;
  priority: number;
  sizeBytes: number;
  transmittedBytes: number;
  status: TelemetryStatus;
  scheduledTxTimeMET?: number;
  txDurationSeconds?: number;
  earthReceiptTimeMET?: number;
}

export interface GroundReceiptAckFrame {
  id: string;
  packetId: string;
  groundStationId: string;
  generatedAtMET: number;
  scheduledTxTimeMET: number;
  txDurationSeconds: number;
  oneWayLightTimeSeconds: number;
  arrivalMETSeconds: number;
  status: 'QUEUED' | 'TRANSMITTING' | 'IN_TRANSIT' | 'ARRIVED';
}

export interface TransmissionStepResult {
  bytesTransferred: number;
  remainingBytes: number;
  isComplete: boolean;
  durationUsedSeconds: number;
  wasInterrupted: boolean;
}

/* -------------------------------------------------------------------------- */
/* Manager Types                                                              */
/* -------------------------------------------------------------------------- */

export interface CommunicationManagerConfig {
  groundStations?: GroundStation[];
  storageCapacityBytes?: number;
  defaultFrequencyHz?: number;
  defaultRequiredMarginDb?: number;
  /**
   * If true (default), CommunicationManager marks arrived commands as executed automatically.
   * When false (used by FlightComputer), commands remain ARRIVED for CommandExecutor to process.
   */
  autoExecuteCommands?: boolean;
  /**
   * If true (default), CommunicationManager automatically schedules return uplink acknowledgement
   * frames back to AETHON upon receipt of downlinked telemetry at Earth.
   */
  autoGenerateGroundAcks?: boolean;
}

export interface CommStepReport {
  metSeconds: number;
  activeStationIds: string[];
  commandsTransmitted: number;
  commandsArrived: number;
  commandsExecuted: number;
  telemetryBytesTransferred: number;
  activeDownlinkPacketId?: string;
  isDownlinkActive: boolean;
}
