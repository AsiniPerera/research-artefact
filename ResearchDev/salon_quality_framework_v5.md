# Beauty Service Quality Framework — Specification v5

**7 categories · 25 sub-points**
**Date:** 11 October 2026
**Status:** Frozen by the researcher on 11 October 2026. To be shown to the supervisor: one sub-point moved from Category 5 to Category 3, and the customer questions reworded. The scoring described here has been in effect since scoring run 5 (11 October 2026).
**Replaces:** `salon_quality_framework_v4.md`, `salon_quality_framework_v4_amendment_1.md` and `FRAMEWORK_V5_DECISIONS.md`.

**This is the single reference document.** Part A (Sections 1 to 10) is the framework specification. Part B (Sections 11 to 16) is the implementation reference: rules for working on the code, database layout, API and screen behaviour, the decision log and open items.

Companion taxonomy: `service_taxonomy_v9.md` (5 categories, 17 services, 51 sub-services).

---

# Part A — Framework specification

## 1. How to read this

Each sub-point is written as a question a customer asks when choosing a beauty service business. The research meaning sits next to it.

Every sub-point states what it checks and what it does not, so that each thing a review says has one home.

All 25 sub-points feed their category score. Sub-points 7.1, 7.2 and 7.3 also feed the safety mark described in Section 6.

---

## 2. Categories

| # | Category | Name shown on screen | Description shown to the customer | Sub-points |
|---|---|---|---|---:|
| 1 | Quality of the Result | Quality of the Result | Good results that match what you asked for and last | 3 |
| 2 | Consultation, Care & Aftercare | Consultation & Aftercare | They look after you before and after | 3 |
| 3 | Management Responsiveness & Continuous Improvement | Management Response | How the business deals with complaints and mistakes | 5 |
| 4 | Customer Trust & Recommendation | Trust & Recommendation | Customers recommend it and come back | 2 |
| 5 | Staff & Customer Service | Staff & Customer Service | How the staff treat you | 4 |
| 6 | Value & Price Honesty | Value & Price Honesty | Fair price, as agreed | 3 |
| 7 | Safety, Hygiene & Facilities | Safety, Hygiene & Facilities | A clean, safe, comfortable place | 5 |
| | **Total** | | | **25** |

The full category name is used in the thesis. The shorter name and the description are what the prototype shows, and they are the same on every screen. Where space is tight, such as the score chips on a result card, a one-word label is used: Quality, Care, Management, Trust, Staff, Value, Safety.

---

## 3. Sub-points

### 1 · Quality of the Result

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 1.1 | **Is the quality of the work good?** | Overall verdict on a named service; technical execution quality | Overall verdict on the service, skill, neat finish, as judged at the time of the visit. Includes a successful or failed repair of another business's work, and this business's work having to be corrected elsewhere (negative) | Staff manner (5.1); how the result held up later (1.3) |
| 1.2 | **Does the result match what I asked for?** | Request–outcome match | Result matches the request, photo or instructions. Coded only when the request is mentioned | General praise (1.1) |
| 1.3 | **Does the result last?** | Longevity against expectation; early fading or chipping | The result faded, chipped or came undone, or held well. The customer is back where they started | Harm to hair, skin or nails (7.3); length of the visit (5.4) |

### 2 · Consultation, Care & Aftercare

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 2.1 | **Do they assess my needs and relevant risks first?** | Pre-service consultation; patch or strand test | Finding out about the hair or skin before starting, by looking, testing or asking: condition, history, allergies | Telling the customer what is possible or risky (2.2); simply listening to what the customer wants (5.1) |
| 2.2 | **Are they honest about what is possible?** | Feasibility setting, risk disclosure, refusal and honest referral | Realistic results, warning of risks, declining a service or referring elsewhere | Explaining the procedure (5.3); selling extras (6.3) |
| 2.3 | **Do they explain how to care for the result?** | Aftercare instruction | Care advice for home; follow-up | Explanation during the service (5.3) |

### 3 · Management Responsiveness & Continuous Improvement

*3.1 to 3.4 are read from owner replies and apply to the whole business. 3.5 is read from customer reviews.*

A **complaint** is a review with text that is not positive overall (its overall sentiment is negative or neutral). The star rating is not used.

