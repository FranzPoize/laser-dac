import WebsocketClient from './websocket.js';
import dat from './dat.gui.js';

class SimulatorOptions {
  constructor() {
    this.positionDelay = 0;
    this.afterglowAmount = 30;
    this.xyResolution = 1;
    this.numberOfPoints = '';
    this.totalPoints = '';
    this.showBlanking = false;
    this.showDots = false;
    this.forceTotalRender = true;
  }
}

const options = new SimulatorOptions();
var gui = new dat.GUI();
gui.add(options, 'positionDelay', 0, 10).step(1);
gui.add(options, 'afterglowAmount', 0, 300);
gui.add(options, 'showBlanking');
gui.add(options, 'showDots');
gui.add(options, 'forceTotalRender');
gui.add(options, 'xyResolution', 0, 1);
gui.add(options, 'numberOfPoints').listen();
gui.add(options, 'totalPoints').listen();
gui.width = 300;

let points = [];
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let lastRenderTime;

function handleResize() {
  const pixelRatio = window.devicePixelRatio;

  ctx.scale(pixelRatio, pixelRatio);
  canvas.width = Math.floor(canvas.clientWidth * pixelRatio);
  canvas.height = Math.floor(canvas.clientHeight * pixelRatio);
  ctx.lineWidth = pixelRatio;
}
handleResize();
window.onresize = handleResize;

// Listen to changes in device pixel ratio.
window
  .matchMedia('screen and (min-resolution: 2dppx)')
  .addListener(handleResize);

function calculateRelativePosition(position) {
  return position / options.xyResolution;
}

function calculateColor(raw) {
  return Math.round(raw * 255);
}

