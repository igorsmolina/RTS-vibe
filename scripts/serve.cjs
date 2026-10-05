// Servidor local do jogo (sem dependências): http://localhost:5173. Necessário para o login do Neon, que não aceita file://.
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{exec}=require('node:child_process');
const root=path.join(__dirname,'..','public'),port=Number(process.env.PORT)||5173;
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav'};
http.createServer((req,res)=>{
 const file=path.join(root,decodeURIComponent(new URL(req.url,'http://x').pathname).replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Não encontrado');return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(file).toLowerCase()]||'application/octet-stream'});res.end(data);});
}).listen(port,'127.0.0.1',()=>{
 const url=`http://localhost:${port}/`;console.log(`rtsvibe em ${url} — feche esta janela para parar.`);
 if(!process.env.NO_OPEN)exec(process.platform==='win32'?`start "" "${url}"`:process.platform==='darwin'?`open ${url}`:`xdg-open ${url}`);
});
