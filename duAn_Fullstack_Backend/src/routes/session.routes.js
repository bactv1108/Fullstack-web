const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { getSessions, revokeSession } = require('../controllers/session.controller');

// GET  /api/v1/auth/sessions        — list all sessions for current user
router.get('/sessions', authenticateJWT, getSessions);

// POST /api/v1/auth/sessions/revoke — terminate a session by id
router.post('/sessions/revoke', authenticateJWT, revokeSession);

module.exports = router;
