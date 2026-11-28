/* Landing page scroll scenes, canvases and the demo circuit. Ported verbatim from the Tapebox site. */
(()=>{
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const ramp=(v,a,b)=>clamp((v-a)/(b-a));
const DPR=()=>Math.min(window.devicePixelRatio||1,2);

/* ---------- menu ---------- */
const burger=$('#burger');
burger.addEventListener('click',()=>{
  const open=document.body.classList.toggle('menu-open');
  burger.setAttribute('aria-expanded',open);burger.setAttribute('aria-label',open?'Close menu':'Open menu');
  if(open) $$('.menu [data-scr]').forEach((el,i)=>setTimeout(()=>scramble(el),120+i*70));
});
addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open'))burger.click()});
$$('.menu a').forEach(a=>a.addEventListener('click',()=>document.body.classList.remove('menu-open')));

/* ---------- scramble ---------- */
const GLY='01NANDLATCH<>/#_=+*';
function scramble(el){
  if(RM) return;
  const final=el.dataset.txt||(el.dataset.txt=el.textContent);
  let f=0;const total=16;
  clearInterval(el._t);
  el._t=setInterval(()=>{
    f++;
    el.textContent=final.split('').map((c,i)=>{
      if(c===' ')return ' ';
      return i < (f/total)*final.length ? c : GLY[(Math.random()*GLY.length)|0];
    }).join('');
    if(f>=total){clearInterval(el._t);el.textContent=final}
  },32);
}
$$('[data-scr]').forEach(el=>el.addEventListener('mouseenter',()=>scramble(el)));

/* ---------- headline split + reveal ---------- */
$$('[data-reveal]').forEach(h=>{
  $$('.ln',h).forEach(ln=>{
    const t=ln.textContent;ln.textContent='';ln.setAttribute('aria-hidden','true');
    t.split(' ').forEach((wd,wi)=>{
      if(wi)ln.appendChild(document.createTextNode(' '));
      const w=document.createElement('span');w.className='w';
      for(const c of wd){const s=document.createElement('span');s.className='ch';s.dataset.c=c;s.textContent=c;w.appendChild(s)}
      ln.appendChild(w);
    });
  });
  const sr=document.createElement('span');sr.style.cssText='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)';
  sr.textContent=$$('.ln',h).map(l=>l.textContent).join(' ');h.appendChild(sr);
});
function reveal(h){
  if(h._on)return;h._on=true;
  const chs=$$('.ch',h);
  chs.forEach((s,i)=>{
    const c=s.dataset.c;if(c===' ')return;
    clearTimeout(s._a);clearInterval(s._b);
    if(RM){s.classList.add('on');return}
    s._a=setTimeout(()=>{
      let n=0;s.classList.add('sc');
      s._b=setInterval(()=>{
        n++;s.textContent=GLY[(Math.random()*GLY.length)|0];
        if(n>5){clearInterval(s._b);s.textContent=c;s.classList.remove('sc');s.classList.add('on')}
      },45);
    },140+i*26+Math.random()*90);
  });
}
function unreveal(h){
  if(!h._on)return;h._on=false;
  $$('.ch',h).forEach(s=>{clearTimeout(s._a);clearInterval(s._b);s.textContent=s.dataset.c;s.classList.remove('on','sc')});
}

/* ---------- scenes ---------- */
const scenes=$$('.scene');
const ticks=$('#ticks');
scenes.forEach((s,i)=>{const a=document.createElement('a');a.href='#'+s.id;a.setAttribute('aria-label','Scene '+(i+1));ticks.appendChild(a)});
const tickEls=$$('a',ticks);
tickEls.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();const s=scenes[i];scrollTo({top:s.offsetTop+(i?innerHeight*0.02:0),behavior:RM?'auto':'smooth'})}));
$('.logo').addEventListener('click',e=>{e.preventDefault();scrollTo({top:0,behavior:RM?'auto':'smooth'})});

