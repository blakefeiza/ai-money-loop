(function(){
"use strict";
var NS="http://www.w3.org/2000/svg";
var T=AI.TYPES,N=AI.NODES,E=AI.EDGES,ST=AI.STEPS,LAY=AI.LAYOUT,GR=AI.GROUPS;
var byId={};E.forEach(function(e){byId[e.id]=e});
var S={i:0,sel:null,off:{},sc:null,p:0.6};
var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(n,a,p){var x=document.createElementNS(NS,n);for(var k in a||{})x.setAttribute(k,a[k]);if(p)p.appendChild(x);return x}
function $(id){return document.getElementById(id)}
function money(b){return b>=1000?"$"+(b/1000).toFixed(1).replace(/\.0$/,"")+"T":"$"+(Math.round(b*10)/10)+"B"}
function haloR(n){return n.value?20+0.8*Math.sqrt(n.value):0}
function each(l,f){Array.prototype.forEach.call(l,f)}
function sc(id){return AI.SCENARIOS.filter(function(x){return x.id===id})[0]}
function chipOf(id){var c=LAY[id].chip;return c?{rx:c[0],ry:c[1]}:{rx:31,ry:31}}
function netPos(){var P={};Object.keys(N).forEach(function(id){P[id]={x:N[id].x,y:N[id].y}});return P}
function clusterPos(){var P={};Object.keys(N).forEach(function(id){P[id]={x:LAY[id].cx,y:LAY[id].cy}});return P}

/* ---------- shared: draw a company chip (logo on a cream disc) ---------- */
function drawChip(g,id,labelBelow){
  var n=N[id],c=chipOf(id),L=LAY[id].logo;
  el("ellipse",{rx:c.rx,ry:c.ry,"class":"chip-c"},g);
  if(L){el("image",{href:"logos/"+L[0],x:-L[1]/2,y:-L[2]/2,width:L[1],height:L[2],preserveAspectRatio:"xMidYMid meet","class":"logo"},g)}
  else if(LAY[id].text){
    el("text",{x:0,y:5,"class":"wm"},g).textContent=LAY[id].text;
  }else{
    el("circle",{cx:0,cy:-6,r:7,fill:"#0b1d18"},g);
    el("path",{d:"M-13,14 C-13,3 13,3 13,14 Z",fill:"#0b1d18"},g);
  }
  var ty=labelBelow?c.ry+22:-c.ry-20,labs=[];
  var t1=el("text",{x:0,y:ty,"class":"nm"},g);t1.textContent=n.name;labs.push(t1);
  if(n.value){var t2=el("text",{x:0,y:ty+16,"class":"vl"},g);t2.textContent=money(n.value);labs.push(t2)}
  g.__labs=labs;g.__dy=labelBelow?0:(c.ry+22)-(-c.ry-20);
}
function above(id){return id==="openai"||id==="softbank"||id==="google"}

/* ---------- shared: network builder ---------- */
function makeNet(svg,o){
  var net={svg:svg,nodes:{},halo:{},edges:{},P:netPos()};
  var defs=el("defs",{},svg);
  Object.keys(T).forEach(function(k){
    var m=el("marker",{id:o.id+"-ar-"+k,viewBox:"0 0 10 10",refX:"6",refY:"5",markerUnits:"userSpaceOnUse",markerWidth:o.hero?"11":"17",markerHeight:o.hero?"11":"17",orient:"auto-start-reverse"},defs);
    el("path",{d:"M0,0 L10,5 L0,10 z",fill:T[k].color},m);
  });
  net.gHull=el("g",{"class":"hulls"},svg);
  net.gHalo=el("g",{},svg);net.gEdge=el("g",{},svg);net.gNode=el("g",{},svg);
  Object.keys(N).forEach(function(id){
    var r=haloR(N[id]);
    if(r)net.halo[id]=el("circle",{r:r,"class":"halo"},net.gHalo);
    var g=el("g",{"class":"node",tabindex:0,role:"button","aria-label":N[id].name+", "+N[id].role},net.gNode);
    drawChip(g,id,!above(id));
    net.nodes[id]=g;
  });
  E.forEach(function(e){
    var c=T[e.type].color;
    var eg=el("g",{"class":"edge"+(e.dash?" dashed":""),tabindex:o.hero?-1:0,role:"button","aria-label":e.title},net.gEdge);
    var line=el("path",{"class":"line",stroke:c,"marker-end":"url(#"+o.id+"-ar-"+e.type+")"},eg);
    line.style.setProperty("--w",(e.amt?Math.min(9,Math.max(2.2,1.6+0.38*Math.sqrt(e.amt))):2.4)+"px");
    var hit=el("path",{"class":"hit"},eg);
    var rect=null,txt=null;
    if(!o.hero){
      var pill=el("g",{"class":"pill"},eg),w=e.label.length*6.6+14;
      rect=el("rect",{width:w,height:20,rx:10,stroke:c},pill);
      txt=el("text",{fill:c},pill);txt.textContent=e.label;
    }
    net.edges[e.id]={g:eg,line:line,hit:hit,rect:rect,txt:txt,w:e.label.length*6.6+14};
  });
  net.update=function(P){
    net.P=P;
    Object.keys(N).forEach(function(id){
      var p=P[id];net.nodes[id].setAttribute("transform","translate("+p.x+","+p.y+")");
      if(net.halo[id]){net.halo[id].setAttribute("cx",p.x);net.halo[id].setAttribute("cy",p.y)}
    });
    E.forEach(function(e){
      var g=geom(e,P),h=net.edges[e.id];
      h.line.setAttribute("d",g.d);h.hit.setAttribute("d",g.d);
      if(h.rect){h.rect.setAttribute("x",g.lx-h.w/2);h.rect.setAttribute("y",g.ly-10);h.txt.setAttribute("x",g.lx);h.txt.setAttribute("y",g.ly)}
      h.d=g.d;
    });
  };
  net.update(net.P);
  return net;
}
function geom(e,P){
  var a=P[e.from],b=P[e.to],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
  var mx=(a.x+b.x)/2,my=(a.y+b.y)/2,nx=dy/len,ny=-dx/len;
  var cx=mx+nx*e.bend*2,cy=my+ny*e.bend*2;
  function edgePt(p,c,id,extra){
    var vx=c.x-p.x,vy=c.y-p.y,l=Math.hypot(vx,vy)||1;vx/=l;vy/=l;
    var k=chipOf(id),r=k.rx*k.ry/Math.sqrt(Math.pow(k.ry*vx,2)+Math.pow(k.rx*vy,2));
    return{x:p.x+vx*(r+extra),y:p.y+vy*(r+extra)};
  }
  var s=edgePt(a,{x:cx,y:cy},e.from,3),t=edgePt(b,{x:cx,y:cy},e.to,10);
  var u=e.lt||0.5,lx=(1-u)*(1-u)*s.x+2*u*(1-u)*cx+u*u*t.x,ly=(1-u)*(1-u)*s.y+2*u*(1-u)*cy+u*u*t.y;
  return{d:"M"+s.x+","+s.y+" Q"+cx+","+cy+" "+t.x+","+t.y,lx:lx,ly:ly};
}

/* ================= HERO ================= */
var hero={sel:null,auto:true,timer:null};
(function buildHero(){
  var target=byId.oa_ms.amt+byId.oa_or.amt+byId.oa_am.amt+byId.oa_cw.amt;
  var c=$("count"),t0=null;
  if(reduce)c.textContent="$"+target;
  else requestAnimationFrame(function f(t){if(!t0)t0=t;var k=Math.min(1,(t-t0)/1800),e=1-Math.pow(1-k,3);c.textContent="$"+Math.round(target*e);if(k<1)requestAnimationFrame(f)});

  var net=makeNet($("hnet"),{id:"h",hero:true});hero.net=net;
  if(!reduce)E.forEach(function(e,i){
    var h=net.edges[e.id],len=Math.hypot(net.P[e.to].x-net.P[e.from].x,net.P[e.to].y-net.P[e.from].y);
    var coin=el("circle",{r:4.5,"class":"coin"},net.gEdge);
    coin.style.transition="opacity .3s";h.coin=coin;
    el("animateMotion",{dur:(len/70+3)+"s",repeatCount:"indefinite",begin:(-(i*1.3%6))+"s",path:h.d},coin);
  });
  function caption(){
    var s=hero.sel,box=$("hcap"),h="";
    if(!s){box.innerHTML='<span class="prompt">Tap a logo to see who it is tied to.</span>';return}
    if(s.t==="n"){
      var n=N[s.id],out=E.filter(function(e){return e.from===s.id}).length,inn=E.filter(function(e){return e.to===s.id}).length;
      h='<b>'+n.name+'</b> <span class="role">'+n.role+'</span><span class="cnt">'+out+(out===1?' arrow':' arrows')+' out · '+inn+' in</span><p>'+n.plain+'</p>';
    }else{
      var e=byId[s.id];
      h='<b>'+e.title+'</b> <span class="role">'+N[e.from].name+' → '+N[e.to].name+(e.amt?' · '+money(e.amt):'')+'</span><p>'+e.plain+'</p>';
    }
    box.innerHTML=h;
  }
  function paint(){
    var s=hero.sel;
    E.forEach(function(e){
      var h=net.edges[e.id],on=s&&((s.t==="n"&&(e.from===s.id||e.to===s.id))||(s.t==="e"&&e.id===s.id));
      h.g.classList.toggle("lit",!!on);h.g.classList.toggle("dim",!!(s&&!on));
      if(h.coin)h.coin.style.opacity=(s&&!on)?0.1:1;
    });
    Object.keys(N).forEach(function(id){
      var linked=!s||(s.t==="n"&&(s.id===id||E.some(function(e){return(e.from===s.id&&e.to===id)||(e.to===s.id&&e.from===id)})))||(s.t==="e"&&(byId[s.id].from===id||byId[s.id].to===id));
      net.nodes[id].classList.toggle("faded",!linked);
      net.nodes[id].classList.toggle("sel",!!(s&&s.t==="n"&&s.id===id));
    });
    caption();
  }
  function pick(sel,user){
    if(user){hero.auto=false;clearInterval(hero.timer)}
    hero.sel=(hero.sel&&sel&&hero.sel.t===sel.t&&hero.sel.id===sel.id&&user)?null:sel;paint();
  }
  var canHover=window.matchMedia&&matchMedia("(hover:hover)").matches;
  Object.keys(N).forEach(function(id){
    var g=net.nodes[id];
    g.addEventListener("click",function(){pick({t:"n",id:id},true)});
    g.addEventListener("mouseenter",function(){if(!hero.auto&&canHover){hero.sel={t:"n",id:id};paint()}});
    g.addEventListener("keydown",function(ev){if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();pick({t:"n",id:id},true)}});
  });
  E.forEach(function(e){net.edges[e.id].g.addEventListener("click",function(){pick({t:"e",id:e.id},true)})});
  $("hnet").addEventListener("mouseleave",function(){if(!hero.auto&&canHover){hero.sel=null;paint()}});
  var tour=["nvidia","openai","anthropic","xai","intel","meta","nebius","oracle","microsoft","amazon","coreweave","blueowl"],ti=0;
  paint();
  if(!reduce){
    hero.timer=setInterval(function(){if(!hero.auto)return;hero.sel={t:"n",id:tour[ti++%tour.length]};paint()},3200);
    setTimeout(function(){if(hero.auto){hero.sel={t:"n",id:"nvidia"};paint();ti=1}},900);
  }
})();

/* ================= MAIN MAP ================= */
var svg=$("map"),net=makeNet(svg,{id:"m"}),gc=net.nodes;
(function(){
  var CP=clusterPos();
  Object.keys(GR).forEach(function(k){
    var ids=GR[k].ids,xs=[],ys=[];
    ids.forEach(function(id){var c=chipOf(id);xs.push(CP[id].x-c.rx,CP[id].x+c.rx);ys.push(CP[id].y-c.ry-12,CP[id].y+c.ry+44)});
    var x0=Math.min.apply(null,xs)-22,x1=Math.max.apply(null,xs)+22,y0=Math.min.apply(null,ys)-26,y1=Math.max.apply(null,ys)+6;
    var g=el("g",{"class":"hull"},net.gHull);
    el("rect",{x:x0,y:y0,width:x1-x0,height:y1-y0,rx:22},g);
    el("text",{x:x0+16,y:y0+20},g).textContent=GR[k].name;
  });
})();
var posNow=netPos(),posAnim=0,layoutNow="net";
function setLayout(name){
  if(name===layoutNow)return;
  layoutNow=name;
  Object.keys(gc).forEach(function(id){var g=gc[id];if(g.__dy)g.__labs.forEach(function(t){t.style.transform=name==="cluster"?"translateY("+g.__dy+"px)":""})});
  var from={},to=name==="cluster"?clusterPos():netPos();
  Object.keys(posNow).forEach(function(id){from[id]={x:posNow[id].x,y:posNow[id].y}});
  cancelAnimationFrame(posAnim);
  if(reduce){posNow=to;net.update(posNow);return}
  var t0=null;
  posAnim=requestAnimationFrame(function f(ts){
    if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/900),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,P={};
    Object.keys(to).forEach(function(id){P[id]={x:from[id].x+(to[id].x-from[id].x)*e,y:from[id].y+(to[id].y-from[id].y)*e}});
    posNow=P;net.update(P);if(k<1)posAnim=requestAnimationFrame(f);
  });
}
svg.addEventListener("click",function(ev){if(ev.target===svg&&S.sel){S.sel=null;render()}});
Object.keys(N).forEach(function(id){
  var g=gc[id],open=function(){S.sel={t:"n",id:id};render()};
  g.addEventListener("click",open);
  g.addEventListener("keydown",function(ev){if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();open()}});
});
E.forEach(function(e){
  var h=net.edges[e.id],open=function(ev){if(ev)ev.stopPropagation();S.sel={t:"e",id:e.id};render()};
  h.g.addEventListener("click",open);
  h.g.addEventListener("keydown",function(ev){if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();open()}});
});

