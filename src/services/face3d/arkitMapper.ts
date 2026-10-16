/**
 * ARKit Blendshape Mapper
 * Maps MediaPipe Face Landmarker blendshapes to ARKit blendshape naming convention
 */

export const ARKIT_BLENDSHAPE_NAMES = [
  'browDownLeft',
  'browDownRight',
  'browInnerUp',
  'browOuterUpLeft',
  'browOuterUpRight',
  'cheekPuff',
  'cheekSquintLeft',
  'cheekSquintRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeSquintLeft',
  'eyeSquintRight',
  'eyeWideLeft',
  'eyeWideRight',
  'jawForward',
  'jawLeft',
  'jawOpen',
  'jawRight',
  'mouthClose',
  'mouthDimpleLeft',
  'mouthDimpleRight',
  'mouthFrownLeft',
  'mouthFrownRight',
  'mouthFunnel',
  'mouthLeft',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthPressLeft',
  'mouthPressRight',
  'mouthPucker',
  'mouthRight',
  'mouthRollLower',
  'mouthRollUpper',
  'mouthShrugLower',
  'mouthShrugUpper',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthStretchLeft',
  'mouthStretchRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'noseSneerLeft',
  'noseSneerRight',
  'tongueOut',
] as const;

export type ARKitBlendshapeName = (typeof ARKIT_BLENDSHAPE_NAMES)[number];

export class ARKitBlendshapeMapper {
  private mediaPipeToARKitMap: Record<string, string>;

  constructor() {
    this.mediaPipeToARKitMap = this.createMapping();
  }

  createMapping(): Record<string, string> {
    return {
      // Eye movements
      eyeBlinkLeft: 'eyeBlinkLeft',
      eyeBlinkRight: 'eyeBlinkRight',
      eyeLookDownLeft: 'eyeLookDownLeft',
      eyeLookDownRight: 'eyeLookDownRight',
      eyeLookInLeft: 'eyeLookInLeft',
      eyeLookInRight: 'eyeLookInRight',
      eyeLookOutLeft: 'eyeLookOutLeft',
      eyeLookOutRight: 'eyeLookOutRight',
      eyeLookUpLeft: 'eyeLookUpLeft',
      eyeLookUpRight: 'eyeLookUpRight',
      eyeSquintLeft: 'eyeSquintLeft',
      eyeSquintRight: 'eyeSquintRight',
      eyeWideLeft: 'eyeWideLeft',
      eyeWideRight: 'eyeWideRight',

      // Eyebrows
      browDownLeft: 'browDownLeft',
      browDownRight: 'browDownRight',
      browInnerUp: 'browInnerUp',
      browOuterUpLeft: 'browOuterUpLeft',
      browOuterUpRight: 'browOuterUpRight',

      // Jaw
      jawForward: 'jawForward',
      jawLeft: 'jawLeft',
      jawRight: 'jawRight',
      jawOpen: 'jawOpen',

      // Mouth
      mouthClose: 'mouthClose',
      mouthFunnel: 'mouthFunnel',
      mouthPucker: 'mouthPucker',
      mouthLeft: 'mouthLeft',
      mouthRight: 'mouthRight',
      mouthSmileLeft: 'mouthSmileLeft',
      mouthSmileRight: 'mouthSmileRight',
      mouthFrownLeft: 'mouthFrownLeft',
      mouthFrownRight: 'mouthFrownRight',
      mouthDimpleLeft: 'mouthDimpleLeft',
      mouthDimpleRight: 'mouthDimpleRight',
      mouthStretchLeft: 'mouthStretchLeft',
      mouthStretchRight: 'mouthStretchRight',
      mouthRollLower: 'mouthRollLower',
      mouthRollUpper: 'mouthRollUpper',
      mouthShrugLower: 'mouthShrugLower',
      mouthShrugUpper: 'mouthShrugUpper',
      mouthPressLeft: 'mouthPressLeft',
      mouthPressRight: 'mouthPressRight',
      mouthLowerDownLeft: 'mouthLowerDownLeft',
      mouthLowerDownRight: 'mouthLowerDownRight',
      mouthUpperUpLeft: 'mouthUpperUpLeft',
      mouthUpperUpRight: 'mouthUpperUpRight',

      // Cheeks
      cheekPuff: 'cheekPuff',
      cheekSquintLeft: 'cheekSquintLeft',
      cheekSquintRight: 'cheekSquintRight',

      // Nose
      noseSneerLeft: 'noseSneerLeft',
      noseSneerRight: 'noseSneerRight',

      // Tongue
      tongueOut: 'tongueOut',
    };
  }

