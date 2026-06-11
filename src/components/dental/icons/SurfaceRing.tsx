import React from 'react';

export type SurfaceType = 'occlusal' | 'vestibular' | 'oral' | 'mesial' | 'distal';

interface SurfaceRingProps {
  surfaces?: SurfaceType[];
  filledColor?: string;
  emptyColor?: string;
  strokeColor?: string;
  className?: string;
}

// Helper to generate SVG path for a wedge
function describeWedge(x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const startOuter = polarToCartesian(x, y, outerRadius, endAngle);
  const endOuter = polarToCartesian(x, y, outerRadius, startAngle);
  const startInner = polarToCartesian(x, y, innerRadius, endAngle);
  const endInner = polarToCartesian(x, y, innerRadius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", startOuter.x, startOuter.y,
    "A", outerRadius, outerRadius, 0, largeArcFlag, 0, endOuter.x, endOuter.y,
    "L", endInner.x, endInner.y,
    "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
    "Z"
  ].join(" ");
}

export const SurfaceRing: React.FC<SurfaceRingProps> = ({
  surfaces = [],
  filledColor = '#EF4444', // red for caries
  emptyColor = 'white',
  strokeColor = '#9CA3AF', // gray-400
  className = ''
}) => {
  const cx = 12;
  const cy = 12;
  const rInner = 4.5;
  const rOuter = 11.5;

  const hasSurface = (s: SurfaceType) => surfaces.includes(s);

  return (
    <svg viewBox="0 0 24 24" className={`w-full h-full ${className}`} stroke={strokeColor} strokeWidth="1">
      {/* Top wedge (Vestibular) */}
      <path 
        d={describeWedge(cx, cy, rInner, rOuter, -45, 45)} 
        fill={hasSurface('vestibular') ? filledColor : emptyColor} 
      />
      {/* Right wedge (Distal or Mesial depending on tooth, standard is just 4 sides) */}
      <path 
        d={describeWedge(cx, cy, rInner, rOuter, 45, 135)} 
        fill={hasSurface('distal') ? filledColor : emptyColor} 
      />
      {/* Bottom wedge (Oral) */}
      <path 
        d={describeWedge(cx, cy, rInner, rOuter, 135, 225)} 
        fill={hasSurface('oral') ? filledColor : emptyColor} 
      />
      {/* Left wedge (Mesial) */}
      <path 
        d={describeWedge(cx, cy, rInner, rOuter, 225, 315)} 
        fill={hasSurface('mesial') ? filledColor : emptyColor} 
      />
      {/* Center circle (Occlusal) */}
      <circle 
        cx={cx} cy={cy} r={rInner} 
        fill={hasSurface('occlusal') ? filledColor : emptyColor} 
      />
    </svg>
  );
};
