// ============================================================
// Swift Popup — Scrolly pattern, new gesture set
// ============================================================
(function () {
  'use strict';

  const SETTINGS_KEY = 'swiftSettings';
  const SETTINGS_KEYS = [
    'masterEnabled','vShape','lShape','circle','cShape','diagonalSwipeUp',
    'floatingEnabled','buttonSize','buttonOpacity','sensitivity'
  ];

  let settings = {
    masterEnabled: true,
    vShape: true, lShape: true, circle: true, cShape: true, diagonalSwipeUp: true,
    floatingEnabled: true,
    buttonSize: 'medium', buttonOpacity: 90, sensitivity: 50
  };

  // ── i18n ──────────────────────────────────────────────────
  const I18N = {
    ko: { tagline:'Safari 제스처 컨트롤', master_label:'SWIFT Extension', master_desc:'모든 제스처 및 플로팅 버튼 활성화', gestures_title:'제스처', vshape_label:'V — 탭 닫기', lshape_label:'L — 탭 복구', circle_label:'○ — 페이지 내 검색', cshape_label:'C — 캐시 삭제 및 새로고침', diagonal_label:'↗ — 새 탭 열기', floating_title:'플로팅 버튼', show_button:'플로팅 버튼 표시', show_button_desc:'모든 페이지에서 빠른 접근', btn_size:'크기', opacity:'투명도', sensitivity_title:'민감도', less_sensitive:'낮음', more_sensitive:'높음', footer:'SWIFT v1.0.0' },
    en: { tagline:'Gesture control for Safari', master_label:'SWIFT Extension', master_desc:'Enable all gestures & floating button', gestures_title:'GESTURES', vshape_label:'V — Close Tab', lshape_label:'L — Restore Tab', circle_label:'○ — Find on Page', cshape_label:'C — Clear & Refresh', diagonal_label:'↗ — New Tab', floating_title:'FLOATING BUTTON', show_button:'Show Floating Button', show_button_desc:'Quick access on every page', btn_size:'Size', opacity:'Opacity', sensitivity_title:'SENSITIVITY', less_sensitive:'Less', more_sensitive:'More', footer:'SWIFT v1.0.0' }
  };
  const lang = (() => { const l = (navigator.language || 'en').toLowerCase(); return l.startsWith('ko') ? 'ko' : 'en'; })();
  const t = (key) => (I18N[lang] || I18N.en)[key] || I18N.en[key] || key;

  function applyI18n() {
    const map = { txt_tagline:'tagline', txt_master_label:'master_label', txt_master_desc:'master_desc', txt_gestures_title:'gestures_title', txt_vshape_label:'vshape_label', txt_lshape_label:'lshape_label', txt_circle_label:'circle_label', txt_cshape_label:'cshape_label', txt_diagonal_label:'diagonal_label', txt_floating_title:'floating_title', txt_show_button:'show_button', txt_show_button_desc:'show_button_desc', txt_btn_size:'btn_size', txt_opacity:'opacity', txt_sensitivity_title:'sensitivity_title', txt_less_sensitive:'less_sensitive', txt_more_sensitive:'more_sensitive', txt_footer:'footer' };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    }
  }

  // ── Scrolly send() ────────────────────────────────────────
  async function send(action, message) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        browser.tabs.sendMessage(tabs[0].id, { action, ...message }).catch(() => {});
      }
    } catch (e) {}
  }

  // ── gestureConfig ─────────────────────────────────────────
  function buildGestureConfig() {
    return {
      masterEnabled: settings.masterEnabled,
      floatingButtonEnabled: settings.masterEnabled && settings.floatingEnabled,
      sensitivity: settings.sensitivity,
      buttonSize: settings.buttonSize,
      buttonOpacity: settings.buttonOpacity,
      gesturesEnabled: {
        vShape: settings.masterEnabled ? settings.vShape : false,
        lShape: settings.masterEnabled ? settings.lShape : false,
        circle: settings.masterEnabled ? settings.circle : false,
        cShape: settings.masterEnabled ? settings.cShape : false,
        diagonalSwipeUp: settings.masterEnabled ? settings.diagonalSwipeUp : false,
      }
    };
  }

  // ── pushSettings (Scrolly pattern) ────────────────────────
  function pushSettings() {
    const gestureConfig = buildGestureConfig();
    send('configUpdated', { config: gestureConfig, swiftSettings: { ...settings } });
    try {
      browser.storage?.local?.set({ [SETTINGS_KEY]: { ...settings }, gestureConfig })?.catch(() => {});
    } catch (_) {}
  }

  // ── renderUI ──────────────────────────────────────────────
  function renderUI() {
    document.getElementById('masterToggle').checked = settings.masterEnabled;
    const sub = document.getElementById('subControls');
    if (settings.masterEnabled) sub.classList.remove('dimmed');
    else sub.classList.add('dimmed');

    document.getElementById('vshapeToggle').checked = settings.vShape;
    document.getElementById('lshapeToggle').checked = settings.lShape;
    document.getElementById('circleToggle').checked = settings.circle;
    document.getElementById('cshapeToggle').checked = settings.cShape;
    document.getElementById('diagonalToggle').checked = settings.diagonalSwipeUp;
    document.getElementById('floatingToggle').checked = settings.floatingEnabled;

    ['small','medium','large'].forEach(s => {
      document.getElementById('size_' + s).classList.toggle('active', settings.buttonSize === s);
    });

    document.getElementById('opacitySlider').value = settings.buttonOpacity;
    document.getElementById('opacityValue').textContent = settings.buttonOpacity + '%';
    document.getElementById('sensitivitySlider').value = settings.sensitivity;
    document.getElementById('sensitivityValue').textContent = settings.sensitivity + '%';
  }

  // ── Bindings ──────────────────────────────────────────────
  function bindToggle(id, key) {
    document.getElementById(id).addEventListener('change', function () {
      settings[key] = this.checked;
      if (key === 'masterEnabled' && this.checked) {
        settings.vShape = true; settings.lShape = true;
        settings.circle = true; settings.cShape = true;
        settings.diagonalSwipeUp = true; settings.floatingEnabled = true;
      }
      if (key === 'masterEnabled') renderUI();
      pushSettings();
    });
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'currentState' && msg.settings) {
      for (const k of SETTINGS_KEYS) { if (k in msg.settings) settings[k] = msg.settings[k]; }
      renderUI();
    }
  });

  // ── Init ──────────────────────────────────────────────────
  applyI18n();

  bindToggle('masterToggle', 'masterEnabled');
  bindToggle('vshapeToggle', 'vShape');
  bindToggle('lshapeToggle', 'lShape');
  bindToggle('circleToggle', 'circle');
  bindToggle('cshapeToggle', 'cShape');
  bindToggle('diagonalToggle', 'diagonalSwipeUp');
  bindToggle('floatingToggle', 'floatingEnabled');

  ['small','medium','large'].forEach(v => {
    document.getElementById('size_' + v).addEventListener('click', () => {
      settings.buttonSize = v; renderUI(); pushSettings();
    });
  });

  document.getElementById('opacitySlider').addEventListener('input', function () {
    settings.buttonOpacity = parseInt(this.value, 10);
    document.getElementById('opacityValue').textContent = this.value + '%';
    pushSettings();
  });

  document.getElementById('sensitivitySlider').addEventListener('input', function () {
    settings.sensitivity = parseInt(this.value, 10);
    document.getElementById('sensitivityValue').textContent = this.value + '%';
    pushSettings();
  });

  // Load + getState
  try {
    browser.storage?.local?.get(SETTINGS_KEY)?.then(result => {
      if (result?.[SETTINGS_KEY]) {
        const stored = result[SETTINGS_KEY];
        for (const k of SETTINGS_KEYS) { if (k in stored) settings[k] = stored[k]; }
      }
      renderUI();
    })?.catch(() => { renderUI(); });
  } catch (_) { renderUI(); }

  send('getState', {});
  renderUI();
})();
