import { useMemo } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  EyeOff,
  Layers,
  ListOrdered,
  RotateCcw,
  Sliders,
  Wrench,
} from 'lucide-react';
import {
  ASSEMBLY_STEPS,
  DEFAULT_JOINT_ANGLES,
  PART_BY_ID,
  POSE_PRESETS,
  ROBOT_JOINTS,
  ROBOT_PARTS,
  SUBSYSTEM_META,
} from '../../data/robotManifest';
import type { JointId, SubsystemId } from '../../types/robot';

export interface ControlRailProps {
  masterExplode: number;
  onChangeMasterExplode: (v: number) => void;
  subsystemExplode: Record<SubsystemId, number>;
  onChangeSubsystemExplode: (id: SubsystemId, v: number) => void;
  visibleSubsystems: Record<SubsystemId, boolean>;
  onToggleSubsystemVisible: (id: SubsystemId) => void;
  activeStep: number | null;
  onChangeActiveStep: (step: number | null) => void;
  jointAngles: Record<JointId, number>;
  onChangeJointAngle: (id: JointId, deg: number) => void;
  onApplyPose: (angles: Record<JointId, number>) => void;
  activeTab: 'explode' | 'steps' | 'joints';
  onChangeTab: (tab: 'explode' | 'steps' | 'joints') => void;
}

const SUBSYSTEM_ORDER: SubsystemId[] = [
  'head',
  'torso',
  'electronics',
  'right_leg',
  'left_leg',
  'hardware',
];

const EXPLODE_PRESETS: { label: string; value: number }[] = [
  { label: '装配态 0%', value: 0 },
  { label: '微展开 32%', value: 0.32 },
  { label: '完全爆炸 100%', value: 1 },
];

const JOINT_GROUPS: {
  id: 'right_leg' | 'left_leg' | 'head';
  labelZh: string;
  labelEn: string;
  color: string;
}[] = [
  { id: 'right_leg', labelZh: '右腿关节', labelEn: 'CH0–CH2', color: '#2563EB' },
  { id: 'left_leg', labelZh: '左腿关节', labelEn: 'CH3–CH5', color: '#7C3AED' },
  { id: 'head', labelZh: '头部云台', labelEn: 'CH6–CH7', color: '#EA580C' },
];

