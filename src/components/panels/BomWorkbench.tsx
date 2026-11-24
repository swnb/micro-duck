import { useMemo, useState } from 'react';
import {
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Coins,
  Copy,
  Cpu,
  Eye,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  RotateCcw,
  Scale,
  Search,
  Upload,
  X,
} from 'lucide-react';
import {
  ROBOT_JOINTS,
  ROBOT_PARTS,
  SUBSYSTEM_META,
} from '../../data/robotManifest';
import type {
  CustomCadOverride,
  PartCategory,
  SubsystemId,
} from '../../types/robot';
import {
  downloadTextFile,
  generateBomCsv,
  generateManifestJson,
  generateUrdfXml,
} from '../../utils/exporters';

export interface BomWorkbenchProps {
  selectedPartId: string | null;
  customCadOverrides: Record<string, CustomCadOverride>;
  onInspectIn3D: (partId: string) => void;
  onUploadCad: (partId: string, file: File) => void;
  onRemoveCad: (partId: string) => void;
}

const MASS_BUDGET_GRAMS = 400;

const SUBSYSTEM_ORDER: SubsystemId[] = [
  'head',
  'torso',
  'electronics',
  'right_leg',
  'left_leg',
  'hardware',
];

const CATEGORY_LABELS: Record<PartCategory, string> = {
  '3d_print_pla': 'PLA / PLA+ 打印件',
  '3d_print_tpu': 'TPU 95A 柔性件',
  actuator: 'MG90S 舵机',
  electronics: '电控模块',
  power: '供电与降压',
  fastener: '标准紧固件',
};

