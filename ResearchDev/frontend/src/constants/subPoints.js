/* The 25 sub-points of the framework (plus `overall`), in customer words.
 
   ref.sub_point already carries a `customer_question` — "Is the work good?" —
   and the API returns it. This adds the two things a question cannot do in a
   tight space: a SHORT label that fits a meta line or a list, and a plain
   description of what the check actually looks for.
 
   Codes are the framework's own and match ref.sub_point exactly, so a row can
   still be traced back. The taxonomy is frozen per projectInfo.md, so nothing
   here is to be added or renamed — only reworded for a reader.
*/
export const SUB_POINTS = {
  // 1 — Quality of the Result
  "1.1": { label: "Work quality",        question: "Is the work good?",              blurb: "Neat finish, skilled execution, result looks right" },
  "1.2": { label: "Got what was asked",  question: "Will I get what I asked for?",   blurb: "Result matches the request, photo or instructions given" },
  "1.3": { label: "Lasted well",         question: "Will it last?",                  blurb: "Held up over time — or faded, chipped and came undone early" },

  // 2 — Consultation, Care & Aftercare
  "2.1": { label: "Checked before starting",      question: "Do they check my hair or skin first?",      blurb: "Assessed condition, history or allergies before starting; patch or strand test done" },
  "2.2": { label: "Honest about what's possible", question: "Are they honest about what is possible?",   blurb: "Set realistic expectations, warned of risks, declined or referred if unsafe" },
  "2.3": { label: "Gave aftercare advice",         question: "Do they tell me how to look after it?",    blurb: "Gave home-care instructions or follow-up advice after the service" },

  // 3 — Management Responsiveness
  "3.1": { label: "Replies to complaints",  question: "Does the owner answer complaints, and quickly?",          blurb: "Share of complaints (reviews that are not positive) that received a reply from the owner" },
  "3.2": { label: "Personal replies",       question: "Is the reply personal, not copy-paste?",                 blurb: "Whether the reply addresses what that specific reviewer said — a generic template counts as negative" },
  "3.3": { label: "Takes responsibility",   question: "Do they take responsibility and offer to put it right?", blurb: "Accepts the problem; offers a redo, refund or direct contact — blaming the customer counts as negative" },
  "3.4": { label: "Keeps promises",         question: "Do they keep their promises to improve?",                blurb: "A specific promised change tested against later reviews to see if it actually happened" },
  "3.5": { label: "Puts mistakes right",    question: "If something goes wrong, do they put it right?",         blurb: "Free redo or refund for the salon's own mistake — refusing to fix it counts as negative" },

  // 4 — Customer Trust & Recommendation
  "4.1": { label: "People recommend it",  question: "Do people recommend it?",        blurb: "Reviewer uses the word \"recommend\" or says they referred friends or family" },
  "4.2": { label: "Customers come back",  question: "Do customers keep coming back?", blurb: "Reviewer states they will return or describes themselves as a regular" },

  // 5 — Staff & Customer Service
  "5.1": { label: "Friendly and caring",   question: "Are they friendly and caring?",                    blurb: "Courteous, respectful, attentive and welcoming — listens to the customer" },
  "5.2": { label: "Gentle treatment",      question: "Is the treatment gentle and comfortable?",         blurb: "Physically comfortable during the service — no pain or discomfort" },
  "5.3": { label: "Explains things",       question: "Do they explain things, in my language?",          blurb: "Explains the procedure clearly; accommodates language needs" },
  "5.4": { label: "On time",               question: "Will I be seen on time, by the person I booked?", blurb: "Punctual, no long waits, no unannounced substitution of the booked person" },

  // 6 — Value & Price Honesty
  "6.1": { label: "Worth the money",           question: "Is it worth the money?",                blurb: "Customers felt the result was good value for what they paid" },
  "6.2": { label: "Price as quoted",           question: "Will I pay the price I was quoted?",   blurb: "Final price matched the quote — no hidden charges or unadvertised extras" },
  "6.3": { label: "No pressure to buy extras", question: "Will they push me to buy extras?",     blurb: "No pressure to add products or treatments the customer could have refused" },

  // 7 — Safety, Hygiene & Facilities
  "7.1": { label: "Salon is clean",            question: "Is the salon clean?",                         blurb: "Clean floors, mirrors, surfaces, furniture and washroom" },
  "7.2": { label: "Tools and staff hygienic",  question: "Are the tools and staff hygienic?",           blurb: "Sterilised tools, fresh blades, towels and capes; staff wear gloves and wash hands" },
  "7.3": { label: "No harm",                   question: "Could I get hurt?",                           blurb: "No burns, rashes, allergic reactions, cuts, infections or damage to hair, skin or nails" },
  "7.4": { label: "Genuine products",          question: "Are the products genuine and good quality?",  blurb: "Authentic brands used — not expired, counterfeit or poor quality" },
  "7.5": { label: "Comfortable facilities",    question: "Are the facilities comfortable and well equipped?", blurb: "Good atmosphere, space, seating, air conditioning, parking and equipment" },

  // 8 — Overall Verdict (reported only, never weighted)
  overall: { label: "Overall verdict", question: "What is the overall impression?", blurb: "A general judgement on the salon, not tied to any one thing" },
};

/** The sub-points of one category, in code order. */
export const subPointsOf = (categoryNo) =>
  Object.entries(SUB_POINTS)
    .filter(([code]) => (categoryNo === 8 ? code === "overall" : code.startsWith(`${categoryNo}.`)))
    .map(([code, v]) => ({ code, ...v }));
