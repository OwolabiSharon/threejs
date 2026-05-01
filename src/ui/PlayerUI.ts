interface PlayerHudElements {
  root: HTMLDivElement;
  portraitFrame: HTMLDivElement;
  portraitImage: HTMLDivElement;
  hpFrame: HTMLDivElement;
  hpFill: HTMLDivElement;
  greenFrame: HTMLDivElement;
  greenFill: HTMLDivElement;
  youDied: HTMLDivElement;
}

export class PlayerUI {
  private elements: PlayerHudElements;
  private lastHealthPercent = -1;

  constructor() {
    this.elements = this.createHud();
  }

  updateHealth(current: number, max: number): void {
    const safeMax = Math.max(1, max);
    const ratio = Math.max(0, Math.min(1, current / safeMax));
    const percent = Math.round(ratio * 100);

    if (percent === this.lastHealthPercent) return;
    this.lastHealthPercent = percent;
    this.elements.hpFill.style.width = `${percent}%`;

    if (current <= 0) {
      this.elements.youDied.style.display = "block";
    }
  }

  updateStamina(current: number, max: number): void {
    const safeMax = Math.max(1, max);
    const ratio = Math.max(0, Math.min(1, current / safeMax));
    const percent = Math.round(ratio * 100);
    this.elements.greenFill.style.width = `${percent}%`;
  }

  show(): void {
    this.elements.root.style.opacity = "1";
  }

  hide(): void {
    this.elements.root.style.opacity = "0";
  }

  private createHud(): PlayerHudElements {
    const root = document.createElement("div");
    root.style.position = "fixed";
    root.style.top = "16px";
    root.style.left = "16px";
    root.style.width = "360px";
    root.style.pointerEvents = "none";
    root.style.zIndex = "40";
    root.style.display = "flex";
    root.style.alignItems = "center";
    root.style.gap = "14px";

    const portraitFrame = document.createElement("div");
    portraitFrame.style.position = "relative";
    portraitFrame.style.width = "146px";
    portraitFrame.style.height = "146px";
    portraitFrame.style.flexShrink = "0";

    // Frame image
    portraitFrame.style.backgroundImage = "url('/assets/ui%20elements/big_roundframe.png')";
    portraitFrame.style.backgroundRepeat = "no-repeat";
    portraitFrame.style.backgroundPosition = "center";
    portraitFrame.style.backgroundSize = "contain";


    // 👇 INNER MASK (this is important for clean clipping)
    const portraitMask = document.createElement("div");
    portraitMask.style.position = "absolute";
    portraitMask.style.left = "34px";
    portraitMask.style.top = "34px";
    portraitMask.style.width = "74px";
    portraitMask.style.height = "74px"; // make it a true circle
    portraitMask.style.borderRadius = "90%";
    portraitMask.style.overflow = "hidden"; // 👈 ensures clean crop


    // 👇 IMAGE (bigger than mask so we can shift it)
    const portraitImage = document.createElement("div");
    portraitImage.style.width = "100%";
    portraitImage.style.height = "170%"; // 👈 taller than container
    portraitImage.style.backgroundImage = "url('/assets/ui%20elements/warrior_silhouette_man.png')";
    portraitImage.style.backgroundRepeat = "no-repeat";
    portraitImage.style.backgroundSize = "cover";

    // 👇 THIS is the key part (adjust this value)
    portraitImage.style.backgroundPosition = "50% 3%";
    // try 10% - 30% depending on how much head you want

    portraitImage.style.filter = "brightness(0.95)";


    // Build structure
    portraitMask.appendChild(portraitImage);
    portraitFrame.appendChild(portraitMask);

    const barsContainer = document.createElement("div");
    barsContainer.style.display = "flex";
    barsContainer.style.flexDirection = "column";
    barsContainer.style.gap = "0px";
    barsContainer.style.marginTop = "-6px";

    const hpFrame = document.createElement("div");
    hpFrame.style.position = "relative";
    hpFrame.style.width = "224px";
    hpFrame.style.height = "40px";
    hpFrame.style.flexShrink = "0";
    hpFrame.style.backgroundImage = "url('/assets/ui%20elements/Hp_frame.png')";
    hpFrame.style.backgroundRepeat = "no-repeat";
    hpFrame.style.backgroundPosition = "center";
    hpFrame.style.backgroundSize = "contain";

    const hpFill = document.createElement("div");
    hpFill.style.position = "absolute";
    hpFill.style.left = "0";
    hpFill.style.top = "14px";
    hpFill.style.height = "13px";
    hpFill.style.width = "100%";
    hpFill.style.maxWidth = "100%";
    hpFill.style.transformOrigin = "left center";
    hpFill.style.backgroundImage = "url('/assets/ui%20elements/Hp_line.png')";
    hpFill.style.backgroundRepeat = "no-repeat";
    hpFill.style.backgroundPosition = "center";
    hpFill.style.backgroundSize = "100% 100%";
    hpFill.style.transition = "width 0.18s ease";

    hpFrame.appendChild(hpFill);

    const greenFrame = document.createElement("div");
    greenFrame.style.position = "relative";
    greenFrame.style.width = "224px";
    greenFrame.style.height = "40px";
    greenFrame.style.flexShrink = "0";
    greenFrame.style.marginTop = "-4px";
    greenFrame.style.backgroundImage = "url('/assets/ui%20elements/Hp_frame.png')";
    greenFrame.style.backgroundRepeat = "no-repeat";
    greenFrame.style.backgroundPosition = "center";
    greenFrame.style.backgroundSize = "contain";

    const greenFill = document.createElement("div");
    greenFill.style.position = "absolute";
    greenFill.style.left = "0";
    greenFill.style.top = "14px";
    greenFill.style.height = "13px";
    greenFill.style.width = "100%";
    greenFill.style.maxWidth = "100%";
    greenFill.style.transformOrigin = "left center";
    greenFill.style.backgroundImage = "url('/assets/ui%20elements/Hp_line.png')";
    greenFill.style.backgroundRepeat = "no-repeat";
    greenFill.style.backgroundPosition = "center";
    greenFill.style.backgroundSize = "100% 100%";
    greenFill.style.filter = "hue-rotate(110deg) saturate(2.2) brightness(0.5)";
    greenFill.style.transition = "width 0.18s ease";

    greenFrame.appendChild(greenFill);
    barsContainer.appendChild(hpFrame);
    barsContainer.appendChild(greenFrame);

    root.appendChild(portraitFrame);
    root.appendChild(barsContainer);
    root.style.opacity = "0";
    root.style.transition = "opacity 0.8s ease-in";
    document.body.appendChild(root);

    const youDied = document.createElement("div");
    youDied.style.position = "fixed";
    youDied.style.top = "50%";
    youDied.style.left = "50%";
    youDied.style.transform = "translate(-50%, -50%)";
    youDied.style.width = "600px";
    youDied.style.height = "200px";
    youDied.style.backgroundImage = "url('/assets/ui%20elements/you_died.png')";
    youDied.style.backgroundRepeat = "no-repeat";
    youDied.style.backgroundPosition = "center";
    youDied.style.backgroundSize = "contain";
    youDied.style.zIndex = "1000";
    youDied.style.display = "none";
    document.body.appendChild(youDied);

    return {
      root,
      portraitFrame,
      portraitImage,
      hpFrame,
      hpFill,
      greenFrame,
      greenFill,
      youDied,
    };
  }
}
