const DIFFS = ['EASY','NORMAL','HARD','BRUTAL'];
let diffIdx = 1;
const PUNCH_SIZES = ['SMALL','MEDIUM','LARGE'];
let punchIdx = 1;
let maxLives = 5;

const DIFF_PARAMS = {
  EASY:   {spawnBase:2800, spawnMin:900,  waveTime:22000, speedMult:.8},
  NORMAL: {spawnBase:2000, spawnMin:650,  waveTime:18000, speedMult:1.0},
  HARD:   {spawnBase:1500, spawnMin:480,  waveTime:14000, speedMult:1.3},
  BRUTAL: {spawnBase:1100, spawnMin:320,  waveTime:11000, speedMult:1.7},
};
const PUNCH_RADII = {SMALL:62, MEDIUM:90, LARGE:120};

//  CANVAS / ELEMENTS

const video     = document.getElementById('base-video');
const hCanvas   = document.getElementById('base-hand-canvas');
const hCtx      = hCanvas.getContext('2d');
const gCanvas   = document.getElementById('game-canvas');
const gCtx      = gCanvas.getContext('2d');
const flashEl   = document.getElementById('flash-overlay');
const statusEl  = document.getElementById('status-msg');
const hintEl    = document.getElementById('hand-hint');


// AUDIO SYSTEM

// ════════════════════════════════════════════════════════════
//  AUDIO MANAGER
// ════════════════════════════════════════════════════════════

const AudioManager = {
  volume: 0.5,
musicVolume: 0.5, 
sfxVolume: 0.7, 
  sounds: {
    menu: new Audio('assets/audio/menu.mp3'),
    bg: new Audio('assets/audio/gameplay.mp3'),
    punch: new Audio('assets/audio/punch.mp3'),
    hit: new Audio('assets/audio/hit.mp3'),
    combo: new Audio('assets/audio/combo.mp3'),
    gameover: new Audio('assets/audio/gameover.mp3'),
    uiClick: new Audio('assets/audio/ui-click.mp3')
  },

  init(){
    this.sounds.bg.loop = true;
    this.sounds.menu.loop = true;
  },
  setMusicVolume(v){
  this.musicVolume = v;

  // 🔥 update currently playing sounds instantly
  this.sounds.bg.volume = v;
  this.sounds.menu.volume = v;
},

setSfxVolume(v){
  this.sfxVolume = v;
},

setVolume(v){
  this.setMusicVolume(v);
  this.setSfxVolume(v);
},

  play(name){
  const sound = this.sounds[name];
  if(!sound) return;

  const audio = new Audio(sound.src);

  if(name === 'bg' || name === 'menu'){
    audio.volume = this.musicVolume;
  } else {
    audio.volume = this.sfxVolume;
  }

  audio.play().catch(()=>{});
},

  playBg(){
  this.stopMenu();
  this.sounds.bg.volume = this.musicVolume;
  this.sounds.bg.currentTime = 0;
  this.sounds.bg.play().catch(()=>{});
},


  stopBg(){
    this.sounds.bg.pause();
    this.sounds.bg.currentTime = 0;
  },

  playMenu(){
  this.stopBg();
  this.sounds.menu.volume = this.musicVolume;
  this.sounds.menu.currentTime = 0;
  this.sounds.menu.play().catch(()=>{});
},

  stopMenu(){
    this.sounds.menu.pause();
    this.sounds.menu.currentTime = 0;
  }
};

AudioManager.init();

function resize(){
  hCanvas.width  = gCanvas.width  = innerWidth;
  hCanvas.height = gCanvas.height = innerHeight;
}
window.addEventListener('resize', resize); resize();


//  SCREEN MANAGER

