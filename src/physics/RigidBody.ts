import * as THREE from "three";

export class RigidBody {
  readonly object: THREE.Object3D;
  /** Vertical velocity in units/s */
  velocity = 0;
  /** Units/s² — positive = falls down */
  gravity = 980;
  /** How far above the object's origin the ground is considered flush (feet offset) */
  groundOffset: number;
  /** How far down to raycast looking for ground */
  rayLength: number;

  isGrounded = false;
  enabled = true;

  constructor(object: THREE.Object3D, groundOffset = 0, rayLength = 200) {
    this.object = object;
    this.groundOffset = groundOffset;
    this.rayLength = rayLength;
  }
}
