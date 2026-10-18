import React from 'react';
import { AvatarId, FaceFeatures, DynamicTrackingMode } from '../../types';
import { ThreeAvatarCanvas } from './ThreeAvatarCanvas';

interface AvatarCanvasProps {
  avatarId: AvatarId;
  userId?: string;
  features: FaceFeatures;
  userName?: string;
  isSpeaking?: boolean;
  className?: string;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
  trackingMode?: DynamicTrackingMode;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  avatarId,
  userId,
  features,
  userName,
  isSpeaking = false,
  className = '',
  cameraOffsetX = 0,
  cameraOffsetY = 0,
  trackingMode,
}) => {
  return (
    <ThreeAvatarCanvas
      avatarId={avatarId}
      userId={userId}
      features={features}
      userName={userName}
      isSpeaking={isSpeaking}
      className={className}
      cameraOffsetX={cameraOffsetX}
      cameraOffsetY={cameraOffsetY}
      trackingMode={trackingMode}
    />
  );
};
