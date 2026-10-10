/**
 * Texture Mapper
 * Creates UV-mapped face texture from input image using MediaPipe landmarks
 */

export interface FaceBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class TextureMapper {
  private textureSize: number;

  constructor(size: number = 1024) {
    this.textureSize = size;
  }

  createFaceTexture(
    image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    landmarks: Array<{ x: number; y: number; z: number }>
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.textureSize;
    canvas.height = this.textureSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Get face bounding box from landmarks
    const bounds = this.getFaceBounds(landmarks);

    // Calculate crop region with padding
    const padding = 0.2;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    const cropSize = Math.max(width, height) * (1 + padding);
    const cropX = centerX - cropSize / 2;
    const cropY = centerY - cropSize / 2;

    // Draw cropped and centered face with neutral skin tone background
    ctx.fillStyle = '#f5e6d3';
    ctx.fillRect(0, 0, this.textureSize, this.textureSize);

    const imgWidth = 'naturalWidth' in image ? (image.naturalWidth || image.width) : image.width;
    const imgHeight = 'naturalHeight' in image ? (image.naturalHeight || image.height) : image.height;

    ctx.drawImage(
      image,
      cropX * imgWidth,
      cropY * imgHeight,
      cropSize * imgWidth,
      cropSize * imgHeight,
      0,
      0,
      this.textureSize,
      this.textureSize
    );

    // Apply enhancement
    this.enhanceTexture(ctx);

    return canvas;
  }

  getFaceBounds(landmarks: Array<{ x: number; y: number; z: number }>): FaceBounds {
    let minX = 1,
      minY = 1,
      maxX = 0,
      maxY = 0;

    landmarks.forEach((landmark) => {
      minX = Math.min(minX, landmark.x);
      minY = Math.min(minY, landmark.y);
      maxX = Math.max(maxX, landmark.x);
      maxY = Math.max(maxY, landmark.y);
    });

    return { minX, minY, maxX, maxY };
  }

  enhanceTexture(ctx: CanvasRenderingContext2D): void {
    try {
      const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
      const data = imageData.data;

      // Increase contrast slightly
      const factor = 1.1;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128)); // R
        data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128)); // G
        data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128)); // B
      }

      ctx.putImageData(imageData, 0, 0);
    } catch (_) {
      // Ignore if tainted canvas or context error
    }
  }

  createUVMapping(landmarks: Array<{ x: number; y: number; z: number }>): number[] {
    const uvs: number[] = [];
    const bounds = this.getFaceBounds(landmarks);
    const width = bounds.maxX - bounds.minX || 1;
    const height = bounds.maxY - bounds.minY || 1;

    landmarks.forEach((landmark) => {
      const u = (landmark.x - bounds.minX) / width;
      const v = 1 - (landmark.y - bounds.minY) / height;
      uvs.push(u, v);
    });

    return uvs;
  }
}
