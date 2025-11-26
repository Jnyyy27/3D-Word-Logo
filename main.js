"use strict";

// -------------------------
// GLOBAL VARIABLES
// -------------------------
let gl;
let canvas;
let points = [];
let colors = [];
let normals = [];

let modelViewMatrix, projectionMatrix;
let modelViewMatrixLoc, projectionMatrixLoc;

// rotation (Euler angles)
let theta = [0, 0, 0]; // [x, y, z]

// animation control
let isAnimating = false;
let animPath = 1;   // 1 = animation, 2 & 3 reserved (do nothing)
let animSeq = 1;    // 1..7 inside animation sequence 1
let stageFrameCount = 0; // counts frames in current stage

const defaultSpeed = 0.5;
const defaultDepth = 0.3;
const defaultSpacing = 0.2;

let animationSpeed = defaultSpeed;
let extrusionDepth = defaultDepth;
let letterSpacing = defaultSpacing;

// scaling
let scaleValue = 1;
const scaleLimits = { min: 0.7, max: 1.4 };

// translation
let translationOffset = [0, 0, 0];
let translationVelocity = [0.02, 0.015];

// UI elements
let startBtn;

// Individual letter colors - more vibrant
let colorT = [193 / 255, 58 / 255, 242 / 255, 1.0]; // Purple
let colorE = [61 / 255, 72 / 255, 230 / 255, 1.0]; // Blue
let colorC = [60 / 255, 211 / 255, 180 / 255, 1.0]; // Cyan/Turquoise
let colorH = [226 / 255, 235 / 255, 152 / 255, 1.0]; // Light Yellow/Green
let bgColor = [245 / 255, 229 / 255, 229 / 255, 1.0]; // Light Pink
let colorMode = "per-letter"; // Default color mode

// Keep a copy of the original defaults so we can restore them
const defaultColorT = colorT.slice();
const defaultColorE = colorE.slice();
const defaultColorC = colorC.slice();
const defaultColorH = colorH.slice();

// Word geometry helpers
const TECH_HEIGHT = 1.0; // you use "height = 1.0" in buildTECH()

function getTotalWordWidth() {
  const letterWidth = 0.8;
  const gap = letterSpacing;
  // T(1.0) + gap + E(0.8) + gap + C(0.8) + gap + H(0.8)
  return 1.0 + gap + letterWidth + gap + letterWidth + gap + letterWidth;
}

// Maximum scale so that the word still stays fully inside the ortho projection
function getMaxScaleToFit() {
  const aspect = canvas.width / canvas.height;

  // from ortho(-3*aspect, 3*aspect, -3, 3, -10, 10)
  const orthoHalfWidth = 3 * aspect;
  const orthoHalfHeight = 3;

  const halfWordWidth = getTotalWordWidth() / 2;
  const halfWordHeight = TECH_HEIGHT / 2;

  const maxScaleX = orthoHalfWidth / halfWordWidth;
  const maxScaleY = orthoHalfHeight / halfWordHeight;

  return Math.min(maxScaleX, maxScaleY);
}

// Clamp translation so the scaled word never goes outside the screen
function clampTranslation() {
  const aspect = canvas.width / canvas.height;

  const orthoHalfWidth = 3 * aspect;
  const orthoHalfHeight = 3;

  const halfWordWidth = (getTotalWordWidth() * scaleValue) / 2;
  const halfWordHeight = (TECH_HEIGHT * scaleValue) / 2;

  const maxX = Math.max(0, orthoHalfWidth - halfWordWidth);
  const maxY = Math.max(0, orthoHalfHeight - halfWordHeight);

  translationOffset[0] = Math.min(maxX, Math.max(-maxX, translationOffset[0]));
  translationOffset[1] = Math.min(maxY, Math.max(-maxY, translationOffset[1]));
}

// Simple scale matrix helper (MV.js lacks scalem)
function scalem(x, y, z) {
  const result = mat4();
  result[0][0] = x;
  result[1][1] = y;
  result[2][2] = z;
  return result;
}

// -------------------------
// BOX HELPER - EACH FACE GETS DIFFERENT COLOR
// -------------------------
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

// -------------------------
// BUILD 3D TECH LETTERS
// -------------------------
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

// -------------------------
// INITIALIZE WEBGL
// -------------------------
let vBuffer, cBuffer;

window.onload = function init() {
  getUIElement();
  configWebGL();
  render();
};

