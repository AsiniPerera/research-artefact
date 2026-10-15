/* The usability evaluation as a conversation: the same 21 questions as the
   Google Form it replaces, asked one at a time with tap-to-answer chips, then
   saved anonymously through POST /survey/responses (public.usability_responses,
   which also computes the SUS score). Same look as ContactChat: it reuses the
   `.chat` styles. */
import { useEffect, useRef, useState } from "react";
import { submitSurvey } from "../api/client";
import { IconArrow } from "./Icons";

const LIKERT = [
  { value: 1, label: "1 · Strongly disagree" },
  { value: 2, label: "2 · Disagree" },
  { value: 3, label: "3 · Neutral" },
  { value: 4, label: "4 · Agree" },
  { value: 5, label: "5 · Strongly agree" },
];

/* `intro` is said before the first question of a section. */
const QUESTIONS = [
  { key: "age_range", kind: "choice", text: "What is your age range?",
    options: ["18–24", "25–34", "35–44", "45+"],
    intro: "Section 1 of 4 — a little about you." },
  { key: "gender", kind: "choice", text: "What is your gender?",
    options: ["Male", "Female", "Prefer not to say"] },
  { key: "review_use", kind: "choice",
    text: "How often do you use Google Maps or online reviews to find a salon or beauty service?",
    options: ["Never", "Rarely (a few times a year)", "Sometimes (monthly)", "Often (weekly or more)"] },

  { key: "q4", kind: "likert", text: "I think that I would like to use this system frequently.",
    intro: "Section 2 of 4 — ten statements about the system you just used. Pick how much you agree with each." },
  { key: "q5", kind: "likert", text: "I found the system unnecessarily complex." },
  { key: "q6", kind: "likert", text: "I thought the system was easy to use." },
  { key: "q7", kind: "likert", text: "I think that I would need the support of a technical person to be able to use this system." },
  { key: "q8", kind: "likert", text: "I found the various functions in this system were well integrated." },
  { key: "q9", kind: "likert", text: "I thought there was too much inconsistency in this system." },
  { key: "q10", kind: "likert", text: "I would imagine that most people would learn to use this system very quickly." },
  { key: "q11", kind: "likert", text: "I found the system very cumbersome to use." },
  { key: "q12", kind: "likert", text: "I felt very confident using the system." },
  { key: "q13", kind: "likert", text: "I needed to learn a lot of things before I could get going with this system." },

  { key: "q14", kind: "likert", text: "Setting my priority levels for each quality category was clear and easy.",
    intro: "Section 3 of 4 — about the features you used during the tasks." },
  { key: "q15", kind: "likert", text: "I could understand why a business was ranked in its position." },
  { key: "q16", kind: "likert",
    text: "The seven quality categories (Quality, Consultation, Management Response, Trust, Staff, Value, Safety) made sense to me." },
  { key: "q17", kind: "likert", text: "When no ranked business was available, the fallback message was easy to understand." },
  { key: "q18", kind: "likert", text: "The business detail page (scores and review evidence) was useful and informative." },

  { key: "most_useful", kind: "text", text: "What did you find most useful about the system?",
    intro: "Section 4 of 4 — three short questions in your own words. You can skip any of them." },
  { key: "most_confusing", kind: "text", text: "What was the most confusing or difficult part?" },
  { key: "other_comments", kind: "text", text: "Any other comments or suggestions?" },
];

const TOTAL = QUESTIONS.length;
const BOT_DELAY = 350;
const WELCOME = [
  "Thank you for taking part in this usability evaluation.",
  "You have just completed some tasks on this website. I'll ask 21 short questions about your experience. There are no right or wrong answers — we are testing the system, not you.",
  "It takes about 3–5 minutes, and it's anonymous.",
];

const answerLabel = (q, v) =>
  q.kind === "likert" ? LIKERT.find((l) => l.value === v)?.label : v || "Skipped";

