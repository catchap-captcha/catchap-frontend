import React from "react";

const NAV = [
  { icon: "🏠", label: "홈", active: false },
  { icon: "🧩", label: "놀이", active: true },
  { icon: "⭐", label: "모으기", active: false },
  { icon: "🐱", label: "나", active: false },
];

export default function StudentHome() {
  return (
    <div className="min-h-screen bg-[#eef0ee] font-sans text-slate-700 antialiased">
      {/* HEADER */}
      <header className="flex h-21 items-center justify-between bg-gradient-to-r from-[#5f9e87] to-[#9ec3b4] px-9 py-5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[28px] font-extrabold tracking-tight text-white">캣챱</span>
          <span className="text-[15px] font-semibold text-emerald-50">Catchap</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[22px]">🐱</span>
          <span className="text-[17px] font-extrabold text-white">토리</span>
          <span className="rounded-full bg-white/20 px-3.5 py-1.5 text-[13px] font-bold text-white">
            별님반·유치원
          </span>
        </div>
      </header>

      {/* BODY: 3열 */}
      <div className="mx-auto grid max-w-[1840px] grid-cols-[200px_1fr_380px] items-start gap-7 px-9 pb-12 pt-7">
        {/* 좌측 사이드바 */}
        <aside className="flex min-h-[760px] flex-col gap-2.5 rounded-[20px] bg-white p-[22px_14px] shadow-sm">
          {NAV.map((it) => (
            <div
              key={it.label}
              className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl px-2 py-[18px] ${
                it.active ? "bg-[#e3f3ea] text-[#3d9d70]" : "text-slate-500"
              }`}
            >
              <span className="text-[28px]">{it.icon}</span>
              <span className="text-sm font-bold">{it.label}</span>
            </div>
          ))}
        </aside>

        {/* 중앙 메인 */}
        <main className="flex flex-col gap-[22px]">
          {/* 인사 카드 */}
          <div className="rounded-[18px] bg-white px-7 py-6 shadow-sm">
            <h1 className="mb-2 text-[22px] font-extrabold text-slate-700">
              별님반 토리야, 오늘도 반가워!
            </h1>
            <p className="text-sm text-slate-400">오늘도 즐겁게 놀면서 실력을 키워보자!</p>
          </div>

          {/* 추천 놀이 배너 */}
          <div className="relative flex min-h-[360px] flex-col overflow-hidden rounded-[22px] bg-gradient-to-br from-[#6f8fd6] via-[#7d7fcf] to-[#8aa0db] px-10 py-9">
            <div className="pointer-events-none absolute -right-10 -top-10 rotate-[-12deg] text-[240px] opacity-10">
              🐟
            </div>

            <span className="relative self-start rounded-full bg-[#4caf82] px-3.5 py-1.5 text-[13px] font-extrabold text-white">
              오늘의 추천 놀이
            </span>
            <h2 className="relative mb-2.5 mt-[18px] text-[46px] font-extrabold tracking-tight text-white">
              생선 세기 놀이
            </h2>
            <p className="relative mb-[18px] text-base text-indigo-50">
              그림을 보고 물고기를 세어 보자!
            </p>
            <div className="relative flex gap-2.5">
              {["⏱ 3분", "📊 쉬움", "⭐ 별 2개 지급"].map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/90 px-3.5 py-2 text-[13px] font-bold text-slate-500"
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="relative mt-[18px] flex flex-1 items-end justify-center">
              <button className="flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-[#74c79b] to-[#5fae84] px-10 py-[18px] text-xl font-extrabold text-white shadow-lg shadow-emerald-700/30">
                놀이 시작하기 <span className="text-base">▶</span>
              </button>
            </div>
          </div>

          {/* AI 추천 문제 */}
          <div className="rounded-[18px] bg-white px-7 py-6 shadow-sm">
            <div className="mb-[18px] flex items-center gap-2.5">
              <h3 className="text-[19px] font-extrabold text-slate-700">토리를 위한 추천 문제</h3>
              <span className="rounded-full bg-[#7c3aed] px-3 py-1 text-xs font-extrabold text-white">
                AI
              </span>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex h-[74px] w-[108px] flex-shrink-0 items-center justify-center gap-[18px] rounded-[14px] bg-[#cfe5fb] text-[26px] font-extrabold text-[#2f6fb0]">
                <span>3</span>
                <span>7</span>
              </div>
              <div className="flex-1">
                <h4 className="mb-1.5 text-base font-extrabold text-slate-700">수 세기 연습 문제</h4>
                <p className="mb-2.5 text-sm text-slate-400">
                  6~10까지의 수를 정확히 세는 연습을 해봐요.
                </p>
                <div className="flex gap-2">
                  {["예상 시간 5분", "난이도 보통"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#f1ecfd] px-3 py-[5px] text-xs font-bold text-[#7c3aed]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <button className="flex-shrink-0 rounded-xl bg-[#7c3aed] px-[22px] py-3.5 text-sm font-extrabold text-white">
                추천 문제 풀기 ▶
              </button>
            </div>
          </div>

          {/* 지난 기록 */}
          <div className="mt-1.5 flex justify-center">
            <button className="rounded-full bg-white px-[22px] py-[11px] text-sm font-bold text-slate-400 shadow-sm">
              ⟳ 지난 기록 보기
            </button>
          </div>
        </main>

        {/* 우측 사이드 패널 */}
        <aside className="flex flex-col gap-5">
          {/* 오늘 목표 */}
          <div className="flex items-center gap-4 rounded-[18px] bg-[#fbf3df] px-6 py-5">
            <span className="whitespace-nowrap text-sm font-extrabold text-[#b07e2e]">오늘 목표</span>
            <span className="text-xl tracking-widest text-[#e0c074]">☆☆</span>
            <span className="text-[13px] font-bold text-[#9b7b3e]">별 2개 더 모으면 스티커 선물!</span>
          </div>

          {/* 놀이 고르기 */}
          <div className="rounded-[18px] bg-white px-6 py-[22px] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 flex-shrink-0 rounded-[14px] bg-[#d8ede2]" />
              <div className="flex-1">
                <h4 className="mb-1 text-[17px] font-extrabold text-slate-700">놀이 고르기</h4>
                <p className="text-[13px] text-slate-400">새로운 놀이를 선택해보자!</p>
              </div>
              <button className="h-[42px] w-[42px] flex-shrink-0 rounded-full bg-[#4caf82] text-lg text-white">
                ›
              </button>
            </div>
            <span className="mt-3.5 inline-block rounded-full bg-[#e8f5ee] px-3.5 py-1.5 text-xs font-bold text-[#3d9d70]">
              오늘 새로 나온 놀이 2개
            </span>
          </div>

          {/* 내 스티커 */}
          <div className="rounded-[18px] bg-white px-6 py-[22px] shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 flex-shrink-0 rounded-[14px] bg-[#ece4fb]" />
              <div className="flex-1">
                <h4 className="mb-1 text-[17px] font-extrabold text-slate-700">내 스티커</h4>
                <p className="text-[13px] text-slate-400">모은 스티커를 확인해보자!</p>
              </div>
              <button className="h-[42px] w-[42px] flex-shrink-0 rounded-full bg-[#7c3aed] text-lg text-white">
                ›
              </button>
            </div>
            <span className="mt-3.5 inline-block rounded-full bg-[#f1ecfd] px-3.5 py-1.5 text-xs font-bold text-[#7c3aed]">
              보유 스티커 15개
            </span>
          </div>

          {/* 오늘 모은 별 */}
          <div className="rounded-[18px] bg-white p-6 shadow-sm">
            <h4 className="mb-[18px] text-[17px] font-extrabold text-slate-700">오늘 모은 별</h4>
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[26px] tracking-widest">
                ⭐⭐⭐<span className="text-slate-200">☆☆</span>
              </span>
              <span className="text-3xl font-extrabold text-slate-700">3 / 5</span>
            </div>
            <div className="mb-4 h-3 overflow-hidden rounded-full bg-[#eef0ee]">
              <div className="h-full w-[60%] rounded-full bg-gradient-to-r from-[#f5c451] to-[#f0a93a]" />
            </div>
            <div className="flex items-start gap-2 rounded-xl bg-[#fbf3df] px-3.5 py-3">
              <span className="text-[13px]">🔴</span>
              <span className="text-[13px] font-bold leading-relaxed text-[#9b7b3e]">
                오늘 별 2개 더 모으면 새 스티커를 받을 수 있어요!
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}