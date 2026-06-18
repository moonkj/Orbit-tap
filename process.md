# Orbit Tap - Safari Gesture Extension 개발 프로세스

> 구현 단계가 진행될 때마다 업데이트되며, 각 단계 완료 시 GitHub 커밋

---

## 프로젝트 개요
- **앱 이름**: Orbit Tap
- **플랫폼**: iOS Safari Extension (Flutter + TypeScript + Swift)
- **Bundle ID**: com.shadowengine.app
- **수익화**: 1회 구매 유료 앱 (v1.1.0~, 단일 티어 무제한) · *이전 v1.0.x는 월 $0.99 구독 + 무료 10회/일*
- **지원 언어**: 6개 (한국어, 영어, 일본어, 중국어, 프랑스어, 힌디어)

---

## Phase 1: 팝업 설정 저장 ✅

### 문제
iOS Safari에서 popup의 `browser.storage.local.set()`이 비동기 완료 전 context 소멸

### 해결 (Scrolly 패턴)
- 외부 `popup.js` 파일 (inline script CSP 문제 회피)
- 옵셔널체이닝: `browser.storage?.local?.set()?.catch()`
- `browser.tabs.sendMessage()`로 content script에 직접 전달
- Content script가 `swiftSettings` + `gestureConfig` 둘 다 storage에 저장
- Popup은 `gestureConfig`에서 역변환 fallback

---

## Phase 2: 플로팅 버튼 ✅

### 디자인
- 글래스모피즘 다크 글래스 (`backdrop-filter: blur(24px)`)
- 스쿼클 모양 (`border-radius: 22%`)
- 원형 SVG 아이콘 (그라데이션 스트로크)
- 누름 효과: `scale(0.82)` + 원이 파란색으로 변경

### 동작
| 동작 | 기능 |
|------|------|
| 1탭 | 뒤로가기 |
| 2탭 | 앞으로가기 |
| 3탭 | 제스처 모드 |
| 꾹 3초 | 제스처 가이드 |
| 꾹 0.4초 + 드래그 | 위치 이동 |

### 해결한 버그
- 중복 버튼: iframe guard + `all_frames: false` + DOM cleanup
- 날아오는 효과: transition 비활성 후 다음 프레임에서 활성
- 크기 변경 시 원형됨: `size * 0.22` 사용

---

## Phase 3: 제스처 시스템 ✅

### iOS Safari 터치 제약
- `passive: true` → `touchcancel` 발생 (스크롤 시)
- `passive: false` + `preventDefault` → 스크롤 차단 (나쁜 UX)
- `touch-action: pan-y` → 사이트 멈춤
- **최종**: 제스처 모드 오버레이 (`touch-action: none`)

### 제스처 4종
| 제스처 | 동작 | 감지 |
|--------|------|------|
| X (두 획) | 탭 닫기 | 30°+ 각도 차, 1초 타임아웃 |
| L | 새 탭 | 2세그먼트, 60-120° 직각 |
| ○ 원 | 페이지 검색 | 각도 커버리지 ≥300° |
| C | 새로고침 | 각도 커버리지 150-300° |

### UX
- 네온 레인보우 궤적 (HSL 색상 순환 + 글로우)
- 보라→핑크→시안 테두리 (펄스 애니메이션)
- 5초 자동 해제
- 다국어 토스트 메시지

---

## Phase 4: 구독 시스템 (ShieldMail 패턴) ✅

### 구매 플로우
```
팝업 "Pro $0.99" → swiftgesture://subscribe
→ SceneDelegate → StoreKitChannel.purchase()
→ Apple StoreKit 2 → Transaction 검증
→ App Groups UserDefaults 저장
→ Extension에서 읽기
```

### 무료 제한 플로우
```
UsageTracker.recordUse() → count++
→ count >= 10 → 구독 안내 프롬프트
→ "구독하기" → URL scheme → 앱
```

### 핵심 컴포넌트
| 파일 | 역할 |
|------|------|
| StoreKitChannel.swift | StoreKit 2 구매/복원/검증/리스너 |
| AppGroupConstants.swift | App Groups 공유 키 |
| SafariWebExtensionHandler.swift | App Groups → Extension 구독 상태 |
| UsageTracker.ts | 일일 제한, 서명 검증, 통계 |
| popup.js | 사용량 표시, 구독 버튼, 관리자 패널 |

### 변조 방지
- `computeSignature()`: `salt + isSubscribed + date + count` 해시
- 로드 시 서명 불일치 → `isSubscribed = false`
- 관리자 토글도 서명 재계산

### 관리자 패널
- 버전 5탭 → SHA-256 비밀번호 (Web Crypto API)
- 5회 시도 잠금
- 구독 전환, 통계 보기, 초기화
- `admin_secret.js` gitignore 처리

---

## Phase 5: 앱 아이콘 & UI ✅

### 앱 아이콘
- 터치 포인트 + 파동 링 디자인
- 다크 네이비→퍼플 그라데이션 배경
- Python Pillow 생성 (2x → LANCZOS 다운스케일)