let currentScreen = null;
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el = document.getElementById('screen-'+id);
  if(el) el.classList.add('active');
  currentScreen = id;
  // HUD visibility
  document.getElementById('hud').style.display    = id==='game' ? 'flex'  : 'none';
  gCanvas.style.display                            = id==='game' ? 'block' : 'none';
  flashEl.style.display                            = id==='game' ? 'block' : 'none';
  statusEl.style.display                           = id==='game' ? 'block' : 'none';
  hintEl.style.display                             = id==='game' ? 'block' : 'none';
}


//  HAND BUTTON SYSTEM (hover-with-fist-to-activate)

const BTN_HOLD_MS = 1200;
const btnState = {}; 

function initBtn(el){
  btnState[el.id] = {progress:0, raf:null, startTime:null, hovering:false};
}
document.querySelectorAll('.hand-btn, .arr-btn').forEach(initBtn);

function updateBtnHover(el, fistOver){
  const st = btnState[el.id];
  if(!st) return;
  if(fistOver && !st.hovering){
    st.hovering = true;
    el.classList.add('hovering');
    st.startTime = performance.now();
    animBtnProgress(el);
  }
  if(!fistOver && st.hovering){
    st.hovering = false;
    el.classList.remove('hovering');
    st.progress = 0;
    const prog = el.querySelector('.btn-progress');
    if(prog) prog.style.width='0%';
    if(st.raf){ cancelAnimationFrame(st.raf); st.raf=null; }
  }
}

function animBtnProgress(el){
  const st = btnState[el.id];
  if(!st || !st.hovering) return;
  const elapsed = performance.now() - st.startTime;
  const pct = Math.min(elapsed / BTN_HOLD_MS * 100, 100);
  const prog = el.querySelector('.btn-progress');
  if(prog) prog.style.width = pct+'%';
  if(pct >= 100){
    activateBtn(el);
    return;
  }
  st.raf = requestAnimationFrame(()=>animBtnProgress(el));
}

function activateBtn(el){
  const st = btnState[el.id];
  if(st){
    st.hovering=false;
    st.progress=0;
    el.classList.remove('hovering');
    el.classList.add('activated');
  }

  const prog = el.querySelector('.btn-progress');
  if(prog) prog.style.width='0%';

  setTimeout(()=>el.classList.remove('activated'),300);

  AudioManager.play('uiClick');

  const action = el.dataset.action;

  if(action==='play'){
    startGame();
  }

  else if(action==='settings'){
    toggleSettings();
  }

  else if(action==='replay'){
    startGame();
  }

  else if(action==='menu'){
  AudioManager.stopBg();
  AudioManager.playMenu();
  showScreen('intro');
  stopGame();
}

  else if(action==='diff-down'){
    diffIdx=Math.max(0,diffIdx-1);
    document.getElementById('diff-val').textContent=DIFFS[diffIdx];
  }

  else if(action==='diff-up'){
    diffIdx=Math.min(DIFFS.length-1,diffIdx+1);
    document.getElementById('diff-val').textContent=DIFFS[diffIdx];
  }

  else if(action==='lives-down'){
    maxLives=Math.max(1,maxLives-1);
    document.getElementById('lives-val').textContent=maxLives;
  }

  else if(action==='lives-up'){
    maxLives=Math.min(9,maxLives+1);
    document.getElementById('lives-val').textContent=maxLives;
  }

  else if(action==='punch-down'){
    punchIdx=Math.max(0,punchIdx-1);
    document.getElementById('punch-val').textContent=PUNCH_SIZES[punchIdx];
  }

  else if(action==='punch-up'){
    punchIdx=Math.min(2,punchIdx+1);
    document.getElementById('punch-val').textContent=PUNCH_SIZES[punchIdx];
  }
}

let settingsOpen = false;
function toggleSettings(){
  settingsOpen = !settingsOpen;
  document.getElementById('settings-panel').classList.toggle('open', settingsOpen);
}

