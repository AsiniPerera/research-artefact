/* The usability evaluation as a conversation: a task checklist, then the same
   21 questions as the Google Form it replaces, asked one at a time with
   tap-to-answer chips, then saved anonymously through POST /survey/responses
   (public.usability_responses, which also computes the SUS score). Same look
   as ContactChat: it reuses the `.chat` styles.

   The checklist writes task1_completed .. task5_completed
   (backend/salon_db/28_usability_task_completion.sql). It is asked FIRST, while
   the tasks are still fresh, and it is deliberately separate from q14-q18:
   those record how a feature felt, this records whether the task was finished.

   Answering by keyboard is supported throughout - 1-5 on a rating, 1-9 on a
   choice, Enter to move on, Backspace to go back - because a participant who
   is already typing finds reaching for the mouse 21 times the tiring part. */
import { useCallback, useEffect, useRef, useState } from "react";
import { submitSurvey } from "../api/client";
import { IconArrow } from "./Icons";

const LIKERT = [
  { value: 1, label: "1 · Strongly disagree" },
  { value: 2, label: "2 · Disagree" },
  { value: 3, label: "3 · Neutral" },
  { value: 4, label: "4 · Agree" },
  { value: 5, label: "5 · Strongly agree" },
];

/* The five scenarios every participant is given before the survey. The wording
   matches the printed task sheet, so a participant recognises each line. */
const TASKS = [
  { key: "task1_completed", label: "T-1 · Find businesses offering a service I chose" },
  { key: "task2_completed", label: "T-2 · Tell it which qualities matter most to me" },
  { key: "task3_completed", label: "T-3 · See which business is first, and why" },
  { key: "task4_completed", label: "T-4 · Read what customers said about one quality" },
  { key: "task5_completed", label: "T-5 · Find complaint handling and named staff" },
];

/* `intro` is said before the first question of a section; `cheer` is a one-off
   nudge said before that, at the points where a long survey loses people. */
const QUESTIONS = [
  { key: "tasks", kind: "tasks",
    text: "Tick the ones you managed on your own, then choose Continue. It is absolutely fine to leave some unticked — that is exactly what we need to know.",
    intro: "First, the five tasks you were asked to try." },

  { key: "age_range", kind: "choice", text: "What is your age range?",
    options: ["18–24", "25–34", "35–44", "45+"],
    cheer: "Thank you — that is the most useful answer in the whole survey.",
    intro: "Section 1 of 4 — a little about you." },
  { key: "gender", kind: "choice", text: "What is your gender?",
    options: ["Male", "Female", "Prefer not to say"] },
  { key: "review_use", kind: "choice",
    text: "How often do you use Google Maps or online reviews to find a salon or beauty service?",
    options: ["Never", "Rarely (a few times a year)", "Sometimes (monthly)", "Often (weekly or more)"] },

  { key: "q4", kind: "likert", text: "I think that I would like to use this system frequently.",
    intro: "Section 2 of 4 — ten standard statements. Pick how much you agree. Tip: the number keys 1 to 5 work." },
  { key: "q5", kind: "likert", text: "I found the system unnecessarily complex." },
  { key: "q6", kind: "likert", text: "I thought the system was easy to use." },
  { key: "q7", kind: "likert", text: "I think that I would need the support of a technical person to be able to use this system." },
  { key: "q8", kind: "likert", text: "I found the various functions in this system were well integrated." },
  { key: "q9", kind: "likert", text: "I thought there was too much inconsistency in this system.",
    cheer: "Halfway through this section." },
  { key: "q10", kind: "likert", text: "I would imagine that most people would learn to use this system very quickly." },
  { key: "q11", kind: "likert", text: "I found the system very cumbersome to use." },
  { key: "q12", kind: "likert", text: "I felt very confident using the system." },
  { key: "q13", kind: "likert", text: "I needed to learn a lot of things before I could get going with this system." },

  { key: "q14", kind: "likert", text: "Setting my priority levels for each quality category was clear and easy.",
    cheer: "That is the standard set done. Five more, about this system in particular.",
    intro: "Section 3 of 4 — the features you used during the tasks." },
  { key: "q15", kind: "likert", text: "I could understand why a business was ranked in its position." },
  { key: "q16", kind: "likert",
    text: "The six quality categories I could set priorities for (Quality, Consultation, Trust, Staff, Value, Safety) made sense to me." },
  { key: "q17", kind: "likert",
    text: "If you met a search with no ranked business, the message explaining why was easy to understand. If you never saw one, choose 3 · Neutral." },
  { key: "q18", kind: "likert", text: "The business detail page (scores and review evidence) was useful and informative." },

  { key: "most_useful", kind: "text", text: "What did you find most useful about the system?",
    cheer: "Last stretch — and these three are the ones that change the design.",
    intro: "Section 4 of 4 — in your own words. Skip any you like." },
  { key: "most_confusing", kind: "text", text: "What was the most confusing or difficult part?" },
  { key: "other_comments", kind: "text", text: "Any other comments or suggestions?" },
];

