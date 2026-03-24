const jwt = require('jsonwebtoken');
const secretKey = 'your-secret-key';

function authorize(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.sendStatus(401);

    const token = authHeader.split(' ')[1];
    jwt.verify(token, secretKey, (err, user) => {
      if (err) return res.sendStatus(403);
      if (!roles.includes(user.role)) return res.sendStatus(403);

      req.user = user;
      next();
    });
  };
}

module.exports = authorize;