// Check which buttons a screen-position is over
function checkButtonsForPoint(sx, sy, isFist){
  const activeBtns = currentScreen==='intro'
    ? document.querySelectorAll('#screen-intro .hand-btn, #settings-panel .arr-btn')
    : currentScreen==='gameover'
    ? document.querySelectorAll('#screen-gameover .hand-btn')
    : [];
  activeBtns.forEach(btn=>{
    const r = btn.getBoundingClientRect();
    const over = sx>=r.left && sx<=r.right && sy>=r.top && sy<=r.bottom;
    updateBtnHover(btn, over && isFist);
  });
}


//  MEDIAPIPE SETUP

let handLandmarker = null, lastVideoTime = -1, handDetected = false;

async function initMP(){
  try{
    const {HandLandmarker, FilesetResolver} =
      await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/+esm');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm');
    handLandmarker = await HandLandmarker.createFromOptions(vision,{
      baseOptions:{
        modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate:'GPU'
      },
      runningMode:'VIDEO', numHands:2
    });
    console.log('✅ HandLandmarker ready');
  }catch(e){
    console.warn('MediaPipe failed, mouse fallback');
    useMouse();
  }
}

function useMouse(){
  handDetected=true;
  hands[0].detected=true;
  document.addEventListener('mousemove',ev=>{
    hands[0].sx = ev.clientX; hands[0].sy = ev.clientY;
    hands[0].prevSx=hands[0].sx; hands[0].prevSy=hands[0].sy;
  });
  document.addEventListener('mousedown',()=>{
    hands[0].fist=true;
    if(currentScreen==='game') doPunch(0);
  });
  document.addEventListener('mouseup',()=>{ hands[0].fist=false; });
  hintEl.textContent='🖱️ Mouse: move = aim, click = punch';
}

//  MOUSE SUPPORT


let mouseX = 0, mouseY = 0;
let mouseDown = false;

document.addEventListener('mousemove', (e)=>{
  mouseX = e.clientX;
  mouseY = e.clientY;

  // simulate hover (like fist hover but without holding)
  checkButtonsForPoint(mouseX, mouseY, true);
});

document.addEventListener('mousedown', (e)=>{
  mouseDown = true;

  const activeBtns = currentScreen==='intro'
    ? document.querySelectorAll('#screen-intro .hand-btn, #settings-panel .arr-btn')
    : currentScreen==='gameover'
    ? document.querySelectorAll('#screen-gameover .hand-btn')
    : [];

  activeBtns.forEach(btn=>{
    const r = btn.getBoundingClientRect();
    const over = mouseX>=r.left && mouseX<=r.right && mouseY>=r.top && mouseY<=r.bottom;

    if(over){
      activateBtn(btn); // 🔥 instant click
    }
  });
});

document.addEventListener('mouseup', ()=>{
  mouseDown = false;
});
//  HAND STATE 

let hands = [
  {detected:false, sx:0, sy:0, prevSx:0, prevSy:0, fist:false, punching:false, cooldown:0, vel:0, label:''},
  {detected:false, sx:0, sy:0, prevSx:0, prevSy:0, fist:false, punching:false, cooldown:0, vel:0, label:''},
];

function isFist(lm){
  const w=lm[0];
  const tips=[8,12,16,20], mcps=[5,9,13,17];
  let c=0;
  for(let i=0;i<4;i++) if(d3(lm[tips[i]],w)<d3(lm[mcps[i]],w)*.75) c++;
  return c>=3;
}
function d3(a,b){ return Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)); }

