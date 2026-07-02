import * as THREE from "three";

/**
 * Deterministic, dependency-free Earth-like textures generated on an
 * off-DOM <canvas>. Avoids shipping/fetching real satellite imagery for a
 * ~4s decorative login transition — diffuse/bump/roughness/clouds are all
 * derived from the same procedural landmass mask so they stay consistent.
 */

type EarthTextureSet = {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  cloudsAlphaMap: THREE.CanvasTexture;
};

const textureCache = new Map<number, EarthTextureSet>();

function mulberry32(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext("2d")! };
}

/** Radial soft blob, mirrored across the horizontal edges so the map tiles seamlessly. */
function drawWrappedBlob(
  ctx: CanvasRenderingContext2D,
  width: number,
  cx: number,
  cy: number,
  r: number,
  alpha = 0.9
) {
  const xs = [cx];
  if (cx - r < 0) xs.push(cx + width);
  if (cx + r > width) xs.push(cx - width);

  for (const x of xs) {
    const gradient = ctx.createRadialGradient(x, cy, 0, x, cy, r);
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function buildLandmassMask(width: number, height: number, rand: () => number) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const continents = 16;
  for (let i = 0; i < continents; i++) {
    const cx = rand() * width;
    const cy = height * 0.18 + rand() * height * 0.64;
    const baseR = width * (0.05 + rand() * 0.09);

    const blobCount = 5 + Math.floor(rand() * 4);
    for (let b = 0; b < blobCount; b++) {
      const angle = rand() * Math.PI * 2;
      const dist = rand() * baseR * 0.6;
      const bx = cx + Math.cos(angle) * dist;
      const by = cy + Math.sin(angle) * dist;
      const br = baseR * (0.45 + rand() * 0.65);
      drawWrappedBlob(ctx, width, bx, by, br);
    }
  }

  // fine speckle for terrain micro-detail
  for (let i = 0; i < 4000; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 0.6 + rand() * 1.6;
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function buildDiffuseMap(width: number, height: number, landMask: HTMLCanvasElement) {
  const { canvas, ctx } = makeCanvas(width, height);

  const ocean = ctx.createLinearGradient(0, 0, 0, height);
  ocean.addColorStop(0, "#062544");
  ocean.addColorStop(0.5, "#0d5f96");
  ocean.addColorStop(1, "#062544");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  const { canvas: landLayer, ctx: lctx } = makeCanvas(width, height);
  const landGradient = lctx.createLinearGradient(0, 0, 0, height);
  landGradient.addColorStop(0, "#f2f6ea");
  landGradient.addColorStop(0.15, "#7fae55");
  landGradient.addColorStop(0.45, "#3f7a41");
  landGradient.addColorStop(0.7, "#8a7a4a");
  landGradient.addColorStop(0.85, "#6b8f4e");
  landGradient.addColorStop(1, "#f2f6ea");
  lctx.fillStyle = landGradient;
  lctx.fillRect(0, 0, width, height);
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(landMask, 0, 0);

  ctx.drawImage(landLayer, 0, 0);

  const iceTop = ctx.createLinearGradient(0, 0, 0, height * 0.12);
  iceTop.addColorStop(0, "rgba(255,255,255,0.95)");
  iceTop.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = iceTop;
  ctx.fillRect(0, 0, width, height * 0.12);

  const iceBottom = ctx.createLinearGradient(0, height * 0.88, 0, height);
  iceBottom.addColorStop(0, "rgba(255,255,255,0)");
  iceBottom.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = iceBottom;
  ctx.fillRect(0, height * 0.88, width, height * 0.12);

  return canvas;
}

/** Soft wispy cloud coverage, brightest near the equator/mid-latitudes like real satellite imagery. */
function buildCloudMask(width: number, height: number, rand: () => number) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  const bands = 26;
  for (let i = 0; i < bands; i++) {
    const cx = rand() * width;
    const cy = height * 0.1 + rand() * height * 0.8;
    const baseR = width * (0.035 + rand() * 0.07);
    const wisps = 4 + Math.floor(rand() * 5);

    for (let w = 0; w < wisps; w++) {
      const angle = rand() * Math.PI * 2;
      const dist = rand() * baseR * 0.9;
      const bx = cx + Math.cos(angle) * dist;
      const by = cy + Math.sin(angle) * dist * 0.5;
      const br = baseR * (0.4 + rand() * 0.75);
      drawWrappedBlob(ctx, width, bx, by, br, 0.5 + rand() * 0.3);
    }
  }

  return canvas;
}

function buildBumpMap(width: number, height: number, landMask: HTMLCanvasElement) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(landMask, 0, 0);
  return canvas;
}

function buildRoughnessMap(width: number, height: number, landMask: HTMLCanvasElement) {
  const { canvas, ctx } = makeCanvas(width, height);
  ctx.fillStyle = "#2b3a44"; // smooth/reflective base = ocean
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 0.75; // brighter where land = rougher terrain
  ctx.drawImage(landMask, 0, 0);
  return canvas;
}

export function createEarthTextureSet(seed = 7): EarthTextureSet {
  const cached = textureCache.get(seed);
  if (cached) return cached;

  const width = 1024;
  const height = 512;
  const rand = mulberry32(seed);

  const landMask = buildLandmassMask(width, height, rand);

  const map = new THREE.CanvasTexture(buildDiffuseMap(width, height, landMask));
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const bumpMap = new THREE.CanvasTexture(buildBumpMap(width, height, landMask));
  bumpMap.wrapS = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(buildRoughnessMap(width, height, landMask));
  roughnessMap.wrapS = THREE.RepeatWrapping;

  const cloudsAlphaMap = new THREE.CanvasTexture(buildCloudMask(width, height, rand));
  cloudsAlphaMap.wrapS = THREE.RepeatWrapping;

  const set: EarthTextureSet = { map, bumpMap, roughnessMap, cloudsAlphaMap };
  textureCache.set(seed, set);
  return set;
}
