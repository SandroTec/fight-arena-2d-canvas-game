import Phaser from 'phaser';

type FrameUrl = string;
type EnemyAction = 'attacking' | 'idle' | 'running';
type EnemyFacing = 'down' | 'left' | 'right' | 'up';

const enemyFiles = import.meta.glob<FrameUrl>(
  './enemies/Pirate Zombie/PNG/PNG Sequences/**/*.png',
  { eager: true, query: '?url', import: 'default' },
);

const animationKey = (action: EnemyAction, facing: EnemyFacing): string => `pirate-zombie-${action}-${facing}`;

export function preloadPirateZombie(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(enemyFiles)) {
    const sequence = path.match(/(Back|Front|Left|Right) - (Attacking|Idle|Running)\//);
    if (!sequence) continue;

    const direction = sequence[1] === 'Back' ? 'up' : sequence[1] === 'Front' ? 'down' : sequence[1].toLowerCase();
    const action = sequence[2].toLowerCase();
    const frame = path.match(/_(\d+)\.png$/)?.[1];
    if (!frame) continue;
    scene.load.image(`pirate-zombie-${action}-${direction}-${frame}`, url);
  }
}

export function createPirateZombieAnimations(scene: Phaser.Scene): void {
  const actions: EnemyAction[] = ['idle', 'running', 'attacking'];
  const directions: EnemyFacing[] = ['down', 'left', 'right', 'up'];

  for (const action of actions) {
    for (const direction of directions) {
      const key = animationKey(action, direction);
      if (scene.anims.exists(key)) continue;

      const prefix = `${key}-`;
      const frameKeys = Object.keys(scene.textures.list)
        .filter((textureKey) => textureKey.startsWith(prefix))
        .sort((first, second) => Number(first.slice(prefix.length)) - Number(second.slice(prefix.length)));
      if (frameKeys.length === 0) continue;

      scene.anims.create({
        key,
        frames: frameKeys.map((textureKey) => ({ key: textureKey })),
        frameRate: action === 'running' ? 12 : action === 'attacking' ? 18 : 8,
        repeat: action === 'attacking' ? 0 : -1,
      });
    }
  }
}

export function pirateZombieAnimation(action: EnemyAction, facing: EnemyFacing): string {
  return animationKey(action, facing);
}
