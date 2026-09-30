const L = require('./_lib');

const DAY = 60 * 60 * 24;

async function session(name) {
  const token = L.crypto.randomBytes(32).toString('hex');
  await L.cmd(['SET', 'waiter:sess:' + token, name, 'EX', String(90 * DAY)]);
  return token;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!L.configured()) return res.status(500).json({ error: 'not_configured' });
  const { action, login, password } = req.body || {};
  try {
    if (action === 'logout') {
      const t = L.bearer(req);
      if (t) await L.cmd(['DEL', 'waiter:sess:' + t]);
      return res.status(200).json({ ok: true });
    }
    const name = L.normLogin(login);
    if (!name || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'bad_request' });
    }
    if (action === 'register') {
      const rec = await L.makeHash(password);
      const created = await L.cmd([
        'SET', 'waiter:user:' + name, JSON.stringify({ ...rec, created: Date.now() }), 'NX',
      ]);
      if (!created) return res.status(409).json({ error: 'exists' });
      return res.status(200).json({ token: await session(name), login: name });
    }
    if (action === 'login') {
      const rl = 'waiter:rl:' + name;
      const tries = Number(await L.cmd(['GET', rl])) || 0;
      if (tries >= 10) return res.status(429).json({ error: 'too_many' });
      const raw = await L.cmd(['GET', 'waiter:user:' + name]);
      const ok = await L.checkHash(password, raw ? JSON.parse(raw) : null);
      if (!ok) {
        const n = await L.cmd(['INCR', rl]);
        if (n === 1) await L.cmd(['EXPIRE', rl, '900']);
        return res.status(401).json({ error: 'invalid' });
      }
      await L.cmd(['DEL', rl]);
      return res.status(200).json({ token: await session(name), login: name });
    }
    return res.status(400).json({ error: 'bad_request' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
