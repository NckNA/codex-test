import React from 'react';

interface ToothSvgProps {
  fillColor?: string;
  strokeColor?: string;
  className?: string;
  toothNumber: number;
}

const getToothType = (number: number) => {
  const n = number % 10;
  if (n >= 1 && n <= 2) return 'incisor';
  if (n === 3) return 'canine';
  if (n >= 4 && n <= 5) return 'premolar';
  if (n >= 6 && n <= 8) return 'molar';
  return 'incisor'; // fallback
};

export const AnatomicalTooth: React.FC<ToothSvgProps> = ({ 
  fillColor = 'white', 
  strokeColor = '#4B5563', // gray-600
  className = '',
  toothNumber
}) => {
  const type = getToothType(toothNumber);
  // Default bounds
  const viewBox = "0 0 24 40";
  
  // Upper jaw has roots pointing UP in our base SVG.
  // Lower jaw will be rotated by the parent via CSS.
  
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox={viewBox} 
      className={`w-full h-full ${className}`}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {type === 'incisor' && (
        <path d="M7 16 C7 8 10 2 12 2 C14 2 17 8 17 16 L18 24 C19 32 17 38 15 38 L9 38 C7 38 5 32 6 24 Z" />
      )}
      
      {type === 'canine' && (
        <path d="M6 16 C6 8 10 2 12 2 C14 2 18 8 18 16 L19 23 C20 30 15 38 12 38 C9 38 4 30 5 23 Z" />
      )}

      {type === 'premolar' && (
        <path d="M5 16 C5 8 9 2 11 2 C12 2 13 8 14 16 L14 16 C15 8 16 2 17 2 C19 2 20 8 20 16 L21 24 C22 32 19 38 15 38 C12 38 12 35 12 35 C12 35 12 38 9 38 C5 38 2 32 3 24 Z" />
      )}

      {type === 'molar' && (
        <path d="M3 16 C3 10 6 2 8 2 C9 2 10 6 11 12 C12 6 13 2 15 2 C16 2 17 6 18 12 C19 6 20 2 21 2 C23 2 24 10 24 16 L23 24 C22 34 19 38 16 38 C13 38 14 34 14 34 C14 34 13 38 10 38 C7 38 5 34 4 24 Z" />
      )}
    </svg>
  );
};
