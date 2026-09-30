import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AvatarId, FaceFeatures } from '../../types';

export interface Character3DController {
  group: THREE.Group;
  headPivot: THREE.Group;
  update: (features: FaceFeatures, dt: number, now: number) => void;
  playEmote?: (name: string) => void;
  dispose: () => void;
}

// Reusable standard materials
function createPBRMaterial(color: number, roughness = 0.5, metalness = 0.1): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

/**
 * Builds a 3D Cat character
 */
export function buildCatCharacter(): Character3DController {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // 1. Torso / Collar
  const torsoMat = createPBRMaterial(0xffedd5, 0.6, 0.05); // Cream fur
  const hoodieMat = createPBRMaterial(0xf472b6, 0.5, 0.1); // Pink hoodie
  const bellMat = createPBRMaterial(0xfbbf24, 0.25, 0.85); // Shiny gold bell
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = createPBRMaterial(0x10b981, 0.2, 0.3); // Emerald cat eye
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x064e3b });
  const noseMat = createPBRMaterial(0xf43f5e, 0.4, 0.05); // Pink nose
  const innerEarMat = createPBRMaterial(0xfecdd3, 0.7, 0.0); // Soft pink inner ear
  const tongueMat = createPBRMaterial(0xfb7185, 0.3, 0.1);
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });

  // Body Base
  const bodyGeo = new THREE.CylinderGeometry(0.85, 1.2, 1.8, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, hoodieMat);
  bodyMesh.position.set(0, 1.9, 0);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.6, 20);
  const neckMesh = new THREE.Mesh(neckGeo, torsoMat);
  neckMesh.position.set(0, 2.9, 0);
  root.add(neckMesh);

  // Collar with bell
  const collarGeo = new THREE.TorusGeometry(0.52, 0.08, 12, 32);
  const collarMesh = new THREE.Mesh(collarGeo, createPBRMaterial(0xbe185d, 0.4, 0.2));
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 2.85, 0);
  root.add(collarMesh);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 2.75, 0.55);
  const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), bellMat);
  bellMesh.castShadow = true;
  bellPivot.add(bellMesh);
  root.add(bellPivot);

  // 2. Head Pivot Group (rotates around neck at y=3.2)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.2, 0);
  root.add(headPivot);

  // Head Skull (chibi squashed sphere)
  const headGeo = new THREE.SphereGeometry(1.0, 32, 28);
  headGeo.scale(1.15, 0.95, 1.0);
  const headMesh = new THREE.Mesh(headGeo, torsoMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // 3. Cat Ears (Left and Right)
  const earGeo = new THREE.ConeGeometry(0.48, 0.85, 4);
  earGeo.scale(1.1, 1.0, 0.4);

  // Left Ear
  const leftEarPivot = new THREE.Group();
  leftEarPivot.position.set(-0.7, 0.82, -0.05);
  leftEarPivot.rotation.set(-0.1, 0, 0.35);
  const leftEarMesh = new THREE.Mesh(earGeo, torsoMat);
  leftEarMesh.castShadow = true;
  leftEarPivot.add(leftEarMesh);

  const leftInnerEar = new THREE.Mesh(earGeo, innerEarMat);
  leftInnerEar.scale.set(0.7, 0.7, 0.7);
  leftInnerEar.position.set(0, -0.05, 0.05);
  leftEarPivot.add(leftInnerEar);
  headPivot.add(leftEarPivot);

  // Right Ear
  const rightEarPivot = new THREE.Group();
  rightEarPivot.position.set(0.7, 0.82, -0.05);
  rightEarPivot.rotation.set(-0.1, 0, -0.35);
  const rightEarMesh = new THREE.Mesh(earGeo, torsoMat);
  rightEarMesh.castShadow = true;
  rightEarPivot.add(rightEarMesh);

  const rightInnerEar = new THREE.Mesh(earGeo, innerEarMat);
  rightInnerEar.scale.set(0.7, 0.7, 0.7);
  rightInnerEar.position.set(0, -0.05, 0.05);
  rightEarPivot.add(rightInnerEar);
  headPivot.add(rightEarPivot);

  // 4. Muzzle & Whiskers
  const muzzleGroup = new THREE.Group();
  muzzleGroup.position.set(0, -0.15, 0.95);

  // Whisker pads
  const padGeo = new THREE.SphereGeometry(0.24, 16, 16);
  padGeo.scale(1.2, 0.9, 0.9);
  const leftPad = new THREE.Mesh(padGeo, torsoMat);
  leftPad.position.set(-0.2, -0.05, 0);
  const rightPad = new THREE.Mesh(padGeo, torsoMat);
  rightPad.position.set(0.2, -0.05, 0);
  muzzleGroup.add(leftPad);
  muzzleGroup.add(rightPad);

  // Pink Nose
  const noseMesh = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.12, 3), noseMat);
  noseMesh.rotation.z = Math.PI;
  noseMesh.position.set(0, 0.08, 0.18);
  muzzleGroup.add(noseMesh);

  // Whiskers
  const whiskerGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.6, 6);
  const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
  [-1, 1].forEach((side) => {
    [-0.15, 0, 0.15].forEach((angle, i) => {
      const w = new THREE.Mesh(whiskerGeo, whiskerMat);
      w.rotation.z = Math.PI / 2 + angle * side;
      w.rotation.y = side * 0.3;
      w.position.set(side * 0.5, -0.05 + i * 0.06, 0.05);
      muzzleGroup.add(w);
    });
  });

  headPivot.add(muzzleGroup);

  // 5. Eyes with Blink & Gaze
  const eyeRadius = 0.24;
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.42, 0.18, 0.88);

  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  leftEyeGroup.add(leftCornea);

  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.72, 16, 16), irisMat);
  leftIris.position.set(0, 0, eyeRadius * 0.35);
  leftEyeGroup.add(leftIris);

  const leftPupil = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.14, 4, 8), pupilMat);
  leftPupil.position.set(0, 0, eyeRadius * 0.75);
  leftEyeGroup.add(leftPupil);

  // Left Eyelid
  const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeo, torsoMat);
  leftEyelid.rotation.x = -Math.PI / 2;
  leftEyeGroup.add(leftEyelid);
  headPivot.add(leftEyeGroup);

  // Right Eye
  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.42, 0.18, 0.88);

  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  rightEyeGroup.add(rightCornea);

  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.72, 16, 16), irisMat);
  rightIris.position.set(0, 0, eyeRadius * 0.35);
  rightEyeGroup.add(rightIris);

  const rightPupil = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.14, 4, 8), pupilMat);
  rightPupil.position.set(0, 0, eyeRadius * 0.75);
  rightEyeGroup.add(rightPupil);

  const rightEyelid = new THREE.Mesh(eyelidGeo, torsoMat);
  rightEyelid.rotation.x = -Math.PI / 2;
  rightEyeGroup.add(rightEyelid);
  headPivot.add(rightEyeGroup);

  // 6. Mouth / Jaw
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.32, 0.9);

  const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), torsoMat);
  jawMesh.scale.set(0.9, 0.5, 0.8);
  jawGroup.add(jawMesh);

  const tongueMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), tongueMat);
  tongueMesh.scale.set(0.9, 0.4, 1.4);
  tongueMesh.position.set(0, -0.05, 0.1);
  jawGroup.add(tongueMesh);

  headPivot.add(jawGroup);

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      const targetRoll = features.roll || 0;
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = targetRoll;

      // Bell & collar physics
      bellPivot.rotation.z = THREE.MathUtils.lerp(bellPivot.rotation.z, targetRoll * 1.5, 0.2);

      // Ear twitches
      const twitch = Math.sin(now / 350) * 0.08;
      leftEarPivot.rotation.z = 0.35 + twitch - targetRoll * 0.3;
      rightEarPivot.rotation.z = -0.35 - twitch - targetRoll * 0.3;

      // Eyelids (blink)
      const lBlink = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const rBlink = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      leftEyelid.rotation.x = -Math.PI / 2 + lBlink * (Math.PI / 2);
      rightEyelid.rotation.x = -Math.PI / 2 + rBlink * (Math.PI / 2);

      // Gaze
      const gX = (features.gazeX || 0) * 0.08;
      const gY = (features.gazeY || 0) * 0.06;
      leftIris.position.x = gX;
      leftIris.position.y = gY;
      rightIris.position.x = gX;
      rightIris.position.y = gY;

      // Jaw Opening purely driven by lips tracking (no false audio triggers)
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const activeOpen = jOpen;
      jawGroup.position.y = -0.32 - activeOpen * 0.22;
      jawGroup.rotation.x = activeOpen * 0.35;
    },
    dispose: () => {
      // Standard cleanup
    },
  };
}

/**
 * Builds a 3D Dog character
 */
