(function(){
'use strict';

const PASSWORD_HASH = 'e17c2cdaaceef416152287dc579931963f2e13cbfa390665a8dc2bb1095108c7';
const LS_GH = 'mashcoffee_admin_gh';
const SS_UNLOCKED = 'mashcoffee_admin_unlocked';

const FONT_OPTIONS = ['Vazirmatn', 'Noto Sans Arabic', 'Noto Naskh Arabic', 'Amiri', 'Lalezar', 'Aref Ruqaa', 'Reem Kufi'];

const DEFAULT_COLORS = {
  colors: { ground: '#FBF4EA', surface: '#FFFDF9', ink: '#2B1D15', ink2: '#7B5F4C', line: '#E9DAC7', accent: '#C0721C', accentSoft: '#F6E5CF', pistachio: '#5F7A4F' },
  colorsDark: { ground: '#191109', surface: '#241911', ink: '#F6EADC', ink2: '#B59A80', line: '#3B2A1D', accent: '#E9A24C', accentSoft: '#3A2614', pistachio: '#93AF7C' }
};

const COLOR_FIELDS = [
  { key: 'ground', label: 'پس‌زمینه' },
  { key: 'surface', label: 'سطح کارت‌ها / پانویس' },
  { key: 'ink', label: 'متن اصلی' },
  { key: 'ink2', label: 'متن کم‌رنگ' },
  { key: 'line', label: 'خط جداکننده' },
  { key: 'accent', label: 'رنگ تاکیدی (قیمت، آیکن)' },
  { key: 'accentSoft', label: 'پس‌زمینهٔ دایرهٔ لوگو' },
  { key: 'pistachio', label: 'رنگ برچسب سبز' }
];

let draft = null;
let previewMode = 'light';
// key -> { filename, base64, apply() } — apply() writes the final path into draft after upload
let pendingImages = {};

const $ = sel => document.querySelector(sel);
const el = (tag, attrs, ...children) => {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return node;
};

async function sha256Hex(str){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function slugId(prefix){
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------------- gate ---------------- */
$('#gate-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pass = $('#gate-password').value;
  const hash = await sha256Hex(pass);
  if (hash === PASSWORD_HASH){
    sessionStorage.setItem(SS_UNLOCKED, '1');
    $('#gate-error').textContent = '';
    afterUnlock();
  } else {
    $('#gate-error').textContent = 'رمز اشتباه است.';
  }
});

function afterUnlock(){
  $('#gate-screen').hidden = true;
  const saved = localStorage.getItem(LS_GH);
  if (saved){
    try {
      const cfg = JSON.parse(saved);
      $('#setup-owner').value = cfg.owner || '';
      $('#setup-repo').value = cfg.repo || '';
      $('#setup-token').value = cfg.token || '';
      connect(cfg.owner, cfg.repo, cfg.token, true);
      return;
    } catch (e) {}
  }
  $('#setup-screen').hidden = false;
}

if (sessionStorage.getItem(SS_UNLOCKED) === '1'){
  afterUnlock();
}

/* ---------------- setup / connect ---------------- */
$('#setup-form').addEventListener('submit', e => {
  e.preventDefault();
  connect($('#setup-owner').value.trim(), $('#setup-repo').value.trim(), $('#setup-token').value.trim(), false);
});

async function connect(owner, repo, token, silent){
  const errEl = $('#setup-error');
  errEl.textContent = '';
  if (!owner || !repo || !token){
    if (!silent) errEl.textContent = 'همهٔ فیلدها لازم است.';
    $('#setup-screen').hidden = false;
    return;
  }
  GitHubAPI.configure({ owner, repo, token, branch: 'main' });
  try {
    await GitHubAPI.whoAmI();
    const file = await GitHubAPI.getFile('menu-data.json');
    if (!file){
      throw new Error('فایل menu-data.json در ریپو پیدا نشد. مطمئن شوید نام کاربری/ریپو درست است و فایل‌های سایت پوش شده‌اند.');
    }
    draft = JSON.parse(file.content);
    localStorage.setItem(LS_GH, JSON.stringify({ owner, repo, token }));
    $('#setup-screen').hidden = true;
    $('#editor-screen').hidden = false;
    $('#view-site-link').href = `https://${owner}.github.io/${repo}/`;
    pendingImages = {};
    buildStaticForm();
    renderSettingsForm();
    renderCategoriesList();
    renderPreview();
    setStatus('');
  } catch (err){
    $('#setup-screen').hidden = false;
    errEl.textContent = err.message || 'اتصال ناموفق بود.';
  }
}

$('#logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(SS_UNLOCKED);
  location.reload();
});

/* ---------------- tabs ---------------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ---------------- preview ---------------- */
function renderPreview(){
  renderMenu($('#preview-root'), draft, previewMode);
}
$('#preview-light-btn').addEventListener('click', () => { previewMode = 'light'; renderPreview(); });
$('#preview-dark-btn').addEventListener('click', () => { previewMode = 'dark'; renderPreview(); });

/* ---------------- settings tab: static one-time build ---------------- */
function buildStaticForm(){
  const logoPreview = $('#logo-thumb-preview');
  updateThumbPreview(logoPreview, { image: draft.settings.logoImage || '' });
  $('#logo-file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const { dataUrl, base64 } = await compressImage(file);
    const filename = 'images/logo.jpg';
    pendingImages['settings::logo'] = { filename, base64, apply: () => { draft.settings.logoImage = filename; } };
    draft.settings.logoImage = dataUrl;
    updateThumbPreview(logoPreview, { image: dataUrl });
    renderPreview();
  });
  $('#remove-logo-btn').addEventListener('click', () => {
    draft.settings.logoImage = '';
    delete pendingImages['settings::logo'];
    updateThumbPreview(logoPreview, { image: '' });
    renderPreview();
  });

  $('#reset-colors-btn').addEventListener('click', () => {
    if (!confirm('رنگ‌های حالت روشن و تاریک به تنظیمات پیش‌فرض اولیه بازگردانده شود؟')) return;
    draft.settings.colors = { ...DEFAULT_COLORS.colors };
    draft.settings.colorsDark = { ...DEFAULT_COLORS.colorsDark };
    renderSettingsForm();
    renderPreview();
  });

  const iconWrap = $('#logo-icon-select');
  iconWrap.innerHTML = '';
  ICON_KEYS.forEach(key => {
    const btn = el('button', {
      type: 'button', class: 'icon-opt', title: key,
      onclick: () => { draft.settings.logoIcon = key; highlightLogoIcon(); renderPreview(); }
    });
    btn.innerHTML = iconSvg(key);
    btn.dataset.key = key;
    iconWrap.appendChild(btn);
  });

  [['#f-font', 'font'], ['#f-displayFont', 'displayFont']].forEach(([sel, field]) => {
    const s = $(sel);
    s.innerHTML = '';
    FONT_OPTIONS.forEach(f => s.appendChild(el('option', { value: f }, f)));
    s.addEventListener('change', () => { draft.settings[field] = s.value; renderPreview(); });
  });

  const lightWrap = $('#colors-light');
  const darkWrap = $('#colors-dark');
  lightWrap.innerHTML = ''; darkWrap.innerHTML = '';
  COLOR_FIELDS.forEach(({ key, label }) => {
    lightWrap.appendChild(colorField('colors', key, label));
    darkWrap.appendChild(colorField('colorsDark', key, label));
  });

  bindText('#f-cafeName', v => draft.settings.cafeName = v);
  bindText('#f-tagline', v => draft.settings.tagline = v);
  bindText('#f-closedMessage', v => draft.settings.closedMessage = v);
  $('#f-siteEnabled').addEventListener('change', e => { draft.settings.siteEnabled = e.target.checked; renderPreview(); });
  bindText('#f-address', v => draft.settings.address = v);
  bindText('#f-phone', v => draft.settings.phone = v);
  bindText('#f-instagram', v => draft.settings.instagram = v);
  bindText('#f-instagramLabel', v => draft.settings.instagramLabel = v);
  bindText('#f-serviceNote', v => draft.settings.serviceNote = v);

  $('#add-hours-btn').addEventListener('click', () => {
    draft.settings.hoursLines = draft.settings.hoursLines || [];
    draft.settings.hoursLines.push({ label: '', value: '' });
    renderHoursList();
    renderPreview();
  });

  $('#add-category-btn').addEventListener('click', () => {
    draft.categories.push({ id: slugId('cat'), title: 'دستهٔ جدید', icon: 'cup', enabled: true, items: [] });
    renderCategoriesList();
    renderPreview();
  });
}

function bindText(sel, setter){
  $(sel).addEventListener('input', e => { setter(e.target.value); renderPreview(); });
}

function colorField(group, key, label){
  const input = el('input', { type: 'color' });
  input.addEventListener('input', () => {
    draft.settings[group] = draft.settings[group] || {};
    draft.settings[group][key] = input.value;
    renderPreview();
  });
  input.dataset.group = group;
  input.dataset.key = key;
  return el('div', { class: 'color-field' }, input, el('label', {}, label));
}

function highlightLogoIcon(){
  document.querySelectorAll('#logo-icon-select .icon-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.key === draft.settings.logoIcon);
  });
}

