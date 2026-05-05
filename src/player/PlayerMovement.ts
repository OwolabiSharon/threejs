import * as THREE from "three";
import { Input } from "./Input";

export class PlayerMovement {
  private moveSpeed: number;
  private turnSpeed: number;
  private lockRotationLerpSpeed: number;
  private sprintMultiplier = 1.8;
  private spaceTapMoveDistance = 1.3;
  private tapImpulseSharpness = 18;
  private rollingLocked = false;

  private moveForward = new THREE.Vector3();
  private moveRight = new THREE.Vector3();
  private moveDir = new THREE.Vector3();
  private worldUp = new THREE.Vector3(0, 1, 0);
  private playerPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private strafeRight = new THREE.Vector3();
  private fallbackBackward = new THREE.Vector3();
  private tapMoveDir = new THREE.Vector3();
  private tapVelocity = new THREE.Vector3();

  constructor(moveSpeed = 0.8, turnSpeed = 10, lockRotationLerpSpeed = 10) {
    this.moveSpeed = moveSpeed;
    this.turnSpeed = turnSpeed;
    this.lockRotationLerpSpeed = lockRotationLerpSpeed;
  }

  freeLook(
    input: Input,
    delta: number,
    root: THREE.Object3D,
    getForwardVector: (out: THREE.Vector3) => THREE.Vector3
  ): void {
    getForwardVector(this.moveForward);
    this.moveRight.crossVectors(this.worldUp, this.moveForward).normalize();
    this.moveDir.set(0, 0, 0);
    const currentMoveSpeed = input.isSpaceDown() ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;

    if (input.isDown("w")) this.moveDir.add(this.moveForward);
    if (input.isDown("s")) this.moveDir.sub(this.moveForward);
    if (input.isDown("a")) this.moveDir.add(this.moveRight);
    if (input.isDown("d")) this.moveDir.sub(this.moveRight);
    this.moveDir.y = 0;

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize().multiplyScalar(currentMoveSpeed * delta);
      root.position.add(this.moveDir);

      const targetYaw = Math.atan2(-this.moveDir.x, -this.moveDir.z);
      const t = 1 - Math.exp(-this.turnSpeed * delta);
      root.rotation.y = this.lerpAngle(root.rotation.y, targetYaw, t);
    }

    this.handleSpaceTap(input, root, this.moveDir, false, delta);
    this.applyTapImpulse(root, delta);
  }


  lockedOn(input: Input, delta: number, root: THREE.Object3D, lockedTarget: THREE.Object3D, moveDir: string | null): void {
    root.getWorldPosition(this.playerPos);
    lockedTarget.getWorldPosition(this.targetPos);
    this.toTarget.copy(this.targetPos).sub(this.playerPos);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() === 0) return;
    this.toTarget.normalize();

    this.strafeRight.crossVectors(this.worldUp, this.toTarget).normalize();
    this.moveDir.set(0, 0, 0);
    const currentMoveSpeed = input.isSpaceDown() ? this.moveSpeed * this.sprintMultiplier : this.moveSpeed;

    if (input.isDown("w")) this.moveDir.add(this.toTarget);
    if (input.isDown("s")) this.moveDir.sub(this.toTarget);
    if (input.isDown("a")) this.moveDir.add(this.strafeRight);
    if (input.isDown("d")) this.moveDir.sub(this.strafeRight);
    this.moveDir.y = 0;

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize().multiplyScalar(currentMoveSpeed * delta);
      root.position.add(this.moveDir);
    }

    const rotatedOnTap = this.handleSpaceTap(input, root, this.moveDir, moveDir !== null, delta);
    // console.log(this.rollingLocked, rotatedOnTap, "coco");
    if (!rotatedOnTap && !this.rollingLocked) {
      this.rotateTowardLockTarget(root, lockedTarget, delta);
    }
    this.applyTapImpulse(root, delta);
  }

  private handleSpaceTap(
    input: Input,
    root: THREE.Object3D,
    motionDir: THREE.Vector3,
    rotateOnTap: boolean,
    _delta: number
  ): boolean {
    if (!input.peekSpaceTap()) return false;

    if (motionDir.lengthSq() === 0) {
      root.getWorldDirection(this.fallbackBackward);
      this.fallbackBackward.y = 0;
      //.multiplyScalar(1) done on purpose
      this.tapMoveDir.copy(this.fallbackBackward).multiplyScalar(1);
    } else {
      this.tapMoveDir.copy(motionDir).normalize();
    }
    this.tapMoveDir.y = 0;
    if (this.tapMoveDir.lengthSq() > 0) {
      this.tapMoveDir.normalize();
    }

    this.tapVelocity
      .copy(this.tapMoveDir)
      .multiplyScalar(this.spaceTapMoveDistance * this.tapImpulseSharpness);

    if (!rotateOnTap) return false;

    if (this.tapMoveDir.lengthSq() === 0) return false;

    this.rollingLocked = true;
    const targetYaw = Math.atan2(-this.tapMoveDir.x, -this.tapMoveDir.z);
    root.rotation.y = targetYaw;
    return true;
  }

  private applyTapImpulse(root: THREE.Object3D, delta: number): void {
    if (this.tapVelocity.lengthSq() === 0) return;

    root.position.addScaledVector(this.tapVelocity, delta);
    const decay = Math.exp(-this.tapImpulseSharpness * delta);
    this.tapVelocity.multiplyScalar(decay);
    this.tapVelocity.y = 0;

    if (this.tapVelocity.lengthSq() < 0.0001) {
      this.tapVelocity.set(0, 0, 0);
    }
  }

  resumeFacingTarget(): void {
    this.rollingLocked = false;
  }

  rotateTowardLockTarget(root: THREE.Object3D, lockedTarget: THREE.Object3D, delta: number): void {
    root.getWorldPosition(this.playerPos);
    lockedTarget.getWorldPosition(this.targetPos);
    this.toTarget.copy(this.targetPos).sub(this.playerPos);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() === 0) return;

    const targetYaw = Math.atan2(-this.toTarget.x, -this.toTarget.z);
    const t = 1 - Math.exp(-this.lockRotationLerpSpeed * delta);
    root.rotation.y = this.lerpAngle(root.rotation.y, targetYaw, t);
  }

  private lerpAngle(from: number, to: number, t: number): number {
    const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + diff * t;
  }
}
