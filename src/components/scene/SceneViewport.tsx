import { ComponentRef, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  OrbitControls,
} from '@react-three/drei';
import * as THREE from 'three';
import { PART_BY_ID } from '../../data/robotManifest';
import {
  CircuitDomain,
  CustomCadOverride,
  JointId,
  SubsystemId,
} from '../../types/robot';
import { DuckAssemblyScene } from './DuckAssemblyScene';

export interface SceneViewportProps {
  masterExplode: number;
  subsystemExplode: Record<SubsystemId, number>;
  visibleSubsystems: Record<SubsystemId, boolean>;
  jointAngles: Record<JointId, number>;
  xRayMode: boolean;
  showAxes: boolean;
  showLeaderLines: boolean;
  showHarness: boolean;
  showCoM: boolean;
  showCallouts: boolean;
  activeStep: number | null;
  selectedPartId: string | null;
  selectedWireId: string | null;
  activeDomains: Record<CircuitDomain, boolean>;
  customCadOverrides: Record<string, CustomCadOverride>;
  cameraPreset: 'iso' | 'front' | 'side' | 'top' | null;
  onSelectPart: (partId: string | null) => void;
  onSelectWire: (wireId: string | null) => void;
}

type CameraPresetKey = NonNullable<SceneViewportProps['cameraPreset']>;

const CAMERA_PRESETS: Record<
  CameraPresetKey,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  iso: {
    pos: [30.5, 24.5, 43.5],
    target: [0, 10.8, 0.3],
  },
  front: {
    pos: [0, 11.4, 54.0],
    target: [0, 10.8, 0],
  },
  side: {
    pos: [54.0, 11.4, 0.4],
    target: [0, 10.8, 0.2],
  },
  top: {
    pos: [0, 56.0, 7.5],
    target: [0, 10.0, 0.4],
  },
};

const DEFAULT_TARGET = new THREE.Vector3(0, 10.8, 0.3);

interface CameraRigProps {
  cameraPreset: SceneViewportProps['cameraPreset'];
  selectedPartId: string | null;
  masterExplode: number;
  subsystemExplode: Record<SubsystemId, number>;
}

