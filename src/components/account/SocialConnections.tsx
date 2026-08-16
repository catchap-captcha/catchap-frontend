/**
 * 간편 로그인 연결 관리 — 학생 마이페이지와 운영 콘솔 프로필이 함께 쓴다.
 *
 * 연결하기는 로그인과 같은 왕복(authorize → provider 동의 → /auth/social/callback)을 타되,
 * intent=connect로 표시해 콜백이 로그인 대신 연결 API를 부르고 여기로 돌아오게 한다
 * (돌아올 주소는 returnTo로 넘긴다 — 콜백 화면은 두 화면이 공유하므로 하드코딩할 수 없다).
 *
 * ★콘솔 계정(운영자·강사)에는 이 화면이 유일한 소셜 로그인 통로다. 서버는 이메일이 같아도
 * 콘솔 계정을 자동으로 연결해 주지 않는다 — 고권한 계정을 외부 IdP에 여는 결정이라
 * '본인이 로그인한 상태에서 눌렀다'는 명시적 행위만 근거로 인정한다.
 *
 * 해제는 서버가 막는 경우가 있다: 비밀번호가 없고(소셜 전용 계정) 남은 연결이 하나뿐이면
 * 끊는 순간 계정에 못 들어오기 때문이다. 그 상태를 버튼에 미리 반영해(비활성 + 사유 안내)
 * 400을 눌러 보고 알게 되지 않도록 한다. 콘솔 계정은 항상 비밀번호가 있어 걸리지 않는다.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import {
  rememberSocialIntent,
  socialApi,
  type SocialConnectionsResponse,
  type SocialProvider,
} from '../../api/social';
import { PATHS } from '../../routes/paths';
import SocialLogo from './SocialLogo';
import './SocialConnections.css';

function detailOf(err: unknown, fallback: string) {
  const d = (err as AxiosError<{ detail?: string }>)?.response?.data?.detail;
  return typeof d === 'string' ? d : fallback;
}

interface Props {
  /** 카드 껍데기 클래스 — 마이페이지(mp-card)와 콘솔(ipf-card)의 카드 스타일이 다르다 */
  cardClassName?: string;
  titleClassName?: string;
  /** 연결 왕복이 끝나고 돌아올 경로. 기본값은 학생 마이페이지 계정 탭. */
  returnTo?: string;
}

export default function SocialConnections({
  cardClassName = 'mp-card',
  titleClassName = 'mp-card-title mp-card-title--pad',
  returnTo,
}: Props = {}) {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<SocialConnectionsResponse | null>(null);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  // 다른 계정을 연결하고 싶을 때 — provider 세션이 살아 있으면 지금 로그인된 계정으로만
  // 연결되어, 계정을 바꿔 연결할 방법이 없었다.
  const [reauth, setReauth] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    socialApi
      .connections()
      .then(setData)
      .catch(() => setData(null)); // 소셜이 꺼진 배포에서는 섹션 자체를 감춘다
  }, []);

  useEffect(load, [load]);

  // 연결 왕복에서 돌아오면 ?linked=kakao 가 붙어 있다 — 안내만 띄우고 쿼리는 지운다.
  useEffect(() => {
    const linked = params.get('linked');
    if (!linked) return;
    setNotice(`${linked === 'kakao' ? '카카오' : linked === 'naver' ? '네이버' : '구글'} 계정을 연결했어요.`);
    const next = new URLSearchParams(params);
    next.delete('linked');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const connect = async (provider: SocialProvider) => {
    setError('');
    setBusy(provider);
    try {
      const res = await socialApi.authorize(provider, reauth);
      rememberSocialIntent(provider, 'connect', returnTo);
      window.location.href = res.authorize_url;
    } catch (err) {
      setBusy(null);
      setError(detailOf(err, '연결을 시작하지 못했어요.'));
    }
  };

  const disconnect = async (provider: SocialProvider) => {
    setError('');
    setNotice('');
    setBusy(provider);
    try {
      setData(await socialApi.disconnect(provider));
      setNotice('연결을 해제했어요.');
    } catch (err) {
      setError(detailOf(err, '연결을 해제하지 못했어요.'));
    } finally {
      setBusy(null);
    }
  };

  if (!data || data.available.every((p) => !p.enabled)) return null;

  const connected = new Map(data.connections.map((c) => [c.provider, c]));
  const onlyOneLeft = data.connections.length <= 1 && !data.has_password;

  return (
    <section className={cardClassName}>
      <h2 className={titleClassName}>간편 로그인 연결</h2>
      <p className="sx-desc">
        연결한 계정으로 비밀번호 없이 로그인할 수 있어요.
        {!data.has_password && (
          <>
            {' '}
            지금은 <b>간편 로그인만</b> 쓸 수 있는 계정이라, 마지막 연결은 해제할 수 없어요.{' '}
            <Link to={PATHS.PASSWORD_RESET}>비밀번호를 먼저 설정</Link>하면 해제할 수 있어요.
          </>
        )}
      </p>

      {notice && (
        <div className="sx-msg sx-msg--ok">
          <i className="ph-fill ph-check-circle" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="sx-msg sx-msg--bad">
          <i className="ph-fill ph-warning-circle" />
          <span>{error}</span>
        </div>
      )}

      <label className="sx-reauth">
        <input type="checkbox" checked={reauth} onChange={(e) => setReauth(e.target.checked)} />
        <span>다른 계정으로 연결할래요 (계정 선택 화면을 다시 띄워요)</span>
      </label>

      {data.available
        .filter((p) => p.enabled)
        .map((p) => {
          const link = connected.get(p.provider);
          const blocked = Boolean(link) && onlyOneLeft;
          return (
            <div key={p.provider} className="sx-row">
              <span className="sx-icon">
                <SocialLogo provider={p.provider} />
              </span>
              <div className="sx-info">
                <div className="sx-title">{p.label}</div>
                <div className="sx-sub">
                  {link ? (
                    <>
                      {link.email ?? '연결됨'}
                      {link.connected_at && (
                        <span className="sx-date"> · {link.connected_at.slice(0, 10)} 연결</span>
                      )}
                    </>
                  ) : (
                    '연결되지 않음'
                  )}
                </div>
              </div>
              {link ? (
                <button
                  type="button"
                  className="sx-btn sx-btn--off"
                  onClick={() => disconnect(p.provider)}
                  disabled={busy !== null || blocked}
                  title={blocked ? '마지막 로그인 수단이라 해제할 수 없어요' : undefined}
                >
                  해제
                </button>
              ) : (
                <button
                  type="button"
                  className="sx-btn"
                  onClick={() => connect(p.provider)}
                  disabled={busy !== null}
                >
                  연결
                </button>
              )}
            </div>
          );
        })}
    </section>
  );
}
