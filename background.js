// ============================================================
//  tool_flow — background service worker
//  Dùng chrome.debugger để GÕ CHỮ THẬT vào ô prompt (Slate),
//  Slate chỉ nhận sự kiện thật nên phải đi đường này.
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((e) => console.warn("[tool_flow] setPanelBehavior:", e));
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let attachedTab = null;

// Nếu người dùng bấm Hủy thanh vàng -> debugger tự tách -> reset trạng thái
chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId === attachedTab) {
    console.warn("[tool_flow] debugger bị tách khỏi tab", source.tabId);
    attachedTab = null;
  }
});

function sendCmd(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res);
    });
  });
}

async function ensureAttached(tabId) {
  if (attachedTab === tabId) return;
  if (attachedTab !== null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTab });
    } catch (_) {}
    attachedTab = null;
  }
  await new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, "1.3", () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  attachedTab = tabId;
}

async function detach() {
  if (attachedTab !== null) {
    try {
      await chrome.debugger.detach({ tabId: attachedTab });
    } catch (_) {}
    attachedTab = null;
  }
}

// Gõ prompt + Enter bằng input THẬT qua CDP
async function debugTypeAndSubmit(tabId, x, y, prompt) {
  await ensureAttached(tabId);

  // 1) click vào ô để đặt con trỏ (focus thật)
  await sendCmd(tabId, "Input.dispatchMouseEvent", {
    type: "mousePressed", x, y, button: "left", clickCount: 1,
  });
  await sendCmd(tabId, "Input.dispatchMouseEvent", {
    type: "mouseReleased", x, y, button: "left", clickCount: 1,
  });
  await wait(180);

  // 2) chọn hết (Ctrl+A) để xoá nội dung cũ nếu có
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyDown", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65,
  });
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65,
  });
  await wait(60);

  // 3) GÕ CHỮ THẬT — Slate nhận chuẩn 100%
  await sendCmd(tabId, "Input.insertText", { text: prompt });
  await wait(250);

  // 4) Enter để gửi (key thật)
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "rawKeyDown", key: "Enter", code: "Enter",
    windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
  });
  await sendCmd(tabId, "Input.dispatchKeyEvent", {
    type: "keyUp", key: "Enter", code: "Enter",
    windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13,
  });
}

// Quản lý tên file download do extension yêu cầu (đảm bảo tạo folder con và không bị đổi tên thành 'tải xuống')
const pendingDownloads = new Map(); // url -> filename

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  if (msg.type === "REGISTER_DOWNLOAD") {
    if (msg.url && msg.filename) {
      pendingDownloads.set(msg.url, msg.filename);
      // Tự dọn sau 60 giây nếu không dùng
      setTimeout(() => pendingDownloads.delete(msg.url), 60000);
    }
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "DEBUG_SUBMIT") {
    debugTypeAndSubmit(msg.tabId, msg.x, msg.y, msg.prompt)
      .then(() => sendResponse({ ok: true }))
      .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }

  if (msg.type === "DEBUG_DETACH") {
    detach().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Bắt sự kiện xác định tên file tải về để ép Chrome tạo folder con và đặt tên chuẩn xác
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  let targetName = null;
  if (pendingDownloads.has(item.url)) {
    targetName = pendingDownloads.get(item.url);
    pendingDownloads.delete(item.url);
  }
  if (targetName) {
    console.log("[tool_flow] onDeterminingFilename áp dụng tên:", targetName);
    suggest({
      filename: targetName,
      conflictAction: "uniquify",
    });
  } else {
    suggest();
  }
});

