import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { createEarthTextureSet } from "./textures";

type SpaceCanvasProps = {
  /** 0 = just mounted (camera close-in), 1 = settled in its final framing. */
  entrance: number;
};

const EARTH_RADIUS = 2.2;
const CAMERA_START_Z = 4.1;
const CAMERA_END_Z = 7.1;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const textures = useMemo(() => createEarthTextureSet(), []);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.045;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += delta * 0.062;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 128]} />
        <meshStandardMaterial
          map={textures.map}
          bumpMap={textures.bumpMap}
          bumpScale={0.04}
          roughnessMap={textures.roughnessMap}
          roughness={1}
          metalness={0.05}
        />
      </mesh>

      {/* wispy cloud shell, rotating slightly faster than the surface for parallax */}
      <mesh ref={cloudsRef} scale={1.012}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 96]} />
        <meshStandardMaterial
          color="#ffffff"
          alphaMap={textures.cloudsAlphaMap}
          transparent
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* thin atmospheric rim glow */}
      <mesh scale={1.04}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshBasicMaterial color="#5fd0ff" transparent opacity={0.14} side={THREE.BackSide} />
      </mesh>
      <mesh scale={1.09}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshBasicMaterial color="#3fa9ff" transparent opacity={0.06} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function ParallaxRig({ children }: { children: React.ReactNode }) {
  const rig = useRef<THREE.Group>(null);

  useFrame(({ pointer }) => {
    if (!rig.current) return;
    rig.current.rotation.y = THREE.MathUtils.lerp(rig.current.rotation.y, pointer.x * 0.05, 0.04);
    rig.current.rotation.x = THREE.MathUtils.lerp(rig.current.rotation.x, -pointer.y * 0.035, 0.04);
  });

  return <group ref={rig}>{children}</group>;
}

/** Stage 1: cinematic camera pull-back that settles into the final framing. */
function CameraRig({ entrance }: { entrance: number }) {
  useFrame(({ camera }) => {
    const eased = easeOutCubic(entrance);
    camera.position.z = THREE.MathUtils.lerp(CAMERA_START_Z, CAMERA_END_Z, eased);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function SceneLighting() {
  return (
    <>
      {/* dark ambient so the un-lit hemisphere reads as near-black, like a real orbital photo */}
      <ambientLight intensity={0.16} color="#16213f" />
      {/* sharp key light from top-right — this carves the crescent terminator */}
      <directionalLight position={[6, 4, 5]} intensity={3.6} color="#eef5ff" />
      {/* faint cool rim/fill so the dark side isn't pure black */}
      <directionalLight position={[-4, -1, -3]} intensity={0.22} color="#3b82f6" />
    </>
  );
}

const SpaceCanvas: React.FC<SpaceCanvasProps> = ({ entrance }) => {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, CAMERA_START_Z], fov: 40 }}
      className="absolute! inset-0"
    >
      <color attach="background" args={["#01030a"]} />
      <fog attach="fog" args={["#01030a", 9, 18]} />

      <SceneLighting />
      <CameraRig entrance={entrance} />

      <Suspense fallback={null}>
        <ParallaxRig>
          <Stars radius={70} depth={40} count={3200} factor={2.6} saturation={0} fade speed={0.4} />
          <Earth />
        </ParallaxRig>
      </Suspense>
    </Canvas>
  );
};

export default React.memo(SpaceCanvas);
