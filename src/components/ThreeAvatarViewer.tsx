import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Box, Eye, RefreshCw, RotateCcw, Sparkles } from 'lucide-react';

interface ThreeAvatarViewerProps {
  modelUrl?: string | null;
  characterName?: string;
  avatarUrl?: string;
  pose?: string;
  currentPose?: string;
  interactive?: boolean;
  className?: string;
  height?: number;
}

export const ThreeAvatarViewer: React.FC<ThreeAvatarViewerProps> = ({
  modelUrl,
  characterName = 'Avatar',
  avatarUrl,
  pose: propPose,
  currentPose = 'neutral',
  interactive = true,
  className = 'h-64 w-full',
  height: propHeight,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const effectivePose = propPose || currentPose;
  const [pose, setPose] = useState<string>(effectivePose);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPose(currentPose);
  }, [currentPose]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 300;
    const height = container.clientHeight || 300;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 1.4, 3.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Lighting rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xc084fc, 2.2); // Purple rim light
    dirLight.position.set(4, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xf59e0b, 1.5); // Warm amber fill
    fillLight.position.set(-4, 2, -2);
    scene.add(fillLight);

    // Create Hierarchical Stylized Avatar Character Group
    const avatarGroup = new THREE.Group();
    avatarGroup.position.set(0, 0, 0);
    scene.add(avatarGroup);

    // Color theme derived from character name
    let hue = 270; // purple default
    if (characterName.toLowerCase().includes('peppa')) hue = 330; // pink
    if (characterName.toLowerCase().includes('nextor')) hue = 0; // crimson
    if (characterName.toLowerCase().includes('valerie')) hue = 38; // amber/gold

    const primaryColor = new THREE.Color(`hsl(${hue}, 70%, 55%)`);
    const accentColor = new THREE.Color(`hsl(${(hue + 45) % 360}, 80%, 65%)`);
    const glowColor = new THREE.Color(`hsl(${(hue + 180) % 360}, 90%, 75%)`);

    // Material with PBR sheen
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: primaryColor,
      roughness: 0.35,
      metalness: 0.25,
    });

    const accentMaterial = new THREE.MeshStandardMaterial({
      color: accentColor,
      roughness: 0.2,
      metalness: 0.5,
    });

    const visorMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x18181b,
      roughness: 0.1,
      metalness: 0.9,
      transmission: 0.6,
      transparent: true,
      opacity: 0.9,
    });

    // 1. Torso
    const torsoGeo = new THREE.CylinderGeometry(0.35, 0.28, 0.8, 16);
    const torso = new THREE.Mesh(torsoGeo, bodyMaterial);
    torso.position.y = 1.0;
    avatarGroup.add(torso);

    // 2. Head / Visor
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.65;
    avatarGroup.add(headGroup);

    const headGeo = new THREE.SphereGeometry(0.28, 24, 24);
    const head = new THREE.Mesh(headGeo, accentMaterial);
    headGroup.add(head);

    const visorGeo = new THREE.BoxGeometry(0.32, 0.14, 0.22);
    const visor = new THREE.Mesh(visorGeo, visorMaterial);
    visor.position.set(0, 0.02, 0.18);
    headGroup.add(visor);

    // Floating halo or aura ring
    const haloGeo = new THREE.TorusGeometry(0.38, 0.02, 12, 32);
    const haloMat = new THREE.MeshBasicMaterial({ color: glowColor, wireframe: true });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.4;
    headGroup.add(halo);

    // 3. Limbs (Shoulders, Arms, Hands)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.45, 1.35, 0);
    avatarGroup.add(leftArmGroup);

    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.6, 12);
    const leftArm = new THREE.Mesh(armGeo, bodyMaterial);
    leftArm.position.y = -0.3;
    leftArmGroup.add(leftArm);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.45, 1.35, 0);
    avatarGroup.add(rightArmGroup);

    const rightArm = new THREE.Mesh(armGeo, bodyMaterial);
    rightArm.position.y = -0.3;
    rightArmGroup.add(rightArm);

    // Floating crystal / weapon / focus item in hand
    const crystalGeo = new THREE.OctahedronGeometry(0.12, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 0.6,
      roughness: 0.1,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, -0.65, 0.15);
    rightArmGroup.add(crystal);

    // 4. Base Platform / Holo-Pedestal
    const baseGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.08, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.04;
    scene.add(base);

    const ringGeo = new THREE.RingGeometry(0.75, 0.85, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: primaryColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.09;
    scene.add(ring);

    // Pose adjustments
    const applyPose = (p: string) => {
      if (p === 'combat') {
        avatarGroup.rotation.y = 0.35;
        torso.rotation.x = 0.1;
        leftArmGroup.rotation.x = -0.8;
        leftArmGroup.rotation.z = 0.4;
        rightArmGroup.rotation.x = 0.5;
        rightArmGroup.rotation.z = -0.5;
        headGroup.rotation.y = -0.2;
      } else if (p === 'spellcasting') {
        avatarGroup.rotation.y = 0;
        torso.rotation.x = -0.15;
        leftArmGroup.rotation.x = -1.2;
        leftArmGroup.rotation.z = -0.5;
        rightArmGroup.rotation.x = -1.2;
        rightArmGroup.rotation.z = 0.5;
        headGroup.rotation.x = -0.2;
      } else if (p === 'inquisitive') {
        avatarGroup.rotation.y = -0.25;
        torso.rotation.z = 0.08;
        headGroup.rotation.z = 0.15;
        leftArmGroup.rotation.x = 0.2;
        rightArmGroup.rotation.x = -0.5;
        rightArmGroup.rotation.z = -0.2;
      } else if (p === 'relaxed') {
        avatarGroup.rotation.y = 0.15;
        torso.rotation.x = 0.05;
        leftArmGroup.rotation.x = 0.1;
        rightArmGroup.rotation.x = 0.1;
        headGroup.rotation.y = 0.1;
      } else {
        // Neutral
        avatarGroup.rotation.set(0, 0, 0);
        torso.rotation.set(0, 0, 0);
        headGroup.rotation.set(0, 0, 0);
        leftArmGroup.rotation.set(0, 0, 0);
        rightArmGroup.rotation.set(0, 0, 0);
      }
    };

    applyPose(pose);

    // Mouse Drag Interaction for 3D Orbiting
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (!interactive) return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging || !interactive) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      avatarGroup.rotation.y += deltaX * 0.01;
      camera.position.y = Math.max(0.5, Math.min(3.0, camera.position.y - deltaY * 0.008));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle breathing & floating idle motion
      torso.position.y = 1.0 + Math.sin(elapsedTime * 2) * 0.015;
      halo.rotation.z = elapsedTime * 0.8;
      crystal.rotation.y = elapsedTime * 1.5;
      crystal.rotation.x = Math.sin(elapsedTime) * 0.5;
      ring.rotation.z = -elapsedTime * 0.3;

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup resources to prevent WebGL memory leaks
    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      // Dispose geometries and materials
      torsoGeo.dispose();
      headGeo.dispose();
      visorGeo.dispose();
      haloGeo.dispose();
      armGeo.dispose();
      crystalGeo.dispose();
      baseGeo.dispose();
      ringGeo.dispose();

      bodyMaterial.dispose();
      accentMaterial.dispose();
      visorMaterial.dispose();
      haloMat.dispose();
      crystalMat.dispose();
      baseMat.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, [characterName, pose, interactive]);

  return (
    <div className={`relative flex flex-col items-center justify-center rounded-3xl border border-purple-500/30 bg-zinc-950/80 p-2 overflow-hidden shadow-2xl backdrop-blur-md ${className}`}>
      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="h-full w-full cursor-grab active:cursor-grabbing flex items-center justify-center"
      />

      {/* Floating Controls Bar */}
      {interactive && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-1 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 px-2.5 py-1.5 backdrop-blur-lg text-[10px]">
          <div className="flex items-center gap-1 text-purple-300 font-semibold">
            <Box className="h-3 w-3 text-purple-400" />
            <span>3D Avatar Pose:</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {(['neutral', 'combat', 'spellcasting', 'inquisitive', 'relaxed'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPose(p)}
                className={`rounded-lg px-2 py-0.5 capitalize transition-all ${
                  pose === p
                    ? 'bg-purple-600 text-white font-bold shadow-sm'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Top Badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-purple-950/60 border border-purple-500/40 px-2.5 py-0.5 text-[10px] font-bold text-purple-200 backdrop-blur-sm pointer-events-none">
        <Sparkles className="h-3 w-3 text-amber-300 animate-pulse" />
        <span>Three.js 3D Model</span>
      </div>
    </div>
  );
};
