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

  // 2. Encrypt the file bytes.
  const plaintext = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);

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

/** Fetch + decrypt a previously uploaded record. (Helper for completeness.) */
export async function downloadAndDecrypt(cid: string, keyB64: string): Promise<ArrayBuffer> {
  const url = `https://${PINATA_GATEWAY}/ipfs/${cid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gateway fetch failed (${res.status})`);
  const packaged = await res.arrayBuffer(); // ArrayBuffer
  const iv = packaged.slice(0, 12);
  const ciphertext = packaged.slice(12);
  const key = await crypto.subtle.importKey("raw", b64ToBuf(keyB64), { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
