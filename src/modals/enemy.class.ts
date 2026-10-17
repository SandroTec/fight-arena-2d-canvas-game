import Phaser from 'phaser';
import { pirateZombieAnimation } from '../assets/pirateZombie.ts';
import type { Player } from './player.class.ts';

/** One simple chaser enemy with a health bar and a short-range attack. */
export class Enemy {
  static readonly maxHealth = 50;
  static readonly attackDamage = 10;
  static readonly attackRange = 58;

  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly healthBar: Phaser.GameObjects.Graphics;
  private readonly weaponSprite: Phaser.GameObjects.Image;
  private readonly speed = 82;
  private readonly detectionRadius = 320;
  private nextAttackAt = 0;
  private attackAnimationPlaying = false;
  private facing: 'down' | 'left' | 'right' | 'up' = 'down';
  private readonly scene: Phaser.Scene;
  health = Enemy.maxHealth;
  isAlive = true;

  constructor(scene: Phaser.Scene, x: number, y: number, weaponTexture: string) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, pirateZombieAnimation('idle', this.facing));
    this.sprite.setScale(0.18);
    this.sprite.setSize(180, 190).setOffset(330, 380);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(2);
    this.sprite.play(pirateZombieAnimation('idle', this.facing));
    this.weaponSprite = scene.add.image(x + 14, y + 6, weaponTexture)
      .setScale(1.15)
      .setDepth(2.2)
      .setVisible(false);
    this.healthBar = scene.add.graphics().setDepth(4);
  }

  update(player: Player, time: number, canAttack: boolean): void {
    if (!this.isAlive) return;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body;
    const deltaX = playerBody.center.x - body.center.x;
    const deltaY = playerBody.center.y - body.center.y;
    const distance = Math.hypot(deltaX, deltaY);
    this.updateFacing(deltaX, deltaY);
    this.updateWeaponPosition();

    if (distance > this.detectionRadius) {
      body.setVelocity(0, 0);
      if (!this.attackAnimationPlaying) this.playAnimation('idle');
    } else if (distance > Enemy.attackRange) {
      body.setVelocity(deltaX, deltaY).velocity.normalize().scale(this.speed);
      if (!this.attackAnimationPlaying) this.playAnimation('running');
    } else {
      body.setVelocity(0, 0);
      if (canAttack && time >= this.nextAttackAt && !this.attackAnimationPlaying) {
        this.playAnimation('attacking');
        this.attackAnimationPlaying = true;
        this.weaponSprite.setVisible(true);
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          this.attackAnimationPlaying = false;
          this.weaponSprite.setVisible(false);
          if (this.sprite.active) this.playAnimation('idle');
        });
        player.takeDamage(Enemy.attackDamage, time);
        this.nextAttackAt = time + 900;
      } else if (!this.attackAnimationPlaying) {
        this.playAnimation('idle');
      }
    }

    this.drawHealthBar();
  }

  getHurtbox(): Phaser.Geom.Rectangle {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    return new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
  }

  takeDamage(amount: number): void {
    if (!this.isAlive) return;

    this.health = Math.max(0, this.health - amount);
    this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(100, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });

    if (this.health === 0) {
      this.isAlive = false;
      this.healthBar.destroy();
      this.weaponSprite.destroy();
      this.sprite.destroy();
      return;
    }

    this.drawHealthBar();
  }

  private updateFacing(deltaX: number, deltaY: number): void {
    if (Math.abs(deltaX) > Math.abs(deltaY)) this.facing = deltaX < 0 ? 'left' : 'right';
    else this.facing = deltaY < 0 ? 'up' : 'down';
  }

  private updateWeaponPosition(): void {
    const directionAngle = this.facing === 'right' ? 0
      : this.facing === 'down' ? 90
        : this.facing === 'left' ? 180 : -90;
    const facingAngle = Phaser.Math.DegToRad(directionAngle);
    this.weaponSprite
      .setPosition(
        this.sprite.x + Math.cos(facingAngle) * 15 + 14,
        this.sprite.y + Math.sin(facingAngle) * 15 + 5,
      )
      .setAngle(directionAngle + 45);
  }

  private playAnimation(action: 'attacking' | 'idle' | 'running'): void {
    const key = pirateZombieAnimation(action, this.facing);
    if (this.sprite.anims.currentAnim?.key !== key) this.sprite.play(key);
  }

  private drawHealthBar(): void {
    if (!this.isAlive) return;

    const ratio = this.health / Enemy.maxHealth;
    const x = this.sprite.x - 27;
    const y = this.sprite.y - 48;
    this.healthBar.clear();
    this.healthBar.fillStyle(0x171b19, 0.9).fillRoundedRect(x, y, 54, 8, 3);
    this.healthBar.fillStyle(0xb94d43, 1).fillRoundedRect(x + 2, y + 2, 50 * ratio, 4, 2);
    this.healthBar.lineStyle(1, 0xe0d1b9, 0.9).strokeRoundedRect(x, y, 54, 8, 3);
  }
}
