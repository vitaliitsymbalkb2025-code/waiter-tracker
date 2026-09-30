const L = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!L.configured()) return res.status(500).json({ error: 'not_configured' });
  try {
    const name = await L.userFromRequest(req);
    if (!name) return res.status(401).json({ error: 'unauthorized' });
    const key = 'waiter:data:' + name;
    if (req.method === 'GET') {
      const v = await L.cmd(['GET', key]);
      return res.status(200).json({ data: v ? JSON.parse(v) : null });
    }
    if (req.method === 'PUT') {
      const d = req.body && req.body.data;
      if (!d || typeof d !== 'object') return res.status(400).json({ error: 'bad_request' });
      await L.cmd(['SET', key, JSON.stringify(d)]);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
};
