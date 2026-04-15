# Swift – Safari Gesture Control Extension
## Architecture & Implementation Plan

> **Version:** 1.0 | **Date:** 2026-04-15 | **Author:** Team Leader (Architect)

---

## 1. 아키텍처 개요

### 1.1 핵심 결정사항

| 결정 | 근거 |
|------|------|
| **Flutter = 컨테이너 앱 전용** | Safari Web Extension은 별도 네이티브 타겟 필수. Flutter 엔진은 Extension 프로세스에서 실행 불가 (메모리 제한 ~120MB, 샌드박스) |
| **TypeScript → JS 번들** | Extension content/background script는 JavaScript. TypeScript로 개발하여 타입 안정성 확보 후 Rollup으로 번들 |
| **App Groups 데이터 공유** | 앱 ↔ Extension 간 실시간 통신 불가. UserDefaults(suiteName:)을 통한 비동기 공유만 가능 |
| **StoreKit 2 직접 구현** | 월 $0.99 단순 구독이므로 RevenueCat 불필요. 앱 크기 절감 |

### 1.2 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────────┐
│                      iOS App Bundle                          │
│                                                              │
│  ┌────────────────────────┐  ┌─────────────────────────────┐│
│  │  Flutter Container App │  │  Safari Web Extension       ││
│  │                        │  │  (Native Target)            ││
│  │  ┌──────────────────┐  │  │                             ││
│  │  │ Dart UI Layer    │  │  │  ┌───────────────────────┐  ││
│  │  │ - Onboarding     │  │  │  │ content_script.js     │  ││
│  │  │ - Settings       │  │  │  │ - GestureEngine       │  ││
│  │  │ - Gesture Config │  │  │  │ - FloatingButton      │  ││
│  │  │ - Subscription   │  │  │  │ - QuickActionHUD      │  ││
│  │  │ - Stats Dashboard│  │  │  │ - IntentDetector      │  ││
│  │  │ - Tutorial       │  │  │  │ - ExclusionManager    │  ││
│  │  └───────┬──────────┘  │  │  └───────────────────────┘  ││
│  │          │MethodChannel│  │  ┌───────────────────────┐  ││
│  │  ┌───────▼──────────┐  │  │  │ background.js         │  ││
│  │  │ Native Swift     │  │  │  │ - TabManager          │  ││
│  │  │ Bridge Layer     │  │  │  │ - NavigationHandler    │  ││
│  │  │ - StoreKit 2     │  │  │  └───────────────────────┘  ││
│  │  │ - App Group I/O  │  │  │  ┌───────────────────────┐  ││
│  │  └───────┬──────────┘  │  │  │ SafariWebExtHandler   │  ││
│  └──────────┼─────────────┘  │  │ .swift (Native Msg)   │  ││
│             │ App Groups     │  └───────────┬───────────┘  ││
│             └────────────────┼──────────────┘              ││
│                              └─────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 1.3 기술 스택

| 레이어 | 기술 |
|--------|------|
| **컨테이너 앱 UI** | Flutter 3.x / Dart |
| **상태 관리** | Riverpod |
| **네이티브 브릿지** | MethodChannel → Swift |
| **구독 결제** | StoreKit 2 (Swift, async/await) |
| **Extension Native** | Swift (SafariWebExtensionHandler) |
| **Extension Web** | TypeScript → Rollup → JS 번들 |
| **테스트 (JS)** | Vitest |
| **테스트 (Flutter)** | flutter_test + mockito |
| **빌드** | Xcode + Flutter CLI + npm scripts |

---

## 2. 기능 실현 가능성 분석

> Teammate 2 (Debugger)의 리스크 분석과 Teammate 3 (Tester)의 사양 검토를 종합한 결과

### 2.1 구현 확정 기능 (Green)

