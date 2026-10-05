# -*- coding: utf-8 -*-
"""Rebuild the accent around #d4aa7d — a warm tan — and drop the olive-brown.

The palette was black / white / a bronze-olive family (#6b5d3e and friends,
hue ~42 at low saturation), which reads brown and slightly muddy. Everything
in that family is re-cut at hue ~32, the given tone's own hue.

#d4aa7d itself is 2.13:1 on white, so it cannot carry text. It becomes the
--gold-300 step — fills, rules, marks on dark — and the text-bearing steps are
darker cuts of the same hue that clear AA.

Idempotent. Re-run after a revert:   python retint.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = 'tan, not olive-brown'

s = io.open(CSS, encoding='utf-8').read()
if MARK in s:
    print('already applied')
    raise SystemExit


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:64])
    s = s.replace(old, new)


# ── The accent family ─────────────────────────────────────────────
sub("""  --gold:       #6b5d3e;
  --gold-600:   #524628;
  --gold-300:   #b3a489;
  --gold-100:   #e0d9c8;
  --gold-50:    #f1ede3;""",
    """  /* Cut around #d4aa7d — tan, not olive-brown. The old family sat at hue 42
     with the saturation low enough to read as mud; these hold hue ~32 and let
     the warmth show. The given tone IS --gold-300: at 2.13:1 on white it
     cannot carry text, so it does fills, rules and marks on dark, and the two
     steps below it are the same hue cut deep enough to clear AA (4.8:1 and
     6.7:1 on white). */
  --gold:       #96692f;
  --gold-600:   #7a5522;
  --gold-300:   #d4aa7d;
  --gold-100:   #f2e2cf;
  --gold-50:    #fbf4ec;""")

sub("""  --gold-muted: #a99a85;""", """  --gold-muted: #b09a7c;""")

# ── The priority ramp, re-cut in the same hue ────────────────────
sub("""  --lvl-1: rgba(179, 164, 137, 0.38); --lvl-1-ink: #7a6a4e;  --lvl-1-halo: rgba(179, 164, 137, 0.42);
  --lvl-2: rgba(154, 138, 111, 0.38); --lvl-2-ink: #6b5d3e;  --lvl-2-halo: rgba(154, 138, 111, 0.42);
  --lvl-3: rgba(122, 106, 78, 0.42);  --lvl-3-ink: #5a4d33;  --lvl-3-halo: rgba(122, 106, 78, 0.46);
  --lvl-4: rgba(82, 70, 40, 0.38);    --lvl-4-ink: #3f351f;  --lvl-4-halo: rgba(82, 70, 40, 0.42);""",
    """  --lvl-1: rgba(226, 199, 165, 0.38); --lvl-1-ink: #a97a3c;  --lvl-1-halo: rgba(226, 199, 165, 0.42);
  --lvl-2: rgba(212, 170, 125, 0.38); --lvl-2-ink: #96692f;  --lvl-2-halo: rgba(212, 170, 125, 0.42);
  --lvl-3: rgba(180, 132, 79, 0.42);  --lvl-3-ink: #7a5522;  --lvl-3-halo: rgba(180, 132, 79, 0.46);
  --lvl-4: rgba(138, 96, 44, 0.38);   --lvl-4-ink: #5e401a;  --lvl-4-halo: rgba(138, 96, 44, 0.42);""")

sub("""  --lvl-1-bar: #ded5c2;   /* palest  */
  --lvl-2-bar: #b3a489;
  --lvl-3-bar: #8a7854;
  --lvl-4-bar: #524628;   /* deepest */""",
    """  --lvl-1-bar: #f2e2cf;   /* palest  */
  --lvl-2-bar: #d4aa7d;
  --lvl-3-bar: #a97a3c;
  --lvl-4-bar: #7a5522;   /* deepest */""")

# ── Domain marks ──────────────────────────────────────────────────
sub("""  --domain-hair: #4a3f26;
  --domain-hair-halo: rgba(74, 63, 38, 0.24);
  --domain-skin: #5a4d33;
  --domain-skin-halo: rgba(90, 77, 51, 0.26);
  --domain-bridal: #6b5d3e;
  --domain-bridal-halo: rgba(107, 93, 62, 0.28);
  --domain-nails: #7a6a4e;
  --domain-nails-halo: rgba(122, 106, 78, 0.24);
  --domain-grooming: #8a7854;
  --domain-grooming-halo: rgba(138, 120, 84, 0.28);""",
    """  --domain-hair: #6b4a19;
  --domain-hair-halo: rgba(107, 74, 25, 0.24);
  --domain-skin: #7a5522;
  --domain-skin-halo: rgba(122, 85, 34, 0.26);
  --domain-bridal: #96692f;
  --domain-bridal-halo: rgba(150, 105, 47, 0.28);
  --domain-nails: #a97a3c;
  --domain-nails-halo: rgba(169, 122, 60, 0.24);
  --domain-grooming: #b98d52;
  --domain-grooming-halo: rgba(185, 141, 82, 0.28);""")

# ── Light pools and washes ────────────────────────────────────────
sub("""  --iris-sky:   224, 217, 200;
  --iris-peri:  212, 202, 180;
  --iris-sage:  233, 227, 212;
  --iris-blush: 218, 206, 184;""",
    """  --iris-sky:   242, 226, 207;
  --iris-peri:  226, 199, 165;
  --iris-sage:  251, 244, 236;
  --iris-blush: 212, 170, 125;""")

sub("""  --ok:    #6b5d3e;
  --warn:  #5a4d33;
  --bad:   #4a3a22;""",
    """  --ok:    #96692f;
  --warn:  #7a5522;
  --bad:   #6b3c10;""")

sub("""  --accent:     #b3a489;
  --accent-700: #9a8a6f;""",
    """  --accent:     #d4aa7d;
  --accent-700: #b98d52;""")

sub("""  --field-line-lit: #6b5d3e;""", """  --field-line-lit: #96692f;""")

# ── Neutrals: the warm greys were reading brown too ──────────────
sub("""  --muted:      #6e675b;
  --faint:      #918978;
  --line:       #e4e0d6;
  --line-soft:  #efece4;
  --surface:    #f2efe8;""",
    """  --muted:      #6d6355;
  --faint:      #948875;
  --line:       #e8e1d6;
  --line-soft:  #f2ede4;
  --surface:    #f7f2ea;""")

# ── Hardcoded leftovers from the old family ──────────────────────
s = s.replace('rgba(107, 93, 62,', 'rgba(150, 105, 47,')
s = s.replace('#c8c0ae', '#d8c3a6')
s = s.replace('linear-gradient(100deg, #8a7854 0%, #6b5d3e 46%, #4a3f26 100%)',
              'linear-gradient(100deg, #d4aa7d 0%, #a97a3c 46%, #7a5522 100%)')

assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
