export class Player {
    playerX = 100;
    playerY = 100;
    width = 50;
    height = 50;

    ctx: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;

    constructor(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
        this.ctx = ctx;
        this.canvas = canvas;
    }

    update() {
        this.playerX += 1;
        if (this.playerX > (this.canvas.width - this.width)) {
        this.playerX = 100;
        }
    }

    draw() {
        this.ctx.fillRect(
            this.playerX,
            this.playerY,
            this.width,
            this.height
        );
    }
}

    