function getUIElement() {
  canvas = document.getElementById("gl-canvas");
  startBtn = document.getElementById("startBtn");
}

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

  projectionMatrix = ortho(
    -3 * (canvas.width / canvas.height),
    3 * (canvas.width / canvas.height),
    -3,
    3,
    -10,
    10
  );
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  setupUIEventListeners();
}

function refreshGeometryBuffers() {
  buildTECH();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
}

// -------------------------
// UI SETUP
// -------------------------
function setupUIEventListeners() {
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
          colorT = hexToColor(
            document.getElementById("colorPickerT").value
          );
          colorE = hexToColor(
            document.getElementById("colorPickerE").value
          );
          colorC = hexToColor(
            document.getElementById("colorPickerC").value
          );
          colorH = hexToColor(
            document.getElementById("colorPickerH").value
          );
        } catch (err) {}
      }
    }
    refreshGeometryBuffers();
  });

  document
    .getElementById("singleColorPicker")
    .addEventListener("input", () => {
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
    animSeq = 1;
    stageFrameCount = 0;
  });
}

function resetDefaults() {
  isAnimating = false;
  theta = [0, 0, 0];
  animPath = 1;
  animSeq = 1;
  stageFrameCount = 0;

  scaleValue = 1;
  translationOffset = [0, 0, 0];
  translationVelocity = [0.02, 0.015];

  animationSpeed = defaultSpeed;
  extrusionDepth = defaultDepth;
  letterSpacing = defaultSpacing;

  document.getElementById("animPath").value = 1;
  document.getElementById("speedSlider").value = defaultSpeed;
  document.getElementById("depthSlider").value = defaultDepth;
  document.getElementById("spacingSlider").value = defaultSpacing;
  if (startBtn) {
    startBtn.innerText = "Start Animation";
    startBtn.disabled = false;
  }
}

function aniUpdate() {
  // Only animation sequence 1 is active now
  if (animPath !== 1) return;

  switch (animSeq) {
    case 1:
      theta[1] += animationSpeed;
      if (theta[1] >= 180) {
        theta[1] = 180;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;

    case 2:
      theta[1] -= animationSpeed;
      if (theta[1] <= 0) {
        theta[1] = 0;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;

    case 3:
      theta[1] -= animationSpeed;
      if (theta[1] <= -180) {
        theta[1] = -180;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;

    case 4:
      theta[1] += animationSpeed;
      if (theta[1] >= 0) {
        theta[1] = 0;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;

    // 5) Enlarge scaling until hitting border (no outside)
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
          animSeq++;
          if (animSeq > 7) animSeq = 1;
          stageFrameCount = 0;
        }
      } else {
        scaleValue = maxScale;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;
    }

    // 6) Diminish scaling back to original size (center)
    case 6: {
      const step = 0.01 * animationSpeed;
      translationOffset[0] *= 0.9;
      translationOffset[1] *= 0.9;

      if (scaleValue > 1.0) {
        scaleValue -= step;
        if (scaleValue <= 1.0) {
          scaleValue = 1.0;
          animSeq++;
          if (animSeq > 7) animSeq = 1;
          stageFrameCount = 0;
        }
      } else {
        scaleValue = 1.0;
        animSeq++;
        if (animSeq > 7) animSeq = 1;
        stageFrameCount = 0;
      }
      break;
    }

    // 7) Move around within screen bounds (bouncing)
    case 7: {
      if (stageFrameCount === 0) {
        scaleValue = 1.0;
        translationOffset = [0, 0, 0];
        translationVelocity = [0.02, 0.015];
      }

      const aspect = canvas.width / canvas.height;
      const orthoHalfWidth = 3 * aspect;
      const orthoHalfHeight = 3;

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

      // let translation stage run for some time, then loop back to stage 1
      const MAX_FRAMES = 600; // ~10 seconds at 60fps
      if (stageFrameCount > MAX_FRAMES) {
        translationOffset = [0, 0, 0];
        translationVelocity = [0.02, 0.015];
        animSeq = 1;
        stageFrameCount = 0;
      }

      break;
    }
  }

  stageFrameCount++;
}

// -------------------------
// RENDER LOOP
// -------------------------
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
}

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (isAnimating) {
    aniUpdate();
    clampTranslation(); // always keep in bounds
  }

  // orthographic projection
  const aspect = canvas.width / canvas.height;
  projectionMatrix = ortho(-3 * aspect, 3 * aspect, -3, 3, -10, 10);
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
