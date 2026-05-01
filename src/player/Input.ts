export type Key = "w" | "a" | "s" | "d" | "q" | "e";

export class Input {
  private keys: Record<Key, boolean> = { w: false, a: false, s: false, d: false, q: false, e: false };
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  private spaceDown = false;
  private spaceTapped = false;
  private spaceDownStartedAt = 0;
  private spaceTapThresholdMs = 180;

  private shiftDown = false;
  private rmbDown = false;
  private lightAttackTapped = false;
  private heavyAttackTapped = false;
  private qTapped = false;
  private eTapped = false;

  constructor() {
    document.addEventListener("click", () => {
      document.body.requestPointerLock();
    });

    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase() as Key;
      if (key in this.keys) this.keys[key] = true;

      if (e.code === "Space") {
        if (!this.spaceDown) this.spaceDownStartedAt = performance.now();
        this.spaceDown = true;
      }

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.shiftDown = true;
    });

    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase() as Key;
      if (key in this.keys) this.keys[key] = false;

      if (e.code === "Space") {
        const held = performance.now() - this.spaceDownStartedAt;
        if (held <= this.spaceTapThresholdMs) this.spaceTapped = true;
        this.spaceDown = false;
      }

      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.shiftDown = false;
      if (e.code === "KeyQ") this.qTapped = true;
      if (e.code === "KeyE") this.eTapped = true;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        if (this.shiftDown) this.heavyAttackTapped = true;
        else                this.lightAttackTapped = true;
      }
      if (e.button === 2) this.rmbDown = true;
    });

    window.addEventListener("mouseup", (e) => {
      if (e.button === 2) this.rmbDown = false;
    });

    window.addEventListener("mousemove", (e) => {
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    // Prevent context menu on right click
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  isDown(key: Key): boolean { return this.keys[key]; }

  isSpaceDown(): boolean  { return this.spaceDown; }
  isShiftDown(): boolean  { return this.shiftDown; }
  isBlocking(): boolean   { return this.rmbDown; }

  peekSpaceTap(): boolean { return this.spaceTapped; }

  consumeSpaceTap(): boolean {
    const v = this.spaceTapped;
    this.spaceTapped = false;
    return v;
  }

  consumeLightAttack(): boolean {
    const v = this.lightAttackTapped;
    this.lightAttackTapped = false;
    return v;
  }

  consumeHeavyAttack(): boolean {
    const v = this.heavyAttackTapped;
    this.heavyAttackTapped = false;
    return v;
  }

  consumeQTap(): boolean {
    const v = this.qTapped;
    this.qTapped = false;
    return v;
  }

  consumeETap(): boolean {
    const v = this.eTapped;
    this.eTapped = false;
    return v;
  }

  consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }
}
