/** 공용 다운로드 유틸 — 모든 내보내기/다운로드 버튼이 실제 파일을 저장하도록. */

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
    const s = v == null ? '' : String(v);
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

/** 오늘 날짜 파일명 suffix: 2026-07-07 */
export function dateSuffix(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
