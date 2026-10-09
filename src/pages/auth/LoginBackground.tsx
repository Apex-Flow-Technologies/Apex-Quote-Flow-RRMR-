import React from 'react';

/**
 * LoginBackground component
 * Authentic industrial aesthetic: "A roofing sheet yard meets a quotation desk."
 * Pure CSS and inline SVG (no external images or dependencies).
 * Features:
 * - Midnight-navy to deep-blue architectural base gradient
 * - Profiled trapezoidal and corrugated roofing sheets with metallic specular highlights
 * - Folded ridge cap / flashing plate in Tata BlueScope / JSW Colouron+ Royal Blue
 * - Hex-head self-drilling roofing fasteners with EPDM washers
 * - Low-opacity architectural dimension lines (1.06 m, 0.50 mm, 12 ft)
 * - Faded quotation desk stationery with "QUOTATION" rubber-stamp
 * - Soft diffuse light sources behind the frosted glass card
 */
export const LoginBackground: React.FC = () => {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
      style={{
        background: 'linear-gradient(135deg, #0A0F1A 0%, #0F172A 35%, #172554 70%, #1E3A8A 100%)',
      }}
    >
      {/* =========================================================================
          LAYER 1: Soft diffuse glow circles behind center card for frosted glass blur
          ========================================================================= */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-[65%] -translate-y-[55%] w-[340px] h-[340px] rounded-full bg-[#2563EB] opacity-25 filter blur-[95px]"
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-[35%] -translate-y-[40%] w-[300px] h-[300px] rounded-full bg-[#FFFFFF] opacity-15 filter blur-[85px]"
      />
      {/* Soft blue glow positioned at bottom-right corner at 28% opacity */}
      <div
        className="absolute top-1/2 left-1/2 translate-x-[15%] sm:translate-x-[20%] translate-y-[16%] sm:translate-y-[22%] w-[260px] sm:w-[280px] h-[260px] sm:h-[280px] rounded-full bg-[#1D4ED8] opacity-[0.28] filter blur-[80px]"
      />
      <div
        className="absolute top-[20%] right-[15%] w-[260px] h-[260px] rounded-full bg-[#60A5FA] opacity-15 filter blur-[90px]"
      />

      {/* =========================================================================
          LAYER 2: SVG Canvas containing Roofing Profiles, Flashing, Screws & Dimensions
          ========================================================================= */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1440 900"
      >
        <defs>
          {/* Gradients for Trapezoidal Sheet Profiles (Royal / Architectural Blue) */}
          <linearGradient id="trapRibCrestBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E40AF" />
            <stop offset="50%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          <linearGradient id="trapRibSlopeShadow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#0B1120" />
          </linearGradient>

          <linearGradient id="trapRibValleyBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#172554" />
            <stop offset="100%" stopColor="#0F1E40" />
          </linearGradient>

          {/* Gradients for Galvanized / Silver Corrugated Sheet */}
          <linearGradient id="galvCrest" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#DCE1E6" />
            <stop offset="40%" stopColor="#F4F6F8" />
            <stop offset="100%" stopColor="#B8C0C8" />
          </linearGradient>

          <linearGradient id="galvTrough" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5A626A" />
            <stop offset="50%" stopColor="#444B52" />
            <stop offset="100%" stopColor="#767E86" />
          </linearGradient>

          {/* Ridge Cap Flashing Gradient */}
          <linearGradient id="ridgeFacetLight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#E2E6EA" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="ridgeFacetBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Fastener Hex Head Metallic Gradient */}
          <radialGradient id="hexMetallic" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#CAD1D8" />
            <stop offset="80%" stopColor="#727B84" />
            <stop offset="100%" stopColor="#40464C" />
          </radialGradient>

          {/* Fastener Blue Coated Hex Head */}
          <radialGradient id="hexBlueCoated" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="60%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#0F172A" />
          </radialGradient>

          {/* Fastener Washer EPDM Ring */}
          <linearGradient id="epdmWasher" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E2328" />
            <stop offset="100%" stopColor="#0D1012" />
          </linearGradient>

          {/* Fastener Flange Washer */}
          <linearGradient id="flangeWasher" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8ECF0" />
            <stop offset="50%" stopColor="#98A2AC" />
            <stop offset="100%" stopColor="#4F565E" />
          </linearGradient>
        </defs>

        {/* -------------------------------------------------------------------
            1. TOP-LEFT: Galvanized Corrugated Metal Sheet Panel (Sinusoidal)
            ------------------------------------------------------------------- */}
        <g transform="translate(-160, -120) rotate(-24, 200, 200)" opacity="0.82">
          {/* Base Sheet Backing */}
          <rect x="0" y="0" width="760" height="420" fill="#2E353C" rx="2" />

          {/* Sinusoidal Wave Ribs (Alternating Peaks and Valleys) */}
          {[0, 48, 96, 144, 192, 240, 288, 336, 384, 432, 480, 528, 576, 624, 672, 720].map((x, i) => (
            <g key={`corrug-${i}`}>
              {/* Crest highlight band */}
              <rect x={x} y="0" width="22" height="420" fill="url(#galvCrest)" />
              {/* Soft specular line */}
              <line x1={x + 11} y1="0" x2={x + 11} y2="420" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.65" />
              {/* Trough shadow band */}
              <rect x={x + 22} y="0" width="26" height="420" fill="url(#galvTrough)" opacity="0.85" />
              {/* Deep flute line */}
              <line x1={x + 35} y1="0" x2={x + 35} y2="420" stroke="#1A1E22" strokeWidth="1" opacity="0.6" />
            </g>
          ))}

          {/* Cut Sheet Edge Border */}
          <line x1="0" y1="420" x2="760" y2="420" stroke="#CAD1D8" strokeWidth="3" opacity="0.9" />
          <line x1="0" y1="422" x2="760" y2="422" stroke="#1E2328" strokeWidth="1.5" />
        </g>

        {/* -------------------------------------------------------------------
            2. BOTTOM-RIGHT: Royal Blue Trapezoidal Profile Sheet Panel (Industrial Crest Ribs)
            ------------------------------------------------------------------- */}
        <g transform="translate(740, 400) rotate(-22, 300, 300)" opacity="0.92">
          {/* Base Sheet Valley */}
          <rect x="-80" y="-40" width="850" height="520" fill="url(#trapRibValleyBlue)" />

          {/* Repeating Trapezoidal Standing Ribs */}
          {[0, 110, 220, 330, 440, 550, 660].map((x, i) => (
            <g key={`trap-${i}`}>
              {/* Left slope highlight */}
              <polygon
                points={`${x},0 ${x + 14},0 ${x + 14},520 ${x},520`}
                fill="#3B82F6"
                opacity="0.75"
              />
              {/* Flat Crest of Rib (Trapezoid Top) */}
              <rect x={x + 14} y="0" width="36" height="520" fill="url(#trapRibCrestBlue)" />
              {/* Center specular highlight on crest */}
              <line x1={x + 32} y1="0" x2={x + 32} y2="520" stroke="#93C5FD" strokeWidth="1" opacity="0.55" />
              {/* Right slope shadow */}
              <polygon
                points={`${x + 50},0 ${x + 64},0 ${x + 64},520 ${x + 50},520`}
                fill="url(#trapRibSlopeShadow)"
              />
              {/* Valley stiffener groove */}
              <line x1={x + 87} y1="0" x2={x + 87} y2="520" stroke="#0B1120" strokeWidth="1.5" opacity="0.7" />
              <line x1={x + 88} y1="0" x2={x + 88} y2="520" stroke="#1D4ED8" strokeWidth="1" opacity="0.4" />
            </g>
          ))}

          {/* Bottom cut factory edge */}
          <line x1="-80" y1="0" x2="770" y2="0" stroke="#60A5FA" strokeWidth="2" opacity="0.8" />
          <line x1="-80" y1="-2" x2="770" y2="-2" stroke="#0F172A" strokeWidth="2" />
        </g>

        {/* -------------------------------------------------------------------
            3. RIDGE CAP / FLASHING: Angled Folded-Plate Roof Ridge (Lower-Left)
            ------------------------------------------------------------------- */}
        <g transform="translate(-40, 620) rotate(16, 200, 100)" opacity="0.88">
          {/* Lower Flange / Drip Edge */}
          <polygon
            points="0,180 540,140 540,165 0,205"
            fill="#0F172A"
          />
          {/* Main South Ridge Facet (Deep Royal Blue) */}
          <polygon
            points="0,180 540,140 540,80 0,118"
            fill="url(#ridgeFacetBlue)"
          />
          {/* Apex Seam Highlight Line */}
          <line x1="0" y1="118" x2="540" y2="80" stroke="#FFFFFF" strokeWidth="3" opacity="0.85" />
          <line x1="0" y1="117" x2="540" y2="79" stroke="#93C5FD" strokeWidth="1.5" />

          {/* Upper North Ridge Facet (Specular Light Face) */}
          <polygon
            points="0,118 540,80 540,20 0,55"
            fill="url(#ridgeFacetLight)"
          />
          {/* Upper turn-down lip */}
          <polygon
            points="0,55 540,20 540,10 0,43"
            fill="#0B1120"
          />
        </g>

        {/* -------------------------------------------------------------------
            4. TOP-RIGHT: Secondary Off-White Pre-Painted Profile Accent
            ------------------------------------------------------------------- */}
        <g transform="translate(1120, -100) rotate(32, 200, 200)" opacity="0.45">
          <rect x="0" y="0" width="460" height="340" fill="#E8ECEF" />
          {[0, 75, 150, 225, 300, 375].map((x, i) => (
            <g key={`white-rib-${i}`}>
              <rect x={x + 10} y="0" width="30" height="340" fill="#FFFFFF" />
              <rect x={x + 40} y="0" width="12" height="340" fill="#BCC5CE" />
            </g>
          ))}
        </g>

        {/* -------------------------------------------------------------------
            5. FASTENERS: Self-Drilling Hex Head Roofing Screws with EPDM Washers
            ------------------------------------------------------------------- */}
        {/* Screw 1 (Lower-Left Ridge Cap fixing) */}
        <g transform="translate(185, 715)">
          <circle cx="0" cy="0" r="14" fill="url(#epdmWasher)" />
          <circle cx="0" cy="0" r="12" fill="url(#flangeWasher)" />
          {/* Hex Head Profile */}
          <polygon
            points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
            fill="url(#hexMetallic)"
          />
          <circle cx="-2" cy="-2" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Screw 2 (Mid ridge cap) */}
        <g transform="translate(320, 680)">
          <circle cx="0" cy="0" r="14" fill="url(#epdmWasher)" />
          <circle cx="0" cy="0" r="12" fill="url(#flangeWasher)" />
          <polygon
            points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
            fill="url(#hexMetallic)"
          />
          <circle cx="-2" cy="-2" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Screw 3 (Lower sheet fixing) */}
        <g transform="translate(450, 645)">
          <circle cx="0" cy="0" r="14" fill="url(#epdmWasher)" />
          <circle cx="0" cy="0" r="12" fill="url(#flangeWasher)" />
          <polygon
            points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
            fill="url(#hexMetallic)"
          />
          <circle cx="-2" cy="-2" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Screw 4 (Blue Coated fastener on blue sheet rib - Bottom Right) */}
        <g transform="translate(1015, 665)">
          <circle cx="0" cy="0" r="13" fill="#0F172A" />
          <circle cx="0" cy="0" r="11" fill="url(#flangeWasher)" />
          <polygon
            points="0,-7.5 6.5,-3.8 6.5,3.8 0,7.5 -6.5,3.8 -6.5,-3.8"
            fill="url(#hexBlueCoated)"
          />
          <circle cx="-1.5" cy="-2" r="1.2" fill="#BFDBFE" opacity="0.85" />
        </g>

        {/* Screw 5 (Blue Coated fastener - Bottom Right) */}
        <g transform="translate(1125, 620)">
          <circle cx="0" cy="0" r="13" fill="#0F172A" />
          <circle cx="0" cy="0" r="11" fill="url(#flangeWasher)" />
          <polygon
            points="0,-7.5 6.5,-3.8 6.5,3.8 0,7.5 -6.5,3.8 -6.5,-3.8"
            fill="url(#hexBlueCoated)"
          />
          <circle cx="-1.5" cy="-2" r="1.2" fill="#BFDBFE" opacity="0.85" />
        </g>

        {/* -------------------------------------------------------------------
            6. DIMENSION LINES: Technical Architectural Annotation Lines (Desktop only)
            ------------------------------------------------------------------- */}
        <g className="hidden md:inline" opacity="0.35">
          {/* Dimension Line 1: Width 1.06 m across silver corrugation */}
          <g transform="translate(190, 80) rotate(-24)">
            <line x1="0" y1="0" x2="180" y2="0" stroke="#60A5FA" strokeWidth="1.2" />
            <line x1="0" y1="-8" x2="0" y2="8" stroke="#60A5FA" strokeWidth="1.2" />
            <line x1="180" y1="-8" x2="180" y2="8" stroke="#60A5FA" strokeWidth="1.2" />
            {/* Arrowhead ticks */}
            <path d="M 0,0 L 8,-3 L 8,3 Z" fill="#60A5FA" />
            <path d="M 180,0 L 172,-3 L 172,3 Z" fill="#60A5FA" />
            <text
              x="90"
              y="-6"
              fill="#FFFFFF"
              fontSize="11"
              fontFamily="sans-serif"
              fontWeight="600"
              textAnchor="middle"
              letterSpacing="0.05em"
            >
              1.06 m COIL WIDTH
            </text>
          </g>

          {/* Dimension Line 2: Thickness 0.50 mm */}
          <g transform="translate(1080, 520) rotate(-22)">
            <line x1="0" y1="0" x2="110" y2="0" stroke="#FFFFFF" strokeWidth="1" />
            <line x1="0" y1="-6" x2="0" y2="6" stroke="#FFFFFF" strokeWidth="1" />
            <line x1="110" y1="-6" x2="110" y2="6" stroke="#FFFFFF" strokeWidth="1" />
            <text
              x="55"
              y="-5"
              fill="#60A5FA"
              fontSize="10"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              t = 0.50 mm
            </text>
          </g>

          {/* Dimension Line 3: Length 12 ft */}
          <g transform="translate(1210, 680) rotate(-22)">
            <line x1="0" y1="0" x2="140" y2="0" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" />
            <text
              x="70"
              y="-5"
              fill="#FFFFFF"
              fontSize="10"
              fontFamily="sans-serif"
              textAnchor="middle"
              opacity="0.9"
            >
              SPAN: 12&apos; 0&quot;
            </text>
          </g>
        </g>

        {/* -------------------------------------------------------------------
            7. QUOTATION PAPER: Faded Background Ledger Sheet with Stamp (Desktop only)
            ------------------------------------------------------------------- */}
        <g
          className="hidden md:inline"
          transform="translate(160, 220) rotate(-9)"
          opacity="0.15"
        >
          {/* Paper Sheet Foundation */}
          <rect
            x="0"
            y="0"
            width="340"
            height="440"
            fill="#F6F3EE"
            stroke="#D8D2C8"
            strokeWidth="1.5"
            rx="2"
          />

          {/* Ruled Header Lines */}
          <rect x="18" y="22" width="160" height="12" fill="#1E3A8A" opacity="0.7" rx="1" />
          <line x1="18" y1="50" x2="322" y2="50" stroke="#222222" strokeWidth="1.5" />
          <line x1="18" y1="72" x2="322" y2="72" stroke="#222222" strokeWidth="1" />

          {/* Table Header Labels */}
          <text x="24" y="65" fill="#222222" fontSize="9" fontFamily="monospace" fontWeight="bold">
            SL | ITEM DESCRIPTION | NOS | KGS | AMOUNT
          </text>

          {/* Table Rows */}
          {[96, 120, 144, 168, 192, 216, 240, 264, 288].map((y, idx) => (
            <g key={`paper-row-${idx}`}>
              <line x1="18" y1={y} x2="322" y2={y} stroke="#8A9199" strokeWidth="0.8" strokeDasharray="2 2" />
              <rect x="22" y={y - 12} width={60 + (idx % 3) * 35} height="7" fill="#5A626A" opacity="0.35" rx="1" />
              <rect x="270" y={y - 12} width="40" height="7" fill="#5A626A" opacity="0.4" rx="1" />
            </g>
          ))}

          {/* Totals Section */}
          <rect x="180" y="320" width="142" height="40" fill="#E8E3DA" opacity="0.5" rx="1" />
          <line x1="180" y1="340" x2="322" y2="340" stroke="#222222" strokeWidth="0.8" />

          {/* Rubber Stamp "QUOTATION" */}
          <g transform="translate(170, 160) rotate(-16)">
            <rect
              x="-8"
              y="-18"
              width="150"
              height="36"
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.5"
              strokeDasharray="9 2"
              rx="3"
            />
            <text
              x="67"
              y="6"
              fill="#2563EB"
              fontSize="18"
              fontFamily="sans-serif"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="0.16em"
            >
              QUOTATION
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
};
