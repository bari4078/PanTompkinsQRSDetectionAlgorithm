import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Sphere, Html } from '@react-three/drei';

// Helper: map progress value to sub-range [start, end]
function mapSubProgress(p, start, end) {
  if (typeof p !== 'number' || isNaN(p)) return 0;
  if (p <= start) return 0;
  if (p >= end) return 1;
  return (p - start) / (end - start);
}

// Smooth pulse curve for node activation
function pulse(t) {
  if (typeof t !== 'number' || isNaN(t)) return 0;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.pow(Math.sin(clamped * Math.PI), 0.7);
}

// Linearly interpolate a position along a multi-point polyline
function getPointAlongPolyline(points, t) {
  if (!points || points.length < 2) return [0, 0, 0];
  const clampedT = Math.max(0, Math.min(0.9999, t));
  const segmentCount = points.length - 1;
  const scaledT = clampedT * segmentCount;
  const index = Math.floor(scaledT);
  const frac = scaledT - index;
  const p1 = points[index];
  const p2 = points[index + 1];
  return [
    p1[0] + (p2[0] - p1[0]) * frac,
    p1[1] + (p2[1] - p1[1]) * frac,
    p1[2] + (p2[2] - p1[2]) * frac,
  ];
}

// Volumetric 3D Conduction Tube built with CatmullRomCurve3
function ConductionTube({
  points,
  color = '#60a5fa',
  radius = 0.009,
  opacity = 0.85,
}) {
  const curve = useMemo(() => {
    if (!points || points.length < 2) return null;
    const vectors = points.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
    return new THREE.CatmullRomCurve3(vectors);
  }, [points]);

  if (!curve) return null;

  return (
    <mesh>
      <tubeGeometry args={[curve, 32, radius, 8, false]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
    </mesh>
  );
}

// Sleek 3D anatomical badge label
function ConductionLabel({ position, text, subtext, active, activeColor = '#38bdf8' }) {
  const borderVal = active ? ('1px solid ' + activeColor) : '1px solid rgba(148, 163, 184, 0.35)';
  const shadowVal = active ? ('0 0 10px ' + activeColor + '99') : '0 2px 5px rgba(0,0,0,0.5)';
  const dotShadow = active ? ('0 0 6px ' + activeColor) : 'none';

  return (
    <Html
      position={position}
      center
      distanceFactor={4.8}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          background: active ? 'rgba(15, 23, 42, 0.94)' : 'rgba(15, 23, 42, 0.78)',
          border: borderVal,
          borderRadius: '10px',
          padding: '2px 8px',
          boxShadow: shadowVal,
          transform: active ? 'scale(1.06)' : 'scale(1.0)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <div
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: active ? activeColor : '#94a3b8',
            boxShadow: dotShadow,
          }}
        />
        <span
          style={{
            fontSize: '11px',
            fontWeight: active ? 700 : 500,
            color: active ? activeColor : '#f1f5f9',
            letterSpacing: '0.02em',
          }}
        >
          {text}
        </span>
        {subtext && (
          <span
            style={{
              fontSize: '9px',
              color: '#94a3b8',
              marginLeft: '2px',
            }}
          >
            {subtext}
          </span>
        )}
      </div>
    </Html>
  );
}

/**
 * ============================================================================
 * ACTIVE HEART MODEL SELECTOR
 * ============================================================================
 * Set this variable to 'model1' or 'model2' to switch the 3D heart model:
 *   - 'model1': /realistic_human_heart.glb
 *   - 'model2': /realistic_human_heart2.glb
 * ============================================================================
 */
export const ACTIVE_HEART_MODEL = 'model2';

