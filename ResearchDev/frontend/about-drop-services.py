# -*- coding: utf-8 -*-
"""Drop the "Services we cover" section from the About page, and everything
that existed only to feed it.

Idempotent. Re-run after a revert:   python about-drop-services.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
JSX = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ About.jsx ═══════════════════════════════════════════════════
s = io.open(JSX, encoding='utf-8').read()
if 'about-services' not in s:
    skipped.append('About.jsx')
else:
    lines = s.split('\n')
    a = next(i for i, l in enumerate(lines) if 'Services' in l and l.strip().startswith('{/*'))
    b = next(i for i, l in enumerate(lines)
             if i > a and l.strip() == '</section>')
    del lines[a:b + 2]              # the comment, the section, the blank line
    s = '\n'.join(lines)

    # Everything below existed only to build those cards.
    s = s.replace("""import { SERVICE_FAMILIES, SUB_SERVICES, COUNTS } from "../constants/taxonomy";\n""", "")

    start = s.index("/* Nobody names a file `makeup_bridal.webp`")
    end = s.index("const heroImage =")
    s = s[:start] + s[end:]

    for dead in ('SERVICE_FAMILIES', 'SUB_SERVICES', 'COUNTS',
                 'familyImage', 'FAMILY_ALIASES', 'about-service'):
        assert dead not in s, 'still referenced: ' + dead
    assert s.count('<section') == s.count('</section>')
    io.open(JSX, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')

# ══ index.css: the cards' styling goes with them ════════════════
s = io.open(CSS, encoding='utf-8').read()
start_marker = """/* Five service cards. The picture is a tall crop because every service photo
   in this project is of a person, and a landscape thumb crops all of them to
   a collarbone. */"""
if start_marker not in s:
    skipped.append('index.css')
else:
    a = s.index(start_marker)
    b = s.index("""/* The limits sit on a tinted panel.""")
    s = s[:a] + s[b:]
    assert 'about-service' not in s, 'service card CSS survived'
    assert s.count('{') == s.count('}'), 'brace mismatch'
    io.open(CSS, 'w', encoding='utf-8').write(s)
    done.append('index.css')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