function processHands(){
  if(!handLandmarker||video.readyState<2) return;
  const now=performance.now();
  if(video.currentTime===lastVideoTime) return;
  lastVideoTime=video.currentTime;
  let res; try{ res=handLandmarker.detectForVideo(video,now); }catch(e){ return; }

  hCtx.clearRect(0,0,hCanvas.width,hCanvas.height);

  const W=hCanvas.width, H=hCanvas.height;
  const n = res.landmarks ? res.landmarks.length : 0;
  handDetected = n>0;

  // Reset
  hands[0].detected=false; hands[1].detected=false;

  for(let hi=0;hi<n&&hi<2;hi++){
    const lm  = res.landmarks[hi];
    const hand= res.handedness ? res.handedness[hi] : null;
    const h   = hands[hi];


    const wristSx = (1 - lm[0].x) * W;
    const wristSy = lm[0].y * H;
    const midSx   = (1 - lm[9].x) * W;
    const midSy   = lm[9].y * H;

    h.prevSx = h.sx; h.prevSy = h.sy;
    h.sx = (wristSx+midSx)/2;
    h.sy = (wristSy+midSy)/2;
    h.vel = Math.hypot(h.sx-h.prevSx, h.sy-h.prevSy);
    h.detected = true;
    h.fist = isFist(lm);
    // Label (corrected for mirror)
    h.label = hand ? (hand[0].categoryName==='Left'?'R':'L') : '';

    if(h.cooldown>0) h.cooldown--;
    const SPEED_THRESH = innerWidth * 0.018;
    if(h.fist && h.vel > SPEED_THRESH && h.cooldown===0){
      h.punching=true; h.cooldown=14;
      if(currentScreen==='game') doPunch(hi);
    } else { h.punching=false; }

    // Draw skeleton on hand canvas (coords already screen-space, no extra flip)
    drawHandOnCanvas(lm, h.fist, h.punching, W, H);

    // Button hover check
    checkButtonsForPoint(h.sx, h.sy, h.fist);
  }

  // hint
  if(!handDetected){
    hintEl.textContent='👋 Show your hands to the camera';
  } else {
    const icons=hands.filter(h=>h.detected).map(h=>h.punching?'💥':h.fist?'✊':'🖐️').join('  ');
    hintEl.textContent=icons+'  (fist + move fast = PUNCH)';
  }
}

// Draw hand skeleton — lm in MediaPipe normalized coords, convert to screen
function drawHandOnCanvas(lm, fist, punching, W, H){
  const CONN=[
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],[0,17]
  ];
  const col = punching?'#ff4400':fist?'#ffcc00':'rgba(232,223,192,.65)';
  hCtx.save();
  hCtx.strokeStyle=col; hCtx.lineWidth=2.5; hCtx.lineCap='round';
  if(punching){ hCtx.shadowColor='#ff4400'; hCtx.shadowBlur=22; }
  else if(fist){ hCtx.shadowColor='#ffcc00'; hCtx.shadowBlur=10; }
  for(const[a,b]of CONN){
    // flip x to match mirrored video
    hCtx.beginPath();
    hCtx.moveTo((1-lm[a].x)*W, lm[a].y*H);
    hCtx.lineTo((1-lm[b].x)*W, lm[b].y*H);
    hCtx.stroke();
  }
  hCtx.fillStyle=col;
  for(let i=0;i<21;i++){
    hCtx.beginPath();
    hCtx.arc((1-lm[i].x)*W, lm[i].y*H, i===0?5:2.5, 0, Math.PI*2);
    hCtx.fill();
  }
  hCtx.restore();
}
//  GAME STATE
let score=0, wave=1, hp=5, combo=1, comboTimer=0;
let gameActive=false, gameOver=false;
let enemies=[], particles=[], floaters=[];
let lastSpawn=0, spawnInterval=2000, waveTimer=0;
let animFrame=null;

function resetGame(){
  score=0; wave=1; hp=maxLives; combo=1; comboTimer=0;
  gameOver=false; enemies=[]; particles=[]; floaters=[];
  const dp = DIFF_PARAMS[DIFFS[diffIdx]];
  spawnInterval=dp.spawnBase; waveTimer=0; lastSpawn=0;
  document.getElementById('score-v').textContent='0';
  document.getElementById('wave-v').textContent='1';
  document.getElementById('combo-v').textContent='x1';
  updateHpUI();
}
function startGame(){
  stopGame();
  resetGame();
  showScreen('game');
  gameActive=true;

  AudioManager.stopMenu();
  AudioManager.playBg();

  animFrame=requestAnimationFrame(gameLoop);
}
function stopGame(){
  gameActive=false;
  if(animFrame){ cancelAnimationFrame(animFrame); animFrame=null; }
}