| # | Customer question | Research meaning | What it checks | Not here (goes to) | Read from |
|---|---|---|---|---|---|
| 3.1 | **Does management respond to customer complaints?** | Reply coverage on complaints | The share of complaints that receive an owner reply | Replies to positive reviews (not counted) | Owner replies |
| 3.2 | **Does management address the specific concern raised?** | Reply specificity | Whether the reply to a complaint addresses what that reviewer said. A generic template reply is negative | A thank-you under a positive review (not counted) | Owner replies |
| 3.3 | **Does management take ownership of the concern?** | Responsibility stance and remedy | Accepting the problem; offering a redo, refund or contact. A specific, factual rebuttal is not the lowest score. Neither accepting nor explaining is | A customer saying it was fixed (3.5) | Owner replies |
| 3.4 | **Does management follow through on improvement commitments?** | Corrective commitment, tagged with the issue, and its fulfilment | A promised change, tested against the same business's later reviews | A promise that cannot be tested (neutral) | Owner replies and later reviews |
| 3.5 | **If something goes wrong, do they put it right?** | Service recovery by the business, and who bore the cost | Redo, refund or correction of the business's own mistake, as described by the customer. A free redo or a refund is positive. Refusing to fix it, or charging again for the fix, is negative | Offered in an owner reply (3.3); corrected at another business (1.1 negative); general manner (5.1) | Customer reviews |

**How 3.4 is tested.** Each promise is tagged with what it concerned. A promise can carry several tags; all the matched sub-points are used together.

| Promise tag | Matched to negative statements under |
|---|---|
| Waiting / time | 5.4 |
| Staff behaviour | 5.1 |
| Service outcome | Category 1 |
| Price | Category 6 |
| Hygiene / safety | 7.1, 7.2, 7.3 |

For the same business, reviews complaining on the matched sub-points are counted in the 12 months before the owner's reply and the 12 months after, each as a share of the business's text reviews in that period.

| Outcome | Condition |
|---|---|
| **Kept** | The share of reviews complaining about the issue is lower after the reply than before |
| **Broken** | 2 or more later reviews complain about the issue, and the share is not lower than before |
| **No clear change** | Neither of the above. Neutral |
| **Not testable** | Fewer than 10 text reviews in the 12 months before or in the 12 months after, no reply date, or no identifiable issue. Neutral |

The thesis reports how many promises were found, tested, kept and broken.

### 4 · Customer Trust & Recommendation

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 4.1 | **Would customers recommend the business?** | Explicit recommendation and referral behaviour | The word "recommend" or a referral of friends or family | Praise without those words (1.1) |
| 4.2 | **Do customers want to return?** | Return intent and self-declared repeat visits | Stating they will return or are regulars | Returning only for a free correction (3.5) |

Read from the review text only, never from the stars.

### 5 · Staff & Customer Service

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 5.1 | **Are the staff friendly and respectful?** | Courtesy, respect and attentiveness | Courtesy, respect, attentiveness, welcome, listening to the customer | Skill or talent (1.1); assessing the hair or skin (2.1); how a mistake was handled (3.5) |
| 5.2 | **Is the treatment comfortable and appropriately handled?** | Pain and comfort during a treatment | Pain and physical comfort while the service is carried out | An injury or mark that remains (7.3) |
| 5.3 | **Do staff explain things clearly?** | Explanation during service and language accommodation | Explaining the procedure; the language used with the customer | Risks (2.2); home care (2.3) |
| 5.4 | **Is my appointment handled professionally?** | Appointment reliability and unannounced substitution | Punctuality, waiting, crowding, how long the visit took, staff substitution | Lack of space or seating (7.5) |

### 6 · Value & Price Honesty

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 6.1 | **Is it worth the money?** | Value judgement | Value for what was paid | A price different from what was agreed (6.2) |
| 6.2 | **Will I pay the price I was quoted?** | Quote accuracy and undisclosed charges | Final price against the quote, hidden charges, advertised offers honoured | Extras the customer could refuse (6.3) |
| 6.3 | **Will they push me to buy extras?** | Sales pressure | Pressure to add products or treatments the customer could refuse, whether or not the customer gave in | Charged without agreeing (6.2) |

### 7 · Safety, Hygiene & Facilities

| # | Customer question | Research meaning | What it checks | Not here (goes to) |
|---|---|---|---|---|
| 7.1 | **Is the premises clean?** | Premises cleanliness | Cleanliness of the room itself: floors, mirrors, surfaces, furniture, washroom | Atmosphere and decor (7.5); items used on the customer (7.2) |
| 7.2 | **Are tools and staff hygiene practices appropriate?** | Tool hygiene, sterilisation practice and staff hygiene | Cleanliness of anything used on the customer: sterilised tools, fresh blades, combs, towels, capes, bed linen. Staff practice: gloves, handwashing | The room itself (7.1); harm that actually occurred (7.3) |
| 7.3 | **Are there reports of harm or unsafe practices?** | Adverse reaction, injury, delayed-onset damage, unsafe practice | Burns, rashes, allergic reactions, cuts, infection, damage to hair, skin or nails, on the day or later; risky methods. The customer is worse off than before | Discomfort that ends with the service (5.2); harm caused by another business (not counted) |
| 7.4 | **Are products appropriate and in good condition?** | Product authenticity and quality | Brand, authenticity, old or expired products. Coded only when the product itself is discussed | The effect of a product (7.3 or 1.3) |
| 7.5 | **Are the facilities comfortable and suitable?** | Ambience and facilities | Atmosphere, space, seating, air conditioning, parking, equipment, having a washroom | Cleanliness (7.1) |

