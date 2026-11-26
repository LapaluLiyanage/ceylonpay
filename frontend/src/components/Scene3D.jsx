import { useEffect, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

// Light intensities were tuned in an older three.js that did not apply the physical light scale.
const L = Math.PI;

// Cheap deterministic noise so the stone looks hand-cut instead of perfectly flat.
const hash = (x, y, z) => {
  const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

function roughen(geo, amount) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    p.setXYZ(i, x + (hash(x, y, z) - 0.5) * amount, y + (hash(y, z, x) - 0.5) * amount, z + (hash(z, x, y) - 0.5) * amount);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildScene(renderer) {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff1e6, 0x4a3a30, 0.55 * L));
  const key = new DirectionalLight(0xffe2c8, 0.95 * L);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new DirectionalLight(0xff7a45, 0.6 * L);
  rim.position.set(-6, 2, -4);
  scene.add(rim);

  // A small studio of bright panels gives the polished stone something to reflect.
  const env = new Scene();
  env.add(new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: 0x2a1a12, side: BackSide })));
  [
    [0, 9, 4, 14, 3, 0xfff4ea],
    [-9, 3, 2, 3, 10, 0xffd2b8],
    [9, 2, -2, 3, 8, 0xffffff],
    [0, -2, 10, 10, 2, 0xff9a6a],
  ].forEach(([x, y, z, w, h, c]) => {
    const panel = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: c, side: DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    env.add(panel);
  });
  const pmrem = new PMREMGenerator(renderer);
  const envTexture = pmrem.fromScene(env, 0.04).texture;
  scene.environment = envTexture;
  pmrem.dispose();

  const stone = new MeshPhysicalMaterial({ color: 0xe9e3da, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, reflectivity: 0.6 });
  const dark = new MeshPhysicalMaterial({ color: 0x2a2522, roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04 });
  const accent = new MeshPhysicalMaterial({ color: 0xe2572b, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 });
  const goldM = new MeshStandardMaterial({ color: 0xe0ad4a, metalness: 1, roughness: 0.14 });

  const root = new Group();
  scene.add(root);
  const add = (geo, mat, x, y, z) => {
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };

  // The bank: stepped base, four columns, a lintel and a triangular pediment.
  add(roughen(new BoxGeometry(4.6, 0.32, 2.4, 8, 2, 4), 0.015), dark, 0, -2.2, 0);
  add(roughen(new BoxGeometry(4.2, 0.3, 2.1, 8, 2, 4), 0.015), stone, 0, -1.9, 0);
  add(roughen(new BoxGeometry(3.8, 0.26, 1.8, 8, 2, 4), 0.012), stone, 0, -1.62, 0);
  [-1.38, -0.46, 0.46, 1.38].forEach((x) => {
    add(roughen(new CylinderGeometry(0.24, 0.28, 2.3, 16, 6), 0.008), stone, x, -0.36, 0);
    add(new BoxGeometry(0.66, 0.14, 0.66), stone, x, 0.86, 0);
    add(new BoxGeometry(0.62, 0.12, 0.62), stone, x, -1.45, 0);
  });
  add(roughen(new BoxGeometry(3.9, 0.36, 1.8, 8, 2, 4), 0.012), stone, 0, 1.1, 0);
  const tri = new Shape();
  tri.moveTo(-2.05, 0);
  tri.lineTo(2.05, 0);
  tri.lineTo(0, 1.05);
  tri.lineTo(-2.05, 0);
  add(new ExtrudeGeometry(tri, { depth: 1.8, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }), stone, 0, 1.3, -0.9);
  const pedCoin = add(new CylinderGeometry(0.24, 0.24, 0.08, 40), accent, 0, 1.68, 0.95);
  pedCoin.rotation.x = Math.PI / 2;

  // A little stack of coins by the steps and three drifting ones.
  const small = new CylinderGeometry(0.26, 0.26, 0.07, 40);
  for (let i = 0; i < 4; i++) {
    const c = new Mesh(small, i % 2 ? accent : goldM);
    c.position.set(-1.05 + i * 0.02, -1.5 + i * 0.085, 1.35);
    root.add(c);
  }
  const floaters = [];
  [
    [-2.3, 1.6, 0.6],
    [2.25, -0.5, 0.8],
    [-2.1, -1.1, 1.1],
  ].forEach(([x, y, z], i) => {
    const c = new Mesh(small, i === 1 ? accent : goldM);
    c.position.set(x, y, z);
    c.rotation.x = Math.PI / 2.4;
    c.userData.base = y;
    root.add(c);
    floaters.push(c);
  });

  // The big coin with "Rs" on its face.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const cx = canvas.getContext('2d');
  cx.fillStyle = '#d9a441';
  cx.fillRect(0, 0, 256, 256);
  cx.strokeStyle = '#a8761f';
  cx.lineWidth = 10;
  cx.beginPath();
  cx.arc(128, 128, 104, 0, Math.PI * 2);
  cx.stroke();
  cx.fillStyle = '#8a5d14';
  cx.font = 'bold 96px Archivo, sans-serif';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText('Rs', 128, 136);
  const faceTexture = new CanvasTexture(canvas);
  faceTexture.colorSpace = SRGBColorSpace;
  const gold = new MeshStandardMaterial({ color: 0xe0ad4a, metalness: 1, roughness: 0.12 });
  const face = new MeshStandardMaterial({ map: faceTexture, metalness: 0.85, roughness: 0.16 });
  const coin = new Mesh(new CylinderGeometry(0.68, 0.68, 0.14, 56), [gold, face, face]);
  coin.rotation.x = Math.PI / 2;
  const coinGroup = new Group();
  coinGroup.add(coin);
  coinGroup.position.set(1.45, 2.1, 1.5);
  coinGroup.scale.setScalar(0.72);
  root.add(coinGroup);

  const dispose = () => {
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      mats.forEach((m) => m.dispose());
    });
    faceTexture.dispose();
    envTexture.dispose();
  };

  return { scene, root, coinGroup, floaters, dispose };
}

