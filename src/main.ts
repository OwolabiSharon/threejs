import * as THREE from "three";
import { scene } from "./core/scene";
import { camera } from "./core/camera";
import { renderer } from "./core/renderer";
import { Input } from "./player/Input";
import { Player } from "./player/Player";
import { World } from "./world/World";
import { Physics } from "./physics";
import { createCSS2DRenderer } from "./ui/CSS2DRendererSetup";
import { PlayerUI } from "./ui/PlayerUI";
import { EnemyManager } from "./enemy/EnemyManager";
import { LoadingScreen } from "./ui/LoadingScreen";

// Audio setup
// const menuMusic = new Audio("/assets/audios/Tower%20Attack%20Menu%20(1).wav");
// menuMusic.loop = true;
// menuMusic.volume = 0.5;

// const gameMusic = new Audio("/assets/audios/Tower%20Attack%20(1).wav");
// gameMusic.loop = true;
// gameMusic.volume = 0.5;

// // Try to play menu music on first interaction
// window.addEventListener("click", () => {
//   if (menuMusic.paused && !gameStarted) {
//     menuMusic.play().catch(e => console.log("Audio play blocked", e));
//   }
// }, { once: true });

// 1. Initialize core systems
const input = new Input();
const physics = new Physics();
const labelRenderer = createCSS2DRenderer();
const loadingScreen = new LoadingScreen();
const clock = new THREE.Clock();
let gameStarted = false;

export { physics };

// 2. Setup World and Player
const world = new World(scene);
world.init();

const player = new Player(scene, camera);
const playerUI = new PlayerUI();

// CRITICAL: Initialize player colliders BEFORE anything else uses them
player.load(() => {
  // Model is loaded, enable the start button
  loadingScreen.enablePlayButton();
});

// Register player body collider
if (player.bodyCollider) {
  physics.register(player.bodyCollider);
}

// 3. Setup World/Physics relations
const ground = world.getGround();
if (ground) physics.addGroundMesh(ground);
physics.addRigidBody(player.rigidBody);

const enemyManager = new EnemyManager(scene, player);
enemyManager.spawnEnemy(new THREE.Vector3(0, 0, -30));
enemyManager.spawnEnemy(new THREE.Vector3(20, 0, -30));
enemyManager.spawnEnemy(new THREE.Vector3(-20, 0, -30));

loadingScreen.onPlay(() => {
  // Start fading out menu music
  // const fadeOutInterval = setInterval(() => {
  //   if (menuMusic.volume > 0.05) {
  //     menuMusic.volume -= 0.05;
  //   } else {
  //     menuMusic.pause();
  //     clearInterval(fadeOutInterval);
  //   }
  // }, 50);

  setTimeout(() => {
    loadingScreen.hide();
    playerUI.show();
    gameStarted = true;
    clock.start();

    // Start game music
    // gameMusic.play().catch(e => console.log("Game audio play blocked", e));

    // Instant reveal for the canvas
    renderer.domElement.style.opacity = "1";
  }, 1000);
});

function animate(): void {
  requestAnimationFrame(animate);

  if (!gameStarted) return;

  const delta = Math.min(clock.getDelta(), 0.05);
  world.update();
  player.update(input, delta);
  playerUI.updateHealth(player.hp, player.maxHp);
  playerUI.updateStamina(player.stamina, player.maxStamina);
  enemyManager.update(delta);
  physics.update(delta);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

animate();

// Event Listeners
window.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  if (event.repeat) return;
  event.preventDefault();
  player.toggleLockOn();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});
