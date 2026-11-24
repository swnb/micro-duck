import { useEffect, useMemo, useRef, useState } from 'react';
import { ThreeEvent, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PART_BY_ID } from '../../data/robotManifest';
import { WIRE_CONNECTIONS, WIRING_NODES } from '../../data/wiringData';
import { CircuitDomain, SubsystemId, Vec3, WireConnectionSpec } from '../../types/robot';

export interface WiringHarness3DProps {
  activeDomains: Record<CircuitDomain, boolean>;
  selectedWireId: string | null;
  selectedPartId: string | null;
  masterExplode: number;
  subsystemExplode: Record<SubsystemId, number>;
  visibleSubsystems: Record<SubsystemId, boolean>;
  onSelectWire: (wireId: string | null) => void;
}

const NODE_BY_ID = Object.fromEntries(WIRING_NODES.map((n) => [n.id, n]));

function getPartExplodeOffset(
  partId: string | undefined,
  masterExplode: number,
  subsystemExplode: Record<SubsystemId, number>,
): Vec3 {
  if (!partId) return [0, 0, 0];
  const part = PART_BY_ID[partId];
  if (!part) return [0, 0, 0];
  const factor = masterExplode * (subsystemExplode[part.subsystem] ?? 1);
  return [
    part.explodeVector[0] * factor,
    part.explodeVector[1] * factor,
    part.explodeVector[2] * factor,
  ];
}

function getBaseWireRadius(domain: CircuitDomain): number {
  switch (domain) {
    case 'power_7v4':
    case 'power_5v_servo':
      return 0.085;
    case 'gnd':
      return 0.072;
    case 'power_logic':
      return 0.06;
    case 'i2c':
      return 0.056;
    case 'pwm':
      return 0.064;
  }
}

interface SingleWireTubeProps {
  wire: WireConnectionSpec;
  startOffset: Vec3;
  endOffset: Vec3;
  isHighlighted: boolean;
  isDimmed: boolean;
  onSelectWire: (wireId: string | null) => void;
}

function SingleWireTube({
  wire,
  startOffset,
  endOffset,
  isHighlighted,
  isDimmed,
  onSelectWire,
}: SingleWireTubeProps): JSX.Element {
  const [hovered, setHovered] = useState(false);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const pulseRefA = useRef<THREE.Mesh>(null);
  const pulseRefB = useRef<THREE.Mesh>(null);

  const curve = useMemo(() => {
    const n = wire.points3D.length;
    const pts = wire.points3D.map((p, idx) => {
      const t = n > 1 ? idx / (n - 1) : 0;
      const ox = startOffset[0] * (1 - t) + endOffset[0] * t;
      const oy = startOffset[1] * (1 - t) + endOffset[1] * t;
      const oz = startOffset[2] * (1 - t) + endOffset[2] * t;
      return new THREE.Vector3(p[0] + ox, p[1] + oy, p[2] + oz);
    });
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.45);
  }, [wire.points3D, startOffset, endOffset]);

  const baseRadius = getBaseWireRadius(wire.domain);
  const activeRadius = isHighlighted
    ? baseRadius * 1.62
    : hovered
      ? baseRadius * 1.32
      : baseRadius;

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 28, activeRadius, 10, false);
  }, [curve, activeRadius]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const startPoint = useMemo(() => curve.getPoint(0), [curve]);
  const endPoint = useMemo(() => curve.getPoint(1), [curve]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (materialRef.current) {
      if (isHighlighted) {
        materialRef.current.emissiveIntensity = 0.55 + Math.sin(t * 5.2) * 0.25;
      } else if (hovered) {
        materialRef.current.emissiveIntensity = 0.32;
      } else {
        materialRef.current.emissiveIntensity = 0.08;
      }
    }

    if (isHighlighted && pulseRefA.current && pulseRefB.current) {
      const uA = (t * 0.55) % 1;
      const uB = (t * 0.55 + 0.5) % 1;
      curve.getPointAt(uA, pulseRefA.current.position);
      curve.getPointAt(uB, pulseRefB.current.position);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectWire(wire.id);
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const opacity = isHighlighted || hovered ? 0.98 : isDimmed ? 0.28 : 0.88;
  const isTransparent = opacity < 0.96;

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.needsUpdate = true;
    }
  }, [isTransparent, opacity]);

  return (
    <group>
      <mesh
        geometry={geometry}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        castShadow={isHighlighted}
      >
        <meshStandardMaterial
          ref={materialRef}
          key={isTransparent ? 'wire-trans' : 'wire-opaque'}
          color={wire.color}
          emissive={wire.color}
          emissiveIntensity={isHighlighted ? 0.6 : 0.08}
          roughness={0.42}
          metalness={0.08}
          transparent={isTransparent}
          opacity={opacity}
          depthWrite={opacity >= 0.8}
        />
      </mesh>

      {/* Connector terminal beads at both endpoints */}
      <mesh position={startPoint}>
        <sphereGeometry args={[activeRadius * 1.35, 10, 10]} />
        <meshStandardMaterial
          color={isHighlighted ? '#FFFFFF' : wire.color}
          emissive={wire.color}
          emissiveIntensity={isHighlighted ? 0.6 : 0.15}
          roughness={0.35}
        />
      </mesh>
      <mesh position={endPoint}>
        <sphereGeometry args={[activeRadius * 1.35, 10, 10]} />
        <meshStandardMaterial
          color={isHighlighted ? '#FFFFFF' : wire.color}
          emissive={wire.color}
          emissiveIntensity={isHighlighted ? 0.6 : 0.15}
          roughness={0.35}
        />
      </mesh>

      {/* Animated signal/current direction beads when selected */}
      {isHighlighted && (
        <>
          <mesh ref={pulseRefA}>
            <sphereGeometry args={[activeRadius * 1.55, 12, 12]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>
          <mesh ref={pulseRefB}>
            <sphereGeometry args={[activeRadius * 1.55, 12, 12]} />
            <meshBasicMaterial color="#FEF3C7" />
          </mesh>
        </>
      )}
    </group>
  );
}

