import * as THREE from "three";

export class World {
  private scene: THREE.Scene;
  private cube: THREE.Mesh | null = null;
  private ground: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    const cubeGeometry = new THREE.BoxGeometry(20, 20, 20);
    const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff88 });
    this.cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    this.cube.position.y = 1;
    this.cube.position.z = -30;
    // this.scene.add(this.cube);

    // const plane = new THREE.Mesh(
    //   new THREE.PlaneGeometry(5, 5),
    //   new THREE.MeshStandardMaterial({ color: 0x444444 })
    // );

    // plane.rotation.x = -Math.PI / 2;
    // this.scene.add(plane);

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.name = "ground";
    this.scene.add(this.ground);

    const grid = new THREE.GridHelper(6000, 200, 0x555555, 0x555555);
    this.scene.add(grid);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  update(): void {
  }

  getCube(): THREE.Object3D | null {
    return this.cube;
  }

  getGround(): THREE.Mesh | null {
    return this.ground;
  }
}