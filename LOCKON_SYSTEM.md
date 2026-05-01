# Souls-like Lock-On Targeting System

A smooth, directional lock-on targeting system for Three.js games inspired by Dark Souls combat mechanics.

## 🎮 Controls

- **Tab** → Toggle lock-on (lock nearest target / unlock)
- **Q** → Switch target to the left
- **E** → Switch target to the right

## ✨ Features

### 1. Target Detection
- Filters targets by maximum distance (2000 units)
- Only considers targets in front of the camera
- Sorts by distance for initial lock-on

### 2. Smooth Target Switching
- **No instant snapping** - all transitions are interpolated
- Uses ease-out cubic interpolation for natural motion
- 0.2s cooldown between switches prevents accidental double-switching
- Blends between previous and current target positions

### 3. Directional Switching (Q/E)
- **Left (Q)**: Switches to closest target on the left side of camera view
- **Right (E)**: Switches to closest target on the right side of camera view
- Uses camera right vector for accurate directional filtering
- Prioritizes closest targets in the selected direction

### 4. Camera Behavior
- Smoothly moves to position behind and to the side of player
- Looks at midpoint between player and blended target position
- No camera snapping during target transitions
- Maintains smooth motion throughout all operations

### 5. Player Rotation
- Player smoothly rotates to face the blended target position
- Uses exponential interpolation for natural turning
- Rotation continues smoothly during target switches
- Strafe-based movement while locked on

## 🏗️ Architecture

### Core Components

#### `LockOnSystem.ts`
Main system managing lock-on state and target switching logic.

**Key Methods:**
- `lockNearest()` - Locks onto the closest valid target
- `unlock()` - Clears lock-on state
- `switchLeft()` / `switchRight()` - Directional target switching
- `getBlendedTargetPosition()` - Returns interpolated position during transitions
- `update()` - Updates transition progress each frame

**State:**
```typescript
{
  currentTarget: THREE.Object3D | null;
  previousTarget: THREE.Object3D | null;
  switchProgress: number;  // 0 → 1
  lastSwitchTime: number;
}
```

#### `PlayerCamera.ts`
Enhanced with blended target support for smooth camera transitions.

**New Methods:**
- `lockedVisualUpdate()` - Updated to accept blended position
- `updateLockedCameraPositionBlended()` - Positions camera using blended target
- `updateLookAtMidpointBlended()` - Looks at midpoint with blended target

#### `PlayerMovement.ts`
Enhanced with blended target rotation for smooth player turning.

**New Methods:**
- `lockedOnBlended()` - Movement with blended target direction
- `rotateTowardBlendedTarget()` - Smooth rotation to blended position

#### `Input.ts`
Extended to handle Tab, Q, and E keys.

**New Methods:**
- `consumeTab()` - Toggle lock-on
- `consumeQ()` - Switch left
- `consumeE()` - Switch right

#### `Player.ts`
Integrates the lock-on system with existing player logic.

**New Methods:**
- `toggleLockOn()` - Handles Tab key press
- `switchTargetLeft()` - Handles Q key press
- `switchTargetRight()` - Handles E key press

## 🎯 How It Works

### Initial Lock-On (Tab)
1. Filters all enemies by distance and camera frustum
2. Sorts by distance to player
3. Locks onto closest valid target
4. Shows lock-on indicator on target

### Target Switching (Q/E)
1. Computes camera right vector
2. For each valid target:
   - Calculates direction from player to enemy
   - Computes dot product with camera right vector
   - Filters by sign (negative for left, positive for right)
3. Sorts filtered targets by distance
4. Initiates smooth transition to closest target

### Smooth Transition
1. Sets `previousTarget` to current target
2. Sets `currentTarget` to new target
3. Resets `switchProgress` to 0
4. Each frame:
   - Increments `switchProgress` by `delta * 5`
   - Applies ease-out cubic: `t = 1 - (1 - progress)³`
   - Blends positions: `lerp(previous, current, t)`
5. Camera and player use blended position for smooth motion

### Unlock (Tab while locked)
1. Hides lock-on indicator
2. Clears all lock-on state
3. Returns to free-look camera mode

## 🔧 Configuration

Key parameters in `LockOnSystem.ts`:

```typescript
maxDistance = 2000;        // Maximum lock-on range
switchCooldown = 0.2;      // Seconds between switches
switchSpeed = 5;           // Transition speed (higher = faster)
```

## 🎨 Visual Feedback

- Lock-on indicator appears above locked target
- Indicator smoothly follows target during transitions
- Camera glides between targets instead of snapping
- Player rotation is smooth and predictable

## 🚀 Performance

- Minimal overhead: only processes valid targets
- Efficient filtering using dot products
- No raycasting during switches (only for initial lock)
- Reuses Vector3 objects to minimize allocations

## 📝 Notes

- All transitions use interpolation - no instant snapping
- Directional switching is relative to camera view
- System maintains lock even during combat animations
- Compatible with existing player movement and combat systems
