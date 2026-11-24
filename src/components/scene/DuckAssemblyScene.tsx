import { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import {
  DEFAULT_JOINT_ANGLES,
  JOINT_BY_ID,
  PART_BY_ID,
  ROBOT_PARTS,
  SUBSYSTEM_META,
} from '../../data/robotManifest';
import {
  CircuitDomain,
  CustomCadOverride,
  JointId,
  JointSpec,
  SubsystemId,
  Vec3,
} from '../../types/robot';
import { CustomCadMesh, StepVisualState } from './CustomCadMesh';
import {
  OUTER_SHELL_PART_IDS,
  PartVisualState,
  ProceduralPartMesh,
} from './PartMeshes';
import { WiringHarness3D } from './WiringHarness3D';

export interface DuckAssemblySceneProps {
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
  onSelectPart: (partId: string | null) => void;
  onSelectWire: (wireId: string | null) => void;
}

const DEG2RAD = Math.PI / 180;

// ============================================================================
// Pure Forward Kinematics Helpers (used for grounding, CoM & support polygon)
// ============================================================================
interface KinematicChainResult {
  groundShiftY: number;
  comWorld: THREE.Vector3;
  supportHullXZ: [number, number][];
  comInsideSupport: boolean;
  rFootGrounded: boolean;
  lFootGrounded: boolean;
}

// Local offsets matching the exact hierarchy in DuckAssemblyScene
const R_HIP_ROLL_PIVOT = new THREE.Vector3(-2.1, 7.6, -0.2);
const R_HIP_PITCH_LOCAL = new THREE.Vector3(-1.0, -2.0, 0);
const R_ANKLE_ROLL_LOCAL = new THREE.Vector3(0, -3.75, 0.3);

const L_HIP_ROLL_PIVOT = new THREE.Vector3(2.1, 7.6, -0.2);
const L_HIP_PITCH_LOCAL = new THREE.Vector3(1.0, -2.0, 0);
const L_ANKLE_ROLL_LOCAL = new THREE.Vector3(0, -3.75, 0.3);

const NECK_PITCH_PIVOT = new THREE.Vector3(0, 13.7, 0.1);
const HEAD_YAW_LOCAL = new THREE.Vector3(0, 1.9, 0.2);

// Foot sole 6-point perimeter in ankle_roll local coordinates (bottom of TPU at y=-1.85)
const FOOT_SOLE_LOCAL_CORNERS: THREE.Vector3[] = [
  new THREE.Vector3(-1.45, -1.85, -1.95),
  new THREE.Vector3(1.45, -1.85, -1.95),
  new THREE.Vector3(2.3, -1.85, 2.75),
  new THREE.Vector3(1.15, -1.85, 3.65),
  new THREE.Vector3(-1.15, -1.85, 3.65),
  new THREE.Vector3(-2.3, -1.85, 2.75),
];

type PartLinkGroup =
  | 'base'
  | 'r_hip_u'
  | 'r_shin'
  | 'r_foot'
  | 'l_hip_u'
  | 'l_shin'
  | 'l_foot'
  | 'neck'
  | 'head';

const PART_LINK_MAP: Record<string, PartLinkGroup> = {
  bracket_r_hip_u: 'r_hip_u',
  servo_r_hip_pitch: 'r_hip_u',
  shin_r: 'r_shin',
  servo_r_ankle_roll: 'r_shin',
  foot_r_plate: 'r_foot',
  foot_r_tpu: 'r_foot',

  bracket_l_hip_u: 'l_hip_u',
  servo_l_hip_pitch: 'l_hip_u',
  shin_l: 'l_shin',
  servo_l_ankle_roll: 'l_shin',
  foot_l_plate: 'l_foot',
  foot_l_tpu: 'l_foot',

  neck_link: 'neck',
  servo_head_yaw: 'neck',
  shell_head_dome: 'head',
  head_beak: 'head',
  head_antennas: 'head',
};

const _mIdentity = new THREE.Matrix4();
const _mTrans = new THREE.Matrix4();
const _mRot = new THREE.Matrix4();
const _mRHipU = new THREE.Matrix4();
const _mRShin = new THREE.Matrix4();
const _mRFoot = new THREE.Matrix4();
const _mLHipU = new THREE.Matrix4();
const _mLShin = new THREE.Matrix4();
const _mLFoot = new THREE.Matrix4();
const _mNeck = new THREE.Matrix4();
const _mHead = new THREE.Matrix4();
const _vTmp = new THREE.Vector3();

function buildJointMatrix(
  parent: THREE.Matrix4,
  offset: THREE.Vector3,
  axis: 'x' | 'y' | 'z',
  angleRad: number,
  out: THREE.Matrix4,
): void {
  _mTrans.makeTranslation(offset.x, offset.y, offset.z);
  if (axis === 'x') _mRot.makeRotationX(angleRad);
  else if (axis === 'y') _mRot.makeRotationY(angleRad);
  else _mRot.makeRotationZ(angleRad);
  out.copy(parent).multiply(_mTrans).multiply(_mRot);
}

function cross2D(
  o: [number, number],
  a: [number, number],
  b: [number, number],
): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function computeConvexHull2D(points: [number, number][]): [number, number][] {
  if (points.length <= 3) return points;
  const sorted = [...points].sort((a, b) =>
    a[0] === b[0] ? a[1] - b[1] : a[0] - b[0],
  );
  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      cross2D(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      cross2D(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function isPointInConvexPolygon(
  pt: [number, number],
  hull: [number, number][],
): boolean {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    if (cross2D(a, b, pt) < -0.02) return false;
  }
  return true;
}

function evaluateKinematics(
  anglesDeg: Record<JointId, number>,
): KinematicChainResult {
  // Right leg chain (sign verified against POSE_PRESETS: roll uses -angle around +Z)
  buildJointMatrix(
    _mIdentity,
    R_HIP_ROLL_PIVOT,
    'z',
    -anglesDeg.r_hip_roll * DEG2RAD,
    _mRHipU,
  );
  buildJointMatrix(
    _mRHipU,
    R_HIP_PITCH_LOCAL,
    'x',
    anglesDeg.r_hip_pitch * DEG2RAD,
    _mRShin,
  );
  buildJointMatrix(
    _mRShin,
    R_ANKLE_ROLL_LOCAL,
    'z',
    -anglesDeg.r_ankle_roll * DEG2RAD,
    _mRFoot,
  );

  // Left leg chain
  buildJointMatrix(
    _mIdentity,
    L_HIP_ROLL_PIVOT,
    'z',
    -anglesDeg.l_hip_roll * DEG2RAD,
    _mLHipU,
  );
  buildJointMatrix(
    _mLHipU,
    L_HIP_PITCH_LOCAL,
    'x',
    anglesDeg.l_hip_pitch * DEG2RAD,
    _mLShin,
  );
  buildJointMatrix(
    _mLShin,
    L_ANKLE_ROLL_LOCAL,
    'z',
    -anglesDeg.l_ankle_roll * DEG2RAD,
    _mLFoot,
  );

  // Head chain
  buildJointMatrix(
    _mIdentity,
    NECK_PITCH_PIVOT,
    'x',
    anglesDeg.neck_pitch * DEG2RAD,
    _mNeck,
  );
  buildJointMatrix(
    _mNeck,
    HEAD_YAW_LOCAL,
    'y',
    anglesDeg.head_yaw * DEG2RAD,
    _mHead,
  );

  // Compute lowest foot corners for floor grounding & support polygon
  let rMinY = Infinity;
  let lMinY = Infinity;
  const rCorners: THREE.Vector3[] = [];
  const lCorners: THREE.Vector3[] = [];

  for (const c of FOOT_SOLE_LOCAL_CORNERS) {
    const rw = c.clone().applyMatrix4(_mRFoot);
    if (rw.y < rMinY) rMinY = rw.y;
    rCorners.push(rw);

    const lw = c.clone().applyMatrix4(_mLFoot);
    if (lw.y < lMinY) lMinY = lw.y;
    lCorners.push(lw);
  }

  const lowestY = Math.min(rMinY, lMinY);
  const groundShiftY = -lowestY;
  const rFootGrounded = rMinY - lowestY < 0.28;
  const lFootGrounded = lMinY - lowestY < 0.28;

  const groundedPtsXZ: [number, number][] = [];
  if (rFootGrounded) {
    for (const p of rCorners) groundedPtsXZ.push([p.x, p.z]);
  }
  if (lFootGrounded) {
    for (const p of lCorners) groundedPtsXZ.push([p.x, p.z]);
  }
  const supportHullXZ = computeConvexHull2D(groundedPtsXZ);

  // Compute mass-weighted approximate 3D Center of Mass
  const comWorld = new THREE.Vector3(0, 0, 0);
  let totalMass = 0;

  for (const part of ROBOT_PARTS) {
    const mass = part.weightGrams * part.quantity;
    const link = PART_LINK_MAP[part.id] ?? 'base';
    const [fx, fy, fz] = part.focusTarget;

    if (link === 'base') {
      _vTmp.set(fx, fy, fz);
    } else if (link === 'r_hip_u') {
      _vTmp.set(fx + 2.1, fy - 7.6, fz + 0.2).applyMatrix4(_mRHipU);
    } else if (link === 'r_shin') {
      _vTmp.set(fx + 3.1, fy - 5.6, fz + 0.2).applyMatrix4(_mRShin);
    } else if (link === 'r_foot') {
      _vTmp.set(fx + 3.1, fy - 1.85, fz - 0.1).applyMatrix4(_mRFoot);
    } else if (link === 'l_hip_u') {
      _vTmp.set(fx - 2.1, fy - 7.6, fz + 0.2).applyMatrix4(_mLHipU);
    } else if (link === 'l_shin') {
      _vTmp.set(fx - 3.1, fy - 5.6, fz + 0.2).applyMatrix4(_mLShin);
    } else if (link === 'l_foot') {
      _vTmp.set(fx - 3.1, fy - 1.85, fz - 0.1).applyMatrix4(_mLFoot);
    } else if (link === 'neck') {
      _vTmp.set(fx, fy - 13.7, fz - 0.1).applyMatrix4(_mNeck);
    } else {
      _vTmp.set(fx, fy - 15.6, fz - 0.3).applyMatrix4(_mHead);
    }

    comWorld.addScaledVector(_vTmp, mass);
    totalMass += mass;
  }

  if (totalMass > 0) {
    comWorld.divideScalar(totalMass);
  }
  comWorld.y += groundShiftY;

  const comInsideSupport = isPointInConvexPolygon(
    [comWorld.x, comWorld.z],
    supportHullXZ,
  );

  return {
    groundShiftY,
    comWorld,
    supportHullXZ,
    comInsideSupport,
    rFootGrounded,
    lFootGrounded,
  };
}

// ============================================================================
// Reusable Part Wrapper (smooth explosion, leader line, selection, CAD override)
// ============================================================================
interface PartNodeProps {
  partId: string;
  basePosition: Vec3;
  masterExplode: number;
  subsystemExplode: Record<SubsystemId, number>;
  visibleSubsystems: Record<SubsystemId, boolean>;
  xRayMode: boolean;
  activeStep: number | null;
  selectedPartId: string | null;
  customCadOverrides: Record<string, CustomCadOverride>;
  showLeaderLines: boolean;
  onSelectPart: (partId: string | null) => void;
}

function PartNode({
  partId,
  basePosition,
  masterExplode,
  subsystemExplode,
  visibleSubsystems,
  xRayMode,
  activeStep,
  selectedPartId,
  customCadOverrides,
  showLeaderLines,
  onSelectPart,
}: PartNodeProps): JSX.Element | null {
  const part = PART_BY_ID[partId];
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const subExplode = part ? subsystemExplode[part.subsystem] ?? 1 : 1;
  const explodeFactor = masterExplode * subExplode;

  const targetPos = useMemo<Vec3>(() => {
    if (!part) return basePosition;
    return [
      basePosition[0] + part.explodeVector[0] * explodeFactor,
      basePosition[1] + part.explodeVector[1] * explodeFactor,
      basePosition[2] + part.explodeVector[2] * explodeFactor,
    ];
  }, [basePosition, explodeFactor, part]);

  const initialPosRef = useRef<Vec3>(targetPos);

  useEffect(() => {
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const d = Math.min(delta, 0.05);
    groupRef.current.position.x = THREE.MathUtils.damp(
      groupRef.current.position.x,
      targetPos[0],
      10,
      d,
    );
    groupRef.current.position.y = THREE.MathUtils.damp(
      groupRef.current.position.y,
      targetPos[1],
      10,
      d,
    );
    groupRef.current.position.z = THREE.MathUtils.damp(
      groupRef.current.position.z,
      targetPos[2],
      10,
      d,
    );
  });

  if (!part || !visibleSubsystems[part.subsystem]) return null;

  const isSelected = selectedPartId === partId;
  const stepState: StepVisualState =
    activeStep === null
      ? 'normal'
      : part.assemblyStep === activeStep
        ? 'active'
        : part.assemblyStep < activeStep
          ? 'normal'
          : 'future';

  const visual: PartVisualState = {
    selected: isSelected,
    hovered,
    xRay: xRayMode,
    stepState,
  };

  const override = customCadOverrides[partId];
  const isOuterShell = OUTER_SHELL_PART_IDS.has(partId);

  const explodeDist = Math.hypot(
    part.explodeVector[0],
    part.explodeVector[1],
    part.explodeVector[2],
  );
  const shouldShowLeader =
    showLeaderLines &&
    explodeFactor > 0.03 &&
    explodeDist > 0.05 &&
    stepState !== 'future';

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectPart(partId);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const leaderColor = isSelected
    ? '#EA580C'
    : stepState === 'active'
      ? '#F97316'
      : '#64748B';

  return (
    <group>
      <group
        ref={groupRef}
        position={initialPosRef.current}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {override ? (
          <CustomCadMesh
            override={override}
            selected={isSelected}
            hovered={hovered}
            xRay={xRayMode}
            isOuterShell={isOuterShell}
            stepState={stepState}
            fallbackColor={part.category === '3d_print_tpu' ? '#1E242B' : '#F3EFE6'}
          />
        ) : (
          <ProceduralPartMesh partId={partId} visual={visual} />
        )}
      </group>

      {shouldShowLeader && (
        <group>
          <Line
            points={[basePosition, targetPos]}
            color={leaderColor}
            lineWidth={isSelected ? 1.8 : 1.0}
            dashed
            dashSize={0.28}
            gapSize={0.22}
            transparent
            opacity={isSelected ? 0.92 : 0.48}
          />
          <mesh position={basePosition}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshBasicMaterial color={leaderColor} transparent opacity={0.65} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// Coordinate Frame & Joint Axis Gizmo + Channel Badges (CH0..CH7)
// ============================================================================
function MiniAxisTriad({ length = 1.15 }: { length?: number }): JSX.Element {
  const shaftRadius = length * 0.032;
  const headRadius = length * 0.088;
  const headHeight = length * 0.22;
  const half = length * 0.5;

  return (
    <group>
      {/* +X axis (Red) */}
      <group rotation={[0, 0, -Math.PI / 2]}>
        <mesh position={[0, half, 0]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, length, 8]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        <mesh position={[0, length, 0]}>
          <coneGeometry args={[headRadius, headHeight, 10]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
      </group>
      {/* +Y axis (Green) */}
      <group>
        <mesh position={[0, half, 0]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, length, 8]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
        <mesh position={[0, length, 0]}>
          <coneGeometry args={[headRadius, headHeight, 10]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      </group>
      {/* +Z axis (Blue) */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh position={[0, half, 0]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, length, 8]} />
          <meshBasicMaterial color="#2563EB" />
        </mesh>
        <mesh position={[0, length, 0]}>
          <coneGeometry args={[headRadius, headHeight, 10]} />
          <meshBasicMaterial color="#2563EB" />
        </mesh>
      </group>
    </group>
  );
}

interface JointGizmoProps {
  joint: JointSpec;
  localPosition: Vec3;
  badgeOffset: Vec3;
  showAxes: boolean;
  showCallouts: boolean;
  isSelected: boolean;
  visible: boolean;
  onSelectPart: (partId: string | null) => void;
}

function JointAxisGizmo({
  joint,
  localPosition,
  badgeOffset,
  showAxes,
  showCallouts,
  isSelected,
  visible,
  onSelectPart,
}: JointGizmoProps): JSX.Element | null {
  if (!visible || (!showAxes && !showCallouts)) return null;

  const accentColor = SUBSYSTEM_META[joint.subsystem].color;

  // Orient rotation torus perpendicular to joint.axisThree
  const ringRotation: [number, number, number] =
    joint.axisThree[0] === 1
      ? [0, Math.PI / 2, 0]
      : joint.axisThree[1] === 1
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];

  return (
    <group position={localPosition}>
      {showAxes && (
        <group>
          <MiniAxisTriad length={1.15} />
          {/* Curved rotation indicator arc around active DOF axis */}
          <group rotation={ringRotation}>
            <mesh>
              <torusGeometry args={[0.92, isSelected ? 0.055 : 0.036, 10, 28, Math.PI * 1.45]} />
              <meshBasicMaterial
                color={isSelected ? '#EA580C' : accentColor}
                transparent
                opacity={isSelected ? 0.96 : 0.72}
              />
            </mesh>
            {/* Arrowhead at arc tip */}
            <mesh position={[0.92, 0, 0]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.1, 0.24, 10]} />
              <meshBasicMaterial color={isSelected ? '#EA580C' : accentColor} />
            </mesh>
          </group>
        </group>
      )}

      {showAxes && showCallouts && (
        <Html
          position={badgeOffset}
          center
          distanceFactor={26}
          zIndexRange={[10, 0]}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectPart(joint.partId);
            }}
            className={`pointer-events-auto select-none whitespace-nowrap rounded-full border px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-tight shadow-sm transition-transform hover:scale-110 ${
              isSelected
                ? 'border-orange-500 bg-orange-600 text-white'
                : 'border-slate-300/90 bg-white/90 text-slate-800 backdrop-blur-sm hover:border-orange-400'
            }`}
            title={`${joint.channel} · ${joint.nameZh} (${joint.axisLabel})`}
          >
            {joint.channel}
          </button>
        </Html>
      )}
    </group>
  );
}

function BaseOriginFrame({ showCallouts }: { showCallouts: boolean }): JSX.Element {
  return (
    <group position={[0, 0.05, 0]}>
      <MiniAxisTriad length={2.5} />
      <mesh>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>
      {showCallouts && (
        <Html position={[0, 0.25, -0.9]} center distanceFactor={28} zIndexRange={[5, 0]}>
          <div className="pointer-events-none select-none whitespace-nowrap rounded border border-slate-300/80 bg-white/85 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
            BASE (0,0,0)
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// Dynamic CoM Projection & Support Polygon Floor Overlay
// ============================================================================
interface CoMOverlayProps {
  kinematicsRef: MutableRefObject<KinematicChainResult>;
  showCallouts: boolean;
}

function CoMAndSupportOverlay({
  kinematicsRef,
  showCallouts,
}: CoMOverlayProps): JSX.Element {
  const comOrbRef = useRef<THREE.Group>(null);
  const floorCrossRef = useRef<THREE.Group>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const labelDivRef = useRef<HTMLDivElement>(null);

  const plumbGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(6), 3),
    );
    geom.setAttribute(
      'lineDistance',
      new THREE.BufferAttribute(new Float32Array(2), 1),
    );
    return geom;
  }, []);

  const plumbLine = useMemo(() => {
    const mat = new THREE.LineDashedMaterial({
      color: '#EA580C',
      dashSize: 0.3,
      gapSize: 0.2,
      transparent: true,
      opacity: 0.8,
    });
    return new THREE.Line(plumbGeom, mat);
  }, [plumbGeom]);

  // Fixed-capacity buffer (up to 16 hull vertices) for dynamic dashed support polygon
  const hullGeom = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(16 * 3), 3),
    );
    geom.setAttribute(
      'lineDistance',
      new THREE.BufferAttribute(new Float32Array(16), 1),
    );
    geom.setDrawRange(0, 0);
    return geom;
  }, []);

  const hullMat = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: '#059669',
        dashSize: 0.42,
        gapSize: 0.24,
        transparent: true,
        opacity: 0.88,
      }),
    [],
  );

  const hullLine = useMemo(() => new THREE.Line(hullGeom, hullMat), [hullGeom, hullMat]);

  useEffect(() => {
    return () => {
      plumbGeom.dispose();
      (plumbLine.material as THREE.Material).dispose();
      hullGeom.dispose();
      hullMat.dispose();
    };
  }, [hullGeom, hullMat, plumbGeom, plumbLine]);

  useFrame(() => {
    const k = kinematicsRef.current;
    const { x, y, z } = k.comWorld;

    if (comOrbRef.current) {
      comOrbRef.current.position.set(x, y, z);
    }
    if (floorCrossRef.current) {
      floorCrossRef.current.position.set(x, 0.04, z);
    }

    // Update vertical plumb line in-place (zero per-frame allocations)
    const pAttr = plumbGeom.attributes.position as THREE.BufferAttribute;
    const pDist = plumbGeom.attributes.lineDistance as THREE.BufferAttribute;
    pAttr.setXYZ(0, x, y, z);
    pAttr.setXYZ(1, x, 0.04, z);
    pAttr.needsUpdate = true;
    pDist.setX(0, 0);
    pDist.setX(1, Math.max(0, y - 0.04));
    pDist.needsUpdate = true;

    // Update dashed support polygon hull around grounded foot/feet in-place
    const hull = k.supportHullXZ;
    const hAttr = hullGeom.attributes.position as THREE.BufferAttribute;
    const hDist = hullGeom.attributes.lineDistance as THREE.BufferAttribute;
    if (hull.length >= 3) {
      const count = Math.min(hull.length, 15);
      let accum = 0;
      for (let i = 0; i < count; i++) {
        hAttr.setXYZ(i, hull[i][0], 0.04, hull[i][1]);
        if (i > 0) {
          accum += Math.hypot(
            hull[i][0] - hull[i - 1][0],
            hull[i][1] - hull[i - 1][1],
          );
        }
        hDist.setX(i, accum);
      }
      // Close loop
      hAttr.setXYZ(count, hull[0][0], 0.04, hull[0][1]);
      accum += Math.hypot(
        hull[0][0] - hull[count - 1][0],
        hull[0][1] - hull[count - 1][1],
      );
      hDist.setX(count, accum);
      hAttr.needsUpdate = true;
      hDist.needsUpdate = true;
      hullGeom.setDrawRange(0, count + 1);
    } else {
      hullGeom.setDrawRange(0, 0);
    }

    const statusColor = k.comInsideSupport ? '#059669' : '#DC2626';
    if (ringMatRef.current) {
      ringMatRef.current.color.set(statusColor);
    }
    hullMat.color.set(statusColor);

    if (labelDivRef.current) {
      const xMm = Math.round(x * 10);
      const zMm = Math.round(z * 10);
      labelDivRef.current.textContent = `CoM (${xMm >= 0 ? '+' : ''}${xMm}, ${zMm >= 0 ? '+' : ''}${zMm}) mm`;
    }
  });

  return (
    <group name="com-support-overlay">
      {/* 3D Engineering CoM marker (quarter-toned sphere) */}
      <group ref={comOrbRef}>
        <mesh>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshStandardMaterial
            color="#EA580C"
            emissive="#EA580C"
            emissiveIntensity={0.45}
            roughness={0.3}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.48, 0.04, 10, 24]} />
          <meshBasicMaterial color="#0F172A" />
        </mesh>
      </group>

      {/* Vertical plumb line to floor y=0.04 */}
      <primitive object={plumbLine} />

      {/* Support polygon dashed outline on floor y=0.04 */}
      <primitive object={hullLine} />

      {/* Floor CoM Crosshair Target at y=0.04 */}
      <group ref={floorCrossRef} position={[0, 0.04, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.56, 28]} />
          <meshBasicMaterial ref={ringMatRef} color="#059669" side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.14, 16]} />
          <meshBasicMaterial color="#EA580C" side={THREE.DoubleSide} />
        </mesh>
        {/* Crosshair ticks */}
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[1.55, 0.01, 0.06]} />
          <meshBasicMaterial color="#0F172A" />
        </mesh>
        <mesh position={[0, 0.004, 0]}>
          <boxGeometry args={[0.06, 0.01, 1.55]} />
          <meshBasicMaterial color="#0F172A" />
        </mesh>

        {showCallouts && (
          <Html position={[0, 0.12, 1.15]} center distanceFactor={26} zIndexRange={[8, 0]}>
            <div
              ref={labelDivRef}
              className="pointer-events-none select-none whitespace-nowrap rounded-full border border-emerald-500/40 bg-white/92 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-800 shadow-sm backdrop-blur-sm"
            >
              CoM (0, 0) mm
            </div>
          </Html>
        )}
      </group>
    </group>
  );
}

