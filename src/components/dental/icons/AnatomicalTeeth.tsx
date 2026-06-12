interface ToothSvgProps {
  fillColor?: string;
  strokeColor?: string;
  className?: string;
  toothNumber: number;
  isSelected?: boolean;
}

type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar';

interface ToothShape {
  root: string;
  crown: string;
  neckLine: string;
  rootLines: string[];
  fissures: string[];
  highlights: string[];
}

const getToothType = (number: number): ToothType => {
  const n = number % 10;
  if (n >= 1 && n <= 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n >= 4 && n <= 5) return 'premolar';
  if (n >= 6 && n <= 8) return 'molar';
  return 'incisor';
};

const TOOTH_SHAPES: Record<ToothType, ToothShape> = {
  incisor: {
    root: 'M 18 2 C 13 2 10 12 10 28 Q 18 26 26 28 C 26 12 23 2 18 2 Z',
    crown: 'M 10 28 Q 18 26 26 28 L 27 58 C 27 61 24 62 18 62 C 12 62 9 61 9 58 Z',
    neckLine: 'M 10 28 Q 18 26 26 28',
    rootLines: [
      'M 18 6 L 18 24'
    ],
    fissures: [
      'M 14 35 L 14 55',
      'M 22 35 L 22 55'
    ],
    highlights: [
      'M 12 32 Q 12 40 14 45'
    ],
  },
  canine: {
    root: 'M 18 2 C 10 5 9 18 9 28 Q 18 26 27 28 C 27 18 26 5 18 2 Z',
    crown: 'M 9 28 Q 18 26 27 28 L 28 48 C 28 52 22 60 18 62 C 14 60 8 52 8 48 Z',
    neckLine: 'M 9 28 Q 18 26 27 28',
    rootLines: [
      'M 18 5 L 18 25'
    ],
    fissures: [
      'M 18 35 L 18 55'
    ],
    highlights: [
      'M 12 32 Q 12 40 13 45'
    ],
  },
  premolar: {
    root: 'M 13 2 C 10 6 9 16 9 28 Q 18 26 27 28 C 27 16 26 6 23 2 C 20 6 18 14 18 14 C 18 14 16 6 13 2 Z',
    crown: 'M 9 28 Q 18 26 27 28 C 29 40 28 58 18 58 C 8 58 7 40 9 28 Z',
    neckLine: 'M 9 28 Q 18 26 27 28',
    rootLines: [
      'M 13 5 L 13 24',
      'M 23 5 L 23 24'
    ],
    fissures: [
      'M 11 43 A 7 4 0 1 0 25 43 A 7 4 0 1 0 11 43',
      'M 14 43 L 22 43',
      'M 16 41 L 16 45',
      'M 20 41 L 20 45'
    ],
    highlights: [
      'M 10 32 Q 10 40 11 45'
    ],
  },
  molar: {
    root: 'M 9 2 C 6 6 5 18 5 28 Q 18 25 31 28 C 31 18 30 6 27 2 C 23 8 20 18 18 18 C 16 18 13 8 9 2 Z',
    crown: 'M 5 28 Q 18 25 31 28 C 33 42 31 60 18 60 C 5 60 3 42 5 28 Z',
    neckLine: 'M 5 28 Q 18 25 31 28',
    rootLines: [
      'M 9 5 L 9 24',
      'M 27 5 L 27 24'
    ],
    fissures: [
      'M 8 44 A 10 5 0 1 0 28 44 A 10 5 0 1 0 8 44',
      'M 12 44 L 24 44',
      'M 18 40 L 18 48',
      'M 15 42 L 15 46',
      'M 21 42 L 21 46'
    ],
    highlights: [
      'M 7 32 Q 7 40 8 45'
    ],
  },
};

export function AnatomicalTooth({
  fillColor = 'white',
  strokeColor = '#4B5563',
  className = '',
  toothNumber,
  isSelected = false,
}: ToothSvgProps) {
  const type = getToothType(toothNumber);
  const shape = TOOTH_SHAPES[type];
  const rootFill = fillColor === '#ffffff' ? '#F8FAFC' : fillColor;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 36 64"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full transition-all ${className} ${isSelected ? 'drop-shadow-[0_0_4px_rgba(59,130,246,0.6)]' : ''}`}
    >
      <path
        d={shape.root}
        fill={rootFill}
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.96"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={shape.crown}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={shape.neckLine}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
        vectorEffect="non-scaling-stroke"
      />
      {shape.rootLines.map((line, index) => (
        <path
          key={`${type}-root-${index}`}
          d={line}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.85"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.25"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {shape.fissures.map((line, index) => (
        <path
          key={`${type}-fissure-${index}`}
          d={line}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.82"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {shape.highlights.map((line, index) => (
        <path
          key={`${type}-highlight-${index}`}
          d={line}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.45"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