export function buildDogCharacter(): Character3DController {
  const root = new THREE.Group();

  const dogFurMat = createPBRMaterial(0xd97706, 0.6, 0.05); // Golden-brown dog fur
  const snoutFurMat = createPBRMaterial(0xfef3c7, 0.65, 0.05); // Cream muzzle
  const blackNoseMat = createPBRMaterial(0x18181b, 0.2, 0.1); // Wet black nose
  const collarMat = createPBRMaterial(0x2563eb, 0.4, 0.2); // Blue collar
  const boneTagMat = createPBRMaterial(0xe2e8f0, 0.2, 0.9); // Silver bone
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = createPBRMaterial(0x78350f, 0.3, 0.2); // Warm brown eye
  const tongueMat = createPBRMaterial(0xf43f5e, 0.3, 0.1); // Pink dog tongue

  // Body Base
  const bodyGeo = new THREE.CylinderGeometry(0.9, 1.25, 1.8, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, dogFurMat);
  bodyMesh.position.set(0, 1.9, 0);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Blue collar with bone tag
  const collarMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.08, 12, 32),
    collarMat
  );
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 2.85, 0);
  root.add(collarMesh);

  const bonePivot = new THREE.Group();
  bonePivot.position.set(0, 2.75, 0.58);
  const boneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.06), boneTagMat);
  bonePivot.add(boneMesh);
  root.add(bonePivot);

  // Head Pivot Group (at y=3.2)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.2, 0);
  root.add(headPivot);

  // Head Skull
  const headGeo = new THREE.SphereGeometry(1.02, 32, 28);
  headGeo.scale(1.05, 0.98, 1.05);
  const headMesh = new THREE.Mesh(headGeo, dogFurMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Floppy Dog Ears (Left and Right that swing dynamically)
  const earGeo = new THREE.CapsuleGeometry(0.28, 0.9, 8, 16);
  earGeo.scale(0.8, 1.0, 0.45);

  const leftEarPivot = new THREE.Group();
  leftEarPivot.position.set(-0.85, 0.55, 0.1);
  leftEarPivot.rotation.set(0.1, 0, 0.35);
  const leftEarMesh = new THREE.Mesh(earGeo, dogFurMat);
  leftEarMesh.position.set(0, -0.45, 0);
  leftEarMesh.castShadow = true;
  leftEarPivot.add(leftEarMesh);
  headPivot.add(leftEarPivot);

  const rightEarPivot = new THREE.Group();
  rightEarPivot.position.set(0.85, 0.55, 0.1);
  rightEarPivot.rotation.set(0.1, 0, -0.35);
  const rightEarMesh = new THREE.Mesh(earGeo, dogFurMat);
  rightEarMesh.position.set(0, -0.45, 0);
  rightEarMesh.castShadow = true;
  rightEarPivot.add(rightEarMesh);
  headPivot.add(rightEarPivot);

  // Protruding Dog Snout
  const snoutGroup = new THREE.Group();
  snoutGroup.position.set(0, -0.15, 0.95);

  const snoutMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.45, 0.65), snoutFurMat);
  snoutMesh.position.set(0, 0, 0.18);
  snoutMesh.castShadow = true;
  snoutGroup.add(snoutMesh);

  // Wet Nose
  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), blackNoseMat);
  noseMesh.scale.set(1.2, 0.8, 0.8);
  noseMesh.position.set(0, 0.16, 0.52);
  snoutGroup.add(noseMesh);

  headPivot.add(snoutGroup);

  // Eyes
  const eyeRadius = 0.22;
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.4, 0.22, 0.9);

  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  leftEyeGroup.add(leftCornea);

  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.75, 16, 16), irisMat);
  leftIris.position.set(0, 0, eyeRadius * 0.4);
  leftEyeGroup.add(leftIris);

  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.4, 16, 16), blackNoseMat);
  leftPupil.position.set(0, 0, eyeRadius * 0.75);
  leftEyeGroup.add(leftPupil);

  const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeo, dogFurMat);
  leftEyelid.rotation.x = -Math.PI / 2;
  leftEyeGroup.add(leftEyelid);
  headPivot.add(leftEyeGroup);

  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.4, 0.22, 0.9);

  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  rightEyeGroup.add(rightCornea);

  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.75, 16, 16), irisMat);
  rightIris.position.set(0, 0, eyeRadius * 0.4);
  rightEyeGroup.add(rightIris);

  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.4, 16, 16), blackNoseMat);
  rightPupil.position.set(0, 0, eyeRadius * 0.75);
  rightEyeGroup.add(rightPupil);

  const rightEyelid = new THREE.Mesh(eyelidGeo, dogFurMat);
  rightEyelid.rotation.x = -Math.PI / 2;
  rightEyeGroup.add(rightEyelid);
  headPivot.add(rightEyeGroup);

  // Lower Jaw & Panting Tongue
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.38, 0.9);

  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), snoutFurMat);
  jawPivot.add(jawMesh);

  // Tongue extends and pants when mouth opens
  const tongueGeo = new THREE.CapsuleGeometry(0.12, 0.35, 8, 16);
  tongueGeo.scale(1.2, 0.3, 1.0);
  const tongueMesh = new THREE.Mesh(tongueGeo, tongueMat);
  tongueMesh.position.set(0, -0.05, 0.25);
  tongueMesh.rotation.x = 0.4;
  jawPivot.add(tongueMesh);

  headPivot.add(jawPivot);

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      const targetRoll = features.roll || 0;
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = targetRoll;

      // Floppy ear inertia & bounce
      const earFlop = targetRoll * 0.9 + Math.sin(now / 300) * 0.05;
      leftEarPivot.rotation.z = 0.35 + earFlop;
      rightEarPivot.rotation.z = -0.35 + earFlop;

      // Bone tag physics
      bonePivot.rotation.z = THREE.MathUtils.lerp(bonePivot.rotation.z, targetRoll * 1.4, 0.2);

      // Eyelids
      const lBlink = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const rBlink = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      leftEyelid.rotation.x = -Math.PI / 2 + lBlink * (Math.PI / 2);
      rightEyelid.rotation.x = -Math.PI / 2 + rBlink * (Math.PI / 2);

      // Gaze
      const gX = (features.gazeX || 0) * 0.08;
      const gY = (features.gazeY || 0) * 0.06;
      leftIris.position.x = gX;
      leftIris.position.y = gY;
      rightIris.position.x = gX;
      rightIris.position.y = gY;

      // Jaw & Tongue Extension purely driven by lips tracking (no false audio triggers)
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const activeOpen = jOpen;
      jawPivot.position.y = -0.38 - activeOpen * 0.25;
      jawPivot.rotation.x = activeOpen * 0.45;
      tongueMesh.scale.z = 1.0 + activeOpen * 1.2;
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Stylized Female Anime character
 */
