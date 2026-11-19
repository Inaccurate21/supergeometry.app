"""supergeometry.app logo: a faceted red cape blowing in the wind, a yellow clasp, and a yellow
hexagon with a blue G printed on the cloth (it folds and shades with the facets).

Run: python scripts/logo.py   (writes public/icon.svg; then node scripts/icons.mjs for the PNGs)"""
import math
import sys

TILE = "#1f2125"
RED = ("#7e1f1a", "#d8392f", "#ff7466")
YEL = ("#9a6a08", "#ffc23d", "#ffe9a3")
BLU = ("#123574", "#2a63c4", "#6ea4ff")
CLASP = "#ffd34d"


def stroke(pl, t):
    """A thick polyline (miter joins, butt ends) as one polygon."""
    h = t / 2
    def nrm(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        return (-dy / L, dx / L)
    left, right = [], []
    n = len(pl)
    for i in range(n):
        if i == 0: m = nrm(pl[0], pl[1]); k = 1
        elif i == n - 1: m = nrm(pl[-2], pl[-1]); k = 1
        else:
            a, b = nrm(pl[i - 1], pl[i]), nrm(pl[i], pl[i + 1])
            m = (a[0] + b[0], a[1] + b[1]); L = math.hypot(*m); m = (m[0] / L, m[1] / L)
            k = 1 / (m[0] * a[0] + m[1] * a[1])
        left.append((pl[i][0] + m[0] * h * k, pl[i][1] + m[1] * h * k))
        right.append((pl[i][0] - m[0] * h * k, pl[i][1] - m[1] * h * k))
    return left + right[::-1]


def hexpts(cx, cy, r, angles):
    return [(cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))) for a in angles]


def lerp(a, b, t): return a + (b - a) * t


def mix(c1, c2, t):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(lerp(x, y, t)):02x}" for x, y in zip(a, b))


def tone(pal, s):
    return mix(pal[0], pal[1], s / 0.55) if s < 0.55 else mix(pal[1], pal[2], (s - 0.55) / 0.45)


def width(v): return lerp(0.3, 1.0, v ** 0.8)


def surf(u, v, wind=1.0, folds=1.0):
    x = (u - 0.5) * 2 * width(v) + wind * 0.3 * v * v - 0.12 * v * (1 - u)
    y = v * 1.6 - wind * 0.32 * v * v * u + 0.1 * v ** 3 * math.cos(u * math.pi * 3 + 1.8)
    z = folds * (v ** 0.7) * math.sin(u * math.pi * 3 + v * 1.8) * 0.3
    return (x, y, z)


def flat_to_uv(p):
    """A point on the cloth laid flat (X across from the middle, Y down) to its (u, v)."""
    X, Y = p
    v = Y / 1.6
    return (0.5 + X / (2 * width(v)), v)


def densify(P, step=0.02):
    out = []
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        n = max(1, int(math.dist(a, b) / step))
        out += [(lerp(a[0], b[0], k / n), lerp(a[1], b[1], k / n)) for k in range(n)]
    return out


def clip(subject, tri):
    """Sutherland-Hodgman: the part of a polygon inside a triangle (counter-clockwise or not)."""
    area = (tri[1][0] - tri[0][0]) * (tri[2][1] - tri[0][1]) - (tri[1][1] - tri[0][1]) * (tri[2][0] - tri[0][0])
    sgn = 1 if area > 0 else -1
    out = subject
    for i in range(3):
        a, b = tri[i], tri[(i + 1) % 3]
        inside = lambda p: sgn * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0
        src, out = out, []
        if not src: break
        for j in range(len(src)):
            p, q = src[j], src[(j + 1) % len(src)]
            if inside(q):
                if not inside(p): out.append(cross(p, q, a, b))
                out.append(q)
            elif inside(p):
                out.append(cross(p, q, a, b))
    return out


def cross(p, q, a, b):
    d1 = (q[0] - p[0], q[1] - p[1]); d2 = (b[0] - a[0], b[1] - a[1])
    den = d1[0] * d2[1] - d1[1] * d2[0]
    t = ((a[0] - p[0]) * d2[1] - (a[1] - p[1]) * d2[0]) / den
    return (p[0] + t * d1[0], p[1] + t * d1[1])


