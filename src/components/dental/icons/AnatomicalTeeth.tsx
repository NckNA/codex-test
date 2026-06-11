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
  detailLines: string[];
  highlightLines: string[];
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
    root: 'M12.4 23.8 C10.5 17.6 10.8 8.3 13.5 3.5 C15.1 0.8 16.9 0.8 18.5 3.5 C21.2 8.3 21.5 17.6 19.6 23.8 C17.7 25.4 14.3 25.4 12.4 23.8 Z',
    crown: 'M7.2 22.6 C7.2 18 10.5 15.7 16 15.7 C21.5 15.7 24.8 18 24.8 22.6 L25.8 39.2 C26.4 48.6 22 54 16 54 C10 54 5.6 48.6 6.2 39.2 Z',
    neckLine: 'M8.2 23.4 C11.6 25.4 20.4 25.4 23.8 23.4',
    detailLines: [
      'M11 27 C12.8 28.4 19.2 28.4 21 27',
      'M12.4 34.5 C14 35.4 18 35.4 19.6 34.5',
    ],
    highlightLines: [
      'M11.4 18.8 C9.7 22.6 9.7 31.5 10.5 39.6',
      'M14 17.4 C15.4 16.9 17.6 16.9 19 17.4',
    ],
  },
  canine: {
    root: 'M11.4 24.5 C8.8 16.2 10.2 6.8 14.7 2.2 C15.6 1.3 16.4 1.3 17.3 2.2 C21.8 6.8 23.2 16.2 20.6 24.5 C18.5 26.4 13.5 26.4 11.4 24.5 Z',
    crown: 'M7.3 23.5 C7.2 18.4 10.7 15.8 16 15.8 C21.3 15.8 24.8 18.4 24.7 23.5 L23.7 37.5 C22.8 44.6 18.7 51.4 16 54 C13.3 51.4 9.2 44.6 8.3 37.5 Z',
    neckLine: 'M8.3 24.3 C11.4 26.8 20.6 26.8 23.7 24.3',
    detailLines: [
      'M12 29.5 C14.3 31.2 17.7 31.2 20 29.5',
      'M16 17.2 C15.6 25.4 15.6 41.8 16 51.5',
    ],
    highlightLines: [
      'M11.8 18.7 C10.2 22.7 10.2 31.9 11.2 39.4',
      'M14.1 17.5 C15.4 17 17.4 17 18.7 17.5',
    ],
  },
  premolar: {
    root: 'M8.3 24.4 C7.6 16.4 9.4 6.8 12.7 2.3 C14.9 5.9 15.6 15.5 15.8 24.2 C16.4 15.5 17.2 5.9 19.3 2.3 C22.6 6.8 24.4 16.4 23.7 24.4 C20.6 26.4 11.4 26.4 8.3 24.4 Z',
    crown: 'M5.2 23.6 C5.2 18.4 9.2 15.7 16 15.7 C22.8 15.7 26.8 18.4 26.8 23.6 L26.1 39.2 C25.8 48.7 21.3 54 16 54 C10.7 54 6.2 48.7 5.9 39.2 Z',
    neckLine: 'M6.2 24.5 C10.8 27.2 21.2 27.2 25.8 24.5',
    detailLines: [
      'M10.2 29.2 C13 31.4 19 31.4 21.8 29.2',
      'M16 17.8 C15.4 27 15.4 43.5 16 52.4',
      'M10.7 38 C13.4 39.5 18.6 39.5 21.3 38',
    ],
    highlightLines: [
      'M10.2 18.6 C8.5 23 8.7 32.4 9.8 40',
      'M13.2 17.3 C15 16.8 17 16.8 18.8 17.3',
    ],
  },
  molar: {
    root: 'M5.7 24.5 C5.1 16.9 6.8 7.7 10.2 2.7 C12.4 6.3 12.8 15.5 13 23.7 C13.6 14.7 14.7 5.9 16 2.2 C17.3 5.9 18.4 14.7 19 23.7 C19.2 15.5 19.6 6.3 21.8 2.7 C25.2 7.7 26.9 16.9 26.3 24.5 C22.3 26.8 9.7 26.8 5.7 24.5 Z',
    crown: 'M3.8 23.8 C3.8 18 8.2 15.4 16 15.4 C23.8 15.4 28.2 18 28.2 23.8 L27.5 39 C27.1 49.1 22.2 54.2 16 54.2 C9.8 54.2 4.9 49.1 4.5 39 Z',
    neckLine: 'M5.2 24.7 C10.6 28 21.4 28 26.8 24.7',
    detailLines: [
      'M9.4 30.4 C12.2 33 19.8 33 22.6 30.4',
      'M8.8 39.2 C12.8 41.4 19.2 41.4 23.2 39.2',
      'M16 17.5 C15.1 27.6 15.1 43.8 16 52.8',
      'M10.5 19.2 C12.4 25.4 12.4 36.2 10.8 45.2',
      'M21.5 19.2 C19.6 25.4 19.6 36.2 21.2 45.2',
    ],
    highlightLines: [
      'M9.6 18.4 C7.7 23.1 8 32.7 9.4 40.2',
      'M12.3 17.2 C14.4 16.5 17.6 16.5 19.7 17.2',
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

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 56"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full ${className}`}
    >
      <path
        d={shape.root}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={shape.crown}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={shape.neckLine}
        fill="none"
        stroke={strokeColor}
        strokeWidth="0.95"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
        vectorEffect="non-scaling-stroke"
      />
      {shape.detailLines.map((line, index) => (
        <path
          key={`${type}-detail-${index}`}
          d={line}
          fill="none"
          stroke={strokeColor}
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.24"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {shape.highlightLines.map((line, index) => (
        <path
          key={`${type}-highlight-${index}`}
          d={line}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
