import * as THREE from 'three';
import { FACEMESH_TESSELATION } from './face-mesh-triangulation';

export const MORPH_TARGET_NAMES = [
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'jawOpen',
  'jawForward',
  'jawLeft',
  'jawRight',
  'mouthClose',
  'mouthFunnel',
  'mouthPucker',
  'mouthLeft',
  'mouthRight',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
] as const;

export class FaceMeshGenerator {
  public baseVertices: Float32Array | null = null;
  public geometry: THREE.BufferGeometry | null = null;
  public material: THREE.MeshStandardMaterial | null = null;
  public mesh: THREE.Mesh | null = null;
  public skinColor: { r: number; g: number; b: number } = { r: 0.85, g: 0.75, b: 0.65 };

  generateWithMorphTargets(
    landmarks: Array<{ x: number; y: number; z: number }>,
    blendshapes: Record<string, number>,
    transformMatrix: any,
    textureCanvas: HTMLCanvasElement
  ): THREE.Mesh {
    this.geometry = new THREE.BufferGeometry();

    // Sample skin color
    this.skinColor = this.sampleSkinColorFromTexture(textureCanvas);

    // Calculate bounds for geometry AND UV mapping
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;
    let minZ = Infinity,
      maxZ = -Infinity;

    landmarks.forEach((landmark) => {
      minX = Math.min(minX, landmark.x);
      maxX = Math.max(maxX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxY = Math.max(maxY, landmark.y);
      minZ = Math.min(minZ, landmark.z);
      maxZ = Math.max(maxZ, landmark.z);
    });

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const scaleX = maxX - minX || 1;
    const scaleY = maxY - minY || 1;
    const correctedScaleX = scaleX * 1.05;
    const scaleZ = Math.max(scaleX, scaleY) * 1.5;

    // Calculate texture crop bounds
    const padding = 0.2;
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const cropSize = Math.max(faceWidth, faceHeight) * (1 + padding);
    const textureCenterX = centerX;
    const textureCenterY = centerY;
    const textureMinX = textureCenterX - cropSize / 2;
    const textureMinY = textureCenterY - cropSize / 2;

    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];

    landmarks.forEach((landmark) => {
      const x = ((landmark.x - centerX) / correctedScaleX) * 2;
      const y = -((landmark.y - centerY) / scaleY) * 2;
      const z = -(((landmark.z - centerZ) / scaleZ) * 2);
      vertices.push(x, y, z);

      colors.push(1, 1, 1);

      const u = (landmark.x - textureMinX) / cropSize;
      const v = 1.0 - (landmark.y - textureMinY) / cropSize;
      uvs.push(u, v);
    });

    this.baseVertices = Float32Array.from(vertices);

    this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const indices: number[] = [];
    for (let i = 0; i < FACEMESH_TESSELATION.length; i += 3) {
      indices.push(
        FACEMESH_TESSELATION[i],
        FACEMESH_TESSELATION[i + 1],
        FACEMESH_TESSELATION[i + 2]
      );
    }

    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();

    // Morph targets
    this.createMorphTargets(
      landmarks,
      blendshapes,
      centerX,
      centerY,
      centerZ,
      correctedScaleX,
      scaleY,
      scaleZ
    );

    // Texture
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    // Material
    this.material = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.5,
      metalness: 0.0,
      emissive: new THREE.Color(0x222222),
      emissiveIntensity: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      alphaTest: 0.1,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.mesh.userData.faceWidth = 2.0;
    this.mesh.userData.faceHeight = 2.0;
    this.mesh.userData.aspectRatio = (maxX - minX) / (maxY - minY);
    this.mesh.userData.skinColor = this.skinColor;

    // Apply blendshapes
    Object.entries(blendshapes).forEach(([_, value], index) => {
      if (this.mesh?.morphTargetInfluences && index < this.mesh.morphTargetInfluences.length) {
        this.mesh.morphTargetInfluences[index] = value;
      }
    });

    if (transformMatrix) {
      this.applyTransformMatrix(transformMatrix);
    }

    return this.mesh;
  }