//  HUD helpers

function updateHpUI(){
  const bar=document.getElementById('hp-bar-wrap'); bar.innerHTML='';
  for(let i=0;i<maxLives;i++){ const p=document.createElement('div'); p.className='hp-pip'+(i>=hp?' lost':''); bar.appendChild(p); }
}
function updateComboUI(){
  const el=document.getElementById('combo-v');
  el.textContent=`x${combo}`; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}


//  SKELETON ENEMY

function spawnEnemy(){
  const W=gCanvas.width, H=gCanvas.height;
  const dp=DIFF_PARAMS[DIFFS[diffIdx]];
  const roll=Math.random();
  let type,eHp,pts,speed,scale;
  if(wave>=5&&roll<.15){type='giant';eHp=3;pts=80;speed=(.6+wave*.07)*dp.speedMult;scale=1.45;}
  else if(wave>=2&&roll<.36){type='runner';eHp=1;pts=25;speed=(1.8+wave*.13)*dp.speedMult;scale=.8;}
  else{type='normal';eHp=1;pts=10;speed=(1+wave*.1)*dp.speedMult;scale=1;}
  const side=Math.floor(Math.random()*4);
  let x,y;
  if(side===0){x=Math.random()*W;y=-70;}
  else if(side===1){x=W+70;y=Math.random()*H;}
  else if(side===2){x=Math.random()*W;y=H+70;}
  else{x=-70;y=Math.random()*H;}
  const ang=Math.atan2(H/2-y,W/2-x);
  enemies.push({x,y,hp:eHp,maxHp:eHp,type,pts,speed,scale,
    vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed,
    hitFlash:0, animT:Math.random()*100});
}

