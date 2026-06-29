import React, { useState } from "react";
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'

const ACCENT = "#4a9b8e";
const NAVY = "#1e3a5f";
const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

const NAV = [
  { label: "서비스 소개", href: "/Service", active: true },
  { label: "학교·기관 안내", href: "/schoolpage", active: false },
  { label: "로그인", href: "/login", active: false },
];

const ITEMS = [
  { title: "학습 기록", body: "진도, 정답 여부, 모은 별과 스티커를 저장합니다." },
  { title: "드래그 행동 정보", body: "문제를 푸는 동안의 드래그 경로와 속도를 사람 여부 확인과 화면 개선에 활용합니다." },
  { title: "실제 아동 데이터 원칙", body: "아동의 개인정보는 최소한으로 수집하며, 보호자 동의 아래 안전하게 다룹니다." },
  { title: "보관과 삭제", body: "정보는 필요한 기간만 보관하고, 요청 시 안전하게 삭제합니다." },
];

export default function PrivacyPolicy() {
  const [openIndexes, setOpenIndexes] = useState([0]);

  const toggle = (i) => {
    setOpenIndexes(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f0ec", fontFamily: FONT, color: NAVY, WebkitFontSmoothing: "antialiased" }}>
      {/* HEADER */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e6e6e0" }}>
        <div style={{ maxWidth: 1160, margin: "0 auto", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <img src={logo} alt="캣챱 로고" style={{ width: 38, height: 38, display: "block" }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: NAVY }}>캣챱</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>Catchap</span>
            </div>
          </Link>
          <nav className="cc-nav" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: -100 }}>
            {NAV.map((item) => (
              <a key={item.label} href={item.href} style={{ padding: "8px 16px", borderRadius: 999, fontSize: 14, fontWeight: item.active ? 700 : 500, color: item.active ? NAVY : "#5a6b7a", background: item.active ? "#eef2ef" : "transparent", textDecoration: "none" }}>
                {item.label}
              </a>
            ))}
          </nav>
          <button style={{ padding: "8px 18px", borderRadius: 999, border: "1px solid #d6d6cf", background: "#f6f6f1", color: NAVY, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            공개
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "56px 32px 72px" }}>
        <h1 style={{ margin: "0 0 14px", fontSize: 32, fontWeight: 900, letterSpacing: "-0.8px", color: NAVY, textAlign: "left" }}>이용·개인정보 안내</h1>
        <p style={{ margin: "0 0 32px", fontSize: 16, lineHeight: 1.7, color: "#52606d", textAlign: "left" }}>캣챱이 어떤 정보를 왜 사용하는지 쉽게 안내합니다.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ITEMS.map((item, i) => (
            <div key={i} style={{ background: "#ffffff", border: "1px solid #e6e6de", borderRadius: 12, overflow: "hidden" }}>
              <div onClick={() => toggle(i)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", cursor: "pointer" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: ACCENT, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 16, fontWeight: 700, textAlign: "left" }}>{item.title}</span>
                <span style={{ fontSize: 18, color: "#9aa6af", transition: "transform .2s", transform: openIndexes.includes(i) ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
              </div>
              {openIndexes.includes(i) && (
                <div style={{ padding: "0 22px 20px 41px", fontSize: 14, lineHeight: 1.7, color: "#65727e", textAlign: "left" }}>{item.body}</div>
              )}
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @media (max-width: 880px) { .cc-nav { display: none !important; } }
      `}</style>
    </div>
  );
}