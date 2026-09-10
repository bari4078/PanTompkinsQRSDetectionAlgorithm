import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGLTF, Sphere, Line } from '@react-three/drei';

// Helper: map a progress value to a sub-range [start, end]
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

export default function HeartModel({ phase = 'diastole', progress = 0 }) {
  const heartGroup = useRef();
  const realisticModelRef = useRef();

  // Load the realistic human heart 3D model
  const { scene } = useGLTF('/realistic_human_heart.glb');

  // Clone scene so materials can be enhanced and animated without mutating the cached asset
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.roughness = 0.4;
        child.material.metalness = 0.15;
        child.material.emissive = new THREE.Color('#ef4444');
        child.material.emissiveIntensity = 0.02;
      }
    });
    return clone;
  }, [scene]);

  // Node refs
  const saNodeRef = useRef();
  const avNodeRef = useRef();

  // Electrical spark refs
  const atrialSparkRef = useRef();
  const hisSparkRef = useRef();
  const rbbSparkRef = useRef();
  const lbbSparkRef = useRef();

  // Pathway line refs
  const atrialLine1Ref = useRef();
  const atrialLine2Ref = useRef();
  const hisLineRef = useRef();
  const rbbLineRef = useRef();
  const lbbLineRef = useRef();

  // ---------------------------------------------------------------------------
  // Conduction Pathways (Coordinates fitted to the realistic human heart model)
  // Scale factor for model is ~1.85
  // ---------------------------------------------------------------------------

  // Sinoatrial (SA) Node: Superior Vena Cava / Right Atrium junction
  const saPos = useMemo(() => [0.42, 0.62, 0.40], []);

  // Atrioventricular (AV) Node: Interatrial septum near tricuspid valve
  const avPos = useMemo(() => [-0.09, 0.20, 0.54], []);

  // Atrial Pathway 1: Internodal anterior tract (SA -> AV)
  const atrialPath1 = useMemo(() => [
    [0.42, 0.62, 0.40],
    [0.22, 0.48, 0.50],
    [0.05, 0.32, 0.55],
    [-0.09, 0.20, 0.54],
  ], []);

  // Atrial Pathway 2: Bachmann bundle crossing toward Left Atrium
  const atrialPath2 = useMemo(() => [
    [0.42, 0.62, 0.40],
    [0.15, 0.75, 0.42],
    [-0.22, 0.68, 0.42],
    [-0.52, 0.55, 0.32],
  ], []);

  // Bundle of His: AV node descending into the interventricular septum
  const hisPath = useMemo(() => [
    [-0.09, 0.20, 0.54],
    [-0.07, 0.05, 0.58],
    [-0.04, -0.12, 0.60],
  ], []);

  // Right Bundle Branch (RBB): Along septum down toward RV apex
  const rbbPath = useMemo(() => [
    [-0.04, -0.12, 0.60],
    [0.10, -0.32, 0.56],
    [0.25, -0.58, 0.46],
    [0.35, -0.85, 0.32],
  ], []);

  // Left Bundle Branch (LBB): Along septum down to Left Ventricle apex
  const lbbPath = useMemo(() => [
    [-0.04, -0.12, 0.60],
    [-0.16, -0.32, 0.56],
    [-0.30, -0.58, 0.46],
    [-0.36, -0.90, 0.32],
  ], []);

  // Purkinje Fiber network arborizations
  const purkinjeLines = useMemo(() => [
    // Right Ventricle Purkinje branches
    [[0.35, -0.85, 0.32], [0.46, -0.68, 0.36], [0.52, -0.48, 0.28]],
    [[0.35, -0.85, 0.32], [0.44, -0.95, 0.22], [0.28, -1.05, 0.14]],
    [[0.25, -0.58, 0.46], [0.40, -0.48, 0.42], [0.52, -0.35, 0.32]],
    // Left Ventricle Purkinje branches
    [[-0.36, -0.90, 0.32], [-0.48, -0.72, 0.34], [-0.54, -0.52, 0.26]],
    [[-0.36, -0.90, 0.32], [-0.42, -0.98, 0.22], [-0.26, -1.06, 0.14]],
    [[-0.30, -0.58, 0.46], [-0.44, -0.48, 0.40], [-0.56, -0.35, 0.28]],
  ], []);

  // ---------------------------------------------------------------------------
  // Per-frame Animation loop synchronized with PlaybackEngine phase and progress
  // ---------------------------------------------------------------------------
  useFrame(() => {
    const currentPhase = phase || 'diastole';
    const currentProg = (typeof progress === 'number' && !isNaN(progress)) ? progress : 0;

    const isAtrial = currentPhase === 'atrial_activation';
    const isAvDelay = currentPhase === 'av_delay';
    const isVentricular = currentPhase === 'ventricular_conduction';
    const isRepol = currentPhase === 'repolarization';

    // 1. SA Node Glow
    let saGlow = 0.2;
    if (isAtrial) {
      saGlow = 0.5 + pulse(currentProg) * 3.5;
    }
    if (saNodeRef.current && saNodeRef.current.material) {
      saNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        saNodeRef.current.material.emissiveIntensity || 0.2,
        saGlow,
        0.35
      );
    }

    // 2. AV Node Glow
    let avGlow = 0.2;
    if (isAvDelay) {
      avGlow = 0.5 + pulse(currentProg) * 3.5;
    }
    if (avNodeRef.current && avNodeRef.current.material) {
      avNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(
        avNodeRef.current.material.emissiveIntensity || 0.2,
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
    const bbProgress = isVentricular ? mapSubProgress(currentProg, 0.2, 0.6) : 0;
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
    const baseScale = 1.85;
    let targetScale = baseScale;
    let targetEmissive = 0.02;

    if (isVentricular) {
      // Systole: pump contraction curve (shrinks inward then expands)
      const pump = Math.sin(mapSubProgress(currentProg, 0.15, 0.85) * Math.PI) * 0.12;
      targetScale = baseScale * (1.0 - pump);
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

  return (
    <group ref={heartGroup} position={[0, -0.05, 0]} scale={[1.85, 1.85, 1.85]}>
      {/* Realistic Anatomical Human Heart 3D Model */}
      <primitive ref={realisticModelRef} object={clonedScene} />

      {/* ============ CARDIAC CONDUCTION NODES ============ */}

      {/* Sinoatrial (SA) Node */}
      <Sphere ref={saNodeRef} args={[0.065, 16, 16]} position={saPos}>
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </Sphere>

      {/* Atrioventricular (AV) Node */}
      <Sphere ref={avNodeRef} args={[0.06, 16, 16]} position={avPos}>
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.4}
          toneMapped={false}
        />
      </Sphere>

      {/* ============ CONDUCTION PATHWAYS ============ */}

      {/* Atrial Pathway 1: Internodal Tract */}
      <Line
        ref={atrialLine1Ref}
        points={atrialPath1}
        color={phase === 'atrial_activation' ? '#38bdf8' : '#60a5fa'}
        lineWidth={3.5}
        transparent
        opacity={phase === 'atrial_activation' ? 0.95 : 0.35}
      />

      {/* Atrial Pathway 2: Bachmann Bundle */}
      <Line
        ref={atrialLine2Ref}
        points={atrialPath2}
        color={phase === 'atrial_activation' ? '#818cf8' : '#60a5fa'}
        lineWidth={3}
        transparent
        opacity={phase === 'atrial_activation' ? 0.95 : 0.25}
      />

      {/* Bundle of His */}
      <Line
        ref={hisLineRef}
        points={hisPath}
        color={phase === 'ventricular_conduction' ? '#22d3ee' : '#60a5fa'}
        lineWidth={4.5}
        transparent
        opacity={phase === 'ventricular_conduction' ? 1.0 : 0.4}
      />

      {/* Right Bundle Branch */}
      <Line
        ref={rbbLineRef}
        points={rbbPath}
        color={phase === 'ventricular_conduction' ? '#60a5fa' : '#3b82f6'}
        lineWidth={3.5}
        transparent
        opacity={phase === 'ventricular_conduction' ? 0.95 : 0.35}
      />

      {/* Left Bundle Branch */}
      <Line
        ref={lbbLineRef}
        points={lbbPath}
        color={phase === 'ventricular_conduction' ? '#60a5fa' : '#3b82f6'}
        lineWidth={3.5}
        transparent
        opacity={phase === 'ventricular_conduction' ? 0.95 : 0.35}
      />

      {/* Purkinje Network */}
      {purkinjeLines.map((pts, idx) => (
        <Line
          key={idx}
          points={pts}
          color={phase === 'ventricular_conduction' ? '#c084fc' : '#818cf8'}
          lineWidth={2.2}
          transparent
          opacity={phase === 'ventricular_conduction' ? 0.9 : 0.25}
        />
      ))}

      {/* ============ ELECTRICAL IMPULSE SPARKS ============ */}

      {/* Atrial Traveling Impulse */}
      <Sphere ref={atrialSparkRef} args={[0.045, 12, 12]} visible={false}>
        <meshBasicMaterial color="#ffffff" />
      </Sphere>

      {/* His Bundle Impulse */}
      <Sphere ref={hisSparkRef} args={[0.05, 12, 12]} visible={false}>
        <meshBasicMaterial color="#67e8f9" />
      </Sphere>

      {/* Right Bundle Branch Impulse */}
      <Sphere ref={rbbSparkRef} args={[0.045, 12, 12]} visible={false}>
        <meshBasicMaterial color="#93c5fd" />
      </Sphere>

      {/* Left Bundle Branch Impulse */}
      <Sphere ref={lbbSparkRef} args={[0.045, 12, 12]} visible={false}>
        <meshBasicMaterial color="#93c5fd" />
      </Sphere>
    </group>
  );
}

// Preload the realistic GLB model
useGLTF.preload('/realistic_human_heart.glb');
