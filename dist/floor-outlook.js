import * as T from './vendor/three.module.js';
import {floorSegments,floorLead} from './election-explorer.js';

// Non-interactive inlaid seat-count dial. It is never a probability display.
export function createFloorOutlook(model){
 const group=new T.Group();group.position.set(0,-.095,-4.7);
 const metal=new T.MeshStandardMaterial({color:0xdbe5ed,metalness:.78,roughness:.27});
 const backing=new T.MeshStandardMaterial({color:0x0c1828,metalness:.42,roughness:.5});
 const band=(r1,r2,a,b,material,y=0)=>{const shape=new T.Shape();shape.absarc(0,0,r2,a,b);shape.absarc(0,0,r1,b,a,true);shape.closePath();const geo=new T.ExtrudeGeometry(shape,{depth:.025,bevelEnabled:false,curveSegments:64});geo.rotateX(Math.PI/2);const mesh=new T.Mesh(geo,material);mesh.position.y=y;mesh.receiveShadow=true;group.add(mesh);return mesh;};
 // All segments retain exact angular seat proportions; a narrow physical aisle
 // is left empty without reallocating its seats to neighboring categories.
 band(1.08,2.21,0,Math.PI,backing);
 for(const segment of floorSegments(model)){
  const a=Math.PI*(1-segment.end),b=Math.PI*(1-segment.start),material=new T.MeshStandardMaterial({color:segment.color,emissive:segment.color,emissiveIntensity:.12,roughness:.32,metalness:.22});
  for(const [lo,hi] of [[a,Math.min(b,Math.PI/2-.055)],[Math.max(a,Math.PI/2+.055),b]])if(hi>lo){band(1.17,2.12,lo,hi,material,.032);if(segment.independent)band(2.13,2.17,lo,hi,new T.MeshStandardMaterial({color:0xb35bff,emissive:0x6b239e,emissiveIntensity:.3}),.035);}
  const mid=(a+b)/2;const line=new T.Mesh(new T.BoxGeometry(.012,.025,.96),metal);line.position.set(Math.cos(a)*1.65,.045,Math.sin(a)*1.65);line.rotation.y=Math.PI/2-a;group.add(line);
 }
 for(const [a,b]of [[0,Math.PI/2-.055],[Math.PI/2+.055,Math.PI]]){band(1.1,1.14,a,b,metal,.03);band(2.15,2.19,a,b,metal,.03);}
 const angle=Math.PI/2,direction=new T.Vector3(Math.cos(angle),0,Math.sin(angle));
 const pointer=new T.Mesh(new T.ConeGeometry(.085,.48,3),metal);pointer.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);pointer.position.copy(direction).multiplyScalar(2.06);pointer.position.y=.12;group.add(pointer);
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#10263b';ctx.fillRect(0,0,256,96);ctx.strokeStyle='#bdd7e7';ctx.lineWidth=3;ctx.strokeRect(2,2,252,92);ctx.fillStyle='#fff';ctx.font='700 60px system-ui';ctx.textAlign='center';ctx.fillText('½',128,69);const label=new T.Mesh(new T.PlaneGeometry(.72,.27),new T.MeshBasicMaterial({map:new T.CanvasTexture(canvas),side:T.DoubleSide}));label.rotation.x=-Math.PI/2;label.position.set(.02,.12,1.12);label.material.userData.ownedTexture=true;group.add(label);
 const lead=floorLead(model),delta=lead.side==='D'?lead.seats:-lead.seats;if(delta){const from=Math.PI/2,to=from+(delta>0?1:-1)*lead.arcRadians;band(2.24,2.31,Math.min(from,to),Math.max(from,to),new T.MeshStandardMaterial({color:delta>0?0x155dff:0xf1264f,emissive:delta>0?0x155dff:0xf1264f,emissiveIntensity:.5}),.07);}
 group.userData={capacity:model.capacity,majority:model.majority,segments:floorSegments(model)};
 return group;
}