function StudioCameraRig({
  cameraPreset,
  selectedPartId,
  masterExplode,
  subsystemExplode,
}: CameraRigProps): JSX.Element {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  const desiredPosRef = useRef<THREE.Vector3 | null>(null);
  const desiredTargetRef = useRef<THREE.Vector3 | null>(null);
  const lastPresetRef = useRef<SceneViewportProps['cameraPreset']>(cameraPreset);
  const lastSelectedPartRef = useRef<string | null>(selectedPartId);

  // Trigger smooth camera preset transition when cameraPreset changes
  useEffect(() => {
    if (cameraPreset && cameraPreset !== lastPresetRef.current) {
      const cfg = CAMERA_PRESETS[cameraPreset];
      desiredPosRef.current = new THREE.Vector3(...cfg.pos);
      desiredTargetRef.current = new THREE.Vector3(...cfg.target);
    }
    lastPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  // Subtle focus assist when a user picks a specific part (nudges target gently without hijacking orbit)
  useEffect(() => {
    if (selectedPartId && selectedPartId !== lastSelectedPartRef.current) {
      const part = PART_BY_ID[selectedPartId];
      if (part) {
        const factor = masterExplode * (subsystemExplode[part.subsystem] ?? 1);
        const focusPt = new THREE.Vector3(
          part.focusTarget[0] + part.explodeVector[0] * factor,
          part.focusTarget[1] + part.explodeVector[1] * factor,
          part.focusTarget[2] + part.explodeVector[2] * factor,
        );
        // Blend 48% toward the selected part so the full duck stays nicely framed
        desiredTargetRef.current = DEFAULT_TARGET.clone().lerp(focusPt, 0.48);
        desiredPosRef.current = null;
      }
    }
    lastSelectedPartRef.current = selectedPartId;
  }, [masterExplode, selectedPartId, subsystemExplode]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const d = Math.min(delta, 0.05);

    if (desiredPosRef.current) {
      camera.position.x = THREE.MathUtils.damp(
        camera.position.x,
        desiredPosRef.current.x,
        6.5,
        d,
      );
      camera.position.y = THREE.MathUtils.damp(
        camera.position.y,
        desiredPosRef.current.y,
        6.5,
        d,
      );
      camera.position.z = THREE.MathUtils.damp(
        camera.position.z,
        desiredPosRef.current.z,
        6.5,
        d,
      );
      if (camera.position.distanceTo(desiredPosRef.current) < 0.06) {
        desiredPosRef.current = null;
      }
    }

    if (desiredTargetRef.current) {
      controls.target.x = THREE.MathUtils.damp(
        controls.target.x,
        desiredTargetRef.current.x,
        6.5,
        d,
      );
      controls.target.y = THREE.MathUtils.damp(
        controls.target.y,
        desiredTargetRef.current.y,
        6.5,
        d,
      );
      controls.target.z = THREE.MathUtils.damp(
        controls.target.z,
        desiredTargetRef.current.z,
        6.5,
        d,
      );
      if (controls.target.distanceTo(desiredTargetRef.current) < 0.04) {
        desiredTargetRef.current = null;
      }
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 10.8, 0.3]}
      enableDamping
      dampingFactor={0.075}
      minDistance={12}
      maxDistance={95}
      maxPolarAngle={Math.PI * 0.495}
      onStart={() => {
        // Immediately yield control to user drag/zoom
        desiredPosRef.current = null;
        desiredTargetRef.current = null;
      }}
    />
  );
}

export function SceneViewport(props: SceneViewportProps): JSX.Element {
  const {
    cameraPreset,
    selectedPartId,
    masterExplode,
    subsystemExplode,
    onSelectPart,
    onSelectWire,
  } = props;

  return (
    <div className="relative isolate h-full w-full select-none overflow-hidden bg-[#EEF1F5]">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: CAMERA_PRESETS.iso.pos, fov: 38, near: 0.2, far: 240 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.04,
        }}
        onPointerMissed={() => {
          onSelectPart(null);
          onSelectWire(null);
        }}
      >
        {/* Warm Swiss-CAD Porcelain Drafting Studio Atmosphere */}
        <color attach="background" args={['#EEF1F5']} />
        <fog attach="fog" args={['#EEF1F5', 78, 175]} />

        {/* Procedural Studio Softbox IBL (100% offline, zero external HDR fetch) */}
        <Environment resolution={256} frames={1}>
          <Lightformer
            form="rect"
            intensity={2.1}
            color="#FFFFFF"
            position={[0, 14, 4]}
            rotation={[Math.PI / 2, 0, 0]}
            scale={[22, 16, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.1}
            color="#E0F2FE"
            position={[-16, 8, 6]}
            rotation={[0, Math.PI / 2.2, 0]}
            scale={[14, 10, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.25}
            color="#FFF7ED"
            position={[16, 10, -4]}
            rotation={[0, -Math.PI / 2.2, 0]}
            scale={[14, 10, 1]}
          />
          <Lightformer
            form="ring"
            intensity={0.7}
            color="#F8FAFC"
            position={[0, -6, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={24}
          />
        </Environment>

        {/* Studio Precision 3-Point Rig */}
        <hemisphereLight args={['#FFFFFF', '#DCE3EC', 0.62]} />
        <directionalLight
          position={[14, 24, 18]}
          intensity={1.32}
          color="#FFFDF9"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={4}
          shadow-camera-far={65}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={24}
          shadow-camera-bottom={-8}
          shadow-bias={-0.0003}
          shadow-normalBias={0.03}
        />
        <directionalLight
          position={[-16, 12, -10]}
          intensity={0.45}
          color="#DBEAFE"
        />
        <directionalLight
          position={[0, 14, -18]}
          intensity={0.36}
          color="#FFEDD5"
        />

        {/* Engineering Floor Grid (1 minor cell = 10mm, 1 major section = 50mm) */}
        <Grid
          position={[0, 0.002, 0]}
          args={[80, 80]}
          cellSize={1}
          cellThickness={0.55}
          cellColor="#CBD5E1"
          sectionSize={5}
          sectionThickness={1.05}
          sectionColor="#94A3B8"
          fadeDistance={88}
          fadeStrength={1.5}
          infiniteGrid
        />

        {/* Matte shadow-receiving drafting plate */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.004, 0]}
          receiveShadow
        >
          <planeGeometry args={[120, 120]} />
          <shadowMaterial transparent opacity={0.12} color="#1E293B" />
        </mesh>

        {/* Soft Studio Contact Shadows */}
        <ContactShadows
          position={[0, 0.006, 0]}
          opacity={0.32}
          scale={42}
          blur={2.15}
          far={20}
          resolution={512}
          color="#1E293B"
        />

        {/* 8-DOF BDX MicroDuck Robot Assembly */}
        <DuckAssemblyScene
          masterExplode={props.masterExplode}
          subsystemExplode={props.subsystemExplode}
          visibleSubsystems={props.visibleSubsystems}
          jointAngles={props.jointAngles}
          xRayMode={props.xRayMode}
          showAxes={props.showAxes}
          showLeaderLines={props.showLeaderLines}
          showHarness={props.showHarness}
          showCoM={props.showCoM}
          showCallouts={props.showCallouts}
          activeStep={props.activeStep}
          selectedPartId={props.selectedPartId}
          selectedWireId={props.selectedWireId}
          activeDomains={props.activeDomains}
          customCadOverrides={props.customCadOverrides}
          onSelectPart={props.onSelectPart}
          onSelectWire={props.onSelectWire}
        />

        <StudioCameraRig
          cameraPreset={cameraPreset}
          selectedPartId={selectedPartId}
          masterExplode={masterExplode}
          subsystemExplode={subsystemExplode}
        />
      </Canvas>

      {/* Subtle Swiss-CAD Viewport Scale Corner Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-slate-300/75 bg-white/85 px-2.5 py-1 font-mono text-[10px] text-slate-600 shadow-sm backdrop-blur-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
        <span>SCALE 1:1 · GRID 10 mm</span>
        <span className="text-slate-300">|</span>
        <span>左键旋转 · 右键平移 · 滚轮缩放</span>
      </div>
    </div>
  );
}
