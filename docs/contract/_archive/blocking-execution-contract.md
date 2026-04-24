# Blocking 실행 계약

**상태:** 규범
**Phase:** A (`runtime-contract.md`, `session-schema.md`, `ccg-parity-checklist.md` 대체)
**참조:** `reference/ccg-workflow/codeagent-wrapper/executor.go`

---

## 1. 실행 모델

`aco run`은 **동기적이며 blocking**된다.

```
Claude Code slash command
  │ bash dispatch
  ▼
aco run <provider> <command>    ← provider 종료까지 차단
  │ stdout을 호출자에게 직접 스트리밍
  │ 실행 중 exec.Cmd를 메모리에서 소유
  ▼
provider 완료 또는 취소 시 종료
```

daemon, session registry, IPC는 없다.
`aco cancel`, `aco status`, `aco result`도 없다.

---

## 2. Signal 처리

`aco run`이 OS 또는 Claude Code에서 SIGTERM이나 SIGINT를 받으면:

1. `syscall.Kill(-pgid, syscall.SIGTERM)`으로 provider **process group**에 `SIGTERM` 전달
2. `time.AfterFunc(forceKillDelay, func() { syscall.Kill(-pgid, syscall.SIGKILL) })` 시작
3. provider 종료 대기

process group을 사용하면 Node.js CLI 같은 provider가 worker 또는 child process를 생성해도 전체 tree를 종료할 수 있다. 이로써 고아 프로세스가 pipe를 열린 상태로 유지해 `cmd.Wait()`를 막는 상황을 방지한다.

**참조 구현 패턴:**

```go
// 1. 새 process group으로 command 준비
cmd := exec.Command(binary, args...)
cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true} // Provider가 PGID leader가 됨

// 2. PID(PGID와 동일)를 얻기 위해 process 시작
if err := cmd.Start(); err != nil {
    return err
}
pgid := cmd.Process.Pid

// 3. 전체 group에 signal 전달
sigCh := make(chan os.Signal, 1)
signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
defer signal.Stop(sigCh)

go func() {
    sig, ok := <-sigCh
    if !ok {
        return
    }
    // process group에 SIGTERM 전송 (negative PID)
    _ = syscall.Kill(-pgid, syscall.SIGTERM)

    // fallback으로 SIGKILL 예약
    time.AfterFunc(5 * time.Second, func() {
        _ = syscall.Kill(-pgid, syscall.SIGKILL)
    })
}()

// 4. 완료 대기
err := cmd.Wait()
```

**Force-kill delay:** 5초 (ccg-workflow 기본값, `main.go:67`).

**`cmd.WaitDelay` 참고:** ccg-workflow는 `cmd.WaitDelay`를 사용하지 않는다.
Phase B에서는 `cmd.WaitDelay`가 필요한지 또는 제거해야 하는지 검증해야 한다.
`AfterFunc` 패턴과 동등하다고 가정하지 않는다.

---

## 3. Timeout

context timeout은 전체 실행을 감싼다:

```go
ctx, cancel := context.WithTimeout(ctx, time.Duration(timeoutSecs)*time.Second)
defer cancel()
```

deadline 도달 시 `terminateCommand` 패턴이 SIGTERM → AfterFunc SIGKILL을 보낸다.

**참조:** `executor.go:966-967`, `executor.go:1431-1467`

기본 timeout은 300초이며, `--timeout` 또는 `ACO_TIMEOUT_SECONDS`로 설정할 수 있다.

---

## 4. Process 소유권

- `exec.Cmd`는 `Run` 함수 scope 안에서 생성되고 소유된다.
- process handle (`*os.Process`)은 실행 중 메모리에 유지된다.
- cancellation은 저장된 PID가 아니라 live `proc` reference를 직접 사용한다.
- PID는 디스크에 쓰지 않는다. `task.json`은 없다.

**참조:** `executor.go:975` — cmd는 local variable
**참조:** `executor.go:1451` — live handle에 `proc.Signal(syscall.SIGTERM)` 호출

---

## 5. 출력

- Provider stdout은 `aco run`의 stdout으로 직접 스트리밍된다.
- `output.log` 파일은 없다.
- `~/.aco/sessions/` 디렉터리는 없다.
- tee는 없다. 출력은 호출자의 stdout 한 곳으로만 간다.

**참조:** `executor.go:1032-1038` — stdout pipe, single consumer

---

## 6. 종료 분류

| Provider 종료 | `aco run` exit code | 에러 타입 |
|--------------|---------------------|------------|
| Exit 0 | 0 | — |
| 0이 아닌 종료 (인증 아님) | 1 | `*provider.ExitError` |
| 인증 실패 (provider별 heuristic) | 1 | `*provider.AuthError` |
| Context timeout | 1 | `*provider.TimeoutError` |
| Signal 종료 | 1 | `*provider.SignalError` |
| Binary 없음 | 1 | `*provider.NotFoundError` |

---

## 7. 존재하지 않는 것

다음 항목은 명시적으로 존재하지 않는다:

| 제거된 항목 | 이유 |
|---------|-----|
| `aco cancel` | cancel은 OS SIGTERM이 `aco run`에 직접 전달되는 방식으로 처리 |
| `aco status` | async state 없음. 실행은 blocking |
| `aco result` | log file 없음. 출력은 inline stream |
| `~/.aco/sessions/` | session persistence 없음 |
| `task.json` | session schema 없음 |
| PID file | cancellation은 저장된 PID가 아니라 live proc handle 사용 |
| Supervisor daemon | 장기 실행 프로세스 불필요 |
| Unix domain socket IPC | cross-process coordination 불필요 |

---

## 8. Phase B 구현 대상

Phase B는 `internal/runner/process.go`와 `cmd/aco/cmd_run.go`를 다시 작성해 다음을 반영해야 한다:

| 함수 | 참조 위치 |
|----------|--------------------|
| `forwardSignals` | `executor.go:1322-1358` |
| `terminateCommand` | `executor.go:1431-1467` |
| 메인 실행 루프 | `executor.go:966-1319` |

구현은 local invention이 아니라 참조 구현의 copy임을 알아볼 수 있어야 한다.

---

*ccg-workflow copy. 새 발명 없음. Blocking model. OS가 cancel 처리.*