function view(i){
  var v={nodes:{},edges:{},fresh:{}},k,st;
  for(k=0;k<=i;k++){
    st=ST[k];
    if(st.reset){v.nodes={};v.edges={}}
    if(st.all){Object.keys(N).forEach(function(x){v.nodes[x]=1});E.forEach(function(e){v.edges[e.id]=1})}
    (st.nodes||[]).forEach(function(x){v.nodes[x]=1});
    (st.edges||[]).forEach(function(x){v.edges[x]=1});
    if(k===i)(st.edges||[]).forEach(function(x){v.fresh[x]=1});
  }
  st=ST[i];
  if(st.layout==="cluster")v.edges={};
  if(st.kind==="future"){
    v.edges={};
    if(S.sc){var s=sc(S.sc);s.edges.forEach(function(x){v.edges[x]=1});s.nodes.forEach(function(x){v.nodes[x]=1})}
  }
  Object.keys(v.edges).forEach(function(id){var e=byId[id];if(!v.nodes[e.from]||!v.nodes[e.to])delete v.edges[id]});
  return v;
}
var vb={x:0,y:0,w:1000,h:720},vbKey="",vbRaf=0;
function fitView(v,full){
  var t,ids=Object.keys(v.nodes);
  if(full||ids.length>=7||!ids.length){t={x:0,y:0,w:1000,h:720}}
  else{
    var xs=[],ys=[];ids.forEach(function(id){xs.push(N[id].x);ys.push(N[id].y)});
    var x0=Math.min.apply(null,xs),x1=Math.max.apply(null,xs),y0=Math.min.apply(null,ys),y1=Math.max.apply(null,ys);
    var w=Math.max(x1-x0+380,480),h=Math.max(y1-y0+320,340);
    if(w/h<1000/720)w=h*1000/720;else h=w*720/1000;
    if(w>1000){w=1000;h=720}
    var cx=(x0+x1)/2,cy=(y0+y1)/2;
    t={x:Math.max(0,Math.min(1000-w,cx-w/2)),y:Math.max(0,Math.min(720-h,cy-h/2)),w:w,h:h};
  }
  var key=[t.x,t.y,t.w].join();if(key===vbKey)return;vbKey=key;
  if(reduce){vb=t;svg.setAttribute("viewBox",[t.x,t.y,t.w,t.h].join(" "));return}
  var from={x:vb.x,y:vb.y,w:vb.w,h:vb.h},t0=null;cancelAnimationFrame(vbRaf);
  vbRaf=requestAnimationFrame(function f(ts){
    if(!t0)t0=ts;var k=Math.min(1,(ts-t0)/700),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    vb={x:from.x+(t.x-from.x)*e,y:from.y+(t.y-from.y)*e,w:from.w+(t.w-from.w)*e,h:from.h+(t.h-from.h)*e};
    svg.setAttribute("viewBox",[vb.x,vb.y,vb.w,vb.h].join(" "));
    if(k<1)vbRaf=requestAnimationFrame(f);
  });
}
function drawMap(st){
  var v=view(S.i),explore=st.kind==="explore",cluster=st.layout==="cluster";
  setLayout(cluster?"cluster":"net");
  fitView(v,cluster);
  net.gHull.style.opacity=cluster?1:0;
  var sel=S.sel,selEdge=sel&&sel.t==="e"?sel.id:null,selNode=sel&&sel.t==="n"?sel.id:null;
  drawLegend(v,explore);
  each(svg.querySelectorAll(".coin"),function(c){c.remove()});
  E.forEach(function(e){
    var h=net.edges[e.id],show=v.edges[e.id]&&!S.off[e.type];
    h.g.classList.toggle("hidden",!show);
    var dim=false;
    if(selEdge)dim=e.id!==selEdge;
    else if(selNode)dim=!(e.from===selNode||e.to===selNode);
    else if(!st.noDim&&!v.fresh[e.id])dim=true;
    h.g.classList.toggle("dim",!!(show&&dim));
    h.g.classList.toggle("sel",e.id===selEdge);
    h.g.classList.toggle("pulse",!!(show&&v.fresh[e.id]&&!sel&&!st.noDim));
    if(show&&st.coins&&!reduce){
      var coin=el("circle",{r:6,"class":"coin"},net.gEdge);
      el("animateMotion",{dur:"2.2s",repeatCount:"indefinite",path:h.d},coin);
    }
  });
  Object.keys(N).forEach(function(id){
    var g=gc[id],on=!!v.nodes[id];
    g.classList.toggle("gone",!on);
    if(net.halo[id])net.halo[id].style.opacity=(on&&!cluster)?1:0;
    var faded=false;
    if(selNode||selEdge){
      faded=true;
      if(id===selNode)faded=false;
      if(selNode)E.forEach(function(e){if(v.edges[e.id]&&(e.from===selNode&&e.to===id||e.to===selNode&&e.from===id))faded=false});
      if(selEdge&&(byId[selEdge].from===id||byId[selEdge].to===id))faded=false;
    }
    g.classList.toggle("faded",faded);
    g.classList.toggle("sel",id===selNode);
  });
}
function drawLegend(v,explore){
  var used={},h="";
  Object.keys(v.edges).forEach(function(id){used[byId[id].type]=1});
  Object.keys(T).forEach(function(k){
    if(!explore&&!used[k])return;
    h+=explore?'<button class="chip'+(S.off[k]?" off":"")+'" data-t="'+k+'" title="'+T[k].blurb+'"><i style="background:'+T[k].color+'"></i>'+T[k].name+'</button>':'<span class="chip"><i style="background:'+T[k].color+'"></i>'+T[k].name+'</span>';
  });
  $("legend").innerHTML=h;
  each($("legend").querySelectorAll("button"),function(b){b.onclick=function(){S.off[b.dataset.t]=!S.off[b.dataset.t];render()}});
}

