"""
Functionality evaluation for the Amore Beauty web application -- F-01 .. F-35.

READ-ONLY against the deployed site. This script drives a headless Edge browser
over the DevTools protocol, performs each user action against the live host and
records what it observes. It makes no change to the database: the only writes it
causes are a favourite being saved and then unsaved again (F-20/F-21), which it
reverses before finishing. It prints a markdown table and writes the same rows
to functionality_results.csv beside this file.

Integrity: every test's Status is computed from what the browser reports.
Nothing is hardcoded to "Pass". A test whose precondition is missing records
"Not testable" with the reason rather than a Pass or a Fail, so a selector that
has gone stale can never be mistaken for working software.

Run it yourself:
    python evaluation/functionality/functionality_tests.py
    python evaluation/functionality/functionality_tests.py --base http://localhost:5173

Requires: Microsoft Edge, and `pip install websocket-client`.

Scope note. This evaluates the DEPLOYED artefact. The live build may lag the
working tree; the header the script prints records the host and the date so a
result can always be tied to the build it describes.

Two findings are expected to FAIL on the build evaluated on 2026-10-20 (F-31,
F-32). They are WCAG text defects, not functional breakages, and they are left
failing on purpose: a passing table that hides them would misreport the artefact.
"""

import argparse
import base64
import csv
import json
import os
import subprocess
import sys
import threading
import time
import urllib.request

try:
    import websocket  # websocket-client
except ImportError:
    sys.exit("pip install websocket-client")

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 9444
DEFAULT_BASE = "https://amore-beauty-qckp.onrender.com"
EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

# A service that is known to carry a ranked list. HR.CUT.01 = Haircut & Trim.
SERVICE_HASH = "#/services?family=hair&sub=haircut_trim"
SERVICE_CODE = "HR.CUT.01"

ROWS = ".slr"              # one ranked salon row in the deployed build
NAMES = "JSON.stringify([...document.querySelectorAll('.slr-name')].map(e=>e.textContent.trim()))"
SCORES = "JSON.stringify([...document.querySelectorAll('.slr-score-num')].map(e=>e.textContent.trim()))"


# ---------------------------------------------------------------- CDP driver

class Tab:
    def __init__(self, ws_url):
        # Edge 155 refuses a CDP socket whose Origin it was not told to allow.
        self.ws = websocket.create_connection(ws_url, timeout=180, suppress_origin=True)
        self.id = 0
        self.events = []
        self.lock = threading.Lock()

    def call(self, method, **params):
        with self.lock:
            self.id += 1
            mid = self.id
            self.ws.send(json.dumps({"id": mid, "method": method, "params": params}))
            while True:
                msg = json.loads(self.ws.recv())
                if msg.get("id") == mid:
                    if "error" in msg:
                        raise RuntimeError(f"{method}: {msg['error']}")
                    return msg.get("result", {})
                if "method" in msg:
                    self.events.append(msg)

    def drain(self, seconds):
        end = time.time() + seconds
        self.ws.settimeout(0.4)
        try:
            while time.time() < end:
                try:
                    msg = json.loads(self.ws.recv())
                    if "method" in msg:
                        self.events.append(msg)
                except Exception:
                    pass
        finally:
            self.ws.settimeout(180)

    def js(self, expr, default=None):
        res = self.call("Runtime.evaluate", expression=expr, returnByValue=True).get("result", {})
        if res.get("subtype") == "error":
            return default
        v = res.get("value")
        return default if v is None else v

    def jsonjs(self, expr, default=None):
        v = self.js(expr)
        if not isinstance(v, str):
            return default
        try:
            return json.loads(v)
        except Exception:
            return default

    def shot(self, name, w=1440, h=950):
        d = self.call("Page.captureScreenshot", format="png",
                      clip={"x": 0, "y": 0, "width": w, "height": h, "scale": 1})
        open(os.path.join(HERE, name), "wb").write(base64.b64decode(d["data"]))


def _attach():
    tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=8))
    t = next(x for x in tabs if x["type"] == "page")
    tab = Tab(t["webSocketDebuggerUrl"])
    for domain in ("Runtime", "Page", "Network", "Log"):
        tab.call(f"{domain}.enable")
    return tab