const state={};
function frame(){
  const vh=innerHeight;let cur=0;
  scenes.forEach((s,i)=>{
    const r=s.getBoundingClientRect(),H=r.height;
    const enter=i?clamp(r.top/vh):0;
    const live=Math.max(1,H-2*vh);
    const q=clamp(-r.top/live);
    const out=i<scenes.length-1?clamp((-r.top-(H-2*vh))/vh):0;
    s.style.setProperty('--enter',enter.toFixed(4));
    s.style.setProperty('--q',q.toFixed(4));
    s.style.setProperty('--out',out.toFixed(4));
    state[s.id]={enter,q,out,vis:r.top<vh&&r.bottom>0&&out<1};
    if(r.top<=vh*0.5) cur=i;
    const h=$('[data-reveal]',s);
    const isIn=enter<0.35&&out<0.9;
    if(h){ if(isIn)reveal(h); else if(enter>0.7||r.bottom<0) unreveal(h);}
    s.classList.toggle('in',isIn);
  });
  // hero headline
  const doc=document.documentElement,tot=doc.scrollHeight-vh;
  $('#ringp').style.strokeDashoffset=(132*(1-clamp(scrollY/tot))).toFixed(1);
  $('#ringn').textContent=String(cur+1).padStart(2,'0');
  tickEls.forEach((a,i)=>a.classList.toggle('on',i===cur));
  // steps
  const q5=state.s5.q;
  $('#clock').firstChild.textContent=String(Math.round(q5*60)).padStart(2,'0');
  const th=[0.001,1/6,.5,.995];
  $$('#steps .step').forEach((el,i)=>el.classList.toggle('on',q5>=th[i]&&state.s5.enter<0.4));
  $$('#track .mk').forEach((el,i)=>el.classList.toggle('on',q5>=th[i]&&state.s5.enter<0.4));
  $('#track').style.setProperty('--q',q5);
}
let ticking=false;
addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(()=>{frame();ticking=false})}},{passive:true});
addEventListener('resize',frame);

/* ---------- canvases ---------- */
function setup(c){
  const fit=()=>{const d=DPR(),w=c.clientWidth,h=c.clientHeight;c.width=w*d;c.height=h*d;c._w=w;c._h=h;c._d=d};
  fit();new ResizeObserver(fit).observe(c);return c.getContext('2d');
}
let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});

// seeded rand
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646}}

// wafer
const wc=$('#wafer'),wx=setup(wc);
const R=rng(7);const dies=[];
const N=23;
for(let y=0;y<N;y++)for(let x=0;x<N;x++){const cx=x-(N-1)/2,cy=y-(N-1)/2;if(Math.hypot(cx,cy)<N/2-0.6)dies.push({cx,cy,b:R(),p:R()*6.28,s:.6+R()*1.4,hot:R()<.06})}
const dust=Array.from({length:140},()=>({x:R(),y:R(),z:.2+R()*.8,v:.2+R()*.6}));
function drawWafer(t){
  const c=wc,x=wx,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);
  x.fillStyle='#040705';x.fillRect(0,0,w,h);
  const q=state.s1?state.s1.q:0;
  const base=Math.max(w*.7,h*1.1)/N;
  const zoom=1+q*2.6;const cell=base*zoom;
  const ox=w/2+mx*-24,oy=h/2+my*-18;
  // glow behind
  const g=x.createRadialGradient(ox,oy,0,ox,oy,Math.max(w,h)*.7);
  g.addColorStop(0,'rgba(40,100,30,.22)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
  const gap=Math.max(1.5,cell*.07);
  for(const k of dies){
    const px=ox+k.cx*cell-cell/2,py=oy+k.cy*cell-cell/2;
    if(px>w||py>h||px+cell<0||py+cell<0)continue;
    const fl=.5+.5*Math.sin(t*.0006*k.s+k.p);
    const dist=Math.hypot(k.cx,k.cy)/(N/2);
    const l=6+k.b*10+fl*7-dist*6;
    x.fillStyle=k.hot?`hsla(${74+fl*6},80%,${30+fl*14}%,1)`:`hsl(${105+k.b*30},${40+k.b*20}%,${l}%)`;
    x.fillRect(px+gap/2,py+gap/2,cell-gap,cell-gap);
    if(cell>40){ // micro grid
      x.strokeStyle='rgba(255,255,255,.05)';x.lineWidth=1;x.beginPath();
      const m=cell/8;for(let i=1;i<8;i++){x.moveTo(px+i*m,py+gap);x.lineTo(px+i*m,py+cell-gap);x.moveTo(px+gap,py+i*m);x.lineTo(px+cell-gap,py+i*m)}x.stroke();
    }
    if(k.hot){x.shadowColor='rgba(198,244,50,.9)';x.shadowBlur=20;x.strokeStyle='rgba(198,244,50,.7)';x.strokeRect(px+gap/2,py+gap/2,cell-gap,cell-gap);x.shadowBlur=0}
  }
  // dust
  for(const p of dust){
    p.y-=p.v*.0006;if(p.y<0)p.y=1;
    const px=p.x*w+mx*40*p.z,py=p.y*h+my*30*p.z,r=p.z*2.2;
    x.fillStyle=`rgba(${p.z>.8?'230,255,150':'160,230,120'},${.15+p.z*.5})`;x.beginPath();x.arc(px,py,r,0,7);x.fill();
  }
}

