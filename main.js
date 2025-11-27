"use strict";

// ----------------------------------------------------------------------------
// GLOBAL CONSTANTS
// ----------------------------------------------------------------------------
const ORTHO_HALF_HEIGHT = 2.5; // must match the values used in render()
const defaultSpeed = 0.5;
const defaultDepth = 0.3;
const defaultSpacing = 0.2;
const TECH_HEIGHT = 1.0; // "height = 1.0" in buildTECH()


// ----------------------------------------------------------------------------
// GLOBAL VARIABLES
// ----------------------------------------------------------------------------
// WebGL context and Geometry
let gl;
let canvas;
let points = [];
let colors = [];
let vBuffer, cBuffer;

// Matrices
let modelViewMatrix, projectionMatrix;
let modelViewMatrixLoc, projectionMatrixLoc;

// Animation state
let theta = [0, 0, 0]; // [x, y, z]
let translationOffset = [0, 0, 0];
let translationVelocity = [0.02, 0.015];
let isAnimating = false;
let animPath = 1;   // 1 = original, 2 = reverse, 3 = playground
let animSeq = 1;    // 1..7 inside animation sequence
let stageFrameCount = 0; // counts frames in current stage
let scaleValue = 1;

// Control parameters
let animationSpeed = defaultSpeed;
let extrusionDepth = defaultDepth;
let letterSpacing = defaultSpacing;

// UI elements
let startBtn;

// Individual letter colors - more vibrant
let colorT = [193 / 255, 58 / 255, 242 / 255, 1.0]; // Purple
let colorE = [61 / 255, 72 / 255, 230 / 255, 1.0]; // Blue
let colorC = [60 / 255, 211 / 255, 180 / 255, 1.0]; // Cyan/Turquoise
let colorH = [226 / 255, 235 / 255, 152 / 255, 1.0]; // Light Yellow/Green
let bgColor = [0 / 255, 0 / 255, 0 / 255, 1.0]; // Black
let colorMode = "per-letter"; // Default color mode

// Keep a copy of the original defaults so we can restore them
const defaultColorT = colorT.slice();
const defaultColorE = colorE.slice();
const defaultColorC = colorC.slice();
const defaultColorH = colorH.slice();
// Remember the default single-color picker hex so Reset can restore it
let defaultSingleColorHex = null;


// ----------------------------------------------------------------------------
// Centralized function
// ----------------------------------------------------------------------------
function getTotalWordWidth() {
  const letterWidth = 0.8;
  const gap = letterSpacing;
  // T(1.0) + gap + E(0.8) + gap + C(0.8) + gap + H(0.8)
  return 1.0 + gap + letterWidth + gap + letterWidth + gap + letterWidth;
}

// Maximum scale so that the word still stays fully inside the ortho projection
function getMaxScaleToFit() {
  const aspect = canvas.width / canvas.height;

  const orthoHalfHeight = ORTHO_HALF_HEIGHT;
  const orthoHalfWidth = ORTHO_HALF_HEIGHT * aspect;

  const halfWordWidth = getTotalWordWidth() / 2;
  const halfWordHeight = TECH_HEIGHT / 2;

  const maxScaleX = orthoHalfWidth / halfWordWidth;
  const maxScaleY = orthoHalfHeight / halfWordHeight;

  return Math.min(maxScaleX, maxScaleY);
}

// ----------------------------------------------------------------------------
// Simple scale matrix helper (MV.js lacks scalem)
// ----------------------------------------------------------------------------
function scalem(x, y, z) {
  const result = mat4();
  result[0][0] = x;
  result[1][1] = y;
  result[2][2] = z;
  return result;
}

