/* رندر مشترک منو — هم برای صفحهٔ اصلی و هم پیش‌نمایش پنل مدیریت استفاده می‌شود */

const ICONS = {
  cup: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 5.5c0-1 1-1.2 1-2.2M11.5 5.5c0-1 1-1.2 1-2.2"/>',
  coldcup: '<path d="M6 7h12l-1.5 13h-9z"/><path d="M8 11h8"/>',
  teapot: '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 9h2a2 2 0 0 1 0 4h-2"/>',
  shake: '<path d="M7 9h10l-1 11H8z"/><path d="M9 9a3 3 0 0 1 6 0"/><path d="M15 4l-1 5"/>',
  cake: '<path d="M4 12h16v7H4z"/><path d="M6 12V9h12v3"/><path d="M9 6v-.5M12 6v-.5M15 6v-.5"/>',
  breakfast: '<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M9 10c0-1.5 1.3-2 3-2s3 .5 3 2"/>'
};
const ICON_KEYS = Object.keys(ICONS);
function iconSvg(key, cls){
  const path = ICONS[key] || ICONS.cup;
  return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
function themeIconSvg(mode){
  const path = mode === 'dark' ? SUN_ICON : MOON_ICON;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function escapeHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function fontFamilyCss(name, fallback){
  return `"${name}",${fallback}`;
}

const LOCATION_ICON = '<path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>';
const PHONE_ICON = '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1.1 1A16 16 0 0 1 4 5.1 1 1 0 0 1 5 4z"/>';
const INSTAGRAM_ICON = '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r="1"/>';
const CLOCK_ICON = '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>';
const MOON_ICON = '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>';
const SUN_ICON = '<circle cx="12" cy="12" r="4.5"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>';

const THEME_STORAGE_KEY = 'mashcoffee-theme';
function getStoredMode(){
  try { return localStorage.getItem(THEME_STORAGE_KEY); } catch (e) { return null; }
}
function setStoredMode(mode){
  try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch (e) {}
}
function resolveMode(forceMode){
  if (forceMode === 'light' || forceMode === 'dark') return forceMode;
  const stored = getStoredMode();
  return (stored === 'light' || stored === 'dark') ? stored : 'light';
}

function applyTheme(rootEl, settings, mode){
  const dark = mode === 'dark';
  const palette = (dark && settings.colorsDark) ? settings.colorsDark : settings.colors;
  const map = {
    ground:'--ground', surface:'--surface', ink:'--ink', ink2:'--ink-2',
    line:'--line', accent:'--accent', accentSoft:'--accent-soft', pistachio:'--pistachio'
  };
  Object.keys(map).forEach(k => {
    if (palette && palette[k]) rootEl.style.setProperty(map[k], palette[k]);
  });
  rootEl.style.setProperty('--f-body', fontFamilyCss(settings.font || 'Vazirmatn', 'system-ui,sans-serif'));
  rootEl.style.setProperty('--f-display', fontFamilyCss(settings.displayFont || 'Lalezar', '"Vazirmatn",system-ui,sans-serif'));
  ensureFontsLoaded(settings.font, settings.displayFont);
}

let loadedFontKey = '';
function ensureFontsLoaded(font, displayFont){
  const families = Array.from(new Set([font, displayFont].filter(Boolean)));
  const key = families.join('|');
  if (!families.length || key === loadedFontKey) return;
  loadedFontKey = key;
  const href = 'https://fonts.googleapis.com/css2?' + families.map(f => 'family=' + encodeURIComponent(f) + ':wght@300;400;500;700').join('&') + '&display=swap';
  let link = document.getElementById('menu-google-fonts');
  if (!link){
    link = document.createElement('link');
    link.id = 'menu-google-fonts';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  link.href = href;
}

function renderMenu(rootEl, data, forceMode){
  const settings = data.settings || {};
  const showToggle = !forceMode;
  const mode = resolveMode(forceMode);
  rootEl.innerHTML = '';
  applyTheme(rootEl, settings, mode);

  const markHtml = settings.logoImage
    ? `<img src="${escapeHtml(settings.logoImage)}" alt="">`
    : iconSvg(settings.logoIcon);

  const toggleHtml = showToggle
    ? `<button type="button" class="theme-toggle theme-toggle-floating" id="theme-toggle-btn" aria-label="تغییر حالت روشن/تاریک">${themeIconSvg(mode)}</button>`
    : '';
  const navToggleHtml = showToggle
    ? `<button type="button" class="theme-toggle theme-toggle-nav" id="theme-toggle-btn" aria-label="تغییر حالت روشن/تاریک">${themeIconSvg(mode)}</button>`
    : '';

  function wireToggle(){
    if (!showToggle) return;
    const btn = rootEl.querySelector('#theme-toggle-btn');
    if (btn) btn.addEventListener('click', () => {
      setStoredMode(mode === 'dark' ? 'light' : 'dark');
      renderMenu(rootEl, data, forceMode);
    });
  }

  if (settings.siteEnabled === false){
    rootEl.innerHTML = `
      ${toggleHtml}
      <div class="wrap closed-wrap">
        <div class="head">
          <div class="mark">${markHtml}</div>
          <h1>${escapeHtml(settings.cafeName || '')}</h1>
        </div>
        <p class="closed-msg">${escapeHtml(settings.closedMessage || 'منو موقتاً در دسترس نیست.')}</p>
      </div>`;
    wireToggle();
    return;
  }

  const cats = (data.categories || []).filter(c => c.enabled !== false);

  const navHtml = cats.map(c => `<a href="#${escapeHtml(c.id)}">${escapeHtml(c.title)}</a>`).join('');

  const sectionsHtml = cats.map(cat => {
    const items = (cat.items || []).filter(it => it.enabled !== false);
    const itemsHtml = items.map(it => `
      <li class="item">
        <div class="thumb" aria-hidden="true">${it.image ? `<img src="${escapeHtml(it.image)}" alt="">` : iconSvg(cat.icon)}</div>
        <div class="info">
          <p class="name">${escapeHtml(it.name)}${it.badge ? `<span class="badge">${escapeHtml(it.badge)}</span>` : ''}</p>
          ${it.desc ? `<p class="desc">${escapeHtml(it.desc)}</p>` : ''}
        </div>
        <span class="price">${escapeHtml(it.price || '')}</span>
      </li>`).join('');
    return `
      <section id="${escapeHtml(cat.id)}">
        <div class="cat-head">
          <h2>${escapeHtml(cat.title)}</h2>
          <span class="dash"></span>
          <span class="count">${toPersianDigits(items.length)} مورد</span>
        </div>
        <ul class="items">${itemsHtml || '<li class="item empty">موردی ثبت نشده</li>'}</ul>
      </section>`;
  }).join('');

  const rows = [];
  if (settings.address) rows.push(`<div class="row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${LOCATION_ICON}</svg><span>${escapeHtml(settings.address)}</span></div>`);
  if (settings.phone) rows.push(`<div class="row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PHONE_ICON}</svg><span><a href="tel:${escapeHtml(settings.phone.replace(/[^\d+]/g,''))}">${escapeHtml(settings.phone)}</a></span></div>`);
  if (settings.instagram) rows.push(`<div class="row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${INSTAGRAM_ICON}</svg><span><a href="${escapeHtml(settings.instagram)}" target="_blank" rel="noopener">${escapeHtml(settings.instagramLabel || 'اینستاگرام کافه')}</a></span></div>`);
  if (settings.hoursLines && settings.hoursLines.length){
    const txt = settings.hoursLines.map(h => `<b>${escapeHtml(h.label)}</b> ${escapeHtml(h.value)}`).join(' — ');
    rows.push(`<div class="row hours"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${CLOCK_ICON}</svg><span>${txt}</span></div>`);
  }

  rootEl.innerHTML = `
    <div class="wrap" dir="rtl" lang="fa">
      <header class="head">
        <div class="mark" aria-hidden="true">${markHtml}</div>
        <h1>${escapeHtml(settings.cafeName || '')}</h1>
        ${settings.tagline ? `<p class="tagline">${escapeHtml(settings.tagline)}</p>` : ''}
      </header>
      <nav class="nav" aria-label="دسته‌بندی منو"><div class="nav-inner"><div class="nav-scroll">${navHtml}</div>${navToggleHtml}</div></nav>
      ${sectionsHtml}
      ${settings.serviceNote ? `<p class="note">${escapeHtml(settings.serviceNote)}</p>` : ''}
      ${rows.length ? `<footer><h3>${escapeHtml(settings.cafeName || '')}</h3><div class="rows">${rows.join('')}</div></footer>` : ''}
    </div>`;
  wireToggle();
}

function toPersianDigits(n){
  const d = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(n).replace(/[0-9]/g, x => d[x]);
}