/* ================= RATIO ================= */
var ratio={};
(function(){
  var r=$("ratio"),K=22,base=500;
  el("text",{x:40,y:46,"class":"t-key"},r).textContent="Each square's area is drawn to scale.";
  function pair(key,cx,name,a,b,putLabel,backLabel){
    var g=el("g",{"class":"sq"},r),sa=K*Math.sqrt(a),sb=K*Math.sqrt(b),gap=22,x0=cx-(sa+gap+sb)/2;
    el("rect",{x:x0,y:base-sa,width:sa,height:sa,fill:T.inv.color},g);
    el("rect",{x:x0+sa+gap,y:base-sb,width:sb,height:sb,fill:T.svc.color},g);
    el("text",{x:x0+sa+gap+sb/2,y:base-sb-18,"class":"t-big"},g).textContent=(Math.round(b/a*10)/10)+"×";
    el("text",{x:cx,y:base+34,"class":"t-name"},g).textContent=name;
    el("text",{x:x0+sa/2,y:base+60,"class":"t-sub"},g).textContent=putLabel;
    el("text",{x:x0+sa+gap+sb/2,y:base+60,"class":"t-sub"},g).textContent=backLabel;
    ratio[key]=g;
  }
  pair("a",250,"Microsoft → Anthropic",byId.ms_an.amt,byId.an_ms.amt,"$5B put in","$30B promised");
  pair("b",740,"Amazon → OpenAI",byId.am_oa.amt,byId.oa_am.amt,"$50B put in","$138B promised");
})();
function drawRatio(st){
  ratio.a.style.opacity=(st.pair===2)?0.25:1;
  ratio.b.style.opacity=(st.pair===1)?0:1;
  each(ratio.a.querySelectorAll(".t-big"),function(t){t.style.opacity=(st.pair===1||st.pair===3)?1:0});
  each(ratio.b.querySelectorAll(".t-big"),function(t){t.style.opacity=st.pair>=2?1:0});
}

