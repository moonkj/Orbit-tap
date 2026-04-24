# Tasklist - Orbit Tap Safari Gesture Control Extension

> 리더 및 모든 Teammate가 공동으로 추적하는 진행상황 문서

## 팀 상태
| 역할 | 상태 | 현재 작업 |
|------|------|-----------|
| **리더 (Architect/UX)** | 완료 | 아키텍처 설계 및 구현 플랜 작성 완료 |
| **Teammate 1 (Coder)** | 완료 | 기술 스택 조사 및 프로젝트 구조 제안 완료 |
| **Teammate 2 (Debugger)** | 완료 | 기술 리스크 및 엣지케이스 분석 완료 (Top 5 리스크 식별) |
| **Teammate 3 (Tester/Reviewer)** | 완료 | 사양 완전성 검토, 17개 테스트 케이스, 12개 유저 시나리오 정의 |
| **Teammate 4 (Perf/Doc)** | 완료 | 성능 KPI 정의, 최적화 전략 수립 |

## Phase 0: 프로젝트 초기 설정
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 0.1 | Flutter 프로젝트 생성 | Coder | 대기 | `flutter create --org com.swift` |
| 0.2 | Xcode Safari Web Extension 타겟 추가 | Coder | 대기 | |
| 0.3 | App Groups 설정 | Coder | 대기 | `group.com.swift.app` |
| 0.4 | TypeScript 빌드 환경 (Rollup + Vitest) | Coder | 대기 | |
| 0.5 | Git 구조 확정 및 .gitignore | Leader | 대기 | |

## Phase 1: 핵심 제스처 엔진
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 1.1 | TouchTracker (좌표 수집, Ring Buffer) | Coder | 대기 | |
| 1.2 | VectorAnalyzer (방향 벡터 계산) | Coder | 대기 | |
| 1.3 | ShapeDetector (V/L Shape) | Coder | 대기 | |
| 1.4 | TapDetector (싱글/더블/트리플) | Coder | 대기 | |
| 1.5 | 제스처 상태 머신 | Coder | 대기 | IDLE→DETECTING→RECOGNIZED→COOLDOWN |
| 1.6 | IntentDetector | Coder | 대기 | |
| 1.7 | 단위 테스트 작성 | Tester | 대기 | 목표: 커버리지 90%+ |

## Phase 2: Safari Extension 기본 통합
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 2.1 | manifest.json 구성 | Coder | 대기 | |
| 2.2 | content ↔ background 메시지 통신 | Coder | 대기 | |
| 2.3 | SafariWebExtensionHandler | Coder | 대기 | |
| 2.4 | App Groups 설정 읽기 | Coder | 대기 | |
| 2.5 | 실기기 기본 제스처 테스트 | Tester | 대기 | |

## Phase 3: Floating Button & HUD
| # | 작업 | 담당 | 상태 | 비고 |
|---|------|------|------|------|
| 3.1 | Shadow DOM Floating Button | Coder | 대기 | |
| 3.2 | 드래그 (CSS transform + rAF) | Coder | 대기 | |
| 3.3 | 탭 인식 + Edge 자동 숨김 | Coder | 대기 | |
| 3.4 | Quick Action HUD | Coder | 대기 | |
| 3.5 | 제스처 피드백 오버레이 | Coder | 대기 | |

## Phase 4-8: (상세는 ARCHITECTURE.md 참조)

## 과학적 토론 로그

### [2026-04-15] 기술 스택 결정
- **가설 A (Teammate 1)**: Flutter를 Container App으로, JS를 Extension으로 분리
- **가설 B**: 순수 Swift + JS (Flutter 제거)
- **결론**: 가설 A 채택. Flutter가 빠른 UI 개발에 유리하고, Container App은 충분한 독립 기능을 제공해야 App Store 4.2 가이드라인을 통과할 수 있음 (Teammate 2 근거)

### [2026-04-15] 기능 실현 가능성 토론
- **Teammate 2 반박**: Double Tap→주소창, 트리플탭→탭 전체보기, 읽기 모드 직접 트리거 불가
- **Teammate 3 지지**: 해당 기능들의 대안 필요. 자체 구현으로 대체 제안
- **Teammate 4 지지**: 성능 관점에서 자체 구현이 외부 API 호출보다 유리
- **리더 결정**: Red 기능 3개에 대해 대안 채택 (ARCHITECTURE.md §2.3 참조)

## 교차 레이어 변경 알림
| 일시 | 변경자 | 변경 내용 | 영향 범위 |
|------|--------|----------|-----------|
| 2026-04-15 | Leader | Double Tap 기능을 "주소창 포커스"에서 "페이지 내 검색 바"로 변경 | Content Script UI, 설정 화면 텍스트 |
| 2026-04-15 | Leader | 북마크를 자체 시스템으로 대체 | Storage 설계, 설정 화면 추가, Extension 데이터 모델 |
