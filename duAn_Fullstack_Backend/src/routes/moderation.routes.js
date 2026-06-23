const express = require('express');
const router = express.Router();
const { authenticateJWT, isAdmin } = require('../middlewares/auth.middleware');
const { adminLimiter } = require('../middlewares/rate-limiter.middleware');
const adminController = require('../controllers/admin.controller');

// Áp dụng bảo mật admin cho toàn bộ router này
router.use(adminLimiter);
router.use(authenticateJWT);
router.use(isAdmin);

/**
 * GET /api/v1/admin/moderation/queue
 * Lấy danh sách ảnh phân tích có trạng thái 'pending' cần Admin kiểm duyệt thủ công.
 * Kèm thông tin owner (name, email, avatar).
 */
router.get('/moderation/queue', async (req, res) => {
  try {
    const { ImageAnalysis, User } = require('../models');

    const items = await ImageAnalysis.findAll({
      where: { status: 'pending' },
      order: [['id', 'DESC']],
      limit: 50,
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'avatar']
      }]
    });

    return res.status(200).json({
      success: true,
      items: items.map(img => ({
        id: img.id,
        image_name: img.image_name,
        image_path: img.image_path,
        mime_type: img.mime_type,
        file_size: img.file_size,
        status: img.status,
        error_message: img.error_message,
        prompt_output: img.prompt_output,
        created_at: img.created_at,
        user: img.owner ? {
          id: img.owner.id,
          name: img.owner.name,
          email: img.owner.email,
          avatar: img.owner.avatar
        } : null
      }))
    });
  } catch (err) {
    console.error('[V1 MODERATION] getModerationQueue error:', err.message);
    return res.status(500).json({ message: 'Loi he thong khi tai hang doi kiem duyet anh.' });
  }
});

/**
 * POST /api/v1/admin/moderation/review
 * Admin xu ly quyet dinh kiem duyet mot anh phan tich.
 * Body: { itemId: number, action: 'approved' | 'rejected' }
 * - 'approved' -> cap nhat status = 'success' (anh hop le, cho qua)
 * - 'rejected' -> giu nguyen status = 'failed' va them error_message xac nhan vi pham
 *
 * SAU KHI XU LY: Phat su kien WebSocket 'image_analysis_result' ve dung room cua User
 * de Frontend tu dong cap nhat ket qua ma khong can F5.
 */
router.post('/moderation/review', async (req, res) => {
  const { itemId, action } = req.body;

  if (!itemId || !['approved', 'rejected'].includes(action)) {
    return res.status(400).json({
      message: 'Du lieu khong hop le. Can itemId va action (approved | rejected).'
    });
  }

  try {
    const { ImageAnalysis } = require('../models');
    const img = await ImageAnalysis.findByPk(itemId);

    if (!img) {
      return res.status(404).json({ message: `Khong tim thay anh phan tich ID ${itemId}.` });
    }

    if (action === 'approved') {
      // Admin xac nhan anh hop le -> chuyen sang success
      await img.update({
        status: 'success',
        error_message: null
      });
    } else {
      // Admin xac nhan vi pham -> danh dau ro rang de audit trail
      await img.update({
        error_message: `[Admin xac nhan vi pham] ${img.error_message || 'Noi dung khong phu hop.'}`
      });
    }

    console.log(`[V1 MODERATION] Anh #${itemId} -> action="${action}" boi Admin (userId: ${req.user?.id})`);

    // ─────────────────────────────────────────────────────────────────────────────
    // BAN SU KIEN WEBSOCKET VE DUNG PHONG CUA USER
    // Room convention (theo server.js): user_room_${userId}
    // Event: image_analysis_result
    // Payload: { itemId, status, resultData, message }
    // ─────────────────────────────────────────────────────────────────────────────
    const io = req.io;
    const ownerId = img.user_id;

    if (io && ownerId) {
      const userRoom = `user_room_${ownerId}`;

      // Reload record sau update de lay du lieu chinh xac nhat tu DB
      const updatedImg = await ImageAnalysis.findByPk(itemId);

      const socketPayload = {
        itemId: Number(itemId),
        status: action === 'approved' ? 'success' : 'failed',
        resultData: updatedImg
          ? {
              id:            updatedImg.id,
              prompt_output: updatedImg.prompt_output  || null,
              input_tokens:  updatedImg.input_tokens   || null,
              output_tokens: updatedImg.output_tokens  || null,
              status:        updatedImg.status,
              error_message: updatedImg.error_message  || null,
            }
          : null,
        message: action === 'approved'
          ? 'Ket qua phan tich Mat Than da san sang!'
          : 'Anh cua ban da bi Admin xac nhan vi pham chinh sach.',
      };

      io.to(userRoom).emit('image_analysis_result', socketPayload);
      console.log(`[SOCKET EMIT] image_analysis_result -> ${userRoom} | action=${action} | itemId=${itemId}`);
    } else {
      console.warn(`[SOCKET WARN] Khong the emit: io=${!!io}, ownerId=${ownerId}`);
    }
    // ─────────────────────────────────────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      message: action === 'approved'
        ? `Da duyet anh #${itemId}: Hop le.`
        : `Da xac nhan vi pham anh #${itemId}.`,
      itemId,
      action
    });
  } catch (err) {
    console.error('[V1 MODERATION] reviewModerationItem error:', err.message);
    return res.status(500).json({ message: 'Loi he thong khi xu ly kiem duyet anh.' });
  }
});

/**
 * POST /api/v1/admin/moderation/reject
 * Admin xác nhận vi phạm ảnh phân tích (chống lỗi F5 hiện lại)
 */
router.post('/moderation/reject', isAdmin, adminController.confirmImageViolation);

module.exports = router;
