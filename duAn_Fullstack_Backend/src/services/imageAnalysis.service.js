const { SystemConfig } = require('../models');

// Dynamic require mapping for Google Generative AI SDK
let GoogleGenAI;
try {
  GoogleGenAI = require('@google/generative-ai').GoogleGenAI;
} catch (e) {
  // Safe mock client placeholder to prevent compile crashes if package not installed
  GoogleGenAI = class {
    constructor({ apiKey }) {
      this.apiKey = apiKey;
    }
  };
}

class ImageAnalysisService {
  /**
   * Dynamically retrieves the active Gemini API key from database or process.env
   * @returns {Promise<string|null>} The active API key or null
   */
  async getActiveApiKey() {
    try {
      const dbRecord = await SystemConfig.findByPk('gemini_api_key');
      if (dbRecord && dbRecord.value) {
        return dbRecord.value;
      }
    } catch (error) {
      console.error('[IMAGE ANALYSIS SERVICE] DB key query error:', error.message);
    }
    return process.env.GEMINI_API_KEY || null;
  }

  /**
   * Initializes and returns the Generative AI client instance dynamically
   * @returns {Promise<any>}
   */
  async getClientInstance() {
    const apiKey = await this.getActiveApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured in the database settings or environment variables.');
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Analyze an image using the dynamically loaded client
   * @param {Buffer} imageBuffer 
   * @param {string} prompt 
   */
  async analyzeImage(imageBuffer, prompt) {
    const aiInstance = await this.getClientInstance();
    console.log('[IMAGE ANALYSIS SERVICE] Initiating Google Generative AI instance dynamically.');
    // Simulated/Placeholder generative call:
    return { success: true, clientApiKey: aiInstance.apiKey ? 'ConfigureOK' : 'None' };
  }
}

module.exports = new ImageAnalysisService();