function render() {
  const currentTime = new Date();
  if (lastRenderTime) {
    const frameInterval = currentTime - lastRenderTime;
    // We add variable afterglow depending on the time until the last render.
    ctx.fillStyle = `rgba(0, 0, 0, ${
      options.afterglowAmount ? frameInterval / options.afterglowAmount : 1
    })`;
  }
  lastRenderTime = currentTime;

  // This rectangle will use the afterglow style from the code above.
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  points.forEach(function (point, i) {
    // To simulate the behaviour of an actual laser, controlling the color
    // of the lasers is faster than moving the scanners to a position.
    // "Accurate and Efficient Drawing Method for Laser Projection" describes this as:
    // "... the command ‘turn on beam’ takes less time to execute than the actual ‘jump’ command."
    const colorIndex = i + options.positionDelay;
    const color =
      points[colorIndex < points.length ? colorIndex : points.length - 1];

    // Prevent drawing unnecessary lines.
    const isBlanking = !color || !(color.r || color.g || color.b);
    if ((!options.showBlanking && isBlanking) || i === 0) return;
    const previousPoint = points[i - 1];
    if (previousPoint.x === point.x && previousPoint.y === point.y) return;

    ctx.beginPath();
    ctx.moveTo(
      calculateRelativePosition(previousPoint.x) * canvas.width,
      calculateRelativePosition(previousPoint.y) * canvas.height
    );
    const canvasPointX = calculateRelativePosition(point.x) * canvas.width;
    const canvasPointY = calculateRelativePosition(point.y) * canvas.height;
    const canvasColor = `rgb(${calculateColor(color.r)}, ${calculateColor(
      color.g
    )}, ${calculateColor(color.b)})`;
    ctx.lineTo(canvasPointX, canvasPointY);

    if (isBlanking) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    } else {
      ctx.strokeStyle = canvasColor;
    }
    ctx.stroke();
    if (options.showDots && !isBlanking) {
      ctx.fillStyle = canvasColor;
      ctx.beginPath();
      ctx.arc(canvasPointX, canvasPointY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  requestAnimationFrame(render);
}
requestAnimationFrame(render);

const host = window.document.location.host.replace(/:.*/, '');
const ws = new WebsocketClient();
ws.open('ws://' + host + ':3002');
ws.onmessage = function (event) {
  const payload = JSON.parse(event.data);
  if (payload.type === 'POINTS') {
    if (options.forceTotalRender) {
      points = points.concat(payload.data);
      points = points.slice(Math.max(points.length - options.totalPoints, 0));
    } else {
      points = payload.data;
    }
    return;
  }
  if (payload.type === 'POINTS_INFO') {
    options.numberOfPoints = String(payload.data.numpoints);
    options.totalPoints = String(payload.data.totalPoints);
  }
};


const wsInput = new WebsocketClient();
wsInput.open('ws://' + host + ':8321');

// add event listeners for key handling
window.addEventListener("keyup", (e) => handleOnKeyup(e, wsInput))
window.addEventListener("keydown", (e) => handleOnKeydown(e, wsInput))


function handleOnKeydown(e, ws) {
  console.log(e.key);
  e.preventDefault();
  switch (e.key) {
    /* Modifiers */
    case "Control"   : ws.send("mod-control^1"); break;
    case "Shift"     : ws.send("mod-shift^1"); break;
    case "Meta"      : ws.send("mod-meta^1"); break;
    case "Alt"       : ws.send("mod-alt^1"); break;
    /* Plain */
    case "9"         : ws.send("switch-to-editor"); break;
    case "0"         : ws.send("switch-to-projection"); break;
    case "1"         : ws.send("add-maskingbox"); break;
    case "2"         : ws.send("add-platform-static"); break;
    case "3"         : ws.send("add-platform-moving"); break;
    case "4"         : ws.send("add-laserspawner"); break;
    case "5"         : ws.send("add-neonboss"); break;
    case "6"         : ws.send("add-animationbox"); break;
    case "Escape"    : ws.send("escape"); break;
    case "Enter"     : ws.send("confirm"); break;
    case " "         : ws.send("edit-next"); ws.send("jump^1"); break;
    case "]"         : ws.send("next"); break;
    case "["         : ws.send("previous"); break;
    case "Backspace" : ws.send("delete"); break;
    case "s"         : ws.send("export"); break;
    case "r"         : ws.send("reset"); break;
    case "ArrowUp"   : ws.send("move-N^1"); break;
    case "ArrowDown" : ws.send("move-S^1"); break;
    case "ArrowLeft" : ws.send("move-W^1"); break;
    case "ArrowRight": ws.send("move-E^1"); break;
    case "m"         : ws.send("move-W^1"); break; /* alternative to 'ArrowLeft' to avoid ghosting on joystick */
    case "i"         : ws.send("scale-down-h^1"); break;
    case "k"         : ws.send("scale-up-h^1"); break;
    case "j"         : ws.send("scale-down-w^1"); break;
    case "l"         : ws.send("scale-up-w^1"); break;
  }
};

function handleOnKeyup(e, ws) {
  e.preventDefault();
  switch (e.key) {
    /* Modifiers */
    case "Control"   : ws.send("mod-control^0"); break;
    case "Shift"     : ws.send("mod-shift^0"); break;
    case "Meta"      : ws.send("mod-meta^0"); break;
    case "Alt"       : ws.send("mod-alt^0"); break;
    /* Plain */
    case " "         : ws.send("jump^0"); break;
    case "ArrowUp"   : ws.send("move-N^0"); break;
    case "ArrowDown" : ws.send("move-S^0"); break;
    case "ArrowLeft" : ws.send("move-W^0"); break;
    case "ArrowRight": ws.send("move-E^0"); break;
    case "m"         : ws.send("move-W^0"); break; /* alternative to 'ArrowLeft' to avoid ghosting on joystick */
    case "i"         : ws.send("scale-down-h^0"); break;
    case "k"         : ws.send("scale-up-h^0"); break;
    case "j"         : ws.send("scale-down-w^0"); break;
    case "l"         : ws.send("scale-up-w^0"); break;
  }
};
