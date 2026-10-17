import assert from 'node:assert/strict';
import test from 'node:test';
import { createMeleeHitbox, MeleeAttackWindow, rectanglesOverlap, segmentIntersectsRectangle } from '../src/modals/combatGeometry.ts';

const playerBody = { x: 100, y: 100, width: 40, height: 40 };

test('melee hitbox is placed in the last facing direction', () => {
  assert.deepEqual(createMeleeHitbox(playerBody, { x: 1, y: 0 }, 62, 48), {
    x: 145, y: 96, width: 62, height: 48,
  });
  assert.deepEqual(createMeleeHitbox(playerBody, { x: 0, y: -1 }, 62, 48), {
    x: 96, y: 33, width: 48, height: 62,
  });
});

test('only targets overlapping the active strike rectangle are in range', () => {
  const strike = createMeleeHitbox(playerBody, { x: 1, y: 0 }, 62, 48);
  assert.equal(rectanglesOverlap(strike, { x: 174, y: 110, width: 20, height: 20 }), true);
  assert.equal(rectanglesOverlap(strike, { x: 110, y: 110, width: 20, height: 20 }), false);
  assert.equal(rectanglesOverlap(strike, { x: 250, y: 110, width: 20, height: 20 }), false);
});

test('line of sight is blocked only when the segment crosses a wall', () => {
  const wall = { x: 40, y: 0, width: 10, height: 40 };
  assert.equal(segmentIntersectsRectangle(0, 20, 100, 20, wall), true);
  assert.equal(segmentIntersectsRectangle(0, 50, 100, 50, wall), false);
  assert.equal(segmentIntersectsRectangle(0, 0, 30, 0, wall), false);
});

test('attacks start immediately, stay active briefly, and respect their cooldown', () => {
  const attack = new MeleeAttackWindow(360, 130);
  assert.equal(attack.start(0), true);
  assert.equal(attack.isActive(0), true);
  assert.equal(attack.isActive(129), true);
  assert.equal(attack.isActive(130), false);
  assert.equal(attack.start(359), false);
  assert.equal(attack.start(360), true);
});

test('an enemy can be claimed for damage only once per attack', () => {
  const attack = new MeleeAttackWindow(360, 130);
  const enemy = {};
  assert.equal(attack.start(0), true);
  assert.equal(attack.claimTarget(enemy, 10), true);
  assert.equal(attack.claimTarget(enemy, 20), false);
  assert.equal(attack.claimTarget(enemy, 130), false);
  assert.equal(attack.start(360), true);
  assert.equal(attack.claimTarget(enemy, 370), true);
});
