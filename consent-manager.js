(function () {
  var measurementId = typeof window.DRUMFILL_GA_ID === 'string'
    ? window.DRUMFILL_GA_ID.trim()
    : '';
  var consentStorageKey = 'drumfill.analytics_consent.v1';
  var consentGranted = 'granted';
  var consentDenied = 'denied';
  var bannerId = 'df-consent-banner';
  var manageButtonId = 'df-consent-manage';
  var analyticsConfigured = false;

  if (!measurementId || typeof window.gtag !== 'function') {
    return;
  }

  function logStorageWarning(action, error) {
    if (window.console && typeof window.console.warn === 'function') {
      window.console.warn('Analytics consent ' + action + ' failed.', error);
    }
  }

  function readStoredConsent() {
    try {
      var stored = window.localStorage.getItem(consentStorageKey);
      return stored === consentGranted || stored === consentDenied ? stored : '';
    } catch (error) {
      logStorageWarning('read', error);
      return '';
    }
  }

  function storeConsent(decision) {
    try {
      window.localStorage.setItem(consentStorageKey, decision);
    } catch (error) {
      logStorageWarning('write', error);
    }
  }

  function consentPayload(granted) {
    return {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    };
  }

  function expireCookie(name, domain) {
    document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' + (domain ? '; domain=' + domain : '');
  }

  function clearAnalyticsCookies() {
    if (!document.cookie) {
      return;
    }

    var names = document.cookie.split(';').map(function (entry) {
      return entry.split('=')[0].trim();
    }).filter(function (name) {
      return name.indexOf('_ga') === 0 || name.indexOf('_gid') === 0;
    });

    if (!names.length) {
      return;
    }

    var host = window.location.hostname;
    var domains = ['', host, '.' + host];
    var hostParts = host.split('.');
    if (hostParts.length > 2) {
      domains.push('.' + hostParts.slice(-2).join('.'));
    }

    names.forEach(function (name) {
      domains.forEach(function (domain) {
        expireCookie(name, domain);
      });
    });
  }

  function disableAnalytics() {
    window['ga-disable-' + measurementId] = true;
    window.gtag('consent', 'update', consentPayload(false));
    clearAnalyticsCookies();
  }

  function enableAnalytics() {
    window['ga-disable-' + measurementId] = false;
    window.gtag('consent', 'update', consentPayload(true));

    if (analyticsConfigured) {
      return;
    }

    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      anonymize_ip: true
    });
    analyticsConfigured = true;
  }

  function ensureStyles() {
    if (document.getElementById('df-consent-style')) {
      return;
    }

    var style = document.createElement('style');
    style.id = 'df-consent-style';
    style.textContent =
      '#df-consent-banner {' +
        'position: fixed;' +
        'right: 20px;' +
        'bottom: 20px;' +
        'width: min(420px, calc(100vw - 32px));' +
        'padding: 18px 18px 16px;' +
        'border: 1px solid rgba(255,255,255,0.12);' +
        'border-radius: 18px;' +
        'background: rgba(11,13,18,0.96);' +
        'box-shadow: 0 24px 60px -30px rgba(0,0,0,0.65);' +
        'color: #f6f7fb;' +
        'font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;' +
        'line-height: 1.55;' +
        'z-index: 9999;' +
      '}' +
      '#df-consent-banner[hidden] { display: none; }' +
      '#df-consent-banner p {' +
        'margin: 0;' +
        'font-size: 14px;' +
      '}' +
      '#df-consent-banner a {' +
        'color: #7be3a9;' +
      '}' +
      '#df-consent-banner .df-consent-actions {' +
        'display: flex;' +
        'gap: 10px;' +
        'flex-wrap: wrap;' +
        'margin-top: 14px;' +
      '}' +
      '#df-consent-banner button,' +
      '#df-consent-manage {' +
        'border: 0;' +
        'border-radius: 999px;' +
        'padding: 11px 15px;' +
        'font: inherit;' +
        'font-size: 14px;' +
        'font-weight: 650;' +
        'cursor: pointer;' +
      '}' +
      '#df-consent-banner .df-consent-accept {' +
        'background: #2ecc70;' +
        'color: #06270f;' +
      '}' +
      '#df-consent-banner .df-consent-decline,' +
      '#df-consent-manage {' +
        'background: #212531;' +
        'color: #f6f7fb;' +
        'border: 1px solid rgba(255,255,255,0.12);' +
      '}' +
      '#df-consent-manage {' +
        'position: fixed;' +
        'left: 20px;' +
        'bottom: 20px;' +
        'z-index: 9998;' +
        'box-shadow: 0 16px 40px -28px rgba(0,0,0,0.7);' +
      '}' +
      '#df-consent-manage[hidden] { display: none; }' +
      '@media (max-width: 640px) {' +
        '#df-consent-banner {' +
          'left: 16px;' +
          'right: 16px;' +
          'bottom: 16px;' +
          'width: auto;' +
        '}' +
        '#df-consent-manage {' +
          'left: 16px;' +
          'bottom: 16px;' +
        '}' +
      '}';
    document.head.appendChild(style);
  }

  function getBanner() {
    return document.getElementById(bannerId);
  }

  function getManageButton() {
    return document.getElementById(manageButtonId);
  }

  function hideBanner() {
    var banner = getBanner();
    if (banner) {
      banner.hidden = true;
    }
  }

  function showBanner() {
    var banner = getBanner();
    if (!banner) {
      return;
    }

    banner.hidden = false;
    var manageButton = getManageButton();
    if (manageButton) {
      manageButton.hidden = true;
    }
  }

  function showManageButton() {
    var manageButton = getManageButton();
    if (manageButton) {
      manageButton.hidden = false;
    }
  }

  function setConsent(decision) {
    storeConsent(decision);
    if (decision === consentGranted) {
      enableAnalytics();
    } else {
      disableAnalytics();
    }
    hideBanner();
    showManageButton();
  }

  function createBanner() {
    if (getBanner()) {
      return;
    }

    var banner = document.createElement('section');
    banner.id = bannerId;
    banner.hidden = true;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics preferences');
    banner.innerHTML =
      '<p>We use Google Analytics only if you agree. It helps us understand which pages people use so we can improve the site. You can change this choice any time or read more in our <a href="privacy.html">Privacy Policy</a>.</p>' +
      '<div class="df-consent-actions">' +
        '<button class="df-consent-decline" type="button">Decline</button>' +
        '<button class="df-consent-accept" type="button">Allow analytics</button>' +
      '</div>';

    var declineButton = banner.querySelector('.df-consent-decline');
    var acceptButton = banner.querySelector('.df-consent-accept');
    declineButton.addEventListener('click', function () {
      setConsent(consentDenied);
    });
    acceptButton.addEventListener('click', function () {
      setConsent(consentGranted);
    });

    document.body.appendChild(banner);
  }

  function createManageButton() {
    if (getManageButton()) {
      return;
    }

    var button = document.createElement('button');
    button.id = manageButtonId;
    button.type = 'button';
    button.hidden = true;
    button.textContent = 'Cookie settings';
    button.addEventListener('click', showBanner);
    document.body.appendChild(button);
  }

  function initUi() {
    ensureStyles();
    createBanner();
    createManageButton();

    var stored = readStoredConsent();
    if (stored) {
      showManageButton();
      hideBanner();
      return;
    }

    showBanner();
  }

  disableAnalytics();

  var storedConsent = readStoredConsent();
  if (storedConsent === consentGranted) {
    enableAnalytics();
  } else if (storedConsent === consentDenied) {
    disableAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUi, { once: true });
  } else {
    initUi();
  }
})();