def logo(nu=10, nv=6, badge_y=0.9, badge_r=0.6):
    # the print, laid flat, then into (u, v)
    hexa = [flat_to_uv(p) for p in densify(hexpts(0, badge_y, badge_r, [-90, -30, 30, 90, 150, 210]))]
    g = [flat_to_uv(p) for p in densify(gmark_flat(0, badge_y, badge_r * 0.77, badge_r * 0.3))]
    L = (-0.5, -0.6, 0.62); n = math.sqrt(sum(c * c for c in L)); L = tuple(c / n for c in L)
    UV = [[(i / nu, j / nv) for i in range(nu + 1)] for j in range(nv + 1)]
    tris = []
    for j in range(nv):
        for i in range(nu):
            a, b, c, d = UV[j][i], UV[j][i + 1], UV[j + 1][i + 1], UV[j + 1][i]
            for t in ((a, b, c), (a, c, d)) if (i + j) % 2 == 0 else ((a, b, d), (b, c, d)):
                P = [surf(*q) for q in t]
                e1 = [P[1][k] - P[0][k] for k in range(3)]; e2 = [P[2][k] - P[0][k] for k in range(3)]
                nn = (e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0])
                m = math.sqrt(sum(q * q for q in nn)) or 1
                nn = tuple(q / m for q in nn)
                if nn[2] < 0: nn = tuple(-q for q in nn)
                s = max(0.0, sum(nn[k] * L[k] for k in range(3)))
                s = min(1, max(0, (s - 0.25) / 0.7))
                tris.append((sum(q[2] for q in P) / 3, s, t, P))
    tris.sort(key=lambda q: q[0])
    proj = lambda p: (p[0], p[1] - 0.35 * p[2])
    pts = [proj(p) for *_, P in tris for p in P]
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    k = min(56 / (x1 - x0), 49 / (y1 - y0))
    ox = 32 - (x0 + x1) / 2 * k
    tx = lambda p: (ox + p[0] * k, 12.3 + (p[1] - y0) * k)
    out = []
    for _, s, t, P in tris:
        S = [tx(proj(p)) for p in P]
        # the facet's own affine map from (u, v) to the picture
        (u0, v0), (u1, v1), (u2, v2) = t
        det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0)
        def amap(q, S=S, u0=u0, v0=v0, u1=u1, v1=v1, u2=u2, v2=v2, det=det):
            a = ((q[0] - u0) * (v2 - v0) - (u2 - u0) * (q[1] - v0)) / det
            b = ((u1 - u0) * (q[1] - v0) - (q[0] - u0) * (v1 - v0)) / det
            return (S[0][0] + a * (S[1][0] - S[0][0]) + b * (S[2][0] - S[0][0]),
                    S[0][1] + a * (S[1][1] - S[0][1]) + b * (S[2][1] - S[0][1]))
        out.append((tone(RED, s), S))
        for pal, poly in ((YEL, hexa), (BLU, g)):
            c = clip(poly, list(t))
            if len(c) >= 3:
                out.append((tone(pal, s), [amap(q) for q in c]))
    top = [tx(proj(surf(0, 0))), tx(proj(surf(1, 0)))]
    out.append((CLASP, [(top[0][0] - 1, 9), (top[1][0] + 1, 9), (top[1][0] + 0.5, 12.5), (top[0][0] - 0.5, 12.5)]))
    return out


def gmark_flat(cx, cy, r, t):
    rr = r - t / 2
    P = hexpts(cx, cy, rr, [-30, -90, -150, 150, 90, 30])
    P.append((cx + rr * math.cos(math.radians(30)), cy))
    P.append((cx + rr * 0.05, cy))
    return stroke(P, t)


def svg(shapes, tile=True):
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">']
    if tile: parts.append(f'<rect width="64" height="64" rx="14" fill="{TILE}"/>')
    # each facet is also stroked in its own colour, so no hairline seams show between them
    parts.append('<g stroke-width=".2" stroke-linejoin="round">')
    num = lambda a: f"{a:.1f}".rstrip("0").rstrip(".")
    for c, P in shapes:
        parts.append(f'<path d="M{"L".join(num(x) + " " + num(y) for x, y in P)}Z" fill="{c}" stroke="{c}"/>')
    return "\n".join(parts) + "\n</g>\n</svg>\n"


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "public/icon.svg"
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(svg(logo()))
    print("wrote", out)
