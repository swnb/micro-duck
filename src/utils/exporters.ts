import { ROBOT_JOINTS, ROBOT_PARTS } from '../data/robotManifest';

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateBomCsv(): string {
  const headers = [
    '编号',
    '零件名称',
    '英文名',
    '子系统',
    '类别',
    '数量',
    '单价(RMB)',
    '小计(RMB)',
    '单件重量(g)',
    '总重(g)',
    '尺寸',
    '电气标签',
    'CAD文件名',
    '打印耗材',
    '层高(mm)',
    '壁厚',
    '填充(%)',
  ];

  const rows = ROBOT_PARTS.map((p) => [
    p.code,
    p.nameZh,
    p.nameEn,
    p.subsystem,
    p.category,
    String(p.quantity),
    p.unitPriceCny.toFixed(1),
    (p.unitPriceCny * p.quantity).toFixed(1),
    p.weightGrams.toFixed(1),
    (p.weightGrams * p.quantity).toFixed(1),
    p.dimensionsMm,
    p.electricalTag ?? '',
    p.cadFileName,
    p.printSpec?.material ?? '',
    p.printSpec ? String(p.printSpec.layerHeightMm) : '',
    p.printSpec ? String(p.printSpec.walls) : '',
    p.printSpec ? String(p.printSpec.infillPercent) : '',
  ]);

  const escapeCsv = (val: string) =>
    val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;

  return (
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
  );
}

export function generateManifestJson(): string {
  return JSON.stringify(
    {
      robotName: 'MiniDuck-Edu-8DOF',
      version: '1.0.0',
      coordinateConvention: {
        sceneUnits: '1 unit = 10 mm (Y-up, +Z forward, +X robot left)',
        urdfExport: 'REP-103 standard meters (X forward, Y left, Z up)',
      },
      summary: {
        dof: ROBOT_JOINTS.length,
        totalPartsCount: ROBOT_PARTS.reduce((s, p) => s + p.quantity, 0),
        totalWeightGrams: Number(
          ROBOT_PARTS.reduce((s, p) => s + p.weightGrams * p.quantity, 0).toFixed(1),
        ),
        estimatedCostCny: Number(
          ROBOT_PARTS.reduce((s, p) => s + p.unitPriceCny * p.quantity, 0).toFixed(1),
        ),
      },
      joints: ROBOT_JOINTS,
      parts: ROBOT_PARTS,
    },
    null,
    2,
  );
}

/**
 * Generates a clean REP-103 URDF XML for Gazebo / MuJoCo / Isaac Lab university teaching.
 * Scene conversion: (x_scene, y_scene, z_scene) in cm -> (z*0.01, x*0.01, y*0.01) in meters.
 */
export function generateUrdfXml(): string {
  const toUrdfMeters = (v: [number, number, number]) =>
    `${(v[2] * 0.01).toFixed(4)} ${(v[0] * 0.01).toFixed(4)} ${(v[1] * 0.01).toFixed(4)}`;

  const degToRad = (d: number) => ((d * Math.PI) / 180).toFixed(4);

  const jointXml = ROBOT_JOINTS.map((j) => {
    const [ax, ay, az] = j.axisRobotics;
    return `  <!-- ${j.nameZh} | PCA9685 ${j.channel} | Future Bus ID: ${j.busIdFuture} -->
  <joint name="${j.id}" type="revolute">
    <parent link="${j.parentLink}"/>
    <child link="${j.childLink}"/>
    <origin xyz="${toUrdfMeters(j.pivot)}" rpy="0 0 0"/>
    <axis xyz="${ax} ${ay} ${az}"/>
    <limit lower="${degToRad(j.minDeg)}" upper="${degToRad(j.maxDeg)}" effort="0.20" velocity="6.28"/>
    <dynamics damping="0.02" friction="0.01"/>
  </joint>`;
  }).join('\n\n');

  const uniqueLinks = Array.from(
    new Set(ROBOT_JOINTS.flatMap((j) => [j.parentLink, j.childLink])),
  );

  const linkXml = uniqueLinks
    .map((link) => {
      const mass = link === 'base_link' ? '0.180' : link.includes('foot') ? '0.021' : '0.028';
      return `  <link name="${link}">
    <inertial>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <mass value="${mass}"/>
      <inertia ixx="0.00012" ixy="0" ixz="0" iyy="0.00012" iyz="0" izz="0.00012"/>
    </inertial>
    <visual>
      <origin xyz="0 0 0" rpy="0 0 0"/>
      <geometry>
        <mesh filename="package://miniduck_edu/meshes/${link}.stl" scale="0.001 0.001 0.001"/>
      </geometry>
    </visual>
  </link>`;
    })
    .join('\n\n');

  return `<?xml version="1.0"?>
<!-- MiniDuck-Edu 8-DOF Teaching Biped URDF (REP-103: +X Forward, +Y Left, +Z Up) -->
<!-- Actuator Baseline: 8x MG90S (~0.20 N*m stall torque at 5V) + ESP32 + PCA9685 + IMU -->
<robot name="miniduck_edu_8dof">

${linkXml}

${jointXml}

</robot>
`;
}
