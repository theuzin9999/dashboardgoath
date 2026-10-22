# Kit de proteção universal (Netlify + Vercel)

Você edita os arquivos normais no GitHub. A cada commit, o Netlify/Vercel roda `npm run build`,
que gera a pasta `dist/` ofuscada — e é só ela que vai pro ar.

## Como usar em cada repositório
1. Copie TUDO deste kit para a RAIZ do repo (junto com seus .html/.js/.css): `build.mjs`, `package.json`,
   `protect.config.json`, `netlify.toml`, `vercel.json`, `.gitignore`, pasta `netlify/`.
   (Se já existir package.json/.gitignore, mescle.)
2. Commit e push. Pronto.

### Netlify
Site configuration > Build & deploy: Build command `npm run build` e Publish directory `dist`
(o netlify.toml já define isso). A Edge Function `netlify/edge-functions/shield.js` bloqueia HTTrack/wget/curl.

### Vercel
O `vercel.json` já define build e `cleanUrls`. Para bloquear HTTrack/wget/curl, renomeie
`vercel-middleware.EXEMPLO.js` para `middleware.js` (ou copie a função para o seu middleware.js atual — se você
já tem um, ele continua sendo ignorado pelo build e funciona como antes).
Em Project Settings > Build & Output, deixe "Framework: Other".

## URL sem .html
Netlify: o build gera `dist/_redirects` (`/painel /painel.html 200`) para toda página (exceto index/404).
Vercel: `"cleanUrls": true` no vercel.json faz o mesmo. Arquivos com espaço no nome (ex.: "novas estrategias2.html")
não geram URL limpa: renomeie para `novas-estrategias2.html` e atualize os links.

## O que é ofuscado
- Todo <script> inline e todo .js local (exceto os de `exclude`, como sw.js e middleware.js)
- <style> inline vira css minificado; .css local é minificado
- Injeta anti-DevTools / anti-cópia / anti-iframe e noindex em todo HTML

## Ajustes (protect.config.json)
- `exclude`: arquivos/pastas que NÃO entram no site (e não são ofuscados)
- `noObfuscate`: copiados sem ofuscar (ex.: ["libs/lib.js"])
- `guard`: false desliga bloqueio de DevTools/cópia
- `disableConsole`: false mantém console.log no site (útil pra depurar)
- `domainLock`: ["meusite.netlify.app"] faz o JS só rodar nesse domínio
- `prettyUrls`: false desliga a geração de URLs sem .html

## Limites
Ofuscação dificulta, não impede: quem insistir lê o JS pela aba Network. Segredos de verdade
(chaves, regras de acesso, lógica que não pode vazar) precisam ficar no servidor (Functions/API) e nas
regras do Firebase. Repositório PÚBLICO expõe o código-fonte original: deixe privado.
Service workers (sw.js) ficam fora da ofuscação por padrão.
