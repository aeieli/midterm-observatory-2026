import * as T from './vendor/three.module.js';

// Separate thresholds keep a wheel/pinch near the boundary from flickering.
export function exteriorLevel(wasOutside,distance,aspect){
 const normalized=distance/Math.max(1,1.3/aspect);
 return wasOutside?normalized>37:normalized>44;
}
export function wallOccludes(camera,target,id){
 const bounds={front:['z',4.02,'x',7.6,4.5],rear:['z',-6.65,'x',7.6,4.5],left:['x',-7.3,'z',7,3.6],right:['x',7.3,'z',7,3.6],rostrum:['z',-4.7,'x',3.6,2.2]};
 const b=bounds[id];if(!b)return false;
 const [axis,plane,across,halfWidth,height]=b,delta=target[axis]-camera[axis];
 if(Math.abs(delta)<1e-6)return false;
 const t=(plane-camera[axis])/delta;if(t<=0||t>=1)return false;
 const y=camera.y+(target.y-camera.y)*t,span=camera[across]+(target[across]-camera[across])*t;
 return y>-.5&&y<height&&Math.abs(span-(across==='z'?-1.4:0))<halfWidth;
}

// Original, stylized architectural model. Repeated windows, columns and trim
// are instanced; this is not a surveyed floor plan or a physical seating map.
export function createCapitolExterior(){
 const root=new T.Group(),batches=new Map(),materials=new Set();
 const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=128;
 const ctx=textureCanvas.getContext('2d'),pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4,grain=((x*73+y*137)%19)-9,seam=y%32<1||((x+(Math.floor(y/32)%2)*32)%64<1);const v=seam?155:213+grain;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;pixels.data[i+3]=255;}
 ctx.putImageData(pixels,0,0);const texture=new T.CanvasTexture(textureCanvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(4,3);
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.78,...extra});materials.add(m);return m;};
 const limestone=mat(0xe5e0d5,{bumpMap:texture,bumpScale:.025,roughnessMap:texture}),trim=mat(0xf5f1e7,{roughness:.65}),shadowStone=mat(0xc1bdb2),roof=mat(0x777f83,{metalness:.4,roughness:.55}),glass=mat(0x466779,{metalness:.3,roughness:.33}),windowShade=mat(0x203744),bronze=mat(0x4e6259,{metalness:.7,roughness:.5}),lawn=mat(0x65846f),paving=mat(0xb5b7ad,{bumpMap:texture,bumpScale:.018}),hedge=mat(0x405e4c);
 const boxGeo=new T.BoxGeometry(1,1,1),cylinder=new T.CylinderGeometry(1,1,1,20),sphere=new T.SphereGeometry(1,12,8);
 function add(geometry,material,x,y,z,sx=1,sy=1,sz=1,ry=0){const key=geometry.uuid+material.uuid;let batch=batches.get(key);if(!batch){batch={geometry,material,matrices:[]};batches.set(key,batch);}batch.matrices.push(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),ry),new T.Vector3(sx,sy,sz)));}
 const box=(x,y,z,w,h,d,m=limestone)=>add(boxGeo,m,x,y,z,w,h,d);
 const ring=(x,y,z,r,h,m=trim)=>add(cylinder,m,x,y,z,r,h,r);
 function column(x,z,y=3.65,h=4.1,r=.22){ring(x,y,z,r,h,trim);ring(x,y-h/2+.1,z,r*1.5,.2,shadowStone);ring(x,y+h/2-.1,z,r*1.5,.2,trim);box(x,y+h/2+.06,z,r*3,.16,r*3,trim);}
 function pediment(x,z,w,y){const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,w*.17);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.38,bevelEnabled:false});add(geo,trim,x,y,z);const inner=new T.Shape();inner.moveTo(-w*.39,.08);inner.lineTo(w*.39,.08);inner.lineTo(0,w*.13);inner.closePath();add(new T.ExtrudeGeometry(inner,{depth:.03,bevelEnabled:false}),shadowStone,x,y+.07,z+.39);}
 function window(x,y,z,rotation=0){add(boxGeo,trim,x,y,z,1.0,1.65,.2,rotation);add(boxGeo,windowShade,x+Math.sin(rotation)*.13,y,z+Math.cos(rotation)*.13,.74,1.38,.08,rotation);add(boxGeo,glass,x+Math.sin(rotation)*.18,y,z+Math.cos(rotation)*.18,.59,1.2,.02,rotation);add(boxGeo,trim,x+Math.sin(rotation)*.2,y,z+Math.cos(rotation)*.2,.055,1.38,.03,rotation);add(boxGeo,trim,x+Math.sin(rotation)*.2,y-.04,z+Math.cos(rotation)*.2,.72,.055,.03,rotation);add(boxGeo,trim,x,y-.86,z,1.16,.16,.38,rotation);}
 // Terraces, lawn and broad approach steps.
 box(0,-.75,-1,54,.45,35,lawn);box(0,-.48,1,47,.12,25,paving);box(0,-.28,-1,43,.3,15,shadowStone);
 for(let i=0;i<7;i++)box(0,-.12+i*.13,8.7-i*.45,13.8-i*.3,.15,4.8-i*.42,trim);
 for(const side of [-1,1]){box(side*17,-.25,11,15,.12,3.8,paving);for(let i=0;i<6;i++){box(side*(8+i*2.6),.03,13.4,1.6,.5,.9,hedge);}}
 // Central block, connecting wings and their full rear/side facades.
 box(0,3.1,-1.5,12,6.4,10.5);box(0,6.45,-1.5,12.5,.45,11,trim);box(0,6.76,-1.5,11.8,.18,10.5,roof);
 for(const side of [-1,1]){
  box(side*14,2.9,-1.5,12,6,11);box(side*8,2.5,-1.5,4,5.2,9.2);
  for(const y of [.7,3.1,5.65,6.02])box(side*14,y,-1.5,12.35,y===3.1?.16:.28,11.35,trim);
  box(side*14,6.24,-1.5,11.6,.22,10.65,roof);box(side*8,5.25,-1.5,4.25,.35,9.5,trim);
  for(const z of [-7.11,4.11])for(let x=side*14-5;x<=side*14+5;x+=1.65)for(const y of [1.85,4.25])window(x,y,z,z<0?Math.PI:0);
  for(const z of [-5.5,-3.5,-1.5,.5,2.5])for(const y of [1.85,4.25])window(side*20.1,y,z,side*Math.PI/2);
  // Each wing has a small projecting colonnade and raised central pavilion.
  box(side*14,.65,5,7.6,.4,2.2,trim);box(side*14,5.75,5.1,7.9,.45,2.4,trim);
  for(let i=-3;i<=3;i++)column(side*14+i,5.7,3.15,4.8,.2);
  box(side*14,6.5,-1.5,5.7,.75,7.6);box(side*14,6.96,-1.5,6.1,.22,8,trim);
  for(let i=0;i<4;i++)box(side*14,.12+i*.13,6.6-i*.25,8.4,.15,1.5-i*.2,trim);
 }
 for(const z of [-6.82,3.82])for(const x of [-4.7,-3.1,3.1,4.7])for(const y of [1.8,4.3])window(x,y,z,z<0?Math.PI:0);
 // Principal portico: doors, columns, entablature and pediment.
 for(const x of [-1.5,0,1.5])box(x,2.2,3.83,1.02,2.8,.14,bronze);
 box(0,.7,5.3,12.5,.4,3.4,trim);box(0,6,5.25,12.7,.42,3.6,trim);box(0,6.33,5.25,13.1,.2,3.9,trim);
 for(let i=0;i<10;i++)column(-5.4+i*1.2,6.45,3.55,4.9,.23);
 pediment(0,6.6,13,6.45);
 for(let x=-5.9;x<=6;x+=.42)box(x,6.13,7.13,.2,.28,.23,shadowStone);
 // Drum colonnade and layered Capitol dome, with shared meridian ribs.
 ring(0,7.1,-1.5,4,.65);ring(0,7.55,-1.5,3.65,.25,shadowStone);ring(0,9,-1.5,3.28,2.8,limestone);
 for(let i=0;i<32;i++){const a=i*Math.PI*2/32;column(Math.sin(a)*3.55,-1.5+Math.cos(a)*3.55,9.02,2.65,.14);add(boxGeo,glass,Math.sin(a)*3.3,9,-1.5+Math.cos(a)*3.3,.36,1.65,.1,a);}
 ring(0,10.49,-1.5,3.88,.32);ring(0,10.83,-1.5,3.67,.35);
 const profile=[[3.6,10.96],[3.6,11.4],[3.5,12],[3.22,12.9],[2.78,13.9],[2.2,14.85],[1.5,15.65],[.76,16.2],[.67,16.38]].map(([r,y])=>new T.Vector2(r,y));
 add(new T.LatheGeometry(profile,64),limestone,0,0,-1.5);
 const ribCurve=new T.CatmullRomCurve3(profile.map(p=>new T.Vector3(p.x+.025,p.y,0))),rib=new T.TubeGeometry(ribCurve,28,.035,5,false);
 for(let i=0;i<32;i++)add(rib,trim,0,0,-1.5,1,1,1,i*Math.PI*2/32);
 for(const [r,y] of [[3.6,11.35],[3.3,12.66],[2.55,14.3],[.84,16.2]])ring(0,y,-1.5,r,.075,trim);
 ring(0,16.5,-1.5,.95,.24);ring(0,17.02,-1.5,.57,.85,glass);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;ring(Math.sin(a)*.66,17.04,-1.5+Math.cos(a)*.66,.07,.95,trim);}
 ring(0,17.57,-1.5,.85,.2);add(new T.ConeGeometry(.85,.6,24),limestone,0,17.92,-1.5);
 ring(0,18.4,-1.5,.31,.4,bronze);add(new T.ConeGeometry(.28,.82,10),bronze,0,18.95,-1.5);add(sphere,bronze,0,19.5,-1.5,.17,.2,.17);box(.29,19.16,-1.5,.11,.8,.1,bronze);
 // Roof balustrades use a small number of shared instanced meshes.
 for(const side of [-1,1])for(let x=side*14-5.7;x<=side*14+5.7;x+=.48){box(x,6.55,4.1,.13,.6,.15,trim);box(x,6.55,-7.1,.13,.6,.15,trim);}for(const side of [-1,1])for(const z of [-7.1,4.1])box(side*14,6.85,z,12,.13,.26,trim);
 let instances=0;for(const b of batches.values()){const inst=new T.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((m,i)=>inst.setMatrixAt(i,m));inst.castShadow=true;inst.receiveShadow=true;root.add(inst);instances+=b.matrices.length;}
 root.visible=false;let previous=-1;
 return {group:root,drawCalls:batches.size,instances,setOpacity(alpha){if(Math.abs(alpha-previous)<.0005)return;previous=alpha;root.visible=alpha>.002;for(const m of materials){const hashed=alpha<.999;if(m.alphaHash!==hashed){m.alphaHash=hashed;m.needsUpdate=true;}m.transparent=false;m.opacity=alpha;m.depthWrite=true;}},dispose(){const geometries=new Set([...batches.values()].map(b=>b.geometry));geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());texture.dispose();}};
}
