"use strict";

var gl;
var points = [];
var colors = [];

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;

// BOX HELPER --------------------------------------------------
// Create a cuboid at position (x,y,z) with width w, height h, depth d
function createBox(x, y, z, w, h, d, color) {
  let vertices = [
    vec4(x, y, z, 1.0),
    vec4(x + w, y, z, 1.0),
    vec4(x + w, y + h, z, 1.0),
    vec4(x, y + h, z, 1.0),

    vec4(x, y, z + d, 1.0),
    vec4(x + w, y, z + d, 1.0),
    vec4(x + w, y + h, z + d, 1.0),
    vec4(x, y + h, z + d, 1.0),
  ];

  let faces = [
    [1, 0, 3, 1, 3, 2], // front
    [2, 3, 7, 2, 7, 6], // right
    [3, 0, 4, 3, 4, 7], // left
    [0, 1, 5, 0, 5, 4], // bottom
    [5, 6, 7, 5, 7, 4], // back
    [6, 5, 1, 6, 1, 2], // top
  ];

  for (let f of faces) {
    for (let i = 0; i < f.length; i++) {
      points.push(vertices[f[i]]);
      colors.push(color);
    }
  }
}

// --------------------------------------------------------------
// BUILD 3D WORD "TECH"
// Using boxes for each stroke of a letter
// Coordinate system: center at 0. Letters positioned left to right
//---------------------------------------------------------------
function buildTECH() {
  const thickness = 0.2;
  const depth = 0.3;
  const height = 1.0;
  const letterWidth = 0.8;
  const gap = 0.2;

  let x = -2.0; // starting X for the first letter T

  // ---------------- T ----------------
  // top bar
  let wT = 1.0; // total width of the top bar
  let hT = 1.0; // height of the letter
  let tT = 0.25; // thickness of strokes
  let dT = 0.3; // depth

  // Top horizontal bar
  createBox(
    x, // left
    hT - tT, // top bar Y position
    0, // Z
    wT, // full width
    tT, // thickness
    dT,
    vec4(0.5, 0.8, 1.0, 1)
  );

  // Vertical stem — centered
  createBox(
    x + (wT / 2 - tT / 2), // centered
    0, // from bottom
    0,
    tT, // stroke thickness
    hT - tT, // height (minus top bar)
    dT,
    vec4(0.5, 0.8, 1.0, 1)
  );

  // Move cursor for next letter
  x += wT + gap;

  // ---------------- E ----------------
  createBox(x, 0, 0, thickness, height, depth, vec4(1, 0.8, 0.4, 1)); // vertical spine
  createBox(x, 0.8, 0, letterWidth, thickness, depth, vec4(1, 0.8, 0.4, 1)); // top
  createBox(
    x,
    0.4,
    0,
    letterWidth * 0.7,
    thickness,
    depth,
    vec4(1, 0.8, 0.4, 1)
  ); // middle
  createBox(x, 0, 0, letterWidth, thickness, depth, vec4(1, 0.8, 0.4, 1)); // bottom

  x += letterWidth + gap;

  // ---------------- C ----------------
  createBox(x, 0, 0, thickness, height, depth, vec4(0.6, 1, 0.6, 1)); // left
  createBox(x, 0.8, 0, letterWidth, thickness, depth, vec4(0.6, 1, 0.6, 1)); // top
  createBox(x, 0, 0, letterWidth, thickness, depth, vec4(0.6, 1, 0.6, 1)); // bottom

  x += letterWidth + gap;

  // ---------------- H ----------------
  createBox(x, 0, 0, thickness, height, depth, vec4(1, 0.4, 0.4, 1)); // left
  createBox(
    x + letterWidth - thickness,
    0,
    0,
    thickness,
    height,
    depth,
    vec4(1, 0.4, 0.4, 1)
  ); // right
  createBox(x, 0.4, 0, letterWidth, thickness, depth, vec4(1, 0.4, 0.4, 1)); // middle crossbar
}

window.onload = function init() {
  var canvas = document.getElementById("gl-canvas");
  gl = WebGLUtils.setupWebGL(canvas);

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.enable(gl.DEPTH_TEST);

  // Build geometry
  buildTECH();

  // Load shaders
  var program = initShaders(gl, "vertex-shader", "fragment-shader");
  gl.useProgram(program);

  // Load vertex data
  var vBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

  var vPos = gl.getAttribLocation(program, "vPosition");
  gl.vertexAttribPointer(vPos, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vPos);

  // Load color data
  var cBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

  var vCol = gl.getAttribLocation(program, "vColor");
  gl.vertexAttribPointer(vCol, 4, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(vCol);

  // Matrices
  modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
  projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

  projectionMatrix = perspective(45, canvas.width / canvas.height, 0.1, 100);
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  render();
};

var angle = 0;

function render() {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  angle += 0.7;
  var eye = vec3(3, 2, 6);
  var at = vec3(0, 0.5, 0);
  var up = vec3(0, 1, 0);

  modelViewMatrix = lookAt(eye, at, up);
  modelViewMatrix = mult(modelViewMatrix, rotateY(angle));

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));

  gl.drawArrays(gl.TRIANGLES, 0, points.length);

  requestAnimFrame(render);
}
