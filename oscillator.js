// --- Canvas refs ---
const simCanvas = document.getElementById("simCanvas");
const xtCanvas = document.getElementById("xtCanvas");
const phaseCanvas = document.getElementById("phaseCanvas");
const resCanvas = document.getElementById("resCanvas");
const phasePlotCanvas = document.getElementById("phasePlotCanvas");

const simCtx = simCanvas.getContext("2d");
const xtCtx = xtCanvas.getContext("2d");
const phaseCtx = phaseCanvas.getContext("2d");
const resCtx = resCanvas.getContext("2d");
const phasePlotCtx = phasePlotCanvas.getContext("2d");

// --- Preset buttons ---
const dampNoneBtn = document.getElementById("dampNone");
const dampUnderBtn = document.getElementById("dampUnder");
const dampCritBtn = document.getElementById("dampCrit");
const dampOverBtn = document.getElementById("dampOver");
const dampCustomBtn = document.getElementById("dampCustom");

const driveNoneBtn = document.getElementById("driveNone");
const driveOffBtn = document.getElementById("driveOff");
const driveResBtn = document.getElementById("driveRes");
const driveCustomBtn = document.getElementById("driveCustom");

const startStopBtn = document.getElementById("startStopBtn");
const resetBtn = document.getElementById("resetBtn");

const dampingGroup = [dampNoneBtn, dampUnderBtn, dampCritBtn, dampOverBtn, dampCustomBtn];
const drivingGroup = [driveNoneBtn, driveOffBtn, driveResBtn, driveCustomBtn];

// --- Params / state ---
let x = 1, v = 0, t = 0;
const dt = 0.02;

let xtData = [];
let phaseData = [];

let running = true;
let rafId = null;

// (1,1) adaptive expand-only range
let simXRange = 1.5;

function get(id){ return parseFloat(document.getElementById(id).value); }
function set(id,val){ document.getElementById(id).value = val; }

function omega0(){ return Math.sqrt(get("k")/get("m")); }
function gamma(){ return get("b")/(2*get("m")); }
function bcrit(){ return 2*Math.sqrt(get("k")*get("m")); }

