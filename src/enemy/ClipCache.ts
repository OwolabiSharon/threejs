import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

type ClipCallback = (clip: THREE.AnimationClip) => void;

const cache = new Map<string, THREE.AnimationClip>();
const pending = new Map<string, ClipCallback[]>();
const loader = new FBXLoader();

export function loadClip(path: string, onLoaded: ClipCallback): void {
  const cached = cache.get(path);
  if (cached) { onLoaded(cached); return; }

  const waiting = pending.get(path);
  if (waiting) { waiting.push(onLoaded); return; }

  pending.set(path, [onLoaded]);

  loader.load(path, (fbx) => {
    const clip = fbx.animations[0];
    const callbacks = pending.get(path) ?? [];
    pending.delete(path);
    if (!clip) return;
    cache.set(path, clip);
    for (const cb of callbacks) cb(clip);
  }, undefined, () => pending.delete(path));
}
