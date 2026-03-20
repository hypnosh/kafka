// input.js — unified input state for keyboard and touch

export class InputManager {
  constructor() {
    this.state = {
      left: false,
      right: false,
      down: false,
      jumpHeld: false,
      jumpPressed: false,   // single-frame flag
      attackPressed: false, // single-frame flag
      attackHeld: false,
      hissPressed: false,   // single-frame flag
      pause: false,
    };

    // Track previous frame for single-frame flags
    this._prev = { ...this.state };
    this._raw = { ...this.state }; // raw held state

    // Attack double-tap detection for hiss (Z+Z)
    this._lastAttackTime = 0;
    this._DOUBLE_TAP_WINDOW = 0.25; // seconds

    this._keys = {};
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup', this._boundKeyUp);
  }

  _onKeyDown(e) {
    if (this._keys[e.code]) return; // already held
    this._keys[e.code] = true;

    switch (e.code) {
      case 'ArrowLeft':  this._raw.left = true; break;
      case 'ArrowRight': this._raw.right = true; break;
      case 'ArrowDown':  this._raw.down = true; break;
      case 'Space':
        e.preventDefault();
        this._raw.jumpHeld = true;
        this._raw.jumpPressed = true;
        break;
      case 'KeyZ':
        this._raw.attackHeld = true;
        this._raw.attackPressed = true;
        // Double-tap Z = hiss
        const now = performance.now() / 1000;
        if (now - this._lastAttackTime < this._DOUBLE_TAP_WINDOW) {
          this._raw.hissPressed = true;
        }
        this._lastAttackTime = now;
        break;
      case 'KeyX':
        this._raw.hissPressed = true;
        break;
      case 'Escape':
        this._raw.pause = true;
        break;
    }
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;

    switch (e.code) {
      case 'ArrowLeft':  this._raw.left = false; break;
      case 'ArrowRight': this._raw.right = false; break;
      case 'ArrowDown':  this._raw.down = false; break;
      case 'Space':      this._raw.jumpHeld = false; break;
      case 'KeyZ':       this._raw.attackHeld = false; break;
    }
  }

  // Called by touch controls (DPad component)
  setTouch(key, value) {
    this._raw[key] = value;
    if (key === 'jumpPressed' || key === 'attackPressed' || key === 'hissPressed') {
      // These are pulsed — set true here, cleared next frame
    }
  }

  // Called once per frame at start of update
  update() {
    this.state = {
      left:          this._raw.left,
      right:         this._raw.right,
      down:          this._raw.down,
      jumpHeld:      this._raw.jumpHeld,
      jumpPressed:   this._raw.jumpPressed,
      attackPressed: this._raw.attackPressed,
      attackHeld:    this._raw.attackHeld,
      hissPressed:   this._raw.hissPressed,
      pause:         this._raw.pause,
    };

    // Clear single-frame flags
    this._raw.jumpPressed = false;
    this._raw.attackPressed = false;
    this._raw.hissPressed = false;
    this._raw.pause = false;
  }

  isAnyKeyPressed() {
    return Object.values(this._keys).some(Boolean);
  }

  destroy() {
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup', this._boundKeyUp);
  }
}
