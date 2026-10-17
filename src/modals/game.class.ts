import Phaser from 'phaser';
import { createDarkOracleAnimations, preloadDarkOracle } from '../assets/darkOracle.ts';
import { createPirateZombieAnimations, preloadPirateZombie } from '../assets/pirateZombie.ts';
import { CoinWallet } from './coinWallet.class.ts';
import { Enemy } from './enemy.class.ts';
import { Keyboard } from './keyboard.class.ts';
import { MeleeCombat } from './meleeCombat.class.ts';
import { Player } from './player.class.ts';

const LEVEL_WIDTH = 800;
const LEVEL_HEIGHT = 600;
const CATACOMBS_ATLAS = 'catacombs-atlas';
const CATACOMBS_FLOOR = 'catacombs-floor';
const COINS_PER_ENEMY = 10;
const ENEMY_SPAWN_POINTS = [
  { x: 680, y: 490 },
  { x: 720, y: 270 },
  { x: 420, y: 520 },
] as const;
const LEVEL_ENEMY_COUNTS = [1, 2, 3] as const;

type LevelNumber = 1 | 2 | 3;
type ArenaState = 'start' | 'level-select' | 'playing' | 'intermission';

/** First playable room: movement, world bounds, and static obstacles. */
export class ArenaScene extends Phaser.Scene {
  private player?: Player;
  private keyboard?: Keyboard;
  private enemies: Enemy[] = [];
  private combat?: MeleeCombat;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private playerWallCollider?: Phaser.Physics.Arcade.Collider;
  private enemyWallColliders: Phaser.Physics.Arcade.Collider[] = [];
  private playerEnemyColliders: Phaser.Physics.Arcade.Collider[] = [];
  private playerHealthText?: Phaser.GameObjects.Text;
  private playerHealthBar?: Phaser.GameObjects.Graphics;
  private coinsText?: Phaser.GameObjects.Text;
  private controlsText?: Phaser.GameObjects.Text;
  private levelText?: Phaser.GameObjects.Text;
  private readonly wallet = new CoinWallet();
  private readonly screenObjects: Phaser.GameObjects.GameObject[] = [];
  private state: ArenaState = 'start';
  private selectedLevel: LevelNumber = 1;
  private currentLevel: LevelNumber = 1;
  private coinsEarnedThisLevel = 0;
  private readonly rewardedEnemies = new Set<Enemy>();

  constructor() {
    super('arena');
  }

  preload(): void {
    preloadDarkOracle(this);
    preloadPirateZombie(this);
    this.load.image(CATACOMBS_ATLAS, new URL('../assets/catacombs/mainlevbuild.png', import.meta.url).href);
    this.load.image('catacombs-torch', new URL('../assets/catacombs/torch_1.png', import.meta.url).href);
    this.load.image('catacombs-candle', new URL('../assets/catacombs/candleA_01.png', import.meta.url).href);
    this.load.image('player-sword', new URL('../assets/weapons/sword.png', import.meta.url).href);
    this.load.image('enemy-scimitar', new URL('../assets/weapons/scimitar.png', import.meta.url).href);
  }