/* ================= MATRIX (who is on both sides?) ================= */
(function(){
  var r=$("matrix"),X1=600,X2=830,Y0=190,ROW=62,K=1.5;
  var rows=[
    {id:"nvidia",oa:byId.nv_oa.amt,an:byId.nv_an.amt},
    {id:"microsoft",oa:byId.oa_ms.amt,an:byId.ms_an.amt+byId.an_ms.amt},
    {id:"amazon",oa:byId.am_oa.amt+byId.oa_am.amt,an:byId.am_an.amt,anPlus:true},
    {id:"oracle",oa:byId.oa_or.amt},
    {id:"coreweave",oa:byId.oa_cw.amt},
    {id:"softbank",oa:byId.sb_oa.amt},
    {id:"amd",oaND:true},
    {id:"google",anND:true}
  ];
  [["openai",X1,"OpenAI"],["anthropic",X2,"Anthropic"]].forEach(function(h){
    var L=LAY[h[0]].logo,g=el("g",{transform:"translate("+h[1]+",80)"},r);
    el("circle",{r:30,fill:"#f4efe4"},g);
    el("image",{href:"logos/"+L[0],x:-18,y:-18,width:36,height:36},g);
    el("text",{x:0,y:58,"class":"t-name"},g).textContent=h[2];
  });
  el("rect",{x:30,y:Y0-ROW/2+4,width:940,height:ROW*3-8,rx:14,fill:"rgba(255,200,87,.10)",stroke:"rgba(255,200,87,.5)"},r);
  el("text",{x:954,y:Y0-ROW/2+28,"class":"t-key",fill:"#ffc857",style:"text-anchor:end;letter-spacing:.14em"},r).textContent="BACK BOTH LABS";
  rows.forEach(function(row,i){
    var y=Y0+i*ROW,L=LAY[row.id].logo,g=el("g",{transform:"translate(0,"+y+")"},r);
    var chip=el("g",{transform:"translate(96,0)"},g),wide=!!LAY[row.id].chip;
    el("ellipse",{rx:wide?42:20,ry:19,fill:"#f4efe4"},chip);
    if(L){var w=wide?70:26,h=L[2]*(w/L[1]);el("image",{href:"logos/"+L[0],x:-w/2,y:-h/2,width:w,height:h},chip)}
    el("text",{x:160,y:6,"class":"t-name",style:"text-anchor:start"},g).textContent=N[row.id].name;
    function cell(cx,amt,nd,plus){
      if(nd){el("circle",{cx:cx,cy:0,r:12,fill:"none",stroke:"#9fb3ab","stroke-dasharray":"3 3","stroke-width":1.5},g);el("text",{x:cx+22,y:5,"class":"t-sub",style:"text-anchor:start"},g).textContent="not public";return}
      if(amt==null){el("text",{x:cx,y:5,"class":"t-sub"},g).textContent="—";return}
      var rr=Math.max(4,K*Math.sqrt(amt));
      el("circle",{cx:cx,cy:0,r:rr,fill:"#ff6b6b","fill-opacity":.9},g);
      el("text",{x:cx+rr+10,y:5,"class":"t-sub",style:"text-anchor:start;fill:#f4efe4"},g).textContent=money(amt)+(plus?"+":"");
    }
    cell(X1-20,row.oa,row.oaND);
    cell(X2-20,row.an,row.anND,row.anPlus);
  });
  el("text",{x:40,y:Y0+8*ROW-8,"class":"t-key"},r).textContent="Circle area = disclosed dollars between the company and that lab: investments plus promised spending.";
  el("text",{x:40,y:Y0+8*ROW+12,"class":"t-key"},r).textContent="Dashed = amount not public. Amazon's Anthropic figure leaves out its undisclosed cloud spending.";
})();

