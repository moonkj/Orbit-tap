# SWIFT - Safari Gesture Extension 개발 프로세스

> 구현 단계가 진행될 때마다 업데이트되며, 각 단계 완료 시 GitHub 커밋

---

## 프로젝트 개요
- **앱 이름**: SWIFT
- **플랫폼**: iOS Safari Extension (Flutter + TypeScript + Swift)
- **Bundle ID**: com.shadowengine.app
- **구독**: $0.99/월 (무료 10회/일)
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
| 구독 확인: native messaging → App Groups | ✅ |
| Product ID 일관성 | ✅ |
| App Group 일관성 | ✅ |
| URL scheme 일관성 | ✅ |
| 메서드명 일관성 (Flutter↔Swift) | ✅ |

---

## 커밋 히스토리
| 커밋 | 내용 |
|------|------|
| `c03dfdb` | Fix critical subscription bugs |
| `06fb30b` | Complete app overhaul: subscription, admin, security, i18n, TDD 90%+ |
| `9391cba` | Major overhaul: new gesture system, Scrolly-pattern storage, glassmorphism |
| `400b5cd` | Remove position buttons, persist drag, master toggle fixes |
| `5f93c79` | Complete popup rewrite: Scrolly storage pattern |

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
