/**
 * SECTOR 17 — Onboard Data Storage Model
 * Tracks spacecraft mass storage memory partitions, total/used/available bytes,
 * packet lifecycle states (STORED -> QUEUED -> TRANSMITTED -> ACKNOWLEDGED),
 * and strictly prevents silent data loss or capacity overflow.
 */

import { DEFAULT_STORAGE_CAPACITY_BYTES } from './constants';
import type { DataCategory, StoragePacket, StorageState } from './types';

export class CapacityExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CapacityExceededError';
  }
}

/**
 * Onboard Solid-State Mass Memory Recorder (SSMR)
 */
export class OnboardStorage {
  private totalCapacityBytes: number;
  private packets: Map<string, StoragePacket> = new Map();

  constructor(totalCapacityBytes: number = DEFAULT_STORAGE_CAPACITY_BYTES) {
    if (typeof totalCapacityBytes !== 'number' || !Number.isFinite(totalCapacityBytes) || totalCapacityBytes <= 0) {
      throw new RangeError(`OnboardStorage: totalCapacityBytes must be a positive number. Received: ${totalCapacityBytes}`);
    }
    this.totalCapacityBytes = totalCapacityBytes;
  }

  public getTotalCapacityBytes(): number {
    return this.totalCapacityBytes;
  }

  public getUsedStorageBytes(): number {
    let used = 0;
    for (const packet of this.packets.values()) {
      used += packet.sizeBytes;
    }
    return used;
  }

  public getAvailableStorageBytes(): number {
    return Math.max(0, this.totalCapacityBytes - this.getUsedStorageBytes());
  }

  public getStorageState(): StorageState {
    let used = 0;
    const categoryBreakdown: Record<DataCategory, number> = {
      engineering: 0,
      science: 0,
      critical: 0,
    };

    for (const p of this.packets.values()) {
      used += p.sizeBytes;
      categoryBreakdown[p.category] = (categoryBreakdown[p.category] || 0) + p.sizeBytes;
    }

    return {
      totalCapacityBytes: this.totalCapacityBytes,
      usedStorageBytes: used,
      availableStorageBytes: Math.max(0, this.totalCapacityBytes - used),
      packetCount: this.packets.size,
      categoryBreakdownBytes: categoryBreakdown,
    };
  }

  /**
   * Stores a newly generated scientific or telemetry data packet in onboard storage.
   *
   * @param packet StoragePacket
   * @throws TypeError if packet is invalid
   * @throws Error if packet ID is already present
   * @throws CapacityExceededError if writing packet would exceed total storage capacity
   */
  public storeData<T = unknown>(packet: Omit<StoragePacket<T>, 'state'>): StoragePacket<T> {
    if (!packet || typeof packet !== 'object') {
      throw new TypeError('OnboardStorage.storeData: Packet must be an object.');
    }
    if (!packet.id || typeof packet.id !== 'string' || packet.id.trim().length === 0) {
      throw new TypeError('OnboardStorage.storeData: Packet ID must be a non-empty string.');
    }
    const id = packet.id.trim();
    if (this.packets.has(id)) {
      throw new Error(`OnboardStorage.storeData: Duplicate packet ID '${id}'. An identical packet is already stored.`);
    }

    const validCategories: DataCategory[] = ['engineering', 'science', 'critical'];
    if (!validCategories.includes(packet.category)) {
      throw new TypeError(`OnboardStorage.storeData: Invalid category '${packet.category}'.`);
    }

    if (typeof packet.sizeBytes !== 'number' || !Number.isFinite(packet.sizeBytes) || packet.sizeBytes < 0) {
      throw new RangeError(`OnboardStorage.storeData: sizeBytes must be a non-negative finite number. Received: ${packet.sizeBytes}`);
    }

    const available = this.getAvailableStorageBytes();
    if (packet.sizeBytes > available) {
      throw new CapacityExceededError(
        `OnboardStorage.storeData: Cannot store packet '${id}' (${packet.sizeBytes} bytes). Insufficient storage capacity (available: ${available} bytes, capacity: ${this.totalCapacityBytes} bytes).`
      );
    }

    const priority = packet.priority !== undefined ? packet.priority : 100;
    const createdAtMET = packet.createdAtMETSeconds !== undefined ? packet.createdAtMETSeconds : 0;

    const storedPacket: StoragePacket<T> = {
      id,
      category: packet.category,
      sizeBytes: packet.sizeBytes,
      priority,
      createdAtMETSeconds: createdAtMET,
      payload: packet.payload as T,
      state: 'STORED',
    };

    this.packets.set(id, storedPacket as StoragePacket);
    return { ...storedPacket };
  }

