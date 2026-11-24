import { useMemo } from 'react';
import * as THREE from 'three';
import { StepVisualState } from './CustomCadMesh';

export interface PartVisualState {
  selected: boolean;
  hovered: boolean;
  xRay: boolean;
  stepState: StepVisualState;
}

export const OUTER_SHELL_PART_IDS = new Set<string>([
  'shell_torso_front',
  'shell_torso_back',
  'wing_r_trim',
  'wing_l_trim',
  'shell_head_dome',
  'head_beak',
  'head_antennas',
]);

// Swiss-CAD Robotics Material Palette
const COLORS = {
  plaIvory: '#F3EFE6',
  plaIvoryShadow: '#E5DFD2',
  duckOrange: '#EA580C',
  duckOrangeDeep: '#C2410C',
  slateBracket: '#334155',
  slateDark: '#1E293B',
  tpuCharcoal: '#1E242B',
  servoBlue: '#1D63D8',
  servoCap: '#CBD5E1',
  servoHorn: '#F8FAFC',
  brass: '#D4A338',
  steel: '#94A3B8',
  rfSilver: '#D1D5DB',
  espNavy: '#0F294A',
  pcaEmerald: '#047857',
  imuRoyal: '#1D4ED8',
  terminalGreen: '#16A34A',
  xt30Yellow: '#EAB308',
  visorBlack: '#0F172A',
  eyeCyan: '#22D3EE',
  eyeAmber: '#F59E0B',
  ghostSlate: '#94A3B8',
};

interface MatConfig {
  color: string;
  roughness?: number;
  metalness?: number;
  baseOpacity?: number;
  emissiveBase?: string;
  emissiveBaseIntensity?: number;
  shellFade?: boolean;
}

function resolveMatProps(visual: PartVisualState, cfg: MatConfig) {
  const isGhost = visual.stepState === 'future';
  const isXRayShell = Boolean(cfg.shellFade && visual.xRay);
  const baseOpacity = cfg.baseOpacity ?? 1;

  const opacity = isGhost ? 0.14 : isXRayShell ? 0.22 : baseOpacity;
  const transparent = opacity < 0.99;
  const depthWrite = !(isGhost || isXRayShell);

  let emissive = cfg.emissiveBase ?? '#000000';
  let emissiveIntensity = cfg.emissiveBaseIntensity ?? 0;

  if (!isGhost) {
    if (visual.selected) {
      emissive = '#EA580C';
      emissiveIntensity = Math.max(emissiveIntensity, 0.34);
    } else if (visual.stepState === 'active') {
      emissive = '#F97316';
      emissiveIntensity = Math.max(emissiveIntensity, visual.hovered ? 0.26 : 0.15);
    } else if (visual.hovered) {
      emissive = '#0EA5E9';
      emissiveIntensity = Math.max(emissiveIntensity, 0.17);
    }
  }

  return {
    color: isGhost ? COLORS.ghostSlate : cfg.color,
    roughness: cfg.roughness ?? 0.54,
    metalness: cfg.metalness ?? 0.06,
    transparent,
    opacity,
    depthWrite,
    emissive,
    emissiveIntensity,
  };
}

// ============================================================================
// Memoized Sculpted ExtrudeGeometry Builders (cached once per geometry key)
// ============================================================================
const geometryCache = new Map<string, THREE.BufferGeometry>();

function getCachedGeometry(
  key: string,
  factory: () => THREE.BufferGeometry,
): THREE.BufferGeometry {
  const existing = geometryCache.get(key);
  if (existing) return existing;
  const geom = factory();
  geometryCache.set(key, geom);
  return geom;
}

/** Sculpted webbed duck foot outline in XZ plane (extruded along Y) */
function getDuckFootGeometry(isSole: boolean): THREE.BufferGeometry {
  const key = isSole ? 'duck_foot_tpu' : 'duck_foot_pla';
  return getCachedGeometry(key, () => {
    const s = isSole ? 0.96 : 1.0;
    const shape = new THREE.Shape();
    // Shape in XY, then rotated -PI/2 on X so +Y becomes -Z, or +Y becomes +Z
    // We define shape with X = left/right width, Y = forward (+Z) after rotation
    shape.moveTo(-1.35 * s, -2.55 * s);
    shape.quadraticCurveTo(0, -2.85 * s, 1.35 * s, -2.55 * s);
    shape.bezierCurveTo(1.85 * s, -1.5 * s, 2.25 * s, 0.6 * s, 2.38 * s, 2.25 * s);
    // Right-side toe curve -> central webbed toe -> left-side toe curve
    shape.quadraticCurveTo(2.15 * s, 3.05 * s, 1.35 * s, 2.95 * s);
    shape.quadraticCurveTo(0.85 * s, 2.8 * s, 0.55 * s, 3.22 * s);
    shape.quadraticCurveTo(0, 3.45 * s, -0.55 * s, 3.22 * s);
    shape.quadraticCurveTo(-0.85 * s, 2.8 * s, -1.35 * s, 2.95 * s);
    shape.quadraticCurveTo(-2.15 * s, 3.05 * s, -2.38 * s, 2.25 * s);
    shape.bezierCurveTo(-2.25 * s, 0.6 * s, -1.85 * s, -1.5 * s, -1.35 * s, -2.55 * s);

    const depth = isSole ? 0.24 : 0.44;
    const geom = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: isSole ? 0.05 : 0.1,
      bevelThickness: isSole ? 0.05 : 0.1,
    });
    // Rotate so shape +Y maps to +Z (forward toes) and extrusion +Z maps to +Y (up)
    geom.rotateX(Math.PI / 2);
    // Flip Y after rotateX(+PI/2): (x, y, z) -> (x, -z, y) so extrusion goes -Y;
    // translate up so bottom sits nicely centered
    geom.translate(0, depth * 0.5, 0);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Swept avian shin profile in YZ plane (extruded along X) */
function getAvianShinGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('avian_shin', () => {
    // Shape X = Z_world (front +), Shape Y = Y_world (up +)
    // Centered around focusTarget [±3.1, 3.7, -0.3]:
    // Top hip pitch pivot is at local (z=+0.1, y=+1.9)
    // Bottom ankle roll pivot is at local (z=+0.4, y=-1.85)
    const shape = new THREE.Shape();
    shape.moveTo(-0.55, 2.15);
    shape.quadraticCurveTo(0.1, 2.45, 0.68, 2.0);
    // Front swept curve (sleek bird-leg bow backward then forward to ankle)
    shape.bezierCurveTo(0.75, 0.9, 0.28, -0.25, 0.85, -1.45);
    shape.quadraticCurveTo(1.0, -2.15, 0.35, -2.25);
    // Back heel curve
    shape.quadraticCurveTo(-0.42, -2.22, -0.62, -1.55);
    shape.bezierCurveTo(-1.05, -0.25, -0.95, 0.95, -0.55, 2.15);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 1.35,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.14,
      bevelThickness: 0.14,
    });
    // Map Shape X -> World Z, Shape Y -> World Y, Extrude Z -> World X
    geom.translate(0, 0, -0.675);
    geom.rotateY(-Math.PI / 2);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Sculpted BDX duck bill (upper spatula mandible) */
function getDuckBeakUpperGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('duck_beak_upper', () => {
    // Shape in XZ (X = width, Y = forward projection)
    const shape = new THREE.Shape();
    shape.moveTo(-1.75, -0.75);
    shape.bezierCurveTo(-2.1, 0.35, -1.85, 1.55, -1.05, 1.98);
    shape.quadraticCurveTo(0, 2.28, 1.05, 1.98);
    shape.bezierCurveTo(1.85, 1.55, 2.1, 0.35, 1.75, -0.75);
    shape.quadraticCurveTo(0, -1.05, -1.75, -0.75);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.42,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.18,
      bevelThickness: 0.22,
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, 0.34, 0.15);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Sculpted BDX duck bill lower lip */
function getDuckBeakLowerGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('duck_beak_lower', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-1.42, -0.65);
    shape.bezierCurveTo(-1.68, 0.25, -1.42, 1.2, -0.82, 1.55);
    shape.quadraticCurveTo(0, 1.78, 0.82, 1.55);
    shape.bezierCurveTo(1.42, 1.2, 1.68, 0.25, 1.42, -0.65);
    shape.quadraticCurveTo(0, -0.85, -1.42, -0.65);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.12,
      bevelThickness: 0.12,
    });
    geom.rotateX(Math.PI / 2);
    geom.translate(0, -0.18, 0.06);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Stubby cute BDX side wing airfoil panel */
function getSideWingGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('side_wing_panel', () => {
    // Shape X = Z_world (front +), Shape Y = Y_world (up +)
    const shape = new THREE.Shape();
    shape.moveTo(-1.5, 1.85);
    shape.quadraticCurveTo(0.2, 2.25, 1.65, 1.35);
    shape.bezierCurveTo(2.15, 0.55, 1.85, -1.35, 0.75, -1.95);
    shape.quadraticCurveTo(-0.55, -2.35, -1.75, -1.45);
    shape.bezierCurveTo(-2.15, -0.5, -2.05, 1.1, -1.5, 1.85);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.52,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.2,
      bevelThickness: 0.22,
    });
    geom.translate(0, 0, -0.26);
    geom.rotateY(-Math.PI / 2);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Sculpted BDX ear antenna blade */
function getAntennaBladeGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('antenna_blade', () => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.34, 0);
    shape.lineTo(0.34, 0);
    shape.quadraticCurveTo(0.46, 1.15, 0.36, 2.15);
    shape.quadraticCurveTo(0, 2.55, -0.36, 2.15);
    shape.quadraticCurveTo(-0.46, 1.15, -0.34, 0);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: 0.26,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
    geom.translate(0, 0, -0.13);
    geom.computeVertexNormals();
    return geom;
  });
}

/** Rounded BDX torso half-shell (front or back) */
function getTorsoShellHalfGeometry(isFront: boolean): THREE.BufferGeometry {
  const key = isFront ? 'torso_shell_front' : 'torso_shell_back';
  return getCachedGeometry(key, () => {
    // Rounded egg-like shell profile in XY, extruded along Z with deep smooth bevels
    const shape = new THREE.Shape();
    const wTop = 3.25;
    const wMid = 3.85;
    const wBot = 3.15;
    shape.moveTo(-wBot, -2.65);
    shape.quadraticCurveTo(0, -3.05, wBot, -2.65);
    shape.bezierCurveTo(wMid + 0.15, -1.2, wMid + 0.1, 1.25, wTop, 2.55);
    shape.quadraticCurveTo(0, 3.05, -wTop, 2.55);
    shape.bezierCurveTo(-wMid - 0.1, 1.25, -wMid - 0.15, -1.2, -wBot, -2.65);

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: isFront ? 0.55 : 0.65,
      bevelEnabled: true,
      bevelSegments: 5,
      steps: 1,
      bevelSize: 0.42,
      bevelThickness: 0.65,
    });
    geom.center();
    geom.computeVertexNormals();
    return geom;
  });
}

/** Rounded BDX wide dome head profile */
function getHeadDomeGeometry(): THREE.BufferGeometry {
  return getCachedGeometry('head_dome_core', () => {
    const geom = new THREE.SphereGeometry(1, 36, 28);
    // Sculpt into cute slightly flattened, cheek-broad BDX duck droid dome
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      // Base proportions: 7.4 wide (X), 3.6 tall (Y), 6.5 deep (Z)
      x *= 3.72;
      y *= 1.88;
      z *= 3.28;

      // Gently flatten bottom jaw and subtly broaden lower cheeks
      if (y < 0) {
        y *= 0.84;
        x *= 1 + Math.abs(y) * 0.03;
      }
      // Subtle aerodynamic forward brow rounding
      if (z > 0) {
        z *= 1.03;
      }
      pos.setXYZ(i, x, y, z);
    }
    geom.computeVertexNormals();
    return geom;
  });
}

// ============================================================================
// Reusable High-Detail MG90S Servo Component (22.8 × 12.2 × 28.5 mm)
// Local Origin [0, 0, 0] = center of output gear spline, output shaft along +Y!
// ============================================================================
interface MG90SServoProps {
  visual: PartVisualState;
  hornAngleZ?: number;
}

function MG90SServoMesh({ visual, hornAngleZ = 0 }: MG90SServoProps): JSX.Element {
  const isGhost = visual.stepState === 'future';

  // MG90S dimensions (1 unit = 10mm):
  // Body: 2.28 (X) x 2.25 (Y) x 1.22 (Z)
  // Output spline sits at X=0, offset 0.56 from one end -> body center at X = +0.58
  const bodyMat = resolveMatProps(visual, {
    color: COLORS.servoBlue,
    roughness: 0.24,
    metalness: 0.08,
    baseOpacity: 0.86,
  });
  const capMat = resolveMatProps(visual, {
    color: COLORS.servoCap,
    roughness: 0.28,
    metalness: 0.72,
  });
  const brassMat = resolveMatProps(visual, {
    color: COLORS.brass,
    roughness: 0.26,
    metalness: 0.82,
  });
  const hornMat = resolveMatProps(visual, {
    color: COLORS.servoHorn,
    roughness: 0.45,
    metalness: 0.05,
  });
  const screwMat = resolveMatProps(visual, {
    color: COLORS.steel,
    roughness: 0.3,
    metalness: 0.78,
  });

  return (
    <group>
      {/* Translucent cobalt blue lower body */}
      <mesh position={[0.58, -1.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.28, 2.02, 1.22]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* Internal subtle gear silhouette visible through translucent cobalt case */}
      {!isGhost && (
        <mesh position={[0.45, -1.35, 0]}>
          <boxGeometry args={[1.65, 1.2, 0.82]} />
          <meshStandardMaterial color="#1E3A8A" roughness={0.6} metalness={0.35} />
        </mesh>
      )}

      {/* Side mounting ears (flanges, total span 3.22 = 32.2mm) */}
      <mesh position={[0.58, -0.58, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.22, 0.22, 1.22]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>

      {/* M2 mounting screws on both ears */}
      <mesh position={[-0.82, -0.45, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.28, 12]} />
        <meshStandardMaterial {...screwMat} />
      </mesh>
      <mesh position={[1.98, -0.45, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.28, 12]} />
        <meshStandardMaterial {...screwMat} />
      </mesh>

      {/* Brushed aluminum metal gear cap */}
      <mesh position={[0.58, -0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.24, 0.34, 1.18]} />
        <meshStandardMaterial {...capMat} />
      </mesh>

      {/* Stepped main gear turret around spline at X=0 */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <cylinderGeometry args={[0.58, 0.6, 0.28, 20]} />
        <meshStandardMaterial {...capMat} />
      </mesh>
      {/* Secondary idler gear boss */}
      <mesh position={[0.68, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 0.2, 16]} />
        <meshStandardMaterial {...capMat} />
      </mesh>

      {/* Brass output spline shaft */}
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.21, 0.21, 0.32, 16]} />
        <meshStandardMaterial {...brassMat} />
      </mesh>

      {/* White nylon single-arm servo horn */}
      <group position={[0, 0.34, 0]} rotation={[0, hornAngleZ, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.32, 0.32, 0.16, 16]} />
          <meshStandardMaterial {...hornMat} />
        </mesh>
        <mesh position={[0.58, 0, 0]} castShadow>
          <boxGeometry args={[1.18, 0.14, 0.38]} />
          <meshStandardMaterial {...hornMat} />
        </mesh>
        <mesh position={[1.12, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.14, 14]} />
          <meshStandardMaterial {...hornMat} />
        </mesh>
        {/* Center horn screw */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.08, 12]} />
          <meshStandardMaterial {...screwMat} />
        </mesh>
      </group>

      {/* 3-wire ribbon pigtail exit grommet (orange/red/brown) */}
      {!isGhost && (
        <group position={[1.76, -1.9, 0]}>
          <mesh position={[0, 0, 0.14]}>
            <boxGeometry args={[0.22, 0.12, 0.1]} />
            <meshStandardMaterial color="#F97316" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.22, 0.12, 0.1]} />
            <meshStandardMaterial color="#DC2626" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.14]}>
            <boxGeometry args={[0.22, 0.12, 0.1]} />
            <meshStandardMaterial color="#78350F" roughness={0.6} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// Individual High-Craft Part Meshes (All 33 parts in ROBOT_PARTS)
