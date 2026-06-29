import React, { useState } from "react";
import { Link } from 'react-router-dom'
import logo from '../../assets/logo.png'

const ACCENT = "#4a9b8e";
const NAVY = "#1e3a5f";
const FONT = "'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif";

const NAV = [
  { label: "서비스 소개", href: "/Service", active: false },
  { label: "학교·기관 안내", href: "/schoolpage", active: false },
  { label: "로그인", href: "/login", active: true },
];

const ROLES = [
  { icon: "🐣", title: "학생", desc: "닉네임 또는 학급 코드로 로그인" },
  { icon: "👨‍👩‍👦", title: "학부모", desc: "연결된 자녀의 학습 확인" },
  { icon: "🏫", title: "학교·기관", desc: "멤버·학급·콘텐츠·연동 관리" },
];

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
  textAlign: "left",
};

/**
 * CatChap 로그인
 *
 * @param {object} props
 * @param {string} [props.logoSrc]   헤더 로고 이미지 경로
 * @param {(payload: {role: number, id: string, password: string}) => void} [props.onSubmit]
 */
export default function Login({ logoSrc = logo, onSubmit }) {
  const [selected, setSelected] = useState(0);
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(null);

  const fieldStyle = (name, extra = {}) => ({
    width: "100%",
    padding: "13px 14px",
    border: `1px solid ${focused === name ? ACCENT : "#d8dde1"}`,
    borderRadius: 10,
    fontSize: 14,
    color: NAVY,
    outline: "none",
    fontFamily: "inherit",
    background: "#ffffff",
    boxSizing: "border-box",
    textAlign: "left",
    ...extra,
  });

  const roleCardStyle = (i) => ({
    borderRadius: 12,
    padding: "18px 16px",
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color .15s, box-shadow .15s",
    background: selected === i ? "#eef5f2" : "#ffffff",
    border: selected === i ? `1.5px solid ${ACCENT}` : "1px solid #e6e6de",
    boxShadow: selected === i ? "0 2px 10px rgba(74,155,142,0.15)" : "none",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ role: selected, id, password });
  };

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
      <main
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "64px 32px",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{
            width: "100%",
            maxWidth: 580,
            background: "#ffffff",
            border: "1px solid #e6e6de",
            borderRadius: 16,
            padding: 40,
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 28,
              fontWeight: 1000,
              letterSpacing: "-0.6px",
              textAlign: "left",
              color: NAVY,
            }}
          >
            로그인
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: 15, color: "#52606d", textAlign: "left" }}>
            이용하는 화면을 선택하고 로그인해 주세요.
          </p>

          {/* 역할 선택 */}
          <div
            className="cc-roles"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              marginBottom: 24,
            }}
          >
            {ROLES.map((r, i) => (
              <div key={r.title} onClick={() => setSelected(i)} style={roleCardStyle(i)}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>{r.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                  {r.title}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.45, color: "#65727e" }}>
                  {r.desc}
                </div>
              </div>
            ))}
          </div>

          {/* 이메일 또는 아이디 */}
          <label style={labelStyle}>이메일 또는 아이디</label>
          <input
            type="text"
            placeholder="이메일 또는 아이디"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onFocus={() => setFocused("id")}
            onBlur={() => setFocused(null)}
            style={fieldStyle("id", { marginBottom: 18 })}
          />

          {/* 비밀번호 */}
          <label style={labelStyle}>비밀번호</label>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            style={fieldStyle("password", { marginBottom: 22 })}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: 14,
              border: "none",
              borderRadius: 10,
              background: ACCENT,
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            로그인
          </button>

            <div style={{ marginTop: 18 }}>
            <Link
                to="/ResetPassword"
                style={{
                fontSize: 14,
                fontWeight: 700,
                color: ACCENT,
                textDecoration: "none",
                }}
            >
                비밀번호 찾기
            </Link>
            </div>
        </form>
      </main>

      <style>{`
        @media (max-width: 880px) { .cc-nav { display: none !important; } }
        @media (max-width: 560px) { .cc-roles { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}