export const MODEL_CONFIGS = {
  model1: {
    name: 'Realistic Human Heart 1',
    url: '/realistic_human_heart.glb',
    modelScale: 1.85,
    modelPosition: [0, -0.05, 0],
    conductionScale: 1.85,
    conductionOffset: [0, 0, 0],
    saPos: [-0.18, 0.52, 0.33],
    avPos: [-0.06, 0.18, 0.46],
    atrialPath1: [
      [-0.18, 0.52, 0.33],
      [-0.20, 0.42, 0.36],
      [-0.16, 0.30, 0.38],
      [-0.06, 0.18, 0.46],
    ],
    atrialPath2: [
      [-0.18, 0.52, 0.33],
      [-0.08, 0.54, 0.32],
      [0.05, 0.52, 0.27],
      [0.15, 0.45, 0.35],
    ],
    hisPath: [
      [-0.06, 0.18, 0.46],
      [-0.04, 0.08, 0.48],
      [-0.02, -0.04, 0.50],
      [0.00, -0.15, 0.50],
    ],
    rbbPath: [
      [0.00, -0.15, 0.50],
      [-0.08, -0.26, 0.50],
      [-0.16, -0.38, 0.47],
      [-0.18, -0.52, 0.40],
      [-0.14, -0.62, 0.33],
    ],
    lbbPath: [
      [0.00, -0.15, 0.50],
      [0.04, -0.28, 0.49],
      [0.08, -0.42, 0.44],
      [0.10, -0.56, 0.38],
      [0.10, -0.68, 0.32],
    ],
    purkinjeLines: [
      [[-0.16, -0.38, 0.47], [-0.24, -0.42, 0.43], [-0.30, -0.46, 0.38]],
      [[-0.18, -0.52, 0.40], [-0.25, -0.54, 0.36], [-0.28, -0.60, 0.29]],
      [[-0.14, -0.62, 0.33], [-0.16, -0.68, 0.26], [-0.04, -0.72, 0.27]],
      [[0.08, -0.42, 0.44], [0.18, -0.45, 0.39], [0.24, -0.48, 0.35]],
      [[0.10, -0.56, 0.38], [0.18, -0.58, 0.34], [0.22, -0.64, 0.30]],
      [[0.10, -0.68, 0.32], [0.12, -0.72, 0.29], [0.06, -0.75, 0.27]],
    ],
    labels: {
      sa: [-0.27, 0.58, 0.36],
      av: [-0.15, 0.22, 0.48],
      his: [0.13, 0.05, 0.52],
      rbb: [-0.26, -0.32, 0.50],
      lbb: [0.18, -0.32, 0.50],
      purkinje: [0.18, -0.66, 0.35],
    },
    nodeRadius: { sa: 0.045, av: 0.042 },
    tubeRadius: { atrial: 0.009, his: 0.012, bundle: 0.009, purkinje: 0.006 },
    sparkRadius: 0.035,
  },
  model2: {
    name: 'Realistic Human Heart 2',
    url: '/realistic_human_heart2.glb',
    modelScale: 0.3142,
    modelPosition: [-2.551, -1.847, -0.005],
    conductionScale: 0.3142,
    conductionOffset: [-2.551, -1.847, -0.005],
    saPos: [7.162, 7.836, 0.483],
    avPos: [7.785, 6.504, 1.943],
    atrialPath1: [
      [7.162, 7.836, 0.483],
      [7.283, 7.196, 0.922],
      [7.511, 7.005, 1.643],
      [7.785, 6.504, 1.943],
    ],
    atrialPath2: [
      [7.162, 7.836, 0.483],
      [7.661, 7.960, 0.554],
      [8.339, 8.195, 0.458],
      [8.847, 7.656, 0.589],
    ],
    hisPath: [
      [7.785, 6.504, 1.943],
      [7.777, 5.837, 2.283],
      [7.716, 5.051, 2.464],
      [7.953, 4.296, 2.517],
    ],
    rbbPath: [
      [7.953, 4.296, 2.517],
      [7.564, 3.883, 2.297],
      [7.078, 3.108, 2.117],
      [7.010, 2.576, 1.517],
      [7.297, 1.815, 1.108],
    ],
    lbbPath: [
      [7.953, 4.296, 2.517],
      [8.324, 3.841, 2.352],
      [8.552, 3.026, 1.981],
      [8.516, 2.252, 1.542],
      [8.307, 1.556, 1.152],
    ],
    purkinjeLines: [
      [[7.078, 3.108, 2.117], [6.749, 2.866, 1.591], [6.544, 2.842, 1.330]],
      [[7.010, 2.576, 1.517], [6.759, 2.442, 1.262], [6.761, 2.155, 0.909]],
      [[7.297, 1.815, 1.108], [7.230, 1.603, 0.736], [7.673, 1.284, 0.576]],
      [[8.552, 3.026, 1.981], [8.995, 2.911, 1.674], [9.187, 2.784, 1.383]],
      [[8.516, 2.252, 1.542], [8.931, 2.303, 1.272], [8.842, 1.887, 0.950]],
      [[8.307, 1.556, 1.152], [8.429, 1.344, 0.773], [8.271, 1.235, 0.604]],
    ],
    labels: {
      sa: [6.60, 8.20, 0.60],
      av: [7.30, 6.70, 2.10],
      his: [8.35, 5.70, 2.40],
      rbb: [7.00, 3.90, 2.45],
      lbb: [8.90, 3.90, 2.45],
      purkinje: [8.75, 1.50, 1.25],
    },
    nodeRadius: { sa: 0.265, av: 0.247 },
    tubeRadius: { atrial: 0.053, his: 0.071, bundle: 0.053, purkinje: 0.035 },
    sparkRadius: 0.206,
  },
};

