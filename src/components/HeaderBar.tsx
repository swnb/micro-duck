import { useEffect, useRef, useState } from 'react';
import {
  Axis3d,
  Cable,
  ChevronDown,
  Columns2,
  Crosshair,
  Download,
  Eye,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  Layers,
  Package,
  Tag,
} from 'lucide-react';
import {
  downloadTextFile,
  generateBomCsv,
  generateManifestJson,
  generateUrdfXml,
} from '../utils/exporters';

export type ViewMode = 'explode' | 'split' | 'wiring' | 'bom';
export type CameraPreset = 'iso' | 'front' | 'side' | 'top';

export interface HeaderBarProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  xRayMode: boolean;
  onToggleXRay: () => void;
  showAxes: boolean;
  onToggleAxes: () => void;
  showHarness: boolean;
  onToggleHarness: () => void;
  showCoM: boolean;
  onToggleCoM: () => void;
  showAnnotations: boolean;
  onToggleAnnotations: () => void;
  cameraPreset: CameraPreset | null;
  onSelectCameraPreset: (preset: CameraPreset) => void;
  masterExplode: number;
  activeStep: number | null;
  customCadCount: number;
}

const VIEW_TABS: {
  id: ViewMode;
  label: string;
  shortDesc: string;
  icon: typeof Layers;
}[] = [
  {
    id: 'explode',
    label: '3D 爆炸装配图',
    shortDesc: '结构拆解与运动仿真',
    icon: Layers,
  },
  {
    id: 'split',
    label: '双屏教学联动',
    shortDesc: '3D 机械 + 2D 电气同步高亮',
    icon: Columns2,
  },
  {
    id: 'wiring',
    label: '2D 接线架构图',
    shortDesc: '引脚原理与防烧板清单',
    icon: Cable,
  },
  {
    id: 'bom',
    label: 'BOM 与 CAD 替换',
    shortDesc: '清单核算与模型导入',
    icon: Package,
  },
];

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: 'iso', label: '等轴测' },
  { id: 'front', label: '正视' },
  { id: 'side', label: '侧视' },
  { id: 'top', label: '俯视' },
];

