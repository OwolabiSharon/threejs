import type { AttackData } from "../combat/AttackData";

export type EnemyStateId =
  | "idle"
  | "walk"
  | "run"
  | "pullback"
  | "circle"
  | "taunt"
  | "moveToAttack"
  | "attack"
  | "block"
  | "hurt"
  | "dead";

export interface EnemyState {
  id: EnemyStateId;
  isMoving: boolean;
  isAttacking: boolean;
  isBlocking: boolean;
  isDead: boolean;
  attackClip: AttackData | null;
  strafeDir: 1 | -1; // 1 = right, -1 = left
}
