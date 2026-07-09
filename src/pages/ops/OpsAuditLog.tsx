import { useEffect, useState } from 'react';
import { opsApi, type OpsAuditLog as Row } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import './OpsApproval.css';

// 감사 action 코드 → 사람이 읽는 라벨/아이콘
// 백엔드가 실제로 기록하는 코드 전부를 여기서 매핑한다 (app/utils/helpers.py:audit 호출 지점 기준).
// 매핑에 없는 코드는 아래 fallback으로 원문(영문)이 그대로 노출되므로 누락 없이 유지할 것.
const ACTION_META: Record<string, { label: string; icon: string; cls: string }> = {
  // 운영자 — 기관 가입 승인 콘솔
  org_registration_approved: { label: '기관 가입 승인', icon: 'ph-check-circle', cls: 'ok' },
  org_registration_rejected: { label: '기관 가입 거절', icon: 'ph-x-circle', cls: 'no' },
  // 기관 관리자
  'org.update': { label: '기관 정보 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'org.teacher_add': { label: '선생님 추가', icon: 'ph-user-plus', cls: 'ok' },
  'org.teacher_update': { label: '선생님 정보 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'org.teacher_delete': { label: '선생님 삭제', icon: 'ph-user-minus', cls: 'no' },
  'org.captcha_settings_update': { label: '캡차 설정 변경', icon: 'ph-shield-check', cls: 'neutral' },
  'student.password_reset': { label: '학생 비밀번호 초기화', icon: 'ph-key', cls: 'warn' },
  'parent_link.revoke': { label: '학부모 연결 해제(기관)', icon: 'ph-link-break', cls: 'warn' },
  'student.assign_class': { label: '학생 학급 배정', icon: 'ph-users-three', cls: 'neutral' },
  // 학부모
  'parent.profile_update': { label: '학부모 프로필 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'parent.child_link': { label: '자녀 연결', icon: 'ph-link', cls: 'ok' },
  'parent.child_unlink': { label: '자녀 연결 해제', icon: 'ph-link-break', cls: 'warn' },
  'parent.child_settings_update': { label: '자녀 설정 변경', icon: 'ph-sliders-horizontal', cls: 'neutral' },
  // 선생님
  'teacher.profile_update': { label: '선생님 프로필 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'teacher.class_student_add': { label: '학급 학생 추가', icon: 'ph-user-plus', cls: 'ok' },
  'teacher.class_student_update': { label: '학급 학생 수정', icon: 'ph-pencil-simple', cls: 'neutral' },
  'teacher.class_student_remove': { label: '학급 학생 제외', icon: 'ph-user-minus', cls: 'no' },
  // 공용 설정/계정
  'settings.update': { label: '설정 변경', icon: 'ph-gear', cls: 'neutral' },
  'settings.change_password': { label: '비밀번호 변경', icon: 'ph-key', cls: 'warn' },
  'settings.account_delete': { label: '계정 삭제(탈퇴)', icon: 'ph-user-minus', cls: 'no' },
  // 운영자 — 문의 처리
  'inquiry.answer': { label: '문의 답변 발송', icon: 'ph-paper-plane-tilt', cls: 'ok' },
  'inquiry.resolve': { label: '문의 처리 완료', icon: 'ph-check-circle', cls: 'ok' },
  // 운영자 — 행동 데이터 학습셋 관리
  'behavior.dataset_mark': { label: '행동 데이터 학습셋 상태 변경', icon: 'ph-fingerprint', cls: 'neutral' },
};

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 16);
}

export default function OpsAuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  // 감사 로그는 절대 조작된(가짜) 행을 보여주지 않는다 — 실제 상태만 표시
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    opsApi
      .logs()
      .then((d) => {
        setRows(Array.isArray(d) ? d : []);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  return (
    <div className="op-root">
      <OpsNav />

      <main className="op-main">
        <div className="op-head">
          <div>
            <h1 className="op-title">감사 로그</h1>
            <p className="op-sub">승인·비밀번호 초기화·연결 해제 등 민감한 행동의 기록이에요. (누가·언제·무엇을)</p>
          </div>
          <button className="op-refresh" onClick={load}><i className="ph-bold ph-arrows-clockwise" />새로고침</button>
        </div>

        <div className="op-logcard">
          <div className="op-loghead">
            <span className="op-logcol-act">행동</span>
            <span className="op-logcol-who">실행자</span>
            <span className="op-logcol-tgt">대상</span>
            <span className="op-logcol-time">시각</span>
          </div>
          {state === 'loading' && <div className="op-logrow">불러오는 중…</div>}
          {state === 'error' && (
            <div className="op-logrow">감사 로그를 불러오지 못했어요. 새로고침해 주세요.</div>
          )}
          {state === 'ready' && rows.length === 0 && (
            <div className="op-logrow">기록이 아직 없어요.</div>
          )}
          {state === 'ready' && rows.map((r) => {
            const m = ACTION_META[r.action] ?? { label: r.action, icon: 'ph-dot', cls: 'neutral' };
            return (
              <div key={r.id} className="op-logrow">
                <span className="op-logcol-act">
                  <span className={`op-logic op-logic--${m.cls}`}><i className={`ph-fill ${m.icon}`} /></span>
                  {m.label}
                </span>
                <span className="op-logcol-who">{r.actor_name ?? r.actor_user_id ?? '-'}</span>
                <span className="op-logcol-tgt op-mono">{r.target_type ?? '-'}</span>
                <span className="op-logcol-time">{fmt(r.created_at)}</span>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
