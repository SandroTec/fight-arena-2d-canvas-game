import Phaser from 'phaser';
import './style.scss';
import { ArenaScene } from './modals/game.class.ts';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#17251f',
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [ArenaScene],
});

window.addEventListener('beforeunload', () => game.destroy(true));