**Fault rule for 7.3.** A report counts against the business unless the reviewer says they caused it ("I didn't mention my allergy").

---

## 4. Recorded on every evidence item

| Field | Values |
|---|---|
| Polarity | Positive, negative, mixed, mention. "Mention" means the topic was raised without a judgement; it does not affect the score |
| Seriousness of a failure | Ineffective, cosmetic, needs correction, irreversible, damage. Recorded for negatives only. "Damage" is used only for physical harm and counts double in the score |
| Time since the visit | Same day, later, not stated |
| Confidence | High, medium, low |
| Reviewer fault | Yes when the reviewer says they caused it |
| Staff name | A staff member's name, when the review gives one |

---

## 5. Coding rules

### Part A · Rules for every sentence

| # | Rule | Example |
|---|---|---|
| A1 | Code what the sentence is about, not the words in it | "Lasted 3.5 hours" is about waiting, not durability |
| A2 | A fault counts only if this business caused it | "Damaged at another salon" is not a fault here |
| A3 | The reason for the visit is not evidence | "I had hair fall, so I came for a treatment" gets no code |
| A4 | If the reviewer says it was their own fault, it is not counted | "I forgot to mention my allergy" |
| A5 | The more specific sub-point wins | "Exactly the cut I asked for" is 1.2, not 1.1 |
| A6 | Two codes only when the sentence says two things | "Friendly staff and a perfect cut" is 5.1 and 1.1 |
| A7 | Not mentioned is never negative | No patch test mentioned means no code |
| A8 | Figures of speech are not evidence | "To add insult to injury", "prices burned a hole in my pocket" |
| A9 | Advice, wishes and plans get no code | "Call before you go" |
| A10 | 3.1 to 3.4 are read only from owner replies. 3.5 and every other sub-point are read only from customer reviews | A customer writing "the owner apologised and redid it" is 3.5, not 3.3 |
| A11 | Each sentence is coded once per sub-point. Attach the code to the service named in that sentence. If none is named and the review is about one service, attach it to that service. If the review covers several services or none, attach it to the business as a whole | "Lovely clean salon" in a review of hair, makeup and waxing is coded once, for the business |
| A12 | The star rating is never used to decide a code or its polarity | |
| A13 | The same rules apply in Sinhala, Tamil and Singlish | |
| A14 | Evidence counts only for the business on whose listing the review is posted | "Salon X ruined my hair, and this salon fixed it" is evidence for this business only |

### Part B · Deciding questions for pairs that can be confused

