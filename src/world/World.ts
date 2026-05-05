import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

interface RoomData {
  scene: THREE.Group;
  position: THREE.Vector3;
  exits: Array<{ object: THREE.Object3D; position: THREE.Vector3 }>;
  torchLights: Array<{ light: THREE.PointLight; position: THREE.Vector3 }>;
  enemySpawns: Array<THREE.Vector3>;
  enemiesSpawned: boolean;
  isLoaded: boolean;
  roomPath: string;
  maxLightDistFromCenter: number;
}

export class World {
  private scene: THREE.Scene;
  private ground: THREE.Mesh | null = null;
  private loader = new GLTFLoader();
  private onEnemySpawn?: (position: THREE.Vector3) => void;
  
  private roomModels = [
    "/assets/models/room1.glb",
    "/assets/models/room2.glb",
    "/assets/models/room3.glb",
    "/assets/models/bossroom.glb"
  ];
  
  private rooms: Map<string, RoomData> = new Map();
  private usedExitPositions: Set<string> = new Set();
  private playerPosition = new THREE.Vector3(0, 0, 0);
  
  private readonly ROOM_LOAD_DISTANCE = 50;
  private readonly ROOM_UNLOAD_DISTANCE = 130;
  private readonly ENEMY_SPAWN_DISTANCE = 40;
  private readonly LIGHT_DISTANCE = 20;
  private readonly MAX_ROOMS = 20;
  private readonly LIGHT_UPDATE_INTERVAL = 0.1;
  private readonly ROOM_UPDATE_INTERVAL = 0.2;
  private readonly ENEMY_UPDATE_INTERVAL = 0.15;

  // Pre-computed squared distances to avoid per-frame multiplication
  private readonly ROOM_LOAD_DIST_SQ = this.ROOM_LOAD_DISTANCE * this.ROOM_LOAD_DISTANCE;
  private readonly ROOM_UNLOAD_DIST_SQ = this.ROOM_UNLOAD_DISTANCE * this.ROOM_UNLOAD_DISTANCE;
  private readonly ENEMY_SPAWN_DIST_SQ = this.ENEMY_SPAWN_DISTANCE * this.ENEMY_SPAWN_DISTANCE;
  private readonly LIGHT_DIST_SQ = this.LIGHT_DISTANCE * this.LIGHT_DISTANCE;
  
  private lightUpdateTimer = 0;
  private roomUpdateTimer = 0;
  private enemyUpdateTimer = 0;
  private pendingEnemySpawns: Array<THREE.Vector3> = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  init(): void {
    this.createGround();
    this.createGrid();
    this.createAmbientLight();
    this.generateDungeon();
  }

  update(delta: number): void {
    this.updateRoomVisibilityThrottled(delta);
    this.updateEnemySpawningThrottled(delta);
    this.updateLightVisibilityThrottled(delta);
    this.processPendingEnemySpawns();
  }

  setEnemySpawnCallback(callback: (position: THREE.Vector3) => void): void {
    this.onEnemySpawn = callback;
  }

  setPlayerPosition(position: THREE.Vector3): void {
    this.playerPosition.copy(position);
  }

  getGround(): THREE.Mesh | null {
    return this.ground;
  }

  private createGround(): void {
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(5000, 5000),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.name = "ground";
    this.scene.add(this.ground);
  }

  private createGrid(): void {
    // Grid removed since rooms have their own floors
  }