  sampleSkinColorFromTexture(textureCanvas: HTMLCanvasElement): { r: number; g: number; b: number } {
    const ctx = textureCanvas.getContext('2d');
    if (!ctx) return { r: 0.85, g: 0.75, b: 0.65 };

    const width = textureCanvas.width;
    const height = textureCanvas.height;

    const points = [
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.25) },
      { x: Math.floor(width * 0.3), y: Math.floor(height * 0.55) },
      { x: Math.floor(width * 0.7), y: Math.floor(height * 0.55) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.85) },
      { x: Math.floor(width * 0.5), y: Math.floor(height * 0.45) },
    ];

    const sampleSize = 8;
    let totalR = 0,
      totalG = 0,
      totalB = 0,
      validSamples = 0;

    points.forEach((p) => {
      try {
        const imageData = ctx.getImageData(p.x, p.y, sampleSize, sampleSize);
        const data = imageData.data;

        let r = 0,
          g = 0,
          b = 0,
          count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (brightness > 60 && brightness < 240) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
        }

        if (count > 0) {
          totalR += r / count;
          totalG += g / count;
          totalB += b / count;
          validSamples++;
        }
      } catch (_) {}
    });

    if (validSamples === 0) return { r: 0.85, g: 0.75, b: 0.65 };

    return {
      r: totalR / validSamples / 255,
      g: totalG / validSamples / 255,
      b: totalB / validSamples / 255,
    };
  }

  createMorphTargets(
    landmarks: Array<{ x: number; y: number; z: number }>,
    _blendshapes: Record<string, number>,
    centerX: number,
    centerY: number,
    centerZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
  ): void {
    if (!this.geometry) return;

    const morphTargets: Array<{ name: string; vertices: Float32Array }> = [];
    const morphTargetNames: string[] = [];

    MORPH_TARGET_NAMES.forEach((blendshapeName) => {
      const morphPositions = this.calculateMorphTarget(
        landmarks,
        blendshapeName,
        centerX,
        centerY,
        centerZ,
        scaleX,
        scaleY,
        scaleZ
      );

      morphTargets.push({ name: blendshapeName, vertices: morphPositions });
      morphTargetNames.push(blendshapeName);
    });

    morphTargets.forEach((target, index) => {
      if (!this.geometry) return;
      this.geometry.morphAttributes.position = this.geometry.morphAttributes.position || [];
      this.geometry.morphAttributes.position[index] = new THREE.Float32BufferAttribute(
        target.vertices,
        3
      );
    });

    this.geometry.morphTargetsRelative = false;
    this.geometry.userData.targetNames = morphTargetNames;
  }

  calculateMorphTarget(
    landmarks: Array<{ x: number; y: number; z: number }>,
    blendshapeName: string,
    centerX: number,
    centerY: number,
    centerZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
  ): Float32Array {
    const vertices: number[] = [];
    const multiplier = 0.1;

    landmarks.forEach((landmark, index) => {
      let x = ((landmark.x - centerX) / scaleX) * 2;
      let y = -((landmark.y - centerY) / scaleY) * 2;
      let z = -(((landmark.z - centerZ) / scaleZ) * 2);

      switch (blendshapeName) {
        case 'jawOpen':
          if (y < 0) y -= multiplier * 0.5;
          break;
        case 'eyeBlinkLeft':
          if (index >= 33 && index <= 133) y -= multiplier * 0.2;
          break;
        case 'eyeBlinkRight':
          if (index >= 362 && index <= 398) y -= multiplier * 0.2;
          break;
        case 'mouthSmileLeft':
          if (index === 61 || (index >= 76 && index <= 91)) {
            y += multiplier * 0.3;
            x -= multiplier * 0.2;
          }
          break;
        case 'mouthSmileRight':
          if (index === 291 || (index >= 306 && index <= 321)) {
            y += multiplier * 0.3;
            x += multiplier * 0.2;
          }
          break;
        case 'browInnerUp':
          if (index === 107 || index === 336 || index === 68 || index === 298) {
            y += multiplier * 0.3;
          }
          break;
      }

      vertices.push(x, y, z);
    });

    return Float32Array.from(vertices);
  }

  applyTransformMatrix(matrix: any): void {
    if (!this.mesh || !matrix) return;

    if (matrix.data && Array.isArray(matrix.data)) {
      const m = new THREE.Matrix4();
      m.set(
        matrix.data[0], matrix.data[1], matrix.data[2], matrix.data[3],
        matrix.data[4], matrix.data[5], matrix.data[6], matrix.data[7],
        matrix.data[8], matrix.data[9], matrix.data[10], matrix.data[11],
        matrix.data[12], matrix.data[13], matrix.data[14], matrix.data[15]
      );
      this.mesh.applyMatrix4(m);
    }
  }

  dispose(): void {
    if (this.geometry) this.geometry.dispose();
    if (this.material) {
      if (this.material.map) this.material.map.dispose();
      this.material.dispose();
    }
  }
}
