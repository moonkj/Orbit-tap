// ============================================================
// Swift Popup — Scrolly pattern, new gesture set
// ============================================================
(function () {
  'use strict';

  const SETTINGS_KEY = 'swiftSettings';
  const SETTINGS_KEYS = [
    'masterEnabled','xShape','lShape','circle','cShape',
    'floatingEnabled','buttonSize','buttonOpacity','sensitivity'
  ];

  let settings = {
    masterEnabled: true,
    xShape: true, lShape: true, circle: true, cShape: true,
    floatingEnabled: true,
    buttonSize: 'medium', buttonOpacity: 90, sensitivity: 50
  };

  // ── i18n ──────────────────────────────────────────────────
  const HOWTO_HTML = {
    ko: '플로팅 버튼 <b style="color:var(--text)">3번 탭</b> → 제스처 모드 활성화<br>파란 테두리가 나타나면 아래 제스처를 그리세요<br><span style="font-size:11px;color:var(--text)">· 1탭: 뒤로 · 2탭: 앞으로 · 길게 누르기: 가이드 표시</span>',
    en: 'Tap the floating button <b style="color:var(--text)">3 times</b> → Gesture mode<br>Draw gestures below when blue border appears<br><span style="font-size:11px;color:var(--text)">· 1 tap: Back · 2 taps: Forward · Long press: Guide</span>'
  };

  const I18N = {
    ko: { tagline:'Safari 제스처 컨트롤', master_label:'Orbit Tap Extension', master_desc:'모든 제스처 및 플로팅 버튼 활성화', howto_title:'제스처 사용법', usage_label:'오늘', gestures_title:'제스처', xshape_label:'탭 닫기', lshape_label:'새 탭 열기', circle_label:'페이지 내 검색', cshape_label:'새로고침 (캐시 무시)', floating_title:'플로팅 버튼', show_button:'플로팅 버튼 표시', show_button_desc:'모든 페이지에서 빠른 접근', btn_size:'크기', opacity:'투명도', sensitivity_title:'민감도', less_sensitive:'낮음', more_sensitive:'높음', footer:'Orbit Tap v1.0.0' },
    en: { tagline:'Gesture control for Safari', master_label:'Orbit Tap Extension', master_desc:'Enable all gestures & floating button', howto_title:'GESTURE USAGE', usage_label:'Today', gestures_title:'GESTURES', xshape_label:'Close Tab', lshape_label:'New Tab', circle_label:'Find on Page', cshape_label:'Hard Refresh', floating_title:'FLOATING BUTTON', show_button:'Show Floating Button', show_button_desc:'Quick access on every page', btn_size:'Size', opacity:'Opacity', sensitivity_title:'SENSITIVITY', less_sensitive:'Less', more_sensitive:'More', footer:'Orbit Tap v1.0.0' }
  };
  const lang = (() => { const l = (navigator.language || 'en').toLowerCase(); return l.startsWith('ko') ? 'ko' : 'en'; })();
  const t = (key) => (I18N[lang] || I18N.en)[key] || I18N.en[key] || key;
  // i18n helper: 한국어/영어 선택
  function i18n(ko, en) { return lang === 'ko' ? ko : en; }

  function applyI18n() {
    const map = { txt_tagline:'tagline', txt_master_label:'master_label', txt_master_desc:'master_desc', txt_howto_title:'howto_title', txt_usage_label:'usage_label', txt_gestures_title:'gestures_title', txt_xshape_label:'xshape_label', txt_lshape_label:'lshape_label', txt_circle_label:'circle_label', txt_cshape_label:'cshape_label', txt_floating_title:'floating_title', txt_show_button:'show_button', txt_show_button_desc:'show_button_desc', txt_btn_size:'btn_size', txt_opacity:'opacity', txt_sensitivity_title:'sensitivity_title', txt_less_sensitive:'less_sensitive', txt_more_sensitive:'more_sensitive', txt_footer:'footer' };
    for (const [id, key] of Object.entries(map)) {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    }
    const howtoBody = document.getElementById('txt_howto_body');
    if (howtoBody) howtoBody.innerHTML = HOWTO_HTML[lang] || HOWTO_HTML.en;
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
        xShape: settings.masterEnabled ? settings.xShape : false,
        lShape: settings.masterEnabled ? settings.lShape : false,
        circle: settings.masterEnabled ? settings.circle : false,
        cShape: settings.masterEnabled ? settings.cShape : false,
      }
    };
  }

  // ── pushSettings (Scrolly pattern) ────────────────────────
  function pushSettings() {
    const gestureConfig = buildGestureConfig();
    const snap = { ...settings };

    // Path 1: content script 직접 전달
    send('configUpdated', { config: gestureConfig, swiftSettings: snap });

    // Path 2: storage 직접 저장
    try {
      browser.storage?.local?.set({ [SETTINGS_KEY]: snap, gestureConfig })?.catch(() => {});
    } catch (_) {}

    // Path 3: background relay (가장 안정적)
    try {
      browser.runtime?.sendMessage?.({ action: 'saveConfig', swiftSettings: snap, gestureConfig })?.catch(() => {});
    } catch (_) {}
  }

  // ── renderUI ──────────────────────────────────────────────
  function renderUI() {
    document.getElementById('masterToggle').checked = settings.masterEnabled;
    const sub = document.getElementById('subControls');
    if (settings.masterEnabled) sub.classList.remove('dimmed');
    else sub.classList.add('dimmed');

    document.getElementById('xshapeToggle').checked = settings.xShape;
    document.getElementById('lshapeToggle').checked = settings.lShape;
    document.getElementById('circleToggle').checked = settings.circle;
    document.getElementById('cshapeToggle').checked = settings.cShape;
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
        settings.xShape = true; settings.lShape = true;
        settings.circle = true; settings.cShape = true;
        settings.floatingEnabled = true;
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
  bindToggle('xshapeToggle', 'xShape');
  bindToggle('lshapeToggle', 'lShape');
  bindToggle('circleToggle', 'circle');
  bindToggle('cshapeToggle', 'cShape');
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

  // Load from storage — swiftSettings 우선, gestureConfig fallback
  try {
    browser.storage?.local?.get([SETTINGS_KEY, 'gestureConfig'])?.then(result => {
      // Path 1: swiftSettings 직접 로드
      if (result?.[SETTINGS_KEY]) {
        const stored = result[SETTINGS_KEY];
        for (const k of SETTINGS_KEYS) { if (k in stored) settings[k] = stored[k]; }
      }
      // Path 2: gestureConfig에서 역변환 (swiftSettings 누락 시 보완)
      if (result?.gestureConfig) {
        const gc = result.gestureConfig;
        if (gc.masterEnabled !== undefined) settings.masterEnabled = gc.masterEnabled;
        if (gc.floatingButtonEnabled !== undefined) settings.floatingEnabled = gc.floatingButtonEnabled;
        if (gc.sensitivity !== undefined) settings.sensitivity = gc.sensitivity;
        if (gc.buttonSize !== undefined) settings.buttonSize = gc.buttonSize;
        if (gc.buttonOpacity !== undefined) settings.buttonOpacity = gc.buttonOpacity;
        if (gc.gesturesEnabled) {
          const ge = gc.gesturesEnabled;
          if (ge.xShape !== undefined) settings.xShape = ge.xShape;
          if (ge.lShape !== undefined) settings.lShape = ge.lShape;
          if (ge.circle !== undefined) settings.circle = ge.circle;
          if (ge.cShape !== undefined) settings.cShape = ge.cShape;
        }
      }
      renderUI();
    })?.catch(() => { renderUI(); });
  } catch (_) { renderUI(); }

  renderUI();

  // ── Usage Display ──────────────────────────────────────────
  function renderUsage(count, isSub) {
    const card = document.getElementById('usageCard');
    if (!card) return;

    if (isSub) {
      card.innerHTML = '<div style="font-size:13px;"><span style="color:var(--green);font-weight:700;">Pro</span> <span style="color:var(--sub);">' + i18n('무제한', 'Unlimited') + '</span></div>';
    } else {
      card.innerHTML = '<div style="font-size:13px;"><span style="color:var(--sub);" id="txt_usage_label">' + t('usage_label') + '</span> <span style="color:var(--text);font-weight:700;">' + count + '</span><span style="color:var(--sub);"> / 10</span></div><button id="subscribeBtn" style="padding:8px 16px;border:none;border-radius:8px;background:var(--primary);color:#fff;font-size:12px;font-weight:600;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,sans-serif;" >Pro</button>';
      document.getElementById('subscribeBtn')?.addEventListener('click', () => {
        try {
          const p = browser.tabs?.create({ url: 'swiftgesture://subscribe' });
          if (!p) window.open('swiftgesture://subscribe');
          else p.catch(() => window.open('swiftgesture://subscribe'));
        } catch(_) { window.open('swiftgesture://subscribe'); }
      });
    }
  }

  function loadUsage() {
    let count = 0;
    let isSub = false;

    // 팝업에서 직접 native messaging (ShieldMail 패턴)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendNativeMessage) {
        chrome.runtime.sendNativeMessage(
          'com.shadowengine.app',
          { action: 'getSubscriptionStatus' },
          (resp) => {
            if (resp?.isActive === true || resp?.tier === 'pro') {
              isSub = true;
              browser.storage?.local?.set({ subscriptionActive: true })?.catch(() => {});
              renderUsage(count, true);
            }
          }
        );
      }
    } catch(_) {}

    try {
      browser.storage?.local?.get(['swiftUsage', 'subscriptionActive', 'subscriptionDebug', 'subDbgContent'])?.then(result => {
        const data = result?.swiftUsage || {};
        const todayStr = new Date().toISOString().slice(0, 10);
        count = (data.date === todayStr) ? (data.count || 0) : 0;
        if (data.isSubscribed) isSub = true;
        if (result?.subscriptionActive === true) isSub = true;


        // background에 fresh 체크
        try {
          browser.runtime?.sendMessage?.({ action: 'getSubscriptionStatus' })?.then(r => {
            if (r?.isActive === true) {
              isSub = true;
              renderUsage(count, isSub);
            }
          })?.catch(() => {});
        } catch(_){}

        renderUsage(count, isSub);
      })?.catch(() => renderUsage(count, isSub));
    } catch(_) { renderUsage(count, isSub); }
  }
  loadUsage();

  // subscribeBtn 이벤트는 renderUsage()에서 동적으로 등록

  // ── Admin Mode ────────────────────────────────────────────
  const USAGE_KEY = 'swiftUsage';
  let versionTaps = 0;
  let versionTimer = null;

  // SHA-256 해시 (비번 비교용)
  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 로그인 시도 제한
  let loginAttempts = 0;
  const MAX_LOGIN_ATTEMPTS = 5;

  // 버전 5번 탭 → 관리자 패널 표시
  document.getElementById('txt_footer').addEventListener('click', () => {
    versionTaps++;
    if (versionTimer) clearTimeout(versionTimer);
    versionTimer = setTimeout(() => { versionTaps = 0; }, 1500);

    if (versionTaps >= 5) {
      versionTaps = 0;
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('adminLogin').style.display = 'block';
      document.getElementById('adminDash').style.display = 'none';
      document.getElementById('adminPw').value = '';
    }
  });

  // 관리자 로그인 — SHA-256 해시로만 비교, 평문 없음
  document.getElementById('adminLoginBtn').addEventListener('click', async () => {
    if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
      document.getElementById('adminPw').placeholder = 'Locked';
      return;
    }

    const pw = document.getElementById('adminPw').value;
    const expectedHash = window.__SWIFT_ADMIN_HASH || '';

    if (!expectedHash) { return; }

    const inputHash = await sha256(pw);
    if (inputHash === expectedHash) {
      loginAttempts = 0;
      document.getElementById('adminLogin').style.display = 'none';
      document.getElementById('adminDash').style.display = 'block';
      loadAdminStats();
    } else {
      loginAttempts++;
      document.getElementById('adminPw').style.borderColor = '#FF453A';
      document.getElementById('adminPw').value = '';
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        document.getElementById('adminPw').placeholder = 'Locked (5 attempts)';
      }
    }
  });

  function loadAdminStats() {
    try {
      browser.storage?.local?.get(USAGE_KEY)?.then(result => {
        const data = result?.[USAGE_KEY] || {};
        document.getElementById('statToday').textContent = data.count || 0;
        document.getElementById('statWeekFree').textContent = data.weekFreeCount || 0;
        document.getElementById('statTotalFree').textContent = data.totalFreeCount || 0;
        document.getElementById('statMonthSub').textContent = data.monthSubDays || 0;

        const toggle = document.getElementById('adminSubToggle');
        toggle.checked = data.isSubscribed || false;
      })?.catch(() => {});
    } catch(_) {}
  }

  // UsageTracker와 동일한 서명 알고리즘 (변조 방지)
  function computeSig(data) {
    const raw = `sw1ft_2026:${data.isSubscribed}:${data.date}:${data.count}`;
    let h = 0;
    for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h + raw.charCodeAt(i)) | 0; }
    return h.toString(36);
  }

  // 구독 전환
  document.getElementById('adminSubToggle').addEventListener('change', function() {
    const isSub = this.checked;
    try {
      browser.storage?.local?.get(USAGE_KEY)?.then(result => {
        const data = result?.[USAGE_KEY] || {};
        data.isSubscribed = isSub;
        if (isSub) data.monthSubDays = (data.monthSubDays || 0) + 1;
        data._sig = computeSig(data);
        browser.storage?.local?.set({ [USAGE_KEY]: data })?.then(() => {
          loadUsage();
          loadAdminStats();
          // content script에도 알림
          send('subscriptionChanged', { isSubscribed: isSub });
        })?.catch(() => {});
      })?.catch(() => {});
    } catch(_) {}
  });

  // 통계 초기화
  document.getElementById('adminResetBtn').addEventListener('click', () => {
    if (!confirm('Reset all stats?')) return;
    const emptyData = {
      date: new Date().toISOString().slice(0,10),
      count: 0, isSubscribed: false,
      totalFreeCount: 0, weekStart: '', weekFreeCount: 0,
      monthKey: '', monthSubDays: 0
    };
    try {
      browser.storage?.local?.set({ [USAGE_KEY]: emptyData })?.catch(() => {});
    } catch(_) {}
    loadAdminStats();
  });
})();
