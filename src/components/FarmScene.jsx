import React, { useEffect, useRef, useState } from 'react';

function StaticFarmBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(160deg,#173b2a_0%,#245b3b_48%,#a87542_49%,#65452e_100%)]"
    >
      <div className="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_70%_18%,rgba(253,224,151,.25),transparent_26%),linear-gradient(180deg,rgba(125,181,188,.24),transparent)]" />
      <div className="absolute bottom-[-18%] left-[-10%] h-2/5 w-[120%] rotate-[-4deg] bg-[repeating-linear-gradient(90deg,rgba(43,91,45,.45)_0_2px,transparent_2px_28px)] opacity-80" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,30,19,.64),rgba(5,30,19,.16)_58%,rgba(5,30,19,.28))]" />
    </div>
  );
}

export default function FarmScene({ className = '', style = {} }) {
  const canvasRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const isSmallScreen = window.matchMedia('(max-width: 700px)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isSmallScreen || prefersReducedMotion) {
      setFallback(true);
      return undefined;
    }

    let disposed = false;
    let cleanup = () => {};

    const startScene = async () => {
      const THREE = await import('three');
      if (disposed || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const testContext = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!testContext) {
        setFallback(true);
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 4.6, 12);
      camera.lookAt(0, 0.2, 0);

      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      const ambient = new THREE.HemisphereLight(0xb9d8cf, 0x3b2b1e, 2.2);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffe7b0, 2.5);
      sun.position.set(-5, 9, 6);
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(42, 28),
        new THREE.MeshLambertMaterial({ color: 0x5f472d })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.15;
      scene.add(ground);

      const field = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 18),
        new THREE.MeshLambertMaterial({ color: 0x315f35 })
      );
      field.rotation.x = -Math.PI / 2;
      field.position.set(1.5, -1.1, -1.5);
      scene.add(field);

      const plantGroups = [];
      const plantCount = 28;
      const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x3f6f38 });
      const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x75a94c, side: THREE.DoubleSide });
      const leafLightMaterial = new THREE.MeshLambertMaterial({ color: 0xa4c96c, side: THREE.DoubleSide });
      const stemGeometry = new THREE.CylinderGeometry(0.035, 0.06, 1.25, 6);
      const leafGeometry = new THREE.SphereGeometry(0.23, 7, 4);

      for (let index = 0; index < plantCount; index += 1) {
        const group = new THREE.Group();
        const row = Math.floor(index / 7);
        const column = index % 7;
        const depth = row * 1.25 - 1.2;
        const spread = (column - 3) * 1.05 + (row % 2 ? 0.35 : 0);
        group.position.set(spread, -0.48 + (row % 2) * 0.05, depth - 0.3);
        group.scale.setScalar(0.76 + (index % 4) * 0.1);

        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.62;
        group.add(stem);

        [-1, 0, 1].forEach((side, leafIndex) => {
          const leaf = new THREE.Mesh(leafGeometry, leafIndex === 1 ? leafLightMaterial : leafMaterial);
          leaf.position.set(side * 0.2, 0.58 + leafIndex * 0.25, side === 0 ? 0.02 : side * 0.12);
          leaf.scale.set(1.6, 0.32, 0.75);
          leaf.rotation.z = side * 0.35;
          leaf.rotation.y = side * 0.25;
          group.add(leaf);
        });
        scene.add(group);
        plantGroups.push({ group, phase: index * 0.41 });
      }

      const particlePositions = new Float32Array(42 * 3);
      for (let index = 0; index < 42; index += 1) {
        particlePositions[index * 3] = (Math.random() - 0.5) * 15;
        particlePositions[index * 3 + 1] = Math.random() * 4 - 0.2;
        particlePositions[index * 3 + 2] = Math.random() * 3 - 2;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xd7edbb, size: 0.045, transparent: true, opacity: 0.55 }));
      scene.add(particles);

      const scanRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.72, 0.012, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xb8df7a, transparent: true, opacity: 0.65 })
      );
      scanRing.position.set(0, 0.08, -0.55);
      scanRing.rotation.x = Math.PI / 2;
      scene.add(scanRing);

      const pointer = { x: 0, y: 0 };
      const onPointerMove = (event) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.35;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.16;
      };
      const resize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      let frameId;
      let lastTime = 0;
      const animate = (time) => {
        frameId = requestAnimationFrame(animate);
        if (document.hidden || time - lastTime < 28) return;
        lastTime = time;
        const seconds = time * 0.00035;
        plantGroups.forEach(({ group, phase }) => {
          group.rotation.z = Math.sin(seconds * 2.2 + phase) * 0.035;
          group.rotation.y = Math.cos(seconds * 1.5 + phase) * 0.018;
        });
        particles.rotation.y = seconds * 0.12;
        scanRing.rotation.z = seconds * 0.8;
        camera.position.x += (pointer.x - camera.position.x * 0.02) * 0.025;
        camera.position.y += (4.6 + pointer.y - camera.position.y) * 0.006;
        camera.lookAt(0, 0.2, 0);
        renderer.render(scene, camera);
      };

      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      resize();
      animate(0);

      cleanup = () => {
        cancelAnimationFrame(frameId);
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        scene.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => material.dispose());
          }
        });
        renderer.dispose();
      };
    };

    startScene().catch(() => setFallback(true));
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return fallback ? (
    <div className={`absolute inset-0 ${className}`} style={style}>
      <StaticFarmBackdrop />
    </div>
  ) : (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}
      style={style}
    />
  );
}