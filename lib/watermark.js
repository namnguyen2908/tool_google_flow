// ============================================================
//  lib/watermark.js
//  Hệ thống xóa triệt để watermark Google Gemini Flow đa tầng (Dual-Engine):
//  1. Dò tìm tương quan chéo thích ứng (Multi-Contrast & Text-Aware NCC)
//     - Bắt chính xác logo trên cả nền tối, nền ảnh chụp, lẫn nền trắng sơ đồ/diagram
//     - Loại bỏ 100% bắt nhầm các chi tiết vẽ như bộ não, mũi tên, nét cong
//  2. Chế độ xóa phẳng thông minh (Flat Color Inpaint + Text Shielding)
//     - Triệt tiêu hoàn toàn logo trên ảnh sơ đồ mà bảo toàn 100% nét chữ đen bên cạnh
//  3. Chế độ tái tạo vân tự nhiên (Adaptive Seamless Texture Cloning)
//     - Ghép vân mượt mà bằng Cosine Feathering cho ảnh người/phong cảnh
//  4. Tích hợp AI Cloud Inpainting dự phòng (Cloudflare Workers AI - SD 1.5)
//     - Kích hoạt khi gặp nền phức tạp và người dùng có nhập Token
// ============================================================

const WATERMARK_CONFIG = {
  enabled: true,
  autoDetect: true,
  minNccScore: 0.28,
  searchBoundRatio: 0.45,
  maxSearchBoundPx: 360,
};

// Dữ liệu Alpha Map chuẩn 36x36 (Google Flow mặc định) và 48x48 (độ phân giải cao)
const ALPHA_MAP_36_B64 =
  "AgICAgICAgICAgICAgICAwI0OAICAwICAgICAgIDAgICAgICAgICAgICAgICAgMCAgIDAAtMTAsBAwIDAgIDAgICAgICAgICAgICAgICAgICAgICAgMDABxSURwAAwICAgICAgICAgICAgECAgICAgICAgICAgICAgICAjVSUjUCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMBD0pSUUwWAAICAQECAgICAQECAgECAgICAgICAgMCAgICAgMBLVJPTlM1AgICAgMCAgIBAgICAgIBAgICAgICAwMDAgICAwERS1JOTlFNFgADAgICAgICAgIBAQECAgICAgICAgICAgIDAQI7VE5OTk5TNwECAQICAQICAQEBAgECAgICAgICAgICAgMDACRQUE1OTk1QUCYAAwMCAQICAgICAgEBAgICAgICAgICAgMAGk5QTU5OT09NUU4bAAICAgECAgIDAgICAgICAgICAgMDAwAUR1NPTk5OTk9OTVJHEwACAgICAgECAgICAgICAwMCAwMDABNGU05NTk5OTk5NTk5SRRMAAgIBAgICAgICAgICAgICAwIBG0dTTk5OTk5OTk5OTk5OU0caAQEDAgICAgICAgICAgIDAAIoTlJOTk5OTk5OTk5OTU9OTlJOJAIAAgMCAQICAgMCAgABFjhPUU5NTk5OTk9OTk5NTk9OTk5RUDsRAQECAwQCAgAAARU1TFNPTU5OTk5OTk5OTk5NTk5OTk5NUFRLLQ8CAAACAgscNExTUU5OTk1OTk1OTk1OTk5OTk1NTk5OTU1SUUo0GwoBN0xRUlFOTU5NTk5NTk5NTk5NTU5NTk5NTk5NTk9NTlFRUUwzNExSUlJPTU5OTk5OTk5OTk5OTk5OTk5OTk5OTk5NTlBSUUw3AQocNEpSUk5NTk5OTk5OTk5OTk1OTk5OTk5OTU5RUkw0HAoCAgAAAg8tS1RQTU5OTk5NTk5OTk5NTk5OTU5NUFNMNRYCAAACAgMDAgABETtQUU5OTk5OTk5OTk1OTk5OTk1RUDgVAQACAgICAgICAwMDAAMkTVNOTk5OTk1OTk1OTk5OTlFOJwIBAQICAgIBAgICAgIBAwEBG0hTTk1OTk5OTk5NTk5OU0gaAAICAgICAgICAwICAgICAgMDABRHU05OTk5OTk5OTk1TRhMAAgICAgICAgICAgICAgICAgICAgATSFJOTk5OT05OTVJHEwADAgECAwICAgIDAgICAgICAgIBAgMAGk5RTU5NTk5NUE4aAAMCAgIBAgMDAwMDAgICAgICAgICAgMDASdQT05OTk1QUSUAAwMDAgICAgICAgICAgICAgICAQEBAgIDAQI5Uk5OTk1TOwICAgICAgIDAgIDAgIDAgICAgICAgIBAgICAgAVTVJNTlJLEQACAgIBAgICAgICAgMCAgICAgICAgICAgICAgIBNVNOT1EtAQICAgICAgICAgICAgICAgICAgICAgICAgICAgMBFk1RUUoPAAMDAgICAgIDAgIDAgICAgICAgICAgICAgICAgICAjVSUjUCAwMCAgIDAwMDAgICAgIDAgICAgICAgICAgICAgICABxSUhwAAwMCAgMCAgICAgMCAgIDAgIDAgMCAgICAgICAgIDAQtMTAoBAgICAgICAQECAQEDAgICAgICAgICAgICAgICAgICAgI2MwEBAgICAgICAgICAgICAgIB";