// ============================================================================
// Main 8-DOF Hierarchical Duck Assembly Scene
// ============================================================================
export function DuckAssemblyScene({
  masterExplode,
  subsystemExplode,
  visibleSubsystems,
  jointAngles,
  xRayMode,
  showAxes,
  showLeaderLines,
  showHarness,
  showCoM,
  showCallouts,
  activeStep,
  selectedPartId,
  selectedWireId,
  activeDomains,
  customCadOverrides,
  onSelectPart,
  onSelectWire,
}: DuckAssemblySceneProps): JSX.Element {
  const robotRootRef = useRef<THREE.Group>(null);
  const rHipRollRef = useRef<THREE.Group>(null);
  const rHipPitchRef = useRef<THREE.Group>(null);
  const rAnkleRollRef = useRef<THREE.Group>(null);
  const lHipRollRef = useRef<THREE.Group>(null);
  const lHipPitchRef = useRef<THREE.Group>(null);
  const lAnkleRollRef = useRef<THREE.Group>(null);
  const neckPitchRef = useRef<THREE.Group>(null);
  const headYawRef = useRef<THREE.Group>(null);

  const animatedAnglesRef = useRef<Record<JointId, number>>({
    ...DEFAULT_JOINT_ANGLES,
  });
  const kinematicsRef = useRef<KinematicChainResult>(
    evaluateKinematics(DEFAULT_JOINT_ANGLES),
  );

  // Smoothly damp all 8 joint angles + keep supporting foot grounded on y=0
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const cur = animatedAnglesRef.current;

    (Object.keys(DEFAULT_JOINT_ANGLES) as JointId[]).forEach((jid) => {
      cur[jid] = THREE.MathUtils.damp(cur[jid], jointAngles[jid] ?? 0, 9.5, d);
    });

    if (rHipRollRef.current) rHipRollRef.current.rotation.z = -cur.r_hip_roll * DEG2RAD;
    if (rHipPitchRef.current) rHipPitchRef.current.rotation.x = cur.r_hip_pitch * DEG2RAD;
    if (rAnkleRollRef.current) rAnkleRollRef.current.rotation.z = -cur.r_ankle_roll * DEG2RAD;

    if (lHipRollRef.current) lHipRollRef.current.rotation.z = -cur.l_hip_roll * DEG2RAD;
    if (lHipPitchRef.current) lHipPitchRef.current.rotation.x = cur.l_hip_pitch * DEG2RAD;
    if (lAnkleRollRef.current) lAnkleRollRef.current.rotation.z = -cur.l_ankle_roll * DEG2RAD;

    if (neckPitchRef.current) neckPitchRef.current.rotation.x = cur.neck_pitch * DEG2RAD;
    if (headYawRef.current) headYawRef.current.rotation.y = cur.head_yaw * DEG2RAD;

    const kin = evaluateKinematics(cur);
    kinematicsRef.current = kin;

    if (robotRootRef.current) {
      robotRootRef.current.position.y = kin.groundShiftY;
    }
  });

  const sharedPartProps = {
    masterExplode,
    subsystemExplode,
    visibleSubsystems,
    xRayMode,
    activeStep,
    selectedPartId,
    customCadOverrides,
    showLeaderLines,
    onSelectPart,
  };

  return (
    <group name="duck-studio-world">
      {showAxes && <BaseOriginFrame showCallouts={showCallouts} />}

      {showCoM && (
        <CoMAndSupportOverlay
          kinematicsRef={kinematicsRef}
          showCallouts={showCallouts}
        />
      )}

      {/* Grounded 8-DOF Robot Assembly Root */}
      <group ref={robotRootRef} name="miniduck-robot-root">
        {/* ==================== BASE LINK (Torso, Electronics, Hardware) ==================== */}
        <PartNode partId="chassis_pelvis" basePosition={[0, 7.8, -0.2]} {...sharedPartProps} />
        <PartNode partId="electronics_deck" basePosition={[0, 10.1, 0]} {...sharedPartProps} />
        <PartNode partId="shell_torso_front" basePosition={[0, 10.5, 2.35]} {...sharedPartProps} />
        <PartNode partId="shell_torso_back" basePosition={[0, 10.5, -2.35]} {...sharedPartProps} />
        <PartNode partId="wing_r_trim" basePosition={[-4.35, 10.6, 0]} {...sharedPartProps} />
        <PartNode partId="wing_l_trim" basePosition={[4.35, 10.6, 0]} {...sharedPartProps} />

        <PartNode partId="battery_2s_18650" basePosition={[0, 8.75, -0.9]} {...sharedPartProps} />
        <PartNode partId="module_ubec_5v" basePosition={[-2.25, 9.5, -0.35]} {...sharedPartProps} />
        <PartNode partId="pcb_pca9685" basePosition={[0, 10.55, 1.3]} {...sharedPartProps} />
        <PartNode partId="pcb_esp32" basePosition={[0, 11.9, -0.5]} {...sharedPartProps} />
        <PartNode partId="sensor_imu" basePosition={[1.6, 10.5, -1.3]} {...sharedPartProps} />

        <PartNode partId="hw_standoffs" basePosition={[0, 9.05, 0]} {...sharedPartProps} />
        <PartNode partId="hw_fastener_kit" basePosition={[0, 7.6, 2.35]} {...sharedPartProps} />

        {/* Base-mounted actuator servos */}
        <PartNode partId="servo_r_hip_roll" basePosition={[-2.1, 7.6, -0.2]} {...sharedPartProps} />
        <PartNode partId="servo_l_hip_roll" basePosition={[2.1, 7.6, -0.2]} {...sharedPartProps} />
        <PartNode partId="servo_neck_pitch" basePosition={[0, 13.7, 0.1]} {...sharedPartProps} />

        {/* Base-mounted joint gizmos (CH0, CH3, CH6) */}
        <JointAxisGizmo
          joint={JOINT_BY_ID.r_hip_roll}
          localPosition={[-2.1, 7.6, -0.2]}
          badgeOffset={[-1.45, 0.65, 0.8]}
          showAxes={showAxes}
          showCallouts={showCallouts}
          isSelected={selectedPartId === 'servo_r_hip_roll'}
          visible={visibleSubsystems.right_leg}
          onSelectPart={onSelectPart}
        />
        <JointAxisGizmo
          joint={JOINT_BY_ID.l_hip_roll}
          localPosition={[2.1, 7.6, -0.2]}
          badgeOffset={[1.45, 0.65, 0.8]}
          showAxes={showAxes}
          showCallouts={showCallouts}
          isSelected={selectedPartId === 'servo_l_hip_roll'}
          visible={visibleSubsystems.left_leg}
          onSelectPart={onSelectPart}
        />
        <JointAxisGizmo
          joint={JOINT_BY_ID.neck_pitch}
          localPosition={[0, 13.7, 0.1]}
          badgeOffset={[1.85, 0.25, 0.4]}
          showAxes={showAxes}
          showCallouts={showCallouts}
          isSelected={selectedPartId === 'servo_neck_pitch'}
          visible={visibleSubsystems.head}
          onSelectPart={onSelectPart}
        />

        {/* ==================== RIGHT LEG KINEMATIC CHAIN (3 DOF) ==================== */}
        <group ref={rHipRollRef} position={[-2.1, 7.6, -0.2]}>
          <PartNode
            partId="bracket_r_hip_u"
            basePosition={[-0.6, -1.0, 0]}
            {...sharedPartProps}
          />
          <PartNode
            partId="servo_r_hip_pitch"
            basePosition={[-1.0, -2.0, 0]}
            {...sharedPartProps}
          />

          <JointAxisGizmo
            joint={JOINT_BY_ID.r_hip_pitch}
            localPosition={[-1.0, -2.0, 0]}
            badgeOffset={[-1.75, 0.15, 0.4]}
            showAxes={showAxes}
            showCallouts={showCallouts}
            isSelected={selectedPartId === 'servo_r_hip_pitch'}
            visible={visibleSubsystems.right_leg}
            onSelectPart={onSelectPart}
          />

          <group ref={rHipPitchRef} position={[-1.0, -2.0, 0]}>
            <PartNode
              partId="shin_r"
              basePosition={[0, -1.9, -0.1]}
              {...sharedPartProps}
            />
            <PartNode
              partId="servo_r_ankle_roll"
              basePosition={[0, -3.75, 0.3]}
              {...sharedPartProps}
            />

            <JointAxisGizmo
              joint={JOINT_BY_ID.r_ankle_roll}
              localPosition={[0, -3.75, 0.3]}
              badgeOffset={[-1.75, 0.15, 0.6]}
              showAxes={showAxes}
              showCallouts={showCallouts}
              isSelected={selectedPartId === 'servo_r_ankle_roll'}
              visible={visibleSubsystems.right_leg}
              onSelectPart={onSelectPart}
            />

            <group ref={rAnkleRollRef} position={[0, -3.75, 0.3]}>
              <PartNode
                partId="foot_r_plate"
                basePosition={[0, -1.0, 0.6]}
                {...sharedPartProps}
              />
              <PartNode
                partId="foot_r_tpu"
                basePosition={[0, -1.67, 0.6]}
                {...sharedPartProps}
              />
            </group>
          </group>
        </group>

        {/* ==================== LEFT LEG KINEMATIC CHAIN (3 DOF) ==================== */}
        <group ref={lHipRollRef} position={[2.1, 7.6, -0.2]}>
          <PartNode
            partId="bracket_l_hip_u"
            basePosition={[0.6, -1.0, 0]}
            {...sharedPartProps}
          />
          <PartNode
            partId="servo_l_hip_pitch"
            basePosition={[1.0, -2.0, 0]}
            {...sharedPartProps}
          />

          <JointAxisGizmo
            joint={JOINT_BY_ID.l_hip_pitch}
            localPosition={[1.0, -2.0, 0]}
            badgeOffset={[1.75, 0.15, 0.4]}
            showAxes={showAxes}
            showCallouts={showCallouts}
            isSelected={selectedPartId === 'servo_l_hip_pitch'}
            visible={visibleSubsystems.left_leg}
            onSelectPart={onSelectPart}
          />

          <group ref={lHipPitchRef} position={[1.0, -2.0, 0]}>
            <PartNode
              partId="shin_l"
              basePosition={[0, -1.9, -0.1]}
              {...sharedPartProps}
            />
            <PartNode
              partId="servo_l_ankle_roll"
              basePosition={[0, -3.75, 0.3]}
              {...sharedPartProps}
            />

            <JointAxisGizmo
              joint={JOINT_BY_ID.l_ankle_roll}
              localPosition={[0, -3.75, 0.3]}
              badgeOffset={[1.75, 0.15, 0.6]}
              showAxes={showAxes}
              showCallouts={showCallouts}
              isSelected={selectedPartId === 'servo_l_ankle_roll'}
              visible={visibleSubsystems.left_leg}
              onSelectPart={onSelectPart}
            />

            <group ref={lAnkleRollRef} position={[0, -3.75, 0.3]}>
              <PartNode
                partId="foot_l_plate"
                basePosition={[0, -1.0, 0.6]}
                {...sharedPartProps}
              />
              <PartNode
                partId="foot_l_tpu"
                basePosition={[0, -1.67, 0.6]}
                {...sharedPartProps}
              />
            </group>
          </group>
        </group>

        {/* ==================== HEAD KINEMATIC CHAIN (2 DOF) ==================== */}
        <group ref={neckPitchRef} position={[0, 13.7, 0.1]}>
          <PartNode
            partId="neck_link"
            basePosition={[0, 1.1, 0.15]}
            {...sharedPartProps}
          />
          <PartNode
            partId="servo_head_yaw"
            basePosition={[0, 1.9, 0.2]}
            {...sharedPartProps}
          />

          <JointAxisGizmo
            joint={JOINT_BY_ID.head_yaw}
            localPosition={[0, 1.9, 0.2]}
            badgeOffset={[-1.85, 0.3, 0.4]}
            showAxes={showAxes}
            showCallouts={showCallouts}
            isSelected={selectedPartId === 'servo_head_yaw'}
            visible={visibleSubsystems.head}
            onSelectPart={onSelectPart}
          />

          <group ref={headYawRef} position={[0, 1.9, 0.2]}>
            <PartNode
              partId="shell_head_dome"
              basePosition={[0, 1.6, 0.6]}
              {...sharedPartProps}
            />
            <PartNode
              partId="head_beak"
              basePosition={[0, 0.8, 3.3]}
              {...sharedPartProps}
            />
            <PartNode
              partId="head_antennas"
              basePosition={[0, 3.4, 0]}
              {...sharedPartProps}
            />
          </group>
        </group>

        {/* ==================== 3D INTERACTIVE WIRING HARNESS ==================== */}
        {showHarness && (
          <WiringHarness3D
            activeDomains={activeDomains}
            selectedWireId={selectedWireId}
            selectedPartId={selectedPartId}
            masterExplode={masterExplode}
            subsystemExplode={subsystemExplode}
            visibleSubsystems={visibleSubsystems}
            onSelectWire={onSelectWire}
          />
        )}
      </group>
    </group>
  );
}
