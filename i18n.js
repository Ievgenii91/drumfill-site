(function () {
  var LANGS = [
    ['en', 'English'],
    ['uk', 'Українська'],
    ['de', 'Deutsch'],
    ['es', 'Español'],
    ['fr', 'Français'],
    ['pl', 'Polski'],
    ['cs', 'Čeština'],
    ['pt-PT', 'Português'],
    ['ja', '日本語'],
    ['zh-Hans', '简体中文']
  ];
  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'drumfill.lang.v1';
  var ALIASES = { pt: 'pt-PT', 'pt-pt': 'pt-PT', 'pt-br': 'pt-PT', zh: 'zh-Hans', 'zh-cn': 'zh-Hans', 'zh-sg': 'zh-Hans', 'zh-hans': 'zh-Hans' };

  var base = new WeakMap();   // element -> original English markup/attributes
  var cache = {};             // lang -> dictionary
  var current = DEFAULT_LANG;
  var dict = {};

  function normalize(code) {
    if (!code) return '';
    var lower = String(code).toLowerCase();
    var hit = ALIASES[lower] || ALIASES[lower.split('-')[0]];
    if (hit) return hit;
    var short = lower.split('-')[0];
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i][0].toLowerCase() === lower || LANGS[i][0].toLowerCase() === short) return LANGS[i][0];
    }
    return '';
  }

  function readStored() {
    try { return normalize(window.localStorage.getItem(STORAGE_KEY)); } catch (e) { return ''; }
  }

  function storeLang(lang) {
    try { window.localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* storage unavailable */ }
  }

  function detect() {
    var fromUrl = '';
    try { fromUrl = normalize(new URLSearchParams(window.location.search).get('lang')); } catch (e) { /* old browser */ }
    if (fromUrl) return fromUrl;
    var stored = readStored();
    if (stored) return stored;
    var prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < prefs.length; i++) {
      var hit = normalize(prefs[i]);
      if (hit) return hit;
    }
    return DEFAULT_LANG;
  }

  function t(key, fallback) {
    return Object.prototype.hasOwnProperty.call(dict, key) ? dict[key] : fallback;
  }

  function parseAttrMap(spec) {
    return spec.split(';').map(function (pair) {
      var i = pair.indexOf(':');
      return [pair.slice(0, i), pair.slice(i + 1)];
    });
  }

  function apply(root) {
    root = root || document;
    var nodes = Array.prototype.slice.call(root.querySelectorAll('[data-i18n], [data-i18n-attr]'));
    if (root.nodeType === 1 && (root.hasAttribute('data-i18n') || root.hasAttribute('data-i18n-attr'))) {
      nodes.unshift(root);
    }
    nodes.forEach(function (el) {
      var saved = base.get(el);
      if (!saved) {
        saved = { html: el.innerHTML, attrs: {} };
        parseAttrMap(el.getAttribute('data-i18n-attr') || '').forEach(function (p) {
          if (p[0]) saved.attrs[p[0]] = el.getAttribute(p[0]);
        });
        base.set(el, saved);
      }
      var key = el.getAttribute('data-i18n');
      if (key) {
        if (el.tagName === 'TITLE') {
          el.textContent = t(key, el.textContent);
        } else {
          el.innerHTML = t(key, saved.html);
        }
      }
      parseAttrMap(el.getAttribute('data-i18n-attr') || '').forEach(function (p) {
        if (p[0]) el.setAttribute(p[0], t(p[1], saved.attrs[p[0]]));
      });
    });
    if (root === document) {
      var title = document.querySelector('title[data-i18n]');
      if (title && base.get(title) && !dict[title.getAttribute('data-i18n')]) {
        title.textContent = base.get(title).html;
      }
    }
  }

  function load(lang) {
    if (lang === DEFAULT_LANG) return Promise.resolve({});
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch('locales/' + lang + '.json', { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('locale ' + lang + ' ' + r.status);
        return r.json();
      })
      .then(function (d) { cache[lang] = d; return d; });
  }

  function syncSwitcher() {
    var select = document.getElementById('df-lang');
    if (select) select.value = current;
  }

  function setLang(lang, persist) {
    lang = normalize(lang) || DEFAULT_LANG;
    return load(lang).catch(function (err) {
      if (window.console && console.warn) console.warn('Falling back to English:', err);
      lang = DEFAULT_LANG;
      return {};
    }).then(function (d) {
      current = lang;
      dict = d;
      document.documentElement.lang = lang === 'zh-Hans' ? 'zh-Hans' : lang;
      apply(document);
      syncSwitcher();
      if (persist) storeLang(lang);
      document.dispatchEvent(new CustomEvent('dfi18n', { detail: { lang: lang } }));
    });
  }

  function buildSwitcher() {
    if (document.getElementById('df-lang')) return;
    var host = document.querySelector('.nav-inner');
    if (!host) return;
    var wrap = document.createElement('div');
    wrap.className = 'lang-switch';
    var select = document.createElement('select');
    select.id = 'df-lang';
    select.className = 'lang-select';
    select.setAttribute('aria-label', 'Language');
    select.setAttribute('data-i18n-attr', 'aria-label:common.language');
    LANGS.forEach(function (l) {
      var o = document.createElement('option');
      o.value = l[0];
      o.textContent = l[1];
      o.lang = l[0];
      select.appendChild(o);
    });
    select.addEventListener('change', function () { setLang(select.value, true); });
    wrap.appendChild(select);
    var links = host.querySelector('.nav-links');
    if (links && links.nextSibling) host.insertBefore(wrap, links.nextSibling);
    else host.appendChild(wrap);
  }

  window.dfI18n = {
    langs: LANGS,
    t: t,
    apply: apply,
    setLang: function (l) { return setLang(l, true); },
    get lang() { return current; }
  };

  function init() {
    buildSwitcher();
    var lang = detect();
    syncSwitcher();
    if (lang !== DEFAULT_LANG) setLang(lang, false);
    else { current = DEFAULT_LANG; syncSwitcher(); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
