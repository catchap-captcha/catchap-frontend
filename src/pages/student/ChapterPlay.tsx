import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { client } from '../../api/client';
import { studentApi } from '../../api/students';
import { PATHS } from '../../routes/paths';
import './ChapterPlay.css';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * ChapterPlay — 전체학습 주간 챕터의 '한 단계(2문항)' 자체 완결 플레이.
 *
 * 오늘의 퀴즈(습관·연속도전)와 분리된 '학습' 축. 문항 발급/채점은 서버(chapter-session /
 * game-answer)가 하고, game-answer에 chapter_no/stage를 실어 (a) 오늘의퀴즈는 건드리지 않고
 * (b) 단계 마지막 문항에서 stages_done 커서를 전진시킨다(이어하기 저장). 잠긴 챕터는 서버가 막는다.
 */

const SUBJECT_COLORS: Record<string, { c1: string; c2: string; icon: string }> = {
  국어: { c1: '#FF7A7A', c2: '#FF5A6E', icon: 'ph-fill ph-book-open' },
  영어: { c1: '#FFB43C', c2: '#FF922E', icon: 'ph-fill ph-translate' },
  수학: { c1: '#33C892', c2: '#17B0A0', icon: 'ph-fill ph-plus-minus' },
  과학: { c1: '#4AA6FF', c2: '#2E7BFF', icon: 'ph-fill ph-flask' },
  역사: { c1: '#A98CFF', c2: '#8B6BFF', icon: 'ph-fill ph-scroll' },
  생활: { c1: '#FF93BE', c2: '#FF6DA6', icon: 'ph-fill ph-house-line' },
};

interface Option {
  id: string;
  text?: string;
  emoji?: string;
}
interface Question {
  id: string;
  type: string; // single | multi
  prompt: string;
  hint?: string;
  options: Option[];
  audio?: string;
}
interface Session {
  available: boolean;
  locked?: boolean;
  subject: string;
  chapter: number;
  stage: number;
  stages: number;
  stages_done: number;
  is_replay: boolean;
  questions: Question[];
}
interface Feedback {
  correct: boolean;
  answer_ids: string[];
  answer_text: string;
  hint?: string;
  coins_earned: number;
  stages_done: number | null;
}

