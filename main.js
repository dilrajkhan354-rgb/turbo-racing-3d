import * as THREE from 'three';
import './style.css';

const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8bc9ec);
scene.fog = new THREE.Fog(0x8bc9ec, 45, 190);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 350);
camera.position.set(0, 6.2, 11.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('game').prepend(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xe7f7ff, 0x4b6037, 2));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-8, 16, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

const material = (color, roughness=0.75, metalness=0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
const grassMat = material(0x4c963f);
const roadMat = material(0x30353b);
const stripeMat = material(0xfff5d4);
const tireMat = material(0x111318);
const glassMat = material(0x92d5ec, 0.22, 0.15);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), grassMat);
ground.rotation.x = -Math.PI/2; ground.position.y = -0.12; ground.receiveShadow = true; scene.add(ground);
const road = new THREE.Mesh(new THREE.PlaneGeometry(12, 300), roadMat);
road.rotation.x = -Math.PI/2; road.position.set(0, -0.05, -100); road.receiveShadow = true; scene.add(road);

const laneMarks = [];
for (let z=-260; z<25; z+=9) {
  for (const x of [-2, 2]) {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 4.3), stripeMat);
    mark.position.set(x, 0.015, z); scene.add(mark); laneMarks.push(mark);
  }
}
for (const x of [-5.85, 5.85]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 300), stripeMat);
  edge.position.set(x, 0.01, -100); scene.add(edge);
}

function addBox(group, w,h,d, mat, x,y,z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
  m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
}
function makeCar(color, playerCar=false) {
  const g = new THREE.Group();
  const paint = material(color, 0.28, 0.2);
  addBox(g, 1.65, 0.48, 3.0, paint, 0, 0.62, 0);
  addBox(g, 1.30, 0.48, 1.48, paint, 0, 1.02, -0.12);
  addBox(g, 1.10, 0.33, 1.18, glassMat, 0, 1.08, -0.17);
  addBox(g, 1.53, 0.15, 0.20, material(0x17191e), 0, 0.47, -1.49);
  for (const x of [-0.56,0.56]) {
    addBox(g, 0.27,0.13,0.08, material(playerCar ? 0xffdf73 : 0xffffff), x,0.73,-1.52);
    addBox(g, 0.27,0.13,0.08, material(0xd82e35), x,0.70,1.51);
    for (const z of [-0.96,0.98]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34,0.34,0.20,14), tireMat);
      wheel.rotation.z = Math.PI/2; wheel.position.set(x*1.55,0.38,z); wheel.castShadow=true; g.add(wheel);
    }
  }
  g.traverse(o => { if(o.isMesh){o.castShadow=true;o.receiveShadow=true;} });
  return g;
}

const player = makeCar(0xef402f, true);
player.position.set(0,0,3.4); scene.add(player);

// Low-poly roadside trees, recycled for continuous scenery.
const trees = [];
const trunkMat = material(0x69462c), leafMat = material(0x287343);
for (let i=0; i<48; i++) for (const side of [-1,1]) {
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.21,1.25,7), trunkMat);
  trunk.position.y=0.62; tree.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.05,2.45,7),leafMat);
  crown.position.y=2.25; crown.castShadow=true; tree.add(crown);
  tree.position.set(side*(8+Math.random()*5),0,-i*7-Math.random()*4);
  scene.add(tree); trees.push(tree);
}

const traffic = [];
const colors = [0x2778d7,0xffc629,0xf4f4f4,0x7853c8,0x24a878,0xf0782f];
function spawnCar(z=-120-Math.random()*55, lane=null) {
  const x = lane ?? [-4,0,4][Math.floor(Math.random()*3)];
  const car = makeCar(colors[Math.floor(Math.random()*colors.length)]);
  car.scale.setScalar(0.94); car.position.set(x,0,z); scene.add(car);
  traffic.push({mesh:car, lane:x, speed:9+Math.random()*13});
}
for(let i=0;i<5;i++) spawnCar(-48-i*34);

let active=false, speed=0, score=0, best=Number(localStorage.getItem('turboRacingBest')||0);
let steer=0, gas=false, brake=false, last=0, spawnClock=0;
$('best').textContent=best;

