import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { AvatarId, FaceFeatures } from '../../types';
import { Character3DController } from './threeCharacterBuilder';
import { getAssetUrl } from '../../utils/assetUrl';

export const LEADER_AVATAR_IDS: AvatarId[] = [
  'trump_3d',
  'putin_3d',
  'jinping_3d',
  'bush_3d',
  'thatcher_3d',
];

export function isLeaderAvatar(id?: AvatarId): boolean {
  if (!id) return false;
  return LEADER_AVATAR_IDS.includes(id);
}

// In-memory cache for parsed 3D models to eliminate repeated fetching/parsing
const cachedModels = new Map<AvatarId, THREE.Object3D>();
const loadingPromises = new Map<AvatarId, Promise<THREE.Object3D>>();

export function hasCachedLeaderModel(id: AvatarId): boolean {
  return cachedModels.has(id);
}

/**
 * Loads and caches 3D model geometry & textures for political/historical figures
 */
export async function loadCustomLeaderModel(avatarId: AvatarId): Promise<THREE.Object3D> {
  const cached = cachedModels.get(avatarId);
  if (cached) return cached.clone(true);

  const pending = loadingPromises.get(avatarId);
  if (pending) {
    const model = await pending;
    return model.clone(true);
  }

  const promise = (async () => {
    switch (avatarId) {
      case 'trump_3d': {
        const url = getAssetUrl('models/Trumprepaired.stl');
        const stlLoader = new STLLoader();
        const geometry = await stlLoader.loadAsync(url);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0xdfba8c, // Presidential warm bronze / terracotta
          roughness: 0.44,
          metalness: 0.16,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        // In Trumprepaired.stl, Z is UP; rotate -90 deg on X and 180 on Y to face front
        mesh.rotation.set(-Math.PI / 2, 0, Math.PI);
        const group = new THREE.Group();
        group.add(mesh);
        return group;
      }

      case 'putin_3d': {
        const basePath = getAssetUrl('models/');
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(basePath);

        let materials: MTLLoader.MaterialCreator | null = null;
        try {
          materials = await mtlLoader.loadAsync('Ptin2.mtl');
          materials.preload();
        } catch (e) {
          console.warn('[CustomLeader] Error loading Ptin2.mtl, fallback to default:', e);
        }

        const objLoader = new OBJLoader();
        if (materials) {
          objLoader.setMaterials(materials);
        }
        objLoader.setPath(basePath);

        const object = await objLoader.loadAsync('Ptin2.obj');
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            if (!materials) {
              m.material = new THREE.MeshStandardMaterial({
                color: 0xdec0a5,
                roughness: 0.5,
                metalness: 0.05,
              });
            }
          }
        });
        return object;
      }

      case 'jinping_3d': {
        const basePath = getAssetUrl('models/');
        const objLoader = new OBJLoader();
        objLoader.setPath(basePath);
        const object = await objLoader.loadAsync('Jinping.obj');

        const material = new THREE.MeshStandardMaterial({
          color: 0xe6d4be, // Refined classical marble bust
          roughness: 0.52,
          metalness: 0.06,
        });

        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry.computeVertexNormals();
            m.material = material;
            m.castShadow = true;
            m.receiveShadow = true;
          }
        });
        return object;
      }

      case 'bush_3d': {
        const url = getAssetUrl('models/Bush_standard.stl');
        const stlLoader = new STLLoader();
        const geometry = await stlLoader.loadAsync(url);
        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9, // Classical statesman white marble
          roughness: 0.48,
          metalness: 0.08,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        const group = new THREE.Group();
        group.add(mesh);
        return group;
      }

      case 'thatcher_3d': {
        const basePath = getAssetUrl('models/');
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(basePath);

        let materials: MTLLoader.MaterialCreator | null = null;
        try {
          materials = await mtlLoader.loadAsync('Thatcher_bust.mtl');
          materials.preload();
        } catch (e) {
          console.warn('[CustomLeader] Error loading Thatcher_bust.mtl, fallback to default:', e);
        }

        const objLoader = new OBJLoader();
        if (materials) {
          objLoader.setMaterials(materials);
        }
        objLoader.setPath(basePath);

        const object = await objLoader.loadAsync('Thatcher_bust.obj');
        object.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.castShadow = true;
            m.receiveShadow = true;
            if (!materials) {
              m.material = new THREE.MeshStandardMaterial({
                color: 0xd8c2b0,
                roughness: 0.48,
                metalness: 0.1,
              });
            }
          }
        });
        return object;
      }

      default:
        throw new Error(`Avatar ${avatarId} is not a custom leader model`);
    }
  })();

  loadingPromises.set(avatarId, promise);
  const loadedModel = await promise;
  cachedModels.set(avatarId, loadedModel);
  loadingPromises.delete(avatarId);
  return loadedModel.clone(true);
}

