const { MsEdgeTTS, OUTPUT_FORMAT } = require('microsoft-edge-tts');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { AsyncLocalStorage } = require('async_hooks');

const ttsStorage = new AsyncLocalStorage();

/**
 * DEPRECATED_VOICE_MAP — Ánh xạ các giọng nói Microsoft Edge TTS đã bị deprecated
 * sang giọng tương đương hiện tại. Microsoft thỉnh thoảng ngừng hỗ trợ một số giọng
 * trên free tier của Edge TTS mà không thông báo, khiến server trả về stream rỗng → file 0-byte.
 * Thêm các entry mới vào đây khi phát hiện giọng bị deprecated.
 */
const DEPRECATED_VOICE_MAP = {
  'vi-VN-HoaiAnNeural': 'vi-VN-HoaiMyNeural',  // HoaiAn ngừng hỗ trợ trên Edge free tier → HoaiMy
  // Thêm các deprecated voice khác tại đây nếu cần:
  // 'en-US-SomeOldNeural': 'en-US-JennyNeural',
};

class VoiceService {
  constructor() {
    Object.defineProperty(this, 'tts', {
      get: () => ttsStorage.getStore(),
      configurable: true
    });
  }

  /**
   * Hybrid TTS Service:
   * - Nếu voiceOption chứa dấu '-' → Microsoft Edge TTS (miễn phí)
   * - Nếu voiceOption KHÔNG chứa dấu '-' → ElevenLabs API chính chủ
   */
  async textToSpeech(text, voiceOption, jobId, speed = 1.0, pitch = 0) {
    // ─── 1. CHUẨN HOÁ VOICE OPTION ───────────────────────────────────────────
    let voiceName = (voiceOption && typeof voiceOption === 'string')
      ? voiceOption.trim()
      : 'vi-VN-NamMinhNeural';

    if (!voiceName) {
      voiceName = 'vi-VN-NamMinhNeural';
    }

    // ─── 1b. RESOLVE DEPRECATED VOICE NAMES ──────────────────────────────────
    // Tự động ánh xạ các giọng cũ/deprecated sang giọng tương đương đang hoạt động.
    // Điều này fix triệt để lỗi 0-byte khi server Microsoft từ chối giọng không còn
    // được hỗ trợ trên Edge TTS free tier mà không thông báo lỗi rõ ràng.
    if (DEPRECATED_VOICE_MAP[voiceName]) {
      const resolvedVoice = DEPRECATED_VOICE_MAP[voiceName];
      console.warn(`[VOICE SERVICE] ⚠️  Giọng "${voiceName}" đã bị Microsoft deprecated trên Edge TTS free tier. Tự động chuyển sang "${resolvedVoice}".`);
      voiceName = resolvedVoice;
    }

    // ─── 2. TRUY VẤN ELEVENLABS KEY TỪ DATABASE ──────────────────────────────
    let elevenLabsKey = null;
    try {
      const { SystemConfig } = require('../models');
      const configRow = await SystemConfig.findOne({ where: { key: 'elevenlabs_key' } });
      if (configRow && configRow.value) {
        elevenLabsKey = configRow.value.trim();
      }
    } catch (dbErr) {
      console.warn('[VOICE SERVICE] Không thể truy vấn elevenlabs_key từ DB:', dbErr.message);
    }

    // ─── 3. CHUẨN BỊ ĐƯỜNG DẪN FILE OUTPUT ──────────────────────────────────
    const dirPath = path.join(__dirname, '../../public/uploads/voices');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const fileName = `voice_job_${jobId}.mp3`;
    const absoluteFilePath = path.join(dirPath, fileName);
    const relativeFilePath = `/uploads/voices/${fileName}`;
    const outputUrl = `http://localhost:3000/uploads/voices/${fileName}`;

    // ─── 4. CHIA LUỒNG XỬ LÝ HYBRID ─────────────────────────────────────────
    const isEdgeTTS = voiceName.includes('-');

    if (isEdgeTTS) {
      // ══════════════════════════════════════════════════════════════════════
      // NHÁNH 1: MICROSOFT EDGE TTS
      // Voice chứa dấu '-' (vd: vi-VN-NamMinhNeural, en-US-AriaNeural...)
      // ══════════════════════════════════════════════════════════════════════
      console.log(`[VOICE SERVICE] [Edge TTS] Bắt đầu tổng hợp giọng "${voiceName}" cho Job #${jobId}`);

      const ttsInstance = new MsEdgeTTS();
      ttsInstance.setVoice = async (voice) => {
        return ttsInstance.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      };

      return ttsStorage.run(ttsInstance, async () => {
        let audioStream = null;
        let writeStream = null;
        let success = false;
        const maxAttempts = 5;
        let currentTts = ttsInstance;

        // Tính toán tốc độ và pitch theo chuẩn SSML
        const speedPercent = Math.round((speed - 1) * 100);
        const speedSign = speedPercent >= 0 ? '+' : '';
        const speedString = `${speedSign}${speedPercent}%`;

        const pitchVal = parseInt(pitch);
        const pitchSign = pitchVal >= 0 ? '+' : '';
        const pitchString = `${pitchSign}${pitchVal}%`;

        // Escape ký tự đặc biệt XML để tránh lỗi SSML
        const escapeXML = (str) => {
          if (!str) return '';
          return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        };
        const escapedText = escapeXML(text);

        const xmlLang = voiceName.split('-').slice(0, 2).join('-');
        const requestSSML = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xmlLang}"><voice name="${voiceName}"><prosody pitch="${pitchString}" rate="${speedString}">${escapedText}</prosody></voice></speak>`;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          console.log(`[VOICE SERVICE] [Edge TTS] Attempt ${attempt}/${maxAttempts} — Job #${jobId}`);
          try {
            if (attempt > 1) {
              // Tạo instance TTS mới hoàn toàn để đảm bảo WebSocket connection mới
              currentTts = new MsEdgeTTS();
              currentTts.setVoice = async (voice) => {
                return currentTts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
              };
            }

            await currentTts.setVoice(voiceName);

            // Xoá file cũ nếu tồn tại
            if (fs.existsSync(absoluteFilePath)) {
              try { fs.unlinkSync(absoluteFilePath); } catch (e) {}
            }

            await new Promise((resolve, reject) => {
              writeStream = fs.createWriteStream(absoluteFilePath);

              const result = currentTts.rawToStream(requestSSML);
              audioStream = result.audioStream;

              audioStream.pipe(writeStream);

              writeStream.on('finish', () => resolve());
              writeStream.on('error', (err) => reject(err));
              audioStream.on('error', (err) => reject(err));
            });

            // Đóng stream an toàn
            if (writeStream) {
              try { writeStream.destroy(); } catch (e) {}
            }

            // Kiểm tra file đầu ra có dữ liệu thực sự không
            const stats = fs.statSync(absoluteFilePath);
            if (stats.size > 0) {
              console.log(`[VOICE SERVICE] [Edge TTS] Attempt ${attempt} thành công (${stats.size} bytes)`);
              success = true;
              break;
            } else {
              console.warn(`[VOICE SERVICE] [Edge TTS] Attempt ${attempt} tạo file 0-byte — Server Microsoft có thể đã từ chối giọng "${voiceName}" hoặc nội dung SSML không hợp lệ. Retry...`);
              if (fs.existsSync(absoluteFilePath)) {
                try { fs.unlinkSync(absoluteFilePath); } catch (e) {}
              }
            }
          } catch (error) {
            console.warn(`[VOICE SERVICE] [Edge TTS] Attempt ${attempt} lỗi: ${error.message}`);
            if (writeStream) {
              try { writeStream.destroy(); } catch (e) {}
            }
            if (fs.existsSync(absoluteFilePath)) {
              try { fs.unlinkSync(absoluteFilePath); } catch (e) {}
            }
          }

          // Backoff delay trước khi retry
          await new Promise(r => setTimeout(r, 600));
        }

        if (!success) {
          console.error(`❌ [VOICE SERVICE] [Edge TTS] Tất cả ${maxAttempts} attempts thất bại cho Job #${jobId}. Giọng "${voiceName}" có thể không được hỗ trợ hoặc server Microsoft đang quá tải.`);
          throw new Error(`Lỗi kết xuất âm thanh: Giọng nói "${voiceName}" không phản hồi dữ liệu âm thanh sau ${maxAttempts} lần thử. Vui lòng thử giọng khác hoặc thử lại sau.`);
        }

        // Hoàn tất job: ghi file compat + cập nhật DB + bắn thông báo realtime
        return this._finalizeJob(jobId, absoluteFilePath, relativeFilePath, outputUrl, dirPath);
      });

    } else {
      // ══════════════════════════════════════════════════════════════════════
      // NHÁNH 2: ELEVENLABS API CHÍNH CHỦ
      // Voice KHÔNG chứa dấu '-' → đây là Voice ID của ElevenLabs
      // (vd: "21m00Tcm4TlvDq8ikWAM", "pNInz6obpgDQGcFmaJgB"...)
      // ══════════════════════════════════════════════════════════════════════
      console.log(`[VOICE SERVICE] [ElevenLabs] Bắt đầu tổng hợp giọng ID="${voiceName}" cho Job #${jobId}`);

      if (!elevenLabsKey) {
        throw new Error(
          'Không tìm thấy ElevenLabs API Key trong system_configs (key="elevenlabs_key"). ' +
          'Vui lòng thêm key vào trang Cài đặt Hệ thống.'
        );
      }

      // Xoá file cũ nếu tồn tại
      if (fs.existsSync(absoluteFilePath)) {
        try { fs.unlinkSync(absoluteFilePath); } catch (e) {}
      }

      try {
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceName}`;

        // DEBUG LOG: Kiểm tra key và voiceId trước khi gửi request
        console.log(`[DEBUG TTS] Đang gửi request sang ElevenLabs với Key dài: ${elevenLabsKey ? elevenLabsKey.length : 0} ký tự. Giọng: ${voiceName}`);
        console.log(`[VOICE SERVICE] [ElevenLabs] Gọi API: POST ${elevenLabsUrl}`);

        // CHUẨN CẤU TRÚC 3 THAM SỐ: axios.post(URL, BODY_DATA, CONFIG)
        const response = await axios.post(
          elevenLabsUrl,
          {
            text: text,
            model_id: 'eleven_multilingual_v2'
          },
          {
            headers: {
              'xi-api-key': elevenLabsKey.trim(),
              'Content-Type': 'application/json'
            },
            responseType: 'stream'  // Nhận về dạng stream để pipe trực tiếp vào file
          }
        );

        // Ghi stream âm thanh vào file vật lý — đồng bộ với cách Edge TTS ghi file
        await new Promise((resolve, reject) => {
          const writeStream = fs.createWriteStream(absoluteFilePath);
          response.data.pipe(writeStream);
          writeStream.on('finish', () => resolve());
          writeStream.on('error', (err) => reject(err));
          response.data.on('error', (err) => reject(err));
        });

        // Xác nhận file có dữ liệu thực
        const stats = fs.statSync(absoluteFilePath);
        if (stats.size === 0) {
          throw new Error('ElevenLabs trả về file âm thanh rỗng (0 bytes).');
        }

        console.log(`[VOICE SERVICE] [ElevenLabs] Tổng hợp thành công (${stats.size} bytes) — Job #${jobId}`);

        // Tự động ghi sổ hóa đơn chi phí API ElevenLabs
        try {
          const { ApiCost } = require('../models');
          const characterCount = text ? text.length : 0;
          const calculatedCost = characterCount * 0.00018;
          await ApiCost.create({
            provider: 'ElevenLabs',
            cost: Number(calculatedCost.toFixed(8))
          });
          console.log(`[VOICE SERVICE] ✅ Ghi nhận chi phí ElevenLabs: ${calculatedCost} USD cho ${characterCount} ký tự`);
        } catch (databaseError) {
          console.error('[VOICE SERVICE] ⚠️ Lỗi khi ghi sổ ApiCost ElevenLabs:', databaseError.message);
        }

      } catch (elevenErr) {
        // Làm sạch file lỗi
        if (fs.existsSync(absoluteFilePath)) {
          try { fs.unlinkSync(absoluteFilePath); } catch (e) {}
        }

        // Trích xuất thông báo lỗi chi tiết từ ElevenLabs API response.
        // Lưu ý: khi responseType='stream', error body là stream nên cần đọc thêm.
        let errDetail = elevenErr.message;
        if (elevenErr.response) {
          const status = elevenErr.response.status;
          console.error(`[VOICE SERVICE] [ElevenLabs] HTTP Status: ${status}`);
          // Thử đọc error body từ stream nếu có
          try {
            const rawData = elevenErr.response.data;
            if (rawData && typeof rawData.on === 'function') {
              // response.data là stream, đọc toàn bộ để lấy message lỗi
              const chunks = [];
              await new Promise((res) => {
                rawData.on('data', (chunk) => chunks.push(chunk));
                rawData.on('end', () => res());
                rawData.on('error', () => res());
              });
              const errorBody = JSON.parse(Buffer.concat(chunks).toString());
              errDetail = errorBody?.detail?.message || errorBody?.detail || errorBody?.message || elevenErr.message;
            } else {
              errDetail = rawData?.detail?.message || rawData?.detail || elevenErr.message;
            }
          } catch (parseErr) {
            errDetail = `HTTP ${elevenErr.response.status} — ${elevenErr.message}`;
          }
        }

        console.error(`❌ [VOICE SERVICE] [ElevenLabs] Lỗi cho Job #${jobId}: ${errDetail}`);
        throw new Error(`Lỗi ElevenLabs API: ${errDetail}`);
      }

      // Hoàn tất job: ghi file compat + cập nhật DB + bắn thông báo realtime
      return this._finalizeJob(jobId, absoluteFilePath, relativeFilePath, outputUrl, dirPath);
    }
  }

  /**
   * _finalizeJob — Được gọi sau khi TTS thành công (dù Edge TTS hay ElevenLabs).
   * Thực hiện:
   *   1. Ghi file compat (AI_Studio_Voice_ID_X.mp3, voice_X.mp3)
   *   2. Cập nhật trạng thái Job thành 'Completed' trong DB
   *   3. Tạo Notification và bắn real-time qua SSE/WebSocket
   */
  async _finalizeJob(jobId, absoluteFilePath, relativeFilePath, outputUrl, dirPath) {
    // Bước 1: Ghi file tương thích (compatibility files)
    try {
      const buffer = await fs.promises.readFile(absoluteFilePath);
      await fs.promises.writeFile(path.join(dirPath, `AI_Studio_Voice_ID_${jobId}.mp3`), buffer);
      await fs.promises.writeFile(path.join(dirPath, `voice_${jobId}.mp3`), buffer);
      console.log(`[VOICE SERVICE] Đã ghi file compat cho Job #${jobId}`);
    } catch (copyErr) {
      console.error('[VOICE SERVICE] Ghi file compat thất bại:', copyErr.message);
    }

    // Bước 2 + 3: Cập nhật DB và bắn thông báo real-time
    try {
      const { Job, Notification } = require('../models');
      const notificationEmitter = require('../utils/notificationEmitter');

      const job = await Job.findByPk(jobId);
      if (job) {
        job.status = 'Completed';
        job.progress = 100;
        job.output_url = outputUrl;
        try {
          job.audio_url = outputUrl;
          job.setDataValue('audio_url', outputUrl);
        } catch (e) {}
        await job.save();
        console.log(`[VOICE SERVICE] Job #${jobId} → status: Completed, output_url: ${outputUrl}`);

        // Tạo notification và emit sự kiện SSE
        try {
          const newNotif = await Notification.create({
            userId: job.userId,
            title: 'Tạo âm thanh thành công',
            message: 'Giọng nói bản nháp của bạn đã được khởi tạo thành công!',
            type: 'info',
            is_read: false
          });
          console.log('[DB DEBUG] Đã insert thành công 1 dòng vào bảng notifications. ID:', newNotif.id);

          // Bắn tín hiệu real-time sang luồng SSE qua Emitter
          notificationEmitter.emit('send_notification', newNotif);
          console.log('[SSE DEBUG] Đã emit sự kiện send_notification cho User:', job.userId);
        } catch (notifErr) {
          console.error('[VOICE SERVICE] Lỗi tạo notification:', notifErr.message);
        }
      }
    } catch (dbErr) {
      console.warn('[VOICE SERVICE] Không thể cập nhật Job model:', dbErr.message);
    }

    return relativeFilePath;
  }
}

module.exports = new VoiceService();
