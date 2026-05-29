// Client-side AES-GCM encryption + Pinata IPFS upload.
//
// Flow: generate a fresh 256-bit AES-GCM key per file, encrypt the bytes with a
// random 12-byte IV, then upload [IV || ciphertext] to Pinata. The encryption
// key never leaves the browser — it is returned to the caller (as base64) so it
// can be shown to / stored by the user for later decryption.

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PINATA_GATEWAY =
  (import.meta.env.VITE_PINATA_GATEWAY as string | undefined) || "gateway.pinata.cloud";

const PINATA_PIN_FILE_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

const ENVELOPE_MAGIC = "MCE1";

export type EncryptedUpload = {
  cid: string;
  /** base64 AES-GCM key — needed to decrypt the file later. Keep it safe. */
  keyB64: string;
  size: number;
  gatewayUrl: string;
};

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function b64ToBuf(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt a file with AES-GCM and upload the encrypted blob to Pinata. */
export async function encryptAndUpload(file: File): Promise<EncryptedUpload> {
  if (!PINATA_JWT) {
    throw new Error(
      "Pinata JWT is not configured. Add VITE_PINATA_JWT to frontend/.env and restart the dev server."
    );
  }

  // 1. Generate a fresh AES-GCM key + IV.
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Wrap the file in an envelope that also carries its original name + type,
  //    so the patient's download keeps the real filename. Layout:
  //      ["MCE1"(4) | metaLen u32 BE(4) | metaJSON(utf8) | fileBytes]
  //    The whole envelope is encrypted, so the filename stays confidential too.
  const meta = JSON.stringify({ name: file.name, type: file.type || "" });
  const metaBytes = new TextEncoder().encode(meta);
  const fileBytes = new Uint8Array(await file.arrayBuffer());
  const envelope = new Uint8Array(8 + metaBytes.length + fileBytes.length);
  envelope.set(new TextEncoder().encode(ENVELOPE_MAGIC), 0);
  new DataView(envelope.buffer).setUint32(4, metaBytes.length, false);
  envelope.set(metaBytes, 8);
  envelope.set(fileBytes, 8 + metaBytes.length);

  // 2b. Encrypt the envelope.
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, envelope);

  // 3. Package as [IV (12 bytes) || ciphertext].
  const packaged = new Uint8Array(iv.length + ciphertext.byteLength);
  packaged.set(iv, 0);
  packaged.set(new Uint8Array(ciphertext), iv.length);
  const encryptedBlob = new Blob([packaged], { type: "application/octet-stream" });

  // 4. Upload to Pinata.
  const form = new FormData();
  form.append("file", encryptedBlob, `${file.name}.enc`);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: `${file.name}.enc`, keyvalues: { app: "medchain", encrypted: "aes-gcm" } })
  );

  const res = await fetch(PINATA_PIN_FILE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Pinata upload failed (${res.status}): ${detail || res.statusText}`);
  }

  const json = (await res.json()) as { IpfsHash: string; PinSize?: number };
  const cid = json.IpfsHash;

  // 5. Export the key so the user can decrypt later.
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    cid,
    keyB64: bufToB64(rawKey),
    size: json.PinSize ?? packaged.byteLength,
    gatewayUrl: `https://${PINATA_GATEWAY}/ipfs/${cid}`,
  };
}

export type DecryptedFile = {
  data: Uint8Array;
  /** Original filename if it was preserved at upload time. */
  name?: string;
  /** MIME type (preserved at upload, or sniffed from magic bytes). */
  type: string;
  /** Best-guess extension for naming the download (no leading dot). */
  ext: string;
};

/** Sniff a few common file types from their leading magic bytes. */
function sniff(b: Uint8Array): { type: string; ext: string } {
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return { type: "application/pdf", ext: "pdf" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return { type: "application/zip", ext: "zip" };
  return { type: "application/octet-stream", ext: "bin" };
}

const extFromName = (name: string) => (name.includes(".") ? name.split(".").pop()! : "");

/** Fetch + decrypt a previously uploaded record, recovering its original name/type. */
export async function downloadAndDecrypt(cid: string, keyB64: string): Promise<DecryptedFile> {
  const url = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gateway fetch failed (${res.status})`);
  const packaged = await res.arrayBuffer();
  const iv = packaged.slice(0, 12);
  const ciphertext = packaged.slice(12);
  const key = await crypto.subtle.importKey("raw", b64ToBuf(keyB64), { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));

  // New-format envelope: recover the original name + type.
  if (plain.length >= 8 && new TextDecoder().decode(plain.slice(0, 4)) === ENVELOPE_MAGIC) {
    const metaLen = new DataView(plain.buffer, plain.byteOffset + 4, 4).getUint32(0, false);
    try {
      const meta = JSON.parse(new TextDecoder().decode(plain.slice(8, 8 + metaLen))) as { name?: string; type?: string };
      const data = plain.slice(8 + metaLen);
      const sniffed = sniff(data);
      return { data, name: meta.name, type: meta.type || sniffed.type, ext: extFromName(meta.name ?? "") || sniffed.ext };
    } catch {
      /* fall through to legacy handling */
    }
  }

  // Legacy format: raw file bytes — sniff the type so the download is named sensibly.
  const sniffed = sniff(plain);
  return { data: plain, type: sniffed.type, ext: sniffed.ext };
}
