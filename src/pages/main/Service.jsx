import React from "react";
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

const STEPS = [
  { n: "1", title: "이미지·드래그 문제", desc: "어린이가 이해하기 쉬운 방식" },
  { n: "2", title: "학습 스테이지", desc: "진도·별·스티커로 성장" },
  { n: "3", title: "행동 데이터 분석", desc: "학습과 화면 개선에 활용" },
  { n: "4", title: "기관 연동", desc: "웹사이트에 위젯으로 연결" },
];

/**
 * CatChap 서비스 소개
 *
 * @param {object} props
 * @param {string} [props.logoSrc]   헤더 로고 이미지 경로
 */
export default function ServiceIntro({
  logoSrc = logo,
  onSeeExample,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f0ec",
        fontFamily: FONT,
        color: NAVY,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* HEADER */}
      <header style={{ background: "#ffffff", borderBottom: "1px solid #e6e6e0" }}>
        <div
          style={{
            maxWidth: 1160,
            margin: "0 auto",
            padding: "18px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <img
            src={logoSrc}
            alt="캣챱 로고"
            style={{ width: 38, height: 38, display: "block" }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px", color: NAVY }}>
            캣챱
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: ACCENT }}>
            Catchap
            </span>
        </div>
        </Link>

          <nav className="cc-nav" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: -115 }}>
            {NAV.map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  padding: "8px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: item.active ? 700 : 500,
                  color: item.active ? NAVY : "#5a6b7a",
                  background: item.active ? "#eef2ef" : "transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <button
            style={{
              padding: "8px 18px",
              borderRadius: 999,
              border: "1px solid #d6d6cf",
              background: "#f6f6f1",
              color: NAVY,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            공개
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "56px 32px 72px" }}>
        <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: ACCENT, textAlign: "left" }}>
          캣챱이 하는 일
        </p>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: 38,
            lineHeight: 1.3,
            fontWeight: 900,
            letterSpacing: "-1px",
            color: NAVY,
            textAlign: "left",
          }}
        >
          학습과 인증을 하나의 경험으로
        </h1>
        <p
          style={{
            margin: "0 0 36px",
            fontSize: 16,
            lineHeight: 1.7,
            color: "#52606d",
            maxWidth: 640,
            textAlign: "left",
          }}
        >
          학생에게는 친근한 학습 화면을, 학교·기관에는 관리와 분석 기능을 제공합니다.
        </p>

        {/* 4단계 카드 */}
        <div
          className="cc-steps"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            textAlign: "left",
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              style={{
                background: "#ffffff",
                border: "1px solid #e6e6de",
                borderRadius: 12,
                padding: "26px 24px",
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: ACCENT,
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 800,
                  marginBottom: 22,
                }}
              >
                {s.n}
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 700 }}>
                {s.title}
              </h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#65727e" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <style>{`
        @media (max-width: 880px) {
          .cc-nav { display: none !important; }
          .cc-steps { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          .cc-steps { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}