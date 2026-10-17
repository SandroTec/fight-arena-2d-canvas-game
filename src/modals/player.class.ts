import Phaser from 'phaser';

/** The animated Dark Oracle character and its Arcade Physics body. */
export class Player {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly speed = 190;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    this.sprite = scene.physics.add.sprite(x, y, 'dark-oracle-idle-0');
    this.sprite.setScale(0.14);
    this.sprite.setSize(340, 300).setOffset(270, 500);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(2);
    this.sprite.play('dark-oracle-idle');
  }

  update(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>,
  ): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const left = cursors.left.isDown || wasd.left.isDown;
    const right = cursors.right.isDown || wasd.right.isDown;
    const up = cursors.up.isDown || wasd.up.isDown;
    const down = cursors.down.isDown || wasd.down.isDown;

    body.setVelocity(Number(right) - Number(left), Number(down) - Number(up));
    body.velocity.normalize().scale(this.speed);

    if (left !== right) this.sprite.setFlipX(left);
    const animation = body.velocity.lengthSq() > 0 ? 'dark-oracle-running' : 'dark-oracle-idle';
    if (this.sprite.anims.currentAnim?.key !== animation) this.sprite.play(animation);
  }
}
