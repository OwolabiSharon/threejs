import * as THREE from "three";
import { loadClip } from "./ClipCache";
import type { EnemyState } from "./EnemyState";
import { ENEMY_ATTACK_LIST } from "../combat/AttackData";

const CLIPS: Record<string, string> = {
  "idle":               "/assets/animations/Base Idle.fbx",
  "walk":               "/assets/animations/walk forward.fbx",
  "walkBackward":       "/assets/animations/walk backward.fbx",
  "run":                "/assets/animations/run forward.fbx",
  "walkLeft":           "/assets/animations/walk strafe left.fbx",
  "walkRight":          "/assets/animations/walk strafe right.fbx",
  "blockIdle":          "/assets/animations/combat/Block Idle.fbx",
  "lightMidSlash":      "/assets/animations/combat/light mid slash.fbx",
  "lightOverHeadSlash": "/assets/animations/combat/light over head slash.fbx",
  "lightUpperSlash":    "/assets/animations/combat/light upper slash.fbx",
  "lightUpperSlash2":   "/assets/animations/combat/light upper slash 2.fbx",
  "taunt":              "/assets/animations/combat/enemy taunt.fbx",
  "hitImpact":          "/assets/animations/combat/hit impact.fbx",
  "shieldImpact":       "/assets/animations/combat/shield impact.fbx",
  "death":              "/assets/animations/Falling Back Death.fbx",
};

const PRIORITY = ["idle"];
const DEFERRED = Object.keys(CLIPS).filter(k => k !== "idle");

const FADE_DURATION = 0.2;
const BLOCK_DURATION = 1.5;
const ONE_SHOT_KEYS = new Set([...ENEMY_ATTACK_LIST.map(a => a.clip), "death"]);
const INTERRUPT_KEYS = new Set(["hitImpact", "shieldImpact", "death"]);

export class EnemyAnimations {
  private mixer: THREE.AnimationMixer;
  private actions: Partial<Record<string, THREE.AnimationAction>> = {};
  private current: THREE.AnimationAction | null = null;
  private currentKey: string | null = null;
  private elapsed = 0;
  private lockedUntil = 0;
  private wasOneShot = false;
  private pendingOneShotComplete = false;

  onOneShotComplete: (() => void) | null = null;

  constructor(mixer: THREE.AnimationMixer) {
    this.mixer = mixer;

    for (const name of PRIORITY) {
      loadClip(CLIPS[name], (clip) => {
        this.registerClip(name, clip);
        for (const d of DEFERRED) loadClip(CLIPS[d], (c) => this.registerClip(d, c));
      });
    }
  }

  private registerClip(name: string, clip: THREE.AnimationClip): void {
    const action = this.mixer.clipAction(clip);
    action.play();
    action.weight = 0;
    this.actions[name] = action;
    if (name === "idle" && !this.current) this.crossfadeTo(action);
  }

  playOneShot(key: string): void {
    const action = this.actions[key];
    if (!action) return;
    
    const shouldInterrupt = INTERRUPT_KEYS.has(key);
    if (shouldInterrupt) {
      this.lockedUntil = 0;
    }
    
    this.crossfadeTo(action, true, shouldInterrupt);
    this.currentKey = key;
    this.lockedUntil = this.elapsed + action.getClip().duration - FADE_DURATION;
    this.wasOneShot = true;
  }

  update(state: EnemyState, delta: number): void {
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
    this.crossfadeTo(next, snap);
    this.currentKey = key;

    if (snap) {
      this.lockedUntil = this.elapsed + next.getClip().duration - FADE_DURATION;
      this.wasOneShot = true;
    } else if (key === "blockIdle") {
      this.lockedUntil = this.elapsed + BLOCK_DURATION;
      this.wasOneShot = true;
    }
  }

  flushCallbacks(): void {
    if (this.pendingOneShotComplete) {
      this.pendingOneShotComplete = false;
      this.currentKey = null;
      this.onOneShotComplete?.();
    }
  }

  private resolveKey(state: EnemyState): string {
    if (state.isDead)                          return "death";
    if (state.isAttacking && state.attackClip) return state.attackClip.clip;
    if (state.isBlocking)                      return "blockIdle";
    if (state.id === "taunt")                  return "taunt";
    if (state.id === "pullback")               return "walkBackward";
    if (state.id === "circle")                 return state.strafeDir === 1 ? "walkLeft" : "walkRight";
    if (state.id === "run" || state.id === "moveToAttack") return "run";
    if (state.isMoving)                        return "walk";
    return "idle";
  }

  private crossfadeTo(next: THREE.AnimationAction, snap = false, instant = false): void {
    if (this.current) {
      if (snap || instant) {
        this.current.setEffectiveWeight(0);
        next.reset().play();
      } else {
        this.current.crossFadeTo(next, FADE_DURATION, false);
      }
    }
    next.enabled = true;
    next.setEffectiveWeight(1);
    this.current = next;
  }
}