/* ================= SCALE (promises vs what customers pay) ================= */
(function(){
  var r=$("scale"),K=13,base=540;
  var P=byId.oa_ms.amt+byId.oa_or.amt+byId.oa_am.amt+byId.oa_cw.amt,R=byId.cu_oa.amt,LOSS=14;
  function side(v){return K*Math.sqrt(v)}
  el("text",{x:40,y:46,"class":"t-key"},r).textContent="Squares are drawn to scale by area.";
  var sp=side(P),x0=50;
  el("rect",{x:x0,y:base-sp,width:sp,height:sp,fill:T.svc.color,"fill-opacity":.85},r);
  el("text",{x:x0+sp/2,y:base-sp/2+16,"class":"t-big",style:"fill:#0b1d18;font-size:80px"},r).textContent="$"+Math.round(P)+"B";
  el("text",{x:x0+sp/2,y:base+34,"class":"t-name"},r).textContent="Promised to four clouds";
  el("text",{x:x0+sp/2,y:base+58,"class":"t-sub"},r).textContent="Paid over several years";
  var sr=side(R),xr=x0+sp+80;
  el("rect",{x:xr,y:base-sr,width:sr,height:sr,fill:"#f4efe4"},r);
  el("text",{x:xr+sr/2,y:base-sr-14,"class":"t-pct hot",style:"font-size:36px"},r).textContent="$"+R+"B";
  el("text",{x:xr+sr/2,y:base+34,"class":"t-name"},r).textContent="Customers pay";
  el("text",{x:xr+sr/2,y:base+58,"class":"t-sub"},r).textContent="per year, run-rate";
  var sl=side(LOSS),xl=xr+sr+130;
  el("rect",{x:xl,y:base-sl,width:sl,height:sl,fill:"none",stroke:"#ff6b6b","stroke-width":2,"stroke-dasharray":"5 4"},r);
  el("text",{x:xl+sl/2,y:base-sl-14,"class":"t-pct",style:"font-size:30px;fill:#ff6b6b"},r).textContent="~$"+LOSS+"B";
  el("text",{x:xl+sl/2,y:base+34,"class":"t-name"},r).textContent="Projected loss";
  el("text",{x:xl+sl/2,y:base+58,"class":"t-sub"},r).textContent="2026, reported";
  el("text",{x:xr+sr/2+20,y:170,"class":"t-big",style:"text-anchor:start;font-size:72px"},r).textContent=Math.round(P/R)+"×";
  el("text",{x:xr+sr/2+20,y:200,"class":"t-key",style:"text-anchor:start"},r).textContent="the promises equal about "+Math.round(P/R)+" years";
  el("text",{x:xr+sr/2+20,y:222,"class":"t-key",style:"text-anchor:start"},r).textContent="of today's customer revenue.";
})();

