import React from 'react';

function mapProgress(progress, start, end) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  return (progress - start) / (end - start);
}

function interpolateColor(color1, color2, factor) {
  if (factor <= 0) return color1;
  if (factor >= 1) return color2;
  
  const c1 = color1.match(/\d+/g).map(Number);
  const c2 = color2.match(/\d+/g).map(Number);
  
  const r = Math.round(c1[0] + factor * (c2[0] - c1[0]));
  const g = Math.round(c1[1] + factor * (c2[1] - c1[1]));
  const b = Math.round(c1[2] + factor * (c2[2] - c1[2]));
  const a = c1[3] !== undefined && c2[3] !== undefined 
    ? (c1[3] + factor * (c2[3] - c1[3])).toFixed(2) 
    : 1;
    
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export default function HeartAnatomy({ phase, progress }) {
  // Atria resting: rgba(220, 50, 80, 0.3), active: rgba(239, 68, 68, 0.7)
  const atriaResting = 'rgba(220, 50, 80, 0.3)';
  const atriaActive = 'rgba(239, 68, 68, 0.7)';
  
  // Ventricles resting: rgba(180, 30, 60, 0.3), active: rgba(220, 40, 70, 0.8)
  const ventResting = 'rgba(180, 30, 60, 0.3)';
  const ventActive = 'rgba(220, 40, 70, 0.8)';
  const ventRepol = 'rgba(168, 85, 247, 0.6)'; // Purple-ish repolarization
  
  let atriaColor = atriaResting;
  let ventColor = ventResting;
  
  if (phase === 'atrial_activation') {
    // Ramp up then hold a bit, then ramp down (simplified, just ramp up based on progress)
    // We'll just interpolate up based on progress
    const p = pulseCurve(progress);
    atriaColor = interpolateColor(atriaResting, atriaActive, p);
  } else if (phase === 'ventricular_conduction') {
    const p = pulseCurve(progress);
    ventColor = interpolateColor(ventResting, ventActive, p);
  } else if (phase === 'repolarization') {
    // Fade from active to purple to resting
    if (progress < 0.5) {
      ventColor = interpolateColor(ventActive, ventRepol, progress * 2);
    } else {
      ventColor = interpolateColor(ventRepol, ventResting, (progress - 0.5) * 2);
    }
  }

  // A smooth bell curve for activation intensity
  function pulseCurve(t) {
    return Math.pow(Math.sin(t * Math.PI), 0.7);
  }

  return (
    <g id="heart-anatomy">
      {/* Right Atrium (left side) */}
      <path
        id="right-atrium"
        className="chamber"
        d="M 195 100 C 130 95, 70 120, 75 190 C 80 240, 140 255, 195 260 Z"
        fill={atriaColor}
        stroke="#fda4af"
        strokeWidth="1.5"
      />
      <text x="120" y="170" fill="#94a3b8" fontSize="10">RA</text>

      {/* Left Atrium (right side) */}
      <path
        id="left-atrium"
        className="chamber"
        d="M 205 100 C 270 95, 330 120, 325 190 C 320 240, 260 255, 205 260 Z"
        fill={atriaColor}
        stroke="#fda4af"
        strokeWidth="1.5"
      />
      <text x="270" y="170" fill="#94a3b8" fontSize="10">LA</text>

      {/* Right Ventricle (left side) */}
      <path
        id="right-ventricle"
        className="chamber"
        d="M 190 270 C 120 275, 70 340, 115 420 C 145 470, 190 480, 190 480 Z"
        fill={ventColor}
        stroke="#fda4af"
        strokeWidth="1.5"
      />
      <text x="135" y="370" fill="#94a3b8" fontSize="10">RV</text>

      {/* Left Ventricle (right side) */}
      <path
        id="left-ventricle"
        className="chamber"
        d="M 210 270 C 280 275, 330 340, 285 420 C 255 470, 210 480, 210 480 Z"
        fill={ventColor}
        stroke="#fda4af"
        strokeWidth="1.5"
      />
      <text x="255" y="370" fill="#94a3b8" fontSize="10">LV</text>

      {/* Septum */}
      <path
        id="septum"
        className="chamber"
        d="M 190 260 L 210 260 L 210 480 C 200 485, 200 485, 190 480 Z"
        fill={ventColor}
        stroke="#fda4af"
        strokeWidth="1.5"
      />
    </g>
  );
}
