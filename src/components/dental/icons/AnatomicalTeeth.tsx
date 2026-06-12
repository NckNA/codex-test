import { useId } from 'react';

interface ToothSvgProps {
  fillColor?: string;
  strokeColor?: string;
  className?: string;
  toothNumber: number;
  isSelected?: boolean;
  condition?: string;
}

interface ToothProfile {
  root: string;
  crown: string;
  neckLine: string;
  rootDetails: string[];
  crownDetails: string[];
}

const CENTRAL_INCISOR: ToothProfile = {
  root: 'M21 5 Q24 1 27 5 C31 14 33 31 34 48 Q24 44 14 48 C15 31 17 14 21 5 Z',
  crown: 'M14 48 Q24 44 34 48 L35 78 Q35 87 24 88 Q13 87 13 78 Z',
  neckLine: 'M14 48 Q24 44 34 48',
  rootDetails: ['M24 9 C23 21 23 34 24 44'],
  crownDetails: ['M17 80 Q24 84 31 80', 'M18 55 C17 64 17 72 19 77', 'M30 55 C31 64 31 72 29 77'],
};

const LATERAL_INCISOR: ToothProfile = {
  root: 'M22 5 Q24 2 26 5 C30 15 31 32 32 49 Q24 45 16 49 C17 32 18 15 22 5 Z',
  crown: 'M16 49 Q24 45 32 49 L33 77 Q32 85 24 87 Q16 85 15 77 Z',
  neckLine: 'M16 49 Q24 45 32 49',
  rootDetails: ['M24 10 C23 23 23 36 24 45'],
  crownDetails: ['M19 79 Q24 82 29 79', 'M20 55 C19 65 19 72 20 76'],
};

const CANINE: ToothProfile = {
  root: 'M21 4 Q24 0 27 4 C32 14 34 33 34 49 Q24 44 14 49 C14 33 16 14 21 4 Z',
  crown: 'M14 49 Q24 44 34 49 L36 69 Q32 80 24 88 Q16 80 12 69 Z',
  neckLine: 'M14 49 Q24 44 34 49',
  rootDetails: ['M24 8 C23 22 23 36 24 45'],
  crownDetails: ['M17 70 L24 83 L31 70', 'M24 54 L24 80'],
};

const UPPER_FIRST_PREMOLAR: ToothProfile = {
  root: 'M14 49 C12 36 10 17 13 7 C14 3 17 3 19 8 C21 17 22 28 24 34 C26 27 28 15 31 7 C33 3 36 4 37 9 C39 22 37 38 35 49 Q24 44 14 49 Z',
  crown: 'M13 49 Q24 44 35 49 C38 62 36 79 29 84 Q24 88 19 84 C12 79 10 62 13 49 Z',
  neckLine: 'M13 49 Q24 44 35 49',
  rootDetails: ['M15 9 C17 22 19 34 21 45', 'M33 9 C31 22 29 34 27 45'],
  crownDetails: ['M16 69 Q24 61 32 69', 'M18 74 Q24 80 30 74'],
};

const LOWER_FIRST_PREMOLAR: ToothProfile = {
  root: 'M21 5 Q24 1 27 5 C31 15 32 32 33 49 Q24 45 15 49 C16 32 17 15 21 5 Z',
  crown: 'M15 49 Q24 45 33 49 C37 62 34 79 28 84 Q24 88 20 84 C14 79 11 62 15 49 Z',
  neckLine: 'M15 49 Q24 45 33 49',
  rootDetails: ['M24 10 C23 23 23 36 24 45'],
  crownDetails: ['M17 70 Q24 61 31 70', 'M20 75 Q24 79 28 75'],
};

const SECOND_PREMOLAR: ToothProfile = {
  root: 'M21 5 Q24 1 27 5 C32 15 33 32 34 49 Q24 44 14 49 C15 32 16 15 21 5 Z',
  crown: 'M14 49 Q24 44 34 49 C38 63 36 79 29 84 Q24 87 19 84 C12 79 10 63 14 49 Z',
  neckLine: 'M14 49 Q24 44 34 49',
  rootDetails: ['M19 10 C20 23 21 35 22 45', 'M29 10 C28 23 27 35 26 45'],
  crownDetails: ['M16 69 Q24 62 32 69', 'M18 74 Q24 80 30 74', 'M24 64 L24 78'],
};

