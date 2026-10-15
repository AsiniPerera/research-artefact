/* The floating chat bubble on every page except Contact. It holds no
   conversation of its own: it opens the same ContactChat the Contact page
   shows inline, so there is one assistant, one look, and one save path
   (contact_inquiries). */
import { useState } from "react";
import { ContactChat } from "./ContactChat";

export function ChatWidget({ token, user }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="chatw">
      {open && (
        <section className="chatw-panel" role="dialog" aria-label="Chat with Amore Beauty">
          <button type="button" className="chatw-x" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          <ContactChat token={token} user={user} />
        </section>
      )}

      <button type="button" className="chatw-bubble" onClick={() => setOpen((o) => !o)}
              aria-expanded={open} aria-label={open ? "Close chat" : "Chat with us"}>
        {open ? "×" : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
               strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
          </svg>
        )}
      </button>
    </div>
  );
}
