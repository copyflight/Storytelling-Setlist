import * as THREE from "three";

export function createRadialGlowTexture(
  innerRadius: number,
  innerColor: string,
  outerColor = "rgba(0,0,0,0)"
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(128, 128, innerRadius, 128, 128, 128);
  grad.addColorStop(0, innerColor);
  grad.addColorStop(0.55, innerColor.replace(/[\d.]+\)$/, "0.18)"));
  grad.addColorStop(1, outerColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createVinylGrooveBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  for (let r = 82; r < 248; r += 2) {
    const isTrackGap = r % 34 === 0 || r % 34 === 1;
    const val = isTrackGap ? 50 : 120 + Math.round(Math.sin(r * 1.7) * 55);
    ctx.strokeStyle = `rgb(${val},${val},${val})`;
    ctx.lineWidth = isTrackGap ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  // Linear data texture (NoColorSpace) for bump/roughness
  return tex;
}

export function createStrobeRimTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 64;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#191520";
  ctx.fillRect(0, 0, w, h);

  // Top & bottom machined aluminum bevel highlights
  ctx.fillStyle = "#534866";
  ctx.fillRect(0, 0, w, 6);
  ctx.fillRect(0, h - 6, w, 6);

  // Strobe dots across 4 rows (classic Technics-style pitch calibration dots)
  const dots = 72;
  for (let i = 0; i < dots; i++) {
    const x = (i / dots) * w + 5;
    ctx.fillStyle = "#e5bb71";
    ctx.beginPath();
    ctx.arc(x, h * 0.34, 3.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c9a87c";
    ctx.beginPath();
    ctx.arc(x, h * 0.56, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#9b7fc4";
    ctx.beginPath();
    ctx.arc(x, h * 0.74, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRecordLabelTexture(maxAnisotropy: number): {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return { canvas, texture };
}

export function drawRecordLabel(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  trackNumber: number,
  slot: string,
  bpm: number
): void {
  const ctx = canvas.getContext("2d")!;
  const s = 512;
  const cx = s / 2;
  const cy = s / 2;

  ctx.clearRect(0, 0, s, s);

  // Warm archival paper gradient per track slot
  const palettes: Record<string, [string, string, string]> = {
    OPENER: ["#d4b383", "#b8905c", "#21142f"],
    BUILD: ["#e5bb71", "#c9954c", "#1e1229"],
    PEAK: ["#f0b458", "#d97834", "#170d21"],
    B2B: ["#d7b57c", "#9b7fc4", "#1e1229"],
    COOLDOWN: ["#b89d86", "#7a618f", "#1e1229"],
    CLOSER: ["#e2c697", "#a07a52", "#170d21"],
  };
  const [c1, c2, ink] = palettes[slot] || palettes.OPENER;

  const grad = ctx.createRadialGradient(cx - 40, cy - 40, 20, cx, cy, 250);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, 248, 0, Math.PI * 2);
  ctx.fill();

  // Concentric archival rings
  ctx.strokeStyle = ink;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 206, 0, Math.PI * 2);
  ctx.stroke();

  // Upper typography
  ctx.fillStyle = ink;
  ctx.font = "700 26px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("COPYFLIGHT · 2026 SET", cx, 108);

  // Track number
  ctx.font = "900 164px 'Fraunces', Georgia, serif";
  ctx.fillText(String(trackNumber).padStart(2, "0"), cx, cy + 8);

  // Lower BPM & slot line
  ctx.font = "700 24px 'Space Mono', monospace";
  ctx.fillText(`${slot} · ${bpm} BPM`, cx, 404);

  // Center spindle cutout
  ctx.fillStyle = "#170d21";
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f7f3ec";
  ctx.lineWidth = 3;
  ctx.stroke();

  texture.needsUpdate = true;
}

export function createMixerFaceplateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Brushed dark plum anodized aluminum
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#2c1e3b");
  bg.addColorStop(0.5, "#231731");
  bg.addColorStop(1, "#1c1128");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal brushed metal lines
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Brass border trim & channel divider lines
  ctx.strokeStyle = "rgba(201,168,124,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, w - 24, h - 24);

  ctx.strokeStyle = "rgba(201,168,124,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(188, 28);
  ctx.lineTo(188, 355);
  ctx.moveTo(324, 28);
  ctx.lineTo(324, 355);
  ctx.stroke();

  // Channel headers
  ctx.fillStyle = "#e5bb71";
  ctx.font = "700 20px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("CH 1", 100, 44);
  ctx.fillText("MASTER", 256, 44);
  ctx.fillText("CH 2", 412, 44);

  // EQ knob ring tick marks (3 rows x 2 channels)
  const knobCols = [100, 412];
  const knobRows = [102, 184, 266];
  const eqLabels = ["HIGH", "MID", "LOW"];
  knobCols.forEach((kx) => {
    knobRows.forEach((ky, idx) => {
      for (let a = -2.2; a <= 2.2; a += 0.44) {
        const ang = a - Math.PI / 2;
        const r1 = 26;
        const r2 = 33;
        ctx.strokeStyle = Math.abs(a) < 0.1 ? "#e5bb71" : "rgba(247,243,236,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(kx + Math.cos(ang) * r1, ky + Math.sin(ang) * r1);
        ctx.lineTo(kx + Math.cos(ang) * r2, ky + Math.sin(ang) * r2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(201,168,124,0.75)";
      ctx.font = "700 13px 'Space Mono', monospace";
      ctx.fillText(eqLabels[idx], kx, ky + 48);
    });
  });

  // Crossfader tick scale at bottom
  ctx.fillStyle = "#c9a87c";
  ctx.font = "700 14px 'Space Mono', monospace";
  ctx.fillText("A", 110, 434);
  ctx.fillText("CROSSFADER", 256, 398);
  ctx.fillText("B", 402, 434);
  for (let x = 136; x <= 376; x += 24) {
    ctx.strokeStyle = x === 256 ? "#e5bb71" : "rgba(247,243,236,0.35)";
    ctx.lineWidth = x === 256 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, 412);
    ctx.lineTo(x, 452);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createOnAirSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 192;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#190f24";
  ctx.fillRect(0, 0, w, h);

  // Inner warm glow frame
  ctx.strokeStyle = "#e5bb71";
  ctx.lineWidth = 8;
  ctx.strokeRect(14, 14, w - 28, h - 28);

  ctx.fillStyle = "#f7f3ec";
  ctx.font = "700 84px 'Space Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ON AIR", w / 2, h / 2 + 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAcousticWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1b1026";
  ctx.fillRect(0, 0, w, h);

  // Vertical architectural acoustic slats with warm wood/plum depth
  const slatW = 32;
  for (let x = 0; x < w; x += slatW) {
    const grad = ctx.createLinearGradient(x, 0, x + slatW, 0);
    grad.addColorStop(0, "#120a1a");
    grad.addColorStop(0.22, "#2f1e42");
    grad.addColorStop(0.65, "#261736");
    grad.addColorStop(1, "#120a1a");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, slatW - 4, h);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createWoodFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#1a1024";
  ctx.fillRect(0, 0, size, size);

  const plankH = 64;
  for (let row = 0; row < size / plankH; row++) {
    const y = row * plankH;
    const offset = (row % 2) * 128;
    for (let col = -1; col < 3; col++) {
      const x = col * 256 + offset;
      const shade = 24 + ((row * 7 + col * 13) % 10);
      ctx.fillStyle = `rgb(${shade + 8}, ${shade - 4}, ${shade + 18})`;
      ctx.fillRect(x + 2, y + 2, 252, plankH - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createDeckOledTexture(maxAnisotropy: number): {
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
} {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return { canvas, texture };
}

export function drawDeckOled(
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  trackNumber: number,
  title: string,
  bpm: number,
  playing: boolean
): void {
  const ctx = canvas.getContext("2d")!;
  const w = 512;
  const h = 128;

  ctx.fillStyle = "#110a1a";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = playing ? "#e5bb71" : "rgba(201,168,124,0.45)";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  const deckLabel = trackNumber % 2 === 1 ? "DECK A" : "DECK B";
  const num = String(trackNumber).padStart(2, "0");

  ctx.fillStyle = playing ? "#7fd1a6" : "#c9a87c";
  ctx.font = "700 24px 'Space Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${playing ? "PLAY" : "CUE"} · ${deckLabel} · ${num}`, 22, 38);

  ctx.fillStyle = "#e5bb71";
  ctx.textAlign = "right";
  ctx.fillText(`${bpm} BPM`, w - 22, 38);

  ctx.fillStyle = "#f7f3ec";
  ctx.font = "700 28px 'Atkinson Hyperlegible', sans-serif";
  ctx.textAlign = "left";
  let displayTitle = title;
  while (ctx.measureText(displayTitle).width > w - 48 && displayTitle.length > 4) {
    displayTitle = displayTitle.slice(0, -2) + "…";
  }
  ctx.fillText(displayTitle, 22, 88);

  texture.needsUpdate = true;
}
