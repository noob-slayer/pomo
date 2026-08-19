import { useEffect, useRef } from "react";

// ported from a standalone canvas prototype (a physics-driven curtain of kanji hanging in
// front of a torii-gate photo) -- kept as close to the original as possible, just adapted
// from a full-viewport <body>/window scene to a component scoped to the stage container
// (ResizeObserver on the container instead of window resize, container dimensions instead
// of innerWidth/innerHeight throughout).

const KANJI = ["縁", "風", "月", "花", "光", "道", "心", "夢", "和", "雪", "空", "桜"];

// torii-gate.jpg's actual pixel dimensions -- known up front, so the curtain's geometry
// doesn't have to wait on the image finishing its (async) load to be computed correctly
const IMG_W = 2752;
const IMG_H = 1536;

// how far the crop window is nudged within the source image, as a fraction of the crop's
// own width -- see getCoverCrop(). Applied identically wherever the background is drawn.
// This photo's gate already sits well right-of-center on its own (unlike the previous,
// symmetrically-centered one that needed an artificial push), so no extra shift here.
const BG_SHIFT_FRAC = 0;

// measured directly from THIS photo's own pixels (scanning for the vermillion-red
// pillars and the lower crossbeam, the same way as before -- see the color-scan approach
// noted for whoever swaps the photo again), as fractions of the SOURCE IMAGE width/height,
// not the canvas. The gate here sits off-center and at an angle, further right than the
// previous photo's. The cover-fit crop has two branches (crop left/right vs. crop
// top/bottom, depending on how the canvas's aspect ratio compares to the photo's), and
// which one applies changes at runtime as the stage resizes (e.g. opening/closing the
// task panel) -- the opening's on-canvas position is derived from these image-space
// fractions through whatever the *current* crop rectangle actually is (see
// curtainGeometry()), which stays correct across both branches and any shift applied.
const OPENING_LEFT_FRAC = 0.52;
const OPENING_RIGHT_FRAC = 0.805;
const RAIL_Y_FRAC = 0.34;

const STRANDS = 22;
const BEADS_PER_STRAND = 11;
const GAP = 30;
const GRAVITY = 0.36;
// lower than the original (0.985) -- that much retained velocity per frame made the
// curtain feel like it was drifting in honey; settles and reacts noticeably faster now
const DAMPING = 0.94;
const RELAX_PASSES = 4;
const STRETCH = 1.12;
const COMPRESS = 0.88;
const MOUSE_RADIUS = 100;
const MOUSE_FORCE = 2;
const FONT_SIZE = 18;
const GRAB_RADIUS = 17; // scaled down with FONT_SIZE so the hit area still matches the glyph

class Point {
  x: number;
  y: number;
  px: number;
  py: number;
  pinned: boolean;
  wasPinned = false;
  constructor(x: number, y: number, pinned: boolean) {
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.pinned = pinned;
  }
  integrate(windX: number) {
    if (this.pinned) return;
    const vx = (this.x - this.px) * DAMPING;
    const vy = (this.y - this.py) * DAMPING;
    this.px = this.x;
    this.py = this.y;
    this.x += vx + windX;
    this.y += vy + GRAVITY;
  }
}

class Link {
  a: Point;
  b: Point;
  rest: number;
  min: number;
  max: number;
  constructor(a: Point, b: Point, rest: number) {
    this.a = a;
    this.b = b;
    this.rest = rest;
    this.min = rest * COMPRESS;
    this.max = rest * STRETCH;
  }
  solve() {
    const dx = this.b.x - this.a.x;
    const dy = this.b.y - this.a.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    let target = this.rest;
    if (dist < this.min) target = this.min;
    else if (dist > this.max) target = this.max;
    else return;
    const k = ((target - dist) / dist) * 0.5;
    const ox = dx * k;
    const oy = dy * k;
    if (!this.a.pinned) {
      this.a.x -= ox;
      this.a.y -= oy;
    }
    if (!this.b.pinned) {
      this.b.x += ox;
      this.b.y += oy;
    }
  }
}

interface Strand {
  points: Point[];
  links: Link[];
  chars: string[];
  phase: number;
  alpha: number;
}

