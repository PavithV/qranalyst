import * as qrcode from "qrcode";

export async function generateQrDataUrl(text: string, size = 256) {
  if (!text) throw new Error("generateQrDataUrl: text fehlt.");

  return qrcode.toDataURL(text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

