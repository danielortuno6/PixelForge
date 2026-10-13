/* PixelForge PSD codec: layered RGB, 8 bits/channel, PSD version 1 (MIT). */
(function(global){'use strict';
const E=new TextEncoder(),D=new TextDecoder('latin1');
class Writer{constructor(){this.parts=[];this.length=0}put(b){if(!(b instanceof Uint8Array))b=new Uint8Array(b);this.parts.push(b);this.length+=b.length;return this}u8(n){return this.put(Uint8Array.of(n&255))}u16(n){return this.put(Uint8Array.of(n>>>8&255,n&255))}u32(n){return this.put(Uint8Array.of(n>>>24&255,n>>>16&255,n>>>8&255,n&255))}i16(n){return this.u16(n&65535)}i32(n){return this.u32(n>>>0)}str(s){return this.put(E.encode(s))}zeros(n){return this.put(new Uint8Array(n))}bytes(){let b=new Uint8Array(this.length),p=0;for(const part of this.parts){b.set(part,p);p+=part.length}return b}}
class Reader{constructor(buffer){this.a=new Uint8Array(buffer);this.dv=new DataView(this.a.buffer,this.a.byteOffset,this.a.byteLength);this.p=0}need(n){if(n<0||this.p+n>this.a.length)throw Error('Truncated or invalid PSD')}u8(){this.need(1);return this.a[this.p++]}u16(){this.need(2);let x=this.dv.getUint16(this.p);this.p+=2;return x}i16(){this.need(2);let x=this.dv.getInt16(this.p);this.p+=2;return x}u32(){this.need(4);let x=this.dv.getUint32(this.p);this.p+=4;return x}i32(){this.need(4);let x=this.dv.getInt32(this.p);this.p+=4;return x}str(n){return D.decode(this.take(n))}take(n){this.need(n);let b=this.a.subarray(this.p,this.p+n);this.p+=n;return b}skip(n){this.need(n);this.p+=n}}
const blends={'source-over':'norm',multiply:'mul ',screen:'scrn',overlay:'over',darken:'dark',lighten:'lite'};const fromBlend=Object.fromEntries(Object.entries(blends).map(([a,b])=>[b,a]));
function rgbaChannels(canvas){const {width:w,height:h}=canvas,im=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,out=Array.from({length:4},()=>new Uint8Array(w*h));for(let j=0;j<w*h;j++)for(let k=0;k<4;k++)out[k][j]=im[j*4+k];return out}
function imageFromChannels(ch,w,h){let c=document.createElement('canvas');c.width=w;c.height=h;let ctx=c.getContext('2d'),im=ctx.createImageData(w,h);for(let j=0;j<w*h;j++){im.data[j*4]=ch[0]?.[j]??0;im.data[j*4+1]=ch[1]?.[j]??0;im.data[j*4+2]=ch[2]?.[j]??0;im.data[j*4+3]=ch[3]?.[j]??255}ctx.putImageData(im,0,0);return c}
function pascal(name){const src=E.encode(name),n=Math.min(255,src.length),w=new Writer();w.u8(n).put(src.subarray(0,n));w.zeros((4-((n+1)%4))%4);return w.bytes()}
function unicodeName(name){const b=new Writer();b.u32(name.length);for(const c of name)b.u16(c.charCodeAt(0));return b.bytes()}
function block(key,data){return new Writer().str('8BIM').str(key).u32(data.length).put(data).zeros(data.length%2).bytes()}
function save({width:w,height:h,layers,merged}){
 if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>30000||h>30000)throw Error('Invalid PSD size');if(layers.length>200)throw Error('Too many layers');
 const records=new Writer(), pixels=new Writer();
 // PSD layer stack is top-first.
 for(const L of [...layers].reverse()){
 const channels=rgbaChannels(L.canvas), entries=[];
 for(let i=0;i<4;i++){let payload=new Writer().u16(0).put(channels[i]).bytes();entries.push({id:i===3?-1:i,payload})}
 records.i32(0).i32(0).i32(h).i32(w).u16(entries.length);
 for(const e of entries){records.i16(e.id).u32(e.payload.length);pixels.put(e.payload)}
 records.str('8BIM').str(blends[L.blend]||'norm').u8(Math.max(0,Math.min(255,Math.round(L.opacity*255)))).u8(0).u8(L.visible?0:2).u8(0);
 let extra=new Writer();extra.u32(0).u32(0).put(pascal(L.name||'Layer'));extra.put(block('luni',unicodeName(L.name||'Layer')));
 // Layer masks are deliberately baked into raster content when saving PSD.
 records.u32(extra.length).put(extra.bytes());
 }
 const layerInfo=new Writer().i16(layers.length).put(records.bytes()).put(pixels.bytes());if(layerInfo.length%2)layerInfo.u8(0);
 let section=new Writer().u32(layerInfo.length).put(layerInfo.bytes()).u32(0);
 const out=new Writer().str('8BPS').u16(1).zeros(6).u16(4).u32(h).u32(w).u16(8).u16(3).u32(0).u32(0).u32(section.length).put(section.bytes()).u16(0);
 for(const ch of rgbaChannels(merged))out.put(ch);
 return new Blob([out.bytes()],{type:'image/vnd.adobe.photoshop'});
}
function rleChannel(r,w,h){const lens=Array.from({length:h},()=>r.u16()),output=new Uint8Array(w*h);for(let y=0;y<h;y++){const stop=r.p+lens[y],start=y*w;let col=0;while(r.p<stop){let n=r.u8();if(n<=127){let count=n+1;if(col+count>w)throw Error('RLE row overflow');output.set(r.take(count),start+col);col+=count}else if(n>=129){let count=257-n,v=r.u8();if(col+count>w)throw Error('RLE row overflow');output.fill(v,start+col,start+col+count);col+=count}}if(col!==w||r.p!==stop)throw Error('Malformed RLE row')}return output}
function channelsRead(r,entries,w,h){const channels={};for(const e of entries){let end=r.p+e.length,compression=r.u16();if(compression===0){channels[e.id]=r.take(w*h)}else if(compression===1){channels[e.id]=rleChannel(r,w,h)}else throw Error('Unsupported PSD compression (ZIP)');if(r.p>end)throw Error('Corrupt PSD channel');r.p=end}return channels}
function parse(buffer){const r=new Reader(buffer);if(r.str(4)!=='8BPS'||r.u16()!==1)throw Error('Not a standard PSD file (PSB unsupported)');r.skip(6);let count=r.u16(),h=r.u32(),w=r.u32(),depth=r.u16(),mode=r.u16();if(depth!==8||mode!==3||w<1||h<1||w>4096||h>4096||count<3||count>4)throw Error('Only 8-bit RGB/RGBA PSD up to 4096px supported');r.skip(r.u32());r.skip(r.u32());let sectionLength=r.u32(),sectionEnd=r.p+sectionLength,layers=[];if(sectionEnd>r.a.length)throw Error('Bad layer section');let infoSize=r.u32();if(infoSize){const infoEnd=r.p+infoSize,n=Math.abs(r.i16());if(n>200)throw Error('Too many PSD layers');let meta=[];for(let i=0;i<n;i++){
 let top=r.i32(),left=r.i32(),bottom=r.i32(),right=r.i32(),cn=r.u16(),entries=[];if(cn>50)throw Error('Invalid channels');for(let j=0;j<cn;j++)entries.push({id:r.i16(),length:r.u32()});if(r.str(4)!=='8BIM')throw Error('Unsupported PSD layer signature');let blend=r.str(4),opacity=r.u8()/255;r.u8();let flags=r.u8();r.u8();let extraLength=r.u32(),extraEnd=r.p+extraLength;r.skip(r.u32());r.skip(r.u32());let nameLen=r.u8(),name=r.str(nameLen);r.skip((4-(1+nameLen)%4)%4);while(r.p+12<=extraEnd){let sig=r.str(4),key=r.str(4),length=r.u32(),dataEnd=r.p+length;if(dataEnd>extraEnd)break;if(sig==='8BIM'&&key==='luni'&&length>=4){let len=r.u32();if(len<=1024&&r.p+len*2<=dataEnd){name='';for(let j=0;j<len;j++)name+=String.fromCharCode(r.u16())}}r.p=dataEnd+(length%2)}r.p=extraEnd;meta.push({top,left,bottom,right,entries,name,opacity,blend:fromBlend[blend]||'source-over',visible:!(flags&2)})}
 for(const m of meta){let lw=m.right-m.left,lh=m.bottom-m.top;if(lw<0||lh<0||lw>4096||lh>4096)throw Error('Invalid layer bounds');let ch=channelsRead(r,m.entries,lw,lh);let c=document.createElement('canvas');c.width=w;c.height=h;if(lw&&lh){let rgb=imageFromChannels([ch[0],ch[1],ch[2],ch[-1]],lw,lh);c.getContext('2d').drawImage(rgb,m.left,m.top)}layers.push({canvas:c,name:m.name,visible:m.visible,opacity:m.opacity,blend:m.blend,mask:null,maskEnabled:true})}r.p=infoEnd}
 r.p=sectionEnd;let compression=r.u16(),channels=[];if(compression===0){for(let i=0;i<count;i++)channels.push(r.take(w*h))}else if(compression===1){let lens=Array.from({length:count},()=>Array.from({length:h},()=>r.u16()));for(let i=0;i<count;i++){let out=new Uint8Array(w*h);for(let y=0;y<h;y++){let stop=r.p+lens[i][y],col=0;while(r.p<stop){let n=r.u8();if(n<=127){out.set(r.take(n+1),y*w+col);col+=n+1}else if(n>=129){let cnt=257-n;out.fill(r.u8(),y*w+col,y*w+col+cnt);col+=cnt}}if(col!==w)throw Error('Bad merged RLE')}channels.push(out)}}else throw Error('Unsupported PSD composite compression');
 const merged=imageFromChannels(channels,w,h);return {width:w,height:h,layers:layers.reverse(),merged};
}
global.PixelForgePSD={parse,save};
})(window);
