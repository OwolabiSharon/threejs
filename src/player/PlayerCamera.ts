import * as THREE from "three";
import { Input } from "./Input";

type MouseDelta = { x: number; y: number };

export class PlayerCamera {
  private camera: THREE.Camera;
  private cameraRig: THREE.Object3D;
  private cameraPivot: THREE.Object3D;
  private offset: THREE.Vector3;
  private lookAtPosition = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private mouseSensitivity = 0.002;
  private minPitch = -Math.PI / 120;
  private maxPitch = Math.PI / 120;
  private lockRange = 20;
  private lockBreakDelay = 1.0;
  private lockInvalidTimer = 0;
  private up = new THREE.Vector3(0, 1, 0);
  private playerPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private cameraPos = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private right = new THREE.Vector3();
  private rayDir = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private scene: THREE.Scene;
  private desiredCameraPos = new THREE.Vector3();
  private lockBackOffset = 5;
  private lockSideOffset = 1;
  private lockHeightOffset = 7;
  private lockCameraSharpness = 5;
  private lockModeActive = false;
  private recoveringToFreeLook = false;
  private currentCameraWorldPos = new THREE.Vector3();
  private freeLookRecoverT = 0.15;
  private freeLookRecoverEpsilonSq = 1;
  private unlockDefaultPitch = -Math.PI / 8;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    offset = new THREE.Vector3(0, 6, 6)
  ) {
    this.scene = scene;
    this.camera = camera;
    this.offset = offset;

    this.cameraRig = new THREE.Object3D();
    this.cameraPivot = new THREE.Object3D();
    this.cameraRig.add(this.cameraPivot);
    this.cameraPivot.add(this.camera);
    scene.add(this.cameraRig);
    
  }

  freeLookUpdate(mouseDelta: MouseDelta, followObject: THREE.Object3D, target: THREE.Object3D): void {
    if (this.lockModeActive) {
      this.lockModeActive = false;
      this.recoveringToFreeLook = true;
      this.alignPivotBehindPlayer(followObject);
    }

    this.yaw -= mouseDelta.x * this.mouseSensitivity;
    this.pitch -= mouseDelta.y * this.mouseSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, this.minPitch, this.maxPitch);

    this.cameraPivot.rotation.y = this.yaw;
    this.cameraPivot.rotation.x = this.pitch;

    if (this.recoveringToFreeLook) {
      this.camera.position.lerp(this.offset, this.freeLookRecoverT);
      this.cameraRig.position.lerp(followObject.position, this.freeLookRecoverT);

      const localDone = this.camera.position.distanceToSquared(this.offset) <= this.freeLookRecoverEpsilonSq;
      const rigDone = this.cameraRig.position.distanceToSquared(followObject.position) <= this.freeLookRecoverEpsilonSq;
      if (localDone && rigDone) {
        this.recoveringToFreeLook = false;
        this.camera.position.copy(this.offset);
        this.cameraRig.position.copy(followObject.position);
      }
    } else {
      this.camera.position.copy(this.offset);
      this.cameraRig.position.copy(followObject.position);
    }

    target.getWorldPosition(this.lookAtPosition);
    this.camera.lookAt(this.lookAtPosition);
  }

  private alignPivotBehindPlayer(followObject: THREE.Object3D): void {
    // Keep free-look pivot aligned behind the player as lock-on exits.
    this.yaw = followObject.rotation.y;
    this.pitch = this.unlockDefaultPitch;
    this.cameraPivot.rotation.y = this.yaw;
    this.cameraPivot.rotation.x = this.pitch;
  }

  public getForwardVector(out: THREE.Vector3): THREE.Vector3 {
    this.camera.getWorldDirection(out);
    out.y = 0;
    if (out.lengthSq() === 0) return out.set(0, 0, -1);
    return out.normalize();
  }

  /** Finds the best lock-on target from candidates — closest to screen centre, in range, line of sight. */
  findLockTarget(followObject: THREE.Object3D, candidates: THREE.Object3D[]): THREE.Object3D | null {
    this.camera.getWorldPosition(this.cameraPos);
    followObject.getWorldPosition(this.playerPos);

    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      (this.camera as THREE.PerspectiveCamera).projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    let bestTarget: THREE.Object3D | null = null;
    let bestScore = Infinity;

    for (const candidate of candidates) {
      candidate.getWorldPosition(this.targetPos);

      // Range check
      const distSq = this.playerPos.distanceToSquared(this.targetPos);
      if (distSq > this.lockRange * this.lockRange) continue;

      // Must be in camera frustum
      if (!frustum.containsPoint(this.targetPos)) continue;

      // Line of sight — aim at chest height, not root origin
      const chestOffset = 1.6;
      this.rayDir.copy(this.targetPos).setY(this.targetPos.y + chestOffset).sub(this.cameraPos);
      const dist = this.rayDir.length();
      if (dist === 0) continue;
      this.rayDir.normalize();
      this.raycaster.set(this.cameraPos, this.rayDir);
      this.raycaster.far = dist;

      const hits = this.raycaster.intersectObjects(this.scene.children, true);
      let blocked = false;
      for (const hit of hits) {
        if (this.isDescendantOf(hit.object, this.cameraRig)) continue;
        if (this.isDescendantOf(hit.object, followObject)) continue;
        if (this.isDescendantOf(hit.object, candidate)) continue;
        blocked = true;
        break;
      }
      if (blocked) continue;

      const ndc = this.targetPos.clone().project(this.camera as THREE.PerspectiveCamera);
      const screenDist = Math.sqrt(ndc.x * ndc.x + ndc.y * ndc.y);
      if (screenDist < bestScore) {
        bestScore = screenDist;
        bestTarget = candidate;
      }
    }

    return bestTarget;
  }

  /** Finds the closest enemy to the player that is in the camera frame. */
  findClosestEnemyInView(followObject: THREE.Object3D, candidates: THREE.Object3D[]): THREE.Object3D | null {
    this.camera.getWorldPosition(this.cameraPos);
    followObject.getWorldPosition(this.playerPos);

    const frustum = new THREE.Frustum();
    const projScreenMatrix = new THREE.Matrix4();
    projScreenMatrix.multiplyMatrices(
      (this.camera as THREE.PerspectiveCamera).projectionMatrix,
      this.camera.matrixWorldInverse
    );
    frustum.setFromProjectionMatrix(projScreenMatrix);

    let bestTarget: THREE.Object3D | null = null;
    let bestDistSq = Infinity;

    for (const candidate of candidates) {
      candidate.getWorldPosition(this.targetPos);

      // Must be in camera frustum
      if (!frustum.containsPoint(this.targetPos)) continue;

      // Range check
      const distSq = this.playerPos.distanceToSquared(this.targetPos);
      if (distSq > this.lockRange * this.lockRange) continue;

      // Line of sight — aim at chest height, not root origin
      const chestOffset = 1.6;
      this.rayDir.copy(this.targetPos).setY(this.targetPos.y + chestOffset).sub(this.cameraPos);
      const dist = this.rayDir.length();
      if (dist === 0) continue;
      this.rayDir.normalize();
      this.raycaster.set(this.cameraPos, this.rayDir);
      this.raycaster.far = dist;

      const hits = this.raycaster.intersectObjects(this.scene.children, true);
      let blocked = false;
      for (const hit of hits) {
        if (this.isDescendantOf(hit.object, this.cameraRig)) continue;
        if (this.isDescendantOf(hit.object, followObject)) continue;
        if (this.isDescendantOf(hit.object, candidate)) continue;
        blocked = true;
        break;
      }
      if (blocked) continue;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestTarget = candidate;
      }
    }

    return bestTarget;
  }

  /** Returns false when lock should break (range / line-of-sight grace expired). */
  maintainLock(followObject: THREE.Object3D, lockedTarget: THREE.Object3D, delta: number, lockCandidates: THREE.Object3D[]): boolean {
    //console.log("did it run?")
    return this.validateLock(followObject, lockedTarget, delta, lockCandidates);
  }

  lockedVisualUpdate(
    input: Input,
    followObject: THREE.Object3D,
    lockedTarget: THREE.Object3D,
    delta: number
  ): void {
    this.ensureLockModeTransition();
    input.consumeMouseDelta();
    this.updateLockedCameraPosition(followObject, lockedTarget, delta);
    this.updateLookAtMidpoint(followObject, lockedTarget);
  }

  private ensureLockModeTransition(): void {
    if (this.lockModeActive) return;

    // Preserve current world camera position on lock entry, then switch
    // to lock-mode local camera offset (0,0,0) without a visible pop.
    this.camera.getWorldPosition(this.currentCameraWorldPos);
    this.cameraRig.position.copy(this.currentCameraWorldPos);
    this.camera.position.set(0, 0, 0);
    this.lockModeActive = true;
  }

  private updateLookAtMidpoint(followObject: THREE.Object3D, lockedTarget: THREE.Object3D): void {
    this.calculateMidpoint(followObject, lockedTarget, this.lookAtPosition);
    this.camera.lookAt(this.lookAtPosition);
  }

  private calculateMidpoint(
    first: THREE.Object3D,
    second: THREE.Object3D,
    out: THREE.Vector3
  ): THREE.Vector3 {
    first.getWorldPosition(this.playerPos);
    second.getWorldPosition(this.targetPos);
    return out.copy(this.playerPos).add(this.targetPos).multiplyScalar(0.5);
  }

  private updateLockedCameraPosition(
    followObject: THREE.Object3D,
    lockedTarget: THREE.Object3D,
    delta: number
  ): void {
    followObject.getWorldPosition(this.playerPos);
    lockedTarget.getWorldPosition(this.targetPos);
    this.toTarget.copy(this.targetPos).sub(this.playerPos);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() === 0) return;
    this.toTarget.normalize();

    this.right.crossVectors(this.up, this.toTarget).normalize();

    this.desiredCameraPos
      .copy(this.playerPos)
      .addScaledVector(this.toTarget, -this.lockBackOffset)
      .addScaledVector(this.right, this.lockSideOffset);
    this.desiredCameraPos.y += this.lockHeightOffset;

    const t = 1 - Math.exp(-this.lockCameraSharpness * delta);
    this.cameraRig.position.lerp(this.desiredCameraPos, t);
  }

  private validateLock(followObject: THREE.Object3D, lockedTarget: THREE.Object3D, delta: number, lockCandidates: THREE.Object3D[]): boolean {
    const inRange = this.isInRange(followObject, lockedTarget);
    const inSight = this.hasLineOfSight(followObject, lockedTarget, lockCandidates);

    if (!inRange || !inSight) {
      this.lockInvalidTimer += delta;
      if (this.lockInvalidTimer >= this.lockBreakDelay) {
        this.lockInvalidTimer = 0;
        return false;
      }
      return true;
    }

    this.lockInvalidTimer = 0;
    return true;
  }

  private isInRange(followObject: THREE.Object3D, lockedTarget: THREE.Object3D): boolean {
    followObject.getWorldPosition(this.playerPos);
    lockedTarget.getWorldPosition(this.targetPos);
    return this.playerPos.distanceToSquared(this.targetPos) <= this.lockRange * this.lockRange;
  }

  private hasLineOfSight(followObject: THREE.Object3D, lockedTarget: THREE.Object3D, lockCandidates: THREE.Object3D[]): boolean {
    this.camera.getWorldPosition(this.cameraPos);
    lockedTarget.getWorldPosition(this.targetPos);
    this.targetPos.y += 1.6; // aim at chest height to avoid ground plane occlusion
    this.rayDir.copy(this.targetPos).sub(this.cameraPos);
    const distanceToTarget = this.rayDir.length();
    if (distanceToTarget === 0) return true;

    this.rayDir.normalize();
    this.raycaster.set(this.cameraPos, this.rayDir);
    this.raycaster.far = distanceToTarget;

    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    for (const hit of hits) {
      if (this.isDescendantOf(hit.object, this.cameraRig)) continue;
      if (this.isDescendantOf(hit.object, followObject)) continue;
      if (this.isDescendantOf(hit.object, lockedTarget)) return true;
      
      let isOtherEnemy = false;
      for (const candidate of lockCandidates) {
        if (candidate !== lockedTarget && this.isDescendantOf(hit.object, candidate)) {
          isOtherEnemy = true;
          break;
        }
      }
      
      if (isOtherEnemy) {
        continue;
      }

      return false; // hit something else — blocked
    }

    return true; // nothing in the way
  }

  private isDescendantOf(object: THREE.Object3D, parent: THREE.Object3D): boolean {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }
    return false;
  }

}