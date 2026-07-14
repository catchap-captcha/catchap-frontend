import ScratchBrowser from '../../components/scratch/ScratchBrowser';
import { studentApi } from '../../api/students';

/** 학생 본인 연습장 필기 다시보기 — 공용 ScratchBrowser에 본인 API 연결. */
export default function StudentScratch() {
  return (
    <ScratchBrowser
      title="필기 다시보기"
      subtitle="문제를 풀며 연습장에 쓴 풀이 과정을 과목별로 다시 볼 수 있어요."
      emptyHint="수학처럼 계산이 필요한 문제에서 연습장에 풀이를 쓰면 여기에 모여요."
      loadList={(subject) => studentApi.scratchList(subject)}
      loadDetail={(recordId) => studentApi.scratchDetail(recordId)}
    />
  );
}
