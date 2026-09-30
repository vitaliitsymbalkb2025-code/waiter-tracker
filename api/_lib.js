const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const configured = () => Boolean(URL_ && TOKEN);

async function cmd(args) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || 'redis error');
  return j.result;
}

const scrypt = (pw, salt) =>
  new Promise((ok, no) => crypto.scrypt(String(pw), salt, 64, (e, k) => (e ? no(e) : ok(k))));

async function makeHash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: (await scrypt(pw, salt)).toString('hex') };
}

async function checkHash(pw, rec) {
  const salt = rec ? rec.salt : 'x'.repeat(32); // dummy work for unknown users
  const got = await scrypt(pw, salt);
  if (!rec) return false;
  const want = Buffer.from(rec.hash, 'hex');
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

const normLogin = (l) => (typeof l === 'string' ? l.trim().toLowerCase().slice(0, 64) : '');

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

async function userFromRequest(req) {
  const t = bearer(req);
  if (!t) return null;
  const name = await cmd(['GET', 'waiter:sess:' + t]);
  return name || null;
}

module.exports = { cmd, configured, makeHash, checkHash, normLogin, bearer, userFromRequest, crypto };
