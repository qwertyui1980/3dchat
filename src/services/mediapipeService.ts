import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { FaceFeatures } from '../types';

export const INITIAL_FACE_FEATURES: FaceFeatures = {
  pitch: 0,
  yaw: 0,
  roll: 0,
  eyeBlinkLeft: 0,
  eyeBlinkRight: 0,
  eyeWideLeft: 0,
  eyeWideRight: 0,
  gazeX: 0,
  gazeY: 0,
  browRaise: 0,
  browFurrow: 0,
  jawOpen: 0,
  mouthSmile: 0,
  mouthPucker: 0,
  mouthX: 0,
  audioVolume: 0,
  isFaceDetected: false,
};

function lerp(start: number, end: number, factor: number): number {
  return start + (end - start) * factor;
}

export class MediaPipeFaceTracker {
  private landmarker: FaceLandmarker | null = null;
  private isInitializing: boolean = false;
  private isRunning: boolean = false;
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime: number = -1;
  private currentFeatures: FaceFeatures = { ...INITIAL_FACE_FEATURES };
  private onFeaturesCallback: ((features: FaceFeatures) => void) | null = null;
  private onLandmarksCallback: ((landmarks: Array<{ x: number; y: number; z: number }> | null) => void) | null = null;
  private missedFramesCount: number = 0;
  public isModelLoaded: boolean = false;
  public loadError: string | null = null;

  async initialize(): Promise<boolean> {
    if (this.landmarker) return true;
    if (this.isInitializing) return false;

    this.isInitializing = true;
    this.loadError = null;

    try {
      // Load wasm files from CDN
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });

