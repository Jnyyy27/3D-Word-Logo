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

let theta = [0, 0, 0];
let isAnimating = false;
let animSeq = 1;
let animPath = 1;

const defaultSpeed = 0.5;
const defaultDepth = 0.3;
const defaultSpacing = 0.2;

let animationSpeed = defaultSpeed;
let extrusionDepth = defaultDepth;
let letterSpacing = defaultSpacing;

let scaleValue = 1;
const scaleLimits = { min: 0.7, max: 1.4 };

let translationOffset = [0, 0, 0];
const translationLimit = 1.2;
const translationStepMultiplier = 0.02;

let startBtn;
let translationControl;
let translationXSlider;
let translationYSlider;
let translationManualOverride = false;

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

  // Calculate total width: T(1.0) + gap + E(0.8) + gap + C(0.8) + gap + H(0.8)
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
  translationControl = document.getElementById("translationControl");
  translationXSlider = document.getElementById("translateXSlider");
  translationYSlider = document.getElementById("translateYSlider");
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
  // populate min/max labels next to sliders (sequence: min - slider - max)
  function populateMinMax(id) {
    try {
      const input = document.getElementById(id);
      const minSpan = document.getElementById(id + 'Min');
      const maxSpan = document.getElementById(id + 'Max');
      if (input && minSpan) minSpan.innerText = input.min;
      if (input && maxSpan) maxSpan.innerText = input.max;
    } catch (err) {
      // ignore missing elements
    }
  }

  populateMinMax('spacingSlider');
  populateMinMax('depthSlider');
  populateMinMax('speedSlider');

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
      // If switching back from single or rainbow, restore the original per-letter defaults
      if (prevMode === "single" || prevMode === "rainbow") {
        colorT = defaultColorT.slice();
        colorE = defaultColorE.slice();
        colorC = defaultColorC.slice();
        colorH = defaultColorH.slice();
        // Update the per-letter color pickers to reflect the restored defaults
        try {
          document.getElementById("colorPickerT").value = colorToHex(defaultColorT);
          document.getElementById("colorPickerE").value = colorToHex(defaultColorE);
          document.getElementById("colorPickerC").value = colorToHex(defaultColorC);
          document.getElementById("colorPickerH").value = colorToHex(defaultColorH);
        } catch (err) {
          // ignore if elements not present yet
        }
      } else {
        // normal per-letter: read current picker values
        try {
          colorT = hexToColor(document.getElementById("colorPickerT").value);
          colorE = hexToColor(document.getElementById("colorPickerE").value);
          colorC = hexToColor(document.getElementById("colorPickerC").value);
          colorH = hexToColor(document.getElementById("colorPickerH").value);
        } catch (err) {
          // ignore if elements not present
        }
      }
    }
    refreshGeometryBuffers();
  });

  document.getElementById("singleColorPicker").addEventListener("input", (e) => {
    if (colorMode === "single") {
      applySingleColor();
      console.log('singleColorPicker changed — applying single color and refreshing buffers');
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
            [1.0, 0.0, 0.0, 1.0],    // Red
            [1.0, 0.5, 0.0, 1.0],    // Orange
            [1.0, 1.0, 0.0, 1.0],    // Yellow
            [0.0, 1.0, 0.0, 1.0],    // Green
        ];
        colorT = rainbowColors[0];
        colorE = rainbowColors[1];
        colorC = rainbowColors[2];
        colorH = rainbowColors[3];
    }

  // Helper: convert hex string "#rrggbb" to RGBA array [r,g,b,1]
  function hexToColor(hex) {
    return [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255,
      1.0,
    ];
  }

  // Helper: convert RGBA array [r,g,b,a] to hex string "#rrggbb"
  function colorToHex(col) {
    const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, "0");
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
        if (animSeq === 0) animSeq = 1;
        disableUI();
        startBtn.innerText = "Stop Animation";
      } else {
        enableUI();
        startBtn.innerText = "Start Animation";
      }
    });
  }

  if (translationXSlider) {
    translationXSlider.addEventListener("input", (e) => {
      if (animPath !== 5) return;
      translationManualOverride = true;
      translationOffset[0] = parseFloat(e.target.value);
    });
  }

  if (translationYSlider) {
    translationYSlider.addEventListener("input", (e) => {
      if (animPath !== 5) return;
      translationManualOverride = true;
      translationOffset[1] = parseFloat(e.target.value);
    });
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetDefaults();
    enableUI(); 
    refreshGeometryBuffers();
    
  });
  document.getElementById("animPath").addEventListener("change", (e) => {
    animPath = parseInt(e.target.value);
    animSeq = 1;
    theta = [0, 0, 0];
    if (animPath !== 4) {
      scaleValue = 1;
    }
    if (animPath !== 5) {
      translationOffset = [0, 0, 0];
      translationManualOverride = false;
      if (translationXSlider) translationXSlider.value = 0;
      if (translationYSlider) translationYSlider.value = 0;
      if (translationControl) translationControl.style.display = "none";
      if (translationXSlider) translationXSlider.disabled = true;
      if (translationYSlider) translationYSlider.disabled = true;
    } else {
      translationManualOverride = true;
      if (translationControl) translationControl.style.display = "block";
      if (translationXSlider) {
        translationXSlider.disabled = false;
        translationXSlider.value = translationOffset[0];
      }
      if (translationYSlider) {
        translationYSlider.disabled = false;
        translationYSlider.value = translationOffset[1];
      }
    }
    refreshGeometryBuffers();
});
}

