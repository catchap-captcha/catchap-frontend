import { Link, useParams, useSearchParams } from 'react-router-dom';
import ScratchBrowser from '../../components/scratch/ScratchBrowser';
import { parentApi } from '../../api/parents';
import { PATHS } from '../../routes/paths';

/** 학부모용 자녀 연습장 필기 재생 — /parent/children/:childId/scratch */
export default function ParentScratch() {
  const { childId = '' } = useParams();
  const [sp] = useSearchParams();
  const name = sp.get('name') || '자녀';

  return (
    <div>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '14px 14px 0' }}>
        <Link
          to={PATHS.PARENT_REPORTS}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#8A8175', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}
        >
          <i className="ph-bold ph-arrow-left" /> 리포트로
        </Link>
      </div>
      <ScratchBrowser
        title={`${name}의 필기`}
        subtitle="자녀가 문제를 풀며 연습장에 쓴 풀이 과정을 과목별로 볼 수 있어요."
        emptyHint="아직 연습장에 남긴 필기가 없어요. 수학처럼 계산이 필요한 문제를 풀면 모여요."
        loadList={(subject) => parentApi.childScratch(childId, subject)}
        loadDetail={(recordId) => parentApi.childScratchDetail(childId, recordId)}
      />
    </div>
  );
}
