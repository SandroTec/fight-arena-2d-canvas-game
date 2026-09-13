export
/**
 * Core game engine that manages rendering, game state, collisions and game flow.
 * Acts as central controller between canvas, entities and game systems.
 */
class Game {
    /**
     * Creates the game world and initializes rendering systems.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {Keyboard} keyboard
     
    /** @type {HTMLCanvasElement} */
    canvas;

    /** @type {CanvasRenderingContext2D} */
    ctx;

    /** @type {Keyboard} */
    keyboard;


    constructor(canvas, keyboard) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.keyboard = keyboard;

    }
}