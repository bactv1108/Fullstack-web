const { MsEdgeTTS, OUTPUT_FORMAT } = require('microsoft-edge-tts');
const fs = require('fs-extra');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const ttsStorage = new AsyncLocalStorage();

class VoiceService {
  constructor() {
    Object.defineProperty(this, 'tts', {
      get: () => ttsStorage.getStore(),
      configurable: true
    });
  }

  /**
   * Synthesize text to speech using Microsoft Edge TTS (free Node.js library).
   * ElevenLabs has been deprecated and completely removed.
   */
  async textToSpeech(text, voiceOption, jobId, speed = 1.0, pitch = 0) {
    let voiceName = voiceOption;
    if (!voiceName || typeof voiceName !== 'string' || !voiceName.trim()) {
      voiceName = "vi-VN-NamMinhNeural";
    } else {
      voiceName = voiceName.trim();
    }

    // ElevenLabs fallback handler: if voice does not contain a hyphen, default to Edge TTS
    if (voiceName && !voiceName.includes('-')) {
      console.warn(`[VOICE SERVICE] ElevenLabs is deprecated. Voice "${voiceName}" fell back to Edge TTS vi-VN-NamMinhNeural`);
      voiceName = "vi-VN-NamMinhNeural";
    }

    // Microsoft Edge TTS Pipeline with safe pathing and naming
    const dirPath = path.join(__dirname, '../../public/uploads/voices');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const fileName = `voice_job_${jobId}.mp3`;
    const absoluteFilePath = path.join(dirPath, fileName);
    const relativeFilePath = `/uploads/voices/${fileName}`;
    const outputUrl = `http://localhost:3000/uploads/voices/${fileName}`;

    const ttsInstance = new MsEdgeTTS();
    ttsInstance.setVoice = async (voice) => {
      return ttsInstance.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    };

    return ttsStorage.run(ttsInstance, async () => {
      let audioStream = null;
      let writeStream = null;

      try {
        console.log(`[VOICE SERVICE] Synthesizing speech for job #${jobId} using Edge TTS: ${voiceName}`);
        await this.tts.setVoice(voiceName);

        const speedPercent = Math.round((speed - 1) * 100);
        const speedSign = speedPercent >= 0 ? '+' : '';
        const speedString = `${speedSign}${speedPercent}%`;

        const pitchVal = parseInt(pitch);
        const pitchSign = pitchVal >= 0 ? '+' : '';
        const pitchString = `${pitchSign}${pitchVal}%`;

        const xmlLang = voiceName.split('-').slice(0, 2).join('-');
        const requestSSML = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${xmlLang}"><voice name="${voiceName}"><prosody pitch="${pitchString}" rate="${speedString}">${text}</prosody></voice></speak>`;

        const result = this.tts.rawToStream(requestSSML);
        audioStream = result.audioStream;

        writeStream = fs.createWriteStream(absoluteFilePath);
        audioStream.pipe(writeStream);

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve);
          writeStream.on('error', reject);
          audioStream.on('error', reject);
        });

        // Write compatibility files
        try {
          const buffer = await fs.promises.readFile(absoluteFilePath);
          await fs.promises.writeFile(path.join(dirPath, `AI_Studio_Voice_ID_${jobId}.mp3`), buffer);
          await fs.promises.writeFile(path.join(dirPath, `voice_${jobId}.mp3`), buffer);
        } catch (copyErr) {
          console.error('[VOICE SERVICE] Copy compat file failed:', copyErr.message);
        }

        // Database status finalization for standard jobs
        try {
          const { Job } = require('../models');
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
            console.log(`[VOICE SERVICE] Job #${jobId} status finalized to Completed.`);
          }
        } catch (dbErr) {
          console.warn('[VOICE SERVICE] Failed to update job model:', dbErr.message);
        }

        return relativeFilePath;
      } catch (error) {
        console.error(`[VOICE SERVICE] Error generating TTS for job #${jobId}:`, error.message);
        if (writeStream) {
          try { writeStream.destroy(); } catch (e) {}
        }
        try {
          if (fs.existsSync(absoluteFilePath)) {
            fs.unlinkSync(absoluteFilePath);
          }
        } catch (e) {}
        throw error;
      }
    });
  }
}

module.exports = new VoiceService();
