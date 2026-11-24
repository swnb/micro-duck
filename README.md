# MiniDuck-Edu Studio

Interactive 3D exploded-view assembly, kinematics visualizer, and synchronized 2D/3D wiring studio for an **8-DOF MG90S bipedal teaching robot** (BDX-inspired mini duck silhouette).

**Live Demo (GitHub Pages):** [https://swnb.github.io/micro-duck/](https://swnb.github.io/micro-duck/)

---

## 8-DOF MG90S Architecture

MiniDuck-Edu is designed for university robotics courses, rapid 3D-printed prototyping (PLA+ shells & TPU 95A foot pads), and safe hands-on electronics assembly.

### Kinematic Chain & PCA9685 Channel Map

| Channel | Joint ID | Subsystem | Axis (REP-103) | Range | Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `CH0` | `r_hip_roll` | Right Leg | Roll (`X_rob`) | `-28°` to `+28°` | Lateral weight shift |
| `CH1` | `r_hip_pitch` | Right Leg | Pitch (`Y_rob`) | `-42°` to `+42°` | Fore/aft leg swing |
| `CH2` | `r_ankle_roll` | Right Leg | Roll (`X_rob`) | `-30°` to `+30°` | Foot-ground leveling |
| `CH3` | `l_hip_roll` | Left Leg | Roll (`X_rob`) | `-28°` to `+28°` | Lateral weight shift |
| `CH4` | `l_hip_pitch` | Left Leg | Pitch (`Y_rob`) | `-42°` to `+42°` | Fore/aft leg swing |
| `CH5` | `l_ankle_roll` | Left Leg | Roll (`X_rob`) | `-30°` to `+30°` | Foot-ground leveling |
| `CH6` | `neck_pitch` | Head | Pitch (`Y_rob`) | `-26°` to `+32°` | Head nod & dynamic CoM trim |
| `CH7` | `head_yaw` | Head | Yaw (`Z_rob`) | `-55°` to `+55°` | Expressive yaw rotation |

### Electronics & Power Topology

- **MCU:** ESP32 DevKit (I2C master + Wi-Fi/BLE telemetry)
- **PWM Servo Driver:** PCA9685 16-channel I2C driver (channels `CH0–CH7` active; bus servo IDs reserved for future Feetech upgrades)
- **IMU:** 6-axis IMU module aligned to torso frame
- **Power Rail Isolation:** 2S Li-ion battery pack (`7.4V`) → power switch → high-current `5V` UBEC feeding PCA9685 `V+` servo bus separately from logic power, with common `GND` reference

---

## Key Features

- **Interactive 3D Exploded View:** Smooth master explode slider + per-subsystem explode factors (`head`, `torso`, `electronics`, `right_leg`, `left_leg`, `hardware`), optional dashed CAD leader lines, camera presets (`Iso`, `Front`, `Side`, `Top`), and X-Ray translucent outer shells.
- **Live 8-DOF Kinematics & Teaching Overlays:** Real-time joint sliders, preset poses, RGB joint coordinate frames + channel callout badges, and floor-projected **Center of Mass (CoM)** with dual-foot support polygon.
- **8-Step Guided Assembly Mode:** Highlights the current build step, keeps completed subassemblies visible, and ghosts upcoming parts alongside fastener specs and engineering tips.
- **Synchronized 2D/3D Wiring Schematic:** Filter by circuit domain (`7.4V`, `5V Servo`, `Logic`, `GND`, `I2C`, `PWM`), click any wire or component in either 2D SVG or 3D harness tubes to cross-highlight, plus a pre-power **Safety Checklist** to prevent brownouts and reversed-polarity damage.
- **BOM & URDF Workbench:** Interactive Bill of Materials with cost/weight KPIs, 3D-printing specs (material, infill, layer height, orientation), and one-click export to **CSV BOM**, **JSON**, and **URDF**.

---

## Local Development

Requires **Node.js 22+** and **pnpm 10+**.

```bash
pnpm install
pnpm dev
```

The dev server starts at `http://127.0.0.1:5173/`.

### Production Build

```bash
# Default root path ("/")
pnpm build

# Subpath build (as used by GitHub Pages)
VITE_BASE_PATH="/micro-duck/" pnpm build
pnpm preview
```

---

## Custom CAD Replacement Workflow (`.glb` / `.stl`)

Instructors and students can swap any procedural part in the 3D scene with real Fusion 360 / Onshape / SolidWorks exports directly in the browser—no code edits required:

1. Export the target part from your CAD tool as **`.glb`** (recommended, preserves materials/transforms) or **`.stl`**, matching the suggested filename in the manifest (for example `MD01_chassis_pelvis.stl`).
2. Open the **BOM / CAD Workbench** (or select the part and open the **Inspector Drawer**).
3. Upload the `.glb` or `.stl` file under the part's **Custom CAD Override** slot and tune the scale factor if needed (scene scale is `1 unit = 10 mm`).
4. The custom mesh immediately replaces the procedural geometry while retaining full exploded-view vectors, kinematic joint parenting, step highlighting, and click-to-inspect behavior.
5. Reset any part back to the built-in procedural mesh at any time.

---

## Deployment (GitHub Pages CI)

Every push to `main` (or manual `workflow_dispatch`) triggers [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which installs dependencies with `pnpm --frozen-lockfile`, builds with `VITE_BASE_PATH="/${{ github.event.repository.name }}/"`, and publishes `dist/` directly to GitHub Pages via `actions/deploy-pages@v4`.