function renderSettingsForm(){
  const s = draft.settings;
  $('#f-cafeName').value = s.cafeName || '';
  $('#f-tagline').value = s.tagline || '';
  $('#f-closedMessage').value = s.closedMessage || '';
  $('#f-siteEnabled').checked = s.siteEnabled !== false;
  $('#f-address').value = s.address || '';
  $('#f-phone').value = s.phone || '';
  $('#f-instagram').value = s.instagram || '';
  $('#f-instagramLabel').value = s.instagramLabel || '';
  $('#f-serviceNote').value = s.serviceNote || '';
  $('#f-font').value = s.font || 'Vazirmatn';
  $('#f-displayFont').value = s.displayFont || 'Lalezar';
  highlightLogoIcon();
  updateThumbPreview($('#logo-thumb-preview'), { image: s.logoImage || '' });

  document.querySelectorAll('#colors-light input[type=color]').forEach(inp => {
    inp.value = (s.colors && s.colors[inp.dataset.key]) || '#ffffff';
  });
  document.querySelectorAll('#colors-dark input[type=color]').forEach(inp => {
    inp.value = (s.colorsDark && s.colorsDark[inp.dataset.key]) || '#000000';
  });

  renderHoursList();
}

function renderHoursList(){
  const wrap = $('#hours-list');
  wrap.innerHTML = '';
  (draft.settings.hoursLines || []).forEach((h, i) => {
    const labelInput = el('input', { type: 'text', placeholder: 'مثلاً شنبه تا پنجشنبه', value: h.label || '' });
    const valueInput = el('input', { type: 'text', placeholder: 'مثلاً ۹ صبح تا ۱۱ شب', value: h.value || '' });
    labelInput.addEventListener('input', () => { h.label = labelInput.value; renderPreview(); });
    valueInput.addEventListener('input', () => { h.value = valueInput.value; renderPreview(); });
    const delBtn = el('button', {
      type: 'button', class: 'btn small danger',
      onclick: () => { draft.settings.hoursLines.splice(i, 1); renderHoursList(); renderPreview(); }
    }, '✕');
    wrap.appendChild(el('div', { class: 'hours-row' }, labelInput, valueInput, delBtn));
  });
}