def launch():
    """Reuse the headless instance on PORT if one is up, else start one.

    Only ever touches this port's instance, never the user's own browser."""
    try:
        return None, _attach()
    except Exception:
        pass
    edge = next((p for p in EDGE_CANDIDATES if os.path.exists(p)), None)
    if not edge:
        sys.exit("Microsoft Edge not found")
    proc = subprocess.Popen(
        [edge, "--headless=new", f"--remote-debugging-port={PORT}",
         "--remote-allow-origins=*", f"--user-data-dir={os.path.join(HERE, '.edge-profile')}",
         "--no-first-run", "--disable-gpu", "--hide-scrollbars", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(90):
        time.sleep(1.0)
        try:
            return proc, _attach()
        except Exception:
            continue
    proc.terminate()
    sys.exit("could not start Edge")


def goto(tab, base, hashpath, wait=18, width=1440, height=950, mobile=False):
    tab.call("Page.navigate", url="about:blank")
    time.sleep(0.3)
    tab.call("Emulation.setDeviceMetricsOverride", width=width, height=height,
             deviceScaleFactor=1, mobile=mobile)
    tab.events.clear()
    tab.call("Page.navigate", url=base + hashpath)
    tab.drain(wait)


def problems(tab):
    """Failed requests and uncaught exceptions since the last clear."""
    net, exc = [], []
    for e in tab.events:
        m = e.get("method")
        if m == "Network.responseReceived":
            r = e["params"]["response"]
            if r.get("status", 0) >= 400 and "favicon" not in r["url"]:
                net.append(f"{r['status']} {r['url'][:90]}")
        elif m == "Runtime.exceptionThrown":
            d = e["params"]["exceptionDetails"]
            txt = (d.get("exception", {}).get("description") or d.get("text") or "")[:140]
            # A browser-extension message from the test profile, not the app.
            if "Receiving end does not exist" not in txt:
                exc.append(txt)
    return net, exc


# -------------------------------------------------------- accessibility probe

A11Y = r"""(()=>{
 const parse=c=>(c.match(/[\d.]+/g)||[0,0,0]).map(Number);
 const lum=p=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};
   return .2126*f(p[0])+.7152*f(p[1])+.0722*f(p[2])};
 const bgOf=e=>{let b=e;while(b){const c=getComputedStyle(b).backgroundColor;
   const v=parse(c), a=(c.match(/[\d.]+/g)||[])[3];
   if(a===undefined||Number(a)>0.9) return v; b=b.parentElement;} return [255,255,255];};
 const low=[],small=[];
 document.querySelectorAll('body *').forEach(e=>{
   const r=e.getBoundingClientRect(); if(!r.width||!r.height) return;
   const s=getComputedStyle(e);
   if(s.visibility==='hidden'||s.display==='none') return;
   if(r.right<=0||r.left>=innerWidth) return;          // off-screen drawers do not count
   if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) return;
   const px=parseFloat(s.fontSize), wt=parseInt(s.fontWeight)||400;
   if(px<12) small.push(px.toFixed(1)+'px "'+e.textContent.trim().slice(0,22)+'"');
   const a=lum(parse(s.color)), z=lum(bgOf(e));
   const cr=(Math.max(a,z)+.05)/(Math.min(a,z)+.05);
   const big = px>=24 || (px>=18.66 && wt>=700);
   if(cr < (big?3:4.5)) low.push(cr.toFixed(2)+':1 at '+px.toFixed(1)+'px "'+e.textContent.trim().slice(0,22)+'"');
 });
 const imgs=[...document.querySelectorAll('img')];
 const unnamed=[...document.querySelectorAll('button')]
   .filter(b=>!b.textContent.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('title'));
 return JSON.stringify({
  h1:[...document.querySelectorAll('h1')].filter(e=>!e.closest('[hidden],[aria-hidden=true]')).length,
  main:document.querySelectorAll('main,[role=main]').length,
  nav:document.querySelectorAll('nav').length,
  lang:document.documentElement.lang,
  imgsTotal:imgs.length, imgsNoAlt:imgs.filter(i=>!i.hasAttribute('alt')).length,
  unnamedButtons:unnamed.length,
  smallText:[...new Set(small)].slice(0,4), lowContrast:[...new Set(low)].slice(0,4),
  overflow:document.documentElement.scrollWidth-innerWidth});})()"""


# ------------------------------------------------------------------ the tests

class Results:
    def __init__(self):
        self.rows = []

    def add(self, tid, area, action, expected, actual, status):
        self.rows.append({
            "Id": tid, "Functional area": area, "Test case and action": action,
            "Expected outcome": expected, "Actual outcome": actual, "Status": status,
        })
        mark = {"Pass": "PASS", "Fail": "FAIL"}.get(status, "----")
        print(f"  {mark}  {tid}  {action}")
        print(f"          {actual}")

    def ok(self, tid, area, action, expected, actual, condition):
        """Status is decided by `condition`, never asserted."""
        self.add(tid, area, action, expected, actual, "Pass" if condition else "Fail")

    def untestable(self, tid, area, action, expected, why):
        self.add(tid, area, action, expected, f"Not testable: {why}", "Not testable")


def api(base, path, timeout=180):
    started = time.time()
    with urllib.request.urlopen(base + path, timeout=timeout) as r:
        body = r.read()
    return json.loads(body), round((time.time() - started) * 1000)


def run(base):
    r = Results()
    proc, tab = launch()

    # ---- Backend ---------------------------------------------------------
    print("\nBackend")
    try:
        health, ms = api(base, "/health")
        r.ok("F-01", "Backend / health", "GET /health",
             "Service and database report healthy",
             f"{json.dumps(health)} in {ms} ms",
             health.get("status") == "ok" and health.get("database") == "ok")
    except Exception as e:
        r.untestable("F-01", "Backend / health", "GET /health",
                     "Service and database report healthy", str(e)[:90])

    try:
        svc, ms = api(base, "/services")
        subs = sum(len(s.get("sub_services", [])) for c in svc for s in c.get("services", []))
        ranked = sum(1 for c in svc for s in c.get("services", [])
                     for ss in s.get("sub_services", []) if ss.get("ranked_providers", 0) > 0)
        r.ok("F-02", "Backend / taxonomy", "GET /services",
             "Service tree returned with ranked counts",
             f"{len(svc)} categories, {subs} sub-services, {ranked} with ranked providers ({ms} ms)",
             len(svc) > 0 and subs > 0 and ranked > 0)
    except Exception as e:
        r.untestable("F-02", "Backend / taxonomy", "GET /services",
                     "Service tree returned with ranked counts", str(e)[:90])

    try:
        q = f"/rankings/{SERVICE_CODE}?weights=2,2,2,2,2,2,2&status=open&consistency_window=anytime"
        rk, ms = api(base, q)
        ranked_n = len(rk.get("ranked", []))
        cats = len(rk["ranked"][0].get("category_scores", [])) if ranked_n else 0
        r.ok("F-03", "Backend / ranking", f"GET /rankings/{SERVICE_CODE} at equal weights",
             "Ranked list with per-category scores",
             f"{ranked_n} ranked, {len(rk.get('available_but_not_ranked', []))} listed-not-ranked, "
             f"{cats} category scores each ({ms} ms)",
             ranked_n > 0 and cats > 0)
    except Exception as e:
        r.untestable("F-03", "Backend / ranking", f"GET /rankings/{SERVICE_CODE}",
                     "Ranked list with per-category scores", str(e)[:90])

    # ---- Core journey ----------------------------------------------------
    print("\nCore journey")
    goto(tab, base, "#/home")
    net, exc = problems(tab)
    nav = tab.jsonjs("JSON.stringify([...document.querySelectorAll('.nav-link')].map(e=>e.textContent.trim()))") or []
    h1 = tab.js("(document.querySelector('h1')||{}).textContent", "")
    r.ok("F-04", "Page load", "Load #/home",
         "Landing page renders with navigation",
         f'h1 "{h1}"; {len(nav)} nav items; {tab.js("document.body.innerText.length", 0)} chars; '
         f"{len(exc)} exceptions",
         bool(h1) and len(nav) >= 5 and not exc)

    goto(tab, base, "#/services")
    tab.js("""(()=>{const b=[...document.querySelectorAll('.nav-link')].find(x=>x.textContent.trim()==='Explore');
      if(!b) return; b.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
      b.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}));})()""")
    time.sleep(1.4)
    mega = tab.js("!!document.querySelector('.svcmega')", False)
    tabs_n = tab.js("document.querySelectorAll('.svcmega-tab').length", 0)
    groups = tab.js("document.querySelectorAll('.svcmega-grouphead').length", 0)
    leaves = tab.js("document.querySelectorAll('.svcmega-group li button').length", 0)
    r.ok("F-05", "Service discovery", "Hover Explore in the top navigation",
         "Services mega menu opens",
         f"panel open={mega}; {tabs_n} category tabs; {groups} groups; {leaves} services shown",
         mega and tabs_n > 0 and leaves > 0)

    tab.events.clear()
    picked = tab.js("""(()=>{const b=[...document.querySelectorAll('.svcmega-group li button')]
      .find(x=>x.textContent.includes('Haircut & Trim')); if(!b) return null; b.click(); return b.textContent.trim();})()""")
    tab.drain(18)
    crumb = (tab.js("((document.querySelector('.svc-path')||{}).innerText||'')", "") or "").replace("\n", " ")
    r.ok("F-06", "Service selection", "Click a service in the mega menu",
         "Routes to Explore and ranks that service",
         f'picked "{picked}"; url {tab.js("location.hash", "")}; breadcrumb {crumb.strip()!r}',
         bool(picked) and "sub=" in (tab.js("location.hash", "") or ""))

    goto(tab, base, SERVICE_HASH)
    names = tab.jsonjs(NAMES) or []
    scores = tab.jsonjs(SCORES) or []
    pages = tab.jsonjs("JSON.stringify([...document.querySelectorAll('.page-btn')].map(e=>e.textContent.trim()))") or []
    r.ok("F-07", "Ranking display", "Inspect the ranked list",
         "A page of salons is shown for the chosen service",
         f"{len(names)} rows rendered; pagination {pages}",
         len(names) > 0)

    nums = [int(s) for s in scores if s.isdigit()]
    descending = all(nums[i] >= nums[i + 1] for i in range(len(nums) - 1)) if len(nums) > 1 else False
    r.ok("F-08", "Ranking order", "Read the scores from top to bottom",
         "Scores descend down the page",
         " >= ".join(str(n) for n in nums) if nums else "no scores read",
         descending)

    # loading state
    goto(tab, base, "#/services")
    tab.js("""(()=>{const b=[...document.querySelectorAll('.nav-link')].find(x=>x.textContent.trim()==='Explore');
      b.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
      b.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}));})()""")
    time.sleep(1.2)
    tab.js("""(()=>{const b=[...document.querySelectorAll('.svcmega-group li button')]
      .find(x=>x.textContent.includes('Haircut & Trim')); if(b) b.click();})()""")
    frames = []
    for _ in range(14):
        time.sleep(0.25)
        frames.append(tab.jsonjs(
            "JSON.stringify({sk:document.querySelectorAll('.skeleton,.skeleton-card').length,"
            "busy:document.querySelectorAll('[aria-busy=true]').length,"
            "rows:document.querySelectorAll('" + ROWS + "').length})") or {})
    saw_skeleton = any(f.get("sk", 0) > 0 or f.get("busy", 0) > 0 for f in frames)
    settled = next((i for i, f in enumerate(frames) if f.get("rows", 0) > 0), None)
    r.ok("F-09", "Loading feedback", "Watch the list while the ranking is fetched",
         "A loading state is shown before results arrive",
         f"skeleton/aria-busy seen={saw_skeleton}; rows appeared after ~{(settled or 0) * 250} ms",
         saw_skeleton)

    # ---- Controls --------------------------------------------------------
    print("\nControls")
    goto(tab, base, SERVICE_HASH)
    before = tab.jsonjs(NAMES) or []
    opened = tab.js("""(()=>{const b=[...document.querySelectorAll('button')]
      .find(x=>/Your priorities/i.test(x.textContent)); if(!b) return false; b.click(); return true;})()""", False)
    time.sleep(1.6)
    steps = tab.js("document.querySelectorAll('.prio-step').length", 0)
    cats_n = tab.js("document.querySelectorAll('.meter-row').length", 0)
    r.ok("F-10", "Priorities", "Open the priorities panel",
         "Panel opens with a weighting control per category",
         f"opened={opened}; {cats_n} categories x {steps // max(cats_n, 1)} levels = {steps} steps",
         opened and steps > 0 and cats_n > 0)

    if steps:
        tab.events.clear()
        label = tab.js("""(()=>{const row=document.querySelectorAll('.meter-row')[1];
          const s=[...row.querySelectorAll('.prio-step')]; s[s.length-1].click();
          return row.querySelector('.meter-label').textContent.trim();})()""", "")
        tab.drain(18)
        after = tab.jsonjs(NAMES) or []
        word = tab.js("""(()=>{const row=document.querySelectorAll('.meter-row')[1];
          return row.querySelector('.meter-word').textContent.trim();})()""", "")
        r.ok("F-11", "Personalisation", f'Raise "{label}" to its highest level',
             "The ranking re-orders at once, with no submit step",
             f'set to "{word}"; order {before[:2]} -> {after[:2]}',
             bool(after) and after != before)
    else:
        r.untestable("F-11", "Personalisation", "Raise one priority to its highest level",
                     "The ranking re-orders at once", "priorities panel exposed no level controls")

    goto(tab, base, SERVICE_HASH)
    before = tab.jsonjs(NAMES) or []
    # textContent, not innerText: the pill's label is styled such that innerText
    # returns only the value ("All cities") and never the field name ("City").
    tab.js("""(()=>{const f=[...document.querySelectorAll('.qf-field')]
      .find(x=>/city/i.test(x.textContent||'')); if(f) f.querySelector('button').click();})()""")
    time.sleep(1.6)
    city = tab.js("""(()=>{const o=[...document.querySelectorAll('button,[role=option]')]
      .find(x=>/^(Nugegoda|Malabe|Piliyandala|Maharagama)$/i.test(x.textContent.trim()));
      if(!o) return null; const t=o.textContent.trim(); o.click(); return t;})()""")
    tab.drain(18)
    after = tab.jsonjs(NAMES) or []
    meta = tab.js("(document.querySelector('.slr-meta')||{}).textContent", "")
    if city:
        r.ok("F-12", "Filtering / city", f"Filter the ranking to {city}",
             "Results narrow to that city",
             f"{len(before)} -> {len(after)} rows; first row meta {meta.strip()[:60]!r}",
             after != before)
    else:
        r.untestable("F-12", "Filtering / city", "Filter the ranking by city",
                     "Results narrow to that city", "no city option matched in the open list")

    goto(tab, base, SERVICE_HASH)
    before = tab.jsonjs(NAMES) or []
    tab.js("""(()=>{const f=[...document.querySelectorAll('.qf-field')]
      .find(x=>/sort|best match/i.test(x.textContent||'')); if(f) f.querySelector('button').click();})()""")
    time.sleep(1.4)
    opts = tab.jsonjs("""JSON.stringify([...document.querySelectorAll('button,[role=option]')]
      .map(e=>e.textContent.trim()).filter(t=>/best match|highest|most reviewed|name a/i.test(t)))""") or []
    chose = tab.js("""(()=>{const o=[...document.querySelectorAll('button,[role=option]')]
      .find(x=>/Name A/i.test(x.textContent)); if(!o) return null; const t=o.textContent.trim(); o.click(); return t;})()""")
    tab.drain(16)
    after = tab.jsonjs(NAMES) or []
    alphabetical = after == sorted(after, key=str.lower) if after else False
    if chose:
        r.ok("F-13", "Sorting", f'Change the sort to "{chose}"',
             "The list re-orders alphabetically",
             f"options {opts}; first {after[:2]}; alphabetical={alphabetical}",
             after != before and alphabetical)
    else:
        r.untestable("F-13", "Sorting", "Change the sort order",
                     "The list re-orders", "no sort option matched in the open list")

    goto(tab, base, SERVICE_HASH)
    p1 = tab.jsonjs(NAMES) or []
    tab.events.clear()
    tab.js("""(()=>{const b=[...document.querySelectorAll('.page-btn')]
      .find(x=>x.textContent.trim()==='2'); if(b) b.click();})()""")
    tab.drain(16)
    p2 = tab.jsonjs(NAMES) or []
    r.ok("F-14", "Pagination", "Move to page 2 of the ranking",
         "A different set of salons loads",
         f"page 1 {p1[:2]} -> page 2 {p2[:2]}",
         bool(p2) and p1 != p2)

    goto(tab, base, SERVICE_HASH)
    h_before = tab.js(f"document.querySelector('{ROWS}').getBoundingClientRect().height", 0)
    tab.js("""(()=>{const b=document.querySelector('.slr-toggle'); if(b) b.click();})()""")
    time.sleep(1.3)
    h_after = tab.js(f"document.querySelector('{ROWS}').getBoundingClientRect().height", 0)
    r.ok("F-15", "Progressive disclosure", "Expand a row to see its score breakdown",
         "The row opens to reveal the detail",
         f"row height {round(h_before)}px -> {round(h_after)}px",
         h_after > h_before + 20)

    # ---- Salon profile ---------------------------------------------------
    print("\nSalon profile")
    goto(tab, base, SERVICE_HASH)
    tab.events.clear()
    tab.js("""(()=>{const b=document.querySelector('.slr-name'); if(b) b.click();})()""")
    tab.drain(18)
    net, exc = problems(tab)
    chars = tab.js("document.body.innerText.length", 0)
    r.ok("F-16", "Salon profile", "Open a salon from the ranked list",
         "The profile for that salon opens",
         f'url {tab.js("location.hash", "")[:70]}; {chars} chars; {len(exc)} exceptions',
         "salon=" in (tab.js("location.hash", "") or "") and chars > 800 and not exc)

    sections = tab.jsonjs("""JSON.stringify([...document.querySelectorAll('button')]
      .map(e=>e.textContent.trim())
      .filter(t=>/profile information|customer feedbacks|scores by service/i.test(t)))""") or []
    r.ok("F-17", "Salon profile", "Inspect the profile's sections",
         "The profile presents its tabbed sections",
         f"sections {sections}",
         len(sections) >= 2)

    t0 = (tab.js("document.body.innerText", "") or "")[:1200]
    switched = tab.js("""(()=>{const b=[...document.querySelectorAll('button')]
      .find(x=>/Customer Feedbacks/i.test(x.textContent)); if(!b) return false; b.click(); return true;})()""", False)
    tab.drain(14)
    t1 = (tab.js("document.body.innerText", "") or "")[:1200]
    r.ok("F-18", "Salon profile", 'Switch to the "Customer Feedbacks" tab',
         "The section's content changes",
         f"tab found={switched}; content changed={t0 != t1}",
         switched and t0 != t1)

    # ---- Features --------------------------------------------------------
    print("\nFeatures")
    goto(tab, base, SERVICE_HASH)
    fav_name = tab.js("(document.querySelector('.slr-name')||{}).textContent", "")
    tab.js("""(()=>{const b=document.querySelector('.slr-fav'); if(b) b.click();})()""")
    time.sleep(1.5)
    pressed = tab.js("document.querySelector('.slr-fav').getAttribute('aria-pressed')", "")
    goto(tab, base, "#/favorites", wait=16)
    listed = (fav_name or "\x00")[:16] in (tab.js("document.body.innerText", "") or "")
    r.ok("F-19", "Favourites", "Save a salon, then open the Favorites page",
         "The salon is saved and appears there",
         f'aria-pressed={pressed!r}; "{(fav_name or "")[:28]}" listed={listed}',
         pressed == "true" and listed)

    goto(tab, base, SERVICE_HASH)
    tab.js("""(()=>{const b=document.querySelector('.slr-fav'); if(b) b.click();})()""")
    time.sleep(1.3)
    unpressed = tab.js("document.querySelector('.slr-fav').getAttribute('aria-pressed')", "")
    r.ok("F-20", "Favourites", "Unsave the same salon (restores the starting state)",
         "The save is reversed",
         f"aria-pressed={unpressed!r}",
         unpressed == "false")

    goto(tab, base, "#/home", wait=16)
    tab.events.clear()
    searched = tab.js("""(()=>{const i=document.querySelector('input[type=search]'); if(!i) return false;
      const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
      set.call(i,'salon'); i.dispatchEvent(new Event('input',{bubbles:true}));
      const f=i.closest('form'); if(f) f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
      return true;})()""", False)
    tab.drain(16)
    r.ok("F-21", "Search", 'Search for "salon" from the header',
         "The search route runs and returns content",
         f'hash {tab.js("location.hash", "")}; {tab.js("document.body.innerText.length", 0)} chars',
         searched and "search" in (tab.js("location.hash", "") or ""))

    # ---- Navigation and routing -----------------------------------------
    print("\nNavigation and routing")
    goto(tab, base, "#/home")
    tab.js("""(()=>{const b=[...document.querySelectorAll('.nav-link')].find(x=>/Offers/i.test(x.textContent));
      if(b) b.click();})()""")
    time.sleep(3.0)
    offers = tab.jsonjs("""(()=>{const s=[...document.querySelectorAll('section,div')]
      .find(x=>/offer|promotion/i.test(x.className||''));
      if(!s) return JSON.stringify({found:false});
      const r=s.getBoundingClientRect();
      return JSON.stringify({found:true,cls:(s.className||'').slice(0,28),
        inViewport:r.top<innerHeight&&r.bottom>0,scrollY:Math.round(scrollY)});})()""") or {}
    r.ok("F-22", "Navigation", 'Click "Offers & Promotions" in the navigation',
         "The offers content is brought into view",
         f'hash {tab.js("location.hash", "")}; scrolled to {offers.get("scrollY")}px; '
         f'section {offers.get("cls")!r} in viewport={offers.get("inViewport")}',
         bool(offers.get("found")) and bool(offers.get("inViewport")))

    goto(tab, base, "#/this-route-does-not-exist", wait=14)
    r.ok("F-23", "Routing", "Request a route that does not exist",
         "The application falls back without an error screen",
         f'hash became {tab.js("location.hash", "")}; '
         f'h1 {tab.js("(document.querySelector(\'h1\')||{}).textContent", "")!r}',
         (tab.js("location.hash", "") or "") == "#/home")

    print("\nEvery page loads")
    pages = [("Home", "#/home"), ("Services", "#/ourservices"), ("Explore", "#/services"),
             ("Offers", "#/offers"), ("About", "#/about"), ("Contact", "#/contact"),
             ("Favorites", "#/favorites"), ("Sign in", "#/auth"), ("How it works", "#/how")]
    worst = []
    for label, h in pages:
        goto(tab, base, h, wait=14)
        net, exc = problems(tab)
        a = tab.jsonjs(A11Y) or {}
        chars = tab.js("document.body.innerText.length", 0)
        if chars <= 200 or exc or net:
            worst.append(f"{label}: {chars} chars, exc={exc[:1]}, net={net[:1]}")
    r.ok("F-24", "Page load", f"Load each of the {len(pages)} routes in turn",
         "Every page renders with no console or network errors",
         f"{len(pages) - len(worst)}/{len(pages)} clean" + (f"; problems: {worst}" if worst else
                                                            "; zero exceptions, zero failed requests"),
         not worst)

    # ---- Responsive ------------------------------------------------------
    print("\nResponsive")
    overflow = {}
    for label, h in [("Home", "#/home"), ("Explore", SERVICE_HASH), ("About", "#/about")]:
        goto(tab, base, h, wait=16, width=390, height=850, mobile=True)
        overflow[label] = (tab.jsonjs(A11Y) or {}).get("overflow", 1)
    r.ok("F-25", "Responsive", "Load Home, Explore and About at 390 px",
         "No horizontal scrolling on any of them",
         f"horizontal overflow {overflow} px",
         all(v <= 0 for v in overflow.values()))

    goto(tab, base, "#/home", wait=14, width=390, height=850, mobile=True)
    burger = tab.js("""(()=>{const b=[...document.querySelectorAll('button')]
      .find(x=>/menu/i.test((x.getAttribute('aria-label')||'')+x.className));
      if(!b) return false; b.click(); return true;})()""", False)
    time.sleep(1.4)
    drawer = tab.js("[...document.querySelectorAll('.nav-drawer')].filter(e=>e.getBoundingClientRect().width>0).length", 0)
    r.ok("F-26", "Responsive", "Open the mobile menu at 390 px",
         "The navigation drawer opens",
         f"burger found={burger}; visible drawers={drawer}",
         burger and drawer > 0)

    # ---- Accessibility ---------------------------------------------------
    print("\nAccessibility")
    a_home = (goto(tab, base, "#/home", wait=16), tab.jsonjs(A11Y))[1] or {}
    a_expl = (goto(tab, base, SERVICE_HASH, wait=18), tab.jsonjs(A11Y))[1] or {}
    goto(tab, base, SERVICE_HASH, wait=18)
    tab.js("""(()=>{const b=document.querySelector('.slr-name'); if(b) b.click();})()""")
    tab.drain(16)
    a_prof = tab.jsonjs(A11Y) or {}

    struct_ok = all(a.get("h1") == 1 and a.get("main", 0) >= 1 and a.get("nav", 0) >= 1
                    for a in (a_home, a_expl, a_prof))
    r.ok("F-27", "Accessibility", "Check headings and landmarks on Home, Explore and Profile",
         "One h1 per page, with main and nav landmarks, and a document language",
         f"h1 {[a.get('h1') for a in (a_home, a_expl, a_prof)]}; "
         f"main {[a.get('main') for a in (a_home, a_expl, a_prof)]}; "
         f"nav {[a.get('nav') for a in (a_home, a_expl, a_prof)]}; lang={a_home.get('lang')!r}",
         struct_ok)

    names_ok = all(a.get("imgsNoAlt", 1) == 0 and a.get("unnamedButtons", 1) == 0
                   for a in (a_home, a_expl, a_prof))
    r.ok("F-28", "Accessibility", "Check images and icon-only buttons on the same three pages",
         "Every image has alt text and every icon button has an accessible name",
         f"images without alt {[a.get('imgsNoAlt') for a in (a_home, a_expl, a_prof)]}; "
         f"unnamed buttons {[a.get('unnamedButtons') for a in (a_home, a_expl, a_prof)]}",
         names_ok)

    prof_small = a_prof.get("smallText", [])
    r.ok("F-29", "Accessibility", "Measure text size on the salon profile",
         "All visible text is at least 12 px",
         f"below 12 px: {prof_small}" if prof_small else "no text below 12 px",
         not prof_small)

    goto(tab, base, "#/home", wait=14, width=390, height=850, mobile=True)
    tab.js("""(()=>{const b=[...document.querySelectorAll('button')]
      .find(x=>/menu/i.test((x.getAttribute('aria-label')||'')+x.className)); if(b) b.click();})()""")
    time.sleep(1.5)
    a_draw = tab.jsonjs(A11Y) or {}
    draw_low, draw_small = a_draw.get("lowContrast", []), a_draw.get("smallText", [])
    r.ok("F-30", "Accessibility", "Measure contrast and size inside the open mobile menu",
         "Text meets WCAG AA 4.5:1 and is at least 12 px",
         f"below 4.5:1 {draw_low}; below 12 px {draw_small}" if (draw_low or draw_small)
         else "all drawer text passes",
         not draw_low and not draw_small)

    # ---- Performance -----------------------------------------------------
    print("\nPerformance")
    timings = {}
    for label, h in [("Home", "#/home"), ("Explore", SERVICE_HASH)]:
        goto(tab, base, h, wait=18)
        timings[label] = tab.jsonjs("""(()=>{const n=performance.getEntriesByType('navigation')[0];
          if(!n) return '{}'; const p=performance.getEntriesByType('paint');
          return JSON.stringify({ttfb:Math.round(n.responseStart),
            fcp:Math.round((p.find(x=>x.name==='first-contentful-paint')||{}).startTime||0),
            load:Math.round(n.loadEventEnd)});})()""") or {}
    r.ok("F-31", "Performance", "Measure page load with the backend warm",
         "Pages reach first contentful paint within about two seconds",
         "; ".join(f"{k}: TTFB {v.get('ttfb')} ms, FCP {v.get('fcp')} ms, load {v.get('load')} ms"
                   for k, v in timings.items()),
         all(v.get("fcp", 99999) < 2000 for v in timings.values()))

    lat = {}
    for label, path in [("/health", "/health"), ("/services", "/services"),
                        ("/rankings", f"/rankings/{SERVICE_CODE}?weights=2,2,2,2,2,2,2"
                                      "&status=open&consistency_window=anytime")]:
        samples = []
        for _ in range(3):
            try:
                _, ms = api(base, path)
                samples.append(ms)
            except Exception:
                samples.append(None)
        lat[label] = samples
    good = all(all(isinstance(x, int) and x < 5000 for x in v) for v in lat.values())
    r.ok("F-32", "Performance", "Measure API latency, three samples per endpoint",
         "Every endpoint answers within five seconds",
         "; ".join(f"{k} {v} ms" for k, v in lat.items()),
         good)

    # ---- Stability -------------------------------------------------------
    print("\nStability")
    all_exc, all_net = [], []
    for _, h in pages:
        goto(tab, base, h, wait=12)
        n, e = problems(tab)
        all_net += n
        all_exc += e
    r.ok("F-33", "Error handling", "Collect console exceptions and failed requests across every route",
         "No uncaught exceptions and no failed requests",
         f"{len(all_exc)} exceptions, {len(all_net)} failed requests"
         + (f" -> {all_exc[:2] + all_net[:2]}" if (all_exc or all_net) else " (favicon excluded)"),
         not all_exc and not all_net)

    if proc:
        proc.terminate()
    return r


def main():
    ap = argparse.ArgumentParser(description="Functional evaluation of the Amore Beauty app.")
    ap.add_argument("--base", default=DEFAULT_BASE, help="host to evaluate")
    args = ap.parse_args()
    base = args.base.rstrip("/")

    print(f"Functional evaluation of {base}")
    print(f"Run at {time.strftime('%Y-%m-%d %H:%M')}\n")

    r = run(base)

    cols = ["Id", "Functional area", "Test case and action",
            "Expected outcome", "Actual outcome", "Status"]
    out = os.path.join(HERE, "functionality_results.csv")
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(r.rows)

    print("\n\n| " + " | ".join(cols) + " |")
    print("|" + "---|" * len(cols))
    for row in r.rows:
        print("| " + " | ".join(str(row[c]).replace("|", "\\|") for c in cols) + " |")

    counts = {}
    for row in r.rows:
        counts[row["Status"]] = counts.get(row["Status"], 0) + 1
    print(f"\n{counts.get('Pass', 0)} of {len(r.rows)} passed "
          f"({counts.get('Fail', 0)} failed, {counts.get('Not testable', 0)} not testable)")
    print(f"Written to {out}")

    # A failing functional test should break a CI run; "not testable" should not
    # be silently green either, so it is reported but does not fail the process.
    return 1 if counts.get("Fail") else 0


if __name__ == "__main__":
    sys.exit(main())
