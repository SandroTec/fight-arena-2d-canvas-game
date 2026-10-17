import Phaser from 'phaser';

type FrameUrl = string;
type LeaderAction = 'attacking' | 'idle' | 'running';
type LeaderFacing = 'down' | 'left' | 'right' | 'up';

const enemyFiles = import.meta.glob<FrameUrl>(
  './enemies/Pirate Leader/PNG Sequences/**/*.png',
  { eager: true, query: '?url', import: 'default' },
);

const animationKey = (action: LeaderAction, facing: LeaderFacing): string => `pirate-leader-${action}-${facing}`;

export function preloadPirateLeader(scene: Phaser.Scene): void {
  for (const [path, url] of Object.entries(enemyFiles)) {
    const sequence = path.match(/(Back|Front|Left|Right) - (Attacking|Idle|Running)\//);
    if (!sequence) continue;

    const direction = sequence[1] === 'Back' ? 'up' : sequence[1] === 'Front' ? 'down' : sequence[1].toLowerCase();
    const action = sequence[2].toLowerCase();
    const frame = path.match(/_(\d+)\.png$/)?.[1];
    if (frame) scene.load.image(`pirate-leader-${action}-${direction}-${frame}`, url);
  }
}

export function createPirateLeaderAnimations(scene: Phaser.Scene): void {
  const actions: LeaderAction[] = ['idle', 'running', 'attacking'];
  const directions: LeaderFacing[] = ['down', 'left', 'right', 'up'];

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
        frameRate: action === 'running' ? 12 : action === 'attacking' ? 16 : 8,
        repeat: action === 'attacking' ? 0 : -1,
      });
    }
  }
}

export function pirateLeaderAnimation(action: LeaderAction, facing: LeaderFacing): string {
  return animationKey(action, facing);
}
