import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cable,
  CheckSquare,
  Info,
  Layers,
  MousePointerClick,
  Square,
  X,
  Zap,
} from 'lucide-react';
import { PART_BY_ID } from '../../data/robotManifest';
import {
  CIRCUIT_DOMAIN_META,
  WIRE_CONNECTIONS,
  WIRING_NODES,
} from '../../data/wiringData';
import {
  CircuitDomain,
  WireConnectionSpec,
  WiringNodeSpec,
} from '../../types/robot';

export interface WiringSchematic2DProps {
  selectedPartId: string | null;
  selectedWireId: string | null;
  activeDomains: Record<CircuitDomain, boolean>;
  compact?: boolean;
  onSelectPart: (partId: string | null) => void;
  onSelectWire: (wireId: string | null) => void;
  onToggleDomain: (domain: CircuitDomain) => void;
  onSetAllDomains: (enabled: boolean) => void;
}

const DOMAIN_ORDER: CircuitDomain[] = [
  'power_7v4',
  'power_5v_servo',
  'power_logic',
  'gnd',
  'i2c',
  'pwm',
];

interface ZoneBoxSpec {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  accent: string;
  labelPosition: 'top-left' | 'top-right' | 'bottom-left';
}

const SCHEMATIC_ZONES: ZoneBoxSpec[] = [
  {
    id: 'zone_power',
    x: 22,
    y: 14,
    width: 234,
    height: 368,
    title: '电源管理区 · POWER STAGE',
    accent: '#DC2626',
    labelPosition: 'top-left',
  },
  {
    id: 'zone_mcu_imu',
    x: 304,
    y: 14,
    width: 558,
    height: 204,
    title: '主控与感知区 · MCU & IMU',
    accent: '#0284C7',
    labelPosition: 'top-left',
  },
  {
    id: 'zone_driver',
    x: 304,
    y: 244,
    width: 352,
    height: 198,
    title: '16路PWM驱动区 · DRIVER',
    accent: '#7C3AED',
    labelPosition: 'top-right',
  },
  {
    id: 'zone_head',
    x: 708,
    y: 244,
    width: 326,
    height: 198,
    title: '头部 CH6–7 执行器区 · HEAD (2 DOF)',
    accent: '#EA580C',
    labelPosition: 'top-left',
  },
  {
    id: 'zone_right_leg',
    x: 30,
    y: 480,
    width: 496,
    height: 94,
    title: '右腿 CH0–2 执行器区 · RIGHT LEG (3 DOF)',
    accent: '#2563EB',
    labelPosition: 'bottom-left',
  },
  {
    id: 'zone_left_leg',
    x: 530,
    y: 480,
    width: 496,
    height: 94,
    title: '左腿 CH3–5 执行器区 · LEFT LEG (3 DOF)',
    accent: '#7C3AED',
    labelPosition: 'bottom-left',
  },
];

interface WireInlineTag {
  text: string;
  x: number;
  y: number;
  pill?: boolean;
}

const WIRE_INLINE_TAGS: Record<string, WireInlineTag> = {
  wire_bat_pos: { text: '7.4V · SW', x: 108, y: 193, pill: true },
  wire_bat_gnd: { text: 'GND', x: 168, y: 193, pill: true },
  wire_ubec_pca_vplus: { text: '5V 5A', x: 279, y: 306, pill: true },
  wire_ubec_pca_gnd: { text: 'GND', x: 279, y: 336, pill: true },
  wire_ubec_esp_vin: { text: 'VIN 5V', x: 297, y: 80, pill: false },
  wire_esp_gnd_star: { text: 'GND', x: 305, y: 111, pill: false },
  wire_esp_pca_3v3: { text: '3.3V', x: 380, y: 231, pill: true },
  wire_i2c_pca_sda: { text: 'SDA', x: 448, y: 231, pill: true },
  wire_i2c_pca_scl: { text: 'SCL', x: 498, y: 231, pill: true },
  wire_esp_imu_3v3: { text: '3.3V', x: 603, y: 78, pill: true },
  wire_i2c_imu_bus: { text: 'SDA/SCL', x: 603, y: 122, pill: true },
  wire_pwm_ch6: { text: 'CH6', x: 682, y: 299, pill: true },
  wire_pwm_ch7: { text: 'CH7', x: 682, y: 389, pill: true },
};

const PCA_BOTTOM_PORTS: { ch: string; x: number; wireId: string; color: string }[] = [
  { ch: 'CH0', x: 352, wireId: 'wire_pwm_ch0', color: '#2563EB' },
  { ch: 'CH1', x: 392, wireId: 'wire_pwm_ch1', color: '#3B82F6' },
  { ch: 'CH2', x: 432, wireId: 'wire_pwm_ch2', color: '#60A5FA' },
  { ch: 'CH3', x: 484, wireId: 'wire_pwm_ch3', color: '#7C3AED' },
  { ch: 'CH4', x: 524, wireId: 'wire_pwm_ch4', color: '#8B5CF6' },
  { ch: 'CH5', x: 564, wireId: 'wire_pwm_ch5', color: '#A78BFA' },
];

const ESP_BOTTOM_PORTS: { label: string; x: number; wireId: string; color: string }[] = [
  { label: '3V3', x: 380, wireId: 'wire_esp_pca_3v3', color: '#0284C7' },
  { label: 'SDA', x: 448, wireId: 'wire_i2c_pca_sda', color: '#059669' },
  { label: 'SCL', x: 498, wireId: 'wire_i2c_pca_scl', color: '#10B981' },
];

const NODE_BY_ID: Record<string, WiringNodeSpec> = Object.fromEntries(
  WIRING_NODES.map((n) => [n.id, n]),
);

const WIRE_COUNT_BY_DOMAIN: Record<CircuitDomain, number> = DOMAIN_ORDER.reduce(
  (acc, domain) => {
    acc[domain] = WIRE_CONNECTIONS.filter((w) => w.domain === domain).length;
    return acc;
  },
  {} as Record<CircuitDomain, number>,
);