| 기능 | 구현 방법 | 확신도 |
|------|----------|--------|
| Mid-Back/Forward 스와이프 | `history.back()` / `history.forward()` via content script | 95% |
| V Shape (탭 닫기) | `browser.runtime.sendMessage` → `browser.tabs.remove()` | 90% |
| L Shape (탭 복구) | 닫힌 탭 URL을 `browser.storage.local`에 저장 후 `browser.tabs.create()` | 90% |
| Long Press (상단/하단) | `window.scrollTo()` | 95% |
| Two Finger Flick Up (새로고침) | `location.reload()` | 90% |
| Floating Button (싱글/더블탭, 드래그) | Shadow DOM + CSS transform | 95% |
| Intent-aware (스크롤/input 감지) | scroll/focusin 이벤트 리스너 | 95% |
| Smart Exclusion (overflow-x, iframe) | DOM 속성 분석 | 90% |
| 제스처 피드백 (아이콘 0.3초) | Shadow DOM 오버레이 | 95% |
| 제스처 커스터마이징 (설정 앱) | Flutter UI → App Groups → JS 설정 동기화 | 90% |
| 구독 결제 ($0.99/월) | StoreKit 2 | 95% |
| Gesture Preview Mode | Canvas 또는 SVG로 경로 시각화 | 85% |

### 2.2 구현 주의 기능 (Yellow)

| 기능 | 제약 | 대안 |
|------|------|------|
| **Two Finger Flick Down (전체화면)** | `requestFullscreen()`은 사용자 직접 트리거 필요. Extension에서 동작 불확실 | Safari 도구 모음 숨기기로 대체 (scroll down 트리거) |
| **Quick Action - 공유** | `navigator.share()` API 사용 가능하나 Extension 컨텍스트에서 제한적 | URL 복사 + 공유 시트 시도 |
| **Quick Action - 스크린샷** | `html2canvas` 가능하나 크로스 오리진 이미지 제한 | 현재 뷰포트만 캡처 |
| **Quick Action - 번역** | 외부 번역 API 필요 (Safari 내장 번역 트리거 불가) | Google/DeepL API 연동 또는 제거 |
| **Floating Button 트리플탭** | 탭 전체 보기 직접 트리거 API 없음 | Extension popup에서 탭 목록 표시로 대체 |
| **햅틱 피드백** | Content Script (JS)에서 직접 불가. `navigator.vibrate()`는 iOS Safari 미지원 | 시각적 피드백으로 대체 |

### 2.3 구현 불가 기능 (Red) → 대안 필요

| 원래 기능 | 불가 사유 | 대안 |
|----------|----------|------|
| **Double Tap → 주소창 포커스** | Safari 주소창 제어 API 없음 | Double Tap → 페이지 내 검색 바 표시 (자체 구현) 또는 URL 복사 |
| **Quick Action - 북마크** | `browser.bookmarks` API iOS Safari 미지원 | 자체 북마크 시스템 (`browser.storage.local` 기반) |
| **Quick Action - 읽기 모드** | Safari Reader Mode 프로그래밍 트리거 불가 | 자체 읽기 모드 구현 (본문 추출 + 클린 레이아웃) |

---

## 3. UX 설계 (화면 플로우)

### 3.1 앱 화면 구조

```
App Launch
  │
  ├─ [최초 실행] → Onboarding Flow
  │   ├── Page 1: 앱 소개 + 슬로건
  │   ├── Page 2: Safari Extension 활성화 가이드
  │   ├── Page 3: 제스처 인터랙티브 튜토리얼
  │   ├── Page 4: Floating Button 소개
  │   └── Page 5: 구독 안내 (Free Trial)
  │
  └─ [이후 실행] → Main Settings Screen
      ├── Extension 상태 카드 (활성/비활성)
      ├── 제스처 목록 (활성화/비활성화 토글)
      │   └── 탭 → Gesture Detail Screen
      │       ├── 제스처 ↔ 기능 매핑 변경
      │       ├── 민감도 슬라이더
      │       └── 제스처 연습 모드
      ├── Floating Button 설정
      │   ├── 위치 (좌/우)
      │   ├── 크기 (소/중/대)
      │   └── 불투명도 슬라이더
      ├── Smart Exclusion 관리
      │   ├── 자동 감지 규칙 토글
      │   └── 사이트별 예외 목록
      ├── 사용 통계 대시보드
      │   ├── 주간 제스처 사용 차트
      │   ├── 가장 많이 사용한 제스처 Top 3
      │   └── 절약 시간 추정
      └── 구독 관리
          ├── 현재 상태
          ├── 구독/복원 버튼
          └── 기능 비교 (무료 vs 프리미엄)
```

### 3.2 무료/유료 기능 분리

