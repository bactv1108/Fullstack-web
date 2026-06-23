/**
 * VideoJob.js — Sequelize Model
 * ─────────────────────────────────────────────────────────────────────────────
 * Ánh xạ bảng `video_jobs` trong cơ sở dữ liệu MySQL.
 *
 * Thứ tự cột DB (khớp 100% với INFORMATION_SCHEMA sau migration):
 * ┌────────────────────────┬──────────────────────────────────┬──────────────┐
 * │ Cột DB                 │ Field JS (camelCase)              │ Kiểu         │
 * ├────────────────────────┼──────────────────────────────────┼──────────────┤
 * │ id                     │ id                               │ INT PK AI    │
 * │ user_id                │ userId                           │ INT NOT NULL │
 * │ analysis_id            │ analysisId                       │ INT NULL     │
 * │ prompt                 │ prompt                           │ TEXT NOT NULL│
 * │ input_image_url        │ inputImageUrl                    │ VARCHAR NULL │
 * │ aspect_ratio           │ aspectRatio                      │ ENUM NOT NULL│
 * │ duration               │ duration                         │ INT NOT NULL │
 * │ style_preset           │ stylePreset                      │ VARCHAR NULL │
 * │ status                 │ status                           │ ENUM NOT NULL│
 * │ third_party_task_id    │ thirdPartyTaskId                 │ VARCHAR NULL │
 * │ video_url              │ videoUrl                         │ TEXT NULL    │
 * │ model_name             │ modelName                        │ VARCHAR(50)  │
 * │ created_at             │ createdAt                        │ DATETIME auto│
 * │ updated_at             │ updatedAt                        │ DATETIME auto│
 * └────────────────────────┴──────────────────────────────────┴──────────────┘
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoJob = sequelize.define('VideoJob', {

    // ── PK ───────────────────────────────────────────────────────────────────
    id: {
      type         : DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey   : true,
    },

    // ── FK → bảng users ──────────────────────────────────────────────────────
    userId: {
      type     : DataTypes.INTEGER,
      allowNull: false,
      field    : 'user_id',
      comment  : 'ID người dùng sở hữu tác vụ',
    },

    // ── FK → bảng image_analyses (Mắt Thần AI) — tuỳ chọn ───────────────────
    // NULL khi tạo video độc lập; có giá trị khi tạo từ kịch bản Mắt Thần
    analysisId: {
      type     : DataTypes.INTEGER,
      allowNull: true,
      field    : 'analysis_id',
      comment  : 'FK tuỳ chọn tới bảng image_analyses (kịch bản Mắt Thần AI)',
    },

    // ── Prompt mô tả video gửi lên Fal.ai ───────────────────────────────────
    prompt: {
      type     : DataTypes.TEXT,
      allowNull: false,
      comment  : 'Prompt mô tả nội dung video gửi lên Fal.ai',
    },

    // ── URL ảnh đầu vào (image-to-video) ────────────────────────────────────
    inputImageUrl: {
      type     : DataTypes.STRING(2048),
      allowNull: true,
      field    : 'input_image_url',
      comment  : 'URL ảnh đầu vào cho luồng image-to-video của Fal.ai',
    },

    // ── Tỉ lệ khung hình — khớp chính xác với ENUM DB ───────────────────────
    aspectRatio: {
      type        : DataTypes.ENUM('9:16', '16:9', '4:3'),
      allowNull   : false,
      defaultValue: '16:9',
      field       : 'aspect_ratio',
      comment     : 'Tỉ lệ khung hình: 9:16 (dọc) | 16:9 (ngang) | 4:3 (chuẩn)',
    },

    // ── Thời lượng video (giây) — chỉ áp dụng cho model Premium ──────────────
    duration: {
      type        : DataTypes.INTEGER,
      allowNull   : false,
      defaultValue: 5,
      field       : 'duration',
      comment     : 'Thời lượng video (giây): 5 | 10 — chỉ dùng cho Kling v2.5 Standard',
    },

    // ── Style preset (tuỳ chọn — dành cho mở rộng sau) ──────────────────────
    stylePreset: {
      type     : DataTypes.STRING(255),
      allowNull: true,
      field    : 'style_preset',
      comment  : 'Phong cách render tuỳ chọn (realistic, anime, cinematic...)',
    },

    // ── Trạng thái xử lý — khớp chính xác với ENUM DB ───────────────────────
    status: {
      type        : DataTypes.ENUM('queueing', 'processing', 'success', 'failed'),
      allowNull   : false,
      defaultValue: 'queueing',
      comment     : 'Trạng thái: queueing→processing→success|failed',
    },

    // ── ID tác vụ phía Fal.ai (dùng để tra cứu webhook) ─────────────────────
    thirdPartyTaskId: {
      type     : DataTypes.STRING(255),
      allowNull: true,
      field    : 'third_party_task_id',
      comment  : 'request_id do Fal.ai trả về — dùng để map webhook callback',
    },

    // ── URL video kết quả sau khi Fal.ai hoàn tất ───────────────────────────
    videoUrl: {
      type     : DataTypes.TEXT,
      allowNull: true,
      field    : 'video_url',
      comment  : 'URL video kết quả từ Fal.ai CDN',
    },

    // ── Tên mô hình AI sử dụng ──────────────────────────────────────────────
    modelName: {
      type        : DataTypes.STRING(50),
      allowNull   : false,
      defaultValue: 'hunyuan_video',
      field       : 'model_name',
      comment     : 'Mô hình AI sử dụng: hunyuan_video (mặc định) | kling_v1_6',
    },

  }, {
    tableName : 'video_jobs',
    underscored: true,    // created_at / updated_at tự động (snake_case)
    timestamps : true,
  });

  return VideoJob;
};