// die close up: traces + glowing node network
const dc=$('#die'),dx=setup(dc);
const R2=rng(42);
const nodes=Array.from({length:26},()=>({x:.08+R2()*.84,y:.1+R2()*.8,r:2+R2()*3,ph:R2()*6.28,gold:R2()<.35}));
const edges=[];nodes.forEach((a,i)=>{const near=nodes.map((b,j)=>({j,d:Math.hypot(a.x-b.x,a.y-b.y)})).filter(o=>o.j!==i).sort((p,q)=>p.d-q.d).slice(0,2);near.forEach(o=>{if(!edges.find(e=>(e[0]===o.j&&e[1]===i)))edges.push([i,o.j,R2()])})});
const traces=Array.from({length:70},()=>{const pts=[];let x=R2(),y=R2();pts.push([x,y]);for(let k=0;k<4;k++){if(k%2){y=clamp(y+(R2()-.5)*.5)}else{x=clamp(x+(R2()-.5)*.5)}pts.push([x,y])}return{pts,o:R2()}});
function drawDie(t){
  const c=dc,x=dx,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);
  const st=state.s2||{q:0};const q=st.q;
  const bg=x.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#0b2414');bg.addColorStop(.6,'#081a0e');bg.addColorStop(1,'#04100a');x.fillStyle=bg;x.fillRect(0,0,w,h);
  const s=1.08-q*.08;x.save();x.translate(w/2,h/2);x.scale(s,s);x.rotate((q-.5)*.06);x.translate(-w/2+mx*-20,-h/2+my*-14);
  // fine grid
  x.strokeStyle='rgba(198,244,50,.045)';x.lineWidth=1;x.beginPath();
  const gs=Math.max(w,h)/40;for(let gx=0;gx<w;gx+=gs){x.moveTo(gx,0);x.lineTo(gx,h)}for(let gy=0;gy<h;gy+=gs){x.moveTo(0,gy);x.lineTo(w,gy)}x.stroke();
  // traces draw on
  const draw=ramp(q,0,.75);
  x.lineCap='round';x.lineJoin='round';
  traces.forEach(tr=>{
    const local=clamp((draw*1.4-tr.o*.4));if(local<=0)return;
    x.strokeStyle=`rgba(120,200,90,${.12+.18*tr.o})`;x.lineWidth=1.2;x.beginPath();
    const P=tr.pts.map(p=>[p[0]*w,p[1]*h]);let len=0;const seg=[];for(let i=1;i<P.length;i++){const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);seg.push(l);len+=l}
    let rem=len*local;x.moveTo(P[0][0],P[0][1]);
    for(let i=1;i<P.length&&rem>0;i++){const f=Math.min(1,rem/seg[i-1]);x.lineTo(P[i-1][0]+(P[i][0]-P[i-1][0])*f,P[i-1][1]+(P[i][1]-P[i-1][1])*f);rem-=seg[i-1]}
    x.stroke();
  });
  // network
  const net=ramp(q,.05,.6)+(RM?1:0);
  edges.forEach(([a,b,o])=>{
    const A=nodes[a],B=nodes[b];const f=clamp(net*1.5-o*.5);if(f<=0)return;
    x.strokeStyle='rgba(198,244,50,.35)';x.lineWidth=1.4;x.beginPath();x.moveTo(A.x*w,A.y*h);x.lineTo((A.x+(B.x-A.x)*f)*w,(A.y+(B.y-A.y)*f)*h);x.stroke();
    // pulse travelling
    if(f>=1){const u=(t*.00035+o)%1;x.fillStyle='rgba(240,255,190,.9)';x.beginPath();x.arc((A.x+(B.x-A.x)*u)*w,(A.y+(B.y-A.y)*u)*h,1.6,0,7);x.fill()}
  });
  nodes.forEach((n,i)=>{
    const a=clamp(net*1.6-i/nodes.length*.6);if(a<=0)return;
    const fl=.6+.4*Math.sin(t*.002+n.ph);const col=n.gold?'255,214,70':'198,244,50';
    const gr=x.createRadialGradient(n.x*w,n.y*h,0,n.x*w,n.y*h,n.r*9);gr.addColorStop(0,`rgba(${col},${.5*a*fl})`);gr.addColorStop(1,`rgba(${col},0)`);
    x.fillStyle=gr;x.beginPath();x.arc(n.x*w,n.y*h,n.r*9,0,7);x.fill();
    x.fillStyle=`rgba(${col},${a})`;x.beginPath();x.arc(n.x*w,n.y*h,n.r,0,7);x.fill();
  });
  x.restore();
}

