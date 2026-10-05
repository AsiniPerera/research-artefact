# -*- coding: utf-8 -*-
"""A fifth poster landed in offers/ mid-change: "1st offer.jpg".

Its name maps to one promo and one only, so the feature card takes it and
"offer unisex.jpg" moves to Men's grooming, whose male model it actually
carries. That puts all five offers files on screen.

Both crops are tighter than the others because both posters are busier.
"1st offer.jpg" in particular prints a real salon's phone number and street
address across its lower third, and a monogram top-right; the crop holds the
couple in the middle band so none of that is ever in frame.

Idempotent. Re-run after a revert:   python promos-images2.py
"""
import io
import os

JSX = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   'src', 'screens', 'Landing.jsx')
s = io.open(JSX, encoding='utf-8').read()
if '1stoffer' in s:
    print('already applied')
    raise SystemExit


def sub(old, new, cnt=1):
    global s
    n = s.count(old)
    assert n == cnt, 'expected %d got %d: %r' % (cnt, n, old[:70])
    s = s.replace(old, new)


# the feature takes the poster named for it
sub('''    family: null,
    image: "offerunisex",
    feature: true,''',
    '''    family: null,
    image: "1stoffer",
    feature: true,''')

# and the unisex poster goes where its male model belongs
sub('''    family: "barber_grooming",
    image: "grooming",''',
    '''    family: "barber_grooming",
    image: "offerunisex",''')

sub('''const POSTER_CROP = {
  /* Two models, right of centre; the studio logo runs across the foot. */
  offerunisex: { backgroundSize: "220%", backgroundPosition: "82% 25%" },''',
    '''const POSTER_CROP = {
  /* The busiest of them: headline across the top third, a monogram top-right,
     and a real salon's phone number and street address banded across the
     bottom. The crop sits on the couple in the middle so none of it shows.
     Quoted because the key starts with a digit. */
  "1stoffer": { backgroundSize: "300%", backgroundPosition: "45% 58%" },
  /* Cropped hard to the male model on the right — the female model, the
     headline and the studio logo are all outside this frame. */
  offerunisex: { backgroundSize: "350%", backgroundPosition: "92% 16%" },''')

assert s.count('"1stoffer"') == 2, 'expected the key in data and in the crop map'
assert 'image: "grooming"' not in s
io.open(JSX, 'w', encoding='utf-8').write(s)
print('applied')
