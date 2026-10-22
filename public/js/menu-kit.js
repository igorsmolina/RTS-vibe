'use strict';
/* Peças comuns dos menus táticos: cartões de escolha que espelham um <select>, arte (miniaturas, sprites, ícones),
   sons de interface e abas. O <select> original continua no DOM (visualmente oculto), então o resto do código não muda. */
const MenuKit=(()=>{
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const ui=kind=>{try{if(typeof audio!=='undefined'&&audio?.enabled)audio.play(kind);}catch{}};
 // Esconde o <select> sem tirá-lo da acessibilidade de teste (display:none impediria selectOption).
 const hide=select=>{Object.assign(select.style,{position:'absolute',width:'1px',height:'1px',overflow:'hidden',clip:'rect(0 0 0 0)',whiteSpace:'nowrap',opacity:'0',pointerEvents:'none'});select.tabIndex=-1;select.setAttribute('aria-hidden','true');};

 /* Arte de um cartão: art(option) devolve um nó (canvas, img ou span com ícone) ou uma Promise dele.
    kind: 'map' (4:3), 'square' (1:1) ou 'icon' (largo, para ícones SVG). */
 function artBox(kind,make,option){
  const box=el('span','pick-art'+(kind==='square'?' square':kind==='icon'?' icon':''));
  box.setAttribute('aria-hidden','true');
  const put=node=>{box.classList.remove('loading');if(node)box.replaceChildren(node);};
  const node=make?make(option):null;
  if(node&&typeof node.then==='function'){box.classList.add('loading');node.then(put,()=>put(null));}else put(node);
  return box;
 }
 const iconNode=name=>{const s=el('span');s.dataset.icon=name;return s;};

 /* cardPicker(select, {art, kind, caption, cols, card, enter}): transforma as <option> em cartões radio.
    Devolve {root, refresh(), setDisabled(value, bool)}. Opções com data-hidden ficam de fora. */
 function cardPicker(select,{art,kind='icon',caption,cols,card='148px',enter=true}={}){
  const root=el('div','pick-grid'+(enter?' enter':''));root.setAttribute('role','radiogroup');
  root.style.setProperty('--card-w',card);if(cols){root.dataset.cols=String(cols);root.style.setProperty('--cols',String(cols));}
  const label=select.id&&document.querySelector(`label[for="${select.id}"]`);
  if(label&&label.id!==undefined){label.id=label.id||select.id+'Label';root.setAttribute('aria-labelledby',label.id);}else root.setAttribute('aria-label',select.getAttribute('aria-label')||select.id);
  const cards=new Map();
  const build=()=>{
   cards.clear();root.replaceChildren();let i=0;
   for(const option of select.options){
    if(option.hidden)continue;
    const button=el('button','pick-card');button.type='button';button.setAttribute('role','radio');button.dataset.value=option.value;button.style.setProperty('--i',String(i++));
    button.append(artBox(kind,art,option),el('span','pick-title',option.dataset.title||option.textContent.split(' — ')[0]));
    const sub=caption?caption(option):option.dataset.caption||(option.textContent.includes(' — ')?option.textContent.split(' — ')[1]:'');
    if(sub)button.append(el('span','pick-sub',sub));
    button.addEventListener('click',()=>{if(select.value!==option.value){select.value=option.value;select.dispatchEvent(new Event('change',{bubbles:true}));ui('ui-select');}refresh();});
    button.addEventListener('mouseenter',()=>ui('ui-hover'));
    cards.set(option.value,button);root.append(button);
   }
   refresh();
  };
  const refresh=()=>{for(const [value,button] of cards){const on=select.value===value;button.setAttribute('aria-checked',String(on));button.tabIndex=on?0:-1;button.disabled=select.disabled;}if(![...cards.values()].some(b=>b.tabIndex===0)&&cards.size)cards.values().next().value.tabIndex=0;};
  // Setas movem a seleção entre cartões (padrão radiogroup).
  root.addEventListener('keydown',e=>{
   const list=[...cards.values()],at=list.indexOf(document.activeElement),step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];
   if(at<0||!step)return;e.preventDefault();const next=list[(at+step+list.length)%list.length];next.focus();next.click();
  });
  select.addEventListener('change',refresh);
  hide(select);select.after(root);build();
  return {root,refresh,rebuild:build,setDisabled:(value,on)=>{const b=cards.get(value);if(b)b.disabled=on;}};
 }

 /* Abas (role=tablist) ligadas a painéis [role=tabpanel]: tabs = [{id, label, panel}]. */
 function tabs(host,items,{onChange}={}){
  host.classList.add('tac-tabs');host.setAttribute('role','tablist');host.replaceChildren();const buttons=new Map();
  const show=id=>{for(const item of items){const on=item.id===id;buttons.get(item.id).setAttribute('aria-selected',String(on));buttons.get(item.id).tabIndex=on?0:-1;item.panel.hidden=!on;}ui('ui-select');if(onChange)onChange(id);};
  for(const item of items){
   const b=el('button',null,item.label);b.type='button';b.setAttribute('role','tab');b.id='tab-'+item.id;b.setAttribute('aria-controls',item.panel.id);item.panel.setAttribute('role','tabpanel');item.panel.setAttribute('aria-labelledby',b.id);
   b.addEventListener('click',()=>show(item.id));buttons.set(item.id,b);host.append(b);
  }
  host.addEventListener('keydown',e=>{const ids=items.map(i=>i.id),at=ids.findIndex(id=>buttons.get(id)===document.activeElement),step={ArrowRight:1,ArrowLeft:-1}[e.key];if(at<0||!step)return;e.preventDefault();const next=buttons.get(ids[(at+step+ids.length)%ids.length]);next.focus();next.click();});
  show(items[0].id);return {show};
 }

 /* Régua: liga um <input type=range> a uma saída viva e ao preenchimento da barra (--v). */
 function slider(input,output,format=v=>v+'%'){
  const sync=()=>{const pct=(input.value-input.min)/(input.max-input.min)*100;input.style.setProperty('--v',pct+'%');if(output)output.textContent=format(input.value);};
  input.addEventListener('input',sync);sync();return sync;
 }

 /* Sprites e bandeiras para os cartões. */
 const spriteNode=(type,art=0,size=96)=>{
  const c=document.createElement('canvas');c.width=c.height=size;
  const draw=()=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,size,size);unitIcon(ctx,type,size/2,size/2+size*.08,'#9fb0a3',size/96*1.6,0,0,false,0,false,art);};
  draw();return c;
 };
 const thumbNode=(map,seed,options,w=240,h=180)=>TitleMap.thumb(map,seed,options,w,h);

 /* Paralaxe: camadas [elemento, força em px] seguem o ponteiro em sentido contrário (só com movimento permitido). */
 function parallax(host,layers){
  const still=()=>matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.fx==='performance';
  let raf=0,x=0,y=0;
  host.addEventListener('pointermove',e=>{if(still())return;x=e.clientX/innerWidth-.5;y=e.clientY/innerHeight-.5;if(!raf)raf=requestAnimationFrame(()=>{raf=0;for(const [node,k] of layers)node.style.translate=`${(-x*k).toFixed(1)}px ${(-y*k).toFixed(1)}px`;});});
  host.addEventListener('pointerleave',()=>{for(const [node] of layers)node.style.translate='';});
 }
 return {el,ui,hide,artBox,iconNode,cardPicker,tabs,slider,spriteNode,thumbNode,parallax};
})();
{const title=document.getElementById('titleScreen');if(title)MenuKit.parallax(title,[[document.getElementById('titleBg'),22],[title.querySelector('.title-grid'),10]]);}