export function buildFemaleCharacter(): Character3DController {
  const root = new THREE.Group();

  const skinMat = createPBRMaterial(0xffedd5, 0.55, 0.05); // Smooth anime skin
  const hairMat = createPBRMaterial(0x831843, 0.45, 0.15); // Rich magenta/plum anime hair
  const dressMat = createPBRMaterial(0x0f172a, 0.4, 0.2); // Elegant dark dress
  const chokerMat = createPBRMaterial(0x1e1b4b, 0.3, 0.4);
  const starMat = createPBRMaterial(0xfbbf24, 0.2, 0.85); // Gold star
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = createPBRMaterial(0x6366f1, 0.25, 0.2); // Sapphire anime eyes
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1e1b4b });
  const lashMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
  const blushMat = createPBRMaterial(0xf43f5e, 0.7, 0.0); // Soft blush
  const lipMat = createPBRMaterial(0xf43f5e, 0.35, 0.1);

  // Body Base & Shoulders
  const bodyGeo = new THREE.CylinderGeometry(0.7, 1.1, 1.8, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, dressMat);
  bodyMesh.position.set(0, 1.9, 0);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Neck
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.7, 20), skinMat);
  neckMesh.position.set(0, 2.9, 0);
  root.add(neckMesh);

  // Choker with Star
  const chokerMesh = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 12, 32), chokerMat);
  chokerMesh.rotation.x = Math.PI / 2;
  chokerMesh.position.set(0, 2.85, 0);
  root.add(chokerMesh);

  const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), starMat);
  starMesh.position.set(0, 2.82, 0.4);
  root.add(starMesh);

  // Head Pivot Group
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.25, 0);
  root.add(headPivot);

  // Anime Face Skull (delicate chin)
  const headGeo = new THREE.SphereGeometry(0.92, 32, 28);
  headGeo.scale(0.95, 1.05, 0.95);
  const headMesh = new THREE.Mesh(headGeo, skinMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Hair Base (Back hair)
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(0.98, 24, 24), hairMat);
  hairBack.position.set(0, 0.08, -0.05);
  hairBack.scale.set(1.02, 1.08, 1.05);
  headPivot.add(hairBack);

  // Front Anime Bangs
  const bangsGroup = new THREE.Group();
  bangsGroup.position.set(0, 0.55, 0.72);
  [-0.4, -0.15, 0.15, 0.4].forEach((bx, i) => {
    const bangStrand = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.65, 4), hairMat);
    bangStrand.rotation.z = Math.PI + (i - 1.5) * 0.15;
    bangStrand.rotation.x = -0.3;
    bangStrand.position.set(bx, 0, 0);
    bangsGroup.add(bangStrand);
  });
  headPivot.add(bangsGroup);

  // Twin Side Locks that sway with head movement
  const sideLockGeo = new THREE.CapsuleGeometry(0.12, 1.1, 8, 16);
  const leftLockPivot = new THREE.Group();
  leftLockPivot.position.set(-0.85, 0.2, 0.3);
  const leftLockMesh = new THREE.Mesh(sideLockGeo, hairMat);
  leftLockMesh.position.set(0, -0.55, 0);
  leftLockPivot.add(leftLockMesh);
  headPivot.add(leftLockPivot);

  const rightLockPivot = new THREE.Group();
  rightLockPivot.position.set(0.85, 0.2, 0.3);
  const rightLockMesh = new THREE.Mesh(sideLockGeo, hairMat);
  rightLockMesh.position.set(0, -0.55, 0);
  rightLockPivot.add(rightLockMesh);
  headPivot.add(rightLockPivot);

  // Ponytail in Back
  const ponytailPivot = new THREE.Group();
  ponytailPivot.position.set(0, 0.7, -0.85);
  const ponytailMesh = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8), hairMat);
  ponytailMesh.rotation.x = -1.2;
  ponytailMesh.position.set(0, -0.5, -0.3);
  ponytailPivot.add(ponytailMesh);
  headPivot.add(ponytailPivot);

  // Anime Eyes & Eyelashes
  const eyeRadius = 0.22;
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.36, 0.12, 0.85);

  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  leftEyeGroup.add(leftCornea);

  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.75, 16, 16), irisMat);
  leftIris.position.set(0, 0, eyeRadius * 0.4);
  leftEyeGroup.add(leftIris);

  const leftPupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.4, 16, 16), pupilMat);
  leftPupil.position.set(0, 0, eyeRadius * 0.75);
  leftEyeGroup.add(leftPupil);

  // Eyelash Curvature
  const leftLash = new THREE.Mesh(new THREE.TorusGeometry(eyeRadius * 1.1, 0.03, 8, 16, Math.PI * 0.7), lashMat);
  leftLash.rotation.z = Math.PI * 0.15;
  leftLash.position.set(0, 0.05, eyeRadius * 0.8);
  leftEyeGroup.add(leftLash);

  const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeo, skinMat);
  leftEyelid.rotation.x = -Math.PI / 2;
  leftEyeGroup.add(leftEyelid);
  headPivot.add(leftEyeGroup);

  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.36, 0.12, 0.85);

  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  rightEyeGroup.add(rightCornea);

  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.75, 16, 16), irisMat);
  rightIris.position.set(0, 0, eyeRadius * 0.4);
  rightEyeGroup.add(rightIris);

  const rightPupil = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.4, 16, 16), pupilMat);
  rightPupil.position.set(0, 0, eyeRadius * 0.75);
  rightEyeGroup.add(rightPupil);

  const rightLash = new THREE.Mesh(new THREE.TorusGeometry(eyeRadius * 1.1, 0.03, 8, 16, Math.PI * 0.7), lashMat);
  rightLash.rotation.z = Math.PI * 0.15;
  rightLash.position.set(0, 0.05, eyeRadius * 0.8);
  rightEyeGroup.add(rightLash);

  const rightEyelid = new THREE.Mesh(eyelidGeo, skinMat);
  rightEyelid.rotation.x = -Math.PI / 2;
  rightEyeGroup.add(rightEyelid);
  headPivot.add(rightEyeGroup);

  // Blushing Cheeks
  const blushGeo = new THREE.CircleGeometry(0.18, 16);
  const leftBlush = new THREE.Mesh(blushGeo, blushMat);
  leftBlush.position.set(-0.52, -0.05, 0.78);
  leftBlush.rotation.y = -0.4;
  headPivot.add(leftBlush);

  const rightBlush = new THREE.Mesh(blushGeo, blushMat);
  rightBlush.position.set(0.52, -0.05, 0.78);
  rightBlush.rotation.y = 0.4;
  headPivot.add(rightBlush);

  // Delicate Lips
  const mouthPivot = new THREE.Group();
  mouthPivot.position.set(0, -0.32, 0.88);

  const lipsMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), lipMat);
  lipsMesh.scale.set(1.4, 0.4, 0.6);
  mouthPivot.add(lipsMesh);
  headPivot.add(mouthPivot);

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      const targetRoll = features.roll || 0;
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = targetRoll;

      // Hair strand physics sway
      const sway = targetRoll * 0.8 + Math.sin(now / 400) * 0.04;
      leftLockPivot.rotation.z = sway;
      rightLockPivot.rotation.z = sway;
      ponytailPivot.rotation.z = -sway * 1.2;

      // Eyelids
      const lBlink = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const rBlink = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      leftEyelid.rotation.x = -Math.PI / 2 + lBlink * (Math.PI / 2);
      rightEyelid.rotation.x = -Math.PI / 2 + rBlink * (Math.PI / 2);

      // Gaze
      const gX = (features.gazeX || 0) * 0.08;
      const gY = (features.gazeY || 0) * 0.06;
      leftIris.position.x = gX;
      leftIris.position.y = gY;
      rightIris.position.x = gX;
      rightIris.position.y = gY;

      // Smile & Lips Tracking (purely lips, no false audio triggers)
      const smile = Math.max(0, features.mouthSmile || 0);
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const activeOpen = jOpen;
      mouthPivot.scale.x = 1.0 + smile * 0.5;
      mouthPivot.scale.y = 1.0 + activeOpen * 2.2;
      mouthPivot.position.y = -0.32 - activeOpen * 0.15;
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Horse character
 */
export function buildHorseCharacter(): Character3DController {
  const root = new THREE.Group();

  const coatMat = createPBRMaterial(0x7c2d12, 0.5, 0.1); // Rich chestnut horse coat
  const muzzleMat = createPBRMaterial(0x451a03, 0.6, 0.05); // Dark muzzle tip
  const maneMat = createPBRMaterial(0x1c1917, 0.4, 0.2); // Black mane
  const bridleMat = createPBRMaterial(0x9a3412, 0.35, 0.5); // Leather bridle
  const brassMat = createPBRMaterial(0xfbbf24, 0.2, 0.85); // Brass rings
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = createPBRMaterial(0x18181b, 0.2, 0.3); // Deep equine eye

  // Arched Equine Neck and Shoulders
  const neckGeo = new THREE.CylinderGeometry(0.7, 1.25, 2.2, 24);
  neckGeo.scale(0.85, 1.0, 1.3);
  const neckMesh = new THREE.Mesh(neckGeo, coatMat);
  neckMesh.position.set(0, 1.8, -0.2);
  neckMesh.rotation.x = 0.25;
  neckMesh.castShadow = true;
  root.add(neckMesh);

  // Flowing Mane on Neck
  const maneSpine = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.8, 0.5), maneMat);
  maneSpine.position.set(0, 2.0, -0.75);
  maneSpine.rotation.x = 0.25;
  root.add(maneSpine);

  // Head Pivot Group (at y=3.2)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.2, 0);
  root.add(headPivot);

  // Sculpted Horse Skull & Elongated Equine Muzzle
  const skullGeo = new THREE.SphereGeometry(0.9, 24, 24);
  skullGeo.scale(0.85, 1.0, 1.1);
  const skullMesh = new THREE.Mesh(skullGeo, coatMat);
  skullMesh.castShadow = true;
  skullMesh.receiveShadow = true;
  headPivot.add(skullMesh);

  // Elongated Muzzle Bridge
  const muzzleBridgeGeo = new THREE.CylinderGeometry(0.42, 0.72, 1.3, 16);
  muzzleBridgeGeo.scale(0.85, 1.0, 1.2);
  const muzzleBridge = new THREE.Mesh(muzzleBridgeGeo, coatMat);
  muzzleBridge.rotation.x = -1.0;
  muzzleBridge.position.set(0, -0.35, 0.65);
  headPivot.add(muzzleBridge);

  // Muzzle Tip with Nostrils
  const muzzleTip = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), muzzleMat);
  muzzleTip.scale.set(0.9, 0.8, 1.1);
  muzzleTip.position.set(0, -0.85, 1.25);
  headPivot.add(muzzleTip);

  // Flared Nostrils
  [-0.2, 0.2].forEach((nx) => {
    const nostril = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.03, 8, 16),
      createPBRMaterial(0x0c0a09, 0.8, 0)
    );
    nostril.position.set(nx, -0.82, 1.6);
    nostril.rotation.x = 0.4;
    headPivot.add(nostril);
  });

  // Upright Alert Equine Ears (Left & Right)
  const earGeo = new THREE.ConeGeometry(0.24, 0.85, 8);
  earGeo.scale(1.0, 1.0, 0.45);

  const leftEarPivot = new THREE.Group();
  leftEarPivot.position.set(-0.45, 0.88, -0.1);
  leftEarPivot.rotation.set(-0.2, 0, 0.25);
  const leftEarMesh = new THREE.Mesh(earGeo, coatMat);
  leftEarMesh.position.set(0, 0.4, 0);
  leftEarMesh.castShadow = true;
  leftEarPivot.add(leftEarMesh);
  headPivot.add(leftEarPivot);

  const rightEarPivot = new THREE.Group();
  rightEarPivot.position.set(0.45, 0.88, -0.1);
  rightEarPivot.rotation.set(-0.2, 0, -0.25);
  const rightEarMesh = new THREE.Mesh(earGeo, coatMat);
  rightEarMesh.position.set(0, 0.4, 0);
  rightEarMesh.castShadow = true;
  rightEarPivot.add(rightEarMesh);
  headPivot.add(rightEarPivot);

  // Forelock Mane between Ears
  const forelockPivot = new THREE.Group();
  forelockPivot.position.set(0, 0.82, 0.35);
  const forelockMesh = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.75, 6), maneMat);
  forelockMesh.rotation.x = -0.5;
  forelockPivot.add(forelockMesh);
  headPivot.add(forelockPivot);

  // Lateral Equine Eyes
  const eyeRadius = 0.22;
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.68, 0.25, 0.35);
  leftEyeGroup.rotation.y = -0.55;

  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  leftEyeGroup.add(leftCornea);

  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.85, 16, 16), irisMat);
  leftIris.position.set(0, 0, eyeRadius * 0.45);
  leftEyeGroup.add(leftIris);

  const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeo, coatMat);
  leftEyelid.rotation.x = -Math.PI / 2;
  leftEyeGroup.add(leftEyelid);
  headPivot.add(leftEyeGroup);

  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.68, 0.25, 0.35);
  rightEyeGroup.rotation.y = 0.55;

  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  rightEyeGroup.add(rightCornea);

  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.85, 16, 16), irisMat);
  rightIris.position.set(0, 0, eyeRadius * 0.45);
  rightEyeGroup.add(rightIris);

  const rightEyelid = new THREE.Mesh(eyelidGeo, coatMat);
  rightEyelid.rotation.x = -Math.PI / 2;
  rightEyeGroup.add(rightEyelid);
  headPivot.add(rightEyeGroup);

  // Leather Bridle / Halter
  const noseBand = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.05, 8, 24), bridleMat);
  noseBand.position.set(0, -0.65, 1.05);
  noseBand.rotation.x = -0.9;
  headPivot.add(noseBand);

  // Lower Jaw
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.9, 1.15);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.5), muzzleMat);
  jawPivot.add(jawMesh);
  headPivot.add(jawPivot);

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      const targetRoll = features.roll || 0;
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = targetRoll;

      // Mane bounce
      forelockPivot.rotation.z = targetRoll * 0.6 + Math.sin(now / 350) * 0.05;

      // Ears alert movement
      leftEarPivot.rotation.y = (features.yaw || 0) * 0.2;
      rightEarPivot.rotation.y = (features.yaw || 0) * 0.2;

      // Eyelids
      const lBlink = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const rBlink = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      leftEyelid.rotation.x = -Math.PI / 2 + lBlink * (Math.PI / 2);
      rightEyelid.rotation.x = -Math.PI / 2 + rBlink * (Math.PI / 2);

      // Jaw Opening purely driven by lips tracking (no false audio triggers)
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const activeOpen = jOpen;
      jawPivot.position.y = -0.9 - activeOpen * 0.2;
      jawPivot.rotation.x = activeOpen * 0.35;
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Procedural Robot / Cyborg fallback
 */
