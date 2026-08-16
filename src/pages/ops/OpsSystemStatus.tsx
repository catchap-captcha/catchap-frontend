import { useEffect, useState } from 'react';
import { opsApi, type OpsSystemHealth } from '../../api/ops';
import OpsNav from '../../components/ops/OpsNav';
import { SERVICE_NAME_META as NAME_META } from '../../constants/systemServices';
import './OpsApproval.css';
import './OpsRenewalShared.css';
import './OpsSystemStatus.css';
import SystemScreenGuide from '../../components/ops/SystemScreenGuide';


const STATUS_META: Record<string, { accent: string; soft: string; label: string; icon: string }> = {
  ok: { accent: 'var(--ok)', soft: 'var(--ok-soft)', label: '정상', icon: 'ph-check-circle' },
  degraded: { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '저하', icon: 'ph-warning-circle' },
  'dry-run': { accent: 'var(--warn)', soft: 'var(--warn-soft)', label: '미설정', icon: 'ph-flask' },
  error: { accent: 'var(--brand)', soft: 'var(--brand-soft)', label: '오류', icon: 'ph-x-circle' },
  not_deployed: { accent: 'var(--ink-3)', soft: 'var(--bg)', label: '미배포', icon: 'ph-prohibit' },
  // ★'모름'과 '고장'은 다른 사실이다. 수집이 안 될 뿐인 것을 빨갛게 칠하면 진짜 장애를
  //   못 알아본다 — 회색으로 두고 사유를 detail 에 적는다.
  unknown: { accent: 'var(--ink-3)', soft: 'var(--bg)', label: '모름', icon: 'ph-question' },
};

/**
 * 왕복시간 표기.
 *
 * ★백엔드가 max(1, int(...)) 로 바닥을 치고 있었다 — 0.3ms 도 "1ms" 로 찍혀 정확한 값처럼
 *   보였다(backend#77 에서 없앴다). 그런데 소수 한 자리로 재니 캡차 출제가 0.04ms 라
 *   ★"0ms" 로 찍혔다 — 이번엔 "안 쟀다" 처럼 보인다. 정직해지려다 다른 오해를 만들었다.
 *   잰 값이 0.1ms 도 안 되면 그렇다고 말한다.
 */
function ms(v: number): string {
  if (v <= 0) return '0.1ms 미만';
  return `${v}ms`;
}

function fmt(ts: string | null): string {
  if (!ts) return '-';
  return ts.replace('T', ' ').slice(0, 19);
}

/**
 * 시스템 상태 — 전부 서버 실측이다(DB 왕복시간·캡차엔진·SMTP·디스크 + 클러스터 앱 4종).
 *
 * ★'실측'이라는 말을 지키는 것이 이 화면의 전부다. 종전엔 "AI 판정 서버: 미배포"가
 *   서버에 고정된 문자열이라, 그 앱이 클러스터에 실제로 뜬 뒤에도 영영 미배포라고 말했다
 *   (0809 컷오버). 점검하지 않으면서 단언하는 카드는 없느니만 못하다 — 볼 때마다 사실
 *   확인을 다시 해야 하기 때문이다. 지금은 k8s가 보고 있는 값을 그대로 읽어 온다.
 *
 * 카드 이름·설명은 여기가 갖는다(서버는 키만 보낸다). 모르는 키가 와도 깨지지 않게
 * 기본값으로 떨어진다.
 */