const UPPER_FIRST_MOLAR: ToothProfile = {
  root: 'M9 49 C8 38 6 22 8 10 C9 5 12 4 14 9 C17 18 18 29 20 35 C21 25 21 13 23 6 C24 2 27 3 28 8 C29 18 29 28 29 35 C32 27 34 15 37 8 C39 4 42 6 42 11 C43 25 40 39 38 49 Q24 43 9 49 Z',
  crown: 'M10 49 Q24 43 38 49 C42 61 40 78 33 84 Q29 89 24 85 Q19 89 15 84 C8 78 6 61 10 49 Z',
  neckLine: 'M10 49 Q24 43 38 49',
  rootDetails: ['M12 11 C12 23 15 36 19 45', 'M25 8 C25 22 25 34 24 43', 'M39 11 C37 24 34 37 29 45'],
  crownDetails: ['M13 69 Q18 61 24 68 Q30 60 35 69', 'M14 76 Q19 84 24 78 Q29 84 34 76', 'M24 67 L24 79'],
};

const LOWER_FIRST_MOLAR: ToothProfile = {
  root: 'M10 49 C9 38 6 20 9 8 C10 4 14 4 16 9 C19 19 21 30 24 36 C27 29 30 16 34 8 C36 4 40 5 40 10 C42 24 40 39 38 49 Q24 43 10 49 Z',
  crown: 'M10 49 Q24 43 38 49 C42 61 41 78 34 84 Q29 89 24 85 Q19 89 14 84 C7 78 6 61 10 49 Z',
  neckLine: 'M10 49 Q24 43 38 49',
  rootDetails: ['M12 10 C13 23 17 36 21 45', 'M37 10 C35 23 31 37 27 45'],
  crownDetails: ['M13 69 Q18 61 24 68 Q30 60 35 69', 'M14 76 Q19 84 24 78 Q29 84 34 76', 'M18 65 L18 80', 'M30 65 L30 80'],
};

const UPPER_SECOND_MOLAR: ToothProfile = {
  root: 'M10 49 C9 37 7 22 10 10 C11 6 14 5 16 9 C19 18 20 29 22 34 C23 24 23 13 24 7 C25 4 27 4 28 8 C30 18 30 28 30 34 C32 27 34 16 37 9 C39 5 41 7 41 11 C42 25 40 38 37 49 Q24 44 10 49 Z',
  crown: 'M11 49 Q24 44 37 49 C40 62 39 78 32 84 Q28 88 24 85 Q20 88 16 84 C9 78 8 62 11 49 Z',
  neckLine: 'M11 49 Q24 44 37 49',
  rootDetails: ['M13 12 C14 25 17 37 20 45', 'M26 9 C25 23 25 35 24 43', 'M38 12 C36 25 33 37 28 45'],
  crownDetails: ['M14 69 Q19 62 24 68 Q29 62 34 69', 'M16 77 Q20 82 24 78 Q28 82 32 77'],
};

const LOWER_SECOND_MOLAR: ToothProfile = {
  root: 'M11 49 C10 37 8 21 11 9 C12 5 15 5 17 9 C20 19 22 29 24 35 C27 28 29 17 33 9 C35 5 39 6 39 11 C41 25 39 38 37 49 Q24 44 11 49 Z',
  crown: 'M11 49 Q24 44 37 49 C41 62 39 78 32 84 Q28 88 24 85 Q20 88 16 84 C9 78 7 62 11 49 Z',
  neckLine: 'M11 49 Q24 44 37 49',
  rootDetails: ['M14 11 C15 24 18 37 21 45', 'M36 11 C34 24 31 37 27 45'],
  crownDetails: ['M14 69 Q19 62 24 68 Q29 62 34 69', 'M16 77 Q20 82 24 78 Q28 82 32 77', 'M24 65 L24 80'],
};

const THIRD_MOLAR: ToothProfile = {
  root: 'M12 49 C11 36 9 21 12 10 C13 6 16 5 19 9 C22 16 23 25 24 32 C26 24 29 14 33 9 C36 5 39 7 39 12 C40 26 38 39 36 49 Q24 45 12 49 Z',
  crown: 'M12 49 Q24 45 36 49 C40 63 37 78 31 83 Q27 88 23 85 Q18 88 14 83 C8 77 8 62 12 49 Z',
  neckLine: 'M12 49 Q24 45 36 49',
  rootDetails: ['M16 12 C18 25 20 37 22 45', 'M32 12 C30 25 28 37 26 45'],
  crownDetails: ['M14 69 Q20 61 24 69 Q29 62 34 69', 'M16 77 Q20 83 24 78 Q28 83 32 77'],
};

