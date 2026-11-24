import {
  Component,
  ErrorInfo,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, Link2, RotateCcw } from 'lucide-react';
import {
  CircuitDomain,
  CustomCadOverride,
  JointId,
  SubsystemId,
} from './types/robot';
import {
  ASSEMBLY_STEPS,
  DEFAULT_JOINT_ANGLES,
  PART_BY_ID,
} from './data/robotManifest';
import { WIRE_CONNECTIONS } from './data/wiringData';
import { CameraPreset, HeaderBar, ViewMode } from './components/HeaderBar';
import { SceneViewport } from './components/scene/SceneViewport';
import { WiringSchematic2D } from './components/wiring/WiringSchematic2D';
import { SafetyChecklist } from './components/wiring/SafetyChecklist';
import { ControlRail } from './components/panels/ControlRail';
import { InspectorDrawer } from './components/panels/InspectorDrawer';
import { BomWorkbench } from './components/panels/BomWorkbench';

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  constructor(props: SceneErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): SceneErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'WebGL 3D 渲染上下文初始化失败',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[SceneErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-[#EEF1F5] p-6">
          <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 shadow-sm p-6 text-center space-y-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-sm font-bold text-slate-900">
              3D 视口渲染受限（已自动隔离异常）
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              当前浏览器环境未能创建 WebGL 上下文，但您仍可正常使用 2D 接线架构图、防烧板清单与
              BOM / URDF 导出功能。
            </p>
            <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-500 break-all">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重新加载 3D 场景
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const INITIAL_SUBSYSTEM_EXPLODE: Record<SubsystemId, number> = {
  head: 1,
  torso: 1,
  electronics: 1,
  right_leg: 1,
  left_leg: 1,
  hardware: 1,
};

const INITIAL_VISIBLE_SUBSYSTEMS: Record<SubsystemId, boolean> = {
  head: true,
  torso: true,
  electronics: true,
  right_leg: true,
  left_leg: true,
  hardware: true,
};

const INITIAL_ACTIVE_DOMAINS: Record<CircuitDomain, boolean> = {
  power_7v4: true,
  power_5v_servo: true,
  power_logic: true,
  gnd: true,
  i2c: true,
  pwm: true,
};

const WIRE_BY_ID = Object.fromEntries(WIRE_CONNECTIONS.map((w) => [w.id, w]));

export function App() {
  // View & Control Rail tabs
  const [viewMode, setViewMode] = useState<ViewMode>('explode');
  const [controlRailTab, setControlRailTab] = useState<
    'explode' | 'steps' | 'joints'
  >('explode');

  // Exploded Assembly & Kinematics State
  const [masterExplode, setMasterExplode] = useState<number>(0.28);
  const [subsystemExplode, setSubsystemExplode] = useState<
    Record<SubsystemId, number>
  >(INITIAL_SUBSYSTEM_EXPLODE);
  const [visibleSubsystems, setVisibleSubsystems] = useState<
    Record<SubsystemId, boolean>
  >(INITIAL_VISIBLE_SUBSYSTEMS);
  const [jointAngles, setJointAngles] = useState<Record<JointId, number>>({
    ...DEFAULT_JOINT_ANGLES,
  });
  const [activeStep, setActiveStep] = useState<number | null>(null);

  // Viewport Visualization Toggles
  const [xRayMode, setXRayMode] = useState<boolean>(false);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [showLeaderLines, setShowLeaderLines] = useState<boolean>(true);
  const [showHarness, setShowHarness] = useState<boolean>(true);
  const [showCoM, setShowCoM] = useState<boolean>(true);
  const [showCallouts, setShowCallouts] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>('iso');

  // Selection & Circuit Domain Filtering
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [activeDomains, setActiveDomains] = useState<
    Record<CircuitDomain, boolean>
  >(INITIAL_ACTIVE_DOMAINS);

  // Custom Uploaded CAD Overrides (.glb / .stl)
  const [customCadOverrides, setCustomCadOverrides] = useState<
    Record<string, CustomCadOverride>
  >({});

  // Refs for smooth explode animation, manual split-mode toggle tracking, and URL cleanup
  const masterExplodeRef = useRef(masterExplode);
  masterExplodeRef.current = masterExplode;
  const explodeAnimRafRef = useRef<number | null>(null);
  const cameraPresetRafRef = useRef<number | null>(null);
  const manualSplitXRayOffRef = useRef(false);
  const manualHarnessOffRef = useRef(false);
  const cadOverridesRef = useRef(customCadOverrides);
  cadOverridesRef.current = customCadOverrides;

  // Cleanup animation frames & Object URLs on unmount
  useEffect(() => {
    return () => {
      if (explodeAnimRafRef.current !== null) {
        cancelAnimationFrame(explodeAnimRafRef.current);
      }
      if (cameraPresetRafRef.current !== null) {
        cancelAnimationFrame(cameraPresetRafRef.current);
      }
      for (const override of Object.values(cadOverridesRef.current)) {
        URL.revokeObjectURL(override.objectUrl);
      }
    };
  }, []);

  const cancelExplodeAnimation = useCallback(() => {
    if (explodeAnimRafRef.current !== null) {
      cancelAnimationFrame(explodeAnimRafRef.current);
      explodeAnimRafRef.current = null;
    }
  }, []);

  const animateMasterExplodeTo = useCallback(
    (target: number) => {
      cancelExplodeAnimation();
      const clampedTarget = Math.max(0, Math.min(1, target));
      const start = masterExplodeRef.current;
      if (Math.abs(clampedTarget - start) < 0.005) {
        setMasterExplode(clampedTarget);
        return;
      }
      const durationMs = 360;
      const startTime = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        setMasterExplode(start + (clampedTarget - start) * eased);
        if (t < 1) {
          explodeAnimRafRef.current = requestAnimationFrame(tick);
        } else {
          explodeAnimRafRef.current = null;
        }
      };
      explodeAnimRafRef.current = requestAnimationFrame(tick);
    },
    [cancelExplodeAnimation],
  );

  // View Mode Switcher with Split-Mode Auto X-Ray & Harness Enhancement
  const handleChangeViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'split') {
      if (!manualHarnessOffRef.current) {
        setShowHarness(true);
      }
      if (!manualSplitXRayOffRef.current) {
        setXRayMode(true);
      }
    }
  }, []);

  const handleToggleXRay = useCallback(() => {
    setXRayMode((prev) => {
      const next = !prev;
      if (viewMode === 'split') {
        manualSplitXRayOffRef.current = !next;
      } else if (next) {
        manualSplitXRayOffRef.current = false;
      }
      return next;
    });
  }, [viewMode]);

  const handleToggleHarness = useCallback(() => {
    setShowHarness((prev) => {
      const next = !prev;
      manualHarnessOffRef.current = !next;
      return next;
    });
  }, []);

  const handleToggleAnnotations = useCallback(() => {
    const next = !(showLeaderLines && showCallouts);
    setShowLeaderLines(next);
    setShowCallouts(next);
  }, [showLeaderLines, showCallouts]);

  // Allow re-triggering camera preset smoothly even if the same preset is already active
  const handleSelectCameraPreset = useCallback(
    (preset: CameraPreset) => {
      if (cameraPresetRafRef.current !== null) {
        cancelAnimationFrame(cameraPresetRafRef.current);
        cameraPresetRafRef.current = null;
      }
      if (cameraPreset === preset) {
        setCameraPreset(null);
        cameraPresetRafRef.current = requestAnimationFrame(() => {
          setCameraPreset(preset);
          cameraPresetRafRef.current = null;
        });
      } else {
        setCameraPreset(preset);
      }
    },
    [cameraPreset],
  );

  const handleChangeMasterExplode = useCallback(
    (value: number) => {
      cancelExplodeAnimation();
      setMasterExplode(Math.max(0, Math.min(1, value)));
    },
    [cancelExplodeAnimation],
  );

  const handleChangeSubsystemExplode = useCallback(
    (id: SubsystemId, value: number) => {
      setSubsystemExplode((prev) => ({
        ...prev,
        [id]: Math.max(0, Math.min(1, value)),
      }));
    },
    [],
  );

  const handleToggleSubsystemVisible = useCallback((id: SubsystemId) => {
    setVisibleSubsystems((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleChangeActiveStep = useCallback(
    (step: number | null) => {
      setActiveStep(step);
      if (step !== null) {
        const spec = ASSEMBLY_STEPS.find((s) => s.step === step);
        if (spec) {
          animateMasterExplodeTo(spec.recommendedExplode);
        }
      }
    },
    [animateMasterExplodeTo],
  );

  const handleChangeJointAngle = useCallback((id: JointId, deg: number) => {
    setJointAngles((prev) => ({ ...prev, [id]: deg }));
  }, []);

  const handleApplyPose = useCallback((angles: Record<JointId, number>) => {
    setJointAngles({ ...angles });
  }, []);

  // Mutually exclusive selection on non-null picks so 3D, 2D, and Inspector stay strictly in sync
  const handleSelectPart = useCallback((partId: string | null) => {
    setSelectedPartId(partId);
    if (partId !== null) {
      setSelectedWireId(null);
    }
  }, []);

  const handleSelectWire = useCallback((wireId: string | null) => {
    setSelectedWireId(wireId);
    if (wireId !== null) {
      setSelectedPartId(null);
    }
  }, []);

  const handleToggleDomain = useCallback((domain: CircuitDomain) => {
    setActiveDomains((prev) => ({ ...prev, [domain]: !prev[domain] }));
  }, []);

  const handleSetAllDomains = useCallback((enabled: boolean) => {
    setActiveDomains({
      power_7v4: enabled,
      power_5v_servo: enabled,
      power_logic: enabled,
      gnd: enabled,
      i2c: enabled,
      pwm: enabled,
    });
  }, []);

  // Custom CAD Override Upload / Scale / Removal with clean ObjectURL lifecycle
  const handleUploadCad = useCallback((partId: string, file: File) => {
    const lowerName = file.name.toLowerCase();
    const isStl = lowerName.endsWith('.stl');
    const fileType: 'glb' | 'stl' = isStl ? 'stl' : 'glb';
    const defaultScale = isStl ? 0.1 : 1.0;
    const objectUrl = URL.createObjectURL(file);

    setCustomCadOverrides((prev) => {
      const existing = prev[partId];
      if (existing) {
        URL.revokeObjectURL(existing.objectUrl);
      }
      return {
        ...prev,
        [partId]: {
          partId,
          fileName: file.name,
          fileType,
          objectUrl,
          scale: defaultScale,
        },
      };
    });
  }, []);

  const handleUpdateCadScale = useCallback((partId: string, scale: number) => {
    setCustomCadOverrides((prev) => {
      const existing = prev[partId];
      if (!existing) return prev;
      return {
        ...prev,
        [partId]: { ...existing, scale },
      };
    });
  }, []);

  const handleRemoveCad = useCallback((partId: string) => {
    setCustomCadOverrides((prev) => {
      const existing = prev[partId];
      if (!existing) return prev;
      URL.revokeObjectURL(existing.objectUrl);
      const next = { ...prev };
      delete next[partId];
      return next;
    });
  }, []);

  // Jump from BOM table directly into 3D Exploded View focused on the part
  const handleInspectIn3D = useCallback((partId: string) => {
    const part = PART_BY_ID[partId];
    if (part) {
      setVisibleSubsystems((prev) =>
        prev[part.subsystem] ? prev : { ...prev, [part.subsystem]: true },
      );
    }
    setActiveStep(null);
    setSelectedWireId(null);
    setSelectedPartId(partId);
    setViewMode('explode');
  }, []);

  const selectedPart = selectedPartId ? PART_BY_ID[selectedPartId] : null;
  const selectedWire = selectedWireId ? WIRE_BY_ID[selectedWireId] : null;

  const sceneElement = (
    <SceneErrorBoundary>
      <SceneViewport
        masterExplode={masterExplode}
        subsystemExplode={subsystemExplode}
        visibleSubsystems={visibleSubsystems}
        jointAngles={jointAngles}
        xRayMode={xRayMode}
        showAxes={showAxes}
        showLeaderLines={showLeaderLines}
        showHarness={showHarness}
        showCoM={showCoM}
        showCallouts={showCallouts}
        activeStep={activeStep}
        selectedPartId={selectedPartId}
        selectedWireId={selectedWireId}
        activeDomains={activeDomains}
        customCadOverrides={customCadOverrides}
        cameraPreset={cameraPreset}
        onSelectPart={handleSelectPart}
        onSelectWire={handleSelectWire}
      />
    </SceneErrorBoundary>
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#EEF1F5] text-slate-900">
      <HeaderBar
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        xRayMode={xRayMode}
        onToggleXRay={handleToggleXRay}
        showAxes={showAxes}
        onToggleAxes={() => setShowAxes((v) => !v)}
        showHarness={showHarness}
        onToggleHarness={handleToggleHarness}
        showCoM={showCoM}
        onToggleCoM={() => setShowCoM((v) => !v)}
        showAnnotations={showLeaderLines && showCallouts}
        onToggleAnnotations={handleToggleAnnotations}
        cameraPreset={cameraPreset}
        onSelectCameraPreset={handleSelectCameraPreset}
        masterExplode={masterExplode}
        activeStep={activeStep}
        customCadCount={Object.keys(customCadOverrides).length}
      />

      {/* Mode 1: 3D Exploded Assembly Studio */}
      {viewMode === 'explode' && (
        <main className="flex-1 min-h-0 flex overflow-hidden">
          <aside className="w-[288px] xl:w-[304px] shrink-0 h-full border-r border-slate-200/90 bg-white/95 flex flex-col overflow-hidden">
            <ControlRail
              masterExplode={masterExplode}
              onChangeMasterExplode={handleChangeMasterExplode}
              subsystemExplode={subsystemExplode}
              onChangeSubsystemExplode={handleChangeSubsystemExplode}
              visibleSubsystems={visibleSubsystems}
              onToggleSubsystemVisible={handleToggleSubsystemVisible}
              activeStep={activeStep}
              onChangeActiveStep={handleChangeActiveStep}
              jointAngles={jointAngles}
              onChangeJointAngle={handleChangeJointAngle}
              onApplyPose={handleApplyPose}
              activeTab={controlRailTab}
              onChangeTab={setControlRailTab}
            />
          </aside>

          <section
            aria-label="3D 爆炸装配视口"
            className="flex-1 min-w-0 h-full relative bg-[#EEF1F5] overflow-hidden"
          >
            {sceneElement}
          </section>

          <aside className="w-[320px] xl:w-[344px] shrink-0 h-full border-l border-slate-200/90 bg-white/95 flex flex-col overflow-hidden">
            <InspectorDrawer
              selectedPartId={selectedPartId}
              selectedWireId={selectedWireId}
              customCadOverrides={customCadOverrides}
              onSelectPart={handleSelectPart}
              onSelectWire={handleSelectWire}
              onUploadCad={handleUploadCad}
              onUpdateCadScale={handleUpdateCadScale}
              onRemoveCad={handleRemoveCad}
            />
          </aside>
        </main>
      )}

      {/* Mode 2: 50/50 Dual-Screen Synchronized 3D + 2D Wiring View */}
      {viewMode === 'split' && (
        <main className="flex-1 min-h-0 flex overflow-hidden">
          {/* Left 50%: Interactive 3D Scene */}
          <section
            aria-label="3D 机电联动视口"
            className="w-1/2 min-w-0 h-full flex flex-col border-r border-slate-200/90 bg-[#EEF1F5] overflow-hidden"
          >
            <div className="h-9 shrink-0 px-3 bg-white/90 border-b border-slate-200/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  3D 立体线束与机构视图
                </span>
                {(selectedPart || selectedWire) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-orange-50 text-orange-700 border border-orange-200 truncate max-w-[200px]">
                    {selectedPart
                      ? `${selectedPart.code} ${selectedPart.nameZh}`
                      : selectedWire?.label}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <label
                  htmlFor="split-explode-slider"
                  className="text-[11px] font-mono text-slate-500 whitespace-nowrap"
                >
                  爆炸 {Math.round(masterExplode * 100)}%
                </label>
                <input
                  id="split-explode-slider"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={masterExplode}
                  onChange={(e) =>
                    handleChangeMasterExplode(parseFloat(e.target.value))
                  }
                  className="studio-slider w-24"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 relative overflow-hidden">
              {sceneElement}
            </div>
          </section>

          {/* Right 50%: Interactive 2D Wiring Schematic */}
          <section
            aria-label="2D 接线原理联动视图"
            className="w-1/2 min-w-0 h-full flex flex-col bg-[#EEF1F5] overflow-hidden"
          >
            <div className="h-9 shrink-0 px-3 bg-white/90 border-b border-slate-200/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  2D 电气接线架构（双向高亮联动）
                </span>
              </div>
              <span className="text-[11px] text-slate-500 whitespace-nowrap hidden xl:inline">
                点击模块或导线同步定位 3D 实物
              </span>
            </div>

            <div className="flex-1 min-h-0 p-2.5 flex flex-col overflow-hidden">
              <WiringSchematic2D
                selectedPartId={selectedPartId}
                selectedWireId={selectedWireId}
                activeDomains={activeDomains}
                compact
                onSelectPart={handleSelectPart}
                onSelectWire={handleSelectWire}
                onToggleDomain={handleToggleDomain}
                onSetAllDomains={handleSetAllDomains}
              />
            </div>
          </section>
        </main>
      )}

      {/* Mode 3: Full 2D Wiring Schematic + Hardware Safety Checklist */}
      {viewMode === 'wiring' && (
        <main className="flex-1 min-h-0 flex gap-3 p-3 bg-[#EEF1F5] overflow-hidden">
          <section
            aria-label="2D 接线原理图"
            className="flex-1 min-w-0 h-full flex flex-col overflow-hidden"
          >
            <WiringSchematic2D
              selectedPartId={selectedPartId}
              selectedWireId={selectedWireId}
              activeDomains={activeDomains}
              onSelectPart={handleSelectPart}
              onSelectWire={handleSelectWire}
              onToggleDomain={handleToggleDomain}
              onSetAllDomains={handleSetAllDomains}
            />
          </section>

          <aside className="w-[356px] xl:w-[388px] shrink-0 h-full overflow-hidden">
            <SafetyChecklist />
          </aside>
        </main>
      )}

      {/* Mode 4: BOM Table, Print Specs, URDF Preview & CAD Override Manager */}
      {viewMode === 'bom' && (
        <main className="flex-1 min-h-0 w-full overflow-y-auto bg-[#EEF1F5]">
          <BomWorkbench
            selectedPartId={selectedPartId}
            customCadOverrides={customCadOverrides}
            onInspectIn3D={handleInspectIn3D}
            onUploadCad={handleUploadCad}
            onRemoveCad={handleRemoveCad}
          />
        </main>
      )}
    </div>
  );
}

export default App;