export default function OpsSystemStatus() {
  const [data, setData] = useState<OpsSystemHealth | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = () => {
    setState('loading');
    opsApi
      .system()
      .then((d) => {
        setData(d);
        setState('ready');
      })
      .catch(() => setState('error'));
  };
  useEffect(load, []);

  const worst = data?.services.reduce<'ok' | 'warn' | 'bad'>((acc, s) => {
    if (s.status === 'error') return 'bad';
    if ((s.status === 'degraded' || s.status === 'dry-run') && acc !== 'bad') return 'warn';
    return acc;
  }, 'ok');

  return (
    // 헤더 셸은 콘솔 공통 규격(op-*)을 쓴다 — 이 화면만 orn-* 셸이라 본문 폭(1400 제한 없음)·
    // 여백(32/36 vs 26/28)·제목 크기(32/700 vs 30/800)가 다른 시스템 페이지들과 어긋났다.
    <div className="op-root">
      <OpsNav />
      <main className="op-main sys-page">
        <div className="op-head">
          <div>
            <h1 className="op-title">시스템 상태</h1>
            <p className="op-sub" style={{ maxWidth: 620 }}>
              여덟 가지를 지금 이 순간 직접 재 봅니다. <b>이상한 것이 위로 올라옵니다</b> — 전부
              초록이면 더 볼 것이 없다는 뜻이에요.
            </p>
            <p className="op-sub sys-note">
              백엔드 API 는 목록에 없습니다 — <b>이 화면을 만들어 보내는 것이 백엔드 자신</b>이라,
              화면이 떴다는 것 자체가 살아 있다는 뜻입니다.
            </p>
            {/* ★영상이 어디에 있는지 밝혀 둔다 — 「서버 저장공간」을 영상 보관함으로
                오해하면(그전 설명이 실제로 그랬다) 이 카드가 초록인 것을 보고
                "영상 올릴 자리 넉넉하다" 고 잘못 읽는다. */}
            <p className="op-sub sys-note">
              강의 영상·자막·이미지는 <b>서버가 아니라 오브젝트 스토리지</b>에 쌓입니다 — 아래
              「서버 저장공간」은 그것이 아니라 <b>프로그램이 도는 서버들의 남은 자리</b>예요.
            </p>
          </div>
          <button className="op-refresh" onClick={load} disabled={state === 'loading'}>
            <i className="ph-bold ph-arrows-clockwise" />다시 점검
          </button>
        </div>

        {state === 'loading' && <div className="orn-loading"><i className="ph-duotone ph-spinner-gap" />불러오는 중…</div>}
        {state === 'error' && (
          <div className="orn-card orn-empty"><i className="ph ph-warning-circle" /><p>시스템 상태를 불러오지 못했어요.</p></div>
        )}

        {state === 'ready' && data && (
          <>
            <SystemScreenGuide />
            <div className={`sys-banner sys-banner--${worst}`}>
              <i className={`ph ${worst === 'ok' ? 'ph-check-circle' : worst === 'warn' ? 'ph-warning-circle' : 'ph-x-circle'}`} />
              <b>전체 상태: {worst === 'ok' ? '정상' : worst === 'warn' ? '주의' : '오류'}</b>
              <span className="sys-checked">마지막 점검 {fmt(data.checked_at)} (KST)</span>
            </div>

            {(() => {
              // ★묶음을 뺐다(0816) — "서비스가 도나"·"기능이 되나" 가 둘 다 '되나?' 라 구별이
              //   안 되고, 캡차 API 와 캡차 문제 출제가 갈려 "캡차가 왜 두 군데?" 로 읽혔다.
              //   무엇을 재는지는 각 카드의 부제가 이미 말한다("…하는 서버" / "…나오는지").
              //   대신 ★이상한 것을 위로 올린다 — 여덟 개가 전부 초록이면 볼 것이 없다.
              const rank = (st: string) =>
                st === 'error' ? 0 : st === 'degraded' ? 1 : st === 'dry-run' ? 2 : st === 'unknown' ? 3 : 4;
              const sorted = [...data.services].sort(
                (a, b) => rank(a.status) - rank(b.status),
              );
              return (
                <section className="sys-group">
                  <div className="sys-grid">
                    {sorted.map((s) => {
                      const nm = NAME_META[s.name] ?? {
                        icon: 'ph-heartbeat',
                        label: `미등록 (${s.name})`,
                        desc: '',
                      };
                      const sm = STATUS_META[s.status] ?? STATUS_META.not_deployed;
                      return (
                        <div key={s.name} className="sys-card" style={{ borderLeftColor: sm.accent }}>
                          <div className="sys-card-top">
                            <span className="sys-icbox"><i className={`ph ${nm.icon}`} /></span>
                            <div className="sys-card-title">
                              <div className="sys-card-name">{nm.label}</div>
                              <div className="sys-card-desc">{nm.desc}</div>
                            </div>
                            <span className="sys-pill" style={{ color: sm.accent, background: sm.soft }}>
                              <i className={`ph ${sm.icon}`} />{sm.label}
                            </span>
                          </div>
                          <div className="sys-card-bottom">
                            {s.latency_ms != null && (
                              <span className="sys-latency">{ms(s.latency_ms)}</span>
                            )}
                            <span className="sys-detail">{s.detail}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })()}
          </>
        )}
      </main>
    </div>
  );
}