// ----------------------------------------------------------------------------
// BOX HELPER - EACH FACE GETS DIFFERENT COLOR
// ----------------------------------------------------------------------------
function createBox(x, y, z, w, h, d, baseColor) {
  const vertices = [
    vec4(x, y, z, 1.0),
    vec4(x + w, y, z, 1.0),
    vec4(x + w, y + h, z, 1.0),
    vec4(x, y + h, z, 1.0),

    vec4(x, y, z + d, 1.0),
    vec4(x + w, y, z + d, 1.0),
    vec4(x + w, y + h, z + d, 1.0),
    vec4(x, y + h, z + d, 1.0),
  ];

  // Generate 6 different colors based on the base color
  const frontColor = [
    baseColor[0] * 0.7,
    baseColor[1] * 0.7,
    Math.min(baseColor[2] * 1.4 + 0.3, 1.0),
    1.0,
  ];

  const rightColor = [
    Math.min(baseColor[0] * 1.2 + 0.2, 1.0),
    baseColor[1] * 0.9,
    Math.min(baseColor[2] * 0.8, 1.0),
    1.0,
  ];

  const leftColor = [
    baseColor[0] * 0.8,
    Math.min(baseColor[1] * 1.3, 1.0),
    baseColor[2] * 0.9,
    1.0,
  ];

  const topColor = [
    Math.min(baseColor[0] * 0.9 + 0.3, 1.0),
    Math.min(baseColor[1] * 1.1 + 0.2, 1.0),
    baseColor[2] * 0.85,
    1.0,
  ];

  const backColor = baseColor;

  const bottomColor = [
    baseColor[0] * 0.6,
    Math.min(baseColor[1] * 0.8 + 0.2, 1.0),
    baseColor[2] * 0.6,
    1.0,
  ];

  const faces = [
    [1, 0, 3, 1, 3, 2], // front
    [2, 3, 7, 2, 7, 6], // right
    [3, 0, 4, 3, 4, 7], // left
    [6, 5, 1, 6, 1, 2], // top
    [5, 6, 7, 5, 7, 4], // back
    [0, 1, 5, 0, 5, 4], // bottom
  ];

  const faceColors = [
    frontColor,
    rightColor,
    leftColor,
    topColor,
    backColor,
    bottomColor,
  ];

  for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
    const f = faces[faceIdx];
    const faceColor = faceColors[faceIdx];
    for (let i = 0; i < f.length; i++) {
      points.push(vertices[f[i]]);
      colors.push(faceColor);
    }
  }
}

// ----------------------------------------------------------------------------
// BUILD 3D TECH LETTERS
// ----------------------------------------------------------------------------
function buildTECH() {
  points = [];
  colors = [];

  const thickness = 0.2;
  const height = TECH_HEIGHT;
  const letterWidth = 0.8;
  const gap = letterSpacing;

  // Total width: T(1.0) + gap + E(0.8) + gap + C(0.8) + gap + H(0.8)
  const totalWidth =
    1.0 + gap + letterWidth + gap + letterWidth + gap + letterWidth;

  // Start from the left edge so the word is centered horizontally and vertically
  let x = -totalWidth / 2;
  const yOffset = -height / 2; // Center vertically

  // ---- T ----
  createBox(
    x,
    yOffset + height - thickness,
    0,
    1.0,
    thickness,
    extrusionDepth,
    colorT
  );
  createBox(
    x + 0.375,
    yOffset,
    0,
    thickness,
    height - thickness,
    extrusionDepth,
    colorT
  );
  x += 1.0 + gap;

  // ---- E ----
  createBox(x, yOffset, 0, thickness, height, extrusionDepth, colorE);
  createBox(
    x,
    yOffset + 0.8,
    0,
    letterWidth,
    thickness,
    extrusionDepth,
    colorE
  );
  createBox(
    x,
    yOffset + 0.4,
    0,
    letterWidth * 0.7,
    thickness,
    extrusionDepth,
    colorE
  );
  createBox(x, yOffset, 0, letterWidth, thickness, extrusionDepth, colorE);
  x += letterWidth + gap;

  // ---- C ----
  createBox(x, yOffset, 0, thickness, height, extrusionDepth, colorC);
  createBox(
    x,
    yOffset + 0.8,
    0,
    letterWidth,
    thickness,
    extrusionDepth,
    colorC
  );
  createBox(x, yOffset, 0, letterWidth, thickness, extrusionDepth, colorC);
  x += letterWidth + gap;

  // ---- H ----
  createBox(x, yOffset, 0, thickness, height, extrusionDepth, colorH);
  createBox(
    x + letterWidth - thickness,
    yOffset,
    0,
    thickness,
    height,
    extrusionDepth,
    colorH
  );
  createBox(
    x,
    yOffset + 0.4,
    0,
    letterWidth,
    thickness,
    extrusionDepth,
    colorH
  );
}

