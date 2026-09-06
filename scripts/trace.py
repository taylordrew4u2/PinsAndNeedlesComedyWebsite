#!/usr/bin/env python3
"""
Trace a raster (photo, printed flyer, or line art) to a flat-colour SVG.

This is the tool that produced every SVG in public/posts. It exists in the
repository because the next upload will need it too, and it is the kind of
thing that takes an afternoon to rediscover from prose alone.

Two recipes, chosen per image
-----------------------------
A single tracing recipe does not serve both kinds of source this site has.

Line art (black ink on a near-solid ground: an illustration, a flash sheet, a
black-and-white typeset flyer) wants none of the denoising a photo needs. A
median filter erodes the thin strokes it was meant to protect, and a big
palette invents shading where there is none. It wants a plain two-colour
threshold at high resolution, and nothing else.

A photograph or a flat-colour flyer is the opposite. Traced without
denoising, paper grain and JPEG noise become thousands of tiny disconnected
paths, and two near-identical shades of the same paper colour split into
separate layers whose jagged pixel-level boundary traces as pure static.
One flyer on the home page did exactly that: a clean cream-and-red poster
became 1.3MB of noise. Those need a median filter first and a small palette.

Which recipe runs is decided by sampling the source at low resolution: if
fewer than 5% of pixels carry any real saturation, it is ink on paper.

Quantization is FASTOCTREE, not MEDIANCUT. MEDIANCUT spends most of a small
palette on near-identical shades of the background and merges a small
saturated feature (the red on a flyer) into pink. FASTOCTREE keeps it.
This was verified against the actual clusters each method picked.

Requirements
------------
    pip install potracer numpy Pillow

`potracer` is the pure-Python potrace port; it installs the `potrace`
module used below. Note the polarity: potracer treats *falsy* cells of the
bitmap as the shape, so each colour layer is traced from the inverted mask.

Usage
-----
    python scripts/trace.py IMAGE [IMAGE ...] --out public/posts

Each input is written as `<out>/<basename>.svg`. Pass `--force` to
overwrite an SVG that already exists. One line per image reports which
recipe ran, the mean colour error of the quantized image against the
source, and the output size.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
import potrace
from PIL import Image, ImageFilter

# Fraction of pixels that may carry real colour before an image stops
# counting as ink on paper.
LINE_ART_MAX_SATURATED = 0.05
# Per-pixel saturation above which a pixel counts as coloured at all.
SATURATION_FLOOR = 0.18
# Side length the classifier samples at. Small on purpose: it is looking for
# whether colour exists anywhere with any area, not where.
CLASSIFY_SAMPLE = 250
# Longest side of the SVG viewBox written out.
OUT_DIM = 1200


def is_line_art(im: Image.Image) -> bool:
    """True when almost no pixel carries real colour.

    A line illustration or black-and-white typeset flyer is black, white,
    and the greys anti-aliasing makes between them. The moment a real hue
    shows up anywhere with any area (the red on a flyer, skin tones in a
    photo), it needs the palette and denoising the other path skips.
    """
    small = im.copy()
    small.thumbnail((CLASSIFY_SAMPLE, CLASSIFY_SAMPLE), Image.LANCZOS)
    a = np.asarray(small, dtype=np.float32) / 255.0
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    return float((sat > SATURATION_FLOOR).mean()) < LINE_ART_MAX_SATURATED


def curves_to_d(path, scale: float) -> str:
    """potrace's curve list as one SVG path `d` attribute, scaled."""
    out = []
    for curve in path:
        sx, sy = curve.start_point.x * scale, curve.start_point.y * scale
        out.append(f"M{sx:.1f} {sy:.1f}")
        for seg in curve:
            if seg.is_corner:
                c, e = seg.c, seg.end_point
                out.append(f"L{c.x*scale:.1f} {c.y*scale:.1f}L{e.x*scale:.1f} {e.y*scale:.1f}")
            else:
                a, b, e = seg.c1, seg.c2, seg.end_point
                out.append(
                    f"C{a.x*scale:.1f} {a.y*scale:.1f} {b.x*scale:.1f} {b.y*scale:.1f} "
                    f"{e.x*scale:.1f} {e.y*scale:.1f}"
                )
        out.append("Z")
    return "".join(out)


