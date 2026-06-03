## 1. Allowlist 결정 (Open Question O1)

- [x] 1.1 packable 목록을 sync allowlist에 **수렴**하기로 확정(별도 목록 없음). design.md O1에 기록
- [x] 1.2 초기 큐레이션 = `.aco/sync.yaml` include: `github-kanban-ops`, `improve-codebase-architecture`, `aco-delegation`. `gh-*`/`openspec-*`/`superpowers-*`는 exclude로 제외

## 2. 스킬 템플릿 생성기 (방식 C)

- [x] 2.1 `scripts/build-skill-templates.ts` 추가: `loadSyncConfig`의 include subset을 `.claude/skills/` → `templates/skills/`로 clean-regenerate 복사
- [x] 2.2 `package.json`에 `build:skill-templates` + `check:skill-templates` 스크립트 노출, 멱등 재실행 확인(parity gate 통과)
- [x] 2.3 생성기 실행 → `templates/skills/{aco-delegation,github-kanban-ops,improve-codebase-architecture}` 산출물 커밋 대상화(11 files)
- [x] 2.4 `files: ["dist","templates"]` + `prepack` cpSync가 `templates/` 전체(=skills 포함) 동봉함을 확인

## 3. pack install 스킬 복사 (--global 전용 가드)

- [x] 3.1 `skillsSrc = join(TEMPLATES_DIR,'skills')`, `skillsDest = join(targetBase,'skills')` 정의 (wrapper + installer)
- [x] 3.2 `packInstall`에 `options.global`일 때만 skill copyTree, non-global은 skip + 로그
- [x] 3.3 `--force` 덮어쓰기 / 미지정 시 파일 단위 skip이 skill 경로에도 적용됨(copyTree 공유 로직)
- [x] 3.4 wrapper(공개 npx 경로) + installer(@internal/legacy) 양쪽에 동일 가드 적용

## 4. manifest 및 uninstall

- [x] 4.1 skill 파일이 공유 `installedFiles` 배열을 통해 `aco-manifest.json`에 기록됨(테스트로 확인)
- [x] 4.2 `pack uninstall`의 manifest 기반 선택적 제거가 skill 포함, manifest 외 파일 보존(테스트로 확인)
- [x] 4.3 skill 없는 구버전 manifest 하위호환(기존 20개 pack 테스트 + 363개 스위트 전부 통과)

## 5. CI parity gate

- [x] 5.1 ci.yml `contract` job에 `npm run check:skill-templates` 추가(생성기 재실행 + `git diff` 드리프트 차단)
- [x] 5.2 verify.sh FAST 게이트에 동일 검사 추가(pre-push 로컬 차단), contract 단계와 병기

## 6. 테스트 (testing-strategy)

- [x] 6.1 `--global` 설치 → `~/.claude/skills/aco-delegation/SKILL.md` 존재 + manifest 기록 검증
- [x] 6.2 non-global `pack install`이 `<cwd>/.claude/skills`를 만들지 않음(commands는 설치됨) 검증
- [x] 6.3 non-global `pack setup` 전후 sync source(`.claude/skills/local-only`) byte 불변 + template skill 미주입 검증
- [x] 6.4 `--force` 덮어쓰기 / 미지정 skip 동작(공유 copyTree, 기존 테스트로 커버)
- [x] 6.5 `pack uninstall --global`이 manifest 기록 skill만 제거 검증
- [x] 6.6 생성기 멱등성·allowlist 제외는 `check:skill-templates` parity gate(end-to-end 재현)로 커버. 별도 단위 테스트는 중복이라 생략

## 7. 문서 및 정합

- [x] 7.1 `docs/reference/context-sync.md`: `templates/skills`(배포) vs `.agents/skills`(sync) 별개 표면 + `--global` 가드 명시
- [x] 7.2 CLAUDE.md Maintenance Rules에 `templates/skills` 생성기·parity 규칙 추가
- [x] 7.3 README에 `pack install --global`이 skill까지 배포함을 반영

## 8. 검증

- [x] 8.1 wrapper full suite 363 통과, `typecheck`(wrapper+installer), `test:fixtures` 5, smoke boot, `format:check` 통과
- [x] 8.2 `openspec validate pack-install-skills-packing --strict` 통과
- [x] 8.3 로컬 smoke로 build+boot 확인. 실제 npm tarball install dry-run은 CI `smoke` job(npm pack→install→boot)이 수행
