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
  // 1 — Quality of Work
  "1.1": { label: "Work quality", blurb: "Was the result good? Neat finish, skilled execution" },
  "1.2": { label: "Got what was asked", blurb: "Did the result match what the customer requested" },
  "1.3": { label: "Lasted well", blurb: "Did it hold up over time, or fade, chip or come undone early" },

  // 2 — Consultation, Care & Aftercare
  "2.1": { label: "Checked before starting", blurb: "Did they assess hair or skin condition, do a patch test" },
  "2.2": { label: "Honest about what's possible", blurb: "Realistic expectations, warned of risks, declined if unsafe" },
  "2.3": { label: "Gave aftercare advice", blurb: "Told the customer how to look after it at home" },

  // 3 — Management Responsiveness
  "3.1": { label: "Replies to complaints", blurb: "Share of negative reviews answered, and how fast" },
  "3.2": { label: "Personal replies", blurb: "Addresses the specific issue, not a copy-paste template" },
  "3.3": { label: "Takes responsibility", blurb: "Accepts the problem, offers a redo or refund" },
  "3.4": { label: "Keeps promises", blurb: "Promised to improve and actually did, tested against later reviews" },

  // 4 — Customer Trust & Recommendation
  "4.1": { label: "People recommend it", blurb: "Customers say they recommend it, or refer friends and family" },
  "4.2": { label: "Customers come back", blurb: "Say they will return, or that they are regulars" },

  // 5 — Staff & Customer Service
  "5.1": { label: "Friendly and caring", blurb: "Courteous, respectful, attentive, welcoming" },
  "5.2": { label: "Gentle treatment", blurb: "Comfortable during the service, no pain" },
  "5.3": { label: "Explains things", blurb: "Explains the procedure, accommodates language" },
  "5.4": { label: "On time", blurb: "Punctual, no long waits, the booked person does the job" },
  "5.5": { label: "Puts mistakes right", blurb: "Free redo or refund when they made a mistake" },

  // 6 — Value & Price Honesty
  "6.1": { label: "Worth the money", blurb: "Good value for what was paid" },
  "6.2": { label: "Price as quoted", blurb: "No hidden charges, honoured the quoted price" },
  "6.3": { label: "No pressure to buy extras", blurb: "Didn't push products or add-on treatments" },

  // 7 — Safety, Hygiene & Facilities
  "7.1": { label: "Salon is clean", blurb: "Clean floors, mirrors, surfaces, washroom" },
  "7.2": { label: "Tools and staff hygienic", blurb: "Sterilised tools, fresh towels, gloves, handwashing" },
  "7.3": { label: "No harm", blurb: "No burns, rashes, cuts, infections, or hair, skin or nail damage" },
  "7.4": { label: "Genuine products", blurb: "Authentic brands, not expired" },
  "7.5": { label: "Comfortable facilities", blurb: "Good atmosphere, space, seating, air conditioning, parking" },

  // 8 — Overall Verdict (reported only, never weighted)
  overall: { label: "Overall verdict", blurb: "A general judgement on the salon, not tied to one thing" },
};

/** The sub-points of one category, in code order. */
export const subPointsOf = (categoryNo) =>
  Object.entries(SUB_POINTS)
    .filter(([code]) => (categoryNo === 8 ? code === "overall" : code.startsWith(`${categoryNo}.`)))
    .map(([code, v]) => ({ code, ...v }));