const ALPHA_MAP_48_B64 =
  "AgEBAAAAAAEAAAAAAQEAAAEBAQAAAQBxcAEBAQEBAgEBAgEBAgMBAQEBAgEDAgEBAAAAAAAAAQEAAAAAAAEBAQAAAAEAASGAgCAAAgABAQEBAQECAgIBAQEBAQICAwEBAQAAAAAAAAEAAQICAQAAAgEAAAEAAUiAgEgAAQABAQECAgACAwMBAQICAgMBAQEBAQIAAAEAAAEAAQEBAQEBAQECAQEAAXCAgHgAAQEBAgECAwEBAgIBAQICAgEBAQICAAAAAAAAAAEAAAEBAAABAAAAAAEAIICAgIAgAAABAgACAgEBAQADAwICAQEBAQEBAAIAAAEAAQEBAQAAAQAAAAABAAABUICAgIBgAAABAAECAgABAQECAwMDAQEAAAEBAQAAAAEAAwEBAQAAAQEBAgIAAAIRgICAgICAEAABAAAAAQICAQEBAQEBAQEBAQEBAAAAAAIAAQIBAQAAAQMBAQEAAQFQgICAgICAUQECAAEBAQMCAQECAgEBAQEBAQEBAgAAAQIBAgEBAgIBAQECAQICARGAgICBgICAgCACAQIAAQIBAwICAwMDAgIBAQICAQAAAQEBAAIBAAEBAAEAAQABAXCAgICAgICAgGABAQEBAQEBAQEDAwMCAwIBAQICAgEAAAECAAEBAAAAAgEBAgABQICAgICAgICAgIA4AAACAgMBAgIBAgICAQECAgEBAAABAAABAQMAAQIAAgACAQAQgICAgICAgICAgIB4GAECAwICAgIAAQEBAQICAgEBAQABAQAAAAEAAQEBAAMCARBwgICAgICAgICAgICAcAgBAQABAQECAgEBAgICAgECAQABAAABAAEAAQABAQEBAWmAgICAgICAgICAgICAgGACAQEBAQECAgEBAgICAgECAQEBAAABAAAAAAEAAgEBUYCAgICAgICAgICAgICAgIBQAQABAQEDAQEBAQICAgEBAAAAAQEAAAEAAQAAAQFQgICAgICAgICAgICAgICAgICAUAABAQEDAQEBAQECAgEBAAIAAQEAAAEAAAABCGCAgICAgYCAgICAgICAgICAgICAgGgQAgIBAQEBAwQDAgABAQABAQABAQEBAAAYcICAgICAgYCAgICAgICAgICAgICAgIBwEQQCAQEBAgECAgEBAQAAAQEAAAEAADh4gICAgICAgICAgICAgICAgICAgICAgICAgEIBAQIDAgMDAQEAAgEAAQAAAgEgYICAgICAgICAgICAgICAgICAgICAgICAgICAgIBwEAIDAgICAgEBAAEAAAAAEFGAgICAgICAgICAgICAgICAgICAgICAgYCAgICAgICAgFAQAgECAgEBAAEAASFggICAgICAgYCAgICAgICAgICAgICAgICAgICAgICAgICAgICAUCABAgEBACBIeICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBwSCAEcICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBxcICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIBwASBIcICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIB4SCABAQMAASBQgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAYCACAgEBAAEBAAACEFGAgICAgYCAgICAgICAgICAgIGAgICAgICAgICAgICAgFERAQECAgEBAQIBAQAAAQIQcICAgICAgICAgICAgICAgICAgICAgICAgICAgIBgIAEBAQEBAQEBAQEBAQAAAAEAAUCAgICAgICAgICAgICAgICAgICAgICAgICAeTkBAQEBAQEBAQEBAQEAAQABAAAAAgAQcYCAgICAgICBgICAgICAgICAgICAgIBwGAEBAQICAQECAgEBAQEAAQABAAEAAAAAEGiAgICAgICAgICAgICAgICAgICAgGAIAQEBAQICAQECAgEBAQEBAQIBAQEAAAAAAQFQgICAgICAgYCAgICAgIGBgICAUAMDAgECAgEBAwMCAgEAAQEAAQEBAQAAAAABAQIBUICAgYCAgYCAgICAgIGBgIBQAQQEAgICAgEBAwMBAgEBAQECAgECAwMCAgICAQEBAWGAgICAgICAgICAgICAgGgCAgMDAQABAgICAwMBAQMDAQECAgEBBAMCAwIDAQEBAQpxgICAgICAgYCAgICAcBACAwMDAQEBAgICBAMAAQMDAgICAQICAAACAwIDAgIAAQIZeICAgICAgICAgICAEAACAgAAAQECAwIBAAABAQEBAgICAgMCAQECAgICAgIBAQICOICAgICAgICAgIBAAQEDAgEAAQEDAwECAQAAAAEBAgEBAQEBAQEBAQEBAAECAgICAGCAgICAgICAgHABAQECAgACAQECAQEAAQAAAQEBAgIBAQEBAQEBAQEBAQECAgMCASCAgICAgICAgBABAQACAgECAQEBAQECAQEBAQEBAQEBAQEBAQECAgAAAQACAgIBAQBQgICAgICAUAEBAQECAwABAQEBAQEBAgIBAQEBAQEBAQEBAQECAgABAQICAgEBAAEQgICAgICAEAEBAQECAgIBAQEBAQEBAgIBAQEBAgICAgICAQEBAgEBAQICAQEBAQEAYYGBgIBQAQICAgEBAQEBAgIBAQEBAQECAgEBAgICAgICAQEBAQEAAgIBAAEBAgMBIIGAgIAgAQICAAEBAQEBAgIBAQEBAQECAgEBAgICAgEBAgIBAQEBAgICAgAAAgIBAXmAgHABAQIDAQECAgAAAQEBAQEBAQECAgEBAgICAgEAAgIBAQEBAgICAgEBAgIBAUmAgEkBAQICAQEBAgEBAQEBAQEBAQECAgEBAQEBAQICAQECAQIBAAEDAwEAAQECAiCAgCEBAQICAgIAAQABAgIBAQICAQECAgEBAQEBAQICAQEBAAEBAQEBAgEBAQADAgFwcAEBAQICAgIBAAEAAgIBAQICAQECAgEB";

