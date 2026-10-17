import Phaser from 'phaser';

/** The animated Dark Oracle character and its Arcade Physics body. */
export class Player {
  static readonly maxHealth = 100;
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly facing = new Phaser.Math.Vector2(0, 1);
  private readonly weaponSprite: Phaser.GameObjects.Image;
  private readonly attackFacing = new Phaser.Math.Vector2(0, 1);
  health = Player.maxHealth;
  private readonly speed = 190;
  private invulnerableUntil = 0;
  private attackStartedAt = 0;
  private attackDuration = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, weaponTexture: string) {
    this.sprite = scene.physics.add.sprite(x, y, 'dark-oracle-idle-0');
    this.sprite.setScale(0.14);
    this.sprite.setSize(340, 300).setOffset(270, 500);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(2);
    this.sprite.play('dark-oracle-idle');
    this.weaponSprite = scene.add.image(x, y, weaponTexture)
      .setScale(2.15)
      .setDepth(3)
      .setVisible(false);
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>,
    time: number,
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const left = cursors.left.isDown || wasd.left.isDown;
    const right = cursors.right.isDown || wasd.right.isDown;
    const up = cursors.up.isDown || wasd.up.isDown;
    const down = cursors.down.isDown || wasd.down.isDown;
    const horizontal = Number(right) - Number(left);
    const vertical = Number(down) - Number(up);

    body.setVelocity(horizontal, vertical);
    body.velocity.normalize().scale(this.speed);

    if (horizontal !== 0 || vertical !== 0) {
      if (Math.abs(horizontal) > Math.abs(vertical)) this.facing.set(Math.sign(horizontal), 0);
      else this.facing.set(0, Math.sign(vertical));
    }

    this.updateWeaponSwing(time);

    if (left !== right) this.sprite.setFlipX(left);
    const animation = body.velocity.lengthSq() > 0 ? 'dark-oracle-running' : 'dark-oracle-idle';
    if (this.sprite.anims.currentAnim?.key !== animation) this.sprite.play(animation);

    const isInvulnerable = time < this.invulnerableUntil;
    const alpha = isInvulnerable && Math.floor(time / 80) % 2 === 0 ? 0.45 : 1;
    this.sprite.setAlpha(alpha);
    this.weaponSprite.setAlpha(alpha);
  }

  takeDamage(amount: number, time: number): boolean {
    if (time < this.invulnerableUntil || this.health <= 0) return false;

    this.health = Math.max(0, this.health - amount);
    this.invulnerableUntil = time + 700;
    this.sprite.setTint(0xff665b).setTintMode(Phaser.TintModes.FILL);
    this.sprite.scene.time.delayedCall(110, () => {
      if (this.sprite.active) this.sprite.clearTint();
    });
    return true;
  }

  die(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.sprite.anims.stop();
    this.sprite.setTint(0x7f302d).setAlpha(0.55);
    this.weaponSprite.setVisible(false);
  }

  startWeaponSwing(direction: Phaser.Math.Vector2, time: number, duration: number): void {
    this.attackFacing.copy(direction);
    this.attackStartedAt = time;
    this.attackDuration = duration;
    this.updateWeaponSwing(time);
  }

  destroy(): void {
    this.weaponSprite.destroy();
    this.sprite.destroy();
  }

  private updateWeaponSwing(time: number): void {
    if (this.attackDuration <= 0 || time >= this.attackStartedAt + this.attackDuration) {
      this.weaponSprite.setVisible(false);
      return;
    }

    const progress = Phaser.Math.Clamp((time - this.attackStartedAt) / this.attackDuration, 0, 1);
    const swingOffset = Phaser.Math.Linear(-65, 65, progress);
    const facingAngle = Phaser.Math.RadToDeg(Math.atan2(this.attackFacing.y, this.attackFacing.x));
    const orbitAngle = Phaser.Math.DegToRad(facingAngle + swingOffset);
    const radius = 29;
    const visualYOffset = 24;
    this.weaponSprite
      .setVisible(true)
      .setPosition(
        this.sprite.x + Math.cos(orbitAngle) * radius,
        this.sprite.y + Math.sin(orbitAngle) * radius + visualYOffset,
      )
      .setAngle(facingAngle + swingOffset + 45);
  }
}
