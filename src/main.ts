import './style.css';
import { Player } from './modals/player.class.ts';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!ctx) {
    throw new Error('Could not get canvas context');
}

const player = new Player(ctx, canvas);

function gameLoop() {
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    player.update();
    player.draw();

    requestAnimationFrame(gameLoop);
}

gameLoop();