### i18n 6개 언어
- 팝업: `navigator.language` 동적 체크
- Flutter: `AppLocalizations` locale 기반
- 법적 문서 (개인정보/이용약관): 한/일/중/영 번역

---

## Phase 6: 코드 품질 & 보안 ✅

### TDD
- **247 테스트, 90%+ 라인 커버리지**
- vitest + jsdom + v8 coverage
- 11개 테스트 파일

### 보안 수정
| 항목 | 수정 |
|------|------|
| 비밀번호 | SHA-256 해시 (평문 제거) |
| 로그인 | 5회 시도 잠금 |
| 메시지 | sender 검증 (extension 내부만) |
| XSS | innerHTML → DOM API |
| 변조 | storage 서명 검증 |

### 데드코드 제거
- TapDetector.ts, GesturePreview.ts, QuickActionHUD.ts 삭제
- 미사용 config 속성 11개, 메서드 13개, 핸들러 3개 제거
- popup.html 데드코드 420줄 제거

### 성능 최적화
- 검색 디바운싱 (200ms)
- ShapeDetector `destroy()` 리사이즈 리스너 해제
- GestureEngine `AbortController` 오버레이 리스너 해제
- 타이머 cleanup (unmount/deactivate)
- SearchOverlay 캐시 DOM 쿼리

---

## Phase 7: 최종 검증 ✅

### 팀 에이전트 리뷰 (4회 실시)
- **Coder**: 로직 버그, null crash, 레이스 컨디션
- **UX/UI**: i18n 누락, 하드코딩 텍스트, 아이콘 불일치
- **Security**: XSS, 비밀번호 노출, storage 변조
- **Performance**: 메모리 누수, 타이머 누수, DOM 쿼리

### 구독 검증 (최종)
| 플로우 | 상태 |
|--------|------|
| 구매: popup → URL scheme → StoreKit | ✅ |
| 무료 제한: 10회 → 프롬프트 | ✅ |
| 관리자: 5탭 → 비밀번호 → 토글 + 서명 | ✅ |
| 구독 확인: popup native messaging → App Groups | ✅ |
| Product ID 일관성 | ✅ |
| App Group 일관성 | ✅ |
| URL scheme 일관성 | ✅ |
| 메서드명 일관성 (Flutter↔Swift) | ✅ |

---

## Phase 8: 구독 브릿지 디버깅 ✅

### 문제
StoreKit 구매 성공 후 팝업에서 "Pro 무제한" 표시 안 됨

### 디버깅 과정
| 시도 | 결과 |
|------|------|
| `browser.runtime.sendNativeMessage` (MV2 BG) | `is not a function` |
| `chrome.runtime.sendNativeMessage` (MV3 BG Promise) | 응답 `undefined` |
| `chrome.runtime.sendNativeMessage` (MV3 BG 콜백) | timeout |
| `chrome.runtime.sendNativeMessage` (MV3 CS) | API 없음 |
| **`chrome.runtime.sendNativeMessage` (MV3 Popup 콜백)** | **`{"tier":"pro","isActive":true}` 성공** |

### 근본 원인 및 해결
1. **Manifest V2 → V3** 전환 필수 (`nativeMessaging` 권한)
2. **App Groups entitlement** 앱 + Extension 둘 다 필요
3. **Popup context + 콜백 방식만** 응답 반환 (Background/Content 불가)
4. **NSNull 사용 금지** — 단순 타입만 반환
5. **`context.completeRequest(returningItems:, completionHandler: nil)`** 명시

### 핵심 교훈
> Safari에서 `sendNativeMessage` 응답은 **popup + chrome + 콜백**에서만 동작.
> Background service worker에서는 호출은 되지만 응답이 undefined.
> Content script에서는 API 자체 없음.

---

## Phase 9: App Store 심사 거부 & 재제출 ✅

### 심사 거부 (Guideline 2.1(b))
> "the app includes references to subscriptions but the associated In-App Purchase products have not been submitted for review"

### 원인
1. 구독 상품 `com.swift.app.monthly` 메타데이터 미완성 ("메타데이터 누락됨" 상태)
2. 첫 바이너리 제출 시 IAP를 함께 연결하지 않음
3. 구독 **그룹** 현지화 누락 (상품 현지화와 별개)

### 해결 단계

**1. 구독 상품 메타데이터 완성**
- 구독 가격: $0.99 / 175개국
- 심사 스크린샷 업로드 (Paywall 화면)
- 세금 범주: 상위 앱과 일치
- 상품 현지화 6개 언어 (한/영/일/중/프/힌)
  - 구독 설명 예: "무제한 제스처 사용, 하루 10회 제한 해제"

**2. 구독 그룹 현지화 (핵심 누락 지점)**
- Orbit Tap Pro 그룹 자체 현지화가 별도로 필요
- 6개 언어 × 표시 이름 `Orbit Tap Pro`
- 이 작업 후 상태: "메타데이터 누락됨" → **"제출 준비 완료"**

