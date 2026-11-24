import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Cpu,
  Info,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { ROBOT_JOINTS, SUBSYSTEM_META } from '../../data/robotManifest';
import { HARDWARE_SAFETY_CHECKS } from '../../data/wiringData';

interface I2cDeviceRef {
  device: string;
  role: string;
  address: string;
  power: string;
  note: string;
}

const I2C_QUICK_REF: I2cDeviceRef[] = [
  {
    device: 'PCA9685',
    role: '16路 PWM 舵机驱动',
    address: '0x40',
    power: '3.3V VCC + 5V V+',
    note: 'A0–A5 默认接地',
  },
  {
    device: 'MPU6050',
    role: '6轴姿态传感器 (标配)',
    address: '0x68',
    power: '3.3V Logic',
    note: 'AD0 接地 (高电平 0x69)',
  },
  {
    device: 'BNO055',
    role: '9轴姿态传感器 (升级)',
    address: '0x28',
    power: '3.3V Logic',
    note: '替代 MPU6050 硬件融合',
  },
];

const SEVERITY_STYLES = {
  critical: {
    container: 'bg-red-50/90 border-red-200 hover:border-red-300',
    accentBar: 'bg-red-600',
    badge: 'bg-red-600 text-white',
    badgeText: '严禁 · CRITICAL',
    title: 'text-red-950',
    detail: 'text-red-900/85',
    iconColor: 'text-red-600',
  },
  warning: {
    container: 'bg-amber-50/90 border-amber-200 hover:border-amber-300',
    accentBar: 'bg-amber-500',
    badge: 'bg-amber-500 text-white',
    badgeText: '建议 · WARNING',
    title: 'text-amber-950',
    detail: 'text-amber-900/85',
    iconColor: 'text-amber-600',
  },
  info: {
    container: 'bg-blue-50/90 border-blue-200 hover:border-blue-300',
    accentBar: 'bg-blue-600',
    badge: 'bg-blue-600 text-white',
    badgeText: '校准 · INFO',
    title: 'text-blue-950',
    detail: 'text-blue-900/85',
    iconColor: 'text-blue-600',
  },
} as const;

export function SafetyChecklist({
  compact = false,
}: {
  compact?: boolean;
}): JSX.Element {
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  const completedCount = HARDWARE_SAFETY_CHECKS.filter(
    (c) => checkedIds[c.id],
  ).length;
  const allChecked = completedCount === HARDWARE_SAFETY_CHECKS.length;

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div
      className={`h-full w-full overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col ${
        compact ? 'p-3 gap-3' : 'p-4 gap-4'
      }`}
    >
      {/* Section 1: Pre-Power Hardware Safety Checks */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight truncate">
                防烧板教学要点 · 上电核查
              </h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                Pre-Power Safety Checklist
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border shrink-0 transition-colors ${
              allChecked
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {allChecked ? '已全部核查' : `${completedCount}/${HARDWARE_SAFETY_CHECKS.length}`}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {HARDWARE_SAFETY_CHECKS.map((item) => {
            const style = SEVERITY_STYLES[item.severity];
            const isChecked = Boolean(checkedIds[item.id]);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleCheck(item.id)}
                className={`group relative w-full text-left rounded-lg border transition-all overflow-hidden ${
                  style.container
                } ${isChecked ? 'opacity-65' : 'opacity-100'} ${
                  compact ? 'p-2.5 pl-3' : 'p-3 pl-3.5'
                }`}
              >
                {/* Left severity bar */}
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${style.accentBar}`}
                />

                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold tracking-wide ${style.badge}`}
                      >
                        {item.severity === 'critical' ? (
                          <AlertOctagon className="w-2.5 h-2.5" />
                        ) : item.severity === 'warning' ? (
                          <AlertTriangle className="w-2.5 h-2.5" />
                        ) : (
                          <Info className="w-2.5 h-2.5" />
                        )}
                        {style.badgeText}
                      </span>
                    </div>

                    <p
                      className={`text-xs font-semibold leading-snug ${style.title} ${
                        isChecked ? 'line-through' : ''
                      }`}
                    >
                      {item.title}
                    </p>
                    <p
                      className={`mt-1 text-[11px] leading-relaxed ${style.detail}`}
                    >
                      {item.detail}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 2: I2C Address Quick-Ref Table */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-800">
              I2C 总线地址速查
            </h4>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-semibold text-emerald-700">
            SDA:21 · SCL:22
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
                <th className="py-1.5 px-2.5 font-semibold">设备</th>
                <th className="py-1.5 px-2 font-semibold">地址</th>
                <th className="py-1.5 px-2.5 font-semibold">逻辑/供电</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {I2C_QUICK_REF.map((row) => (
                <tr key={row.device} className="hover:bg-slate-50/70">
                  <td className="py-1.5 px-2.5">
                    <div className="font-mono font-bold text-slate-800">
                      {row.device}
                    </div>
                    <div className="text-[10px] text-slate-500">{row.role}</div>
                  </td>
                  <td className="py-1.5 px-2 align-top">
                    <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 font-mono text-[11px] font-bold text-emerald-700">
                      {row.address}
                    </span>
                  </td>
                  <td className="py-1.5 px-2.5 align-top">
                    <div className="font-mono text-[10.5px] text-slate-700">
                      {row.power}
                    </div>
                    {!compact && (
                      <div className="text-[10px] text-slate-400">
                        {row.note}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: PWM Channel Mapping Quick-Ref Table (CH0-CH7) */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-violet-600" />
            <h4 className="text-xs font-bold text-slate-800">
              PWM 通道映射速查 (CH0–CH7)
            </h4>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-[10px] font-mono font-semibold text-violet-700">
            50Hz · 1500µs 中位
          </span>
        </div>

        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-mono text-slate-500 uppercase">
                <th className="py-1.5 px-2 font-semibold">通道</th>
                <th className="py-1.5 px-2 font-semibold">关节</th>
                <th className="py-1.5 px-2 font-semibold">轴向 / 限位</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
              {ROBOT_JOINTS.map((joint) => {
                const subMeta = SUBSYSTEM_META[joint.subsystem];
                return (
                  <tr key={joint.id} className="hover:bg-slate-50/70">
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10.5px] font-bold text-white"
                        style={{ backgroundColor: subMeta.color }}
                      >
                        {joint.channel}
                      </span>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="font-semibold text-slate-800 leading-tight">
                        {joint.nameZh}
                      </div>
                      <div className="font-mono text-[10px] text-slate-400">
                        {joint.nameEn}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 font-mono text-[10px] text-slate-600 whitespace-nowrap">
                      <div>{joint.axisLabel.split(' ')[0]}</div>
                      <div className="text-slate-400">
                        {joint.minDeg}° ~ +{joint.maxDeg}°
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* MG90S 3-Pin Color Polarity Strip */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10.5px]">
          <span className="font-mono font-semibold text-slate-600">
            MG90S 3-Pin:
          </span>
          <div className="flex items-center gap-2.5 text-slate-700">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              橙 PWM
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              红 5V
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-900" />
              棕 GND
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
