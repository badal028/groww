import React from 'react';
import { useTheme } from '@/hooks/useTheme';

interface GrowwLogoProps {
  size?: number;
  className?: string;
}

const GrowwLogo: React.FC<GrowwLogoProps> = ({ size = 32, className = '' }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
      <circle cx="20" cy="20" r="20" fill="#5367FF" />
      <path
        d="M5 25C10 25 15 18 20 20C25 22 30 15 35 15L35 30C35 33 33 35 30 35L10 35C7 35 5 33 5 30Z"
        fill="#00D09C"
      />
    </svg>
  );
};

export default GrowwLogo;
