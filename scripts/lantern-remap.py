#!/usr/bin/env python3
"""Remap the old studio palette (cool blues/greys) to Lantern Light tokens.
Usage: python3 scripts/lantern-remap.py FILE.css [...]  (edits in place, prints a summary)
Neutral and blue tints -> warm cream/paper/line scale; saturated blues -> violet ink;
green/amber/red/purple tints keep their meaning in the new palette."""
import colorsys, re, sys
HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
def classify(h):
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hue, l, s = colorsys.rgb_to_hls(r, g, b); hue *= 360
    if l >= 0.995: return None                       # pure white stays
    chrome = s < 0.18 or 185 <= hue <= 250
    if chrome:
        if s > 0.45 and 0.25 <= l <= 0.62: return '#5B4BC4'   # brand blues -> violet ink (links, accents)
        for limit, out in ((0.955, '#FBF6EC'), (0.92, '#F3EBDB'), (0.85, '#E2D8C4'), (0.72, '#CFC3AA'),
                           (0.55, '#B3A68A'), (0.35, '#4A5275')):
            if l >= limit: return out
        return '#141B34'
    light = l >= 0.82
    if 75 <= hue < 185: return '#E3F3EF' if light else ('#2BB8A6' if l > 0.5 else '#0E7468')
    if 38 <= hue < 75: return '#FFF1D6' if light else ('#FFB547' if l > 0.5 else '#8A5300')
    if 250 < hue < 320: return '#EEEAFE' if light else '#5B4BC4'
    return '#FFE9E1' if light else ('#FF7A59' if l > 0.55 else '#B5402A')
for path in sys.argv[1:]:
    src = open(path).read(); changed = {}
    def sub(m):
        out = classify(m.group(1))
        if out is None: return m.group(0)
        changed[m.group(0).lower()] = out; return out
    dst = HEX.sub(sub, src)
    if dst != src: open(path, 'w').write(dst)
    print(f'{path}: {len(changed)} colours remapped')
