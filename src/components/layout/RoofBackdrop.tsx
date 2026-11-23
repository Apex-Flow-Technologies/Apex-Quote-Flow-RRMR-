import React, { useEffect, useRef, useState } from 'react';

/**
 * Backdrop for the top of every page: a corrugated roofing sheet (RR's own product)
 * with daylight slowly sweeping across it.
 *
 * - three.js is loaded lazily, after the page has rendered, so it never delays the app.
 * - Renders at ~30 fps, capped pixel ratio, and pauses while the tab is hidden.
 * - "Reduce motion" on the device: one still frame, no loop.
 * - Phones, and devices without WebGL: a static CSS version of the same sheet.
 * - Sits behind all content (z-index -1) and is not printed.
 */
export const RoofBackdrop: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'webgl' | 'static'>('static');

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)').matches;
    const canvasTest = document.createElement('canvas');
    const hasWebGL = Boolean(canvasTest.getContext('webgl2') || canvasTest.getContext('webgl'));
    if (wide && hasWebGL) setMode('webgl');
  }, []);

  useEffect(() => {
    if (mode !== 'webgl' || !hostRef.current) return;
    const host = hostRef.current;
    let disposed = false;
    let cleanup = () => {};

    const start = async () => {
      const THREE = await import('three');
      if (disposed) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden', 'true');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
      camera.position.set(0, 7.5, 9.5);
      camera.lookAt(0, 0, -1.5);

      // Trapezoidal roofing profile: flat crests, sloped webs, flat pans (like a real sheet)
      const pitch = 0.9; // distance between ribs
      const ribHeight = 0.22;
      const profile = (x: number) => {
        const t = ((x / pitch) % 1 + 1) % 1; // 0..1 across one rib
        if (t < 0.18) return ribHeight; // crest
        if (t < 0.32) return ribHeight * (1 - (t - 0.18) / 0.14); // down slope
        if (t < 0.86) return 0; // pan
        return ribHeight * ((t - 0.86) / 0.14); // up slope
      };

      const width = 34;
      const depth = 18;
      const geo = new THREE.PlaneGeometry(width, depth, 680, 1);
      const pos = geo.attributes.position as InstanceType<typeof THREE.BufferAttribute>;
      for (let i = 0; i < pos.count; i++) {
        pos.setZ(i, profile(pos.getX(i) + width / 2));
      }
      geo.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c7d3e6'), // pale steel with RR's blue in it
        metalness: 0.78,
        roughness: 0.38,
      });
      const sheet = new THREE.Mesh(geo, material);
      sheet.rotation.x = -Math.PI / 2;
      sheet.rotation.z = -0.32; // ribs run on a diagonal
      scene.add(sheet);

      scene.add(new THREE.HemisphereLight('#eef3fb', '#8a9ab3', 1.15));
      const sun = new THREE.DirectionalLight('#ffffff', 2.4);
      sun.position.set(-8, 6, 2);
      scene.add(sun);
      const fill = new THREE.DirectionalLight('#9fb8e6', 0.6);
      fill.position.set(6, 3, -4);
      scene.add(fill);

      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = `${w}px`;
        renderer.domElement.style.height = `${h}px`;
        camera.aspect = w / Math.max(h, 1);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const draw = (t: number) => {
        // The sun drifts slowly across the sheet: one sweep every ~40 s
        const phase = t / 40000;
        sun.position.x = Math.sin(phase * Math.PI * 2) * 10;
        sun.position.z = 2 + Math.cos(phase * Math.PI * 2) * 3;
        renderer.render(scene, camera);
      };

      let raf = 0;
      let last = 0;
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        if (t - last < 33) return; // ~30 fps is plenty for a slow light
        last = t;
        draw(t);
      };

      const onVisibility = () => {
        if (reduceMotion) return;
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(loop);
      };

      if (reduceMotion) {
        draw(9000); // a pleasant still frame
      } else {
        draw(performance.now()); // first frame straight away, even if the tab starts hidden
        raf = requestAnimationFrame(loop);
        document.addEventListener('visibilitychange', onVisibility);
      }
      host.classList.add('roof-ready');

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVisibility);
        ro.disconnect();
        geo.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    // Wait until the browser is idle so the app itself is never slowed down
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void start()) : window.setTimeout(() => void start(), 300);

    return () => {
      disposed = true;
      if (!idle) window.clearTimeout(handle);
      cleanup();
    };
  }, [mode]);

  return (
    <div className="roof-backdrop no-print" aria-hidden="true">
      <div ref={hostRef} className={`roof-layer ${mode === 'static' ? 'roof-static' : ''}`} />
    </div>
  );
};
