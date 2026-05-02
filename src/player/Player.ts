import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Input } from "./Input";
import { PlayerCamera } from "./PlayerCamera";
import { PlayerMovement } from "./PlayerMovement";
import type { PlayerState, MoveDir, PlayerStateId } from "./PlayerState";
import { Animations } from "./Animations";
import { RigidBody, Collider } from "../physics";
import { type AttackData, PLAYER_LIGHT_ATTACKS, PLAYER_HEAVY_ATTACKS } from "../combat/AttackData";
import { EnemyUI } from "../ui/EnemyUI";

export class Player {
  public root: THREE.Group;
  public cameraTarget: THREE.Group;
  public lockedTarget: THREE.Object3D | null = null;
  public currentAttackers = 0;
  private lockCandidates: THREE.Object3D[] = [];
  public state: PlayerState = {
    id: "idle", isLockedOn: false, moveDir: null,
    isRolling: false, isRunning: false,
    isBlocking: false, isAttacking: false, attackClip: null,
  };
  public rigidBody: RigidBody;
  public hp = 100;
  public poise = 100;
  public stamina = 100;
  public readonly maxHp = 100;
  public readonly maxPoise = 100;
  public readonly maxStamina = 100;
  private staminaRegenDelay = 0;
  private canRun = true;
  private canRoll = true;
  private static readonly STAMINA_REGEN_RATE = 30;
  private static readonly STAMINA_REGEN_DELAY = 1.0;
  private static readonly LIGHT_ATTACK_STAMINA_COST = 8;
  private static readonly HEAVY_ATTACK_STAMINA_COST = 15;
  private static readonly RUNNING_STAMINA_DRAIN = 12;
  private static readonly STAMINA_RUN_THRESHOLD = 10;
  private static readonly ROLL_STAMINA_COST = 12;
  private static readonly STAMINA_ROLL_THRESHOLD = 10;

  private scene: THREE.Scene;
  private playerCamera: PlayerCamera;
  private movement: PlayerMovement;

  private model: THREE.Object3D | null = null;
  private sword: THREE.Object3D | null = null;
  public swordCollider: Collider | null = null;
  public bodyCollider: Collider | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Animations | null = null;
  private loader = new GLTFLoader();

  private isRolling = false;
  private wasRolling = false;
  private rollTimer = 0;
  private rollDuration = 0.5;

  private isAttacking = false;
  public currentAttack: AttackData | null = null;
  private isKnockedDown = false;
  private knockdownTimer = 0;
  private isDead = false;

  // UI
  public ui: EnemyUI;

  // Attack movement
  private static readonly ATTACK_LUNGE_FORCE = 6.5;
  private static readonly HIT_KNOCKBACK_FORCE = 5;
  private movementVelocity = new THREE.Vector3();
  private tempDirection = new THREE.Vector3();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.scene = scene;

    this.root = new THREE.Group();
    this.cameraTarget = new THREE.Group();
    this.cameraTarget.position.set(0, 2.5, 0);
    this.root.add(this.cameraTarget);
    this.scene.add(this.root);

