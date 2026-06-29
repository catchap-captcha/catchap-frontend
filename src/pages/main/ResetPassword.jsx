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

const inputBase = {
  padding: "13px 14px",
  border: "1px solid #d8dde1",
  borderRadius: 10,
  fontSize: 14,
  color: NAVY,
  outline: "none",
  fontFamily: "inherit",
  background: "#ffffff",  // 이거 추가
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
  textAlign: "left",
};

/**
 * CatChap 비밀번호 재설정
 *
 * @param {object} props
 * @param {string} [props.logoSrc]   헤더 로고 이미지 경로
 * @param {(payload: {email: string, code: string, password: string}) => void} [props.onSubmit]
 * @param {(email: string) => void} [props.onSendCode]
 */
export default function ResetPassword({
  logoSrc = logo,
  onSubmit,
  onSendCode,
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [focused, setFocused] = useState(null);

  const fieldStyle = (name) => ({
    ...inputBase,
    borderColor: focused === name ? ACCENT : "#d8dde1",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ email, code, password });
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
            maxWidth: 660,
            background: "#ffffff",
            border: "1px solid #e6e6de",
            borderRadius: 16,
            padding: 44,
          }}
        >
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 28,
              fontWeight: 1000,
              letterSpacing: "-0.6px",
              color: NAVY,
              textAlign: "left",
            }}
          >
            비밀번호 재설정
          </h1>
          <p style={{ margin: "0 0 26px", fontSize: 15, color: "#52606d", textAlign: "left" }}>
            가입한 이메일로 확인 코드를 보내드려요.
          </p>

          {/* 이메일 + 코드 받기 */}
          <label style={labelStyle}>이메일</label>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              style={{ ...fieldStyle("email"), flex: 1 }}
            />
            <button
              type="button"
              onClick={() => onSendCode?.(email)}
              style={{
                padding: "0 18px",
                border: "1px solid #cfd6da",
                borderRadius: 10,
                background: "#eef1f3",
                color: NAVY,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "inherit",
                cursor: "pointer",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              코드
              <br />
              받기
            </button>
          </div>

          {/* 확인 코드 */}
          <label style={labelStyle}>확인 코드</label>
          <input
            type="text"
            placeholder="6자리 코드"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onFocus={() => setFocused("code")}
            onBlur={() => setFocused(null)}
            style={{ ...fieldStyle("code"), width: "100%", marginBottom: 20 }}
          />

          {/* 새 비밀번호 */}
          <label style={labelStyle}>새 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={() => setFocused("password")}
            onBlur={() => setFocused(null)}
            style={{ ...fieldStyle("password"), width: "100%", marginBottom: 26 }}
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
            변경 완료
          </button>
        </form>
      </main>

      <style>{`
        @media (max-width: 880px) { .cc-nav { display: none !important; } }
      `}</style>
    </div>
  );
}