/**
 * Builds an interactive Character3DController for a custom 3D bust with facial animation
 */
export function buildCustomLeaderCharacter(
  avatarId: AvatarId,
  model: THREE.Object3D
): Character3DController {
  const root = new THREE.Group();

  // 1. Calculate bounding box and scale to standard height (~2.2 units)
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const targetHeight = 2.15;
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetHeight / (maxDim || 1);

  model.scale.set(scale, scale, scale);

  // Position model so its volumetric center coincides with headPivot (0, 0, 0)
  model.position.x = -center.x * scale;
  model.position.y = -center.y * scale;
  model.position.z = -center.z * scale;

  // 2. Create headPivot positioned at standard camera focus height (3.75)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.75, 0);
  headPivot.add(model);
  root.add(headPivot);

  // 3. Elegant display plinth / pedestal
  const pedGeo = new THREE.CylinderGeometry(1.3, 1.55, 0.45, 36);
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x090d16, // Dark titanium
    roughness: 0.35,
    metalness: 0.85,
  });
  const pedestal = new THREE.Mesh(pedGeo, pedMat);
  pedestal.position.set(0, 0.22, 0);
  pedestal.receiveShadow = true;
  root.add(pedestal);

  // Pedestal accent ring matching avatar theme
  const themeColors: Record<string, number> = {
    trump_3d: 0xe11d48,
    putin_3d: 0x2563eb,
    jinping_3d: 0xdc2626,
    bush_3d: 0x3b82f6,
    thatcher_3d: 0x8b5cf6,
  };
  const accentColor = themeColors[avatarId] || 0x06b6d4;

  const ringGeo = new THREE.RingGeometry(1.6, 1.7, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.23, 0);
  root.add(ring);

  // 4. Update function with smooth real-time head motion & audio reactivity
  const update = (features: FaceFeatures, _dt: number, now: number) => {
    // Real-time head pitch, yaw, roll from MediaPipe face tracking
    const targetPitch = (features.pitch || 0) * 0.85;
    const targetYaw = (features.yaw || 0) * 0.85;
    const targetRoll = (features.roll || 0) * 0.85;

    headPivot.rotation.x = THREE.MathUtils.lerp(headPivot.rotation.x, targetPitch, 0.2);
    headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, targetYaw, 0.2);
    headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z, targetRoll, 0.2);

    // Natural breathing oscillation and subtle voice nodding
    const breath = Math.sin(now * 0.002) * 0.012;
    const voiceNod = Math.min((features.audioVolume || 0) * 0.035, 0.025);
    headPivot.position.y = 3.75 + breath + voiceNod;
  };

  const dispose = () => {
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.geometry?.dispose();
        if (Array.isArray(m.material)) {
          m.material.forEach((mat) => mat.dispose());
        } else if (m.material) {
          m.material.dispose();
        }
      }
    });
  };

  return {
    group: root,
    headPivot,
    update,
    dispose,
  };
}