export function buildProceduralRobotCharacter(theme: 'cyber' | 'mecha' | 'punk'): Character3DController {
  const root = new THREE.Group();

  const chassisColor = theme === 'cyber' ? 0x0f172a : theme === 'mecha' ? 0x1e293b : 0x3b0764;
  const accentColor = theme === 'cyber' ? 0x06b6d4 : theme === 'mecha' ? 0x10b981 : 0xa855f7;

  const chassisMat = createPBRMaterial(chassisColor, 0.4, 0.7);
  const accentMat = createPBRMaterial(accentColor, 0.25, 0.85);
  const glowMat = new THREE.MeshBasicMaterial({ color: accentColor });

  // Body Base
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.1), chassisMat);
  bodyMesh.position.set(0, 1.9, 0);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // Glowing Chest Reactor
  const reactorMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), glowMat);
  reactorMesh.rotation.x = Math.PI / 2;
  reactorMesh.position.set(0, 2.2, 0.58);
  root.add(reactorMesh);

  // Head Pivot Group
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.2, 0);
  root.add(headPivot);

  // Robot Head Box
  const headMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.25, 1.2), chassisMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // Visor Screen
  const visorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.45, 0.1), glowMat);
  visorMesh.position.set(0, 0.1, 0.62);
  headPivot.add(visorMesh);

  // Antenna
  const antennaMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 8), accentMat);
  antennaMesh.position.set(0, 0.95, 0);
  headPivot.add(antennaMesh);

  const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), glowMat);
  bulbMesh.position.set(0, 1.35, 0);
  headPivot.add(bulbMesh);

  // Articulated Lower Jaw (Mechanical Chin Plate)
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.45, 0.45);
  const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.28, 0.8), chassisMat);
  jawMesh.position.set(0, -0.1, 0.1);
  jawMesh.castShadow = true;
  jawPivot.add(jawMesh);
  headPivot.add(jawPivot);

  // Recessed Dark Mouth Cavity
  const mouthCavity = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.28, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x020617 })
  );
  mouthCavity.position.set(0, -0.32, 0.61);
  headPivot.add(mouthCavity);

  // 7 Animated Glowing Cyber LED Equalizer Bars
  const ledBars: THREE.Mesh[] = [];
  const ledMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.95,
  });
  for (let i = 0; i < 7; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.12, 0.04), ledMat);
    bar.position.set((i - 3) * 0.09, -0.32, 0.63);
    headPivot.add(bar);
    ledBars.push(bar);
  }

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = features.roll || 0;

      // Perfect Animated Cyber Mouth Mapping
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const vol = Math.max(0, Math.min(1, features.audioVolume || 0));
      const smile = features.mouthSmile || 0;
      const pucker = Math.max(0, Math.min(1, features.mouthPucker || 0));

      // 1. Mechanical Lower Jaw articulates purely with user's lips
      const activeOpen = jOpen;
      jawPivot.rotation.x = THREE.MathUtils.lerp(jawPivot.rotation.x, activeOpen * 0.42, 0.35);
      jawPivot.position.y = THREE.MathUtils.lerp(jawPivot.position.y, -0.45 - activeOpen * 0.18, 0.35);

      // 2. LED Spectrum Equalizer Bars dance with jawOpen
      ledBars.forEach((bar, i) => {
        const dist = Math.abs(i - 3) / 3;
        const centerFactor = 1 - dist * 0.55;
        const targetH = 1.0 + (activeOpen * 6.5) * centerFactor;
        bar.scale.y = THREE.MathUtils.lerp(bar.scale.y, Math.max(0.4, targetH), 0.35);
        bar.scale.x = THREE.MathUtils.lerp(bar.scale.x, Math.max(0.4, 1.0 - pucker * 0.5), 0.3);

        // Curvature: smile curves outer bars up; frown curves outer bars down
        const smileCurve = (i - 3) * (i - 3) * 0.012 * smile;
        bar.position.y = THREE.MathUtils.lerp(bar.position.y, -0.32 + smileCurve, 0.3);
        bar.position.x = (i - 3) * 0.09 * (1.0 - pucker * 0.35);
      });
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Kitsune Fox character with spirit markings and animated mouth
 */
