import React, { useEffect, useRef, useState } from 'react';

/**
 * Backdrop for the top of every page: a thin-line drawing of a steel portal-frame shed
 * (columns, rafters, purlins, bracing), the kind of building RR sheets and steel go into,
 * turning very slowly like a model on an engineer's screen.
 *
 * - three.js is loaded lazily on idle, as its own chunk, so the app never waits for it.
 * - ~30 fps, capped pixel ratio, paused while the tab is hidden.
 * - "Reduce motion": one still frame. Phones / no WebGL: a faint drafting grid instead.
 * - Behind all content (z-index -1), never printed.
 */
export const FrameBackdrop: React.FC = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'webgl' | 'static'>('static');

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 1024px)').matches;
    const test = document.createElement('canvas');
    const hasWebGL = Boolean(test.getContext('webgl2') || test.getContext('webgl'));
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      host.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden', 'true');

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

      // ── Build the frame as line segments (metres) ──
      const span = 10; // across
      const bays = 6;
      const bay = 2.4; // between frames
      const eave = 4.2;
      const ridge = 5.6;
      const length = bays * bay;
      const pts: number[] = [];
      const seg = (a: [number, number, number], b: [number, number, number]) => pts.push(...a, ...b);
      const hx = span / 2;
      const z0 = -length / 2;

      for (let i = 0; i <= bays; i++) {
        const z = z0 + i * bay;
        seg([-hx, 0, z], [-hx, eave, z]); // columns
        seg([hx, 0, z], [hx, eave, z]);
        seg([-hx, eave, z], [0, ridge, z]); // rafters
        seg([hx, eave, z], [0, ridge, z]);
        seg([-hx, 0, z], [hx, 0, z]); // ground line
        // knee braces
        seg([-hx, eave - 0.8, z], [-hx + 0.9, eave + 0.25, z]);
        seg([hx, eave - 0.8, z], [hx - 0.9, eave + 0.25, z]);
      }
      // purlins along the roof, girts along the walls
      const purlins = 5;
      for (let k = 0; k <= purlins; k++) {
        const t = k / purlins;
        const y = eave + (ridge - eave) * t;
        const xl = -hx + hx * t;
        const xr = hx - hx * t;
        seg([xl, y, z0], [xl, y, -z0]);
        if (k < purlins) seg([xr, y, z0], [xr, y, -z0]);
      }
      for (const y of [1.4, 2.8]) {
        seg([-hx, y, z0], [-hx, y, -z0]);
        seg([hx, y, z0], [hx, y, -z0]);
      }
      // cross bracing in the end bays
      for (const zb of [z0, -z0 - bay]) {
        seg([-hx, 0, zb], [-hx, eave, zb + bay]);
        seg([-hx, eave, zb], [-hx, 0, zb + bay]);
        seg([hx, 0, zb], [hx, eave, zb + bay]);
        seg([hx, eave, zb], [hx, 0, zb + bay]);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const mat = new THREE.LineBasicMaterial({ color: '#2563eb', transparent: true, opacity: 0.6 });
      const frame = new THREE.LineSegments(geo, mat);
      frame.position.y = -ridge / 2;

      // faint ground grid
      const grid = new THREE.GridHelper(40, 40, '#2563eb', '#2563eb');
      const gridMat = grid.material as InstanceType<typeof THREE.LineBasicMaterial>;
      gridMat.transparent = true;
      gridMat.opacity = 0.1;
      grid.position.y = -ridge / 2;

      const model = new THREE.Group();
      model.add(frame, grid);
      scene.add(model);

      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        renderer.setSize(w, h, false);
        renderer.domElement.style.width = `${w}px`;
        renderer.domElement.style.height = `${h}px`;
        camera.aspect = w / Math.max(h, 1);
        // The canvas is a fixed-height band over the content area, so the building stays
        // the same size on any screen and sits centred between the page title and buttons
        camera.position.set(0, 12, 40);
        camera.lookAt(0, 0, 0);
        model.position.set(0, -1.6, 0);
        camera.updateProjectionMatrix();
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const draw = (t: number) => {
        model.rotation.y = 0.6 + (t / 90000) * Math.PI * 2; // one turn every 90 s
        renderer.render(scene, camera);
      };

      let raf = 0;
      let last = 0;
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        if (t - last < 33) return;
        last = t;
        draw(t);
      };
      const onVisibility = () => {
        cancelAnimationFrame(raf);
        if (!document.hidden) raf = requestAnimationFrame(loop);
      };

      draw(reduceMotion ? 0 : performance.now());
      if (!reduceMotion) {
        raf = requestAnimationFrame(loop);
        document.addEventListener('visibilitychange', onVisibility);
      }
      host.classList.add('frame-ready');

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVisibility);
        ro.disconnect();
        geo.dispose();
        mat.dispose();
        gridMat.dispose();
        grid.geometry.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    };

    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const handle = idle ? idle(() => void start()) : window.setTimeout(() => void start(), 300);
    return () => {
      disposed = true;
      if (!idle) window.clearTimeout(handle);
      cleanup();
    };
  }, [mode]);

  return (
    <div className="frame-backdrop no-print" aria-hidden="true">
      <div ref={hostRef} className={`frame-layer ${mode === 'static' ? 'frame-static' : ''}`} />
    </div>
  );
};