/* ---------------- categories & items ---------------- */
function renderCategoriesList(){
  const wrap = $('#categories-list');
  const openIds = new Set(Array.from(wrap.querySelectorAll('.category-card.open')).map(c => c.dataset.id));
  wrap.innerHTML = '';

  draft.categories.forEach((cat, catIdx) => {
    const card = el('div', { class: 'category-card' + (cat.enabled === false ? ' disabled' : '') });
    card.dataset.id = cat.id;
    if (openIds.has(cat.id) || openIds.size === 0 && catIdx === 0) card.classList.add('open');

    const titleInput = el('input', { type: 'text', value: cat.title || '', placeholder: 'نام دسته' });
    titleInput.addEventListener('input', () => { cat.title = titleInput.value; renderPreview(); });
    titleInput.addEventListener('click', e => e.stopPropagation());

    const chevron = el('span', { class: 'chevron' }, '›');

    const enabledToggle = el('label', { class: 'toggle', onclick: e => e.stopPropagation() },
      el('input', {
        type: 'checkbox', ...(cat.enabled !== false ? { checked: 'checked' } : {}),
        onchange: e => { cat.enabled = e.target.checked; card.classList.toggle('disabled', !cat.enabled); renderPreview(); }
      }), 'فعال');

    const upBtn = el('button', {
      type: 'button', class: 'btn small', title: 'جابه‌جایی به بالا', onclick: e => { e.stopPropagation(); moveCategory(catIdx, -1); }
    }, '▲');
    const downBtn = el('button', {
      type: 'button', class: 'btn small', title: 'جابه‌جایی به پایین', onclick: e => { e.stopPropagation(); moveCategory(catIdx, 1); }
    }, '▼');
    const delBtn = el('button', {
      type: 'button', class: 'btn small danger', onclick: e => {
        e.stopPropagation();
        if (confirm(`دستهٔ «${cat.title}» و همهٔ آیتم‌های آن حذف شود؟`)){
          (cat.items || []).forEach(it => delete pendingImages[cat.id + '::' + it.id]);
          draft.categories.splice(catIdx, 1);
          renderCategoriesList(); renderPreview();
        }
      }
    }, '🗑');

    const head = el('div', { class: 'category-card-head', onclick: () => card.classList.toggle('open') },
      chevron, titleInput, enabledToggle, upBtn, downBtn, delBtn);

    const body = el('div', { class: 'category-card-body' });

    const iconRow = el('div', { class: 'icon-select', style: 'margin:10px 0' });
    ICON_KEYS.forEach(key => {
      const b = el('button', {
        type: 'button', class: 'icon-opt' + (cat.icon === key ? ' selected' : ''), title: key,
        onclick: () => { cat.icon = key; renderCategoriesList(); renderPreview(); }
      });
      b.innerHTML = iconSvg(key);
      iconRow.appendChild(b);
    });
    body.appendChild(iconRow);

    (cat.items || []).forEach((item, itemIdx) => {
      body.appendChild(buildItemRow(cat, catIdx, item, itemIdx));
    });

    const addItemBtn = el('button', {
      type: 'button', class: 'btn small', style: 'margin-top:8px',
      onclick: () => {
        cat.items = cat.items || [];
        cat.items.push({ id: slugId('item'), name: '', desc: '', price: '', badge: '', image: '', enabled: true });
        renderCategoriesList(); renderPreview();
      }
    }, '+ افزودن آیتم');
    body.appendChild(addItemBtn);

    card.appendChild(head);
    card.appendChild(body);
    wrap.appendChild(card);
  });
}

