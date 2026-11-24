import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { Track } from "../data/tracks";
import { audioEngine } from "../lib/audioEngine";
import { keyBackdropToCanvas } from "../lib/imageKeying";
import {
  createAcousticWallTexture,
  createDeckOledTexture,
  createMixerFaceplateTexture,
  createOnAirSignTexture,
  createRadialGlowTexture,
  createRecordLabelTexture,
  createStrobeRimTexture,
  createVinylGrooveBumpTexture,
  createWoodFloorTexture,
  drawDeckOled,
  drawRecordLabel,
} from "./proceduralTextures";

export interface BoothSettings {
  glow: number;
  haze: number;
  spin: number;
  pulse: boolean;
  orbit: number; // -0.45..0.45 rad
  zoom: number;  // 6.2..10.5
}

export interface BoothHostFit {
  scale: number;
  x: number;
  y: number;
}

export interface BoothThemeColors {
  room: string;
  plum: string;
  panel: string;
  accent: string;
  accentBright: string;
}

export interface BoothController {
  setTrack: (index: number, animateDrop: boolean) => void;
  setTracks: (tracks: Track[], activeIndex: number) => void;
  setPlaying: (playing: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setHostPortrait: (src: string, fit: BoothHostFit) => void;
  updateSettings: (settings: Partial<BoothSettings>) => void;
  updateTheme: (theme: BoothThemeColors) => void;
  handlePointerDrag: (dx: number, dy: number) => { orbit: number };
  dispose: () => void;
}

const _tempColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function mountBoothScene(
  backCanvas: HTMLCanvasElement,
  frontCanvas: HTMLCanvasElement,
  container: HTMLElement,
  initialTracks: Track[],
  initialTrack: number,
  initialPlaying: boolean,
  initialReduced: boolean,
  initialSettings: BoothSettings,
  onContextLost?: () => void
): BoothController | null {
  if (!window.WebGLRenderingContext) return null;

  const isSoftwareGl = detectSoftwareWebGL();
  let rBack: THREE.WebGLRenderer;
  let rFront: THREE.WebGLRenderer;

  try {
    rBack = new THREE.WebGLRenderer({
      canvas: backCanvas,
      antialias: !isSoftwareGl,
      powerPreference: "high-performance",
    });
    rFront = new THREE.WebGLRenderer({
      canvas: frontCanvas,
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  [rBack, rFront].forEach((r) => {
    r.setPixelRatio(pixelRatio);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
  });
  rBack.setClearColor(0x170d21, 1);
  rFront.setClearColor(0x000000, 0);
  rFront.shadowMap.enabled = !isSoftwareGl;
  rFront.shadowMap.type = THREE.PCFSoftShadowMap;

  const maxAniso = Math.min(8, rFront.capabilities.getMaxAnisotropy() || 1);

  // Studio environment reflections (RoomEnvironment) for realistic brushed brass & clearcoat vinyl
  const pmremBack = new THREE.PMREMGenerator(rBack);
  const envTexBack = pmremBack.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremBack.dispose();

  const pmremFront = new THREE.PMREMGenerator(rFront);
  const envTexFront = pmremFront.fromScene(new RoomEnvironment(), 0.04).texture;
  pmremFront.dispose();

  const backScene = new THREE.Scene();
  backScene.fog = new THREE.FogExp2(0x170d21, initialSettings.haze);
  backScene.environment = envTexBack;
  backScene.environmentIntensity = 0.45;

  const frontScene = new THREE.Scene();
  frontScene.environment = envTexFront;
  frontScene.environmentIntensity = 0.72;

  const camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.1, 65);
  const target = new THREE.Vector3(0, 2.28, -0.15);

  // Shared disposable tracking
  const disposables: Array<{ dispose: () => void }> = [envTexBack, envTexFront];
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    disposables.push(t);
    return t;
  };
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    disposables.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    disposables.push(m);
    return m;
  };

  // ---------------- LIGHTING RIG ----------------
  const C = {
    room: 0x170d21,
    plum: 0x352247,
    panel: 0x291a38,
    walnut: 0x2e1c24,
    gold: 0xc9a87c,
    goldBright: 0xe5bb71,
    vinyl: 0x14101a,
    rim: 0x9b7fc4,
    live: 0x7fd1a6,
  };

  // Warm key + cool hemisphere fill + violet rim
  const hemiBack = new THREE.HemisphereLight(0x9b7fc4, 0x1a0e24, 0.58);
  backScene.add(hemiBack);
  const keyBack = new THREE.DirectionalLight(0xffdfb0, 1.45);
  keyBack.position.set(3.2, 6.5, 4.2);
  backScene.add(keyBack);
  const rimBack = new THREE.DirectionalLight(0x8c6ec4, 1.05);
  rimBack.position.set(-4.5, 5.2, -5.0);
  backScene.add(rimBack);
  const boothGlowBack = new THREE.PointLight(C.goldBright, 20, 15, 2);
  boothGlowBack.position.set(0, 3.4, 0.8);
  backScene.add(boothGlowBack);

  const hemiFront = new THREE.HemisphereLight(0xa389cf, 0x1c1026, 0.68);
  frontScene.add(hemiFront);
  const keyFront = new THREE.DirectionalLight(0xffe1b5, 1.55);
  keyFront.position.set(3.2, 6.4, 4.4);
  if (!isSoftwareGl) {
    keyFront.castShadow = true;
    keyFront.shadow.mapSize.set(1024, 1024);
    keyFront.shadow.camera.near = 1;
    keyFront.shadow.camera.far = 16;
    keyFront.shadow.camera.left = -4.2;
    keyFront.shadow.camera.right = 4.2;
    keyFront.shadow.camera.top = 3.5;
    keyFront.shadow.camera.bottom = -2.5;
    keyFront.shadow.bias = -0.0005;
    keyFront.shadow.normalBias = 0.02;
  }
  frontScene.add(keyFront);

  const rimFront = new THREE.DirectionalLight(0x9e7ed6, 1.1);
  rimFront.position.set(-4.2, 4.8, -4.5);
  frontScene.add(rimFront);

  const boothGlowFront = new THREE.PointLight(C.goldBright, 18, 12, 2);
  boothGlowFront.position.set(0, 3.2, 0.9);
  frontScene.add(boothGlowFront);

  const onAirLight = new THREE.PointLight(C.goldBright, 0, 8, 2);
  onAirLight.position.set(0, 3.45, -3.2);
  backScene.add(onAirLight);

  if (!isSoftwareGl) {
    RectAreaLightUniformsLib.init();
    const overheadSoftbox = new THREE.RectAreaLight(0xffe2b3, 3.2, 4.8, 1.1);
    overheadSoftbox.position.set(0, 3.8, 0.1);
    overheadSoftbox.lookAt(0, 1.2, -0.2);
    frontScene.add(overheadSoftbox);
  }

  // ---------------- MATERIALS ----------------
  const mConsoleBody = trackMat(
    new THREE.MeshStandardMaterial({ color: C.plum, roughness: 0.58, metalness: 0.08 })
  );
  const mConsoleDark = trackMat(
    new THREE.MeshStandardMaterial({ color: C.panel, roughness: 0.72, metalness: 0.05 })
  );
  const mWalnutTrim = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x3b2329, roughness: 0.48, metalness: 0.05 })
  );
  const mBrushedBrass = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: C.goldBright,
      roughness: 0.22,
      metalness: 0.92,
      anisotropy: 0.75,
      clearcoat: 0.2,
    })
  );
  const mDarkChrome = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x262030,
      roughness: 0.26,
      metalness: 0.85,
      clearcoat: 0.35,
    })
  );
  const mPlatterRubber = trackMat(
    new THREE.MeshStandardMaterial({ color: 0x100d14, roughness: 0.88, metalness: 0.04 })
  );

  // ---------------- BACK SCENE: ARCHITECTURAL STUDIO ROOM ----------------
  const floorTex = trackTex(createWoodFloorTexture(maxAniso));
  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.65, metalness: 0.08 })
  );
  const floor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(42, 42)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  backScene.add(floor);

  const wallTex = trackTex(createAcousticWallTexture(maxAniso));
  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.82, metalness: 0.05 })
  );
  const backWall = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(36, 13)), wallMat);
  backWall.position.set(0, 5.8, -4.4);
  backScene.add(backWall);

  // Architectural brass horizontal dado rail & vertical accent ribs on back wall
  const dadoRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(16, 0.06, 0.08)), mBrushedBrass);
  dadoRail.position.set(0, 2.25, -4.34);
  backScene.add(dadoRail);

  [-3.8, 3.8].forEach((x) => {
    const pilaster = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.14, 7.5, 0.16)), mWalnutTrim);
    pilaster.position.set(x, 3.75, -4.32);
    backScene.add(pilaster);
  });

  // Volumetric studio spotlight cones + warm halo behind Marlowe
  const haloTex = trackTex(createRadialGlowTexture(8, "rgba(229,187,113,0.62)"));
  const haloSprite = new THREE.Sprite(
    trackMat(
      new THREE.SpriteMaterial({
        map: haloTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
  );
  haloSprite.scale.set(6.8, 6.2, 1);
  haloSprite.position.set(0, 2.45, -3.1);
  backScene.add(haloSprite);

  const shaftMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: C.goldBright,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  [
    [-1.75, 0.2],
    [1.75, -0.2],
  ].forEach(([x, tilt]) => {
    const cone = new THREE.Mesh(
      trackGeo(new THREE.ConeGeometry(1.35, 6.2, 24, 1, true)),
      shaftMat
    );
    cone.position.set(x, 3.85, -0.35);
    cone.rotation.z = tilt;
    backScene.add(cone);
  });

  // Contact shadow grounding plane on studio floor
  const contactTex = trackTex(createRadialGlowTexture(16, "rgba(0,0,0,0.65)"));
  const contactShadow = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(8.2, 4.6)),
    trackMat(
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
      })
    )
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(0, 0.015, -0.2);
  backScene.add(contactShadow);

  // Floating golden studio dust motes
  const dustCount = 120;
  const dustGeo = trackGeo(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    const rx = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 8.5;
    const ry = 0.5 + ((i * 37) % 42) / 10;
    const rz = -3.8 + ((i * 19) % 34) / 10;
    dustPositions[i * 3] = rx;
    dustPositions[i * 3 + 1] = ry;
    dustPositions[i * 3 + 2] = rz;
  }
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
  const dustPoints = new THREE.Points(
    dustGeo,
    trackMat(
      new THREE.PointsMaterial({
        color: C.goldBright,
        size: 0.075,
        map: haloTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
  );
  backScene.add(dustPoints);

  // ---------------- FRONT SCENE: STANDING DJ CONSOLE DESK ----------------
  const consoleGroup = new THREE.Group();
  const TY = 1.62;

  // Main upper console body (dark plum tabletop on top, brass molding recessed below top edge)
  const consoleTop = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.9, 0.24, 1.96)),
    mConsoleBody
  );
  consoleTop.position.set(0, TY - 0.12, 0);
  consoleTop.receiveShadow = true;
  consoleTop.castShadow = true;
  consoleGroup.add(consoleTop);

  const brassBelt = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.96, 0.055, 2.02)),
    mBrushedBrass
  );
  brassBelt.position.set(0, TY - 0.045, 0);
  consoleGroup.add(brassBelt);

  [-2.5, 2.5].forEach((x) => {
    const cheek = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.34, 2.04)), mWalnutTrim);
    cheek.position.set(x, TY - 0.14, 0);
    cheek.castShadow = true;
    consoleGroup.add(cheek);
  });

  // Tall standing architectural legs & recessed front modesty panel with vertical brass louvers
  [-2.18, 2.18].forEach((x) => {
    const leg = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.24, 1.44, 1.58)), mConsoleDark);
    leg.position.set(x, 0.72, 0);
    leg.castShadow = true;
    consoleGroup.add(leg);

    const foot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.13, 0.06, 16)), mBrushedBrass);
    foot.position.set(x, 0.03, 0.62);
    consoleGroup.add(foot);
  });

  const modestyPanel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(4.12, 1.04, 0.06)),
    mConsoleDark
  );
  modestyPanel.position.set(0, 0.88, 0.88);
  consoleGroup.add(modestyPanel);

  // Brass louvered grille strips on the front panel (instanced)
  const louverGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.84, 0.03));
  const louvers = new THREE.InstancedMesh(louverGeo, mBrushedBrass, 19);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 19; i++) {
    dummy.position.set(-1.8 + i * 0.2, 0.88, 0.915);
    dummy.updateMatrix();
    louvers.setMatrixAt(i, dummy.matrix);
  }
  louvers.instanceMatrix.needsUpdate = true;
  consoleGroup.add(louvers);

  frontScene.add(consoleGroup);

  // ---------------- MARLOWE 3D STUDIO CUTOUT BEHIND CONSOLE ----------------
  const marloweMat = trackMat(
    new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.08,
      side: THREE.DoubleSide,
      toneMapped: false,
      visible: false,
    })
  );
  const marloweMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(3.55, 2.66)),
    marloweMat
  );
  const baseMarloweY = TY + 1.29; // bottom at ~TY-0.04, hands at ~TY+0.28 above vinyl platters
  marloweMesh.position.set(0, baseMarloweY, -0.82);
  frontScene.add(marloweMesh);

  let hostFitState: BoothHostFit = { scale: 1, x: 0, y: 0 };
  let activeHostTex: THREE.Texture | null = null;
  let hostRequestToken = 0;
  let lastLoadedSrc = "";

  function loadHostTexture(src: string): void {
    const token = ++hostRequestToken;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (disposed || token !== hostRequestToken) return;
      const keyedCanvas = keyBackdropToCanvas(img);
      const tex = keyedCanvas ? new THREE.CanvasTexture(keyedCanvas) : new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.needsUpdate = true;

      if (activeHostTex) activeHostTex.dispose();
      activeHostTex = tex;
      marloweMat.map = tex;
      marloweMat.visible = true;
      marloweMat.needsUpdate = true;

      // Preserve aspect ratio of uploaded portrait if different from 4:3
      const aspect = (img.naturalWidth || 4) / (img.naturalHeight || 3);
      const h = 2.66;
      const w = h * aspect;
      marloweMesh.geometry.dispose();
      marloweMesh.geometry = new THREE.PlaneGeometry(w, h);

      if (reducedMotion) renderOnce();
    };
    img.src = src;
  }

  // ---------------- STUDIO MONITOR SPEAKERS (FLANKING CONSOLE) ----------------
  const woofers: THREE.Mesh[] = [];
  [-3.12, 3.12].forEach((x, sideIdx) => {
    const spk = new THREE.Group();
    spk.position.set(x, 0, -0.32);
    spk.rotation.y = sideIdx === 0 ? 0.28 : -0.28;

    const basePlate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.05, 0.68)), mDarkChrome);
    basePlate.position.y = 0.025;
    spk.add(basePlate);

    const standPost = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.075, 0.09, 1.66, 16)), mDarkChrome);
    standPost.position.y = 0.86;
    spk.add(standPost);

    const cab = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.66, 0.96, 0.58)), mWalnutTrim);
    cab.position.y = 2.18;
    cab.castShadow = true;
    spk.add(cab);

    const baffle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.58, 0.88, 0.04)), mConsoleDark);
    baffle.position.set(0, 2.18, 0.29);
    spk.add(baffle);

    const tweeterRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.085, 0.02, 12, 24)),
      mBrushedBrass
    );
    tweeterRing.position.set(0, 2.42, 0.31);
    spk.add(tweeterRing);

    const tweeterDome = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.05, 16, 12)),
      mBrushedBrass
    );
    tweeterDome.scale.set(1, 1, 0.5);
    tweeterDome.position.set(0, 2.42, 0.31);
    spk.add(tweeterDome);

    const wooferRing = new THREE.Mesh(
      trackGeo(new THREE.TorusGeometry(0.185, 0.026, 12, 32)),
      mBrushedBrass
    );
    wooferRing.position.set(0, 2.02, 0.31);
    spk.add(wooferRing);

    const wooferCone = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.06, 0.175, 0.07, 28)),
      mPlatterRubber
    );
    wooferCone.rotation.x = Math.PI / 2;
    wooferCone.position.set(0, 2.02, 0.295);
    spk.add(wooferCone);
    woofers.push(wooferCone);

    frontScene.add(spk);
  });

  // ---------------- VINYL RECORD CRATE BESIDE CONSOLE ----------------
  const crateGroup = new THREE.Group();
  crateGroup.position.set(-2.72, 0, 0.72);
  crateGroup.rotation.y = 0.42;

  const crateBase = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.05, 0.68)), mWalnutTrim);
  crateBase.position.y = 0.025;
  crateGroup.add(crateBase);

  [
    [0, 0.32],
    [0, -0.32],
  ].forEach(([x, z]) => {
    const slat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.36, 0.04)), mWalnutTrim);
    slat.position.set(x, 0.22, z);
    crateGroup.add(slat);
  });
  [-0.32, 0.32].forEach((x) => {
    const side = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.36, 0.64)), mWalnutTrim);
    side.position.set(x, 0.22, 0);
    crateGroup.add(side);
  });

  const sleeveColors = [0xc9a87c, 0x7b3f5e, 0xf7f3ec, 0x473060, 0xe5bb71, 0x9b5a4d, 0x352247];
  sleeveColors.forEach((col, idx) => {
    const sleeve = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.56, 0.56, 0.018)),
      trackMat(new THREE.MeshStandardMaterial({ color: col, roughness: 0.75 }))
    );
    sleeve.position.set(0, 0.32, -0.22 + idx * 0.068);
    sleeve.rotation.x = -0.14 + idx * 0.032;
    crateGroup.add(sleeve);
  });
  frontScene.add(crateGroup);

  // ---------------- ARCHITECTURAL "ON AIR" MARQUEE SIGN ----------------
  const onAirTex = trackTex(createOnAirSignTexture(maxAniso));
  const onAirGroup = new THREE.Group();
  onAirGroup.position.set(2.55, 3.82, -3.8);
  onAirGroup.scale.setScalar(1.0);

  const onAirHousing = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.18, 0.44, 0.14)), mDarkChrome);
  onAirGroup.add(onAirHousing);

  const onAirFrame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.22, 0.48, 0.08)), mBrushedBrass);
  onAirFrame.position.z = 0.01;
  onAirGroup.add(onAirFrame);

  const onAirFaceMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: onAirTex,
      emissiveMap: onAirTex,
      emissive: new THREE.Color(C.goldBright),
      emissiveIntensity: 0.12,
      roughness: 0.25,
    })
  );
  const onAirFace = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(1.08, 0.36)), onAirFaceMat);
  onAirFace.position.z = 0.075;
  onAirGroup.add(onAirFace);
  backScene.add(onAirGroup);

  // ---------------- TURNTABLES (DECK A & DECK B) ----------------
  const vinylBumpTex = trackTex(createVinylGrooveBumpTexture(maxAniso));
  const strobeTex = trackTex(createStrobeRimTexture(maxAniso));

  interface TurntableDeck {
    group: THREE.Group;
    platterGroup: THREE.Group;
    recordGroup: THREE.Group;
    tonearmGroup: THREE.Group;
    startLedMat: THREE.MeshStandardMaterial;
    labelCanvas: HTMLCanvasElement;
    labelTex: THREE.CanvasTexture;
    restY: number;
    armCueAngle: number;
  }

  function createTurntable(xPos: number): TurntableDeck {
    const group = new THREE.Group();
    group.position.set(xPos, TY, -0.26);

    // 4 brass isolation feet
    [
      [-0.56, -0.44],
      [0.56, -0.44],
      [-0.56, 0.44],
      [0.56, 0.44],
    ].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 0.035, 16)), mBrushedBrass);
      foot.position.set(fx, 0.018, fz);
      group.add(foot);
    });

    // Die-cast plinth chassis
    const plinth = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.38, 0.11, 1.1)), mDarkChrome);
    plinth.position.y = 0.085;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

    // Recessed deck well
    const well = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.54, 0.54, 0.02, 40)), mPlatterRubber);
    well.position.set(-0.08, 0.142, 0.02);
    group.add(well);

    // Spinning platter with strobe-dot rim
    const platterGroup = new THREE.Group();
    platterGroup.position.set(-0.08, 0.165, 0.02);

    const platterRimMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: strobeTex,
        roughness: 0.35,
        metalness: 0.72,
      })
    );
    const platterMatTop = mPlatterRubber;
    const platter = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.51, 0.525, 0.048, 48)),
      [platterRimMat, platterMatTop, platterMatTop]
    );
    platterGroup.add(platter);

    // Brass center spindle
    const spindle = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 12)), mBrushedBrass);
    spindle.position.y = 0.045;
    platterGroup.add(spindle);
    group.add(platterGroup);

    // Vinyl Record (separate group so it can drop smoothly onto the platter!)
    const recordGroup = new THREE.Group();
    const restY = 0.205;
    recordGroup.position.set(-0.08, restY, 0.02);

    const vinylMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: C.vinyl,
        bumpMap: vinylBumpTex,
        bumpScale: 0.014,
        roughness: 0.28,
        metalness: 0.1,
        clearcoat: 0.88,
        clearcoatRoughness: 0.16,
      })
    );
    const disc = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.475, 0.475, 0.016, 48)), vinylMat);
    disc.castShadow = true;
    recordGroup.add(disc);

    const { canvas: labelCanvas, texture: labelTex } = createRecordLabelTexture(maxAniso);
    trackTex(labelTex);
    const labelMesh = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.175, 0.175, 0.018, 36)),
      trackMat(new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.55 }))
    );
    labelMesh.position.y = 0.002;
    recordGroup.add(labelMesh);
    group.add(recordGroup);

    // Start/Stop button + illuminated LED ring
    const startBtn = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.11, 0.028, 0.09)), mDarkChrome);
    startBtn.position.set(-0.56, 0.148, 0.4);
    group.add(startBtn);

    const startLedMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x3b2a4d,
        emissive: new THREE.Color(C.live),
        emissiveIntensity: 0.1,
        roughness: 0.3,
      })
    );
    const startLed = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.06, 0.012, 0.02)), startLedMat);
    startLed.position.set(-0.56, 0.164, 0.38);
    group.add(startLed);

    // Pitch control slider on right side
    const pitchSlot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.04, 0.012, 0.34)), mPlatterRubber);
    pitchSlot.position.set(0.57, 0.145, 0.24);
    group.add(pitchSlot);

    const pitchKnob = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.065, 0.03, 0.055)), mBrushedBrass);
    pitchKnob.position.set(0.57, 0.16, 0.24);
    group.add(pitchKnob);

    // Articulated S-Shaped Tonearm assembly
    const tonearmPivotBase = new THREE.Group();
    tonearmPivotBase.position.set(0.5, 0.15, -0.34);

    const gimbalRing = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.085, 0.095, 0.05, 24)), mDarkChrome);
    tonearmPivotBase.add(gimbalRing);

    const gimbalCollar = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.048, 0.048, 0.09, 20)), mBrushedBrass);
    gimbalCollar.position.y = 0.06;
    tonearmPivotBase.add(gimbalCollar);

    const tonearmGroup = new THREE.Group();
    tonearmGroup.position.set(0, 0.1, 0);

    // S-curve tube from counterweight through gimbal to headshell
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, -0.14),
      new THREE.Vector3(0, 0.005, 0.06),
      new THREE.Vector3(-0.04, 0.005, 0.26),
      new THREE.Vector3(-0.14, -0.01, 0.44),
      new THREE.Vector3(-0.22, -0.025, 0.56),
    ]);
    const armTube = new THREE.Mesh(
      trackGeo(new THREE.TubeGeometry(armCurve, 28, 0.013, 10, false)),
      mBrushedBrass
    );
    tonearmGroup.add(armTube);

    // Counterweight cylinder
    const counterweight = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.036, 0.036, 0.065, 18)),
      mDarkChrome
    );
    counterweight.rotation.x = Math.PI / 2;
    counterweight.position.set(0, 0, -0.11);
    tonearmGroup.add(counterweight);

    // Headshell & cartridge
    const headshell = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.048, 0.022, 0.095)), mDarkChrome);
    headshell.position.set(-0.23, -0.028, 0.59);
    headshell.rotation.y = 0.42;
    tonearmGroup.add(headshell);

    const cartridge = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.032, 0.024, 0.045)), mBrushedBrass);
    cartridge.position.set(-0.235, -0.042, 0.6);
    cartridge.rotation.y = 0.42;
    tonearmGroup.add(cartridge);

    tonearmPivotBase.add(tonearmGroup);
    group.add(tonearmPivotBase);
    frontScene.add(group);

    return {
      group,
      platterGroup,
      recordGroup,
      tonearmGroup,
      startLedMat,
      labelCanvas,
      labelTex,
      restY,
      armCueAngle: 0.05,
    };
  }

  let activeTracks: Track[] = initialTracks.length > 0 ? initialTracks : [];
  const safeInitialIdx = Math.max(0, Math.min(initialTrack, Math.max(0, activeTracks.length - 1)));
  const deckA = createTurntable(-1.35);
  const deckB = createTurntable(1.35);
  if (activeTracks[0]) {
    drawRecordLabel(deckA.labelCanvas, deckA.labelTex, 1, activeTracks[0].slot, activeTracks[0].bpm);
  }
  if (activeTracks[1] || activeTracks[0]) {
    const bTrack = activeTracks[1] || activeTracks[0];
    drawRecordLabel(deckB.labelCanvas, deckB.labelTex, activeTracks[1] ? 2 : 1, bTrack.slot, bTrack.bpm);
  }

  // ---------------- CENTRAL 2-CHANNEL DJ MIXER ----------------
  const mixerGroup = new THREE.Group();
  mixerGroup.position.set(0, TY, -0.24);

  const mixerBody = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.32, 0.12, 1.06)), mDarkChrome);
  mixerBody.position.y = 0.06;
  mixerBody.castShadow = true;
  mixerBody.receiveShadow = true;
  mixerGroup.add(mixerBody);

  const faceplateTex = trackTex(createMixerFaceplateTexture(maxAniso));
  const faceplate = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.26, 1.0)),
    trackMat(new THREE.MeshStandardMaterial({ map: faceplateTex, roughness: 0.42, metalness: 0.45 }))
  );
  faceplate.rotation.x = -Math.PI / 2;
  faceplate.position.y = 0.122;
  mixerGroup.add(faceplate);

  // Knurled brass EQ & Gain knobs (3 rows x 2 channels)
  const knobGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.048, 0.052, 16));
  const knobCapGeo = trackGeo(new THREE.BoxGeometry(0.012, 0.012, 0.042));
  [-0.36, 0.36].forEach((kx) => {
    [-0.29, -0.13, 0.03].forEach((kz, rowIdx) => {
      const k = new THREE.Mesh(knobGeo, rowIdx === 0 ? mBrushedBrass : mDarkChrome);
      k.position.set(kx, 0.148, kz);
      mixerGroup.add(k);

      const cap = new THREE.Mesh(knobCapGeo, mBrushedBrass);
      cap.position.set(kx, 0.176, kz - 0.014);
      mixerGroup.add(cap);
    });
  });

  // Channel vertical volume faders
  [-0.22, 0.22].forEach((fx) => {
    const slot = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.024, 0.01, 0.24)), mPlatterRubber);
    slot.position.set(fx, 0.126, 0.18);
    mixerGroup.add(slot);

    const cap = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.07, 0.038, 0.045)), mBrushedBrass);
    cap.position.set(fx, 0.145, 0.12);
    mixerGroup.add(cap);
  });

  // Dual 10-segment LED VU Meter Towers in center of mixer
  const vuLeftMats: THREE.MeshStandardMaterial[] = [];
  const vuRightMats: THREE.MeshStandardMaterial[] = [];
  const ledGeo = trackGeo(new THREE.BoxGeometry(0.042, 0.012, 0.018));

  for (let seg = 0; seg < 10; seg++) {
    const ledColor = seg >= 8 ? 0xe85a3d : seg >= 6 ? 0xe5bb71 : 0x7fd1a6;
    const zPos = 0.08 - seg * 0.032;

    const lMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e1429,
        emissive: new THREE.Color(ledColor),
        emissiveIntensity: 0.05,
        roughness: 0.3,
      })
    );
    const lLed = new THREE.Mesh(ledGeo, lMat);
    lLed.position.set(-0.042, 0.13, zPos);
    mixerGroup.add(lLed);
    vuLeftMats.push(lMat);

    const rMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e1429,
        emissive: new THREE.Color(ledColor),
        emissiveIntensity: 0.05,
        roughness: 0.3,
      })
    );
    const rLed = new THREE.Mesh(ledGeo, rMat);
    rLed.position.set(0.042, 0.13, zPos);
    mixerGroup.add(rLed);
    vuRightMats.push(rMat);
  }

  // Horizontal Crossfader track & gliding brass fader
  const cfTrack = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.68, 0.014, 0.04)), mPlatterRubber);
  cfTrack.position.set(0, 0.126, 0.355);
  mixerGroup.add(cfTrack);

  const crossfaderMesh = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.075, 0.048, 0.11)),
    mBrushedBrass
  );
  crossfaderMesh.position.set(-0.28, 0.15, 0.355);
  mixerGroup.add(crossfaderMesh);

  // Angled OLED Track & BPM Display on rear bridge of mixer
  const { canvas: oledCanvas, texture: oledTex } = createDeckOledTexture(maxAniso);
  trackTex(oledTex);
  const initTrackObj = activeTracks[safeInitialIdx];
  if (initTrackObj) {
    drawDeckOled(
      oledCanvas,
      oledTex,
      safeInitialIdx + 1,
      initTrackObj.title,
      initTrackObj.bpm,
      initialPlaying
    );
  }
  const oledFrame = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.84, 0.04, 0.22)),
    mDarkChrome
  );
  oledFrame.position.set(0, 0.145, -0.42);
  oledFrame.rotation.x = 0.28;
  mixerGroup.add(oledFrame);

  const oledScreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: oledTex,
      emissiveMap: oledTex,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: initialPlaying ? 0.9 : 0.35,
      roughness: 0.2,
    })
  );
  const oledScreen = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(0.78, 0.19)), oledScreenMat);
  oledScreen.rotation.x = -Math.PI / 2 + 0.28;
  oledScreen.position.set(0, 0.167, -0.42);
  mixerGroup.add(oledScreen);

  frontScene.add(mixerGroup);

  // ---------------- STATE & ANIMATION LOOP ----------------
  let currentTrack = safeInitialIdx;
  let playing = initialPlaying;
  let reducedMotion = initialReduced;
  const settings: BoothSettings = { ...initialSettings };

  let yaw = settings.orbit;
  let pitch = 0.23;
  let pitchTarget = 0.23;
  let radius = settings.zoom;
  let nudgeYaw = 0;
  let nudgeZoom = 0;

  let crossfaderTarget = initialTrack % 2 === 0 ? -0.28 : 0.28;
  let dropAnim: { deck: TurntableDeck; startMs: number } | null = null;
  let rafId = 0;
  let isVisible = true;
  let lastNow = performance.now();
  let disposed = false;

  const backOutEase = (x: number): number =>
    1 + 2.70158 * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);

  function placeCamera(): void {
    const totalYaw = yaw + nudgeYaw;
    const totalRad = radius + nudgeZoom;
    camera.position.set(
      target.x + totalRad * Math.cos(pitch) * Math.sin(totalYaw),
      target.y + totalRad * Math.sin(pitch),
      target.z + totalRad * Math.cos(pitch) * Math.cos(totalYaw)
    );
    camera.lookAt(target);
  }

  function applyLighting(peakBoost = 0): void {
    const g = settings.glow;
    keyBack.intensity = 1.45 * g + peakBoost * 0.45;
    keyFront.intensity = 1.55 * g + peakBoost * 0.45;
    boothGlowBack.intensity = 20 * g + peakBoost * 9;
    boothGlowFront.intensity = 18 * g + peakBoost * 9;
    backScene.fog = new THREE.FogExp2(C.room, settings.haze);
    if (backScene.fog instanceof THREE.FogExp2) {
      backScene.fog.density = settings.haze;
    }
  }

  function updateMetersAndWoofers(bass: number, mid: number, high: number): void {
    const leftVal = playing ? Math.min(1, bass * 0.65 + mid * 0.45) : 0;
    const rightVal = playing ? Math.min(1, mid * 0.55 + high * 0.55) : 0;

    for (let i = 0; i < 10; i++) {
      const thresh = (i + 1) / 10;
      vuLeftMats[i].emissiveIntensity = leftVal >= thresh ? 2.1 : 0.06;
      vuRightMats[i].emissiveIntensity = rightVal >= thresh ? 2.1 : 0.06;
    }

    const excursion = playing ? bass * 0.024 : 0;
    woofers.forEach((w) => {
      w.position.z = 0.295 + excursion;
    });
  }

  function updateMarloweTransform(grooveY = 0, grooveTilt = 0): void {
    marloweMesh.position.set(
      hostFitState.x * 0.015,
      baseMarloweY + hostFitState.y * 0.015 + grooveY,
      -0.82
    );
    marloweMesh.scale.setScalar(hostFitState.scale);
    // Keep Marlowe horizontally facing the orbiting camera while anchored to center of console
    marloweMesh.rotation.y = Math.atan2(
      camera.position.x - marloweMesh.position.x,
      camera.position.z - marloweMesh.position.z
    );
    marloweMesh.rotation.z = grooveTilt;
  }

  function renderOnce(): void {
    if (disposed) return;
    placeCamera();
    updateMarloweTransform(0, 0);
    crossfaderMesh.position.x = crossfaderTarget;
    const activeDeck = currentTrack % 2 === 0 ? deckA : deckB;
    const idleDeck = currentTrack % 2 === 0 ? deckB : deckA;
    activeDeck.tonearmGroup.rotation.y = playing ? -0.34 : -0.05;
    idleDeck.tonearmGroup.rotation.y = 0.06;
    activeDeck.startLedMat.emissiveIntensity = playing ? 1.8 : 0.15;
    idleDeck.startLedMat.emissiveIntensity = 0.1;
    onAirFaceMat.emissiveIntensity = playing ? 1.65 : 0.14;
    onAirLight.intensity = playing ? 9.5 : 0;
    applyLighting(0);
    updateMetersAndWoofers(0.5, 0.4, 0.3);
    rBack.render(backScene, camera);
    rFront.render(frontScene, camera);
  }

  function afterDraw(cb: () => void): void {
    if (disposed) return;
    const gl = rFront.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === "function") {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          rafId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          rafId = window.setTimeout(cb, 80);
        }
      };
      rafId = window.setTimeout(poll, 5);
    } else {
      rafId = window.setTimeout(cb, 80);
    }
  }

  function tick(now: number): void {
    if (disposed) return;
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    const track = activeTracks[currentTrack] || activeTracks[0];
    const beatHz = (track ? track.bpm : 120) / 60;
    const timeSec = now / 1000;

    // Frame-rate independent exponential damping
    yaw = THREE.MathUtils.damp(yaw, settings.orbit, 6, dt);
    pitch = THREE.MathUtils.damp(pitch, pitchTarget, 6, dt);
    radius = THREE.MathUtils.damp(radius, settings.zoom, 5, dt);
    nudgeYaw = THREE.MathUtils.damp(nudgeYaw, 0, 3.5, dt);
    nudgeZoom = THREE.MathUtils.damp(nudgeZoom, 0, 3.5, dt);

    crossfaderMesh.position.x = THREE.MathUtils.damp(
      crossfaderMesh.position.x,
      crossfaderTarget,
      9,
      dt
    );

    const activeDeck = currentTrack % 2 === 0 ? deckA : deckB;
    const idleDeck = currentTrack % 2 === 0 ? deckB : deckA;

    const targetArmActive = playing ? -0.34 - ((Math.sin(timeSec * 0.4) + 1) * 0.02) : -0.06;
    activeDeck.tonearmGroup.rotation.y = THREE.MathUtils.damp(
      activeDeck.tonearmGroup.rotation.y,
      targetArmActive,
      7,
      dt
    );
    idleDeck.tonearmGroup.rotation.y = THREE.MathUtils.damp(
      idleDeck.tonearmGroup.rotation.y,
      0.06,
      7,
      dt
    );

    activeDeck.startLedMat.emissiveIntensity = playing ? 2.0 : 0.15;
    idleDeck.startLedMat.emissiveIntensity = 0.1;

    if (playing) {
      const spinStep = beatHz * Math.PI * 2 * dt * 0.21 * settings.spin;
      activeDeck.platterGroup.rotation.y -= spinStep;
      activeDeck.recordGroup.rotation.y -= spinStep;
      dustPoints.rotation.y += dt * 0.025;
    }

    const [bass, mid, high] = audioEngine.sampleLevels(timeSec);
    updateMetersAndWoofers(bass, mid, high);

    const peakPulse =
      playing && track?.slot === "PEAK" && settings.pulse
        ? Math.max(0, Math.sin(timeSec * beatHz * Math.PI * 2)) * 0.65 + bass * 0.35
        : playing
          ? bass * 0.18
          : 0;

    applyLighting(peakPulse);

    if (playing) {
      onAirFaceMat.emissiveIntensity = 1.45 + peakPulse * 0.75;
      onAirLight.intensity = 9.0 + peakPulse * 3.5;
      _tempColor.setHex(C.goldBright);
      haloSprite.material.color.copy(_tempColor);
    } else {
      onAirFaceMat.emissiveIntensity = 0.14;
      onAirLight.intensity = 0;
    }

    if (dropAnim) {
      const k = Math.min(1, (now - dropAnim.startMs) / 520);
      dropAnim.deck.recordGroup.position.y = dropAnim.deck.restY + 0.85 * (1 - backOutEase(k));
      if (k >= 1) {
        dropAnim.deck.recordGroup.position.y = dropAnim.deck.restY;
        dropAnim = null;
      }
    }

    placeCamera();
    const grooveY = playing ? Math.sin(timeSec * beatHz * Math.PI) * 0.016 : 0;
    const grooveTilt = playing ? Math.sin(timeSec * beatHz * Math.PI * 0.5) * 0.008 : 0;
    updateMarloweTransform(grooveY, grooveTilt);
    rBack.render(backScene, camera);
    rFront.render(frontScene, camera);

    if (isVisible && !document.hidden && !reducedMotion && !disposed) {
      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        rafId = requestAnimationFrame(tick);
      }
    } else {
      rafId = 0;
    }
  }

  function startLoop(): void {
    if (disposed || rafId || reducedMotion) return;
    lastNow = performance.now();
    if (isSoftwareGl) {
      rafId = requestAnimationFrame(tick);
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function stopLoop(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      clearTimeout(rafId);
      rafId = 0;
    }
  }

  function handleResize(): void {
    if (disposed) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    rBack.setSize(w, h, false);
    rFront.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reducedMotion) renderOnce();
  }

  const resizeObserver = new ResizeObserver(handleResize);
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      isVisible = entries[0]?.isIntersecting ?? true;
      if (isVisible) startLoop();
      else stopLoop();
    },
    { threshold: 0.05 }
  );
  intersectionObserver.observe(container);

  const onVisibilityChange = () => {
    if (document.hidden) stopLoop();
    else startLoop();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  const onLost = (e: Event) => {
    e.preventDefault();
    stopLoop();
    onContextLost?.();
  };
  frontCanvas.addEventListener("webglcontextlost", onLost);
  backCanvas.addEventListener("webglcontextlost", onLost);

  // Pre-warm shaders on hardware GPU
  if (!isSoftwareGl) {
    rBack.compile(backScene, camera);
    rFront.compile(frontScene, camera);
  }

  handleResize();
  renderOnce();
  if (!reducedMotion) {
    startLoop();
  }

  return {
    setTrack(index: number, animateDrop: boolean) {
      if (activeTracks.length === 0) return;
      const safeIdx = Math.max(0, Math.min(index, activeTracks.length - 1));
      currentTrack = safeIdx;
      const track = activeTracks[safeIdx];
      const deck = safeIdx % 2 === 0 ? deckA : deckB;
      drawRecordLabel(deck.labelCanvas, deck.labelTex, safeIdx + 1, track.slot, track.bpm);
      drawDeckOled(oledCanvas, oledTex, safeIdx + 1, track.title, track.bpm, playing);
      crossfaderTarget = safeIdx % 2 === 0 ? -0.28 : 0.28;

      if (animateDrop && !reducedMotion) {
        deck.recordGroup.position.y = deck.restY + 0.85;
        dropAnim = { deck, startMs: performance.now() };
        nudgeYaw = safeIdx % 2 === 0 ? -0.055 : 0.055;
        nudgeZoom = -0.32;
        startLoop();
      } else {
        deck.recordGroup.position.y = deck.restY;
        if (reducedMotion) renderOnce();
      }
    },
    setTracks(nextTracks: Track[], activeIndex: number) {
      activeTracks = nextTracks.length > 0 ? nextTracks : activeTracks;
      if (activeTracks.length === 0) return;
      const safeIdx = Math.max(0, Math.min(activeIndex, activeTracks.length - 1));
      currentTrack = safeIdx;
      const track = activeTracks[safeIdx];
      const activeDeck = safeIdx % 2 === 0 ? deckA : deckB;
      const idleDeck = safeIdx % 2 === 0 ? deckB : deckA;
      const nextIdleIdx = (safeIdx + 1) % activeTracks.length;
      const idleTrack = activeTracks[nextIdleIdx];
      drawRecordLabel(activeDeck.labelCanvas, activeDeck.labelTex, safeIdx + 1, track.slot, track.bpm);
      drawRecordLabel(idleDeck.labelCanvas, idleDeck.labelTex, nextIdleIdx + 1, idleTrack.slot, idleTrack.bpm);
      drawDeckOled(oledCanvas, oledTex, safeIdx + 1, track.title, track.bpm, playing);
      crossfaderTarget = safeIdx % 2 === 0 ? -0.28 : 0.28;
      if (reducedMotion) renderOnce();
    },
    setPlaying(nextPlaying: boolean) {
      playing = nextPlaying;
      const track = activeTracks[currentTrack] || activeTracks[0];
      if (track) {
        drawDeckOled(oledCanvas, oledTex, currentTrack + 1, track.title, track.bpm, nextPlaying);
      }
      oledScreenMat.emissiveIntensity = nextPlaying ? 0.9 : 0.35;
      if (reducedMotion) {
        renderOnce();
      } else {
        startLoop();
      }
    },
    setReducedMotion(reduced: boolean) {
      reducedMotion = reduced;
      if (reduced) {
        stopLoop();
        renderOnce();
      } else {
        startLoop();
      }
    },
    setHostPortrait(src: string, fit: BoothHostFit) {
      hostFitState = { ...fit };
      if (activeHostTex && marloweMat.map === activeHostTex && lastLoadedSrc === src) {
        if (reducedMotion) renderOnce();
        return;
      }
      lastLoadedSrc = src;
      loadHostTexture(src);
    },
    updateSettings(partial: Partial<BoothSettings>) {
      Object.assign(settings, partial);
      if (reducedMotion) renderOnce();
    },
    updateTheme(theme: BoothThemeColors) {
      const roomHex = new THREE.Color(theme.room).getHex();
      const brightColor = new THREE.Color(theme.accentBright);
      C.room = roomHex;
      C.goldBright = brightColor.getHex();
      rBack.setClearColor(roomHex, 1);
      mConsoleBody.color.set(theme.plum);
      mConsoleDark.color.set(theme.panel);
      mBrushedBrass.color.copy(brightColor);
      boothGlowBack.color.copy(brightColor);
      boothGlowFront.color.copy(brightColor);
      onAirLight.color.copy(brightColor);
      onAirFaceMat.emissive.copy(brightColor);
      shaftMat.color.copy(brightColor);
      if (dustPoints.material instanceof THREE.PointsMaterial) {
        dustPoints.material.color.copy(brightColor);
      }
      applyLighting(0);
      if (reducedMotion) renderOnce();
    },
    handlePointerDrag(dx: number, dy: number) {
      settings.orbit = Math.max(-0.45, Math.min(0.45, settings.orbit - dx * 0.0032));
      pitchTarget = Math.max(0.14, Math.min(0.44, pitchTarget + dy * 0.0016));
      if (reducedMotion) renderOnce();
      return { orbit: settings.orbit };
    },
    dispose() {
      disposed = true;
      stopLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      frontCanvas.removeEventListener("webglcontextlost", onLost);
      backCanvas.removeEventListener("webglcontextlost", onLost);
      if (activeHostTex) activeHostTex.dispose();
      disposables.forEach((d) => d.dispose());
      rBack.dispose();
      rFront.dispose();
    },
  };
}
