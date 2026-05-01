export interface AttackData {
  /** Animation clip key (matches the key in CLIPS records) */
  clip: string;
  /** Raw damage dealt on hit */
  damage: number;
  /** Poise damage — how much it staggers the target */
  poiseDamage: number;
  /** Damage dealt when target is blocking */
  shieldedDamage: number;
  /** Guard-break damage applied to the blocker's stamina */
  guardBreakDamage: number;
  /** How long after the animation starts the hit window opens, in seconds */
  hitWindowStart: number;
  /** How long the hit window stays open, in seconds */
  hitWindowDuration: number;
  /** Whether this attack can be parried */
  parriable: boolean;
  /** Knockback force applied to the target on hit */
  knockback: number;
  /** Collision count — incremented on each hit, reset when attack starts */
  collisionCount: number;
}

// ─── Player Attacks ───────────────────────────────────────────────────────────

export const PLAYER_ATTACKS: Record<string, AttackData> = {
  lightMidSlash: {
    clip:              "lightMidSlash",
    damage:            15,
    poiseDamage:       20,
    shieldedDamage:    5,
    guardBreakDamage:  15,
    hitWindowStart:    0.2,
    hitWindowDuration: 0.25,
    parriable:         true,
    knockback:         10,
    collisionCount:    0,
  },
  lightOverHeadSlash: {
    clip:              "lightOverHeadSlash",
    damage:            18,
    poiseDamage:       25,
    shieldedDamage:    6,
    guardBreakDamage:  18,
    hitWindowStart:    0.25,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         12,
    collisionCount:    0,
  },
  lightUpperSlash: {
    clip:              "lightUpperSlash",
    damage:            14,
    poiseDamage:       18,
    shieldedDamage:    4,
    guardBreakDamage:  12,
    hitWindowStart:    0.15,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         8,
    collisionCount:    0,
  },
  lightUpperSlash2: {
    clip:              "lightUpperSlash2",
    damage:            14,
    poiseDamage:       18,
    shieldedDamage:    4,
    guardBreakDamage:  12,
    hitWindowStart:    0.15,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         8,
    collisionCount:    0,
  },
  heavy360Mid: {
    clip:              "heavy360Mid",
    damage:            35,
    poiseDamage:       50,
    shieldedDamage:    15,
    guardBreakDamage:  40,
    hitWindowStart:    0.4,
    hitWindowDuration: 0.4,
    parriable:         false,
    knockback:         30,
    collisionCount:    0,
  },
  heavy360: {
    clip:              "heavy360",
    damage:            40,
    poiseDamage:       60,
    shieldedDamage:    18,
    guardBreakDamage:  50,
    hitWindowStart:    0.45,
    hitWindowDuration: 0.45,
    parriable:         false,
    knockback:         35,
    collisionCount:    0,
  },
  heavyJumpSlash: {
    clip:              "heavyJumpSlash",
    damage:            45,
    poiseDamage:       65,
    shieldedDamage:    20,
    guardBreakDamage:  55,
    hitWindowStart:    0.5,
    hitWindowDuration: 0.3,
    parriable:         false,
    knockback:         40,
    collisionCount:    0,
  },
  heavyUpperSlash: {
    clip:              "heavyUpperSlash",
    damage:            38,
    poiseDamage:       55,
    shieldedDamage:    16,
    guardBreakDamage:  45,
    hitWindowStart:    0.35,
    hitWindowDuration: 0.35,
    parriable:         false,
    knockback:         32,
    collisionCount:    0,
  },
};

export const PLAYER_LIGHT_ATTACKS = [
  PLAYER_ATTACKS.lightMidSlash,
  PLAYER_ATTACKS.lightOverHeadSlash,
  PLAYER_ATTACKS.lightUpperSlash,
  PLAYER_ATTACKS.lightUpperSlash2,
];

export const PLAYER_HEAVY_ATTACKS = [
  PLAYER_ATTACKS.heavy360Mid,
  PLAYER_ATTACKS.heavy360,
  PLAYER_ATTACKS.heavyJumpSlash,
  PLAYER_ATTACKS.heavyUpperSlash,
];

// ─── Enemy Attacks ────────────────────────────────────────────────────────────

export const ENEMY_ATTACKS: Record<string, AttackData> = {
  lightMidSlash: {
    clip:              "lightMidSlash",
    damage:            12,
    poiseDamage:       18,
    shieldedDamage:    4,
    guardBreakDamage:  10,
    hitWindowStart:    0.2,
    hitWindowDuration: 0.25,
    parriable:         true,
    knockback:         8,
    collisionCount:    0,
  },
  lightOverHeadSlash: {
    clip:              "lightOverHeadSlash",
    damage:            14,
    poiseDamage:       22,
    shieldedDamage:    5,
    guardBreakDamage:  12,
    hitWindowStart:    0.25,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         10,
    collisionCount:    0,
  },
  lightUpperSlash: {
    clip:              "lightUpperSlash",
    damage:            11,
    poiseDamage:       16,
    shieldedDamage:    3,
    guardBreakDamage:  8,
    hitWindowStart:    0.15,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         7,
    collisionCount:    0,
  },
  lightUpperSlash2: {
    clip:              "lightUpperSlash2",
    damage:            11,
    poiseDamage:       16,
    shieldedDamage:    3,
    guardBreakDamage:  8,
    hitWindowStart:    0.15,
    hitWindowDuration: 0.2,
    parriable:         true,
    knockback:         7,
    collisionCount:    0,
  },
};

export const ENEMY_ATTACK_LIST = [
  ENEMY_ATTACKS.lightMidSlash,
  ENEMY_ATTACKS.lightOverHeadSlash,
  ENEMY_ATTACKS.lightUpperSlash,
  ENEMY_ATTACKS.lightUpperSlash2,
];