**3. 빌드 번호 상승 + 재빌드**
- `pubspec.yaml`: `1.0.0+1` → `1.0.0+2`
- `project.pbxproj`: SwiftSafariExtension 3개 config `CURRENT_PROJECT_VERSION = 1` → `2`
- `flutter build ios --release` + Xcode Archive

**4. 앱 버전에 IAP 연결**
- App Store 버전 1.0.0 페이지 하단 "앱 내 구입 및 구독" 섹션
- ➕ → Orbit Tap Pro Monthly 체크

**5. 심사 재제출**

### 핵심 교훈
| 교훈 | 설명 |
|------|------|
| 구독 상품 ≠ 구독 그룹 | 둘 다 별도의 현지화 필요 |
| "메타데이터 누락됨" 진단법 | 페이지 각 섹션의 🟡 노란 원 찾기 |
| 첫 구독은 반드시 앱과 함께 | 앱 버전 페이지에서 IAP 선택 후 제출 |
| Xcode Organizer GUI 필수 | Apple ID 인증은 Xcode keychain만 가능 |
| CLI 자동화 조건 | `~/.appstoreconnect/private_keys/` 에 API 키 필요 |

### 회신 템플릿 (영어)
Apple 심사팀 회신 시 수정 사항 나열 + 새 빌드 번호 명시

---

## Phase 10: 유료 앱 전환 — 구독 제거 (v1.1.0) ✅

### 배경
구독자 0명 상태에서 월 $0.99 구독 → **1회 구매 유료 앱**으로 전환. 무료/유료 티어 폐지, 앱 구매자 전원 무제한.

### 제거 내역
| 영역 | 내용 |
|------|------|
| Flutter | PaywallScreen, subscription_service, `/subscribe` 라우트, 설정 구독 섹션, StoreKit 메서드/상수 |
| Swift | StoreKitChannel.swift(+pbxproj 4엔트리), SceneDelegate `swiftgesture://` 핸들러, Handler 구독 응답, AppGroup 구독키 6개 |
| Extension | SubscriptionPrompt.ts, GestureEngine/FloatingButton 한도 게이트, popup 사용량카드+구독버튼+관리자 구독토글 |
| 문구 | popup "/10 Pro", 온보딩 "$0.99/월", 마케팅 "구독", l10n 구독키 13개, docs(이용약관/개인정보/지원) |
| Dead code | 도달불가 화면 5개(stats/about/gesture_detail/floating_button/exclusion), 미사용 l10n 키 61개, fl_chart 의존성 |

### grandfathering
별도 코드 불필요 — App Store가 무료→유료 전환 시 기존 다운로더에게 자동으로 평생 무료 부여.

### 검증
- flutter analyze 0 error, 확장 build OK, vitest 신규 실패 0, l10n 무결성 통과
- iOS release 빌드·실기기(iPhone) 설치 성공 (`Xcode build done`)
- 35 files, +76 / -3065

---

## 커밋 히스토리
| 커밋 | 내용 |
|------|------|
| `fb3e47f` | **v1.1.0**: 1회 구매 유료 앱 전환 + 구독·dead code 전면 제거 |
| `latest` | App Store resubmit: IAP metadata + group localization + build 2 |
| `0a4eb5c` | Rename extension to SWIFT with i18n manifest and popup min-width fix |
| `83c4620` | Add GitHub Pages: privacy, terms, support pages |
| `859a393` | Final review: timer leak fixes, large button 76px, free Y-axis movement |
| `5c845e6` | Fix subscription bridge: popup native messaging + MV3 + entitlements |
| `c03dfdb` | Fix critical subscription bugs |
| `06fb30b` | Complete app overhaul: subscription, admin, security, i18n, TDD 90%+ |
| `9391cba` | Major overhaul: new gesture system, Scrolly-pattern storage, glassmorphism |
| `400b5cd` | Remove position buttons, persist drag, master toggle fixes |
| `5f93c79` | Complete popup rewrite: Scrolly storage pattern |

---

## 최종 상태

- **코드 리뷰**: 팀 에이전트 전원 CLEAN (Coder/UX/Security+Perf)
- **테스트**: 247 통과, 90%+ 커버리지
- **보안**: SHA-256 비밀번호, storage 서명, sender 검증, XSS 방지
- **수익화**: 1회 구매 유료 앱 (v1.1.0 — 구독/StoreKit/페이월/무료제한 전부 제거, 단일 티어 무제한)
- **i18n**: 6개 언어 완전 커버
- **성능**: 디바운싱, AbortController, 타이머 cleanup 완료

---

## 빌드 & 배포
```bash
# TypeScript 빌드
cd safari_extension_src && npm run build

# 테스트
npx vitest run --exclude 'tests/content/**'

# 커버리지
npx vitest run --coverage

# Flutter iOS 빌드
flutter build ios --release

# 아이폰 설치
xcrun devicectl device install app --device <DEVICE_ID> build/ios/iphoneos/Runner.app
```