// dots bg for circuit scene
const oc=$('#dots'),ox=setup(oc);
function drawDots(t){
  const c=oc,x=ox,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);
  const g=x.createRadialGradient(w/2,h*.42,0,w/2,h*.42,Math.max(w,h)*.7);g.addColorStop(0,'#0f2214');g.addColorStop(1,'#050806');x.fillStyle=g;x.fillRect(0,0,w,h);
  const sp=26;x.fillStyle='rgba(198,244,50,.13)';
  for(let yy=sp/2;yy<h;yy+=sp)for(let xx=sp/2;xx<w;xx+=sp){x.fillRect(xx,yy,1.2,1.2)}
}

// embers for s4
const ec=$('#embers'),ex=setup(ec);const R3=rng(99);
const emb=Array.from({length:90},()=>({x:R3(),y:R3(),v:.3+R3(),r:.6+R3()*2.2,ph:R3()*6}));
function drawEmbers(t){
  const c=ec,x=ex,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);
  for(const p of emb){p.y-=p.v*.0009;if(p.y<-.05){p.y=1.05;p.x=R3()}const px=(p.x+Math.sin(t*.0006+p.ph)*.01)*w,py=p.y*h;
    const a=.25+.5*Math.abs(Math.sin(t*.002+p.ph));x.fillStyle=p.r>2?`rgba(198,244,50,${a})`:`rgba(255,190,90,${a})`;x.beginPath();x.arc(px,py,p.r,0,7);x.fill()}
}

