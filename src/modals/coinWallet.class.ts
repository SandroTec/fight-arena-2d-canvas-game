import { getWeapon, type WeaponId, WEAPONS } from './weaponCatalog.ts';

const STORAGE_KEY = 'fight-arena.coins.v1';
const WEAPON_STORAGE_KEY = 'fight-arena.weapons.v1';
const LEGACY_SHARP_BLADE_KEY = 'fight-arena.upgrades.sharp-blade.v1';

interface SavedWeaponState {
  owned: WeaponId[];
  upgrades: Partial<Record<WeaponId, number>>;
  selected: WeaponId;
  legacySwordBonus?: number;
}

/** Keeps coins, weapon ownership, upgrades, and selection in browser storage. */
export class CoinWallet {
  private balance = 0;
  private readonly owned = new Set<WeaponId>(['sword']);
  private readonly upgrades: Record<WeaponId, number> = { sword: 0, scimitar: 0, warblade: 0 };
  private legacySwordBonus = 0;
  private selected: WeaponId = 'sword';
  private readonly storage?: Storage;

  constructor() {
    try {
      this.storage = window.localStorage;
      const storedBalance = this.storage.getItem(STORAGE_KEY);
      const parsedBalance = storedBalance === null ? 0 : Number(storedBalance);
      if (Number.isSafeInteger(parsedBalance) && parsedBalance >= 0) this.balance = parsedBalance;

      const savedState = this.storage.getItem(WEAPON_STORAGE_KEY);
      if (savedState) this.loadWeaponState(JSON.parse(savedState) as SavedWeaponState);
      else if (this.storage.getItem(LEGACY_SHARP_BLADE_KEY) === 'true') this.legacySwordBonus = 5;
    } catch {
      // The in-memory progress still works if browser storage is unavailable or invalid.
    }
  }

  get coins(): number { return this.balance; }
  get selectedWeapon(): WeaponId { return this.selected; }
  get selectedDamage(): number { return this.getDamage(this.selected); }

  getDamage(weaponId: WeaponId): number {
    return getWeapon(weaponId).baseDamage + (weaponId === 'sword' ? this.legacySwordBonus : 0) + getWeapon(weaponId).damagePerUpgrade
      .slice(0, this.upgrades[weaponId])
      .reduce((total, damage) => total + damage, 0);
  }

  getUpgradeLevel(weaponId: WeaponId): number { return this.upgrades[weaponId]; }
  ownsWeapon(weaponId: WeaponId): boolean { return this.owned.has(weaponId); }

  selectWeapon(weaponId: WeaponId): boolean {
    if (!this.owned.has(weaponId)) return false;
    this.selected = weaponId;
    this.save();
    return true;
  }

  purchaseWeapon(weaponId: WeaponId): boolean {
    const weapon = getWeapon(weaponId);
    if (this.owned.has(weaponId) || !this.spend(weapon.purchaseCost)) return false;
    this.owned.add(weaponId);
    this.save();
    return true;
  }

  purchaseUpgrade(weaponId: WeaponId): boolean {
    const level = this.upgrades[weaponId];
    const weapon = getWeapon(weaponId);
    if (!this.owned.has(weaponId) || level >= weapon.upgradeCosts.length) return false;
    if (!this.spend(weapon.upgradeCosts[level])) return false;
    this.upgrades[weaponId] += 1;
    this.save();
    return true;
  }

  add(amount: number): number {
    const reward = Number.isSafeInteger(amount) ? Math.max(0, amount) : 0;
    this.balance += reward;
    this.save();
    return this.balance;
  }

  private spend(cost: number): boolean {
    if (!Number.isSafeInteger(cost) || cost < 0 || this.balance < cost) return false;
    this.balance -= cost;
    return true;
  }

  private loadWeaponState(state: SavedWeaponState): void {
    for (const weapon of WEAPONS) {
      if (weapon.id !== 'sword' && state.owned?.includes(weapon.id)) this.owned.add(weapon.id);
      const level = state.upgrades?.[weapon.id];
      if (Number.isInteger(level)) this.upgrades[weapon.id] = Math.max(0, Math.min(3, level as number));
    }
    if (Number.isSafeInteger(state.legacySwordBonus) && (state.legacySwordBonus ?? 0) > 0) {
      this.legacySwordBonus = state.legacySwordBonus as number;
    }
    if (state.selected && this.owned.has(state.selected)) this.selected = state.selected;
  }

  private save(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, String(this.balance));
      const state: SavedWeaponState = {
        owned: [...this.owned],
        upgrades: this.upgrades,
        selected: this.selected,
        legacySwordBonus: this.legacySwordBonus,
      };
      this.storage?.setItem(WEAPON_STORAGE_KEY, JSON.stringify(state));
      this.storage?.removeItem(LEGACY_SHARP_BLADE_KEY);
    } catch {
      // Keep the current session's progress when storage is unavailable or full.
    }
  }
}
