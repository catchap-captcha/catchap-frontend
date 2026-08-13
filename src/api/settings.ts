import { client } from './client';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const settingsApi = {
  /** 역할별 사용자 설정(JSON) */
  get: () => client.get<any>('/settings/me').then((r) => r.data),
  save: (settings: any) => client.put('/settings/me', { settings }).then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    client
      .post('/settings/me/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })
      .then((r) => r.data),

  /** 강제 변경(임시 비번 첫 로그인) — 현재 비번 재입력 없이 새 비번만 설정 */
  forceChangePassword: (newPassword: string) =>
    client
      .post('/settings/me/change-password', { new_password: newPassword })
      .then((r) => r.data),

  logoutAllDevices: () => client.post('/settings/me/logout-all').then((r) => r.data),

  exportData: () => client.get<any>('/settings/me/export').then((r) => r.data),

  /** 계정 탈퇴 — 비밀번호 있는 계정은 password로, 소셜 전용은 confirm='탈퇴처리에 동의합니다.'로 재확인.
   *  reason(선택) = 탈퇴 사유(감사 로그에 남는다). */
  deleteAccount: (payload: { password?: string; confirm?: string; reason?: string }) =>
    client.delete('/settings/me/account', { data: payload }).then((r) => r.data),
};