// mosaic (testing field)
const mc=$('#mosaic'),mxc=setup(mc);const R4=rng(5);
const tiles=[];for(let i=0;i<4000;i++)tiles.push({b:R4(),p:R4()*6.28,s:.4+R4()*1.6,k:R4()});
function drawMosaic(t){
  const c=mc,x=mxc,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);
  x.fillStyle='#050806';x.fillRect(0,0,w,h);
  const q=(state.s6||{q:0}).q;
  const cols=w<600?16:34,cell=w/cols*1.35;const rows=Math.ceil(h/cell*1.9)+4;
  const horizon=h*(.05-q*.05),camY=t*.012%cell;
  for(let r=0;r<rows;r++){
    for(let col=0;col<cols+12;col++){
      const idx=(r*53+col*7)%tiles.length,T=tiles[idx];
      // perspective: rows get bigger toward bottom
      const zr=r/rows;const sc=.35+zr*1.25;
      const cy=horizon+Math.pow(zr,1.35)*h*1.25+camY*sc;
      const cw=cell*sc,cx=w/2+(col-(cols+12)/2)*cw;
      if(cy>h+cw||cy<-cw)continue;
      const on=Math.sin(t*.0012*T.s+T.p)>.55;
      let hue=78+T.b*40,l=8+T.b*11,sat=45+T.b*28;
      if(T.k>.93){hue=40;l=36;sat=90}
      if(on){l+=12}
      x.fillStyle=`hsl(${hue},${sat}%,${l}%)`;
      const gp=Math.max(1,cw*.12);x.fillRect(cx+gp/2,cy+gp/2,cw-gp,cw-gp);
      if(cw>26&&T.k<.5){x.fillStyle=on?'rgba(10,15,5,.65)':'rgba(255,255,255,.12)';x.font=`600 ${cw*.36}px JetBrains Mono, monospace`;x.textAlign='center';x.textBaseline='middle';x.fillText(on?'1':'0',cx+cw/2,cy+cw/2+1)}
    }
  }
}

// bokeh finale
const bc=$('#bokeh'),bx=setup(bc);const R5=rng(11);
const bok=Array.from({length:46},()=>({x:R5(),y:R5(),r:8+R5()*46,ph:R5()*6,v:.2+R5()*.6,g:R5()<.25}));
function drawBokeh(t){
  const c=bc,x=bx,w=c._w,h=c._h,d=c._d;x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);
  for(const b of bok){const px=(b.x+Math.sin(t*.0002*b.v+b.ph)*.03)*w,py=(b.y+Math.cos(t*.00017*b.v+b.ph)*.03)*h;
    const a=.05+.07*Math.abs(Math.sin(t*.0008+b.ph));const col=b.g?'255,210,90':'170,240,90';
    const gr=x.createRadialGradient(px,py,0,px,py,b.r);gr.addColorStop(0,`rgba(${col},${a*1.6})`);gr.addColorStop(.7,`rgba(${col},${a})`);gr.addColorStop(1,`rgba(${col},0)`);x.fillStyle=gr;x.beginPath();x.arc(px,py,b.r,0,7);x.fill()}
}

const loops=[['s1',drawWafer],['s2',drawDie],['s3',drawDots],['s4',drawEmbers],['s6',drawMosaic],['s7',drawBokeh]];
let last=0;
function loop(t){
  for(const [id,fn] of loops){const s=state[id];if(!s||s.vis)fn(t)}
  if(!RM)requestAnimationFrame(loop);
}

