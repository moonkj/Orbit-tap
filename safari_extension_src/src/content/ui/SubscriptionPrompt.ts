function getLang(): 'ko' | 'en' | 'ja' | 'zh' | 'fr' | 'hi' {
  const l = (navigator.language || 'en').toLowerCase();
  if (l.startsWith('ko')) return 'ko';
  if (l.startsWith('ja')) return 'ja';
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('fr')) return 'fr';
  if (l.startsWith('hi')) return 'hi';
  return 'en';
}

function tr(ko: string, en: string, ja: string, zh: string, fr: string, hi: string): string {
  const map = { ko, en, ja, zh, fr, hi } as const;
  return map[getLang()] || en;
}

const TITLE_BY_LANG = {
  ko: '오늘 무료 사용 완료',
  en: 'Free Limit Reached',
  ja: '本日の無料利用上限に達しました',
  zh: '今日免费使用已达上限',
  fr: 'Limite gratuite atteinte',
  hi: 'आज की मुफ्त सीमा पूरी',
};

const BODY_BY_LANG = {
  ko: '무료 사용자는 하루 10회까지 사용할 수 있습니다.\nOrbit Tap Pro를 구독하면 무제한으로 사용하세요!',
  en: 'Free users can use up to 10 times per day.\nSubscribe to Orbit Tap Pro for unlimited access!',
  ja: '無料ユーザーは1日10回まで利用できます。\nOrbit Tap Pro を購読すると無制限でご利用いただけます!',
  zh: '免费用户每天最多使用10次。\n订阅 Orbit Tap Pro 即可无限使用!',
  fr: "Les utilisateurs gratuits peuvent utiliser jusqu'à 10 fois par jour.\nAbonnez-vous à Orbit Tap Pro pour un accès illimité !",
  hi: 'मुफ्त उपयोगकर्ता दिन में 10 बार तक उपयोग कर सकते हैं।\nअसीमित पहुंच के लिए Orbit Tap Pro की सदस्यता लें!',
};

let activePrompt: HTMLElement | null = null;

export function showSubscriptionPrompt(): void {
  if (activePrompt) return;

  const lang = getLang();
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; top:0; left:0; right:0; bottom:0;
    z-index:2147483647; display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,0.6);
    font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    padding: 24px;
  `;
  el.innerHTML = `
    <div style="background:#1c1c1e;border-radius:16px;padding:28px 24px;max-width:340px;width:100%;text-align:center;color:#fff;">
      <div style="font-size:32px;margin-bottom:12px;">⚡</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">
        ${TITLE_BY_LANG[lang] || TITLE_BY_LANG.en}
      </div>
      <div style="font-size:13px;color:#98989d;margin-bottom:20px;line-height:1.5;white-space:pre-line;">
        ${BODY_BY_LANG[lang] || BODY_BY_LANG.en}
      </div>
      <div style="font-size:22px;font-weight:700;color:#0a84ff;margin-bottom:16px;">Pro</div>
      <button id="swift-sub-btn" style="
        width:100%;padding:14px;border:none;border-radius:12px;
        background:#0a84ff;color:#fff;font-size:16px;font-weight:600;cursor:pointer;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      ">${tr('구독하기', 'Subscribe', '購読する', '订阅', "S'abonner", 'सदस्यता लें')}</button>
      <button id="swift-sub-close" style="
        width:100%;padding:14px;border:none;background:none;
        color:#98989d;font-size:14px;cursor:pointer;margin-top:8px;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;
      ">${tr('나중에', 'Later', 'あとで', '稍后', 'Plus tard', 'बाद में')}</button>
    </div>
  `;
  document.documentElement.appendChild(el);
  activePrompt = el;

  const dismiss = () => { el.remove(); activePrompt = null; };
  el.querySelector('#swift-sub-close')?.addEventListener('click', dismiss);
  el.querySelector('#swift-sub-btn')?.addEventListener('click', () => {
    window.location.href = 'swiftgesture://subscribe';
    dismiss();
  });
}
