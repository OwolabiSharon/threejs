import * as THREE from "three";

export type ColliderShape =
  | { type: "sphere"; radius: number }
  | { type: "box";    size: THREE.Vector3 };

export interface CollisionEvent {
  self:  Collider;
  other: Collider;
}

export class Collider {
  /** The Object3D this collider is attached to */
  readonly object: THREE.Object3D;
  /** The root object that should be moved during collision resolution (e.g., player.root, enemy.root) */
  rootObject: THREE.Object3D | null = null;
  /** Arbitrary tag — use this to identify what kind of thing this is */
  tag: string;
  shape: ColliderShape;
  /** If true, overlaps fire events but no collision response is applied */
  isTrigger: boolean;
  /** If true, solid collision response (MTV push-out) is applied on overlap */
  isSolid: boolean;
  enabled: boolean;

  onTriggerEnter: ((e: CollisionEvent) => void) | null = null;
  onTriggerStay:  ((e: CollisionEvent) => void) | null = null;
  onTriggerExit:  ((e: CollisionEvent) => void) | null = null;

  // Reusable world-space position cache — updated by Physics each frame
  readonly worldPos = new THREE.Vector3();

  constructor(
    object: THREE.Object3D,
    shape: ColliderShape,
    tag = "",
    isTrigger = true,
    isSolid = false,
    rootObject: THREE.Object3D | null = null,
  ) {
    this.object    = object;
    this.shape     = shape;
    this.tag       = tag;
    this.isTrigger = isTrigger;
    this.isSolid   = isSolid;
    this.enabled   = true;
    this.rootObject = rootObject;
  }
}
