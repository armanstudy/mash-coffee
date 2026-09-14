/* پوستهٔ سبک روی GitHub Contents API برای ذخیرهٔ تغییرات پنل مدیریت */

const GitHubAPI = (() => {
  let cfg = { owner: '', repo: '', branch: 'main', token: '' };

  function configure(opts){ Object.assign(cfg, opts); }

  function headers(){
    return {
      'Authorization': 'Bearer ' + cfg.token,
      'Accept': 'application/vnd.github+json'
    };
  }

  async function whoAmI(){
    const res = await fetch('https://api.github.com/user', { headers: headers() });
    if (!res.ok) throw new Error('توکن نامعتبر است یا دسترسی ندارد (کد ' + res.status + ')');
    return res.json();
  }

  async function getFile(path){
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}?ref=${cfg.branch}&t=${Date.now()}`;
    const res = await fetch(url, { headers: headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('خطا در خواندن ' + path + ' (کد ' + res.status + ')');
    const json = await res.json();
    let content = null;
    try { content = b64DecodeUtf8(json.content); } catch (e) { /* binary file, sha still usable */ }
    return { sha: json.sha, content };
  }

  async function putFile(path, contentStr, message, sha){
    const body = {
      message,
      content: b64EncodeUtf8(contentStr),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
      body: JSON.stringify(body)
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error('خطا در ذخیرهٔ ' + path + ': ' + (err.message || res.status));
    }
    return res.json();
  }

  async function putBinaryFile(path, base64Content, message, sha){
    const body = { message, content: base64Content, branch: cfg.branch };
    if (sha) body.sha = sha;
    const url = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers()),
      body: JSON.stringify(body)
    });
    if (!res.ok){
      const err = await res.json().catch(() => ({}));
      throw new Error('خطا در آپلود ' + path + ': ' + (err.message || res.status));
    }
    return res.json();
  }

  function b64EncodeUtf8(str){
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(b64){
    return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
  }

  return { configure, whoAmI, getFile, putFile, putBinaryFile };
})();
