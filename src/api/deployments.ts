import { client } from './client';

/** 배포 하나의 지금 상태. */
export interface Deployment {
  name: string;
  image: string;
  /** ★이미지 태그 = 커밋 해시. `git show <태그>` 로 그 코드를 볼 수 있다. */
  tag: string;
  replicas_desired: number;
  replicas_ready: number;
  healthy: boolean;
  updated_at: string | null;
  /** 정상이 아닌 조건만 담긴다. 비어 있으면 문제 없음. */
  conditions: string[];
}

export interface DeploymentSnapshot {
  namespace: string;
  collected_at: string;
  deployments: Deployment[];
  summary: { total: number; healthy: number; unhealthy: number };
}

export const deploymentApi = {
  /**
   * 지금 클러스터에 떠 있는 배포 목록.
   *
   * ★읽기만 한다. 배포·롤백 같은 바꾸는 기능은 일부러 없다 — ArgoCD 화면에서 한다.
   * ⚠️못 읽으면 503 이 온다(빈 목록이 아니다). 호출부는 그 사유를 그대로 보여 준다.
   */
  list: () => client.get<DeploymentSnapshot>('/ops/deployments').then((r) => r.data),
};