| Pair | Ask | Answer and code |
|---|---|---|
| 1.1 / 1.2 | Does it mention what the customer asked for? | Yes: 1.2. No: 1.1 |
| 1.1 / 1.3 | Is the result judged at the time of the visit, or after time has passed? | At the time: 1.1. Later: 1.3 |
| 1.1 / 5.1 | Does the praise describe the work or skill, or the person's manner? | Work or skill: 1.1. Manner: 5.1 |
| 1.1 / 4.1 | Does it say "recommend" or mention referring someone? | Yes: 4.1. No: 1.1 |
| 1.1 / 6.1 | Does it mention money, price or value? | Yes: 6.1. No: 1.1 |
| 1.3 / 7.3 | Is the customer back where they started, or worse off than before? | Back where they started: 1.3. Worse off: 7.3. Both stated: both codes |
| 1.3 / 5.4 | Is "lasted" about the result or the appointment? | Result: 1.3. Appointment: 5.4 |
| 1.3 / 7.4 | Is the product blamed directly ("old polish")? | Yes: 7.4, plus 1.3 if it did not last. No: 1.3 only |
| 2.1 / 2.2 | Did they find out about the hair or skin (look, test, ask), or tell the customer what is possible or risky? | Found out: 2.1. Told: 2.2 |
| 2.1 / 5.1 | Did they assess the hair or skin, or simply listen to what the customer wanted? | Assessed: 2.1. Listened: 5.1 |
| 2.2 / 5.3 | Was the explanation about risks or what is achievable? The topic decides, not when it was said | Yes: 2.2. No: 5.3 |
| 2.3 / 5.3 | Was it about care at home after the visit? | Yes: 2.3. No: 5.3 |
| 2.2 / 6.3 | Was the suggestion in the customer's interest, or to sell more? | Customer's interest: 2.2. To sell: 6.3 |
| 3.3 / 3.5 | Is the text an owner reply or a customer review? | Owner reply: 3.3. Customer review: 3.5 |
| 3.3 / 3.4 | Is it a remedy for this customer, or a change for future customers? | This customer: 3.3. Future customers: 3.4 |
| 3.5 / 1.1 | Did this business correct its own mistake, or was it corrected elsewhere? | Own correction: 3.5. Elsewhere: 1.1 negative |
| 3.5 / 5.1 | General manner, or how a mistake by the business was handled? | Manner: 5.1. Mistake handled: 3.5 |
| 4.1 / 4.2 | Recommending to others, or returning themselves? | Others: 4.1. Themselves: 4.2 |
| 5.1 / 5.2 | Attitude, or physical comfort during the treatment? | Attitude: 5.1. Physical: 5.2 |
| 5.1 / 5.3 | How they treated the customer, or what they explained? | Treatment of the customer: 5.1. Explanation: 5.3 |
| 5.2 / 7.3 | Did the pain end with the service, or leave a mark, injury or reaction? | Ended, or the review does not say: 5.2. Left harm: 7.3 |
| 5.4 / 7.5 | Is "crowded" about waiting, or about lack of space? | Waiting: 5.4. Space: 7.5 |
| 6.1 / 6.2 | A judgement of value, or a price different from what was agreed? | Value: 6.1. Different from agreed: 6.2 |
| 6.2 / 6.3 | Could the customer have refused the extra? | Yes, even if they gave in: 6.3. No, it was added or charged without asking: 6.2 |
| 7.1 / 7.2 | Is it part of the room (floor, mirror, furniture, washroom), or something used on the customer (tools, towels, capes, linen) or staff practice? | Room: 7.1. Used on the customer, or staff practice: 7.2 |
| 7.1 / 7.3 | Did dirty premises cause actual harm or infection? | Yes: 7.3, plus 7.1 if dirty premises are stated as the cause. No: 7.1 |
| 7.1 / 7.5 | Cleanliness, or atmosphere and comfort? | Cleanliness: 7.1. Atmosphere: 7.5 |
| 7.2 / 7.3 | Was someone actually harmed? | Yes: 7.3, plus 7.2 if poor hygiene is stated as the cause. No: 7.2 |
| 7.3 / 7.4 | Is the product judged, or only its effect? | Product judged: 7.4. Effect only: 7.3 |

**Worked examples for 1.3 and 7.3**

| Service | 1.3 (the result did not last) | 7.3 (the customer was harmed) |
|---|---|---|
| Hair colour | Faded after two washes; turned brassy | Scalp burned; hair became brittle and broke |
| Rebonding, keratin | Waves came back within a month | Hair breaking or falling out |
| Gel or acrylic nails | Chipped or lifted in three days | Natural nails thin, peeling or infected |
| Lash extensions | Fell out within a week | Natural lashes pulled out; eye irritation |
| Waxing | Hair grew back quickly | Skin burned, torn or left with a rash |
| Facial, peel | Glow gone by the next day | Breakout, pigmentation or burn |

Timing does not decide between them: 7.3 covers harm on the day or later. If the reviewer does not blame the service for the worse condition, code 1.3. When unsure, ask whether doing the service again would solve it: if yes, 1.3; if the customer needs recovery, 7.3.

**When a review states both.** "The gel lifted in three days and peeled a layer off my nail" says two things (rule A6): code 1.3 negative for the result not lasting, and 7.3 negative for the harm. Code both only when both are stated.

**Edge case: dry or frizzy hair.** "My hair felt dry again once the keratin wore off" is 1.3: the hair returned to its earlier state. "My hair has been dry and rough ever since the colouring" is 7.3 at "cosmetic" seriousness: the hair is worse than before and the service is blamed.

**Worked examples for sentences that say several things**

| Sentence | Codes | Why |
|---|---|---|
| "They looked at my hair, said bleaching would break it, and explained each step" | 2.1 positive, 2.2 positive, 5.3 positive | Three things are said: they examined, they warned of a risk, they explained the procedure |
| "She asked about my allergies and my last colour before starting" | 2.1 positive | Asking about history is finding out about the hair or skin |
| "They added a Rs. 3,000 treatment without asking, totally not worth it" | 6.2 negative, 6.1 negative | Charged without agreeing, and a separate judgement of value |
| "She kept pushing the hair spa until I said yes" | 6.3 negative | The customer could have refused; giving in does not change the code |
| "It burned during the waxing" | 5.2 negative | Pain during the service, and nothing says a mark remained |
| "The wax burned my skin and left a mark" | 7.3 negative | Harm that remained |
| "Dirty towel, and the floor was full of hair" | 7.2 negative, 7.1 negative | The towel is used on the customer; the floor is the room |
| "The colour went wrong but they redid it free the next day" | 1.1 negative, 3.5 positive | The work failed, and the business put it right |

