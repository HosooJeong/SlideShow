# 기념일 슬라이드쇼 웹앱 — 기획서 (v0.1)

> 사진/동영상을 올리면 돌잔치·생일·결혼식 같은 기념일 영상 느낌으로, 자유분방한 레이아웃과 모션이 자동 생성되는 슬라이드쇼 웹앱.

---

## 1. 목표와 원칙

- **목표**: 편집 지식이 없는 사용자가 사진/영상을 던져 넣고 음악만 고르면, 3분 안에 "영상 같은" 슬라이드쇼가 나온다.
- **핵심 경험**: 정해진 격자가 아닌, 폴라로이드가 흩뿌려지고 사진이 기울어져 날아들고 컨페티가 떨어지는 **자유분방하고 따뜻한 무드**.
- **원칙**
  1. 파일은 기본적으로 **브라우저 밖으로 나가지 않는다** (가족 사진 프라이버시, 서버 비용 0).
  2. 슬라이드쇼는 **시간 t의 순수 함수**로 렌더링한다 → 재생, 시킹, 영상 내보내기가 같은 코드로 동작.
  3. "랜덤"은 **시드 기반 결정적 랜덤** → 같은 프로젝트는 항상 같은 결과, 시드만 바꾸면 "다시 섞기".

---

## 2. 사용자 플로우 (MVP)

```
[시작] → 프로젝트 만들기 (제목, 날짜, 테마, 비율)
      → 미디어 업로드 (드래그앤드롭, 사진/영상 다중)
      → 자동 생성된 슬라이드쇼 미리보기 (재생/일시정지/시킹)
      → 음악 고르기 / 자막(캡션) 손보기 / "다시 섞기"
      → MP4 내보내기 (또는 전체화면으로 그 자리에서 상영)
```

- 타겟 화면: 데스크톱 우선, 모바일(세로 9:16) 대응.
- 비율: 16:9 (TV/빔프로젝터 상영), 9:16 (인스타/릴스), 1:1 옵션.

---

## 3. 기능 범위

### MVP (반드시)
| 영역 | 기능 |
|---|---|
| 업로드 | 드래그앤드롭·파일선택, 이미지(jpg/png/heic*/webp)·영상(mp4/mov/webm), 썸네일 생성, EXIF 회전 보정, 순서 변경·삭제 |
| 프로젝트 | 제목/날짜/테마/비율 설정, IndexedDB 자동 저장(새로고침해도 유지) |
| 자동 구성 | 미디어 수·음악 길이로 씬 개수/길이 산출, 씬 타입을 시드 랜덤으로 배치 |
| 씬 템플릿 | 켄번즈(줌/팬), 폴라로이드 흩뿌리기, 콜라주(2~4장), 틸트 인/아웃, 스플릿 스크린, 타이틀 카드, 엔딩 카드 |
| 트랜지션 | 크로스페이드, 슬라이드, 줌 스루, 화이트 플래시, 종이 넘기기 느낌 |
| 장식 | 컨페티·반짝이 파티클, 손그림 프레임, 테이프/스티커, 날짜·캡션 텍스트 |
| 영상 클립 | 클립당 N초 자동 트림(기본 4초), 음소거/원음 선택 |
| 음악 | 내장 무료 BGM 몇 곡 + 사용자 mp3 업로드, 페이드 인/아웃, 음악 길이에 맞춰 전체 길이 조정 |
| 플레이어 | 재생/일시정지, 시크바, 전체화면, 키보드 단축키 |
| 테마 | 돌잔치(파스텔·핑크/민트), 생일(비비드), 결혼(아이보리·세리프), 여행(필름) — 색·폰트·장식 세트 |

\* HEIC는 `heic2any`로 변환, 실패 시 안내.

### v1.1 (MVP 다음)
- MP4 내보내기 (WebCodecs + mp4-muxer, Chrome/Edge), 미지원 브라우저는 WebM(MediaRecorder) 폴백
- 씬 단위 수동 편집: 특정 씬 템플릿 교체, 길이 조절, 캡션 편집
- 비트 감지로 음악 박자에 씬 전환 맞추기
- PWA(홈 화면 설치, 오프라인)

### v2 (나중에)
- 로그인 + 클라우드 저장 + 링크 공유 (백엔드 도입 시점)
- 서버 렌더링 내보내기(고화질·긴 영상)
- 얼굴 감지로 크롭 포커스 자동 맞추기
- 하객 사진 수집 (QR로 여러 사람이 업로드)

### 하지 않는 것 (스코프 밖)
- 범용 영상 편집기 수준의 타임라인 편집
- 실시간 협업

---

