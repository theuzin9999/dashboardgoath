// build.mjs — protege o site automaticamente a cada deploy (Netlify e Vercel).
// Seus arquivos-fonte (legíveis) ficam no GitHub. Aqui é gerada a pasta dist/ ofuscada, que é a que vai pro ar.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const JSO = require('javascript-obfuscator');
const CleanCSS = require('clean-css');

const ROOT = process.cwd();
const CFG = {
  outDir: 'dist', exclude: [], noObfuscate: [], guard: true, disableConsole: true,
  domainLock: [], prettyUrls: true, noindex: true,
  ...(fs.existsSync('protect.config.json') ? JSON.parse(fs.readFileSync('protect.config.json', 'utf8')) : {}),
};
const OUT = path.join(ROOT, CFG.outDir);
const EXCL = new Set(CFG.exclude.map((p) => p.replace(/\/$/, '')));
const NOOBF = new Set(CFG.noObfuscate);

const log = (...a) => console.log('[protect]', ...a);
const isRemote = (u) => /^(https?:)?\/\//i.test(u) || u.startsWith('data:');

function obfuscate(code, isModule = false) {
  return JSO.obfuscate(code, {
    compact: true, sourceType: isModule ? 'module' : 'script', target: 'browser',
    controlFlowFlattening: true, controlFlowFlatteningThreshold: 0.5,
    deadCodeInjection: true, deadCodeInjectionThreshold: 0.2,
    stringArray: true, stringArrayEncoding: ['rc4'], stringArrayThreshold: 0.9,
    stringArrayWrappersCount: 2, stringArrayWrappersType: 'function',
    rotateStringArray: true, shuffleStringArray: true,
    splitStrings: true, splitStringsChunkLength: 8,
    identifierNamesGenerator: 'hexadecimal', renameGlobals: false, // false: não quebra onclick="..." do HTML
    selfDefending: true, disableConsoleOutput: !!CFG.disableConsole,
    numbersToExpressions: true, simplify: true, transformObjectKeys: false,
    domainLock: CFG.domainLock, domainLockRedirectUrl: 'about:blank',
  }).getObfuscatedCode();
}
const minCss = (css) => new CleanCSS({ level: 2 }).minify(css).styles;

// ---------- guard (anti-devtools / anti-cópia) ----------
const GUARD = `(function(){
var bad=function(){try{document.documentElement.innerHTML='';location.replace('about:blank');}catch(e){}};
document.addEventListener('contextmenu',function(e){e.preventDefault()});
['copy','cut','dragstart','selectstart'].forEach(function(t){document.addEventListener(t,function(e){var n=e.target&&e.target.tagName;if(n==='INPUT'||n==='TEXTAREA')return;e.preventDefault()})});
document.addEventListener('keydown',function(e){var k=(e.key||'').toLowerCase();
 if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['i','j','c','k'].indexOf(k)>-1)||(e.ctrlKey&&['u','s','p'].indexOf(k)>-1)||(e.metaKey&&e.altKey&&['i','j','c','u'].indexOf(k)>-1)){e.preventDefault();return false}});
setInterval(function(){
 var w=window.outerWidth-window.innerWidth>160,h=window.outerHeight-window.innerHeight>160;
 if(w||h){bad()}
 var s=performance.now();(function(){debugger})();if(performance.now()-s>120){bad()}
},1000);
if(window.top!==window.self){try{window.top.location=window.self.location}catch(e){bad()}}
})();`;

