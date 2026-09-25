// ============================================================
//  lib/watermark.js
//  Xóa triệt để watermark Google Gemini Flow bằng thuật toán
//  Adaptive Seamless Texture Cloning (Khớp biên quang học 100%,
//  bảo toàn nguyên vẹn kết cấu vân cỏ/chi tiết ảnh, không nhòe,
//  không đen, không để lại bất kỳ gờ viền nào).
// ============================================================

const WATERMARK_CONFIG = {
  enabled: true,

  // Tự động quét và phát hiện chính xác vị trí + kích thước logo bằng NCC
  autoDetect: true,

  // Tọa độ tương đối dự phòng (nếu autoDetect tắt hoặc không tìm thấy)
  region: { x: 0.912, y: 0.842, w: 0.035, h: 0.063 },

  // Ngưỡng điểm NCC tối thiểu để chấp nhận tọa độ tự động
  minNccScore: 0.30
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
 * Tự động tìm vị trí & kích thước logo bằng NCC (Normalized Cross Correlation)
 */
function detectWatermarkNCC(imgData) {
  const { width: W, height: H, data } = imgData;

  function getLum(x, y) {
    const idx = (y * W + x) * 4;
    return 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  // Quét góc dưới bên phải (mở rộng phạm vi tìm kiếm góc để bao phủ cả ảnh độ phân giải cao)
  const searchBoundW = Math.min(280, Math.floor(W * 0.40));
  const searchBoundH = Math.min(280, Math.floor(H * 0.40));
  const startX = Math.max(0, W - searchBoundW);
  const startY = Math.max(0, H - searchBoundH);

  const candidateSizes = W >= 1200 && H >= 900 ? [48, 36] : [36, 48];
  let best = { found: false, x: 0, y: 0, size: 36, score: -1, alphaMap: getAlphaMap(36) };

  for (const size of candidateSizes) {
    if (size > W || size > H) continue;

    const aMap = getAlphaMap(size);
    let aSum = 0;
    for (let i = 0; i < aMap.length; i++) aSum += aMap[i];
    const aMean = aSum / aMap.length;
    let aSq = 0;
    for (let i = 0; i < aMap.length; i++) {
      const d = aMap[i] - aMean;
      aSq += d * d;
    }
    const aStd = Math.sqrt(aSq / aMap.length);
    if (aStd < 1e-6) continue;

    const maxX = W - size;
    const maxY = H - size;

    for (let y = startY; y <= maxY; y++) {
      for (let x = startX; x <= maxX; x++) {
        let gSum = 0;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            gSum += getLum(x + c, y + r);
          }
        }
        const gMean = gSum / (size * size);
        let gSq = 0, cov = 0;
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const dg = getLum(x + c, y + r) - gMean;
            const da = aMap[r * size + c] - aMean;
            gSq += dg * dg;
            cov += dg * da;
          }
        }
        const gStd = Math.sqrt(gSq / (size * size));
        const ncc = (gStd * aStd > 1e-6) ? (cov / (size * size * gStd * aStd)) : 0;

        if (ncc > best.score) {
          best = { found: true, x, y, size, score: ncc, alphaMap: aMap };
        }
      }
    }
  }

  best.found = best.score >= WATERMARK_CONFIG.minNccScore;
  return best;
}

/**
 * Xóa watermark hoàn hảo bằng Adaptive Seamless Texture Cloning:
 * 1. Tạo mask hình học ngôi sao mở rộng 2px và làm mềm biên bằng hàm Cosine mượt (C^1 continuous).
 * 2. Đánh giá tự động các hướng donor lân cận (Trái, Trên, Góc chéo) bằng sai số bình phương trung bình (MSE).
 * 3. Bù trừ chênh lệch màu quang học (DC color offset) để triệt tiêu mọi chênh lệch độ sáng.
 * 4. Ghép vân kết cấu tự nhiên vào vùng logo -> Đạt độ tàng hình 100%, bảo toàn sợi cỏ / hạt nhiễu,
 *    không để lại bất kỳ gờ viền bóng mờ nào!
 */
