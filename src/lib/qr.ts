import QRCode from "qrcode";

/**
 * A QR code for any address, as an SVG: the Bad Decisions code the flyer and
 * the table tent point at, and the host's own links on the screens.
 *
 * Generated on request rather than checked in as an image, because the
 * address it encodes is the site's own URL plus /bad-decisions — if that
 * ever changes, a checked-in image would quietly point at the wrong thing.
 * SVG, not PNG: it prints crisp at flyer size from a vector with no library
 * beyond the one already doing the encoding.
 */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** The Bad Decisions code: the same SVG, under the name the flyer and the routes have always used. */
export const decisionsQrSvg = qrSvg;