/* ================= EXPOSURE ================= */
var expo={items:[]};
(function(){
  var r=$("expo"),K=1.9,base=470,gap=40;
  var rows=[["oracle",byId.oa_or.amt,"promised"],["microsoft",byId.oa_ms.amt,"promised"],["amazon",byId.oa_am.amt,"promised"],["nvidia",byId.nv_oa.amt+byId.nv_oa_g.amt,"invested + guaranteed"]];
  el("text",{x:40,y:70,"class":"t-key"},r).textContent="Gray circle: what the company is worth. Red circle: what OpenAI has promised it.";
  el("text",{x:40,y:92,"class":"t-key"},r).textContent="Both drawn to scale by area.";
  var total=0;rows.forEach(function(x){total+=2*K*Math.sqrt(N[x[0]].value)+gap});total-=gap;
  var x=(1000-total)/2;
  rows.forEach(function(row){
    var id=row[0],val=N[id].value,R=K*Math.sqrt(val),cx=x+R;x+=2*R+gap;
    var g=el("g",{"class":"exp-g"},r);
    el("circle",{cx:cx,cy:base-R,r:R,"class":"out"},g);
    var L=LAY[id].logo,lw=Math.min(R*0.9,58),lh=lw*L[2]/L[1];
    el("image",{href:"logos/"+L[0],x:cx-lw/2,y:base-R-lh/2-R*0.35,width:lw,height:lh,opacity:.85},g);
    var inn=el("circle",{cx:cx,cy:base,r:0,"class":"inn"},g);
    el("text",{x:cx,y:base+32,"class":"t-name"},g).textContent=N[id].name;
    el("text",{x:cx,y:base+54,"class":"t-sub"},g).textContent="worth "+money(val);
    var line=el("text",{x:cx,y:base+78,"class":"t-sub"},g);
    var pct=el("text",{x:cx,y:base+124,"class":"t-pct"},g);
    el("text",{x:cx,y:base+146,"class":"t-sub"},g).textContent="of its value";
    expo.items.push({id:id,amt:row[1],val:val,K:K,base:base,g:g,inn:inn,line:line,pct:pct,what:row[2]});
  });
})();
function drawExpo(st){
  var p=st.slider?S.p:(st.p==null?1:st.p);
  expo.items.forEach(function(it){
    var a=it.amt*p,ri=it.K*Math.sqrt(a),pc=a/it.val*100;
    it.inn.style.r=ri+"px";it.inn.style.cy=(it.base-ri)+"px";
    it.inn.setAttribute("r",ri);it.inn.setAttribute("cy",it.base-ri);
    it.line.textContent=it.what+" "+money(a);
    it.pct.textContent=(pc>=10?pc.toFixed(0):pc.toFixed(1))+"%";
    it.pct.setAttribute("class","t-pct"+(it.id==="oracle"&&p>=0.5?" hot":""));
    it.g.classList.toggle("dimmed",!!(st.focus&&st.focus!==it.id));
  });
  var pv=$("pv");if(pv)pv.textContent=Math.round(S.p*100)+"%";
  var rp=$("ripple");
  if(rp)rp.textContent=S.p>=0.3?"Second round: Oracle and CoreWeave owe lenders for data centers built for OpenAI, so they may cut Nvidia chip orders. That is how a lab's problem reaches Nvidia, even though Nvidia is only about 3% exposed directly.":"Small shortfalls get absorbed. Keep dragging.";
}

