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

export default function HeartModel({ phase = 'diastole', progress = 0 }) {
  const heartGroup = useRef();
  const realisticModelRef = useRef();

  // Load the realistic human heart 3D model
  const { scene } = useGLTF('/realistic_human_heart.glb');

  // Exact Bounding Box calculation & logging
  useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    box.getCenter(center);
    box.getSize(size);

    console.log('========== HEART MODEL ==========');
    console.log('CENTER:', center);
    console.log('SIZE:', size);
    console.log('MIN:', box.min);
    console.log('MAX:', box.max);
    console.log('=================================');

    return null;
  }, [scene]);

  // Clone scene so materials can be enhanced and animated without affecting cache
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
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

  // Independent calibration parameters for the conduction system
  const conductionOffset = useMemo(
    () => new THREE.Vector3(0, 0, 0),
    []
  );
  const conductionScale = 1.85;

  // Node refs
  const saNodeRef = useRef();
  const avNodeRef = useRef();

  // Electrical impulse spark refs
  const atrialSparkRef = useRef();
  const hisSparkRef = useRef();
  const rbbSparkRef = useRef();
  const lbbSparkRef = useRef();

  // ---------------------------------------------------------------------------
  // Conduction Pathways (Coordinates fitted directly to the realistic heart surface)
  // Scale factor inside conductionGroup is conductionScale (1.85), matching the model.
  // ---------------------------------------------------------------------------

  // Sinoatrial (SA) Node: Superior Vena Cava / Right Atrium wall junction
  const saPos = useMemo(() => [-0.18, 0.52, 0.33], []);

  // Atrioventricular (AV) Node: Interatrial septum near tricuspid valve / AV junction
  const avPos = useMemo(() => [-0.06, 0.18, 0.46], []);

  // Atrial Pathway 1: Internodal anterior tract (SA Node -> AV Node across right atrial wall)
  const atrialPath1 = useMemo(() => [
    [-0.18, 0.52, 0.33],
    [-0.20, 0.42, 0.36],
    [-0.16, 0.30, 0.38],
    [-0.06, 0.18, 0.46],
  ], []);

  // Atrial Pathway 2: Bachmann's bundle (Crossing from SA Node towards left atrium)
  const atrialPath2 = useMemo(() => [
    [-0.18, 0.52, 0.33],
    [-0.08, 0.54, 0.32],
    [0.05, 0.52, 0.27],
    [0.15, 0.45, 0.35],
  ], []);

  // Bundle of His: Descending from AV node through the interventricular septum
  const hisPath = useMemo(() => [
    [-0.06, 0.18, 0.46],
    [-0.04, 0.08, 0.48],
    [-0.02, -0.04, 0.50],
    [0.00, -0.15, 0.50],
  ], []);

  // Right Bundle Branch (RBB): Descending down right septum into right ventricular wall
  const rbbPath = useMemo(() => [
    [0.00, -0.15, 0.50],
    [-0.08, -0.26, 0.50],
    [-0.16, -0.38, 0.47],
    [-0.18, -0.52, 0.40],
    [-0.14, -0.62, 0.33],
  ], []);

  // Left Bundle Branch (LBB): Descending down left septum toward left ventricular apex
  const lbbPath = useMemo(() => [
    [0.00, -0.15, 0.50],
    [0.04, -0.28, 0.49],
    [0.08, -0.42, 0.44],
    [0.10, -0.56, 0.38],
    [0.10, -0.68, 0.32],
  ], []);

  // Purkinje Network: Arborizing branches hugging ventricular myocardium and apex
  const purkinjeLines = useMemo(() => [
    // Right Ventricle branches
    [[-0.16, -0.38, 0.47], [-0.24, -0.42, 0.43], [-0.30, -0.46, 0.38]],
    [[-0.18, -0.52, 0.40], [-0.25, -0.54, 0.36], [-0.28, -0.60, 0.29]],
    [[-0.14, -0.62, 0.33], [-0.16, -0.68, 0.26], [-0.04, -0.72, 0.27]],
    // Left Ventricle branches
    [[0.08, -0.42, 0.44], [0.18, -0.45, 0.39], [0.24, -0.48, 0.35]],
    [[0.10, -0.56, 0.38], [0.18, -0.58, 0.34], [0.22, -0.64, 0.30]],
    [[0.10, -0.68, 0.32], [0.12, -0.72, 0.29], [0.06, -0.75, 0.27]],
  ], []);

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
        const pt = getPointAlongPolyline(atrialPath1, currentProg);
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
        const pt = getPointAlongPolyline(hisPath, hisProgress);
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
        const pt = getPointAlongPolyline(rbbPath, bbProgress);
        rbbSparkRef.current.position.set(pt[0], pt[1], pt[2]);
        rbbSparkRef.current.visible = true;
      } else {
        rbbSparkRef.current.visible = false;
      }
    }

    if (lbbSparkRef.current) {
      if (isVentricular && bbProgress > 0 && bbProgress < 1) {
        const pt = getPointAlongPolyline(lbbPath, bbProgress);
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
    <group ref={heartGroup} position={[0, -0.05, 0]}>
      {/* 1. ANATOMICAL HEART MODEL */}
      <primitive
        ref={realisticModelRef}
        object={clonedScene}
        scale={1.85}
      />

      {/* 2. CALIBRATED CONDUCTION SYSTEM (Separated group with independent offset & scale) */}
      <group position={conductionOffset} scale={conductionScale}>

        {/* ============ CARDIAC CONDUCTION NODES ============ */}

        {/* Sinoatrial (SA) Node */}
        <Sphere ref={saNodeRef} args={[0.045, 16, 16]} position={saPos}>
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={0.5}
            toneMapped={false}
          />
        </Sphere>

        {/* Atrioventricular (AV) Node */}
        <Sphere ref={avNodeRef} args={[0.042, 16, 16]} position={avPos}>
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
          points={atrialPath1}
          color={isAtrial ? '#38bdf8' : '#60a5fa'}
          radius={0.009}
          opacity={isAtrial ? 0.95 : 0.4}
        />

        {/* Atrial Pathway 2: Bachmann Bundle */}
        <ConductionTube
          points={atrialPath2}
          color={isAtrial ? '#818cf8' : '#60a5fa'}
          radius={0.008}
          opacity={isAtrial ? 0.95 : 0.3}
        />

        {/* Bundle of His */}
        <ConductionTube
          points={hisPath}
          color={isVentricular ? '#22d3ee' : '#60a5fa'}
          radius={0.012}
          opacity={isVentricular ? 1.0 : 0.45}
        />

        {/* Right Bundle Branch */}
        <ConductionTube
          points={rbbPath}
          color={isVentricular ? '#60a5fa' : '#3b82f6'}
          radius={0.009}
          opacity={isVentricular ? 0.95 : 0.4}
        />

        {/* Left Bundle Branch */}
        <ConductionTube
          points={lbbPath}
          color={isVentricular ? '#60a5fa' : '#3b82f6'}
          radius={0.009}
          opacity={isVentricular ? 0.95 : 0.4}
        />

        {/* Purkinje Network */}
        {purkinjeLines.map((pts, idx) => (
          <ConductionTube
            key={idx}
            points={pts}
            color={isVentricular ? '#c084fc' : '#818cf8'}
            radius={0.006}
            opacity={isVentricular ? 0.92 : 0.3}
          />
        ))}

        {/* ============ ELECTRICAL IMPULSE SPARKS ============ */}

        {/* Atrial Traveling Impulse */}
        <Sphere ref={atrialSparkRef} args={[0.035, 12, 12]} visible={false}>
          <meshBasicMaterial color="#ffffff" />
        </Sphere>

        {/* His Bundle Impulse */}
        <Sphere ref={hisSparkRef} args={[0.038, 12, 12]} visible={false}>
          <meshBasicMaterial color="#67e8f9" />
        </Sphere>

        {/* Right Bundle Branch Impulse */}
        <Sphere ref={rbbSparkRef} args={[0.035, 12, 12]} visible={false}>
          <meshBasicMaterial color="#93c5fd" />
        </Sphere>

        {/* Left Bundle Branch Impulse */}
        <Sphere ref={lbbSparkRef} args={[0.035, 12, 12]} visible={false}>
          <meshBasicMaterial color="#93c5fd" />
        </Sphere>

        {/* ============ 3D ANATOMICAL NAMING & LABELS ============ */}

        {/* SA Node Label */}
        <ConductionLabel
          position={[-0.27, 0.58, 0.36]}
          text="SA Node"
          subtext="Pacemaker"
          active={isAtrial}
          activeColor="#fbbf24"
        />

        {/* AV Node Label */}
        <ConductionLabel
          position={[-0.15, 0.22, 0.48]}
          text="AV Node"
          active={isAvDelay}
          activeColor="#f59e0b"
        />

        {/* Bundle of His Label */}
        <ConductionLabel
          position={[0.13, 0.05, 0.52]}
          text="His Bundle"
          active={isVentricular}
          activeColor="#22d3ee"
        />

        {/* Right Bundle Branch Label */}
        <ConductionLabel
          position={[-0.26, -0.32, 0.50]}
          text="RBB"
          subtext="Right Bundle"
          active={isVentricular}
          activeColor="#60a5fa"
        />

        {/* Left Bundle Branch Label */}
        <ConductionLabel
          position={[0.18, -0.32, 0.50]}
          text="LBB"
          subtext="Left Bundle"
          active={isVentricular}
          activeColor="#60a5fa"
        />

        {/* Purkinje Fibers Label */}
        <ConductionLabel
          position={[0.18, -0.66, 0.35]}
          text="Purkinje Fibers"
          active={isVentricular}
          activeColor="#c084fc"
        />
      </group>
    </group>
  );
}

// Preload the realistic GLB model
useGLTF.preload('/realistic_human_heart.glb');
