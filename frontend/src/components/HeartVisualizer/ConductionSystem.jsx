import React from 'react';

function mapProgress(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}

export default function ConductionSystem({ phase, progress }) {
  const isAtrial = phase === 'atrial_activation';
  const isVentricular = phase === 'ventricular_conduction';

  const atrialProgress = isAtrial ? progress : 0;
  
  const hisProgress = isVentricular ? mapProgress(progress, 0.0, 0.25) : 0;
  const bundleProgress = isVentricular ? mapProgress(progress, 0.2, 0.6) : 0;
  
  const purkinjeLAProgress = isVentricular ? mapProgress(progress, 0.45, 0.85) : 0;
  const purkinjeLPProgress = isVentricular ? mapProgress(progress, 0.50, 0.90) : 0;
  const purkinjeRAProgress = isVentricular ? mapProgress(progress, 0.45, 0.85) : 0;
  const purkinjeRPProgress = isVentricular ? mapProgress(progress, 0.50, 0.90) : 0;

  const activeColor = "#38bdf8";
  const inactiveOpacity = 0.15;
  const activeOpacity = 0.9;

  const renderPath = (d, prog, active, label, labelX, labelY) => (
    <g>
      <path
        d={d}
        pathLength="1"
        stroke={active ? activeColor : "#60a5fa"}
        strokeWidth={2.5}
        fill="none"
        strokeDasharray="1"
        strokeDashoffset={1 - (active ? prog : 1)}
        strokeLinecap="round"
        opacity={active ? activeOpacity : inactiveOpacity}
      />
      {label && (
        <text x={labelX} y={labelY} fill="#60a5fa" fontSize="9" opacity={active ? 1 : 0.6}>
          {label}
        </text>
      )}
    </g>
  );

  return (
    <g id="conduction-system">
      {/* Atrial Pathways (SA to AV) */}
      {renderPath("M 120 105 Q 160 150 200 220", atrialProgress, isAtrial)}
      {renderPath("M 120 105 Q 140 180 200 220", atrialProgress, isAtrial)}
      {renderPath("M 120 105 Q 200 120 260 170", atrialProgress, isAtrial)} {/* Bachmann's bundle */}

      {/* Bundle of His */}
      {renderPath("M 200 220 L 200 280", hisProgress, isVentricular, "His", 205, 250)}

      {/* Right Bundle Branch */}
      {renderPath("M 200 280 Q 185 360 160 440", bundleProgress, isVentricular, "RBB", 175, 360)}

      {/* Left Bundle Branch */}
      {renderPath("M 200 280 Q 215 360 240 440", bundleProgress, isVentricular, "LBB", 215, 360)}

      {/* Purkinje Network - Right Anterior */}
      {renderPath("M 160 440 Q 120 420 100 370", purkinjeRAProgress, isVentricular)}
      {/* Purkinje Network - Right Posterior */}
      {renderPath("M 160 440 Q 140 460 170 470", purkinjeRPProgress, isVentricular)}

      {/* Purkinje Network - Left Anterior */}
      {renderPath("M 240 440 Q 280 420 300 370", purkinjeLAProgress, isVentricular)}
      {/* Purkinje Network - Left Posterior */}
      {renderPath("M 240 440 Q 260 460 230 470", purkinjeLPProgress, isVentricular)}
    </g>
  );
}