  create(): void {
    createDarkOracleAnimations(this);
    createPirateZombieAnimations(this);
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    this.createCatacombsFloor();
    this.drawRoom();

    this.walls = this.physics.add.staticGroup();
    this.addObstacle(this.walls, 280, 190, 150, 42);
    this.addObstacle(this.walls, 530, 310, 52, 170);
    this.addObstacle(this.walls, 260, 430, 190, 44);
    this.addObstacle(this.walls, 650, 120, 78, 78);
    this.addCatacombsDecorations();

    this.keyboard = new Keyboard(this);
    this.combat = new MeleeCombat();

    this.playerHealthText = this.add.text(24, 55, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#e4f1e9',
    }).setDepth(5).setVisible(false);
    this.playerHealthBar = this.add.graphics().setDepth(5).setVisible(false);
    this.coinsText = this.add.text(24, 98, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#f3d27b',
    }).setDepth(5).setVisible(false);

    this.controlsText = this.add.text(24, 20, 'WASD: Bewegen  ·  Leertaste: Angriff', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#e4f1e9',
      backgroundColor: '#17251fcc',
      padding: { x: 12, y: 8 },
    }).setDepth(5).setVisible(false);
    this.levelText = this.add.text(LEVEL_WIDTH / 2, 20, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#f3d27b',
      backgroundColor: '#17251fcc',
      padding: { x: 10, y: 7 },
    }).setOrigin(0.5, 0).setDepth(5).setVisible(false);
    this.showStartScreen();
  }

  update(time: number, _delta: number): void {
    if (!this.keyboard) return;
    if (this.state !== 'playing') {
      if (Phaser.Input.Keyboard.JustDown(this.keyboard.confirm)) {
        if (this.state === 'level-select') this.startRound(this.selectedLevel);
        else this.showLevelSelection();
      }
      return;
    }
    if (!this.player || this.enemies.length === 0 || !this.combat || !this.walls) return;

    this.player.update(this.keyboard.cursors, this.keyboard.wasd, time);
    if (Phaser.Input.Keyboard.JustDown(this.keyboard.attack)) this.combat.start(this.player, time);

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      const enemyBody = enemy.sprite.body as Phaser.Physics.Arcade.Body;
      const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
      const canAttack = this.combat.hasLineOfSight(
        enemyBody.center.x,
        enemyBody.center.y,
        playerBody.center.x,
        playerBody.center.y,
        this.walls,
      );
      enemy.update(this.player, time, canAttack);
    }

    this.combat.update(this.player, this.enemies, this.walls, time);
    this.rewardDefeatedEnemies();
    this.updatePlayerHealth();
    if (this.enemies.every((enemy) => !enemy.isAlive)) this.finishLevel();
  }

  private startRound(level: LevelNumber): void {
    if (!this.walls) return;

    this.clearScreen();
    this.player?.destroy();
    this.playerWallCollider?.destroy();
    for (const collider of this.enemyWallColliders) collider.destroy();
    for (const collider of this.playerEnemyColliders) collider.destroy();
    this.enemyWallColliders = [];
    this.playerEnemyColliders = [];

    this.state = 'playing';
    this.currentLevel = level;
    this.coinsEarnedThisLevel = 0;
    this.rewardedEnemies.clear();
    this.player = new Player(this, 100, 100, 'player-sword');
    this.enemies = ENEMY_SPAWN_POINTS.slice(0, LEVEL_ENEMY_COUNTS[level - 1])
      .map(({ x, y }) => new Enemy(this, x, y, 'enemy-scimitar'));
    this.playerWallCollider = this.physics.add.collider(this.player.sprite, this.walls);
    for (const enemy of this.enemies) {
      this.enemyWallColliders.push(this.physics.add.collider(enemy.sprite, this.walls));
      this.playerEnemyColliders.push(this.physics.add.collider(this.player.sprite, enemy.sprite));
    }
    this.playerHealthText?.setVisible(true);
    this.playerHealthBar?.setVisible(true);
    this.coinsText?.setVisible(true);
    this.controlsText?.setVisible(true);
    this.levelText?.setVisible(true);
    this.updatePlayerHealth();
  }

  private rewardDefeatedEnemies(): void {
    for (const enemy of this.enemies) {
      if (enemy.isAlive || this.rewardedEnemies.has(enemy)) continue;
      this.rewardedEnemies.add(enemy);
      this.coinsEarnedThisLevel += COINS_PER_ENEMY;
      this.wallet.add(COINS_PER_ENEMY);
    }
  }

  private finishLevel(): void {
    if (this.state !== 'playing') return;

    this.state = 'intermission';
    this.playerHealthText?.setVisible(false);
    this.playerHealthBar?.setVisible(false);
    this.coinsText?.setVisible(false);
    this.controlsText?.setVisible(false);
    this.levelText?.setVisible(false);
    this.showScreen(
      `Level ${this.currentLevel} abgeschlossen`,
      `${LEVEL_ENEMY_COUNTS[this.currentLevel - 1]} Gegner besiegt · +${this.coinsEarnedThisLevel} Münzen\nGespeicherter Stand: ${this.wallet.coins} Münzen\nKlicken oder Enter für die Levelauswahl.`,
      'Levelauswahl',
      () => this.showLevelSelection(),
    );
  }

  private showStartScreen(): void {
    this.state = 'start';
    this.showScreen(
      'Fight Arena',
      `Besiege Piraten-Zombies und sammle Münzen.\nGespeicherter Stand: ${this.wallet.coins} Münzen\nKlicken oder Enter zur Levelauswahl.`,
      'Level auswählen',
      () => this.showLevelSelection(),
    );
  }

  private showLevelSelection(): void {
    this.state = 'level-select';
    this.clearScreen();
    const shade = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x080b09, 0.82)
      .setDepth(10);
    const panel = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, 590, 310, 0x19251f, 1)
      .setStrokeStyle(2, 0x8c7655)
      .setDepth(11);
    const heading = this.add.text(LEVEL_WIDTH / 2, 190, 'Level auswählen', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(12);
    const details = this.add.text(LEVEL_WIDTH / 2, 245, `Gespeicherte Münzen: ${this.wallet.coins} · Enter wählt Level 1`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#c6d0c7',
    }).setOrigin(0.5).setDepth(12);
    this.screenObjects.push(shade, panel, heading, details);

    LEVEL_ENEMY_COUNTS.forEach((enemyCount, index) => {
      const level = (index + 1) as LevelNumber;
      const x = 230 + index * 170;
      const button = this.add.rectangle(x, 340, 150, 92, 0x354b3b, 1)
        .setStrokeStyle(2, 0x8c7655)
        .setInteractive({ useHandCursor: true })
        .setDepth(12);
      const label = this.add.text(x, 340, `Level ${level}\n${enemyCount} Gegner`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f2f4ed',
        align: 'center',
        lineSpacing: 7,
      }).setOrigin(0.5).setDepth(13);
      button.on('pointerdown', () => this.startRound(level));
      this.screenObjects.push(button, label);
    });
  }

  private showScreen(title: string, message: string, buttonLabel: string, onClick: () => void): void {
    this.clearScreen();
    const shade = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x080b09, 0.82)
      .setDepth(10);
    const panel = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, 490, 280, 0x19251f, 1)
      .setStrokeStyle(2, 0x8c7655)
      .setDepth(11);
    const heading = this.add.text(LEVEL_WIDTH / 2, 218, title, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(12);
    const details = this.add.text(LEVEL_WIDTH / 2, 282, message, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#c6d0c7',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5).setDepth(12);
    const button = this.add.rectangle(LEVEL_WIDTH / 2, 390, 220, 52, 0x446e50, 1)
      .setStrokeStyle(2, 0xa3c18e)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);
    const buttonText = this.add.text(LEVEL_WIDTH / 2, 390, buttonLabel, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#f5f5ed',
    }).setOrigin(0.5).setDepth(13);
    button.on('pointerdown', onClick);
    this.screenObjects.push(shade, panel, heading, details, button, buttonText);
  }

  private clearScreen(): void {
    for (const object of this.screenObjects) object.destroy();
    this.screenObjects.length = 0;
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
    this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x171714).setDepth(-2);
    this.add.tileSprite(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, CATACOMBS_FLOOR)
      .setDepth(-1)
      .setTileScale(1.5);
    const border = this.add.graphics().setDepth(-1);
    border.lineStyle(7, 0x11100e, 1).strokeRect(4, 4, LEVEL_WIDTH - 8, LEVEL_HEIGHT - 8);
    border.lineStyle(2, 0x8d7150, 0.85).strokeRect(10, 10, LEVEL_WIDTH - 20, LEVEL_HEIGHT - 20);
  }

  private createCatacombsFloor(): void {
    const source = this.textures.get(CATACOMBS_ATLAS).getSourceImage() as CanvasImageSource;
    const canvasTexture = this.textures.createCanvas(CATACOMBS_FLOOR, 48, 48);
    if (!canvasTexture) throw new Error('Die Catacombs-Bodentextur konnte nicht erstellt werden.');
    canvasTexture.getContext().drawImage(source, 736, 208, 48, 48, 0, 0, 48, 48);
    canvasTexture.refresh();
  }

  private addCatacombsDecorations(): void {
    this.add.image(64, 72, 'catacombs-torch').setScale(2).setDepth(1);
    this.add.image(736, 72, 'catacombs-torch').setScale(2).setDepth(1);
    this.add.image(64, 528, 'catacombs-torch').setScale(2).setDepth(1);
    this.add.image(736, 528, 'catacombs-torch').setScale(2).setDepth(1);
    this.add.image(190, 270, 'catacombs-candle').setScale(2).setDepth(1);
    this.add.image(590, 410, 'catacombs-candle').setScale(2).setDepth(1);
  }

  private updatePlayerHealth(): void {
    if (!this.player || !this.playerHealthText || !this.playerHealthBar) return;

    const ratio = this.player.health / Player.maxHealth;
    this.playerHealthText.setText(`Spieler: ${this.player.health} / ${Player.maxHealth} HP`);
    this.coinsText?.setText(`Münzen: ${this.wallet.coins}`);
    this.levelText?.setText(`Level ${this.currentLevel} · Gegner: ${this.enemies.filter((enemy) => enemy.isAlive).length}`);
    this.playerHealthBar.clear();
    this.playerHealthBar.fillStyle(0x171b19, 0.9).fillRoundedRect(24, 78, 160, 10, 4);
    this.playerHealthBar.fillStyle(0x61bd82, 1).fillRoundedRect(26, 80, 156 * ratio, 6, 3);
    this.playerHealthBar.lineStyle(1, 0xe0d1b9, 0.9).strokeRoundedRect(24, 78, 160, 10, 4);
  }
}
