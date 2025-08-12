// src/offline.ts
import { KeyPair } from '@near-js/crypto';
import { encode as b58encode, decode as b58decode } from 'bs58';

type Network = 'mainnet' | 'testnet';

export type OfflineEnvelopeV1 = {
  offline_signature: {
    v: 1;                    // version
    algo: 'ed25519';
    context: 'fastnear.offline';
    network: Network;
    public_key: string;      // e.g. "ed25519:..."
    nonce: string;           // base58, 16 random bytes
    iat: number;             // issued at (unix seconds)
    exp: number;             // expires (default +300s)
    aud?: string;            // intended audience/service
    origin?: string;         // window.location.origin
    payload: unknown;        // free-form (e.g., guestbook msg, tx sketch, etc.)
  }
};

// Tiny canonicalizer (sorted keys, no extra whitespace)
const enc = new TextEncoder();

function sortDeep(x: any): any {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x && typeof x === 'object') {
    return Object.fromEntries(
      Object.keys(x).sort().map(k => [k, sortDeep(x[k])])
    );
  }
  return x;
}

export function canonicalBytes(obj: unknown): Uint8Array {
  return enc.encode(JSON.stringify(sortDeep(obj)));
}

// Sign & verify (browser)
export function signOffline(
  keyPair: KeyPair,
  payload: unknown,
  opts: { network: Network; ttlSeconds?: number; aud?: string }
) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 300;
  const nonce = crypto.getRandomValues(new Uint8Array(16));

  const envelope: OfflineEnvelopeV1 = {
    offline_signature: {
      v: 1,
      algo: 'ed25519',
      context: 'fastnear.offline',
      network: opts.network,
      public_key: keyPair.getPublicKey().toString(),
      nonce: b58encode(nonce),
      iat: now,
      exp: now + ttl,
      origin: globalThis.location?.origin,
      aud: opts.aud,
      payload
    }
  };

  const { signature } = keyPair.sign(canonicalBytes(envelope));
  return { envelope, signature_b58: b58encode(signature) };
}