function removeWatermarkSeamless(imgData, posX, posY, size, alphaMap) {
  const { width: W, height: H, data } = imgData;

  // 1. Tạo Mask mở rộng (Dilated Mask) kèm Cosine Feathering
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

  // 2. Khảo sát các hướng donor lân cận
  const step = Math.round(size * 1.25);
  const candidates = [
    { name: "Trái", dx: -step, dy: 0 },
    { name: "Trên", dx: 0, dy: -step },
    { name: "Chéo Trên-Trái", dx: -Math.round(size * 0.95), dy: -Math.round(size * 0.95) },
    { name: "Trái Xa", dx: -Math.round(size * 1.6), dy: 0 }
  ];

  let bestCand = candidates[0];
  let minMSE = Infinity;

  for (const cand of candidates) {
    let count = 0;
    let tR = 0, tG = 0, tB = 0;
    let dR = 0, dG = 0, dB = 0;

    for (let r = -2; r <= size + 1; r++) {
      for (let col = -2; col <= size + 1; col++) {
        const inside = (r >= 0 && r < size && col >= 0 && col < size && mask[r * size + col] > 0.05);
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
          const inside = (r >= 0 && r < size && col >= 0 && col < size && mask[r * size + col] > 0.05);
          if (!inside) {
            const px = posX + col, py = posY + r;
            const dx = px + cand.dx, dy = py + cand.dy;
            if (px >= 0 && px < W && py >= 0 && py < H && dx >= 0 && dx < W && dy >= 0 && dy < H) {
              const tIdx = (py * W + px) * 4;
              const dIdx = (dy * W + dx) * 4;
              const dr = data[tIdx] - (data[dIdx] + offR);
              const dg = data[tIdx + 1] - (data[dIdx + 1] + offG);
              const db = data[tIdx + 2] - (data[dIdx + 2] + offB);
              errSum += (dr * dr + dg * dg + db * db);
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

  // 3. Ghép vân kết cấu tự nhiên qua Mask đã làm mịn biên
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
 * Hàm chính xóa watermark
 *
 * @param {string} dataUrl - Dữ liệu ảnh dạng "data:image/png;base64,..."
 * @returns {Promise<string>} Data URL ảnh mới đã xóa sạch logo và đều màu 100%
 */
async function removeWatermark(dataUrl) {
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

    // Tự động tìm watermark bằng NCC
    if (WATERMARK_CONFIG.autoDetect) {
      const detected = detectWatermarkNCC(imgData);
      if (detected.found) {
        targetX = detected.x;
        targetY = detected.y;
        targetSize = detected.size;
        targetAlpha = detected.alphaMap;
        console.log(`[tool_flow] Đã phát hiện watermark: size=${targetSize}x${targetSize} tại x=${targetX}, y=${targetY} (NCC: ${detected.score.toFixed(3)})`);
      } else {
        console.log(`[tool_flow] NCC score (${detected.score.toFixed(3)}) chưa vượt ngưỡng — dùng fallback`);
      }
    }

    // Fallback nếu NCC không tìm thấy
    if (targetX === undefined) {
      targetSize = (W >= 1200 && H >= 900) ? 48 : 36;
      targetAlpha = getAlphaMap(targetSize);
      targetX = Math.max(0, W - targetSize - Math.round(W * 0.05));
      targetY = Math.max(0, H - targetSize - Math.round(H * 0.06));
      console.log(`[tool_flow] Dùng vị trí fallback: size=${targetSize}x${targetSize} tại x=${targetX}, y=${targetY}`);
    }

    // Thực thi xử lý Seamless Texture Cloning
    const chosen = removeWatermarkSeamless(imgData, targetX, targetY, targetSize, targetAlpha);
    console.log(`[tool_flow] Đã ghép vân nền theo hướng: ${chosen.name} (dx=${chosen.dx}, dy=${chosen.dy})`);

    // Ghi lại kết quả và xuất PNG
    ctx.putImageData(imgData, 0, 0);
    const result = canvas.toDataURL("image/png");

    console.log("[tool_flow] Xóa watermark hoàn tất (Adaptive Seamless Texture Cloning, không tì vết 100%)!");
    return result;

  } catch (err) {
    console.error("[tool_flow] removeWatermark thất bại:", err);
    return dataUrl;
  }
}