// ============================================================================

function ChassisPelvisMesh({ visual }: { visual: PartVisualState }) {
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.44,
    metalness: 0.22,
  });
  const ivoryMat = resolveMatProps(visual, {
    color: COLORS.plaIvoryShadow,
    roughness: 0.56,
    metalness: 0.05,
  });
  const brassMat = resolveMatProps(visual, {
    color: COLORS.brass,
    roughness: 0.3,
    metalness: 0.78,
  });

  return (
    <group>
      {/* Main structural base deck */}
      <mesh position={[0, -0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.4, 0.48, 5.6]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Front & rear structural stiffening rails */}
      <mesh position={[0, 0.26, 2.45]} castShadow receiveShadow>
        <boxGeometry args={[7.4, 0.52, 0.65]} />
        <meshStandardMaterial {...ivoryMat} />
      </mesh>
      <mesh position={[0, 0.26, -2.45]} castShadow receiveShadow>
        <boxGeometry args={[7.4, 0.52, 0.65]} />
        <meshStandardMaterial {...ivoryMat} />
      </mesh>
      {/* Left & right hip-roll servo bay saddle pockets */}
      <mesh position={[-2.1, -0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.45, 0.85, 2.3]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[2.1, -0.32, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.45, 0.85, 2.3]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Central battery retention side walls */}
      <mesh position={[-1.95, 0.38, -0.7]} castShadow>
        <boxGeometry args={[0.26, 0.72, 3.6]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[1.95, 0.38, -0.7]} castShadow>
        <boxGeometry args={[0.26, 0.72, 3.6]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* 4 corner M3 brass threaded insert bosses */}
      {(
        [
          [-2.85, 0.2, -1.8],
          [2.85, 0.2, -1.8],
          [-2.85, 0.2, 2.0],
          [2.85, 0.2, 2.0],
        ] as [number, number, number][]
      ).map(([x, y, z], idx) => (
        <mesh key={idx} position={[x, y, z]}>
          <cylinderGeometry args={[0.26, 0.26, 0.24, 12]} />
          <meshStandardMaterial {...brassMat} />
        </mesh>
      ))}
    </group>
  );
}

function ElectronicsDeckMesh({ visual }: { visual: PartVisualState }) {
  const plateMat = resolveMatProps(visual, {
    color: COLORS.plaIvoryShadow,
    roughness: 0.52,
    metalness: 0.08,
  });
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.44,
    metalness: 0.22,
  });

  return (
    <group>
      {/* Main electronics intermediate deck */}
      <mesh position={[0, 0, -0.1]} castShadow receiveShadow>
        <boxGeometry args={[7.0, 0.34, 5.2]} />
        <meshStandardMaterial {...plateMat} />
      </mesh>
      {/* Side cable routing guard lips */}
      <mesh position={[-3.38, 0.25, -0.1]} castShadow>
        <boxGeometry args={[0.24, 0.3, 4.4]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[3.38, 0.25, -0.1]} castShadow>
        <boxGeometry args={[0.24, 0.3, 4.4]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Twin internal spine struts supporting the top neck pitch servo cradle */}
      <mesh position={[-1.95, 1.58, 0.1]} castShadow>
        <boxGeometry args={[0.3, 3.05, 0.65]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[1.95, 1.58, 0.1]} castShadow>
        <boxGeometry args={[0.3, 3.05, 0.65]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Upper neck bridge deck at local y=+3.05 (world y=13.15) */}
      <mesh position={[0, 3.08, 0.1]} castShadow receiveShadow>
        <boxGeometry args={[4.25, 0.32, 1.55]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
    </group>
  );
}

function TorsoFrontShellMesh({ visual }: { visual: PartVisualState }) {
  const geom = useMemo(() => getTorsoShellHalfGeometry(true), []);
  const shellMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.54,
    metalness: 0.04,
    shellFade: true,
  });
  const accentMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.4,
    metalness: 0.08,
    shellFade: true,
  });
  const ventMat = resolveMatProps(visual, {
    color: COLORS.slateDark,
    roughness: 0.62,
    metalness: 0.2,
    shellFade: true,
  });

  return (
    <group>
      {/* Rounded BDX chest shell */}
      <mesh geometry={geom} position={[0, 0, -0.18]} castShadow receiveShadow>
        <meshStandardMaterial {...shellMat} />
      </mesh>

      {/* Recessed chest panel bezel */}
      <mesh position={[0, 0.65, 0.78]} castShadow>
        <boxGeometry args={[3.9, 1.45, 0.18]} />
        <meshStandardMaterial {...accentMat} />
      </mesh>
      {/* Crisp ivory center inset nameplate on orange badge */}
      <mesh position={[0, 0.65, 0.89]}>
        <boxGeometry args={[1.45, 0.45, 0.08]} />
        <meshStandardMaterial {...shellMat} />
      </mesh>

      {/* 3 horizontal precision ventilation louvers */}
      {[-0.65, -1.12, -1.59].map((yPos, i) => (
        <mesh key={i} position={[0, yPos, 0.76]}>
          <boxGeometry args={[3.4 - i * 0.35, 0.18, 0.16]} />
          <meshStandardMaterial {...ventMat} />
        </mesh>
      ))}
    </group>
  );
}

