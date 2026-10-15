/* The Contact page's chat assistant. A scripted conversation, not an AI: it
   asks for the same five fields the old form had (topic, message, name,
   email, optional phone), shows them back for confirmation, then saves them
   through the same endpoint (backend/api/contact.py -> contact_inquiries).
   Every conversation that reaches "Send" is stored; the saved row's id is
   shown as a reference number. A signed-in user is not asked for a name or
   email the app already knows. */
import { useEffect, useRef, useState } from "react";
import { submitInquiry } from "../api/client";
import { IconArrow } from "./Icons";

const REASONS = ["General enquiry", "List your salon", "Feedback", "Something went wrong"];

/* What the assistant asks next, after each topic. */
const ASK_MESSAGE = {
  "General enquiry": "Sure. What would you like to ask?",
  "List your salon": "Great! Tell us the salon's name, its area, and the services it offers.",
  Feedback: "We'd love to hear it. What's on your mind?",
  "Something went wrong": "Sorry about that. What happened, and on which page or salon?",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+\-()]{7,15}$/;
const BOT_DELAY = 450;

const PLACEHOLDER = {
  message: "Type your message…",
  name: "Your name",
  email: "you@example.com",
  phone: "+94 77 000 0000",
};

export function ContactChat({ token, user }) {
  const knownName = user?.full_name?.trim() || "";
  const knownEmail = user?.email?.trim() || "";

  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState("topic");      // topic | message | name | email | phone | review | sending | done | error
  const [form, setForm] = useState({ reason: "", message: "", name: knownName, email: knownEmail, phone: "" });
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [refId, setRefId] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);
  const timers = useRef([]);

  /* Bot lines arrive after a short "typing" pause so the exchange reads as a
     conversation rather than a wall of text. */
  const say = (lines, after) => {
    setTyping(true);
    const t = setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, ...lines.map((text) => ({ from: "bot", text }))]);
      after?.();
    }, BOT_DELAY);
    timers.current.push(t);
  };
  const userSays = (text) => setMessages((m) => [...m, { from: "user", text }]);

  const start = () => {
    setMessages([]);
    setForm({ reason: "", message: "", name: knownName, email: knownEmail, phone: "" });
    setRefId(null);
    setStep("topic");
    say([
      knownName ? `Hi ${knownName.split(" ")[0]}, I'm the Amore help assistant.` : "Hi, I'm the Amore help assistant.",
      "What can I help you with today?",
    ]);
  };

  useEffect(() => {
    start();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Keep the newest line in view, scrolling the log only (never the page). */
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (["message", "name", "email", "phone"].includes(step) && !typing) inputRef.current?.focus();
  }, [step, typing]);

  /* After the message: ask for whatever is still unknown, in order. */
  const askNext = (f) => {
    if (!f.name) { setStep("name"); say(["Thanks. What's your name?"]); return; }
    if (!f.email) { setStep("email"); say([`Nice to meet you, ${f.name.split(" ")[0]}. What's the best email to reach you?`]); return; }
    setStep("phone");
    say(["Would you like a call back? Add a phone number, or skip."]);
  };

  const review = (f) => {
    setStep("review");
    say(["Here's what I'll send to the team:"], () =>
      setMessages((m) => [...m, { from: "bot", kind: "summary", form: f }]));
  };

  const pickTopic = (reason) => {
    userSays(reason);
    const f = { ...form, reason };
    setForm(f);
    setStep("message");
    say([ASK_MESSAGE[reason]]);
  };

  const submitText = (e) => {
    e?.preventDefault();
    const text = draft.trim();
    if (typing || !text) return;

    if (step === "message") {
      userSays(text); setDraft("");
      if (text.length < 10) { say(["Could you add a little more detail? A sentence or two is perfect."]); return; }
      const f = { ...form, message: text.slice(0, 1000) };
      setForm(f); askNext(f); return;
    }
    if (step === "name") {
      userSays(text); setDraft("");
      if (text.length < 2) { say(["Please enter your name (at least 2 characters)."]); return; }
      const f = { ...form, name: text };
      setForm(f); askNext(f); return;
    }
    if (step === "email") {
      userSays(text); setDraft("");
      if (!EMAIL_RE.test(text)) { say(["That doesn't look like an email address. Could you check it?"]); return; }
      const f = { ...form, email: text };
      setForm(f); askNext(f); return;
    }
    if (step === "phone") {
      userSays(text); setDraft("");
      if (!PHONE_RE.test(text)) { say(["That number doesn't look right. Try again, or tap Skip."]); return; }
      const f = { ...form, phone: text };
      setForm(f); review(f);
    }
  };

  const skipPhone = () => { userSays("Skip"); review({ ...form, phone: "" }); };

  const send = async () => {
    userSays("Send");
    setStep("sending");
    setTyping(true);
    try {
      const res = await submitInquiry(form, token);
      setTyping(false);
      setRefId(res?.id ?? null);
      setStep("done");
      setMessages((m) => [...m, {
        from: "bot",
        text: `Saved${res?.id ? ` — your reference is #${res.id}` : ""}. We'll reply to ${form.email} within one working day.`,
      }]);
    } catch (err) {
      setTyping(false);
      setStep("error");
      setMessages((m) => [...m, { from: "bot", text: `Sorry, that didn't go through (${err.message}). Your details are still here — try again.` }]);
    }
  };

  const inputOpen = ["message", "name", "email", "phone"].includes(step);
  const chips =
    typing ? [] :
    step === "topic" ? REASONS.map((r) => ({ label: r, onClick: () => pickTopic(r) })) :
    step === "phone" ? [{ label: "Skip", onClick: skipPhone }] :
    step === "review" ? [{ label: "Send", primary: true, onClick: send }, { label: "Start over", onClick: start }] :
    step === "error" ? [{ label: "Try again", primary: true, onClick: send }, { label: "Start over", onClick: start }] :
    step === "done" ? [{ label: "Send another message", onClick: start }] : [];

  return (
    <div className="chat">
      <header className="chat-head">
        <span className="chat-avatar" aria-hidden="true">A</span>
        <div>
          <p className="chat-title">Amore help assistant</p>
          <p className="chat-status"><i aria-hidden="true" />Replies within one working day</p>
        </div>
      </header>

      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((m, i) =>
          m.kind === "summary" ? (
            <div key={i} className="chat-msg chat-msg--bot">
              <dl className="chat-summary">
                <div><dt>Topic</dt><dd>{m.form.reason}</dd></div>
                <div><dt>Message</dt><dd>{m.form.message}</dd></div>
                <div><dt>Name</dt><dd>{m.form.name}</dd></div>
                <div><dt>Email</dt><dd>{m.form.email}</dd></div>
                {m.form.phone && <div><dt>Phone</dt><dd>{m.form.phone}</dd></div>}
              </dl>
            </div>
          ) : (
            <div key={i} className={`chat-msg chat-msg--${m.from}`}>
              <p>{m.text}</p>
            </div>
          )
        )}
        {typing && (
          <div className="chat-msg chat-msg--bot chat-typing" aria-label="Assistant is typing">
            <span /><span /><span />
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="chat-chips">
          {chips.map((c) => (
            <button key={c.label} type="button" className={`chat-chip ${c.primary ? "is-primary" : ""}`} onClick={c.onClick}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <form className="chat-input" onSubmit={submitText} noValidate>
        <input
          ref={inputRef}
          type={step === "email" ? "email" : step === "phone" ? "tel" : "text"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={inputOpen ? PLACEHOLDER[step] : step === "done" ? "Message saved" : "Choose an option above"}
          disabled={!inputOpen || typing}
          maxLength={step === "message" ? 1000 : 120}
          aria-label="Your reply"
          autoComplete={step === "email" ? "email" : step === "name" ? "name" : step === "phone" ? "tel" : "off"}
        />
        <button type="submit" className="chat-send" disabled={!inputOpen || typing || !draft.trim()} aria-label="Send reply">
          <IconArrow size={16} />
        </button>
      </form>
      {refId && <p className="sr-only">Reference number {refId}</p>}
    </div>
  );
}