  /**
   * Transactionally stores a batch of data packets into onboard storage.
   * If all packets are valid and capacity suffices, all are committed.
   * If any packet fails, all previously inserted packets from this batch are rolled back.
   *
   * @param packets Array of packets to store
   * @returns Array of successfully stored packets
   * @throws CapacityExceededError if total batch exceeds available storage
   * @throws Error on duplicate ID or invalid packet format
   */
  public storeDataBatch<T = unknown>(packets: readonly Omit<StoragePacket<T>, 'state'>[]): StoragePacket<T>[] {
    if (!packets || !Array.isArray(packets)) {
      throw new TypeError('OnboardStorage.storeDataBatch: packets must be an array.');
    }
    if (packets.length === 0) {
      return [];
    }

    // 1. Pre-validate total capacity for entire batch
    const totalBatchBytes = packets.reduce((acc, p) => acc + (p?.sizeBytes ?? 0), 0);
    const available = this.getAvailableStorageBytes();
    if (totalBatchBytes > available) {
      throw new CapacityExceededError(
        `OnboardStorage.storeDataBatch: Batch size (${totalBatchBytes} bytes) exceeds available storage (${available} bytes, capacity: ${this.totalCapacityBytes} bytes).`
      );
    }

    // 2. Pre-validate each packet for uniqueness within batch and against existing storage
    const stagedIds = new Set<string>();
    for (const p of packets) {
      if (!p || typeof p !== 'object') {
        throw new TypeError('OnboardStorage.storeDataBatch: Packet must be an object.');
      }
      if (!p.id || typeof p.id !== 'string' || p.id.trim().length === 0) {
        throw new TypeError('OnboardStorage.storeDataBatch: Packet ID must be a non-empty string.');
      }
      const id = p.id.trim();
      if (this.packets.has(id)) {
        throw new Error(`OnboardStorage.storeData: Duplicate packet ID '${id}'. An identical packet is already stored.`);
      }
      if (stagedIds.has(id)) {
        throw new Error(`OnboardStorage.storeDataBatch: Duplicate packet ID '${id}' detected within the incoming batch.`);
      }
      stagedIds.add(id);
    }

    // 3. Sequential insertion with compensating rollback on any error
    const insertedIds: string[] = [];
    const storedList: StoragePacket<T>[] = [];

    try {
      for (const p of packets) {
        const stored = this.storeData<T>(p);
        storedList.push(stored);
        insertedIds.push(stored.id);
      }
      return storedList;
    } catch (err) {
      // Compensating rollback: delete all packets inserted during this batch attempt
      for (const id of insertedIds) {
        this.packets.delete(id);
      }
      throw err;
    }
  }

  /**
   * Retrieves a stored packet by ID.
   */
  public getPacket(id: string): StoragePacket | undefined {
    const p = this.packets.get(id);
    return p ? { ...p } : undefined;
  }

  /**
   * Updates a packet's transmission state.
   */
  public setPacketState(id: string, newState: StoragePacket['state']): boolean {
    const p = this.packets.get(id);
    if (!p) return false;
    p.state = newState;
    return true;
  }

  /**
   * Explicitly deletes a packet from onboard storage.
   *
   * @param id Packet ID to remove
   * @returns true if deleted, false if not found
   */
  public deletePacket(id: string): boolean {
    return this.packets.delete(id);
  }

  /**
   * Clears all stored data and resets used memory.
   */
  public clear(): void {
    this.packets.clear();
  }

  /**
   * Returns all stored packets.
   */
  public getAllPackets(): StoragePacket[] {
    return Array.from(this.packets.values()).map((p) => ({ ...p }));
  }

  public restorePackets(packets: StoragePacket[]): void {
    this.packets.clear();
    for (const p of packets) {
      this.packets.set(p.id, { ...p });
    }
  }
}