function drawSkeleton(x,y,sc,hitFlash,type,eHp,maxHp,animT){
  const ctx=gCtx;
  ctx.save(); ctx.translate(x,y); ctx.scale(sc,sc);
  const t=(Date.now()/420)+animT;
  const walk=Math.sin(t)*7, bob=Math.abs(Math.sin(t))*3;
  const col=hitFlash>0?'#fff':(type==='giant'?'#ffaaaa':type==='runner'?'#aaffdd':'#e8dfc0');
  ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2.5; ctx.lineCap='round';
  if(hitFlash>0){ctx.shadowColor='#fff';ctx.shadowBlur=24;}

  // skull
  ctx.beginPath(); ctx.arc(0,-38-bob,12,0,Math.PI*2); ctx.stroke();
  // eye sockets
  ctx.fillStyle=hitFlash>0?'#fff':'#111';
  ctx.beginPath(); ctx.ellipse(-4,-40-bob,3,4,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4,-40-bob,3,4,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=col;
  // teeth
  ctx.lineWidth=1.5;
  ctx.beginPath();
  for(let i=-2;i<=2;i++){ctx.moveTo(i*3,-29-bob);ctx.lineTo(i*3,-24-bob);}
  ctx.stroke(); ctx.lineWidth=2.5;
  // nose hole
  ctx.fillStyle=hitFlash>0?'#fff':'#222';
  ctx.beginPath(); ctx.ellipse(0,-34-bob,2,2,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=col;

  // spine
  ctx.beginPath(); ctx.moveTo(0,-26-bob); ctx.lineTo(0,10-bob); ctx.stroke();
  // ribs
  for(let i=0;i<4;i++){
    const ry=-20+i*6-bob;
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.bezierCurveTo(14,ry-2,16,ry+5,10,ry+7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,ry); ctx.bezierCurveTo(-14,ry-2,-16,ry+5,-10,ry+7); ctx.stroke();
  }
  // pelvis
  ctx.beginPath(); ctx.ellipse(0,12-bob,10,5,0,0,Math.PI*2); ctx.stroke();

  // arms
  const armSw=Math.sin(t)*16;
  ctx.save(); ctx.translate(-8,-18-bob); ctx.rotate((-35+armSw)*Math.PI/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-5,15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-5,15); ctx.lineTo(-3,28); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(8,-18-bob); ctx.rotate((35-armSw)*Math.PI/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(5,15); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5,15); ctx.lineTo(3,28); ctx.stroke();
  ctx.restore();

  // legs
  ctx.save(); ctx.translate(-5,12-bob); ctx.rotate(walk*Math.PI/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-3,18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3,18); ctx.lineTo(-5,32); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(5,12-bob); ctx.rotate(-walk*Math.PI/180);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(3,18); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(3,18); ctx.lineTo(5,32); ctx.stroke();
  ctx.restore();

  // hp bar
  if(maxHp>1){
    ctx.setTransform(1,0,0,1,x,y);
    const bw=52, bx=-bw/2;
    ctx.fillStyle='#333'; ctx.fillRect(bx,-72*sc,bw,5);
    ctx.fillStyle='#e84444'; ctx.fillRect(bx,-72*sc,bw*(eHp/maxHp),5);
  }
  ctx.restore();
}


//  PUNCH

function doPunch(hi){
  if(gameOver) return;
  AudioManager.play('punch');
  const h=hands[hi];
  const px=h.sx, py=h.sy;
  const PR=PUNCH_RADII[PUNCH_SIZES[punchIdx]];

  // Flash
  flashEl.style.background='rgba(255,180,60,.1)';
  flashEl.style.opacity='1';
  setTimeout(()=>flashEl.style.opacity='0', 90);

  // Punch ring
  const ring=document.createElement('div');
  ring.className='punch-ring';
  ring.style.cssText=`left:${px}px;top:${py}px;width:${PR*2}px;height:${PR*2}px`;
  document.body.appendChild(ring);
  setTimeout(()=>ring.remove(),420);

  let hits=0;
  for(let j=enemies.length-1;j>=0;j--){
    const e=enemies[j];
    if(Math.hypot(px-e.x,py-e.y)<PR+e.scale*40){
      AudioManager.play('hit');
      hits++; e.hp--; e.hitFlash=10;
      const ang=Math.atan2(e.y-py,e.x-px);
      e.vx+=Math.cos(ang)*8; e.vy+=Math.sin(ang)*8;
      spawnChips(e.x,e.y,14);
      if(e.type==='giant') spawnBlood(e.x,e.y,7);
      if(e.hp<=0){
        spawnChips(e.x,e.y,26);
        const pts=e.pts*combo;
        score+=pts; document.getElementById('score-v').textContent=score;
        floaters.push({x:e.x,y:e.y-20,text:`+${pts}`,life:1,color:'#ffcc00'});
        enemies.splice(j,1);
        combo=Math.min(combo+1,12); comboTimer=210; updateComboUI();
        if(combo>=3){
  AudioManager.play('combo');
  showStatus(`${combo}x COMBO!`,'#ffcc00');
}
        if(combo>=6) showStatus(`💀 BRUTAL ${combo}x!`,'#ff4400');
      }
    }
  }
  if(!hits){
    for(let k=0;k<4;k++) particles.push({
      x:px,y:py,vx:(Math.random()-.5)*3,vy:-Math.random()*2.5,
      life:.5,bone:true,r:2,rot:0,rotV:.2,grav:.1
    });
  }
}

function spawnChips(x,y,n){
  for(let k=0;k<n;k++){
    const a=Math.random()*Math.PI*2, s=3+Math.random()*9;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,bone:true,r:2+Math.random()*4,rot:Math.random()*6,rotV:(Math.random()-.5)*.4,grav:.25});
  }
}
function spawnBlood(x,y,n){
  for(let k=0;k<n;k++){
    const a=Math.random()*Math.PI*2, s=2+Math.random()*5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,bone:false,r:3+Math.random()*4,grav:.2,rotV:0,rot:0});
  }
}


