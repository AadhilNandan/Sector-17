import React from 'react';

export interface ExpeditionSealProps {
  type: 'ganymede' | 'callisto' | 'europa';
  size?: number;
  className?: string;
}

export const ExpeditionSeal: React.FC<ExpeditionSealProps> = ({
  type,
  size = 76,
  className = '',
}) => {
  if (type === 'ganymede') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Expedition III Ganymede Seal"
      >
        {/* Outer double border */}
        <circle cx="50" cy="50" r="46" stroke="#34495E" strokeWidth="2.5" strokeDasharray="4 2" />
        <circle cx="50" cy="50" r="41" stroke="#34495E" strokeWidth="1.2" />

        {/* Text path for circular text */}
        <path id="ganymedeTextArc" d="M 18 50 A 32 32 0 1 1 82 50" fill="none" />
        <path id="ganymedeTextArcBottom" d="M 82 50 A 32 32 0 1 1 18 50" fill="none" />

        <text fontSize="6.5" fill="#34495E" fontFamily="monospace" fontWeight="bold" letterSpacing="0.1em">
          <textPath href="#ganymedeTextArc" startOffset="50%" textAnchor="middle">
            FICTIONAL ARCHIVE
          </textPath>
        </text>
        <text fontSize="6" fill="#34495E" fontFamily="monospace" fontWeight="bold" letterSpacing="0.1em">
          <textPath href="#ganymedeTextArcBottom" startOffset="50%" textAnchor="middle">
            MISSION PATCH
          </textPath>
        </text>

        {/* Central Ganymede crescent & orbital trajectory */}
        <circle cx="50" cy="50" r="20" fill="#34495E" fillOpacity="0.15" />
        <path
          d="M 50 32 A 18 18 0 0 0 62 50 A 18 18 0 0 0 50 68 A 18 18 0 1 1 50 32 Z"
          fill="#34495E"
          fillOpacity="0.85"
        />

        {/* Orbital trajectory ellipse */}
        <ellipse
          cx="50"
          cy="50"
          rx="27"
          ry="9"
          stroke="#2C3E50"
          strokeWidth="1.2"
          transform="rotate(-25 50 50)"
        />
        <circle cx="68" cy="42" r="2" fill="#2C3E50" />
      </svg>
    );
  }

  if (type === 'callisto') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`select-none ${className}`}
        aria-label="Expedition IV Callisto Seal"
      >
        {/* Dark bronze seal background ring */}
        <circle cx="50" cy="50" r="46" fill="#2B1D14" stroke="#4A3525" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="41" stroke="#8C6849" strokeWidth="1" strokeDasharray="3 1.5" />

        {/* Circular text */}
        <path id="callistoTopArc" d="M 18 50 A 32 32 0 1 1 82 50" fill="none" />
        <path id="callistoBottomArc" d="M 82 50 A 32 32 0 1 1 18 50" fill="none" />

        <text fontSize="7" fill="#E8DFC8" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.12em">
          <textPath href="#callistoTopArc" startOffset="50%" textAnchor="middle">
            EXPEDITION-IV
          </textPath>
        </text>
        <text fontSize="7" fill="#E8DFC8" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.16em">
          <textPath href="#callistoBottomArc" startOffset="50%" textAnchor="middle">
            CALLISTO
          </textPath>
        </text>

        {/* Callisto Moon center with craters */}
        <circle cx="50" cy="50" r="19" fill="#75563D" />
        <circle cx="44" cy="43" r="3.5" fill="#4A3525" />
        <circle cx="56" cy="47" r="4.5" fill="#4A3525" />
        <circle cx="48" cy="57" r="3" fill="#4A3525" />
        <circle cx="40" cy="52" r="2" fill="#4A3525" />

        {/* Orbit ellipse */}
        <ellipse
          cx="50"
          cy="50"
          rx="25"
          ry="8"
          stroke="#E8DFC8"
          strokeWidth="1.2"
          transform="rotate(30 50 50)"
        />
        <circle cx="68" cy="58" r="2.2" fill="#E8DFC8" />
      </svg>
    );
  }

  // Europa (Expedition-V)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      aria-label="Expedition V Europa Survey Emblem"
    >
      {/* Outer aerospace circular emblem */}
      <circle cx="50" cy="50" r="46" fill="#0D1B2A" stroke="#7FB7D4" strokeWidth="2.8" />
      <circle cx="50" cy="50" r="41" stroke="#3A637B" strokeWidth="1" strokeDasharray="2 2" />

      {/* Circular text */}
      <path id="europaTopArc" d="M 17 50 A 33 33 0 1 1 83 50" fill="none" />
      <path id="europaBottomArc" d="M 83 50 A 33 33 0 1 1 17 50" fill="none" />

      <text fontSize="7.5" fill="#7FB7D4" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.2em">
        <textPath href="#europaTopArc" startOffset="50%" textAnchor="middle">
          EUROPA
        </textPath>
      </text>
      <text fontSize="7.5" fill="#7FB7D4" fontFamily="sans-serif" fontWeight="bold" letterSpacing="0.2em">
        <textPath href="#europaBottomArc" startOffset="50%" textAnchor="middle">
          AETHON
        </textPath>
      </text>

      {/* Central Europa Ice Sphere & fractures */}
      <circle cx="50" cy="50" r="18" fill="#1C3144" stroke="#7FB7D4" strokeWidth="1.2" />
      {/* Europa Chaos ice lines */}
      <line x1="38" y1="42" x2="56" y2="40" stroke="#7FB7D4" strokeWidth="1" opacity="0.8" />
      <line x1="42" y1="52" x2="62" y2="48" stroke="#7FB7D4" strokeWidth="1" opacity="0.8" />
      <line x1="48" y1="36" x2="45" y2="60" stroke="#7FB7D4" strokeWidth="0.8" opacity="0.6" />

      {/* AETHON Spacecraft silhouette overlay */}
      <g transform="translate(50, 50) rotate(-22)">
        {/* Wings */}
        <rect x="-18" y="-1.5" width="36" height="3" rx="0.5" fill="#E6E2D6" />
        {/* Central bus */}
        <rect x="-3" y="-5" width="6" height="10" rx="1" fill="#7FB7D4" />
        {/* Dish */}
        <path d="M -5 -6 Q 0 -9 5 -6 Z" fill="#E6E2D6" />
      </g>
    </svg>
  );
};