export function buildFoxCharacter(): Character3DController {
  const root = new THREE.Group();

  const orangeFurMat = createPBRMaterial(0xea580c, 0.6, 0.05); // Fox orange
  const whiteFurMat = createPBRMaterial(0xfff7ed, 0.65, 0.05); // Cream white muzzle & cheek fluff
  const darkFurMat = createPBRMaterial(0x1c1917, 0.4, 0.1); // Charcoal ear tips and paws
  const redMarkMat = createPBRMaterial(0xef4444, 0.4, 0.1); // Mystical Kitsune red markings
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const irisMat = createPBRMaterial(0xd97706, 0.25, 0.25); // Mystical amber fox eye
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
  const tongueMat = createPBRMaterial(0xfb7185, 0.3, 0.1);
  const collarMat = createPBRMaterial(0x991b1b, 0.4, 0.2); // Spirit red rope collar
  const bellMat = createPBRMaterial(0xfbbf24, 0.25, 0.85); // Gold spirit bell

  // 1. Torso with Spirit Haori
  const bodyGeo = new THREE.CylinderGeometry(0.85, 1.25, 1.8, 24);
  const bodyMesh = new THREE.Mesh(bodyGeo, orangeFurMat);
  bodyMesh.position.set(0, 1.9, 0);
  bodyMesh.castShadow = true;
  root.add(bodyMesh);

  // White Chest Bib
  const chestBib = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 16), whiteFurMat);
  chestBib.position.set(0, 2.0, 0.45);
  chestBib.rotation.x = 0.2;
  root.add(chestBib);

  // Collar with golden spirit bell
  const collarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.08, 12, 32), collarMat);
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 2.85, 0);
  root.add(collarMesh);

  const bellPivot = new THREE.Group();
  bellPivot.position.set(0, 2.75, 0.55);
  const bellMesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), bellMat);
  bellMesh.castShadow = true;
  bellPivot.add(bellMesh);
  root.add(bellPivot);

  // 2. Head Pivot Group
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.25, 0);
  root.add(headPivot);

  // Fox Skull
  const headGeo = new THREE.SphereGeometry(0.96, 32, 28);
  headGeo.scale(1.08, 0.95, 1.05);
  const headMesh = new THREE.Mesh(headGeo, orangeFurMat);
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  headPivot.add(headMesh);

  // White Cheek Fluff (Left and Right)
  [-0.65, 0.65].forEach((cx, i) => {
    const fluff = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.65, 6), whiteFurMat);
    fluff.position.set(cx, -0.15, 0.35);
    fluff.rotation.z = (i === 0 ? 1 : -1) * 1.1;
    fluff.rotation.x = -0.3;
    headPivot.add(fluff);
  });

  // 3. Tall Alert Fox Ears
  const earGeo = new THREE.ConeGeometry(0.38, 1.1, 4);
  earGeo.scale(1.1, 1.0, 0.45);

  const leftEarPivot = new THREE.Group();
  leftEarPivot.position.set(-0.62, 0.92, -0.05);
  leftEarPivot.rotation.set(-0.15, 0, 0.35);
  const leftEarMesh = new THREE.Mesh(earGeo, orangeFurMat);
  leftEarMesh.position.set(0, 0.4, 0);
  leftEarMesh.castShadow = true;
  leftEarPivot.add(leftEarMesh);

  const leftEarTip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 4), darkFurMat);
  leftEarTip.scale.set(1.1, 1.0, 0.45);
  leftEarTip.position.set(0, 0.75, 0);
  leftEarPivot.add(leftEarTip);

  const leftInnerEar = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), whiteFurMat);
  leftInnerEar.scale.set(1.0, 1.0, 0.4);
  leftInnerEar.position.set(0, 0.35, 0.06);
  leftEarPivot.add(leftInnerEar);
  headPivot.add(leftEarPivot);

  const rightEarPivot = new THREE.Group();
  rightEarPivot.position.set(0.62, 0.92, -0.05);
  rightEarPivot.rotation.set(-0.15, 0, -0.35);
  const rightEarMesh = new THREE.Mesh(earGeo, orangeFurMat);
  rightEarMesh.position.set(0, 0.4, 0);
  rightEarMesh.castShadow = true;
  rightEarPivot.add(rightEarMesh);

  const rightEarTip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 4), darkFurMat);
  rightEarTip.scale.set(1.1, 1.0, 0.45);
  rightEarTip.position.set(0, 0.75, 0);
  rightEarPivot.add(rightEarTip);

  const rightInnerEar = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.75, 4), whiteFurMat);
  rightInnerEar.scale.set(1.0, 1.0, 0.4);
  rightInnerEar.position.set(0, 0.35, 0.06);
  rightEarPivot.add(rightInnerEar);
  headPivot.add(rightEarPivot);

  // 4. Mystical Forehead Marking (Kitsune Spirit Diamond)
  const mark = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), redMarkMat);
  mark.scale.set(0.7, 1.4, 0.2);
  mark.position.set(0, 0.52, 0.95);
  headPivot.add(mark);

  // Red Eye Markings (slanted Kitsune eyeliner)
  [-0.45, 0.45].forEach((mx, i) => {
    const eyeMark = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), redMarkMat);
    eyeMark.position.set(mx, 0.28, 0.88);
    eyeMark.rotation.z = (i === 0 ? -1 : 1) * 0.4;
    headPivot.add(eyeMark);
  });

  // 5. Slanted Fox Eyes
  const eyeRadius = 0.21;
  const leftEyeGroup = new THREE.Group();
  leftEyeGroup.position.set(-0.38, 0.16, 0.88);
  leftEyeGroup.rotation.z = -0.15; // Slanted almond eyes

  const leftCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  leftEyeGroup.add(leftCornea);

  const leftIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.76, 16, 16), irisMat);
  leftIris.position.set(0, 0, eyeRadius * 0.38);
  leftEyeGroup.add(leftIris);

  const leftPupil = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), pupilMat);
  leftPupil.position.set(0, 0, eyeRadius * 0.75);
  leftEyeGroup.add(leftPupil);

  const eyelidGeo = new THREE.SphereGeometry(eyeRadius * 1.05, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const leftEyelid = new THREE.Mesh(eyelidGeo, orangeFurMat);
  leftEyelid.rotation.x = -Math.PI / 2;
  leftEyeGroup.add(leftEyelid);
  headPivot.add(leftEyeGroup);

  const rightEyeGroup = new THREE.Group();
  rightEyeGroup.position.set(0.38, 0.16, 0.88);
  rightEyeGroup.rotation.z = 0.15;

  const rightCornea = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius, 16, 16), eyeWhiteMat);
  rightEyeGroup.add(rightCornea);

  const rightIris = new THREE.Mesh(new THREE.SphereGeometry(eyeRadius * 0.76, 16, 16), irisMat);
  rightIris.position.set(0, 0, eyeRadius * 0.38);
  rightEyeGroup.add(rightIris);

  const rightPupil = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), pupilMat);
  rightPupil.position.set(0, 0, eyeRadius * 0.75);
  rightEyeGroup.add(rightPupil);

  const rightEyelid = new THREE.Mesh(eyelidGeo, orangeFurMat);
  rightEyelid.rotation.x = -Math.PI / 2;
  rightEyeGroup.add(rightEyelid);
  headPivot.add(rightEyeGroup);

  // 6. Pointed Fox Muzzle & Whiskers
  const muzzleGroup = new THREE.Group();
  muzzleGroup.position.set(0, -0.15, 0.95);

  const snoutMesh = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 16), whiteFurMat);
  snoutMesh.rotation.x = Math.PI / 2;
  snoutMesh.position.set(0, 0.05, 0.32);
  snoutMesh.castShadow = true;
  muzzleGroup.add(snoutMesh);

  // Black Nose
  const noseMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), darkFurMat);
  noseMesh.scale.set(1.2, 0.8, 0.9);
  noseMesh.position.set(0, 0.05, 0.68);
  muzzleGroup.add(noseMesh);

  // Whiskers
  const whiskerGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.55, 6);
  const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
  [-1, 1].forEach((side) => {
    [-0.12, 0.08].forEach((angle, i) => {
      const w = new THREE.Mesh(whiskerGeo, whiskerMat);
      w.rotation.z = Math.PI / 2 + angle * side;
      w.rotation.y = side * 0.35;
      w.position.set(side * 0.45, 0.02 + i * 0.05, 0.35);
      muzzleGroup.add(w);
    });
  });
  headPivot.add(muzzleGroup);

  // 7. Articulated Fox Lower Jaw
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.28, 1.05);

  const jawMesh = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 12), whiteFurMat);
  jawMesh.rotation.x = Math.PI / 2;
  jawMesh.position.set(0, -0.05, 0.22);
  jawPivot.add(jawMesh);

  const tongueMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), tongueMat);
  tongueMesh.scale.set(0.9, 0.35, 1.4);
  tongueMesh.position.set(0, -0.03, 0.18);
  jawPivot.add(tongueMesh);
  headPivot.add(jawPivot);

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      const targetRoll = features.roll || 0;
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = targetRoll;

      // Spirit Bell physics
      bellPivot.rotation.z = THREE.MathUtils.lerp(bellPivot.rotation.z, targetRoll * 1.5, 0.2);

      // Fox Ear twitches & alert posture
      const twitch = Math.sin(now / 320) * 0.06;
      leftEarPivot.rotation.z = 0.35 + twitch - targetRoll * 0.25;
      rightEarPivot.rotation.z = -0.35 - twitch - targetRoll * 0.25;

      // Eyelids
      const lBlink = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const rBlink = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      leftEyelid.rotation.x = -Math.PI / 2 + lBlink * (Math.PI / 2);
      rightEyelid.rotation.x = -Math.PI / 2 + rBlink * (Math.PI / 2);

      // Gaze
      const gX = (features.gazeX || 0) * 0.08;
      const gY = (features.gazeY || 0) * 0.06;
      leftIris.position.x = gX;
      leftIris.position.y = gY;
      rightIris.position.x = gX;
      rightIris.position.y = gY;

      // Fox Jaw purely driven by lips tracking (no false audio triggers)
      const jOpen = Math.min(1, Math.max(0, features.jawOpen || 0));
      const activeOpen = jOpen;
      jawPivot.position.y = -0.28 - activeOpen * 0.22;
      jawPivot.rotation.x = activeOpen * 0.42;
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Holographic Wireframe Mesh Avatar
 * Renders complete facial contours, landmark node points, and articulates
 * all captured facial expressions in real-time.
 */
