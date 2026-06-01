/**
 * provider-env.ts
 *
 * Child process env allowlist 구성 유틸리티.
 * provider child process는 부모 env를 그대로 상속하지 않고
 * 이 함수가 반환하는 명시적 allowlist env만 받는다.
 */

/**
 * 모든 provider가 공통으로 받는 base env keys.
 *
 * `USERPROFILE`은 process.env에 존재할 때만 전달된다(buildProviderEnv가
 * undefined 값을 제외). macOS/Linux에서는 보통 설정되지 않아 그대로 빠지므로
 * 무해하며, child CLI가 home 디렉토리를 해석할 때 `HOME`이 비어 있는 환경에서도
 * provider OAuth/session 파일 경로 해석이 끊기지 않도록 allowlist에 포함한다.
 */
const BASE_ENV_KEYS: readonly string[] = ['PATH', 'HOME', 'USERPROFILE', 'TMPDIR', 'LANG', 'TERM'];

/**
 * provider child process에 전달할 env 객체를 구성한다.
 *
 * @param authEnvKeys provider별 인증에 필요한 env key 목록
 *   예) Gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS']
 *       Codex:  ['OPENAI_API_KEY']
 * @returns 현재 process.env에서 allowlist key만 추출한 env 객체.
 *   key가 process.env에 없으면 포함하지 않는다.
 */
export function buildProviderEnv(authEnvKeys: string[]): NodeJS.ProcessEnv {
  const allowed = [...BASE_ENV_KEYS, ...authEnvKeys];
  const env: NodeJS.ProcessEnv = {};
  for (const key of allowed) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
    }
  }
  return env;
}
