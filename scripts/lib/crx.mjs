import { createHash, createPrivateKey, createPublicKey, createSign, createVerify, generateKeyPairSync } from 'node:crypto';

/**
 * Minimal CRX3 writer: wraps the packed zip in a signed Chrome extension
 * header so Chrome can install a single file. The signing key is self-issued
 * (no Web Store proof), which Chrome accepts with Developer mode enabled.
 */

function varint(value) {
  const bytes = [];
  let remaining = value;
  do {
    let byte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining > 0) byte |= 0x80;
    bytes.push(byte);
  } while (remaining > 0);
  return Buffer.from(bytes);
}

function bytesField(fieldNumber, data) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([varint((fieldNumber << 3) | 2), varint(buffer.length), buffer]);
}

function u32le(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0, 0);
  return buffer;
}

export function readPrivateKey(pem) {
  return String(pem).replace(/\\n/g, '\n');
}

export function generatePrivateKeyPem() {
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  }).privateKey;
}

export function extensionIdFromKey(publicKeyDer) {
  const digest = createHash('sha256').update(publicKeyDer).digest().subarray(0, 16);
  return [...digest].map((byte) => 'abcdefghijklmnop'[byte >> 4] + 'abcdefghijklmnop'[byte & 0x0f]).join('');
}

export function createCrx(zip, privateKeyPem) {
  const zipBuffer = Buffer.isBuffer(zip) ? zip : Buffer.from(zip);
  const privateKey = createPrivateKey(readPrivateKey(privateKeyPem));
  const publicKey = createPublicKey(privateKey);
  const exported = publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyDer = Buffer.isBuffer(exported) ? exported : Buffer.from(exported);
  const crxId = createHash('sha256').update(publicKeyDer).digest().subarray(0, 16);
  const signedHeaderData = bytesField(1, crxId);
  const signedPrefix = Buffer.concat([Buffer.from('CRX3 SignedData\x00', 'utf8'), u32le(signedHeaderData.length), signedHeaderData]);

  const signature = createSign('sha256').update(signedPrefix).update(zipBuffer).sign(privateKey);
  const verifies = createVerify('sha256').update(signedPrefix).update(zipBuffer).verify(publicKey, signature);
  if (!verifies) throw new Error('CRX signature self-check failed');

  const proof = Buffer.concat([bytesField(1, publicKeyDer), bytesField(2, signature)]);
  const header = Buffer.concat([bytesField(2, proof), bytesField(10000, signedHeaderData)]);
  const crx = Buffer.concat([Buffer.from('Cr24'), u32le(3), u32le(header.length), header, zipBuffer]);
  return { crx, extensionId: extensionIdFromKey(publicKeyDer) };
}
