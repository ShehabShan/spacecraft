const R=1364.5+180, LAT=256,TRIG=1024, dt=1/60, sp=6.5;
function run(U,W,L){let o={x:0,y:0,z:0},n=-1;const st=Math.ceil(L/(sp*dt));
for(let k=0;k<=st;k++){const s=Math.min(L,k*sp*dt),th=s/R,c=Math.cos(th),m=Math.sin(th);
const a={x:R*(c*U.x+m*W.x),y:R*(c*U.y+m*W.y),z:R*(c*U.z+m*W.z)};
if(Math.max(Math.abs(a.x-o.x),Math.abs(a.y-o.y),Math.abs(a.z-o.z))>TRIG){for(const q of 'xyz')o[q]=LAT*Math.floor(a[q]/LAT+.5);n++;}}return n;}
const s2=1/Math.sqrt(2);
const cases={axis_y:[{x:1,y:0,z:0},{x:0,y:1,z:0}],axis_yz:[{x:1,y:0,z:0},{x:0,y:s2,z:s2}]};
for(const [k,[U,W]] of Object.entries(cases))console.log(k,'nadir',run(U,W,1374.391),'4000',run(U,W,4000),'teleport4300',run(U,W,4300));
