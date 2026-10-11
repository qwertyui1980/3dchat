import * as THREE from 'three';

export type ClothingStyle = 'suit' | 'shirt' | 'crew';

export interface BustOptions {
  style: ClothingStyle;
  suitColor: string;
  shirtColor: string;
  tieColor: string;
  skinColor: { r: number; g: number; b: number };
  widthMultiplier?: number;
  heightMultiplier?: number;
}

export const DEFAULT_BUST_OPTIONS: BustOptions = {
  style: 'suit',
  suitColor: '#172554', // Dark Navy Blue (classic executive suit like Reagan)
  shirtColor: '#f8fafc', // Crisp white shirt
  tieColor: '#991b1b', // Deep Burgundy / Red silk tie
  skinColor: { r: 0.85, g: 0.75, b: 0.65 },
  widthMultiplier: 1.0,
  heightMultiplier: 1.0,
};

export class BustGenerator {
  /**
   * Generates a 3D bust model (neck, collar, shoulders, chest/suit)
   * with a hierarchical bone/pivot structure for realistic natural kinematics.
   */
  generateBust(options: Partial<BustOptions> = {}): THREE.Group {
    const opts: BustOptions = { ...DEFAULT_BUST_OPTIONS, ...options };
    const root = new THREE.Group();
    root.name = 'bustRoot';

    // Materials
    const skinColorHex = new THREE.Color(opts.skinColor.r, opts.skinColor.g, opts.skinColor.b);
    const skinMat = new THREE.MeshStandardMaterial({
      color: skinColorHex,
      roughness: 0.65,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const suitMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(opts.suitColor),
      roughness: 0.85,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(opts.shirtColor),
      roughness: 0.7,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const tieMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(opts.tieColor),
      roughness: 0.45,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    // 1. Torso & Shoulders Base Group (moves with body lean & subtle yaw)
    const torsoGroup = new THREE.Group();
    torsoGroup.name = 'torsoGroup';
    torsoGroup.position.set(0, -1.05, 0);
    root.add(torsoGroup);

    // Shoulders & Upper Chest Body Geometry (Trapezoid / sculpted upper torso)
    // Scale: Human shoulders are approx 2.2x - 2.4x head width
    const chestWidth = 2.4 * (opts.widthMultiplier || 1.0);
    const chestDepth = 1.1;
    const chestHeight = 1.1 * (opts.heightMultiplier || 1.0);

    const chestGeo = new THREE.CylinderGeometry(
      chestWidth * 0.48, // top radius (shoulder slope)
      chestWidth * 0.54, // bottom radius (chest base)
      chestHeight,
      32,
      4
    );
    // Flatten cylinder into elliptical torso shape
    chestGeo.scale(1.0, 1.0, chestDepth / chestWidth);

    const chestMesh = new THREE.Mesh(chestGeo, suitMat);
    chestMesh.name = 'chestMesh';
    chestMesh.position.set(0, -chestHeight * 0.4, -0.05);
    chestMesh.castShadow = true;
    chestMesh.receiveShadow = true;
    torsoGroup.add(chestMesh);

    // Shoulder Caps / Deltoids (natural rounded shoulder slopes)
    const shoulderRadius = 0.36;
    const leftShoulder = new THREE.Mesh(
      new THREE.SphereGeometry(shoulderRadius, 20, 16),
      suitMat
    );
    leftShoulder.scale.set(1.15, 0.75, 1.0);
    leftShoulder.position.set(-chestWidth * 0.46, -0.15, -0.05);
    torsoGroup.add(leftShoulder);

    const rightShoulder = leftShoulder.clone();
    rightShoulder.position.set(chestWidth * 0.46, -0.15, -0.05);
    torsoGroup.add(rightShoulder);

    // 2. Neck Pivot Group (flexes between chest and head)
    const neckPivot = new THREE.Group();
    neckPivot.name = 'neckPivot';
    neckPivot.position.set(0, 0, 0);
    root.add(neckPivot);

    // Neck Column
    const neckTopRadius = 0.34;
    const neckBottomRadius = 0.42;
    const neckHeight = 0.65;
    const neckGeo = new THREE.CylinderGeometry(neckTopRadius, neckBottomRadius, neckHeight, 28);
    neckGeo.scale(0.95, 1.0, 1.05); // slightly oval
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.name = 'neckMesh';
    neckMesh.position.set(0, -neckHeight * 0.45, -0.06);
    neckMesh.castShadow = true;
    neckPivot.add(neckMesh);

    // 3. Clothing Detail Layers (Suit, Shirt, or Crew Neck)
    if (opts.style === 'suit') {
      // White shirt triangle in center of chest
      const shirtInfillGeo = new THREE.ConeGeometry(0.36, 0.75, 4);
      shirtInfillGeo.scale(1.1, 1.0, 0.2);
      const shirtInfill = new THREE.Mesh(shirtInfillGeo, shirtMat);
      shirtInfill.rotation.z = Math.PI;
      shirtInfill.position.set(0, -0.38, 0.42);
      torsoGroup.add(shirtInfill);

      // Shirt Collar (crisp folded white collar around base of neck)
      const collarLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.16, 0.08),
        shirtMat
      );
      collarLeft.position.set(-0.16, -0.18, 0.38);
      collarLeft.rotation.set(0.1, 0.25, -0.22);
      neckPivot.add(collarLeft);

      const collarRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.16, 0.08),
        shirtMat
      );
      collarRight.position.set(0.16, -0.18, 0.38);
      collarRight.rotation.set(0.1, -0.25, 0.22);
      neckPivot.add(collarRight);

