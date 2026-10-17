import Phaser from 'phaser';
import { createDarkOracleAnimations, preloadDarkOracle } from '../assets/darkOracle.ts';
import { Keyboard } from './keyboard.class.ts';
import { Player } from './player.class.ts';

const LEVEL_WIDTH = 800;
const LEVEL_HEIGHT = 600;

/** First playable room: movement, world bounds, and static obstacles. */
export class ArenaScene extends Phaser.Scene {
  private player?: Player;
  private keyboard?: Keyboard;

  constructor() {
    super('arena');
  }

  preload(): void {
    preloadDarkOracle(this);
  }

  create(): void {
    createDarkOracleAnimations(this);
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    this.drawRoom();

    const walls = this.physics.add.staticGroup();
    this.addObstacle(walls, 280, 190, 150, 42);
    this.addObstacle(walls, 530, 310, 52, 170);
    this.addObstacle(walls, 260, 430, 190, 44);
    this.addObstacle(walls, 650, 120, 78, 78);

    this.player = new Player(this, 100, 100);
    this.keyboard = new Keyboard(this);
    this.physics.add.collider(this.player.sprite, walls);

    this.add.text(24, 20, 'WASD  ·  Bewegen', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#e4f1e9',
      backgroundColor: '#17251fcc',
      padding: { x: 12, y: 8 },
    }).setDepth(5);
  }

  update(): void {
    if (this.player && this.keyboard) {
      this.player.update(this.keyboard.cursors, this.keyboard.wasd);
    }
  }

  private addObstacle(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, width: number, height: number): void {
    this.add.rectangle(x + 3, y + 5, width, height, 0x111b18, 0.65).setDepth(1);
    const obstacle = this.add.rectangle(x, y, width, height, 0x51483e).setStrokeStyle(3, 0x9b8060).setDepth(1);
    const highlight = this.add.rectangle(x, y - height / 2 + 4, width - 8, 3, 0xc0a078, 0.8).setDepth(1);
    highlight.setOrigin(0.5, 0);
    group.add(obstacle);
    (obstacle.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private drawRoom(): void {
    this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x1d2924).setDepth(-2);
    const floor = this.add.graphics().setDepth(-1);
    const tileSize = 40;

    for (let y = 0; y < LEVEL_HEIGHT; y += tileSize) {
      for (let x = 0; x < LEVEL_WIDTH; x += tileSize) {
        const shade = (x / tileSize + y / tileSize) % 2 === 0 ? 0x29372f : 0x26342d;
        floor.fillStyle(shade, 1);
        floor.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
        floor.lineStyle(1, 0x35453b, 0.8);
        floor.strokeRect(x + 1, y + 1, tileSize - 2, tileSize - 2);
      }
    }

    floor.lineStyle(6, 0x101a16, 1);
    floor.strokeRect(4, 4, LEVEL_WIDTH - 8, LEVEL_HEIGHT - 8);
    floor.lineStyle(2, 0x6a5a45, 0.8);
    floor.strokeRect(10, 10, LEVEL_WIDTH - 20, LEVEL_HEIGHT - 20);
  }
}