const getToothProfile = (toothNumber: number): ToothProfile => {
  const position = toothNumber % 10;
  const quadrant = Math.floor(toothNumber / 10);
  const isUpper = [1, 2, 5, 6].includes(quadrant);
  const isPrimary = quadrant >= 5;

  switch (position) {
    case 1: return CENTRAL_INCISOR;
    case 2: return LATERAL_INCISOR;
    case 3: return CANINE;
    case 4:
      if (isPrimary) return isUpper ? UPPER_FIRST_MOLAR : LOWER_FIRST_MOLAR;
      return isUpper ? UPPER_FIRST_PREMOLAR : LOWER_FIRST_PREMOLAR;
    case 5:
      if (isPrimary) return isUpper ? UPPER_SECOND_MOLAR : LOWER_SECOND_MOLAR;
      return SECOND_PREMOLAR;
    case 6: return isUpper ? UPPER_FIRST_MOLAR : LOWER_FIRST_MOLAR;
    case 7: return isUpper ? UPPER_SECOND_MOLAR : LOWER_SECOND_MOLAR;
    case 8: return THIRD_MOLAR;
    default: return CENTRAL_INCISOR;
  }
};

const getConditionAccent = (condition?: string) => {
  switch (condition) {
    case 'caries': return { color: '#F97316', kind: 'side' as const };
    case 'filled': return { color: '#0EA5E9', kind: 'center' as const };
    case 'needs_treatment': return { color: '#F59E0B', kind: 'ridge' as const };
    case 'pulpitis': return { color: '#EF4444', kind: 'center' as const };
    case 'periodontitis': return { color: '#F43F5E', kind: 'neck' as const };
    default: return null;
  }
};

export function AnatomicalTooth({
  fillColor = 'white',
  strokeColor = '#526575',
  className = '',
  toothNumber,
  isSelected = false,
  condition,
}: ToothSvgProps) {
  const profile = getToothProfile(toothNumber);
  const quadrant = Math.floor(toothNumber / 10);
  const isMirrored = [1, 4, 5, 8].includes(quadrant);
  const isPrimary = quadrant >= 5;
  const accent = getConditionAccent(condition);
  const clipId = `tooth-crown-${useId().replace(/:/g, '')}`;
  const rootFill = fillColor === '#ffffff' ? '#F1F5F9' : fillColor;
  const profileTransform = [
    isMirrored ? 'translate(48 0) scale(-1 1)' : '',
    isPrimary ? 'translate(2.5 5) scale(0.9 0.94)' : '',
  ].filter(Boolean).join(' ');

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 92"
      preserveAspectRatio="xMidYMid meet"
      className={`h-full w-full overflow-visible transition-all ${className} ${isSelected ? 'drop-shadow-[0_0_5px_rgba(59,130,246,0.55)]' : ''}`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={profile.crown} transform={profileTransform || undefined} />
        </clipPath>
      </defs>

      <g transform={profileTransform || undefined}>
        <path
          d={profile.root}
          fill={rootFill}
          stroke={strokeColor}
          strokeWidth="1.55"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={profile.crown}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={profile.neckLine}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.15"
          strokeLinecap="round"
          opacity="0.72"
          vectorEffect="non-scaling-stroke"
        />
        {profile.rootDetails.map((line, index) => (
          <path
            key={`root-${toothNumber}-${index}`}
            d={line}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.95"
            strokeLinecap="round"
            opacity="0.52"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {profile.crownDetails.map((line, index) => (
          <path
            key={`crown-${toothNumber}-${index}`}
            d={line}
            fill="none"
            stroke={strokeColor}
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.68"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>

      {accent && (
        <g clipPath={`url(#${clipId})`}>
          {accent.kind === 'side' && (
            <path d="M31 51 C38 57 38 70 31 80 C26 75 25 61 31 51 Z" fill={accent.color} opacity="0.92" />
          )}
          {accent.kind === 'center' && (
            <path d="M17 61 Q24 55 31 61 L29 76 Q24 82 19 76 Z" fill={accent.color} opacity="0.94" />
          )}
          {accent.kind === 'ridge' && (
            <path d="M11 53 Q24 45 37 53 L35 59 Q24 52 13 59 Z" fill={accent.color} opacity="0.9" />
          )}
          {accent.kind === 'neck' && (
            <path d="M9 47 Q24 40 39 47 L38 56 Q24 49 10 56 Z" fill={accent.color} opacity="0.7" />
          )}
        </g>
      )}

      <path
        d="M15 54 C14 63 15 72 18 78"
        transform={profileTransform || undefined}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.35"
        strokeLinecap="round"
        opacity="0.68"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
