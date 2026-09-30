import React from 'react';
import { AvatarId, FaceFeatures } from '../../types';
import { ThreeAvatarCanvas } from './ThreeAvatarCanvas';

interface AvatarCanvasProps {
  avatarId: AvatarId;
  features: FaceFeatures;
  userName?: string;
  isSpeaking?: boolean;
  className?: string;
  showLandmarkOverlay?: boolean;
  showEmoteControls?: boolean;
  cameraOffsetX?: number;
  cameraOffsetY?: number;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = ({
  avatarId,
  features,
  userName,
  isSpeaking = false,
  className = '',
  showEmoteControls = true,
  cameraOffsetX = 0,
  cameraOffsetY = 0,
}) => {
  return (
    <ThreeAvatarCanvas
      avatarId={avatarId}
      features={features}
      userName={userName}
      isSpeaking={isSpeaking}
      className={className}
      showEmoteControls={showEmoteControls}
      cameraOffsetX={cameraOffsetX}
      cameraOffsetY={cameraOffsetY}
    />
  );
};