  private createAmbientLight(): void {
    const ambientLight = new THREE.AmbientLight(0x52b7d1, 0.3);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  private generateDungeon(): void {
    this.loadRoomData("/assets/models/room1.glb", new THREE.Vector3(0, 0, 0), "room_0", 0);
  }

  private loadRoomData(roomPath: string, position: THREE.Vector3, roomId: string, rotation = 0): void {
    if (this.rooms.has(roomId)) return;

    this.loader.load(
      roomPath,
      (gltf: GLTF) => {
        const room = gltf.scene;
        room.position.copy(position);
        room.rotation.y = rotation;

        const { exits, torchLights, enemySpawns } = this.processRoom(room);

        // Compute max distance any light is from room center (for coarse culling)
        let maxLightDist = 0;
        for (const tl of torchLights) {
          const d = tl.position.distanceTo(position);
          if (d > maxLightDist) maxLightDist = d;
        }

        const roomData: RoomData = {
          scene: room,
          position: position.clone(),
          exits,
          torchLights,
          enemySpawns,
          enemiesSpawned: false,
          isLoaded: false,
          roomPath,
          maxLightDistFromCenter: maxLightDist
        };
        
        this.rooms.set(roomId, roomData);
        this.generateConnectedRooms(roomId, roomPath, exits);
      },
      undefined,
      (error) => console.error('Error loading room:', error)
    );
  }

  private processRoom(room: THREE.Group): { 
    exits: Array<{ object: THREE.Object3D; position: THREE.Vector3 }>, 
    torchLights: Array<{ light: THREE.PointLight; position: THREE.Vector3 }>,
    enemySpawns: Array<THREE.Vector3>
  } {
    const exits: Array<{ object: THREE.Object3D; position: THREE.Vector3 }> = [];
    const torches: THREE.Object3D[] = [];
    const enemySpawns: Array<THREE.Vector3> = [];
    
    room.traverse((child) => {
      const childName = child.name.toLowerCase();
      
      if (childName.includes("exit")) {
        const exitPos = new THREE.Vector3();
        child.getWorldPosition(exitPos);
        exits.push({ object: child, position: exitPos });
      }
      
      if (childName.includes("torch")) {
        torches.push(child);
      }
      
      if (childName.includes("enemy")) {
        const enemyPos = new THREE.Vector3();
        child.getWorldPosition(enemyPos);
        enemySpawns.push(enemyPos);
      }
    });

    const torchLights = torches.map(torch => {
      const light = this.createTorchLight(torch);
      const lightPos = new THREE.Vector3();
      light.getWorldPosition(lightPos);
      return { light, position: lightPos };
    });
    
    return { exits, torchLights, enemySpawns };
  }

  getEnemySpawns(): Array<THREE.Vector3> {
    const spawns: Array<THREE.Vector3> = [];
    this.rooms.forEach((roomData) => {
      spawns.push(...roomData.enemySpawns);
    });
    return spawns;
  }

  private createTorchLight(torchObject: THREE.Object3D): THREE.PointLight {
    const light = new THREE.PointLight(0xff6600, 30, 120);
    light.position.set(0, 0, 0);
    light.visible = false;
    torchObject.add(light);
    return light;
  }

  private generateConnectedRooms(
    parentRoomId: string, 
    parentRoomPath: string, 
    exits: Array<{ object: THREE.Object3D; position: THREE.Vector3 }>
  ): void {
    exits.forEach((exit, index) => {
      const posKey = `${exit.position.x.toFixed(1)},${exit.position.y.toFixed(1)},${exit.position.z.toFixed(1)}`;
      
      if (this.usedExitPositions.has(posKey)) return;
      
      const nextRoomId = `${parentRoomId}_exit_${index}`;
      
      if (!this.rooms.has(nextRoomId) && this.rooms.size < this.MAX_ROOMS) {
        this.usedExitPositions.add(posKey);
        
        const availableRooms = this.roomModels.filter(r => r !== parentRoomPath);
        const nextRoom = availableRooms[Math.floor(Math.random() * availableRooms.length)];
        
        const exitName = exit.object.name.toLowerCase();
        let rotation: number;
        
        if (exitName.includes("left")) {
          rotation = Math.PI / 2;
        } else {
          const direction = new THREE.Vector3();
          exit.object.getWorldDirection(direction);
          rotation = Math.atan2(direction.x, direction.z);
        }
        
        
        this.loadRoomData(nextRoom, exit.position, nextRoomId, rotation);
      }
    });
  }

  
  private updateRoomVisibilityThrottled(delta: number): void {
    this.roomUpdateTimer += delta;
    
    if (this.roomUpdateTimer < this.ROOM_UPDATE_INTERVAL) return;
    
    this.roomUpdateTimer = 0;
    this.updateRoomVisibility();
  }

  private updateRoomVisibility(): void {
    const playerPos = this.playerPosition;
    const loadDistSq = this.ROOM_LOAD_DIST_SQ;
    const unloadDistSq = this.ROOM_UNLOAD_DIST_SQ;

    for (const roomData of this.rooms.values()) {
      const distSq = playerPos.distanceToSquared(roomData.position);

      if (!roomData.isLoaded && distSq < loadDistSq) {
        this.scene.add(roomData.scene);
        roomData.isLoaded = true;
      } else if (roomData.isLoaded && distSq > unloadDistSq) {
        this.scene.remove(roomData.scene);
        roomData.isLoaded = false;
      }
    }
  }

  private updateEnemySpawningThrottled(delta: number): void {
    this.enemyUpdateTimer += delta;
    
    if (this.enemyUpdateTimer < this.ENEMY_UPDATE_INTERVAL) return;
    
    this.enemyUpdateTimer = 0;
    this.updateEnemySpawning();
  }

  private updateEnemySpawning(): void {
    if (!this.onEnemySpawn) return;

    const playerPos = this.playerPosition;
    const spawnDistSq = this.ENEMY_SPAWN_DIST_SQ;

    for (const roomData of this.rooms.values()) {
      if (roomData.enemiesSpawned) continue;

      const distSq = playerPos.distanceToSquared(roomData.position);
      if (distSq < spawnDistSq) {
        for (let i = 0; i < roomData.enemySpawns.length; i++) {
          this.pendingEnemySpawns.push(roomData.enemySpawns[i]);
        }
        roomData.enemiesSpawned = true;
      }
    }
  }

  private processPendingEnemySpawns(): void {
    if (this.pendingEnemySpawns.length === 0 || !this.onEnemySpawn) return;

    const position = this.pendingEnemySpawns.shift();
    if (position) {
      this.onEnemySpawn(position);
    }
  }

  private updateLightVisibilityThrottled(delta: number): void {
    this.lightUpdateTimer += delta;
    
    if (this.lightUpdateTimer < this.LIGHT_UPDATE_INTERVAL) return;
    
    this.lightUpdateTimer = 0;
    this.updateLightVisibility();
  }

  private updateLightVisibility(): void {
    const playerPos = this.playerPosition;
    const lightDistSq = this.LIGHT_DIST_SQ;

    for (const roomData of this.rooms.values()) {
      if (!roomData.isLoaded) continue;

      // Coarse room-level culling: if room center is too far for any light to be in range, skip all
      const maxReach = this.LIGHT_DISTANCE + roomData.maxLightDistFromCenter;
      const roomDistSq = playerPos.distanceToSquared(roomData.position);
      if (roomDistSq > maxReach * maxReach) {
        for (let i = 0; i < roomData.torchLights.length; i++) {
          roomData.torchLights[i].light.visible = false;
        }
        continue;
      }

      for (let i = 0; i < roomData.torchLights.length; i++) {
        const tl = roomData.torchLights[i];
        tl.light.visible = playerPos.distanceToSquared(tl.position) < lightDistSq;
      }
    }
  }
}