const TOTAL = QUESTIONS.length;
const BOT_DELAY = 350;
const WELCOME = [
  "Thank you for taking part in this usability evaluation.",
  "You have just tried some tasks on this website. I will ask about those, then 21 short questions about how it felt. There are no right or wrong answers — we are testing the system, not you.",
  "About 3 to 5 minutes, and it is completely anonymous.",
];

/* Said after an answer, in rotation, so twenty-two steps do not read like a
   form. Short on purpose: an acknowledgement that takes a line to read stops
   being an acknowledgement. */
const NODS = ["Got it.", "Noted.", "Thanks.", "Understood.", "Logged."];

const answerLabel = (q, v) =>
  q.kind === "likert" ? LIKERT.find((l) => l.value === v)?.label : v || "Skipped";

const taskSummary = (a) => {
  const done = TASKS.filter((t) => a[t.key]).length;
  if (done === TASKS.length) return "You managed all five tasks on your own.";
  if (done === 0) return "You did not finish any of the five unaided — that is a finding, not a failure.";
  return `You managed ${done} of the five tasks on your own.`;
};

export function SurveyChat() {
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(-1);          // -1 = welcome, 0..TOTAL-1 = question, TOTAL = review
  const [answers, setAnswers] = useState({});
  const [status, setStatus] = useState("asking");  // asking | sending | done | error
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [ticked, setTicked] = useState([]);        // task keys chosen on the checklist step
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const timers = useRef([]);

  const later = (fn) => { setTyping(true); timers.current.push(setTimeout(() => { setTyping(false); fn(); }, BOT_DELAY)); };
  const bot = (...texts) => setMessages((m) => [...m, ...texts.map((text) => ({ from: "bot", text }))]);

  const ask = useCallback((i, extra = []) => {
    later(() => {
      if (i >= TOTAL) {
        bot(...extra, "That is everything — thank you for staying with it.",
            "Your answers are anonymous and are not linked to you in any way.",
            "Ready to submit?");
      } else {
        const q = QUESTIONS[i];
        bot(...extra,
            ...(q.cheer ? [q.cheer] : []),
            ...(q.intro ? [q.intro] : []),
            q.text);
      }
      setIndex(i);
    });
  }, []);

  function start() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]); setAnswers({}); setDraft(""); setTicked([]);
    setStatus("asking"); setIndex(-1);
    later(() => { bot(...WELCOME); setIndex(-1); });
  }

  useEffect(() => { start(); return () => timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [messages, typing]);
  useEffect(() => {
    if (QUESTIONS[index]?.kind === "text" && !typing) inputRef.current?.focus();
  }, [index, typing]);

  const answer = useCallback((value) => {
    const q = QUESTIONS[index];
    const said = q.kind === "tasks" ? taskSummary(value) : answerLabel(q, value);
    setMessages((m) => [...m, { from: "user", text: said, q: index }]);
    setAnswers((a) => (q.kind === "tasks" ? { ...a, ...value } : { ...a, [q.key]: value }));
    setDraft("");
    // A nod every third step: often enough to feel answered, rare enough to
    // stay out of the way.
    const nod = index > 0 && index % 3 === 0 ? [NODS[(index / 3) % NODS.length]] : [];
    ask(index + 1, nod);
  }, [index, ask]);

  /* Commit the checklist: every task is recorded, ticked ones true and the
     rest false, so an unticked box is a real "no" rather than a missing value. */
  const commitTasks = useCallback(() => {
    answer(Object.fromEntries(TASKS.map((t) => [t.key, ticked.includes(t.key)])));
  }, [answer, ticked]);

  /* Step back one question: drop everything said since it was asked. */
  const back = useCallback(() => {
    const prev = index - 1;
    if (prev < 0 || typing) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages((m) => {
      const cut = m.findIndex((x) => x.from === "user" && x.q === prev);
      return cut === -1 ? m : m.slice(0, cut);
    });
    const q = QUESTIONS[prev];
    setAnswers((a) => {
      const n = { ...a };
      if (q.kind === "tasks") TASKS.forEach((t) => delete n[t.key]);
      else delete n[q.key];
      return n;
    });
    setIndex(prev);
  }, [index, typing]);

  async function submit() {
    setStatus("sending");
    try {
      const res = await submitSurvey(answers);
      setStatus("done");
      bot("Thank you — your response has been recorded.",
          `Reference number: ${res?.id ?? "—"}. Quote it if you ever want this response removed.`);
    } catch (e) {
      setStatus("error");
      bot(`Sorry, that did not save (${e.message}). Nothing was lost — your answers are still here, so you can try again.`);
    }
  }

  const q = QUESTIONS[index];
  const answered = Math.max(0, Math.min(index, TOTAL));
  const canBack = index > 0 && index <= TOTAL && status === "asking" && !typing;
  const textOpen = q?.kind === "text" && !typing && status === "asking";

  /* Keyboard: numbers answer, Enter advances, Backspace steps back. Ignored
     while a text answer is being typed, so the free-text boxes behave. */
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (typing || status === "sending") return;
      const n = Number(e.key);
      if (e.key === "Enter") {
        if (index === -1) { e.preventDefault(); ask(0); }
        else if (index >= TOTAL) { e.preventDefault(); if (status !== "done") submit(); }
        else if (q?.kind === "tasks") { e.preventDefault(); commitTasks(); }
        return;
      }
      if (e.key === "Backspace" && canBack) { e.preventDefault(); back(); return; }
      if (!n || status !== "asking" || !q) return;
      if (q.kind === "likert" && n >= 1 && n <= 5) { e.preventDefault(); answer(n); }
      else if (q.kind === "choice" && n >= 1 && n <= q.options.length) { e.preventDefault(); answer(q.options[n - 1]); }
      else if (q.kind === "tasks" && n >= 1 && n <= TASKS.length) {
        e.preventDefault();
        const key = TASKS[n - 1].key;
        setTicked((t) => (t.includes(key) ? t.filter((k) => k !== key) : [...t, key]));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, q, typing, status, canBack, answer, back, ask, commitTasks]);

  const chips =
    typing || status === "sending" ? [] :
    status === "done" ? [] :
    status === "error" ? [{ label: "Try again", primary: true, onClick: submit }] :
    index === -1 ? [{ label: "Start the survey", primary: true, onClick: () => ask(0) }] :
    index >= TOTAL ? [{ label: "Submit answers", primary: true, onClick: submit }] :
    q.kind === "tasks" ? [
      ...TASKS.map((t) => ({
        label: t.label, on: ticked.includes(t.key),
        onClick: () => setTicked((s) => (s.includes(t.key) ? s.filter((k) => k !== t.key) : [...s, t.key])),
      })),
      { label: ticked.length ? `Continue with ${ticked.length} ticked` : "Continue — none of them",
        primary: true, onClick: commitTasks },
    ] :
    q.kind === "choice" ? q.options.map((o) => ({ label: o, onClick: () => answer(o) })) :
    q.kind === "likert" ? LIKERT.map((l) => ({ label: l.label, onClick: () => answer(l.value) })) :
    [{ label: "Skip", onClick: () => answer("") }];

  return (
    <div className="chat survey-chat">
      <header className="chat-head">
        <span className="chat-avatar" aria-hidden="true">A</span>
        <div>
          <p className="chat-title">Usability evaluation</p>
          <p className="chat-status">Anonymous · about 3–5 minutes · number keys work</p>
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
        <div className={`chat-chips ${q?.kind === "likert" ? "survey-likert" : ""} ${q?.kind === "tasks" ? "survey-tasks" : ""}`}>
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              className={`chat-chip ${c.primary ? "is-primary" : ""} ${c.on ? "is-on" : ""}`}
              aria-pressed={c.on === undefined ? undefined : c.on}
              onClick={c.onClick}
            >
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
