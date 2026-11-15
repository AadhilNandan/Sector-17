import React from 'react';

export const DebriefOrbitScene: React.FC = () => {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#05070B] select-none">
      {/* Background Starfield and Deep Space Nebula */}
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center opacity-20 mix-blend-screen scale-105"
        style={{ backgroundImage: `url('/assets/images/deep_space.jpg')` }}
      />

      {/* Atmospheric depth gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#05070B] via-[#080D16]/70 to-[#05070B]/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#05070B]/80 via-transparent to-[#05070B]/90" />

      {/* SVG Canvas for Europa Globe, Ascending Craft & Trajectory Return */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Spherical Clip Path for Europa */}
          <clipPath id="europaDebriefClip">
            <circle cx="780" cy="540" r="340" />
          </clipPath>

          {/* Europa Spherical Day/Night Terminator Shadow */}
          <radialGradient id="europaDebriefShadow" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="45%" stopColor="#000000" stopOpacity="0.15" />
            <stop offset="78%" stopColor="#05070B" stopOpacity="0.88" />
            <stop offset="100%" stopColor="#020408" stopOpacity="0.98" />
          </radialGradient>

          {/* Gentle Return Cruise Ion Thruster Plume */}
          <linearGradient id="debriefIonPlume" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#35C6F4" />
            <stop offset="70%" stopColor="#0284c7" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0" />
          </linearGradient>

          {/* Solar Panel Texture */}
          <pattern id="solarGridDebrief" width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill="#0d1e38" stroke="#35C6F4" strokeWidth="0.4" strokeOpacity="0.4" />
          </pattern>
        </defs>

        {/* Ambient starfield */}
        {Array.from({ length: 130 }).map((_, i) => (
          <circle
            key={i}
            cx={(i * 149.3) % 1920}
            cy={(i * 83.1) % 1080}
            r={((i % 4) + 1) * 0.65}
            fill="#ffffff"
            opacity={((i % 5) + 3) / 10}
          />
        ))}

        {/* Departure Orbital Arc (Dashed cyan) */}
        <path
          d="M 520 920 Q 640 820 860 760 T 1320 620"
          stroke="#35C6F4"
          strokeWidth="1.5"
          strokeDasharray="6 8"
          fill="none"
          opacity="0.4"
        />

        {/* ======================================================== */}
        {/* CELESTIAL BODY: EUROPA (High-Res Photographic Globe)     */}
        {/* ======================================================== */}
        <g>
          {/* Subtle atmospheric glow */}
          <circle cx="780" cy="540" r="352" fill="#35C6F4" opacity="0.15" filter="blur(6px)" />
          <circle cx="780" cy="540" r="344" fill="#35C6F4" opacity="0.08" />

          {/* High-res Galileo Europa image with authentic ice lineaments */}
          <image
            href="/assets/images/europa.jpg"
            x="440"
            y="200"
            width="680"
            height="680"
            preserveAspectRatio="xMidYMid slice"
            clipPath="url(#europaDebriefClip)"
          />

          {/* Spherical Day/Night Terminator */}
          <circle
            cx="780"
            cy="540"
            r="340"
            fill="url(#europaDebriefShadow)"
          />

          {/* Subtle atmospheric rim highlight */}
          <circle
            cx="780"
            cy="540"
            r="340"
            fill="none"
            stroke="#35C6F4"
            strokeWidth="1.5"
            strokeOpacity="0.5"
          />
        </g>

        {/* ======================================================== */}
        {/* ASCENDING EXPEDITION CRAFT (Gazing back toward Europa)   */}
        {/* Lower foreground, heading up and away                    */}
        {/* ======================================================== */}
        <g transform="translate(620, 880) rotate(-16) scale(1.25)">
          {/* Gentle sub-light ion thruster plume */}
          <polygon
            points="-70,-14 -220,-24 -220,-4 -70,-8"
            fill="url(#debriefIonPlume)"
          />
          <circle cx="-70" cy="-11" r="10" fill="#35C6F4" opacity="0.8" />
          <ellipse cx="-70" cy="-11" rx="4" ry="7" fill="#ffffff" />

          <polygon
            points="-70,8 -220,4 -220,24 -70,14"
            fill="url(#debriefIonPlume)"
          />
          <circle cx="-70" cy="11" r="10" fill="#35C6F4" opacity="0.8" />
          <ellipse cx="-70" cy="11" rx="4" ry="7" fill="#ffffff" />

          {/* Solar Arrays (Angled) */}
          <polygon
            points="-25,-12 25,-42 90,-52 45,-20"
            fill="url(#solarGridDebrief)"
            stroke="#35C6F4"
            strokeWidth="1"
          />
          <polygon
            points="-25,12 45,20 90,52 25,42"
            fill="url(#solarGridDebrief)"
            stroke="#35C6F4"
            strokeWidth="1"
          />

          {/* Main Spacecraft Hull */}
          <polygon
            points="-75,-20 30,-22 85,0 30,22 -75,20 -70,0"
            fill="#101925"
            stroke="#334155"
            strokeWidth="1.8"
          />

          {/* Thermal Gold Foil Plating */}
          <polygon
            points="-45,-12 0,-14 10,0 0,14 -45,12"
            fill="#D88A18"
            stroke="#F5A623"
            strokeWidth="0.8"
          />

          {/* Navigation Beacons */}
          <circle cx="85" cy="0" r="2.5" fill="#35C6F4" className="animate-ping" />
          <circle cx="25" cy="-42" r="2" fill="#31C48D" />
          <circle cx="25" cy="42" r="2" fill="#EF6464" />
        </g>

        {/* Horizon Ice Ridge Silhouette in Bottom Left Edge */}
        <polygon points="0,1080 340,980 580,1080" fill="#05070B" opacity="0.85" />

        {/* Viewport Telemetry Info */}
        <g opacity="0.6">
          <text
            x="48"
            y="1040"
            fill="#6D7A8D"
            fontFamily="IBM Plex Mono, monospace"
            fontSize="11"
            letterSpacing="2"
          >
            DEPARTURE VECTOR // ESCAPE VELOCITY ACHIEVED · HOMEBOUND TRAJECTORY COMPUTED
          </text>
        </g>
      </svg>
    </div>
  );
};