function TorsoBackShellMesh({ visual }: { visual: PartVisualState }) {
  const geom = useMemo(() => getTorsoShellHalfGeometry(false), []);
  const shellMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.54,
    metalness: 0.04,
    shellFade: true,
  });
  const darkMat = resolveMatProps(visual, {
    color: COLORS.slateDark,
    roughness: 0.58,
    metalness: 0.22,
    shellFade: true,
  });
  const accentMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.42,
    metalness: 0.06,
    shellFade: true,
  });

  return (
    <group>
      {/* Rounded BDX backpack shell */}
      <mesh geometry={geom} position={[0, 0, 0.18]} castShadow receiveShadow>
        <meshStandardMaterial {...shellMat} />
      </mesh>

      {/* USB-C access window bezel around world y=11.9 (local y=+1.4) */}
      <mesh position={[0, 1.38, -0.82]}>
        <boxGeometry args={[1.4, 0.72, 0.18]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>

      {/* Power rocker switch access slot */}
      <mesh position={[-2.0, -0.95, -0.78]}>
        <boxGeometry args={[0.92, 1.15, 0.2]} />
        <meshStandardMaterial {...darkMat} />
      </mesh>
      <mesh position={[-2.0, -0.95, -0.86]}>
        <boxGeometry args={[0.48, 0.72, 0.14]} />
        <meshStandardMaterial {...accentMat} />
      </mesh>

      {/* Rear cooling ribs */}
      {[0.25, -0.22, -0.69].map((yPos, i) => (
        <mesh key={i} position={[0.85, yPos, -0.8]}>
          <boxGeometry args={[2.5, 0.16, 0.16]} />
          <meshStandardMaterial {...darkMat} />
        </mesh>
      ))}
    </group>
  );
}

function SideWingMesh({
  visual,
  side,
}: {
  visual: PartVisualState;
  side: 'left' | 'right';
}) {
  const geom = useMemo(() => getSideWingGeometry(), []);
  const sign = side === 'left' ? 1 : -1;
  const shellMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.52,
    metalness: 0.04,
    shellFade: true,
  });
  const accentMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.42,
    metalness: 0.06,
    shellFade: true,
  });

  return (
    <group rotation={[0, 0, -sign * 0.14]}>
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial {...shellMat} />
      </mesh>
      {/* Sleek orange stripe along lower wing edge */}
      <mesh position={[sign * 0.42, -0.75, 0.15]} rotation={[0.25, 0, 0]}>
        <boxGeometry args={[0.14, 0.34, 2.4]} />
        <meshStandardMaterial {...accentMat} />
      </mesh>
    </group>
  );
}

function Battery2SMesh({ visual }: { visual: PartVisualState }) {
  const cellMat = resolveMatProps(visual, {
    color: '#2563EB',
    roughness: 0.36,
    metalness: 0.14,
  });
  const kaptonMat = resolveMatProps(visual, {
    color: '#D97706',
    roughness: 0.32,
    metalness: 0.1,
  });
  const strapMat = resolveMatProps(visual, {
    color: COLORS.tpuCharcoal,
    roughness: 0.85,
    metalness: 0.04,
  });
  const metalMat = resolveMatProps(visual, {
    color: COLORS.rfSilver,
    roughness: 0.25,
    metalness: 0.85,
  });
  const xt30Mat = resolveMatProps(visual, {
    color: COLORS.xt30Yellow,
    roughness: 0.42,
    metalness: 0.06,
  });

  return (
    <group>
      {/* Dual cylindrical 2S Li-ion cells lying along X */}
      {[-0.86, 0.86].map((zOff, idx) => (
        <group key={idx} position={[0, 0, zOff]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.82, 0.82, 3.55, 22]} />
            <meshStandardMaterial {...cellMat} />
          </mesh>
          {/* End cap amber Kapton bands */}
          <mesh position={[0, 1.62, 0]}>
            <cylinderGeometry args={[0.835, 0.835, 0.28, 22]} />
            <meshStandardMaterial {...kaptonMat} />
          </mesh>
          <mesh position={[0, -1.62, 0]}>
            <cylinderGeometry args={[0.835, 0.835, 0.28, 22]} />
            <meshStandardMaterial {...kaptonMat} />
          </mesh>
          {/* Metallic end terminals */}
          <mesh position={[0, 1.8, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 16]} />
            <meshStandardMaterial {...metalMat} />
          </mesh>
          <mesh position={[0, -1.8, 0]}>
            <cylinderGeometry args={[0.42, 0.42, 0.08, 16]} />
            <meshStandardMaterial {...metalMat} />
          </mesh>
        </group>
      ))}
      {/* Black Velcro battery retention strap */}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.78, 1.72, 3.44]} />
        <meshStandardMaterial {...strapMat} />
      </mesh>
      {/* Yellow XT30 anti-reverse plug */}
      <mesh position={[-1.92, 0.15, 0.55]} castShadow>
        <boxGeometry args={[0.65, 0.44, 0.78]} />
        <meshStandardMaterial {...xt30Mat} />
      </mesh>
    </group>
  );
}

function Ubec5VMesh({ visual }: { visual: PartVisualState }) {
  const bodyMat = resolveMatProps(visual, {
    color: COLORS.slateDark,
    roughness: 0.45,
    metalness: 0.35,
  });
  const heatsinkMat = resolveMatProps(visual, {
    color: COLORS.rfSilver,
    roughness: 0.28,
    metalness: 0.78,
  });
  const capBodyMat = resolveMatProps(visual, {
    color: '#0F172A',
    roughness: 0.32,
    metalness: 0.18,
  });
  const switchRedMat = resolveMatProps(visual, {
    color: '#DC2626',
    roughness: 0.42,
    metalness: 0.05,
  });

  return (
    <group>
      {/* Main 5V/5A UBEC shielded converter housing */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.95, 2.95]} />
        <meshStandardMaterial {...bodyMat} />
      </mesh>
      {/* Aluminum cooling heatsink ribs on top */}
      {[-0.85, -0.42, 0, 0.42, 0.85].map((zOff, i) => (
        <mesh key={i} position={[0, 0.54, zOff]}>
          <boxGeometry args={[0.98, 0.16, 0.16]} />
          <meshStandardMaterial {...heatsinkMat} />
        </mesh>
      ))}
      {/* Prominent 1000µF radial bulk electrolytic capacitor */}
      <group position={[0.25, 0.15, 1.78]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.42, 0.42, 1.05, 18]} />
          <meshStandardMaterial {...capBodyMat} />
        </mesh>
        {/* Silver polarity stripe + aluminum top vent */}
        <mesh position={[0, 0.535, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.04, 18]} />
          <meshStandardMaterial {...heatsinkMat} />
        </mesh>
        <mesh position={[-0.39, 0, 0]}>
          <boxGeometry args={[0.08, 0.96, 0.18]} />
          <meshStandardMaterial {...heatsinkMat} />
        </mesh>
      </group>
      {/* Red master power rocker switch */}
      <mesh position={[-0.1, -0.05, -1.78]} rotation={[0.2, 0, 0]} castShadow>
        <boxGeometry args={[0.72, 0.78, 0.55]} />
        <meshStandardMaterial {...switchRedMat} />
      </mesh>
    </group>
  );
}