export default function HeartModel({ phase = 'diastole', progress = 0, modelChoice }) {
  const heartGroup = useRef();
  const realisticModelRef = useRef();

  const resolvedChoice = modelChoice ?? ACTIVE_HEART_MODEL;
  const isModel2 = resolvedChoice === 'model2' || resolvedChoice === 2;
  const config = isModel2 ? MODEL_CONFIGS.model2 : MODEL_CONFIGS.model1;

  // Load the selected realistic human heart 3D model
  const { scene } = useGLTF(config.url);

  // Clone scene so materials can be enhanced and animated without affecting cache
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.type === 'DirectionalLight' || child.type === 'PointLight' || child.type === 'PerspectiveCamera') {
        child.visible = false;
      }
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.roughness = 0.38;
        child.material.metalness = 0.12;
        child.material.emissive = new THREE.Color('#ef4444');
        child.material.emissiveIntensity = 0.02;
      }
    });
    return clone;
  }, [scene]);

  // Node refs
  const saNodeRef = useRef();
  const avNodeRef = useRef();

  // Electrical impulse spark refs
  const atrialSparkRef = useRef();
  const hisSparkRef = useRef();
  const rbbSparkRef = useRef();
  const lbbSparkRef = useRef();

  // ---------------------------------------------------------------------------
  // Per-frame Animation loop synchronized with PlaybackEngine phase and progress
  // ---------------------------------------------------------------------------
  useFrame(() => {
    const currentPhase = phase || 'diastole';
    const currentProg = (typeof progress === 'number' && !isNaN(progress)) ? progress : 0;

    // Phase flags
    const isAtrial = currentPhase === 'atrial_activation';
    const isAvDelay = currentPhase === 'av_delay';
    const isVentricular = currentPhase === 'ventricular_conduction';
    const isRepol = currentPhase === 'repolarization';

    // 1. SA Node Glow
    let saGlow = 0.3;
    if (isAtrial) {
      saGlow = 0.6 + pulse(currentProg) * 3.5;
    }
    if (saNodeRef.current && saNodeRef.current.material) {
      saNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        saNodeRef.current.material.emissiveIntensity || 0.3,
        saGlow,
        0.35
      );
    }

    // 2. AV Node Glow
    let avGlow = 0.3;
    if (isAvDelay) {
      avGlow = 0.6 + pulse(currentProg) * 3.5;
    }
    if (avNodeRef.current && avNodeRef.current.material) {
      avNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        avNodeRef.current.material.emissiveIntensity || 0.3,
        avGlow,
        0.35
      );
    }

    // 3. Atrial electrical propagation spark
    if (atrialSparkRef.current) {
      if (isAtrial && currentProg > 0 && currentProg < 1) {
        const pt = getPointAlongPolyline(config.atrialPath1, currentProg);
        atrialSparkRef.current.position.set(pt[0], pt[1], pt[2]);
        atrialSparkRef.current.visible = true;
      } else {
        atrialSparkRef.current.visible = false;
      }
    }

    // 4. Bundle of His propagation spark
    const hisProgress = isVentricular ? mapSubProgress(currentProg, 0.0, 0.25) : 0;
    if (hisSparkRef.current) {
      if (isVentricular && hisProgress > 0 && hisProgress < 1) {
        const pt = getPointAlongPolyline(config.hisPath, hisProgress);
        hisSparkRef.current.position.set(pt[0], pt[1], pt[2]);
        hisSparkRef.current.visible = true;
      } else {
        hisSparkRef.current.visible = false;
      }
    }

    // 5. Bundle branches propagation sparks
    const bbProgress = isVentricular ? mapSubProgress(currentProg, 0.2, 0.65) : 0;
    if (rbbSparkRef.current) {
      if (isVentricular && bbProgress > 0 && bbProgress < 1) {
        const pt = getPointAlongPolyline(config.rbbPath, bbProgress);
        rbbSparkRef.current.position.set(pt[0], pt[1], pt[2]);
        rbbSparkRef.current.visible = true;
      } else {
        rbbSparkRef.current.visible = false;
      }
    }

    if (lbbSparkRef.current) {
      if (isVentricular && bbProgress > 0 && bbProgress < 1) {
        const pt = getPointAlongPolyline(config.lbbPath, bbProgress);
        lbbSparkRef.current.position.set(pt[0], pt[1], pt[2]);
        lbbSparkRef.current.visible = true;
      } else {
        lbbSparkRef.current.visible = false;
      }
    }

    // 6. Realistic myocardial contraction & systolic pump
    let targetScale = 1.0;
    let targetEmissive = 0.02;

    if (isVentricular) {
      // Systole: pump contraction curve (shrinks inward then rebounds)
      const pump = Math.sin(mapSubProgress(currentProg, 0.15, 0.85) * Math.PI) * 0.12;
      targetScale = 1.0 - pump;
      targetEmissive = 0.02 + Math.sin(currentProg * Math.PI) * 0.35;
    } else if (isRepol) {
      targetEmissive = 0.02 + (1 - currentProg) * 0.15;
    }

    if (heartGroup.current) {
      heartGroup.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.3
      );
    }

    // Modulate realistic heart texture emissive intensity
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.emissiveIntensity = THREE.MathUtils.lerp(
            child.material.emissiveIntensity || 0.02,
            targetEmissive,
            0.25
          );
        }
      });
    }
  });

  const isAtrial = phase === 'atrial_activation';
  const isAvDelay = phase === 'av_delay';
  const isVentricular = phase === 'ventricular_conduction';

  return (
    <group ref={heartGroup} position={[0, 0, 0]}>
      {/* 1. ANATOMICAL HEART MODEL */}
      <primitive
        ref={realisticModelRef}
        object={clonedScene}
        scale={config.modelScale}
        position={config.modelPosition}
      />

      {/* 2. CALIBRATED CONDUCTION SYSTEM (Separated group with independent offset & scale) */}
      <group position={config.conductionOffset} scale={config.conductionScale}>

        {/* ============ CARDIAC CONDUCTION NODES ============ */}

        {/* Sinoatrial (SA) Node */}
        <Sphere ref={saNodeRef} args={[config.nodeRadius.sa, 16, 16]} position={config.saPos}>
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </Sphere>

        {/* Atrioventricular (AV) Node */}
        <Sphere ref={avNodeRef} args={[config.nodeRadius.av, 16, 16]} position={config.avPos}>
          <meshStandardMaterial
            color="#f59e0b"
            emissive="#f59e0b"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </Sphere>

        {/* ============ 3D CONDUCTION TUBES ============ */}

        {/* Atrial Pathway 1: Internodal Tract */}
        <ConductionTube
          points={config.atrialPath1}
          color={isAtrial ? '#38bdf8' : '#60a5fa'}
          radius={config.tubeRadius.atrial}
          opacity={isAtrial ? 0.95 : 0.4}
        />

        {/* Atrial Pathway 2: Bachmann Bundle */}
        <ConductionTube
          points={config.atrialPath2}
          color={isAtrial ? '#818cf8' : '#60a5fa'}
          radius={config.tubeRadius.atrial * 0.9}
          opacity={isAtrial ? 0.95 : 0.3}
        />

        {/* Bundle of His */}
        <ConductionTube
          points={config.hisPath}
          color={isVentricular ? '#22d3ee' : '#60a5fa'}
          radius={config.tubeRadius.his}
          opacity={isVentricular ? 1.0 : 0.45}
        />

        {/* Right Bundle Branch */}
        <ConductionTube
          points={config.rbbPath}
          color={isVentricular ? '#60a5fa' : '#3b82f6'}
          radius={config.tubeRadius.bundle}
          opacity={isVentricular ? 0.95 : 0.4}
        />

        {/* Left Bundle Branch */}
        <ConductionTube
          points={config.lbbPath}
          color={isVentricular ? '#60a5fa' : '#3b82f6'}
          radius={config.tubeRadius.bundle}
          opacity={isVentricular ? 0.95 : 0.4}
        />

        {/* Purkinje Network */}
        {config.purkinjeLines.map((pts, idx) => (
          <ConductionTube
            key={idx}
            points={pts}
            color={isVentricular ? '#c084fc' : '#818cf8'}
            radius={config.tubeRadius.purkinje}
            opacity={isVentricular ? 0.92 : 0.3}
          />
        ))}

        {/* ============ ELECTRICAL IMPULSE SPARKS ============ */}

        {/* Atrial Traveling Impulse */}
        <Sphere ref={atrialSparkRef} args={[config.sparkRadius, 12, 12]} visible={false}>
          <meshBasicMaterial color="#ffffff" />
        </Sphere>

        {/* His Bundle Impulse */}
        <Sphere ref={hisSparkRef} args={[config.sparkRadius * 1.1, 12, 12]} visible={false}>
          <meshBasicMaterial color="#67e8f9" />
        </Sphere>

        {/* Right Bundle Branch Impulse */}
        <Sphere ref={rbbSparkRef} args={[config.sparkRadius, 12, 12]} visible={false}>
          <meshBasicMaterial color="#93c5fd" />
        </Sphere>

        {/* Left Bundle Branch Impulse */}
        <Sphere ref={lbbSparkRef} args={[config.sparkRadius, 12, 12]} visible={false}>
          <meshBasicMaterial color="#93c5fd" />
        </Sphere>

        {/* ============ 3D ANATOMICAL NAMING & LABELS ============ */}

        {/* SA Node Label */}
        <ConductionLabel
          position={config.labels.sa}
          text="SA Node"
          subtext="Pacemaker"
          active={isAtrial}
          activeColor="#fbbf24"
        />

        {/* AV Node Label */}
        <ConductionLabel
          position={config.labels.av}
          text="AV Node"
          active={isAvDelay}
          activeColor="#f59e0b"
        />

        {/* Bundle of His Label */}
        <ConductionLabel
          position={config.labels.his}
          text="His Bundle"
          active={isVentricular}
          activeColor="#22d3ee"
        />

        {/* Right Bundle Branch Label */}
        <ConductionLabel
          position={config.labels.rbb}
          text="RBB"
          subtext="Right Bundle"
          active={isVentricular}
          activeColor="#60a5fa"
        />

        {/* Left Bundle Branch Label */}
        <ConductionLabel
          position={config.labels.lbb}
          text="LBB"
          subtext="Left Bundle"
          active={isVentricular}
          activeColor="#60a5fa"
        />

        {/* Purkinje Fibers Label */}
        <ConductionLabel
          position={config.labels.purkinje}
          text="Purkinje Fibers"
          active={isVentricular}
          activeColor="#c084fc"
        />
      </group>
    </group>
  );
}

// Preload both realistic GLB models
useGLTF.preload('/realistic_human_heart.glb');
useGLTF.preload('/realistic_human_heart2.glb');