export function WiringHarness3D({
  activeDomains,
  selectedWireId,
  selectedPartId,
  masterExplode,
  subsystemExplode,
  visibleSubsystems,
  onSelectWire,
}: WiringHarness3DProps): JSX.Element {
  const hasAnySelection = selectedWireId !== null || selectedPartId !== null;

  const visibleWires = useMemo(() => {
    return WIRE_CONNECTIONS.filter((wire) => {
      if (!activeDomains[wire.domain]) return false;
      const fromPartId = NODE_BY_ID[wire.fromNodeId]?.partId;
      const toPartId = NODE_BY_ID[wire.toNodeId]?.partId;
      const fromSub = fromPartId ? PART_BY_ID[fromPartId]?.subsystem : undefined;
      const toSub = toPartId ? PART_BY_ID[toPartId]?.subsystem : undefined;
      if (fromSub && !visibleSubsystems[fromSub]) return false;
      if (toSub && !visibleSubsystems[toSub]) return false;
      return true;
    });
  }, [activeDomains, visibleSubsystems]);

  return (
    <group name="wiring-harness-3d">
      {visibleWires.map((wire) => {
        const fromPartId = NODE_BY_ID[wire.fromNodeId]?.partId;
        const toPartId = NODE_BY_ID[wire.toNodeId]?.partId;
        const startOffset = getPartExplodeOffset(fromPartId, masterExplode, subsystemExplode);
        const endOffset = getPartExplodeOffset(toPartId, masterExplode, subsystemExplode);

        const isHighlighted =
          wire.id === selectedWireId ||
          (selectedPartId !== null && wire.relatedPartIds.includes(selectedPartId));
        const isDimmed = hasAnySelection && !isHighlighted;

        return (
          <SingleWireTube
            key={wire.id}
            wire={wire}
            startOffset={startOffset}
            endOffset={endOffset}
            isHighlighted={isHighlighted}
            isDimmed={isDimmed}
            onSelectWire={onSelectWire}
          />
        );
      })}
    </group>
  );
}