### Part C · Polarity rules

| # | Rule | Example |
|---|---|---|
| C1 | Take polarity from the sentence, not from the rest of the review | "Started peeling within a day" is negative even in a warm review |
| C2 | Negation flips it | "Not rushed", "no hidden charges" are positive |
| C3 | "But" and "however" split the sentence; code each side | "Good cut but very late" is 1.1 positive and 5.4 negative |
| C4 | A neutral fact is not positive or negative | "Air conditioned" is positive for 7.5 only when presented as a plus |
| C5 | Praise given despite a problem is coded as praise only | "Did not rush even though it was crowded" is 5.1 positive; the crowding gets no negative |
| C6 | Use "mixed" only when one sentence gives both views on the same sub-point | "Sometimes neat, sometimes careless" |
| C7 | Seriousness is recorded only for negatives, and "damage" only for physical harm | |

### Part D · Trap words

These words have more than one meaning in reviews. Read the sentence before coding.

| Word | Common misreading | Check | Correct code |
|---|---|---|---|
| last, lasted, "until the end" | Durability | What lasted: the result, the visit, or a date ("last Tuesday")? | Result: 1.3. Visit: 5.4. Date: no code |
| original, fake, genuine | Product authenticity | A product, or a price, offer, photo or review? | Product: 7.4. Price or offer: 6.2. Photo or request: 1.2. Otherwise no code |
| damage, damaged | Harm by this business | Who caused it, and when? | This business: 7.3. Another business: no code, unless this business repaired it (1.1) |
| injury, burn, kill, die | Physical harm | A lasting injury, a feeling during the service, or a figure of speech? | Lasting injury: 7.3. Feeling that ended with the service ("it burned"): 5.2. Figure of speech: no code |
| lost hair, hair fall | Harm by this business | A result of the service, or the reason for the visit? | Result of the service: 7.3. Reason for the visit: no code |
| professional, experienced | Skill | Describes the work, or the person's manner? | Work: 1.1. Manner: 5.1 |
| calm, relaxing | Atmosphere | The place, the staff, or the treatment itself? | Place: 7.5. Staff: 5.1. Treatment: 5.2 |
| conditioning | Air conditioning | Air conditioning, or a hair conditioning treatment? | Air conditioning: 7.5. Hair treatment: the service name; code 1.1 only if a verdict is given |
| clean | Cleanliness | The premises, or a "clean cut" or "clean finish"? | Premises: 7.1. The work: 1.1 |
| maintained | Premises | The business, or the customer's hair or skin? | Business: 7.1 or 7.5. Hair or skin: by what the sentence says, usually 2.3 |
| crowded, busy | Complaint | Stated as a problem, or only as a fact? | Waiting problem: 5.4. Lack of space: 7.5. Only a fact: no code |
| cut | Injury | A haircut, a price reduction, or a wound? | Haircut: 1.1. Price: 6.1. Wound: 7.3 |
| reaction | Allergic reaction | A skin reaction, or someone's response? | Skin: 7.3. Staff response in a customer review: 5.1. Owner's response in an owner reply: 3.3 |
| free | Free correction | A free fix, a free offer, or an expression? | Fix of a mistake: 3.5. Offer as value: 6.1. Advertised free item not given: 6.2. "Feel free", "hassle-free": no code |

---

## 6. Safety reports

| Point | Rule |
|---|---|
| What counts as a report | A negative or mixed statement under 7.1, 7.2 or 7.3, or a negative statement with seriousness "damage" under any sub-point. Statements where the reviewer was at fault are left out |
| When a business is marked | Two or more independent reports within 24 months, with the first and last at least 7 days apart. Duplicate and near-copy reviews are removed first |
| Effect on the list | Businesses with the mark are listed after businesses without it. Within each group, businesses are ordered by score |
| What the customer sees | No separate notice. Safety is presented through the Category 7 score |
| Deduction from the score | None |
| Exclusion from ranking | None. No sub-point acts as a gate or veto |

---

## 7. Scoring rules

### Category scores (all categories except 3)

| Rule | What it does |
|---|---|
| **Combining statements** | All statements coded to a category are combined into one category score. Sub-points are used to code and report the evidence; they are not scored separately |
| **Starting point** | Every category score starts at 0.5 and moves toward the evidence: score = (1 + positive weight) ÷ (2 + positive weight + negative weight). A business with few reviews cannot receive an extreme score |
| **No evidence** | A category with no evidence takes the neutral 0.5 and stays in the calculation |
| **Statement weight** | Confidence × recency × specificity |
| **Confidence** | High 1.0, medium 0.7, low 0.3 |
| **Recency** | Half-life of 24 months: a statement 24 months old counts half as much as a new one |
| **Damage** | A negative statement with seriousness "damage" counts double |

