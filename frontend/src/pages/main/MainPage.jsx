import React from "react";
import logo from '../../assets/logo.png'
import welcome_logo from '../../assets/welcome_logo.png'

const ACCENT = "#4a9b8e";
const BG = "#f0f0ec";
const NAVY = "#1e3a5f";

const FONT =
  "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

const FEATURES = [
  { icon: "🧩", title: "게임처럼 푸는 학습", desc: "수학·한글·생활 안전 문제를 이미지 선택과 드래그로 풀어요." },
  { icon: "🖼️", title: "스테이지와 성장", desc: "놀이를 마치면 별·스티커·꾸미기 아이템을 받아요." },
  { icon: "🏫", title: "학교·기관 연동", desc: "기관은 위젯과 API 설정으로 기존 사이트에 캣챱을 연결해요." },
  { icon: "🐣", title: "학생 화면 보기", desc: "학습·스테이지·배지·프로필을 한눈에 확인해요." },
  { icon: "👨‍👩‍👦", title: "학부모 화면 보기", desc: "자녀 요약과 주간 리포트를 받아봐요." },
  { icon: "🏛️", title: "학교·기관 화면 보기", desc: "학급·콘텐츠·분석·API 설정을 관리해요." },
];

const NAV = [
  { label: "서비스 소개", href: "/Service", active: false },
  { label: "학교·기관 안내", href: "/schoolpage", active: false },
  { label: "로그인", href: "/login", active: false },
];

/**
 * CatChap(캣챱) 메인 페이지
 *
 * @param {object} props
 * @param {string} [props.accentColor]      포인트/버튼 컬러 (기본 #4a9b8e)
 * @param {boolean} [props.showFloatingCards] 히어로 카드의 떠다니는 배지 표시 여부 (기본 true)
 * @param {string} [props.logoSrc]          로고 이미지 경로
 */
