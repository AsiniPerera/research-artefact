# -*- coding: utf-8 -*-
"""The images folder was reorganised into logo/ services/ source/, which broke
the build and silently emptied the service pictures.

  1. logo-mark.png moved into logo/ — two imports could not resolve, and the
     build failed outright.
  2. Every glob matched "images/*" only, one level deep, so the five service
     photos in services/ stopped being found. Nothing errored: they simply
     resolved to null and the cards fell back to their gradient.

Idempotent. Re-run after a revert:   python fix-image-paths.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
done, skipped = [], []

# ── 1. Logo imports ───────────────────────────────────────────────
for rel, old in [
    ('App.jsx', 'from "./assets/images/logo-mark.png"'),
    (os.path.join('screens', 'Auth.jsx'), 'from "../assets/images/logo-mark.png"'),
]:
    p = os.path.join(SRC, rel)
    s = io.open(p, encoding='utf-8').read()
    new = old.replace('images/logo-mark.png', 'images/logo/logo-mark.png')
    if new in s:
        skipped.append(rel)
        continue
    assert s.count(old) == 1, '%s: import not found' % rel
    io.open(p, 'w', encoding='utf-8').write(s.replace(old, new))
    done.append(rel)

# ── 2. Globs: recurse, and keep the originals out of the bundle ──
OLD_ONE = '''  ["../assets/images/*.{jpg,jpeg,png,webp}", "!../assets/images/logo*"],'''
NEW_ONE = '''  /* ** so the subfolders count: the service photos live in images/services
     now, and a single-level glob quietly returned nothing for them.
     source/ holds the full-size originals — matching it would bundle a 5 MB
     PNG that nothing renders. */
  [
    "../assets/images/**/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo/**",
    "!../assets/images/source/**",
  ],'''

for rel in [os.path.join('screens', 'About.jsx'), os.path.join('screens', 'Contact.jsx')]:
    p = os.path.join(SRC, rel)
    s = io.open(p, encoding='utf-8').read()
    if '**/*' in s:
        skipped.append(rel)
        continue
    assert s.count(OLD_ONE) == 1, '%s: glob not found' % rel
    io.open(p, 'w', encoding='utf-8').write(s.replace(OLD_ONE, NEW_ONE))
    done.append(rel)

p = os.path.join(SRC, 'screens', 'Landing.jsx')
s = io.open(p, encoding='utf-8').read()
if '**/*' in s:
    skipped.append('Landing.jsx')
else:
    OLD_L = '''    "../assets/images/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo*",'''
    assert s.count(OLD_L) == 1, 'landing glob not found'
    s = s.replace(OLD_L, '''    "../assets/images/**/*.{jpg,jpeg,png,webp}",
    "!../assets/images/logo/**",
    "!../assets/images/source/**",''')
    # herogirl.jpg is gone with the reshuffle
    s = s.replace(
        "const heroBackdrop = byName.herogirl ?? byName.about1 ?? byName.contact1 ?? null;",
        "const heroBackdrop = byName.contact1 ?? byName.about1 ?? byName.auth ?? null;")
    io.open(p, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ── 3. Fallback chains naming files that no longer exist ─────────
p = os.path.join(SRC, 'screens', 'Contact.jsx')
s = io.open(p, encoding='utf-8').read()
s2 = s.replace("const heroImage = byName.contact1 ?? byName.herogirl ?? null;",
               "const heroImage = byName.contact1 ?? byName.about1 ?? null;")
if s2 != s:
    io.open(p, 'w', encoding='utf-8').write(s2)
    if 'Contact.jsx (fallbacks)' not in done:
        done.append('Contact.jsx (fallbacks)')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
