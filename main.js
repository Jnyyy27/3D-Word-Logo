"use strict";

// -------------------------
// GLOBAL VARIABLES
// -------------------------
let gl;
let points = [];
let colors = [];

let modelViewMatrix, projectionMatrix;
let modelViewMatrixLoc, projectionMatrixLoc;

let angle = 0;
let animationSpeed = 0.7;   // controlled by slider
let extrusionDepth = 0.3;   // controlled by slider
let currentColor = [0.5, 0.8, 1.0, 1.0]; // default color
let isAnimating = true;
let letterSpacing = 0.2;    // controlled by slider

// Individual letter colors
let colorT = [1.0, 0.2, 0.2, 1.0];  // Red
let colorE = [0.2, 1.0, 0.2, 1.0];  // Green
let colorC = [0.2, 0.2, 1.0, 1.0];  // Blue
let colorH = [1.0, 1.0, 0.2, 1.0];  // Yellow
let bgColor = [0.1, 0.1, 0.1, 1.0]; // Background color

// -------------------------
// BOX HELPER WITH GRADIENT
// -------------------------
// function createBox(x, y, z, w, h, d, color) {
//     const vertices = [
//         vec4(x, y, z, 1.0),
//         vec4(x + w, y, z, 1.0),
//         vec4(x + w, y + h, z, 1.0),
//         vec4(x, y + h, z, 1.0),

//         vec4(x, y, z + d, 1.0),
//         vec4(x + w, y, z + d, 1.0),
//         vec4(x + w, y + h, z + d, 1.0),
//         vec4(x, y + h, z + d, 1.0)
//     ];

//     // Create gradient variants of the base color
//     const lighterColor = [
//         Math.min(color[0] + 0.3, 1.0),
//         Math.min(color[1] + 0.3, 1.0),
//         Math.min(color[2] + 0.3, 1.0),
//         color[3]
//     ];

//     const darkerColor = [
//         Math.max(color[0] - 0.2, 0.0),
//         Math.max(color[1] - 0.2, 0.0),
//         Math.max(color[2] - 0.2, 0.0),
//         color[3]
//     ];

//     // Each face gets a gradient from base to lighter color
//     const faces = [
//         [1, 0, 3, 1, 3, 2], // front
//         [2, 3, 7, 2, 7, 6], // right
//         [3, 0, 4, 3, 4, 7], // left
//         [0, 1, 5, 0, 5, 4], // bottom
//         [5, 6, 7, 5, 7, 4], // back
//         [6, 5, 1, 6, 1, 2]  // top
//     ];

//     const faceColors = [
//         [color, color, lighterColor, color, lighterColor, lighterColor],           // front - gradient
//         [lighterColor, color, darkerColor, lighterColor, darkerColor, color],      // right - gradient
//         [color, darkerColor, darkerColor, color, darkerColor, lighterColor],       // left - gradient
//         [darkerColor, darkerColor, color, darkerColor, color, color],              // bottom - gradient
//         [color, lighterColor, lighterColor, color, lighterColor, darkerColor],     // back - gradient
//         [lighterColor, color, color, lighterColor, color, darkerColor]             // top - gradient
//     ];

