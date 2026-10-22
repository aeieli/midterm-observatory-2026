// Selection requires a single pointer that never became a drag or pinch.
export class SelectionGesture {
  constructor(){this.pointers=new Map();this.multiple=false;}
  start(id,x,y){if(!this.pointers.size)this.multiple=false;this.pointers.set(id,{x,y,moved:false});if(this.pointers.size>1)this.multiple=true;}
  move(id,x,y){const p=this.pointers.get(id);if(p&&Math.hypot(x-p.x,y-p.y)>7)p.moved=true;}
  end(id,x,y){this.move(id,x,y);const p=this.pointers.get(id);this.pointers.delete(id);return !!p&&!this.multiple&&!p.moved;}
  cancel(id){this.pointers.delete(id);this.multiple=true;}
}
