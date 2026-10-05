# -*- coding: utf-8 -*-
"""About page copy: a working product, not a dissertation.

The academic framing goes — no MSc, no Design Science Research, no F1 scores
or inter-annotator agreement or ablation. What stays is the substance those
words were carrying, said the way you would say it to a client: the method is
tested, and here is what each test is for.

It does NOT claim scale, partnerships or a user base the app does not have.
Dropping the research framing is a change of voice, not a licence to invent.

Idempotent. Re-run after a revert:   python about-copy.py
"""
import io
import os

JSX = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   'src', 'screens', 'About.jsx')
s = io.open(JSX, encoding='utf-8').read()

if 'MSc' not in s:
    print('already rewritten')
    raise SystemExit


def sub(old, new):
    global s
    assert s.count(old) == 1, 'expected 1 got %d: %r' % (s.count(old), old[:70])
    s = s.replace(old, new)


# ── The standfirst ────────────────────────────────────────────────
sub("""        Amore Beauty is a research prototype built around one question: can a ranking be
        personal and honest at the same time? It comes out of an MSc Design Science
        Research project, and the real contribution is the method — the application
        you&apos;re using is how that method is demonstrated and evaluated.""",
    """        Amore Beauty ranks salons on what their clients actually wrote, not on a single
        star average. You decide which things matter to you, and the ranking rearranges
        itself around that — because the salon that suits a bride the week before her
        wedding is rarely the one that suits a Tuesday afternoon haircut.""")

# ── How it's evaluated → what the checks are for ─────────────────
sub("""          <h2>How it&apos;s evaluated</h2>
          <p>
            Extraction is measured against a human-annotated sample and has to clear an F1
            of 0.75 and inter-annotator agreement of 0.70 before its output is trusted. It
            is also held against a sentiment-analysis baseline it must beat to justify its
            cost. The reliability weighting is tested by ablation — removing it has to make
            the ranking measurably worse, or it isn&apos;t earning its place in the
            formula. Weights are checked for stability, so a small change in what you ask
            for cannot produce a wildly different list.
          </p>""",
    """          <h2>How we know it works</h2>
          <p>
            A ranking is only worth as much as the checks behind it, so every part of the
            method has to earn its place before it goes near a result you see.
          </p>
          <p>
            The reading is checked against the same reviews read by people. Where the two
            disagree too often, that part of the method does not ship. It is also compared
            against the simplest thing that could work — if counting positive and negative
            words does the job just as well, the extra effort is not worth what it costs
            you in accuracy you cannot verify.
          </p>
          <p>
            The confidence weighting is tested by taking it out: if removing it does not
            make the ranking measurably worse, it was never doing anything. And your
            priorities are tested for stability, so nudging one slider shifts the order a
            little rather than rewriting the whole list.
          </p>""")

# ── Limits: same honesty, less thesis ────────────────────────────
sub("""          Scores reflect what reviewers chose to write about, which is not the same as
          everything that matters — quiet virtues go unmentioned and stay unscored.
          Perceived value is inferred from reviews rather than a price list, which is why
          it is never used to exclude a salon. And a salon with no reviews is not a bad
          salon; it is simply one we have nothing to say about, which is why it is listed
          apart rather than ranked last.""",
    """          We can only score what people chose to write about. A salon that is quietly
          excellent at something nobody mentions will not be credited for it here, and
          that is a real gap rather than a rounding error. Value is read out of what
          reviewers said about price, not from a price list, so we use it to order
          salons and never to rule one out. And a salon with no reviews is not a bad
          salon — it is one we have nothing to say about yet, which is why you will find
          it listed apart rather than buried at the bottom.""")

assert 'MSc' not in s and 'F1' not in s and 'ablation' not in s
assert 'inter-annotator' not in s and 'research prototype' not in s
io.open(JSX, 'w', encoding='utf-8').write(s)
print('About copy rewritten')