function PcbPca9685Mesh({ visual }: { visual: PartVisualState }) {
  const pcbMat = resolveMatProps(visual, {
    color: COLORS.pcaEmerald,
    roughness: 0.38,
    metalness: 0.14,
  });
  const termMat = resolveMatProps(visual, {
    color: COLORS.terminalGreen,
    roughness: 0.46,
    metalness: 0.05,
  });
  const icMat = resolveMatProps(visual, {
    color: '#0F172A',
    roughness: 0.36,
    metalness: 0.2,
  });
  const metalMat = resolveMatProps(visual, {
    color: COLORS.rfSilver,
    roughness: 0.24,
    metalness: 0.85,
  });
  const pwmYellow = resolveMatProps(visual, { color: '#FACC15', roughness: 0.45 });
  const vccRed = resolveMatProps(visual, { color: '#EF4444', roughness: 0.45 });
  const gndBlack = resolveMatProps(visual, { color: '#1E293B', roughness: 0.5 });

  return (
    <group>
      {/* Emerald PCB substrate (62 × 25 mm) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[6.1, 0.18, 2.45]} />
        <meshStandardMaterial {...pcbMat} />
      </mesh>

      {/* Iconic green V+ / GND 2-pin screw terminal block on -X side */}
      <group position={[-2.35, 0.46, 0.25]}>
        <mesh castShadow>
          <boxGeometry args={[0.92, 0.78, 1.05]} />
          <meshStandardMaterial {...termMat} />
        </mesh>
        <mesh position={[0, 0.41, -0.25]}>
          <cylinderGeometry args={[0.16, 0.16, 0.06, 12]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>
        <mesh position={[0, 0.41, 0.25]}>
          <cylinderGeometry args={[0.16, 0.16, 0.06, 12]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>
      </group>

      {/* Onboard 1000µF filter capacitor next to V+ terminal */}
      <group position={[-1.25, 0.54, -0.58]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.36, 0.36, 0.9, 16]} />
          <meshStandardMaterial {...icMat} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.04, 16]} />
          <meshStandardMaterial {...metalMat} />
        </mesh>
      </group>

      {/* Central PCA9685 TSSOP-28 IC */}
      <mesh position={[0.15, 0.16, -0.55]}>
        <boxGeometry args={[0.92, 0.16, 0.52]} />
        <meshStandardMaterial {...icMat} />
      </mesh>

      {/* 16 colored 3-pin servo headers arranged in 4 neat groups of 4 channels */}
      {[-0.95, 0.25, 1.45, 2.45].map((xBase, bank) => (
        <group key={bank} position={[xBase, 0.34, 0.42]}>
          {/* Yellow PWM signal row */}
          <mesh position={[0, 0, -0.28]}>
            <boxGeometry args={[0.88, 0.46, 0.22]} />
            <meshStandardMaterial {...pwmYellow} />
          </mesh>
          {/* Red 5V V+ row */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.88, 0.46, 0.22]} />
            <meshStandardMaterial {...vccRed} />
          </mesh>
          {/* Black GND row */}
          <mesh position={[0, 0, 0.28]}>
            <boxGeometry args={[0.88, 0.46, 0.22]} />
            <meshStandardMaterial {...gndBlack} />
          </mesh>
        </group>
      ))}

      {/* 6-pin I2C side header on right (+X) edge */}
      <mesh position={[2.82, 0.24, -0.55]}>
        <boxGeometry args={[0.36, 0.32, 1.15]} />
        <meshStandardMaterial {...gndBlack} />
      </mesh>
    </group>
  );
}

function PcbEsp32Mesh({ visual }: { visual: PartVisualState }) {
  const pcbMat = resolveMatProps(visual, {
    color: COLORS.espNavy,
    roughness: 0.36,
    metalness: 0.18,
  });
  const shieldMat = resolveMatProps(visual, {
    color: COLORS.rfSilver,
    roughness: 0.22,
    metalness: 0.88,
  });
  const headerMat = resolveMatProps(visual, {
    color: '#0F172A',
    roughness: 0.52,
    metalness: 0.12,
  });
  const goldMat = resolveMatProps(visual, {
    color: COLORS.brass,
    roughness: 0.25,
    metalness: 0.85,
  });
  const ledMat = resolveMatProps(visual, {
    color: '#38BDF8',
    emissiveBase: '#38BDF8',
    emissiveBaseIntensity: 0.85,
  });

  return (
    <group>
      {/* Deep navy ESP32 DevKit PCB (28 × 50 mm, oriented along Z with USB-C facing -Z) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.78, 0.18, 4.95]} />
        <meshStandardMaterial {...pcbMat} />
      </mesh>

      {/* Brushed silver ESP-WROOM-32 RF shield can */}
      <mesh position={[0, 0.28, 0.65]} castShadow>
        <boxGeometry args={[1.78, 0.36, 1.95]} />
        <meshStandardMaterial {...shieldMat} />
      </mesh>

      {/* PCB meander Wi-Fi antenna area at front (+Z) */}
      <mesh position={[0, 0.12, 2.02]}>
        <boxGeometry args={[1.65, 0.06, 0.68]} />
        <meshStandardMaterial {...headerMat} />
      </mesh>
      <mesh position={[0, 0.16, 2.06]}>
        <boxGeometry args={[1.35, 0.04, 0.14]} />
        <meshStandardMaterial {...goldMat} />
      </mesh>

      {/* Silver USB-C port facing rear (-Z) for easy classroom flashing */}
      <mesh position={[0, 0.24, -2.35]} castShadow>
        <boxGeometry args={[0.92, 0.32, 0.68]} />
        <meshStandardMaterial {...shieldMat} />
      </mesh>

      {/* EN & BOOT tactile micro-buttons */}
      <mesh position={[-0.75, 0.2, -1.82]}>
        <boxGeometry args={[0.32, 0.18, 0.4]} />
        <meshStandardMaterial {...shieldMat} />
      </mesh>
      <mesh position={[0.75, 0.2, -1.82]}>
        <boxGeometry args={[0.32, 0.18, 0.4]} />
        <meshStandardMaterial {...shieldMat} />
      </mesh>

      {/* Status power/telemetry LED */}
      <mesh position={[0.45, 0.16, -1.35]}>
        <boxGeometry args={[0.16, 0.1, 0.22]} />
        <meshStandardMaterial {...ledMat} />
      </mesh>

      {/* Twin 15-pin black female/male headers & standoffs */}
      {[-1.18, 1.18].map((xPos, idx) => (
        <group key={idx}>
          <mesh position={[xPos, -0.34, 0]}>
            <boxGeometry args={[0.26, 0.56, 4.15]} />
            <meshStandardMaterial {...headerMat} />
          </mesh>
          <mesh position={[xPos, 0.2, 0]}>
            <boxGeometry args={[0.18, 0.24, 4.0]} />
            <meshStandardMaterial {...goldMat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SensorImuMesh({ visual }: { visual: PartVisualState }) {
  const pcbMat = resolveMatProps(visual, {
    color: COLORS.imuRoyal,
    roughness: 0.38,
    metalness: 0.15,
  });
  const icMat = resolveMatProps(visual, {
    color: '#0F172A',
    roughness: 0.34,
    metalness: 0.22,
  });
  const silkMat = resolveMatProps(visual, {
    color: '#F8FAFC',
    roughness: 0.4,
    emissiveBase: '#FFFFFF',
    emissiveBaseIntensity: 0.12,
  });
  const goldMat = resolveMatProps(visual, {
    color: COLORS.brass,
    roughness: 0.25,
    metalness: 0.85,
  });

  return (
    <group>
      {/* Compact IMU breakout board (21 × 16 mm) */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.05, 0.16, 1.55]} />
        <meshStandardMaterial {...pcbMat} />
      </mesh>
      {/* Central MEMS QFN chip */}
      <mesh position={[0, 0.14, 0]}>
        <boxGeometry args={[0.48, 0.12, 0.48]} />
        <meshStandardMaterial {...icMat} />
      </mesh>
      {/* Crisp white silkscreen X & Y axis reference arrows on top */}
      <mesh position={[0.42, 0.1, 0.42]}>
        <boxGeometry args={[0.62, 0.03, 0.07]} />
        <meshStandardMaterial {...silkMat} />
      </mesh>
      <mesh position={[0.14, 0.1, 0.14]}>
        <boxGeometry args={[0.07, 0.03, 0.62]} />
        <meshStandardMaterial {...silkMat} />
      </mesh>
      {/* 4-pin I2C header */}
      <mesh position={[-0.78, 0.22, 0]}>
        <boxGeometry args={[0.24, 0.32, 1.1]} />
        <meshStandardMaterial {...goldMat} />
      </mesh>
    </group>
  );
}

function HipUBracketMesh({
  visual,
  side,
}: {
  visual: PartVisualState;
  side: 'left' | 'right';
}) {
  const sign = side === 'left' ? 1 : -1;
  // Centered at local [±0.6, -1.0, 0] relative to hip_roll pivot [±2.1, 7.6, -0.2]
  // So top hip_roll horn is at local [-sign * 0.6, +1.0, 0]
  // Bottom hip_pitch pivot is at local [+sign * 0.4, -1.0, 0]
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.42,
    metalness: 0.26,
  });
  const accentMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.44,
    metalness: 0.08,
  });

  return (
    <group>
      {/* Upper hip-roll mounting flange straddling Z shaft */}
      <mesh position={[-sign * 0.45, 0.92, 0.56]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.88, 0.28]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[-sign * 0.45, 0.92, -0.78]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.88, 0.26]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Stepped outer shoulder bridge connecting down to hip pitch servo */}
      <mesh position={[sign * 0.24, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 2.38, 1.64]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Top cap bridging flange to outer shoulder */}
      <mesh position={[-sign * 0.12, 1.24, -0.1]} castShadow>
        <boxGeometry args={[1.25, 0.3, 1.62]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Lower U-saddle cradle around hip_pitch servo */}
      <mesh position={[-sign * 0.18, -0.88, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.18, 0.32, 1.64]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Subtle orange engineering alignment rib */}
      <mesh position={[sign * 0.47, 0.15, 0]}>
        <boxGeometry args={[0.08, 1.35, 0.24]} />
        <meshStandardMaterial {...accentMat} />
      </mesh>
    </group>
  );
}

