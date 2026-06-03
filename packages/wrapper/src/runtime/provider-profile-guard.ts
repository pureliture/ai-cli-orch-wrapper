import type { IProvider, PermissionProfile } from '../providers/interface.js';

/**
 * Provider가 특정 permission profile을 지원하는지 확인한다.
 *
 * IProvider에 optional `supportsPermissionProfile(profile)` 메서드가 있으면
 * 해당 메서드를 호출해 지원 여부를 판단한다. 메서드가 없으면 차단하지 않는다
 * (backward compatibility: 기존 provider는 모든 프로필을 암묵적으로 허용).
 *
 * 차단 조건: provider.supportsPermissionProfile 존재 + false 반환
 * → Error를 throw한다.
 */
export function checkProviderProfileSupport(
  provider: IProvider & { supportsPermissionProfile?: (profile: PermissionProfile) => boolean },
  profile: PermissionProfile
): void {
  if (typeof provider.supportsPermissionProfile !== 'function') {
    // 메서드 없음 — backward compat: 차단하지 않음
    return;
  }

  if (!provider.supportsPermissionProfile(profile)) {
    throw new Error(
      `Provider '${provider.key}' does not support permission profile '${profile}'. ` +
        `Execution blocked. Use a supported profile or a different provider.`
    );
  }
}