export function buildMeshOutlineCharacter(): Character3DController {
  const root = new THREE.Group();

  // Holographic Wireframe Materials
  const neonCyanLine = new THREE.LineBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.85,
  });

  const neonPurpleLine = new THREE.LineBasicMaterial({
    color: 0xa855f7,
    transparent: true,
    opacity: 0.85,
  });

  const neonRoseLine = new THREE.LineBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.9,
  });

  const neonDotMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.95,
  });

  const purpleDotMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.95,
  });

  const roseDotMat = new THREE.MeshBasicMaterial({
    color: 0xfb7185,
    transparent: true,
    opacity: 0.95,
  });

  const holoMeshMat = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
  });

  // 1. Holographic Torso & Collar Wireframe
  const torsoGeo = new THREE.CylinderGeometry(0.85, 1.25, 1.8, 16, 6, true);
  const torsoMesh = new THREE.Mesh(torsoGeo, holoMeshMat);
  torsoMesh.position.set(0, 1.9, 0);
  root.add(torsoMesh);

  // Neck Rings
  const neckRing1 = new THREE.Mesh(new THREE.RingGeometry(0.48, 0.52, 24), neonCyanLine);
  neckRing1.rotation.x = Math.PI / 2;
  neckRing1.position.set(0, 2.75, 0);
  root.add(neckRing1);

  const neckRing2 = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.48, 24), neonPurpleLine);
  neckRing2.rotation.x = Math.PI / 2;
  neckRing2.position.set(0, 2.95, 0);
  root.add(neckRing2);

  // 2. Head Pivot Group
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.25, 0);
  root.add(headPivot);

  // Holographic Cranial Wireframe Dome
  const skullGeo = new THREE.SphereGeometry(0.96, 20, 16);
  skullGeo.scale(1.0, 1.05, 1.0);
  const skullMesh = new THREE.Mesh(skullGeo, holoMeshMat);
  headPivot.add(skullMesh);

  // Floating Orbital Halo Data Ring
  const haloGeo = new THREE.RingGeometry(1.35, 1.38, 48);
  const haloMesh = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
  }));
  haloMesh.rotation.x = 0.35;
  haloMesh.position.set(0, 0.2, 0);
  headPivot.add(haloMesh);

  // Helper to create dynamic line loop from 3D points
  const createLineLoop = (points: THREE.Vector3[], mat: THREE.LineBasicMaterial) => {
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.LineLoop(geo, mat);
    headPivot.add(line);
    return { line, geo, points };
  };

  // 3. Face Oval Outline (Chin, Jawline, Temples, Forehead)
  const faceOvalBasePoints = [
    new THREE.Vector3(0, 0.95, 0.3),     // Forehead top
    new THREE.Vector3(0.45, 0.75, 0.4),
    new THREE.Vector3(0.72, 0.4, 0.5),   // Temples
    new THREE.Vector3(0.82, 0.05, 0.55), // Cheeks
    new THREE.Vector3(0.7, -0.35, 0.6),  // Jaw angle R
    new THREE.Vector3(0.4, -0.7, 0.7),
    new THREE.Vector3(0, -0.92, 0.8),    // Chin
    new THREE.Vector3(-0.4, -0.7, 0.7),
    new THREE.Vector3(-0.7, -0.35, 0.6), // Jaw angle L
    new THREE.Vector3(-0.82, 0.05, 0.55),
    new THREE.Vector3(-0.72, 0.4, 0.5),
    new THREE.Vector3(-0.45, 0.75, 0.4),
  ];
  const faceOval = createLineLoop(faceOvalBasePoints, neonCyanLine);

  // 4. Nose Bridge & Pyramid
  const noseBasePoints = [
    new THREE.Vector3(0, 0.3, 0.85),     // Glabella
    new THREE.Vector3(0, 0.0, 1.05),     // Nose tip
    new THREE.Vector3(0.16, -0.12, 0.95),// Nostril R
    new THREE.Vector3(0, -0.12, 0.98),   // Subnasale
    new THREE.Vector3(-0.16, -0.12, 0.95),// Nostril L
    new THREE.Vector3(0, 0.0, 1.05),     // Back to tip
  ];
  const noseLines = createLineLoop(noseBasePoints, neonCyanLine);

  // 5. Eyebrows (Left & Right)
  const leftBrowPoints = [
    new THREE.Vector3(-0.15, 0.38, 0.88),
    new THREE.Vector3(-0.35, 0.44, 0.85),
    new THREE.Vector3(-0.55, 0.42, 0.78),
    new THREE.Vector3(-0.68, 0.34, 0.68),
  ];
  const rightBrowPoints = [
    new THREE.Vector3(0.15, 0.38, 0.88),
    new THREE.Vector3(0.35, 0.44, 0.85),
    new THREE.Vector3(0.55, 0.42, 0.78),
    new THREE.Vector3(0.68, 0.34, 0.68),
  ];
  const leftBrow = createLineLoop(leftBrowPoints, neonPurpleLine);
  const rightBrow = createLineLoop(rightBrowPoints, neonPurpleLine);

  // 6. Eye Outlines & Irises (Left & Right)
  const leftEyeBasePoints = [
    new THREE.Vector3(-0.2, 0.18, 0.88),  // Inner corner
    new THREE.Vector3(-0.36, 0.26, 0.86), // Top eyelid
    new THREE.Vector3(-0.54, 0.18, 0.82), // Outer corner
    new THREE.Vector3(-0.36, 0.10, 0.86), // Bottom eyelid
  ];
  const rightEyeBasePoints = [
    new THREE.Vector3(0.2, 0.18, 0.88),
    new THREE.Vector3(0.36, 0.26, 0.86),
    new THREE.Vector3(0.54, 0.18, 0.82),
    new THREE.Vector3(0.36, 0.10, 0.86),
  ];
  const leftEye = createLineLoop(leftEyeBasePoints, neonCyanLine);
  const rightEye = createLineLoop(rightEyeBasePoints, neonCyanLine);

  // Cyber Iris Reticles (Glowing concentric rings)
  const irisMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  const leftIrisPivot = new THREE.Group();
  leftIrisPivot.position.set(-0.36, 0.18, 0.88);
  const leftIrisRing = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.08, 16), irisMat);
  const leftPupilDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), neonDotMat);
  leftIrisPivot.add(leftIrisRing);
  leftIrisPivot.add(leftPupilDot);
  headPivot.add(leftIrisPivot);

  const rightIrisPivot = new THREE.Group();
  rightIrisPivot.position.set(0.36, 0.18, 0.88);
  const rightIrisRing = new THREE.Mesh(new THREE.RingGeometry(0.04, 0.08, 16), irisMat);
  const rightPupilDot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), neonDotMat);
  rightIrisPivot.add(rightIrisRing);
  rightIrisPivot.add(rightPupilDot);
  headPivot.add(rightIrisPivot);

  // 7. Outer & Inner Lips Wireframe
  const outerLipBasePoints = [
    new THREE.Vector3(0, -0.25, 0.98),    // Top center
    new THREE.Vector3(0.18, -0.28, 0.95), // Top right
    new THREE.Vector3(0.32, -0.34, 0.88), // Corner R
    new THREE.Vector3(0.18, -0.42, 0.95), // Bottom right
    new THREE.Vector3(0, -0.45, 0.98),    // Bottom center
    new THREE.Vector3(-0.18, -0.42, 0.95),// Bottom left
    new THREE.Vector3(-0.32, -0.34, 0.88),// Corner L
    new THREE.Vector3(-0.18, -0.28, 0.95),// Top left
  ];
  const outerLips = createLineLoop(outerLipBasePoints, neonRoseLine);

  const innerLipBasePoints = [
    new THREE.Vector3(0, -0.30, 0.97),
    new THREE.Vector3(0.15, -0.32, 0.94),
    new THREE.Vector3(0.24, -0.34, 0.91),
    new THREE.Vector3(0.15, -0.38, 0.94),
    new THREE.Vector3(0, -0.40, 0.97),
    new THREE.Vector3(-0.15, -0.38, 0.94),
    new THREE.Vector3(-0.24, -0.34, 0.91),
    new THREE.Vector3(-0.15, -0.32, 0.94),
  ];
  const innerLips = createLineLoop(innerLipBasePoints, neonRoseLine);

  // 8. Constellation of Landmark Vertex Dots (Nodes)
  const landmarkDots: THREE.Mesh[] = [];
  const dotGeo = new THREE.SphereGeometry(0.024, 8, 8);

  const addDot = (pos: THREE.Vector3, mat: THREE.Material) => {
    const dot = new THREE.Mesh(dotGeo, mat);
    dot.position.copy(pos);
    headPivot.add(dot);
    landmarkDots.push(dot);
    return dot;
  };

  const ovalDots = faceOvalBasePoints.map((p) => addDot(p, neonDotMat));
  const browDots = [...leftBrowPoints, ...rightBrowPoints].map((p) => addDot(p, purpleDotMat));
  const noseDots = noseBasePoints.map((p) => addDot(p, neonDotMat));
  const lipDots = outerLipBasePoints.map((p) => addDot(p, roseDotMat));

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = features.roll || 0;

      // Orbital Halo slow spin
      haloMesh.rotation.z += dt * 0.4;

      // Extract real-time facial expressions
      // NOTE: Use STRICTLY the pure lips aperture from tracking, without forcing artificial audio volume opening
      const lipAperture = Math.min(1, Math.max(0, features.jawOpen || 0));
      const vol = Math.max(0, Math.min(1, features.audioVolume || 0));
      const smile = features.mouthSmile || 0;
      const pucker = Math.max(0, Math.min(1, features.mouthPucker || 0));
      const browRaise = Math.min(1, Math.max(0, features.browRaise || 0));
      const browFurrow = Math.min(1, Math.max(0, features.browFurrow || 0));
      const blinkL = Math.min(1, Math.max(0, features.eyeBlinkLeft || 0));
      const blinkR = Math.min(1, Math.max(0, features.eyeBlinkRight || 0));
      const gX = (features.gazeX || 0) * 0.08;
      const gY = (features.gazeY || 0) * 0.06;

      // 1. Update Gaze Pupils / Irises
      leftIrisPivot.position.x = -0.36 + gX;
      leftIrisPivot.position.y = 0.18 + gY;
      rightIrisPivot.position.x = 0.36 + gX;
      rightIrisPivot.position.y = 0.18 + gY;

      // 2. Eyebrows Expression Deformation
      const browShiftY = browRaise * 0.12 - browFurrow * 0.06;

      const lbPos = leftBrow.geo.attributes.position as THREE.BufferAttribute;
      leftBrowPoints.forEach((p, i) => {
        const yOffset = browShiftY + (i === 0 ? -browFurrow * 0.08 : 0);
        lbPos.setXYZ(i, p.x, p.y + yOffset, p.z);
        if (browDots[i]) browDots[i].position.set(p.x, p.y + yOffset, p.z);
      });
      lbPos.needsUpdate = true;

      const rbPos = rightBrow.geo.attributes.position as THREE.BufferAttribute;
      rightBrowPoints.forEach((p, i) => {
        const yOffset = browShiftY + (i === 0 ? -browFurrow * 0.08 : 0);
        rbPos.setXYZ(i, p.x, p.y + yOffset, p.z);
        const dotIdx = leftBrowPoints.length + i;
        if (browDots[dotIdx]) browDots[dotIdx].position.set(p.x, p.y + yOffset, p.z);
      });
      rbPos.needsUpdate = true;

      // 3. Eye Blinking (Upper eyelid curve flattens down)
      const lePos = leftEye.geo.attributes.position as THREE.BufferAttribute;
      leftEyeBasePoints.forEach((p, i) => {
        const y = i === 1 ? p.y - blinkL * 0.14 : p.y;
        lePos.setXYZ(i, p.x, y, p.z);
      });
      lePos.needsUpdate = true;

      const rePos = rightEye.geo.attributes.position as THREE.BufferAttribute;
      rightEyeBasePoints.forEach((p, i) => {
        const y = i === 1 ? p.y - blinkR * 0.14 : p.y;
        rePos.setXYZ(i, p.x, y, p.z);
      });
      rePos.needsUpdate = true;

      // 4. Outer Lips Deformation (Smile, Lip Aperture, Pucker)
      // Modifies ONLY the lips! Upper lip lifts slightly up, lower lip lowers down
      const mouthWidthFactor = 1.0 + smile * 0.20 - pucker * 0.30;
      const lowerLipDrop = lipAperture * 0.22;
      const upperLipRise = lipAperture * 0.06;
      const smileCornerY = smile * 0.08;

      const olPos = outerLips.geo.attributes.position as THREE.BufferAttribute;
      outerLipBasePoints.forEach((p, i) => {
        let x = p.x * mouthWidthFactor;
        let y = p.y;
        // Upper lip points (0: top center, 1: top right, 7: top left)
        if (i === 0 || i === 1 || i === 7) {
          y += upperLipRise;
        }
        // Lower lip points (3: bottom right, 4: bottom center, 5: bottom left)
        else if (i === 3 || i === 4 || i === 5) {
          y -= lowerLipDrop;
        }
        // Corners (2: right, 6: left)
        if (i === 2 || i === 6) {
          y += smileCornerY;
        }
        olPos.setXYZ(i, x, y, p.z);
        if (lipDots[i]) lipDots[i].position.set(x, y, p.z);
      });
      olPos.needsUpdate = true;

      // 5. Inner Lips Opening Deformation (Only inner lips)
      const ilPos = innerLips.geo.attributes.position as THREE.BufferAttribute;
      innerLipBasePoints.forEach((p, i) => {
        let x = p.x * mouthWidthFactor;
        let y = p.y;
        if (i === 0 || i === 1 || i === 7) {
          y += upperLipRise * 0.8;
        } else if (i === 3 || i === 4 || i === 5) {
          y -= lowerLipDrop * 0.85;
        }
        if (i === 2 || i === 6) {
          y += smileCornerY * 0.7;
        }
        ilPos.setXYZ(i, x, y, p.z);
      });
      ilPos.needsUpdate = true;

      // 6. Face Oval / Chin remains completely solid & stable
      // (Does NOT deform or pull down chin wireframe; chin stays intact!)

      // 7. Pulse glow on audio speech
      if (vol > 0.05) {
        neonRoseLine.opacity = 0.9 + Math.min(0.3, vol * 0.5);
        neonDotMat.opacity = 0.85 + Math.min(0.15, vol * 0.3);
      } else {
        neonRoseLine.opacity = 0.85;
        neonDotMat.opacity = 0.95;
      }
    },
    dispose: () => {},
  };
}