function AvianShinMesh({
  visual,
  side,
}: {
  visual: PartVisualState;
  side: 'left' | 'right';
}) {
  const geom = useMemo(() => getAvianShinGeometry(), []);
  const sign = side === 'left' ? 1 : -1;
  const ivoryMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.52,
    metalness: 0.05,
  });
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.44,
    metalness: 0.24,
  });
  const orangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.4,
    metalness: 0.08,
  });

  return (
    <group>
      {/* Main swept avian PLA shin body */}
      <mesh geometry={geom} castShadow receiveShadow>
        <meshStandardMaterial {...ivoryMat} />
      </mesh>

      {/* Upper hip-pitch joint collar hub (at local y=+1.9, z=+0.1) */}
      <mesh position={[0, 1.9, 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.72, 0.72, 1.68, 20]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Outer orange joint cap */}
      <mesh position={[sign * 0.86, 1.9, 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.12, 16]} />
        <meshStandardMaterial {...orangeMat} />
      </mesh>

      {/* Lower ankle servo housing collar (at local y=-1.85, z=+0.4) */}
      <mesh position={[0, -1.75, 0.35]} castShadow>
        <boxGeometry args={[1.64, 0.95, 1.35]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>

      {/* Inner cable routing channel groove detail */}
      <mesh position={[-sign * 0.74, 0.15, -0.35]}>
        <boxGeometry args={[0.16, 2.8, 0.32]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
    </group>
  );
}

function DuckFootPlateMesh({ visual }: { visual: PartVisualState }) {
  const geom = useMemo(() => getDuckFootGeometry(false), []);
  // Local [0, 0, 0] = focusTarget [±3.1, 0.85, 0.7]
  // Ankle pivot is at local [0, +1.0, -0.6]
  const ivoryMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.52,
    metalness: 0.05,
  });
  const orangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.42,
    metalness: 0.06,
  });
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.44,
    metalness: 0.24,
  });

  return (
    <group>
      {/* Wide webbed duck foot structural plate */}
      <mesh geometry={geom} position={[0, -0.35, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...ivoryMat} />
      </mesh>

      {/* Signal-orange webbed toe ridge accent */}
      <mesh position={[0, -0.02, 2.05]} castShadow>
        <boxGeometry args={[3.4, 0.24, 0.85]} />
        <meshStandardMaterial {...orangeMat} />
      </mesh>

      {/* Ankle clevis yoke rising to ankle_roll pivot (local y=+1.0, z=-0.6) */}
      <mesh position={[0, 0.34, -0.6]} castShadow receiveShadow>
        <boxGeometry args={[2.15, 0.56, 2.35]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Front & rear yoke arms straddling the ankle servo */}
      <mesh position={[0, 0.86, 0.38]} castShadow>
        <boxGeometry args={[1.65, 0.96, 0.32]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[0, 0.86, -1.52]} castShadow>
        <boxGeometry args={[1.65, 0.96, 0.32]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Front ankle bearing bolt */}
      <mesh position={[0, 1.0, 0.58]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.14, 16]} />
        <meshStandardMaterial {...orangeMat} />
      </mesh>
    </group>
  );
}

function DuckFootTpuMesh({ visual }: { visual: PartVisualState }) {
  const geom = useMemo(() => getDuckFootGeometry(true), []);
  const tpuMat = resolveMatProps(visual, {
    color: COLORS.tpuCharcoal,
    roughness: 0.86,
    metalness: 0.02,
  });

  return (
    <group>
      {/* Flexible 95A charcoal TPU webbed sole resting flush on y=0 */}
      <mesh geometry={geom} position={[0, -0.02, 0]} castShadow receiveShadow>
        <meshStandardMaterial {...tpuMat} />
      </mesh>
    </group>
  );
}

function NeckLinkMesh({ visual }: { visual: PartVisualState }) {
  // Local [0, 0, 0] = focusTarget [0, 14.8, 0.25]
  // Neck pitch pivot = local [0, -1.1, -0.15]
  // Head yaw servo = local [0, +0.8, +0.05]
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.42,
    metalness: 0.26,
  });
  const orangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.42,
    metalness: 0.06,
  });

  return (
    <group>
      {/* Twin pan-tilt gimbal side arms gripping neck_pitch shaft */}
      <mesh position={[-1.08, -0.25, -0.08]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 2.25, 1.15]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      <mesh position={[1.08, -0.25, -0.08]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 2.25, 1.15]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Upper gimbal cradle deck holding servo_head_yaw */}
      <mesh position={[0, 0.56, 0.05]} castShadow receiveShadow>
        <boxGeometry args={[2.46, 0.42, 2.15]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>
      {/* Neck pivot hub caps */}
      <mesh position={[1.25, -1.1, -0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.1, 16]} />
        <meshStandardMaterial {...orangeMat} />
      </mesh>
      <mesh position={[-1.25, -1.1, -0.15]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 0.1, 16]} />
        <meshStandardMaterial {...orangeMat} />
      </mesh>
    </group>
  );
}

