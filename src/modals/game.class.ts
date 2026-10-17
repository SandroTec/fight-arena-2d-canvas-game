import Phaser from 'phaser';
import { createDarkOracleAnimations, preloadDarkOracle } from '../assets/darkOracle.ts';
import { createPirateLeaderAnimations, preloadPirateLeader } from '../assets/pirateLeader.ts';
import { createPirateZombieAnimations, preloadPirateZombie } from '../assets/pirateZombie.ts';
import { CoinWallet } from './coinWallet.class.ts';
import { Enemy, type EnemyDifficulty } from './enemy.class.ts';
import { Keyboard } from './keyboard.class.ts';
import { MeleeCombat } from './meleeCombat.class.ts';
import { Player } from './player.class.ts';
import { getWeapon, getWeaponAttackSettings, WEAPONS } from './weaponCatalog.ts';

const LEVEL_WIDTH = 800;
const LEVEL_HEIGHT = 600;
const CATACOMBS_ATLAS = 'catacombs-atlas';
const CATACOMBS_FLOOR = 'catacombs-floor';
interface ObstacleRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LevelConfig {
  enemyCount: number;
  leaderCount: number;
  coinsPerEnemy: number;
  enemy: EnemyDifficulty;
  leader: EnemyDifficulty;
}

const LEVELS = [
  {
    enemyCount: 4, leaderCount: 0, coinsPerEnemy: 15,
    enemy: { maxHealth: 60, attackDamage: 12, attackRange: 60, speed: 88, detectionRadius: 340, attackCooldownMs: 850 },
    leader: { maxHealth: 180, attackDamage: 28, attackRange: 72, speed: 76, detectionRadius: 400, attackCooldownMs: 1000 },
  },
  {
    enemyCount: 6, leaderCount: 1, coinsPerEnemy: 20,
    enemy: { maxHealth: 78, attackDamage: 16, attackRange: 62, speed: 96, detectionRadius: 360, attackCooldownMs: 800 },
    leader: { maxHealth: 240, attackDamage: 34, attackRange: 76, speed: 82, detectionRadius: 420, attackCooldownMs: 950 },
  },
  {
    enemyCount: 8, leaderCount: 2, coinsPerEnemy: 25,
    enemy: { maxHealth: 100, attackDamage: 20, attackRange: 64, speed: 104, detectionRadius: 380, attackCooldownMs: 750 },
    leader: { maxHealth: 300, attackDamage: 40, attackRange: 80, speed: 88, detectionRadius: 440, attackCooldownMs: 900 },
  },
] as const satisfies readonly LevelConfig[];

type LevelNumber = 1 | 2 | 3;
type ArenaState = 'start' | 'level-select' | 'playing' | 'intermission' | 'shop' | 'game-over';