  mapMediaPipeToARKit(
    mediaPipeBlendshapes: Array<{ categoryName: string; score: number }>,
    landmarks?: Array<{ x: number; y: number; z: number }>
  ): Record<string, number> {
    const arkitBlendshapes: Record<string, number> = {};

    // Initialize all ARKit blendshapes with 0
    ARKIT_BLENDSHAPE_NAMES.forEach((name) => {
      arkitBlendshapes[name] = 0;
    });

    // Map MediaPipe blendshapes with non-linear gain & sensitivity curve
    mediaPipeBlendshapes.forEach((blendshape) => {
      const arkitName = this.mediaPipeToARKitMap[blendshape.categoryName];
      if (arkitName) {
        let val = blendshape.score;

        // Dynamic non-linear sensitivity calibration:
        // Raw MediaPipe webcam scores for eyebrows/smiles are naturally low (0.05-0.25).
        // This organic gamma curve maps human movements into rich 60-100% avatar expressions.
        if (arkitName.startsWith('brow')) {
          val = Math.min(1.0, Math.pow(val, 0.65) * 2.1);
        } else if (arkitName.startsWith('eyeBlink')) {
          // Snappy eyelid closure curve — MediaPipe reports eyeBlink > 0 even with fully
          // open eyes (0.05–0.35 baseline). The dead zone of 0.35 ensures only genuine
          // closures produce output; 1.8x gain maps the usable range to 0–1.
          val = val > 0.35 ? Math.min(1.0, (val - 0.35) * 1.8) : 0;
        } else if (arkitName.startsWith('eyeWide')) {
          val = Math.min(1.0, Math.max(val * 1.6, 0.32));
        } else if (arkitName.startsWith('eyeSquint')) {
          val = val > 0.32 ? Math.min(1.0, (val - 0.32) * 1.5) : 0;
        } else if (arkitName.includes('Smile') || arkitName.includes('smile')) {
          val = Math.min(1.0, Math.pow(val, 0.70) * 1.85);
        } else if (arkitName.includes('Pucker') || arkitName.includes('pucker')) {
          val = Math.min(1.0, Math.pow(val, 0.75) * 1.7);
        }

        arkitBlendshapes[arkitName] = val;
      }
    });

    // Calculate additional blendshapes from landmarks if available
    if (landmarks && landmarks.length >= 468) {
      this.enhanceBlendshapesFromLandmarks(arkitBlendshapes, landmarks);
    }

    return arkitBlendshapes;
  }

  enhanceBlendshapesFromLandmarks(
    blendshapes: Record<string, number>,
    landmarks: Array<{ x: number; y: number; z: number }>
  ): Record<string, number> {
    // 1. Calculate jaw open from mouth landmarks
    const upperLip = landmarks[13]; // Upper lip center
    const lowerLip = landmarks[14]; // Lower lip center
    const leftCorner = landmarks[61];
    const rightCorner = landmarks[291];
    const mouthWidth = (leftCorner && rightCorner)
      ? Math.hypot(leftCorner.x - rightCorner.x, leftCorner.y - rightCorner.y)
      : 0.15;

    if (upperLip && lowerLip) {
      const mouthOpenDistance = Math.abs(upperLip.y - lowerLip.y);
      const ratio = mouthOpenDistance / Math.max(0.01, mouthWidth);
      if (ratio > 0.12) {
        const geometricJaw = Math.min(1, Math.max(0, (ratio - 0.10) / 0.32));
        blendshapes.jawOpen = Math.max(blendshapes.jawOpen || 0, geometricJaw);
      }
    }

    // 2. Calculate smile from mouth corners
    if (leftCorner && rightCorner && upperLip) {
      const lipCenterY = (upperLip.y + (lowerLip?.y ?? upperLip.y)) / 2;
      const leftSmileIntensity = ((lipCenterY - leftCorner.y) / mouthWidth) * 4.0;
      const rightSmileIntensity = ((lipCenterY - rightCorner.y) / mouthWidth) * 4.0;

      if (leftSmileIntensity > 0.05) {
        blendshapes.mouthSmileLeft = Math.max(
          blendshapes.mouthSmileLeft || 0,
          Math.min(1.0, leftSmileIntensity)
        );
      }
      if (rightSmileIntensity > 0.05) {
        blendshapes.mouthSmileRight = Math.max(
          blendshapes.mouthSmileRight || 0,
          Math.min(1.0, rightSmileIntensity)
        );
      }
    }

    // 3. Calculate eye blinks from geometric eyelid distance
    const leftUpperLid = landmarks[159];
    const leftLowerLid = landmarks[145];
    const rightUpperLid = landmarks[386];
    const rightLowerLid = landmarks[374];

    if (leftUpperLid && leftLowerLid) {
      const eyeLidDistL = Math.hypot(leftUpperLid.x - leftLowerLid.x, leftUpperLid.y - leftLowerLid.y);
      if (eyeLidDistL < 0.008) {
        // Almost closed lids — threshold lowered to avoid false blink signals
        blendshapes.eyeBlinkLeft = Math.max(blendshapes.eyeBlinkLeft || 0, 0.85);
      }
    }
    if (rightUpperLid && rightLowerLid) {
      const eyeLidDistR = Math.hypot(rightUpperLid.x - rightLowerLid.x, rightUpperLid.y - rightLowerLid.y);
      if (eyeLidDistR < 0.008) {
        blendshapes.eyeBlinkRight = Math.max(blendshapes.eyeBlinkRight || 0, 0.85);
      }
    }

    return blendshapes;
  }
}