function HeadDomeMesh({ visual }: { visual: PartVisualState }) {
  const domeGeom = useMemo(() => getHeadDomeGeometry(), []);
  const isGhost = visual.stepState === 'future';

  const shellMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.5,
    metalness: 0.04,
    shellFade: true,
  });
  const visorMat = resolveMatProps(visual, {
    color: COLORS.visorBlack,
    roughness: 0.14,
    metalness: 0.42,
    shellFade: true,
  });
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.44,
    metalness: 0.24,
    shellFade: true,
  });
  const cyanLensMat = resolveMatProps(visual, {
    color: COLORS.eyeCyan,
    roughness: 0.15,
    metalness: 0.15,
    emissiveBase: COLORS.eyeCyan,
    emissiveBaseIntensity: isGhost ? 0 : 0.95,
  });
  const amberRingMat = resolveMatProps(visual, {
    color: COLORS.eyeAmber,
    roughness: 0.2,
    metalness: 0.2,
    emissiveBase: COLORS.eyeAmber,
    emissiveBaseIntensity: isGhost ? 0 : 0.72,
  });

  return (
    <group>
      {/* Main cute BDX wide rounded dome head */}
      <mesh geometry={domeGeom} castShadow receiveShadow>
        <meshStandardMaterial {...shellMat} />
      </mesh>

      {/* Subtle neck skirt collar at base */}
      <mesh position={[0, -1.35, -0.35]} castShadow>
        <cylinderGeometry args={[1.55, 1.38, 0.56, 24]} />
        <meshStandardMaterial {...slateMat} />
      </mesh>

      {/* Side temple ear-socket decorative rings */}
      {[-3.62, 3.62].map((xPos, idx) => (
        <mesh key={idx} position={[xPos, 0.08, -0.1]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.72, 0.76, 0.28, 22]} />
          <meshStandardMaterial {...slateMat} />
        </mesh>
      ))}

      {/* Recessed glossy dark obsidian optical visor across front face */}
      <group position={[0, 0.28, 2.78]}>
        <mesh castShadow>
          <boxGeometry args={[4.85, 1.24, 0.78]} />
          <meshStandardMaterial {...visorMat} />
        </mesh>
        {/* Rounded end caps of the visor bar */}
        <mesh position={[-2.42, 0, -0.05]}>
          <cylinderGeometry args={[0.62, 0.62, 0.76, 20]} />
          <meshStandardMaterial {...visorMat} />
        </mesh>
        <mesh position={[2.42, 0, -0.05]}>
          <cylinderGeometry args={[0.62, 0.62, 0.76, 20]} />
          <meshStandardMaterial {...visorMat} />
        </mesh>

        {/* Twin expressive optical eye lenses (glowing cyan ring + amber core) */}
        {[-1.38, 1.38].map((xEye, idx) => (
          <group key={idx} position={[xEye, 0.02, 0.42]}>
            {/* Anodized camera bezel */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.48, 0.52, 0.16, 24]} />
              <meshStandardMaterial {...slateMat} />
            </mesh>
            {/* Glowing cyan optical LED ring */}
            <mesh position={[0, 0, 0.08]}>
              <torusGeometry args={[0.33, 0.065, 12, 28]} />
              <meshStandardMaterial {...cyanLensMat} />
            </mesh>
            {/* Warm amber iris ring */}
            <mesh position={[0, 0, 0.075]}>
              <torusGeometry args={[0.18, 0.045, 10, 24]} />
              <meshStandardMaterial {...amberRingMat} />
            </mesh>
            {/* Glossy dark pupil glass */}
            <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.14, 0.14, 0.08, 18]} />
              <meshStandardMaterial color="#020617" roughness={0.05} metalness={0.8} />
            </mesh>
          </group>
        ))}

        {/* Small center telemetry sensor dot */}
        <mesh position={[0, 0.34, 0.41]}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial {...amberRingMat} />
        </mesh>
      </group>
    </group>
  );
}

function HeadBeakMesh({ visual }: { visual: PartVisualState }) {
  const upperGeom = useMemo(() => getDuckBeakUpperGeometry(), []);
  const lowerGeom = useMemo(() => getDuckBeakLowerGeometry(), []);
  const orangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.38,
    metalness: 0.06,
    shellFade: true,
  });
  const deepOrangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrangeDeep,
    roughness: 0.48,
    metalness: 0.06,
    shellFade: true,
  });

  return (
    <group rotation={[0.06, 0, 0]}>
      {/* Sculpted signal-orange upper duck bill */}
      <mesh geometry={upperGeom} castShadow receiveShadow>
        <meshStandardMaterial {...orangeMat} />
      </mesh>
      {/* Lower mandible with cute subtle smile separation */}
      <mesh geometry={lowerGeom} castShadow receiveShadow>
        <meshStandardMaterial {...deepOrangeMat} />
      </mesh>
      {/* Twin delicate nostril accents on upper beak */}
      {[-0.48, 0.48].map((xPos, i) => (
        <mesh key={i} position={[xPos, 0.56, 0.62]} rotation={[0.12, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.22, 6, 10]} />
          <meshStandardMaterial {...deepOrangeMat} />
        </mesh>
      ))}
    </group>
  );
}