## 4. 기술 스택 (제안)

| 층 | 선택 | 이유 |
|---|---|---|
| 빌드/프레임워크 | **Vite + React 18 + TypeScript** | 빠른 개발, 생태계, 정적 배포 |
| 스타일 | Tailwind CSS | 테마 토큰 관리 쉬움 |
| 상태 | Zustand | 가볍고 IndexedDB 연동 간단 |
| 렌더 엔진 | **PixiJS v8 (WebGL/WebGPU)** | 수백 장 사진·파티클을 60fps로, 캔버스 기반이라 내보내기와 코드 공유 |
| 타임라인/이징 | GSAP (timeline, seek) 또는 자체 경량 트윈 | 시간 t로 정확히 시킹 가능 |
| 저장 | IndexedDB (`idb`) — 원본 Blob + 프로젝트 JSON | 새로고침 복원, 서버 없음 |
| 미디어 처리 | `createImageBitmap`, OffscreenCanvas 썸네일, `exifr`(회전), `heic2any` | 브라우저 네이티브 우선 |
| 오디오 | Web Audio API | 페이드, 비트 분석 |
| 내보내기 | WebCodecs `VideoEncoder` + `mp4-muxer`, 오디오는 `AudioEncoder` | 서버 없이 MP4 |
| 테스트 | Vitest + Playwright(시각 회귀 스냅샷) | 렌더는 스냅샷으로 검증 |
| 배포 | Vercel 또는 GitHub Pages (정적) | 비용 0 |

**왜 DOM/CSS 애니메이션이 아니라 캔버스인가**
DOM+Framer Motion은 만들기 빠르지만, MP4 내보내기 시 프레임 단위 캡처가 사실상 불가능(html2canvas 느리고 부정확). 캔버스 렌더러는 `render(timeline, t)` 하나로 재생과 내보내기를 다 처리한다. 대신 UI(업로드, 설정, 플레이어 컨트롤)는 React DOM으로 만든다.

---

## 5. 아키텍처

```
src/
  app/              라우팅, 레이아웃, 전역 상태
  features/
    media/          업로드, 썸네일, EXIF, IndexedDB 저장
    project/        프로젝트 CRUD, 설정 UI
    composer/       미디어 + 설정 → Timeline(씬 배열) 자동 생성 (시드 랜덤)
    renderer/       PixiJS 씬 그래프, render(timeline, t), 씬 템플릿·트랜지션·파티클
    player/         재생 루프(rAF), 시크, 오디오 동기화, 전체화면
    exporter/       프레임 루프 → VideoEncoder → mp4-muxer → 다운로드
    themes/         색·폰트·장식 에셋 세트
  shared/           유틸(seeded rng, easing), UI 컴포넌트
```

### 데이터 모델 (초안)
```ts
type MediaItem = {
  id: string; kind: 'image' | 'video';
  blobKey: string;            // IndexedDB 키
  width: number; height: number; duration?: number;
  thumbUrl: string; orientation: number; takenAt?: string;
};

type Project = {
  id: string; title: string; date?: string;
  theme: 'doljanchi' | 'birthday' | 'wedding' | 'travel';
  aspect: '16:9' | '9:16' | '1:1';
  seed: number;
  media: MediaItem[];
  music?: { blobKey: string; volume: number; fadeIn: number; fadeOut: number };
  overrides: Record<string, Partial<Scene>>;  // 사용자가 손댄 씬만 기록
};

type Scene = {
  id: string;
  type: 'title' | 'kenburns' | 'polaroid' | 'collage' | 'tilt' | 'split' | 'video' | 'ending';
  mediaIds: string[];
  start: number; duration: number;   // 초
  transitionIn: Transition;
  params: Record<string, number | string>;  // 템플릿별 파라미터(줌 방향, 기울기 등)
  caption?: string;
};

type Timeline = { scenes: Scene[]; totalDuration: number };
```

### 핵심 루프
```
composer(project) ─→ timeline
player:   rAF 마다 t = audio.currentTime → renderer.render(timeline, t)
exporter: for f in 0..frames: t = f/fps → renderer.render(timeline, t) → encoder.encode(frame)
```

- 영상 클립은 `<video>`를 텍스처로 사용. 재생 시엔 자연 재생, 내보내기 시엔 `currentTime` 시크 후 `seeked`를 기다려 프레임 확정(느리지만 정확). 나중에 WebCodecs `VideoDecoder`로 교체.
- 내보내기 중엔 UI를 막고 진행률 표시. 30fps·1080p 기준 3분 영상이면 수 분 소요 예상.

---

## 6. 씬 템플릿 설계 메모 ("자유분방함"의 실체)

