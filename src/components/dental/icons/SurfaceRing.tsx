import React, { useId } from 'react';

export type SurfaceType = 'occlusal' | 'vestibular' | 'oral' | 'mesial' | 'distal';

interface SurfaceRingProps {
  surfaces?: SurfaceType[];
  filledColor?: string;
  emptyColor?: string;
  strokeColor?: string;
  className?: string;
  toothNumber?: number;
}

function describeWedge(
  x: number,
  y: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  const polarToCartesian = (radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
    return {
      x: x + radius * Math.cos(angleInRadians),
      y: y + radius * Math.sin(angleInRadians),
    };
  };

  const startOuter = polarToCartesian(outerRadius, endAngle);
  const endOuter = polarToCartesian(outerRadius, startAngle);
  const startInner = polarToCartesian(innerRadius, endAngle);
  const endInner = polarToCartesian(innerRadius, startAngle);

  return [
    'M', startOuter.x, startOuter.y,
    'A', outerRadius, outerRadius, 0, 0, 0, endOuter.x, endOuter.y,
    'L', endInner.x, endInner.y,
    'A', innerRadius, innerRadius, 0, 0, 1, startInner.x, startInner.y,
    'Z',
  ].join(' ');
}

const getOcclusalProfile = (toothNumber: number) => {
  const position = toothNumber % 10;
  const quadrant = Math.floor(toothNumber / 10);
  const isPrimaryMolar = quadrant >= 5 && position >= 4;

  if (position <= 2) {
    return {
      outline: 'M13 3 Q20 0 27 3 L31 21 Q27 29 20 30 Q13 29 9 21 Z',
      fissures: ['M13 8 Q20 5 27 8', 'M15 23 Q20 26 25 23'],
    };
  }

  if (position === 3) {
    return {
      outline: 'M20 1 L31 12 Q34 20 27 27 L20 31 L13 27 Q6 20 9 12 Z',
      fissures: ['M13 13 Q20 8 27 13', 'M15 24 Q20 27 25 24'],
    };
  }

  if (position <= 5 && !isPrimaryMolar) {
    return {
      outline: 'M20 2 C29 2 35 8 34 17 C34 26 28 30 20 30 C12 30 6 26 6 17 C5 8 11 2 20 2 Z',
      fissures: ['M10 17 Q15 10 20 16 Q25 10 30 17', 'M20 7 L20 25', 'M12 22 Q20 27 28 22'],
    };
  }

  return {
    outline: 'M9 4 Q14 1 20 3 Q26 0 32 4 Q37 9 35 16 Q38 23 32 28 Q26 32 20 29 Q14 32 8 28 Q2 23 5 16 Q3 9 9 4 Z',
    fissures: [
      'M8 14 Q14 8 20 15 Q26 7 33 14',
      'M8 21 Q14 27 20 20 Q26 28 33 21',
      'M20 5 L20 27',
      'M12 10 L15 24',
      'M28 10 L25 24',
    ],
  };
};

export const SurfaceRing: React.FC<SurfaceRingProps> = ({
  surfaces = [],
  filledColor = '#EF4444',
  emptyColor = 'white',
  strokeColor = '#64748B',
  className = '',
  toothNumber = 16,
}) => {
  const profile = getOcclusalProfile(toothNumber);
  const clipId = `surface-${useId().replace(/:/g, '')}`;
  const hasSurface = (surface: SurfaceType) => surfaces.includes(surface);

  return (
    <svg
      viewBox="0 0 40 32"
      className={`h-full w-full overflow-visible ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={profile.outline} />
        </clipPath>
      </defs>

      <path d={profile.outline} fill={emptyColor} />
      <g clipPath={`url(#${clipId})`} stroke={strokeColor} strokeWidth="0.75">
        <path d={describeWedge(20, 16, 5.5, 19, -45, 45)} fill={hasSurface('vestibular') ? filledColor : emptyColor} />
        <path d={describeWedge(20, 16, 5.5, 19, 45, 135)} fill={hasSurface('distal') ? filledColor : emptyColor} />
        <path d={describeWedge(20, 16, 5.5, 19, 135, 225)} fill={hasSurface('oral') ? filledColor : emptyColor} />
        <path d={describeWedge(20, 16, 5.5, 19, 225, 315)} fill={hasSurface('mesial') ? filledColor : emptyColor} />
        <circle cx="20" cy="16" r="5.5" fill={hasSurface('occlusal') ? filledColor : emptyColor} />
      </g>

      <path
        d={profile.outline}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {profile.fissures.map((path, index) => (
        <path
          key={`${toothNumber}-fissure-${index}`}
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.82"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
};