function HeadAntennasMesh({ visual }: { visual: PartVisualState }) {
  const bladeGeom = useMemo(() => getAntennaBladeGeometry(), []);
  const ivoryMat = resolveMatProps(visual, {
    color: COLORS.plaIvory,
    roughness: 0.48,
    metalness: 0.04,
    shellFade: true,
  });
  const slateMat = resolveMatProps(visual, {
    color: COLORS.slateBracket,
    roughness: 0.42,
    metalness: 0.24,
    shellFade: true,
  });
  const orangeMat = resolveMatProps(visual, {
    color: COLORS.duckOrange,
    roughness: 0.38,
    metalness: 0.08,
    shellFade: true,
  });

  return (
    <group>
      {([-1, 1] as const).map((sign) => (
        <group
          key={sign}
          position={[sign * 2.12, -0.32, 0]}
          rotation={[-0.18, sign * 0.14, -sign * 0.42]}
        >
          {/* Rotary ear-socket base collar */}
          <mesh position={[0, 0, 0]} castShadow>
            <cylinderGeometry args={[0.46, 0.52, 0.42, 18]} />
            <meshStandardMaterial {...slateMat} />
          </mesh>
          {/* BDX ear blade */}
          <mesh geometry={bladeGeom} position={[0, 0.15, 0]} castShadow receiveShadow>
            <meshStandardMaterial {...ivoryMat} />
          </mesh>
          {/* Signal-orange ear tip cap */}
          <mesh position={[0, 2.38, 0]} castShadow>
            <boxGeometry args={[0.74, 0.34, 0.36]} />
            <meshStandardMaterial {...orangeMat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BrassStandoffsMesh({ visual }: { visual: PartVisualState }) {
  const brassMat = resolveMatProps(visual, {
    color: COLORS.brass,
    roughness: 0.25,
    metalness: 0.84,
  });
  const steelMat = resolveMatProps(visual, {
    color: COLORS.steel,
    roughness: 0.28,
    metalness: 0.82,
  });

  const corners: [number, number][] = [
    [-2.85, -1.8],
    [2.85, -1.8],
    [-2.85, 2.0],
    [2.85, 2.0],
  ];

  return (
    <group>
      {corners.map(([x, z], idx) => (
        <group key={idx} position={[x, 0, z]}>
          {/* Hexagonal M3x22mm brass standoff */}
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.24, 0.24, 2.08, 6]} />
            <meshStandardMaterial {...brassMat} />
          </mesh>
          {/* Top & bottom M3 steel socket cap screws */}
          <mesh position={[0, 1.18, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.2, 12]} />
            <meshStandardMaterial {...steelMat} />
          </mesh>
          <mesh position={[0, -1.16, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.2, 12]} />
            <meshStandardMaterial {...steelMat} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function FastenerKitMesh({ visual }: { visual: PartVisualState }) {
  const steelMat = resolveMatProps(visual, {
    color: COLORS.steel,
    roughness: 0.24,
    metalness: 0.86,
  });
  const darkSteelMat = resolveMatProps(visual, {
    color: COLORS.slateDark,
    roughness: 0.36,
    metalness: 0.72,
  });
  const xt30Mat = resolveMatProps(visual, {
    color: COLORS.xt30Yellow,
    roughness: 0.42,
    metalness: 0.08,
  });

  return (
    <group>
      {/* Row of M2 / M2.5 stainless socket-head screws seated cleanly along front mount bar */}
      {[-2.2, -1.3, -0.4, 0.4, 1.3, 2.2].map((xPos, idx) => (
        <group key={idx} position={[xPos, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.18, 12]} />
            <meshStandardMaterial {...steelMat} />
          </mesh>
          <mesh position={[0, -0.26, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.42, 10]} />
            <meshStandardMaterial {...darkSteelMat} />
          </mesh>
        </group>
      ))}
      {/* Spare XT30 & cable clamp collar accent */}
      <mesh position={[0, -0.26, 0.15]} castShadow>
        <boxGeometry args={[0.66, 0.34, 0.48]} />
        <meshStandardMaterial {...xt30Mat} />
      </mesh>
    </group>
  );
}

// ============================================================================
// Master Dispatcher Component for All 33 Part IDs
// ============================================================================
export interface ProceduralPartMeshProps {
  partId: string;
  visual: PartVisualState;
}

export function ProceduralPartMesh({
  partId,
  visual,
}: ProceduralPartMeshProps): JSX.Element {
  switch (partId) {
    // Torso & Chassis
    case 'chassis_pelvis':
      return <ChassisPelvisMesh visual={visual} />;
    case 'electronics_deck':
      return <ElectronicsDeckMesh visual={visual} />;
    case 'shell_torso_front':
      return <TorsoFrontShellMesh visual={visual} />;
    case 'shell_torso_back':
      return <TorsoBackShellMesh visual={visual} />;
    case 'wing_r_trim':
      return <SideWingMesh visual={visual} side="right" />;
    case 'wing_l_trim':
      return <SideWingMesh visual={visual} side="left" />;

    // Electronics & Power
    case 'battery_2s_18650':
      return <Battery2SMesh visual={visual} />;
    case 'module_ubec_5v':
      return <Ubec5VMesh visual={visual} />;
    case 'pcb_pca9685':
      return <PcbPca9685Mesh visual={visual} />;
    case 'pcb_esp32':
      return <PcbEsp32Mesh visual={visual} />;
    case 'sensor_imu':
      return <SensorImuMesh visual={visual} />;

    // Right Leg (3 DOF)
    case 'servo_r_hip_roll':
      // Output shaft along +Z, body tucked inward (+X) inside pelvis
      return (
        <group position={[0, 0, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
          <MG90SServoMesh visual={visual} hornAngleZ={Math.PI} />
        </group>
      );
    case 'bracket_r_hip_u':
      return <HipUBracketMesh visual={visual} side="right" />;
    case 'servo_r_hip_pitch':
      // Output shaft along -X (outward), body tucked UP (+Y) & inward (+X) inside U-bracket
      return (
        <group position={[-0.36, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <MG90SServoMesh visual={visual} hornAngleZ={0} />
        </group>
      );
    case 'shin_r':
      return <AvianShinMesh visual={visual} side="right" />;
    case 'servo_r_ankle_roll':
      // Output shaft along +Z, body length tucked UP (+Y) inside narrow shin
      return (
        <group position={[0, 0, 0.25]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
          <MG90SServoMesh visual={visual} hornAngleZ={Math.PI / 2} />
        </group>
      );
    case 'foot_r_plate':
      return <DuckFootPlateMesh visual={visual} />;
    case 'foot_r_tpu':
      return <DuckFootTpuMesh visual={visual} />;

    // Left Leg (3 DOF)
    case 'servo_l_hip_roll':
      // Output shaft along +Z, body tucked inward (-X) inside pelvis
      return (
        <group position={[0, 0, 0.42]} rotation={[Math.PI / 2, Math.PI, 0]}>
          <MG90SServoMesh visual={visual} hornAngleZ={Math.PI} />
        </group>
      );
    case 'bracket_l_hip_u':
      return <HipUBracketMesh visual={visual} side="left" />;
    case 'servo_l_hip_pitch':
      // Output shaft along +X (outward), body tucked UP (+Y) & inward (-X) inside U-bracket
      return (
        <group position={[0.36, 0, 0]} rotation={[Math.PI, 0, -Math.PI / 2]}>
          <MG90SServoMesh visual={visual} hornAngleZ={0} />
        </group>
      );
    case 'shin_l':
      return <AvianShinMesh visual={visual} side="left" />;
    case 'servo_l_ankle_roll':
      // Output shaft along +Z, body length tucked UP (+Y) inside narrow shin
      return (
        <group position={[0, 0, 0.25]} rotation={[Math.PI / 2, Math.PI / 2, 0]}>
          <MG90SServoMesh visual={visual} hornAngleZ={Math.PI / 2} />
        </group>
      );
    case 'foot_l_plate':
      return <DuckFootPlateMesh visual={visual} />;
    case 'foot_l_tpu':
      return <DuckFootTpuMesh visual={visual} />;

    // Head Assembly (2 DOF)
    case 'servo_neck_pitch':
      // Output shaft along +X, body extending downward (-Y) into torso neck cradle
      return (
        <group position={[0.72, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <MG90SServoMesh visual={visual} hornAngleZ={0} />
        </group>
      );
    case 'neck_link':
      return <NeckLinkMesh visual={visual} />;
    case 'servo_head_yaw':
      // Output shaft pointing straight UP (+Y) to drive head dome
      return (
        <group position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <MG90SServoMesh visual={visual} hornAngleZ={0} />
        </group>
      );
    case 'shell_head_dome':
      return <HeadDomeMesh visual={visual} />;
    case 'head_beak':
      return <HeadBeakMesh visual={visual} />;
    case 'head_antennas':
      return <HeadAntennasMesh visual={visual} />;

    // Hardware
    case 'hw_standoffs':
      return <BrassStandoffsMesh visual={visual} />;
    case 'hw_fastener_kit':
      return <FastenerKitMesh visual={visual} />;

    default:
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial {...resolveMatProps(visual, { color: COLORS.plaIvory })} />
        </mesh>
      );
  }
}