function resetDefaults() {
  
    isAnimating = false;
    theta = [0, 0, 0];
    animSeq = 1;
    animPath = 1;
    scaleValue = 1;
    translationOffset = [0, 0, 0];
    translationManualOverride = false;

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
    if (translationControl) translationControl.style.display = "none";
    if (translationXSlider) {
      translationXSlider.value = 0;
      translationXSlider.disabled = true;
    }
    if (translationYSlider) {
      translationYSlider.value = 0;
      translationYSlider.disabled = true;
    }
}

function aniUpdate() {
  switch (animPath) {
    case 1: // Default path
        switch(animSeq){

          case 1:
            theta[1] += animationSpeed;
            if (theta[1] >= 180) {
              theta[1]= 180;
              animSeq++;
            }
            break;

          case 2:
            theta[1] -= animationSpeed;
            if (theta[1] <= 0) {
              theta[1]= 0;
              animSeq++;
            }
            break;

          case 3:
            theta[1] -= animationSpeed;
            if (theta[1] <= -180) {
              theta[1]= -180;
              animSeq++;
            }
            break;

          case 4:
            theta[1] += animationSpeed;
            if (theta[1] >= 0) {
              theta[1]= 0;
              animSeq++;
            }
            break;

          case 5:
            theta[1] += animationSpeed;
            if (theta[1] >= 180) {
              theta[1]= 180;
              animSeq++;
            }
            break;

          case 6:
            theta[1] += animationSpeed; // slow left/right rotation
        }
        break;

    case 2:
      switch(animSeq){
          case 1:
            theta[0] += animationSpeed;
            if (theta[0] >= 180) {
              theta[0]= 180;
              animSeq++;
            }
            break;

          case 2:
            theta[0] -= animationSpeed;
            if (theta[0] <= 0) {
              theta[0]= 0;
              animSeq++;
            }
            break;

          case 3:
            theta[0] -= animationSpeed;
            if (theta[0] <= -180) {
              theta[0]= -180;
              animSeq++;
            }
            break;

          case 4:
            theta[0] += animationSpeed;
            if (theta[0] >= 0) {
              theta[0]= 0;
              animSeq++;
            }
            break;

          case 5:
            theta[0] += animationSpeed;
            if (theta[0] >= 180) {
              theta[0]= 180;
              animSeq++;
            }
            break;

          case 6:
            theta[0] += animationSpeed; // slow left/right rotation
        }
        break;
        
    case 3:
      switch(animSeq){
          case 1:
            theta[2] += animationSpeed;
            if (theta[2] >= 180) {
              theta[2]= 180;
              animSeq++;
            }
            break;

          case 2:
            theta[2] -= animationSpeed;
            if (theta[2] <= 0) {
              theta[2]= 0;
              animSeq++;
            }
            break;

          case 3:
            theta[2] -= animationSpeed;
            if (theta[2] <= -180) {
              theta[2]= -180;
              animSeq++;
            }
            break;

          case 4:
            theta[2] += animationSpeed;
            if (theta[2] >= 0) {
              theta[2]= 0;
              animSeq++;
            }
            break;

          case 5:
            theta[2] += animationSpeed;
            if (theta[2] >= 180) {
              theta[2]= 180;
              animSeq++;
            }
            break;

          case 6:
            theta[2] += animationSpeed; // slow left/right rotation
        }
        break;
    
    case 4: {
      const scaleStep = 0.005 * animationSpeed;
      switch (animSeq) {
        case 1:
          scaleValue += scaleStep;
          if (scaleValue >= scaleLimits.max) {
            scaleValue = scaleLimits.max;
            animSeq = 2;
          }
          break;
        case 2:
          scaleValue -= scaleStep;
          if (scaleValue <= 1) {
            scaleValue = 1;
            animSeq = 3;
          }
          break;
        case 3:
          scaleValue -= scaleStep;
          if (scaleValue <= scaleLimits.min) {
            scaleValue = scaleLimits.min;
            animSeq = 4;
          }
          break;
        case 4:
          scaleValue += scaleStep;
          if (scaleValue >= 1) {
            scaleValue = 1;
            animSeq = 1;
          }
          break;
        default:
          animSeq = 1;
      }
      break;
    }

    case 5: {
      if (translationManualOverride) {
        break;
      }
      const moveStep = translationStepMultiplier * animationSpeed;
      switch (animSeq) {
        case 1:
          translationOffset[0] += moveStep;
          if (translationOffset[0] >= translationLimit) {
            translationOffset[0] = translationLimit;
            animSeq = 2;
          }
          break;
        case 2:
          translationOffset[0] -= moveStep;
          if (translationOffset[0] <= 0) {
            translationOffset[0] = 0;
            animSeq = 3;
          }
          break;
        case 3:
          translationOffset[0] -= moveStep;
          if (translationOffset[0] <= -translationLimit) {
            translationOffset[0] = -translationLimit;
            animSeq = 4;
          }
          break;
        case 4:
          translationOffset[0] += moveStep;
          if (translationOffset[0] >= 0) {
            translationOffset[0] = 0;
            animSeq = 5;
          }
          break;
        case 5:
          translationOffset[1] += moveStep;
          if (translationOffset[1] >= translationLimit * 0.7) {
            translationOffset[1] = translationLimit * 0.7;
            animSeq = 6;
          }
          break;
        case 6:
          translationOffset[1] -= moveStep;
          if (translationOffset[1] <= 0) {
            translationOffset[1] = 0;
            animSeq = 1;
          }
          break;
        default:
          animSeq = 1;
      }
      break;
    }
  }
}
// -------------------------
// RENDER LOOP
// -------------------------
function disableUI()
{
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

function enableUI()
{
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
  if (isAnimating) aniUpdate();

  // Use orthographic projection instead of perspective
  const aspect = canvas.width / canvas.height;
  projectionMatrix = ortho(-3 * aspect, 3 * aspect, -3, 3, -10, 10);
  gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

  // Model-view matrix with rotations
  modelViewMatrix = mat4();
  modelViewMatrix = mult(modelViewMatrix, translate(0, 0, 0));
  modelViewMatrix = mult(modelViewMatrix, rotateX(theta[0]));
  modelViewMatrix = mult(modelViewMatrix, rotateY(theta[1]));
  modelViewMatrix = mult(modelViewMatrix, rotateZ(theta[2]));

  gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
  gl.drawArrays(gl.TRIANGLES, 0, points.length);

  requestAnimFrame(render);
}