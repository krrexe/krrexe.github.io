/* Homepage of Krr — GitHub Pages content listing (no build script). */
(function () {
  'use strict';
  const OWNER = 'krrexe';
  const REPOSITORY = 'krrexe.github.io';
  const BRANCH = 'main';
  const api = `https://api.github.com/repos/${OWNER}/${REPOSITORY}/git/trees/${BRANCH}?recursive=1`;
  const cacheKey = 'krr-github-tree-v1';
  const maxAgeMs = 2 * 60 * 1000;

  function sitePath(path) {
    return '../' + path.split('/').map(encodeURIComponent).join('/');
  }
  function findFiles(tree, dir) {
    return tree.filter(entry => entry.type === 'blob' && entry.path.startsWith(dir + '/'));
  }
  function byName(a,b) { return a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}); }
  function folders(files, root) {
    return [...new Set(files.map(e => e.path.slice(root.length + 1).split('/')[0]).filter(Boolean))].sort(byName);
  }
  async function readText(path) {
    const resp = await fetch(sitePath(path), {cache:'no-cache'});
    if (!resp.ok) throw new Error('File could not be loaded: ' + path);
    return resp.text();
  }
  function make(tag, cls, txt) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (txt !== undefined) el.textContent = txt;
    return el;
  }
  function error(target, msg) { target.replaceChildren(make('p', 'load-status', msg)); }
  async function getTree() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (stored && Date.now() - stored.time < maxAgeMs && Array.isArray(stored.tree)) return stored.tree;
    } catch (_) {}
    const resp = await fetch(api, {headers:{'Accept':'application/vnd.github+json'}});
    if (!resp.ok) throw new Error('GitHub API error: ' + resp.status);
    const data = await resp.json();
    if (!Array.isArray(data.tree) || data.truncated) throw new Error('Incomplete GitHub file list');
    try {sessionStorage.setItem(cacheKey, JSON.stringify({time:Date.now(),tree:data.tree}));} catch (_) {}
    return data.tree;
  }
  function externalURL(s) {
    const raw = (s || '').trim();
    if (!raw) return '';
    const addr = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
    try { const parsed = new URL(addr); return /^https?:$/.test(parsed.protocol) ? parsed.href : ''; } catch (_) {return '';}
  }
  async function showProjects(tree,target) {
    const files = findFiles(tree,'project');
    const dirs = folders(files,'project');
    const results = await Promise.all(dirs.map(async name => {
      const base = `project/${name}/`;
      const itemFiles = files.filter(f => f.path.startsWith(base) && !f.path.slice(base.length).includes('/'));
      const paths = itemFiles.map(f => f.path);
      if (!paths.length) return null;
      let description = '';
      if (paths.includes(base+'desc.txt')) {
        try {description = await readText(base+'desc.txt');} catch (_) {}
      }
      const card = make('section','project');
      if (paths.includes(base+'thumbnail.png')) {
        const img = make('img','thumbnail'); img.src = sitePath(base+'thumbnail.png'); img.alt=name; card.appendChild(img);
      }
      card.appendChild(make('h3','',name));
      if (description) card.appendChild(make('div','desc',description));
      const downloads = paths.filter(p=>p.toLowerCase().endsWith('.zip')).sort(byName);
      if (downloads.length) {
        const holder = make('div','downloads');
        downloads.forEach(path => {const a=make('a','',path.slice(base.length)); a.href=sitePath(path); a.setAttribute('download',''); holder.appendChild(a);});
        card.appendChild(holder);
      }
      return card;
    }));
    target.replaceChildren(...results.filter(Boolean));
  }
  async function showBlogs(tree,target) {
    const files = findFiles(tree,'blogs');
    const dirs = folders(files,'blogs');
    const results = await Promise.all(dirs.map(async name => {
      const base=`blogs/${name}/`;
      const paths=files.filter(f=>f.path.startsWith(base) && !f.path.slice(base.length).includes('/')).map(f=>f.path);
      if (!paths.includes(base+'blog.txt') && !paths.some(p=>/^photo(?:[1-9]|[1-9][0-9])\.png$/i.test(p.slice(base.length)))) return null;
      const card=make('article','post'); card.appendChild(make('h3','',name));
      if (paths.includes(base+'blog.txt')) {
        try {card.appendChild(make('div','body',await readText(base+'blog.txt')));} catch (_) {}
      }
      const photos=paths.filter(p=>/^photo(?:[1-9]|[1-9][0-9])\.png$/i.test(p.slice(base.length))).sort((a,b)=>Number(a.match(/photo(\d+)/i)[1])-Number(b.match(/photo(\d+)/i)[1]));
      if (photos.length) {
        const holder=make('div','photos');
        photos.forEach(p=>{const img=make('img');img.src=sitePath(p);img.alt=name;img.loading='lazy';holder.appendChild(img);});
        card.appendChild(holder);
      }
      if (paths.includes(base+'link.txt')) {
        try {const link=externalURL(await readText(base+'link.txt'));if(link){const a=make('a','external','Link');a.href=link;a.target='_blank';a.rel='noopener noreferrer';card.appendChild(a);}} catch (_) {}
      }
      return card;
    }));
    target.replaceChildren(...results.filter(Boolean));
  }
  async function showLinks(tree,target) {
    const paths=findFiles(tree,'link').map(x=>x.path).filter(p=>/^link\/link\d+\.txt$/i.test(p)).sort(byName);
    const results=await Promise.all(paths.map(async path=>{
      let content; try {content=await readText(path);} catch(_){return null;}
      const vals={};
      content.split(/\r?\n/).forEach(line=>{const m=line.match(/^\s*(title|linkdesc|link)\s*:\s*(.*)$/i);if(m) vals[m[1].toLowerCase()]=m[2].trim();});
      const url=externalURL(vals.link);
      if (!url) return null;
      const article=make('article','link-item');
      const h=make('h3');const a=make('a','',vals.title || vals.link); a.href=url;a.target='_blank';a.rel='noopener noreferrer';h.appendChild(a);article.appendChild(h);
      if(vals.linkdesc)article.appendChild(make('p','link-desc',vals.linkdesc));
      const address=make('a','link-url',vals.link); address.href=url;address.target='_blank';address.rel='noopener noreferrer';article.appendChild(address);
      return article;
    }));
    target.replaceChildren(...results.filter(Boolean));
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const kind=document.body.dataset.contentType;
    const target=document.getElementById('content-list');
    if (!target || !kind) return;
    try {
      const tree=await getTree();
      if(kind==='projects') await showProjects(tree,target);
      else if(kind==='blogs') await showBlogs(tree,target);
      else if(kind==='links') await showLinks(tree,target);
    } catch(e) {console.error(e);error(target,'Unable to load content. Please refresh the page.');}
  });
})();
