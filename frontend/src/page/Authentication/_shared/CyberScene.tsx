import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

const TRAIL_LEN = 90;

// ─── Rocket with realistic flame, banking, and multi-layer trail ──────────────
const Rocket: React.FC<{ color: THREE.Color }> = ({ color }) => {
  const group      = useRef<THREE.Group>(null!);
  const flameInner = useRef<THREE.Mesh>(null!);
  const flameMid   = useRef<THREE.Mesh>(null!);
  const flameOuter = useRef<THREE.Mesh>(null!);
  const innerMat   = useRef<THREE.MeshBasicMaterial>(null!);
  const midMat     = useRef<THREE.MeshBasicMaterial>(null!);
  const outerMat   = useRef<THREE.MeshBasicMaterial>(null!);
  const glowMat    = useRef<THREE.MeshBasicMaterial>(null!);
  const coreMat    = useRef<THREE.MeshBasicMaterial>(null!);
  const bankSmooth = useRef(0);

  // Shared trail geometry – reused by all three point layers
  const trailGeo = useMemo(() => {
    const buf = new Float32Array(TRAIL_LEN * 3);
    const g   = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(buf, 3));
    return g;
  }, []);

  // Big looping flight path
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    new THREE.Vector3(  2,  3,  13),
    new THREE.Vector3( 12,  5,   3),
    new THREE.Vector3( 13,  0,  -5),
    new THREE.Vector3(  4, -7, -13),
    new THREE.Vector3(-12,  3,  -8),
    new THREE.Vector3(-14,  0,   3),
    new THREE.Vector3( -6, -6,  11),
  ], true, "catmullrom", 0.5), []);

  const up    = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const quat  = useMemo(() => new THREE.Quaternion(), []);

  const white  = useMemo(() => new THREE.Color(3.2, 3.2, 3.0), []);
  const yellow = useMemo(() => new THREE.Color(4.5, 3.2, 0.4), []);
  const orange = useMemo(() => new THREE.Color(3.2, 1.2, 0.05), []);
  const cyan   = useMemo(() => new THREE.Color(0.6, 1.6, 3.2), []);

  useFrame(({ clock }) => {
    const t       = (clock.getElapsedTime() * 0.048) % 1;
    const t2      = clock.getElapsedTime();
    const pos     = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();

    // Base orientation: nose (+Y local) points along travel direction
    quat.setFromUnitVectors(up, tangent);

    // Banking: project curvature onto the rocket's local right axis
    const tN      = (t + 0.005) % 1;
    const tangN   = curve.getTangent(tN).normalize();
    const curvVec = new THREE.Vector3().subVectors(tangN, tangent);
    const localRight = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);
    const rawBank = curvVec.dot(localRight) * -80; // scale → degrees
    bankSmooth.current += (rawBank - bankSmooth.current) * 0.06;
    const bankQ = new THREE.Quaternion().setFromAxisAngle(up, bankSmooth.current * (Math.PI / 180));

    group.current.position.copy(pos);
    group.current.quaternion.copy(quat).multiply(bankQ);

    // Update trail (circular shift into world-space buffer)
    const attr = trailGeo.attributes.position as THREE.BufferAttribute;
    const arr  = attr.array as Float32Array;
    arr.copyWithin(3, 0, (TRAIL_LEN - 1) * 3);
    arr[0] = pos.x; arr[1] = pos.y; arr[2] = pos.z;
    attr.needsUpdate = true;

    // Flame animation – layered high-frequency flicker
    const f1    = Math.sin(t2 * 35) * 0.16 + Math.sin(t2 * 53) * 0.09;
    const flick = 0.75 + f1;
    const pulse = Math.sin(t2 * 18) * 0.18 + 0.82;
    const snap  = Math.random() > 0.96 ? 1.28 : 1.0; // occasional brightness snap

    if (flameInner.current) flameInner.current.scale.set(
      0.88 + Math.sin(t2 * 39) * 0.13,
      (0.82 + Math.sin(t2 * 29) * 0.20) * flick * snap,
      0.88 + Math.sin(t2 * 39) * 0.13,
    );
    if (flameMid.current) flameMid.current.scale.set(
      1 + Math.sin(t2 * 21) * 0.09,
      0.88 + Math.sin(t2 * 27) * 0.15,
      1 + Math.sin(t2 * 21) * 0.09,
    );
    if (flameOuter.current) flameOuter.current.scale.set(
      1 + Math.sin(t2 * 13) * 0.14,
      0.78 + Math.sin(t2 * 17) * 0.26,
      1 + Math.sin(t2 * 13) * 0.14,
    );
    if (innerMat.current) innerMat.current.opacity = Math.min(1, 0.90 * flick * snap);
    if (midMat.current)   midMat.current.opacity   = 0.55 * pulse;
    if (outerMat.current) outerMat.current.opacity = 0.22 * flick;
    if (coreMat.current)  coreMat.current.opacity  = Math.min(1, 0.96 * snap);
    if (glowMat.current)  glowMat.current.opacity  = 0.38 * pulse;
  });

  return (
    <>
      {/* ─── Three-layer trail (outer halo → bright body → hot core) ─── */}
      <points geometry={trailGeo}>
        <pointsMaterial color={orange} size={0.34} transparent opacity={0.15} sizeAttenuation toneMapped={false} />
      </points>
      <points geometry={trailGeo}>
        <pointsMaterial color={orange} size={0.17} transparent opacity={0.58} sizeAttenuation toneMapped={false} />
      </points>
      <points geometry={trailGeo}>
        <pointsMaterial color={yellow} size={0.07} transparent opacity={0.80} sizeAttenuation toneMapped={false} />
      </points>

      {/* ─── Rocket mesh ─── */}
      <group ref={group} scale={0.50}>

        {/* Pointed nose cone */}
        <mesh position={[0, 1.38, 0]}>
          <coneGeometry args={[0.096, 1.10, 8]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* Upper body (slight taper) */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.096, 0.128, 0.84, 10]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* Porthole window */}
        <mesh position={[0.133, 0.70, 0]}>
          <sphereGeometry args={[0.032, 8, 8]} />
          <meshBasicMaterial color={cyan} toneMapped={false} />
        </mesh>

        {/* Color accent band */}
        <mesh position={[0, 0.20, 0]}>
          <cylinderGeometry args={[0.133, 0.133, 0.058, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* Lower body */}
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.133, 0.150, 0.74, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* Engine block */}
        <mesh position={[0, -0.62, 0]}>
          <cylinderGeometry args={[0.172, 0.192, 0.26, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>

        {/* 4 swept delta fins (main panel + leading-edge brace) */}
        {[0, 1, 2, 3].map(i => {
          const a = (i / 4) * Math.PI * 2;
          return (
            <group key={i} rotation={[0, a, 0]}>
              <mesh position={[0.22, -0.56, 0]} rotation={[0, 0, -0.16]}>
                <boxGeometry args={[0.32, 0.52, 0.024]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
              <mesh position={[0.25, -0.32, 0]} rotation={[0, 0, -0.55]}>
                <boxGeometry args={[0.15, 0.30, 0.020]} />
                <meshBasicMaterial color={color} toneMapped={false} />
              </mesh>
            </group>
          );
        })}

        {/* Nozzle bell (expands toward exit) */}
        <mesh position={[0, -0.79, 0]}>
          <cylinderGeometry args={[0.088, 0.168, 0.22, 12]} />
          <meshBasicMaterial color={white} toneMapped={false} />
        </mesh>

        {/* ─── Flame system – 3 layers ─── */}

        {/* Inner core: hot yellow-white */}
        <mesh ref={flameInner} position={[0, -1.02, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.062, 0.65, 8]} />
          <meshBasicMaterial ref={innerMat} color={yellow} transparent opacity={0.90} toneMapped={false} />
        </mesh>

        {/* Mid cone: orange body */}
        <mesh ref={flameMid} position={[0, -1.14, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.124, 1.00, 10]} />
          <meshBasicMaterial ref={midMat} color={orange} transparent opacity={0.55} toneMapped={false} />
        </mesh>

        {/* Outer flare: large semi-transparent exhaust plume */}
        <mesh ref={flameOuter} position={[0, -1.32, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 1.40, 10]} />
          <meshBasicMaterial ref={outerMat} color={orange} transparent opacity={0.22} toneMapped={false} />
        </mesh>

        {/* Engine glow sphere */}
        <mesh position={[0, -0.82, 0]}>
          <sphereGeometry args={[0.26, 12, 12]} />
          <meshBasicMaterial ref={glowMat} color={orange} transparent opacity={0.38} toneMapped={false} />
        </mesh>

        {/* Hot inner core dot */}
        <mesh position={[0, -0.84, 0]}>
          <sphereGeometry args={[0.095, 10, 10]} />
          <meshBasicMaterial ref={coreMat} color={yellow} transparent opacity={0.96} toneMapped={false} />
        </mesh>

      </group>
    </>
  );
};

// ─── Rotating network graph – pushed to the far left ─────────────────────────
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
    // Anchored to the far left of the canvas
    <group position={[-14, 0, 0]}>
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