export function HeaderBar({
  viewMode,
  onChangeViewMode,
  xRayMode,
  onToggleXRay,
  showAxes,
  onToggleAxes,
  showHarness,
  onToggleHarness,
  showCoM,
  onToggleCoM,
  showAnnotations,
  onToggleAnnotations,
  cameraPreset,
  onSelectCameraPreset,
  masterExplode,
  activeStep,
  customCadCount,
}: HeaderBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setExportOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [exportOpen]);

  const showViewportToolbar = viewMode === 'explode' || viewMode === 'split';

  const handleExportUrdf = () => {
    downloadTextFile(
      'miniduck_edu_8dof.urdf',
      generateUrdfXml(),
      'application/xml;charset=utf-8',
    );
    setExportOpen(false);
  };

  const handleExportBomCsv = () => {
    downloadTextFile(
      'miniduck_edu_bom.csv',
      generateBomCsv(),
      'text/csv;charset=utf-8',
    );
    setExportOpen(false);
  };

  const handleExportManifestJson = () => {
    downloadTextFile(
      'miniduck_edu_manifest.json',
      generateManifestJson(),
      'application/json;charset=utf-8',
    );
    setExportOpen(false);
  };

  const viewportToggles = [
    {
      id: 'xray',
      label: 'X-Ray 透视',
      active: xRayMode,
      onClick: onToggleXRay,
      icon: Eye,
      activeClass: 'bg-orange-600 text-white border-orange-600 shadow-sm',
    },
    {
      id: 'axes',
      label: '坐标系/轴线',
      active: showAxes,
      onClick: onToggleAxes,
      icon: Axis3d,
      activeClass: 'bg-slate-800 text-white border-slate-800 shadow-sm',
    },
    {
      id: 'harness',
      label: '3D 线束',
      active: showHarness,
      onClick: onToggleHarness,
      icon: Cable,
      activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    },
    {
      id: 'com',
      label: '重心投影',
      active: showCoM,
      onClick: onToggleCoM,
      icon: Crosshair,
      activeClass: 'bg-sky-600 text-white border-sky-600 shadow-sm',
    },
    {
      id: 'annotations',
      label: '引线/标签',
      active: showAnnotations,
      onClick: onToggleAnnotations,
      icon: Tag,
      activeClass: 'bg-violet-600 text-white border-violet-600 shadow-sm',
    },
  ];

  return (
    <header className="shrink-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      {/* Primary Navigation Row */}
      <div className="h-14 px-4 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-sm ring-1 ring-slate-900/10 shrink-0"
            aria-hidden="true"
          >
            {/* Geometric Swiss-CAD BDX MiniDuck Emblem */}
            <svg
              viewBox="0 0 32 32"
              className="w-6 h-6"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Twin ear antennas */}
              <path
                d="M11 9.5L8.5 5.5M18 9.5L20 5.5"
                stroke="#CBD5E1"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Head dome */}
              <rect
                x="7"
                y="9"
                width="15"
                height="11.5"
                rx="5.5"
                fill="#F8FAFC"
              />
              {/* Optical visor */}
              <rect
                x="11"
                y="12.2"
                width="8.5"
                height="3.4"
                rx="1.7"
                fill="#0F172A"
              />
              {/* Glowing cyan eye lens */}
              <circle cx="16.8" cy="13.9" r="1.15" fill="#38BDF8" />
              {/* Signal orange duck bill */}
              <path
                d="M20.5 14.5H26.5C27.6 14.5 28.5 15.4 28.5 16.5C28.5 17.6 27.6 18.5 26.5 18.5H20.5V14.5Z"
                fill="#EA580C"
              />
              {/* Torso base */}
              <path
                d="M9.5 21.5H19.5C20.6 21.5 21.5 22.4 21.5 23.5V25.5C21.5 26.3 20.8 27 20 27H9C8.2 27 7.5 26.3 7.5 25.5V23.5C7.5 22.4 8.4 21.5 9.5 21.5Z"
                fill="#334155"
              />
              <circle cx="11.5" cy="24.2" r="1.2" fill="#EA580C" />
              <circle cx="17.5" cy="24.2" r="1.2" fill="#38BDF8" />
            </svg>
          </div>
          <div className="leading-tight min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-bold tracking-tight text-slate-900 whitespace-nowrap">
                MiniDuck-Edu Studio
              </h1>
              <span className="hidden xl:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-orange-50 text-orange-700 border border-orange-200/80">
                REV 1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium tracking-wide whitespace-nowrap">
              8-DOF MG90S 教学双足平台
            </p>
          </div>
        </div>

        {/* 4 View Mode Tabs */}
        <nav
          aria-label="视图模式切换"
          className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 gap-0.5"
        >
          {VIEW_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.shortDesc}
                onClick={() => onChangeViewMode(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/90'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    active ? 'text-orange-600' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Status Badge + Quick Export */}
        <div className="flex items-center gap-2 shrink-0">
          {customCadCount > 0 && (
            <span
              title="已替换的自定义 CAD 零件数量"
              className="hidden lg:inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              CAD ×{customCadCount}
            </span>
          )}

          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportOpen((prev) => !prev)}
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 transition-colors shadow-sm whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>工程导出</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-300 transition-transform ${
                  exportOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 py-1.5 z-50"
              >
                <div className="px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  教学与仿真交付文件
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportUrdf}
                  className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors"
                >
                  <FileCode2 className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                  <div className="leading-snug">
                    <div className="text-xs font-semibold text-slate-900">
                      导出 URDF
                    </div>
                    <div className="text-[11px] text-slate-500">
                      REP-103 标准 XML（Gazebo / MuJoCo）
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportBomCsv}
                  className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="leading-snug">
                    <div className="text-xs font-semibold text-slate-900">
                      导出 BOM CSV
                    </div>
                    <div className="text-[11px] text-slate-500">
                      完整物料成本、重量与打印参数表
                    </div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleExportManifestJson}
                  className="w-full px-3 py-2 text-left flex items-start gap-2.5 hover:bg-slate-50 transition-colors"
                >
                  <FileJson className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                  <div className="leading-snug">
                    <div className="text-xs font-semibold text-slate-900">
                      导出装配清单 JSON
                    </div>
                    <div className="text-[11px] text-slate-500">
                      零件坐标、关节限位与元数据
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick 3D Viewport Toolbar (only shown in explode & split modes) */}
      {showViewportToolbar && (
        <div className="h-10 px-4 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between gap-3 overflow-x-auto">
          {/* Left: Viewport Visualization Toggles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mr-1">
              视口图层
            </span>
            {viewportToggles.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={item.active}
                  onClick={item.onClick}
                  className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all whitespace-nowrap ${
                    item.active
                      ? item.activeClass
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Live Telemetry Chip + Camera Presets */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden xl:flex items-center gap-2 text-[11px] font-mono text-slate-500">
              <span>
                爆炸度{' '}
                <strong className="text-slate-800">
                  {Math.round(masterExplode * 100)}%
                </strong>
              </span>
              {activeStep !== null && (
                <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-semibold">
                  STEP {activeStep}/8
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-slate-200 hidden xl:block" />

            <div
              className="flex items-center gap-1"
              role="group"
              aria-label="相机视角预设"
            >
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 mr-1">
                视角
              </span>
              {CAMERA_PRESETS.map((preset) => {
                const active = cameraPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectCameraPreset(preset.id)}
                    className={`h-7 px-2.5 rounded-md text-[11px] font-semibold border transition-all whitespace-nowrap ${
                      active
                        ? 'bg-orange-50 text-orange-700 border-orange-300 shadow-[inset_0_0_0_1px_rgba(234,88,12,0.12)]'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
