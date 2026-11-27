/* Neon Serpent — canvas snake game. Plain vanilla JS, no dependencies. */
(function () {
  'use strict';

  var COLS = 20;
  var ROWS = 20;
  var POINTS = 10;
  var START_LENGTH = 3;
  var BASE_TICK = 140;
  var MIN_TICK = 64;
  var TICK_STEP = 4;
  var BEST_KEY = 'neon-serpent.best';
  var SWIPE_THRESHOLD = 24;

  var PALETTE = {
    board: '#080d14',
    grid: 'rgba(255, 255, 255, 0.045)',
    bodyNear: '#2bf0c8',
    bodyFar: '#0f7a68',
    head: '#7ffff0',
    glow: 'rgba(43, 240, 200, 0.8)',
    food: '#ffc24b',
    foodGlow: 'rgba(255, 194, 75, 0.7)',
    eye: '#04211b'
  };

  var DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };

  var KEY_TO_DIR = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', W: 'up', a: 'left', A: 'left', s: 'down', S: 'down', d: 'right', D: 'right'
  };

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var statusEl = document.getElementById('status');
  var statusTextEl = document.getElementById('statusText');
  var overlayEl = document.getElementById('overlay');
  var overlayKickerEl = document.getElementById('overlayKicker');
  var overlayScoreEl = document.getElementById('overlayScore');
  var scoreLabelEl = document.getElementById('scoreLabel');
  var finalScoreEl = document.getElementById('finalScore');
  var overlayNoteEl = document.getElementById('overlayNote');
  var overlayHintEl = document.getElementById('overlayHint');
  var actionBtn = document.getElementById('actionBtn');

  var snake = [];
  var food = { x: 0, y: 0 };
  var dir = DIRS.right;
  var queue = [];
  var score = 0;
  var best = 0;
  var foodsEaten = 0;
  var tickInterval = BASE_TICK;
  var state = 'ready';
  var accumulator = 0;
  var lastFrame = 0;
  var boardSize = 600;
  var cell = boardSize / COLS;

  /* ---------- Persistence ---------- */

  function readBest() {
    try {
      var raw = window.localStorage.getItem(BEST_KEY);
      var value = parseInt(raw, 10);
      return isFinite(value) && value > 0 ? value : 0;
    } catch (err) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (err) {
      /* Storage unavailable (private mode); the session still works. */
    }
  }

  /* ---------- Setup ---------- */

  function reset() {
    var cy = Math.floor(ROWS / 2);
    var cx = Math.floor(COLS / 2) - 1;
    snake = [];
    for (var i = 0; i < START_LENGTH; i++) {
      snake.push({ x: cx - i, y: cy });
    }
    dir = DIRS.right;
    queue = [];
    score = 0;
    foodsEaten = 0;
    tickInterval = BASE_TICK;
    accumulator = 0;
    placeFood();
    updateHud();
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < ROWS; y++) {
      for (var x = 0; x < COLS; x++) {
        if (!occupied(x, y)) free.push({ x: x, y: y });
      }
    }
    if (!free.length) return false;
    food = free[Math.floor(Math.random() * free.length)];
    return true;
  }

  function occupied(x, y) {
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === x && snake[i].y === y) return true;
    }
    return false;
  }

  /* ---------- State transitions ---------- */

  function startGame() {
    if (state === 'playing') return;
    if (state === 'over') reset();
    state = 'playing';
    accumulator = 0;
    lastFrame = performance.now();
    hideOverlay();
    updateHud();
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    showOverlay({
      kicker: 'Paused',
      scoreLabel: 'Score',
      score: score,
      note: '',
      button: 'Resume game',
      hint: 'Press Space or P to resume'
    });
    updateHud();
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    accumulator = 0;
    lastFrame = performance.now();
    hideOverlay();
    updateHud();
  }

  function restartGame() {
    reset();
    state = 'playing';
    accumulator = 0;
    lastFrame = performance.now();
    hideOverlay();
    updateHud();
  }

  function gameOver(won) {
    state = 'over';
    var isBest = score > best;
    if (isBest) {
      best = score;
      writeBest(best);
    }
    showOverlay({
      kicker: won ? 'Board cleared' : 'Game over',
      scoreLabel: 'Final score',
      score: score,
      note: isBest && score > 0 ? 'New best' : '',
      button: 'Restart game',
      hint: 'Press R or Enter to play again'
    });
    updateHud();
  }

  function togglePause() {
    if (state === 'playing') {
      pauseGame();
    } else if (state === 'paused') {
      resumeGame();
    } else if (state === 'ready') {
      startGame();
    } else {
      restartGame();
    }
  }

  /* ---------- Direction handling ---------- */

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function enqueueDirection(name) {
    var next = DIRS[name];
    if (!next) return false;
    // Compare against the last queued turn, or the current heading when the
    // queue is empty, so the snake can never reverse into its own neck.
    var reference = queue.length ? queue[queue.length - 1] : dir;
    if (isOpposite(next, reference)) return false;
    if (next.x === reference.x && next.y === reference.y) return false;
    if (queue.length >= 2) return false;
    queue.push({ x: next.x, y: next.y });
    return true;
  }

  function steer(name) {
    if (state === 'ready') {
      startGame();
    } else if (state === 'paused') {
      resumeGame();
    } else if (state === 'over') {
      return;
    }
    enqueueDirection(name);
  }

  /* ---------- Simulation ---------- */

  function step() {
    if (queue.length) {
      dir = queue.shift();
    }

    var head = snake[0];
    var next = { x: head.x + dir.x, y: head.y + dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      gameOver();
      return;
    }

    var growing = next.x === food.x && next.y === food.y;
    var body = growing ? snake : snake.slice(0, -1);
    for (var i = 0; i < body.length; i++) {
      if (body[i].x === next.x && body[i].y === next.y) {
        gameOver();
        return;
      }
    }

    snake.unshift(next);

    if (growing) {
      score += POINTS;
      foodsEaten += 1;
      tickInterval = Math.max(MIN_TICK, BASE_TICK - foodsEaten * TICK_STEP);
      if (score > best) {
        best = score;
        writeBest(best);
      }
      if (!placeFood()) {
        gameOver(true);
        return;
      }
      updateHud();
    } else {
      snake.pop();
    }
  }

  /* ---------- Rendering ---------- */

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var size = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    boardSize = size;
    cell = size / COLS;
  }

  function roundedRectPath(context, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    if (context.roundRect) {
      context.roundRect(x, y, w, h, radius);
      return;
    }
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function drawGrid() {
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 1; i < COLS; i++) {
      var x = Math.round(i * cell) + 0.5;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, boardSize);
    }
    for (var j = 1; j < ROWS; j++) {
      var y = Math.round(j * cell) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(boardSize, y);
    }
    ctx.stroke();
  }

  function drawFood(time) {
    var cx = (food.x + 0.5) * cell;
    var cy = (food.y + 0.5) * cell;
    var pulse = 0.5 + 0.5 * Math.sin(time / 260);
    var radius = cell * (0.28 + pulse * 0.05);

    ctx.save();
    ctx.shadowColor = PALETTE.foodGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = PALETTE.food;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake() {
    if (!snake.length) return;

    var head = snake[0];
    var tail = snake[snake.length - 1];
    var inset = cell * 0.06;
    var size = cell - inset * 2;
    var radius = size * 0.28;

    var gradient = ctx.createLinearGradient(
      head.x * cell,
      head.y * cell,
      tail.x * cell,
      tail.y * cell
    );
    gradient.addColorStop(0, PALETTE.bodyNear);
    gradient.addColorStop(1, PALETTE.bodyFar);

    ctx.save();
    ctx.shadowColor = PALETTE.glow;
    ctx.shadowBlur = 14;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    for (var i = snake.length - 1; i >= 0; i--) {
      roundedRectPath(
        ctx,
        snake[i].x * cell + inset,
        snake[i].y * cell + inset,
        size,
        size,
        radius
      );
    }
    ctx.fill();
    ctx.restore();

    // Head plate sits on top of the body so the facing is readable.
    ctx.save();
    ctx.shadowColor = PALETTE.glow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = PALETTE.head;
    ctx.beginPath();
    roundedRectPath(ctx, head.x * cell + inset, head.y * cell + inset, size, size, radius);
    ctx.fill();
    ctx.restore();

    var perp = { x: -dir.y, y: dir.x };
    var forward = { x: dir.x, y: dir.y };
    var eyeOffset = cell * 0.19;
    var eyeRadius = Math.max(1.5, cell * 0.075);
    ctx.fillStyle = PALETTE.eye;
    for (var side = -1; side <= 1; side += 2) {
      ctx.beginPath();
      ctx.arc(
        (head.x + 0.5) * cell + forward.x * eyeOffset + perp.x * side * eyeOffset,
        (head.y + 0.5) * cell + forward.y * eyeOffset + perp.y * side * eyeOffset,
        eyeRadius,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  function render(time) {
    ctx.fillStyle = PALETTE.board;
    ctx.fillRect(0, 0, boardSize, boardSize);
    drawGrid();
    drawFood(time);
    drawSnake();
  }

  function frame(time) {
    var delta = time - lastFrame;
    lastFrame = time;

    if (state === 'playing') {
      accumulator += delta;
      while (accumulator >= tickInterval) {
        accumulator -= tickInterval;
        step();
        if (state !== 'playing') break;
      }
    }

    render(time);
    window.requestAnimationFrame(frame);
  }

  /* ---------- HUD and overlay ---------- */

  function updateHud() {
    scoreEl.textContent = String(score);
    bestEl.textContent = String(best);
    var labels = {
      ready: 'Ready',
      playing: 'Running',
      paused: 'Paused',
      over: 'Game over'
    };
    statusEl.dataset.state = state;
    statusTextEl.textContent = labels[state];
  }

  function showOverlay(options) {
    overlayKickerEl.textContent = options.kicker;
    scoreLabelEl.textContent = options.scoreLabel;
    finalScoreEl.textContent = String(options.score);
    overlayNoteEl.textContent = options.note || '';
    overlayNoteEl.hidden = !options.note;
    actionBtn.textContent = options.button;
    overlayHintEl.textContent = options.hint;
    overlayEl.hidden = false;
    actionBtn.focus({ preventScroll: true });
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  /* ---------- Input ---------- */

  function onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    var key = event.key;
    var lower = key.length === 1 ? key.toLowerCase() : key;
    var name = KEY_TO_DIR[lower] || KEY_TO_DIR[key];
    if (name) {
      event.preventDefault();
      steer(name);
      return;
    }

    var onButton = event.target && event.target.closest && event.target.closest('button');

    if (key === ' ' || key === 'Spacebar' || lower === 'p') {
      // Space activates a focused button natively; don't fight it.
      if (onButton) return;
      event.preventDefault();
      togglePause();
      return;
    }

    if (lower === 'r') {
      event.preventDefault();
      restartGame();
      return;
    }

    if (key === 'Enter') {
      if (onButton) return;
      if (state === 'over' || state === 'ready') {
        event.preventDefault();
        state === 'over' ? restartGame() : startGame();
      }
    }
  }

  function bindDpad() {
    var dpad = document.getElementById('dpad');
    if (!dpad) return;
    var buttons = dpad.querySelectorAll('[data-dir]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('pointerdown', function (event) {
        event.preventDefault();
        steer(button.dataset.dir);
      });
      button.addEventListener('click', function () {
        steer(button.dataset.dir);
      });
    });
  }

  function bindSwipe() {
    var origin = null;

    canvas.addEventListener('pointerdown', function (event) {
      origin = { x: event.clientX, y: event.clientY };
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (err) {
          /* capture is optional */
        }
      }
    });

    canvas.addEventListener('pointermove', function (event) {
      if (!origin) return;
      var dx = event.clientX - origin.x;
      var dy = event.clientY - origin.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        steer(dx > 0 ? 'right' : 'left');
      } else {
        steer(dy > 0 ? 'down' : 'up');
      }
      origin = { x: event.clientX, y: event.clientY };
    });

    function end() {
      origin = null;
    }

    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);
  }

  /* ---------- Boot ---------- */

  best = readBest();
  reset();
  resize();

  if (window.ResizeObserver) {
    new window.ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  window.addEventListener('keydown', onKeyDown);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'playing') pauseGame();
  });

  actionBtn.addEventListener('click', function () {
    if (state === 'paused') {
      resumeGame();
    } else if (state === 'over') {
      restartGame();
    } else {
      startGame();
    }
  });

  bindDpad();
  bindSwipe();
  showOverlay({
    kicker: 'Ready',
    scoreLabel: 'Best',
    score: best,
    note: '',
    button: 'Start game',
    hint: 'Arrow keys, WASD, or swipe to steer'
  });

  window.requestAnimationFrame(function (time) {
    lastFrame = time;
    window.requestAnimationFrame(frame);
  });
})();
