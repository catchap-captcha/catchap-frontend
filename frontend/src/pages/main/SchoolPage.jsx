import React from "react";
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'

const ACCENT = "#4a9b8e";
const NAVY = "#1e3a5f";
const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

const NAV = [
  { label: "서비스 소개", href: "/Service", active: false },
  { label: "학교·기관 안내", href: "/schoolpage", active: true },
  { label: "로그인", href: "/login", active: false },
];

const CARDS = [
  { icon: "👥", title: "멤버와 권한", desc: "관리자·교사·개발자의 접근 범위를 구분합니다." },
  { icon: "🏫", title: "학급과 학생", desc: "담당 교사, 학생, 진도 정보를 관리합니다." },
  { icon: "✏️", title: "사이트 연동", desc: "공개 키와 허용 주소를 설정해 위젯을 연결합니다." },
  { icon: "📊", title: "역할별 분석", desc: "학습·조작·보안 정보를 목적에 맞게 제공합니다." },
];

/**
 * CatChap 학교·기관 안내
 *
 * @param {object} props
 * @param {string} [props.logoSrc]      헤더 로고 이미지 경로
 * @param {() => void} [props.onSeeExample]  '외부 연동 예시 보기' 클릭 콜백
 */
export default function SchoolPage({
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

          <nav className="cc-nav" style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: -100 }}>
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
          학교·교육기관용
        </p>
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: 38,
            lineHeight: 1.3,
            fontWeight: 900,
            letterSpacing: "-1px",
            textAlign: "left",
            color: NAVY,
          }}
        >
          학급 관리부터 외부 연동까지
        </h1>
        <p
          style={{
            margin: "0 0 36px",
            fontSize: 15,
            lineHeight: 1.7,
            color: "#52606d",
            maxWidth: 660,
            textAlign: "left",
          }}
        >
          기관은 학생·교사·콘텐츠를 관리하고, 필요한 경우 자체 웹사이트에 캣챱 위젯을
          연결할 수 있습니다.
        </p>

        {/* 2x2 카드 그리드 */}
        <div
          className="cc-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
          }}
        >
          {CARDS.map((c) => (
            <div
              key={c.title}
              style={{
                background: "#ffffff",
                border: "1px solid #e6e6de",
                borderRadius: 12,
                padding: "28px 26px",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 14 }}>{c.icon}</div>
              <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 700 }}>
                {c.title}
              </h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#65727e" }}>
                {c.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 36 }}>
          <button
            onClick={onSeeExample}
            style={{
              padding: "13px 28px",
              borderRadius: 999,
              border: "1px solid #cfd6da",
              background: "#eef1f3",
              color: NAVY,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            외부 연동 예시 보기
          </button>
        </div>
      </main>

      <style>{`
        @media (max-width: 880px) {
          .cc-nav { display: none !important; }
          .cc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}