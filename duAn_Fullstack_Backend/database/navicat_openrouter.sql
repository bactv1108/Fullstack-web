-- ============================================================
-- FILE: navicat_openrouter.sql
-- MỤC ĐÍCH: Thêm cấu hình openrouter_api_key vào bảng system_configs
-- CÁCH DÙNG: Mở Navicat → Query → Chạy file này (F8 hoặc Run)
-- ============================================================

-- Bước 1: Kiểm tra xem key đã tồn tại chưa (tuỳ chọn, để xem trước)
SELECT `key`, `value`, `created_at`, `updated_at`
FROM `system_configs`
WHERE `key` = 'openrouter_api_key';

-- Bước 2: Chèn dòng mới nếu chưa tồn tại
--         (ON DUPLICATE KEY UPDATE đảm bảo không bị lỗi nếu chạy lại)
INSERT INTO `system_configs` (`key`, `value`, `created_at`, `updated_at`)
VALUES ('openrouter_api_key', '', NOW(), NOW())
ON DUPLICATE KEY UPDATE `updated_at` = `updated_at`;

-- Bước 3: Xác nhận kết quả — hiển thị toàn bộ API key hiện có
SELECT `key`, 
       CASE 
         WHEN `value` = '' OR `value` IS NULL THEN '[CHUA CAI DAT]'
         ELSE CONCAT(LEFT(`value`, 8), '...[AN]')
       END AS `value_preview`,
       `created_at`,
       `updated_at`
FROM `system_configs`
ORDER BY `key` ASC;

-- ============================================================
-- KET QUA MONG DOI (sau khi chay):
--
--  key                  | value_preview    | created_at           | updated_at
--  ---------------------|------------------|----------------------|---------------------
--  elevenlabs_key       | [CHUA CAI DAT]   | 2026-xx-xx xx:xx:xx  | 2026-xx-xx xx:xx:xx
--  fal_api_key          | [CHUA CAI DAT]   | 2026-xx-xx xx:xx:xx  | 2026-xx-xx xx:xx:xx
--  gemini_api_key       | [CHUA CAI DAT]   | 2026-xx-xx xx:xx:xx  | 2026-xx-xx xx:xx:xx
--  openai_api_key       | [CHUA CAI DAT]   | 2026-xx-xx xx:xx:xx  | 2026-xx-xx xx:xx:xx
--  openrouter_api_key   | [CHUA CAI DAT]   | 2026-xx-xx xx:xx:xx  | 2026-xx-xx xx:xx:xx  <- DONG MOI
--
-- ============================================================

-- [TUY CHON] Neu muon nhap key ngay trong Navicat (khong qua Admin UI):
-- UPDATE `system_configs`
-- SET `value` = 'sk-or-v1-your-key-here', `updated_at` = NOW()
-- WHERE `key` = 'openrouter_api_key';
