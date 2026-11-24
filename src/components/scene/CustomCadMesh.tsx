import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { CustomCadOverride } from '../../types/robot';

export type StepVisualState = 'normal' | 'active' | 'future';

export interface CustomCadMeshProps {
  override: CustomCadOverride;
  selected: boolean;
  hovered: boolean;
  xRay: boolean;
  isOuterShell: boolean;
  stepState: StepVisualState;
  fallbackColor?: string;
}

function disposeObjectResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((mat) => mat.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    }
  });
}

function applyMaterialState(
  material: THREE.Material,
  selected: boolean,
  hovered: boolean,
  xRay: boolean,
  isOuterShell: boolean,
  stepState: StepVisualState,
): void {
  const mat = material as THREE.MeshStandardMaterial;
  const isGhost = stepState === 'future';
  const isTransparent = isGhost || (xRay && isOuterShell);

  mat.transparent = isTransparent;
  mat.opacity = isGhost ? 0.14 : isTransparent ? 0.22 : 1.0;
  mat.depthWrite = !isTransparent;

  if ('emissive' in mat && mat.emissive instanceof THREE.Color) {
    if (selected) {
      mat.emissive.set('#EA580C');
      mat.emissiveIntensity = 0.36;
    } else if (stepState === 'active') {
      mat.emissive.set('#F97316');
      mat.emissiveIntensity = hovered ? 0.28 : 0.16;
    } else if (hovered) {
      mat.emissive.set('#0EA5E9');
      mat.emissiveIntensity = 0.18;
    } else {
      mat.emissive.set('#000000');
      mat.emissiveIntensity = 0;
    }
  }
  mat.needsUpdate = true;
}

export function CustomCadMesh({
  override,
  selected,
  hovered,
  xRay,
  isOuterShell,
  stepState,
  fallbackColor = '#F3EFE6',
}: CustomCadMeshProps): JSX.Element {
  const [stlGeometry, setStlGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [gltfScene, setGltfScene] = useState<THREE.Group | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    if (override.fileType === 'stl') {
      setGltfScene((prev) => {
        if (prev) disposeObjectResources(prev);
        return null;
      });
      const loader = new STLLoader();
      loader.load(
        override.objectUrl,
        (geom) => {
          if (cancelled) {
            geom.dispose();
            return;
          }
          geom.computeVertexNormals();
          geom.center();
          setStlGeometry((prev) => {
            prev?.dispose();
            return geom;
          });
        },
        undefined,
        () => {
          if (!cancelled) {
            setLoadError('STL load failed');
          }
        },
      );
    } else {
      setStlGeometry((prev) => {
        prev?.dispose();
        return null;
      });
      const loader = new GLTFLoader();
      loader.load(
        override.objectUrl,
        (gltf) => {
          if (cancelled) {
            disposeObjectResources(gltf.scene);
            return;
          }
          const cloned = gltf.scene.clone(true);
          const box = new THREE.Box3().setFromObject(cloned);
          const center = new THREE.Vector3();
          box.getCenter(center);
          cloned.position.sub(center);

          cloned.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (Array.isArray(child.material)) {
                child.material = child.material.map((m) => m.clone());
              } else if (child.material) {
                child.material = child.material.clone();
              }
            }
          });

          setGltfScene((prev) => {
            if (prev) disposeObjectResources(prev);
            return cloned;
          });
        },
        undefined,
        () => {
          if (!cancelled) {
            setLoadError('GLB load failed');
          }
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [override.objectUrl, override.fileType]);

  // Clean up GPU buffers on unmount
  useEffect(() => {
    return () => {
      if (stlGeometry) stlGeometry.dispose();
      if (gltfScene) disposeObjectResources(gltfScene);
    };
  }, [stlGeometry, gltfScene]);

  // Update cloned GLTF materials when visual state changes
  useEffect(() => {
    if (!gltfScene) return;
    gltfScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) =>
            applyMaterialState(m, selected, hovered, xRay, isOuterShell, stepState),
          );
        } else if (child.material) {
          applyMaterialState(
            child.material,
            selected,
            hovered,
            xRay,
            isOuterShell,
            stepState,
          );
        }
      }
    });
  }, [gltfScene, selected, hovered, xRay, isOuterShell, stepState]);

  const stlMaterialProps = useMemo(() => {
    const isGhost = stepState === 'future';
    const isTransparent = isGhost || (xRay && isOuterShell);
    const emissive = selected
      ? '#EA580C'
      : stepState === 'active'
        ? '#F97316'
        : hovered
          ? '#0EA5E9'
          : '#000000';
    const emissiveIntensity = selected
      ? 0.36
      : stepState === 'active'
        ? hovered
          ? 0.28
          : 0.16
        : hovered
          ? 0.18
          : 0;
    return {
      color: isGhost ? '#94A3B8' : fallbackColor,
      roughness: 0.48,
      metalness: 0.08,
      transparent: isTransparent,
      opacity: isGhost ? 0.14 : isTransparent ? 0.22 : 1.0,
      depthWrite: !isTransparent,
      emissive,
      emissiveIntensity,
    };
  }, [fallbackColor, hovered, isOuterShell, selected, stepState, xRay]);

  const safeScale = Number.isFinite(override.scale) && override.scale > 0 ? override.scale : 1;

  if (loadError) {
    return (
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.2, 2.2, 2.2]} />
        <meshStandardMaterial color="#EF4444" wireframe />
      </mesh>
    );
  }

  if (override.fileType === 'stl' && stlGeometry) {
    return (
      <mesh
        geometry={stlGeometry}
        scale={[safeScale, safeScale, safeScale]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...stlMaterialProps} />
      </mesh>
    );
  }

  if (override.fileType === 'glb' && gltfScene) {
    return <primitive object={gltfScene} scale={[safeScale, safeScale, safeScale]} />;
  }

  // Brief translucent placeholder while parsing local blob
  return (
    <mesh>
      <octahedronGeometry args={[0.9, 1]} />
      <meshStandardMaterial color="#94A3B8" wireframe transparent opacity={0.45} />
    </mesh>
  );
}