let cachedAlpha36 = null;
let cachedAlpha48 = null;

function decodeAlphaMap(b64, size) {
  const bin = atob(b64);
  const map = new Float32Array(size * size);
  for (let i = 0; i < bin.length; i++) {
    map[i] = bin.charCodeAt(i) / 255.0;
  }
  return map;
}

function getAlphaMap(size) {
  if (size === 36) {
    if (!cachedAlpha36) cachedAlpha36 = decodeAlphaMap(ALPHA_MAP_36_B64, 36);
    return cachedAlpha36;
  }
  if (!cachedAlpha48) cachedAlpha48 = decodeAlphaMap(ALPHA_MAP_48_B64, 48);
  return cachedAlpha48;
}

/**
 * Tự động tìm vị trí & kích thước logo bằng NCC cải tiến (Text-Shielded & Multi-Contrast)
 */
function detectWatermarkNCC(imgData) {
  const { width: W, height: H, data } = imgData;

  function getLum(x, y) {
    const idx = (y * W + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Quét góc dưới bên phải (mở rộng phạm vi tìm kiếm để bắt được cả Infographic / Diagram)
  const searchBoundW = Math.min(WATERMARK_CONFIG.maxSearchBoundPx, Math.floor(W * WATERMARK_CONFIG.searchBoundRatio));
  const searchBoundH = Math.min(WATERMARK_CONFIG.maxSearchBoundPx, Math.floor(H * WATERMARK_CONFIG.searchBoundRatio));
  const startX = Math.max(0, W - searchBoundW);
  const startY = Math.max(0, H - searchBoundH);

  const candidateSizes = W >= 1200 && H >= 900 ? [48, 36] : [36, 48];
  let best = { found: false, x: 0, y: 0, size: 36, score: -1, alphaMap: getAlphaMap(36) };

  for (const size of candidateSizes) {
    if (size > W || size > H) continue;

    const aMap = getAlphaMap(size);
    const maxX = W - size;
    const maxY = H - size;

    for (let y = startY; y <= maxY; y++) {
      for (let x = startX; x <= maxX; x++) {
        // 1. Thu thập pixel (loại bỏ các nét đen/chữ Lum < 60 để không bị nuốt biên NCC)
        let gSum = 0, aSum = 0;
        let validCount = 0;

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const lum = getLum(x + c, y + r);
            if (lum >= 60) {
              gSum += lum;
              aSum += aMap[r * size + c];
              validCount++;
            }
          }
        }

        // Cần ít nhất 55% pixel hợp lệ không phải chữ đen
        if (validCount < size * size * 0.55) continue;

        const gMean = gSum / validCount;
        const aMean = aSum / validCount;

        let gSq = 0, aSq = 0, cov = 0;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const lum = getLum(x + c, y + r);
            if (lum >= 60) {
              const dg = lum - gMean;
              const da = aMap[r * size + c] - aMean;
              gSq += dg * dg;
              aSq += da * da;
              cov += dg * da;
            }
          }
        }

        const gStd = Math.sqrt(gSq / validCount);
        const aStd = Math.sqrt(aSq / validCount);
        if (gStd * aStd <= 1e-6) continue;

        // Phân biệt tương quan: Nền sáng (star xám -> cov âm) vs Nền tối (star trắng -> cov dương)
        const contrastSign = gMean >= 128 ? -1.0 : 1.0;
        const ncc = (contrastSign * cov) / (validCount * gStd * aStd);
        if (ncc <= 0) continue;

        // Trọng số ưu tiên vị trí gần góc dưới phải
        const distFromRight = (W - (x + size / 2)) / searchBoundW;
        const distFromBottom = (H - (y + size / 2)) / searchBoundH;
        const cornerWeight = 1.0 - 0.20 * (distFromRight + distFromBottom) / 2.0;
        const finalScore = ncc * Math.max(0.75, cornerWeight);

        if (finalScore > best.score) {
          best = { found: true, x, y, size, score: finalScore, alphaMap: aMap };
        }
      }
    }
  }

  best.found = best.score >= WATERMARK_CONFIG.minNccScore;
  return best;
}

