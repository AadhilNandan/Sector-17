/**
 * SECTOR 17 — Science Data Registry
 * Central, immutable repository managing Level 0, Level 1, and Level 2 science products.
 *
 * SAFETY INVARIANTS:
 * 1. Immutability: Products entered into the registry are frozen and cannot be modified.
 * 2. Traceability: Enforces strict provenance linking across processing levels (L2 -> L1 -> L0).
 * 3. Deterministic query access: Provides predictable querying without modifying underlying data.
 */

import type {
  Level0Product,
  Level1Product,
  ScienceProductLevel2,
  ReasonLevel2Product,
  MaspexLevel2Product,
  InstrumentType,
} from './types';

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export class ScienceDataRegistry {
  private level0Products: Map<string, Level0Product> = new Map();
  private level1Products: Map<string, Level1Product> = new Map();
  private level2Products: Map<string, ScienceProductLevel2> = new Map();

  // Indexing maps for rapid provenance resolution
  private l0ByPacketId: Map<string, string> = new Map(); // packetId -> l0Id
  private l1ByL0Id: Map<string, string[]> = new Map(); // l0Id -> l1Ids
  private l2ByL1Id: Map<string, string[]> = new Map(); // l1Id -> l2Ids

  /* -------------------------------------------------------------------------- */
  /* Level 0 Product Registration                                               */
  /* -------------------------------------------------------------------------- */

  public registerLevel0(product: Level0Product): Level0Product {
    if (!product || !product.id || !product.packetId) {
      throw new TypeError('registerLevel0: Product must have valid id and packetId.');
    }
    if (this.level0Products.has(product.id)) {
      throw new Error(`registerLevel0: Duplicate Level 0 product ID '${product.id}'.`);
    }
    if (this.l0ByPacketId.has(product.packetId)) {
      throw new Error(`registerLevel0: Packet ID '${product.packetId}' is already registered as Level 0.`);
    }

    const cloned = deepFreeze(JSON.parse(JSON.stringify(product)));
    this.level0Products.set(cloned.id, cloned);
    this.l0ByPacketId.set(cloned.packetId, cloned.id);
    return cloned;
  }

  public getLevel0(id: string): Level0Product | undefined {
    return this.level0Products.get(id);
  }

  public getLevel0ByPacketId(packetId: string): Level0Product | undefined {
    const id = this.l0ByPacketId.get(packetId);
    return id ? this.level0Products.get(id) : undefined;
  }

  public getAllLevel0(): Level0Product[] {
    return Array.from(this.level0Products.values());
  }

  /* -------------------------------------------------------------------------- */
  /* Level 1 Product Registration                                               */
  /* -------------------------------------------------------------------------- */

  public registerLevel1(product: Level1Product): Level1Product {
    if (!product || !product.id || !product.level0Id) {
      throw new TypeError('registerLevel1: Product must have valid id and level0Id.');
    }
    if (this.level1Products.has(product.id)) {
      throw new Error(`registerLevel1: Duplicate Level 1 product ID '${product.id}'.`);
    }
    if (!this.level0Products.has(product.level0Id)) {
      throw new Error(`registerLevel1: Source Level 0 product '${product.level0Id}' does not exist.`);
    }

    const cloned = deepFreeze(JSON.parse(JSON.stringify(product)));
    this.level1Products.set(cloned.id, cloned);

    const list = this.l1ByL0Id.get(cloned.level0Id) || [];
    list.push(cloned.id);
    this.l1ByL0Id.set(cloned.level0Id, list);

    return cloned;
  }

  public getLevel1(id: string): Level1Product | undefined {
    return this.level1Products.get(id);
  }

  public getLevel1ForLevel0(level0Id: string): Level1Product[] {
    const ids = this.l1ByL0Id.get(level0Id) || [];
    return ids.map((id) => this.level1Products.get(id)!).filter(Boolean);
  }

  public getAllLevel1(): Level1Product[] {
    return Array.from(this.level1Products.values());
  }

  /* -------------------------------------------------------------------------- */
  /* Level 2 Product Registration                                               */
  /* -------------------------------------------------------------------------- */

  public registerLevel2(product: ScienceProductLevel2): ScienceProductLevel2 {
    if (!product || !product.id || !product.level1Id) {
      throw new TypeError('registerLevel2: Product must have valid id and level1Id.');
    }
    if (this.level2Products.has(product.id)) {
      throw new Error(`registerLevel2: Duplicate Level 2 product ID '${product.id}'.`);
    }
    if (!this.level1Products.has(product.level1Id)) {
      throw new Error(`registerLevel2: Source Level 1 product '${product.level1Id}' does not exist.`);
    }

    const cloned = deepFreeze(JSON.parse(JSON.stringify(product)));
    this.level2Products.set(cloned.id, cloned);

    const list = this.l2ByL1Id.get(cloned.level1Id) || [];
    list.push(cloned.id);
    this.l2ByL1Id.set(cloned.level1Id, list);

    return cloned;
  }

  public getLevel2(id: string): ScienceProductLevel2 | undefined {
    return this.level2Products.get(id);
  }

  public getLevel2Reason(id: string): ReasonLevel2Product | undefined {
    const prod = this.level2Products.get(id);
    return prod && prod.instrument === 'REASON' ? (prod as ReasonLevel2Product) : undefined;
  }

  public getLevel2Maspex(id: string): MaspexLevel2Product | undefined {
    const prod = this.level2Products.get(id);
    return prod && prod.instrument === 'MASPEX' ? (prod as MaspexLevel2Product) : undefined;
  }

  public getLevel2ForLevel1(level1Id: string): ScienceProductLevel2[] {
    const ids = this.l2ByL1Id.get(level1Id) || [];
    return ids.map((id) => this.level2Products.get(id)!).filter(Boolean);
  }

  public getAllLevel2(): ScienceProductLevel2[] {
    return Array.from(this.level2Products.values());
  }

  public getLevel2ByInstrument(instrument: InstrumentType): ScienceProductLevel2[] {
    return Array.from(this.level2Products.values()).filter((p) => p.instrument === instrument);
  }

  /* -------------------------------------------------------------------------- */
  /* Provenance Verification                                                    */
  /* -------------------------------------------------------------------------- */

  public verifyProvenance(level2Id: string): {
    isValid: boolean;
    level2?: ScienceProductLevel2;
    level1?: Level1Product;
    level0?: Level0Product;
    error?: string;
  } {
    const l2 = this.level2Products.get(level2Id);
    if (!l2) {
      return { isValid: false, error: `Level 2 product '${level2Id}' not found.` };
    }
    const l1 = this.level1Products.get(l2.level1Id);
    if (!l1) {
      return { isValid: false, error: `Parent Level 1 product '${l2.level1Id}' not found.` };
    }
    const l0 = this.level0Products.get(l1.level0Id);
    if (!l0) {
      return { isValid: false, error: `Parent Level 0 product '${l1.level0Id}' not found.` };
    }
    if (l0.packetId !== l2.level0PacketId) {
      return {
        isValid: false,
        error: `Provenance mismatch: L2 references packetId '${l2.level0PacketId}' but L0 has '${l0.packetId}'.`,
      };
    }
    return { isValid: true, level2: l2, level1: l1, level0: l0 };
  }

  public clear(): void {
    this.level0Products.clear();
    this.level1Products.clear();
    this.level2Products.clear();
    this.l0ByPacketId.clear();
    this.l1ByL0Id.clear();
    this.l2ByL1Id.clear();
  }

  public restoreProducts(l0: Level0Product[], l1: Level1Product[], l2: ScienceProductLevel2[]): void {
    this.clear();
    for (const p of l0) {
      const cloned = deepFreeze(JSON.parse(JSON.stringify(p)));
      this.level0Products.set(cloned.id, cloned);
      this.l0ByPacketId.set(cloned.packetId, cloned.id);
    }
    for (const p of l1) {
      const cloned = deepFreeze(JSON.parse(JSON.stringify(p)));
      this.level1Products.set(cloned.id, cloned);
      const existing = this.l1ByL0Id.get(cloned.level0Id) || [];
      existing.push(cloned.id);
      this.l1ByL0Id.set(cloned.level0Id, existing);
    }
    for (const p of l2) {
      const cloned = deepFreeze(JSON.parse(JSON.stringify(p)));
      this.level2Products.set(cloned.id, cloned);
      const existing = this.l2ByL1Id.get(cloned.level1Id) || [];
      existing.push(cloned.id);
      this.l2ByL1Id.set(cloned.level1Id, existing);
    }
  }
}

