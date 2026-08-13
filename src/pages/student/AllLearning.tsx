import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../routes/paths';
import { studentApi } from '../../api/students';
import { lectureApi, type StudentCourse } from '../../api/lectures';
import { StudentNav } from '../../layouts/StudentLayout';
import './AllLearning.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 문제은행 — 성인 인강(이수·수료 검증형)으로 재편(2026-07-20).
 *
 * 왜: 종전엔 국어·영어·수학·과학·사회·생활 6과목을 하드코딩하고 '주차별 챕터'(달력 잠금)로
 * 묶은 초등 커리큘럼이었다. 성인 제품에선 문제은행 = **내 코스의 확인문항 연습장**(수료 시험
 * 대비)이다. 과목은 6개 고정이 아니라 **코스가 declare한 자유 라벨**을 그대로 쓴다 — 어학·
 * 자격증 등 어떤 과목 재편도 코드 수정 없이 반영된다(백엔드도 하드코딩 6과목 게이트 제거).
 *
 * 데이터: lectureApi.courses()(코스별 subject·bank_question_count·unlocked·수료시험 요약),
 * studentApi.qToday()(오늘의 Q = SRS 일일 복습). 연습은 GameScreen 코스 스코프
 * (?subject=<코스 과목>&bank=1&course=<코스 id>). 강의 완주 잠금은 서버가 건다.
 */