### Specificity

When scoring a business for one sub-service, a statement counts in full for that sub-service and at reduced weight elsewhere.

| The statement is about | Weight |
|---|---|
| The same sub-service | 1.00 |
| The same service, no sub-service named | 0.75 |
| The business in general | 0.50 |
| Another service, on a business-wide trait (categories 3 to 7) | 0.25 |
| Another service, on the outcome of the work (categories 1 and 2) | 0 (not counted) |

### Category 3

Each part uses the same starting point of 0.5. There is no minimum number of replies; with little evidence a part stays close to 0.5.

| Part | Calculation |
|---|---|
| 3.1 | Complaints that received a reply against all complaints, each weighted by recency |
| 3.2 | Over replies to complaints: specific = 1, partly specific = 0.5, generic = 0 |
| 3.3 | Over replies to complaints: the average of the stance (accepts or apologises = 1, accepts and disputes = 0.75, disputes the report = 0.5, neither = 0.25) and whether a remedy was offered (1 or 0) |
| 3.4 | Promises kept against promises broken (Section 3). Promises with no clear change or not testable are left out |
| 3.5 | Positive against negative customer statements coded to 3.5, with the usual statement weights |
| **Category 3 score** | The average of the parts that have evidence |

| Situation | Result |
|---|---|
| No complaints and no 3.5 statements | Neutral 0.5 |
| Complaints, but none answered | 3.1 is low, and the category score follows it |
| Replies to positive reviews only | Not counted |

### Overall score and ranking

| Rule | What it does |
|---|---|
| **Customer weights** | The customer sets one of four levels per category: Low 1, Medium 2 (default), High 4, Very high 8. Each value is divided by the total of the seven, so the weights always add up to 1 |
| **Overall score** | The weighted average of the seven category scores |
| **Minimum evidence to rank** | A business × sub-service is ranked only when the 80% range of its score, built from customer statements about that service, is narrower than 0.50 / 0.45 / 0.40 / 0.35 / 0.30 for tiers 1 to 5. Otherwise it is listed as "Available but Not Ranked". Owner replies do not count toward this |
| **Order** | Businesses without the safety mark first, then by overall score, highest first |
| **Ties** | Equal scores are ordered by amount of evidence, most first |
| **Fallback** | If no business is ranked for a sub-service, results are shown for its service, and if none there, for its category, with a message saying so |

### Irreversibility tiers

Assigned by the researcher using this written rule.

| Tier | Rule | Examples |
|---|---|---|
| 1 | Gone within a day | Blow-dry, makeup |
| 2 | Days | Mehendi |
| 3 | Weeks | Nail polish (classic and gel), lash extensions, waxing |
| 4 | Months | Colour, keratin, extensions |
| 5 | Permanent, or a real risk of damage | Rebonding, perm, bleach, chemical peel, microblading |

---

## 8. Overall Verdict

General statements that name no quality aspect ("great place", "worst experience") are stored separately as an Overall Verdict. It carries no weight, is not one of the seven categories or 25 sub-points, does not enter the score, and is not shown in the prototype.

---

## 9. Known limitations

| # | Limitation |
|---|---|
| L1 | Statements are combined per category, so rare complaints on one sub-point can be outweighed by frequent praise on another |
| L2 | A category with no evidence stays at 0.5, so a customer's priority on a thinly evidenced category changes the order little |
| L3 | Category 4 counts positive against negative statements. Customers seldom write "I do not recommend", so scores lean high |
| L4 | Few owners reply to complaints, so 3.2 to 3.4 rest on little evidence for most businesses |
| L5 | A business with unanswered complaints scores below a business with no complaints at all on Category 3. Businesses with many reviews are more likely to have complaints, so Category 3 tends to be lower for them |
| L6 | Many promises carry several issue tags at once, which makes the test in 3.4 broad |
| L7 | Very few customer statements describe a business putting a mistake right, so 3.5 rarely has evidence |
| L8 | The weights and thresholds (specificity values, 24-month half-life, range widths) were set by the researcher and not tuned against data |
| L9 | The safety mark lowers a business in the list without a visible notice |
| L10 | The gender of customers a business serves was not verified |

---

## 10. Verification

| Step | What it establishes |
|---|---|
| Supervisor approval | That this specification is the framework of record |
| Checked sample of 300 reviews, across languages and star ratings | Each coded statement is checked against the rules in Section 5 for service, sub-point and polarity; missed statements are noted. The share correct is reported per category and per language. A portion is checked a second time to test consistency |
| Score recalculation | Ten business × sub-service pairs are recalculated by hand and compared with the stored scores |
| Coding of all reviews with text | Each review is read in context and coded with the rules in Section 5 |

---

# Part B — Implementation reference

## 11. Rules for working on this codebase

