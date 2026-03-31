#!/usr/bin/env node
const fs=require('fs'),path=require('path'),ROOT=path.resolve(__dirname,'..');
let sw=fs.readFileSync(path.join(ROOT,'sw.js'),'utf8');
const m=sw.match(/musicgacha-v(\d+)/),oldV=+m[1],newV=oldV+1;
sw=sw.replace('musicgacha-v'+oldV,'musicgacha-v'+newV);
fs.writeFileSync(path.join(ROOT,'sw.js'),sw,'utf8');
console.log('SW: v'+oldV+' -> v'+newV);
const d=new Date(),date=''+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
const idx=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const em=idx.match(/\?v=(\d{8})([a-z])?/);
let suf='a';if(em&&em[1]===date)suf=String.fromCharCode((em[2]||'a').charCodeAt(0)+1);
const ver=date+suf;
['index.html','js/app.js'].forEach(f=>{const p=path.join(ROOT,f);let c=fs.readFileSync(p,'utf8');const n=(c.match(/\?v=\d{8}[a-z]?/g)||[]).length;c=c.replace(/\?v=\d{8}[a-z]?/g,'?v='+ver);fs.writeFileSync(p,c,'utf8');console.log(f+': ?v='+ver+' ('+n+')')});
['index.html','js/app.js','js/storage.js','js/i18n.js','sw.js'].forEach(f=>{const p=path.join(ROOT,f);if(!fs.existsSync(p))return;const b=fs.readFileSync(p);if(b[0]===0xEF&&b[1]===0xBB&&b[2]===0xBF){fs.writeFileSync(p,b.slice(3));console.log('BOM removed: '+f)}});
console.log('Done: SW v'+newV+', ?v='+ver);