/**
 * The 3D bank and coins. It fills its parent, so the parent must be `position: relative`.
 * `rotation` is the yaw to settle at (radians); change it to turn the building.
 * If WebGL is unavailable it renders nothing and the page's own gradient shows through.
 */
export default function Scene3D({ rotation = -0.35 }) {
  const hostRef = useRef(null);
  const targetRef = useRef({ rot: rotation, mx: 0, my: 0 });

  useEffect(() => {
    targetRef.current.rot = rotation;
  }, [rotation]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      return undefined; // No WebGL: leave the gradient background.
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(new Color(0x000000), 0);
    const el = renderer.domElement;
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    el.setAttribute('aria-hidden', 'true');
    host.insertBefore(el, host.firstChild);

    const camera = new PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.6, 11);
    const { scene, root, coinGroup, floaters, dispose } = buildScene(renderer);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The whole model is about 5.6 units tall and wide. Pull the camera back until it fills the frame, as
    // the design does (about 10.5 units away in a roughly square frame, further back in a tall narrow one).
    const MODEL_SIZE = 5.6;
    const HALF_TAN = Math.tan((camera.fov * Math.PI) / 360);
    const fit = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = Math.max(MODEL_SIZE / (2 * HALF_TAN), MODEL_SIZE / (camera.aspect * 2 * HALF_TAN));
      camera.updateProjectionMatrix();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);

    const clock = new Clock();
    let frame = 0;
    const draw = () => {
      const t = reduceMotion ? 0 : clock.getElapsedTime();
      const target = targetRef.current;
      root.rotation.y += (target.rot + Math.sin(t * 0.35) * 0.2 + target.mx * 0.35 - root.rotation.y) * 0.05;
      root.rotation.x += (target.my * 0.18 - root.rotation.x) * 0.05;
      coinGroup.rotation.y = t * 1.3;
      coinGroup.position.y = 2.1 + Math.sin(t * 1.5) * 0.16;
      floaters.forEach((c, i) => {
        c.position.y = c.userData.base + Math.sin(t * 1.1 + i * 2) * 0.14;
        c.rotation.z = t * (0.6 + i * 0.2);
      });
      renderer.render(scene, camera);
    };
    const loop = () => {
      frame = requestAnimationFrame(loop);
      draw();
    };
    if (reduceMotion) {
      root.rotation.y = rotation;
      draw();
    } else {
      loop();
    }

    // The building leans a little towards the pointer.
    const onMove = (e) => {
      const r = host.getBoundingClientRect();
      targetRef.current.mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      targetRef.current.my = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    const onLeave = () => {
      targetRef.current.mx = 0;
      targetRef.current.my = 0;
    };
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
      dispose();
      renderer.dispose();
      if (el.parentNode === host) host.removeChild(el);
    };
    // The scene is built once; rotation is pushed in through targetRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0, zIndex: 1 }} />;
}