export function BomWorkbench({
  selectedPartId,
  customCadOverrides,
  onInspectIn3D,
  onUploadCad,
  onRemoveCad,
}: BomWorkbenchProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [subsystemFilter, setSubsystemFilter] = useState<SubsystemId | 'all'>(
    'all',
  );
  const [categoryFilter, setCategoryFilter] = useState<PartCategory | 'all'>(
    'all',
  );
  const [showUrdfPreview, setShowUrdfPreview] = useState(false);
  const [urdfCopied, setUrdfCopied] = useState(false);

  const summary = useMemo(() => {
    let totalWeightGrams = 0;
    let totalCostCny = 0;
    let totalQuantity = 0;
    let totalPrintMinutes = 0;
    let printedPartCount = 0;
    let printedWeightGrams = 0;

    for (const part of ROBOT_PARTS) {
      const partWeight = part.weightGrams * part.quantity;
      totalWeightGrams += partWeight;
      totalCostCny += part.unitPriceCny * part.quantity;
      totalQuantity += part.quantity;
      if (part.printSpec) {
        totalPrintMinutes += part.printSpec.estimatedMinutes;
        printedPartCount += 1;
        printedWeightGrams += partWeight;
      }
    }

    return {
      totalWeightGrams: Number(totalWeightGrams.toFixed(1)),
      totalCostCny: Number(totalCostCny.toFixed(1)),
      totalQuantity,
      totalPrintMinutes,
      totalPrintHours: Number((totalPrintMinutes / 60).toFixed(1)),
      printedPartCount,
      printedWeightGrams: Number(printedWeightGrams.toFixed(1)),
    };
  }, []);

  const urdfXml = useMemo(() => generateUrdfXml(), []);
  const urdfLineCount = useMemo(() => urdfXml.split('\n').length, [urdfXml]);

  const filteredParts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ROBOT_PARTS.filter((part) => {
      if (subsystemFilter !== 'all' && part.subsystem !== subsystemFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && part.category !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        part.code.toLowerCase().includes(q) ||
        part.nameZh.toLowerCase().includes(q) ||
        part.nameEn.toLowerCase().includes(q) ||
        part.cadFileName.toLowerCase().includes(q) ||
        (part.electricalTag?.toLowerCase().includes(q) ?? false) ||
        (part.printSpec?.material.toLowerCase().includes(q) ?? false)
      );
    });
  }, [searchQuery, subsystemFilter, categoryFilter]);

  const filteredTotals = useMemo(() => {
    let qty = 0;
    let weight = 0;
    let cost = 0;
    for (const part of filteredParts) {
      qty += part.quantity;
      weight += part.weightGrams * part.quantity;
      cost += part.unitPriceCny * part.quantity;
    }
    return {
      qty,
      weight: Number(weight.toFixed(1)),
      cost: Number(cost.toFixed(1)),
    };
  }, [filteredParts]);

  const customCadCount = Object.keys(customCadOverrides).length;
  const massBarPercent = Math.min(
    100,
    Math.round((summary.totalWeightGrams / MASS_BUDGET_GRAMS) * 100),
  );
  const isOverMassBudget = summary.totalWeightGrams > MASS_BUDGET_GRAMS;

  const handleExportCsv = () => {
    downloadTextFile(
      'MiniDuck-Edu-BOM.csv',
      generateBomCsv(),
      'text/csv;charset=utf-8',
    );
  };

  const handleExportJson = () => {
    downloadTextFile(
      'MiniDuck-Edu-Manifest.json',
      generateManifestJson(),
      'application/json;charset=utf-8',
    );
  };

  const handleExportUrdf = () => {
    downloadTextFile(
      'miniduck_edu_8dof.urdf',
      urdfXml,
      'application/xml;charset=utf-8',
    );
  };

  const handleCopyUrdf = async () => {
    try {
      await navigator.clipboard.writeText(urdfXml);
      setUrdfCopied(true);
      window.setTimeout(() => setUrdfCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  return (
    <div className="min-h-full w-full bg-[#EEF1F5] text-slate-900 p-4 lg:p-6">
      <div className="max-w-[1440px] mx-auto space-y-4">
          {/* ==================== KPI HEADER CARDS ==================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Weight & Mass Budget */}
            <div className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  整机预估总重
                </span>
                <span className="p-1.5 rounded-lg bg-orange-50 text-[#EA580C]">
                  <Scale className="w-4 h-4" />
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                    {summary.totalWeightGrams.toFixed(1)}
                  </span>
                  <span className="font-mono text-xs text-slate-500">
                    g / {MASS_BUDGET_GRAMS}g 预算
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full ${
                      isOverMassBudget
                        ? 'bg-gradient-to-r from-amber-500 to-[#EA580C]'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${massBarPercent}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>打印件 {summary.printedWeightGrams}g</span>
                <span
                  className={`font-mono font-semibold ${
                    isOverMassBudget ? 'text-[#EA580C]' : 'text-emerald-700'
                  }`}
                >
                  {isOverMassBudget
                    ? `超标 +${(summary.totalWeightGrams - MASS_BUDGET_GRAMS).toFixed(0)}g`
                    : `余量 ${(MASS_BUDGET_GRAMS - summary.totalWeightGrams).toFixed(0)}g`}
                </span>
              </div>
            </div>

            {/* Estimated BOM Cost */}
            <div className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  教学物料总成本
                </span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                  <Coins className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  ¥{summary.totalCostCny.toFixed(1)}
                </span>
                <span className="font-mono text-xs text-slate-500">RMB</span>
              </div>
              <div className="text-[11px] text-slate-500">
                共{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {ROBOT_PARTS.length}
                </span>{' '}
                类 /{' '}
                <span className="font-mono font-semibold text-slate-700">
                  {summary.totalQuantity}
                </span>{' '}
                件 · 含 8×MG90S 与电控
              </div>
            </div>

            {/* 3D Print Total Time */}
            <div className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  3D 打印总工时
                </span>
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Clock className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                  {summary.totalPrintHours.toFixed(1)}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  小时 ({summary.totalPrintMinutes} min)
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                {summary.printedPartCount} 个打印零件 · PLA/PLA+ & TPU 95A
              </div>
            </div>

            {/* 8 DOF + MG90S Spec Badge */}
            <div className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 p-4 shadow-sm flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">
                  构型与执行器基准
                </span>
                <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600">
                  <Cpu className="w-4 h-4" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-2xl font-bold text-slate-900">
                  {ROBOT_JOINTS.length} DOF
                </span>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                  MG90S
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>6 腿部 + 2 头部 · ESP32</span>
                <span className="font-mono text-[#EA580C] font-semibold">
                  已替换 CAD: {customCadCount}
                </span>
              </div>
            </div>
          </div>

          {/* ==================== EXPORT TOOLBAR + URDF PREVIEW ==================== */}
          <section className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  工程清单导出与高校仿真 URDF
                </h2>
                <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                  EXPORT BOM CSV · MANIFEST JSON · REP-103 URDF XML (GAZEBO / MUJOCO / ISAAC LAB)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>导出 BOM (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
                >
                  <FileJson className="w-3.5 h-3.5 text-blue-600" />
                  <span>导出装配清单 (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportUrdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-xs font-semibold text-white shadow-sm transition-colors"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>导出标准 URDF (XML)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUrdfPreview((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    showUrdfPreview
                      ? 'border-orange-300 bg-orange-50 text-[#EA580C]'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>{showUrdfPreview ? '收起 URDF 预览' : '课堂 URDF 预览'}</span>
                  {showUrdfPreview ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Inline Collapsible URDF XML Preview */}
            {showUrdfPreview && (
              <div className="border-t border-slate-200 bg-slate-900 text-slate-100">
                <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-800 bg-slate-950/60">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-orange-400 font-semibold">
                      miniduck_edu_8dof.urdf
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">
                      REP-103 (+X Forward, +Y Left, +Z Up) · {urdfLineCount} lines
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyUrdf}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition-colors"
                  >
                    {urdfCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">已复制 XML</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制 XML</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 text-[11px] font-mono leading-relaxed overflow-auto max-h-72 text-slate-200">
                  <code>{urdfXml}</code>
                </pre>
              </div>
            )}
          </section>

          {/* ==================== FILTER BAR + BOM TABLE ==================== */}
          <section className="rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-sm overflow-hidden">
            {/* Search & Subsystem/Category Filter Header */}
            <div className="p-3.5 border-b border-slate-200 space-y-3 bg-slate-50/60">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜索零件编号 (MD-01)、中英文名、通道 (CH0–CH7) 或耗材..."
                    className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-200"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="清除搜索关键字"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Select */}
                <select
                  value={categoryFilter}
                  onChange={(e) =>
                    setCategoryFilter(e.target.value as PartCategory | 'all')
                  }
                  aria-label="按类别筛选"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:border-[#EA580C]"
                >
                  <option value="all">全部类别 (All Categories)</option>
                  {(
                    Object.entries(CATEGORY_LABELS) as [PartCategory, string][]
                  ).map(([cat, label]) => (
                    <option key={cat} value={cat}>
                      {label}
                    </option>
                  ))}
                </select>

                {/* Filtered Count Readout */}
                <div className="font-mono text-[11px] text-slate-500 ml-auto">
                  显示{' '}
                  <span className="font-bold text-slate-900">
                    {filteredParts.length}
                  </span>{' '}
                  / {ROBOT_PARTS.length} 项 ·{' '}
                  <span className="text-slate-700 font-semibold">
                    {filteredTotals.weight.toFixed(1)}g
                  </span>{' '}
                  ·{' '}
                  <span className="text-slate-700 font-semibold">
                    ¥{filteredTotals.cost.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Subsystem Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSubsystemFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    subsystemFilter === 'all'
                      ? 'border-[#EA580C] bg-[#EA580C] text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  全部子系统 ({ROBOT_PARTS.length})
                </button>
                {SUBSYSTEM_ORDER.map((subId) => {
                  const meta = SUBSYSTEM_META[subId];
                  const count = ROBOT_PARTS.filter(
                    (p) => p.subsystem === subId,
                  ).length;
                  const isActive = subsystemFilter === subId;
                  return (
                    <button
                      key={subId}
                      type="button"
                      onClick={() => setSubsystemFilter(subId)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                        isActive
                          ? 'border-[#EA580C] bg-orange-50 text-[#EA580C] font-semibold'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span>{meta.nameZh}</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BOM Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    <th className="py-2.5 px-3.5 whitespace-nowrap">编号</th>
                    <th className="py-2.5 px-3.5">零件名称 / 电气标签</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">子系统</th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">
                      材质 / 打印参数
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      数量
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      重量 (g)
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      成本 (¥)
                    </th>
                    <th className="py-2.5 px-3.5 whitespace-nowrap">
                      CAD 模型状态 (.glb/.stl)
                    </th>
                    <th className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredParts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 text-center text-slate-400"
                      >
                        当前筛选条件下无匹配物料，可尝试重置子系统或类别筛选。
                      </td>
                    </tr>
                  ) : (
                    filteredParts.map((part) => {
                      const subMeta = SUBSYSTEM_META[part.subsystem];
                      const cadOverride = customCadOverrides[part.id];
                      const isSelected = selectedPartId === part.id;
                      const rowWeight = part.weightGrams * part.quantity;
                      const rowCost = part.unitPriceCny * part.quantity;

                      return (
                        <tr
                          key={part.id}
                          className={`transition-colors ${
                            isSelected
                              ? 'bg-orange-50/60'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Code */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                                  isSelected
                                    ? 'bg-[#EA580C] text-white'
                                    : 'bg-slate-900 text-white'
                                }`}
                              >
                                {part.code}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                Step {part.assemblyStep}
                              </span>
                            </div>
                          </td>

                          {/* Name & Electrical Tag */}
                          <td className="py-2.5 px-3.5 align-top min-w-[200px]">
                            <div className="font-semibold text-slate-900">
                              {part.nameZh}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                              {part.nameEn}
                            </div>
                            {part.electricalTag && (
                              <span className="inline-block mt-1 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                {part.electricalTag}
                              </span>
                            )}
                          </td>

                          {/* Subsystem */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                            <span
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border"
                              style={{
                                color: subMeta.color,
                                backgroundColor: subMeta.badgeBg,
                                borderColor: `${subMeta.color}33`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: subMeta.color }}
                              />
                              {subMeta.nameZh}
                            </span>
                          </td>

                          {/* Material / Print Spec */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                            {part.printSpec ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] font-bold text-slate-800">
                                    {part.printSpec.material}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    {part.printSpec.layerHeightMm}mm ·{' '}
                                    {part.printSpec.walls}壁 ·{' '}
                                    {part.printSpec.infillPercent}%
                                  </span>
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {part.printSpec.supports ? '需支撑' : '免支撑'} ·{' '}
                                  {part.printSpec.estimatedMinutes} min
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <div className="text-[11px] font-medium text-slate-700">
                                  {CATEGORY_LABELS[part.category]}
                                </div>
                                <div className="font-mono text-[10px] text-slate-400">
                                  {part.dimensionsMm}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Qty */}
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 tabular-nums align-top">
                            ×{part.quantity}
                          </td>

                          {/* Weight */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top">
                            <div className="font-semibold text-slate-900">
                              {rowWeight.toFixed(1)}
                            </div>
                            {part.quantity > 1 && (
                              <div className="text-[10px] text-slate-400">
                                {part.weightGrams}g/件
                              </div>
                            )}
                          </td>

                          {/* Cost */}
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums align-top">
                            <div className="font-semibold text-slate-900">
                              ¥{rowCost.toFixed(1)}
                            </div>
                            {part.quantity > 1 && (
                              <div className="text-[10px] text-slate-400">
                                ¥{part.unitPriceCny.toFixed(1)}/件
                              </div>
                            )}
                          </td>

                          {/* CAD Status + Inline Upload / Reset */}
                          <td className="py-2.5 px-3.5 whitespace-nowrap align-top">
                            {cadOverride ? (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-[#EA580C] font-mono text-[10px] font-semibold max-w-[140px]"
                                  title={cadOverride.fileName}
                                >
                                  <Box className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    {cadOverride.fileName}
                                  </span>
                                </span>

                                <label
                                  title="更换 .glb / .stl 文件"
                                  className="p-1 rounded border border-slate-200 bg-white hover:border-orange-300 hover:text-[#EA580C] text-slate-500 cursor-pointer transition-colors"
                                >
                                  <Upload className="w-3 h-3" />
                                  <input
                                    type="file"
                                    accept=".glb,.gltf,.stl"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) onUploadCad(part.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={() => onRemoveCad(part.id)}
                                  title="恢复程序化默认模型"
                                  className="p-1 rounded border border-slate-200 bg-white hover:border-red-300 hover:text-red-600 text-slate-500 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                  程序化默认
                                </span>
                                <label className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-white hover:border-[#EA580C] hover:text-[#EA580C] text-[11px] font-medium text-slate-600 cursor-pointer transition-colors">
                                  <Upload className="w-3 h-3" />
                                  <span>替换 CAD</span>
                                  <input
                                    type="file"
                                    accept=".glb,.gltf,.stl"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) onUploadCad(part.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </td>

                          {/* Inspect in 3D Action */}
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap align-top">
                            <button
                              type="button"
                              onClick={() => onInspectIn3D(part.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:border-[#EA580C] hover:bg-orange-50 hover:text-[#EA580C] text-[11px] font-medium text-slate-700 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>在 3D 中查看</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {filteredParts.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/95 text-xs font-semibold text-slate-800">
                      <td colSpan={4} className="py-2.5 px-3.5">
                        筛选汇总 ({filteredParts.length} 项物料)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        ×{filteredTotals.qty}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {filteredTotals.weight.toFixed(1)} g
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#EA580C]">
                        ¥{filteredTotals.cost.toFixed(1)}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3.5 text-right font-mono text-[10px] text-slate-400">
                        支持局部替换 Fusion360 / SolidWorks 模型
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
      </div>
    </div>
  );
}