// ---------- copia a árvore ----------
const htmlFiles = [];
function walk(dir, rel = '') {
  for (const name of fs.readdirSync(dir)) {
    const r = rel ? `${rel}/${name}` : name;
    if (EXCL.has(r) || EXCL.has(name) || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full, r); continue; }
    const dest = path.join(OUT, r);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const ext = path.extname(name).toLowerCase();
    if (ext === '.html' || ext === '.htm') { htmlFiles.push(r); continue; }
    if (ext === '.js' && !NOOBF.has(r) && !name.endsWith('.min.js.map')) {
      try {
        const src = fs.readFileSync(full, 'utf8');
        const isModule = /^\s*(import|export)\s/m.test(src);
        fs.writeFileSync(dest, obfuscate(src, isModule)); log('js  ', r);
      } catch (e) { log('AVISO: não ofusquei', r, '-', e.message.split('\n')[0]); fs.copyFileSync(full, dest); }
      continue;
    }
    if (ext === '.css') { fs.writeFileSync(dest, minCss(fs.readFileSync(full, 'utf8'))); log('css ', r); continue; }
    fs.copyFileSync(full, dest);
  }
}
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
walk(ROOT);

if (CFG.guard) { fs.mkdirSync(path.join(OUT, '_p'), { recursive: true }); fs.writeFileSync(path.join(OUT, '_p/g.js'), obfuscate(GUARD)); }

// ---------- HTML ----------
for (const rel of htmlFiles) {
  let h = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const base = rel.replace(/\.html?$/i, '').replace(/[^a-z0-9]+/gi, '-');
  const dirPrefix = '/' + (path.dirname(rel) === '.' ? '' : path.dirname(rel) + '/');
  let n = 0;

  // <style> sem atributos -> arquivo css
  h = h.replace(/<style>([\s\S]*?)<\/style>/g, (_, css) => {
    const f = `_p/${base}-${++n}.css`;
    fs.writeFileSync(path.join(OUT, f), minCss(css));
    return `<link rel="stylesheet" href="/${f}">`;
  });
  // <script> inline -> arquivo js ofuscado
  h = h.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (full, attrs, code) => {
    if (/\ssrc\s*=/.test(attrs) || !code.trim()) return full;
    const typeM = attrs.match(/type\s*=\s*["']([^"']+)["']/i);
    const type = typeM ? typeM[1].toLowerCase() : '';
    if (type && type !== 'module' && !/javascript/.test(type)) return full; // json, tailwind etc.
    const isModule = type === 'module';
    let out;
    try { out = obfuscate(code, isModule); } catch (e) { log('AVISO: script inline de', rel, 'mantido sem ofuscar -', e.message.split('\n')[0]); return full; }
    const f = `_p/${base}-${++n}.js`;
    fs.writeFileSync(path.join(OUT, f), out);
    return `<script${isModule ? ' type="module"' : ''}${/\bdefer\b/.test(attrs) ? ' defer' : ''} src="/${f}"></script>`;
  });
  // injeta guard + noindex no começo do <head>
  const inject = (CFG.noindex ? '<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">' : '') +
                 (CFG.guard ? '<script src="/_p/g.js"></script>' : '');
  if (/<head[^>]*>/i.test(h)) h = h.replace(/<head[^>]*>/i, (m) => m + inject); else h = inject + h;
  h = h.replace(/<!--(?!\[if)[\s\S]*?-->/g, ''); // remove comentários HTML
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, h);
  log('html', rel);
}

// ---------- URLs sem .html (Netlify: _redirects / Vercel: cleanUrls no vercel.json) ----------
if (CFG.prettyUrls) {
  const lines = [], skipped = [];
  for (const rel of htmlFiles) {
    const name = path.basename(rel).toLowerCase();
    if (name === 'index.html' || name === '404.html') continue;
    const clean = '/' + rel.replace(/\.html?$/i, '');
    if (/[\s%]/.test(rel)) { skipped.push(rel); continue; }
    lines.push(`${clean} /${rel} 200`);
  }
  fs.writeFileSync(path.join(OUT, '_redirects'), lines.join('\n') + '\n');
  if (skipped.length) log('AVISO: renomeie (sem espaços) para ter URL limpa:', skipped.join(', '));
  log('URLs limpas:', lines.length);
}

// ---------- headers (Netlify) ----------
fs.writeFileSync(path.join(OUT, '_headers'),
`/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Cache-Control: no-store
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
log('pronto ->', CFG.outDir + '/');
