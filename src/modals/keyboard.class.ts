import Phaser from 'phaser';

/** Keeps the game's keyboard bindings together in one typed input helper. */
export class Keyboard {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  readonly wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  readonly attack: Phaser.Input.Keyboard.Key;
  readonly confirm: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable.');

    this.cursors = keyboard.createCursorKeys();
    this.wasd = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
    this.attack = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.confirm = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
  }
}
