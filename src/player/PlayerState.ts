export type MoveDir = "forward" | "backward" | "left" | "right" | null;
import type { AttackData } from "../combat/AttackData";

export type PlayerStateId =
  | "idle"
  | "lockedIdle"
  | "walk"
  | "run"
  | "roll"
  | "lockedWalk"
  | "lockedRun"
  | "lockedRoll"
  | "lightAttack"
  | "heavyAttack"
  | "blocking";

export interface PlayerState {
  id: PlayerStateId;
  isLockedOn: boolean;
  moveDir: MoveDir;
  isRolling: boolean;
  isRunning: boolean;
  isBlocking: boolean;
  isAttacking: boolean;
  attackClip: AttackData | null;
}
