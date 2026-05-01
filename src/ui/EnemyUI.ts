import * as THREE from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";

interface HealthBarElements {
  container: HTMLDivElement;
  bar: HTMLDivElement;
  css2DObject: CSS2DObject;
}

interface LockOnIndicator {
  element: HTMLDivElement;
  css2DObject: CSS2DObject;
}

interface DamageNumber {
  css2DObject: CSS2DObject;
  element: HTMLDivElement;
  lifetime: number;
  startY: number;
}

export class EnemyUI {
  private healthBar: HealthBarElements | null = null;
  private damageNumbers: DamageNumber[] = [];
  private lockOnIndicator: LockOnIndicator | null = null;
  private enemyRoot: THREE.Object3D;

  constructor(enemyRoot: THREE.Object3D) {
    this.enemyRoot = enemyRoot;
    this.createLockOnIndicator();
  }

  createHealthBar(): void {
    const { container, bar } = this.createHealthBarElements();
    const css2DObject = new CSS2DObject(container);
    css2DObject.position.set(0, 3.2, 0);
    this.enemyRoot.add(css2DObject);

    this.healthBar = { container, bar, css2DObject };
  }

  private createLockOnIndicator(): void {
    const element = document.createElement("div");
    element.style.width = "20px";
    element.style.height = "20px";
    element.style.backgroundImage = "url('/assets/ui%20elements/big_roundframe.png')";
    element.style.backgroundRepeat = "no-repeat";
    element.style.backgroundPosition = "center";
    element.style.backgroundSize = "contain";
    element.style.pointerEvents = "none";
    element.style.opacity = "0";
    element.style.transition = "opacity 0.2s ease";
    element.style.filter = "brightness(3)";

    const css2DObject = new CSS2DObject(element);
    css2DObject.position.set(0, 2.8, 0);
    this.enemyRoot.add(css2DObject);

    this.lockOnIndicator = { element, css2DObject };
  }

  setLockOnVisible(visible: boolean): void {
    if (!this.lockOnIndicator) return;
    this.lockOnIndicator.element.style.opacity = visible ? "1" : "0";
  }

  private createHealthBarElements(): { container: HTMLDivElement; bar: HTMLDivElement } {
    const container = document.createElement("div");
    container.style.width = "60px";
    container.style.height = "6px";
    container.style.background = "rgba(0, 0, 0, 0.7)";
    container.style.border = "1px solid rgba(255, 255, 255, 0.3)";
    container.style.borderRadius = "3px";
    container.style.overflow = "hidden";

    const bar = document.createElement("div");
    bar.style.width = "100%";
    bar.style.height = "100%";
    bar.style.background = "#7f1d1d";
    bar.style.transition = "width 0.3s ease";

    container.appendChild(bar);
    return { container, bar };
  }

  updateHealth(current: number, max: number): void {
    if (!this.healthBar) return;

    const percent = Math.max(0, Math.min(100, (current / max) * 100));
    this.healthBar.bar.style.width = `${percent}%`;
  }

  spawnDamageNumber(damage: number): void {
    const element = document.createElement("div");
    element.textContent = `-${Math.round(damage)}`;
    element.style.color = "#fff";
    element.style.fontSize = "18px";
    element.style.fontWeight = "bold";
    element.style.textShadow = "2px 2px 4px rgba(0, 0, 0, 0.8)";
    element.style.pointerEvents = "none";
    element.style.userSelect = "none";

    const css2DObject = new CSS2DObject(element);
    css2DObject.position.set(
      (Math.random() - 0.5) * 0.5,
      3.3,
      (Math.random() - 0.5) * 0.5
    );
    this.enemyRoot.add(css2DObject);

    this.damageNumbers.push({
      css2DObject,
      element,
      lifetime: 0,
      startY: css2DObject.position.y,
    });
  }

  update(delta: number): void {
    for (let i = this.damageNumbers.length - 1; i >= 0; i--) {
      const dmg = this.damageNumbers[i];
      dmg.lifetime += delta;

      const progress = dmg.lifetime / 1.0;
      dmg.css2DObject.position.y = dmg.startY + progress * 1.5;
      dmg.element.style.opacity = `${1 - progress}`;

      if (dmg.lifetime >= 1.0) {
        this.enemyRoot.remove(dmg.css2DObject);
        this.damageNumbers.splice(i, 1);
      }
    }
  }

  destroy(): void {
    if (this.healthBar) {
      this.enemyRoot.remove(this.healthBar.css2DObject);
      this.healthBar = null;
    }

    if (this.lockOnIndicator) {
      this.enemyRoot.remove(this.lockOnIndicator.css2DObject);
      this.lockOnIndicator = null;
    }

    for (const dmg of this.damageNumbers) {
      this.enemyRoot.remove(dmg.css2DObject);
    }
    this.damageNumbers = [];
  }
}