function moveCategory(idx, dir){
  const to = idx + dir;
  if (to < 0 || to >= draft.categories.length) return;
  const [c] = draft.categories.splice(idx, 1);
  draft.categories.splice(to, 0, c);
  renderCategoriesList();
  renderPreview();
}

function moveItem(cat, idx, dir){
  const to = idx + dir;
  if (to < 0 || to >= cat.items.length) return;
  const [it] = cat.items.splice(idx, 1);
  cat.items.splice(to, 0, it);
  renderCategoriesList();
  renderPreview();
}

function buildItemRow(cat, catIdx, item, itemIdx){
  const thumb = el('div', { class: 'item-thumb' });
  const preview = el('div', { class: 'item-thumb-preview' });
  thumb.appendChild(preview);
  updateThumbPreview(preview, item);
  const fileInput = el('input', {
    type: 'file', accept: 'image/*',
    onchange: async e => {
      const file = e.target.files[0];
      if (!file) return;
      const { dataUrl, base64 } = await compressImage(file);
      const key = cat.id + '::' + item.id;
      const filename = 'images/' + cat.id + '-' + item.id + '.jpg';
      pendingImages[key] = { filename, base64, apply: () => { item.image = filename; } };
      item.image = dataUrl;
      updateThumbPreview(preview, item);
      renderPreview();
    }
  });
  thumb.appendChild(fileInput);

  const nameInput = el('input', { type: 'text', placeholder: 'نام آیتم', value: item.name || '' });
  nameInput.addEventListener('input', () => { item.name = nameInput.value; renderPreview(); });
  const priceInput = el('input', { type: 'text', placeholder: 'قیمت', value: item.price || '' });
  priceInput.addEventListener('input', () => { item.price = priceInput.value; renderPreview(); });
  const descInput = el('input', { type: 'text', placeholder: 'توضیح کوتاه', value: item.desc || '' });
  descInput.addEventListener('input', () => { item.desc = descInput.value; renderPreview(); });
  const badgeInput = el('input', { type: 'text', placeholder: 'برچسب (مثلاً پرفروش) — اختیاری', value: item.badge || '' });
  badgeInput.addEventListener('input', () => { item.badge = badgeInput.value; renderPreview(); });

  const removeImgBtn = el('button', {
    type: 'button', class: 'btn small', style: 'font-size:.7rem;padding:2px 6px',
    onclick: () => {
      item.image = '';
      delete pendingImages[cat.id + '::' + item.id];
      updateThumbPreview(preview, item);
      renderPreview();
    }
  }, 'حذف عکس');

  const enabledToggle = el('label', { class: 'toggle' },
    el('input', {
      type: 'checkbox', ...(item.enabled !== false ? { checked: 'checked' } : {}),
      onchange: e => { item.enabled = e.target.checked; renderPreview(); }
    }), 'فعال');

  const upBtn = el('button', { type: 'button', class: 'btn small', onclick: () => moveItem(cat, itemIdx, -1) }, '▲');
  const downBtn = el('button', { type: 'button', class: 'btn small', onclick: () => moveItem(cat, itemIdx, 1) }, '▼');
  const delBtn = el('button', {
    type: 'button', class: 'btn small danger',
    onclick: () => {
      if (confirm(`آیتم «${item.name || ''}» حذف شود؟`)){
        delete pendingImages[cat.id + '::' + item.id];
        cat.items.splice(itemIdx, 1);
        renderCategoriesList(); renderPreview();
      }
    }
  }, '🗑');

  return el('div', { class: 'item-row' },
    thumb,
    el('div', { class: 'item-fields' },
      el('div', { class: 'row-2' }, nameInput, priceInput),
      descInput, badgeInput,
      el('div', { style: 'display:flex;gap:10px;align-items:center' }, enabledToggle, removeImgBtn)
    ),
    el('div', { class: 'item-actions' }, upBtn, downBtn, delBtn)
  );
}

