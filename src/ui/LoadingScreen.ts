export class LoadingScreen {
  private container: HTMLDivElement;
  private playButton: HTMLDivElement;
  private spinner: HTMLDivElement;
  private onPlayCallback: (() => void) | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: url('/assets/ui%20elements/castle%20image.jpg');
      background-size: cover;
      background-position: center;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      z-index: 9999;
      background-color: #000;
      opacity: 0;
      transition: opacity 0.4s ease-out;
    `;

    const vignette = document.createElement("div");
    vignette.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.75) 100%);
      pointer-events: none;
    `;

    const contentWrapper = document.createElement("div");
    contentWrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 35vh;
    `;

    const title = document.createElement("h1");
    title.textContent = "Combat Arena";
    title.style.cssText = `
      background: linear-gradient(180deg, #e8e8e8 0%, #b0b0b0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 5.5rem;
      margin: 0;
      font-family: 'Cinzel Decorative', serif;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      filter: drop-shadow(0 0 30px rgba(180, 200, 220, 0.2)) drop-shadow(0 6px 16px rgba(0, 0, 0, 0.9));
      opacity: 0;
      animation: logoFadeIn 2s ease-out 0.3s forwards;
      position: relative;
    `;

    const titleShadow = document.createElement("h1");
    titleShadow.textContent = "Combat Arena";
    titleShadow.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      color: rgba(180, 200, 220, 0.08);
      font-size: 5.5rem;
      margin: 0;
      font-family: 'Cinzel Decorative', serif;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      transform: translateY(4px);
      z-index: -1;
    `;

    const titleContainer = document.createElement("div");
    titleContainer.style.cssText = `
      position: relative;
      margin-bottom: 7rem;
    `;
    titleContainer.appendChild(titleShadow);
    titleContainer.appendChild(title);

    const portraitContainer = document.createElement("div");
    portraitContainer.style.cssText = `
      position: absolute;
      top: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: 180px;
      height: 180px;
      opacity: 0.9;
      filter: drop-shadow(0 0 20px rgba(194, 169, 106, 0.25));
    `;

    const portraitFrame = document.createElement("div");
    portraitFrame.style.cssText = `
      position: relative;
      width: 180px;
      height: 180px;
      background-image: url('/assets/ui%20elements/big_roundframe.png');
      background-repeat: no-repeat;
      background-position: center;
      background-size: contain;
      opacity: 1;
    `;

    const portraitMask = document.createElement("div");
    portraitMask.style.cssText = `
      position: absolute;
      left: 42px;
      top: 42px;
      width: 92px;
      height: 92px;
      border-radius: 90%;
      overflow: hidden;
    `;

    const portraitImage = document.createElement("div");
    portraitImage.style.cssText = `
      width: 100%;
      height: 170%;
      background-image: url('/assets/ui%20elements/warrior_silhouette_man.png');
      background-repeat: no-repeat;
      background-size: cover;
      background-position: 50% 3%;
      filter: brightness(1.1) contrast(1.2);
    `;

    portraitMask.appendChild(portraitImage);
    portraitFrame.appendChild(portraitMask);
    portraitContainer.appendChild(portraitFrame);

    this.playButton = document.createElement("div");
    this.playButton.textContent = "Begin";
    this.playButton.style.cssText = `
      font-size: 1.6rem;
      font-family: 'Cinzel', serif;
      font-weight: 300;
      letter-spacing: 0.5em;
      color: #d8d8d8;
      text-transform: uppercase;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.4s ease, transform 0.3s ease, text-shadow 0.3s ease;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
      pointer-events: none;
      animation: beginFadeIn 2s ease-out 1.2s forwards;
    `;

    this.spinner = document.createElement("div");
    this.spinner.style.cssText = `
      width: 60px;
      height: 60px;
      margin-top: 1rem;
      background-image: url('/assets/ui%20elements/big_roundframe.png');
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      opacity: 0;
      filter: drop-shadow(0 0 10px rgba(180, 200, 220, 0.4));
      pointer-events: none;
    `;

    this.playButton.addEventListener("mouseenter", () => {
      if (this.playButton.style.pointerEvents !== "none") {
        this.playButton.style.opacity = "1";
        this.playButton.style.transform = "scale(1.03)";
        this.playButton.style.textShadow = "0 0 16px rgba(180, 200, 220, 0.3), 0 2px 10px rgba(0, 0, 0, 0.8)";
      }
    });

    this.playButton.addEventListener("mouseleave", () => {
      this.playButton.style.opacity = "0.6";
      this.playButton.style.transform = "scale(1)";
      this.playButton.style.textShadow = "0 2px 10px rgba(0, 0, 0, 0.8)";
    });

    this.playButton.addEventListener("click", () => {
      this.showSpinner();
      if (this.onPlayCallback) {
        // Defer the callback to ensure the spinner renders first
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            this.onPlayCallback?.();
          });
        });
      }
    });

    const style = document.createElement("style");
    style.textContent = `
      @keyframes logoFadeIn {
        to {
          opacity: 1;
        }
      }
      @keyframes beginFadeIn {
        to {
          opacity: 0.6;
          pointer-events: auto;
        }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    contentWrapper.appendChild(titleContainer);
    contentWrapper.appendChild(this.playButton);
    contentWrapper.appendChild(this.spinner);

    this.container.appendChild(vignette);
    this.container.appendChild(portraitContainer);
    this.container.appendChild(contentWrapper);
    document.body.appendChild(this.container);

    // Trigger fade-in immediately
    requestAnimationFrame(() => {
      this.container.style.opacity = "1";
    });

    // Load fonts in background
    this.loadFonts();
  }

  private async loadFonts(): Promise<void> {
    try {
      await Promise.all([
        document.fonts.load("700 5.5rem 'Cinzel Decorative'"),
        document.fonts.load("300 1.6rem 'Cinzel'")
      ]);
      await document.fonts.ready;
    } catch (error) {
      console.warn("Font loading failed, using fallback", error);
      // Still show the screen even if fonts fail to load
    }
  }

  enablePlayButton(): void {
    this.playButton.style.opacity = "0.6";
    this.playButton.style.pointerEvents = "auto";
  }

  onPlay(callback: () => void): void {
    this.onPlayCallback = callback;
  }

  private showSpinner(): void {
    this.playButton.style.display = "none";
    this.spinner.style.display = "block";
    this.spinner.style.opacity = "1";
    this.spinner.style.animation = "spin 1.5s linear infinite";
  }

  hide(): void {
    this.container.style.transition = "opacity 0.5s ease-in";
    this.container.style.opacity = "0";
    setTimeout(() => {
      this.container.remove();
    }, 500);
  }
}
