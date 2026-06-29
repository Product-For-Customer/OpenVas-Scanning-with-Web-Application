import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const TRAIL_LEN = 60;

// ─── Rocket with glowing trail ────────────────────────────────────────────────
const Rocket: React.FC<{ color: THREE.Color }> = ({ color }) => {
  const group     = useRef<THREE.Group>(null!);
  const innerGlow = useRef<THREE.MeshBasicMaterial>(null!);
  const outerGlow = useRef<THREE.MeshBasicMaterial>(null!);
  const flameCone = useRef<THREE.Mesh>(null!);

  // Trail: a BufferGeometry in world space updated every frame
  const trailGeo = useMemo(() => {
    const buf = new Float32Array(TRAIL_LEN * 3);
    const g   = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf, 3));
    return g;
  }, []);

  // Big looping flight path around the scene
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(  2,  3,  13),
    new THREE.Vector3( 12,  5,   3),
    new THREE.Vector3( 13,  0,  -5),
    new THREE.Vector3(  4, -7, -13),
    new THREE.Vector3(-12,  3,  -8),
    new THREE.Vector3(-14,  0,   3),
    new THREE.Vector3( -6, -6,  11),
  ], true, "catmullrom", 0.5), []);

  const up     = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat   = useMemo(() => new THREE.Quaternion(), []);
  const white  = useMemo(() => new THREE.Color(2.6, 2.6, 2.6), []);
  const cyan   = useMemo(() => new THREE.Color(1.2, 2.2, 2.6), []);
  const flame  = useMemo(() => new THREE.Color(3.0, 1.4, 0.1), []);
  const flameO = useMemo(() => new THREE.Color(1.8, 0.45, 0.0), []);

  useFrame(({ clock }) => {
    const t       = (clock.getElapsedTime() * 0.048) % 1;
    const pos     = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    // Move & orient rocket — nose (+Y) points in direction of travel
    group.current.position.copy(pos);
    quat.setFromUnitVectors(up, tangent);
    group.current.quaternion.copy(quat);

    // Prepend current world position into trail buffer (circular shift right)
    const attr = trailGeo.attributes.position as THREE.BufferAttribute;
    const arr  = attr.array as Float32Array;
    arr.copyWithin(3, 0, (TRAIL_LEN - 1) * 3);
    arr[0] = pos.x;
    arr[1] = pos.y;
    arr[2] = pos.z;
    attr.needsUpdate = true;

    // Animate engine flame
    const t2    = clock.getElapsedTime();
    const pulse = Math.sin(t2 * 15) * 0.28 + 0.72;
    if (innerGlow.current) innerGlow.current.opacity = pulse;
    if (outerGlow.current) outerGlow.current.opacity = pulse * 0.40;
    if (flameCone.current) {
      flameCone.current.scale.set(1, 0.86 + Math.sin(t2 * 22) * 0.16, 1);
    }
  });

  return (
    <>
      {/* ─── Trail (world-space points, not inside the rocket group) ─── */}
      <points geometry={trailGeo}>
        <pointsMaterial
          color={flameO}
          size={0.13}
          transparent
          opacity={0.52}
          sizeAttenuation
          toneMapped={false}
        />
      </points>

      {/* ─── Rocket mesh ─── */}
      <group ref={group} scale={0.46}>

        {/* Nose cone */}
        <mesh position={[0, 1.12, 0]}>
          <coneGeometry args={[0.14, 0.72, 8]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* Upper body – white */}
        <mesh position={[0, 0.54, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.72, 10]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* Accent color band */}
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.145, 0.145, 0.065, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* Lower body – accent color */}
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.145, 0.158, 0.64, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* Porthole window (cyan glow) */}
        <mesh position={[0.148, 0.50, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color={cyan} toneMapped={false} />
        </mesh>

        {/* Engine skirt */}
        <mesh position={[0, -0.56, 0]}>
          <cylinderGeometry args={[0.19, 0.21, 0.2, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* 4 swept fins */}
        {[0, 1, 2, 3].map(i => {
          const a  = (i / 4) * Math.PI * 2;
          const cx = Math.cos(a);
          const cz = Math.sin(a);
          return (
            <mesh
              key={i}
              position={[cx * 0.24, -0.46, cz * 0.24]}
              rotation={[0, a, -0.30]}
            >
              <boxGeometry args={[0.036, 0.44, 0.30]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
          );
        })}

        {/* Nozzle ring */}
        <mesh position={[0, -0.70, 0]}>
          <cylinderGeometry args={[0.11, 0.14, 0.10, 10]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* Animated flame cone */}
        <mesh ref={flameCone} position={[0, -0.94, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.14, 0.62, 8]} />
          <meshBasicMaterial color={flameO} transparent opacity={0.40} toneMapped={false} />
        </mesh>

        {/* Outer engine glow */}
        <mesh position={[0, -0.73, 0]}>
          <sphereGeometry args={[0.21, 10, 10]} />
          <meshBasicMaterial ref={outerGlow} color={flameO} transparent toneMapped={false} />
        </mesh>

        {/* Inner bright core */}
        <mesh position={[0, -0.70, 0]}>
          <sphereGeometry args={[0.10, 10, 10]} />
          <meshBasicMaterial ref={innerGlow} color={flame} transparent toneMapped={false} />
        </mesh>

      </group>
    </>
  );
};

// ─── Rotating network graph – anchored to the left ────────────────────────────
const Network: React.FC<{ color: THREE.Color }> = ({ color }) => {
  const group = useRef<THREE.Group>(null!);

  const { nodeVecs, edgeGeo } = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N           = 60;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < N; i++) {
      const y   = 1 - (i / (N - 1)) * 2;
      const r   = Math.sqrt(1 - y * y);
      const phi = goldenAngle * i;
      const rad = 5.5 + Math.sin(i * 0.9) * 2.8;
      pts.push(new THREE.Vector3(
        rad * r * Math.cos(phi),
        rad * y,
        rad * r * Math.sin(phi),
      ));
    }

    const edgePositions: number[] = [];
    const CONNECT = 3.8;
    for (let i = 0; i < pts.length; i++) {
      const dists = pts
        .map((p, j) => ({ j, d: pts[i].distanceTo(p) }))
        .filter(({ j, d }) => j !== i && d < CONNECT)
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);
      for (const { j } of dists) {
        if (j > i) {
          edgePositions.push(
            pts[i].x, pts[i].y, pts[i].z,
            pts[j].x, pts[j].y, pts[j].z,
          );
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
    return { nodeVecs: pts, edgeGeo: geo };
  }, []);

  useFrame((_, dt) => {
    group.current.rotation.y += dt * 0.048;
    group.current.rotation.x += dt * 0.016;
  });

  const white = useMemo(() => new THREE.Color(2, 2, 2), []);

  return (
    // Shift the entire network to the left side of the canvas
    <group position={[-5, 0, 0]}>
      <group ref={group}>
        <lineSegments geometry={edgeGeo}>
          <lineBasicMaterial color={color} transparent opacity={0.22} toneMapped={false} />
        </lineSegments>
        {nodeVecs.map((v, i) => {
          const isHub = i % 14 === 0;
          return (
            <mesh key={i} position={v}>
              <sphereGeometry args={[isHub ? 0.15 : 0.072, 10, 10]} />
              <meshBasicMaterial color={isHub ? white : color} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};

// ─── Floating ambient particles ───────────────────────────────────────────────
const Particles: React.FC<{ color: THREE.Color }> = ({ color }) => {
  const geo = useMemo(() => {
    const n   = 300;
    const pos = new Float32Array(n * 3);
    let seed  = 42;
    const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < n * 3; i++) pos[i] = (rng() - 0.5) * 42;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);

  return (
    <points geometry={geo}>
      <pointsMaterial
        color={color}
        size={0.055}
        transparent
        opacity={0.38}
        sizeAttenuation
        toneMapped={false}
      />
    </points>
  );
};

// ─── Exported scene ───────────────────────────────────────────────────────────
export const CyberScene: React.FC<{ color: string }> = ({ color }) => {
  const tc = useMemo(() => new THREE.Color(color), [color]);

  return (
    <Canvas
      camera={{ position: [0, 0, 24], fov: 56 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    >
      <color attach="background" args={["#02050e"]} />

      <Network   color={tc} />
      <Rocket    color={tc} />
      <Particles color={tc} />

      <EffectComposer>
        <Bloom
          luminanceThreshold={0.0}
          luminanceSmoothing={0.9}
          intensity={1.1}
        />
      </EffectComposer>
    </Canvas>
  );
};