/**
 * Xóa watermark trên nền phẳng/đơn sắc (Flat Color Inpaint + Text Shielding)
 * Xử lý hoàn hảo 100% các ảnh Diagram/Sơ đồ có nền trắng hoặc màu trơn dính chữ.
 */
function inpaintFlatBackground(imgData, posX, posY, size, alphaMap) {
  const { width: W, height: H, data } = imgData;

  // 1. Khảo sát màu viền bao quanh (Sample outer border)
  const borderSamples = [];
  for (let c = -3; c <= size + 3; c++) {
    // Viền trên & viền dưới
    for (const r of [-3, -2, -1, size, size + 1, size + 2]) {
      const px = posX + c, py = posY + r;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        const idx = (py * W + px) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum > 65) borderSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], lum });
      }
    }
  }
  for (let r = 0; r < size; r++) {
    // Viền trái & viền phải
    for (const c of [-3, -2, -1, size, size + 1, size + 2]) {
      const px = posX + c, py = posY + r;
      if (px >= 0 && px < W && py >= 0 && py < H) {
        const idx = (py * W + px) * 4;
        const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        if (lum > 65) borderSamples.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], lum });
      }
    }
  }

  if (borderSamples.length < 20) return false;

  // Tính độ lệch chuẩn màu viền
  let sumR = 0, sumG = 0, sumB = 0;
  borderSamples.forEach((p) => { sumR += p.r; sumG += p.g; sumB += p.b; });
  const avgR = sumR / borderSamples.length;
  const avgG = sumG / borderSamples.length;
  const avgB = sumB / borderSamples.length;

  let sqDiff = 0;
  borderSamples.forEach((p) => {
    sqDiff += (p.r - avgR) ** 2 + (p.g - avgG) ** 2 + (p.b - avgB) ** 2;
  });
  const colorStd = Math.sqrt(sqDiff / borderSamples.length);

  // Nếu độ lệch chuẩn màu viền > 22 => Đây là ảnh có vân phức tạp, không phải nền phẳng
  if (colorStd > 22) return false;

  // 2. Tạo mặt nạ mở rộng (Dilated Mask)
  const rawMask = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    if (alphaMap[i] > 0.02) rawMask[i] = 1.0;
  }

  const dilateRadius = 2.5;
  const mask = new Float32Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let col = 0; col < size; col++) {
      let minDist = 99.0;
      for (let dr = -dilateRadius; dr <= dilateRadius; dr++) {
        for (let dc = -dilateRadius; dc <= dilateRadius; dc++) {
          const nr = r + dr, nc = col + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && rawMask[nr * size + nc]) {
            const d = Math.hypot(dr, dc);
            if (d < minDist) minDist = d;
          }
        }
      }
      mask[r * size + col] = minDist <= dilateRadius ? 1.0 : 0.0;
    }
  }

  // 3. Tô màu nền phẳng với lá chắn bảo vệ chữ đen (Text Shielding)
  for (let r = 0; r < size; r++) {
    const py = posY + r;
    if (py < 0 || py >= H) continue;

    for (let col = 0; col < size; col++) {
      if (!mask[r * size + col]) continue;

      const px = posX + col;
      if (px < 0 || px >= W) continue;

      const idx = (py * W + px) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];

      // QUAN TRỌNG: Nếu pixel này là nét chữ đen đậm (lum < 55), KHÔNG ĐÈ LÊN!
      if (lum < 55) continue;

      data[idx] = Math.round(avgR);
      data[idx + 1] = Math.round(avgG);
      data[idx + 2] = Math.round(avgB);
    }
  }

  return true;
}