      // Red / Patterned Silk Tie
      // Tie knot
      const tieKnot = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.15, 6),
        tieMat
      );
      tieKnot.rotation.z = Math.PI;
      tieKnot.position.set(0, -0.24, 0.46);
      neckPivot.add(tieKnot);

      // Tie body hanging down
      const tieBodyGeo = new THREE.CylinderGeometry(0.07, 0.14, 0.85, 4);
      tieBodyGeo.scale(1.0, 1.0, 0.25);
      const tieBody = new THREE.Mesh(tieBodyGeo, tieMat);
      tieBody.position.set(0, -0.65, 0.48);
      torsoGroup.add(tieBody);

      // Suit Lapels (Solapas del saco en 'V')
      const lapelLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.9, 0.08),
        suitMat
      );
      lapelLeft.position.set(-0.32, -0.42, 0.46);
      lapelLeft.rotation.set(-0.05, 0.15, -0.32);
      torsoGroup.add(lapelLeft);

      const lapelRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.9, 0.08),
        suitMat
      );
      lapelRight.position.set(0.32, -0.42, 0.46);
      lapelRight.rotation.set(-0.05, -0.15, 0.32);
      torsoGroup.add(lapelRight);
    } else if (opts.style === 'shirt') {
      // Casual buttoned shirt (no tie)
      chestMesh.material = shirtMat;
      leftShoulder.material = shirtMat;
      rightShoulder.material = shirtMat;

      // Casual collar flaps
      const collarLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.08),
        shirtMat
      );
      collarLeft.position.set(-0.2, -0.16, 0.36);
      collarLeft.rotation.set(0.12, 0.3, -0.28);
      neckPivot.add(collarLeft);

      const collarRight = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.08),
        shirtMat
      );
      collarRight.position.set(0.2, -0.16, 0.36);
      collarRight.rotation.set(0.12, -0.3, 0.28);
      neckPivot.add(collarRight);

      // Center button placket
      const placket = new THREE.Mesh(
        new THREE.BoxGeometry(0.09, 0.8, 0.04),
        shirtMat
      );
      placket.position.set(0, -0.55, 0.48);
      torsoGroup.add(placket);

      // Small buttons
      for (let i = 0; i < 3; i++) {
        const btn = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
        );
        btn.rotation.x = Math.PI / 2;
        btn.position.set(0, -0.35 - i * 0.22, 0.51);
        torsoGroup.add(btn);
      }
    } else {
      // Crew Neck / Modern T-Shirt
      chestMesh.material = suitMat;
      leftShoulder.material = suitMat;
      rightShoulder.material = suitMat;

      // Rounded collar rim
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.05, 12, 32),
        suitMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(0, -0.16, 0.02);
      neckPivot.add(rim);
    }

    return root;
  }
}

export const bustGeneratorSingleton = new BustGenerator();
