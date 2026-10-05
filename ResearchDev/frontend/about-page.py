# -*- coding: utf-8 -*-
"""Styling for the rebuilt About page.

Idempotent. Re-run after a revert:   python about-page.py
"""
import io
import os

CSS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src', 'index.css')
MARK = '/* -- About -- */'

s = io.open(CSS, encoding='utf-8').read()
if MARK in s:
    print('already applied')
    raise SystemExit

anchor = "/* ── Footer ───"
assert s.count(anchor) == 1, 'anchor missing'

BLOCK = MARK + """
/* The About page is the one place that explains the method, so it is set as
   an article: one measure for reading, full-bleed only where a picture earns
   it. Everything here is beige, black and white, like the rest. */
.about {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--gutter) 5rem;
}

/* Opening frame. The scrim is directional rather than flat — heaviest under
   the type, releasing across the picture — so the photograph is darkened
   only where it has to carry words. */
.about-hero {
  position: relative;
  margin: 0 0 2.5rem;
  border-radius: var(--radius-panel);
  overflow: hidden;
  min-height: clamp(15rem, 34vw, 22rem);
  display: flex;
  align-items: flex-end;
  background: var(--ink);
}
.about-hero-media { position: absolute; inset: 0; }
.about-hero-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 45%;
  display: block;
}
.about-hero-media::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(15deg,
    rgba(22, 21, 15, 0.86) 0%,
    rgba(22, 21, 15, 0.55) 42%,
    rgba(22, 21, 15, 0.18) 78%);
}
.about-hero-copy {
  position: relative;
  padding: clamp(1.5rem, 3vw, 2.5rem);
  color: #fff;
}
.about-hero-copy h1 {
  color: #fff;
  font-size: clamp(1.9rem, 4vw, 3rem);
  max-width: 18ch;
}
.about-hero-copy .editorial-eyebrow { color: var(--gold-300); }

/* The lede runs wider than body copy and lighter — it is a standfirst, read
   at a glance before the reader decides to commit to the rest. */
.about-lede {
  font-size: clamp(1rem, 1.5vw, 1.15rem);
  line-height: 1.75;
  color: var(--body);
  max-width: 62ch;
  margin-bottom: 3.5rem;
}

.about-section { margin-bottom: 3.5rem; }
.about h2 {
  font-size: clamp(1.3rem, 2.2vw, 1.75rem);
  margin-bottom: 0.9rem;
}
.about p { line-height: 1.75; color: var(--body); max-width: 68ch; }
.about p + p { margin-top: 1rem; }
.about-note { color: var(--muted); font-size: 0.95rem; margin-bottom: 1.5rem; }

/* Copy beside a picture. The image column is narrower than the text: the
   picture supports the argument, it does not make it. */
.about-split {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: clamp(1.5rem, 4vw, 3.25rem);
  align-items: center;
  margin-bottom: 3.5rem;
}
/* Alternating sides down the page, so two picture-and-text sections never
   stack into one column of images. */
.about-split--flip .about-split-copy { order: 2; }
.about-split--flip .about-split-media { order: 1; }
.about-split-media {
  margin: 0;
  border-radius: var(--radius-panel);
  overflow: hidden;
  aspect-ratio: 4 / 5;
  background: var(--surface);
}
.about-split-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* The ten categories, numbered. An ordered list because they ARE presented in
   a fixed order everywhere else in the app; the numbers are the same ones the
   priorities panel shows them in. */
.about-cats {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.15rem 2.5rem;
  counter-reset: none;
}
.about-cats li {
  display: flex;
  align-items: baseline;
  gap: 0.85rem;
  padding: 0.8rem 0;
  border-top: 1px solid var(--line-soft);
}
.about-cat-no {
  font-size: 0.66rem;
  font-weight: 600;
  color: var(--gold);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.about-cat-body { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
.about-cat-body strong { font-size: 0.92rem; font-weight: 600; color: var(--ink); }
.about-cat-body span { font-size: 0.78rem; color: var(--muted); }

/* Five service cards. The picture is a tall crop because every service photo
   in this project is of a person, and a landscape thumb crops all of them to
   a collarbone. */
.about-services {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.25rem;
}
.about-service-media {
  aspect-ratio: 3 / 4;
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 0.85rem;
  background:
    linear-gradient(150deg, var(--gold-100) 0%, var(--gold-300) 100%);
}
.about-service-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s var(--ease);
}
.about-service:hover .about-service-media img { transform: scale(1.04); }
.about-service h3 { font-size: 0.98rem; margin-bottom: 0.15rem; }
.about-service-count {
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--gold);
  margin-bottom: 0.35rem;
}
.about-service-list { font-size: 0.76rem; line-height: 1.5; color: var(--muted); }

/* The limits sit on a tinted panel. They are the part most likely to be
   skipped and the part most worth reading, so they get a surface of their
   own rather than being the last paragraph on white. */
.about-limits {
  background: var(--surface);
  border-radius: var(--radius-panel);
  padding: clamp(1.5rem, 3vw, 2.25rem);
  margin-bottom: 0;
}
.about-limits h2 { margin-bottom: 0.6rem; }

@media (max-width: 780px) {
  /* One column, and the image always follows its copy — flipping the order
     on a stacked layout would put a picture above the heading it belongs to. */
  .about-split { grid-template-columns: 1fr; gap: 1.5rem; }
  .about-split--flip .about-split-copy,
  .about-split--flip .about-split-media { order: 0; }
  .about-split-media { aspect-ratio: 16 / 10; }
  .about-cats { gap: 0; }
}

"""
s = s.replace(anchor, BLOCK + anchor)
assert s.count('{') == s.count('}'), 'brace mismatch'
io.open(CSS, 'w', encoding='utf-8').write(s)
print('applied; braces %d' % s.count('{'))
