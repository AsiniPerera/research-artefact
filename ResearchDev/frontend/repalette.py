# -*- coding: utf-8 -*-
"""Black, white and beige only — plus Availability defaulting to Open Now.

Every hue outside the warm-neutral family is mapped onto the ink/beige scale
the design system already owns:

    black   #16150f  #24221a  #3a362b  #56503f
    beige   #524628  #6b5d3e  #b3a489  #e0d9c8  #f1ede3
    paper   #ffffff

Idempotent. Re-run after a revert:   python repalette.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
CSS = os.path.join(ROOT, 'src', 'index.css')
RK = os.path.join(ROOT, 'src', 'screens', 'Rankings.jsx')
done, skipped = [], []

s = io.open(CSS, encoding='utf-8').read()
MARK = 'beige ramp, light to dark'

if MARK in s:
    skipped.append('index.css')
else:
    def sub(old, new, cnt=1):
        global s
        n = s.count(old)
        assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:64])
        s = s.replace(old, new)

    # ── Priority ramp: red→green becomes light beige→dark bronze ──
    sub("""  --lvl-1: rgba(211, 30, 55, 0.38);   --lvl-1-ink: #b3122a;  --lvl-1-halo: rgba(211, 30, 55, 0.42);
  --lvl-2: rgba(255, 140, 26, 0.38);  --lvl-2-ink: #a85200;  --lvl-2-halo: rgba(255, 140, 26, 0.42);
  --lvl-3: rgba(255, 196, 32, 0.42);  --lvl-3-ink: #8a6a00;  --lvl-3-halo: rgba(255, 196, 32, 0.46);
  --lvl-4: rgba(34, 163, 84, 0.38);   --lvl-4-ink: #15703a;  --lvl-4-halo: rgba(34, 163, 84, 0.42);""",
        """  /* A beige ramp, light to dark. This was crimson-amber-gold-emerald, which
     said "low is bad, high is good" — a judgement the scale never meant to
     make, since a Low here is a deliberate choice not a failing. Depth reads
     as MORE just as clearly as hue did, and it is the only ordering a
     three-colour palette can express. Every -ink clears AA on white. */
  --lvl-1: rgba(179, 164, 137, 0.38); --lvl-1-ink: #7a6a4e;  --lvl-1-halo: rgba(179, 164, 137, 0.42);
  --lvl-2: rgba(154, 138, 111, 0.38); --lvl-2-ink: #6b5d3e;  --lvl-2-halo: rgba(154, 138, 111, 0.42);
  --lvl-3: rgba(122, 106, 78, 0.42);  --lvl-3-ink: #5a4d33;  --lvl-3-halo: rgba(122, 106, 78, 0.46);
  --lvl-4: rgba(82, 70, 40, 0.38);    --lvl-4-ink: #3f351f;  --lvl-4-halo: rgba(82, 70, 40, 0.42);""")

    sub("""  --lvl-1-bar: #d31e37;   /* red    */
  --lvl-2-bar: #f0800f;   /* orange */
  --lvl-3-bar: #f0b81e;   /* yellow */
  --lvl-4-bar: #22a354;   /* green  */""",
        """  --lvl-1-bar: #ded5c2;   /* palest  */
  --lvl-2-bar: #b3a489;
  --lvl-3-bar: #8a7854;
  --lvl-4-bar: #524628;   /* deepest */""")

    # ── The cool accent becomes the ink it was standing in for ────
    sub("""  --slate:     #5b6b8a;
  --slate-700: #47566f;""",
        """  /* Kept under the old name because ~40 rules reference it. It is no longer
     slate: primary fills, selected states and focus edges are near-black now,
     which is the only "accent" a black/white/beige palette has that is not
     simply more beige. */
  --slate:     #24221a;
  --slate-700: #16150f;""")

    sub("""  --accent:     #d9a299;
  --accent-700: #c78d82;""",
        """  --accent:     #b3a489;
  --accent-700: #9a8a6f;""")

    # ── Status. Hue was doing the work here; wording has to now. ──
    sub("""  --ok:    #587a5e;
  --warn:  #8a6b2c;
  --bad:   #a05548;""",
        """  /* These annotated by hue. With one hue family left they annotate by DEPTH
     instead — fine for ok and warn, which are read alongside their own
     labels, and a real loss for --bad, which is the only one people rely on
     spotting without reading. It keeps the deepest, warmest tone available so
     it still separates from body copy, but an error no longer shouts. */
  --ok:    #6b5d3e;
  --warn:  #5a4d33;
  --bad:   #4a3a22;""")

    # ── Domain accents ────────────────────────────────────────────
    sub("""  --domain-hair: #6b3c3c;              /* burgundy */
  --domain-hair-halo: rgba(107, 60, 60, 0.24);
  --domain-skin: #8b5528;              /* brown */
  --domain-skin-halo: rgba(139, 85, 40, 0.26);
  --domain-bridal: #8b7332;            /* olive */
  --domain-bridal-halo: rgba(139, 115, 50, 0.28);
  --domain-nails: #8b7355;             /* taupe (neutral) */
  --domain-nails-halo: rgba(139, 115, 85, 0.24);
  --domain-grooming: #3c6432;          /* forest */
  --domain-grooming-halo: rgba(60, 100, 50, 0.28);""",
        """  /* Five beiges rather than five hues. They no longer distinguish the five
     domains from one another — nothing in a single-family palette can — so
     they now only mark "this domain is selected". The domain's NAME is what
     tells you which. */
  --domain-hair: #4a3f26;
  --domain-hair-halo: rgba(74, 63, 38, 0.24);
  --domain-skin: #5a4d33;
  --domain-skin-halo: rgba(90, 77, 51, 0.26);
  --domain-bridal: #6b5d3e;
  --domain-bridal-halo: rgba(107, 93, 62, 0.28);
  --domain-nails: #7a6a4e;
  --domain-nails-halo: rgba(122, 106, 78, 0.24);
  --domain-grooming: #8a7854;
  --domain-grooming-halo: rgba(138, 120, 84, 0.28);""")

    # ── Hero light pools ──────────────────────────────────────────
    sub("""  --iris-sky:   178, 209, 238;
  --iris-peri:  203, 196, 233;
  --iris-sage:  193, 223, 212;
  --iris-blush: 233, 212, 227;""",
        """  --iris-sky:   224, 217, 200;
  --iris-peri:  212, 202, 180;
  --iris-sage:  233, 227, 212;
  --iris-blush: 218, 206, 184;""")

    sub("""  --field-line-lit: #5b6b8a;""", """  --field-line-lit: #6b5d3e;""")

    # ── Hardcoded leftovers ───────────────────────────────────────
    s = s.replace('rgba(38, 48, 66,', 'rgba(22, 21, 15,')
    s = s.replace('rgba(91, 107, 138,', 'rgba(107, 93, 62,')
    s = s.replace('#b9c6d6', '#c8c0ae')
    sub(""".tm-item:nth-child(3n + 1) { color: #a00000; }""",
        """.tm-item:nth-child(3n + 1) { color: var(--gold-600); }""")
    sub("""    rgba(73, 154, 19, 0.08) 100%);""", """    rgba(107, 93, 62, 0.08) 100%);""")

    # the accent-word gradient on the landing headline
    sub("""  color: #7c8fb5;
  background: linear-gradient(100deg, #8aa6cf 0%, #a99fc9 46%, #cfa8bd 100%);""",
        """  color: var(--gold);
  background: linear-gradient(100deg, #8a7854 0%, #6b5d3e 46%, #4a3f26 100%);""")

    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

# ══ Availability defaults to Open Now ═══════════════════════════
s = io.open(RK, encoding='utf-8').read()
OLD = """  /* "any", not "open": a filter that hides most of the results before the
     visitor has asked for anything is the wrong first impression. */
  availability: "any","""
if OLD in s:
    s = s.replace(OLD, """  availability: "open",""")
    io.open(RK, 'w', encoding='utf-8').write(s)
    done.append('Rankings.jsx')
elif 'availability: "open"' in s:
    skipped.append('Rankings.jsx')
else:
    raise SystemExit('availability default not found')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