| 기능 | 무료 | 유료 ($0.99/월) |
|------|------|----------------|
| Mid-Back/Forward 스와이프 | O | O |
| Floating Button (싱글탭만) | O | O |
| V/L Shape 제스처 | X | O |
| Double Tap / Long Press | X | O |
| Two Finger Flick | X | O |
| Floating Button 전체 기능 | X | O |
| Quick Action Layer | X | O |
| 제스처 커스터마이징 | X | O |
| Smart Exclusion 세부 설정 | X | O |
| 사이트별 프로필 | X | O |
| 사용 통계 | 기본 | 상세 |

### 3.3 예외 UX 상태

| 상태 | 처리 |
|------|------|
| Extension 비활성화 | 메인 화면 상단에 경고 배너 + 설정 이동 버튼 |
| 구독 만료 | Grace Period 3일 → 이후 무료 기능으로 자동 전환. 앱 진입 시 갱신 안내 |
| 오프라인 | 로컬 캐시 기반 구독 확인. 번역 기능 비활성화 |
| 제스처 실패 | 시각적 피드백 (빨간 X 아이콘 0.3초) |
| 제스처 성공 | 시각적 피드백 (녹색 체크 + 기능 아이콘 0.3초) |
| 빈 상태 (탭 복구할 것 없음) | 토스트 메시지 "복구할 탭이 없습니다" |
| Floating Button 숨김 | 숨겨진 쪽 가장자리 스와이프로 복원 |

---

## 4. 프로젝트 디렉토리 구조

```
swift_safari_gesture/
├── lib/                              # Flutter (Dart)
│   ├── main.dart
│   ├── app.dart
│   ├── core/
│   │   ├── constants/
│   │   ├── theme/
│   │   └── utils/
│   │       ├── platform_channel.dart
│   │       └── app_group_bridge.dart
│   ├── features/
│   │   ├── onboarding/
│   │   ├── settings/
│   │   ├── subscription/
│   │   ├── tutorial/
│   │   └── stats/
│   └── shared/widgets/
│
├── ios/
│   ├── Runner/                       # Flutter 앱 타겟
│   │   └── Channels/                 # MethodChannel 핸들러
│   │       ├── StoreKitChannel.swift
│   │       ├── AppGroupChannel.swift
│   │       └── ExtensionStatusChannel.swift
│   ├── SwiftSafariExtension/        # Safari Extension 타겟
│   │   ├── SafariWebExtensionHandler.swift
│   │   └── Resources/
│   │       ├── manifest.json
│   │       ├── content/
│   │       ├── background/
│   │       └── icons/
│   └── Shared/                       # 앱↔Extension 공유 코드
│       ├── AppGroupConstants.swift
│       └── SubscriptionStatus.swift
│
├── safari_extension_src/             # TypeScript 소스
│   ├── package.json
│   ├── tsconfig.json
│   ├── rollup.config.js
│   ├── src/
│   │   ├── content/
│   │   │   ├── index.ts
│   │   │   ├── gesture/             # 제스처 엔진
│   │   │   ├── ui/                   # FloatingButton, HUD
│   │   │   ├── intent/               # Intent-aware
│   │   │   ├── exclusion/            # Smart Exclusion
│   │   │   └── config/               # 설정 브릿지
│   │   ├── background/
│   │   └── popup/
│   └── tests/
│
├── assets/                           # Flutter 에셋
├── scripts/                          # 빌드 스크립트
├── pubspec.yaml
├── Makefile
├── ARCHITECTURE.md                   # 이 문서
├── Tasklist.md
└── process.md
```

---

## 5. 구현 단계 (Implementation Phases)

### Phase 0: 프로젝트 초기 설정 (1-2일)
- [ ] Flutter 프로젝트 생성 (`flutter create --org com.swift swift_safari_gesture`)
- [ ] Xcode에서 Safari Web Extension 타겟 추가
- [ ] App Groups 설정 (`group.com.swift.app`)
- [ ] TypeScript 빌드 환경 설정 (Rollup + Vitest)
- [ ] Git 구조 확정 및 .gitignore
- [ ] CI/CD 파이프라인 기본 설정

