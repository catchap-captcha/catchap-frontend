/** 표준 에러 응답 (백엔드 공통) */
export interface ApiError {
  detail: string;
  code?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
