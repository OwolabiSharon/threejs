import * as THREE from "three";
import { Collider } from "./Collider";
import { RigidBody } from "./RigidBody";

const _boxA = new THREE.Box3();
const _boxB = new THREE.Box3();
const _rayOrigin = new THREE.Vector3();
const _rayDown = new THREE.Vector3(0, -1, 0);
const _raycaster = new THREE.Raycaster();
const _closest = new THREE.Vector3();

const _mtv = new THREE.Vector3();
const _halfA = new THREE.Vector3();
const _halfB = new THREE.Vector3();

/** Returns penetration depth > 0 if overlapping, and writes the push direction into `out` (a → away from b) */
function penetration(a: Collider, b: Collider, out: THREE.Vector3): number {
  if (a.shape.type === "sphere" && b.shape.type === "sphere") {
    const rSum = a.shape.radius + b.shape.radius;
    const dist = a.worldPos.distanceTo(b.worldPos);
    if (dist >= rSum) return 0;
    out.subVectors(a.worldPos, b.worldPos).normalize();
    return rSum - dist;
  }

  if (a.shape.type === "box" && b.shape.type === "box") {
    _halfA.copy(a.shape.size).multiplyScalar(0.5);
    _halfB.copy(b.shape.size).multiplyScalar(0.5);
    const d  = _mtv.subVectors(a.worldPos, b.worldPos);
    const ox = _halfA.x + _halfB.x - Math.abs(d.x);
    const oy = _halfA.y + _halfB.y - Math.abs(d.y);
    const oz = _halfA.z + _halfB.z - Math.abs(d.z);
    if (ox <= 0 || oy <= 0 || oz <= 0) return 0;
    if (ox <= oy && ox <= oz) { out.set(Math.sign(d.x), 0, 0); return ox; }
    if (oy <= ox && oy <= oz) { out.set(0, Math.sign(d.y), 0); return oy; }
    out.set(0, 0, Math.sign(d.z)); return oz;
  }

  return 0; // sphere-box solid response not needed for triggers
}

function overlaps(a: Collider, b: Collider): boolean {
  if (a.shape.type === "sphere" && b.shape.type === "sphere") {
    const r = a.shape.radius + b.shape.radius;
    return a.worldPos.distanceToSquared(b.worldPos) <= r * r;
  }

  if (a.shape.type === "box" && b.shape.type === "box") {
    _boxA.setFromCenterAndSize(a.worldPos, a.shape.size);
    _boxB.setFromCenterAndSize(b.worldPos, b.shape.size);
    return _boxA.intersectsBox(_boxB);
  }

  // sphere vs box (mixed)
  const sphere = a.shape.type === "sphere" ? a : b;
  const box    = a.shape.type === "box"    ? a : b;
  if (sphere.shape.type !== "sphere" || box.shape.type !== "box") return false;
  _boxA.setFromCenterAndSize(box.worldPos, box.shape.size);
  _closest.copy(sphere.worldPos).clamp(_boxA.min, _boxA.max);
  return _closest.distanceToSquared(sphere.worldPos) <= sphere.shape.radius * sphere.shape.radius;
}

export class Physics {
  private colliders: Collider[]   = [];
  private rigidBodies: RigidBody[] = [];
  private groundMeshes: THREE.Object3D[] = [];
  private active = new Set<number>();
  private nextId = 0;
  private colliderById = new Map<number, Collider>();

  // --- Registration ---

  register(collider: Collider): void {
    (collider as any)._id = this.nextId++;
    this.colliders.push(collider);
  }

  unregister(collider: Collider): void {
    this.colliders = this.colliders.filter(c => c !== collider);
  }

  addRigidBody(rb: RigidBody): void {
    this.rigidBodies.push(rb);
  }

  removeRigidBody(rb: RigidBody): void {
    this.rigidBodies = this.rigidBodies.filter(r => r !== rb);
  }

  /** Any mesh passed here will stop falling objects */
  addGroundMesh(...meshes: THREE.Object3D[]): void {
    this.groundMeshes.push(...meshes);
  }

  // --- Update ---

  update(delta: number): void {
    this.stepGravity(delta);
    this.stepTriggers();
  }

  // --- Gravity ---

  private stepGravity(delta: number): void {
    for (const rb of this.rigidBodies) {
      if (!rb.enabled) continue;

      // Always raycast — even when grounded — so walking off an edge is detected
      _rayOrigin.copy(rb.object.position);
      _rayOrigin.y += rb.rayLength * 0.5;
      _raycaster.set(_rayOrigin, _rayDown);
      _raycaster.far = rb.rayLength;

      const hits = _raycaster.intersectObjects(this.groundMeshes, true);
      const groundY = hits.length > 0 ? hits[0].point.y : null;

      if (groundY !== null && rb.object.position.y <= groundY + rb.groundOffset + 1) {
        // On solid ground
        rb.object.position.y = groundY + rb.groundOffset;
        rb.velocity = 0;
        rb.isGrounded = true;
      } else {
        // No ground beneath — fall
        rb.isGrounded = false;
        rb.velocity += rb.gravity * delta;
        rb.object.position.y -= rb.velocity * delta;
      }
    }
  }

  // --- Triggers ---

  private stepTriggers(): void {
    const { colliders, colliderById } = this;
    colliderById.clear();

    for (const c of colliders) {
      colliderById.set((c as any)._id as number, c);
      if (c.enabled) c.object.getWorldPosition(c.worldPos);
    }

    const stillActive = new Set<number>();

    for (let i = 0; i < colliders.length; i++) {
      const a = colliders[i];
      if (!a.enabled) continue;

      for (let j = i + 1; j < colliders.length; j++) {
        const b = colliders[j];
        if (!b.enabled) continue;
        if (!overlaps(a, b)) continue;

        const key = this.pairKey(a, b);
        stillActive.add(key);

        if (!this.active.has(key)) {
          a.onTriggerEnter?.({ self: a, other: b });
          b.onTriggerEnter?.({ self: b, other: a });
        } else {
          a.onTriggerStay?.({ self: a, other: b });
          b.onTriggerStay?.({ self: b, other: a });
        }

        if (a.isSolid && b.isSolid) this.resolveCollision(a, b);
      }
    }

    for (const key of this.active) {
      if (!stillActive.has(key)) {
        const ia = key >>> 16;
        const ib = key & 0xFFFF;
        const a = colliderById.get(ia);
        const b = colliderById.get(ib);
        a?.onTriggerExit?.({ self: a, other: b! });
        b?.onTriggerExit?.({ self: b!, other: a! });
      }
    }

    this.active = stillActive;
  }

  private resolveCollision(a: Collider, b: Collider): void {
    const depth = penetration(a, b, _mtv);
    if (depth <= 0) return;

    const half = depth * 0.5;

    // Get the actual objects to move (root objects if specified, otherwise the collider objects)
    const objA = a.rootObject || a.object;
    const objB = b.rootObject || b.object;

    // Push objects apart along MTV
    objA.position.addScaledVector(_mtv, half);
    objB.position.addScaledVector(_mtv, -half);

    // Update world positions immediately after resolution
    a.object.getWorldPosition(a.worldPos);
    b.object.getWorldPosition(b.worldPos);
  }

  private pairKey(a: Collider, b: Collider): number {
    const ia = (a as any)._id as number;
    const ib = (b as any)._id as number;
    return ia < ib ? (ia << 16) | ib : (ib << 16) | ia;
  }
}
