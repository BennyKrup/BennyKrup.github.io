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
  function buildTerrain(terrain, seed) {
    const n=terrain.detail, vertices=[], points=[];
    const random=(x,z)=>{const v=Math.sin(x*127.1+z*311.7+seed*48.2)*43758.5453;return v-Math.floor(v)};
    function elevation(x,z) {
      const peaks=[[-.46,-.24,.86,.055],[.52,.20,.66,.095],[-.13,.18,.45,.10],[.21,-.52,.53,.055],[-.72,.48,.30,.06],[.74,-.48,.32,.045]];
      let h=.025;
      for(const [px,pz,a,s] of peaks) {
        const dx=x-px-Math.sin(seed*1.7+px)*.06, dz=z-pz-Math.cos(seed*1.3+pz)*.07;
        h+=a*Math.exp(-(dx*dx+dz*dz)/s);
      }
      h*=1+Math.sin(x*31+z*17+seed)*Math.sin(z*29-x*13)*.14;
      h+=(random(x,z)-.5)*.065*Math.min(h*3,1);
      return Math.max(.013,h);
    }
    for(let z=0;z<=n;z++) for(let x=0;x<=n;x++) {
      const px=x/n*2-1,pz=z/n*2-1;
      points.push([px,elevation(px,pz),pz]);
    }
    function triangle(a,b,c) {
      const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
      let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const len=Math.hypot(...normal);normal=normal.map(q=>q/len);if(normal[1]<0)normal=normal.map(q=>-q);
      for(const p of [a,b,c])vertices.push(...p,...normal);
    }
    for(let z=0;z<n;z++)for(let x=0;x<n;x++){
      const a=points[z*(n+1)+x],b=points[z*(n+1)+x+1],c=points[(z+1)*(n+1)+x],d=points[(z+1)*(n+1)+x+1];
      if((x+z)%2){triangle(a,b,c);triangle(b,d,c)}else{triangle(a,b,d);triangle(a,d,c)}
    }
    terrain.count=vertices.length/6;
    gl.bindBuffer(gl.ARRAY_BUFFER,terrain.buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  }
  function makeTerrain() {
    link(`
      precision highp float;
      attribute vec3 position,faceNormal;
      uniform vec2 resolution;
      uniform float level,yaw,scaleFactor,riseFactor;
      uniform vec4 placement;
      varying vec3 normal;
      varying float altitude,originalHeight;
      varying vec2 ground;
      void main(){
        float h=min(position.y,level);
        float x=position.x*cos(yaw)-position.z*sin(yaw);
        float z=position.x*sin(yaw)+position.z*cos(yaw);
        float small=step(resolution.x,600.);
        float scale=mix(min(resolution.x*.42,resolution.y*.72),resolution.x*.59,small)*scaleFactor;
        float rise=mix(min(resolution.y*.55,resolution.x*.34),resolution.y*.28,small)*riseFactor;
        vec2 center=resolution*mix(placement.xy,placement.zw,small);
        vec2 screen=center+vec2(x*scale,z*scale*.40-h*rise);
        gl_Position=vec4(screen.x/resolution.x*2.-1.,1.-screen.y/resolution.y*2.,-z*.22-h*.1,1.);
        normal=faceNormal;altitude=h;originalHeight=position.y;ground=position.xz;
      }
    `,`
      precision highp float;
      varying vec3 normal;
      varying float altitude,originalHeight;
      varying vec2 ground;
      uniform float level,haze;
      uniform vec3 lowColor,highColor;
      void main(){
        float clipped=smoothstep(level-.008,level+.008,originalHeight);
        vec3 n=normalize(mix(normal,vec3(0.,1.,0.),clipped));
        float light=max(0.,dot(n,normalize(vec3(-.5,1.,.35))));
        vec3 color=mix(lowColor,highColor,smoothstep(0.,.85,altitude));
        color*=.57+light*.51;
        float contour=1.-smoothstep(.0,.055,abs(fract(altitude*17.)-.5));
        color=mix(color,vec3(.84,.85,.75),contour*.20*(1.-clipped));
        // The uppermost unfinished slice catches light as it is assembled.
        float rim=1.-smoothstep(.0,.012,abs(altitude-level));
        color+=vec3(.15,.13,.075)*rim*.48;
        float grid=(1.-smoothstep(.0,.035,abs(fract(ground.x*27.)-.5)))+(1.-smoothstep(.0,.035,abs(fract(ground.y*27.)-.5)));
        color+=vec3(.025)*grid*clipped;
        color=mix(color,vec3(.902,.910,.875),haze);
        gl_FragColor=vec4(color,1.);
      }
    `);
    terrainAttributes.position=gl.getAttribLocation(program,'position');
    terrainAttributes.faceNormal=gl.getAttribLocation(program,'faceNormal');
    gl.enableVertexAttribArray(terrainAttributes.position);
    gl.enableVertexAttribArray(terrainAttributes.faceNormal);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    // Back to front: three smaller, quieter formations surround the original.
    // Distinct periods and offsets keep their construction stages independent.
    terrains=[
      {id:'distant-sage',detail:32,period:79,offset:5,seed:7,
        placement:[.80,.29,.78,.15],scale:.48,rise:.47,yaw:-.12,haze:.43,
        low:[.39,.49,.40],high:[.80,.83,.70]},
      {id:'right-olive',detail:36,period:61,offset:31,seed:21,
        placement:[1.08,.52,1.04,.46],scale:.43,rise:.58,yaw:-.68,haze:.28,
        low:[.43,.46,.31],high:[.83,.78,.61]},
      {id:'left-earth',detail:36,period:67,offset:24,seed:13,
        placement:[.12,.79,.09,.64],scale:.45,rise:.48,yaw:.40,haze:.30,
        low:[.49,.37,.27],high:[.83,.73,.57]},
      {id:'main',detail:54,period:56,offset:0,seed:0,
        placement:[.72,.70,.67,.37],scale:1,rise:1,yaw:-.35,haze:0,
        low:[.33,.43,.40],high:[.80,.80,.70]}
    ].map(terrain=>({...terrain,buffer:gl.createBuffer(),generation:-1,count:0}));
  }
  function terrainState(terrain) {
    const clock=time+terrain.offset;
    const phase=(clock%terrain.period)/terrain.period*56;
    const smooth=x=>x*x*(3-2*x);
    let level;
    if(phase<23)level=smooth(phase/23);
    else if(phase<28)level=1;
    else if(phase<51)level=1-smooth((phase-28)/23);
    else level=0;
    return {generation:Math.floor(clock/terrain.period),level:.014+level*1.04,
      phase:phase<23?'building':phase<28?'resting':phase<51?'lowering':'reconstructing'};
  }
  function drawTerrain(terrain,state) {
    if(state.generation!==terrain.generation){
      terrain.generation=state.generation;
      buildTerrain(terrain,terrain.seed+terrain.generation);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,terrain.buffer);
    gl.vertexAttribPointer(terrainAttributes.position,3,gl.FLOAT,false,24,0);
    gl.vertexAttribPointer(terrainAttributes.faceNormal,3,gl.FLOAT,false,24,12);
    gl.uniform1f(uniform('level'),state.level);
    gl.uniform1f(uniform('yaw'),terrain.yaw);
    gl.uniform1f(uniform('scaleFactor'),terrain.scale);
    gl.uniform1f(uniform('riseFactor'),terrain.rise);
    gl.uniform4f(uniform('placement'),...terrain.placement);
    gl.uniform3f(uniform('lowColor'),...terrain.low);
    gl.uniform3f(uniform('highColor'),...terrain.high);
    gl.uniform1f(uniform('haze'),terrain.haze);
    // Each formation has its own depth buffer; distant geometry cannot cut
    // through the original foreground landscape when their projections overlap.
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES,0,terrain.count);
  }
  function render() {
    if(!ready||document.hidden)return;
    gl.uniform2f(uniform('resolution'),width,height);
    if(scene==='sand'){
      gl.uniform1f(uniform('time'),time);
      gl.drawArrays(gl.TRIANGLES,0,6);
    }else{
      gl.clearColor(.902,.910,.875,1.);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      const phases=[];
      for(const terrain of terrains){
        const state=terrainState(terrain);
        drawTerrain(terrain,state);
        phases.push(`${terrain.id}:${state.phase}`);
        if(terrain.id==='main')canvas.dataset.phase=state.phase;
      }
      canvas.dataset.layers=String(terrains.length);
      canvas.dataset.layerPhases=phases.join(',');
    }
  }
  function resize(){
    width=innerWidth;height=innerHeight;
    const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1800000/(width*height)));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    if(ready){gl.viewport(0,0,canvas.width,canvas.height);render()}
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