/* ================= STEPS (text column) ================= */
(function buildSteps(){
  var h="";
  ST.forEach(function(st,i){
    h+='<section class="step" data-i="'+i+'"><div class="card">';
    if(st.act){var m=st.act.split(" · ");h+='<div class="chap"><b>'+m[0]+'</b><span>'+m[1]+'</span></div>'}
    h+='<h2>'+st.head+'</h2>';
    if(st.sub)h+='<p class="sub">'+st.sub+'</p>';
    if(st.more)st.more.forEach(function(m){h+='<details class="more"><summary>'+m.q+'</summary><p>'+m.a+'</p></details>'});
    if(st.facts){h+='<div class="facts">';st.facts.forEach(function(f){h+='<div class="fact"><b>'+f[0]+'</b><span>'+f[1]+'</span></div>'});h+='</div>'}
    if(st.slider)h+='<div class="pv" id="pv"></div><input class="slider" id="sl" type="range" min="0" max="100" step="5" value="'+Math.round(S.p*100)+'" aria-label="Share of OpenAI promises that fall through"><p class="ripple" id="ripple"></p><p class="small">Contract value at risk, not a loss estimate. Rent is rarely lost all at once.</p>';
    if(st.kind==="future"){
      AI.SCENARIOS.forEach(function(s){h+='<button class="sc" style="--c:'+s.color+'" data-s="'+s.id+'"><b>'+s.name+'</b><span>'+s.summary+'</span></button>'});
      h+='<div id="scbody"></div>';
    }
    if((st.scene||"map")==="map")h+='<div class="detail" data-d="'+i+'"></div>';
    h+='</div></section>';
  });
  $("steps").innerHTML=h;
  var sl=$("sl");if(sl)sl.oninput=function(){S.p=sl.value/100;render()};
  each(document.querySelectorAll(".sc"),function(b){b.onclick=function(){S.sc=S.sc===b.dataset.s?null:b.dataset.s;S.sel=null;render()}});
})();

