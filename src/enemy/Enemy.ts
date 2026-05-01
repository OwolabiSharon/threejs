import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EnemyMovement } from "./EnemyMovement";
import { EnemyAnimations } from "./EnemyAnimations";
import type { EnemyState, EnemyStateId } from "./EnemyState";
import { type AttackData, ENEMY_ATTACK_LIST } from "../combat/AttackData";
import type { Player } from "../player/Player";
import { Collider } from "../physics";
import * as Config from "./EnemyConfig";
import { EnemyUI } from "../ui/EnemyUI";

const IDLE_STATE: EnemyState = {
  id: "idle",
  isMoving: false,
  isAttacking: false,
  isBlocking: false,
  isDead: false,
  attackClip: null,
  strafeDir: 1,
};

const DEAD_STATE: EnemyState = {
  id: "dead",
  isMoving: false,
  isAttacking: false,
  isBlocking: false,
  isDead: true,
  attackClip: null,
  strafeDir: 1,
};

export class Enemy {
  // ═══════════════════════════════════════════════════════════════════════════
  // Properties
  // ═══════════════════════════════════════════════════════════════════════════

  // Scene & Rendering
  public root: THREE.Group;
  private scene: THREE.Scene;
  private model: THREE.Object3D | null = null;
  private loader = new GLTFLoader();

  // State
  public state: EnemyState = { ...IDLE_STATE };
  private pendingStateId: EnemyStateId | null = null;
  private stateLagTimer = 0;
  private isDeathAnimationPlaying = false;
  private shouldDestroy = false;

  // Systems
  private movement: EnemyMovement;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: EnemyAnimations | null = null;

  // Combat Stats
  public hp = 100;
  public poise = 100;
  public readonly maxHp = 100;
  public readonly maxPoise = 100;

  // Combat State
  public currentAttack: AttackData | null = null;
  private reactionCooldown = 0;
  private isRegisteredAttacker = false;

  // Movement State
  private isMoveToAttack = false;
  private moveToAttackTimer = 0;
  private isInPullback = false;
  private targetPullbackDistance = 0;
  private circleMode: "strafe" | "taunt" | null = null;
  private strafeDir: 1 | -1 = 1;
  private strafeSwitchTimer = 0;

  // Cooldowns
  private secondCooldown = 0;

  // Knockdown (currently disabled)
  private isKnockedDown = false;
  private knockdownTimer = 0;

  // Colliders
  private sword: THREE.Object3D | null = null;
  public swordCollider: Collider | null = null;
  public bodyCollider: Collider | null = null;

  // References
  private player: Player | null = null;

  // UI
  public ui: EnemyUI;

  // Attack movement
  private static readonly ATTACK_LUNGE_FORCE = 6.5;
  private static readonly HIT_KNOCKBACK_FORCE = 5;
  private movementVelocity = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();

  // ═══════════════════════════════════════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════════════════════════════════════

  constructor(scene: THREE.Scene, position = new THREE.Vector3()) {
    this.scene = scene;
    this.movement = new EnemyMovement();
    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.scene.add(this.root);
    this.ui = new EnemyUI(this.root);
    this.root.userData.enemyUI = this.ui;
  }

  setPlayer(player: Player): void {
    this.player = player;
  }

  load(modelPath: string): void {
    this.loadModel(modelPath);
    this.createBodyCollider();
    this.ui.createHealthBar();
    this.ui.updateHealth(this.hp, this.maxHp);
  }

  private loadModel(modelPath: string): void {
    this.loader.load(modelPath, (gltf: GLTF) => {
      this.model = gltf.scene;
      this.model.rotation.y = Math.PI;
      this.root.add(this.model);

      this.createSwordCollider();
      this.setupAnimations();
    });
  }

