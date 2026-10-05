# -*- coding: utf-8 -*-
"""1. The landing page's contact section goes. Contact has had its own page
      since the routing change, so this was a second copy of the same form —
      and the two had already drifted apart in wording and field set.
   2. The About heading stops describing the method and starts saying what
      the thing is for.

Idempotent. Re-run after a revert:   python drop-landing-contact.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
LAND = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
ABOUT = os.path.join(ROOT, 'src', 'screens', 'About.jsx')
CSS = os.path.join(ROOT, 'src', 'index.css')
done, skipped = [], []

# ══ 1. Landing loses the contact section and its machinery ══════
s = io.open(LAND, encoding='utf-8').read()
if 'contactRef' not in s:
    skipped.append('Landing.jsx')
else:
    lines = s.split('\n')
    a = next(i for i, l in enumerate(lines) if 'className="contact"' in l)
    # back up over the comment block above it
    while a > 0 and (lines[a - 1].strip().startswith('{/*') or
                     (lines[a - 1].strip() and not lines[a - 1].strip().startswith('<')
                      and '*/}' in ''.join(lines[max(0, a - 6):a]))):
        a -= 1
        if lines[a].strip().startswith('{/*'):
            break
    # the section closes at the matching </section>
    depth = 0
    b = None
    for i in range(a, len(lines)):
        depth += lines[i].count('<section')
        depth -= lines[i].count('</section>')
        if depth == 0 and '</section>' in lines[i]:
            b = i
            break
    assert b is not None, 'contact section end not found'
    del lines[a:b + 1]
    s = '\n'.join(lines)

    # state and helpers that existed only for it
    s = s.replace("""  const [contact, setContact] = useState({
    name: "",
    email: "",
    message: "",
    topic: CONTACT_TOPICS[0],
  });
  const [sent, setSent] = useState(false);
  const contactRef = useRef(null);
""", "")
    s = s.replace("""    if (scrollToContact) {
      contactRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
""", "")
    s = s.replace("""  }, [scrollToContact, scrollToOffers, scrollToServices]);""",
                  """  }, [scrollToOffers, scrollToServices]);""")
    s = s.replace("""  scrollToContact = false,\n""", "")

    start = s.index('function handleContact(e)')
    # walk to the closing brace of the function
    depth = 0
    i = s.index('{', start)
    j = i
    while True:
        if s[j] == '{':
            depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0:
                break
        j += 1
    # take the whole line the function starts on, and the blank line after
    ls = s.rindex('\n', 0, start) + 1
    le = s.index('\n', j) + 1
    while s[le:le + 1] == '\n':
        le += 1
    s = s[:ls] + s[le:]

    # the topics list, and imports that went with the section
    ta = s.index('/* Reasons someone reaches out')
    tb = s.index('\n', s.index('];', ta)) + 1
    while s[tb:tb + 1] == '\n':
        tb += 1
    s = s[:ta] + s[tb:]

    s = s.replace("""  IconMail,
  IconClock,
  IconPin,
  IconInstagram,
  IconFacebook,
""", "")

    for dead in ('contactRef', 'CONTACT_TOPICS', 'handleContact', 'setContact',
                 'className="contact"', 'scrollToContact'):
        assert dead not in s, 'still referenced: ' + dead
    assert s.count('<section') == s.count('</section>')
    io.open(LAND, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══ App: stop passing a prop that no longer exists ══════════════
APP = os.path.join(ROOT, 'src', 'App.jsx')
s = io.open(APP, encoding='utf-8').read()
if 'scrollToContact' in s:
    s = s.replace("""              scrollToContact={route === "contact"}\n""", "")
    io.open(APP, 'w', encoding='utf-8').write(s)
    done.append('App.jsx')

# ══ 2. A warmer heading ═════════════════════════════════════════
s = io.open(ABOUT, encoding='utf-8').read()
old = """          <h1>Ranking salons on evidence, not averages</h1>"""
if old in s:
    s = s.replace(old, """          <h1>Helping you find a salon you&apos;ll love</h1>""")
    io.open(ABOUT, 'w', encoding='utf-8').write(s)
    done.append('About.jsx')
else:
    skipped.append('About.jsx')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
