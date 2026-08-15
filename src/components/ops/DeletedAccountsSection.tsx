import type { OpsDeletedOperator } from '../../api/ops';

/**
 * 삭제된 계정 이력 — 운영자·강사 계정 목록 하단에 붙는 별도 영역.
 *
 * ★왜 같은 표에 섞지 않나: 삭제는 하드 삭제라 users 행이 남지 않는다. 여기 값은 지우기
 * 직전에 감사 로그로 남긴 스냅샷이지 지금의 계정 상태가 아니다. 위 목록과 한 표에 두면
 * 삭제된 계정이 아직 살아 있는 것처럼 읽히고, 운영자가 '중지'와 '삭제'를 구분하지 못한다.
 *
 * 운영자·강사 두 화면이 같은 모양이라 여기 한 곳에만 둔다(복붙 금지 — 한쪽만 고쳐져 어긋나는 걸 막는다).
 */
export default function DeletedAccountsSection({
  kind,
  items,
  loading,
}: {
  /** 화면 문구에만 쓰인다 — 데이터는 호출부가 각자의 API로 가져온다 */
  kind: '운영자' | '강사';
  items: OpsDeletedOperator[];
  loading: boolean;
}) {
  const fmt = (ts: string | null) => (ts ? ts.replace('T', ' ').slice(0, 16) : '-');

  return (
    <>
      <div className="op-head" style={{ marginTop: 28 }}>
        <div>
          <h2 className="op-title" style={{ fontSize: 20 }}>
            삭제된 계정
            {items.length > 0 && <span className="op-delcount">{items.length}</span>}
          </h2>
          <p className="op-sub">
            중지한 뒤 삭제된 {kind} 계정이에요. 계정 자체는 이미 사라졌고 여기 값은 삭제 시점에
            남긴 기록이라 되살릴 수 없어요 — 다시 쓰려면 같은 이메일로 새로 추가해야 합니다.
            (이 계정이 남긴 활동 기록은 감사 로그에 그대로 보존돼요.)
          </p>
        </div>
      </div>

      <div className="op-logcard">
        <div className="op-loghead op-delhead">
          <span>이름</span>
          <span>이메일(로그인)</span>
          <span>상태</span>
          <span>삭제 일시</span>
          <span>삭제한 운영자</span>
        </div>

        {loading && <div className="op-logrow">불러오는 중…</div>}
        {!loading && items.length === 0 && (
          <div className="op-logrow op-delempty">삭제된 {kind} 계정이 없어요.</div>
        )}
        {!loading &&
          items.map((d) => (
            <div key={`${d.id}-${d.deleted_at}`} className="op-logrow op-delrow">
              <span className="op-op-name">
                <span className="op-org-ic"><i className="ph-fill ph-shield-slash" /></span>
                {d.name || '(이름 없음)'}
              </span>
              <span className="op-mono">{d.email ?? '-'}</span>
              <span className="op-del-state">
                <span className="op-orgstatus op-orgstatus--deleted">삭제됨</span>
                {d.status_before === 'disabled' && <small>중지 후</small>}
              </span>
              <span className="op-op-login">{fmt(d.deleted_at)}</span>
              {/* 삭제를 실행한 운영자도 나중에 삭제됐을 수 있다 — 없는 이름을 지어내지 않는다 */}
              <span className="op-del-by">
                {d.deleted_by ?? <em title={d.deleted_by_id ?? ''}>삭제된 계정</em>}
              </span>
            </div>
          ))}
      </div>
    </>
  );
}
