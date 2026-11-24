export type SubsystemId =
  | 'head'
  | 'torso'
  | 'electronics'
  | 'right_leg'
  | 'left_leg'
  | 'hardware';

export type PartCategory =
  | '3d_print_pla'
  | '3d_print_tpu'
  | 'actuator'
  | 'electronics'
  | 'power'
  | 'fastener';

export type JointId =
  | 'r_hip_roll'
  | 'r_hip_pitch'
  | 'r_ankle_roll'
  | 'l_hip_roll'
  | 'l_hip_pitch'
  | 'l_ankle_roll'
  | 'neck_pitch'
  | 'head_yaw';

export type CircuitDomain =
  | 'power_7v4'
  | 'power_5v_servo'
  | 'power_logic'
  | 'gnd'
  | 'i2c'
  | 'pwm';

export type Vec3 = [number, number, number];

export interface PrintSpec {
  material: 'PLA' | 'PLA+' | 'PETG' | 'TPU 95A';
  layerHeightMm: number;
  walls: number;
  infillPercent: number;
  supports: boolean;
  orientation: string;
  estimatedMinutes: number;
}

export interface RobotPartSpec {
  id: string;
  code: string; // e.g., MD-01
  nameZh: string;
  nameEn: string;
  subsystem: SubsystemId;
  category: PartCategory;
  quantity: number;
  unitPriceCny: number;
  weightGrams: number;
  dimensionsMm: string;
  description: string;
  /** Offset added when exploded (in scene units: 1 unit = 10mm) */
  explodeVector: Vec3;
  /** Assembly step number (1..8) */
  assemblyStep: number;
  /** Optional associated joint if this part is an actuator */
  jointId?: JointId;
  /** Optional electrical channel or I2C address badge */
  electricalTag?: string;
  /** 3D print instructions for printed parts */
  printSpec?: PrintSpec;
  /** Fasteners required when installing this part */
  fastenersNote?: string;
  /** Suggested external CAD filename when user swaps procedural part */
  cadFileName: string;
  /** Base assembled anchor point for focus camera & leader line */
  focusTarget: Vec3;
}

export interface JointSpec {
  id: JointId;
  channel: string; // CH0..CH7
  busIdFuture: number; // Reserved bus servo ID for Feetech upgrade
  nameZh: string;
  nameEn: string;
  subsystem: 'right_leg' | 'left_leg' | 'head';
  partId: string;
  /** Local rotation axis in Three.js scene coords (X=Left, Y=Up, Z=Front) */
  axisThree: Vec3;
  /** Standard REP-103 robotics axis (X=Front, Y=Left, Z=Up) */
  axisRobotics: Vec3;
  axisLabel: 'Roll (X_rob)' | 'Pitch (Y_rob)' | 'Yaw (Z_rob)';
  /** Joint pivot position in scene units (1 unit = 10mm) */
  pivot: Vec3;
  minDeg: number;
  maxDeg: number;
  defaultDeg: number;
  trimNote: string;
  parentLink: string;
  childLink: string;
}

export interface AssemblyStepSpec {
  step: number;
  title: string;
  subtitle: string;
  partIds: string[];
  fasteners: string;
  engineeringTip: string;
  recommendedExplode: number;
}

export interface WiringNodeSpec {
  id: string;
  partId: string;
  label: string;
  sublabel: string;
  category: 'power' | 'mcu' | 'driver' | 'sensor' | 'servo';
  /** 2D schematic SVG position (viewBox 0..1080 x 0..640) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** 3D harness anchor in assembled scene coords (1 unit = 10mm) */
  anchor3D: Vec3;
  pins: string[];
  specs: string;
}

export interface WireConnectionSpec {
  id: string;
  fromNodeId: string;
  fromPin: string;
  toNodeId: string;
  toPin: string;
  domain: CircuitDomain;
  label: string;
  wireGauge: string;
  voltageInfo: string;
  color: string;
  /** Intermediate 2D SVG path points (excluding start/end) */
  waypoints2D?: [number, number][];
  /** Custom 2D start/end anchor positions */
  start2D: [number, number];
  end2D: [number, number];
  /** 3D spline control points (assembled coords, 1 unit = 10mm) */
  points3D: Vec3[];
  relatedPartIds: string[];
  safetyNote?: string;
}

export interface PosePreset {
  id: string;
  name: string;
  description: string;
  angles: Record<JointId, number>;
}

export interface CustomCadOverride {
  partId: string;
  fileName: string;
  fileType: 'glb' | 'stl';
  objectUrl: string;
  scale: number;
}
