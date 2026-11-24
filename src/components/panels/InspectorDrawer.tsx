import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Box,
  Cable,
  ChevronRight,
  Coins,
  Compass,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import {
  JOINT_BY_ID,
  PART_BY_ID,
  ROBOT_PARTS,
  SUBSYSTEM_META,
} from '../../data/robotManifest';
import {
  CIRCUIT_DOMAIN_META,
  WIRE_CONNECTIONS,
  WIRING_NODES,
} from '../../data/wiringData';
import type { CustomCadOverride, SubsystemId } from '../../types/robot';

export interface InspectorDrawerProps {
  selectedPartId: string | null;
  selectedWireId: string | null;
  customCadOverrides: Record<string, CustomCadOverride>;
  onSelectPart: (partId: string | null) => void;
  onSelectWire: (wireId: string | null) => void;
  onUploadCad: (partId: string, file: File) => void;
  onUpdateCadScale: (partId: string, scale: number) => void;
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

const CAD_SCALE_PRESETS: { label: string; scale: number }[] = [
  { label: '0.01×', scale: 0.01 },
  { label: '0.1× mm→cm', scale: 0.1 },
  { label: '1.0× 原尺寸', scale: 1.0 },
  { label: '2.0×', scale: 2.0 },
];

export function InspectorDrawer({
  selectedPartId,
  selectedWireId,
  customCadOverrides,
  onSelectPart,
  onSelectWire,
  onUploadCad,
  onUpdateCadScale,
  onRemoveCad,
}: InspectorDrawerProps): JSX.Element {
  const [quickSearch, setQuickSearch] = useState('');

  const { totalWeightGrams, totalCostCny } = useMemo(() => {
    let weight = 0;
    let cost = 0;
    for (const part of ROBOT_PARTS) {
      weight += part.weightGrams * part.quantity;
      cost += part.unitPriceCny * part.quantity;
    }
    return {
      totalWeightGrams: Number(weight.toFixed(1)),
      totalCostCny: Number(cost.toFixed(1)),
    };
  }, []);

  const massRatio = totalWeightGrams / MASS_BUDGET_GRAMS;
  const massBarPercent = Math.min(100, Math.round(massRatio * 100));
  const isOverMassBudget = totalWeightGrams > MASS_BUDGET_GRAMS;

  const selectedPart = selectedPartId ? PART_BY_ID[selectedPartId] ?? null : null;
  const selectedWire = useMemo(
    () =>
      selectedWireId
        ? WIRE_CONNECTIONS.find((w) => w.id === selectedWireId) ?? null
        : null,
    [selectedWireId],
  );

  const nodeById = useMemo(
    () => Object.fromEntries(WIRING_NODES.map((n) => [n.id, n])),
    [],
  );

  const connectedWires = useMemo(() => {
    if (!selectedPart) return [];
    return WIRE_CONNECTIONS.filter((w) =>
      w.relatedPartIds.includes(selectedPart.id),
    );
  }, [selectedPart]);

  const groupedParts = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    return SUBSYSTEM_ORDER.map((subId) => {
      const parts = ROBOT_PARTS.filter((p) => {
        if (p.subsystem !== subId) return false;
        if (!query) return true;
        return (
          p.code.toLowerCase().includes(query) ||
          p.nameZh.toLowerCase().includes(query) ||
          p.nameEn.toLowerCase().includes(query) ||
          (p.electricalTag?.toLowerCase().includes(query) ?? false)
        );
      });
      return { subId, parts };
    }).filter((group) => group.parts.length > 0);
  }, [quickSearch]);

  const customCadCount = Object.keys(customCadOverrides).length;

  const handleClearSelection = () => {
    onSelectPart(null);
    onSelectWire(null);
  };

  // Prioritize wire view if a wire is explicitly selected, otherwise part view
  const activeMode: 'wire' | 'part' | 'picker' = selectedWire
    ? 'wire'
    : selectedPart
      ? 'part'
      : 'picker';

  return (
    <div className="h-full w-full min-h-0 flex flex-col bg-white/95 backdrop-blur text-slate-900 overflow-hidden">
      {/* Top Live Mass Budget & Cost Summary Strip */}
      <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50/85 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-700">
              质量预算 (MG90S 稳态线)
            </span>
          </div>
          <div className="flex items-baseline gap-1 font-mono text-xs tabular-nums">
            <span
              className={`font-bold ${
                isOverMassBudget ? 'text-[#EA580C]' : 'text-emerald-700'
              }`}
            >
              {totalWeightGrams.toFixed(1)} g
            </span>
            <span className="text-slate-400">/ {MASS_BUDGET_GRAMS} g</span>
          </div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-slate-200/90 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isOverMassBudget
                ? 'bg-gradient-to-r from-amber-500 to-[#EA580C]'
                : massRatio > 0.88
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            }`}
            style={{ width: `${massBarPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-600">
            <Coins className="w-3.5 h-3.5 text-slate-400" />
            <span>BOM 预估</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              ¥{totalCostCny.toFixed(1)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {customCadCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C] font-semibold">
                CAD ×{customCadCount}
              </span>
            )}
            <span
              className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isOverMassBudget
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isOverMassBudget
                ? `超标 +${(totalWeightGrams - MASS_BUDGET_GRAMS).toFixed(0)}g`
                : `余量 ${(MASS_BUDGET_GRAMS - totalWeightGrams).toFixed(0)}g`}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Inspector Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* ==================== PART INSPECTOR ==================== */}
        {activeMode === 'part' && selectedPart && (() => {
          const subMeta = SUBSYSTEM_META[selectedPart.subsystem];
          const jointSpec = selectedPart.jointId
            ? JOINT_BY_ID[selectedPart.jointId]
            : null;
          const cadOverride = customCadOverrides[selectedPart.id];

          return (
            <>
              {/* Part Identity Card */}
              <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                      {selectedPart.code}
                    </span>
                    <span
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md border"
                      style={{
                        color: subMeta.color,
                        backgroundColor: subMeta.badgeBg,
                        borderColor: `${subMeta.color}33`,
                      }}
                    >
                      {subMeta.nameZh}
                    </span>
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      Step {selectedPart.assemblyStep}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelection}
                    aria-label="关闭零件检查器"
                    title="返回零件速览列表"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-snug">
                    {selectedPart.nameZh}
                  </h2>
                  <p className="font-mono text-[11px] text-slate-500 mt-0.5">
                    {selectedPart.nameEn}
                  </p>
                </div>

                {selectedPart.electricalTag && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/80 text-emerald-800 font-mono text-[11px] font-semibold">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{selectedPart.electricalTag}</span>
                  </div>
                )}

                {/* Technical Specs 2x2 Grid */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">
                      重量 (单件{selectedPart.quantity > 1 ? ` ×${selectedPart.quantity}` : ''})
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 tabular-nums mt-0.5">
                      {selectedPart.weightGrams} g
                      {selectedPart.quantity > 1 && (
                        <span className="text-[10px] font-normal text-slate-500 ml-1">
                          (共 {(selectedPart.weightGrams * selectedPart.quantity).toFixed(1)}g)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">
                      参考单价 (RMB)
                    </div>
                    <div className="font-mono text-xs font-bold text-slate-900 tabular-nums mt-0.5">
                      ¥{selectedPart.unitPriceCny.toFixed(1)}
                      {selectedPart.quantity > 1 && (
                        <span className="text-[10px] font-normal text-slate-500 ml-1">
                          ×{selectedPart.quantity}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">
                      标称外形尺寸 (DIMENSIONS)
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-800 mt-0.5">
                      {selectedPart.dimensionsMm}
                    </div>
                  </div>
                </div>

                {/* Full Description */}
                <p className="text-xs leading-relaxed text-slate-600 pt-0.5">
                  {selectedPart.description}
                </p>

                {/* Joint Kinematic Spec if Actuator */}
                {jointSpec && (
                  <div className="rounded-lg bg-blue-50/70 border border-blue-200/80 p-2.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-900">
                        <Compass className="w-3.5 h-3.5 text-blue-600" />
                        关节运动副 · {jointSpec.axisLabel}
                      </span>
                      <span className="font-mono text-[10px] text-blue-700 font-semibold">
                        [{jointSpec.minDeg}°, +{jointSpec.maxDeg}°]
                      </span>
                    </div>
                    <div className="font-mono text-[10px] text-blue-700/80">
                      {jointSpec.parentLink} → {jointSpec.childLink} · Future Bus ID #{jointSpec.busIdFuture}
                    </div>
                    <p className="text-[11px] text-blue-950/85 leading-relaxed">
                      {jointSpec.trimNote}
                    </p>
                  </div>
                )}

                {/* Fasteners Note */}
                {selectedPart.fastenersNote && (
                  <div className="flex items-start gap-2 rounded-lg bg-slate-100/80 border border-slate-200/80 px-2.5 py-2">
                    <Wrench className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] leading-relaxed text-slate-700">
                      <span className="font-semibold">紧固说明：</span>
                      {selectedPart.fastenersNote}
                    </div>
                  </div>
                )}
              </section>

              {/* 3D Print Parameters Card */}
              {selectedPart.printSpec && (
                <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-[#EA580C]" />
                      <h3 className="text-xs font-semibold text-slate-900">
                        3D 打印切片参数
                      </h3>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-orange-50 text-[#EA580C] border border-orange-200">
                      {selectedPart.printSpec.material}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-1.5 px-1">
                      <div className="text-[10px] text-slate-400">层高</div>
                      <div className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                        {selectedPart.printSpec.layerHeightMm}mm
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-1.5 px-1">
                      <div className="text-[10px] text-slate-400">壁厚</div>
                      <div className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                        {selectedPart.printSpec.walls} 层
                      </div>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-1.5 px-1">
                      <div className="text-[10px] text-slate-400">填充</div>
                      <div className="font-mono text-xs font-bold text-slate-800 mt-0.5">
                        {selectedPart.printSpec.infillPercent}%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">支撑</span>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          selectedPart.printSpec.supports
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {selectedPart.printSpec.supports ? '需支撑' : '免支撑'}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">耗时</span>
                      <span className="font-mono text-[11px] font-bold text-slate-800 tabular-nums">
                        {selectedPart.printSpec.estimatedMinutes} min
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5 text-[11px] text-slate-700">
                    <span className="text-slate-400">推荐摆放：</span>
                    <span className="font-medium">
                      {selectedPart.printSpec.orientation}
                    </span>
                  </div>
                </section>
              )}

              {/* Connected Wires List */}
              {connectedWires.length > 0 && (
                <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Cable className="w-3.5 h-3.5 text-slate-600" />
                      <h3 className="text-xs font-semibold text-slate-900">
                        关联电气线束
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {connectedWires.length} 条
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {connectedWires.map((wire) => {
                      const domainMeta = CIRCUIT_DOMAIN_META[wire.domain];
                      return (
                        <button
                          key={wire.id}
                          type="button"
                          onClick={() => {
                            onSelectPart(null);
                            onSelectWire(wire.id);
                          }}
                          className="w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:border-[#EA580C]/50 hover:bg-orange-50/40 transition-all group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: wire.color }}
                              />
                              <span className="text-xs font-medium text-slate-800 truncate group-hover:text-[#EA580C]">
                                {wire.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-slate-500">
                              <span>{domainMeta.shortLabel}</span>
                              <span>·</span>
                              <span className="truncate">
                                {wire.fromPin} → {wire.toPin}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#EA580C] shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Custom CAD Model Override Box */}
              <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Box className="w-3.5 h-3.5 text-[#EA580C] shrink-0" />
                    <h3 className="text-xs font-semibold text-slate-900 truncate">
                      替换真实 CAD 模型 (.glb / .stl)
                    </h3>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 font-medium ${
                      cadOverride
                        ? 'bg-orange-100 text-[#EA580C]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cadOverride ? '自定义 CAD' : '程序化'}
                  </span>
                </div>

                <div className="font-mono text-[10px] text-slate-400 truncate">
                  建议文件名: {selectedPart.cadFileName}
                </div>

                <label className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 hover:border-[#EA580C] hover:bg-orange-50/40 cursor-pointer transition-all text-center">
                  <Upload className="w-4 h-4 text-[#EA580C]" />
                  <span className="text-xs font-medium text-slate-700">
                    {cadOverride
                      ? '重新上传以替换当前 CAD 文件'
                      : '点击导入 Fusion360 / SolidWorks 导出的 .glb 或 .stl'}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400">
                    保留爆炸动画与关节联动 · 本地浏览器解析
                  </span>
                  <input
                    type="file"
                    accept=".glb,.gltf,.stl"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onUploadCad(selectedPart.id, file);
                      }
                      e.target.value = '';
                    }}
                  />
                </label>

                {cadOverride && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-2.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#EA580C] text-white">
                            {cadOverride.fileType}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-slate-800 truncate">
                            {cadOverride.fileName}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveCad(selectedPart.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 bg-white hover:border-red-300 hover:text-red-600 text-[11px] font-medium text-slate-600 transition-colors shrink-0"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>恢复默认</span>
                      </button>
                    </div>

                    {/* Scale Slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600 font-medium">
                          模型缩放倍率 (Scale)
                        </span>
                        <span className="font-mono font-bold text-[#EA580C] tabular-nums">
                          {cadOverride.scale.toFixed(2)}×
                        </span>
                      </div>

                      <input
                        type="range"
                        min={0.01}
                        max={2}
                        step={0.01}
                        value={cadOverride.scale}
                        onChange={(e) =>
                          onUpdateCadScale(
                            selectedPart.id,
                            Number(e.target.value),
                          )
                        }
                        aria-label="自定义 CAD 缩放倍率"
                        className="studio-slider w-full"
                      />

                      <div className="grid grid-cols-4 gap-1">
                        {CAD_SCALE_PRESETS.map((preset) => {
                          const isCurrent =
                            Math.abs(cadOverride.scale - preset.scale) < 0.005;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                onUpdateCadScale(selectedPart.id, preset.scale)
                              }
                              className={`py-1 px-1 rounded border font-mono text-[10px] transition-colors truncate ${
                                isCurrent
                                  ? 'border-[#EA580C] bg-[#EA580C] text-white font-semibold'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-orange-300 hover:text-[#EA580C]'
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
              </section>
            </>
          );
        })()}

        {/* ==================== WIRE INSPECTOR ==================== */}
        {activeMode === 'wire' && selectedWire && (() => {
          const domainMeta = CIRCUIT_DOMAIN_META[selectedWire.domain];
          const fromNode = nodeById[selectedWire.fromNodeId];
          const toNode = nodeById[selectedWire.toNodeId];
          const relatedParts = selectedWire.relatedPartIds
            .map((pid) => PART_BY_ID[pid])
            .filter(Boolean);

          return (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-md text-white"
                    style={{ backgroundColor: domainMeta.color }}
                  >
                    <Cable className="w-3 h-3" />
                    {domainMeta.label}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    aria-label="关闭线束检查器"
                    title="返回零件速览列表"
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-snug">
                    {selectedWire.label}
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {domainMeta.description}
                  </p>
                </div>

                {/* From -> To Pinout Diagram */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        FROM 起点
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {fromNode?.label ?? selectedWire.fromNodeId}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 shrink-0">
                      {selectedWire.fromPin}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <div
                      className="h-0.5 flex-1 rounded-full"
                      style={{ backgroundColor: selectedWire.color }}
                    />
                    <ArrowRight
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: selectedWire.color }}
                    />
                    <div
                      className="h-0.5 flex-1 rounded-full"
                      style={{ backgroundColor: selectedWire.color }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        TO 终点
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {toNode?.label ?? selectedWire.toNodeId}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800 shrink-0">
                      {selectedWire.toPin}
                    </span>
                  </div>
                </div>

                {/* Wire Gauge & Voltage */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">
                      推荐线规 (GAUGE)
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-800 mt-0.5">
                      {selectedWire.wireGauge}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">
                      电压/信号 (SPEC)
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-800 mt-0.5">
                      {selectedWire.voltageInfo}
                    </div>
                  </div>
                </div>

                {/* Safety Warning Note */}
                {selectedWire.safetyNote && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs leading-relaxed text-amber-950">
                      <span className="font-semibold">安全警示：</span>
                      {selectedWire.safetyNote}
                    </div>
                  </div>
                )}
              </section>

              {/* Clickable Connected Parts */}
              <section className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-900">
                    两端关联器件
                  </h3>
                  <span className="font-mono text-[10px] text-slate-400">
                    {relatedParts.length} 件
                  </span>
                </div>

                <div className="space-y-1.5">
                  {relatedParts.map((part) => {
                    const meta = SUBSYSTEM_META[part.subsystem];
                    return (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => {
                          onSelectWire(null);
                          onSelectPart(part.id);
                        }}
                        className="w-full text-left flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:border-[#EA580C]/50 hover:bg-orange-50/40 transition-all group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-white shrink-0">
                              {part.code}
                            </span>
                            <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#EA580C]">
                              {part.nameZh}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span>{meta.nameZh}</span>
                            {part.electricalTag && (
                              <>
                                <span>·</span>
                                <span className="font-mono">
                                  {part.electricalTag}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#EA580C] shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          );
        })()}

        {/* ==================== QUICK PART PICKER ==================== */}
        {activeMode === 'picker' && (
          <>
            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    零件速览与一键定位
                  </h3>
                  <p className="font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                    QUICK PART PICKER · {ROBOT_PARTS.length} ITEMS
                  </p>
                </div>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="筛选编号 MD-01 / 舵机 CH0 / 名称..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#EA580C] focus:ring-1 focus:ring-orange-200 transition-all"
                />
                {quickSearch && (
                  <button
                    type="button"
                    onClick={() => setQuickSearch('')}
                    aria-label="清空搜索"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {groupedParts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center text-xs text-slate-500">
                未找到匹配 “{quickSearch}” 的零件
              </div>
            ) : (
              <div className="space-y-3">
                {groupedParts.map(({ subId, parts }) => {
                  const meta = SUBSYSTEM_META[subId];
                  return (
                    <section key={subId} className="space-y-1.5">
                      <div className="flex items-center justify-between px-0.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          <span className="text-[11px] font-semibold text-slate-700">
                            {meta.nameZh}
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-slate-400">
                          {parts.length}
                        </span>
                      </div>

                      <div className="space-y-1">
                        {parts.map((part) => {
                          const hasCustomCad = Boolean(
                            customCadOverrides[part.id],
                          );
                          return (
                            <button
                              key={part.id}
                              type="button"
                              onClick={() => {
                                onSelectWire(null);
                                onSelectPart(part.id);
                              }}
                              className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-200/80 bg-white hover:border-[#EA580C]/60 hover:bg-orange-50/40 transition-all group"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-[#EA580C] group-hover:text-white transition-colors shrink-0">
                                  {part.code}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-medium text-slate-800 truncate group-hover:text-[#EA580C]">
                                    {part.nameZh}
                                  </div>
                                  {part.electricalTag && (
                                    <div className="font-mono text-[10px] text-slate-400 truncate">
                                      {part.electricalTag}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasCustomCad && (
                                  <span className="font-mono text-[9px] font-bold px-1 py-0.5 rounded bg-orange-100 text-[#EA580C]">
                                    CAD
                                  </span>
                                )}
                                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                                  {part.weightGrams}g
                                </span>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#EA580C]" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