function updateThumbPreview(previewEl, item){
  if (item.image){
    previewEl.innerHTML = `<img src="${item.image}" alt="">`;
  } else {
    previewEl.innerHTML = '<span style="font-size:.65rem;color:var(--a-ink2)">+ عکس</span>';
  }
}

function compressImage(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        resolve({ dataUrl, base64: dataUrl.split(',')[1] });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------- save / reload ---------------- */
function setStatus(msg, kind){
  const s = $('#save-status');
  s.textContent = msg;
  s.style.color = kind === 'error' ? 'var(--a-danger)' : kind === 'ok' ? 'var(--a-ok)' : '';
}

$('#save-btn').addEventListener('click', async () => {
  const btn = $('#save-btn');
  btn.disabled = true;
  try {
    const keys = Object.keys(pendingImages);
    for (let i = 0; i < keys.length; i++){
      const key = keys[i];
      const { filename, base64, apply } = pendingImages[key];
      setStatus(`در حال آپلود عکس (${i + 1} از ${keys.length})...`);
      let sha;
      try { const existing = await GitHubAPI.getFile(filename); sha = existing ? existing.sha : undefined; } catch (e) {}
      await GitHubAPI.putBinaryFile(filename, base64, 'آپلود عکس منو از پنل مدیریت', sha);
      apply();
      delete pendingImages[key];
    }

    setStatus('در حال ذخیرهٔ منو...');
    let sha;
    try { const current = await GitHubAPI.getFile('menu-data.json'); sha = current ? current.sha : undefined; } catch (e) {}
    await GitHubAPI.putFile('menu-data.json', JSON.stringify(draft, null, 2), 'به‌روزرسانی منو از پنل مدیریت', sha);

    renderCategoriesList();
    renderPreview();
    setStatus('ذخیره شد ✓ — گیت‌هاب پیجز طی چند ثانیه تا چند دقیقه سایت را به‌روزرسانی می‌کند.', 'ok');
  } catch (err){
    setStatus('خطا: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

$('#reload-btn').addEventListener('click', async () => {
  if (!confirm('تغییرات ذخیره‌نشده از بین می‌رود. بازخوانی شود؟')) return;
  setStatus('در حال بازخوانی...');
  try {
    const file = await GitHubAPI.getFile('menu-data.json');
    draft = JSON.parse(file.content);
    pendingImages = {};
    renderSettingsForm();
    renderCategoriesList();
    renderPreview();
    setStatus('بازخوانی شد.', 'ok');
  } catch (err){
    setStatus('خطا در بازخوانی: ' + err.message, 'error');
  }
});

})();
