/**
 * Head Geometry Generator
 * Generates back of head using face contour extrusion
 */

export interface HeadGenerationResult {
  vertices: number[];
  colors: number[];
  backTriangulation: number[];
  vertexCount: number;
}

export class HeadGeometryGenerator {
  generateCompleteHead(
    faceLandmarks: Array<{ x: number; y: number; z: number }>,
    centerX: number,
    centerY: number,
    centerZ: number,
    scaleX: number,
    scaleY: number,
    scaleZ: number
  ): HeadGenerationResult {
    const vertices: number[] = [];
    const colors: number[] = [];

    // Face vertices (0-467) with POSITIVE Z
    faceLandmarks.forEach((landmark) => {
      const x = ((landmark.x - centerX) / scaleX) * 2;
      const y = -((landmark.y - centerY) / scaleY) * 2;
      const z = ((landmark.z - centerZ) / scaleZ) * 2; // POSITIVE

      vertices.push(x, y, z);
      colors.push(1, 1, 1); // White for texture
    });

    // Face contour indices for head outline
    const contourIndices = [
      10, // Forehead top
      109, // Left temple
      67, // Left cheek
      103, // Left jaw
      104, // Left chin
      152, // Chin center
      365, // Right chin
      389, // Right jaw
      297, // Right cheek
      338, // Right temple
      10, // Close loop
    ];

    const skinColor = { r: 0.92, g: 0.82, b: 0.72 };

    // Generate back vertices
    const backData = this.generateBackVertices(
      faceLandmarks,
      contourIndices,
      skinColor,
      centerX,
      centerY,
      centerZ,
      scaleX,
      scaleY,
      scaleZ
    );

    backData.vertices.forEach((v) => {
      vertices.push(v.x, v.y, v.z);
      colors.push(v.r, v.g, v.b);
    });

    const backTriangulation = this.generateBackTriangulation(
      468,
      contourIndices.length - 1,
      backData.layers
    );

    return {
      vertices,
      colors,
      backTriangulation,
      vertexCount: vertices.length / 3,
    };
  }

  generateBackVertices(
    faceLandmarks: Array<{ x: number; y: number; z: number }>,
    contourIndices: number[],
    skinColor: { r: number; g: number; b: number },
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number
  ): { vertices: Array<{ x: number; y: number; z: number; r: number; g: number; b: number }>; layers: number } {
    const vertices: Array<{ x: number; y: number; z: number; r: number; g: number; b: number }> = [];
    const numLayers = 8;
    const pointsPerLayer = contourIndices.length - 1;

    const layerConfigs = [];
    for (let i = 0; i < numLayers; i++) {
      const t = (i + 1) / numLayers;
      const zOffset = -0.2 - t * 1.6;
      const curve = Math.cos(t * Math.PI * 0.4);

      layerConfigs.push({
        zOffset: zOffset,
        scale: curve,
        yShift: i * 0.05,
      });
    }

    for (let layer = 0; layer < numLayers; layer++) {
      const config = layerConfigs[layer];

      for (let i = 0; i < pointsPerLayer; i++) {
        const contourIdx = contourIndices[i];
        const landmark = faceLandmarks[contourIdx] || { x: cx, y: cy, z: cz };

        let x = ((landmark.x - cx) / sx) * 2;
        let y = -((landmark.y - cy) / sy) * 2;

        x *= config.scale;

        const isTop = i === 0 || i === pointsPerLayer - 1;
        const isBottom = i === 4 || i === 5 || i === 6;

        if (isTop) {
          y += config.yShift;
        } else if (isBottom) {
          y += layer * 0.1;
        }

        const z = config.zOffset;

        vertices.push({
          x,
          y,
          z,
          r: skinColor.r,
          g: skinColor.g,
          b: skinColor.b,
        });
      }
    }

    // Occiput apex
    vertices.push({
      x: 0,
      y: 0.3,
      z: -2.0,
      r: skinColor.r,
      g: skinColor.g,
      b: skinColor.b,
    });

    return { vertices, layers: numLayers };
  }

  generateBackTriangulation(startIdx: number, pointsPerLayer: number, numLayers: number): number[] {
    const indices: number[] = [];

    const faceContourIndices = [10, 109, 67, 103, 104, 152, 365, 389, 297, 338];

    for (let i = 0; i < pointsPerLayer; i++) {
      const f1 = faceContourIndices[i];
      const f2 = faceContourIndices[(i + 1) % pointsPerLayer];
      const b1 = startIdx + i;
      const b2 = startIdx + ((i + 1) % pointsPerLayer);

      indices.push(f1, f2, b1);
      indices.push(f2, b2, b1);
    }

    for (let layer = 0; layer < numLayers - 1; layer++) {
      const layer1Start = startIdx + layer * pointsPerLayer;
      const layer2Start = startIdx + (layer + 1) * pointsPerLayer;

      for (let i = 0; i < pointsPerLayer; i++) {
        const p1 = layer1Start + i;
        const p2 = layer1Start + ((i + 1) % pointsPerLayer);
        const p3 = layer2Start + i;
        const p4 = layer2Start + ((i + 1) % pointsPerLayer);

        indices.push(p1, p2, p3);
        indices.push(p2, p4, p3);
      }
    }

    const lastLayerStart = startIdx + (numLayers - 1) * pointsPerLayer;
    const apexIdx = startIdx + numLayers * pointsPerLayer;

    for (let i = 0; i < pointsPerLayer; i++) {
      const p1 = lastLayerStart + i;
      const p2 = lastLayerStart + ((i + 1) % pointsPerLayer);

      indices.push(p1, p2, apexIdx);
    }

    return indices;
  }
}