### Phase 1: 핵심 제스처 엔진 (3-5일)
- [ ] TouchTracker (좌표 수집, Ring Buffer)
- [ ] VectorAnalyzer (방향 벡터 계산)
- [ ] ShapeDetector (V/L Shape 인식)
- [ ] TapDetector (싱글/더블/트리플)
- [ ] 제스처 상태 머신 (IDLE → DETECTING → RECOGNIZED → COOLDOWN)
- [ ] IntentDetector (스크롤/input/idle 감지)
- [ ] 단위 테스트 작성 (목표: 커버리지 90%+)

### Phase 2: Safari Extension 기본 통합 (2-3일)
- [ ] manifest.json 구성
- [ ] content script ↔ background script 메시지 통신
- [ ] background script: 탭 관리 (닫기, 복구, 네비게이션)
- [ ] SafariWebExtensionHandler: 네이티브 메시지 핸들러
- [ ] App Groups를 통한 설정 읽기
- [ ] 실제 디바이스에서 기본 제스처 테스트

### Phase 3: Floating Button & HUD (2-3일)
- [ ] Shadow DOM 기반 Floating Button 렌더링
- [ ] 드래그 (CSS transform + rAF 배칭)
- [ ] 탭 인식 (싱글/더블/트리플 + cooldown)
- [ ] Edge 자동 숨김 + 가장자리 복원
- [ ] Quick Action HUD 구현
- [ ] 제스처 피드백 오버레이

### Phase 4: Smart Exclusion & 고급 기능 (2-3일)
- [ ] overflow-x 감지
- [ ] iframe 내부 비활성화
- [ ] 사이트별 예외 규칙
- [ ] 제스처 충돌 회피 (Safari 네이티브 제스처와 영역 분리)
- [ ] Gesture Preview Mode
- [ ] 화면 크기별 threshold 적응

### Phase 5: Flutter 컨테이너 앱 (4-5일)
- [ ] 앱 테마 및 디자인 시스템
- [ ] 온보딩 플로우 (5페이지)
- [ ] 메인 설정 화면
- [ ] 제스처 구성 화면 (매핑 변경, 민감도)
- [ ] Floating Button 설정 화면
- [ ] Smart Exclusion 관리 화면
- [ ] 제스처 튜토리얼/연습 모드
- [ ] MethodChannel 브릿지 구현

### Phase 6: 구독 결제 시스템 (2-3일)
- [ ] StoreKit 2 네이티브 구현
- [ ] MethodChannel 연동
- [ ] Flutter Paywall UI
- [ ] 구독 상태 → App Groups 동기화
- [ ] Extension에서 구독 상태 확인 + Grace Period
- [ ] 무료/유료 기능 분기 처리

### Phase 7: 사용 통계 & 문서화 (1-2일)
- [ ] 제스처 이벤트 카운트 로컬 저장
- [ ] Flutter 통계 대시보드 UI (주간 차트)
- [ ] 다국어 지원 (한국어, 영어)
- [ ] README 및 App Store 설명 작성
- [ ] Privacy Manifest 작성

### Phase 8: QA & 최적화 (3-5일)
- [ ] 성능 프로파일링 (Safari Web Inspector)
- [ ] KPI 검증 (초기화 <5ms, 핸들러 <1ms, idle CPU 0%)
- [ ] 10대 웹사이트 호환성 테스트
- [ ] 디바이스 매트릭스 테스트 (SE~Pro Max)
- [ ] iOS 버전 호환성 (17.x, 18.x)
- [ ] 메모리 누수 체크 (1시간 연속 사용)
- [ ] App Store 리뷰 가이드라인 최종 점검
- [ ] 접근성 (VoiceOver, Dynamic Type, 왼손잡이 모드)

---

## 6. 제스처 인식 알고리즘 사양

### 6.1 인식 영역 정의

```
Screen Width = W, Screen Height = H

Edge Zone:    0 ~ W*0.12 (좌), W*0.88 ~ W (우)
Center Zone:  W*0.12 ~ W*0.88 (제스처 인식 활성 영역)

Thresholds (화면 비율 기반, min/max clamp):
  - Swipe 최소 거리: max(60pt, W*0.15)
  - V/L Shape 세그먼트 최소 거리: max(50pt, W*0.13)
  - Edge 숨김 영역: min(30pt, W*0.08)
```

### 6.2 제스처별 인식 조건