//  game loop

let lastTs=0;
function gameLoop(ts){
  if(!gameActive) return;
  processHands();

  const W=gCanvas.width, H=gCanvas.height;
  gCtx.clearRect(0,0,W,H);
  gCtx.fillStyle='rgba(0,0,0,.22)'; gCtx.fillRect(0,0,W,H);
  // scanlines
  for(let sy=0;sy<H;sy+=4){ gCtx.fillStyle='rgba(0,0,0,.025)'; gCtx.fillRect(0,sy,W,2); }

  const dp=DIFF_PARAMS[DIFFS[diffIdx]];
  const dt=Math.min(ts-lastTs,50); lastTs=ts;

  // combo decay
  if(comboTimer>0) comboTimer--; else if(combo>1){ combo=1; updateComboUI(); }

  // wave
  waveTimer+=dt;
  if(waveTimer>dp.waveTime){ waveTimer=0; wave++; document.getElementById('wave-v').textContent=wave;
    spawnInterval=Math.max(dp.spawnMin,spawnInterval-180);
    showStatus(`⚰️ WAVE ${wave}`,'#e8dfc0'); }

  // spawn
  if(ts-lastSpawn>spawnInterval){ spawnEnemy(); lastSpawn=ts; }

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vx*=.91; p.vy=p.vy*.91+(p.grav||.2);
    p.rot+=p.rotV; p.life-=.024;
    if(p.life<=0){particles.splice(i,1);continue;}
    gCtx.save(); gCtx.globalAlpha=p.life;
    if(p.bone){
      gCtx.fillStyle='#e8dfc0'; gCtx.translate(p.x,p.y); gCtx.rotate(p.rot);
      gCtx.fillRect(-p.r/2,-p.r*1.5,p.r,p.r*3);
    } else {
      gCtx.fillStyle='#c0001a'; gCtx.beginPath(); gCtx.arc(p.x,p.y,p.r,0,Math.PI*2); gCtx.fill();
    }
    gCtx.restore();
  }

  // enemies
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    e.x+=e.vx; e.y+=e.vy; e.vx*=.95; e.vy*=.95;
    // re-steer
    const ang=Math.atan2(H/2-e.y,W/2-e.x);
    const spd=Math.hypot(e.vx,e.vy);
    if(spd<e.speed){ e.vx+=Math.cos(ang)*.1; e.vy+=Math.sin(ang)*.1; }
    if(e.hitFlash>0) e.hitFlash--;
    if(Math.hypot(e.x-W/2,e.y-H/2)<60){
      enemies.splice(i,1); loseLife();
      if(gameOver) return;
      flashEl.style.background='rgba(192,0,26,.4)';
      flashEl.style.opacity='1'; setTimeout(()=>flashEl.style.opacity='0',160);
      continue;
    }
    drawSkeleton(e.x,e.y,e.scale,e.hitFlash,e.type,e.hp,e.maxHp,e.animT);
  }

  // floaters
  for(let i=floaters.length-1;i>=0;i--){
    const f=floaters[i]; f.y-=1.7; f.life-=.018;
    if(f.life<=0){floaters.splice(i,1);continue;}
    gCtx.save(); gCtx.globalAlpha=f.life;
    gCtx.font='bold 22px "Share Tech Mono"'; gCtx.fillStyle=f.color;
    gCtx.textAlign='center'; gCtx.shadowColor=f.color; gCtx.shadowBlur=10;
    gCtx.fillText(f.text,f.x,f.y); gCtx.restore();
  }

  // fist indicators
  for(let hi=0;hi<2;hi++){
    const h=hands[hi]; if(!h.detected) continue;
    gCtx.save();
    const PR=PUNCH_RADII[PUNCH_SIZES[punchIdx]];
    if(h.punching){ gCtx.shadowColor='#ff4400'; gCtx.shadowBlur=30; gCtx.strokeStyle='#ff4400'; gCtx.lineWidth=3; gCtx.beginPath(); gCtx.arc(h.sx,h.sy,PR*.55,0,Math.PI*2); gCtx.stroke(); }
    else if(h.fist){ gCtx.shadowColor='#ffcc00'; gCtx.shadowBlur=14; gCtx.strokeStyle='#ffcc00'; gCtx.lineWidth=2; gCtx.beginPath(); gCtx.arc(h.sx,h.sy,PR*.42,0,Math.PI*2); gCtx.stroke(); }
    // label
    if(h.label){ gCtx.font='bold 14px "Share Tech Mono"'; gCtx.fillStyle='rgba(232,223,192,.7)'; gCtx.textAlign='center'; gCtx.fillText(h.label,h.sx,h.sy-40); }
    gCtx.restore();
  }

  animFrame=requestAnimationFrame(gameLoop);
}


