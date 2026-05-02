import * as THREE from "three";
import { Enemy } from "./Enemy";
import type { Player } from "../player/Player";
import { physics } from "../main";

export class EnemyManager {
  private scene: THREE.Scene;
  private player: Player;
  private enemies: Enemy[] = [];
  private colliderCheckInterval: ReturnType<typeof setInterval> | null = null;
  private playerSwordHandlerSetup = false;

  constructor(scene: THREE.Scene, player: Player) {
    this.scene = scene;
    this.player = player;
  }

  spawnEnemy(position: THREE.Vector3, modelPath = "/assets/models/current copy2.glb"): Enemy {
    const enemy = new Enemy(this.scene, position);
    enemy.load(modelPath);
    enemy.setPlayer(this.player);
    this.player.registerLockCandidate(enemy.root);

    if (enemy.bodyCollider) {
      physics.register(enemy.bodyCollider);
    }

    this.setupColliders(enemy);
    this.enemies.push(enemy);
    return enemy;
  }

  private setupColliders(enemy: Enemy): void {
    const checkInterval = setInterval(() => {
      const pc = this.player.swordCollider;
      const ec = enemy.swordCollider;
      if (!pc || !ec) return;

      clearInterval(checkInterval);
      physics.register(ec);

      if (!this.playerSwordHandlerSetup) {
        physics.register(pc);
        this.setupPlayerSwordHandler();
        this.playerSwordHandlerSetup = true;
      }

      enemy.setupSwordCollisionHandler(pc, (attack) => {
        this.player.registerHit(enemy.root, attack);
      });
    }, 100);
  }

  private setupPlayerSwordHandler(): void {
    if (!this.player.swordCollider) return;
    this.player.swordCollider.onTriggerEnter = (e) => {
      if (!this.player.state.isAttacking || !this.player.currentAttack) return;
      if (this.player.currentAttack.collisionCount > 0) return;
      if (e.other.tag !== "enemy") return;
      
      const hitEnemy = this.enemies.find(enemy => enemy.bodyCollider === e.other);
      if (hitEnemy && !hitEnemy.isDestroyed()) {
        this.player.currentAttack.collisionCount++;
        hitEnemy.registerHit(this.player.root, this.player.currentAttack);
      }
    };
  }

  update(delta: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      if (enemy.isDestroyed()) {
        this.enemies.splice(i, 1);
        continue;
      }

      enemy.update(this.player.root, delta);
    }
  }

  getEnemies(): Enemy[] {
    return this.enemies;
  }

  cleanup(): void {
    if (this.colliderCheckInterval) {
      clearInterval(this.colliderCheckInterval);
    }
    for (const enemy of this.enemies) {
      enemy.destroy();
    }
    this.enemies = [];
  }
}