function setActive(group, btn){
  group.forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

// dynamic b-range so bcrit is mid: b ∈ [0, 2*bcrit]
function updateBRange(preserve=true){
  const bEl = document.getElementById("b");
  const bOldMax = parseFloat(bEl.max);
  const bNewMax = 2*bcrit();

  const bNow = get("b");

  bEl.min = 0;
  bEl.max = Math.max(0.01, bNewMax);

  if(preserve){
    if(isFinite(bOldMax) && bOldMax > 0){
      const frac = Math.min(1, Math.max(0, bNow / bOldMax));
      set("b", frac * bNewMax);
    }else{
      set("b", Math.min(bNow, bNewMax));
    }
  }else{
    set("b", Math.min(bNow, bNewMax));
  }

}

// Reset
function resetSimulation(){
  x = 1;
  v = 0;
  t = 0;
  xtData = [];
  phaseData = [];

  // refresh once (useful if paused)
  drawSimulation();
  drawXT();
  drawPhase();
  drawResAndPhase();
  updateDisplay();
}
resetBtn.addEventListener("click", resetSimulation);

function startSimulation(){
  if(running) return;
  running = true;
  startStopBtn.innerText = "Ustavi";
  rafId = requestAnimationFrame(loop);
}

function stopSimulation(){
  if(!running) return;
  running = false;
  startStopBtn.innerText = "Začni";
  if(rafId !== null){
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

startStopBtn.addEventListener("click", ()=>{
  if(running) stopSimulation();
  else startSimulation();
});

// --- Display ---
function updateDisplay(){
  //document.getElementById("mVal").innerText = get("m").toFixed(2);
  document.getElementById("mVal").innerText = get("m").toFixed(2) + " kg";
  document.getElementById("kVal").innerText = get("k").toFixed(2) + " N/m";
  //document.getElementById("bVal").innerText = get("b").toFixed(2);
  const b = get("b");
  const gcalc = gamma();
  document.getElementById("bVal").innerText = b.toFixed(2) + " kg/s"  + " (γ="+ gcalc +" rad/s)";
     
  document.getElementById("FVal").innerText = get("F").toFixed(2)+ " N";
  document.getElementById("wVal").innerText = get("w").toFixed(2) + " rad/s";

  const w0 = omega0();
  document.getElementById("omega0Val").innerText = w0.toFixed(2) + " rad/s";
  document.getElementById("omega0Slider").value = w0;



}

// --- Preset behaviors ---
function applyDampingNone(){
  set("b", 0);
  setActive(dampingGroup, dampNoneBtn);
}
function applyDampingUnder(){
  set("b", 0.2*bcrit()); // lower b -> more oscillations
  setActive(dampingGroup, dampUnderBtn);
}
function applyDampingCritical(){
  set("b", bcrit());     // slider midpoint
  setActive(dampingGroup, dampCritBtn);
}
function applyDampingOver(){
  set("b", 2*bcrit());
  setActive(dampingGroup, dampOverBtn);
}

function applyDriveNone(){
  set("F", 0);
  setActive(drivingGroup, driveNoneBtn);
}
function applyDriveOff(){
  set("F", 2.0);
  set("w", 0.5*omega0());
  setActive(drivingGroup, driveOffBtn);
}
function applyDriveRes(){
  set("F", 2.0);
  set("w", omega0());
  setActive(drivingGroup, driveResBtn);
}

// attach clicks
dampNoneBtn.addEventListener("click", applyDampingNone);
dampUnderBtn.addEventListener("click", applyDampingUnder);
dampCritBtn.addEventListener("click", applyDampingCritical);
dampOverBtn.addEventListener("click", applyDampingOver);
dampCustomBtn.addEventListener("click", ()=>setActive(dampingGroup, dampCustomBtn));

driveNoneBtn.addEventListener("click", applyDriveNone);
driveOffBtn.addEventListener("click", applyDriveOff);
driveResBtn.addEventListener("click", applyDriveRes);
driveCustomBtn.addEventListener("click", ()=>setActive(drivingGroup, driveCustomBtn));

// sliders -> custom
["m","k","b","omega0Slider"].forEach(id=>{
  document.getElementById(id).addEventListener("input", ()=>{
    setActive(dampingGroup, dampCustomBtn);
  });
});
["F","w"].forEach(id=>{
  document.getElementById(id).addEventListener("input", ()=>{
    setActive(drivingGroup, driveCustomBtn);
  });
});

// keep b-range synced when m or k changes
document.getElementById("m").addEventListener("input", ()=>updateBRange(true));
document.getElementById("k").addEventListener("input", ()=>updateBRange(true));

// Coupled sliders
document.getElementById("omega0Slider").addEventListener("input",()=>{
  const w0 = get("omega0Slider");
  const m = get("m");
  set("k", m*w0*w0);
  updateBRange(true);
});

// --- Physics step ---
function physics(){
  const m = get("m");
  const b = get("b");
  const k = get("k");
  const F = get("F");
  const w = get("w");

  const a = (-k*x - b*v + F*Math.sin(w*t))/m;
  v += a*dt;
  x += v*dt;
  t += dt;
}

// --- Axes (ticks closer; optional custom y ticks) ---
function drawAxes(
  ctx, W, H,
  xMin, xMax, yMin, yMax,
  xLabel, yLabel,
  xTicks=5, yTicks=5,
  yCustomTicks=null // optional: [{value, label}]
){
  const ml = 70, mr = 15, mt = 15, mb = 40;
  const plotW = W - ml - mr;
  const plotH = H - mt - mb;

  ctx.clearRect(0,0,W,H);

  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = 1;
  ctx.font = "12px Arial";

  // axes lines
  ctx.beginPath();
  ctx.moveTo(ml, mt);
  ctx.lineTo(ml, mt+plotH);
  ctx.lineTo(ml+plotW, mt+plotH);
  ctx.stroke();

  // x ticks + labels closer
  for(let i=0;i<=xTicks;i++){
    const u = i/xTicks;
    const xPix = ml + u*plotW;

    ctx.beginPath();
    ctx.moveTo(xPix, mt+plotH);
    ctx.lineTo(xPix, mt+plotH+5);
    ctx.stroke();

    const val = xMin + u*(xMax-xMin);
    ctx.fillText(val.toFixed(1), xPix-10, mt+plotH+14); // closer than before
  }

  // y ticks + labels closer
  if(yCustomTicks && Array.isArray(yCustomTicks)){
    for(const tk of yCustomTicks){
      const yPix = mt+plotH - ((tk.value - yMin)/(yMax-yMin))*plotH;

      ctx.beginPath();
      ctx.moveTo(ml-5, yPix);
      ctx.lineTo(ml, yPix);
      ctx.stroke();

      ctx.fillText(tk.label, ml-32, yPix+4);
    }
  } else {
    for(let i=0;i<=yTicks;i++){
      const u = i/yTicks;
      const yPix = mt+plotH - u*plotH;

      ctx.beginPath();
      ctx.moveTo(ml-5, yPix);
      ctx.lineTo(ml, yPix);
      ctx.stroke();

      const val = yMin + u*(yMax-yMin);
      ctx.fillText(val.toFixed(1), ml-40, yPix+4);
    }
  }

  // x label
  ctx.fillText(xLabel, ml + plotW*0.45, H-10);

  // y label (unchanged position from last stable)
  ctx.save();
  ctx.translate(18, mt + plotH*0.55);
  ctx.rotate(-Math.PI/2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();

  return {
    xPix: (xVal)=> ml + ((xVal-xMin)/(xMax-xMin))*plotW,
    yPix: (yVal)=> mt+plotH - ((yVal-yMin)/(yMax-yMin))*plotH,
    ml, mr, mt, mb, plotW, plotH
  };
}

// --- (1,1) potential plot (expand-only) ---
function drawSimulation(){
  const k = get("k");

  const marginFrac = 0.12;
  const needed = Math.abs(x) / (1 - marginFrac);

  if(needed > simXRange){
    simXRange = Math.max(simXRange * 1.15, needed);
  }

  const xRange = simXRange;
  const Vmax = 0.5 * k * xRange * xRange;

  const tr = drawAxes(
    simCtx,
    simCanvas.width,
    simCanvas.height,
    -xRange, xRange,
    0, Vmax * 1.1,
    "x / m",
    "U / J",
    5, 4
  );

  simCtx.strokeStyle = "#000";
  simCtx.beginPath();

  const N = 220;
  for(let i=0;i<=N;i++){
    const xx = -xRange + (2*xRange*i)/N;
    const V = 0.5 * k * xx * xx;
    const px = tr.xPix(xx);
    const py = tr.yPix(V);
    if(i===0) simCtx.moveTo(px, py);
    else simCtx.lineTo(px, py);
  }
  simCtx.stroke();

  const Vx = 0.5 * k * x * x;
  const px = tr.xPix(x);
  const py = tr.yPix(Vx);

  const boxW = 26;
  const boxH = 18;
  const yOffset = 16;

  simCtx.fillStyle = "#000";
  simCtx.fillRect(px - boxW/2, py - yOffset - boxH/2, boxW, boxH);

  simCtx.beginPath();
  simCtx.moveTo(px, py);
  simCtx.lineTo(px, py - yOffset);
  simCtx.stroke();
}

// --- (1,2) x(t) ---
function drawXT(){
  const N = xtData.length;
  const tWindow = Math.max(5, N*dt);
  const xAbsMax = Math.max(1, ...xtData.map(z=>Math.abs(z)));
  const yRange = xAbsMax * 1.2;

  const tr = drawAxes(
    xtCtx, xtCanvas.width, xtCanvas.height,
    0, tWindow,
    -yRange, yRange,
    "t / s", "x / m",
    5, 4
  );

  xtCtx.strokeStyle = "#000";
  xtCtx.beginPath();
  for(let i=0;i<N;i++){
    const ti = (N===1)? 0 : i*dt;
    const px = tr.xPix(ti);
    const py = tr.yPix(xtData[i]);
    if(i===0) xtCtx.moveTo(px,py);
    else xtCtx.lineTo(px,py);
  }
  xtCtx.stroke();
}

// --- (1,3) phase space ---
function drawPhase(){
  const xAbsMax = Math.max(1, ...phaseData.map(p=>Math.abs(p.x)));
  const vAbsMax = Math.max(1, ...phaseData.map(p=>Math.abs(p.v)));
  const xRange = xAbsMax * 1.2;
  const vRange = vAbsMax * 1.2;

  const tr = drawAxes(
    phaseCtx, phaseCanvas.width, phaseCanvas.height,
    -xRange, xRange,
    -vRange, vRange,
    "x / m", "v / m/s",
    5, 4
  );

  phaseCtx.fillStyle = "#000";
  for(const p of phaseData){
    const px = tr.xPix(p.x);
    const py = tr.yPix(p.v);
    phaseCtx.fillRect(px, py, 2, 2);
  }
}

// --- (2,1) amplitude + (2,2) phase ---
function drawResAndPhase(){
  const F = get("F");
  const m = get("m");
  const w0 = omega0();
  const g = gamma();

  const n = 300;
  const wMax = 5;

  const omegaVals = [];
  const ampVals = [];
  const phaseVals = [];

  let Amax = 1e-9;

  for(let i=0;i<=n;i++){
    const w = (i/n)*wMax;
    const denom = Math.sqrt((w0*w0 - w*w)**2 + (2*g*w)**2);
    const A = (denom===0) ? 1e3 : (F/m)/denom;

    const rawPhi = Math.atan2(2*g*w, (w0*w0 - w*w));
    const phi = rawPhi < 0 ? rawPhi + Math.PI : rawPhi;

    omegaVals.push(w);
    ampVals.push(A);
    phaseVals.push(phi);

    if(A > Amax) Amax = A;
  }

  // amplitude plot
  const yAmpMax = Math.max(0.5, Amax*1.15);
  const trA = drawAxes(
    resCtx, resCanvas.width, resCanvas.height,
    0, wMax,
    0, yAmpMax,
    "ω / rad/s", "A / m",
    5, 4
  );

  resCtx.strokeStyle = "#000";
  resCtx.beginPath();
  for(let i=0;i<omegaVals.length;i++){
    const px = trA.xPix(omegaVals[i]);
    const py = trA.yPix(ampVals[i]);
    if(i===0) resCtx.moveTo(px,py);
    else resCtx.lineTo(px,py);
  }
  resCtx.stroke();

  // dot on amplitude at current ω
  const wCur = get("w");
  const denomCur = Math.sqrt((w0*w0 - wCur*wCur)**2 + (2*g*wCur)**2);
  const Acur = (denomCur===0) ? 0 : (F/m)/denomCur;

  resCtx.beginPath();
  resCtx.arc(trA.xPix(wCur), trA.yPix(Acur), 5, 0, 2*Math.PI);
  resCtx.fillStyle = "red";
  resCtx.fill();
  resCtx.fillStyle = "#000";

  // phase plot: only 0, pi/2, pi ticks (no doubling)
  const yMin = -0.1;
  const yMax = Math.PI + 0.1;

  const phaseTicks = [
    { value: 0, label: "0" },
    { value: Math.PI/2, label: "π/2" },
    { value: Math.PI, label: "π" }
  ];

  phasePlotCtx.clearRect(0,0,phasePlotCanvas.width,phasePlotCanvas.height);
  const trP = drawAxes(
    phasePlotCtx, phasePlotCanvas.width, phasePlotCanvas.height,
    0, wMax,
    yMin, yMax,
    "ω / rad/s", "φ",
    5, 4,
    phaseTicks
  );

  phasePlotCtx.strokeStyle = "#000";
  phasePlotCtx.beginPath();
  for(let i=0;i<omegaVals.length;i++){
    const px = trP.xPix(omegaVals[i]);
    const py = trP.yPix(phaseVals[i]);
    if(i===0) phasePlotCtx.moveTo(px,py);
    else phasePlotCtx.lineTo(px,py);
  }
  phasePlotCtx.stroke();

  // π/2 line
  const yH = trP.yPix(Math.PI/2);
  phasePlotCtx.strokeStyle = "red";
  phasePlotCtx.setLineDash([6,6]);
  phasePlotCtx.beginPath();
  phasePlotCtx.moveTo(trP.ml, yH);
  phasePlotCtx.lineTo(trP.ml + trP.plotW, yH);
  phasePlotCtx.stroke();
  phasePlotCtx.setLineDash([]);
  phasePlotCtx.strokeStyle = "#000";

  // dot on phase at current ω
  const rawPhiCur = Math.atan2(2*g*wCur, (w0*w0 - wCur*wCur));
  const phiCur = rawPhiCur < 0 ? rawPhiCur + Math.PI : rawPhiCur;

  phasePlotCtx.beginPath();
  phasePlotCtx.arc(trP.xPix(wCur), trP.yPix(phiCur), 5, 0, 2*Math.PI);
  phasePlotCtx.fillStyle = "red";
  phasePlotCtx.fill();
  phasePlotCtx.fillStyle = "#000";
}

// --- Update stored traces ---
function updatePlots(){
  xtData.push(x);
  if(xtData.length > 500) xtData.shift();

  phaseData.push({x, v});
  if(phaseData.length > 3000) phaseData.shift();
}

// --- Main loop ---
function loop(){
  if(!running) return;
  physics();
  updatePlots();

  drawSimulation();
  drawXT();
  drawPhase();
  drawResAndPhase();

  updateDisplay();
  rafId = requestAnimationFrame(loop);
}

// init ranges
updateBRange(false);

// Initial preset state
applyDampingNone();
applyDriveNone();
updateDisplay();
startStopBtn.innerText = "Ustavi";
loop();