1. **The framework is frozen.** Do not add, remove, rename or move categories or sub-points. New ideas go under "Limitations" or "Future work" in the thesis.
2. **Show diffs and wait for approval** before editing any file.
3. **Database changes go in a numbered migration file** under `backend/salon_db/`. The researcher runs it herself in the Supabase SQL Editor, one step at a time. Do not connect to the database from the agent.
4. **Do not run the scoring script.** The researcher runs it.
5. **Change only what was asked.** State what you did not change.
6. **No paid APIs.** There is no API budget.
7. In thesis text, write "beauty service business", not "salon". Code and table names may keep "salon" and "provider".

---

## 12. Database layout (Supabase / PostgreSQL)

| Schema | Holds | Key objects |
|---|---|---|
| `raw` | Collected Google data | `provider`, `review`, `owner_reply`, `removed_duplicate_review`, `v_review_full` |
| `ref` | Framework and taxonomy | `framework_category`, `sub_point`, `service_category`, `service`, `sub_service`, `provider_city`, `dim_service`, `dim_sub_point` |
| `extract` | Final coded evidence | `evidence_item`, `review_assessment`, `reply_assessment`, `extraction_run`, `gold_label`, `v_evidence` |
| `score` | Calculated scores | `category_score`, `trust_score`, `scoring_run`, `provider_safety`, `commitment_outcome`, `gate_veto_status`, `v_ranking`, `v_provider_caution`, functions `rank_providers`, `rank_providers_group` |
| `staging` | Raw landing area for loads | `evidence_item`, `review_assessment`, `reply_assessment`, `staff_names` |
| `public` | Website login and contact form | `app_users`, `contact_inquiries` |
| `backup_v3` | Old framework backup | Do not use |

**Key files**

| File | Role |
|---|---|
| `backend/salon_db/06_run_scoring.py` | The only code that fills `score.category_score` and `score.trust_score` |
| `backend/salon_db/09_framework_v5_migration.sql` | Moves 5.5 to 3.5, renames category 1 |
| `backend/salon_db/10_framework_v5_questions.sql` | Sets the 25 customer questions |
| `backend/salon_db/11_framework_v5_meanings.sql` | Sets the research meaning of 3.1, 3.4 and 3.5 |
| `frontend/src/constants/categories.js` | Category names, one-word labels and descriptions shown on every screen |
| `backend/api/main.py` | `GET /rankings/{sub_service_code}`; calls the ranking functions; weight validation; fallback |
| `frontend/src/components/WeightLevels.jsx` | Priority buttons |
| `frontend/src/constants/presets.js` | Presets |
| `frontend/src/components/SalonCard.jsx` | Business card |
| `frontend/src/components/FallbackNotice.jsx` | Fallback message |
| `frontend/src/constants/subPoints.js` | Sub-point labels |

**Retired code.** The folders `pipeline/`, `core/` and `evaluation/`, and the old app in `backend/main.py`, `backend/db.py`, `backend/schemas.py` and `backend/services/`, belong to an earlier design. The live system (`backend/api/`, `backend/salon_db/`, `frontend/`) does not use them.

**Note on flags.** In `ref.sub_point` only 3.1 is flagged `is_computed`. Sub-points 3.1 to 3.4 are all taken from owner replies; the scoring script excludes their evidence-table rows by code, not by that flag.

**Snapshot before the v5 re-score (scoring run 4):** 549 businesses, about 27,100 reviews, 6,847 owner replies, 44,594 evidence items, 7,561 business × sub-service pairs, 283 ranked.

---

## 13. API behaviour

| Topic | Behaviour |
|---|---|
| Endpoint | `GET /rankings/{sub_service_code}` |
| Functions | `score.rank_providers` (sub-service level), `score.rank_providers_group` (service or category level). `score.v_ranking` is not used by the API |
| Order | Taken from the database unchanged. The API does not re-sort or re-score. Exception: the nearby endpoint orders ranked businesses by distance. |
| Weights | Exactly 7 values; non-numeric, negative, wrong count or all-zero → HTTP 422. Any non-negative number is accepted, not only 1, 2, 4, 8 |
| Missing weights | Database defaults each to 1 (equal weights) |
| Fallback | Sub-service → service → category, moving up when no business is ranked at that level for the chosen city. Response carries `level_used`, `requested`, `shown`. Required by the supervisor |

---

## 14. Frontend decisions

