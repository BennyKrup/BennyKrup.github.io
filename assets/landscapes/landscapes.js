/* Two independent, dependency-free landscapes. Sand grain is sampled from the
   supplied photograph; the faceted terrain follows the supplied landscape image.
   The terrain is decorative geometry, not a visualization of research data. */
(() => {
  'use strict';
  const canvas = document.querySelector('#landscape-canvas');
  const button = document.querySelector('.motion-toggle');
  if (!canvas || !button) return;
  const scene = document.body.dataset.scene;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reduced.matches, gl, program, ready = false;
  let width = innerWidth, height = innerHeight, frame = 0, last = 0;
  let time = scene === 'sand' ? 34 : 15;
  let terrains = [];
  const terrainAttributes = {};
  let terrainBuffer, terrainIndices, terrainCount = 0;
  const uniforms = {};
  function shader(type, source) {
    const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message);
    }
    return s;
  }
  function link(vertexSource, fragmentSource) {
    const v = shader(gl.VERTEX_SHADER, vertexSource), f = shader(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram(); gl.attachShader(program,v); gl.attachShader(program,f); gl.linkProgram(program);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Landscape program unavailable');
    gl.useProgram(program);
  }
  function uniform(name) { return uniforms[name] ?? (uniforms[name] = gl.getUniformLocation(program,name)); }
  function makeSand(image) {
    link(`attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`, `
      precision highp float;
      varying vec2 uv;
      uniform vec2 resolution;
      uniform sampler2D sand;
      uniform float time;
      const float PI=3.14159265359;
      const float TAU=6.28318530718;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float radius(){return resolution.x<600.?max(resolution.x*.68,resolution.y*.37):max(resolution.x*.38,resolution.y*.48);}
      vec2 center(){return vec2(resolution.x*.79,resolution.y*(resolution.x<600.?.30:.49));}
      float spacing(){return resolution.x<600.?9.:11.;}
      float phase(){return mod(time,124.);}
      float variation(){return mod(floor(time/124.),2.);}
      float groove(vec2 pos){
        vec2 p=pos-center(); float angle=mod(atan(p.y,p.x)+PI,TAU);
        float r=length(p)+sin(angle*3.)*variation()*9.;
        float ring=floor((r-27.)/spacing());
        float rings=floor(radius()/spacing());
        float progress=min(phase()/92.,1.)*(rings+1.);
        float drawn=1.-smoothstep(progress-.025,progress+.025,ring+angle/TAU);
        float edge=smoothstep(-1.,1.,ring)*(1.-smoothstep(rings-1.,rings,ring));
        float wipe=clamp((phase()-99.)/21.,0.,1.)*1.18;
        float erasing=1.-smoothstep(wipe-.15,wipe+.02,pos.x/resolution.x*.75+pos.y/resolution.y*.25);
        float d=abs(r-(27.+(ring+.5)*spacing()));
        float trench=-1.9*exp(-d*d/1.5);
        float lip=.62*exp(-pow((d-2.4)/1.1,2.));
        return (trench+lip)*drawn*edge*(1.-erasing);
      }
      void main(){
        vec2 p=vec2(uv.x,1.-uv.y)*resolution;
        float h=groove(p);
        vec2 slope=vec2(groove(p+vec2(.7,0.))-groove(p-vec2(.7,0.)),groove(p+vec2(0.,.7))-groove(p-vec2(0.,.7)));
        vec3 normal=normalize(vec3(-slope*.75,1.));
        float light=dot(normal,normalize(vec3(-.65,-.8,1.35)));
        vec2 tex=fract(p/vec2(736.,1472.));
        float grain=dot(texture2D(sand,tex).rgb,vec3(.299,.587,.114));
        float adjacent=dot(texture2D(sand,clamp(tex+vec2(.008,.004),0.,1.)).rgb,vec3(.299,.587,.114));
        float speck=hash(floor(p*1.4));
        float dust=(grain-adjacent)*.22+(speck-.5)*.055;
        vec3 base=vec3(.827,.745,.607);
        vec3 color=base*(.78+light*.30)+dust;
        color-=vec3(.08,.06,.035)*pow(max(0.,.15-speck)/.15,2.);
        color+=vec3(.028,.022,.013)*h;
        // A small polished tracing point follows the currently engraved circle.
        float rings=floor(radius()/spacing());
        float progress=min(phase()/92.,1.)*(rings+1.);
        float active=floor(progress),angle=fract(progress)*TAU-PI;
        float r=27.+(active+.5)*spacing()-sin((angle+PI)*3.)*variation()*9.;
        vec2 tip=center()+vec2(cos(angle),sin(angle))*r;
        vec2 q=(p-tip)/4.5; float d=length(q);
        float activeTip=step(phase(),92.)*step(active,rings-1.);
        float shadow=exp(-dot(p-tip-vec2(2.,3.),p-tip-vec2(2.,3.))/34.);
        color-=vec3(.13,.11,.08)*shadow*activeTip;
        if(d<1. && activeTip>.5){
          vec3 n=normalize(vec3(q,sqrt(max(0.,1.-d*d))));
          float shine=pow(max(0.,dot(n,normalize(vec3(-.5,-.6,1.)))),18.);
          color=vec3(.49,.43,.32)+shine*.45+max(0.,dot(n,vec3(-.4,-.5,.7)))*.16;
        }
        gl_FragColor=vec4(color,1.);
      }
    `);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    gl.uniform1i(gl.getUniformLocation(program,'sand'),0);
  }
  // Every formation contributes to the same continuous heightfield. Their
  // silhouettes are authored separately; none is a copied terrain patch.
  function formationHeight(index,x,z) {
    const t=terrains[index], u=x-t.x, v=z-t.z;
    const peak=(px,pz,a,sx,sz)=>a*Math.exp(-((u-px)**2/sx+(v-pz)**2/sz));
    const ridge=(ax,az,bx,bz,a,spread)=>{
      const dx=bx-ax,dz=bz-az;
      const k=Math.max(0,Math.min(1,((u-ax)*dx+(v-az)*dz)/(dx*dx+dz*dz)));
      return a*Math.exp(-((u-ax-k*dx)**2+(v-az-k*dz)**2)/spread);
    };
    let h=0;
    switch(index) {
      case 0: // The original central summits and their fine, angular surface.
        for(const [px,pz,a,s] of [[-.46,-.24,.86,.055],[.52,.20,.66,.095],[-.13,.18,.45,.10],[.21,-.52,.53,.055],[-.72,.48,.30,.06],[.74,-.48,.32,.045]])
          h+=peak(px+Math.sin(px)*.06,pz+Math.cos(pz)*.07,a,s,s);
        break;
      case 1: // Long, broken sage escarpment at the back.
        h=ridge(-.85,-.12,.65,.18,.44,.07)+peak(-.58,-.06,.35,.06,.08)+peak(.20,.12,.40,.04,.05);
        break;
      case 2: // Narrow olive spires, staggered along a diagonal saddle.
        h=ridge(-.35,-.60,.40,.55,.20,.11)+peak(-.32,-.44,.73,.038,.08)+peak(.20,.10,.54,.065,.045)+peak(.38,.48,.40,.025,.04);
        break;
      case 3: // Broad weathered ochre mesa, unlike the pointed summits.
        h=.47*Math.exp(-((u/.63)**4+(v/.43)**4))+peak(.42,-.28,.22,.10,.07)+ridge(-.6,.3,.55,.42,.18,.10);
        break;
      case 4: // Curving fern ridge with an open, low basin.
        for(let k=0;k<7;k++){
          const angle=-.7+k*.48;
          h+=peak(Math.cos(angle)*.60,Math.sin(angle)*.43,.21,.08,.06);
        }
        h+=peak(-.12,-.43,.36,.035,.06);
        break;
      case 5: // A tall asymmetric saddle behind the right-hand range.
        h=peak(-.38,.03,.82,.065,.15)+peak(.30,-.30,.57,.13,.055)+ridge(-.35,.02,.28,-.28,.24,.09);
        break;
      case 6: // Low, wide rolling foothills in the foreground.
        h=peak(-.55,.12,.35,.30,.16)+peak(.32,-.27,.43,.24,.09)+ridge(-.65,.45,.7,.28,.15,.12);
        break;
      case 7: // Rust-brown diagonal spine with offset rocky shoulders.
        h=ridge(-.7,-.48,.55,.37,.37,.045)+peak(-.36,-.30,.34,.06,.08)+peak(.35,.30,.28,.12,.045)+peak(.15,-.38,.24,.09,.05);
        break;
      case 8: // Small, irregular distant peaks fading into the horizon.
        h=peak(-.64,.15,.40,.09,.045)+peak(-.13,-.25,.59,.048,.07)+peak(.47,.04,.33,.13,.06)+ridge(-.6,.1,.45,.02,.12,.13);
        break;
    }
    const grain=Math.sin(x*(29+index)+z*17+index*2.1)*Math.sin(z*29-x*13+index)*.12;
    return Math.max(0,h*(1+grain));
  }
  function buildTerrain() {
    const small=width<600;
    const scale=small?width*.59:Math.min(width*.42,height*.72);
    const rise=small?height*.28:Math.min(height*.55,width*.34);
    const cx=width*(small?.67:.72),cy=height*(small?.37:.70);
    // Extend the common ground beyond the viewport, including the ground
    // behind high summits. There are no rectangular island edges to expose.
    const u0=(-cx-width*.12)/scale,u1=(width-cx+width*.12)/scale;
    const v0=(-cy-height*.14)/(scale*.40),v1=(height-cy+rise*1.65)/(scale*.40);
    const nx=Math.min(180,Math.max(64,Math.ceil((u1-u0)/.039)));
    const nz=Math.min(220,Math.max(88,Math.ceil((v1-v0)/.039)));
    const stride=15,vertices=new Float32Array((nx+1)*(nz+1)*stride),indices=new Uint16Array(nx*nz*6);
    let out=0;
    for(let iz=0;iz<=nz;iz++)for(let ix=0;ix<=nx;ix++){
      let u=u0+(u1-u0)*ix/nx,v=v0+(v1-v0)*iz/nz;
      // Small deterministic offsets keep facets from looking like graph paper.
      if(ix>0&&ix<nx)u+=Math.sin(ix*127.1+iz*31.7)*.006;
      if(iz>0&&iz<nz)v+=Math.sin(iz*97.3+ix*19.1)*.006;
      const x=u*Math.cos(-.35)+v*Math.sin(-.35),z=-u*Math.sin(-.35)+v*Math.cos(-.35);
      const shapes=terrains.map((_,i)=>formationHeight(i,x,z));
      let ground=.035+.025*(1+Math.sin(x*1.7)*Math.cos(z*1.3));
      let weight=.08,color=[.39*.08,.46*.08,.36*.08];
      terrains.forEach((t,i)=>{
        // Persistent foothills join the independently moving formations.
        const apron=Math.exp(-((x-t.x)**2+(z-t.z)**2)/1.1);
        ground+=apron*.065;
        const w=apron*.18+shapes[i];weight+=w;
        color=color.map((c,j)=>c+t.color[j]*w);
      });
      vertices.set([x,z,ground,...shapes,...color.map(c=>c/weight)],out);out+=stride;
    }
    out=0;
    for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
      const a=z*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
      indices.set((x+z)%2?[a,b,c,b,d,c]:[a,b,d,a,d,c],out);out+=6;
    }
    terrainCount=indices.length;
    gl.bindBuffer(gl.ARRAY_BUFFER,terrainBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,terrainIndices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  }
  function makeTerrain() {
    const derivatives=gl.getExtension('OES_standard_derivatives');
    link(`
      precision highp float;
      attribute vec3 position,tint;
      attribute vec4 shapeA,shapeB;
      attribute float shapeC;
      uniform vec2 resolution;
      uniform vec4 levelA,levelB;
      uniform float levelC;
      varying vec3 surface,colorTint;
      varying float cap,distanceBack;
      void main(){
        float h=position.z+dot(min(shapeA,levelA),vec4(1.))+dot(min(shapeB,levelB),vec4(1.))+min(shapeC,levelC);
        float total=dot(shapeA+shapeB,vec4(1.))+shapeC+.001;
        cap=(dot(step(levelA,shapeA)*shapeA,vec4(1.))+dot(step(levelB,shapeB)*shapeB,vec4(1.))+step(levelC,shapeC)*shapeC)/total;
        float x=position.x*cos(-.35)-position.y*sin(-.35);
        float z=position.x*sin(-.35)+position.y*cos(-.35);
        float small=step(resolution.x,600.);
        float scale=mix(min(resolution.x*.42,resolution.y*.72),resolution.x*.59,small);
        float rise=mix(min(resolution.y*.55,resolution.x*.34),resolution.y*.28,small);
        vec2 center=resolution*mix(vec2(.72,.70),vec2(.67,.37),small);
        vec2 screen=center+vec2(x*scale,z*scale*.40-h*rise);
        gl_Position=vec4(screen.x/resolution.x*2.-1.,1.-screen.y/resolution.y*2.,clamp(-z*.035-h*.025,-.95,.95),1.);
        surface=vec3(position.x,h,position.y);colorTint=tint;distanceBack=z;
      }
    `,`${derivatives?'#extension GL_OES_standard_derivatives : enable':''}
      precision highp float;
      varying vec3 surface,colorTint;
      varying float cap,distanceBack;
      void main(){
        vec3 n=${derivatives?'normalize(cross(dFdx(surface),dFdy(surface)))':'normalize(vec3(-.3,1.,.25))'};
        if(n.y<0.)n=-n;
        float light=max(0.,dot(n,normalize(vec3(-.5,1.,.35))));
        vec3 highColor=mix(vec3(.80,.80,.70),colorTint+vec3(.29,.28,.25),.35);
        vec3 color=mix(colorTint,highColor,smoothstep(.10,1.05,surface.y));
        color*=.57+light*.51;
        float contour=1.-smoothstep(.0,.055,abs(fract(surface.y*17.)-.5));
        color=mix(color,vec3(.84,.85,.75),contour*.16*(1.-cap));
        color+=vec3(.075,.065,.038)*cap;
        float haze=.08+.48*(1.-smoothstep(-4.,-.35,distanceBack));
        color=mix(color,vec3(.902,.910,.875),haze);
        gl_FragColor=vec4(color,1.);
      }
    `);
    terrainBuffer=gl.createBuffer();terrainIndices=gl.createBuffer();
    const attributes=[['position',3,0],['shapeA',4,3],['shapeB',4,7],['shapeC',1,11],['tint',3,12]];
    gl.bindBuffer(gl.ARRAY_BUFFER,terrainBuffer);
    for(const [name,size,offset] of attributes){
      const location=gl.getAttribLocation(program,name);terrainAttributes[name]=location;
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,60,offset*4);
    }
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    terrains=[
      {id:'main',x:0,z:0,period:56,offset:0,color:[.33,.43,.40]},
      {id:'sage-escarpment',x:-.15,z:-1.90,period:79,offset:5,color:[.43,.52,.39]},
      {id:'olive-spires',x:1.50,z:-.45,period:61,offset:31,color:[.46,.49,.31]},
      {id:'ochre-mesa',x:-1.70,z:.10,period:67,offset:24,color:[.56,.43,.29]},
      {id:'fern-basin',x:-1.90,z:-1.75,period:83,offset:40,color:[.34,.49,.36]},
      {id:'distant-saddle',x:1.45,z:-2.30,period:71,offset:8,color:[.51,.48,.34]},
      {id:'soft-foothills',x:.35,z:1.60,period:91,offset:49,color:[.47,.55,.41]},
      {id:'umber-spine',x:-1.40,z:1.80,period:73,offset:17,color:[.53,.40,.31]},
      {id:'horizon-peaks',x:-.55,z:-3.70,period:97,offset:60,color:[.43,.51,.43]}
    ];
  }
  function terrainState(terrain) {
    const phase=((time+terrain.offset)%terrain.period)/terrain.period*56;
    const smooth=x=>x*x*(3-2*x);
    let level;
    if(phase<23)level=smooth(phase/23);
    else if(phase<28)level=1;
    else if(phase<51)level=1-smooth((phase-28)/23);
    else level=0;
    return {level:.014+level*1.04,
      phase:phase<23?'building':phase<28?'resting':phase<51?'lowering':'reconstructing'};
  }
  function drawTerrain() {
    const states=terrains.map(terrainState),levels=states.map(state=>state.level);
    gl.uniform4fv(uniform('levelA'),levels.slice(0,4));
    gl.uniform4fv(uniform('levelB'),levels.slice(4,8));
    gl.uniform1f(uniform('levelC'),levels[8]);
    gl.drawElements(gl.TRIANGLES,terrainCount,gl.UNSIGNED_SHORT,0);
    canvas.dataset.phase=states[0].phase;
    canvas.dataset.formations=String(terrains.length);
    canvas.dataset.connected='true';
    canvas.dataset.layerPhases=terrains.map((t,i)=>`${t.id}:${states[i].phase}`).join(',');
  }
  function render() {
    if(!ready||document.hidden)return;
    gl.uniform2f(uniform('resolution'),width,height);
    if(scene==='sand'){
      gl.uniform1f(uniform('time'),time);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }else{
      gl.clearColor(.902,.910,.875,1.);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      drawTerrain();
    }
  }
  function resize(){
    width=innerWidth;height=innerHeight;
    const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/(width*height)));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    if(ready){if(scene==='topography')buildTerrain();gl.viewport(0,0,canvas.width,canvas.height);render()}
  }
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;}
  function animate(timestamp){
    frame=0;if(paused||document.hidden||!ready)return;
    if(timestamp-last>=40){time+=Math.min((timestamp-last)/1000,.12);last=timestamp;render()}
    frame=requestAnimationFrame(animate);
  }
  function schedule(){stop();last=performance.now();if(!paused&&!document.hidden&&ready)frame=requestAnimationFrame(animate)}
  function sync(){
    button.setAttribute('aria-pressed',String(paused));button.setAttribute('aria-label',paused?'Resume background animation':'Pause background animation');
    button.querySelector('.motion-label').textContent=paused?'Resume':'Pause';
    button.querySelector('.motion-icon').textContent=paused?'▷':'Ⅱ';canvas.dataset.motion=paused?'paused':'playing';
  }
  button.addEventListener('click',()=>{paused=!paused;sync();schedule()});
  reduced.addEventListener('change',event=>{paused=event.matches;sync();schedule()});
  document.addEventListener('visibilitychange',()=>{render();schedule()});
  let resizeFrame=0;
  addEventListener('resize',()=>{if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize()})});
  function fallback(){ready=false;stop();canvas.hidden=true;button.hidden=true;canvas.dataset.renderer='static';}
  let sandImage;
  async function start(){
    try{
      gl=canvas.getContext('webgl',{alpha:false,antialias:scene==='topography',depth:scene==='topography',powerPreference:'low-power'});
      if(!gl)throw new Error('No WebGL');
      for(const key of Object.keys(uniforms))delete uniforms[key];
      if(scene==='sand'){
        if(!sandImage){sandImage=new Image();sandImage.src=new URL('assets/landscapes/sand-reference.png',document.baseURI).href;await sandImage.decode()}
        makeSand(sandImage);
      }else makeTerrain();
      ready=true;canvas.hidden=false;button.hidden=false;canvas.dataset.renderer='webgl';resize();sync();schedule();
    }catch(error){console.warn("Landscape effect unavailable:",error);fallback()}
  }
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback()});
  canvas.addEventListener('webglcontextrestored',start);
  sync();start();
})();