/**
 * Builds a 3D Point Cloud character from Zaghetto PCD data
 */
export function buildPCDCharacter(baseGeometry: THREE.BufferGeometry): Character3DController {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // Clone geometry so multiple participant instances don't fight over vertex deformations
  const geometry = baseGeometry.clone();
  geometry.center();
  geometry.rotateX(Math.PI);

  const count = geometry.attributes.position.count;
  const origPositions = new Float32Array(geometry.attributes.position.array);
  const currentPositions = geometry.attributes.position.array as Float32Array;

  // Vertex Colors: Cyberpunk Hologram gradient (Cyan -> Electric Blue -> Violet)
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = origPositions[i * 3 + 1];
    const t = Math.min(Math.max((y + 0.21) / 0.42, 0), 1);
    colors[i * 3] = 0.05 + 0.65 * t;        // Red (0.05 -> 0.70)
    colors[i * 3 + 1] = 0.90 * (1 - t * 0.45); // Green (0.90 -> 0.495)
    colors[i * 3 + 2] = 0.98;               // Blue (0.98 -> 0.98)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.0055,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const pointsMesh = new THREE.Points(geometry, material);
  pointsMesh.scale.set(5.6, 5.6, 5.6);

  // Head Pivot Group centered around (0, 3.75, 0)
  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.75, 0);
  headPivot.add(pointsMesh);
  root.add(headPivot);

  // Circular laser scan ring on the base
  const scanRingGeo = new THREE.RingGeometry(1.6, 1.66, 64);
  const scanRingMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const scanRing = new THREE.Mesh(scanRingGeo, scanRingMat);
  scanRing.rotation.x = Math.PI / 2;
  scanRing.position.set(0, 1.2, 0);
  root.add(scanRing);

  // Horizontal laser scan ring that sweeps vertically across the face
  const laserGeo = new THREE.RingGeometry(0.7, 0.74, 48);
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
  });
  const laserMesh = new THREE.Mesh(laserGeo, laserMat);
  laserMesh.rotation.x = Math.PI / 2;
  headPivot.add(laserMesh);

  // Subtle interior cyber eye point lights
  const leftEyeLight = new THREE.PointLight(0x00f0ff, 1.5, 2.0);
  leftEyeLight.position.set(-0.35, 0.2, 0.4);
  headPivot.add(leftEyeLight);

  const rightEyeLight = new THREE.PointLight(0x00f0ff, 1.5, 2.0);
  rightEyeLight.position.set(0.35, 0.2, 0.4);
  headPivot.add(rightEyeLight);

  let scanAngle = 0;

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1. Head Pose Tracking
      headPivot.rotation.y = THREE.MathUtils.lerp(headPivot.rotation.y, features.yaw * 0.9, dt * 14);
      headPivot.rotation.x = THREE.MathUtils.lerp(headPivot.rotation.x, -features.pitch * 0.85, dt * 14);
      headPivot.rotation.z = THREE.MathUtils.lerp(headPivot.rotation.z, -features.roll * 0.75, dt * 14);

      // 2. Jaw & Mouth deformation on point cloud points
      const openAmount = Math.max(features.jawOpen, features.audioVolume * 1.6);
      if (openAmount > 0.04) {
        for (let i = 0; i < count; i++) {
          const origX = origPositions[i * 3];
          const origY = origPositions[i * 3 + 1];
          const origZ = origPositions[i * 3 + 2];

          // Target jaw/chin lower region
          if (origY < -0.06 && Math.abs(origX) < 0.14 && origZ > -0.05) {
            const factor = Math.min((-origY - 0.06) / 0.12, 1);
            currentPositions[i * 3 + 1] = origY - openAmount * 0.026 * factor;
          }
        }
        geometry.attributes.position.needsUpdate = true;
      } else {
        // Smoothly restore
        for (let i = 0; i < count; i++) {
          const origY = origPositions[i * 3 + 1];
          if (currentPositions[i * 3 + 1] !== origY) {
            currentPositions[i * 3 + 1] = THREE.MathUtils.lerp(
              currentPositions[i * 3 + 1],
              origY,
              dt * 20
            );
          }
        }
        geometry.attributes.position.needsUpdate = true;
      }

      // 3. Audio reactivity: particle size & subtle pulse
      material.size = THREE.MathUtils.lerp(
        material.size,
        0.0055 + features.audioVolume * 0.0035,
        dt * 15
      );

      // 4. Scanner animation
      scanAngle += dt * 1.8;
      laserMesh.position.y = Math.sin(scanAngle) * 0.9;
      scanRing.rotation.z += dt * 0.5;
    },
    playEmote: (name: string) => {
      material.size = 0.01;
      setTimeout(() => {
        material.size = 0.0055;
      }, 400);
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      scanRingGeo.dispose();
      scanRingMat.dispose();
      laserGeo.dispose();
      laserMat.dispose();
    },
  };
}