export function SurveyChat() {
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(-1);          // -1 = welcome, 0..20 = question, TOTAL = review
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("asking");  // asking | sending | done | error
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const timers = useRef([]);

  const later = (fn) => { setTyping(true); timers.current.push(setTimeout(() => { setTyping(false); fn(); }, BOT_DELAY)); };
  const bot = (...texts) => setMessages((m) => [...m, ...texts.map((text) => ({ from: "bot", text }))]);

  function ask(i, extra = []) {
    later(() => {
      if (i >= TOTAL) {
        bot(...extra, "That's everything. Ready to submit your answers?");
      } else {
        const q = QUESTIONS[i];
        bot(...extra, ...(q.intro ? [q.intro] : []), q.text);
      }
      setIndex(i);
    });
  }

  function start() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]); setAnswers({}); setDraft(""); setStatus("asking"); setIndex(-1);
    later(() => { bot(...WELCOME); setIndex(-1); });
  }

  useEffect(() => { start(); return () => timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, typing]);
  useEffect(() => {
    if (QUESTIONS[index]?.kind === "text" && !typing) inputRef.current?.focus();
  }, [index, typing]);

  function answer(value) {
    const q = QUESTIONS[index];
    setMessages((m) => [...m, { from: "user", text: answerLabel(q, value), q: index }]);
    setAnswers((a) => ({ ...a, [q.key]: value }));
    setDraft("");
    ask(index + 1);
  }

  /* Step back one question: drop everything said since it was asked. */
  function back() {
    const prev = index - 1;
    if (prev < 0 || typing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages((m) => {
      const cut = m.findIndex((x) => x.from === "user" && x.q === prev);
      return cut === -1 ? m : m.slice(0, cut);
    });
    setAnswers((a) => { const n = { ...a }; delete n[QUESTIONS[prev].key]; return n; });
    setIndex(prev);
  }

  async function submit() {
    setStatus("sending");
    try {
      const res = await submitSurvey(answers);
      setStatus("done");
      bot("Thank you for your feedback! Your response has been recorded.",
          `Reference number: ${res?.id ?? "—"}.`);
    } catch (e) {
      setStatus("error");
      bot(`Sorry, that didn't save (${e.message}). Please try again.`);
    }
  }

  const q = QUESTIONS[index];
  const answered = Math.min(Object.keys(answers).length, TOTAL);
  const canBack = index > 0 && index <= TOTAL && status === "asking" && !typing;

  const chips =
    typing || status === "sending" ? [] :
    status === "done" ? [] :
    status === "error" ? [{ label: "Try again", primary: true, onClick: submit }] :
    index === -1 ? [{ label: "Start the survey", primary: true, onClick: () => ask(0) }] :
    index >= TOTAL ? [{ label: "Submit answers", primary: true, onClick: submit }] :
    q.kind === "choice" ? q.options.map((o) => ({ label: o, onClick: () => answer(o) })) :
    q.kind === "likert" ? LIKERT.map((l) => ({ label: l.label, onClick: () => answer(l.value) })) :
    [{ label: "Skip", onClick: () => answer("") }];

  const textOpen = q?.kind === "text" && !typing && status === "asking";

  return (
    <div className="chat survey-chat">
      <header className="chat-head">
        <span className="chat-avatar" aria-hidden="true">A</span>
        <div>
          <p className="chat-title">Usability evaluation</p>
          <p className="chat-status">Anonymous · about 3–5 minutes</p>
        </div>
      </header>

      <div className="survey-progress" aria-label={`${answered} of ${TOTAL} answered`}>
        <span style={{ width: `calc((100% - 5.75rem) * ${answered / TOTAL})` }} />
        <em>{status === "done" ? "Complete" : `${answered} / ${TOTAL}`}</em>
      </div>

      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.from}`}><p>{m.text}</p></div>
        ))}
        {typing && (
          <div className="chat-msg chat-msg--bot chat-typing" aria-label="Assistant is typing">
            <span /><span /><span />
          </div>
        )}
      </div>

      {(chips.length > 0 || canBack) && (
        <div className={`chat-chips ${q?.kind === "likert" ? "survey-likert" : ""}`}>
          {chips.map((c) => (
            <button key={c.label} type="button" className={`chat-chip ${c.primary ? "is-primary" : ""}`} onClick={c.onClick}>
              {c.label}
            </button>
          ))}
          {canBack && (
            <button type="button" className="chat-chip survey-back" onClick={back}>← Back</button>
          )}
        </div>
      )}

      <form className="chat-input" noValidate
            onSubmit={(e) => { e.preventDefault(); if (textOpen && draft.trim()) answer(draft.trim()); }}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={textOpen ? "Type your answer…" : status === "done" ? "Response saved" : "Choose an option above"}
          disabled={!textOpen}
          maxLength={2000}
          aria-label="Your answer"
        />
        <button type="submit" className="chat-send" disabled={!textOpen || !draft.trim()} aria-label="Send answer">
          <IconArrow size={16} />
        </button>
      </form>
    </div>
  );
}