- **폴라로이드 흩뿌리기**: 3~5장이 화면 밖에서 회전하며 날아와 겹치게 착지. 각 장 회전 -12°~+12°, 착지 위치는 시드 랜덤. 마지막 한 장이 살짝 튀며 강조.
- **켄번즈**: 얼굴/중앙 기준(우선은 중앙) 시작·끝 프레임을 랜덤 배치, 줌 1.0→1.15 또는 반대.
- **콜라주**: 2~4장을 비정형 그리드(살짝 어긋난 틸트)로, 순차 팝인.
- **틸트 인**: 한 장이 큰 회전+스케일로 등장 → 정지 → 손그림 프레임·테이프 오버레이.
- **타이틀/엔딩 카드**: 테마 폰트로 이름·날짜, 파티클 배경.
- **파티클**: 컨페티(돌잔치·생일), 꽃잎(결혼), 필름 그레인(여행). 전 씬에 얕게 깔린다.
- 연속 씬에 같은 템플릿이 오지 않도록 컴포저에서 가중 랜덤 + 직전 타입 배제.

---

## 7. 개발 단계 (마일스톤)

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| **0. 셋업** | Vite+React+TS+Tailwind, ESLint/Prettier, Vitest, CI, 배포 파이프라인 | `main` 푸시 → 자동 배포되는 빈 앱 |
| **1. 미디어** | 업로드, 썸네일, EXIF, IndexedDB 저장·복원, 정렬/삭제 | 새로고침 후 미디어 그대로 남음 |
| **2. 렌더 엔진 + 플레이어** | PixiJS 캔버스, `render(timeline, t)`, 켄번즈+크로스페이드 1종, 재생/시크 | 사진 10장이 영상처럼 끊김 없이 재생 |
| **3. 컴포저 + 템플릿** | 시드 랜덤 컴포저, 씬 템플릿 6종, 트랜지션 4종, 파티클, 타이틀/엔딩 | "다시 섞기"로 매번 다른 구성 |
| **4. 음악 + 테마 + 설정 UI** | BGM 업로드/내장, 페이드, 길이 맞춤, 테마 4종, 캡션 편집 | 음악 끝과 엔딩 카드가 맞아떨어짐 |
| **5. 영상 클립** | 비디오 텍스처, 자동 트림, 음소거 옵션 | 사진·영상 섞인 프로젝트 재생 |
| **6. 내보내기** | WebCodecs MP4, WebM 폴백, 진행률 | 1080p MP4 다운로드해 폰에서 재생 |
| **7. 폴리싱** | 모바일 레이아웃, PWA, 접근성, 온보딩, 에러 처리 | 지인 돌잔치 영상 1편 실제 제작 |

각 단계는 PR 1~3개 단위로 쪼개고, 단계 끝마다 배포된 데모로 확인.

---

## 8. 리스크와 대응

| 리스크 | 대응 |
|---|---|
| 대용량 사진 수백 장 → 메모리 | 업로드 시 표시용으로 최대 2048px 리사이즈 저장, 원본은 선택 보관 |
| HEIC(아이폰) 호환 | `heic2any` 변환, 실패 시 "설정 → 카메라 → 호환성 우선" 안내 |
| iOS Safari 제약 (WebCodecs 부분 지원, IndexedDB 용량, 자동재생) | 재생은 전 브라우저 지원, 내보내기는 Chrome/Edge 권장 표시 |
| 영상 클립 시크 느림 | 내보내기 시에만 프레임 정확 모드, 재생 시엔 자연 재생 |
| 폰트 라이선스 | Pretendard, 나눔 계열 등 OFL 폰트만 사용 |
| BGM 저작권 | 내장곡은 CC0/직접 제작, 사용자 업로드곡은 사용자 책임 고지 |

---

## 9. 결정 필요 사항 (열린 질문)

1. **백엔드 없이 시작** (브라우저 전용)으로 가도 되는지 — 추천: 예. 공유는 v2에서.
2. **MP4 내보내기가 MVP 필수인지**, 아니면 웹에서 상영만 되면 되는지 — 이 답이 6단계 우선순위를 정함.
3. **프레임워크 선호**: React 괜찮은지 (Vue/Svelte 선호 있으면 지금 말해줘).
4. **주 타겟 기기**: 노트북에서 만들고 TV로 상영? 폰에서 만들고 인스타에 올림? — 기본 비율과 UI 우선순위가 갈림.
5. **첫 테마**: 돌잔치 하나만 제대로 만들고 확장? 아니면 4종을 얕게 동시에?
6. **배포 위치**: Vercel / GitHub Pages / 기타.
