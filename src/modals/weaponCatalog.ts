import type { MeleeAttackSettings } from './meleeCombat.class.ts';

export type WeaponId = 'sword' | 'scimitar' | 'warblade';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  texture: string;
  purchaseCost: number;
  baseDamage: number;
  range: number;
  /** Attacks per second; lower values produce a longer attack cooldown. */
  speed: number;
  upgradeCosts: readonly [number, number, number];
  damagePerUpgrade: readonly [number, number, number];
}

export const WEAPONS: readonly WeaponDefinition[] = [
  {
    id: 'sword', name: 'Ritterschwert', texture: 'player-sword', purchaseCost: 0,
    baseDamage: 20, range: 62, speed: 2.8,
    upgradeCosts: [40, 100, 220], damagePerUpgrade: [10, 15, 20],
  },
  {
    id: 'scimitar', name: 'Krummsäbel', texture: 'player-scimitar', purchaseCost: 100,
    baseDamage: 35, range: 68, speed: 2.3,
    upgradeCosts: [120, 260, 500], damagePerUpgrade: [15, 22, 30],
  },
  {
    id: 'warblade', name: 'Kriegsbrecher', texture: 'player-warblade', purchaseCost: 250,
    baseDamage: 55, range: 76, speed: 1.9,
    upgradeCosts: [220, 450, 850], damagePerUpgrade: [20, 30, 45],
  },
] as const;

export function getWeapon(id: WeaponId): WeaponDefinition {
  return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0];
}

export function getWeaponDamage(weapon: WeaponDefinition, upgradeLevel: number): number {
  return weapon.baseDamage + weapon.damagePerUpgrade
    .slice(0, upgradeLevel)
    .reduce((total, upgradeDamage) => total + upgradeDamage, 0);
}

export function getWeaponAttackSettings(weapon: WeaponDefinition, upgradeLevel: number): Partial<MeleeAttackSettings> {
  return {
    damage: getWeaponDamage(weapon, upgradeLevel),
    range: weapon.range,
    cooldownMs: Math.round(1000 / weapon.speed),
  };
}
