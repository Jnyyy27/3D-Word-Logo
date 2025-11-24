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

let angle = 0;
let animationSpeed = 0.7;
let extrusionDepth = 0.3;
let isAnimating = false;
let letterSpacing = 0.2;

// Individual letter colors - more vibrant
let colorT = [193 / 255, 58 / 255, 242 / 255, 1.0]; // Purple
let colorE = [61 / 255, 72 / 255, 230 / 255, 1.0]; // Blue
let colorC = [60 / 255, 211 / 255, 180 / 255, 1.0]; // Cyan/Turquoise
let colorH = [226 / 255, 235 / 255, 152 / 255, 1.0]; // Light Yellow/Green
let bgColor = [245 / 255, 229 / 255, 229 / 255, 1.0]; // Light Pink

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
  // Each face will have a unique hue shift
  const frontColor = [
    baseColor[0] * 0.7,
    baseColor[1] * 0.7,
    Math.min(baseColor[2] * 1.4 + 0.3, 1.0),
    1.0,
  ]; // Original color - facing camera

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
    frontColor, // front - original color
    rightColor, // right - shifted hue
    leftColor, // left - different shift
    topColor, // top - distinct color
    backColor, // back - unique color
    bottomColor, // bottom - another variation
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
  const height = 1.0;
  const letterWidth = 0.8;
  const gap = letterSpacing;

  let x = -2.0;

  // ---- T ----
  createBox(x, height - thickness, 0, 1.0, thickness, extrusionDepth, colorT);
  createBox(
    x + 0.375,
    0,
    0,
    thickness,
    height - thickness,
    extrusionDepth,
    colorT
  );
  x += 1.0 + gap;

  // ---- E ----
  createBox(x, 0, 0, thickness, height, extrusionDepth, colorE);
  createBox(x, 0.8, 0, letterWidth, thickness, extrusionDepth, colorE);
  createBox(x, 0.4, 0, letterWidth * 0.7, thickness, extrusionDepth, colorE);
  createBox(x, 0, 0, letterWidth, thickness, extrusionDepth, colorE);
  x += letterWidth + gap;

  // ---- C ----
  createBox(x, 0, 0, thickness, height, extrusionDepth, colorC);
  createBox(x, 0.8, 0, letterWidth, thickness, extrusionDepth, colorC);
  createBox(x, 0, 0, letterWidth, thickness, extrusionDepth, colorC);
  x += letterWidth + gap;

  // ---- H ----
  createBox(x, 0, 0, thickness, height, extrusionDepth, colorH);
  createBox(
    x + letterWidth - thickness,
    0,
    0,
    thickness,
    height,
    extrusionDepth,
    colorH
  );
  createBox(x, 0.4, 0, letterWidth, thickness, extrusionDepth, colorH);
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

  projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100);
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

function setupUIEventListeners() {
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

  document.getElementById("startBtn").addEventListener("click", () => {
    isAnimating = true;
  });

  document.getElementById("stopBtn").addEventListener("click", () => {
    isAnimating = false;
  });
}

// -------------------------
// RENDER LOOP
// -------------------------
function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  if (isAnimating) angle += animationSpeed;

  const eye = vec3(0, 1.5, 6);
  const at = vec3(0, 0.5, 0);
  const up = vec3(0, 1, 0);

  modelViewMatrix = lookAt(eye, at, up);
  modelViewMatrix = mult(modelViewMatrix, rotateY(angle));

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.drawArrays(gl.TRIANGLES, 0, points.length);

  requestAnimFrame(render);
}
