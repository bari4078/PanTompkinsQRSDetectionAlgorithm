import React from 'react';

function pulseCurve(t) {
  // Smooth bell curve: rises quickly, peaks at 0.3, falls gradually
  return Math.pow(Math.sin(t * Math.PI), 0.7);
}

export default function CardiacNodes({ phase, progress }) {
  // SA Node position: X=120, Y=105 (top of Right Atrium area, left side of SVG)
  // (Prompt initially suggested 280, 105 but also said RA is left. Using 120, 105 to match anatomy rules)
  const saX = 120;
  const saY = 105;

  // AV Node position: X=200, Y=220 (center)
  const avX = 200;
  const avY = 220;

  const isSaActive = phase === 'atrial_activation';
  const isAvActive = phase === 'av_delay';

  const saPulse = isSaActive ? pulseCurve(progress) : 0;
  const avPulse = isAvActive ? pulseCurve(progress) : 0;

  const renderNode = (x, y, activePulse, label, labelOffset) => {
    const baseRadius = 4;
    const coreRadius = baseRadius + activePulse * 2;
    const glowRadius = 12 + activePulse * 8;
    const glowOpacity = activePulse * 0.6;

    return (
      <g>
        {/* Glow circle */}
        {glowOpacity > 0 && (
          <circle
            cx={x}
            cy={y}
            r={glowRadius}
            fill="#fbbf24"
            opacity={glowOpacity}
            filter="url(#nodeGlow)"
          />
        )}
        {/* Core circle */}
        <circle
          cx={x}
          cy={y}
          r={coreRadius}
          fill={activePulse > 0 ? "#fef3c7" : "#d97706"}
          stroke="#fbbf24"
          strokeWidth={1.5}
        />
        {/* Label */}
        <text
          x={x + labelOffset}
          y={y + 4}
          fill="#fbbf24"
          fontSize="7"
          fontWeight="600"
        >
          {label}
        </text>
      </g>
    );
  };

  return (
    <g id="cardiac-nodes">
      <defs>
        <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {renderNode(saX, saY, saPulse, "SA", -25)}
      {renderNode(avX, avY, avPulse, "AV", 15)}
    </g>
  );
}