interface ScreenAction {
  label: string;
  onClick: () => void;
}

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
  private levelText?: Phaser.GameObjects.Text;
  private readonly wallet = new CoinWallet();
  private readonly screenObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly obstacleDecorations: Phaser.GameObjects.GameObject[] = [];
  private obstacleRects: ObstacleRect[] = [];
  private state: ArenaState = 'start';
  private shopReturnState: 'start' | 'intermission' = 'start';
  private selectedLevel: LevelNumber = 1;
  private levelSelectionReturnState: 'start' | 'intermission' = 'start';
  private currentLevel: LevelNumber = 1;
  private coinsEarnedThisLevel = 0;
  private readonly rewardedEnemies = new Set<Enemy>();

  constructor() {
    super('arena');
  }

  preload(): void {
    preloadDarkOracle(this);
    preloadPirateZombie(this);
    preloadPirateLeader(this);
    this.load.image(CATACOMBS_ATLAS, new URL('../assets/catacombs/mainlevbuild.png', import.meta.url).href);
    this.load.image('catacombs-torch', new URL('../assets/catacombs/torch_1.png', import.meta.url).href);
    this.load.image('catacombs-candle', new URL('../assets/catacombs/candleA_01.png', import.meta.url).href);
    this.load.image('player-sword', new URL('../assets/weapons/sword.png', import.meta.url).href);
    this.load.image('player-scimitar', new URL('../assets/weapons/scimitar.png', import.meta.url).href);
    this.load.image('enemy-scimitar', new URL('../assets/weapons/scimitar.png', import.meta.url).href);
  }

  create(): void {
    createDarkOracleAnimations(this);
    createPirateZombieAnimations(this);
    createPirateLeaderAnimations(this);
    this.physics.world.setBounds(0, 0, LEVEL_WIDTH, LEVEL_HEIGHT);
    this.createCatacombsFloor();
    this.createWarbladeTexture();
    this.drawRoom();

    this.walls = this.physics.add.staticGroup();
    this.createRoundLayout();
    this.addCatacombsDecorations();

    this.keyboard = new Keyboard(this);

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
        else if (this.state === 'shop') this.returnFromShop();
        else if (this.state === 'game-over') this.startRound(this.currentLevel);
        else if (this.state === 'start') this.startRound(1);
        else this.startRound(this.currentLevel);
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
    if (this.player.health <= 0) {
      this.loseLevel();
      return;
    }
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
    for (const enemy of this.enemies) enemy.destroy();
    this.enemyWallColliders = [];
    this.playerEnemyColliders = [];
    this.enemies = [];
    this.createRoundLayout();

    this.state = 'playing';
    this.currentLevel = level;
    this.coinsEarnedThisLevel = 0;
    this.rewardedEnemies.clear();
    const selectedWeapon = getWeapon(this.wallet.selectedWeapon);
    this.player = new Player(this, 100, 100, selectedWeapon.texture);
    this.combat = new MeleeCombat(getWeaponAttackSettings(selectedWeapon, this.wallet.getUpgradeLevel(selectedWeapon.id)));
    const levelConfig = LEVELS[level - 1];
    this.enemies = this.createEnemySpawnPoints(levelConfig.enemyCount)
      .map(({ x, y }, index) => {
        const isLeader = index >= levelConfig.enemyCount - levelConfig.leaderCount;
        return new Enemy(
          this,
          x,
          y,
          'enemy-scimitar',
          isLeader ? levelConfig.leader : levelConfig.enemy,
          isLeader ? 'leader' : 'zombie',
        );
      });
    this.playerWallCollider = this.physics.add.collider(this.player.sprite, this.walls);
    for (const enemy of this.enemies) {
      this.enemyWallColliders.push(this.physics.add.collider(enemy.sprite, this.walls));
      this.playerEnemyColliders.push(this.physics.add.collider(this.player.sprite, enemy.sprite));
    }
    this.playerHealthText?.setVisible(true);
    this.playerHealthBar?.setVisible(true);
    this.coinsText?.setVisible(true);
    this.levelText?.setVisible(true);
    this.updatePlayerHealth();
  }

  private rewardDefeatedEnemies(): void {
    for (const enemy of this.enemies) {
      if (enemy.isAlive || this.rewardedEnemies.has(enemy)) continue;
      this.rewardedEnemies.add(enemy);
      const levelConfig = LEVELS[this.currentLevel - 1];
      const reward = levelConfig.coinsPerEnemy * (enemy.kind === 'leader' ? 2 : 1);
      this.coinsEarnedThisLevel += reward;
    }
  }

  private finishLevel(): void {
    if (this.state !== 'playing') return;

    this.state = 'intermission';
    this.wallet.add(this.coinsEarnedThisLevel);
    this.playerHealthText?.setVisible(false);
    this.playerHealthBar?.setVisible(false);
    this.coinsText?.setVisible(false);
    this.levelText?.setVisible(false);
    this.showScreen(
      `Level ${this.currentLevel} abgeschlossen`,
      `+${this.coinsEarnedThisLevel} Münzen verdient\nGespeicherter Stand: ${this.wallet.coins} Münzen\nDu kannst direkt weiterspielen oder etwas kaufen.`,
      [
        { label: `Start: Level ${this.currentLevel}`, onClick: () => this.startRound(this.currentLevel) },
        { label: 'Shop', onClick: () => this.showShopScreen() },
        { label: 'Levelauswahl', onClick: () => this.showLevelSelection('intermission') },
      ],
    );
  }

  private loseLevel(): void {
    if (this.state !== 'playing' || !this.player) return;

    this.state = 'game-over';
    this.player.die();
    this.playerHealthText?.setVisible(false);
    this.playerHealthBar?.setVisible(false);
    this.coinsText?.setVisible(false);
    this.levelText?.setVisible(false);
    this.showScreen(
      'Level verloren',
      `Du bist in Level ${this.currentLevel} gefallen.\n${this.coinsEarnedThisLevel} Münzen aus dieser Runde gehen verloren.\nGespeichertes Guthaben: ${this.wallet.coins} Münzen.`,
      [
        { label: 'Level erneut versuchen', onClick: () => this.startRound(this.currentLevel) },
        { label: 'Zum Startbildschirm', onClick: () => this.showStartScreen() },
      ],
    );
  }

  private showStartScreen(): void {
    this.state = 'start';
    this.showScreen(
      'Fight Arena',
      '',
      [
        { label: 'Start', onClick: () => this.startRound(1) },
        { label: 'Shop', onClick: () => this.showShopScreen('start') },
        { label: 'Levelauswahl', onClick: () => this.showLevelSelection() },
      ],
    );
  }

  private showIntermissionScreen(): void {
    this.state = 'intermission';
    this.playerHealthText?.setVisible(false);
    this.playerHealthBar?.setVisible(false);
    this.coinsText?.setVisible(false);
    this.levelText?.setVisible(false);
    this.showScreen(
      `Level ${this.currentLevel} abgeschlossen`,
      `+${this.coinsEarnedThisLevel} Münzen verdient\nGespeicherter Stand: ${this.wallet.coins} Münzen\nDu kannst direkt weiterspielen oder etwas kaufen.`,
      [
        { label: `Start: Level ${this.currentLevel}`, onClick: () => this.startRound(this.currentLevel) },
        { label: 'Shop', onClick: () => this.showShopScreen() },
        { label: 'Levelauswahl', onClick: () => this.showLevelSelection('intermission') },
      ],
    );
  }

  private showShopScreen(returnState: 'start' | 'intermission' = 'intermission'): void {
    this.state = 'shop';
    this.shopReturnState = returnState;
    this.clearScreen();
    const shade = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x080b09, 0.82)
      .setDepth(10);
    const panel = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, 760, 500, 0x19251f, 1)
      .setStrokeStyle(2, 0x8c7655)
      .setDepth(11);
    const heading = this.add.text(LEVEL_WIDTH / 2, 82, 'Waffenschmiede', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(12);
    const balance = this.add.text(LEVEL_WIDTH / 2, 126, `Münzen: ${this.wallet.coins} · Ausgerüstet: ${getWeapon(this.wallet.selectedWeapon).name} (${this.wallet.selectedDamage} Schaden)`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      color: '#f3d27b',
    }).setOrigin(0.5).setDepth(12);
    this.screenObjects.push(shade, panel, heading, balance);
    WEAPONS.forEach((weapon, index) => {
      const x = 170 + index * 230;
      const owned = this.wallet.ownsWeapon(weapon.id);
      const level = this.wallet.getUpgradeLevel(weapon.id);
      const damage = this.wallet.getDamage(weapon.id);
      const selected = this.wallet.selectedWeapon === weapon.id;
      const card = this.add.rectangle(x, 310, 210, 310, 0x26372e, 1).setStrokeStyle(2, selected ? 0xd9b66c : 0x687a68).setDepth(12);
      const weaponName = this.add.text(x, 176, weapon.name, {
        fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#f2f4ed', align: 'center',
      }).setOrigin(0.5).setDepth(13);
      const preview = this.add.image(x, 220, weapon.texture)
        .setScale(weapon.id === 'warblade' ? 0.75 : 3)
        .setDepth(13);
      const stats = this.add.text(x, 285, `${damage} Schaden\nReichweite ${weapon.range}\nTempo ${weapon.speed.toFixed(1)} Angriffe/s\nStufe ${level}/3`, {
        fontFamily: 'system-ui, sans-serif', fontSize: '14px', color: '#c6d0c7', align: 'center', lineSpacing: 8,
      }).setOrigin(0.5).setDepth(13);
      const purchaseCost = weapon.purchaseCost;
      const purchaseLabel = owned ? (selected ? 'Ausgewählt' : 'Ausrüsten') : `Kaufen · ${purchaseCost} Münzen`;
      const purchaseAction = owned
        ? () => this.wallet.selectWeapon(weapon.id)
        : () => this.wallet.purchaseWeapon(weapon.id);
      const purchaseEnabled = owned || this.wallet.coins >= purchaseCost;
      const selectButton = this.add.rectangle(x, 365, 180, 42, purchaseEnabled ? 0x446e50 : 0x343d37, 1)
        .setStrokeStyle(1, 0xa3c18e).setDepth(13);
      const selectText = this.add.text(x, 365, purchaseLabel, {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#f5f5ed', align: 'center',
      }).setOrigin(0.5).setDepth(14);
      if (purchaseEnabled && !selected) selectButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        purchaseAction();
        this.showShopScreen(returnState);
      });

      const upgradeCost = weapon.upgradeCosts[level];
      const upgradeLabel = !owned ? 'Erst kaufen' : level >= 3 ? 'Maximale Stufe' : `Verbessern · ${upgradeCost} Münzen`;
      const upgradeEnabled = owned && level < 3 && this.wallet.coins >= upgradeCost;
      const upgradeButton = this.add.rectangle(x, 423, 180, 42, upgradeEnabled ? 0x795c32 : 0x343d37, 1)
        .setStrokeStyle(1, 0xc9a65f).setDepth(13);
      const upgradeText = this.add.text(x, 423, upgradeLabel, {
        fontFamily: 'system-ui, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#f5f5ed', align: 'center',
      }).setOrigin(0.5).setDepth(14);
      if (upgradeEnabled) upgradeButton.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.wallet.purchaseUpgrade(weapon.id);
        this.showShopScreen(returnState);
      });
      this.screenObjects.push(card, weaponName, preview, stats, selectButton, selectText, upgradeButton, upgradeText);
    });
    const backButton = this.add.rectangle(LEVEL_WIDTH / 2, 515, 180, 42, 0x354b3b, 1)
      .setStrokeStyle(2, 0x8c7655)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);
    const backText = this.add.text(LEVEL_WIDTH / 2, 515, 'Zurück', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(13);
    backButton.on('pointerdown', () => this.returnFromShop());
    this.screenObjects.push(backButton, backText);
  }

  private returnFromShop(): void {
    if (this.shopReturnState === 'start') this.showStartScreen();
    else this.showIntermissionScreen();
  }

  private showLevelSelection(returnState: 'start' | 'intermission' = 'start'): void {
    this.state = 'level-select';
    this.levelSelectionReturnState = returnState;
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
    const details = this.add.text(LEVEL_WIDTH / 2, 245, `Gespeicherte Münzen: ${this.wallet.coins} · Enter startet Level ${this.selectedLevel}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '15px',
      color: '#c6d0c7',
    }).setOrigin(0.5).setDepth(12);
    this.screenObjects.push(shade, panel, heading, details);

    LEVELS.forEach((_config, index) => {
      const level = (index + 1) as LevelNumber;
      const x = 230 + index * 170;
      const button = this.add.rectangle(x, 340, 150, 92, 0x354b3b, 1)
        .setStrokeStyle(2, 0x8c7655)
        .setInteractive({ useHandCursor: true })
        .setDepth(12);
      const label = this.add.text(x, 340, `Level ${level}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#f2f4ed',
        align: 'center',
        lineSpacing: 7,
      }).setOrigin(0.5).setDepth(13);
      button.on('pointerdown', () => {
        this.selectedLevel = level;
        this.startRound(level);
      });
      this.screenObjects.push(button, label);
    });
    const backButton = this.add.rectangle(LEVEL_WIDTH / 2, 423, 160, 34, 0x354b3b, 1)
      .setStrokeStyle(1, 0x8c7655)
      .setInteractive({ useHandCursor: true })
      .setDepth(12);
    const backText = this.add.text(LEVEL_WIDTH / 2, 423, 'Zurück', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(13);
    backButton.on('pointerdown', () => {
      if (this.levelSelectionReturnState === 'intermission') this.showIntermissionScreen();
      else this.showStartScreen();
    });
    this.screenObjects.push(backButton, backText);
  }

  private showScreen(title: string, message: string, actions: ScreenAction[]): void {
    this.clearScreen();
    const shade = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, LEVEL_WIDTH, LEVEL_HEIGHT, 0x080b09, 0.82)
      .setDepth(10);
    const panelWidth = actions.length >= 3 ? 620 : 490;
    const panel = this.add.rectangle(LEVEL_WIDTH / 2, LEVEL_HEIGHT / 2, panelWidth, 280, 0x19251f, 1)
      .setStrokeStyle(2, 0x8c7655)
      .setDepth(11);
    const heading = this.add.text(LEVEL_WIDTH / 2, 218, title, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#f2f4ed',
    }).setOrigin(0.5).setDepth(12);
    this.screenObjects.push(shade, panel, heading);
    if (message) {
      const details = this.add.text(LEVEL_WIDTH / 2, 282, message, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#c6d0c7',
        align: 'center',
        lineSpacing: 8,
      }).setOrigin(0.5).setDepth(12);
      this.screenObjects.push(details);
    }
    const buttonWidth = actions.length >= 3 ? 160 : 220;
    const gap = 20;
    const firstX = LEVEL_WIDTH / 2 - ((actions.length - 1) * (buttonWidth + gap)) / 2;
    actions.forEach((action, index) => {
      const x = firstX + index * (buttonWidth + gap);
      const button = this.add.rectangle(x, 390, buttonWidth, 52, 0x446e50, 1)
        .setStrokeStyle(2, 0xa3c18e)
        .setInteractive({ useHandCursor: true })
        .setDepth(12);
      const buttonText = this.add.text(x, 390, action.label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#f5f5ed',
        align: 'center',
      }).setOrigin(0.5).setDepth(13);
      button.on('pointerdown', action.onClick);
      this.screenObjects.push(button, buttonText);
    });
  }

  private clearScreen(): void {
    for (const object of this.screenObjects) object.destroy();
    this.screenObjects.length = 0;
  }

  private addObstacle(group: Phaser.Physics.Arcade.StaticGroup, x: number, y: number, width: number, height: number): void {
    const shadow = this.add.rectangle(x + 3, y + 5, width, height, 0x111b18, 0.65).setDepth(1);
    const obstacle = this.add.rectangle(x, y, width, height, 0x51483e).setStrokeStyle(3, 0x9b8060).setDepth(1);
    const highlight = this.add.rectangle(x, y - height / 2 + 4, width - 8, 3, 0xc0a078, 0.8).setDepth(1);
    highlight.setOrigin(0.5, 0);
    this.obstacleDecorations.push(shadow, highlight);
    group.add(obstacle);
    (obstacle.body as Phaser.Physics.Arcade.StaticBody).updateFromGameObject();
  }

  private createRoundLayout(): void {
    if (!this.walls) return;

    this.walls.clear(true, true);
    for (const decoration of this.obstacleDecorations) decoration.destroy();
    this.obstacleDecorations.length = 0;
    this.obstacleRects = [];

    const templates: ObstacleRect[] = [
      { x: 280, y: 190, width: 150, height: 42 },
      { x: 530, y: 310, width: 52, height: 170 },
      { x: 260, y: 430, width: 190, height: 44 },
      { x: 650, y: 120, width: 78, height: 78 },
    ];
    const playerSafeZone = new Phaser.Geom.Rectangle(35, 35, 150, 150);

    for (const template of templates) {
      let obstacle: ObstacleRect | undefined;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate: ObstacleRect = {
          x: template.x + Phaser.Math.Between(-34, 34),
          y: template.y + Phaser.Math.Between(-30, 30),
          width: template.width + Phaser.Math.Between(-16, 16),
          height: template.height + Phaser.Math.Between(-12, 12),
        };
        const bounds = this.toObstacleBounds(candidate);
        if (this.overlaps(bounds, playerSafeZone, 8)) continue;
        if (this.obstacleRects.some((placed) => this.overlaps(bounds, this.toObstacleBounds(placed), 18))) continue;
        obstacle = candidate;
        break;
      }

      // The original layout is a known safe fallback if random placements conflict.
      obstacle ??= template;
      this.obstacleRects.push(obstacle);
      this.addObstacle(this.walls, obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }
  }

  private createEnemySpawnPoints(count: number): Array<{ x: number; y: number }> {
    const candidates: Array<{ x: number; y: number }> = [];
    for (let y = 55; y <= LEVEL_HEIGHT - 55; y += 50) {
      for (let x = 55; x <= LEVEL_WIDTH - 55; x += 50) candidates.push({ x, y });
    }

    const shuffledCandidates = Phaser.Utils.Array.Shuffle(candidates);
    const selected: Array<{ x: number; y: number }> = [];
    const playerSpawn = { x: 100, y: 100 };
    for (const point of shuffledCandidates) {
      if (Math.hypot(point.x - playerSpawn.x, point.y - playerSpawn.y) < 170) continue;
      const spawnBounds = new Phaser.Geom.Rectangle(point.x - 36, point.y - 36, 72, 72);
      if (this.obstacleRects.some((wall) => this.overlaps(spawnBounds, this.toObstacleBounds(wall)))) continue;
      if (selected.some((other) => Math.hypot(point.x - other.x, point.y - other.y) < 90)) continue;
      selected.push(point);
      if (selected.length === count) return selected;
    }

    throw new Error(`Could not find ${count} non-overlapping enemy spawn points.`);
  }

  private toObstacleBounds(obstacle: ObstacleRect): Phaser.Geom.Rectangle {
    return new Phaser.Geom.Rectangle(
      obstacle.x - obstacle.width / 2,
      obstacle.y - obstacle.height / 2,
      obstacle.width,
      obstacle.height,
    );
  }

  private overlaps(first: Phaser.Geom.Rectangle, second: Phaser.Geom.Rectangle, padding = 0): boolean {
    return first.left < second.right + padding
      && first.right + padding > second.left
      && first.top < second.bottom + padding
      && first.bottom + padding > second.top;
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

  private createWarbladeTexture(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    const points = [
      new Phaser.Math.Vector2(15, 0),
      new Phaser.Math.Vector2(25, 38),
      new Phaser.Math.Vector2(20, 45),
      new Phaser.Math.Vector2(10, 38),
    ];
    graphics.fillStyle(0x9da7a1).fillPoints([
      ...points,
    ], true);
    graphics.lineStyle(2, 0xe1e5dc).strokePoints([...points, points[0]], true);
    graphics.fillStyle(0x75502e).fillRect(14, 43, 5, 18);
    graphics.fillStyle(0xc6a35c).fillRect(7, 43, 19, 4);
    graphics.generateTexture('player-warblade', 34, 64);
    graphics.destroy();
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
    this.coinsText?.setText(`Münzen: ${this.wallet.coins} (+${this.coinsEarnedThisLevel})`);
    this.levelText?.setText(`Level ${this.currentLevel}`);
    this.playerHealthBar.clear();
    this.playerHealthBar.fillStyle(0x171b19, 0.9).fillRoundedRect(24, 78, 160, 10, 4);
    this.playerHealthBar.fillStyle(0x61bd82, 1).fillRoundedRect(26, 80, 156 * ratio, 6, 3);
    this.playerHealthBar.lineStyle(1, 0xe0d1b9, 0.9).strokeRoundedRect(24, 78, 160, 10, 4);
  }
}
