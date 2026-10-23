'use strict';
// Os menus usam um único tema escuro tático. As funções continuam existindo porque o resto do código as chama.
let menuTheme='dark';
function applyMenuTheme(){
 document.documentElement.dataset.menuTheme='dark';
 const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content='#0B120E';
}
function setMenuTheme(){applyMenuTheme();}
applyMenuTheme();
