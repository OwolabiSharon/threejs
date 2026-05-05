import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import type { PlayerState } from "./PlayerState";

const CLIPS: Record<string, string> = {
  "idle":          "/assets/animations/Base Idle.fbx",
  "lockedIdle":    "/assets/animations/Locked Idle.fbx",
  "walkForward":   "/assets/animations/walk forward.fbx",
  "walkBackward":  "/assets/animations/walk backward.fbx",
  "walkLeft":      "/assets/animations/walk strafe left.fbx",
  "walkRight":     "/assets/animations/walk strafe right.fbx",
  "runForward":    "/assets/animations/run forward.fbx",
  "runBackward":   "/assets/animations/run backward.fbx",
  "runLeft":       "/assets/animations/run strafe left.fbx",
  "runRight":      "/assets/animations/run strafe right.fbx",
  "rollForward":   "/assets/animations/roll forward.fbx",
  "backStep":      "/assets/animations/back step.fbx",
  "death":         "/assets/animations/Falling Back Death.fbx",
  // Combat
  "blockIdle":             "/assets/animations/combat/Block Idle.fbx",
 "lightMidSlash":         "/assets/animations/combat/light mid slash.fbx",
  "lightOverHeadSlash":    "/assets/animations/combat/light over head slash.fbx",
  "lightUpperSlash":       "/assets/animations/combat/light upper slash.fbx",
  "lightUpperSlash2":      "/assets/animations/combat/light upper slash 2.fbx",
  "heavy360Mid":           "/assets/animations/combat/heavy 360 mid.fbx",
  "heavy360":              "/assets/animations/combat/heavy 360.fbx",
  "heavyJumpSlash":        "/assets/animations/combat/heavy jump slash.fbx",
  "heavyUpperSlash":       "/assets/animations/combat/heavy upper slash.fbx",
  "hitImpact":             "/assets/animations/combat/hit impact.fbx",
  "shieldImpact":          "/assets/animations/combat/shield impact.fbx",
};

const PRIORITY_CLIPS = ["idle"];
const DEFERRED_CLIPS = Object.keys(CLIPS).filter(k => k !== "idle");

const FADE_DURATION = 0.2;
const BLOCK_FADE_DURATION = 0.08;
const ONE_SHOT_KEYS = new Set([
  "rollForward", "backStep", "death",
  "lightMidSlash", "lightOverHeadSlash", "lightUpperSlash", "lightUpperSlash2",
  "heavy360Mid", "heavy360", "heavyJumpSlash", "heavyUpperSlash",
  "hitImpact", "shieldImpact",
]);
const INTERRUPT_KEYS = new Set(["hitImpact", "shieldImpact"]);

export class Animations {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<string, THREE.AnimationAction>> = {};
  private current: THREE.AnimationAction | null = null;
  private currentKey: string | null = null;
  private elapsed = 0;
  private lockedUntil = 0;
  private wasOneShot = false;
  private loader = new FBXLoader();

  private pendingOneShotComplete = false;

  onOneShotComplete: (() => void) | null = null;

  constructor(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;
    this.loadClips(PRIORITY_CLIPS, () => this.loadClips(DEFERRED_CLIPS));
  }

  private loadClips(keys: string[], onAllLoaded?: () => void): void {
    let remaining = keys.length;
    for (const name of keys) {
      this.loader.load(CLIPS[name], (fbx) => {
        const clip = fbx.animations[0];
        if (clip) {
          const action = this.mixer.clipAction(clip);
          action.play();
          action.weight = 0;
          if (name.includes("light") || name.includes("heavy")) {
            action.timeScale = 1.5;
          }
          if (name === "rollForward") {
            action.timeScale = 1.5;
          }
          if (ONE_SHOT_KEYS.has(name)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          this.actions[name] = action;
          if (name === "idle" && !this.current) this.crossfadeTo(action);
        }
        if (--remaining === 0) onAllLoaded?.();
      });
    }
  }

  playOneShot(key: string): void {
    const action = this.actions[key];
    if (!action) return;
    
    const shouldInterrupt = INTERRUPT_KEYS.has(key);
    if (shouldInterrupt) {
      this.lockedUntil = 0;
    }
    
    this.crossfadeTo(action, true, FADE_DURATION, shouldInterrupt);
    this.currentKey = key;
    const actualDuration = action.getClip().duration / action.timeScale;
    this.lockedUntil = this.elapsed + actualDuration - FADE_DURATION;
    this.wasOneShot = true;
  }

  update(state: PlayerState, delta: number): void {
    this.elapsed += delta;
    const isLocked = this.elapsed < this.lockedUntil;

    if (!isLocked && this.wasOneShot) {
      this.wasOneShot = false;
      this.pendingOneShotComplete = true;
    }
    if (isLocked) return;

    const key = this.resolveKey(state);
    if (key === this.currentKey) return;
    const next = this.actions[key];
    if (!next) return;

    const snap = ONE_SHOT_KEYS.has(key);
    const fade = key === "blockIdle" || this.currentKey?.includes("block") ? BLOCK_FADE_DURATION : FADE_DURATION;
    this.crossfadeTo(next, snap, fade);
    this.currentKey = key;

    if (snap) {
      const actualDuration = next.getClip().duration / next.timeScale;
      this.lockedUntil = this.elapsed + actualDuration - FADE_DURATION;
      this.wasOneShot = true;
    }
  }

  /** Call this after mixer.update() each frame to flush deferred callbacks */
  flushCallbacks(): void {
    if (this.pendingOneShotComplete) {
      this.pendingOneShotComplete = false;
      this.currentKey = null;
      this.onOneShotComplete?.();
    }
  }

  private resolveKey(state: PlayerState): string {
    const { id, moveDir, isRunning, attackClip, isBlocking } = state;

    if (attackClip && (id === "lightAttack" || id === "heavyAttack")) return attackClip.clip;
    if (isBlocking) return "blockIdle";

    if (id === "idle")       return "idle";
    if (id === "lockedIdle") return "lockedIdle";
    if (id === "roll" || id === "lockedRoll") return moveDir ? "rollForward" : "backStep";
    if (id === "walk")       return "walkForward";
    if (id === "run")        return "runForward";

    const tier = isRunning ? "run" : "walk";
    const dir  = moveDir ?? "forward";
    return `${tier}${dir.charAt(0).toUpperCase()}${dir.slice(1)}`;
  }

  private crossfadeTo(next: THREE.AnimationAction, snap = false, fadeDuration = FADE_DURATION, instant = false): void {
    if (this.current) {
      if (snap || instant) {
        this.current.setEffectiveWeight(0);
        next.reset().play();
      } else {
        this.current.crossFadeTo(next, fadeDuration, false);
      }
    }
    next.enabled = true;
    next.setEffectiveWeight(1);
    this.current = next;
  }
}
