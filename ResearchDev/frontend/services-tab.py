# -*- coding: utf-8 -*-
"""A Services tab in the nav, landing on the home page's Our Services section.

Idempotent. Re-run after a revert:   python services-tab.py
"""
import io
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, 'src', 'App.jsx')
LAND = os.path.join(ROOT, 'src', 'screens', 'Landing.jsx')
done, skipped = [], []

# ══ Landing: a ref and a prop for the services section ══════════
s = io.open(LAND, encoding='utf-8').read()
if 'scrollToServices' in s:
    skipped.append('Landing.jsx')
else:
    s = s.replace(
        """export function Landing({ onExplore, scrollToContact = false, scrollToOffers = false }) {""",
        """export function Landing({
  onExplore,
  scrollToContact = false,
  scrollToOffers = false,
  scrollToServices = false,
}) {""")

    s = s.replace("""  const offersRef = useRef(null);""",
                  """  const offersRef = useRef(null);
  const servicesRef = useRef(null);""")

    s = s.replace("""    if (scrollToOffers) {
      offersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollToContact, scrollToOffers]);""",
                  """    if (scrollToOffers) {
      offersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (scrollToServices) {
      servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollToContact, scrollToOffers, scrollToServices]);""")

    old = """      <section className="services-section">"""
    assert s.count(old) == 1, 'services section not found'
    s = s.replace(old, """      <section className="services-section" ref={servicesRef}>""")

    assert s.count('servicesRef') == 3
    io.open(LAND, 'w', encoding='utf-8').write(s)
    done.append('Landing.jsx')

# ══ App: the tab, the route, the scroll ═════════════════════════
s = io.open(APP, encoding='utf-8').read()
if 'ourservices' in s:
    skipped.append('App.jsx')
else:
    # "Services" and "Explore" are different things and sit next to each
    # other, so the labels have to carry the difference: Services shows what
    # is on offer, Explore ranks salons that do it.
    s = s.replace("""const NAV = [
  { key: "home",     label: "Home" },
  { key: "services", label: "Explore" },""",
                  """const NAV = [
  { key: "home",        label: "Home" },
  { key: "ourservices", label: "Services" },
  { key: "services",    label: "Explore" },""")
    s = s.replace("""  { key: "offers",   label: "Offers & Promotions" },
  { key: "about",    label: "About" },
  { key: "contact",  label: "Contact" },""",
                  """  { key: "offers",      label: "Offers & Promotions" },
  { key: "about",       label: "About" },
  { key: "contact",     label: "Contact" },""")

    old = """  const isLanding = (route === "home" || route === "offers") && !selectedSalon;"""
    assert s.count(old) == 1, 'isLanding not found'
    s = s.replace(old, """  const isLanding =
    (route === "home" || route === "offers" || route === "ourservices") && !selectedSalon;""")

    old2 = """          ) : route === "home" || route === "offers" ? ("""
    assert s.count(old2) == 1, 'landing branch not found'
    s = s.replace(old2, """          ) : route === "home" || route === "offers" || route === "ourservices" ? (""")

    old3 = """              scrollToOffers={route === "offers"}"""
    assert s.count(old3) == 1, 'scrollToOffers not found'
    s = s.replace(old3, """              scrollToOffers={route === "offers"}
              scrollToServices={route === "ourservices"}""")

    io.open(APP, 'w', encoding='utf-8').write(s)
    done.append('App.jsx')

print('APPLIED : ' + (', '.join(done) if done else '(nothing)'))
print('SKIPPED : ' + (', '.join(skipped) if skipped else '(nothing)'))
