import Phaser from 'phaser';

type FrameUrl = string;
type AnimationFrames = Array<{ key: string }>;

const idleFiles = import.meta.glob<FrameUrl>(
  './Dark_Oracle_1/PNG/PNG Sequences/Idle/*.png',
  { eager: true, query: '?url', import: 'default' },
);
const runningFiles = import.meta.glob<FrameUrl>(
  './Dark_Oracle_1/PNG/PNG Sequences/Running/*.png',
  { eager: true, query: '?url', import: 'default' },
);

function loadSequence(scene: Phaser.Scene, name: string, files: Record<string, FrameUrl>): AnimationFrames {
  return Object.entries(files)
    .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
    .map(([, url], index) => {
      const key = `dark-oracle-${name}-${index}`;
      scene.load.image(key, url);
      return { key };
    });
}

export function preloadDarkOracle(scene: Phaser.Scene): void {
  loadSequence(scene, 'idle', idleFiles);
  loadSequence(scene, 'running', runningFiles);
}

export function createDarkOracleAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists('dark-oracle-idle') && scene.anims.exists('dark-oracle-running')) return;

  const idleFrames = Object.keys(idleFiles).length;
  const runningFrames = Object.keys(runningFiles).length;

  scene.anims.create({
    key: 'dark-oracle-idle',
    frames: Array.from({ length: idleFrames }, (_, index) => ({ key: `dark-oracle-idle-${index}` })),
    frameRate: 8,
    repeat: -1,
  });
  scene.anims.create({
    key: 'dark-oracle-running',
    frames: Array.from({ length: runningFrames }, (_, index) => ({ key: `dark-oracle-running-${index}` })),
    frameRate: 12,
    repeat: -1,
  });
}