    this.playerCamera = new PlayerCamera(this.scene, camera);
    this.movement = new PlayerMovement(2, 10, 10);
    this.rigidBody = new RigidBody(this.root, 0, 400);
    this.ui = new EnemyUI(this.root);
  }

  registerLockCandidate(target: THREE.Object3D): void {
    this.lockCandidates.push(target);
  }

  unregisterLockCandidate(target: THREE.Object3D): void {
    const index = this.lockCandidates.indexOf(target);
    if (index > -1) {
      this.lockCandidates.splice(index, 1);
    }
    if (this.lockedTarget === target) {
      this.lockedTarget = null;
    }
  }

  toggleLockOn(): void {
    if (this.lockedTarget) {
      this.updateLockOnIndicator(this.lockedTarget, false);
      this.lockedTarget = null;
      return;
    }
    const newTarget = this.playerCamera.findLockTarget(this.root, this.lockCandidates);
    if (newTarget) {
      this.lockedTarget = newTarget;
      this.updateLockOnIndicator(newTarget, true);
    }
  }

  findNearestLockOnToDirection(direction: "left" | "right"): THREE.Object3D | null {
    if (!this.lockedTarget) return null;

    const playerPos = new THREE.Vector3();
    const targetPos = new THREE.Vector3();
    const candidatePos = new THREE.Vector3();
    const cameraPos = new THREE.Vector3();

    this.root.getWorldPosition(playerPos);
    this.lockedTarget.getWorldPosition(targetPos);
    this.playerCamera.getCamera().getWorldPosition(cameraPos);

    const referencePos = targetPos;
    const toReference = new THREE.Vector3().subVectors(referencePos, cameraPos).normalize();
    const cameraRight = new THREE.Vector3().crossVectors(toReference, new THREE.Vector3(0, 1, 0)).normalize();

    let bestCandidate: THREE.Object3D | null = null;
    let bestScore = -Infinity;

    for (const candidate of this.lockCandidates) {
      if (candidate === this.lockedTarget) continue;

      candidate.getWorldPosition(candidatePos);
      const toCandidate = new THREE.Vector3().subVectors(candidatePos, referencePos);
      const lateralDot = toCandidate.dot(cameraRight);

      if ((direction === "right" && lateralDot <= 0) || (direction === "left" && lateralDot >= 0)) continue;

      const distance = candidatePos.distanceTo(referencePos);
      const score = Math.abs(lateralDot) / (distance + 1);

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  load(onLoad?: () => void): void {
    this.loader.load("/assets/models/current copy2.glb", (gltf: GLTF) => {
      this.model = gltf.scene;
      this.sword = this.model.getObjectByName("SW04") ?? null;
      if (this.sword) {
        const colliderHelper = new THREE.Object3D();
        colliderHelper.position.set(0, 0, -1.2);
        this.sword.add(colliderHelper);
        this.swordCollider = new Collider(colliderHelper, { type: "box", size: new THREE.Vector3(0.6, 0.6, 2.4) }, "playerSword", true, false);
        colliderHelper.add(new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.6, 2.4),
          new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
        ));
      }
      this.model.rotation.y = Math.PI;
      this.root.add(this.model);

      this.mixer = new THREE.AnimationMixer(this.model);
      this.animations = new Animations(this.mixer);
      this.animations.onOneShotComplete = () => this.onOneShotComplete();

      if (onLoad) onLoad();
    });

    const bodyHelper = new THREE.Object3D();
    bodyHelper.position.set(0, 1.8, 0);
    this.root.add(bodyHelper);
    this.bodyCollider = new Collider(bodyHelper, { type: "box", size: new THREE.Vector3(1.2, 2.8, 1.2) }, "player", false, true, this.root);
    bodyHelper.add(new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.8, 1.2),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true })
    ));
  }

  registerHit(source: THREE.Object3D, attack: AttackData): void {
    if (this.isKnockedDown || this.isDead || this.isRolling) return;

    const blocking = this.state.isBlocking;
    const damage = blocking ? attack.shieldedDamage : attack.damage;
    this.hp = Math.max(0, this.hp - damage);
    this.poise = Math.max(0, this.poise - (blocking ? attack.guardBreakDamage : attack.poiseDamage));

    this.ui.spawnDamageNumber(damage);
    this.applyHitKnockback(source);

    if (this.hp <= 0) {
      this.isDead = true;
      this.animations?.playOneShot("death");
      return;
    }

    if (this.isAttacking && this.poise > 0) return;

    this.animations?.playOneShot(blocking ? "shieldImpact" : "hitImpact");
  }

  update(input: Input, delta: number): void {
    if (this.isDead) {
      this.mixer?.update(delta);
      this.animations?.flushCallbacks();
      return;
    }

    if (this.isKnockedDown) {
      this.knockdownTimer -= delta;
      if (this.knockdownTimer <= 0) {
        this.isKnockedDown = false;
        this.poise = this.maxPoise;
      }
      this.mixer?.update(delta);
      this.animations?.flushCallbacks();
      return;
    }

    // Apply movement velocity
    if (this.movementVelocity.lengthSq() > 0) {
      this.root.position.addScaledVector(this.movementVelocity, delta);
      this.movementVelocity.multiplyScalar(Math.max(0, 1 - 8 * delta));
      if (this.movementVelocity.lengthSq() < 0.1) {
        this.movementVelocity.set(0, 0, 0);
      }
    }

    const tapped = input.peekSpaceTap();
    if (tapped) {
      if (this.canRoll && this.stamina >= 0 && !this.isRolling) {
        this.rollTimer = this.rollDuration;
        this.stamina -= Player.ROLL_STAMINA_COST;
        this.staminaRegenDelay = Player.STAMINA_REGEN_DELAY;
      }
    }
    else if (this.rollTimer > 0) this.rollTimer = Math.max(0, this.rollTimer - delta);
    this.isRolling = this.rollTimer > 0;
    if (this.isRolling) {
      this.wasRolling = true;
    }

    if (input.consumeQTap()) {
      const newTarget = this.findNearestLockOnToDirection("left");
      if (newTarget) {
        this.updateLockOnIndicator(this.lockedTarget!, false);
        this.lockedTarget = newTarget;
        this.updateLockOnIndicator(newTarget, true);
      }
    }

    if (input.consumeETap()) {
      const newTarget = this.findNearestLockOnToDirection("right");
      if (newTarget) {
        this.updateLockOnIndicator(this.lockedTarget!, false);
        this.lockedTarget = newTarget;
        this.updateLockOnIndicator(newTarget, true);
      }
    }

    if (!this.isAttacking && !this.isRolling) {
      if (input.consumeLightAttack()) {
        this.isAttacking = true;
        this.stamina -= Player.LIGHT_ATTACK_STAMINA_COST;
        this.staminaRegenDelay = Player.STAMINA_REGEN_DELAY;
        this.currentAttack = PLAYER_LIGHT_ATTACKS[Math.floor(Math.random() * PLAYER_LIGHT_ATTACKS.length)];
        this.currentAttack.collisionCount = 0;
        if (!this.lockedTarget) this.faceNearestTarget();
        this.applyAttackLunge();
      } else if (input.consumeHeavyAttack()) {
        this.isAttacking = true;
        this.stamina -= Player.HEAVY_ATTACK_STAMINA_COST;
        this.staminaRegenDelay = Player.STAMINA_REGEN_DELAY;
        this.currentAttack = PLAYER_HEAVY_ATTACKS[Math.floor(Math.random() * PLAYER_HEAVY_ATTACKS.length)];
        this.currentAttack.collisionCount = 0;
        if (!this.lockedTarget) this.faceNearestTarget();
        this.applyAttackLunge();
      }
    }

    const isBlocking = input.isBlocking();
    const suppressMovement = this.isAttacking || isBlocking;

    const hasValidLock =
      this.lockedTarget !== null && this.playerCamera.maintainLock(this.root, this.lockedTarget, delta, this.lockCandidates);

    if (!hasValidLock && this.lockedTarget) {
      this.updateLockOnIndicator(this.lockedTarget, false);
      this.lockedTarget = null;
    }

    this.state = this.deriveState(input, hasValidLock);

    if (!suppressMovement) {
      if (hasValidLock && this.lockedTarget) {
        this.movement.lockedOn(input, delta, this.root, this.lockedTarget, this.state.moveDir);
        this.playerCamera.lockedVisualUpdate(input, this.root, this.lockedTarget, delta);
      } else {
        this.movement.freeLook(input, delta, this.root, (out) => this.playerCamera.getForwardVector(out));
        this.playerCamera.freeLookUpdate(input.consumeMouseDelta(), this.root, this.cameraTarget);
      }
    } else {
      if (hasValidLock && this.lockedTarget) {
        this.playerCamera.lockedVisualUpdate(input, this.root, this.lockedTarget, delta);
        this.movement.rotateTowardLockTarget(this.root, this.lockedTarget, delta);
      } else {
        this.playerCamera.freeLookUpdate(input.consumeMouseDelta(), this.root, this.cameraTarget);
      }
    }

    if (this.state.isRunning) {
      this.stamina = Math.max(0, this.stamina - Player.RUNNING_STAMINA_DRAIN * delta);
      this.staminaRegenDelay = Player.STAMINA_REGEN_DELAY;
    }

    if (this.stamina <= 0) {
      this.canRun = false;
      this.canRoll = false;
    }

    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay -= delta;
    } else {
      this.stamina = Math.min(this.maxStamina, this.stamina + Player.STAMINA_REGEN_RATE * delta);
      if (this.stamina >= Player.STAMINA_RUN_THRESHOLD) {
        this.canRun = true;
      }
      if (this.stamina >= Player.STAMINA_ROLL_THRESHOLD) {
        this.canRoll = true;
      }
    }

    this.animations?.update(this.state, delta);
    this.mixer?.update(delta);
    this.animations?.flushCallbacks();
    this.ui.update(delta);

    if (tapped) {
      input.consumeSpaceTap();
    }
  }

  private onOneShotComplete(): void {
    if (this.isAttacking) {
      this.isAttacking = false;
      this.currentAttack = null;
    }
    if (this.wasRolling) {
      this.wasRolling = false;
      this.movement.resumeFacingTarget();
    }
  }

  private deriveState(input: Input, isLockedOn: boolean): PlayerState {
    const isBlocking = input.isBlocking();

    if (this.isAttacking && this.currentAttack) {
      const id: PlayerStateId = PLAYER_LIGHT_ATTACKS.includes(this.currentAttack) ? "lightAttack" : "heavyAttack";
      return {
        id, isLockedOn, moveDir: null,
        isRolling: false, isRunning: false,
        isBlocking: false, isAttacking: true,
        attackClip: this.currentAttack,
      };
    }

    if (isBlocking) {
      return {
        id: "blocking", isLockedOn, moveDir: null,
        isRolling: false, isRunning: false,
        isBlocking: true, isAttacking: false, attackClip: null,
      };
    }

    const w = input.isDown("w"), s = input.isDown("s"), a = input.isDown("a"), d = input.isDown("d");
    const moving = w || s || a || d;
    const isRunning = input.isSpaceDown() && moving && !this.isRolling && this.canRun;

    let moveDir: MoveDir = null;
    if (w) moveDir = "forward";
    else if (s) moveDir = "backward";
    else if (a) moveDir = "left";
    else if (d) moveDir = "right";

    let id: PlayerStateId;
    if (this.isRolling) id = isLockedOn ? "lockedRoll" : "roll";
    else if (!moving) id = isLockedOn ? "lockedIdle" : "idle";
    else if (isRunning) id = isLockedOn ? "lockedRun" : "run";
    else id = isLockedOn ? "lockedWalk" : "walk";

    return {
      id, isLockedOn, moveDir, isRolling: this.isRolling, isRunning,
      isBlocking: false, isAttacking: false, attackClip: null,
    };
  }

  setupSwordCollisionHandler(enemySwordCollider: Collider, onHit: (attack: AttackData) => void): void {
    if (!this.swordCollider) return;
    this.swordCollider.onTriggerEnter = (e) => {
      if (!this.state.isAttacking || !this.currentAttack) return;
      if (this.currentAttack.collisionCount > 0) return;
      if (e.other === enemySwordCollider) return;
      if (e.other.tag !== "enemy") return;
      this.currentAttack.collisionCount++;
      onHit(this.currentAttack);
    };
  }

  private applyAttackLunge(): void {
    this.tempDirection.set(0, 0, -1);
    this.tempDirection.applyQuaternion(this.root.quaternion);
    this.tempDirection.y = 0;
    this.tempDirection.normalize();

    this.movementVelocity.addScaledVector(
      this.tempDirection,
      Player.ATTACK_LUNGE_FORCE
    );
  }

  private applyHitKnockback(source: THREE.Object3D): void {
    this.tempDirection.subVectors(this.root.position, source.position);
    this.tempDirection.y = 0;
    if (this.tempDirection.lengthSq() > 0) {
      this.tempDirection.normalize();
      this.movementVelocity.addScaledVector(this.tempDirection, Player.HIT_KNOCKBACK_FORCE);
    }
  }

  private faceNearestTarget(): void {
    const target = this.playerCamera.findClosestEnemyInView(this.root, this.lockCandidates);
    if (!target) return;

    this.tempDirection.subVectors(target.position, this.root.position);
    this.tempDirection.y = 0;

    if (this.tempDirection.lengthSq() > 0) {
      this.tempDirection.normalize();

      // ✅ match your working function
      const targetAngle = Math.atan2(-this.tempDirection.x, -this.tempDirection.z);

      this.root.rotation.y = targetAngle;
    }
  }

  private updateLockOnIndicator(target: THREE.Object3D, visible: boolean): void {
    const enemy = this.lockCandidates.find(candidate => candidate === target);
    if (!enemy) return;

    // Access the enemy's UI through userData
    const enemyUI = (enemy as any).userData?.enemyUI as EnemyUI | undefined;
    if (enemyUI) {
      enemyUI.setLockOnVisible(visible);
    }
  }
}
