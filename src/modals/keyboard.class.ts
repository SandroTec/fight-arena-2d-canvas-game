export
class Keyboard {
    /** @type {boolean} */
    LEFT = false;
    /** @type {boolean} */
    RIGHT = false;
    /** @type {boolean} */
    SPACE = false;
    /** @type {boolean} */
    D = false;
    /** @type {boolean} */
    C = false;

    /** @type {HTMLElement} */
    btnLeft = document.getElementById('moveLeft');
    /** @type {HTMLElement} */
    btnRight = document.getElementById('moveRight');
    /** @type {HTMLElement} */
    btnJump = document.getElementById('jump');
    /** @type {HTMLElement} */
    btnThrow = document.getElementById('throw');

    /**
     * Creates a new Keyboard controller instance.
     * Initializes keyboard and button input bindings.
     */
    constructor() {
        this.bindKeyboard();
        this.bindButtons();
    }

    /**
     * Registers keyboard event listeners for movement and action controls.
     * Updates internal boolean state based on key press and release events.
     */
    bindKeyboard() {
        window.addEventListener('keydown', (e) => this.handleKeyChange(e.code, true));
        window.addEventListener('keyup', (e) => this.handleKeyChange(e.code, false));
    }

    /**
     * Binds all on-screen control buttons to corresponding keyboard states.
     * Enables touch and pointer input support for mobile devices.
     */
    bindButtons() {
        this.bindButton(this.btnLeft, 'LEFT');
        this.bindButton(this.btnRight, 'RIGHT');
        this.bindButton(this.btnJump, 'SPACE');
        this.bindButton(this.btnThrow, 'D');
    }

    /**
     * Binds a single button element to a keyboard state property.
     * Ensures proper handling of pointer interactions (down, up, leave, cancel).
     *
     * @param {HTMLElement} btn - The button element to bind.
     * @param {string} key - The internal state key to update.
     */
    bindButton(btn, key) {
        if (!btn) return;
        const setState = (state) => {
            this[key] = state;
        };
        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            setState(true);
        });
        const reset = () => setState(false);
        btn.addEventListener('pointerup', reset);
        btn.addEventListener('pointerleave', reset);
        btn.addEventListener('pointercancel', reset);
    }

    /**
     * Handles mapping of keyboard event codes to internal state flags.
     *
     * @param {string} code - The keyboard event code.
     * @param {boolean} state - True if key is pressed, false if released.
     */
    handleKeyChange(code, state) {
        switch (code) {
            case 'ArrowLeft':
                this.LEFT = state;
                break;
            case 'ArrowRight':
                this.RIGHT = state;
                break;
            case 'Space':
                this.SPACE = state;
                break;
            case 'KeyD':
                this.D = state;
                break;
            case 'KeyC':
                this.C = state;
                break;
        }
    }
}