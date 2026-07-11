/** 공용 다운로드 유틸 — 모든 내보내기/다운로드 버튼이 실제 파일을 저장하도록. */

import { kstDateString } from './format';

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 브라우저가 저장을 시작할 시간을 준 뒤 URL 해제
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** CSV 저장 — Excel 한글 호환을 위해 UTF-8 BOM 포함. rows[0]은 헤더. */
export function downloadCSV(filename: string, rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    let s = v == null ? '' : String(v);
    // 수식 인젝션 방어: 사용자 입력이 =HYPERLINK(...) 같은 셀로 들어와 Excel에서 실행되지 않게
    // 선두 =,+,@ (및 숫자가 아닌 -) 앞에 ' 를 붙인다. 음수 등 순수 숫자는 그대로 둔다.
    if (/^[=+@-]/.test(s) && (s === '' || isNaN(Number(s)))) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  downloadBlob(filename, new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' }));
}

/** 캔버스 → PNG 저장 (리포트/상장 이미지) */
export function downloadCanvasPng(filename: string, canvas: HTMLCanvasElement) {
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(filename, blob);
  }, 'image/png');
}

/** 오늘 날짜 파일명 suffix: 2026-07-07 (KST 고정 — 브라우저 시간대 무관) */
export function dateSuffix(): string {
  return kstDateString();
}
