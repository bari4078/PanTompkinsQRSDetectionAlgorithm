import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sphere, Line, MeshWobbleMaterial } from '@react-three/drei';

export default function HeartModel({ currentTime, fs, peaks }) {
  const heartGroup = useRef();
  const saNodeRef = useRef();
  const avNodeRef = useRef();
  const purkinjeRef = useRef();

  // Create a stylized 3D heart shape using Three.js Shape API
  const heartGeometry = useMemo(() => {
    const x = 0, y = 0;
    const heartShape = new THREE.Shape();
    
    heartShape.moveTo( x + 5, y + 5 );
    heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
    heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
    heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
    heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
    heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
    heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );

    const extrudeSettings = { depth: 4, bevelEnabled: true, bevelSegments: 4, steps: 2, bevelSize: 2, bevelThickness: 2 };
    const geometry = new THREE.ExtrudeGeometry( heartShape, extrudeSettings );
    
    // Center and scale the geometry
    geometry.center();
    geometry.scale(0.1, 0.1, 0.1);
    // Rotate so it stands upright
    geometry.rotateX(Math.PI);
    
    return geometry;
  }, []);

  useFrame(() => {
    if (!peaks || peaks.length === 0) return;

    // Convert currentTime (seconds) to samples
    const currentSample = currentTime * fs;
    
    // Find the closest upcoming or just passed R-peak
    // We look for a peak that is within a 300ms window (-200ms to +100ms) of our current time
    let closestPeak = null;
    let minDistance = Infinity;
    
    for (let i = 0; i < peaks.length; i++) {
      const dist = currentSample - peaks[i];
      if (Math.abs(dist) < Math.abs(minDistance)) {
        minDistance = dist;
        closestPeak = peaks[i];
      }
    }

    // Time difference in seconds from the current time to the closest R-peak
    // Negative means we are approaching the peak, positive means we passed it
    const dt = minDistance / fs;
    
    // Default states
    let heartScale = 1.0;
    let saIntensity = 0.2;
    let avIntensity = 0.2;
    let purkinjeIntensity = 0.1;
    
    // 1. SA Node Firing (P-Wave)
    // Occurs roughly 150ms to 100ms before R-peak
    if (dt > -0.18 && dt < -0.10) {
      saIntensity = 2.0; // Flash SA node
    }
    
    // 2. AV Node Firing (PR Segment Delay)
    // Occurs roughly 80ms to 40ms before R-peak
    if (dt > -0.09 && dt < -0.03) {
      avIntensity = 2.0; // Flash AV node
    }
    
    // 3. Purkinje Fibers Firing (QRS Complex)
    // Occurs from -20ms to +40ms around R-peak
    if (dt > -0.02 && dt < 0.05) {
      purkinjeIntensity = 1.5; // Flash Purkinje network
    }
    
    // 4. Ventricular Contraction (Systole)
    // Heart muscle physically contracts (shrinks slightly then pumps out)
    if (dt > 0.0 && dt < 0.15) {
      // Pump calculation: quick shrink then expand
      const pumpPhase = (dt / 0.15); // 0 to 1
      heartScale = 1.0 - Math.sin(pumpPhase * Math.PI) * 0.15;
    }

    // Apply scaling to the heart
    if (heartGroup.current) {
      // Smooth interpolation for the heart scale
      heartGroup.current.scale.lerp(new THREE.Vector3(heartScale, heartScale, heartScale), 0.3);
    }
    
    // Apply intensities
    if (saNodeRef.current) {
      saNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(saNodeRef.current.material.emissiveIntensity, saIntensity, 0.4);
    }
    if (avNodeRef.current) {
      avNodeRef.current.material.emissiveIntensity = THREE.MathUtils.lerp(avNodeRef.current.material.emissiveIntensity, avIntensity, 0.4);
    }
    if (purkinjeRef.current) {
      purkinjeRef.current.material.opacity = THREE.MathUtils.lerp(purkinjeRef.current.material.opacity, purkinjeIntensity, 0.4);
    }
  });

  return (
    <group ref={heartGroup} position={[0, 0, 0]}>
      {/* Heart Muscle */}
      <mesh geometry={heartGeometry}>
        <MeshWobbleMaterial 
          color="#ef4444" 
          roughness={0.4} 
          factor={0.1} 
          speed={2} 
        />
      </mesh>

      {/* SA Node (Top Right Atrium) */}
      <Sphere ref={saNodeRef} args={[0.15, 16, 16]} position={[0.5, 0.8, 0.2]}>
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} toneMapped={false} />
      </Sphere>

      {/* AV Node (Center, between atria and ventricles) */}
      <Sphere ref={avNodeRef} args={[0.12, 16, 16]} position={[-0.2, 0.2, 0]}>
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.2} toneMapped={false} />
      </Sphere>

      {/* Purkinje Fibers (Stylized lines spreading down the ventricles) */}
      <group ref={purkinjeRef}>
        <Line points={[[-0.2, 0.2, 0], [0, -0.5, 0.3], [0.5, -1.0, 0.1]]} color="#60a5fa" lineWidth={3} transparent opacity={0.1} />
        <Line points={[[-0.2, 0.2, 0], [-0.5, -0.4, 0.3], [-0.8, -0.8, 0.1]]} color="#60a5fa" lineWidth={3} transparent opacity={0.1} />
        <Line points={[[-0.2, 0.2, 0], [0.2, -0.6, -0.3], [0.4, -0.9, -0.1]]} color="#60a5fa" lineWidth={3} transparent opacity={0.1} />
      </group>
    </group>
  );
}
