# SlideShow

사진과 영상을 올리면 해리포터의 마법 신문처럼 **사진이 살아 움직이는 무대**를 카메라가 여행하는 기념일 영상(돌잔치·생일·결혼)이 자동으로 만들어지는 웹앱. 파일은 브라우저 밖으로 나가지 않고, 결과물은 MP4로 내보낸다.

- 기획: [docs/PLAN.md](docs/PLAN.md)
- 연출 장치 카탈로그: [docs/DEVICES.md](docs/DEVICES.md)
- 배포: GitHub Pages (`main` 푸시 시 자동)

## 개발

```bash
npm install
npm run dev        # http://localhost:5173/SlideShow/
npm run check      # lint + format + typecheck + test
npm run build
```

`/#/lab` 에서 연출 장치 실험실을 볼 수 있다.

## 스택

Vite · React · TypeScript · Tailwind · three.js / React Three Fiber · Zustand · IndexedDB · WebCodecs