  private createSwordCollider(): void {
    this.sword = this.model?.getObjectByName("SW04") ?? null;
    if (!this.sword) return;

    const colliderHelper = new THREE.Object3D();
    colliderHelper.position.set(0, 0, -1.2);
    this.sword.add(colliderHelper);

    this.swordCollider = new Collider(
      colliderHelper,
      { type: "box", size: new THREE.Vector3(0.6, 0.6, 2.4) },
      "enemySword",
      true,
      false
    );

    const debugBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.6, 2.4),
      new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
    );
    colliderHelper.add(debugBox);
  }

  private createBodyCollider(): void {
    const bodyHelper = new THREE.Object3D();
    bodyHelper.position.set(0, 1.8, 0);
    this.root.add(bodyHelper);

    this.bodyCollider = new Collider(
      bodyHelper,
      { type: "box", size: new THREE.Vector3(1.2, 2.8, 1.2) },
      "enemy",
      false,
      true,
      this.root
    );

    const debugBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.8, 1.2),
      new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
    );
    // bodyHelper.add(debugBox);
  }

  private setupAnimations(): void {
    if (!this.model) return;
    this.mixer = new THREE.AnimationMixer(this.model);
    this.animations = new EnemyAnimations(this.mixer);
    this.animations.onOneShotComplete = () => this.onOneShotComplete();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Public API
  // ═══════════════════════════════════════════════════════════════════════════

  update(target: THREE.Object3D | null, delta: number): void {
    if (this.shouldDestroy) return;

    if (this.updateKnockdown(delta)) return;

    // Apply movement velocity
    if (this.movementVelocity.lengthSq() > 0) {
      this.root.position.addScaledVector(this.movementVelocity, delta);
      this.movementVelocity.multiplyScalar(Math.max(0, 1 - 8 * delta));
      if (this.movementVelocity.lengthSq() < 0.1) {
        this.movementVelocity.set(0, 0, 0);
      }
    }

    const nextId = this.deriveStateId(target, delta);
    const resolvedId = this.shouldApplyStateLag(nextId)
      ? this.applyStateLag(nextId, delta)
      : nextId;

    this.state = this.buildState(resolvedId);
    
    if (this.state.isDead && !this.isDeathAnimationPlaying) {
      this.isDeathAnimationPlaying = true;
      this.animations?.playOneShot("death");
    }

    this.tickState(target, delta);

    this.animations?.update(this.state, delta);
    this.mixer?.update(delta);
    this.animations?.flushCallbacks();
    this.ui.update(delta);
  }

  registerHit(source: THREE.Object3D, attack: AttackData): void {
    if (this.hp <= 0) return;
    const blocking = this.state.isBlocking;
    const damage = blocking ? attack.shieldedDamage : attack.damage;
    this.hp = Math.max(0, this.hp - damage);
    this.poise = Math.max(0, this.poise - (blocking ? attack.guardBreakDamage : attack.poiseDamage));

    this.ui.spawnDamageNumber(damage);
    this.ui.updateHealth(this.hp, this.maxHp);

    this.applyHitKnockback(source);

    if (this.poise <= Config.POISE_THRESHOLD && blocking) {
      this.state = { ...this.state, isBlocking: false };
      this.animations?.playOneShot("hitImpact");
    } else {
      this.animations?.playOneShot(blocking ? "shieldImpact" : "hitImpact");
    }
  }

  setupSwordCollisionHandler(playerSwordCollider: Collider, onHit: (attack: AttackData) => void): void {
    if (!this.swordCollider) return;
    this.swordCollider.onTriggerEnter = (e) => {
      if (this.state.id !== "attack" || !this.state.isAttacking || !this.currentAttack) return;
      if (this.currentAttack.collisionCount > 0) return;
      if (e.other === playerSwordCollider) return;
      if (e.other.tag !== "player") return;
      this.currentAttack.collisionCount++;
      onHit(this.currentAttack);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Update Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private updateKnockdown(delta: number): boolean {
    if (!this.isKnockedDown) return false;

    this.knockdownTimer -= delta;
    if (this.knockdownTimer <= 0) {
      this.isKnockedDown = false;
      this.poise = this.maxPoise;
    }

    this.mixer?.update(delta);
    this.animations?.flushCallbacks();
    return true;
  }

  private shouldApplyStateLag(nextId: EnemyStateId): boolean {
    return (
      (nextId === "circle" || this.state.id === "circle") &&
      nextId !== "attack" &&
      this.state.id !== "attack"
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Machine - Decision
  // ═══════════════════════════════════════════════════════════════════════════

  private deriveStateId(target: THREE.Object3D | null, delta: number): EnemyStateId {
    if (this.hp <= 0) return "dead";
    if (this.state.isDead) return "dead";
    if (this.state.isAttacking || this.state.isBlocking) return this.state.id;

    this.updateCooldowns(delta);
    this.updateCircleMode();

    if (!target) return "idle";

    const dist = this.distanceTo(target);

    if (dist > Config.CHASE_RANGE) return "idle";

    this.updateMoveToAttackTimer(delta);

    if (this.updatePullbackState(dist)) return "pullback";

    if (dist <= Config.ATTACK_RANGE) return this.decideAttackOrBlock();

    this.currentAttack = null;

    if (this.shouldAttemptMoveToAttack(dist)) {
      return this.circleMode === "taunt" ? "taunt" : "circle";
    }

    if (this.isMoveToAttack || dist > Config.RUN_RANGE) {
      return this.isMoveToAttack ? "moveToAttack" : "run";
    }

    
    return this.circleMode === "taunt" ? "taunt" : "circle";
  }

  private updateCooldowns(delta: number): void {
    this.reactionCooldown = Math.max(0, this.reactionCooldown - delta);
    this.secondCooldown = Math.max(0, this.secondCooldown - delta);
  }

  private updateMoveToAttackTimer(delta: number): void {
    if (!this.isMoveToAttack) return;

    this.moveToAttackTimer -= delta;
    if (this.moveToAttackTimer <= 0) {
      this.isMoveToAttack = false;
    }
  }

  private updatePullbackState(dist: number): boolean {
    if (!this.isInPullback) return false;

    if (dist >= this.targetPullbackDistance) {
      this.isInPullback = false;
      return false;
    }

    return true;
  }

  private shouldAttemptMoveToAttack(dist: number): boolean {
    if (dist > Config.RUN_RANGE || this.isMoveToAttack || !this.player) return false;

    if (this.secondCooldown <= 0) {
      const canAttack = this.player.currentAttackers < 1 && Math.random() < 0.01;
      if (canAttack) {
        this.isMoveToAttack = true;
        this.moveToAttackTimer = Config.MOVE_TO_ATTACK_DURATION;
        this.secondCooldown = Config.SECOND_COOLDOWN;
        return false;
      }
    }

    return !this.isMoveToAttack;
  }

  private updateCircleMode(): void {
    if (this.state.id !== "circle" && this.state.id !== "taunt") {
      this.circleMode = Math.random() < 0.94 ? "strafe" : "taunt";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Machine - Lag
  // ═══════════════════════════════════════════════════════════════════════════

  private applyStateLag(desiredId: EnemyStateId, delta: number): EnemyStateId {
    const isLocked =
      this.state.isAttacking ||
      this.state.isBlocking ||
      this.state.isDead ||
      this.isMoveToAttack;

    if (isLocked || desiredId === this.state.id) {
      this.pendingStateId = null;
      return desiredId;
    }

    if (this.pendingStateId !== desiredId) {
      this.pendingStateId = desiredId;
      this.stateLagTimer = Config.STATE_LAG;
    } else {
      this.stateLagTimer = Math.max(0, this.stateLagTimer - delta);
    }

    return this.stateLagTimer > 0 ? this.state.id : desiredId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Machine - Builder
  // ═══════════════════════════════════════════════════════════════════════════

  private buildState(id: EnemyStateId): EnemyState {
    if (id === "attack") {
      this.isMoveToAttack = false;
    }

    const baseState = {
      id,
      isMoving: this.isMovingState(id),
      isAttacking: id === "attack",
      isBlocking: id === "block",
      isDead: id === "dead",
      attackClip: id === "attack" ? this.currentAttack : null,
      strafeDir: this.strafeDir,
    };

    return id === "dead" ? { ...DEAD_STATE } : baseState;
  }

  private isMovingState(id: EnemyStateId): boolean {
    return ["pullback", "moveToAttack", "run", "circle"].includes(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // State Machine - Execution
  // ═══════════════════════════════════════════════════════════════════════════

  private tickState(target: THREE.Object3D | null, delta: number): void {
    if (!target) return;

    this.movement.state = this.state;

    switch (this.state.id) {
      case "attack":
      case "block":
      case "taunt":
        this.movement.faceTarget(this.root, target, delta, 20);
        break;

      case "pullback":
        this.movement.moveAway(this.root, target, delta, Config.PULLBACK_SPEED);
        break;

      case "moveToAttack":
      case "run":
        this.movement.moveToward(this.root, target, delta, Config.RUN_SPEED);
        break;

      case "circle":
        this.updateStrafeDirection(delta);
        this.movement.strafe(this.root, target, this.strafeDir, delta, Config.STRAFE_SPEED);
        break;
    }
  }

  private updateStrafeDirection(delta: number): void {
    this.strafeSwitchTimer -= delta;
    if (this.strafeSwitchTimer <= 0) {
      this.strafeDir = (Math.random() > 0.5 ? 1 : -1) as 1 | -1;
      this.strafeSwitchTimer =
        Config.STRAFE_SWITCH_MIN +
        Math.random() * (Config.STRAFE_SWITCH_MAX - Config.STRAFE_SWITCH_MIN);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Combat Actions
  // ═══════════════════════════════════════════════════════════════════════════

  private decideAttackOrBlock(): EnemyStateId {
    if (this.isMoveToAttack) {
      return this.commitAttack();
    }

    if (this.reactionCooldown <= 0) {
      this.reactionCooldown = Config.REACTION_COOLDOWN;
      return Math.random() < 0.75 ? this.commitAttack() : this.commitBlock();
    }

    return this.commitPullback();
  }

  private commitPullback(): EnemyStateId {
    this.targetPullbackDistance =
      Config.CIRCLE_RANGE_MIN +
      Math.random() * (Config.CIRCLE_RANGE_MAX - Config.CIRCLE_RANGE_MIN);
    this.isInPullback = true;
    return "pullback";
  }

  private commitAttack(): EnemyStateId {
    if (!this.currentAttack) {
      this.currentAttack =
        ENEMY_ATTACK_LIST[Math.floor(Math.random() * ENEMY_ATTACK_LIST.length)];
    }
    this.currentAttack.collisionCount = 0;
    this.updateAttackerRegistration(true);
    this.applyAttackLunge();
    return "attack";
  }

  private commitBlock(): EnemyStateId {
    this.updateAttackerRegistration(false);
    return "block";
  }

  private onOneShotComplete(): void {
    if (this.state.isDead) {
      this.destroy();
      return;
    }
    
    this.currentAttack = null;
    this.updateAttackerRegistration(false);
    this.state = { ...this.state, isAttacking: false, isBlocking: false, attackClip: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  private updateAttackerRegistration(isAttacker: boolean): void {
    if (!this.player) return;

    if (isAttacker && !this.isRegisteredAttacker) {
      this.player.currentAttackers++;
      this.isRegisteredAttacker = true;
    } else if (!isAttacker && this.isRegisteredAttacker) {
      this.player.currentAttackers--;
      this.isRegisteredAttacker = false;
    }
  }

  private distanceTo(target: THREE.Object3D): number {
    return this.root.position.distanceTo(target.position);
  }

  private applyAttackLunge(): void {
    this.tempDirection.set(0, 0, -1);
    this.tempDirection.applyQuaternion(this.root.quaternion);
    this.tempDirection.y = 0;
    this.tempDirection.normalize();
  
    this.movementVelocity.addScaledVector(
      this.tempDirection,
      Enemy.ATTACK_LUNGE_FORCE
    );
  }

  private applyHitKnockback(source: THREE.Object3D): void {
    this.tempDirection.subVectors(this.root.position, source.position);
    this.tempDirection.y = 0;
    if (this.tempDirection.lengthSq() > 0) {
      this.tempDirection.normalize();
      this.movementVelocity.addScaledVector(this.tempDirection, Enemy.HIT_KNOCKBACK_FORCE);
    }
  }

  destroy(): void {
    this.ui.destroy();
    this.scene.remove(this.root);
    if (this.player) {
      this.player.unregisterLockCandidate(this.root);
    }
  }

  isDestroyed(): boolean {
    return this.shouldDestroy;
  }
}