/* ---------- circuit (half adder, real logic) ---------- */
function buildCircuit(){
const M=innerWidth<600,SX=M?.64:1;
const W=M?640:1000,Hh=420;
const G0={a:[60,140],b:[60,300],n1:[300,220],n2:[520,110],n3:[520,230],carry:[520,350],sum:[740,170],osum:[930,170],ocarry:[930,350]};
const G={};for(const k in G0)G[k]=[M?(k==='a'||k==='b'?50:k.startsWith('o')?W-58:G0[k][0]*SX):G0[k][0],G0[k][1]];
const wires=[['a','n1',0],['b','n1',1],['a','n2',0],['n1','n2',1],['b','n3',0],['n1','n3',1],['n1','carry',0],['n1','carry',1],['n2','sum',0],['n3','sum',1],['sum','osum',0],['carry','ocarry',0]];
const gw=M?92:110,gh=M?64:58,iw=M?80:90,ih=M?50:46;
function outPt(k){const[x,y]=G[k];if(k==='a'||k==='b')return[x+iw/2,y];return[x+gw/2,y]}
function inPt(k,i){const[x,y]=G[k];if(k.startsWith('o'))return[x-iw/2,y];return[x-gw/2,y+(i?12:-12)]}
function path(a,b){const dx=(b[0]-a[0])*.5;return`M${a[0]},${a[1]} C${a[0]+dx},${a[1]} ${b[0]-dx},${b[1]} ${b[0]},${b[1]}`}
let svg=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Half adder made of five NAND gates"><defs><filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g id="wires">`;
wires.forEach(([f,t,i],n)=>{const d=path(outPt(f),inPt(t,i));svg+=`<path class="wire" data-src="${f}" d="${d}"/><path class="flow" data-src="${f}" d="${d}"/>`});
svg+='</g>';
['n1','n2','n3','carry','sum'].forEach(k=>{const[x,y]=G[k];svg+=`<g class="gate" data-k="${k}"><rect x="${x-gw/2}" y="${y-gh/2}" width="${gw}" height="${gh}" rx="10"/><text x="${x}" y="${y-6}">NAND</text><text class="nm" x="${x}" y="${y+14}">${k}</text></g>`});
['a','b'].forEach(k=>{const[x,y]=G[k];svg+=`<g class="io in" data-k="${k}" tabindex="0" role="switch" aria-checked="false" aria-label="input ${k}"><rect x="${x-iw/2}" y="${y-ih/2}" width="${iw}" height="${ih}" rx="23"/><circle class="led" cx="${x-iw/2+20}" cy="${y}" r="5"/><text class="nm" x="${x+4}" y="${y+5}">${k}</text><text class="v" x="${x+28}" y="${y+5}">0</text></g>`});
[['osum','sum'],['ocarry','carry']].forEach(([k,l])=>{const[x,y]=G[k];svg+=`<g class="io out" data-k="${k}"><rect x="${x-iw/2-10}" y="${y-ih/2}" width="${iw+20}" height="${ih}" rx="10"/><text class="nm" x="${x-12}" y="${y+5}">${l}</text><text class="v" x="${x+34}" y="${y+5}">0</text></g>`});
svg+='</svg>';
$('#circuit').innerHTML=svg;
}
buildCircuit();
const inp={a:0,b:0};let auto=true;
function evalC(){
  const nand=(p,q)=>p&&q?0:1;
  const v={a:inp.a,b:inp.b};v.n1=nand(v.a,v.b);v.n2=nand(v.a,v.n1);v.n3=nand(v.b,v.n1);v.sum=nand(v.n2,v.n3);v.carry=nand(v.n1,v.n1);v.osum=v.sum;v.ocarry=v.carry;
  $$('#circuit .wire,#circuit .flow').forEach(p=>p.classList.toggle('hot',!!v[p.dataset.src]));
  $$('#circuit .gate').forEach(g=>g.classList.toggle('hot',!!v[g.dataset.k]));
  $$('#circuit .io').forEach(g=>{const on=!!v[g.dataset.k];g.classList.toggle('hot',on);$('.v',g).textContent=on?1:0;if(g.classList.contains('in'))g.setAttribute('aria-checked',on)});
}
function bindC(){$$('#circuit .io.in').forEach(g=>{
  const tog=()=>{auto=false;inp[g.dataset.k]^=1;evalC()};
  g.addEventListener('click',tog);g.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();tog()}});
});}
bindC();
let wasM=innerWidth<600;addEventListener('resize',()=>{const m=innerWidth<600;if(m!==wasM){wasM=m;buildCircuit();bindC();evalC()}});
let step=0;setInterval(()=>{if(!auto||!(state.s3&&state.s3.vis))return;step=(step+1)%4;inp.a=step>>1&1;inp.b=step&1;evalC()},1700);
evalC();

/* ---------- copy ---------- */
$('#copy').addEventListener('click',async e=>{
  try{await navigator.clipboard.writeText('npx @zevbuilds/tapebox up');e.target.textContent='Copied'}catch{e.target.textContent='Select it'}
  setTimeout(()=>e.target.textContent='Copy',1600);
});

frame();requestAnimationFrame(loop);
if(RM)setInterval(()=>loop(performance.now()),1000);
})();