//     for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
//         const f = faces[faceIdx];
//         const fColors = faceColors[faceIdx];
//         for (let i = 0; i < f.length; i++) {
//             points.push(vertices[f[i]]);
//             colors.push(fColors[i]);
// BOX HELPER WITH VIBRANT GRADIENT
// -------------------------
  function createBox(x, y, z, w, h, d, color) {
      const vertices = [
          vec4(x, y, z, 1.0),
          vec4(x + w, y, z, 1.0),
          vec4(x + w, y + h, z, 1.0),
          vec4(x, y + h, z, 1.0),

          vec4(x, y, z + d, 1.0),
          vec4(x + w, y, z + d, 1.0),
          vec4(x + w, y + h, z + d, 1.0),
          vec4(x, y + h, z + d, 1.0)
      ];

      // Create vibrant gradient variants with complementary hues
      const accentColor = [
          Math.min(color[0] + 0.4, 1.0),
          Math.min(color[1] * 0.7 + 0.3, 1.0),
          Math.min(color[2] + 0.5, 1.0),
          color[3]
      ];

      const deepColor = [
          Math.max(color[0] * 0.4, 0.0),
          Math.max(color[1] * 0.5, 0.0),
          Math.max(color[2] * 0.7, 0.0),
          color[3]
      ];

      const brightColor = [
          Math.min(color[0] * 1.3 + 0.2, 1.0),
          Math.min(color[1] * 1.2 + 0.3, 1.0),
          Math.min(color[2] * 0.8 + 0.4, 1.0),
          color[3]
      ];

      // Each face gets a unique gradient pattern for visual interest
      const faces = [
          [1, 0, 3, 1, 3, 2], // front
          [2, 3, 7, 2, 7, 6], // right
          [3, 0, 4, 3, 4, 7], // left
          [0, 1, 5, 0, 5, 4], // bottom
          [5, 6, 7, 5, 7, 4], // back
          [6, 5, 1, 6, 1, 2]  // top
      ];

      const faceColors = [
          [brightColor, color, accentColor, brightColor, accentColor, brightColor],   // front - bright gradient
          [accentColor, brightColor, color, accentColor, color, deepColor],           // right - warm transition
          [deepColor, color, brightColor, deepColor, brightColor, accentColor],       // left - cool gradient
          [color, deepColor, deepColor, color, color, brightColor],                   // bottom - shadow effect
          [accentColor, brightColor, deepColor, accentColor, deepColor, color],       // back - contrasting
          [brightColor, accentColor, color, brightColor, color, deepColor]            // top - highlight effect
      ];

      for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
          const f = faces[faceIdx];
          const fColors = faceColors[faceIdx];
          for (let i = 0; i < f.length; i++) {
              points.push(vertices[f[i]]);
              colors.push(fColors[i]);
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
    const gap = letterSpacing;  // Use the global letterSpacing variable

    let x = -2.0;

    // ---- T ----
    createBox(x, height - thickness, 0, 1.0, thickness, extrusionDepth, colorT); // top bar
    createBox(x + 0.375, 0, 0, thickness, height - thickness, extrusionDepth, colorT); // stem
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
    createBox(x + letterWidth - thickness, 0, 0, thickness, height, extrusionDepth, colorH);
    createBox(x, 0.4, 0, letterWidth, thickness, extrusionDepth, colorH);
}

// -------------------------
// INITIALIZE WEBGL
// -------------------------
let vBuffer, cBuffer;  // Global buffers

window.onload = function init() {
    const canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
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

    // -------------------------
    // UI EVENT LISTENERS
    // -------------------------

    document.getElementById("depthSlider").addEventListener("input", e => {
        extrusionDepth = parseFloat(e.target.value);
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("speedSlider").addEventListener("input", e => {
        animationSpeed = parseFloat(e.target.value);
    });

    document.getElementById("spacingSlider").addEventListener("input", e => {
        letterSpacing = parseFloat(e.target.value);
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("colorPickerT").addEventListener("input", e => {
        const hex = e.target.value;
        colorT = [
            parseInt(hex.substr(1, 2), 16)/255,
            parseInt(hex.substr(3, 2), 16)/255,
            parseInt(hex.substr(5, 2), 16)/255,
            1.0
        ];
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("colorPickerE").addEventListener("input", e => {
        const hex = e.target.value;
        colorE = [
            parseInt(hex.substr(1, 2), 16)/255,
            parseInt(hex.substr(3, 2), 16)/255,
            parseInt(hex.substr(5, 2), 16)/255,
            1.0
        ];
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("colorPickerC").addEventListener("input", e => {
        const hex = e.target.value;
        colorC = [
            parseInt(hex.substr(1, 2), 16)/255,
            parseInt(hex.substr(3, 2), 16)/255,
            parseInt(hex.substr(5, 2), 16)/255,
            1.0
        ];
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("colorPickerH").addEventListener("input", e => {
        const hex = e.target.value;
        colorH = [
            parseInt(hex.substr(1, 2), 16)/255,
            parseInt(hex.substr(3, 2), 16)/255,
            parseInt(hex.substr(5, 2), 16)/255,
            1.0
        ];
        buildTECH();
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    });

    document.getElementById("startBtn").addEventListener("click", () => {
        isAnimating = true;
    });

    document.getElementById("stopBtn").addEventListener("click", () => {
        isAnimating = false;
    });

    render();
};

// -------------------------
// RENDER LOOP
// -------------------------
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (isAnimating) angle += animationSpeed;

    const eye = vec3(3, 2, 6);
    const at = vec3(0, 0.5, 0);
    const up = vec3(0, 1, 0);

    modelViewMatrix = lookAt(eye, at, up);
    modelViewMatrix = mult(modelViewMatrix, rotateY(angle));

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    requestAnimFrame(render);
}
