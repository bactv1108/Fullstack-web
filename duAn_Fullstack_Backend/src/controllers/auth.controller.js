const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const googleAuth = (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Để nhận refresh_token
    prompt: 'consent', // Bắt buộc user đồng ý để luôn trả về refresh_token
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(url);
};

const googleCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });

    const userInfoResponse = await oauth2.userinfo.get();
    const { id: google_id, email, name, picture: avatar } = userInfoResponse.data;

    const refresh_token = tokens.refresh_token;

    // Check if user exists
    const [rows] = await db.execute('SELECT * FROM users WHERE google_id = ? OR email = ?', [google_id, email]);
    let user = rows[0];

    if (user) {
      // UPSERT: Update name, avatar, and conditionally refresh_token
      let updateQuery = 'UPDATE users SET name = ?, avatar = ?';
      let queryParams = [name, avatar];

      if (refresh_token) {
        updateQuery += ', refresh_token = ?';
        queryParams.push(refresh_token);
      }
      
      updateQuery += ' WHERE id = ?';
      queryParams.push(user.id);

      await db.execute(updateQuery, queryParams);
      
      // Update local user object for JWT
      user.name = name;
      user.avatar = avatar;
    } else {
      // INSERT
      const [insertResult] = await db.execute(
        'INSERT INTO users (google_id, email, name, avatar, refresh_token) VALUES (?, ?, ?, ?, ?)',
        [google_id, email, name, avatar, refresh_token || null]
      );
      user = {
        id: insertResult.insertId,
        google_id,
        email,
        name,
        avatar,
        role: 'user'
      };
    }

    // Sign local JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '15m' }
    );

    // Redirect back to frontend
    // Frontend URL could be loaded from env, hardcoded for now as requested
    const frontendRedirectUrl = `http://localhost:5173/auth/google/callback?token=${token}`;
    res.redirect(frontendRedirectUrl);

  } catch (error) {
    console.error('Error in Google Callback:', error);
    res.status(500).json({ error: 'Internal Server Error during Google Authentication' });
  }
};

module.exports = {
  googleAuth,
  googleCallback
};
