## Context

`aco pack install`은 `templates/{commands,prompts,tasks}`를 `targetBase/.claude`로 복사한다. `targetBase`는 `--global`이면 `~/.claude`, 아니면 `process.cwd()/.claude`이다(`packages/wrapper/src/commands/pack-install.ts:59`). 스킬은 `templates/`에 없어 배포되지 않으며, 실제 source of truth는 `.claude/skills/`이다.

별도 메커니즘인 `aco sync`는 `repoRoot/.claude/skills/*/SKILL.md`를 READ source로 읽어 `.agents/skills/<skill>/`를 생성한다(`source-discovery.ts:31`, `skill-transform.ts`). 즉 `.claude/skills/`는 sync의 입력이다. `aco pack setup`은 한 커맨드 안에서 `packInstall()` → `runSync()`를 연쇄 호출한다(`pack-install.ts:291`→`:309`).

스킬을 `targetBase/skills/`로 단순 복사하면 non-global 실행에서 `cwd/.claude/skills/`(= sync source)를 덮어쓰고, `pack setup`이 그 자리에서 sync를 돌려 `.agents/skills/`까지 오염을 전파한다. 본 설계는 이 결합을 구조적으로 차단하면서 npx 단독 배포·갱신을 가능케 하는 방법을 정한다.

## Goals / Non-Goals

**Goals:**
- `npx ... pack install --global`만으로 큐레이션 스킬을 `~/.claude/skills/`에 설치·갱신·제거.
- `aco sync`의 read source(`.claude/skills/`)를 어떤 pack 실행도 오염시키지 않음.
- `templates/skills/` 내용이 `.claude/skills/` source와 항상 일치(드리프트 0).
- packable 목록과 sync-eligible 목록이 단일 기준에서 파생.

**Non-Goals:**
- `aco sync`의 요구사항·분류 정책 변경.
- non-global(repo-local) 스킬 설치 지원. repo 작업자는 `.claude/skills/` 원본을 그대로 쓰므로 불필요.
- `templates/{commands,prompts,tasks}` 기존 배포 동작 변경.
- Windows 지원(repo 정책상 out of scope).

## Decisions

### D1. 스킬 packing은 `--global` 전용, non-global은 skip
- 채택: `packInstall`의 스킬 복사 단계는 `options.global === true`일 때만 실행. non-global은 skip하고 `[skip] skills require --global` 로그.
- 대안 A(거부 가드): "write 대상이 sync-source repo면 throw". sync-source 판정 로직이 추가로 필요하고 false negative 위험. D1이 더 단순하고 동일 효과 → 기각.
- 근거: non-global write 자체가 사라지면 `cwd/.claude/skills/` 오염 경로와 `pack setup` 연쇄 전파가 모두 구조적으로 제거된다. `--global` write 대상 `~/.claude/skills/`는 sync read source `repoRoot/.claude/skills/`와 경로가 달라 충돌 없음(코드 확인).

### D2. `templates/skills/`는 생성물 — 생성기 + 커밋 + CI parity gate (방식 C)
- 채택: source of truth = `.claude/skills/`. 생성기 스크립트(`npm run build:skill-templates`)가 allowlist subset을 `templates/skills/`로 복사하고 결과를 커밋한다. CI가 생성기 재실행 후 `git diff --exit-code`로 parity를 강제.
- 대안 A(손유지 미러): `templates/commands ↔ .claude/commands`처럼 수동 정렬. 수동 동기화 세금이 스킬에도 반복됨 → 부분 기각(생성기로 자동화).
- 대안 B(prepack에서만 생성, 미커밋): dev install은 monorepo 루트 `templates/`를 직접 읽으므로(`findTemplatesDir` dev 분기) publish 시점 생성은 dev에서 스킬 누락 → 기각.
- 근거: 단일 source, dev/prod 모두 디스크에 존재, content parity(가드 4)와 selection parity(가드 3)를 한 메커니즘으로 통합.

### D3. packable allowlist = sync allowlist에서 파생
- 채택: 생성기가 포함할 스킬을 `.aco/sync.yaml` include + `ACO_OWNED_SKILLS` 기준으로 선별. `gh-*` 얇은 래퍼, `openspec-*`/`superpowers-*` 외부 스킬은 기본 제외.
- 근거: 두 allowlist가 따로 노는 드리프트 차단. 단일 정책 소스.
- 주의: 배포 목적(유저레벨 슬래시/스킬 UX)과 sync 목적(provider-surface 미러)이 완전히 같지 않을 수 있음 → Open Questions 참고.

### D4. manifest 계약 확장
- 채택: 설치된 스킬 파일 경로를 기존 `aco-manifest.json`의 `files`에 그대로 추가. `pack uninstall`의 manifest 기반 선택적 제거가 스킬도 자연히 처리.
- 근거: 별도 manifest 신설 불필요. 기존 선택적 제거 계약 재사용.

### D5. installer/wrapper 두 진입점 동시 반영
- 두 `pack-install.ts`(installer, wrapper)가 동일 로직을 공유하므로 스킬 복사·`--global` 가드를 양쪽에 일관 적용. 단일 헬퍼로 추출 검토.

## Risks / Trade-offs

- [생성기 미실행 상태로 스킬 편집 → 낡은 스킬 배포] → CI `git diff --exit-code` gate로 차단. 로컬 pre-commit 보조 검토.
- [allowlist 파생이 배포 의도와 어긋남(예: `aco-delegation`은 sync-eligible 아니지만 유저레벨 배포는 필요)] → D3의 단일 파생이 과도 제한일 수 있음. Open Question O1에서 결정.
- [`pack setup` non-global이 여전히 `runSync` 호출] → D1로 스킬을 안 건드리므로 sync source 불변. 단 `pack setup`의 sync 호출 자체는 기존 동작이라 유지.
- [tech-debt: parity gate가 또 하나의 CI 검사 surface 추가] → 기존 `cmp` 기반 commands parity와 동일 패턴이라 인지 부하 낮음. 생성기로 수동 단계 제거해 순 부채는 감소.
- [BREAKING-인접: 누군가 non-global pack install로 스킬이 깔리길 기대] → 현재 스킬 packing 자체가 없으므로 회귀 아님. 신규 동작.

## Migration Plan

1. 생성기 스크립트 추가 후 1회 실행 → `templates/skills/` 초기 커밋.
2. `packInstall`에 `--global` 가드 스킬 복사 + manifest 기록 추가.
3. `pack uninstall` 선택적 제거가 스킬 포함하는지 검증.
4. CI parity gate 추가.
5. `pack-runtime-contract` 테스트 확장.
- 롤백: `templates/skills/`와 생성기·가드를 되돌리면 기존 commands/prompts-only 동작으로 복귀. manifest 하위호환(스킬 없는 manifest도 정상 동작).

## Open Questions (Resolved)

- O1 (확정): sync allowlist에 **수렴**. `.aco/sync.yaml` `skills.include`에 `aco-delegation`을 추가해 packable = sync-eligible 단일 목록으로 통일. 부수효과로 `aco sync`도 `aco-delegation`을 `.agents/skills/`로 미러한다(사용자 승인). 별도 distributable 목록은 두지 않는다.
- O2 (확정): 생성기는 root `scripts/build-skill-templates.ts`, `npm run build:skill-templates`로 노출. parity 게이트는 `npm run check:skill-templates`(생성 후 `git diff --exit-code -- templates/skills`).
- O3 (확정): 이번 변경에서는 `pack status`의 스킬 표시를 추가하지 않는다(범위 밖, 필요 시 follow-up). 설치 추적은 `aco-manifest.json`으로 충분하다.