export function ControlRail({
  masterExplode,
  onChangeMasterExplode,
  subsystemExplode,
  onChangeSubsystemExplode,
  visibleSubsystems,
  onToggleSubsystemVisible,
  activeStep,
  onChangeActiveStep,
  jointAngles,
  onChangeJointAngle,
  onApplyPose,
  activeTab,
  onChangeTab,
}: ControlRailProps): JSX.Element {
  const subsystemPartCounts = useMemo(() => {
    const counts: Record<SubsystemId, number> = {
      head: 0,
      torso: 0,
      electronics: 0,
      right_leg: 0,
      left_leg: 0,
      hardware: 0,
    };
    for (const part of ROBOT_PARTS) {
      counts[part.subsystem] += 1;
    }
    return counts;
  }, []);

  const currentStepSpec = useMemo(
    () =>
      activeStep !== null
        ? ASSEMBLY_STEPS.find((s) => s.step === activeStep) ?? null
        : null,
    [activeStep],
  );

  const activePoseId = useMemo(() => {
    for (const preset of POSE_PRESETS) {
      const matches = ROBOT_JOINTS.every(
        (j) => Math.abs((jointAngles[j.id] ?? 0) - preset.angles[j.id]) < 0.5,
      );
      if (matches) return preset.id;
    }
    return null;
  }, [jointAngles]);

  const activePoseSpec = useMemo(
    () => POSE_PRESETS.find((p) => p.id === activePoseId) ?? null,
    [activePoseId],
  );

  const allSubsystemsVisible = SUBSYSTEM_ORDER.every(
    (id) => visibleSubsystems[id],
  );

  const handleShowAllSubsystems = () => {
    for (const id of SUBSYSTEM_ORDER) {
      if (!visibleSubsystems[id]) {
        onToggleSubsystemVisible(id);
      }
    }
  };

  const handleResetSubsystemScales = () => {
    for (const id of SUBSYSTEM_ORDER) {
      if (Math.abs((subsystemExplode[id] ?? 1) - 1) > 0.001) {
        onChangeSubsystemExplode(id, 1);
      }
    }
  };

  const hasCustomSubsystemScale = SUBSYSTEM_ORDER.some(
    (id) => Math.abs((subsystemExplode[id] ?? 1) - 1) > 0.001,
  );

  return (
    <div className="h-full w-full min-h-0 flex flex-col bg-white/95 backdrop-blur text-slate-900 overflow-hidden">
      {/* Compact 3-Tab Switcher */}
      <div className="shrink-0 p-2.5 border-b border-slate-200 bg-slate-50/80">
        <div
          className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70"
          role="tablist"
          aria-label="控制面板切换"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'explode'}
            onClick={() => onChangeTab('explode')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all ${
              activeTab === 'explode'
                ? 'bg-[#EA580C] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">爆炸拆解</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'steps'}
            onClick={() => onChangeTab('steps')}
            className={`relative flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all ${
              activeTab === 'steps'
                ? 'bg-[#EA580C] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">分步装机</span>
            {activeStep !== null && (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeTab === 'steps' ? 'bg-white' : 'bg-[#EA580C]'
                }`}
              />
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'joints'}
            onClick={() => onChangeTab('joints')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-all ${
              activeTab === 'joints'
                ? 'bg-[#EA580C] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">关节运动</span>
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* ==================== TAB 1: EXPLODE ==================== */}
        {activeTab === 'explode' && (
          <>
            {/* Master Explode Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    全局爆炸系数
                  </h3>
                  <p className="font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                    MASTER EXPLODE FACTOR
                  </p>
                </div>
                <span className="font-mono text-lg font-bold tabular-nums text-[#EA580C]">
                  {Math.round(masterExplode * 100)}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterExplode}
                onChange={(e) => onChangeMasterExplode(Number(e.target.value))}
                aria-label="全局爆炸系数"
                className="studio-slider w-full"
              />

              <div className="grid grid-cols-3 gap-1.5 mt-3">
                {EXPLODE_PRESETS.map((preset) => {
                  const isActive = Math.abs(masterExplode - preset.value) < 0.02;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => onChangeMasterExplode(preset.value)}
                      className={`py-1.5 px-1.5 rounded-lg border text-[11px] font-medium transition-all text-center ${
                        isActive
                          ? 'border-[#EA580C] bg-orange-50 text-[#EA580C] font-semibold'
                          : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-slate-100/70'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Per-Subsystem Visibility & Fine-Tune */}
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-900">
                    子系统分层拆解
                  </h3>
                  <p className="font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                    SUBSYSTEM LAYERS
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!allSubsystemsVisible && (
                    <button
                      type="button"
                      onClick={handleShowAllSubsystems}
                      className="text-[11px] px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:text-[#EA580C] hover:border-orange-200 bg-slate-50 transition-colors"
                    >
                      全部显示
                    </button>
                  )}
                  {hasCustomSubsystemScale && (
                    <button
                      type="button"
                      onClick={handleResetSubsystemScales}
                      className="text-[11px] px-2 py-0.5 rounded border border-slate-200 text-slate-600 hover:text-[#EA580C] hover:border-orange-200 bg-slate-50 transition-colors"
                      title="重置全部子系统倍率至 100%"
                    >
                      重置
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {SUBSYSTEM_ORDER.map((id) => {
                  const meta = SUBSYSTEM_META[id];
                  const isVisible = visibleSubsystems[id];
                  const factor = subsystemExplode[id] ?? 1;

                  return (
                    <div
                      key={id}
                      className={`rounded-lg border p-2.5 transition-all ${
                        isVisible
                          ? 'border-slate-200/90 bg-slate-50/40'
                          : 'border-slate-200/60 bg-slate-100/50 opacity-65'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: meta.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-xs font-medium truncate ${
                                  isVisible
                                    ? 'text-slate-800'
                                    : 'text-slate-500 line-through'
                                }`}
                              >
                                {meta.nameZh}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 shrink-0">
                                {subsystemPartCounts[id]}件
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[11px] tabular-nums text-slate-500 w-9 text-right">
                            {Math.round(factor * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => onToggleSubsystemVisible(id)}
                            aria-label={
                              isVisible
                                ? `隐藏 ${meta.nameZh}`
                                : `显示 ${meta.nameZh}`
                            }
                            title={isVisible ? '点击隐藏该子系统' : '点击显示该子系统'}
                            className={`p-1 rounded-md border transition-colors ${
                              isVisible
                                ? 'border-slate-200 bg-white text-slate-600 hover:text-[#EA580C] hover:border-orange-300'
                                : 'border-slate-200 bg-slate-200/70 text-slate-400 hover:text-slate-700'
                            }`}
                          >
                            {isVisible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={factor}
                        disabled={!isVisible}
                        onChange={(e) =>
                          onChangeSubsystemExplode(id, Number(e.target.value))
                        }
                        aria-label={`${meta.nameZh} 爆炸微调`}
                        className="studio-slider w-full disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* ==================== TAB 2: ASSEMBLY STEPS ==================== */}
        {activeTab === 'steps' && (
          <>
            {/* Navigation & Exit Control */}
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[11px] font-semibold tracking-wider text-[#EA580C]">
                    {activeStep !== null
                      ? `STEP 0${activeStep} / 0${ASSEMBLY_STEPS.length}`
                      : 'FULL ASSEMBLY'}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    乐高式 8 步教学装机引导
                  </p>
                </div>

                {activeStep !== null ? (
                  <button
                    type="button"
                    onClick={() => onChangeActiveStep(null)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 hover:text-[#EA580C] text-[11px] font-medium text-slate-700 transition-colors shrink-0"
                  >
                    退出分步/全机显示
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChangeActiveStep(1)}
                    className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white text-[11px] font-medium transition-colors shrink-0 shadow-sm"
                  >
                    开始第 1 步
                  </button>
                )}
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#EA580C] transition-all duration-300"
                  style={{
                    width: `${
                      activeStep !== null
                        ? (activeStep / ASSEMBLY_STEPS.length) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              {/* Prev / Next Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={activeStep === null || activeStep <= 1}
                  onClick={() => {
                    if (activeStep !== null && activeStep > 1) {
                      onChangeActiveStep(activeStep - 1);
                    }
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>上一步</span>
                </button>
                <button
                  type="button"
                  disabled={activeStep === ASSEMBLY_STEPS.length}
                  onClick={() => {
                    if (activeStep === null) {
                      onChangeActiveStep(1);
                    } else if (activeStep < ASSEMBLY_STEPS.length) {
                      onChangeActiveStep(activeStep + 1);
                    }
                  }}
                  className="flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg border border-orange-200 bg-orange-50/80 text-xs font-semibold text-[#EA580C] hover:bg-orange-100/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <span>{activeStep === null ? '进入第 1 步' : '下一步'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>

            {/* Active Step Instruction Card */}
            {currentStepSpec ? (
              <section className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50/70 to-white p-3 space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {currentStepSpec.step}. {currentStepSpec.title}
                    </h4>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">
                      {currentStepSpec.subtitle}
                    </p>
                  </div>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-[#EA580C] font-semibold shrink-0">
                    推荐展开 {Math.round(currentStepSpec.recommendedExplode * 100)}%
                  </span>
                </div>

                {/* Required Parts */}
                <div>
                  <div className="text-[11px] font-medium text-slate-500 mb-1.5">
                    本步装入零件 ({currentStepSpec.partIds.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {currentStepSpec.partIds.map((pid) => {
                      const part = PART_BY_ID[pid];
                      if (!part) return null;
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] text-slate-700"
                        >
                          <span className="font-mono text-[10px] font-semibold text-slate-500">
                            {part.code}
                          </span>
                          <span className="truncate max-w-[130px]">
                            {part.nameZh}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Fasteners */}
                <div className="flex items-start gap-2 rounded-lg bg-slate-100/80 border border-slate-200/80 px-2.5 py-2">
                  <Wrench className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <span className="font-semibold text-slate-700">
                      所需紧固件：
                    </span>
                    <span className="text-slate-600">
                      {currentStepSpec.fasteners}
                    </span>
                  </div>
                </div>

                {/* Engineering Tip */}
                <div className="flex items-start gap-2 rounded-lg bg-amber-50/90 border border-amber-200/90 px-2.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed text-amber-950">
                    <span className="font-semibold">工程要点：</span>
                    {currentStepSpec.engineeringTip}
                  </div>
                </div>
              </section>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-xs text-slate-500 leading-relaxed">
                当前处于<span className="font-semibold text-slate-700">全机显示模式</span>
                。点击下方任意步骤（1–8）即可高亮该步零件并隐藏后续步骤，自动切换推荐爆炸比例。
              </div>
            )}

            {/* Clickable 8-Step List */}
            <section className="space-y-1.5">
              {ASSEMBLY_STEPS.map((s) => {
                const isActive = activeStep === s.step;
                const isCompleted = activeStep !== null && s.step < activeStep;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => onChangeActiveStep(s.step)}
                    className={`w-full text-left flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'border-[#EA580C] bg-orange-50/60 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[11px] font-bold shrink-0 mt-0.5 transition-colors ${
                        isActive
                          ? 'bg-[#EA580C] text-white'
                          : isCompleted
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        `0${s.step}`
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span
                          className={`text-xs font-semibold truncate ${
                            isActive ? 'text-[#EA580C]' : 'text-slate-800'
                          }`}
                        >
                          {s.title}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 shrink-0">
                          {s.partIds.length}件
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </section>
          </>
        )}

        {/* ==================== TAB 3: JOINTS ==================== */}
        {activeTab === 'joints' && (
          <>
            {/* Pose Presets Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-2.5">
              <div>
                <h3 className="text-xs font-semibold text-slate-900">
                  预设教学姿态
                </h3>
                <p className="font-mono text-[10px] tracking-wide text-slate-400 uppercase">
                  KINEMATIC POSE PRESETS
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {POSE_PRESETS.map((preset) => {
                  const isActive = activePoseId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onApplyPose({ ...preset.angles })}
                      title={preset.description}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium text-left transition-all ${
                        isActive
                          ? 'border-[#EA580C] bg-[#EA580C] text-white shadow-sm'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => onApplyPose({ ...DEFAULT_JOINT_ANGLES })}
                className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-orange-50 hover:text-[#EA580C] text-xs font-medium text-slate-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>全部归零 (90° 中位)</span>
              </button>

              {activePoseSpec && (
                <p className="text-[11px] leading-relaxed text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-2.5 py-1.5">
                  {activePoseSpec.description}
                </p>
              )}
            </section>

            {/* 8 Joint Sliders Grouped by Subsystem */}
            {JOINT_GROUPS.map((group) => {
              const joints = ROBOT_JOINTS.filter(
                (j) => j.subsystem === group.id,
              );
              return (
                <section
                  key={group.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <h4 className="text-xs font-semibold text-slate-800">
                        {group.labelZh}
                      </h4>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400">
                      {group.labelEn}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {joints.map((joint) => {
                      const deg = jointAngles[joint.id] ?? 0;
                      const formattedDeg =
                        deg > 0 ? `+${Math.round(deg)}°` : `${Math.round(deg)}°`;

                      return (
                        <div key={joint.id} className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                                style={{ backgroundColor: group.color }}
                              >
                                {joint.channel}
                              </span>
                              <span className="text-xs font-medium text-slate-800 truncate">
                                {joint.nameZh}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => onChangeJointAngle(joint.id, 0)}
                              title="点击单轴归零 (0° / 舵机 90° 中位)"
                              className={`font-mono text-xs font-bold tabular-nums px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                                Math.abs(deg) > 0.5
                                  ? 'bg-orange-50 text-[#EA580C] border border-orange-200 hover:bg-orange-100'
                                  : 'bg-slate-100 text-slate-600 border border-transparent hover:border-slate-300'
                              }`}
                            >
                              {formattedDeg}
                            </button>
                          </div>

                          <input
                            type="range"
                            min={joint.minDeg}
                            max={joint.maxDeg}
                            step={1}
                            value={deg}
                            onChange={(e) =>
                              onChangeJointAngle(
                                joint.id,
                                Number(e.target.value),
                              )
                            }
                            aria-label={`${joint.channel} ${joint.nameZh}`}
                            className="studio-slider w-full"
                          />

                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              <Compass className="w-2.5 h-2.5 text-slate-400" />
                              {joint.axisLabel}
                            </span>
                            <span className="tabular-nums">
                              [{joint.minDeg}°, +{joint.maxDeg}°] · 舵机{' '}
                              {90 + Math.round(deg)}°
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