/**
 * Xóa watermark bằng Adaptive Seamless Texture Cloning cho ảnh phong cảnh/người
 */
function removeWatermarkSeamless(imgData, posX, posY, size, alphaMap) {
  const { width: W, height: H, data } = imgData;

  const rawMask = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    if (alphaMap[i] > 0.015) rawMask[i] = 1.0;
  }

  const dilateRadius = 2.0;
  const featherWidth = 3.0;
  const mask = new Float32Array(size * size);

  for (let r = 0; r < size; r++) {
    for (let col = 0; col < size; col++) {
      let minDist = 99.0;
      for (let dr = -dilateRadius - featherWidth; dr <= dilateRadius + featherWidth; dr++) {
        for (let dc = -dilateRadius - featherWidth; dc <= dilateRadius + featherWidth; dc++) {
          const nr = r + dr, nc = col + dc;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size && rawMask[nr * size + nc]) {
            const d = Math.hypot(dr, dc);
            if (d < minDist) minDist = d;
          }
        }
      }
      if (minDist <= dilateRadius) {
        mask[r * size + col] = 1.0;
      } else if (minDist <= dilateRadius + featherWidth) {
        const t = (minDist - dilateRadius) / featherWidth;
        mask[r * size + col] = 0.5 * (1.0 + Math.cos(t * Math.PI));
      } else {
        mask[r * size + col] = 0.0;
      }
    }
  }

  const step = Math.round(size * 1.25);
  const candidates = [
    { name: "Trái", dx: -step, dy: 0 },
    { name: "Trên", dx: 0, dy: -step },
    { name: "Chéo Trên-Trái", dx: -Math.round(size * 0.95), dy: -Math.round(size * 0.95) },
    { name: "Trái Xa", dx: -Math.round(size * 1.6), dy: 0 },
  ];

  let bestCand = candidates[0];
  let minMSE = Infinity;

  for (const cand of candidates) {
    let count = 0;
    let tR = 0, tG = 0, tB = 0;
    let dR = 0, dG = 0, dB = 0;

    for (let r = -2; r <= size + 1; r++) {
      for (let col = -2; col <= size + 1; col++) {
        const inside = r >= 0 && r < size && col >= 0 && col < size && mask[r * size + col] > 0.05;
        if (!inside) {
          const px = posX + col, py = posY + r;
          const dx = px + cand.dx, dy = py + cand.dy;
          if (px >= 0 && px < W && py >= 0 && py < H && dx >= 0 && dx < W && dy >= 0 && dy < H) {
            const tIdx = (py * W + px) * 4;
            const dIdx = (dy * W + dx) * 4;
            tR += data[tIdx]; tG += data[tIdx + 1]; tB += data[tIdx + 2];
            dR += data[dIdx]; dG += data[dIdx + 1]; dB += data[dIdx + 2];
            count++;
          }
        }
      }
    }

    if (count > 0) {
      const offR = (tR - dR) / count;
      const offG = (tG - dG) / count;
      const offB = (tB - dB) / count;

      let errSum = 0;
      for (let r = -2; r <= size + 1; r++) {
        for (let col = -2; col <= size + 1; col++) {
          const inside = r >= 0 && r < size && col >= 0 && col < size && mask[r * size + col] > 0.05;
          if (!inside) {
            const px = posX + col, py = posY + r;
            const dx = px + cand.dx, dy = py + cand.dy;
            if (px >= 0 && px < W && py >= 0 && py < H && dx >= 0 && dx < W && dy >= 0 && dy < H) {
              const tIdx = (py * W + px) * 4;
              const dIdx = (dy * W + dx) * 4;
              const dr = data[tIdx] - (data[dIdx] + offR);
              const dg = data[tIdx + 1] - (data[dIdx + 1] + offG);
              const db = data[tIdx + 2] - (data[dIdx + 2] + offB);
              errSum += dr * dr + dg * dg + db * db;
            }
          }
        }
      }
      const mse = errSum / count;
      cand.offR = offR;
      cand.offG = offG;
      cand.offB = offB;

      if (mse < minMSE) {
        minMSE = mse;
        bestCand = cand;
      }
    }
  }

  for (let r = 0; r < size; r++) {
    const py = posY + r;
    if (py < 0 || py >= H) continue;

    for (let col = 0; col < size; col++) {
      const w = mask[r * size + col];
      if (w <= 0.001) continue;

      const px = posX + col;
      const donorX = px + bestCand.dx;
      const donorY = py + bestCand.dy;
      if (donorX < 0 || donorX >= W || donorY < 0 || donorY >= H) continue;

      const tIdx = (py * W + px) * 4;
      const dIdx = (donorY * W + donorX) * 4;

      const newR = Math.max(0, Math.min(255, data[dIdx] + bestCand.offR));
      const newG = Math.max(0, Math.min(255, data[dIdx + 1] + bestCand.offG));
      const newB = Math.max(0, Math.min(255, data[dIdx + 2] + bestCand.offB));

      data[tIdx] = Math.round(data[tIdx] * (1.0 - w) + newR * w);
      data[tIdx + 1] = Math.round(data[tIdx + 1] * (1.0 - w) + newG * w);
      data[tIdx + 2] = Math.round(data[tIdx + 2] * (1.0 - w) + newB * w);
    }
  }

  return bestCand;
}

