const fs=require('fs');
const html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
const eng=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];
const E=new Function(eng+';return {calcEmpuxos,solveFicha,calcMuro,capFactors,incFactors,baseStress,sigmaPts,integrate,svAt,layerAtDepth,boundaries}')();
let fail=0;
const ok=(n,a,b,tol=1e-6)=>{const g=Math.abs(a-b)<=tol*Math.max(1,Math.abs(b));if(!g)fail++;console.log((g?'OK  ':'FAIL')+' '+n+'  got='+(+a).toFixed(5)+' exp='+(+b).toFixed(5))};
const rad=d=>d*Math.PI/180;
const sand=[{t:1,phi:30,c:0,g:18}];
const inp0={method:'rankine',q:0,qP:0,deltaA:0,deltaP:0,beta:0,cutTension:true,paLinear:true,pp1zero:true,fsP:1,layersA:sand,layersP:sand};
const opt0={FSt:2,FSd:1.5,FSc:3,deltaB:20,ca:0,capMethod:'meyerhof',usePassive:false,soilToe:false,qStab:false,gf:1.4};

// ---- 1) gravidade retangular (hs=0, Lp=0, Lt=0): solucao fechada
let g={hf:4,bt:1.5,bb:1.5,hs:0,Lp:0,Lt:0,Df:0.01,gc:25};
let r=E.calcMuro(inp0,g,opt0);
const W=25*1.5*4, Ea=0.5*18*16/3, ya=4/3, Mov=Ea*ya;
ok('B',r.B,1.5); ok('Htot',r.Htot,4);
ok('Ea',r.Ea.H,Ea); ok('ya',r.Ea.y,ya); ok('Mov',r.Ea.Mov,Mov);
ok('W total',r.items.reduce((a,i)=>a+i.W,0),W);
ok('FS tomb',r.tomb.FS,W*0.75/Mov);
ok('FS desl',r.desl.FS,W*Math.tan(rad(20))/Ea);
const xR=(W*0.75-Mov)/W; ok('xR',r.base.xR,xR); ok('e',r.base.e,0.75-xR);
// e > B/6 -> triangular sob a ponta: Lc=3xR, sT=2V/Lc
ok('kind',r.base.kind==='toe'?1:0,1); ok('sT',r.base.sT,2*W/(3*xR));
// ---- 2) equilibrio da pressao na base (forca e momento) em varios casos
const cases=[{...g,bb:2.5,bt:2.5},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2.2,Df:1,gc:25},{hf:5,bt:0.3,bb:0.6,hs:0.6,Lp:1.5,Lt:3,Df:1.2,gc:25},{hf:2,bt:0.3,bb:0.4,hs:0.4,Lp:0,Lt:3,Df:0.5,gc:25}];
cases.forEach((gg,k)=>{
  const rr=E.calcMuro({...inp0,q:15},gg,{...opt0,soilToe:true});
  const I=E.integrate(rr.sp,0,rr.B);
  console.log(`  caso${k}: tipo de distribuição = ${rr.base.kind}`);
  ok(`caso${k} ∫σ=V`,I.E,rr.base.V,1e-9); ok(`caso${k} ∫σx=V·xR`,I.Mt,rr.base.V*rr.base.xR,1e-9);
});
// ---- 3) flexao: poligono (shoelace) x partes de concreto; solo sobre o talao por integracao numerica
g={hf:4,bt:0.3,bb:0.5,hs:0.6,Lp:0.8,Lt:2.2,Df:1,gc:25};
const L2=[{t:1.5,phi:30,c:0,g:18},{t:1,phi:28,c:5,g:19},{t:3,phi:22,c:15,g:17}];
r=E.calcMuro({...inp0,q:10,layersA:L2},g,{...opt0,soilToe:true});
const B=g.Lp+g.bb+g.Lt;
const poly=[[0,0],[B,0],[B,g.hs],[g.Lp+g.bb,g.hs],[g.Lp+g.bt,g.hs+g.hf],[g.Lp,g.hs+g.hf],[g.Lp,g.hs],[0,g.hs]];
let A2=0,cx=0;for(let i=0;i<poly.length;i++){const [x1,y1]=poly[i],[x2,y2]=poly[(i+1)%poly.length];const c=x1*y2-x2*y1;A2+=c;cx+=(x1+x2)*c}
const Ar=A2/2;cx/=6*Ar;
const conc=r.items.filter(i=>i.kind==='c');
const Wc=conc.reduce((a,i)=>a+i.W,0), xc=conc.reduce((a,i)=>a+i.W*i.x,0)/Wc;
ok('concreto W',Wc,25*Ar); ok('concreto x',xc,cx);
// solo sobre talao: sum gamma*w(z)dz (passo fino)
let Ws=0,Mx=0;const n=200000;
for(let i=0;i<n;i++){const z=(i+0.5)*g.hf/n;const gam=E.layerAtDepth(L2,z).l.g;const w=g.Lt+(g.bb-g.bt)*(g.hf-z)/g.hf;Ws+=gam*w*g.hf/n;Mx+=gam*w*(B-w/2)*g.hf/n}
const s3=r.items.find(i=>i.id==='W3');
ok('solo talao W',s3.W,Ws,1e-8); ok('solo talao x',s3.x,Mx/Ws,1e-8);
// solo sobre a ponta: gamma*(Df-hs)*Lp (sand)
const s4=r.items.find(i=>i.id==='W4');
ok('solo ponta',s4.W,E.svAt(sand,g.Df-g.hs,0)*g.Lp);
// sobrecarga sobre talao
const w0=g.Lt+g.bb-g.bt; ok('Q',r.items.find(i=>i.id==='Q').W,10*w0);
// ---- 4) empuxo: areia Ka=1/3, q=0, plano virtual ate Htot
r=E.calcMuro(inp0,{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},opt0);
ok('Ea flexao',r.Ea.H,0.5*18*4.5**2/3); ok('ya flexao',r.Ea.y,4.5/3);
// fuste: M base = gamma K hf^3/6 ; V = gamma K hf^2/2
ok('V fuste',r.stem.V,18/3*16/2); ok('M fuste',r.stem.M,18/3*64/6);
ok('Md',r.stem.Md,1.4*r.stem.M);
// com q: M = K q hf^2/2 + gamma K hf^3/6
r=E.calcMuro({...inp0,q:10},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},opt0);
ok('M fuste q',r.stem.M,10/3*16/2+18/3*64/6);
// perfil do fuste: M(hf) do perfil = M
ok('perfil M fim',r.stem.S[r.stem.S.length-1].M,r.stem.M,1e-9);
// ---- 5) passivo: Ep = 0.5*18*Df^2*3 a Df/3 ; tombamento e deslizamento com passivo
r=E.calcMuro(inp0,{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},{...opt0,usePassive:true});
ok('Ep',r.Ep.E,0.5*18*1*3); ok('yp',r.Ep.y,1/3);
const r0=E.calcMuro(inp0,{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},opt0);
ok('desl c/ Ep',r.desl.FS,(r0.desl.Rf+27)/r0.Ea.H);
ok('tomb c/ Ep',r.tomb.FS,(r0.tomb.Mest+27/3)/r0.Ea.Mov);
// FS no passivo (fsP=1.5)
r=E.calcMuro({...inp0,fsP:1.5},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},{...opt0,usePassive:true});
ok('Ep/FS',r.Ep.E,27/1.5);
// ---- 6) Coulomb: horizontal = 1/2 g H^2 Ka cos d ; vertical = H tan d
r=E.calcMuro({...inp0,method:'coulomb',deltaA:20,deltaP:0},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},opt0);
const sd=Math.sin(rad(50)),Kc=Math.sin(rad(120))**2/(Math.sin(rad(90))**2*Math.sin(rad(70))*(1+Math.sqrt(Math.sin(rad(50))*Math.sin(rad(30))/(Math.sin(rad(70))*Math.sin(rad(90)))))**2);
ok('Ka coulomb',Kc,0.2973,2e-3);
ok('Ea coulomb H',r.Ea.H,0.5*18*4.5**2*Kc*Math.cos(rad(20)),1e-9);
ok('Ea coulomb V',r.Ea.v,r.Ea.H*Math.tan(rad(20)),1e-12);
// ---- 7) fatores de capacidade de carga (tabelas)
let F=E.capFactors(30); ok('Nq30',F.Nq,18.40,1e-3); ok('Nc30',F.Nc,30.14,1e-3); ok('NgV30',F.NgV,22.40,1e-3); ok('NgM30',F.NgM,15.67,2e-3);
F=E.capFactors(20); ok('Nq20',F.Nq,6.40,2e-3); ok('Nc20',F.Nc,14.83,1e-3); ok('NgV20',F.NgV,5.39,2e-3);
F=E.capFactors(0); ok('Nc0',F.Nc,5.14,1e-3); ok('Nq0',F.Nq,1);
// ---- 8) capacidade: formula explicita (sem inclinacao: H=0 no quadrado) via incFactors
let I=E.incFactors('meyerhof',30,0,2,100,0,30.14); ok('i=1 sem H',I.iq,1); ok('ig=1',I.ig,1);
I=E.incFactors('meyerhof',30,0,2,100,100*Math.tan(rad(15)),30.14); ok('iq M 15°',I.iq,(1-15/90)**2); ok('ig M 15°',I.ig,(1-15/30)**2);
I=E.incFactors('vesic',30,0,2,100,20,30.14); ok('iq V',I.iq,0.64); ok('ig V',I.ig,0.512);
// capacidade completa num caso: recalcular na mao
r=E.calcMuro({...inp0,q:10},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},{...opt0,capMethod:'meyerhof'});
const c=r.cap, th=Math.atan2(r.Ea.H,r.base.V)*180/Math.PI, k=(1-th/90)**2, ig=(1-th/30)**2;
const qult=0+18*1*18.4011*k+0.5*18*c.Bp*15.6678*ig;
console.log('  Nq calc',c.Nq,' Ng',c.Ng,' Bp',c.Bp,' q0',c.q0,' soil',c.soil);
ok('qult manual',c.qult,18*c.Nq*k+0.5*18*c.Bp*c.Ng*ig,1e-9);
ok('FS cap',c.FS,c.qult/(r.base.V/c.Bp),1e-9);
ok('Bp',c.Bp,r.B-2*Math.abs(r.base.e),1e-12);
// ---- 9) esforcos na sapata: equilibrio global da sapata (toe + heel + fuste) -> V
//   soma das forcas verticais na sapata: pressao total = V ; cargas sobre sapata = V (resultante)
r=E.calcMuro({...inp0,q:10},{hf:4,bt:0.3,bb:0.5,hs:0.5,Lp:0.8,Lt:2,Df:1,gc:25},opt0);
const gg=r.g, Bw=r.B;
const Vp=E.integrate(r.sp,0,Bw).E;
// cargas no nivel do topo da sapata em cada trecho: pe qt*Lp ; fuste = W1 (concreto fuste) ; talao qh*Lt ; costas do fuste incluidas em W3 (entre xb e B?)
console.log('  toe V',r.toe.V.toFixed(3),'M',r.toe.M.toFixed(3),' heel V',r.heel.V.toFixed(3),'M',r.heel.M.toFixed(3));
// verificacao numerica do toe e heel (integracao de sigma(x))
const sig=x=>{const p=r.sp;if(!p.length)return 0;const [a,b]=[p[0],p[1]];if(x<a.z||x>b.z)return 0;return a.v+(b.v-a.v)*(x-a.z)/(b.z-a.z)};
let Vt=0,Mt=0;const N=200000;for(let i=0;i<N;i++){const x=(i+.5)*gg.Lp/N;const s=sig(x)-r.toe.q;Vt+=s*gg.Lp/N;Mt+=s*(gg.Lp-x)*gg.Lp/N}
ok('toe V num',r.toe.V,Vt,1e-6); ok('toe M num',r.toe.M,Mt,1e-6);
const xb=gg.Lp+gg.bb;let Vh=0,Mh=0;for(let i=0;i<N;i++){const x=xb+(i+.5)*gg.Lt/N;const s=r.heel.q-sig(x);Vh+=s*gg.Lt/N;Mh+=s*(x-xb)*gg.Lt/N}
ok('heel V num',r.heel.V,Vh,1e-6); ok('heel M num',r.heel.M,Mh,1e-6);
// ---- 10) FS cresce com Lt (sanidade) e rotulo de resultante fora da base
const fsA=E.calcMuro(inp0,{...g,Lt:1},opt0).tomb.FS, fsB=E.calcMuro(inp0,{...g,Lt:3},opt0).tomb.FS;
console.log('  FS tomb Lt=1:',fsA.toFixed(2),'Lt=3:',fsB.toFixed(2)); if(!(fsB>fsA)){fail++;console.log('FAIL sanidade Lt')}
r=E.calcMuro({...inp0,q:60},{hf:6,bt:0.3,bb:0.3,hs:0.3,Lp:0,Lt:0.2,Df:0.5,gc:25},opt0);
console.log('  muro esbelto: xR',r.base.xR.toFixed(3),'ok base',r.base.ok,'FSt',r.tomb.FS.toFixed(2),'FScap',r.cap.FS.toFixed(2),'warn',r.warn.join('|'));
// regressao: cortina (exemplo do usuario) continua igual
const ex={method:'rankine',H:3,D:3,q:10,qP:0,deltaA:0,deltaP:0,beta:0,cutTension:true,paLinear:true,pp1zero:true,
 layersA:[{t:3,phi:15,c:10,g:17},{t:3,phi:35,c:0,g:19}],layersP:[{t:3,phi:35,c:0,g:19}]};
const f=E.solveFicha(ex,1,1.2); ok('regressao cortina Z',f.Z,2.424,1e-3); ok('regressao ficha',f.Zproj,2.909,1e-3);
let bsH=E.baseStress(100,2.5,3); ok('heel kind',bsH.kind==='heel'?1:0,1); ok('heel Lc',bsH.Lc,1.5); ok('heel sH',bsH.sH,2*100/1.5);
{const I2=E.integrate(E.sigmaPts(bsH,3),0,3); ok('heel ∫σ',I2.E,100); ok('heel ∫σx',I2.Mt,250)}
let bsT=E.baseStress(100,0.5,3); ok('toe kind',bsT.kind==='toe'?1:0,1); ok('toe sT',bsT.sT,2*100/1.5);
{const I2=E.integrate(E.sigmaPts(bsT,3),0,3); ok('toe ∫σ',I2.E,100); ok('toe ∫σx',I2.Mt,50)}
console.log(fail?"FALHAS "+fail:"TODOS OK"); if(fail) process.exit(1);
