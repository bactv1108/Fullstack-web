// utils/stealthCrawler.js
const axios = require('axios');

function extractPriceFromAnywhere(pageHtml, rawText) {
  // 🎯 TẦNG 1: Quét thẻ Meta Ad-Pixel chuẩn hóa (Logic cũ)
  const amountRegex = /<meta[^>]*property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/i;
  let match = pageHtml.match(amountRegex);
  if (match && match[1] && !isNaN(match[1])) {
    return Number(match[1]).toLocaleString('vi-VN') + 'đ';
  }

  // 🎯 TẦNG 2: Bẫy sâu cấu trúc JSON ngầm của TikTok Shop (Quét chuỗi priceStr hoặc minPrice)
  const jsonPriceRegex = /"priceStr"\s*:\s*"([^"]+)"|"minPrice"\s*:\s*"([^"]+)"/i;
  const jsonMatch = pageHtml.match(jsonPriceRegex);
  if (jsonMatch) {
    const rawPrice = jsonMatch[1] || jsonMatch[2];
    if (rawPrice && !rawPrice.includes('{')) {
      let cleanPrice = rawPrice.replace(/[^\d]/g, '');
      if (cleanPrice) return Number(cleanPrice).toLocaleString('vi-VN') + 'đ';
    }
  }

  // 🎯 TẦNG 3: Cứu hộ khẩn cấp bằng cách quét Regex tiền tệ trên chuỗi rawText thô toàn màn hình
  // Tìm các cụm có ký tự ₫ hoặc đ đứng trước/sau dải số (Ví dụ: ₫159.000, 159đ)
  const textPriceRegex = /(?:₫|đ|vnd)\s*([\d\.,]{3,10})|([\d\.,]{3,10})\s*(?:đ|₫|vnd)/i;
  const textMatch = rawText.match(textPriceRegex);
  if (textMatch) {
    const finalPriceStr = textMatch[1] || textMatch[2];
    let cleanPrice = finalPriceStr.replace(/[\.\s,]/g, '');
    if (!isNaN(cleanPrice) && cleanPrice.length >= 4) { // Tránh bắt nhầm mã sản phẩm ngắn
      return Number(cleanPrice).toLocaleString('vi-VN') + 'đ';
    }
  }

  return null;
}

/**
 * Hàm cào dữ liệu qua Scraper API đám mây thay thế cho Puppeteer Stealth nội bộ
 * Giữ nguyên tên hàm để không ảnh hưởng đến các tập tin import khác
 */
async function scrapeWithPuppeteerStealth(productUrl) {
  console.log(`[CLOUD SCRAPER] Processing URL via ScraperAPI: ${productUrl}`);

  const apiKey = process.env.SCRAPER_API_KEY;

  if (!apiKey) {
    console.error('[CLOUD SCRAPER] Error: SCRAPER_API_KEY is missing in environment variables.');
    throw new Error('SCRAPER_API_EMPTY_DATA');
  }

  try {
    // Gọi API đám mây ScraperAPI vượt tường lửa với render=true và timeout 45 giây
    const targetUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(productUrl)}&render=true`;
    
    const response = await axios.get(targetUrl, { timeout: 45000 });
    const html = response.data;

    if (!html || typeof html !== 'string') {
      throw new Error('SCRAPER_API_EMPTY_DATA');
    }

    let title = '';
    let price = '';

    // TẦNG KHAI THÁC SÂU TIKTOK PC: Quét thẻ RENDER_DATA
    if (html.includes('id="RENDER_DATA"')) {
      try {
        const renderDataMatch = html.match(/<script[^>]*id=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i);
        if (renderDataMatch && renderDataMatch[1]) {
          let decodedJsonText = renderDataMatch[1].trim();
          if (decodedJsonText.includes('%')) {
            try {
              decodedJsonText = decodeURIComponent(decodedJsonText);
            } catch (e) {
              console.warn('[CRAWLER JSON] decodeURIComponent failed, using raw string:', e.message);
            }
          }
          const parsedData = JSON.parse(decodedJsonText);
          
          // Khai thác sâu cây cấu trúc JSON của TikTok PDP Desktop
          const productInfo = parsedData?.initialData?.productInfo || {};
          title = productInfo?.title || '';
          
          const priceInfo = productInfo?.price || {};
          if (priceInfo.priceStr) {
            price = priceInfo.priceStr;
          } else if (priceInfo.minPrice) {
            price = Number(priceInfo.minPrice).toLocaleString('vi-VN') + 'đ';
          }
        }
      } catch (jsonErr) {
        console.error('[CRAWLER JSON ERROR] Lỗi giải mã RENDER_DATA:', jsonErr.message);
      }
    }

    // Lột sạch thẻ HTML tag bằng Regex để thu về tối đa 3000 ký tự chữ thô (rawText)
    const rawTextClean = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const rawTextCut = rawTextClean.substring(0, 3000);

    // Nếu RENDER_DATA không bốc được title, sử dụng meta tag regex làm dự phòng
    if (!title) {
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i);
      if (ogTitleMatch && ogTitleMatch[1]) {
        title = ogTitleMatch[1].trim();
      }
    }

    // Nếu tiêu đề rỗng hoặc chứa từ khóa Captcha/Security Check, đánh dấu là lỗi
    if (!title || 
        title.toLowerCase().includes('security check') || 
        title.toLowerCase().includes('captcha') || 
        title.toLowerCase().includes('robot') || 
        title.toLowerCase().includes('verification')) {
      console.error(`[CLOUD SCRAPER] Title is invalid or blocked: "${title}"`);
      throw new Error('SCRAPER_API_EMPTY_DATA');
    }

    // Nếu RENDER_DATA không bốc được price, sử dụng bộ quét Regex Meta/Anywhere cũ
    if (!price) {
      price = extractPriceFromAnywhere(html, rawTextCut);
    }

    // Thẩm định nghiêm ngặt kết quả đầu ra
    const hasValidTitle = title && title.trim().length > 0;
    const hasValidPrice = price && price !== 'Liên hệ shop' && /\d+/.test(price);

    if (!hasValidTitle || !hasValidPrice) {
      console.error(`[CLOUD SCRAPER] Validation failed. Title: "${title}", Price: "${price}"`);
      throw new Error('SCRAPER_API_EMPTY_DATA');
    }

    const cleanData = {
      title: title,
      price: price,
      description: title,
      rawText: rawTextCut,
      variants: [{ thuoc_tinh: 'Phân loại', lua_chon: ['Mặc định'] }],
      scrapedAt: new Date()
    };

    console.log(`[CLOUD SCRAPER SUCCESS] Extracted product: "${cleanData.title}" | Price: ${cleanData.price}`);
    return cleanData;

  } catch (error) {
    console.error('[CLOUD SCRAPER EXCEPTION]', error.message);
    throw new Error('SCRAPER_API_EMPTY_DATA');
  }
}

module.exports = { scrapeWithPuppeteerStealth, extractPriceFromAnywhere };
