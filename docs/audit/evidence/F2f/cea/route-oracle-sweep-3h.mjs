const LAT=256,TRIG=1024,dt=1/60,sp=6.5,s2=1/Math.sqrt(2);
function run(R,U,W,L){let o={x:0,y:0,z:0},n=0;const st=Math.ceil(L/(sp*dt));
for(let k=0;k<=st;k++){const s=Math.min(L,k*sp*dt),th=s/R,c=Math.cos(th),m=Math.sin(th);
const a={x:R*(c*U.x+m*W.x),y:R*(c*U.y+m*W.y),z:R*(c*U.z+m*W.z)};
if(Math.max(Math.abs(a.x-o.x),Math.abs(a.y-o.y),Math.abs(a.z-o.z))>TRIG){for(const q of 'xyz')o[q]=LAT*Math.floor(a[q]/LAT+.5);if(k>0)n++;}}return n;}
const U={x:1,y:0,z:0},W={x:0,y:s2,z:s2};
for(const [h,nad] of [[0,1278.304],[180,1374.391],[360,1459.296]]){const R=1364.5+h;console.log(`h=${h} R=${R} nadir=${run(R,U,W,nad)} 4000=${run(R,U,W,4000)}`);}