// ----------------------------------------------------------------------------
// INITIALIZE WEBGL
// ----------------------------------------------------------------------------
window.onload = function init() {
  getUIElement();
  configWebGL();
  render();
};

// ----------------------------------------------------------------------------
// GET UI ELEMENTS AND SETUP EVENT LISTENERS
// ----------------------------------------------------------------------------
function getUIElement() {

  canvas = document.getElementById("gl-canvas");
  startBtn = document.getElementById("startBtn");

  function populateMinMax(id) {
    try {
      const input = document.getElementById(id);
      const minSpan = document.getElementById(id + "Min");
      const maxSpan = document.getElementById(id + "Max");
      if (input && minSpan) minSpan.innerText = input.min;
      if (input && maxSpan) maxSpan.innerText = input.max;
    } catch (err) {}
  }

  populateMinMax("spacingSlider");
  populateMinMax("depthSlider");
  populateMinMax("speedSlider");

    document.getElementById("depthSlider").addEventListener("input", (e) => {
    extrusionDepth = parseFloat(e.target.value);
    refreshGeometryBuffers();
  });

  document.getElementById("speedSlider").addEventListener("input", (e) => {
    animationSpeed = parseFloat(e.target.value);
  });

  document.getElementById("spacingSlider").addEventListener("input", (e) => {
    letterSpacing = parseFloat(e.target.value);
    refreshGeometryBuffers();
  });

  document.getElementById("colorPickerT").addEventListener("input", (e) => {
    const hex = e.target.value;
    colorT = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    refreshGeometryBuffers();
  });

  document.getElementById("colorPickerE").addEventListener("input", (e) => {
    const hex = e.target.value;
    colorE = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    refreshGeometryBuffers();
  });

  document.getElementById("colorPickerC").addEventListener("input", (e) => {
    const hex = e.target.value;
    colorC = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    refreshGeometryBuffers();
  });

  document.getElementById("colorPickerH").addEventListener("input", (e) => {
    const hex = e.target.value;
    colorH = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    refreshGeometryBuffers();
  });

  // Capture the default single color hex so Reset can restore it later
  try {
    const single = document.getElementById("singleColorPicker");
    if (single) defaultSingleColorHex = single.value;
  } catch (err) {}

    document.getElementById("colorMode").addEventListener("change", (e) => {
    const prevMode = colorMode;
    colorMode = e.target.value;

    if (colorMode === "single") {
      applySingleColor();
    } else if (colorMode === "rainbow") {
      applyRainbowColors();
    } else if (colorMode === "per-letter") {
      if (prevMode === "single" || prevMode === "rainbow") {
        colorT = defaultColorT.slice();
        colorE = defaultColorE.slice();
        colorC = defaultColorC.slice();
        colorH = defaultColorH.slice();
        try {
          document.getElementById("colorPickerT").value =
            colorToHex(defaultColorT);
          document.getElementById("colorPickerE").value =
            colorToHex(defaultColorE);
          document.getElementById("colorPickerC").value =
            colorToHex(defaultColorC);
          document.getElementById("colorPickerH").value =
            colorToHex(defaultColorH);
        } catch (err) {}
      } else {
        try {
          colorT = hexToColor(document.getElementById("colorPickerT").value);
          colorE = hexToColor(document.getElementById("colorPickerE").value);
          colorC = hexToColor(document.getElementById("colorPickerC").value);
          colorH = hexToColor(document.getElementById("colorPickerH").value);
        } catch (err) {}
      }
    }
    refreshGeometryBuffers();
  });

  document.getElementById("singleColorPicker").addEventListener("input", () => {
    if (colorMode === "single") {
      applySingleColor();
      refreshGeometryBuffers();
    }
  });

  function applySingleColor() {
    const hex = document.getElementById("singleColorPicker").value;
    const col = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    colorT = col.slice();
    colorE = col.slice();
    colorC = col.slice();
    colorH = col.slice();
  }

  function applyRainbowColors() {
    const rainbowColors = [
      [1.0, 0.0, 0.0, 1.0], // Red
      [1.0, 0.5, 0.0, 1.0], // Orange
      [1.0, 1.0, 0.0, 1.0], // Yellow
      [0.0, 1.0, 0.0, 1.0], // Green
    ];
    colorT = rainbowColors[0];
    colorE = rainbowColors[1];
    colorC = rainbowColors[2];
    colorH = rainbowColors[3];

    updateColorPickers([colorT, colorE, colorC, colorH]);
  }

  function updateColorPickers(colors) {
    const pickers = [
      document.getElementById("colorPickerT"),
      document.getElementById("colorPickerE"),
      document.getElementById("colorPickerC"),
      document.getElementById("colorPickerH"),
    ];

    const toHex = (v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0");
    const rgbToHex = (col) =>
      `#${toHex(col[0])}${toHex(col[1])}${toHex(col[2])}`;

    pickers.forEach((picker, i) => {
      if (picker && colors[i]) {
        picker.value = rgbToHex(colors[i]);
        picker.dispatchEvent(new Event("input"));
      }
    });
  }

  function hexToColor(hex) {
    return [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
  }

  function colorToHex(col) {
    const toHex = (v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${toHex(col[0])}${toHex(col[1])}${toHex(col[2])}`;
  }

  document.getElementById("bgColorPicker").addEventListener("input", (e) => {
    const hex = e.target.value;
    bgColor = [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
    gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
  });

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      isAnimating = !isAnimating;
      if (isAnimating) {
        disableUI();
        startBtn.innerText = "Stop Animation";
      } else {
        enableUI();
        startBtn.innerText = "Start Animation";
      }
    });
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetDefaults();
    enableUI();
    refreshGeometryBuffers();
  });

  document.getElementById("animPath").addEventListener("change", (e) => {
    animPath = parseInt(e.target.value, 10);

    // reset animation state when switching sequence
    theta = [0, 0, 0];
    scaleValue = 1;
    translationOffset = [0, 0, 0];
    translationVelocity = [0.02, 0.015];
    stageFrameCount = 0;

    // start from stage 1 for both paths
    animSeq = 1;
  });

  window.addEventListener("keydown", (event) => {
    if (animPath === 1 || animPath === 2) {
      // only active in animation sequence 1
      if (isAnimating) return;

      const key = event.key.toLowerCase();
      switch (key) {
        case "arrowup":
          animationSpeed = Math.min(animationSpeed + 0.1, 5);
          speedSlider.value = animationSpeed;
          break;

        case "arrowdown":
          animationSpeed = Math.max(animationSpeed - 0.1, 0);
          speedSlider.value = animationSpeed;
          break;

        case "arrowright":
          extrusionDepth = Math.min(extrusionDepth + 0.05, 1);
          depthSlider.value = extrusionDepth;
          break;
        case "arrowleft":
          extrusionDepth = Math.max(extrusionDepth - 0.05, 0.1);
          depthSlider.value = extrusionDepth;
          break;

        case "1":
          if (colorMode !== "per-letter") break;
          colorT = randomColor();
          refreshGeometryBuffers();
          try {
            document.getElementById("colorPickerT").value = colorToHex(colorT);
          } catch {}
          break;

        case "2":
          if (colorMode !== "per-letter") break;
          colorE = randomColor();
          refreshGeometryBuffers();
          try {
            document.getElementById("colorPickerE").value = colorToHex(colorE);
          } catch {}
          break;

        case "3":
          if (colorMode !== "per-letter") break;
          colorC = randomColor();
          refreshGeometryBuffers();
          try {
            document.getElementById("colorPickerC").value = colorToHex(colorC);
          } catch {}
          break;

        case "4":
          if (colorMode !== "per-letter") break;
          colorH = randomColor();
          refreshGeometryBuffers();
          try {
            document.getElementById("colorPickerH").value = colorToHex(colorH);
          } catch {}
          break;

        case " ": // spacebar → start/stop
          isAnimating = !isAnimating;
          if (startBtn)
            startBtn.innerText = isAnimating
              ? "Stop Animation"
              : "Start Animation";
          break;

        case "+": // Increase letter spacing
          letterSpacing += 0.05;
          letterSpacing = Math.min(letterSpacing, 1.0); // clamp max
          document.getElementById("spacingSlider").value = letterSpacing;
          refreshGeometryBuffers();
          break;

        case "-": // Decrease letter spacing
          letterSpacing -= 0.05;
          letterSpacing = Math.max(letterSpacing, 0.05); // clamp min
          refreshGeometryBuffers();
          break;
        case "r":
          resetDefaults();
          refreshGeometryBuffers();
          break;
      }

    } else if (animPath == 3) {
      // Playground mode - no animation sequences
      const key = event.key.toLowerCase();
      switch (key) {
        case "arrowleft":
          theta[1] -= 5; // rotate Y left
          break;

        case "arrowright":
          theta[1] += 5; // rotate Y right
          break;

        case "arrowup":
          theta[0] -= 5; // rotate X up
          break;

        case "arrowdown":
          theta[0] += 5; // rotate X down
          break;

        case "a":
          translationOffset[0] -= 0.1;
          break;

        case "d":
          translationOffset[0] += 0.1;
          break;

        case "w":
          translationOffset[1] += 0.1;
          break;

        case "s":
          translationOffset[1] -= 0.1;
          break;

        case "+":
          scaleValue *= 1.05; // zoom in
          break;

        case "-":
          scaleValue *= 0.95; // zoom out
          break;

        case "r":
          resetDefaults();
          refreshGeometryBuffers();
          break;
      }
    }
  });

  const animPathSelect = document.getElementById("animPath");
  const defaultKeys = document.getElementById("defaultKeys");
  const playgroundKeys = document.getElementById("playgroundKeys");

  animPathSelect.addEventListener("change", () => {
    animPath = parseInt(animPathSelect.value, 10);

    if (animPath === 3) {
      defaultKeys.style.display = "none";
      playgroundKeys.style.display = "block";
    } else {
      playgroundKeys.style.display = "none";
      defaultKeys.style.display = "block";
    }
  });
}

// ----------------------------------------------------------------------------
// CONFIGURE WEBGL
// ----------------------------------------------------------------------------
function configWebGL() {
  gl = WebGLUtils.setupWebGL(canvas);

  if (!gl) {
    alert("WebGL isn't available");
    return;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(bgColor[0], bgColor[1], bgColor[2], bgColor[3]);
  gl.enable(gl.DEPTH_TEST);

  buildTECH();

  const program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // VERTEX BUFFER
  vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  const vPos = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPos, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPos);

  // COLOR BUFFER
  cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

  const vCol = gl.getAttribLocation(program, "vColor");
  gl.vertexAttribPointer(vCol, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vCol);

  // MATRICES
  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
}

// ----------------------------------------------------------------------------
// REFRESH GEOMETRY BUFFERS
// ----------------------------------------------------------------------------
function refreshGeometryBuffers() {
  buildTECH();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
}

// ----------------------------------------------------------------------------
// RANDOM COLOR
// ----------------------------------------------------------------------------
function randomColor() {
  return [Math.random(), Math.random(), Math.random(), 1.0];
}  

// ----------------------------------------------------------------------------
// RESET TO DEFAULTS
// ----------------------------------------------------------------------------
function resetDefaults() {
  isAnimating = false;
  theta = [0, 0, 0];
  animPath = 1;
  animSeq = 1;
  stageFrameCount = 0;

  scaleValue = 1;
  translationOffset = [0, 0, 0];
  translationVelocity = [0.02, 0.015];
  defaultKeys.style.display = "block";
  playgroundKeys.style.display = "none";

  animationSpeed = defaultSpeed;
  extrusionDepth = defaultDepth;
  letterSpacing = defaultSpacing;

  document.getElementById("animPath").value = 1;
  document.getElementById("speedSlider").value = defaultSpeed;
  document.getElementById("depthSlider").value = defaultDepth;
  document.getElementById("spacingSlider").value = defaultSpacing;

  if (colorMode === "rainbow") {
        colorT = rainbowColors.slice();
        colorE = rainbowColors.slice();
        colorC = rainbowColors.slice();
        colorH = rainbowColors.slice();
  }else{ // Restore per-letter colors to defaults and update pickers (do not change color mode)
        colorT = defaultColorT.slice();
        colorE = defaultColorE.slice();
        colorC = defaultColorC.slice();
        colorH = defaultColorH.slice();

        try {
          const tPicker = document.getElementById("colorPickerT");
          const ePicker = document.getElementById("colorPickerE");
          const cPicker = document.getElementById("colorPickerC");
          const hPicker = document.getElementById("colorPickerH");

          // Convert RGB array(0-1) to hex string so that it is working
          const toHex = (v) =>
            Math.round(v * 255)
              .toString(16)
              .padStart(2, "0");
          const rgbToHex = (col) => `#${toHex(col[0])}${toHex(col[1])}${toHex(col[2])}`;

          if (tPicker) {
            tPicker.value = rgbToHex(defaultColorT);
            tPicker.dispatchEvent(new Event("input"));
          }
          if (ePicker) {
            ePicker.value = rgbToHex(defaultColorE);
            ePicker.dispatchEvent(new Event("input"));
          }
          if (cPicker) {
            cPicker.value = rgbToHex(defaultColorC);
            cPicker.dispatchEvent(new Event("input"));
          }
          if (hPicker) {
            hPicker.value = rgbToHex(defaultColorH);
            hPicker.dispatchEvent(new Event("input"));
          }
        } catch (err) {}
      }

  // Restore single color picker to its initial value after press reset
  try {
    const single = document.getElementById("singleColorPicker");
    if (single && defaultSingleColorHex) {
      single.value = defaultSingleColorHex;
      single.dispatchEvent(new Event("input"));
    }
  } catch (err) {}

  refreshGeometryBuffers();
  if (startBtn) {
    startBtn.innerText = "Start Animation";
    startBtn.disabled = false;
  }
}

// ----------------------------------------------------------------------------
// Clamp translation so the scaled word never goes outside the screen
// ----------------------------------------------------------------------------
function clampTranslation() {
  const aspect = canvas.width / canvas.height;

  const orthoHalfHeight = ORTHO_HALF_HEIGHT;
  const orthoHalfWidth = ORTHO_HALF_HEIGHT * aspect;

  const halfWordWidth = (getTotalWordWidth() * scaleValue) / 2;
  const halfWordHeight = (TECH_HEIGHT * scaleValue) / 2;

  const maxX = Math.max(0, orthoHalfWidth - halfWordWidth);
  const maxY = Math.max(0, orthoHalfHeight - halfWordHeight);

  translationOffset[0] = Math.min(maxX, Math.max(-maxX, translationOffset[0]));
  translationOffset[1] = Math.min(maxY, Math.max(-maxY, translationOffset[1]));
}

// ----------------------------------------------------------------------------
// MASTER ANIMATION
// animPath 1: original (cases 1–7)
// animPath 2: reverse version of sequence 1
// ----------------------------------------------------------------------------
function aniUpdate() {
  // ==========================================
  // SEQUENCE 1: Rotate -> Scale -> Bounce
  // ==========================================
  if (animPath === 1) {
    switch (animSeq) {
      // 1–4: rotation around Y axis
      case 1:
        theta[1] += animationSpeed;
        if (theta[1] >= 180) {
          theta[1] = 180;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      case 2:
        theta[1] -= animationSpeed;
        if (theta[1] <= 0) {
          theta[1] = 0;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      case 3:
        theta[1] -= animationSpeed;
        if (theta[1] <= -180) {
          theta[1] = -180;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      case 4:
        theta[1] += animationSpeed;
        if (theta[1] >= 0) {
          theta[1] = 0;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      // 5) Enlarge scaling until hitting border
      case 5: {
        const step = 0.01 * animationSpeed;
        const maxScale = getMaxScaleToFit();

        if (stageFrameCount === 0) {
          translationOffset = [0, 0, 0];
          scaleValue = Math.max(1.0, scaleValue);
        }

        if (scaleValue < maxScale) {
          scaleValue += step;
          if (scaleValue >= maxScale) {
            scaleValue = maxScale;
            clampTranslation();
            animSeq++;
            stageFrameCount = 0;
          }
        } else {
          scaleValue = maxScale;
          clampTranslation();
          animSeq++;
          stageFrameCount = 0;
        }
        break;
      }

      // 6) Diminish scaling back to original size
      case 6: {
        const step = 0.01 * animationSpeed;
        translationOffset[0] *= 0.9; // pull to center
        translationOffset[1] *= 0.9;

        if (scaleValue > 1.0) {
          scaleValue -= step;
          if (scaleValue <= 1.0) {
            scaleValue = 1.0;
            animSeq++;
            stageFrameCount = 0;
          }
        } else {
          scaleValue = 1.0;
          animSeq++;
          stageFrameCount = 0;
        }
        break;
      }

      // 7) Bounce around within screen bounds
      case 7: {
        if (stageFrameCount === 0) {
          scaleValue = 1.0;
          translationOffset = [0, 0, 0];
          translationVelocity = [0.02, 0.015];
        }

        // Logic for bouncing
        handleBouncing();

        // Run for set time then Loop back to 1
        const MAX_FRAMES = 600;
        if (stageFrameCount > MAX_FRAMES) {
          translationOffset = [0, 0, 0];
          translationVelocity = [0.02, 0.015];
          animSeq = 1; // LOOP BACK TO START
          stageFrameCount = 0;
        }
        break;
      }
    }
  }

  // ==========================================
  // SEQUENCE 2: REVERSE (Bounce -> Scale -> Rotate)
  // ==========================================
  else if (animPath === 2) {
    switch (animSeq) {
      // 1) Bounce first (Reverse of Seq 1 Case 7)
      case 1: {
        if (stageFrameCount === 0) {
          scaleValue = 1.0;
          translationOffset = [0, 0, 0];
          translationVelocity = [0.02, 0.015];
        }

        handleBouncing();

        // Run for set time then move to Scaling
        const MAX_FRAMES = 600;
        if (stageFrameCount > MAX_FRAMES) {
          // Force return to center before scaling starts
          translationOffset = [0, 0, 0]; 
          animSeq++;
          stageFrameCount = 0;
        }
        break;
      }

      // 2) Scale Up (Reverse of Seq 1 Case 6)
      // Seq 1 Case 6 was Max -> 1.0, so this is 1.0 -> Max
      case 2: {
        const step = 0.01 * animationSpeed;
        const maxScale = getMaxScaleToFit();

        if (stageFrameCount === 0) {
          translationOffset = [0, 0, 0];
          scaleValue = 1.0;
        }

        if (scaleValue < maxScale) {
          scaleValue += step;
          if (scaleValue >= maxScale) {
            scaleValue = maxScale;
            animSeq++;
            stageFrameCount = 0;
          }
        } else {
            animSeq++;
            stageFrameCount = 0;
        }
        break;
      }

      // 3) Scale Down (Reverse of Seq 1 Case 5)
      // Seq 1 Case 5 was 1.0 -> Max, so this is Max -> 1.0
      case 3: {
        const step = 0.01 * animationSpeed;
        
        if (scaleValue > 1.0) {
          scaleValue -= step;
          if (scaleValue <= 1.0) {
            scaleValue = 1.0;
            animSeq++;
            stageFrameCount = 0;
          }
        } else {
          scaleValue = 1.0;
          animSeq++;
          stageFrameCount = 0;
        }
        break;
      }

      // 4) Rotate 0 -> -180 (Reverse of Seq 1 Case 4: -180 -> 0)
      case 4:
        theta[1] -= animationSpeed;
        if (theta[1] <= -180) {
          theta[1] = -180;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      // 5) Rotate -180 -> 0 (Reverse of Seq 1 Case 3: 0 -> -180)
      case 5:
        theta[1] += animationSpeed;
        if (theta[1] >= 0) {
          theta[1] = 0;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      // 6) Rotate 0 -> 180 (Reverse of Seq 1 Case 2: 180 -> 0)
      case 6:
        theta[1] += animationSpeed;
        if (theta[1] >= 180) {
          theta[1] = 180;
          animSeq++;
          stageFrameCount = 0;
        }
        break;

      // 7) Rotate 180 -> 0 (Reverse of Seq 1 Case 1: 0 -> 180)
      case 7:
        theta[1] -= animationSpeed;
        if (theta[1] <= 0) {
          theta[1] = 0;
          animSeq = 1; // LOOP BACK TO START OF SEQ 2
          stageFrameCount = 0;
        }
        break;
    }
  }

  stageFrameCount++;
}

// Helper function to keep code clean (extracted from old Case 7 logic)
function handleBouncing() {
  const aspect = canvas.width / canvas.height;
  const orthoHalfHeight = ORTHO_HALF_HEIGHT;
  const orthoHalfWidth = ORTHO_HALF_HEIGHT * aspect;

  const halfWordWidth = getTotalWordWidth() / 2;
  const halfWordHeight = TECH_HEIGHT / 2;

  const maxX = Math.max(0, orthoHalfWidth - halfWordWidth);
  const maxY = Math.max(0, orthoHalfHeight - halfWordHeight);

  translationOffset[0] += translationVelocity[0] * animationSpeed;
  translationOffset[1] += translationVelocity[1] * animationSpeed;

  // bounce at borders
  if (translationOffset[0] > maxX) {
    translationOffset[0] = maxX;
    translationVelocity[0] *= -1;
  } else if (translationOffset[0] < -maxX) {
    translationOffset[0] = -maxX;
    translationVelocity[0] *= -1;
  }

  if (translationOffset[1] > maxY) {
    translationOffset[1] = maxY;
    translationVelocity[1] *= -1;
  } else if (translationOffset[1] < -maxY) {
    translationOffset[1] = -maxY;
    translationVelocity[1] *= -1;
  }
}

// ----------------------------------------------------------------------------
// DISABLE / ENABLE UI CONTROLS
// ----------------------------------------------------------------------------
function disableUI() {
  document.getElementById("depthSlider").disabled = true;
  document.getElementById("speedSlider").disabled = true;
  document.getElementById("spacingSlider").disabled = true;
  document.getElementById("colorPickerT").disabled = true;
  document.getElementById("colorPickerE").disabled = true;
  document.getElementById("colorPickerC").disabled = true;
  document.getElementById("colorPickerH").disabled = true;
  document.getElementById("bgColorPicker").disabled = true;
  document.getElementById("animPath").disabled = true;
  document.getElementById("singleColorPicker").disabled = true;
  document.getElementById("colorMode").disabled = true;
}

function enableUI() {
  document.getElementById("depthSlider").disabled = false;
  document.getElementById("speedSlider").disabled = false;
  document.getElementById("spacingSlider").disabled = false;
  document.getElementById("colorPickerT").disabled = false;
  document.getElementById("colorPickerE").disabled = false;
  document.getElementById("colorPickerC").disabled = false;
  document.getElementById("colorPickerH").disabled = false;
  document.getElementById("bgColorPicker").disabled = false;
  document.getElementById("animPath").disabled = false;
  document.getElementById("singleColorPicker").disabled = false;
  document.getElementById("colorMode").disabled = false;
}

// ----------------------------------------------------------------------------
// RENDER LOOP
// ----------------------------------------------------------------------------
function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (isAnimating) {
    aniUpdate();
    clampTranslation(); // always keep in bounds
  }

  // orthographic projection (MUST match ORTHO_HALF_HEIGHT)
  const aspect = canvas.width / canvas.height;
  projectionMatrix = ortho(
    -ORTHO_HALF_HEIGHT * aspect,
    ORTHO_HALF_HEIGHT * aspect,
    -ORTHO_HALF_HEIGHT,
    ORTHO_HALF_HEIGHT,
    -10,
    10
  );
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  // Model-view matrix: translation -> scale -> rotations
  modelViewMatrix = mat4();
  modelViewMatrix = mult(
    modelViewMatrix,
    translate(translationOffset[0], translationOffset[1], translationOffset[2])
  );
  modelViewMatrix = mult(
    modelViewMatrix,
    scalem(scaleValue, scaleValue, scaleValue)
  );
  modelViewMatrix = mult(modelViewMatrix, rotateX(theta[0]));
  modelViewMatrix = mult(modelViewMatrix, rotateY(theta[1]));
  modelViewMatrix = mult(modelViewMatrix, rotateZ(theta[2]));

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.drawArrays(gl.TRIANGLES, 0, points.length);

  requestAnimFrame(render);
}