export default function AllLearning() {
  const [courses, setCourses] = useState<StudentCourse[] | null>(null);
  const [qToday, setQToday] = useState<any>(null);
  const [subjFilter, setSubjFilter] = useState<string>('all');

  useEffect(() => {
    let mounted = true;
    lectureApi
      .courses()
      .then((cs) => {
        if (mounted) setCourses(Array.isArray(cs) ? cs : []);
      })
      .catch(() => mounted && setCourses([]));
    // 오늘의 Q — 일일 복습 목표·연속·큐(실패 시 카드 생략, 가짜 수치 금지)
    studentApi
      .qToday()
      .then((d: any) => {
        if (mounted && d && typeof d.goal === 'number') setQToday(d);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // 과목 필터 — 내 코스에서 동적으로(하드코딩 6과목 아님)
  const subjects = useMemo(() => {
    const s = new Set<string>();
    (courses ?? []).forEach((c) => c.subject && s.add(c.subject));
    return Array.from(s);
  }, [courses]);

  const visibleCourses = (courses ?? []).filter(
    (c) => subjFilter === 'all' || c.subject === subjFilter,
  );

  /* 오늘의 Q 시작 과목 — 만기 많은 과목 우선 → 틀린 것 있는 과목 → 새 문항 많은 과목 */
  const qStartHref = (() => {
    const subs: any[] = qToday?.subjects ?? [];
    if (!subs.length) return null;
    const mostDue = [...subs].sort((a, b) => (b.due ?? 0) - (a.due ?? 0))[0];
    const mostNew = [...subs].sort((a, b) => (b.new ?? 0) - (a.new ?? 0))[0];
    const pick =
      (mostDue?.due ?? 0) > 0 ? mostDue : subs.find((s) => (s.wrong ?? 0) > 0) ?? mostNew;
    if (!pick || ((pick.due ?? 0) === 0 && (pick.wrong ?? 0) === 0 && (pick.new ?? 0) === 0))
      return null;
    return `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(pick.subject)}&bank=1`;
  })();

  const loading = courses === null;

  return (
    <div className="al-root">
      <StudentNav />

      {/* HEADER */}
      <section className="al-header-section">
        <div className="al-header">
          <div className="al-header-left">
            <div>
              <h1 className="al-title">문제은행</h1>
              <p className="al-subtitle">
                수강한 강의의 확인문항으로 연습하고, 오늘의 Q로 복습해 수료 시험을 대비해요.
              </p>
            </div>
          </div>
        </div>

        {/* 오늘의 Q — 일일 복습(SRS). 데이터를 못 받으면 카드 생략(가짜 수치 금지) */}
        {qToday && (
          <div className="al-qcard">
            <div className="al-qcard-left">
              <div className="al-qcard-titlerow">
                <span className="al-qcard-badge">
                  <i className="ph-fill ph-stack" /> 오늘의 Q
                </span>
                {qToday.streak_days > 0 && (
                  <span className="al-qcard-streak" title="일일 목표(10문제) 달성일 연속">
                    🔥 연속 {qToday.streak_days}일
                  </span>
                )}
              </div>
              <div className="al-qcard-counts">
                <span className="al-qcard-count al-qcard-count--due">
                  복습 도착 <b>{qToday.total?.due ?? 0}</b>
                </span>
                <span className="al-qcard-count al-qcard-count--wrong">
                  틀린 문제 <b>{qToday.total?.wrong ?? 0}</b>
                </span>
                <span className="al-qcard-count">
                  새 문제 <b>{qToday.total?.new ?? 0}</b>
                </span>
              </div>
              <div className="al-qcard-goal">
                <div className="al-qcard-goaltrack">
                  <div
                    className="al-qcard-goalfill"
                    style={{ width: `${Math.min(100, Math.round(((qToday.done_today ?? 0) / (qToday.goal || 10)) * 100))}%` }}
                  />
                </div>
                <span className="al-qcard-goaltext">
                  오늘 목표 {Math.min(qToday.done_today ?? 0, qToday.goal ?? 10)}/{qToday.goal ?? 10}
                  {qToday.goal_met ? ' · 달성! 🎉' : ''}
                </span>
              </div>
            </div>
            {qStartHref ? (
              <Link to={qStartHref} className="al-qcard-start">
                {qToday.goal_met ? '더 풀기' : '오늘의 Q 시작'} <i className="ph-bold ph-arrow-right" />
              </Link>
            ) : (
              <span className="al-qcard-done">오늘 복습할 문제를 모두 끝냈어요 ✨</span>
            )}
          </div>
        )}

        {/* 과목 필터 — 내 코스의 과목에서 동적 생성(하드코딩 6과목 아님) */}
        {subjects.length > 1 && (
          <div className="al-chips">
            <button
              onClick={() => setSubjFilter('all')}
              className={`al-chip ${subjFilter === 'all' ? 'al-chip-on' : 'al-chip-off'}`}
            >
              <i className="ph-fill ph-squares-four" /> 전체
            </button>
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubjFilter(s)}
                className={`al-chip ${subjFilter === s ? 'al-chip-on' : 'al-chip-off'}`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 내 코스별 연습 */}
      <section className="al-courses">
        <div className="al-sec-head">
          <h2 className="al-sec-title">
            <i className="ph-fill ph-stack" /> 코스별 연습
          </h2>
        </div>

        {loading && <div className="al-empty">불러오는 중…</div>}
        {!loading && visibleCourses.length === 0 && (
          <div className="al-empty">
            아직 연습할 코스가 없어요. 강의를 수강하면 그 강의의 확인문항을 여기서 연습할 수 있어요.
          </div>
        )}

        {!loading && visibleCourses.length > 0 && (
          <div className="al-course-grid">
            {visibleCourses.map((c) => {
              const total = c.bank_question_count ?? 0;
              const unlocked = c.unlocked_question_count ?? 0;
              const lecturesDone = c.exam?.lectures_done ?? 0;
              const lecturesTotal = c.exam?.lectures_total ?? c.lecture_count;
              const practiceHref = `${PATHS.STUDENT_GAME}?subject=${encodeURIComponent(c.subject)}&bank=1&course=${c.id}`;
              return (
                <article key={c.id} className="al-course">
                  <div className="al-course-top">
                    <span className="al-course-subj">{c.subject}</span>
                    {c.exam?.passed && <span className="al-course-done">수료</span>}
                  </div>
                  <h3 className="al-course-title">{c.title}</h3>
                  {c.instructor_name && (
                    <span className="al-course-inst">{c.instructor_name} 강사</span>
                  )}
                  <div className="al-course-meta">
                    {total > 0 ? (
                      <span>
                        연습 문항 <b>{unlocked}</b>
                        {unlocked < total && <span className="al-course-locked"> / 전체 {total}</span>}
                      </span>
                    ) : (
                      <span className="al-course-none">아직 연습 문제가 없어요</span>
                    )}
                  </div>

                  {!c.enrolled ? (
                    /* 미수강 코스 — 연습·시청 전에 수강신청(구매)이 먼저다. 결제(수강신청) 페이지로
                       보낸다. 구매가 끝나 enrolled=true가 되면(문제은행 재진입 시 재조회) 아래
                       잠금/연습 버튼으로 자연 전환된다. 무료 코스는 문구만 바꾼다. */
                    <Link
                      to={`${PATHS.STUDENT_CHECKOUT}?course=${c.id}`}
                      className="al-course-btn al-course-btn--buy"
                    >
                      <i className={`ph-bold ${c.pricing?.is_free ? 'ph-plus-circle' : 'ph-shopping-cart-simple'}`} />
                      {c.pricing?.is_free ? '무료로 수강신청' : '강의 구매하기'}
                    </Link>
                  ) : unlocked > 0 ? (
                    <Link to={practiceHref} className="al-course-btn">
                      <i className="ph-bold ph-play" /> 연습하기
                    </Link>
                  ) : total > 0 ? (
                    <button className="al-course-btn al-course-btn--lock" disabled>
                      <i className="ph-bold ph-lock-simple" /> 강의를 완주하면 열려요
                      {lecturesTotal > 0 && ` (${lecturesDone}/${lecturesTotal})`}
                    </button>
                  ) : (
                    <Link to={PATHS.STUDENT_LECTURES} className="al-course-btn al-course-btn--ghost">
                      <i className="ph-bold ph-monitor-play" /> 강의 보러 가기
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
