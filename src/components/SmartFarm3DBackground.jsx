import React, { useEffect, useRef, useState } from 'react';

function CssFarmFallback() {
  return <div aria-hidden="true" className="smart-farm-fallback"><span className="smart-farm-sun" /><span className="smart-farm-hill smart-farm-hill-back" /><span className="smart-farm-hill smart-farm-hill-front" /><span className="smart-farm-field" /><span className="smart-farm-row smart-farm-row-one" /><span className="smart-farm-row smart-farm-row-two" /></div>;
}

function isNight() {
  return document.documentElement.classList.contains('dark');
}

export default function SmartFarm3DBackground({ sceneKey = 'dashboard' }) {
  const canvasRef = useRef(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowEnd = window.matchMedia('(max-width: 700px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    if (reduced || lowEnd) {
      setFallback(true);
      return undefined;
    }

    let disposed = false;
    let cleanup = () => {};
    let themeObserver;
    const start = async () => {
      const THREE = await import('three');
      if (disposed || !canvasRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas.getContext('webgl2') && !canvas.getContext('webgl')) {
        setFallback(true);
        return;
      }

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
      camera.position.set(0, 4.3, 12);
      const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = false;

      const sky = new THREE.Mesh(new THREE.SphereGeometry(35, 16, 8), new THREE.MeshBasicMaterial({ color: 0x9fc9d0, side: THREE.BackSide }));
      scene.add(sky);
      const ambient = new THREE.HemisphereLight(0xd8eee8, 0x3d3026, 1.7);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffe2a1, 2.1);
      sun.position.set(-5, 9, 5);
      scene.add(sun);

      const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 28), new THREE.MeshLambertMaterial({ color: 0x6b5133 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.2;
      scene.add(ground);
      const field = new THREE.Mesh(new THREE.PlaneGeometry(30, 17), new THREE.MeshLambertMaterial({ color: 0x38673a }));
      field.rotation.x = -Math.PI / 2;
      field.position.set(1, -1.14, -1.2);
      scene.add(field);

      const cropGroups = [];
      const stemGeometry = new THREE.CylinderGeometry(0.035, 0.06, 1.1, 5);
      const leafGeometry = new THREE.SphereGeometry(0.22, 6, 4);
      const stemMaterial = new THREE.MeshLambertMaterial({ color: 0x315d35 });
      const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x78a95a });
      for (let index = 0; index < 24; index += 1) {
        const crop = new THREE.Group();
        const row = Math.floor(index / 6);
        const column = index % 6;
        crop.position.set((column - 2.5) * 1.2, -0.48, row * 1.25 - 1.6);
        crop.scale.setScalar(0.7 + (index % 3) * 0.1);
        const stem = new THREE.Mesh(stemGeometry, stemMaterial);
        stem.position.y = 0.55;
        crop.add(stem);
        [-1, 1].forEach((side) => {
          const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
          leaf.position.set(side * 0.22, 0.65 + (side === 1 ? 0.18 : 0), side * 0.08);
          leaf.scale.set(1.7, 0.3, 0.7);
          leaf.rotation.z = side * 0.4;
          crop.add(leaf);
        });
        scene.add(crop);
        cropGroups.push({ crop, phase: index * 0.47 });
      }

      const cloudGroups = [];
      const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f5e8, transparent: true, opacity: 0.72 });
      for (let index = 0; index < 4; index += 1) {
        const cloud = new THREE.Group();
        for (let puff = 0; puff < 3; puff += 1) {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.55 + puff * 0.12, 7, 5), cloudMaterial);
          mesh.position.set(puff * 0.62, puff % 2 ? 0.15 : 0, 0);
          cloud.add(mesh);
        }
        cloud.position.set(-8 + index * 5, 4.1 + (index % 2) * 0.7, -4 - index * 0.6);
        cloud.scale.setScalar(0.75 + (index % 2) * 0.25);
        scene.add(cloud);
        cloudGroups.push({ cloud, speed: 0.08 + index * 0.01 });
      }

      const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x3f743f });
      for (let index = 0; index < 5; index += 1) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.2, 6), new THREE.MeshLambertMaterial({ color: 0x6b4930 }));
        trunk.position.y = -0.3;
        tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 0), treeMaterial);
        crown.position.y = 0.55;
        tree.add(crown);
        tree.position.set(index % 2 ? 7 : -7, 0, -3.7 - index * 0.25);
        tree.scale.setScalar(0.7 + (index % 3) * 0.13);
        scene.add(tree);
      }

      const particles = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xd9efb7, size: 0.045, transparent: true, opacity: 0.45 }));
      const positions = new Float32Array(32 * 3);
      for (let index = 0; index < 32; index += 1) {
        positions[index * 3] = (Math.random() - 0.5) * 16;
        positions[index * 3 + 1] = Math.random() * 4 - 0.2;
        positions[index * 3 + 2] = Math.random() * 4 - 3;
      }
      particles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      scene.add(particles);

      const pointer = { x: 0, y: 0 };
      const onPointerMove = (event) => {
        pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.32;
        pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.12;
      };
      const applyTheme = () => {
        const night = isNight();
        sky.material.color.setHex(night ? 0x15291f : 0x9fc9d0);
        ambient.color.setHex(night ? 0x6d917c : 0xd8eee8);
        ambient.groundColor.setHex(night ? 0x101a14 : 0x3d3026);
        sun.color.setHex(night ? 0x9bc4a3 : 0xffe2a1);
        sun.intensity = night ? 1.0 : 2.1;
        ground.material.color.setHex(night ? 0x2d3b2d : 0x6b5133);
        field.material.color.setHex(night ? 0x24452b : 0x38673a);
        cloudMaterial.color.setHex(night ? 0x405a4a : 0xf4f5e8);
        cloudMaterial.opacity = night ? 0.28 : 0.72;
        particles.material.color.setHex(night ? 0xf3ce72 : 0xd9efb7);
      };
      const resize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (!width || !height) return;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      const observerTarget = document.documentElement;
      themeObserver = new MutationObserver(applyTheme);
      themeObserver.observe(observerTarget, { attributes: true, attributeFilter: ['class'] });
      applyTheme();

      let frameId;
      let lastFrame = 0;
      const animate = (time) => {
        frameId = requestAnimationFrame(animate);
        if (document.hidden || time - lastFrame < 32) return;
        lastFrame = time;
        const seconds = time * 0.00035;
        cropGroups.forEach(({ crop, phase }) => {
          crop.rotation.z = Math.sin(seconds * 2 + phase) * 0.035;
          crop.rotation.y = Math.cos(seconds * 1.4 + phase) * 0.02;
        });
        cloudGroups.forEach(({ cloud, speed }) => {
          cloud.position.x += speed * 0.012;
          if (cloud.position.x > 10) cloud.position.x = -10;
        });
        particles.rotation.y = seconds * 0.08;
        camera.position.x += (pointer.x - camera.position.x * 0.02) * 0.02;
        camera.position.y += (4.3 + pointer.y - camera.position.y) * 0.006;
        camera.lookAt(0, 0.1, -1);
        renderer.render(scene, camera);
      };
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      resize();
      animate(0);
      cleanup = () => {
        cancelAnimationFrame(frameId);
        themeObserver?.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('pointermove', onPointerMove);
        scene.traverse((object) => {
          object.geometry?.dispose();
          if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material.dispose());
        });
        renderer.dispose();
      };
    };
    start().catch(() => setFallback(true));
    return () => { disposed = true; cleanup(); };
  }, [sceneKey]);

  return fallback ? <CssFarmFallback /> : <canvas ref={canvasRef} aria-hidden="true" className="smart-farm-canvas" />;
}