| Item | Decision |
|---|---|
| Priority buttons | Low = 1, Medium = 2 (default), High = 4, Very high = 8. Heading: "How important is each to you?" |
| Presets (Q1–Q7) | balanced 2,2,2,2,2,2,2 · quality 8,4,1,2,2,1,2 · budget 4,1,1,1,2,8,2 · hygiene 2,2,2,2,4,1,8 · bridal 8,4,2,4,2,1,2 |
| Safety advisory notice on the card | Removed |
| "Monitored" band word for Category 7 | Removed; Category 7 shows its normal band |
| Overall Verdict | Not shown |
| Google rating | Shown as "reference only"; never part of the score |
| Fallback | `FallbackNotice` shows what was requested and what is shown |
| Category 1 label | "Quality of the Result" |
| 3.5 | Listed under Category 3, not Category 5 |

---

## 15. Decision log

| Date | Decision | Reason |
|---|---|---|
| 10 Oct 2026 | 7-category, 25-sub-point framework confirmed as approved | Stated by the researcher |
| 10 Oct | A category with no evidence stays at 0.5 and remains in the score | Already in the code; neutral; avoids one glowing review dominating. Using 0 would punish silence |
| 10 Oct | Statements are pooled per category, not scored per sub-point | Already in the code; more stable with few statements. Document corrected to match |
| 10 Oct | Specificity weights kept and documented | In the code but previously unwritten |
| 10 Oct | The 0.5 starting point (prior 1, 1) kept | Stops a single review giving 100%; gives empty categories a value |
| 10 Oct | Overall Verdict is not added to the score | It is the same kind of general signal as the star rating |
| 10 Oct | Safety advisory notice removed from the card | Safety is already a scored category |
| 10 Oct | Safety ordering in the database functions left unchanged | Researcher's decision. The thesis must describe the order as it is |
| 10 Oct | No gates or penalties | Cautions were replaced by the Category 7 score |
| 10 Oct | Priority labels changed to Low / Medium / High / Very high | The buttons set importance, not quality |
| 10 Oct | Accuracy is evaluated on a checked sample of 300 reviews, not a blind hand-coded set | Researcher's decision; recorded as a limitation |
| 11 Oct | Category 3 scored from replies to complaints only | 90% of replies were thank-yous to 5-star reviews; the category is about complaint handling |
| 11 Oct | Evidence-table copies of owner replies (3.1–3.4) removed from all scoring and from the ranking threshold | They double-counted replies and contradicted the reply table |
| 11 Oct | Minimum of 5 replies removed | The 0.5 starting point already handles thin evidence |
| 11 Oct | Sub-point 5.5 moved to Category 3 as 3.5 | Putting a mistake right is management responsiveness; it also gives Category 3 more evidence |
| 11 Oct | 3.4 tested against later reviews using Rule B (share of reviews) | Rule A (2 or more later complaints) marked improving large businesses as broken |
| 11 Oct | A promise is testable only with 10 or more text reviews in both the before and the after window | A share taken from one or two reviews is unreliable and could mark a promise "kept" by accident |
| 11 Oct | Promise issue tags are split on ";" and matched by substring; the test uses the union of the mapped sub-points | Most promises carry several tags |
| 11 Oct | Category 1 renamed "Quality of the Result"; all 25 questions reworded | Researcher's wording |
| 11 Oct | **Framework frozen** | No further structural changes |
| 11 Oct | All safety notices removed from the screens (card box, header chip, side-panel text, "safety concern" section) | Consistent with the 10 Oct decision; safety is shown through the Category 7 score |
| 11 Oct | The business page shows Category 3 from the same data the score uses: complaints, replies to complaints, promise outcomes. Reply speed is no longer shown | The screen and the score must agree |

---

## 16. Open items

| # | Item | Owner |
|---|---|---|
| O1 | **Done 11 Oct.** Migration run and scoring run 5 completed: 7,561 pairs, 283 ranked (same as run 4). Promises: 30 kept, 40 broken, 8 no clear change, 71 not testable | Researcher |
| O2 | Files updated 11 Oct (`10_framework_v5_questions.sql`, `02_reference_data.sql`, `subPoints.js`). Run `10_framework_v5_questions.sql` in Supabase to finish | Researcher |
| O3 | Show this document to the supervisor (3.5 move, rewording) | Researcher |
| O4 | Taxonomy: Gents' Grooming (Beard & Shave) has no ranked businesses. Keep 5 categories, or move Beard & Shave under Hair (4 categories)? Not decided | Researcher |
| O5 | Check whether barber-shop listings were collected, and whether beard reviews were coded elsewhere | Researcher |
| O6 | **Closed 11 Oct.** No such filter exists. The caution chip, the safety-concern section, the side-panel safety text and the empty advisory box were removed | Coding agent |
| O7 | Sub-services within one service show identical ranked counts; check whether scores really differ between sub-services | To investigate |
| O8 | Thesis Chapters 2 and 3 were written for an older design (ten categories, expert panel); update to v5 | Researcher |
| O9 | Evaluation not started: functional tests, accuracy (300-review check, score recalculation, ranking vs star rating), performance, usability (20–30 participants), comparison table | Researcher |
