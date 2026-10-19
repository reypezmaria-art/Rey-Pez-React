export function crearEscenaAcceso(ctx, bg, sheet, tipo) {
  const W = 1408,
    H = 820;
  function sprite(box, x, y, w, h, angle = 0, flip = false) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(sheet, ...box, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function paint(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(bg, 0, 0, W, H);
    // Moving surface caustics and broad shafts of underwater light.
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 4; i++) {
      const x = 300 + i * 210 + Math.sin(t * 0.7 + i) * 100;
      const g = ctx.createLinearGradient(x, 0, x + 180, 780);
      g.addColorStop(0, "rgba(139,255,255,.22)");
      g.addColorStop(1, "rgba(139,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 65, 0);
      ctx.lineTo(x + 340, 820);
      ctx.lineTo(x + 140, 820);
      ctx.fill();
    }
    for (let j = 0; j < 8; j++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 18) {
        const y = 635 + j * 23 + Math.sin(x * 0.012 + t * 1.3 + j) * 13;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(153,255,245," + (0.12 + (j % 3) * 0.055) + ")";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.restore();
    // Illustration sprites swim independently across the scene.
    const swims = [
      { v: 115, offset: 90, y: 310, w: 140, flip: false },
      { v: 155, offset: 820, y: 600, w: 115, flip: true },
      { v: 82, offset: 1180, y: 420, w: 95, flip: false },
    ];
    for (let i = 0; i < swims.length; i++) {
      const s = swims[i],
        phase = (s.offset + t * s.v) % (W + 320);
      const x = s.flip ? phase - 160 : W + 160 - phase;
      const y = s.y + Math.sin(t * 2 + i * 2) * 22;
      sprite(
        [35, 700, 575, 535],
        x,
        y,
        s.w,
        s.w * 0.93,
        Math.sin(t * 3 + i) * 0.1,
        s.flip,
      );
    }
    // Every few seconds the actual robot switches to its closed-eye frame.
    const blinking = t % 2.3 > 0.12 && t % 2.3 < 0.38;
    const robotBox = blinking ? [695, 0, 550, 660] : [65, 0, 550, 660];
    sprite(
      robotBox,
      245 + Math.sin(t * 1.3) * 9,
      300 + Math.sin(t * 2) * 10,
      345,
      414,
      Math.sin(t * 1.5) * 0.035,
    );
    // Real lock sprite with a visible pulse and moving highlights.
    const lx = 775,
      ly = 335,
      lw = 285,
      lh = 325,
      pulse = (Math.sin(t * 3) + 1) / 2;
    const glow = ctx.createRadialGradient(
      lx + lw / 2,
      ly + lh / 2,
      40,
      lx + lw / 2,
      ly + lh / 2,
      240,
    );
    glow.addColorStop(0, "rgba(255,212,103," + (0.3 + pulse * 0.3) + ")");
    glow.addColorStop(1, "rgba(255,212,103,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(lx - 160, ly - 150, lw + 320, lh + 300);
    ctx.save();
    ctx.shadowColor = tipo === "bloqueado" ? "#ffcf64" : "#ff827f";
    ctx.shadowBlur = 12 + pulse * 35;
    sprite(
      [690, 660, 510, 580],
      lx,
      ly + Math.sin(t * 1.2) * 4,
      lw,
      lh,
      Math.sin(t) * 0.012,
    );
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + i * 2.1,
        x = lx + lw / 2 + Math.cos(a) * 175,
        y = ly + lh / 2 + Math.sin(a) * 170,
        shine = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i));
      ctx.save();
      ctx.globalAlpha = shine;
      ctx.strokeStyle = "#fff2ac";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x, y + 8);
      ctx.stroke();
      ctx.restore();
    }
    // Foreground bubbles, large enough to remain visible on a phone.
    for (let i = 0; i < 32; i++) {
      const speed = 45 + (i % 6) * 15,
        y = H + 35 - ((t * speed + i * 91) % (H + 100)),
        x = ((i * 137) % W) + Math.sin(t * 1.4 + i) * 15,
        r = 5 + (i % 4) * 3;
      ctx.strokeStyle = "rgba(203,255,255,.72)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(231,255,255,.62)";
      ctx.beginPath();
      ctx.arc(
        x - r * 0.25,
        y - r * 0.3,
        Math.max(1.5, r * 0.18),
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  return paint;
}
