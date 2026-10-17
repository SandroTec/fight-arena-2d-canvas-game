export interface CombatRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CombatDirection {
  x: number;
  y: number;
}

/** Tracks whether an attack can start and while its hitbox is active. */
export class MeleeAttackWindow {
  private nextAttackAt = Number.NEGATIVE_INFINITY;
  private attackEndsAt = 0;
  private readonly hitTargets = new Set<object>();
  private readonly cooldownMs: number;
  private readonly activeMs: number;

  constructor(cooldownMs: number, activeMs: number) {
    this.cooldownMs = cooldownMs;
    this.activeMs = activeMs;
  }

  start(time: number): boolean {
    if (time < this.nextAttackAt) return false;
    this.nextAttackAt = time + this.cooldownMs;
    this.attackEndsAt = time + this.activeMs;
    this.hitTargets.clear();
    return true;
  }

  isActive(time: number): boolean {
    return time < this.attackEndsAt;
  }

  claimTarget(target: object, time: number): boolean {
    if (!this.isActive(time) || this.hitTargets.has(target)) return false;
    this.hitTargets.add(target);
    return true;
  }
}

/** Builds a one-direction strike area from the outside edge of a mover body. */
export function createMeleeHitbox(
  body: CombatRectangle,
  direction: CombatDirection,
  range: number,
  width: number,
  gap = 5,
): CombatRectangle {
  const halfWidth = width / 2;
  const centerX = body.x + body.width / 2;
  const centerY = body.y + body.height / 2;

  if (direction.x > 0) return { x: body.x + body.width + gap, y: centerY - halfWidth, width: range, height: width };
  if (direction.x < 0) return { x: body.x - gap - range, y: centerY - halfWidth, width: range, height: width };
  if (direction.y < 0) return { x: centerX - halfWidth, y: body.y - gap - range, width, height: range };
  return { x: centerX - halfWidth, y: body.y + body.height + gap, width, height: range };
}

export function rectanglesOverlap(first: CombatRectangle, second: CombatRectangle): boolean {
  return first.x < second.x + second.width
    && first.x + first.width > second.x
    && first.y < second.y + second.height
    && first.y + first.height > second.y;
}

/** Returns true when a segment crosses a wall rectangle (including its edge). */
export function segmentIntersectsRectangle(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  rect: CombatRectangle,
): boolean {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  let minT = 0;
  let maxT = 1;

  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) {
      if (t > maxT) return false;
      minT = Math.max(minT, t);
    } else {
      if (t < minT) return false;
      maxT = Math.min(maxT, t);
    }
    return true;
  };

  return clip(-deltaX, startX - rect.x)
    && clip(deltaX, rect.x + rect.width - startX)
    && clip(-deltaY, startY - rect.y)
    && clip(deltaY, rect.y + rect.height - startY)
    && minT <= maxT;
}