//  LIFE / GAME OVER

function loseLife(){
  hp--; updateHpUI(); combo=1; updateComboUI(); showStatus('💀 HIT!','#c0001a');
  if(hp<=0) triggerGameOver();
}
function triggerGameOver(){
  gameOver=true; gameActive=false;
  AudioManager.stopBg();
  AudioManager.play('gameover');
  setTimeout(()=>{
    AudioManager.playMenu();
  }, 1500);
  cancelAnimationFrame(animFrame);
  document.getElementById('go-score').textContent=
    `SCORE: ${score}  ·  WAVE: ${wave}  ·  BEST COMBO: x${combo}`;
  // Reset btn states
  ['btn-replay','btn-menu'].forEach(id=>{
    const st=btnState[id];
    if(st){st.hovering=false;st.progress=0;}
    const el=document.getElementById(id);
    if(el){el.classList.remove('hovering','activated');const p=el.querySelector('.btn-progress');if(p)p.style.width='0%';}
  });
  showScreen('gameover');
}


//  STATUS MSG

let stTO;
function showStatus(txt,col='#e8dfc0'){
  statusEl.textContent=txt; statusEl.style.color=col; statusEl.style.opacity='1';
  clearTimeout(stTO); stTO=setTimeout(()=>statusEl.style.opacity='0',1400);
}

//  HAND LOOP

function handLoop(){
  processHands();
  requestAnimationFrame(handLoop);
}


//  BOOT

async function boot(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:1280,height:720}});
    video.srcObject=stream;
    await new Promise(r=>video.onloadedmetadata=r);
    video.play();
  }catch(e){
    document.getElementById('loading-msg').textContent='⚠ CAMERA DENIED — RELOAD & ALLOW ACCESS';
    return;
  }
  await initMP();
  document.getElementById('loading-msg').style.display='none';
  AudioManager.init();
  showScreen('intro');
  AudioManager.playMenu();
  // HUD off initially
  document.getElementById('hud').style.display='none';
  gCanvas.style.display='none';
  flashEl.style.display='none';
  statusEl.style.display='none';
  hintEl.style.display='block';
  // start hand tracking loop (always on)
  requestAnimationFrame(handLoop);
}

boot();

window.addEventListener('DOMContentLoaded', () => {

  const musicSlider = document.getElementById('music-slider');
  const sfxSlider = document.getElementById('sfx-slider');

  if(musicSlider){
    musicSlider.addEventListener('input', (e)=>{
      AudioManager.setMusicVolume(parseFloat(e.target.value));
    });
  }

  if(sfxSlider){
    sfxSlider.addEventListener('input', (e)=>{
      AudioManager.setSfxVolume(parseFloat(e.target.value));
    });
  }

});