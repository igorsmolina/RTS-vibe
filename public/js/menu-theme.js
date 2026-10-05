'use strict';
// Preferência visual deste navegador; não pertence ao pacote de progresso.
const MENU_THEME_KEY='rtsvibe.theme.v1',menuSystem=matchMedia('(prefers-color-scheme: dark)');
let menuTheme='system';
try{const saved=localStorage.getItem(MENU_THEME_KEY);if(['system','light','dark'].includes(saved))menuTheme=saved;}catch{}
function applyMenuTheme(){
 const theme=menuTheme==='system'?(menuSystem.matches?'dark':'light'):menuTheme;
 document.documentElement.dataset.menuTheme=theme;
 for(const id of ['titleTheme','setTheme']){const select=document.getElementById(id);if(select)select.value=menuTheme;}
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=theme==='dark'?'#2D1D1A':'#F4F5EF';
}
function setMenuTheme(value){menuTheme=['system','light','dark'].includes(value)?value:'system';try{localStorage.setItem(MENU_THEME_KEY,menuTheme);}catch{}applyMenuTheme();}
menuSystem.addEventListener('change',()=>{if(menuTheme==='system')applyMenuTheme();});
applyMenuTheme();