export default function ChapterPlay() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const subject = sp.get('subject') || '수학';
  const chapter = Math.max(1, Number(sp.get('chapter')) || 1);
  const stageParam = sp.get('stage') ? Number(sp.get('stage')) : undefined;
  const color = SUBJECT_COLORS[subject] || SUBJECT_COLORS['수학'];

  const [sess, setSess] = useState<Session | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [qi, setQi] = useState(0); // 현재 문항 index (0..questions-1)
  const [picked, setPicked] = useState<string[]>([]); // 선택한 option id (multi=복수)
  const [fb, setFb] = useState<Feedback | null>(null); // 채점 결과(있으면 피드백 표시)
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState(false);
  const [done, setDone] = useState(false); // 단계 완료 화면
  const [finalStages, setFinalStages] = useState<number | null>(null);
  const startedAt = useRef<number>(0);

  const load = useCallback(() => {
    setSess(null);
    setLoadErr(null);
    setQi(0);
    setPicked([]);
    setFb(null);
    setDone(false);
    studentApi
      .chapterSession(subject, chapter, stageParam)
      .then((d: Session) => {
        if (d.locked) {
          setLoadErr('아직 잠긴 챕터예요. 다음 주 월요일에 열려요!');
          return;
        }
        if (!d.available || !d.questions?.length) {
          setLoadErr('이 단계는 아직 준비 중이에요.');
          return;
        }
        setSess(d);
        startedAt.current = Date.now();
      })
      .catch(() => setLoadErr('문제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'));
    // stageParam은 URL 고정값 — 재조회는 subject/chapter 변화 시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, chapter]);

  useEffect(() => {
    load();
  }, [load]);

  if (loadErr) {
    return (
      <div className="cp-root">
        <div className="cp-msgcard">
          <i className="ph-fill ph-lock-simple cp-msgicon" />
          <p className="cp-msgtext">{loadErr}</p>
          <Link to={PATHS.STUDENT_ALL_LEARNING} className="cp-btn cp-btn-primary">
            전체 학습으로
          </Link>
        </div>
      </div>
    );
  }
  if (!sess) {
    return (
      <div className="cp-root">
        <div className="cp-msgcard">
          <i className="ph-fill ph-spinner cp-spin cp-msgicon" />
          <p className="cp-msgtext">문제를 불러오는 중…</p>
        </div>
      </div>
    );
  }

  const q = sess.questions[qi];
  const isMulti = q.type === 'multi';
  const isLastQuestion = qi >= sess.questions.length - 1;

  const toggle = (oid: string) => {
    if (fb) return; // 채점 후엔 선택 잠금
    if (isMulti) {
      setPicked((p) => (p.includes(oid) ? p.filter((x) => x !== oid) : [...p, oid]));
    } else {
      setPicked([oid]);
    }
  };

  const submit = () => {
    if (submitting || fb || picked.length === 0) return;
    setSubmitting(true);
    setSubmitErr(false);
    studentApi
      .gameAnswer({
        question_id: q.id,
        subject,
        option_id: isMulti ? '' : picked[0],
        option_ids: isMulti ? picked : undefined,
        chapter_no: chapter,
        stage: sess.stage,
        last: isLastQuestion,
        replay: sess.is_replay,
      })
      .then((r: Feedback) => {
        setFb(r);
        setSubmitting(false);
        if (isLastQuestion && typeof r.stages_done === 'number') setFinalStages(r.stages_done);
      })
      .catch(() => {
        // 저장 실패를 삼키지 않는다 — 가짜 성공 금지, 재시도 유도
        setSubmitting(false);
        setSubmitErr(true);
      });
  };

  const next = () => {
    if (isLastQuestion) {
      setDone(true);
      return;
    }
    setQi((i) => i + 1);
    setPicked([]);
    setFb(null);
    setSubmitErr(false);
  };

  // ---- 단계 완료 화면 ----
  if (done) {
    const filled = finalStages ?? sess.stages_done;
    const chapterCleared = filled >= sess.stages;
    const nextStage = sess.stage + 1;
    return (
      <div className="cp-root" style={{ ['--cp-c1' as any]: color.c1, ['--cp-c2' as any]: color.c2 }}>
        <div className="cp-donecard">
          <i className={`ph-fill ${chapterCleared ? 'ph-trophy' : 'ph-star'} cp-doneicon`} />
          <h2 className="cp-donetitle">
            {sess.stage}단계 완료!{sess.is_replay ? ' (복습)' : ''}
          </h2>
          <div className="cp-segs cp-segs-lg">
            {Array.from({ length: sess.stages }, (_, i) => (
              <div key={i} className={`cp-seg${i < filled ? ' cp-seg-on' : ''}`} />
            ))}
          </div>
          <p className="cp-donesub">
            {chapterCleared
              ? `${chapter}주차 챕터를 모두 마쳤어요! 다음 챕터는 다음 주 월요일에 열려요.`
              : `${sess.stages}단계 중 ${filled}단계 완료`}
          </p>
          <div className="cp-doneactions">
            {!chapterCleared && nextStage <= sess.stages && (
              <button
                className="cp-btn cp-btn-primary"
                onClick={() => {
                  // 다음 단계 이어하기 — stage 미지정 재조회(서버가 다음 미완료 단계 반환)
                  navigate(
                    `${PATHS.STUDENT_CHAPTER_PLAY}?subject=${encodeURIComponent(subject)}&chapter=${chapter}`,
                  );
                  // 같은 라우트라 useSearchParams는 그대로 → 강제 리로드
                  setTimeout(load, 0);
                }}
              >
                다음 단계 <i className="ph-bold ph-arrow-right" />
              </button>
            )}
            <Link to={PATHS.STUDENT_ALL_LEARNING} className="cp-btn cp-btn-ghost">
              전체 학습으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- 문항 플레이 ----
  return (
    <div className="cp-root" style={{ ['--cp-c1' as any]: color.c1, ['--cp-c2' as any]: color.c2 }}>
      <div className="cp-top">
        <Link to={PATHS.STUDENT_ALL_LEARNING} className="cp-back">
          <i className="ph-bold ph-arrow-left" /> 그만두기
        </Link>
        <div className="cp-topmid">
          <span className="cp-tag">
            <i className={color.icon} /> {subject}
          </span>
          <span className="cp-chap">
            {chapter}주차 · {sess.stage}단계{sess.is_replay ? ' (복습)' : ''}
          </span>
        </div>
        <span className="cp-count">
          {qi + 1} / {sess.questions.length}
        </span>
      </div>

      {/* 챕터 5단계 진행 바 (홈/전체학습과 같은 세그먼트) */}
      <div className="cp-segs">
        {Array.from({ length: sess.stages }, (_, i) => (
          <div
            key={i}
            className={`cp-seg${i < sess.stages_done ? ' cp-seg-on' : ''}${i === sess.stage - 1 ? ' cp-seg-cur' : ''}`}
          />
        ))}
      </div>

      <div className="cp-card">
        <p className="cp-prompt">{q.prompt}</p>
        {q.audio && (
          <audio
            className="cp-audio"
            controls
            src={`${client.defaults.baseURL}/captcha/v1/audio/${q.audio}`}
          >
            오디오를 재생할 수 없어요.
          </audio>
        )}
        {isMulti && <p className="cp-multihint">여러 개일 수 있어요 — 맞는 걸 모두 골라요.</p>}

        <div className="cp-options">
          {q.options.map((o) => {
            const sel = picked.includes(o.id);
            const isAnswer = fb?.answer_ids?.includes(o.id);
            const wrongPick = fb && sel && !isAnswer;
            return (
              <button
                key={o.id}
                className={
                  'cp-opt' +
                  (sel ? ' cp-opt-sel' : '') +
                  (fb && isAnswer ? ' cp-opt-correct' : '') +
                  (wrongPick ? ' cp-opt-wrong' : '')
                }
                onClick={() => toggle(o.id)}
                disabled={!!fb}
              >
                {o.emoji && <span className="cp-opt-emoji">{o.emoji}</span>}
                {o.text && <span className="cp-opt-text">{o.text}</span>}
                {fb && isAnswer && <i className="ph-fill ph-check cp-opt-mark" />}
                {wrongPick && <i className="ph-fill ph-x cp-opt-mark" />}
              </button>
            );
          })}
        </div>

        {/* 피드백 */}
        {fb && (
          <div className={`cp-fb ${fb.correct ? 'cp-fb-ok' : 'cp-fb-no'}`}>
            <div className="cp-fb-head">
              <i className={`ph-fill ${fb.correct ? 'ph-smiley' : 'ph-smiley-meh'}`} />
              {fb.correct ? '정답이에요!' : `아쉬워요 — 정답은 "${fb.answer_text}"`}
              {fb.correct && fb.coins_earned > 0 && (
                <span className="cp-coins">+{fb.coins_earned}🪙</span>
              )}
            </div>
            {fb.hint && <p className="cp-fb-hint">{fb.hint}</p>}
          </div>
        )}

        {submitErr && (
          <p className="cp-submiterr">저장에 실패했어요. 다시 눌러 주세요.</p>
        )}

        {/* 액션 */}
        {!fb ? (
          <button
            className="cp-btn cp-btn-primary cp-btn-wide"
            onClick={submit}
            disabled={submitting || picked.length === 0}
          >
            {submitting ? '채점 중…' : '확인'}
          </button>
        ) : (
          <button className="cp-btn cp-btn-primary cp-btn-wide" onClick={next}>
            {isLastQuestion ? '단계 완료' : '다음 문제'} <i className="ph-bold ph-arrow-right" />
          </button>
        )}
      </div>
    </div>
  );
}