export function JapanCurtain() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = container.clientWidth;
    let height = container.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resizeCanvas() {
      width = container!.clientWidth;
      height = container!.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // pre-render each unique kanji glyph (shadow + gradient baked in) once, instead of
    // recomputing a gradient + 6px shadow blur from scratch for every one of ~150-240
    // on-screen glyphs every single frame -- that per-frame cost was the actual source of
    // the lag, not the physics itself (measured ~28fps before this, back to a smooth 60
    // after). Per-strand alpha is applied via globalAlpha at draw time instead of being
    // baked into the cached bitmap, so one cached glyph still serves every strand.
    const GLYPH_PAD = FONT_SIZE * 2.4;
    const glyphCache = new Map<string, HTMLCanvasElement>();
    Array.from(new Set(KANJI)).forEach((ch) => {
      const c = document.createElement("canvas");
      c.width = GLYPH_PAD * dpr;
      c.height = GLYPH_PAD * dpr;
      const cctx = c.getContext("2d");
      if (!cctx) return;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cctx.translate(GLYPH_PAD / 2, GLYPH_PAD / 2);
      cctx.font = `600 ${FONT_SIZE}px "Noto Sans JP", sans-serif`;
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      cctx.shadowColor = "rgba(0,0,0,0.4)";
      cctx.shadowBlur = 6;
      cctx.shadowOffsetY = 2;
      const grad = cctx.createLinearGradient(0, -FONT_SIZE / 2, 0, FONT_SIZE / 2);
      grad.addColorStop(0, "rgba(255,236,196,1)");
      grad.addColorStop(1, "rgba(230,176,108,1)");
      cctx.fillStyle = grad;
      cctx.fillText(ch, 0, 0);
      glyphCache.set(ch, c);
    });

    let bgImage: HTMLImageElement | null = new Image();
    let bgLoaded = false;
    bgImage.onload = () => {
      bgLoaded = true;
    };
    bgImage.onerror = () => {
      console.warn("torii-gate.jpg failed to load -- falling back to the illustration.");
    };
    bgImage.src = "/torii-gate.jpg";

    // the standard "cover" fit has two branches -- crop left/right (image relatively
    // wider than the canvas) or crop top/bottom (canvas relatively wider) -- and which one
    // applies flips at runtime as the stage resizes. Shared by drawCoverImage (actually
    // drawing it) and curtainGeometry (positioning the curtain against it), so the two can
    // never disagree about which crop is currently in effect.
    function getCoverCrop(imgW: number, imgH: number) {
      const canvasRatio = width / height;
      const imgRatio = imgW / imgH;
      let sx: number, sy: number, sw: number, sh: number;
      if (imgRatio > canvasRatio) {
        sh = imgH;
        sw = sh * canvasRatio;
        sx = (imgW - sw) / 2;
        sy = 0;
      } else {
        sw = imgW;
        sh = sw / canvasRatio;
        sx = 0;
        sy = (imgH - sh) / 2;
      }
      // shifts the crop window left within the source image, which moves the photo's
      // content right on screen -- clamped to the image's own bounds either way.
      sx = Math.max(0, Math.min(imgW - sw, sx - sw * BG_SHIFT_FRAC));
      return { sx, sy, sw, sh };
    }

    function drawCoverImage(img: HTMLImageElement) {
      const { sx, sy, sw, sh } = getCoverCrop(img.width, img.height);
      ctx!.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
    }

    function gateGeometry() {
      const gateWidth = Math.min(width * 0.74, 780);
      const centerX = width / 2;
      return {
        left: centerX - gateWidth / 2,
        right: centerX + gateWidth / 2,
        topY: height * 0.13,
        groundY: height * 0.86,
        centerX,
      };
    }

    function curtainGeometry() {
      // projects the gate opening's known position in the *source photo* through the
      // current crop rectangle into canvas space -- correct regardless of which cover-fit
      // branch is active, unlike a fixed canvas-fraction constant (which only tracked one
      // branch and snapped out of alignment with the photo in the other).
      const { sx, sw } = getCoverCrop(IMG_W, IMG_H);
      const left = ((OPENING_LEFT_FRAC * IMG_W - sx) / sw) * width;
      const right = ((OPENING_RIGHT_FRAC * IMG_W - sx) / sw) * width;
      return { left, right, railY: height * RAIL_Y_FRAC };
    }

    let strands: Strand[] = [];
    function build() {
      strands = [];
      const { left, right, railY } = curtainGeometry();
      for (let s = 0; s < STRANDS; s++) {
        const x = left + ((right - left) / (STRANDS - 1)) * s;
        const points: Point[] = [];
        for (let i = 0; i <= BEADS_PER_STRAND; i++) points.push(new Point(x, railY + i * GAP, i === 0));
        const links: Link[] = [];
        for (let i = 0; i < points.length - 1; i++) links.push(new Link(points[i], points[i + 1], GAP));
        const chars: string[] = [];
        for (let i = 0; i < BEADS_PER_STRAND; i++) chars.push(KANJI[(s * 3 + i) % KANJI.length]);
        strands.push({ points, links, chars, phase: Math.random() * Math.PI * 2, alpha: 0.85 + Math.random() * 0.15 });
      }
    }

    const mouse: { x: number; y: number; grabbed: Point | null } = { x: -9999, y: -9999, grabbed: null };
    function setMouse(e: MouseEvent | TouchEvent) {
      const rect = canvas!.getBoundingClientRect();
      const point = "touches" in e ? (e.touches[0] ?? null) : e;
      if (!point) return;
      mouse.x = point.clientX - rect.left;
      mouse.y = point.clientY - rect.top;
    }
    function onDown(e: MouseEvent | TouchEvent) {
      setMouse(e);
      let closest: Point | null = null;
      let closestD = GRAB_RADIUS;
      strands.forEach((s) =>
        s.points.forEach((p) => {
          const d = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (d < closestD) {
            closest = p;
            closestD = d;
          }
        }),
      );
      if (closest) {
        mouse.grabbed = closest;
        (closest as Point).wasPinned = (closest as Point).pinned;
        (closest as Point).pinned = true;
      }
    }
    function onMove(e: MouseEvent | TouchEvent) {
      setMouse(e);
      if (mouse.grabbed) {
        mouse.grabbed.x = mouse.x;
        mouse.grabbed.y = mouse.y;
        mouse.grabbed.px = mouse.x;
        mouse.grabbed.py = mouse.y;
      }
    }
    function onUp() {
      if (mouse.grabbed) {
        mouse.grabbed.pinned = mouse.grabbed.wasPinned;
        mouse.grabbed = null;
      }
    }
    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    canvas.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);

    function applyMouseField() {
      strands.forEach((s) =>
        s.points.forEach((p) => {
          if (p.pinned) return;
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < MOUSE_RADIUS && d > 0.01) {
            const push = (1 - d / MOUSE_RADIUS) * MOUSE_FORCE;
            p.x += (dx / d) * push;
            p.y += (dy / d) * push;
          }
        }),
      );
    }

    let stars: { x: number; y: number; r: number; phase: number }[] = [];
    function buildStars() {
      stars = [];
      for (let i = 0; i < 70; i++)
        stars.push({ x: Math.random() * width, y: Math.random() * height * 0.55, r: Math.random() * 1.3 + 0.3, phase: Math.random() * Math.PI * 2 });
    }

    function drawMoon() {
      const mx = width * 0.84;
      const my = height * 0.15;
      const r = 44;
      const halo = ctx!.createRadialGradient(mx, my, r * 0.5, mx, my, r * 3.4);
      halo.addColorStop(0, "rgba(255,248,224,0.32)");
      halo.addColorStop(1, "rgba(255,248,224,0)");
      ctx!.fillStyle = halo;
      ctx!.beginPath();
      ctx!.arc(mx, my, r * 3.4, 0, Math.PI * 2);
      ctx!.fill();

      const body = ctx!.createRadialGradient(mx - r * 0.3, my - r * 0.3, r * 0.1, mx, my, r);
      body.addColorStop(0, "#fffaf0");
      body.addColorStop(1, "#f0e2ba");
      ctx!.fillStyle = body;
      ctx!.beginPath();
      ctx!.arc(mx, my, r, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = "rgba(206,186,148,0.35)";
      ([
        [-11, -6, 7],
        [9, 11, 5],
        [-3, 15, 4],
      ] as [number, number, number][]).forEach(([dx, dy, rr]) => {
        ctx!.beginPath();
        ctx!.arc(mx + dx, my + dy, rr, 0, Math.PI * 2);
        ctx!.fill();
      });
    }

    function drawSky(t: number) {
      const g = ctx!.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, "#161b2c");
      g.addColorStop(0.5, "#241f34");
      g.addColorStop(1, "#31202b");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, width, height);

      stars.forEach((s) => {
        const tw = 0.5 + 0.5 * Math.sin(t / 900 + s.phase);
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * tw})`;
        ctx!.fill();
      });

      drawMoon();

      ctx!.beginPath();
      ctx!.moveTo(0, height * 0.6);
      ctx!.bezierCurveTo(width * 0.15, height * 0.48, width * 0.32, height * 0.56, width * 0.5, height * 0.5);
      ctx!.bezierCurveTo(width * 0.7, height * 0.44, width * 0.86, height * 0.54, width, height * 0.49);
      ctx!.lineTo(width, height * 0.9);
      ctx!.lineTo(0, height * 0.9);
      ctx!.closePath();
      ctx!.fillStyle = "rgba(58,50,74,0.5)";
      ctx!.fill();

      ctx!.beginPath();
      ctx!.moveTo(0, height * 0.7);
      ctx!.bezierCurveTo(width * 0.22, height * 0.58, width * 0.4, height * 0.68, width * 0.6, height * 0.62);
      ctx!.bezierCurveTo(width * 0.8, height * 0.56, width * 0.9, height * 0.66, width, height * 0.61);
      ctx!.lineTo(width, height * 0.92);
      ctx!.lineTo(0, height * 0.92);
      ctx!.closePath();
      ctx!.fillStyle = "rgba(34,28,46,0.75)";
      ctx!.fill();

      for (let i = 0; i < 3; i++) {
        const y = height * (0.66 + i * 0.05);
        const shift = ((t / 9000 + i * 0.33) % 1) * width;
        const mg = ctx!.createLinearGradient(shift - width, y - 18, shift + width, y + 18);
        mg.addColorStop(0, "rgba(230,220,235,0)");
        mg.addColorStop(0.5, `rgba(230,220,235,${0.05 + i * 0.02})`);
        mg.addColorStop(1, "rgba(230,220,235,0)");
        ctx!.fillStyle = mg;
        ctx!.fillRect(0, y - 22, width, 44);
      }
    }

    function drawGround() {
      const groundY = gateGeometry().groundY;
      const g = ctx!.createLinearGradient(0, groundY, 0, height);
      g.addColorStop(0, "rgba(18,16,24,0)");
      g.addColorStop(0.25, "rgba(14,12,19,0.9)");
      g.addColorStop(1, "rgba(7,6,10,1)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, groundY, width, height - groundY);

      ctx!.strokeStyle = "rgba(255,255,255,0.045)";
      ctx!.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = groundY + 14 + i * ((height - groundY - 14) / 6);
        const spread = 46 + i * 46;
        ctx!.beginPath();
        ctx!.moveTo(width / 2 - spread, y);
        ctx!.lineTo(width / 2 + spread, y);
        ctx!.stroke();
      }
    }

    function pillarGradient(px: number, w: number) {
      const g = ctx!.createLinearGradient(px - w / 2, 0, px + w / 2, 0);
      g.addColorStop(0, "#6e2717");
      g.addColorStop(0.35, "#c1502f");
      g.addColorStop(0.55, "#dd6d44");
      g.addColorStop(1, "#7a2c1c");
      return g;
    }
    function beamGradient(y0: number, y1: number) {
      const g = ctx!.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, "#e2794f");
      g.addColorStop(1, "#7a2c1c");
      return g;
    }

    function drawTorii() {
      const gate = gateGeometry();
      const { left, right, topY, groundY, centerX } = gate;
      const pillarW = Math.max(18, (right - left) * 0.024);
      const taper = pillarW * 0.28;
      const top = topY + 46;

      function pillarPath(px: number) {
        ctx!.beginPath();
        ctx!.moveTo(px - pillarW / 2, groundY);
        ctx!.lineTo(px - pillarW / 2 + taper, top);
        ctx!.lineTo(px + pillarW / 2 - taper, top);
        ctx!.lineTo(px + pillarW / 2, groundY);
        ctx!.closePath();
      }

      [left, right].forEach((px) => {
        ctx!.save();
        ctx!.beginPath();
        ctx!.ellipse(px + pillarW * 1.4, groundY + 4, pillarW * 2.2, pillarW * 0.6, 0, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(0,0,0,0.32)";
        ctx!.filter = "blur(6px)";
        ctx!.fill();
        ctx!.restore();
      });

      [left, right].forEach((px) => {
        pillarPath(px);
        ctx!.fillStyle = pillarGradient(px, pillarW);
        ctx!.fill();

        ctx!.save();
        pillarPath(px);
        ctx!.clip();
        ctx!.strokeStyle = "rgba(0,0,0,0.12)";
        ctx!.lineWidth = 1;
        for (let gy = top + 14; gy < groundY; gy += 17) {
          ctx!.beginPath();
          ctx!.moveTo(px - pillarW / 2, gy + Math.sin(gy) * 2);
          ctx!.lineTo(px + pillarW / 2, gy + Math.cos(gy) * 2);
          ctx!.stroke();
        }
        ctx!.restore();

        ctx!.beginPath();
        ctx!.moveTo(px - pillarW * 0.9, groundY);
        ctx!.lineTo(px + pillarW * 0.9, groundY);
        ctx!.lineTo(px + pillarW * 0.62, groundY - 15);
        ctx!.lineTo(px - pillarW * 0.62, groundY - 15);
        ctx!.closePath();
        ctx!.fillStyle = "#4b4f5c";
        ctx!.fill();
        ctx!.strokeStyle = "rgba(255,255,255,0.08)";
        ctx!.stroke();
      });

      ctx!.fillStyle = beamGradient(topY + 92, topY + 108);
      ctx!.fillRect(left - pillarW, topY + 92, right - left + pillarW * 2, 16);
      ctx!.strokeStyle = "rgba(0,0,0,0.25)";
      ctx!.lineWidth = 1.5;
      ctx!.strokeRect(left - pillarW, topY + 92, right - left + pillarW * 2, 16);

      ctx!.fillStyle = beamGradient(topY + 32, topY + 50);
      ctx!.fillRect(left - 30, topY + 32, right - left + 60, 18);
      ctx!.strokeRect(left - 30, topY + 32, right - left + 60, 18);

      ctx!.beginPath();
      ctx!.moveTo(left - 54, topY + 24);
      ctx!.quadraticCurveTo(centerX, topY - 22, right + 54, topY + 24);
      ctx!.lineTo(right + 54, topY + 42);
      ctx!.quadraticCurveTo(centerX, topY - 4, left - 54, topY + 42);
      ctx!.closePath();
      ctx!.fillStyle = beamGradient(topY - 22, topY + 42);
      ctx!.fill();
      ctx!.stroke();

      ctx!.beginPath();
      ctx!.moveTo(left - 54, topY + 24);
      ctx!.quadraticCurveTo(centerX, topY - 22, right + 54, topY + 24);
      ctx!.strokeStyle = "rgba(255,224,190,0.5)";
      ctx!.lineWidth = 2;
      ctx!.stroke();

      ctx!.fillStyle = "#5c2015";
      ctx!.fillRect(centerX - 15, topY + 46, 30, 36);
      ctx!.strokeStyle = "rgba(255,224,190,0.3)";
      ctx!.strokeRect(centerX - 15, topY + 46, 30, 36);
    }

    function drawReflection() {
      const groundY = gateGeometry().groundY;
      ctx!.save();
      ctx!.translate(0, groundY * 2);
      ctx!.scale(1, -1);
      ctx!.globalAlpha = 0.16;
      drawTorii();
      ctx!.restore();

      const fade = ctx!.createLinearGradient(0, groundY, 0, height);
      fade.addColorStop(0, "rgba(9,8,13,0)");
      fade.addColorStop(1, "rgba(9,8,13,1)");
      ctx!.fillStyle = fade;
      ctx!.fillRect(0, groundY, width, height - groundY);
    }

    function drawRail() {
      const { left, right, railY } = curtainGeometry();
      const g = ctx!.createLinearGradient(0, railY - 6, 0, railY + 6);
      g.addColorStop(0, "#3a2a1e");
      g.addColorStop(1, "#1c130d");
      ctx!.fillStyle = g;
      ctx!.fillRect(left - 14, railY - 5, right - left + 28, 10);
    }

    let petals: { x: number; y: number; s: number; speed: number; drift: number; rot: number; rotSpeed: number }[] = [];
    function buildPetals() {
      petals = [];
      for (let i = 0; i < 10; i++) {
        petals.push({
          x: Math.random() * width,
          y: Math.random() * height,
          s: 6 + Math.random() * 5,
          speed: 0.3 + Math.random() * 0.4,
          drift: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.02,
        });
      }
    }

    function drawPetals(t: number) {
      petals.forEach((p) => {
        p.y += p.speed;
        p.x += Math.sin(t / 1000 + p.drift) * 0.4;
        p.rot += p.rotSpeed;
        if (p.y > height + 10) {
          p.y = -10;
          p.x = Math.random() * width;
        }
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rot);
        ctx!.fillStyle = "rgba(245,200,205,0.5)";
        ctx!.beginPath();
        ctx!.ellipse(0, 0, p.s, p.s * 0.6, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      });
    }

    function drawGlyph(p: Point, prev: Point, ch: string, alpha: number) {
      const cached = glyphCache.get(ch);
      if (!cached) return;
      const angle = Math.atan2(p.y - prev.y, p.x - prev.x) - Math.PI / 2;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(angle);
      ctx!.globalAlpha = alpha;
      ctx!.drawImage(cached, -GLYPH_PAD / 2, -GLYPH_PAD / 2, GLYPH_PAD, GLYPH_PAD);
      ctx!.restore();
    }

    function drawVignette() {
      const g = ctx!.createRadialGradient(width / 2, height / 2, height * 0.18, width / 2, height / 2, height * 0.95);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, width, height);
    }

    resizeCanvas();
    build();
    buildStars();
    buildPetals();

    const ro = new ResizeObserver(() => {
      resizeCanvas();
      build();
      buildStars();
      buildPetals();
    });
    ro.observe(container);

    let cancelled = false;
    let raf = 0;
    function drawFrame(t: number) {
      if (cancelled) return;
      if (bgLoaded && bgImage) {
        drawCoverImage(bgImage);
      } else {
        drawSky(t);
        drawGround();
        drawReflection();
        drawTorii();
        drawPetals(t);
        drawRail();
      }

      strands.forEach((s) => {
        // faster period (was t/1500) and bigger amplitude (was 0.035) -- the original
        // sway was so slow and subtle it barely read as motion at all
        const windX = Math.sin(t / 650 + s.phase) * 0.09;
        s.points.forEach((p) => p.integrate(windX));
        for (let i = 0; i < RELAX_PASSES; i++) s.links.forEach((l) => l.solve());
      });

      applyMouseField();

      strands.forEach((s) => {
        const pts = s.points;
        ctx!.beginPath();
        ctx!.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx!.lineTo(pts[i].x, pts[i].y);
        ctx!.strokeStyle = "rgba(255,224,180,0.12)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
        for (let i = 1; i < pts.length; i++) drawGlyph(pts[i], pts[i - 1], s.chars[i - 1], s.alpha);
      });

      drawVignette();
      raf = requestAnimationFrame(drawFrame);
    }
    raf = requestAnimationFrame(drawFrame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      bgImage = null;
    };
  }, []);

  return (
    <div className="stage-japan-wrap" ref={containerRef}>
      <canvas className="stage-japan-canvas" ref={canvasRef} />
    </div>
  );
}