/**
 * Generates an SVG path string with smooth circular-arc / quadratic rounded corners
 * for orthogonal wire routes, clamping each corner radius to half the shortest adjacent segment.
 */
function buildRoundedOrthogonalPath(
  points: [number, number][],
  cornerRadius = 7,
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;
  if (points.length === 2) {
    return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
  }

  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const v1x = curr[0] - prev[0];
    const v1y = curr[1] - prev[1];
    const len1 = Math.hypot(v1x, v1y);

    const v2x = next[0] - curr[0];
    const v2y = next[1] - curr[1];
    const len2 = Math.hypot(v2x, v2y);

    if (len1 < 0.01 || len2 < 0.01) {
      d += ` L ${curr[0]} ${curr[1]}`;
      continue;
    }

    const r = Math.min(cornerRadius, len1 / 2, len2 / 2);
    const inX = curr[0] - (v1x / len1) * r;
    const inY = curr[1] - (v1y / len1) * r;
    const outX = curr[0] + (v2x / len2) * r;
    const outY = curr[1] + (v2y / len2) * r;

    d += ` L ${inX.toFixed(2)} ${inY.toFixed(2)} Q ${curr[0]} ${curr[1]} ${outX.toFixed(2)} ${outY.toFixed(2)}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

function getNodeHeaderMeta(node: WiringNodeSpec): {
  headerBg: string;
  tag: string;
  softBg: string;
} {
  if (node.category === 'power') {
    return {
      headerBg: node.id === 'node_battery' ? '#DC2626' : '#EA580C',
      tag: 'PWR',
      softBg: '#FFF7ED',
    };
  }
  if (node.category === 'mcu') {
    return { headerBg: '#0284C7', tag: 'MCU', softBg: '#F0F9FF' };
  }
  if (node.category === 'sensor') {
    return { headerBg: '#059669', tag: 'IMU', softBg: '#ECFDF5' };
  }
  if (node.category === 'driver') {
    return { headerBg: '#7C3AED', tag: 'PWM · 0x40', softBg: '#F5F3FF' };
  }
  // Servo color matches subsystem (Right Leg blue, Left Leg violet, Head orange)
  if (
    node.id === 'node_ch0' ||
    node.id === 'node_ch1' ||
    node.id === 'node_ch2'
  ) {
    return { headerBg: '#2563EB', tag: 'R-LEG', softBg: '#EFF6FF' };
  }
  if (
    node.id === 'node_ch3' ||
    node.id === 'node_ch4' ||
    node.id === 'node_ch5'
  ) {
    return { headerBg: '#7C3AED', tag: 'L-LEG', softBg: '#F5F3FF' };
  }
  return { headerBg: '#EA580C', tag: 'HEAD · 2 DOF', softBg: '#FFF7ED' };
}

function getPinDotColor(pin: string): string {
  const upper = pin.toUpperCase();
  if (upper.includes('7.4V') || upper.includes('BAT+')) return '#DC2626';
  if (upper.includes('V+') || upper.includes('5V(红)') || upper.includes('5A'))
    return '#EA580C';
  if (upper.includes('PWM')) return '#F97316';
  if (upper.includes('3.3V') || upper.includes('3V3') || upper.includes('VIN'))
    return '#0284C7';
  if (upper.includes('SDA') || upper.includes('SCL')) return '#059669';
  if (upper.includes('CH0')) return '#7C3AED';
  if (upper.includes('GND') || upper.includes('BAT-') || upper.includes('IN-'))
    return '#334155';
  return '#64748B';
}

function estimateTextPx(text: string, asciiW = 5.2, cjkW = 8.8): number {
  let w = 0;
  for (let i = 0; i < text.length; i++) {
    w += text.charCodeAt(i) > 255 ? cjkW : asciiW;
  }
  return w;
}

interface PlacedPin {
  label: string;
  x: number;
  y: number;
  width: number;
  dotColor: string;
}

function layoutPinBadges(
  pins: string[],
  startX: number,
  startY: number,
  maxWidth: number,
  pillHeight = 16,
  gapX = 5,
  gapY = 5,
  asciiW = 5.2,
  cjkW = 8.4,
  padX = 16,
): PlacedPin[] {
  const placed: PlacedPin[] = [];
  let cursorX = startX;
  let cursorY = startY;

  for (const pin of pins) {
    const pillW = Math.ceil(estimateTextPx(pin, asciiW, cjkW)) + padX;
    if (cursorX > startX && cursorX + pillW > startX + maxWidth) {
      cursorX = startX;
      cursorY += pillHeight + gapY;
    }
    placed.push({
      label: pin,
      x: cursorX,
      y: cursorY,
      width: Math.min(pillW, maxWidth),
      dotColor: getPinDotColor(pin),
    });
    cursorX += pillW + gapX;
  }

  return placed;
}

function getBaseWireStrokeWidth(domain: CircuitDomain): number {
  if (domain === 'power_7v4' || domain === 'power_5v_servo') return 3.1;
  if (domain === 'gnd') return 2.5;
  return 2.2;
}

export function WiringSchematic2D({
  selectedPartId,
  selectedWireId,
  activeDomains,
  compact = false,
  onSelectPart,
  onSelectWire,
  onToggleDomain,
  onSetAllDomains,
}: WiringSchematic2DProps): JSX.Element {
  const [hoveredWireId, setHoveredWireId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const allDomainsEnabled = DOMAIN_ORDER.every((d) => activeDomains[d]);
  const activeDomainCount = DOMAIN_ORDER.filter((d) => activeDomains[d]).length;

  const selectedWire: WireConnectionSpec | null = useMemo(
    () =>
      selectedWireId
        ? WIRE_CONNECTIONS.find((w) => w.id === selectedWireId) ?? null
        : null,
    [selectedWireId],
  );

  const hoveredWire: WireConnectionSpec | null = useMemo(
    () =>
      hoveredWireId
        ? WIRE_CONNECTIONS.find((w) => w.id === hoveredWireId) ?? null
        : null,
    [hoveredWireId],
  );

  const selectedNode: WiringNodeSpec | null = useMemo(
    () =>
      selectedPartId
        ? WIRING_NODES.find((n) => n.partId === selectedPartId) ?? null
        : null,
    [selectedPartId],
  );

  const selectedPartSpec = useMemo(
    () => (selectedPartId ? PART_BY_ID[selectedPartId] ?? null : null),
    [selectedPartId],
  );

  const selectedPartHasSchematicMatch = useMemo(() => {
    if (!selectedPartId) return false;
    return (
      Boolean(selectedNode) ||
      WIRE_CONNECTIONS.some((w) => w.relatedPartIds.includes(selectedPartId))
    );
  }, [selectedPartId, selectedNode]);

  const hasElectricalFocus =
    Boolean(selectedWire) || selectedPartHasSchematicMatch;

  const highlightedWireIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedWire) {
      ids.add(selectedWire.id);
    }
    if (selectedPartId && selectedPartHasSchematicMatch) {
      for (const wire of WIRE_CONNECTIONS) {
        if (
          wire.relatedPartIds.includes(selectedPartId) &&
          activeDomains[wire.domain]
        ) {
          ids.add(wire.id);
        }
      }
    }
    return ids;
  }, [selectedWire, selectedPartId, selectedPartHasSchematicMatch, activeDomains]);

  const hoverRelatedWireIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredWireId) ids.add(hoveredWireId);
    if (hoveredNodeId) {
      const hoveredNode = NODE_BY_ID[hoveredNodeId];
      if (hoveredNode) {
        for (const wire of WIRE_CONNECTIONS) {
          if (
            activeDomains[wire.domain] &&
            (wire.fromNodeId === hoveredNodeId ||
              wire.toNodeId === hoveredNodeId ||
              wire.relatedPartIds.includes(hoveredNode.partId))
          ) {
            ids.add(wire.id);
          }
        }
      }
    }
    return ids;
  }, [hoveredWireId, hoveredNodeId, activeDomains]);

  const partnerNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedWire) {
      ids.add(selectedWire.fromNodeId);
      ids.add(selectedWire.toNodeId);
    }
    if (selectedPartId && selectedPartHasSchematicMatch) {
      for (const wire of WIRE_CONNECTIONS) {
        if (
          activeDomains[wire.domain] &&
          wire.relatedPartIds.includes(selectedPartId)
        ) {
          ids.add(wire.fromNodeId);
          ids.add(wire.toNodeId);
        }
      }
    }
    return ids;
  }, [selectedWire, selectedPartId, selectedPartHasSchematicMatch, activeDomains]);

  const hoveredEndpointNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredWire) {
      ids.add(hoveredWire.fromNodeId);
      ids.add(hoveredWire.toNodeId);
    }
    return ids;
  }, [hoveredWire]);

  const selectedPartConnectedWires = useMemo(() => {
    if (!selectedPartId) return [];
    return WIRE_CONNECTIONS.filter((w) =>
      w.relatedPartIds.includes(selectedPartId),
    );
  }, [selectedPartId]);

  const wirePaths = useMemo(
    () =>
      WIRE_CONNECTIONS.map((wire) => {
        const pts: [number, number][] = [
          wire.start2D,
          ...(wire.waypoints2D ?? []),
          wire.end2D,
        ];
        return {
          wire,
          d: buildRoundedOrthogonalPath(pts, 7),
        };
      }),
    [],
  );

  // Order wires so inactive/dimmed render beneath highlighted/hovered wires
  const orderedWirePaths = useMemo(() => {
    return [...wirePaths].sort((a, b) => {
      const score = (w: WireConnectionSpec) => {
        if (w.id === selectedWireId) return 4;
        if (w.id === hoveredWireId) return 3;
        if (highlightedWireIds.has(w.id)) return 2;
        if (hoverRelatedWireIds.has(w.id)) return 1.5;
        return activeDomains[w.domain] ? 1 : 0;
      };
      return score(a.wire) - score(b.wire);
    });
  }, [
    wirePaths,
    selectedWireId,
    hoveredWireId,
    highlightedWireIds,
    hoverRelatedWireIds,
    activeDomains,
  ]);

  const handleClearSelection = () => {
    onSelectPart(null);
    onSelectWire(null);
  };

  // Determine ribbon display subject (selected wire takes precedence, then hovered wire when nothing selected, then selected part)
  const ribbonWire = selectedWire ?? (!selectedPartId ? hoveredWire : null);

  return (
    <div className="h-full w-full flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Top Circuit Domain Filter Bar */}
      <div
        className={`shrink-0 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-1.5 ${
          compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 pr-1 mr-0.5 border-r border-slate-200">
            <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700 tracking-tight whitespace-nowrap">
              电路域筛选
            </span>
          </div>

          {/* All toggle pill */}
          <button
            type="button"
            onClick={() => onSetAllDomains(!allDomainsEnabled)}
            title="切换全部电路域显示"
            className={`inline-flex items-center gap-1 rounded-md border font-medium transition-colors whitespace-nowrap ${
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[11px]'
            } ${
              allDomainsEnabled
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            <span>全部</span>
            <span
              className={`font-mono text-[10px] ${
                allDomainsEnabled ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              {activeDomainCount}/{DOMAIN_ORDER.length}
            </span>
          </button>

          {/* Per-domain filter pills */}
          {DOMAIN_ORDER.map((domain) => {
            const meta = CIRCUIT_DOMAIN_META[domain];
            const enabled = activeDomains[domain];
            return (
              <button
                key={domain}
                type="button"
                onClick={() => onToggleDomain(domain)}
                title={`${meta.label}：${meta.description}`}
                className={`inline-flex items-center gap-1.5 rounded-md border transition-all whitespace-nowrap ${
                  compact
                    ? 'px-2 py-0.5 text-[11px]'
                    : 'px-2.5 py-1 text-[11px]'
                } ${
                  enabled
                    ? 'bg-white text-slate-800 border-slate-300 shadow-sm font-medium hover:border-slate-400'
                    : 'bg-slate-100/80 text-slate-400 border-slate-200/80 hover:text-slate-600 hover:bg-white'
                }`}
                style={
                  enabled
                    ? {
                        borderColor: `${meta.color}66`,
                        boxShadow: `inset 0 0 0 1px ${meta.color}18`,
                      }
                    : undefined
                }
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                  style={{
                    backgroundColor: meta.color,
                    opacity: enabled ? 1 : 0.35,
                  }}
                />
                <span>{meta.shortLabel}</span>
                {!compact && (
                  <span className="font-mono text-[10px] text-slate-400">
                    {WIRE_COUNT_BY_DOMAIN[domain]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Select All / Clear All */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSetAllDomains(true)}
            disabled={allDomainsEnabled}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="显示所有电路层"
          >
            <CheckSquare className="w-3 h-3" />
            <span>全选</span>
          </button>
          <button
            type="button"
            onClick={() => onSetAllDomains(false)}
            disabled={activeDomainCount === 0}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            title="清空全部电路层"
          >
            <Square className="w-3 h-3" />
            <span>清空</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Interactive SVG Schematic Canvas */}
      <div className="relative flex-1 min-h-0 w-full bg-white blueprint-dots overflow-hidden flex items-center justify-center p-2">
        <svg
          viewBox="0 0 1056 584"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-w-full max-h-full block select-none"
          role="img"
          aria-label="MiniDuck-Edu 8-DOF 2D 电气接线架构图"
          onClick={handleClearSelection}
        >
          <defs>
            <style>{`
              @keyframes wiringFlowDash {
                from { stroke-dashoffset: 32; }
                to { stroke-dashoffset: 0; }
              }
              .wiring-flow-overlay {
                animation: wiringFlowDash 0.85s linear infinite;
              }
            `}</style>
            <filter
              id="wiring-card-shadow"
              x="-8%"
              y="-8%"
              width="116%"
              height="120%"
            >
              <feDropShadow
                dx="0"
                dy="1.5"
                stdDeviation="2"
                floodColor="#0F172A"
                floodOpacity="0.07"
              />
            </filter>
            <filter
              id="wiring-card-active-shadow"
              x="-12%"
              y="-12%"
              width="124%"
              height="128%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="4"
                floodColor="#EA580C"
                floodOpacity="0.22"
              />
            </filter>
          </defs>

          {/* Subtle Swiss-CAD sheet outer frame */}
          <rect
            x={6}
            y={6}
            width={1044}
            height={572}
            rx={8}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={1}
          />

          {/* 1. Grouped Engineering Zone Outlines */}
          <g className="pointer-events-none">
            {SCHEMATIC_ZONES.map((zone) => {
              const labelX =
                zone.labelPosition === 'top-right'
                  ? zone.x + zone.width - 10
                  : zone.x + 10;
              const labelY =
                zone.labelPosition === 'bottom-left'
                  ? zone.y + zone.height - 6
                  : zone.y + 15;
              const textAnchor =
                zone.labelPosition === 'top-right' ? 'end' : 'start';

              return (
                <g key={zone.id}>
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.width}
                    height={zone.height}
                    rx={8}
                    fill="#F8FAFC"
                    fillOpacity={0.55}
                    stroke="#CBD5E1"
                    strokeWidth={1.1}
                    strokeDasharray="5 4"
                  />
                  {/* Corner CAD registration ticks */}
                  <path
                    d={`M ${zone.x + 2} ${zone.y + 10} L ${zone.x + 2} ${zone.y + 2} L ${zone.x + 10} ${zone.y + 2}`}
                    fill="none"
                    stroke={zone.accent}
                    strokeWidth={1.5}
                    strokeOpacity={0.55}
                  />
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor={textAnchor}
                    fontSize={9.5}
                    fontWeight={600}
                    fill="#475569"
                    className="font-mono tracking-wide"
                  >
                    {zone.title}
                  </text>
                </g>
              );
            })}

            {/* Top-Right Swiss-CAD Technical Title & Quick Reference Block */}
            <g>
              <rect
                x={878}
                y={14}
                width={156}
                height={204}
                rx={7}
                fill="#FFFFFF"
                fillOpacity={0.95}
                stroke="#CBD5E1"
                strokeWidth={1}
              />
              <rect
                x={878}
                y={14}
                width={156}
                height={24}
                rx={7}
                fill="#0F172A"
              />
              <rect
                x={878}
                y={30}
                width={156}
                height={8}
                fill="#0F172A"
              />
              <text
                x={888}
                y={30}
                fontSize={9.5}
                fontWeight={700}
                fill="#FFFFFF"
                className="font-mono"
              >
                MINIDUCK-EDU · R1
              </text>
              <text
                x={888}
                y={53}
                fontSize={9.5}
                fontWeight={600}
                fill="#0F172A"
              >
                8-DOF 教学电气架构
              </text>
              <line
                x1={888}
                y1={61}
                x2={1024}
                y2={61}
                stroke="#E2E8F0"
                strokeWidth={0.8}
              />

              {/* Key Specs */}
              <text
                x={888}
                y={75}
                fontSize={8.5}
                fontWeight={600}
                fill="#64748B"
                className="font-mono"
              >
                I2C ADDRESS
              </text>
              <text
                x={888}
                y={88}
                fontSize={8.5}
                fill="#059669"
                fontWeight={600}
                className="font-mono"
              >
                PCA9685 · 0x40
              </text>
              <text
                x={888}
                y={100}
                fontSize={8.5}
                fill="#059669"
                fontWeight={600}
                className="font-mono"
              >
                IMU · 0x68 / 0x28
              </text>

              <line
                x1={888}
                y1={109}
                x2={1024}
                y2={109}
                stroke="#E2E8F0"
                strokeWidth={0.8}
              />

              <text
                x={888}
                y={123}
                fontSize={8.5}
                fontWeight={600}
                fill="#64748B"
                className="font-mono"
              >
                WIRE GAUGE
              </text>
              <line
                x1={888}
                y1={134}
                x2={912}
                y2={134}
                stroke="#EA580C"
                strokeWidth={3.2}
                strokeLinecap="round"
              />
              <text
                x={918}
                y={137}
                fontSize={8.5}
                fill="#334155"
                className="font-mono"
              >
                18AWG 动力 (5A)
              </text>
              <line
                x1={888}
                y1={149}
                x2={912}
                y2={149}
                stroke="#059669"
                strokeWidth={2}
                strokeLinecap="round"
              />
              <text
                x={918}
                y={152}
                fontSize={8.5}
                fill="#334155"
                className="font-mono"
              >
                26AWG I2C / PWM
              </text>

              <line
                x1={888}
                y1={162}
                x2={1024}
                y2={162}
                stroke="#E2E8F0"
                strokeWidth={0.8}
              />

              <text
                x={888}
                y={176}
                fontSize={8.5}
                fontWeight={600}
                fill="#64748B"
                className="font-mono"
              >
                MG90S 3-PIN 线序
              </text>
              <circle cx={893} cy={189} r={3} fill="#F97316" />
              <text x={900} y={192} fontSize={8} fill="#334155">
                橙 PWM
              </text>
              <circle cx={940} cy={189} r={3} fill="#EF4444" />
              <text x={947} y={192} fontSize={8} fill="#334155">
                红 5V
              </text>
              <circle cx={982} cy={189} r={3} fill="#78350F" />
              <text x={989} y={192} fontSize={8} fill="#334155">
                棕 GND
              </text>

              <text
                x={888}
                y={208}
                fontSize={8}
                fill="#DC2626"
                fontWeight={600}
              >
                ! V+ 独立供电 · 严禁经主控
              </text>
            </g>
          </g>

          {/* 2. Orthogonal Rounded-Corner Circuit Wires */}
          <g>
            {orderedWirePaths.map(({ wire, d }) => {
              const domainActive = activeDomains[wire.domain];
              const isSelected = wire.id === selectedWireId;
              const isHovered = wire.id === hoveredWireId;
              const isHighlighted = highlightedWireIds.has(wire.id);
              const isHoverRelated = hoverRelatedWireIds.has(wire.id);
              const isEmphasized = isSelected || isHighlighted || isHovered || isHoverRelated;

              let opacity = 0.92;
              if (!domainActive) {
                opacity = 0.08;
              } else if (hasElectricalFocus && !isHighlighted && !isHovered) {
                opacity = 0.16;
              } else if (hoveredNodeId && !hasElectricalFocus && !isHoverRelated) {
                opacity = 0.25;
              }

              const baseWidth = getBaseWireStrokeWidth(wire.domain);
              const strokeWidth = isSelected
                ? baseWidth + 1.4
                : isEmphasized
                  ? baseWidth + 0.9
                  : baseWidth;

              const showFlow =
                domainActive &&
                (isSelected || isHovered || isHighlighted || isHoverRelated);

              const inlineTag = WIRE_INLINE_TAGS[wire.id];

              return (
                <g
                  key={wire.id}
                  style={{
                    opacity,
                    transition: 'opacity 160ms ease',
                  }}
                  className={
                    domainActive ? 'cursor-pointer' : 'pointer-events-none'
                  }
                  onMouseEnter={() => {
                    if (domainActive) setHoveredWireId(wire.id);
                  }}
                  onMouseLeave={() => {
                    setHoveredWireId((prev) =>
                      prev === wire.id ? null : prev,
                    );
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!domainActive) return;
                    onSelectWire(wire.id);
                  }}
                >
                  <title>{`${wire.label} (${wire.fromPin} → ${wire.toPin} · ${wire.voltageInfo} · ${wire.wireGauge})`}</title>

                  {/* Soft halo behind selected / hovered / connected wires */}
                  {showFlow && (
                    <path
                      d={d}
                      fill="none"
                      stroke={wire.color}
                      strokeWidth={strokeWidth + 6}
                      strokeOpacity={isSelected || isHovered ? 0.24 : 0.16}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Crisp white casing under solid wire so crossings stay legible */}
                  {domainActive && (
                    <path
                      d={d}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={strokeWidth + 2}
                      strokeOpacity={0.85}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Primary colored wire path */}
                  <path
                    d={d}
                    fill="none"
                    stroke={wire.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Animated flowing dash overlay when selected / hovered / part-highlighted */}
                  {showFlow && (
                    <path
                      d={d}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth={Math.max(1.4, baseWidth * 0.55)}
                      strokeDasharray="6 10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="wiring-flow-overlay pointer-events-none"
                    />
                  )}

                  {/* Inline wire label tag */}
                  {inlineTag && domainActive && (
                    <g className="pointer-events-none">
                      {inlineTag.pill ? (
                        <>
                          <rect
                            x={
                              inlineTag.x -
                              (estimateTextPx(inlineTag.text, 4.9, 8) + 10) / 2
                            }
                            y={inlineTag.y - 8}
                            width={estimateTextPx(inlineTag.text, 4.9, 8) + 10}
                            height={16}
                            rx={4}
                            fill={isEmphasized ? wire.color : '#FFFFFF'}
                            stroke={wire.color}
                            strokeWidth={isEmphasized ? 1.2 : 0.9}
                          />
                          <text
                            x={inlineTag.x}
                            y={inlineTag.y + 3}
                            textAnchor="middle"
                            fontSize={8.2}
                            fontWeight={700}
                            fill={isEmphasized ? '#FFFFFF' : wire.color}
                            className="font-mono"
                          >
                            {inlineTag.text}
                          </text>
                        </>
                      ) : (
                        <text
                          x={inlineTag.x}
                          y={inlineTag.y}
                          textAnchor="middle"
                          fontSize={8.2}
                          fontWeight={700}
                          fill={wire.color}
                          stroke="#FFFFFF"
                          strokeWidth={3}
                          paintOrder="stroke"
                          className="font-mono"
                        >
                          {inlineTag.text}
                        </text>
                      )}
                    </g>
                  )}

                  {/* Effortless wide invisible hit target */}
                  {domainActive && (
                    <path
                      d={d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* 3. Engineering Block Nodes */}
          <g>
            {WIRING_NODES.map((node) => {
              const header = getNodeHeaderMeta(node);
              const isSelectedPart = selectedPartId === node.partId;
              const isWireEndpoint =
                selectedWire !== null &&
                (selectedWire.fromNodeId === node.id ||
                  selectedWire.toNodeId === node.id);
              const isPartner = partnerNodeIds.has(node.id);
              const isHovered =
                hoveredNodeId === node.id || hoveredEndpointNodeIds.has(node.id);
              const isCompactServo = node.category === 'servo';
              const isWideServo = isCompactServo && node.width > 200;

              let nodeOpacity = 1;
              if (hasElectricalFocus) {
                if (isSelectedPart || isWireEndpoint) {
                  nodeOpacity = 1;
                } else if (isPartner || isHovered) {
                  nodeOpacity = 0.88;
                } else {
                  nodeOpacity = 0.38;
                }
              }

              const borderColor = isSelectedPart
                ? '#EA580C'
                : isWireEndpoint
                  ? header.headerBg
                  : isHovered
                    ? '#475569'
                    : isPartner && hasElectricalFocus
                      ? `${header.headerBg}AA`
                      : '#CBD5E1';

              const borderWidth = isSelectedPart
                ? 2.4
                : isWireEndpoint
                  ? 2.1
                  : isHovered
                    ? 1.7
                    : 1.2;

              const headerHeight = isCompactServo ? 21 : 25;

              // Compute wrapped pin pills for module cards
              const placedPins = isCompactServo
                ? layoutPinBadges(
                    node.pins,
                    node.x + (isWideServo ? 10 : 6),
                    node.y + (isWideServo ? 44 : 41),
                    node.width - (isWideServo ? 20 : 12),
                    15,
                    isWideServo ? 6 : 3,
                    4,
                    isWideServo ? 5.1 : 4.5,
                    isWideServo ? 8.2 : 7.5,
                    isWideServo ? 16 : 12,
                  )
                : layoutPinBadges(
                    node.pins,
                    node.x + 10,
                    node.y + 56,
                    node.width - 20,
                    16,
                    5,
                    5,
                    5.2,
                    8.4,
                    16,
                  );

              const showSpecsLine = !isCompactServo && node.height >= 112;

              const specsY =
                node.id === 'node_battery'
                  ? node.y + 95
                  : node.id === 'node_imu'
                    ? node.y + 99
                    : node.id === 'node_ubec'
                      ? node.y + 118
                      : node.id === 'node_esp32'
                        ? node.y + 118
                        : node.y + 116;

              const shortSpecs =
                node.id === 'node_battery'
                  ? '标称 7.4V (满电 8.4V) · ≥ 10A'
                  : node.id === 'node_ubec'
                    ? '独立降压 · 隔离 8 舵机冲击电流'
                    : node.id === 'node_esp32'
                      ? '50–100Hz 步态插值 + IMU 闭环'
                      : node.id === 'node_imu'
                        ? '共享 I2C 总线 · 输出 Roll/Pitch/Yaw'
                        : '逻辑 3.3V 与动力 5V V+ 内部独立';

              return (
                <g
                  key={node.id}
                  style={{
                    opacity: nodeOpacity,
                    transition: 'opacity 160ms ease',
                  }}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() =>
                    setHoveredNodeId((prev) => (prev === node.id ? null : prev))
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPart(node.partId);
                  }}
                >
                  <title>{`${node.label} — ${node.sublabel}\n${node.specs}`}</title>

                  {/* Outer selection halo when selected (including from 3D viewport!) */}
                  {(isSelectedPart || isWireEndpoint) && (
                    <rect
                      x={node.x - 4}
                      y={node.y - 4}
                      width={node.width + 8}
                      height={node.height + 8}
                      rx={10}
                      fill="none"
                      stroke={isSelectedPart ? '#EA580C' : header.headerBg}
                      strokeWidth={2}
                      strokeOpacity={0.35}
                      strokeDasharray={isSelectedPart ? undefined : '4 3'}
                    />
                  )}

                  {/* Card base */}
                  <rect
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                    rx={6}
                    fill="#FFFFFF"
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                    filter={
                      isSelectedPart
                        ? 'url(#wiring-card-active-shadow)'
                        : 'url(#wiring-card-shadow)'
                    }
                  />

                  {/* Colored category header bar */}
                  <rect
                    x={node.x + 0.6}
                    y={node.y + 0.6}
                    width={node.width - 1.2}
                    height={headerHeight}
                    rx={5.4}
                    fill={header.headerBg}
                  />
                  {/* Square off bottom corners of header bar */}
                  <rect
                    x={node.x + 0.6}
                    y={node.y + headerHeight - 6}
                    width={node.width - 1.2}
                    height={6.6}
                    fill={header.headerBg}
                  />

                  {/* Header Title */}
                  <text
                    x={node.x + (isCompactServo && !isWideServo ? 7 : 10)}
                    y={node.y + (isCompactServo ? 14 : 16.5)}
                    fontSize={isCompactServo && !isWideServo ? 10 : 10.8}
                    fontWeight={700}
                    fill="#FFFFFF"
                  >
                    {node.label}
                  </text>

                  {/* Category / status tag on right of header */}
                  {node.width >= 200 && (
                    <g>
                      <rect
                        x={node.x + node.width - (isSelectedPart ? 46 : 42) - 8}
                        y={node.y + (isCompactServo ? 4 : 5.5)}
                        width={isSelectedPart ? 46 : 42}
                        height={14}
                        rx={3}
                        fill="#FFFFFF"
                        fillOpacity={isSelectedPart ? 0.96 : 0.2}
                      />
                      <text
                        x={
                          node.x +
                          node.width -
                          (isSelectedPart ? 46 : 42) / 2 -
                          8
                        }
                        y={node.y + (isCompactServo ? 13.5 : 15)}
                        textAnchor="middle"
                        fontSize={7.8}
                        fontWeight={700}
                        fill={isSelectedPart ? '#EA580C' : '#FFFFFF'}
                        className="font-mono"
                      >
                        {isSelectedPart
                          ? '已选中'
                          : node.id === 'node_pca9685'
                            ? '0x40'
                            : header.tag.split(' ')[0]}
                      </text>
                    </g>
                  )}

                  {/* Selected corner indicator dot on narrow servo cards */}
                  {isSelectedPart && node.width < 200 && (
                    <circle
                      cx={node.x + node.width - 10}
                      cy={node.y + 10.5}
                      r={3.5}
                      fill="#FFFFFF"
                    />
                  )}

                  {/* Sublabel */}
                  <text
                    x={node.x + (isCompactServo && !isWideServo ? 7 : 10)}
                    y={node.y + (isCompactServo ? 33 : 40)}
                    fontSize={isCompactServo ? 8.3 : 8.8}
                    fill="#475569"
                    className="font-mono"
                  >
                    {node.sublabel}
                  </text>

                  {/* Wide head servo extra specs hint on right side */}
                  {isWideServo && (
                    <text
                      x={node.x + node.width - 10}
                      y={node.y + 33}
                      textAnchor="end"
                      fontSize={8.2}
                      fill="#94A3B8"
                    >
                      {node.specs}
                    </text>
                  )}

                  {/* Divider under sublabel for module cards */}
                  {!isCompactServo && (
                    <line
                      x1={node.x + 10}
                      y1={node.y + 48}
                      x2={node.x + node.width - 10}
                      y2={node.y + 48}
                      stroke="#E2E8F0"
                      strokeWidth={0.8}
                    />
                  )}

                  {/* Visible Pin Badges */}
                  {placedPins.map((pin) => (
                    <g key={`${node.id}-${pin.label}`}>
                      <rect
                        x={pin.x}
                        y={pin.y}
                        width={pin.width}
                        height={isCompactServo ? 15 : 16}
                        rx={3}
                        fill="#F8FAFC"
                        stroke="#CBD5E1"
                        strokeWidth={0.8}
                      />
                      <circle
                        cx={pin.x + (isCompactServo && !isWideServo ? 4.5 : 6)}
                        cy={pin.y + (isCompactServo ? 7.5 : 8)}
                        r={isCompactServo && !isWideServo ? 2 : 2.3}
                        fill={pin.dotColor}
                      />
                      <text
                        x={pin.x + (isCompactServo && !isWideServo ? 9 : 11.5)}
                        y={pin.y + (isCompactServo ? 10.5 : 11.2)}
                        fontSize={isCompactServo && !isWideServo ? 7.3 : 8}
                        fontWeight={600}
                        fill="#1E293B"
                        className="font-mono"
                      >
                        {pin.label}
                      </text>
                    </g>
                  ))}

                  {/* Engineering specs footer note on tall modules */}
                  {showSpecsLine && (
                    <text
                      x={node.x + 10}
                      y={specsY}
                      fontSize={8.2}
                      fill="#64748B"
                    >
                      {shortSpecs}
                    </text>
                  )}

                  {/* ESP32 bottom aligned I2C / 3V3 exit port strip */}
                  {node.id === 'node_esp32' && (
                    <g>
                      <line
                        x1={node.x + 10}
                        y1={node.y + 131}
                        x2={node.x + node.width - 10}
                        y2={node.y + 131}
                        stroke="#E2E8F0"
                        strokeWidth={0.8}
                        strokeDasharray="2 2"
                      />
                      {ESP_BOTTOM_PORTS.map((port) => {
                        const portActive =
                          highlightedWireIds.has(port.wireId) ||
                          hoveredWireId === port.wireId;
                        return (
                          <g
                            key={port.label}
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectWire(port.wireId);
                            }}
                          >
                            <rect
                              x={port.x - 16}
                              y={node.y + 138}
                              width={32}
                              height={16}
                              rx={3}
                              fill={portActive ? port.color : '#F8FAFC'}
                              stroke={port.color}
                              strokeWidth={portActive ? 1.2 : 0.8}
                            />
                            <text
                              x={port.x}
                              y={node.y + 149}
                              textAnchor="middle"
                              fontSize={8}
                              fontWeight={700}
                              fill={portActive ? '#FFFFFF' : port.color}
                              className="font-mono"
                            >
                              {port.label}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}

                  {/* PCA9685 bottom aligned CH0..CH5 output channel port strip */}
                  {node.id === 'node_pca9685' && (
                    <g>
                      <line
                        x1={node.x + 10}
                        y1={node.y + 129}
                        x2={node.x + node.width - 10}
                        y2={node.y + 129}
                        stroke="#E2E8F0"
                        strokeWidth={0.8}
                        strokeDasharray="2 2"
                      />
                      {PCA_BOTTOM_PORTS.map((port) => {
                        const portActive =
                          highlightedWireIds.has(port.wireId) ||
                          hoveredWireId === port.wireId;
                        return (
                          <g
                            key={port.ch}
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectWire(port.wireId);
                            }}
                          >
                            <rect
                              x={port.x - 15}
                              y={node.y + 137}
                              width={30}
                              height={16}
                              rx={3}
                              fill={portActive ? port.color : '#F8FAFC'}
                              stroke={port.color}
                              strokeWidth={portActive ? 1.2 : 0.8}
                            />
                            <text
                              x={port.x}
                              y={node.y + 148}
                              textAnchor="middle"
                              fontSize={8}
                              fontWeight={700}
                              fill={portActive ? '#FFFFFF' : port.color}
                              className="font-mono"
                            >
                              {port.ch}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* 4. Crisp Terminal Junction Pads on Node Boundaries */}
          <g className="pointer-events-none">
            {orderedWirePaths.map(({ wire }) => {
              const domainActive = activeDomains[wire.domain];
              const isSelected = wire.id === selectedWireId;
              const isHovered = wire.id === hoveredWireId;
              const isHighlighted = highlightedWireIds.has(wire.id);
              const isHoverRelated = hoverRelatedWireIds.has(wire.id);
              const isEmphasized =
                isSelected || isHighlighted || isHovered || isHoverRelated;

              let opacity = 0.95;
              if (!domainActive) {
                opacity = 0.1;
              } else if (hasElectricalFocus && !isHighlighted && !isHovered) {
                opacity = 0.18;
              } else if (
                hoveredNodeId &&
                !hasElectricalFocus &&
                !isHoverRelated
              ) {
                opacity = 0.28;
              }

              return (
                <g
                  key={`pads-${wire.id}`}
                  style={{ opacity, transition: 'opacity 160ms ease' }}
                >
                  <circle
                    cx={wire.start2D[0]}
                    cy={wire.start2D[1]}
                    r={isEmphasized ? 4.3 : 3.2}
                    fill="#FFFFFF"
                    stroke={wire.color}
                    strokeWidth={isEmphasized ? 2.2 : 1.7}
                  />
                  <circle
                    cx={wire.end2D[0]}
                    cy={wire.end2D[1]}
                    r={isEmphasized ? 4.3 : 3.2}
                    fill={isEmphasized ? wire.color : '#FFFFFF'}
                    stroke={wire.color}
                    strokeWidth={isEmphasized ? 2 : 1.7}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Bottom Compact Detail Ribbon */}
      <div
        className={`shrink-0 border-t border-slate-200 bg-slate-50/95 ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        }`}
      >
        {ribbonWire ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                {/* Domain badge */}
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold text-white shrink-0"
                  style={{
                    backgroundColor:
                      CIRCUIT_DOMAIN_META[ribbonWire.domain].color,
                  }}
                >
                  <Cable className="w-3 h-3" />
                  {CIRCUIT_DOMAIN_META[ribbonWire.domain].shortLabel}
                </span>

                {/* Pin-to-pin mapping */}
                <div className="flex flex-wrap items-center gap-1 text-xs font-mono text-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const n = NODE_BY_ID[ribbonWire.fromNodeId];
                      if (n) onSelectPart(n.partId);
                    }}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-700 font-sans font-medium text-[11px] transition-colors"
                  >
                    {NODE_BY_ID[ribbonWire.fromNodeId]?.label ??
                      ribbonWire.fromNodeId}
                  </button>
                  <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-semibold text-[11px]">
                    {ribbonWire.fromPin}
                  </span>
                  <span className="text-slate-400 font-sans">→</span>
                  <button
                    type="button"
                    onClick={() => {
                      const n = NODE_BY_ID[ribbonWire.toNodeId];
                      if (n) onSelectPart(n.partId);
                    }}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:border-orange-400 hover:text-orange-700 font-sans font-medium text-[11px] transition-colors"
                  >
                    {NODE_BY_ID[ribbonWire.toNodeId]?.label ??
                      ribbonWire.toNodeId}
                  </button>
                  <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-800 font-semibold text-[11px]">
                    {ribbonWire.toPin}
                  </span>
                </div>

                {/* Gauge & Voltage badges */}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                  {ribbonWire.wireGauge}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-[11px] font-mono font-semibold text-orange-800">
                  <Zap className="w-3 h-3 text-orange-600" />
                  {ribbonWire.voltageInfo}
                </span>
              </div>

              {selectedWire && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors shrink-0"
                  title="取消选中"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>清除</span>
                </button>
              )}
            </div>

            {ribbonWire.safetyNote ? (
              <div className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200/90 text-[11px] text-amber-900 leading-snug">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">接线要点：</strong>
                  {ribbonWire.safetyNote}
                </span>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500 truncate">
                {ribbonWire.label}
                {!selectedWire && (
                  <span className="ml-2 text-slate-400">
                    （点击导线锁定详情）
                  </span>
                )}
              </div>
            )}
          </div>
        ) : selectedNode ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold text-white shrink-0"
                  style={{
                    backgroundColor: getNodeHeaderMeta(selectedNode).headerBg,
                  }}
                >
                  {selectedNode.label}
                </span>
                <span className="text-[11px] font-mono text-slate-600">
                  {selectedNode.sublabel}
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  · {selectedNode.specs}
                </span>
              </div>

              <button
                type="button"
                onClick={handleClearSelection}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                <span>清除</span>
              </button>
            </div>

            {/* Quick connected wire chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500">
                关联线束 ({selectedPartConnectedWires.length})：
              </span>
              {selectedPartConnectedWires.slice(0, compact ? 4 : 8).map((w) => {
                const isDomainVisible = activeDomains[w.domain];
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onSelectWire(w.id)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                      isDomainVisible
                        ? 'bg-white border-slate-200 text-slate-700 hover:border-orange-400 hover:text-orange-700'
                        : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                    }`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: w.color }}
                    />
                    <span>
                      {w.fromPin}→{w.toPin}
                    </span>
                  </button>
                );
              })}
              {selectedPartConnectedWires.length > (compact ? 4 : 8) && (
                <span className="text-[10px] font-mono text-slate-400">
                  +{selectedPartConnectedWires.length - (compact ? 4 : 8)} 条
                </span>
              )}
            </div>
          </div>
        ) : selectedPartSpec ? (
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                当前 3D 选中机械件{' '}
                <span className="font-mono font-semibold text-slate-800">
                  [{selectedPartSpec.code}]
                </span>{' '}
                {selectedPartSpec.nameZh}（无电气连线）· 点击原理图任意模块或导线可追踪线束
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
              <span>清除</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 min-w-0">
              <MousePointerClick className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              <span className="truncate">
                点击任意电气模块或导线可高亮对应回路，与 3D 场景线束实时双向联动 · 点击空白处重置
              </span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 shrink-0">
              <span>{WIRING_NODES.length} NODES</span>
              <span>·</span>
              <span>{WIRE_CONNECTIONS.length} WIRES</span>
              <span>·</span>
              <span>I2C 0x40 / 0x68</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