function reset() {
  speed=0; score=0; steer=0; spawnClock=0;
  player.position.x=0; player.rotation.set(0,0,0);
  traffic.forEach((t,i)=>{t.mesh.position.set([-4,0,4][i%3],0,-45-i*34);t.speed=9+Math.random()*13;});
  $('speed').textContent='0'; $('score').textContent='0';
}
function startRace() { reset(); active=true; $('overlay').classList.add('hidden'); }
function crash() {
  if (!active) return;
  active=false; gas=false; brake=false;
  best=Math.max(best,Math.floor(score));
  localStorage.setItem('turboRacingBest',String(best));
  $('best').textContent=best;
  $('overlayTitle').innerHTML='RACE<br><em>OVER</em>';
  $('overlayText').textContent=`Score: ${Math.floor(score)} · Best: ${best}. Try again!`;
  $('start').textContent='RACE AGAIN';
  $('overlay').classList.remove('hidden');
}
$('start').addEventListener('click',startRace);

function hold(id, down, up) {
  const el=$(id);
  const press=e=>{e.preventDefault();down();el.classList.add('pressed');};
  const release=e=>{e.preventDefault();up();el.classList.remove('pressed');};
  el.addEventListener('pointerdown',press);
  ['pointerup','pointercancel','pointerleave'].forEach(type=>el.addEventListener(type,release));
  el.addEventListener('contextmenu',e=>e.preventDefault());
}
hold('left',()=>steer=-1,()=>{if(steer===-1)steer=0;});
hold('right',()=>steer=1,()=>{if(steer===1)steer=0;});
hold('gas',()=>gas=true,()=>gas=false);
hold('brake',()=>brake=true,()=>brake=false);

addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key.toLowerCase()==='a')steer=-1;
  if(e.key==='ArrowRight'||e.key.toLowerCase()==='d')steer=1;
  if(e.key==='ArrowUp'||e.key.toLowerCase()==='w')gas=true;
  if(e.key==='ArrowDown'||e.key.toLowerCase()==='s')brake=true;
  if(e.key==='Enter'&&!active)startRace();
});
addEventListener('keyup',e=>{
  if(['ArrowLeft','ArrowRight','a','d','A','D'].includes(e.key))steer=0;
  if(['ArrowUp','w','W'].includes(e.key))gas=false;
  if(['ArrowDown','s','S'].includes(e.key))brake=false;
});
addEventListener('blur',()=>{steer=0;gas=false;brake=false;});

function update(dt) {
  if(active) {
    if(gas)speed+=35*dt; else speed-=7*dt;
    if(brake)speed-=50*dt;
    speed=THREE.MathUtils.clamp(speed,0,68);
    player.position.x=THREE.MathUtils.clamp(player.position.x+steer*(3.4+speed*.045)*dt,-4.8,4.8);
    player.rotation.z=THREE.MathUtils.damp(player.rotation.z,-steer*.13,7,dt);
    const movement=speed*dt*1.25;
    laneMarks.forEach(m=>{m.position.z+=movement;if(m.position.z>12)m.position.z-=290;});
    trees.forEach(t=>{t.position.z+=movement;if(t.position.z>14){t.position.z=-300-Math.random()*30;t.position.x=Math.sign(t.position.x)*(8+Math.random()*5);}});
    traffic.forEach(t=>{
      t.mesh.position.z+=(speed*1.25-t.speed*.45)*dt;
      if(t.mesh.position.z>13){t.mesh.position.z=-130-Math.random()*75;t.lane=[-4,0,4][Math.floor(Math.random()*3)];t.mesh.position.x=t.lane;t.speed=9+Math.random()*13;}
      if(Math.abs(t.mesh.position.z-player.position.z)<2.35 && Math.abs(t.mesh.position.x-player.position.x)<1.45) crash();
    });
    spawnClock+=dt;
    if(spawnClock>5.2&&traffic.length<8){spawnCar();spawnClock=0;}
    score+=speed*dt*.55;
    $('speed').textContent=Math.round(speed*3.2);
    $('score').textContent=Math.floor(score);
  }
  camera.position.x=THREE.MathUtils.damp(camera.position.x,player.position.x*.27,2.5,dt);
  camera.lookAt(player.position.x*.16,0.75,-8);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt=Math.min((now-(last||now))/1000,0.04); last=now;
  update(dt); renderer.render(scene,camera);
}
requestAnimationFrame(frame);
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
});
