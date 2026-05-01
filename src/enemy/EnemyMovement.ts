import * as THREE from "three";
import type { EnemyState } from "./EnemyState";

export class EnemyMovement {
  private moveSpeed: number;
  private turnSpeed: number;

  private worldUp = new THREE.Vector3(0, 1, 0);
  private toTarget = new THREE.Vector3();
  private strafeVec = new THREE.Vector3();
  private selfPos = new THREE.Vector3();
  private targetPos = new THREE.Vector3();

  public state: EnemyState | null = null;

  constructor(moveSpeed = 1, turnSpeed = 8) {
    this.moveSpeed = moveSpeed;
    this.turnSpeed = turnSpeed;
  }

  /** Walk/run straight toward target. Returns distance to target. */
  moveToward(root: THREE.Object3D, target: THREE.Object3D, delta: number, speed = this.moveSpeed): number {
    if (this.state?.isBlocking || this.state?.id === "hurt") return root.position.distanceTo(target.position);

    root.getWorldPosition(this.selfPos);
    target.getWorldPosition(this.targetPos);

    this.toTarget.copy(this.targetPos).sub(this.selfPos);
    this.toTarget.y = 0;

    const dist = this.toTarget.length();
    if (dist < 0.01) return dist;

    this.toTarget.normalize();

    root.position.addScaledVector(this.toTarget, speed * delta);
    this.faceDirection(root, this.toTarget, delta);

    return dist;
  }

  /** Rotate root to face a world-space direction vector. */
  faceDirection(root: THREE.Object3D, dir: THREE.Vector3, delta: number): void {
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    const t = 1 - Math.exp(-this.turnSpeed * delta);
    root.rotation.y = this.lerpAngle(root.rotation.y, targetYaw, t);
  }

  /** Face the target without moving. */
  faceTarget(root: THREE.Object3D, target: THREE.Object3D, delta: number, turnSpeed = this.turnSpeed): void {
    root.getWorldPosition(this.selfPos);
    target.getWorldPosition(this.targetPos);
    this.toTarget.copy(this.targetPos).sub(this.selfPos);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() === 0) return;
    const targetYaw = Math.atan2(-this.toTarget.x, -this.toTarget.z);
    const t = 1 - Math.exp(-turnSpeed * delta);
    root.rotation.y = this.lerpAngle(root.rotation.y, targetYaw, t);
  }

  /**
   * Strafe sideways around the target.
   * dir: 1 = strafe right (clockwise), -1 = strafe left (counter-clockwise)
   */
  strafe(root: THREE.Object3D, target: THREE.Object3D, dir: 1 | -1, delta: number, speed = this.moveSpeed): void {
    if (this.state?.isBlocking || this.state?.id === "hurt") return;

    root.getWorldPosition(this.selfPos);
    target.getWorldPosition(this.targetPos);

    this.toTarget.copy(this.targetPos).sub(this.selfPos);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() === 0) return;
    this.toTarget.normalize();

    // Perpendicular to toTarget in the XZ plane
    this.strafeVec.crossVectors(this.worldUp, this.toTarget).normalize();
    this.strafeVec.multiplyScalar(dir);

    root.position.addScaledVector(this.strafeVec, speed * delta);

    // Always face the target while strafing
    this.faceDirection(root, this.toTarget, delta);
  }

  /** Move away from target while facing them. */
  moveAway(root: THREE.Object3D, target: THREE.Object3D, delta: number, speed = this.moveSpeed): number {
    if (this.state?.isBlocking || this.state?.id === "hurt") return root.position.distanceTo(target.position);

    root.getWorldPosition(this.selfPos);
    target.getWorldPosition(this.targetPos);

    this.toTarget.copy(this.targetPos).sub(this.selfPos);
    this.toTarget.y = 0;

    const dist = this.toTarget.length();
    if (dist < 0.01) return dist;

    this.toTarget.normalize();

    root.position.addScaledVector(this.toTarget, -speed * delta);
    this.faceDirection(root, this.toTarget, delta);

    return dist;
  }

  private lerpAngle(from: number, to: number, t: number): number {
    const diff = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + diff * t;
  }
}
