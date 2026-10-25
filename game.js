(() => {
  "use strict";

  const WORLD = { w: 1000, h: 600, wall: 30 };

  const FIELD = {
    x0: WORLD.wall,
    y0: WORLD.wall,
    x1: WORLD.w - WORLD.wall,
    y1: WORLD.h - WORLD.wall,
    cx: WORLD.w / 2,
    cy: WORLD.h / 2,
  };

  const PLAYER = {
    radius: 18,
    accel: 2600,
    maxSpeed: 323,
    drag: 0.88,
    recoil: 0.08,
  };

  const BALL = {
    radius: 12,
    drag: 0.992,
    wallRetention: 0.75,
    maxSpeed: 900,
    cornerMargin: 8,
    cornerHold: 2,
    smashWindow: 1,
    smashMax: 2,
  };

  const SPRINT = {
    max: 100,
    drain: 28,
    regen: 18,
    exhaustedRegen: 10,
    recoverDelay: 0.8,
    recover: 25,
    speed: 425,
    accel: 3800,
  };

  const MOBILE = {
    speed: SPRINT.speed * 0.9,
    accel: 3030,
  };

  const DASH = {
    minStamina: 50,
    cost: 75,
    impulseStill: 546,
    impulseRun: 945,
    duration: 0.2,
    maxSpeed: 998,
  };

  const CONTACT = {
    transfer: 0.55,
    baseImpulse: 140,
    cooldown: 0.12,
    sprintBonus: 200,
  };

  const COMBO = {
    window: 0.12,
    speed: 1150,
    banner: 0.7,
  };

  const STUN = {
    duration: 0.55,
    knockback: 520,
    recoil: 180,
    tackleCooldown: 1,
  };

  const GOAL = {
    width: 180,
    depth: WORLD.wall,
  };

  const MATCH = {
    duration: 150,
    targetScore: 5,
    kickoffCountdown: 3,
    goalPause: 1.2,
    stuckLimit: 5,
    stuckSpeed: 25,
  };

  const COLORS = {
    p1: "#4cc9f0",
    p1Dark: "#1d7fa0",
    p2: "#f77f00",
    p2Dark: "#b35c00",
    ball: "#f8f9fa",
    ballDark: "#22223b",
    pitchA: "#1b7a3f",
    pitchB: "#1e8a47",
    wall: "#0f2a1d",
    line: "rgba(255,255,255,0.28)",
  };

  const ACTIONS = ["up", "down", "left", "right", "sprint", "dash"];

  const ACTION_LABELS = {
    up: "Up",
    down: "Down",
    left: "Left",
    right: "Right",
    sprint: "Sprint",
    dash: "Dash",
  };

  const DEFAULT_CONTROLS = [
    {
      up: "KeyW",
      down: "KeyS",
      left: "KeyA",
      right: "KeyD",
      sprint: "ShiftLeft",
      dash: "Space",
    },
    {
      up: "ArrowUp",
      down: "ArrowDown",
      left: "ArrowLeft",
      right: "ArrowRight",
      sprint: "ShiftRight",
      dash: "Enter",
    },
  ];

  const RESERVED_KEYS = new Set([
    "Escape",
    "KeyP",
    "KeyR",
    "KeyO",
    "KeyM",
    "Tab",
  ]);

  const STORAGE_KEY = "soccer-controls-v1";

  const KEY_LABELS = {
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    Space: "Space",
    Enter: "Enter",
    Escape: "Esc",
    Tab: "Tab",
    Backspace: "Backspace",
    ShiftLeft: "L Shift",
    ShiftRight: "R Shift",
    ControlLeft: "L Ctrl",
    ControlRight: "R Ctrl",
    AltLeft: "L Alt",
    AltRight: "R Alt",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
    BracketLeft: "[",
    BracketRight: "]",
    Minus: "-",
    Equal: "=",
    Backquote: "`",
  };

  function keyLabel(code) {
    if (!code) return "\u2014";
    if (KEY_LABELS[code]) return KEY_LABELS[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return "Num " + code.slice(6);
    return code;
  }

  function cloneDefaults() {
    return DEFAULT_CONTROLS.map((controls) => ({ ...controls }));
  }

  function sanitizeControls(data) {
    const out = cloneDefaults();
    if (!Array.isArray(data)) return out;

    for (let p = 0; p < 2; p++) {
      const source = data[p];
      if (!source || typeof source !== "object") continue;
      for (const action of ACTIONS) {
        if (typeof source[action] === "string" && source[action].length > 0) {
          out[p][action] = source[action];
        }
      }
    }

    return out;
  }

  function findConflict(controls, playerIndex, action, code) {
    for (let p = 0; p < 2; p++) {
      for (const other of ACTIONS) {
        if (p === playerIndex && other === action) continue;
        if (controls[p][other] === code) {
          return `P${p + 1} ${ACTION_LABELS[other]}`;
        }
      }
    }
    return null;
  }

  function applyControls(match, controls) {
    for (let p = 0; p < 2; p++) {
      match.players[p].controls = { ...controls[p] };
    }
  }

  function loadControls() {
    try {
      if (typeof localStorage === "undefined") return cloneDefaults();
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaults();
      return sanitizeControls(JSON.parse(raw));
    } catch {
      return cloneDefaults();
    }
  }

  function saveControls(controls) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(controls));
    } catch {}
  }

  const BLOCK_DEFAULT = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
    "Enter",
    "NumpadEnter",
  ]);

  class Input {
    constructor() {
      this.down = new Set();
      this.pressed = new Set();

      this.onKeyDown = (e) => {
        if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
        if (!this.down.has(e.code)) this.pressed.add(e.code);
        this.down.add(e.code);
      };
      this.onKeyUp = (e) => {
        this.down.delete(e.code);
      };
      this.onBlur = () => {
        this.down.clear();
        this.pressed.clear();
      };

      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      window.addEventListener("blur", this.onBlur);
    }

    isDown(code) {
      return this.down.has(code);
    }

    consumePressed(code) {
      if (this.pressed.has(code)) {
        this.pressed.delete(code);
        return true;
      }
      return false;
    }

    endFrame() {
      this.pressed.clear();
    }

    clear() {
      this.down.clear();
      this.pressed.clear();
    }
  }

  class Player {
    constructor(opts) {
      this.name = opts.name;
      this.color = opts.color;
      this.dark = opts.dark;
      this.controls = opts.controls;
      this.radius = PLAYER.radius;
      this.mobile = Boolean(opts.mobile);
      this.reset(opts.x, opts.y, opts.dir);
    }

    reset(x, y, dir = 0) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.dir = dir;
      this.touchCooldown = 0;
      this.touchFlash = 0;
      this.stunTimer = 0;
      this.tackleCooldown = 0;
      this.stamina = SPRINT.max;
      this.exhausted = false;
      this.sprinting = false;
      this.sprintArmed = true;
      this.regenDelay = 0;
      this.dashTimer = 0;
    }

    getHitbox() {
      const half = this.radius / Math.SQRT2;
      return {
        left: this.x - half,
        right: this.x + half,
        top: this.y - half,
        bottom: this.y + half,
      };
    }

    updateStamina(dt, sprinting) {
      if (sprinting) {
        this.sprinting = true;
        this.stamina = Math.max(0, this.stamina - SPRINT.drain * dt);
        if (this.stamina <= 0) {
          this.exhausted = true;
          this.sprintArmed = false;
          this.regenDelay = SPRINT.recoverDelay;
        }
        return;
      }

      this.sprinting = false;

      if (this.regenDelay > 0) {
        this.regenDelay = Math.max(0, this.regenDelay - dt);
        return;
      }

      const rate = this.exhausted ? SPRINT.exhaustedRegen : SPRINT.regen;
      this.stamina = Math.min(SPRINT.max, this.stamina + rate * dt);
      if (this.exhausted && this.stamina >= SPRINT.recover) {
        this.exhausted = false;
      }
    }

    update(dt, input) {
      if (this.touchCooldown > 0) this.touchCooldown -= dt;
      if (this.touchFlash > 0) this.touchFlash -= dt;
      if (this.tackleCooldown > 0) this.tackleCooldown -= dt;
      if (this.dashTimer > 0) this.dashTimer -= dt;

      if (this.stunTimer > 0) {
        this.stunTimer -= dt;
        this.updateStamina(dt, false);
        const stunDrag = Math.pow(PLAYER.drag, dt * 60);
        this.vx *= stunDrag;
        this.vy *= stunDrag;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.constrain();
        return;
      }

      const c = this.controls;
      let ix = 0;
      let iy = 0;
      if (typeof input.getMove === "function") {
        const move = input.getMove();
        if (move) {
          ix = Number(move.x) || 0;
          iy = Number(move.y) || 0;
        }
      } else {
        if (input.isDown(c.left)) ix -= 1;
        if (input.isDown(c.right)) ix += 1;
        if (input.isDown(c.up)) iy -= 1;
        if (input.isDown(c.down)) iy += 1;
        const keyboardLen = Math.hypot(ix, iy);
        if (keyboardLen > 0) {
          ix /= keyboardLen;
          iy /= keyboardLen;
        }
      }

      let len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
        len = 1;
      }
      if (len > 0.12) {
        this.dir = Math.atan2(iy, ix);
      }

      if (
        !this.mobile &&
        input.consumePressed(c.dash) &&
        this.stamina >= DASH.minStamina &&
        this.stunTimer <= 0
      ) {
        const dx = len > 0 ? ix : Math.cos(this.dir);
        const dy = len > 0 ? iy : Math.sin(this.dir);
        this.stamina = Math.max(0, this.stamina - DASH.cost);
        if (this.stamina <= 0) {
          this.exhausted = true;
          this.sprintArmed = false;
          this.regenDelay = SPRINT.recoverDelay;
        }
        const speedNow = Math.hypot(this.vx, this.vy);
        const runness = Math.min(1, speedNow / SPRINT.speed);
        const impulse =
          DASH.impulseStill +
          (DASH.impulseRun - DASH.impulseStill) * runness;
        this.vx += dx * impulse;
        this.vy += dy * impulse;
        this.dashTimer = DASH.duration;
      }

      const sprintDown = !this.mobile && input.isDown(c.sprint);
      if (!sprintDown) {
        this.sprintArmed = true;
      } else if (this.exhausted || this.stamina <= 0) {
        this.sprintArmed = false;
      }

      const wantSprint =
        len > 0 &&
        sprintDown &&
        this.sprintArmed &&
        !this.exhausted &&
        this.stamina > 0;
      this.updateStamina(dt, wantSprint);

      const accel = this.sprinting
        ? SPRINT.accel
        : this.mobile
          ? MOBILE.accel
          : PLAYER.accel;
      this.vx += ix * accel * dt;
      this.vy += iy * accel * dt;

      const drag = Math.pow(PLAYER.drag, dt * 60);
      this.vx *= drag;
      this.vy *= drag;

      let limit = this.sprinting
        ? SPRINT.speed
        : this.mobile
          ? MOBILE.speed
          : PLAYER.maxSpeed;
      if (this.dashTimer > 0) limit = DASH.maxSpeed;
      const speed = Math.hypot(this.vx, this.vy);
      if (speed > limit) {
        const bleed = Math.pow(0.9, dt * 60);
        this.vx *= bleed;
        this.vy *= bleed;
      }

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.constrain();
    }

    stun(duration, dx, dy, knockback) {
      this.stunTimer = duration;
      this.sprinting = false;
      this.dashTimer = 0;
      this.vx = dx * knockback;
      this.vy = dy * knockback;
    }

    constrain() {
      const r = this.radius;
      const minX = FIELD.x0 + r;
      const maxX = FIELD.x1 - r;
      const minY = FIELD.y0 + r;
      const maxY = FIELD.y1 - r;

      if (this.x < minX) {
        this.x = minX;
        this.vx = Math.max(0, this.vx);
      }
      if (this.x > maxX) {
        this.x = maxX;
        this.vx = Math.min(0, this.vx);
      }
      if (this.y < minY) {
        this.y = minY;
        this.vy = Math.max(0, this.vy);
      }
      if (this.y > maxY) {
        this.y = maxY;
        this.vy = Math.min(0, this.vy);
      }
    }
  }

  class Ball {
    constructor(x, y) {
      this.radius = BALL.radius;
      this.trail = [];
      this.reset(x, y);
    }

    reset(x, y) {
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.speed = 0;
      this.trail = [];
    }

    update(dt) {
      const drag = Math.pow(BALL.drag, dt * 60);
      this.vx *= drag;
      this.vy *= drag;

      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.speed = Math.hypot(this.vx, this.vy);

      if (this.speed > 60) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 14) this.trail.shift();
      } else if (this.trail.length > 0) {
        this.trail.shift();
      }
    }

    clampSpeed() {
      const s = Math.hypot(this.vx, this.vy);
      if (s > BALL.maxSpeed) {
        const f = BALL.maxSpeed / s;
        this.vx *= f;
        this.vy *= f;
      }
    }

    getBox() {
      const r = this.radius;
      return {
        left: this.x - r,
        right: this.x + r,
        top: this.y - r,
        bottom: this.y + r,
      };
    }
  }

  class Effects {
    constructor() {
      this.particles = [];
      this.shake = 0;
      this.flash = 0;
      this.flashColor = "#ffffff";
    }

    burst(x, y, color, count = 24, power = 320) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = power * (0.3 + Math.random() * 0.9);
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.6,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    addShake(value) {
      this.shake = Math.min(16, this.shake + value);
    }

    addFlash(value, color = "#ffffff") {
      this.flash = Math.min(1, this.flash + value);
      this.flashColor = color;
    }

    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.92, dt * 60);
        p.vy *= Math.pow(0.92, dt * 60);
      }

      this.shake *= Math.pow(0.001, dt);
      if (this.shake < 0.1) this.shake = 0;

      this.flash = Math.max(0, this.flash - dt * 2.5);
    }

    draw(ctx) {
      for (const p of this.particles) {
        ctx.globalAlpha = Math.min(1, p.life / 0.6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  class AIController {
    constructor(match, index) {
      this.match = match;
      this.index = index;
      this.intent = {
        up: false,
        down: false,
        left: false,
        right: false,
        sprint: false,
      };
      this.dashQueued = false;
      this.thinkTimer = 0;
      this.dashCooldown = 0;
      this.wobble = 0;
      this.wobbleTimer = 0;
      this.reset();
    }

    get player() {
      return this.match.players[this.index];
    }

    reset() {
      this.intent.up = false;
      this.intent.down = false;
      this.intent.left = false;
      this.intent.right = false;
      this.intent.sprint = false;
      this.dashQueued = false;
      this.thinkTimer = 0;
      this.dashCooldown = 0.4;
      this.wobble = 0;
      this.wobbleTimer = 0;
    }

    isDown(code) {
      const c = this.player.controls;
      if (code === c.up) return this.intent.up;
      if (code === c.down) return this.intent.down;
      if (code === c.left) return this.intent.left;
      if (code === c.right) return this.intent.right;
      if (code === c.sprint) return this.intent.sprint;
      return false;
    }

    consumePressed(code) {
      if (code === this.player.controls.dash && this.dashQueued) {
        this.dashQueued = false;
        return true;
      }
      return false;
    }

    endFrame() {}

    clear() {
      this.intent.up = false;
      this.intent.down = false;
      this.intent.left = false;
      this.intent.right = false;
      this.intent.sprint = false;
      this.dashQueued = false;
    }

    update(dt) {
      this.dashCooldown = Math.max(0, this.dashCooldown - dt);
      this.wobbleTimer -= dt;
      if (this.wobbleTimer <= 0) {
        this.wobble = (Math.random() - 0.5) * 18;
        this.wobbleTimer = 0.5 + Math.random() * 0.6;
      }

      const p = this.player;
      if (p.stunTimer > 0) {
        this.clear();
        this.thinkTimer = 0;
        return;
      }

      this.thinkTimer -= dt;
      if (this.thinkTimer > 0) return;
      this.thinkTimer = 0.06 + Math.random() * 0.03;

      const b = this.match.ball;
      const { x0, x1, y0, y1, cy } = FIELD;

      const lead = 0.13;
      let bx = b.x + b.vx * lead;
      let by = b.y + b.vy * lead;
      bx = Math.max(x0 + b.radius, Math.min(x1 - b.radius, bx));
      by = Math.max(y0 + b.radius, Math.min(y1 - b.radius, by));

      let gx = x0 - bx;
      let gy = cy - by;
      const gd = Math.hypot(gx, gy) || 1;
      gx /= gd;
      gy /= gd;

      const behindDist = p.radius + b.radius + 6;
      const behindProj = (p.x - bx) * gx + (p.y - by) * gy;
      const behind = behindProj < -4;

      const toBallX = bx - p.x;
      const toBallY = by - p.y;
      const distBall = Math.hypot(toBallX, toBallY) || 0.001;
      const cos = (toBallX * gx + toBallY * gy) / distBall;
      const canPush = behind && cos > 0.55 && distBall < 120;

      let dx;
      let dy;
      if (canPush) {
        dx = bx + gx * 45 - p.x;
        dy = by + gy * 45 - p.y;
      } else if (!behind) {
        const ang = Math.atan2(p.y - by, p.x - bx);
        const behindAng = Math.atan2(-gy, -gx);
        let da = behindAng - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const dir = da >= 0 ? 1 : -1;
        const tx = -Math.sin(ang) * dir;
        const ty = Math.cos(ang) * dir;
        let radial = 0;
        if (distBall < 80) radial = 1;
        else if (distBall > 125) radial = -1;
        dx = tx * 140 + Math.cos(ang) * radial * 110 + this.wobble * 0.2;
        dy = ty * 140 + Math.sin(ang) * radial * 110 + this.wobble * 0.2;
      } else {
        let targetX = bx - gx * behindDist;
        let targetY = by - gy * behindDist + this.wobble;
        targetX = Math.max(x0 + p.radius, Math.min(x1 - p.radius, targetX));
        targetY = Math.max(y0 + p.radius, Math.min(y1 - p.radius, targetY));
        dx = targetX - p.x;
        dy = targetY - p.y;
      }

      const dead = 8;
      this.intent.right = dx > dead;
      this.intent.left = dx < -dead;
      this.intent.up = dy < -dead;
      this.intent.down = dy > dead;

      const moving =
        this.intent.left ||
        this.intent.right ||
        this.intent.up ||
        this.intent.down;
      const far = Math.hypot(dx, dy) > 100;
      const defensive = bx > FIELD.cx + 120;
      const sprintOK =
        !(defensive && !behind) &&
        !(!behind && distBall < 160);

      this.intent.sprint =
        !p.mobile &&
        moving &&
        !p.exhausted &&
        p.stamina > 15 &&
        sprintOK &&
        (far || (canPush && p.stamina > 45));

      if (
        !p.mobile &&
        this.dashCooldown <= 0 &&
        p.stamina >= DASH.minStamina &&
        !p.exhausted &&
        canPush &&
        distBall < 95 &&
        distBall > 22 &&
        moving
      ) {
        this.dashQueued = true;
        this.dashCooldown = 1.6;
      }
    }
  }

  class Match {
    constructor(input) {
      this.input = input;
      this.effects = new Effects();

      this.players = [
        new Player({
          name: "P1",
          color: COLORS.p1,
          dark: COLORS.p1Dark,
          controls: { ...DEFAULT_CONTROLS[0] },
          x: FIELD.cx - 160,
          y: FIELD.cy,
          dir: 0,
        }),
        new Player({
          name: "P2",
          color: COLORS.p2,
          dark: COLORS.p2Dark,
          controls: { ...DEFAULT_CONTROLS[1] },
          x: FIELD.cx + 160,
          y: FIELD.cy,
          dir: Math.PI,
        }),
      ];

      this.controllers = [input, input];
      this.ball = new Ball(FIELD.cx, FIELD.cy);
      this.reset();
    }

    setController(index, controller) {
      this.controllers[index] = controller;
    }

    reset() {
      this.score = [0, 0];
      this.timeLeft = MATCH.duration;
      this.suddenDeath = false;
      this.state = "countdown";
      this.countdown = MATCH.kickoffCountdown;
      this.stateTimer = 0;
      this.playTimer = 0;
      this.playClock = 0;
      this.stuckTimer = 0;
      this.lastGoalBy = null;
      this.lastTouch = null;
      this.smashTimer = 0;
      this.smashTimes = [];
      this.cornerTimer = 0;

      this.players[0].reset(FIELD.cx - 160, FIELD.cy, 0);
      this.players[1].reset(FIELD.cx + 160, FIELD.cy, Math.PI);
      this.ball.reset(FIELD.cx, FIELD.cy);

      this.effects.particles.length = 0;
      this.effects.shake = 0;
      this.effects.flash = 0;

      for (const controller of this.controllers) {
        if (controller && typeof controller.reset === "function") {
          controller.reset();
        }
      }
    }

    update(dt) {
      this.effects.update(dt);
      if (this.smashTimer > 0) this.smashTimer -= dt;

      if (this.state === "countdown") {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.state = "playing";
          this.playTimer = 0;
          this.lastTouch = null;
          this.ball.reset(FIELD.cx, FIELD.cy);
          this.players[0].reset(FIELD.cx - 160, FIELD.cy, 0);
          this.players[1].reset(FIELD.cx + 160, FIELD.cy, Math.PI);
          for (const controller of this.controllers) {
            if (controller && typeof controller.reset === "function") {
              controller.reset();
            }
          }
          this.effects.addFlash(0.2);
        }
        return;
      }

      if (this.state === "goal") {
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) this.kickoff();
        return;
      }

      if (this.state === "ended") return;

      this.playTimer += dt;
      this.playClock += dt;
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (this.score[0] !== this.score[1]) {
          this.end();
          return;
        }
        this.suddenDeath = true;
      }

      for (let i = 0; i < this.players.length; i++) {
        const controller = this.controllers[i];
        if (controller && typeof controller.update === "function") {
          controller.update(dt);
        }
        this.players[i].update(dt, controller);
      }

      this.resolvePlayers();
      this.ball.update(dt);
      this.resolveBallWalls(dt);
      for (let i = 0; i < this.players.length; i++) {
        this.resolvePlayerBall(this.players[i], i);
      }

      this.updateStuck(dt);

      const goal = this.detectGoal();
      if (goal !== null) this.scoreGoal(goal);
    }

    resolvePlayers() {
      const [a, b] = this.players;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.radius + b.radius;

      if (d <= 0.0001) {
        a.x -= 1;
        b.x += 1;
        return;
      }

      if (d < min) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;

        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;

        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          const aAttacking = a.dashTimer > 0;
          const bAttacking = b.dashTimer > 0;
          const aCanTackle = aAttacking && a.tackleCooldown <= 0;
          const bCanTackle = bAttacking && b.tackleCooldown <= 0;

          if (aCanTackle && !bAttacking && b.stunTimer <= 0) {
            b.stun(STUN.duration, nx, ny, STUN.knockback);
            a.vx -= nx * STUN.recoil;
            a.vy -= ny * STUN.recoil;
            a.tackleCooldown = STUN.tackleCooldown;
            this.tackleFx((a.x + b.x) / 2, (a.y + b.y) / 2);
          } else if (bCanTackle && !aAttacking && a.stunTimer <= 0) {
            a.stun(STUN.duration, -nx, -ny, STUN.knockback);
            b.vx += nx * STUN.recoil;
            b.vy += ny * STUN.recoil;
            b.tackleCooldown = STUN.tackleCooldown;
            this.tackleFx((a.x + b.x) / 2, (a.y + b.y) / 2);
          } else {
            const j = rel * 0.6;
            a.vx -= nx * j;
            a.vy -= ny * j;
            b.vx += nx * j;
            b.vy += ny * j;
          }
        }

        a.constrain();
        b.constrain();
      }
    }

    tackleFx(x, y) {
      this.effects.burst(x, y, "#ffd166", 22, 360);
      this.effects.addShake(10);
      this.effects.addFlash(0.18, "#ffd166");
    }

    resolveBallWalls(dt = 0) {
      const b = this.ball;
      const r = b.radius;
      const { x0, y0, x1, y1, cy } = FIELD;
      const mouthTop = cy - GOAL.width / 2;
      const mouthBottom = cy + GOAL.width / 2;
      const box = b.getBox();
      const inMouth = box.top >= mouthTop && box.bottom <= mouthBottom;

      if (box.top < y0) {
        b.y = y0 + r;
        b.vy = Math.abs(b.vy) * BALL.wallRetention;
        b.vx *= BALL.wallRetention;
      } else if (box.bottom > y1) {
        b.y = y1 - r;
        b.vy = -Math.abs(b.vy) * BALL.wallRetention;
        b.vx *= BALL.wallRetention;
      }

      if (!inMouth && box.left < x0) {
        b.x = x0 + r;
        b.vx = Math.abs(b.vx) * BALL.wallRetention;
        b.vy *= BALL.wallRetention;
      } else if (!inMouth && box.right > x1) {
        b.x = x1 - r;
        b.vx = -Math.abs(b.vx) * BALL.wallRetention;
        b.vy *= BALL.wallRetention;
      }

      const margin = BALL.cornerMargin;
      const nearLeft = b.x - r <= x0 + margin;
      const nearRight = b.x + r >= x1 - margin;
      const nearTop = b.y - r <= y0 + margin;
      const nearBottom = b.y + r >= y1 - margin;

      const inCorner =
        (nearLeft || nearRight) && (nearTop || nearBottom);

      if (inCorner) {
        this.cornerTimer += dt;
        if (this.cornerTimer >= BALL.cornerHold) {
          this.resetBallToCenter();
        }
      } else {
        this.cornerTimer = 0;
      }
    }

    resetBallToCenter() {
      const oldX = this.ball.x;
      const oldY = this.ball.y;
      this.ball.reset(FIELD.cx, FIELD.cy);
      this.lastTouch = null;
      this.stuckTimer = 0;
      this.cornerTimer = 0;
      this.smashTimes.length = 0;
      this.effects.burst(oldX, oldY, "#ffffff", 10, 180);
      this.effects.burst(FIELD.cx, FIELD.cy, "#ffffff", 18, 260);
      this.effects.addShake(6);
    }

    resolvePlayerBall(p, index) {
      const b = this.ball;
      const box = p.getHitbox();
      const closestX = Math.max(box.left, Math.min(b.x, box.right));
      const closestY = Math.max(box.top, Math.min(b.y, box.bottom));
      const dx = b.x - closestX;
      const dy = b.y - closestY;
      const d = Math.hypot(dx, dy);

      if (d >= b.radius) return;

      let nx;
      let ny;

      if (d > 0.0001) {
        nx = dx / d;
        ny = dy / d;
        b.x = closestX + nx * b.radius;
        b.y = closestY + ny * b.radius;
      } else {
        const leftPen = b.x - box.left;
        const rightPen = box.right - b.x;
        const topPen = b.y - box.top;
        const bottomPen = box.bottom - b.y;
        const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);

        if (minPen === leftPen) {
          nx = -1;
          ny = 0;
          b.x = box.left - b.radius;
        } else if (minPen === rightPen) {
          nx = 1;
          ny = 0;
          b.x = box.right + b.radius;
        } else if (minPen === topPen) {
          nx = 0;
          ny = -1;
          b.y = box.top - b.radius;
        } else {
          nx = 0;
          ny = 1;
          b.y = box.bottom + b.radius;
        }
      }

      if (p.touchCooldown > 0) return;

      const last = this.lastTouch;
      if (
        last &&
        last.index !== index &&
        this.playClock - last.time <= COMBO.window
      ) {
        this.smashBall(p, nx, ny, last);
        p.touchCooldown = CONTACT.cooldown;
        p.touchFlash = 0.12;
        p.vx -= nx * 120;
        p.vy -= ny * 120;
        this.lastTouch = null;
        return;
      }

      const toward = Math.max(0, p.vx * nx + p.vy * ny);
      const speed = Math.hypot(p.vx, p.vy);
      let impulse =
        CONTACT.baseImpulse + toward * CONTACT.transfer + speed * 0.12;
      if (p.sprinting || p.dashTimer > 0) impulse += CONTACT.sprintBonus;

      b.vx += nx * impulse;
      b.vy += ny * impulse;
      b.clampSpeed();

      p.vx -= nx * impulse * PLAYER.recoil;
      p.vy -= ny * impulse * PLAYER.recoil;
      p.touchCooldown = CONTACT.cooldown;
      p.touchFlash = 0.12;

      this.lastTouch = { index, time: this.playClock, nx, ny };
      this.effects.burst(b.x, b.y, "#ffffff", 3, 110);
    }

    smashBall(p, nx, ny, last) {
      const b = this.ball;
      let dx = nx + last.nx;
      let dy = ny + last.ny;
      let len = Math.hypot(dx, dy);

      if (len < 0.35) {
        const other = this.players[last.index];
        const ax = p.x - other.x;
        const ay = p.y - other.y;
        dx = -ay;
        dy = ax;
        len = Math.hypot(dx, dy);
        if (len < 0.0001) {
          dx = 1;
          dy = 0;
          len = 1;
        }
        const toCenterX = FIELD.cx - b.x;
        const toCenterY = FIELD.cy - b.y;
        if (dx * toCenterX + dy * toCenterY < 0) {
          dx = -dx;
          dy = -dy;
        }
      }

      dx /= len;
      dy /= len;

      b.vx = dx * COMBO.speed;
      b.vy = dy * COMBO.speed;
      b.trail = [];

      this.effects.burst(b.x, b.y, "#ffd166", 46, 560);
      this.effects.addShake(14);
      this.effects.addFlash(0.5, "#ffd166");
      this.smashTimer = COMBO.banner;

      const now = this.playClock;
      this.smashTimes.push(now);
      while (
        this.smashTimes.length > 0 &&
        now - this.smashTimes[0] > BALL.smashWindow
      ) {
        this.smashTimes.shift();
      }
      if (this.smashTimes.length > BALL.smashMax) {
        this.resetBallToCenter();
      }
    }

    updateStuck(dt) {
      if (this.ball.speed < MATCH.stuckSpeed) {
        this.stuckTimer += dt;
      } else {
        this.stuckTimer = 0;
      }

      if (this.stuckTimer >= MATCH.stuckLimit) {
        this.ball.reset(FIELD.cx, FIELD.cy);
        this.stuckTimer = 0;
        this.cornerTimer = 0;
        this.effects.burst(FIELD.cx, FIELD.cy, "#ffffff", 12, 180);
      }
    }

    detectGoal() {
      const box = this.ball.getBox();
      const mouthTop = FIELD.cy - GOAL.width / 2;
      const mouthBottom = FIELD.cy + GOAL.width / 2;

      if (box.top < mouthTop || box.bottom > mouthBottom) return null;
      if (box.right < FIELD.x0) return "left";
      if (box.left > FIELD.x1) return "right";
      return null;
    }

    scoreGoal(side) {
      const scorer = side === "right" ? 0 : 1;
      this.score[scorer] += 1;
      this.lastGoalBy = scorer;

      const color = scorer === 0 ? COLORS.p1 : COLORS.p2;
      const b = this.ball;
      this.effects.burst(b.x, b.y, color, 40, 420);
      this.effects.addShake(12);
      this.effects.addFlash(0.45, color);

      b.vx = 0;
      b.vy = 0;

      this.state = "goal";
      this.stateTimer = MATCH.goalPause;
    }

    kickoff() {
      if (
        this.score[0] >= MATCH.targetScore ||
        this.score[1] >= MATCH.targetScore
      ) {
        this.end();
        return;
      }

      this.state = "countdown";
      this.countdown = MATCH.kickoffCountdown;
      this.stuckTimer = 0;
      this.lastTouch = null;
      this.cornerTimer = 0;
      this.smashTimes.length = 0;

      this.players[0].reset(FIELD.cx - 160, FIELD.cy, 0);
      this.players[1].reset(FIELD.cx + 160, FIELD.cy, Math.PI);
      this.ball.reset(FIELD.cx, FIELD.cy);
    }

    end() {
      this.state = "ended";
      this.effects.addFlash(0.35);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPitch(ctx) {
    const { w, h } = WORLD;
    const { x0, y0, x1, y1, cx, cy } = FIELD;

    ctx.fillStyle = COLORS.wall;
    ctx.fillRect(0, 0, w, h);

    const stripe = 50;
    for (let x = x0; x < x1; x += stripe) {
      const index = Math.round((x - x0) / stripe);
      ctx.fillStyle = index % 2 === 0 ? COLORS.pitchA : COLORS.pitchB;
      ctx.fillRect(x, y0, Math.min(stripe, x1 - x), y1 - y0);
    }

    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx, y1);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 70, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.line;
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
  }

  function drawGoal(ctx, side) {
    const { x0, x1, cy } = FIELD;
    const h = GOAL.width;
    const top = cy - h / 2;
    const bottom = cy + h / 2;
    const left = side === "left";
    const x = left ? 0 : x1;
    const width = GOAL.depth;
    const color = left ? COLORS.p1 : COLORS.p2;
    const dark = left ? COLORS.p1Dark : COLORS.p2Dark;

    ctx.fillStyle = dark;
    ctx.fillRect(x, top, width, h);

    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) {
      const yy = top + (h / 6) * i;
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x + width, yy);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      const xx = x + (width / 4) * i;
      ctx.beginPath();
      ctx.moveTo(xx, top);
      ctx.lineTo(xx, bottom);
      ctx.stroke();
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const lineX = left ? x0 : x1;
    ctx.moveTo(lineX, top);
    ctx.lineTo(lineX, bottom);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    for (const postY of [top, bottom]) {
      ctx.beginPath();
      ctx.arc(lineX, postY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBall(ctx, ball) {
    for (let i = 0; i < ball.trail.length; i++) {
      const t = ball.trail[i];
      const k = (i + 1) / ball.trail.length;
      ctx.globalAlpha = k * 0.22;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.radius * (0.3 + 0.6 * k), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(ball.x + 2, ball.y + 3, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    const g = ctx.createRadialGradient(
      ball.x - 4,
      ball.y - 5,
      2,
      ball.x,
      ball.y,
      ball.radius,
    );
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#cfd8dc");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.ballDark;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const rr = ball.radius * 0.66;
      ctx.beginPath();
      ctx.arc(
        ball.x + Math.cos(a) * rr,
        ball.y + Math.sin(a) * rr,
        ball.radius * 0.16,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  function canDash(p) {
    return p.stamina >= DASH.minStamina && p.stunTimer <= 0 && p.dashTimer <= 0;
  }

  function drawPlayer(ctx, p, time) {
    const { x, y, radius } = p;

    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    ctx.fill();

    if (p.sprinting || p.dashTimer > 0) {
      const dashing = p.dashTimer > 0;
      ctx.globalAlpha = dashing ? 0.55 : 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, radius + (dashing ? 13 : 8), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (p.dashTimer > 0) {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const tail = 34;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - (p.vx / sp) * tail, y - (p.vy / sp) * tail);
      ctx.stroke();
      ctx.lineCap = "butt";
      ctx.globalAlpha = 1;
    }

    const g = ctx.createRadialGradient(x - 5, y - 6, 2, x, y, radius);
    g.addColorStop(0, p.color);
    g.addColorStop(1, p.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(p.dir) * (radius - 6),
      y + Math.sin(p.dir) * (radius - 6),
      3.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (p.touchFlash > 0) {
      ctx.globalAlpha = (p.touchFlash / 0.12) * 0.6;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "bold 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.name, x, y - radius - 9);

    if (!p.mobile) {
      const staminaFrac = Math.max(0, Math.min(1, p.stamina / SPRINT.max));
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, radius + 5, -Math.PI / 2, Math.PI * 1.5);
      ctx.stroke();

      const ready = canDash(p);
      ctx.strokeStyle = ready ? "#7ee787" : "#ff5d5d";
      ctx.lineWidth = ready ? 5 : 4;
      ctx.globalAlpha = p.exhausted
        ? 0.55 + Math.sin(time * 14) * 0.35
        : 0.95;
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        radius + 5,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * staminaFrac,
      );
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    if (p.stunTimer > 0) {
      const pulse = 0.5 + Math.sin(time * 18) * 0.5;
      ctx.globalAlpha = 0.35 + pulse * 0.3;
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, radius + 6 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      for (let i = 0; i < 3; i++) {
        const a = time * 7 + (i / 3) * Math.PI * 2;
        const sx = x + Math.cos(a) * 15;
        const sy = y - radius - 7 + Math.sin(a) * 5;
        ctx.fillStyle = "#ffd166";
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return `${m}:${String(rest).padStart(2, "0")}`;
  }

  function drawHud(ctx, m) {
    const { cx } = FIELD;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    roundRect(ctx, cx - 120, 6, 240, 50, 10);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = COLORS.p1;
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText(String(m.score[0]), cx - 30, 27);

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.fillText("–", cx, 26);

    ctx.fillStyle = COLORS.p2;
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText(String(m.score[1]), cx + 30, 27);

    ctx.fillStyle =
      m.timeLeft <= 10 && m.state === "playing"
        ? "#ff5d5d"
        : "rgba(255,255,255,0.75)";
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.fillText(formatTime(m.timeLeft), cx, 47);

    ctx.restore();
  }

  function drawBanners(ctx, m, time) {
    const { cx, cy } = FIELD;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (m.state === "countdown") {
      const n = Math.ceil(m.countdown);
      const frac = m.countdown - Math.floor(m.countdown);

      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.arc(cx, cy, 82, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${70 + frac * 18}px system-ui, sans-serif`;
      ctx.fillText(String(n), cx, cy - 4);

      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText("KICKOFF", cx, cy + 62);
    }

    if (m.state === "playing" && m.playTimer < 0.6) {
      const t = m.playTimer / 0.6;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${60 + t * 30}px system-ui, sans-serif`;
      ctx.fillText("GO!", cx, cy);
      ctx.globalAlpha = 1;
    }

    if (m.state === "playing" && m.suddenDeath) {
      const pulse = 0.6 + Math.sin(time * 8) * 0.4;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = "#ff5d5d";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText("SUDDEN DEATH", cx, 78);
      ctx.globalAlpha = 1;
    }

    if (m.state === "playing" && m.smashTimer > 0) {
      const t = 1 - m.smashTimer / COMBO.banner;
      ctx.save();
      ctx.translate(cx, cy - 110);
      ctx.scale(1 + t * 0.2, 1 + t * 0.2);
      ctx.globalAlpha = Math.min(1, m.smashTimer * 4);
      ctx.fillStyle = "#ffd166";
      ctx.font = "bold 58px system-ui, sans-serif";
      ctx.fillText("SMASH!", 0, 0);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    if (m.state === "goal") {
      const color = m.lastGoalBy === 0 ? COLORS.p1 : COLORS.p2;
      const t = 1 - m.stateTimer / MATCH.goalPause;
      const scale = 1 + Math.max(0, 0.25 - t * 0.25);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, -190, -62, 380, 124, 18);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = "bold 64px system-ui, sans-serif";
      ctx.fillText("GOAL!", 0, -10);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText(
        `${m.lastGoalBy === 0 ? "P1" : "P2"}  ·  ${m.score[0]} – ${m.score[1]}`,
        0,
        34,
      );
      ctx.restore();
    }

    if (m.state === "ended") {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);

      const winner =
        m.score[0] === m.score[1]
          ? "DRAW"
          : m.score[0] > m.score[1]
            ? "P1 WINS"
            : "P2 WINS";
      const color =
        m.score[0] > m.score[1]
          ? COLORS.p1
          : m.score[1] > m.score[0]
            ? COLORS.p2
            : "#ffffff";

      ctx.fillStyle = color;
      ctx.font = "bold 72px system-ui, sans-serif";
      ctx.fillText(winner, cx, cy - 30);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 40px system-ui, sans-serif";
      ctx.fillText(`${m.score[0]} – ${m.score[1]}`, cx, cy + 36);
    }

    ctx.restore();
  }

  function draw(ctx, match, time) {
    const fx = match.effects;

    ctx.save();
    if (fx.shake > 0.1) {
      const s = fx.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    drawPitch(ctx);
    drawGoal(ctx, "left");
    drawGoal(ctx, "right");
    drawBall(ctx, match.ball);
    for (const p of match.players) drawPlayer(ctx, p, time);
    fx.draw(ctx);

    ctx.restore();

    if (fx.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.4, fx.flash * 0.35);
      ctx.fillStyle = fx.flashColor;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
      ctx.restore();
    }

    drawHud(ctx, match);
    drawBanners(ctx, match, time);
  }

  const GUIDE_PAGES = [
    {
      title: "Score goals",
      html: `
        <p>Play a friend on one keyboard, or take on the CPU as P1. It is always 1v1.</p>
        <ul>
          <li><b>P1</b> attacks the <b>right</b> goal. <b>P2</b> attacks the <b>left</b> goal.</li>
          <li>First to <b>5 goals</b> wins. If the 2:30 clock runs out, the higher score wins.</li>
          <li>A tie at full time goes to <b>sudden death</b>: the next goal wins.</li>
        </ul>`,
    },
    {
      title: "Move and shoot",
      html: `
        <p>There is no kick button. Run into the ball to push it.</p>
        <ul>
          <li>Your speed and angle decide where the ball goes.</li>
          <li>Walls bounce the ball and cut <b>25%</b> of its speed on every bounce.</li>
          <li>Body-check the other player to fight for space.</li>
        </ul>`,
    },
    {
      title: "Sprint and stamina",
      html: `
        <p>Hold <span class="kbd">Sprint</span> while moving to speed up.</p>
        <ul>
          <li>Sprinting drains stamina. The ring around your player is your stamina bar.</li>
          <li><b>Green</b> means dash is ready. <b>Red</b> means it is not.</li>
          <li>Empty stamina makes you <b>exhausted</b>: sprint stops, refill is delayed, then it refills slower until you recover.</li>
          <li>After exhaustion, release and press Sprint again to restart.</li>
        </ul>`,
    },
    {
      title: "Dash",
      html: `
        <p>Dash is a short burst of speed.</p>
        <ul>
          <li>It needs at least <b>50 stamina</b> and spends <b>75</b>.</li>
          <li>A running dash travels farther than a standing dash.</li>
          <li>Use it to close distance, blast the ball, or tackle.</li>
          <li>You cannot dash while stunned or under 50 stamina.</li>
        </ul>`,
    },
    {
      title: "Tackle and smash",
      html: `
        <p>Tackle and smash are your power moves.</p>
        <ul>
          <li><b>Tackle:</b> dash into the other player. They are stunned and knocked back.</li>
          <li><b>Smash:</b> if both players touch the ball within 0.12s, it fires away at top speed.</li>
          <li>Try pinching the ball between both players for a smash.</li>
        </ul>`,
    },
    {
      title: "Controls and setup",
      html: `
        <p>Defaults, rebindable anytime:</p>
        <ul>
          <li><b>P1:</b> WASD · <span class="kbd">LShift</span> sprint · <span class="kbd">Space</span> dash</li>
          <li><b>P2:</b> Arrows · <span class="kbd">RShift</span> sprint · <span class="kbd">Enter</span> dash</li>
          <li><span class="kbd">O</span> Controls · <span class="kbd">M</span> Menu · <span class="kbd">P</span> Pause · <span class="kbd">R</span> Restart</li>
        </ul>
        <p>Your bindings are saved in this browser.</p>`,
    },
  ];

  const MOBILE_GUIDE_PAGES = [
    {
      title: "Score goals",
      html: `
        <p>Grab a joystick and play 1v1 on one screen.</p>
        <ul>
          <li><b>P1</b> attacks the <b>right</b> goal. <b>P2</b> attacks the <b>left</b> goal.</li>
          <li>First to <b>5 goals</b> wins. Higher score after 2:30 wins.</li>
          <li>A tie at full time goes to sudden death.</li>
        </ul>`,
    },
    {
      title: "Move and shoot",
      html: `
        <p>Push your joystick to move. There is no kick button.</p>
        <ul>
          <li>Run into the ball to push it. Your angle and speed send it.</li>
          <li>Walls bounce the ball and cut <b>25%</b> of its speed.</li>
          <li>Both players move at <b>90% of sprint speed</b>. Sprint, stamina, and dash are off on touch.</li>
        </ul>`,
    },
    {
      title: "Smash",
      html: `
        <p>Smash is your power move.</p>
        <ul>
          <li>If both players touch the ball within <b>0.12s</b>, it fires away at top speed.</li>
          <li>Try pinching the ball between both players.</li>
          <li>If the ball stays in a corner for 2 seconds, it resets to the center.</li>
        </ul>`,
    },
    {
      title: "Touch controls",
      html: `
        <p>Use the joysticks on screen.</p>
        <ul>
          <li><b>P1</b> uses the left joystick. <b>P2</b> uses the right joystick.</li>
          <li>In <b>Play vs AI</b>, only the left joystick appears; the CPU controls P2.</li>
          <li>Push the stick fully for top speed.</li>
          <li>Tap <b>Menu</b> in the top-left to leave a match.</li>
        </ul>`,
    },
  ];

  function createMenuUI(input, match, settings, onStart, isMobile) {
    if (
      typeof document === "undefined" ||
      typeof document.createElement !== "function" ||
      !document.body
    ) {
      return null;
    }

    const pages = isMobile ? MOBILE_GUIDE_PAGES : GUIDE_PAGES;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const button = (className, text) => {
      const node = el("button", className, text);
      node.type = "button";
      node.tabIndex = -1;
      return node;
    };

    const menuBackdrop = el("div", "menu-backdrop");
    menuBackdrop.hidden = true;
    const menuPanel = el("div", "menu-panel");
    menuBackdrop.appendChild(menuPanel);

    menuPanel.appendChild(el("p", "menu-kicker", "1P vs AI · 2P local"));
    menuPanel.appendChild(el("h1", "menu-title", "TOP-DOWN SOCCER"));
    menuPanel.appendChild(
      el(
        "p",
        "menu-subtitle",
        isMobile
          ? "First to 5 · 2:30 · touch joysticks"
          : "First to 5 · 2:30 · one keyboard",
      ),
    );

    const playAButton = button("menu-play", "Play vs AI");
    playAButton.addEventListener("click", (event) => {
      event.stopPropagation();
      startGame("ai");
    });
    menuPanel.appendChild(playAButton);

    const playLocalButton = button("menu-button", "2 Players");
    playLocalButton.addEventListener("click", (event) => {
      event.stopPropagation();
      startGame("2p");
    });
    menuPanel.appendChild(playLocalButton);

    const guideButton = button("menu-button", "How to Play");
    guideButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openGuide();
    });
    menuPanel.appendChild(guideButton);

    if (!isMobile && settings) {
      const controlsButton = button("menu-button", "Controls");
      controlsButton.addEventListener("click", (event) => {
        event.stopPropagation();
        if (settings) settings.open();
      });
      menuPanel.appendChild(controlsButton);
    }

    menuPanel.appendChild(
      el(
        "p",
        "menu-footer",
        isMobile
          ? "Use the on-screen joysticks · Menu to leave a match"
          : "M menu · O controls · P pause · R restart",
      ),
    );

    const guideBackdrop = el("div", "guide-backdrop");
    guideBackdrop.hidden = true;
    const guidePanel = el("div", "guide-panel");
    guideBackdrop.appendChild(guidePanel);

    const guideHead = el("div", "guide-head");
    guideHead.appendChild(el("h1", "guide-heading", "How to Play"));
    const guideCount = el("span", "guide-count", "");
    guideHead.appendChild(guideCount);
    guidePanel.appendChild(guideHead);

    const guideTitle = el("h2", "guide-title", "");
    guidePanel.appendChild(guideTitle);

    const guideBody = el("div", "guide-body", "");
    guidePanel.appendChild(guideBody);

    const dotRow = el("div", "guide-dots");
    const dots = [];
    for (let i = 0; i < pages.length; i++) {
      const dot = button("guide-dot", "");
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        setPage(i);
      });
      dotRow.appendChild(dot);
      dots.push(dot);
    }
    guidePanel.appendChild(dotRow);

    const guideActions = el("div", "guide-actions");
    const backButton = button("settings-button", "Back to menu");
    backButton.addEventListener("click", (event) => {
      event.stopPropagation();
      backToMenu();
    });
    guideActions.appendChild(backButton);

    const navGroup = el("div", "guide-nav-group");
    const prevButton = button("settings-button guide-nav", "Prev");
    prevButton.addEventListener("click", (event) => {
      event.stopPropagation();
      prevPage();
    });
    const nextButton = button("settings-button guide-nav", "Next");
    nextButton.addEventListener("click", (event) => {
      event.stopPropagation();
      nextPage();
    });
    navGroup.appendChild(prevButton);
    navGroup.appendChild(nextButton);
    guideActions.appendChild(navGroup);
    guidePanel.appendChild(guideActions);

    const menuToggle = button("menu-toggle", isMobile ? "Menu" : "Menu (M)");
    menuToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      openMenu();
    });

    document.body.appendChild(menuToggle);
    document.body.appendChild(menuBackdrop);
    document.body.appendChild(guideBackdrop);

    let screen = "closed";
    let page = 0;

    const blurActive = () => {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    };

    function renderPage() {
      const data = pages[page];
      guideTitle.textContent = data.title;
      guideBody.innerHTML = data.html;
      guideCount.textContent = `${page + 1} / ${pages.length}`;
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle("active", i === page);
      }
      prevButton.disabled = page === 0;
      nextButton.disabled = page === pages.length - 1;
    }

    function setPage(index) {
      page = Math.max(0, Math.min(pages.length - 1, index));
      renderPage();
      input.clear();
    }

    function openMenu() {
      screen = "menu";
      menuBackdrop.hidden = false;
      guideBackdrop.hidden = true;
      menuToggle.hidden = true;
      blurActive();
      input.clear();
    }

    function openGuide() {
      screen = "guide";
      page = 0;
      renderPage();
      menuBackdrop.hidden = true;
      guideBackdrop.hidden = false;
      menuToggle.hidden = true;
      blurActive();
      input.clear();
    }

    function backToMenu() {
      screen = "menu";
      menuBackdrop.hidden = false;
      guideBackdrop.hidden = true;
      blurActive();
      input.clear();
    }

    function close() {
      screen = "closed";
      menuBackdrop.hidden = true;
      guideBackdrop.hidden = true;
      menuToggle.hidden = false;
      blurActive();
      input.clear();
    }

    function startGame(mode) {
      close();
      if (onStart) onStart(mode);
    }

    function nextPage() {
      if (page < pages.length - 1) setPage(page + 1);
    }

    function prevPage() {
      if (page > 0) setPage(page - 1);
    }

    guideBackdrop.addEventListener("click", (event) => {
      if (event.target === guideBackdrop) backToMenu();
    });

    return {
      get isOpen() {
        return screen !== "closed";
      },
      get screen() {
        return screen;
      },
      openMenu,
      close,
      backToMenu,
      nextPage,
      prevPage,
    };
  }

  function createSettingsUI(input, match) {
    if (
      typeof document === "undefined" ||
      typeof document.createElement !== "function" ||
      !document.body
    ) {
      return null;
    }

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const backdrop = el("div", "settings-backdrop");
    backdrop.hidden = true;

    const panel = el("div", "settings-panel");
    backdrop.appendChild(panel);

    panel.appendChild(el("h1", null, "Controls"));
    panel.appendChild(
      el(
        "p",
        "settings-hint",
        "Click a binding, then press the key you want. Esc cancels. Press O or Esc to close.",
      ),
    );

    const grid = el("div", "settings-grid");
    grid.appendChild(el("div", "settings-cell settings-head"));
    grid.appendChild(el("div", "settings-cell settings-head settings-p1", "P1"));
    grid.appendChild(el("div", "settings-cell settings-head settings-p2", "P2"));
    panel.appendChild(grid);

    const rows = [];
    for (const action of ACTIONS) {
      grid.appendChild(el("div", "settings-cell settings-label", ACTION_LABELS[action]));

      for (let p = 0; p < 2; p++) {
        const button = el("button", `bind-btn settings-p${p + 1}-btn`);
        button.type = "button";
        button.tabIndex = -1;
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          startCapture(p, action);
        });
        grid.appendChild(button);
        rows.push({ p, action, button });
      }
    }

    const message = el("p", "settings-message");
    panel.appendChild(message);

    const actions = el("div", "settings-actions");
    panel.appendChild(actions);

    const resetButton = el("button", "settings-button", "Reset defaults");
    resetButton.type = "button";
    resetButton.tabIndex = -1;
    resetButton.addEventListener("click", (event) => {
      event.stopPropagation();
      resetControls();
    });
    actions.appendChild(resetButton);

    const closeButton = el("button", "settings-button", "Close");
    closeButton.type = "button";
    closeButton.tabIndex = -1;
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      close();
    });
    actions.appendChild(closeButton);

    const toggle = el("button", "settings-toggle", "Controls (O)");
    toggle.type = "button";
    toggle.tabIndex = -1;
    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      open();
    });

    document.body.appendChild(toggle);
    document.body.appendChild(backdrop);

    let isOpen = false;
    let capturing = null;

    const blurActive = () => {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    };

    function setMessage(text) {
      message.textContent = text || "";
    }

    function refresh() {
      for (const { p, action, button } of rows) {
        const active = capturing && capturing.p === p && capturing.action === action;
        button.classList.toggle("listening", Boolean(active));
        button.textContent = active
          ? "Press a key..."
          : keyLabel(match.players[p].controls[action]);
      }
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      capturing = null;
      setMessage("");
      refresh();
      backdrop.hidden = false;
      toggle.hidden = true;
      blurActive();
      input.clear();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      capturing = null;
      backdrop.hidden = true;
      toggle.hidden = false;
      blurActive();
      input.clear();
      saveControls(match.players.map((player) => ({ ...player.controls })));
    }

    function resetControls() {
      const defaults = cloneDefaults();
      applyControls(match, defaults);
      saveControls(defaults);
      capturing = null;
      setMessage("Defaults restored.");
      refresh();
    }

    function startCapture(p, action) {
      capturing = { p, action };
      setMessage("");
      blurActive();
      refresh();
    }

    function onCaptureKey(event) {
      if (!isOpen || !capturing) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      if (event.code === "Escape") {
        capturing = null;
        setMessage("");
        refresh();
        return;
      }

      if (RESERVED_KEYS.has(event.code)) {
        setMessage("That key is reserved. Try another.");
        return;
      }

      const controls = [
        match.players[0].controls,
        match.players[1].controls,
      ];
      const conflict = findConflict(
        controls,
        capturing.p,
        capturing.action,
        event.code,
      );

      if (conflict) {
        setMessage(`${keyLabel(event.code)} is already used for ${conflict}.`);
        return;
      }

      match.players[capturing.p].controls[capturing.action] = event.code;
      saveControls(match.players.map((player) => ({ ...player.controls })));
      capturing = null;
      setMessage("");
      refresh();
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });

    window.addEventListener("keydown", onCaptureKey, true);

    return {
      get isOpen() {
        return isOpen;
      },
      open,
      close,
    };
  }

  class TouchController {
    constructor(joystick) {
      this.joystick = joystick;
    }

    getMove() {
      return this.joystick.getVector();
    }

    isDown() {
      return false;
    }

    consumePressed() {
      return false;
    }

    endFrame() {}

    clear() {
      this.joystick.reset();
    }
  }

  function detectMobile() {
    try {
      if (typeof window === "undefined") return false;
      if (
        typeof URLSearchParams !== "undefined" &&
        window.location &&
        window.location.search
      ) {
        const params = new URLSearchParams(window.location.search);
        if (params.has("mobile")) return true;
        if (params.has("desktop")) return false;
      }
      if (!window.matchMedia) return false;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      return Boolean(
        typeof navigator !== "undefined" &&
          navigator.maxTouchPoints > 0 &&
          window.matchMedia("(hover: none)").matches,
      );
    } catch {
      return false;
    }
  }

  function createJoysticks() {
    if (
      typeof document === "undefined" ||
      typeof document.createElement !== "function" ||
      !document.body
    ) {
      return null;
    }

    const make = (side, label) => {
      const root = document.createElement("div");
      root.className = `joystick joystick-${side}`;
      const base = document.createElement("div");
      base.className = "joystick-base";
      const knob = document.createElement("div");
      knob.className = "joystick-knob";
      base.appendChild(knob);
      const name = document.createElement("span");
      name.className = "joystick-label";
      name.textContent = label;
      root.appendChild(base);
      root.appendChild(name);
      document.body.appendChild(root);

      const state = { x: 0, y: 0, active: false, pointerId: null };
      let maxTravel = 1;

      const setKnob = (dx, dy) => {
        knob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
      };
      const reset = () => {
        state.x = 0;
        state.y = 0;
        state.active = false;
        state.pointerId = null;
        setKnob(0, 0);
      };
      const update = (clientX, clientY) => {
        const rect = base.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        maxTravel = (rect.width / 2) * 0.62;
        let dx = clientX - cx;
        let dy = clientY - cy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxTravel && dist > 0) {
          dx = (dx / dist) * maxTravel;
          dy = (dy / dist) * maxTravel;
        }
        setKnob(dx, dy);
        const nx = dx / maxTravel;
        const ny = dy / maxTravel;
        if (Math.hypot(nx, ny) < 0.12) {
          state.x = 0;
          state.y = 0;
        } else {
          state.x = nx;
          state.y = ny;
        }
      };
      const onDown = (event) => {
        if (state.active) return;
        state.active = true;
        state.pointerId = event.pointerId;
        if (base.setPointerCapture) {
          try {
            base.setPointerCapture(event.pointerId);
          } catch {}
        }
        event.preventDefault();
        update(event.clientX, event.clientY);
      };
      const onMove = (event) => {
        if (!state.active || event.pointerId !== state.pointerId) return;
        event.preventDefault();
        update(event.clientX, event.clientY);
      };
      const onUp = (event) => {
        if (!state.active || event.pointerId !== state.pointerId) return;
        if (base.releasePointerCapture) {
          try {
            base.releasePointerCapture(event.pointerId);
          } catch {}
        }
        reset();
      };

      base.addEventListener("pointerdown", onDown);
      base.addEventListener("pointermove", onMove);
      base.addEventListener("pointerup", onUp);
      base.addEventListener("pointercancel", onUp);
      base.addEventListener("lostpointercapture", onUp);
      base.addEventListener("contextmenu", (event) => event.preventDefault());
      setKnob(0, 0);

      return {
        getVector() {
          return { x: state.x, y: state.y };
        },
        reset,
        setVisible(visible) {
          root.hidden = !visible;
          if (!visible) reset();
        },
      };
    };

    return {
      left: make("left", "P1"),
      right: make("right", "P2"),
      setVisible(leftVisible, rightVisible) {
        this.left.setVisible(leftVisible);
        this.right.setVisible(rightVisible);
      },
    };
  }

  function createRestartButton(parent, onRestart) {
    if (
      !parent ||
      typeof document === "undefined" ||
      typeof document.createElement !== "function"
    ) {
      return null;
    }

    const button = document.createElement("button");
    button.className = "restart-button";
    button.type = "button";
    button.tabIndex = -1;
    button.textContent = "Play Again";
    button.hidden = true;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (button.blur) button.blur();
      onRestart();
    });
    parent.appendChild(button);
    return button;
  }

  function boot() {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const input = new Input();
    const match = new Match(input);
    applyControls(match, loadControls());

    const isMobile = detectMobile();
    const joysticks = isMobile ? createJoysticks() : null;
    const touch1 = joysticks ? new TouchController(joysticks.left) : null;
    const touch2 = joysticks ? new TouchController(joysticks.right) : null;
    const mobileControls = Boolean(isMobile && touch1 && touch2);

    const STEP = 1 / 120;
    let scale = 1;
    let paused = false;
    let last = performance.now();
    let acc = 0;

    const ai = new AIController(match, 1);
    let mode = "ai";

    function applyMode() {
      for (const player of match.players) player.mobile = mobileControls;

      if (mobileControls) {
        match.setController(0, touch1);
        if (mode === "ai") {
          match.setController(1, ai);
          match.players[1].name = "AI";
          joysticks.setVisible(true, false);
        } else {
          match.setController(1, touch2);
          match.players[1].name = "P2";
          joysticks.setVisible(true, true);
        }
        return;
      }

      if (mode === "ai") {
        match.setController(1, ai);
        match.players[1].name = "AI";
      } else {
        match.setController(1, input);
        match.players[1].name = "P2";
      }
    }

    function startFromMenu(nextMode) {
      const changed = nextMode !== mode;
      mode = nextMode;
      applyMode();
      if (changed || match.state === "ended") match.reset();
      paused = false;
      last = performance.now();
      acc = 0;
    }

    applyMode();

    const wrap = canvas.parentElement || document.body;
    let restartButton = null;

    function restartMatch() {
      match.reset();
      paused = false;
      last = performance.now();
      acc = 0;
      input.clear();
      if (restartButton) restartButton.hidden = true;
    }

    restartButton = createRestartButton(wrap, restartMatch);

    const settings = mobileControls ? null : createSettingsUI(input, match);
    const menu = createMenuUI(
      input,
      match,
      settings,
      startFromMenu,
      mobileControls,
    );
    if (menu) menu.openMenu();

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      scale = (rect.width / WORLD.w) * dpr;
    }

    function drawPause() {
      const { w, h } = WORLD;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 56px system-ui, sans-serif";
      ctx.fillText("PAUSED", w / 2, h / 2 - 10);
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("Press P or Esc to resume", w / 2, h / 2 + 40);
      ctx.restore();
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const settingsOpen = !!(settings && settings.isOpen);
      const menuOpen = !!(menu && menu.isOpen);

      if (settingsOpen) {
        if (input.consumePressed("KeyO") || input.consumePressed("Escape")) {
          settings.close();
        }
      } else if (menuOpen) {
        if (menu.screen === "guide") {
          if (input.consumePressed("Escape")) {
            menu.backToMenu();
          } else if (input.consumePressed("KeyM")) {
            menu.close();
          } else {
            if (input.consumePressed("ArrowRight")) menu.nextPage();
            if (input.consumePressed("ArrowLeft")) menu.prevPage();
          }
        } else {
          if (input.consumePressed("KeyO") && settings) {
            settings.open();
          } else if (
            input.consumePressed("Escape") ||
            input.consumePressed("KeyM")
          ) {
            menu.close();
          }
        }
      } else {
        if (input.consumePressed("KeyM") && menu) {
          menu.openMenu();
        } else {
          if (input.consumePressed("KeyO") && settings) {
            settings.open();
          }
          if (input.consumePressed("KeyR")) {
            restartMatch();
          }
          if (input.consumePressed("KeyP") || input.consumePressed("Escape")) {
            paused = !paused;
          }
        }

        if (
          !paused &&
          !(settings && settings.isOpen) &&
          !(menu && menu.isOpen)
        ) {
          acc += dt;
          let steps = 0;
          while (acc >= STEP && steps < 10) {
            match.update(STEP);
            acc -= STEP;
            steps += 1;
          }
          if (steps >= 10) acc = 0;
        }
      }

      input.endFrame();

      if (restartButton) {
        restartButton.hidden = !(
          match.state === "ended" &&
          !paused &&
          !(settings && settings.isOpen) &&
          !(menu && menu.isOpen)
        );
      }

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, WORLD.w, WORLD.h);
      draw(ctx, match, now / 1000);

      if (
        paused &&
        !(settings && settings.isOpen) &&
        !(menu && menu.isOpen)
      ) {
        drawPause();
      }

      requestAnimationFrame(frame);
    }

    window.addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
  }

  globalThis.Soccer = {
    Match,
    Input,
    Player,
    Ball,
    Effects,
    WORLD,
    FIELD,
    MATCH,
    GOAL,
    COMBO,
    STUN,
    SPRINT,
    MOBILE,
    DASH,
    MOBILE_GUIDE_PAGES,
    AIController,
    ACTIONS,
    ACTION_LABELS,
    DEFAULT_CONTROLS,
    keyLabel,
    sanitizeControls,
    findConflict,
    applyControls,
    canDash,
    draw,
  };

  if (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    document.getElementById("game")
  ) {
    boot();
  }
})();