/**
 * Builds a 3D FaceCap character with 52 ARKit morph targets
 */
export function buildFaceCapCharacter(gltf: GLTF): Character3DController {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  const model = SkeletonUtils.clone(gltf.scene) as THREE.Group;

  // Scale and center the head properly for our scene
  const bbox = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  const size = new THREE.Vector3();
  bbox.getSize(size);

  const targetHeight = 2.2;
  const scale = targetHeight / (size.y || 1);
  model.scale.set(scale, scale, scale);

  // Position relative to headPivot
  model.position.x = -center.x * scale;
  model.position.y = -center.y * scale;
  model.position.z = -center.z * scale;

  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 3.75, 0);
  headPivot.add(model);
  root.add(headPivot);

  // Locate mesh with morphTargetDictionary
  let morphMesh: THREE.Mesh | null = null;
  model.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh && m.morphTargetDictionary && m.morphTargetInfluences) {
      morphMesh = m;
    }
  });

  // Base circular pedestal
  const pedGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 32);
  const pedMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.8,
  });
  const ped = new THREE.Mesh(pedGeo, pedMat);
  ped.position.set(0, 0.2, 0);
  root.add(ped);

  const ringGeo = new THREE.RingGeometry(1.45, 1.52, 48);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.65,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.41, 0);
  root.add(ring);

  const setMorph = (targetName: string, val: number) => {
    if (!morphMesh || !morphMesh.morphTargetDictionary || !morphMesh.morphTargetInfluences) return;
    const dict = morphMesh.morphTargetDictionary;
    const idx =
      dict[targetName] ??
      dict[`blendShape1.${targetName}`] ??
      dict[`head.${targetName}`] ??
      dict[`mesh.${targetName}`] ??
      dict[targetName.replace('_L', 'Left').replace('_R', 'Right')] ??
      dict[targetName.replace('Left', '_L').replace('Right', '_R')];
    if (idx !== undefined) {
      morphMesh.morphTargetInfluences[idx] = Math.max(0, Math.min(1, val));
    }
  };

  return {
    group: root,
    headPivot,
    update: (features: FaceFeatures, dt: number, now: number) => {
      // 1:1 Faithful Head Rotation
      headPivot.rotation.y = features.yaw || 0;
      headPivot.rotation.x = features.pitch || 0;
      headPivot.rotation.z = features.roll || 0;

      if (!morphMesh || !morphMesh.morphTargetInfluences) return;

      const bs = features.blendshapes || {};

      // 2. Eyes Blinking, Squint & Wide
      setMorph('eyeBlink_L', bs['eyeBlinkLeft'] ?? features.eyeBlinkLeft);
      setMorph('eyeBlink_R', bs['eyeBlinkRight'] ?? features.eyeBlinkRight);
      setMorph('eyeWide_L', bs['eyeWideLeft'] ?? features.eyeWideLeft ?? 0);
      setMorph('eyeWide_R', bs['eyeWideRight'] ?? features.eyeWideRight ?? 0);
      setMorph('eyeSquint_L', bs['eyeSquintLeft'] ?? 0);
      setMorph('eyeSquint_R', bs['eyeSquintRight'] ?? 0);

      // Eye Gaze
      setMorph('eyeLookIn_L', bs['eyeLookInLeft'] ?? (features.gazeX > 0 ? features.gazeX : 0));
      setMorph('eyeLookOut_L', bs['eyeLookOutLeft'] ?? (features.gazeX < 0 ? -features.gazeX : 0));
      setMorph('eyeLookIn_R', bs['eyeLookInRight'] ?? (features.gazeX < 0 ? -features.gazeX : 0));
      setMorph('eyeLookOut_R', bs['eyeLookOutRight'] ?? (features.gazeX > 0 ? features.gazeX : 0));
      setMorph('eyeLookUp_L', bs['eyeLookUpLeft'] ?? (features.gazeY < 0 ? -features.gazeY : 0));
      setMorph('eyeLookUp_R', bs['eyeLookUpRight'] ?? (features.gazeY < 0 ? -features.gazeY : 0));
      setMorph('eyeLookDown_L', bs['eyeLookDownLeft'] ?? (features.gazeY > 0 ? features.gazeY : 0));
      setMorph('eyeLookDown_R', bs['eyeLookDownRight'] ?? (features.gazeY > 0 ? features.gazeY : 0));

      // 3. Eyebrows (Inner Up, Outer Up, Furrow Down)
      setMorph('browInnerUp', bs['browInnerUp'] ?? features.browRaise ?? 0);
      setMorph('browOuterUp_L', bs['browOuterUpLeft'] ?? (features.browRaise || 0) * 0.75);
      setMorph('browOuterUp_R', bs['browOuterUpRight'] ?? (features.browRaise || 0) * 0.75);
      setMorph('browDown_L', bs['browDownLeft'] ?? features.browFurrow ?? 0);
      setMorph('browDown_R', bs['browDownRight'] ?? features.browFurrow ?? 0);

      // 4. Cheeks & Nose (Puff, Squint, Sneer)
      setMorph('cheekPuff', bs['cheekPuff'] ?? 0);
      setMorph('cheekSquint_L', bs['cheekSquintLeft'] ?? 0);
      setMorph('cheekSquint_R', bs['cheekSquintRight'] ?? 0);
      setMorph('noseSneer_L', bs['noseSneerLeft'] ?? 0);
      setMorph('noseSneer_R', bs['noseSneerRight'] ?? 0);

      // 5. Jaw & Mouth (Pure Biometric Lips & Jaw - 100% Noise Immune)
      setMorph('jawOpen', features.jawOpen);
      setMorph('jawForward', bs['jawForward'] ?? 0);
      setMorph('jawLeft', bs['jawLeft'] ?? 0);
      setMorph('jawRight', bs['jawRight'] ?? 0);

      // Smiles, Frowns & Dimples
      const smileL = features.mouthSmileLeft ?? bs['mouthSmileLeft'] ?? (features.mouthSmile > 0 ? features.mouthSmile : 0);
      const smileR = features.mouthSmileRight ?? bs['mouthSmileRight'] ?? (features.mouthSmile > 0 ? features.mouthSmile : 0);
      setMorph('mouthSmile_L', smileL);
      setMorph('mouthSmile_R', smileR);

      setMorph('mouthFrown_L', bs['mouthFrownLeft'] ?? (features.mouthSmile < 0 ? -features.mouthSmile : 0));
      setMorph('mouthFrown_R', bs['mouthFrownRight'] ?? (features.mouthSmile < 0 ? -features.mouthSmile : 0));
      setMorph('mouthDimple_L', bs['mouthDimpleLeft'] ?? 0);
      setMorph('mouthDimple_R', bs['mouthDimpleRight'] ?? 0);
      setMorph('mouthStretch_L', bs['mouthStretchLeft'] ?? 0);
      setMorph('mouthStretch_R', bs['mouthStretchRight'] ?? 0);

      // Pucker, Funnel, Roll & Shrug
      setMorph('mouthPucker', bs['mouthPucker'] ?? features.mouthPucker ?? 0);
      setMorph('mouthFunnel', bs['mouthFunnel'] ?? 0);
      setMorph('mouthLeft', bs['mouthLeft'] ?? 0);
      setMorph('mouthRight', bs['mouthRight'] ?? 0);
      setMorph('mouthRollLower', bs['mouthRollLower'] ?? 0);
      setMorph('mouthRollUpper', bs['mouthRollUpper'] ?? 0);
      setMorph('mouthShrugLower', bs['mouthShrugLower'] ?? 0);
      setMorph('mouthShrugUpper', bs['mouthShrugUpper'] ?? 0);
      setMorph('mouthPress_L', bs['mouthPressLeft'] ?? 0);
      setMorph('mouthPress_R', bs['mouthPressRight'] ?? 0);
      setMorph('mouthLowerDown_L', bs['mouthLowerDownLeft'] ?? 0);
      setMorph('mouthLowerDown_R', bs['mouthLowerDownRight'] ?? 0);
      setMorph('mouthUpperUp_L', bs['mouthUpperUpLeft'] ?? 0);
      setMorph('mouthUpperUp_R', bs['mouthUpperUpRight'] ?? 0);
      setMorph('mouthClose', bs['mouthClose'] ?? 0);

      // Slowly rotate base ring
      ring.rotation.z += dt * 0.35;
    },
    playEmote: (name: string) => {
      if (name === 'ThumbsUp' || name === 'Yes') {
        setMorph('mouthSmile_L', 1);
        setMorph('mouthSmile_R', 1);
        setTimeout(() => {
          setMorph('mouthSmile_L', 0);
          setMorph('mouthSmile_R', 0);
        }, 1500);
      }
    },
    dispose: () => {
      pedGeo.dispose();
      pedMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