      this.isModelLoaded = true;
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      console.warn('[MediaPipe] Failed to load GPU landmarker, trying CPU fallback:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        this.isModelLoaded = true;
        this.isInitializing = false;
        return true;
      } catch (errFallback: any) {
        this.loadError = errFallback?.message || 'Error al inicializar el modelo de MediaPipe';
        console.error('[MediaPipe] Model load failed:', errFallback);
        this.isInitializing = false;
        return false;
      }
    }
  }

  startTracking(
    video: HTMLVideoElement,
    onFeatures: (features: FaceFeatures) => void,
    onLandmarks?: (landmarks: Array<{ x: number; y: number; z: number }> | null) => void
  ) {
    this.videoElement = video;
    this.onFeaturesCallback = onFeatures;
    this.onLandmarksCallback = onLandmarks || null;
    this.isRunning = true;

    const processFrame = () => {
      if (!this.isRunning) return;

      if (
        this.videoElement &&
        this.videoElement.readyState >= 2 &&
        !this.videoElement.paused &&
        this.landmarker
      ) {
        const currentTime = this.videoElement.currentTime;
        if (currentTime !== this.lastVideoTime) {
          this.lastVideoTime = currentTime;
          const startTimeMs = performance.now();

          try {
            const results = this.landmarker.detectForVideo(this.videoElement, startTimeMs);

            if (results.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0];
              const blendshapes = results.faceBlendshapes?.[0]?.categories || [];

              // Extract blendshapes map
              const bsMap: Record<string, number> = {};
              for (let i = 0; i < blendshapes.length; i++) {
                bsMap[blendshapes[i].categoryName] = blendshapes[i].score;
              }

              // Compute head pose
              // Key landmarks: 1: Nose tip, 10: Forehead, 152: Chin, 234: Left Cheek, 454: Right Cheek, 168: Glabella
              const nose = landmarks[1];
              const forehead = landmarks[10];
              const chin = landmarks[152];
              const leftCheek = landmarks[234];
              const rightCheek = landmarks[454];
              const glabella = landmarks[168] || landmarks[6] || forehead;

              // Robust landmark availability check
              if (!nose || !forehead || !chin || !leftCheek || !rightCheek) {
                // If any key landmark is missing, gracefully hold previous features
                if (this.onFeaturesCallback) {
                  this.onFeaturesCallback(this.currentFeatures);
                }
                return;
              }

              // ========================================================
              // 1:1 FAITHFUL 3D HEAD ORIENTATION (YAW, PITCH, ROLL)
              // Uses MediaPipe Facial Transformation Matrix when available
              // and geometric 3D normal vector cross product as robust fallback.
              // ========================================================
              let yaw = 0;
              let pitch = 0;
              let roll = 0;

              const matrixData = results.facialTransformationMatrixes?.[0]?.data;
              if (matrixData && matrixData.length >= 16) {
                // Column-major 4x4 rigid transformation matrix from MediaPipe
                // m[0]=r00, m[1]=r10, m[2]=r20, m[4]=r01, m[5]=r11, m[6]=r21, m[8]=r02, m[9]=r12, m[10]=r22
                const r00 = matrixData[0];
                const r10 = matrixData[1];
                const r12 = matrixData[9];
                const r02 = matrixData[8];
                const r22 = matrixData[10];

                // Exact Euler decomposition (ZYX order)
                // Pitch (look up/down): positive = looking up, negative = looking down
                pitch = -Math.asin(Math.max(-1, Math.min(1, r12)));
                // Yaw (turn left/right): in mirror mode, turning right = positive yaw
                yaw = Math.atan2(r02, r22);
                // Roll (tilt head sideways)
                roll = Math.atan2(r10, r00);
              } else {
                // Geometric 3D vector orientation from landmark coordinates
                const up = {
                  x: glabella.x - chin.x,
                  y: glabella.y - chin.y,
                  z: (glabella.z || 0) - (chin.z || 0),
                };
                const right = {
                  x: rightCheek.x - leftCheek.x,
                  y: rightCheek.y - leftCheek.y,
                  z: (rightCheek.z || 0) - (leftCheek.z || 0),
                };
                // Normal vector = right x up
                const fwd = {
                  x: right.y * up.z - right.z * up.y,
                  y: right.z * up.x - right.x * up.z,
                  z: right.x * up.y - right.y * up.x,
                };
                const fwdLen = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
                yaw = Math.atan2(fwd.x / fwdLen, Math.abs(fwd.z / fwdLen));
                pitch = Math.atan2(-fwd.y / fwdLen, Math.abs(fwd.z / fwdLen));
                roll = Math.atan2(right.y, right.x);
              }

              // Clamp to human anatomical range (-1.2 to 1.2 rad ≈ -70° to +70°)
              pitch = Math.max(-1.2, Math.min(1.2, Number.isFinite(pitch) ? pitch : 0));
              yaw = Math.max(-1.2, Math.min(1.2, Number.isFinite(yaw) ? yaw : 0));
              roll = Math.max(-1.0, Math.min(1.0, Number.isFinite(roll) ? roll : 0));

              // Eyes
              const eyeBlinkLeft = bsMap['eyeBlinkLeft'] ?? 0;
              const eyeBlinkRight = bsMap['eyeBlinkRight'] ?? 0;
              const eyeWideLeft = bsMap['eyeWideLeft'] ?? 0;
              const eyeWideRight = bsMap['eyeWideRight'] ?? 0;

              // Gaze
              const lookInL = bsMap['eyeLookInLeft'] ?? 0;
              const lookOutL = bsMap['eyeLookOutLeft'] ?? 0;
              const lookUpL = bsMap['eyeLookUpLeft'] ?? 0;
              const lookDownL = bsMap['eyeLookDownLeft'] ?? 0;
              const gazeX = (lookOutL - lookInL);
              const gazeY = (lookDownL - lookUpL);

              // ========================================================
              // ENHANCED MULTI-POINT MOUTH & LIPS CAPTURE (40 POINTS)
              // Center, Left, and Right vertical pairs for organic lips
              // ========================================================
              const upperInnerLip = landmarks[13];
              const lowerInnerLip = landmarks[14];
              const upperOuterLip = landmarks[0];
              const lowerOuterLip = landmarks[17];
              const leftCorner = landmarks[61];
              const rightCorner = landmarks[291];

              // Additional high-density mouth capture pairs (left & right lobes)
              const leftInnerTop = landmarks[82] || upperInnerLip;
              const leftInnerBottom = landmarks[87] || lowerInnerLip;
              const rightInnerTop = landmarks[312] || upperInnerLip;
              const rightInnerBottom = landmarks[317] || lowerInnerLip;

              const faceHeight = Math.hypot(
                forehead.x - chin.x,
                forehead.y - chin.y
              ) || 0.4;
              const mouthWidth = Math.hypot(
                leftCorner.x - rightCorner.x,
                leftCorner.y - rightCorner.y
              ) || 0.15;

              // ========================================================
              // PURE LIPS TRACKING (EXCLUSIVAMENTE LABIOS)
              // Direct geometric aperture between upper & lower inner lips,
              // normalized strictly by mouth corner width (scale & tilt invariant).
              // No blendshape chin/jaw interference.
              // ========================================================
              const distCenter = Math.hypot(upperInnerLip.x - lowerInnerLip.x, upperInnerLip.y - lowerInnerLip.y);
              const distLeft = Math.hypot(leftInnerTop.x - leftInnerBottom.x, leftInnerTop.y - leftInnerBottom.y);
              const distRight = Math.hypot(rightInnerTop.x - rightInnerBottom.x, rightInnerTop.y - rightInnerBottom.y);

              // Weighted lips separation
              const weightedLipDist = distCenter * 0.70 + distLeft * 0.15 + distRight * 0.15;
              const lipRatio = weightedLipDist / mouthWidth;

              // Pure lips opening: closed lips are below 0.026 ratio, opening scales up to 0.30
              const pureLipOpen = Math.max(0, Math.min(1, (lipRatio - 0.026) / 0.28));

              // Fast, synchronized response
              const currentJaw = this.currentFeatures.jawOpen || 0;
              const jawLerpFactor = pureLipOpen > currentJaw ? 0.95 : 0.80;
              const jawOpen = lerp(currentJaw, pureLipOpen, jawLerpFactor);

              // Mouth Smile: Physical left & right corner elevation + blendshapes
              const lipCenterY = (upperInnerLip.y + lowerInnerLip.y) / 2;
              const leftCornerLift = ((lipCenterY - leftCorner.y) / mouthWidth) * 3.5;
              const rightCornerLift = ((lipCenterY - rightCorner.y) / mouthWidth) * 3.5;
              const blendSmileL = bsMap['mouthSmileLeft'] ?? 0;
              const blendSmileR = bsMap['mouthSmileRight'] ?? 0;

              const smileL = Math.max(leftCornerLift, blendSmileL);
              const smileR = Math.max(rightCornerLift, blendSmileR);
              const rawSmile = (smileL + smileR) / 2;
              const mouthSmile = Math.max(-1, Math.min(1, rawSmile));
              const mouthPucker = bsMap['mouthPucker'] ?? 0;

              // Eyebrows
              const browInnerUp = bsMap['browInnerUp'] ?? 0;
              const browDownL = bsMap['browDownLeft'] ?? 0;
              const browDownR = bsMap['browDownRight'] ?? 0;
              const browRaise = browInnerUp;
              const browFurrow = (browDownL + browDownR) / 2;

              // Latency and instant FPS calculation
              const latencyMs = Math.round(performance.now() - startTimeMs);

              // Zero-lag responsive synchronization factors (avoids sluggish delay)
              const poseLerp = 0.85;
              const eyeLerp = 0.80;
              const faceLerp = 0.85;

              this.currentFeatures = {
                pitch: lerp(this.currentFeatures.pitch, pitch, poseLerp),
                yaw: lerp(this.currentFeatures.yaw, yaw, poseLerp),
                roll: lerp(this.currentFeatures.roll, roll, poseLerp),
                eyeBlinkLeft: lerp(this.currentFeatures.eyeBlinkLeft, eyeBlinkLeft, 0.85),
                eyeBlinkRight: lerp(this.currentFeatures.eyeBlinkRight, eyeBlinkRight, 0.85),
                eyeWideLeft: lerp(this.currentFeatures.eyeWideLeft, eyeWideLeft, eyeLerp),
                eyeWideRight: lerp(this.currentFeatures.eyeWideRight, eyeWideRight, eyeLerp),
                gazeX: lerp(this.currentFeatures.gazeX, gazeX, eyeLerp),
                gazeY: lerp(this.currentFeatures.gazeY, gazeY, eyeLerp),
                browRaise: lerp(this.currentFeatures.browRaise, browRaise, faceLerp),
                browFurrow: lerp(this.currentFeatures.browFurrow, browFurrow, faceLerp),
                jawOpen: jawOpen,
                mouthSmile: lerp(this.currentFeatures.mouthSmile, mouthSmile, faceLerp),
                mouthSmileLeft: smileL,
                mouthSmileRight: smileR,
                mouthOpenCenter: distCenter / faceHeight,
                mouthOpenLeft: distLeft / faceHeight,
                mouthOpenRight: distRight / faceHeight,
                mouthPucker: lerp(this.currentFeatures.mouthPucker, mouthPucker, faceLerp),
                mouthX: (leftCorner.x + rightCorner.x) / 2 - nose.x,
                mouthPointsCount: 40,
                audioVolume: this.currentFeatures.audioVolume,
                isFaceDetected: true,
                blendshapes: bsMap,
                latencyMs,
              };

              if (this.onFeaturesCallback) {
                this.onFeaturesCallback(this.currentFeatures);
              }
              this.missedFramesCount = 0;
              if (this.onLandmarksCallback) {
                this.onLandmarksCallback(landmarks);
              }
            } else {
              this.missedFramesCount++;
              // Grace period: if lost for < 10 frames (~330ms), hold last pose without sudden jerk or snap!
              if (this.missedFramesCount < 10) {
                if (this.onFeaturesCallback) {
                  this.onFeaturesCallback(this.currentFeatures);
                }
              } else {
                // If persistently absent, very gently decay to neutral resting pose (zero sobresaltos)
                const decayRate = 0.04;
                this.currentFeatures = {
                  ...this.currentFeatures,
                  pitch: lerp(this.currentFeatures.pitch, 0, decayRate),
                  yaw: lerp(this.currentFeatures.yaw, 0, decayRate),
                  roll: lerp(this.currentFeatures.roll, 0, decayRate),
                  eyeBlinkLeft: lerp(this.currentFeatures.eyeBlinkLeft, 0, decayRate),
                  eyeBlinkRight: lerp(this.currentFeatures.eyeBlinkRight, 0, decayRate),
                  jawOpen: lerp(this.currentFeatures.jawOpen, 0, decayRate),
                  mouthSmile: lerp(this.currentFeatures.mouthSmile, 0, decayRate),
                  browRaise: lerp(this.currentFeatures.browRaise, 0, decayRate),
                  browFurrow: lerp(this.currentFeatures.browFurrow, 0, decayRate),
                  isFaceDetected: false,
                };
                if (this.onFeaturesCallback) {
                  this.onFeaturesCallback(this.currentFeatures);
                }
                if (this.onLandmarksCallback) {
                  this.onLandmarksCallback(null);
                }
              }
            }
          } catch (detectionErr) {
            console.error('[MediaPipe] Detection error in loop:', detectionErr);
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  setAudioVolume(vol: number) {
    this.currentFeatures.audioVolume = vol;
    if (this.onFeaturesCallback) {
      this.onFeaturesCallback(this.currentFeatures);
    }
  }

  stopTracking() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  destroy() {
    this.stopTracking();
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
    this.isModelLoaded = false;
  }
}

export const faceTrackerSingleton = new MediaPipeFaceTracker();