| 제스처 | 시작 영역 | 판별 조건 | Cooldown |
|--------|----------|----------|----------|
| Mid-Back | Center Zone | 우→좌 수평 스와이프, 거리 ≥ 80pt, 수직 편차 < 50pt | 300ms |
| Mid-Forward | Center Zone | 좌→우 수평 스와이프, 거리 ≥ 80pt, 수직 편차 < 50pt | 300ms |
| V Shape | Center Zone | 2세그먼트, 꺾임각 30°~90°, 각 세그먼트 ≥ 60pt, 200~800ms | 500ms |
| L Shape | Center Zone | 2세그먼트, 꺾임각 75°~105°, 수직 ≥ 80pt, 수평 ≥ 60pt, 300~1000ms | 500ms |
| Double Tap | Center Zone | 두 탭 간격 < 300ms, 위치 차이 < 20pt | 400ms |
| Long Press | Center Zone | 이동 < 10pt, 지속 ≥ 700ms | 500ms |
| Two Finger Flick | Center Zone | 두 손가락 방향 차이 < 30°, 속도 > 400px/s | 600ms |

### 6.3 상태 머신

```
IDLE → [touch start] → DETECTING → [threshold met] → RECOGNIZED → COOLDOWN → IDLE
                            ↓ [intent: scrolling/input]           ↑
                         SUPPRESSED ─────────────────────────────┘
                            ↓ [idle detected]
                           IDLE
```

---

## 7. 성능 목표 (KPI)

| 지표 | 목표 | 실패 기준 |
|------|------|----------|
| Content script 초기화 | < 5ms | > 16ms |
| idle 상태 CPU | 0% | > 1% |
| touchmove 핸들러 | < 1ms | > 4ms |
| 제스처 인식 (end→결과) | < 0.5ms | > 5ms |
| HUD 표시 | < 50ms | > 100ms |
| Floating Button 드래그 FPS | 60fps | < 45fps |
| 메모리 (idle) | < 3MB | > 10MB |
| 메모리 (active) | < 5MB | > 15MB |
| 1시간 후 메모리 증가 | < 0.5MB | > 2MB |
| 배터리 영향 (1시간) | < 1% | > 3% |

---

## 8. 리스크 대응 전략

### 최우선 리스크 Top 5

| # | 리스크 | 심각도 | 대응 |
|---|--------|--------|------|
| 1 | Flutter 빌드가 Extension Target 파괴 | 높음 | Podfile post_install hook으로 보호, CI에서 매 빌드 검증 |
| 2 | Safari 네이티브 제스처 충돌 | 높음 | Center Zone 한정 인식, 실기기 프로토타입 우선 검증 |
| 3 | App Store 4.2 거부 (최소 기능성) | 높음 | Container App에 충분한 독립 기능 (설정, 튜토리얼, 통계) 구현 |
| 4 | Two Finger Flick ↔ Pinch-to-Zoom 구분 실패 | 높음 | distance_ratio 기반 판별 PoC, 실패 시 기능 제거 |
| 5 | 구독 상태 동기화 지연 | 중간 | App Groups + Grace Period 3일 + 다층 확인 시스템 |

---

## 9. 팀원별 추가 아이디어 (채택)

| 출처 | 아이디어 | 채택 여부 |
|------|---------|----------|
| Teammate 1 | TypeScript로 Extension 개발 | **채택** |
| Teammate 1 | Ring Buffer 좌표 저장 | **채택** |
| Teammate 3 | 제스처 커스터마이징 (리매핑) | **채택** (유료 기능) |
| Teammate 3 | 사용 통계 대시보드 | **채택** (Phase 7) |
| Teammate 3 | 사이트별 제스처 프로필 | **채택** (유료 기능) |
| Teammate 3 | 왼손잡이 모드 | **채택** (접근성) |
| Teammate 4 | Passive/Active 하이브리드 리스너 | **채택** |
| Teammate 4 | Shadow DOM UI 격리 | **채택** |
| Teammate 4 | AbortController 일괄 리스너 관리 | **채택** |
| Teammate 4 | Web Worker 제스처 오프로드 | **Phase 3 검토** |
| Teammate 4 | 적응형 쓰로틀링 (30Hz/60Hz) | **채택** |
| Teammate 2 | 자체 북마크/읽기모드 구현 | **채택** (대안) |
| Teammate 2 | Privacy Manifest 필수 포함 | **채택** |
| Teammate 2 | 제스처 상태 머신 + Cooldown | **채택** |