/* ================= RENDER ================= */
function render(){
  var st=ST[S.i],scene=st.scene||"map";
  each(document.querySelectorAll(".step"),function(s){s.classList.toggle("on",+s.dataset.i===S.i)});
  ["map","ratio","matrix","expo","scale"].forEach(function(k){$(k).classList.toggle("on",k===scene)});
  var act="";for(var k=S.i;k>=0;k--){if(ST[k].act){act=ST[k].act;break}}
  $("act").textContent=act;
  if(scene==="map"){drawMap(st)}else{$("legend").innerHTML=""}
  if(scene==="ratio")drawRatio(st);
  if(scene==="expo")drawExpo(st);
  $("hint").textContent=(scene==="map"&&!S.sel)?(st.hint||""):"";
  each(document.querySelectorAll(".sc"),function(b){b.classList.toggle("on",b.dataset.s===S.sc)});
  var sb=$("scbody");
  if(sb){
    var s=S.sc?sc(S.sc):null;
    sb.innerHTML=s?'<div class="scbody" style="--c:'+s.color+'"><p class="lbl">How it plays out</p><p>'+s.how+'</p><p class="lbl">Early warning signs</p><ul>'+s.watch.map(function(w){return"<li>"+w+"</li>"}).join("")+'</ul><p class="small">'+s.note+'</p></div>':"";
  }
  drawDetail();
}
function drawDetail(){
  each(document.querySelectorAll(".detail"),function(x){x.innerHTML=""});
  var d=document.querySelector('.detail[data-d="'+S.i+'"]');if(!d)return;
  var s=S.sel;
  if(!s||(ST[S.i].scene||"map")!=="map")return;
  var h='<div class="dcard"><button class="close" id="x" aria-label="Close">×</button>';
  if(s.t==="e"){
    var e=byId[s.id],c=T[e.type];
    h+='<span class="tag" style="background:'+c.color+'">'+c.name+'</span> <span class="badge b-'+e.status+'">'+e.status+'</span>'+
       '<h3>'+e.title+'</h3><p class="small">'+N[e.from].name+' → '+N[e.to].name+(e.amt?" · "+money(e.amt):"")+'</p>'+
       '<p class="lbl">In plain English</p><p>'+e.plain+'</p><p class="lbl">Why it matters</p><p>'+e.why+'</p><p class="small">Source: '+e.src+'</p>';
  }else{
    var n=N[s.id],v=view(S.i);
    h+='<p class="small">'+n.role+(n.value?" · "+money(n.value)+" market value":"")+'</p><h3>'+n.name+'</h3><p>'+n.plain+'</p>';
    var out=E.filter(function(e){return e.from===s.id&&v.edges[e.id]}),inn=E.filter(function(e){return e.to===s.id&&v.edges[e.id]});
    var list=function(a,t){if(!a.length)return"";return '<p class="lbl">'+t+'</p><div class="links">'+a.map(function(e){return '<button class="lk" data-e="'+e.id+'" style="border-color:'+T[e.type].color+'">'+(t==="Money going out"?N[e.to].name:N[e.from].name)+" · "+e.label+'</button>'}).join("")+'</div>'};
    h+=list(out,"Money going out")+list(inn,"Money coming in");
  }
  h+='</div>';
  d.innerHTML=h;
  $("x").onclick=function(){S.sel=null;render()};
  each(d.querySelectorAll(".lk"),function(b){b.onclick=function(){S.sel={t:"e",id:b.dataset.e};render()}});
}

/* ================= SCROLL ================= */
var narrow=window.innerWidth<=900;
var io=new IntersectionObserver(function(es){
  es.forEach(function(en){
    if(en.isIntersecting){var i=+en.target.dataset.i;if(i!==S.i){S.i=i;S.sel=null;if(ST[i].kind!=="future")S.sc=null;render()}}
  });
},{rootMargin:narrow?"-62% 0px -20% 0px":"-45% 0px -45% 0px"});
each(document.querySelectorAll(".step"),function(s){io.observe(s)});
window.addEventListener("scroll",function(){
  var h=document.documentElement,p=h.scrollTop/(h.scrollHeight-h.clientHeight);
  $("bar").style.width=Math.min(100,p*100)+"%";
},{passive:true});
$("sources").innerHTML=AI.SOURCES.map(function(s){return '<li><a href="'+s[1]+'" target="_blank" rel="noopener">'+s[0]+'</a></li>'}).join("");
render();
})();
