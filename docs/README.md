# MiniDuck-Edu Studio 文档中心

[← 返回中文首页](../README.md) · [English Overview](../README.en.md) · [在线体验（GitHub Pages）](https://swnb.github.io/micro-duck/)

欢迎来到 **MiniDuck-Edu Studio**（8-DOF MG90S 双足教学机器人交互式 3D 爆炸装配与机电联动平台）的完整工程与教学文档体系。本套文档与源码保持严格单数据源对齐，涵盖软件架构、硬件 BOM 与防烧板接线、CAD 建模与 3D 打印、高校实验课程以及二次开发与 CI/CD 部署。

---

## 文档总目录

| 编号 | 文档 | 核心内容 | 适用人群 |
| :--- | :--- | :--- | :--- |
| 01 | [系统架构与数据流](architecture.md) | 前端模块分层、单数据源 `Assembly Manifest`、`1 unit = 10 mm` 与 REP-103 坐标系换算、4 大视图双向联动与 CoM 支撑多边形算法 | 开发者、架构师、课程助教 |
| 02 | [硬件设计、BOM 核算与电气接线](hardware-and-wiring.md) | 8-DOF 运动学与 `CH0–CH7`（含飞特预留总线 ID）、全量 33 项 BOM（¥231.0 / 508.2g）、压进 400g 稳态预算的轻量化方案、供电隔离与 I2C 拓扑、19 条接线明细与 4 项防烧板核查、总线上升级路线 | 硬件工程师、装机学生、采购老师 |
| 03 | [CAD 建模、3D 打印与热替换指南](cad-and-printing-guide.md) | Fusion 360 / SolidWorks / Onshape 导出规范、18 项打印零件切片参数表（总耗时 549 min ≈ 9.2h）、浏览器内热替换 `.glb`/`.stl` 与 `0.1×` 缩放约定 | 机械设计师、创客实验室、学生团队 |
| 04 | [高校机器人课程实验手册（4 课时）](teaching-curriculum.md) | 面向本科/研究生机器人课程的 4 节实操实验（机械装调与 90° 中位、双足 CoM 与支撑多边形、供电隔离与 I2C 调试、REP-103 URDF 仿真衔接）与评分量表 | 高校任课教师、实验助教、学生 |
| 05 | [本地开发、二次扩展与自动部署](development-and-deploy.md) | Node 22 + pnpm 10 本地开发、扩展自定义零件/关节/线束/姿态、GitHub Actions（`deploy-pages.yml`）自动构建机制与排错指南 | 开源贡献者、平台维护者 |

---

## 按角色推荐阅读路线

### 1. 高校教师备课路线（Curriculum Instructor）

适合希望在一学期或短期工程实训课中快速引入低成本双足机器人平台的教师与助教：

1. 先浏览 [中文首页](../README.md) 了解 4 大教学视图与在线演示地址（无需安装客户端即可在机房/投影仪直接打开）。
2. 阅读 [高校机器人课程实验手册（4 课时）](teaching-curriculum.md)，确定课堂课时安排、学生预习任务与验收标准。
3. 核对 [硬件设计、BOM 核算与电气接线](hardware-and-wiring.md) 中的 33 项 BOM 成本（约 ¥231.0/套）与 4 项上电前防烧板硬性检查，统一准备实验室采购与 3D 打印排班。
4. 参考 [CAD 建模、3D 打印与热替换指南](cad-and-printing-guide.md) 布置学生自研鸭嘴/胸甲外壳替换作业，并在浏览器内现场演示验收。

### 2. 学生装机与接线实操路线（Student Builder）

适合首次亲手组装 8-DOF MG90S 双足小鸭机器人的同学：

1. 在线打开 [MiniDuck-Edu Studio](https://swnb.github.io/micro-duck/)，切换左侧 **「分步装机」** 面板按 Step 1 → Step 8 预览装机顺序与螺丝规格。
2. 精读 [CAD 建模、3D 打印与热替换指南](cad-and-printing-guide.md) 中的全量打印参数表，完成 16 项 PLA/PLA+ 结构件与 2 项 TPU 95A 防滑脚垫切片打印。
3. 严格对照 [硬件设计、BOM 核算与电气接线](hardware-and-wiring.md) 完成 **19 条接线**，并在首次通电前逐项勾完 **4 项防烧板核查表**（特别是 5V/5A UBEC 供电隔离与星型共地）。
4. 配合 [高校机器人课程实验手册（4 课时）](teaching-curriculum.md) 完成 90° 中位校准、步态重心观测与 URDF 仿真验证。

### 3. 机械工程师 CAD 替换路线（Mechanical & CAD Designer）

适合在 Fusion 360 / SolidWorks / Onshape 中对结构件做轻量化、改型或二次设计的工程师：

1. 先阅读 [系统架构与数据流](architecture.md) 中的坐标系约定（`1 scene unit = 10 mm`，Y-Up / `+Z` 朝前 / `+X` 朝机器人左侧）与零件装配锚点机制。
2. 精读 [CAD 建模、3D 打印与热替换指南](cad-and-printing-guide.md) 中的建模公差建议、文件命名规范（如 `MD01_chassis_pelvis.stl`）与浏览器本地热替换 `.glb`/`.stl` 流程。
3. 参考 [硬件设计、BOM 核算与电气接线](hardware-and-wiring.md) 中的 **400g 稳态预算轻量化指南**，在不损失 MG90S 舵机装配刚性的前提下完成薄壁与掏空优化。

### 4. 前端与机器人软件二次开发路线（Developer & Maintainer）

适合希望复用本框架展示其他机器人机型（如四足、机械臂、总线上升级版 12-DOF 小鸭）的开发者：

1. 阅读 [系统架构与数据流](architecture.md)，掌握 `App.tsx` 状态中心、`robotManifest.ts` 与 `wiringData.ts` 单数据源模型，以及 3D 视口 / 2D SVG 的双向选中联动机制。
2. 阅读 [本地开发、二次扩展与自动部署](development-and-deploy.md)，了解如何新增零件、关节、电路域、导出器，以及如何 Fork 后通过 GitHub Actions 一键部署自己的 GitHub Pages 站点。

---

## 核心工程指标速查

| 指标项 | 代码库核验值 | 数据来源 |
| :--- | :--- | :--- |
| 主动自由度 | **8 DOF**（右腿 3 + 左腿 3 + 头部 2） | `src/data/robotManifest.ts` (`ROBOT_JOINTS`) |
| 执行器基准 | 8 × **MG90S** 金属齿微型舵机（5V 堵转约 `2.0 kg·cm ≈ 0.20 N·m`） | `src/data/robotManifest.ts`, `src/utils/exporters.ts` |
| BOM 物料条目 / 总件数 | **33 项** / **37 件**（含 18 项 19 件 3D 打印零件） | `src/data/robotManifest.ts` (`ROBOT_PARTS`) |
| 清单原始总重 / 稳态预算 | **508.2 g** / **400.0 g**（含轻量化压降至 `<390 g` 方案） | `src/components/panels/BomWorkbench.tsx` |
| 清单预估总成本 | **¥231.0 RMB**（含电控、电池、舵机与打印耗材） | `src/data/robotManifest.ts` |
| 3D 打印预计总工时 | **549 min**（约 **9.2 小时**） | `src/data/robotManifest.ts` (`printSpec`) |
| 电气节点 / 线束连接 | **13 个电气模块** / **19 条导线**（6 大电路域） | `src/data/wiringData.ts` |
| 工程导出格式 | **BOM CSV**（带 UTF-8 BOM）、**Manifest JSON**、**REP-103 URDF XML** | `src/utils/exporters.ts` |