def build_svg(work: Image.Image, idx: np.ndarray, palette: list[int], colors: int, turd: int, scale: float) -> str:
    """One filled path per palette colour, over a rect of the most common one."""
    counts = np.bincount(idx.ravel(), minlength=colors)
    order = list(np.argsort(-counts))
    w, h = work.size
    vw, vh = round(w * scale), round(h * scale)

    def hexes(i: int) -> str:
        return "#%02x%02x%02x" % tuple(palette[i * 3 : i * 3 + 3])

    bg = order[0]
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {vw} {vh}" '
        f'width="{vw}" height="{vh}" shape-rendering="geometricPrecision">',
        f'<rect width="{vw}" height="{vh}" fill="{hexes(bg)}"/>',
    ]
    for i in order[1:]:
        if counts[i] == 0:
            continue
        mask = idx == i
        # potracer treats falsy cells as the shape, hence the inversion.
        bmp = potrace.Bitmap(~mask)
        d = curves_to_d(
            bmp.trace(turdsize=turd, alphamax=1.0, opticurve=True, opttolerance=0.4), scale
        )
        if d:
            parts.append(f'<path fill="{hexes(i)}" d="{d}"/>')
    parts.append("</svg>")
    return "".join(parts)


def trace(src: str, dst: str, out_dim: int = OUT_DIM) -> dict:
    """Trace one file. Returns what ran and how it went."""
    im = Image.open(src).convert("RGB")
    fw, fh = im.size
    line_art = is_line_art(im)

    if line_art:
        # Two colours, no denoising, high resolution: the strokes are the point.
        colors, median, turd, trace_dim = 2, 0, 2, 1400
    else:
        # Small palette after a median filter: the noise is real.
        colors, median, turd, trace_dim = 8, 5, 10, 760

    r = trace_dim / max(fw, fh)
    work = im.resize((max(1, round(fw * r)), max(1, round(fh * r))), Image.LANCZOS) if r < 1 else im
    if median >= 3:
        k = median if median % 2 else median + 1
        work_q = work.filter(ImageFilter.MedianFilter(size=k))
    else:
        work_q = work
    pal = work_q.quantize(colors=colors, method=Image.FASTOCTREE, dither=Image.NONE)
    idx = np.asarray(pal)
    scale = out_dim / max(work.size)
    svg = build_svg(work, idx, pal.getpalette(), colors, turd, scale)
    with open(dst, "w") as f:
        f.write(svg)

    err = float(
        np.abs(np.asarray(work, dtype=np.int16) - np.asarray(pal.convert("RGB"), dtype=np.int16)).mean()
    )
    return {"line_art": line_art, "colors": colors, "err": err, "bytes": len(svg)}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Trace rasters to flat-colour SVGs.")
    parser.add_argument("images", nargs="+", help="source rasters (webp, png, jpg, ...)")
    parser.add_argument("--out", required=True, help="directory the SVGs are written into")
    parser.add_argument("--force", action="store_true", help="overwrite an SVG that already exists")
    args = parser.parse_args(argv)

    os.makedirs(args.out, exist_ok=True)
    failed = 0
    for src in args.images:
        name = os.path.splitext(os.path.basename(src))[0]
        dst = os.path.join(args.out, f"{name}.svg")
        if os.path.exists(dst) and not args.force:
            print(f"skip      {name}.svg exists (use --force)")
            continue
        t0 = time.time()
        try:
            info = trace(src, dst)
        except Exception as error:  # one bad file must not stop the batch
            failed += 1
            print(f"FAILED    {name}: {error}", file=sys.stderr)
            continue
        print(
            f"{'LINE-ART' if info['line_art'] else 'general ':9} "
            f"colours={info['colors']} err={info['err']:5.2f} "
            f"{info['bytes']/1024:6.0f}KB {time.time()-t0:5.1f}s  {name}.svg"
        )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