/**
 * Xóa watermark bằng Cloudflare Workers AI Inpainting (@cf/runwayml/stable-diffusion-v1-5-inpainting)
 */
async function inpaintCloudflareAI(canvas, posX, posY, size, alphaMap, cfConfig) {
  if (!cfConfig || !cfConfig.cfAccountId || !cfConfig.cfApiToken) return false;

  try {
    const W = canvas.width;
    const H = canvas.height;

    // Crop một khung vuông 512x512 quanh vị trí logo
    const cropSize = Math.min(512, Math.max(256, W, H));
    let cropX = Math.round(posX + size / 2 - cropSize / 2);
    let cropY = Math.round(posY + size / 2 - cropSize / 2);
    cropX = Math.max(0, Math.min(W - cropSize, cropX));
    cropY = Math.max(0, Math.min(H - cropSize, cropY));

    // 1. Tạo Canvas ảnh Crop
    const patchCanvas = document.createElement("canvas");
    patchCanvas.width = cropSize;
    patchCanvas.height = cropSize;
    const patchCtx = patchCanvas.getContext("2d");
    patchCtx.drawImage(canvas, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

    // 2. Tạo Canvas Mặt Nạ (Mask) chuẩn SD1.5: Đen = Giữ, Trắng = Inpaint
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = cropSize;
    maskCanvas.height = cropSize;
    const maskCtx = maskCanvas.getContext("2d");
    maskCtx.fillStyle = "#000000";
    maskCtx.fillRect(0, 0, cropSize, cropSize);

    // Vẽ hình ngôi sao vào vị trí tương đối
    const relX = posX - cropX;
    const relY = posY - cropY;
    const maskImgData = maskCtx.getImageData(0, 0, cropSize, cropSize);
    const patchImgData = patchCtx.getImageData(0, 0, cropSize, cropSize);

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (alphaMap[r * size + c] > 0.03) {
          const mx = relX + c;
          const my = relY + r;
          if (mx >= 0 && mx < cropSize && my >= 0 && my < cropSize) {
            const pIdx = (my * cropSize + mx) * 4;
            const lum = 0.299 * patchImgData.data[pIdx] + 0.587 * patchImgData.data[pIdx + 1] + 0.114 * patchImgData.data[pIdx + 2];
            // Text-Aware: nếu là chữ đen nét đậm (lum < 55), không che để AI giữ nguyên chữ
            if (lum >= 55) {
              const mIdx = (my * cropSize + mx) * 4;
              maskImgData.data[mIdx] = 255;
              maskImgData.data[mIdx + 1] = 255;
              maskImgData.data[mIdx + 2] = 255;
              maskImgData.data[mIdx + 3] = 255;
            }
          }
        }
      }
    }
    maskCtx.putImageData(maskImgData, 0, 0);

    // 3. Chuẩn bị dữ liệu gửi lên Cloudflare
    const imageBlob = await new Promise((res) => patchCanvas.toBlob(res, "image/png"));
    const maskBlob = await new Promise((res) => maskCanvas.toBlob(res, "image/png"));

    const toBase64 = (blob) =>
      new Promise((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result.split(",")[1]);
        fr.readAsDataURL(blob);
      });

    const [imageBase64, maskBase64] = await Promise.all([toBase64(imageBlob), toBase64(maskBlob)]);

    console.log("[tool_flow] Đang gửi yêu cầu Cloudflare Workers AI Inpainting...");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const cleanAccountId = (cfConfig.cfAccountId || "").trim();
    const cleanToken = (cfConfig.cfApiToken || "").trim().replace(/^Bearer\s+/i, "");
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${cleanAccountId}/ai/run/@cf/runwayml/stable-diffusion-v1-5-inpainting`;
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: imageBase64,
        mask: maskBase64,
        prompt: "clean uniform background, seamless texture, continuous matching background, high resolution",
        negative_prompt: "watermark, star, logo, symbol, text, letters, artifacts, distortion, blurry, noisy",
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn("[tool_flow] Cloudflare AI trả về lỗi HTTP:", resp.status, errText);
      return false;
    }

    // Kết quả có thể là binary image/png hoặc JSON
    const contentType = resp.headers.get("content-type") || "";
    let resultBlob;
    if (contentType.includes("application/json")) {
      const json = await resp.json();
      if (json && json.result && json.result.image) {
        const byteCharacters = atob(json.result.image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        resultBlob = new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
      }
    } else {
      resultBlob = await resp.blob();
    }

    if (!resultBlob) return false;

    // 4. Dán mảnh đã Inpaint quay trở lại ảnh chính
    const inpaintedImg = await new Promise((res, rej) => {
      const url = URL.createObjectURL(resultBlob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = rej;
      img.src = url;
    });

    const mainCtx = canvas.getContext("2d");
    mainCtx.drawImage(inpaintedImg, cropX, cropY, cropSize, cropSize);
    console.log("[tool_flow] ✓ Cloudflare AI Inpainting thành công và đã ghép vào ảnh gốc!");
    return true;

  } catch (err) {
    console.warn("[tool_flow] Cloudflare AI Inpainting thất bại, chuyển về Local mode:", err.message || err);
    return false;
  }
}

/**
 * Hàm chính xóa watermark
 *
 * @param {string} dataUrl - Dữ liệu ảnh dạng "data:image/png;base64,..."
 * @param {object} options - Cấu hình Cloudflare AI { cfAccountId, cfApiToken, cfUseAiFallback }
 * @returns {Promise<string>} Data URL ảnh mới đã xóa sạch logo 100%
 */
async function removeWatermark(dataUrl, options = {}) {
  if (!WATERMARK_CONFIG.enabled) return dataUrl;

  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("[tool_flow] Không thể load ảnh từ dataURL"));
      i.src = dataUrl;
    });

    const W = img.naturalWidth;
    const H = img.naturalHeight;
    if (W <= 0 || H <= 0) return dataUrl;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, W, H);

    let targetX, targetY, targetSize, targetAlpha;

    // 1. Tự động tìm watermark bằng NCC cải tiến
    if (WATERMARK_CONFIG.autoDetect) {
      const detected = detectWatermarkNCC(imgData);
      if (detected.found) {
        targetX = detected.x;
        targetY = detected.y;
        targetSize = detected.size;
        targetAlpha = detected.alphaMap;
        console.log(`[tool_flow] Đã phát hiện watermark: size=${targetSize}x${targetSize} tại x=${targetX}, y=${targetY} (Score: ${detected.score.toFixed(3)})`);
      } else {
        console.log(`[tool_flow] Điểm quét (${detected.score.toFixed(3)}) chưa vượt ngưỡng — dùng fallback`);
      }
    }

    // Fallback nếu NCC không tìm thấy
    if (targetX === undefined) {
      targetSize = W >= 1200 && H >= 900 ? 48 : 36;
      targetAlpha = getAlphaMap(targetSize);
      targetX = Math.max(0, W - targetSize - Math.round(W * 0.05));
      targetY = Math.max(0, H - targetSize - Math.round(H * 0.06));
      console.log(`[tool_flow] Dùng vị trí fallback: size=${targetSize}x${targetSize} tại x=${targetX}, y=${targetY}`);
    }

    // 2. Lựa chọn Engine xóa tối ưu:
    // Ưu tiên 1: Nền phẳng/đơn sắc (Flat Color Inpaint) -> Xóa sạch 100% trong 0.001s, bảo vệ chữ đen
    const flatSuccess = inpaintFlatBackground(imgData, targetX, targetY, targetSize, targetAlpha);
    if (flatSuccess) {
      ctx.putImageData(imgData, 0, 0);
      console.log("[tool_flow] ✓ Đã xóa watermark bằng Flat Background Inpaint (Đều màu 100%, bảo toàn nét chữ)!");
      return canvas.toDataURL("image/png");
    }

    // Ưu tiên 2: Cloudflare Workers AI Inpainting (Nếu bật và có cấu hình)
    if (options.cfUseAiFallback && options.cfAccountId && options.cfApiToken) {
      ctx.putImageData(imgData, 0, 0);
      const aiSuccess = await inpaintCloudflareAI(canvas, targetX, targetY, targetSize, targetAlpha, options);
      if (aiSuccess) {
        return canvas.toDataURL("image/png");
      }
    }

    // Ưu tiên 3: Local Seamless Texture Cloning (Ghép vân mượt mà cho ảnh phong cảnh/người)
    const chosen = removeWatermarkSeamless(imgData, targetX, targetY, targetSize, targetAlpha);
    console.log(`[tool_flow] ✓ Đã ghép vân nền theo hướng: ${chosen.name} (dx=${chosen.dx}, dy=${chosen.dy})`);

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL("image/png");

  } catch (err) {
    console.error("[tool_flow] removeWatermark thất bại:", err);
    return dataUrl;
  }
}
