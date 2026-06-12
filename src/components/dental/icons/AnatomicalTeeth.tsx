interface ToothSvgProps {
  fillColor?: string;
  strokeColor?: string;
  className?: string;
  toothNumber: number;
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
    root: 'M14.2 28.8 C11.9 20.3 12.1 8.5 15.4 2.8 C17.2 -0.2 18.8 -0.2 20.6 2.8 C23.9 8.5 24.1 20.3 21.8 28.8 C19.6 31 16.4 31 14.2 28.8 Z',
    crown: 'M8.9 27.4 C8.7 21.4 12.4 18.4 18 18.4 C23.6 18.4 27.3 21.4 27.1 27.4 L27.9 45.2 C28.4 56.1 24.3 62.4 18 62.4 C11.7 62.4 7.6 56.1 8.1 45.2 Z',
    neckLine: 'M9.8 28.4 C13.1 31.1 22.9 31.1 26.2 28.4',
    rootLines: [
      'M18 3.8 C16.7 10.1 16.6 19.7 17.2 28.5',
    ],
    fissures: [
      'M12.6 34.4 C14.8 36 21.2 36 23.4 34.4',
      'M13.4 43.2 C15.1 44.2 20.9 44.2 22.6 43.2',
      'M14.2 52.2 C15.8 53 20.2 53 21.8 52.2',
    ],
    highlights: [
      'M13 20.9 C11.2 26.4 11.1 39.8 12.3 51.8',
      'M15.1 19.7 C16.9 19.1 19.1 19.1 20.9 19.7',
    ],
  },
  canine: {
    root: 'M13.2 29.2 C10.2 18.8 11.8 7.1 16.4 2.1 C17.5 0.8 18.5 0.8 19.6 2.1 C24.2 7.1 25.8 18.8 22.8 29.2 C20.5 31.7 15.5 31.7 13.2 29.2 Z',
    crown: 'M8.9 27.8 C8.6 21.8 12.5 18.5 18 18.5 C23.5 18.5 27.4 21.8 27.1 27.8 L26 43.8 C25.2 52.8 20.8 59.8 18 62.4 C15.2 59.8 10.8 52.8 10 43.8 Z',
    neckLine: 'M10 29 C13.4 32.1 22.6 32.1 26 29',
    rootLines: [
      'M18 3.8 C17 11.9 17 21.6 17.8 29.2',
    ],
    fissures: [
      'M13.1 35.2 C15.6 37 20.4 37 22.9 35.2',
      'M18 19.8 C17.4 31.7 17.4 49.6 18 60.1',
      'M14.1 44.5 C15.8 45.7 20.2 45.7 21.9 44.5',
    ],
    highlights: [
      'M13.2 20.9 C11.4 26.9 11.5 40.2 12.9 51.7',
      'M15.1 19.8 C16.8 19.2 19.2 19.2 20.9 19.8',
    ],
  },
  premolar: {
    root: 'M9.7 29.2 C8.8 18.8 10.9 7.2 14.9 2.4 C17 7.2 17.5 18 17.7 28.7 C18.4 18 19 7.2 21.1 2.4 C25.1 7.2 27.2 18.8 26.3 29.2 C22.8 31.9 13.2 31.9 9.7 29.2 Z',
    crown: 'M6.8 27.8 C6.6 21.6 11.1 18.3 18 18.3 C24.9 18.3 29.4 21.6 29.2 27.8 L28.5 45.1 C28.1 56 23.4 62.5 18 62.5 C12.6 62.5 7.9 56 7.5 45.1 Z',
    neckLine: 'M8 29.2 C12.4 32.8 23.6 32.8 28 29.2',
    rootLines: [
      'M14.9 3.9 C14.3 11.7 14.5 21.8 15.4 29',
      'M21.1 3.9 C21.7 11.7 21.5 21.8 20.6 29',
    ],
    fissures: [
      'M11.8 35.4 C14.8 38.1 21.2 38.1 24.2 35.4',
      'M18 20.6 C17.3 33.6 17.3 50.7 18 60.5',
      'M12.4 46.1 C15.2 48 20.8 48 23.6 46.1',
      'M12 27.4 C14.8 29.1 21.2 29.1 24 27.4',
    ],
    highlights: [
      'M11.7 20.8 C9.7 27.3 10 40.6 11.5 51.9',
      'M14.4 19.8 C16.5 19.1 19.5 19.1 21.6 19.8',
    ],
  },
  molar: {
    root: 'M6.8 29.2 C6.1 19.1 8 8.2 11.7 2.7 C14 7 14.5 18.4 14.8 28.5 C15.6 17.5 16.5 6.6 18 2.2 C19.5 6.6 20.4 17.5 21.2 28.5 C21.5 18.4 22 7 24.3 2.7 C28 8.2 29.9 19.1 29.2 29.2 C25 32.3 11 32.3 6.8 29.2 Z',
    crown: 'M5.1 28 C4.8 21.1 9.7 18 18 18 C26.3 18 31.2 21.1 30.9 28 L30.3 45.1 C29.8 56.5 24.5 62.8 18 62.8 C11.5 62.8 6.2 56.5 5.7 45.1 Z',
    neckLine: 'M6.5 29.4 C11.9 33.4 24.1 33.4 29.5 29.4',
    rootLines: [
      'M11.7 4.1 C10.9 12.1 11.2 21.9 12.2 29',
      'M18 3.8 C17.4 12.5 17.4 22.4 18 29.4',
      'M24.3 4.1 C25.1 12.1 24.8 21.9 23.8 29',
    ],
    fissures: [
      'M10.7 36.3 C14 39.4 22 39.4 25.3 36.3',
      'M9.9 47.2 C14.2 49.8 21.8 49.8 26.1 47.2',
      'M18 20.4 C17 33.9 17 51.3 18 61',
      'M11.2 21.8 C13.4 30.4 13.2 43.4 11.7 55.2',
      'M24.8 21.8 C22.6 30.4 22.8 43.4 24.3 55.2',
      'M9.8 28 C12.8 30.2 23.2 30.2 26.2 28',
    ],
    highlights: [
      'M10.8 20.9 C8.7 27.5 9.1 40.8 10.7 52',
      'M13.8 19.5 C16.3 18.8 19.7 18.8 22.2 19.5',
    ],
  },
};

export function AnatomicalTooth({
  fillColor = 'white',
  strokeColor = '#4B5563',
  className = '',
  toothNumber,
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
      className={`h-full w-full ${className}`}
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
