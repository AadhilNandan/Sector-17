/**
 * SECTOR 17 — Communications Module Entry Point
 * Exports all ground stations, signal propagation, link budget,
 * data transmission, queues, onboard storage, and manager services.
 */

export * from './constants';
export * from './types';
export * from './groundStations';
export * from './signalPropagation';
export * from './linkBudget';
export * from './communicationWindows';
export * from './dataTransmission';
export * from './onboardStorage';
export * from './commandQueue';
export * from './telemetryQueue';
export * from './communicationManager';