export default function MainPage({
  accentColor = ACCENT,
  showFloatingCards = true,
  logoSrc = logo,
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {logoSrc 
            ? <img src={logoSrc} alt="캣챱 로고" style={{ width: 38, height: 38, display: "block" }} />
            : <span style={{ fontSize: 28 }}>🐱</span>
        }
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.5px" }}>
            캣챱
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: accentColor }}>
            Catchap
            </span>
        </div>
        </div>

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

      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "48px 32px 72px" }}>
        {/* HERO */}
        <section
          style={{
            background: "#f7f3ea",
            borderRadius: 24,
            padding: 56,
            border: "1px solid #ece6d8",
          }}
        >
          <div
            className="cc-hero"
            style={{
              display: "grid",
              gridTemplateColumns: "1.05fr 0.95fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            {/* LEFT */}
            <div>
              <p
                style={{
                  margin: "0 0 18px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: accentColor,
                  letterSpacing: "-0.2px",
                  textAlign: "left",
                }}
              >
                어린이 교육용 이미지 CAPTCHA 기반 학습 서비스
              </p>
              <h1
                style={{
                  margin: "0 0 20px",
                  fontSize: 34,        // 40 → 28 (원하는 크기로 조절)
                  lineHeight: 1.3,
                  fontWeight: 900,     // 800 → 700 (볼드)
                  letterSpacing: "-1px",
                  textWrap: "balance",
                  color: NAVY,
                  textAlign: "left",
                }}
              > 
                문제를 풀며 배우고,
                <br />
                자연스럽게 사람임을 확인해요
              </h1>
              <p
                style={{
                  margin: "0 0 32px",
                  fontSize: 16,
                  lineHeight: 1.75,
                  color: "#52606d",
                  maxWidth: 480,
                  textAlign: "left",
                }}
              >
                이미지 선택과 드래그 문제를 학습 콘텐츠로 즐기고, 놀이·별·스티커로
                성장하는 서비스예요. 학교와 교육기관은 캣챱 위젯과 분석 기능을 기존
                서비스에 연결할 수 있어요.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button
                  style={{
                    padding: "14px 26px",
                    borderRadius: 12,
                    border: "none",
                    background: accentColor,
                    color: "#ffffff",
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(74,155,142,0.3)",
                  }}
                >
                  학습 시작하기
                </button>
                <button
                  style={{
                    padding: "14px 26px",
                    borderRadius: 12,
                    border: `1.5px solid ${accentColor}`,
                    background: "transparent",
                    color: accentColor,
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  학교·기관 도입 안내
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div
              style={{
                background: "#e4f1ec",
                border: "2px dashed #9ecbc0",
                borderRadius: 20,
                padding: "36px 28px",
                position: "relative",
                minHeight: 300,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 24,
              }}
            >
              {showFloatingCards && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      top: 28,
                      left: 28,
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#ffffff",
                      boxShadow: "0 6px 16px rgba(30,58,95,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 700,
                      color: accentColor,
                    }}
                  >
                    +
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: 34,
                      right: 26,
                      width: 54,
                      height: 54,
                      borderRadius: 14,
                      background: "#ffffff",
                      boxShadow: "0 6px 16px rgba(30,58,95,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      fontWeight: 800,
                      color: NAVY,
                    }}
                  >
                    가
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 128,
                      right: 34,
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: "#ffffff",
                      boxShadow: "0 6px 16px rgba(30,58,95,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    🏅
                  </div>
                  <div
                  style={{
                    position: "absolute",
                    bottom: 100,        // 위치 조절
                    left: 50,          // 위치 조절
                    width: 54,
                    height: 54,
                    borderRadius: 14,
                    background: "#ffffff",
                    boxShadow: "0 6px 16px rgba(30,58,95,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                  }}
                >
                  ⭐
                </div>
                </>
              )}
            <img
              src={welcome_logo}
              alt="캣챱 캐릭터"
              style={{
                width: 180,
                height: 180,
                display: "block",
              }}
            />
            <p style={{ margin: "40px 0 0 0", fontSize: 18, fontWeight: 700, color: NAVY }}>
            오늘은 어떤 스테이지에 도전할까요?
            </p>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section style={{ marginTop: 64 }}>
          <h2
            style={{
              margin: "0 0 28px",
              fontSize: 23,
              fontWeight: 900,
              letterSpacing: "-0.6px",
              color: NAVY,
              textAlign: "left",
            }}
          >
            캣챱에서 할 수 있어요!
          </h2>
          <div
            className="cc-features"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 20,
            }}
          >
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </section>
      </main>

      <footer style={{ background: "#f2f2ef", borderTop: "1px solid #e2e2da", marginTop: 24 }}>
        <div style={{ padding: "14px 32px", borderBottom: "1px solid #e6e6df", fontSize: 12, color: "#70757a", textAlign: "left" }}>
          대한민국
        </div>
        <div style={{ padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 26 }}>
            <span style={{ fontSize: 12, color: "#70757a" }}>© 2024 Catchap All rights reserved.</span>
            <a href="mailto:contact@catchap.kr" style={{ fontSize: 12, color: "#5f6368", textDecoration: "none" }}>비즈니스</a>
          </div>
          <div style={{ display: "flex", gap: 26 }}>
            <a href="/privacy" style={{ fontSize: 12, color: "#5f6368", textDecoration: "none" }}>이용·개인정보 안내</a>
            <a href="/login" style={{ fontSize: 12, color: "#5f6368", textDecoration: "none" }}>로그인</a>
          </div>
        </div>
      </footer>

      {/* 반응형 + hover */}
      <style>{`
        @media (max-width: 880px) {
          .cc-nav { display: none !important; }
          .cc-hero { grid-template-columns: 1fr !important; }
          .cc-features { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 881px) and (max-width: 1100px) {
          .cc-features { grid-template-columns: 1fr 1fr !important; }
        }
        .cc-feature-card { transition: box-shadow .18s, transform .18s; }
        .cc-feature-card:hover {
          box-shadow: 0 10px 28px rgba(30,58,95,0.08);
          transform: translateY(-3px);
        }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div
      className="cc-feature-card"
      style={{
        background: "#ffffff",
        border: "1px solid #e6e6de",
        borderRadius: 12,
        padding: "26px 24px",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 12,
          background: "#eef5f2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          marginBottom: 16,
        }}
      >
        {icon}
      </div>
      <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: NAVY }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "#65727e" }}>
        {desc}
      </p>
    </div>
  );
}