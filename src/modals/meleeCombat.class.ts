import Phaser from 'phaser';
import { createMeleeHitbox, MeleeAttackWindow, rectanglesOverlap, segmentIntersectsRectangle } from './combatGeometry.ts';
import { Enemy } from './enemy.class.ts';
import { Player } from './player.class.ts';

export interface MeleeAttackSettings {
  damage: number;
  range: number;
  width: number;
  cooldownMs: number;
  activeMs: number;
}

const PLAYER_MELEE: MeleeAttackSettings = {
  damage: 20,
  range: 62,
  width: 48,
  cooldownMs: 360,
  activeMs: 130,
};

/** Owns the player's short-lived melee hitbox and per-attack hit tracking. */
export class MeleeCombat {
  private readonly hitbox = new Phaser.Geom.Rectangle();
  private readonly settings: MeleeAttackSettings;
  private readonly attackWindow: MeleeAttackWindow;
  private attackDirection = new Phaser.Math.Vector2(0, 1);

  constructor(settings = PLAYER_MELEE) {
    this.settings = settings;
    this.attackWindow = new MeleeAttackWindow(settings.cooldownMs, settings.activeMs);
  }

  start(player: Player, time: number): boolean {
    if (!this.attackWindow.start(time)) return false;

    this.attackDirection.copy(player.facing);
    player.startWeaponSwing(this.attackDirection, time, this.settings.activeMs);
    return true;
  }

  update(player: Player, enemies: Enemy[], walls: Phaser.Physics.Arcade.StaticGroup, time: number): void {
    if (!this.attackWindow.isActive(time)) return;

    this.updateHitbox(player);

    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body;
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (!rectanglesOverlap(this.hitbox, enemy.getHurtbox())) continue;

      const enemyBody = enemy.sprite.body as Phaser.Physics.Arcade.Body;
      if (!this.hasLineOfSight(playerBody.center.x, playerBody.center.y, enemyBody.center.x, enemyBody.center.y, walls)) continue;

      if (!this.attackWindow.claimTarget(enemy, time)) continue;
      enemy.takeDamage(this.settings.damage);
    }
  }

  hasLineOfSight(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    walls: Phaser.Physics.Arcade.StaticGroup,
  ): boolean {
    for (const wall of walls.getChildren()) {
      const wallBody = (wall as Phaser.GameObjects.Rectangle & { body?: Phaser.Physics.Arcade.StaticBody }).body;
      if (!wallBody) continue;
      if (segmentIntersectsRectangle(startX, startY, endX, endY, {
        x: wallBody.x,
        y: wallBody.y,
        width: wallBody.width,
        height: wallBody.height,
      })) {
        return false;
      }
    }
    return true;
  }

  private updateHitbox(player: Player): void {
    const body = player.sprite.body as Phaser.Physics.Arcade.Body;
    const rectangle = createMeleeHitbox(
      { x: body.x, y: body.y, width: body.width, height: body.height },
      this.attackDirection,
      this.settings.range,
      this.settings.width,
    );
    this.hitbox.setTo(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  }
}
