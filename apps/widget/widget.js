(function () {
  if (window.__voiceChatWidgetLoaded) return;
  window.__voiceChatWidgetLoaded = true;

  var script = document.currentScript;
  var agentKey = script && script.getAttribute("data-agent-key");
  var apiBase =
    (script && script.getAttribute("data-api-url")) ||
    (script && script.src ? script.src.replace(/\/widget\.js(?:\?.*)?$/, "") : "");

  if (!agentKey) {
    console.warn("[voice-chat] missing data-agent-key");
    return;
  }

  var css = document.createElement("style");
  css.textContent =
    "#vc-root{position:relative;z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:1.4;color:#111827;-webkit-font-smoothing:antialiased}" +
    "#vc-root *,#vc-root *::before,#vc-root *::after{box-sizing:border-box}" +
    "#vc-launcher{position:fixed;right:20px;bottom:20px;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:10px;pointer-events:none}" +
    "#vc-idle{display:none;pointer-events:auto;position:relative;width:160px;height:160px;border:0;padding:0;background:transparent;cursor:pointer;overflow:visible;border-radius:0;box-shadow:none;transform:translateZ(0);-webkit-transform:translateZ(0);contain:layout paint}" +
    "#vc-idle canvas{display:block;width:100%;height:100%;background:transparent;pointer-events:none;mix-blend-mode:screen;filter:drop-shadow(0 8px 16px rgba(15,23,42,.2));transform:translateZ(0)}" +
    "#vc-idle img{display:none}" +
    "#vc-launcher.mode-floating #vc-idle{display:block}" +
    "#vc-launcher.mode-floating:not(.live){align-items:center;gap:0}" +
    "#vc-launcher.mode-floating:not(.live) #vc-btn{display:none!important}" +
    "#vc-launcher.mode-floating:not(.live) #vc-launcher-row{justify-content:center;width:100%;margin-top:-28px}" +
    "#vc-launcher.mode-floating:not(.live) #vc-hint{margin:0 auto}" +
    "#vc-launcher.mode-floating:not(.live) #vc-hint::after{right:auto;left:50%;top:-5px;bottom:auto;transform:translateX(-50%) rotate(45deg);border-right:0;border-bottom:0;border-left:1px solid rgba(15,23,42,.08);border-top:1px solid rgba(15,23,42,.08)}" +
    "#vc-launcher.live #vc-idle{display:none}" +
    "#vc-launcher-row{display:flex;align-items:center;gap:12px;pointer-events:none}" +
    "#vc-hint{pointer-events:none;display:inline-flex;align-items:center;gap:8px;background:#fff;color:#111827;font-size:13px;font-weight:600;letter-spacing:.01em;white-space:nowrap;padding:10px 14px;border-radius:12px;border:1px solid rgba(15,23,42,.08);box-shadow:0 8px 24px rgba(15,23,42,.12);opacity:1;transform:translateX(0);transition:opacity .2s ease,transform .2s ease;position:relative}" +
    "#vc-hint svg{display:block;width:16px;height:16px;flex-shrink:0;color:var(--vc-accent,#2563eb)}" +
    "#vc-hint::after{content:'';position:absolute;right:-5px;top:50%;width:10px;height:10px;background:#fff;border-right:1px solid rgba(15,23,42,.08);border-bottom:1px solid rgba(15,23,42,.08);transform:translateY(-50%) rotate(-45deg)}" +
    "#vc-btn{pointer-events:auto;position:relative;width:60px;height:60px;border-radius:50%;border:0;padding:0;display:inline-flex;align-items:center;justify-content:center;background:#2563eb;color:#fff;cursor:pointer;box-shadow:0 10px 28px rgba(37,99,235,.35),0 2px 6px rgba(15,23,42,.12);transition:transform .18s ease,box-shadow .18s ease,background .18s ease;-webkit-tap-highlight-color:transparent;overflow:hidden}" +
    "#vc-btn:hover{transform:translateY(-1px) scale(1.04)}" +
    "#vc-btn:active{transform:scale(.97)}" +
    "#vc-btn:focus-visible{outline:2px solid #93c5fd;outline-offset:3px}" +
    "#vc-btn svg{display:block;width:26px;height:26px}" +
    "#vc-btn .vc-icon-end{display:none}" +
    "#vc-btn .vc-avatar{display:none;width:100%;height:100%;object-fit:cover}" +
    "#vc-launcher.mode-avatar #vc-btn{background:#0f172a;box-shadow:0 10px 28px rgba(15,23,42,.28),0 0 0 3px var(--vc-accent,#2563eb)}" +
    "#vc-launcher.mode-avatar:not(.live) #vc-btn .vc-icon-mic{display:none}" +
    "#vc-launcher.mode-avatar:not(.live) #vc-btn .vc-avatar{display:block}" +
    "#vc-btn.live{display:none!important}" +
    "#vc-launcher.live #vc-hint{display:none}" +
    "#vc-launcher.live ~ #vc-character,#vc-root:has(#vc-launcher.live) #vc-character{bottom:8px;pointer-events:auto}" +
    "#vc-launcher.live ~ #vc-panel,#vc-root:has(#vc-launcher.live) #vc-panel{bottom:180px}" +
    "#vc-launcher.live ~ #vc-panel.no-character,#vc-root:has(#vc-launcher.live) #vc-panel.no-character{bottom:20px}" +
    "#vc-character{position:fixed;right:20px;bottom:96px;z-index:2147483000;width:200px;height:200px;display:none;pointer-events:none;overflow:visible}" +
    "#vc-launcher.mode-floating:not(.live) ~ #vc-character," +
    "#vc-root:has(#vc-launcher.mode-floating:not(.live)) #vc-character{bottom:200px}" +
    "#vc-character img.vc-char-frame{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;opacity:0;pointer-events:none}" +
    "#vc-character img.vc-char-frame.active{opacity:1}" +
    "#vc-powered{position:absolute;left:50%;bottom:32px;transform:translateX(-50%) translateY(6px);display:inline-flex;align-items:center;gap:6px;padding:5px 10px 5px 6px;border-radius:999px;background:rgba(255,255,255,.96);border:1px solid rgba(15,23,42,.1);box-shadow:0 6px 18px rgba(15,23,42,.14);text-decoration:none;color:#334155;font-size:11px;font-weight:600;letter-spacing:.02em;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .18s ease,transform .18s ease;z-index:2}" +
    "#vc-powered img{width:18px;height:18px;border-radius:50%;display:block;flex-shrink:0}" +
    "#vc-character:hover #vc-powered,#vc-character:focus-within #vc-powered{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0)}" +
    "#vc-powered:hover{color:#0f172a;border-color:rgba(99,102,241,.35)}" +
    "#vc-avatar-close{position:absolute;top:8px;right:8px;z-index:3;width:32px;height:32px;border:0;border-radius:50%;padding:0;display:inline-flex;align-items:center;justify-content:center;background:rgba(220,38,38,.92);color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.28);pointer-events:auto;opacity:0;transform:scale(.92);transition:opacity .15s ease,transform .15s ease}" +
    "#vc-avatar-close svg{display:block;width:15px;height:15px}" +
    "#vc-character.vc-call-active:hover #vc-avatar-close,#vc-character.vc-call-active:focus-within #vc-avatar-close{opacity:1;transform:scale(1)}" +
    "#vc-avatar-close:hover{background:#b91c1c}" +
    "#vc-panel{position:fixed;right:20px;bottom:300px;z-index:2147483000;width:280px;background:#111827;color:#f9fafb;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:inherit}" +
    "#vc-panel.no-character{bottom:96px}" +
    "#vc-launcher.mode-floating:not(.live) ~ #vc-panel.no-character{bottom:200px}" +
    "#vc-panel-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px}" +
    "#vc-panel h3{margin:0;font-size:16px;font-weight:600;color:#f9fafb;flex:1;min-width:0}" +
    "#vc-panel p{margin:0 0 12px;font-size:13px;line-height:1.4;color:#d1d5db}" +
    "#vc-status{font-size:12px;color:#93c5fd;margin-bottom:10px}" +
    "#vc-error{font-size:12px;color:#fca5a5;margin-bottom:8px}" +
    "#vc-transcript{display:none;max-height:120px;overflow-y:auto;margin:0 0 12px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.06);font-size:12px;line-height:1.45;color:#e5e7eb}" +
    "#vc-transcript.show{display:block}" +
    "#vc-transcript .vc-line{margin:0 0 6px}" +
    "#vc-transcript .vc-line:last-child{margin-bottom:0}" +
    "#vc-transcript .vc-role{font-weight:600;color:#93c5fd;margin-right:4px}" +
    "#vc-transcript .vc-role.assistant{color:#a7f3d0}" +
    "#vc-close{flex-shrink:0;width:28px;height:28px;border:0;border-radius:8px;padding:0;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);color:#f9fafb;cursor:pointer}" +
    "#vc-close:hover{background:rgba(255,255,255,.16)}" +
    "#vc-close svg{display:block;width:14px;height:14px}" +
    "@media (max-width:420px){#vc-launcher{right:14px;bottom:14px}#vc-idle{width:132px;height:132px}#vc-btn{width:56px;height:56px}#vc-btn svg{width:24px;height:24px}#vc-hint{font-size:12px;padding:9px 12px}#vc-character{right:14px}#vc-powered{font-size:10px;padding:4px 8px 4px 5px}#vc-powered img{width:16px;height:16px}}";
  document.head.appendChild(css);

  var root = document.createElement("div");
  root.id = "vc-root";
  document.body.appendChild(root);

  var characterWrap = document.createElement("div");
  characterWrap.id = "vc-character";
  var characterImgA = document.createElement("img");
  var characterImgB = document.createElement("img");
  characterImgA.alt = "";
  characterImgB.alt = "";
  characterImgA.className = "vc-char-frame active";
  characterImgB.className = "vc-char-frame";
  characterImgA.decoding = "async";
  characterImgB.decoding = "async";
  characterWrap.appendChild(characterImgA);
  characterWrap.appendChild(characterImgB);
  var poweredLink = document.createElement("a");
  poweredLink.id = "vc-powered";
  poweredLink.href = "https://voiexa.com/";
  poweredLink.target = "_blank";
  poweredLink.rel = "noopener noreferrer";
  poweredLink.setAttribute("aria-label", "Powered by Voiexa");
  poweredLink.innerHTML =
    "<img alt='' width='18' height='18' decoding='async'/>" +
    "<span>Powered by Voiexa</span>";
  poweredLink.querySelector("img").src =
    apiBase.replace(/\/$/, "") + "/static/branding/voiexa-icon.png";
  characterWrap.appendChild(poweredLink);
  var avatarCloseBtn = document.createElement("button");
  avatarCloseBtn.id = "vc-avatar-close";
  avatarCloseBtn.type = "button";
  avatarCloseBtn.setAttribute("aria-label", "End call");
  avatarCloseBtn.innerHTML =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18'/></svg>";
  characterWrap.appendChild(avatarCloseBtn);
  root.appendChild(characterWrap);

  var launcher = document.createElement("div");
  launcher.id = "vc-launcher";
  launcher.className = "mode-mic";

  var idleBtn = document.createElement("button");
  idleBtn.id = "vc-idle";
  idleBtn.type = "button";
  idleBtn.setAttribute("aria-label", "Tap to talk with AI");
  var idleCanvas = document.createElement("canvas");
  idleCanvas.width = 240;
  idleCanvas.height = 240;
  idleBtn.appendChild(idleCanvas);
  launcher.appendChild(idleBtn);

  var launcherRow = document.createElement("div");
  launcherRow.id = "vc-launcher-row";

  var hint = document.createElement("div");
  hint.id = "vc-hint";
  launcherRow.appendChild(hint);

  function setHintLabel(label) {
    var text = label || "Tap to talk with AI";
    hint.innerHTML =
      "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
      "<rect x='9' y='2' width='6' height='11' rx='3'/>" +
      "<path d='M5 10v1a7 7 0 0 0 14 0v-1'/>" +
      "<path d='M12 18v3'/>" +
      "<path d='M8 21h8'/>" +
      "</svg>" +
      "<span></span>";
    hint.querySelector("span").textContent = text;
  }
  setHintLabel("Tap to talk with AI");

  var btn = document.createElement("button");
  btn.id = "vc-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Tap to talk with AI");
  btn.innerHTML =
    "<img class='vc-avatar' alt='' decoding='async'/>" +
    "<svg class='vc-icon-mic' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" +
    "<rect x='9' y='2' width='6' height='11' rx='3'/>" +
    "<path d='M5 10v1a7 7 0 0 0 14 0v-1'/>" +
    "<path d='M12 18v3'/>" +
    "<path d='M8 21h8'/>" +
    "</svg>" +
    "<svg class='vc-icon-end' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.2' stroke-linecap='round' aria-hidden='true'>" +
    "<path d='M6 6l12 12'/>" +
    "<path d='M18 6L6 18'/>" +
    "</svg>";
  launcherRow.appendChild(btn);
  launcher.appendChild(launcherRow);
  root.appendChild(launcher);

  var avatarImg = btn.querySelector(".vc-avatar");
  var launcherMode = "mic";
  var launcherLabel = "Tap to talk with AI";
  var launcherColor = "#2563eb";
  var launcherSize = 160;
  var characterSize = 200;
  var panelWidth = 280;
  var showTranscription = false;
  var idleFrames = [];
  var idleImages = [];
  var idleFrameIndex = 0;
  var idleRafId = null;
  var idleAccMs = 0;
  var idleLastNow = 0;
  var idleReady = false;
  var idleLoadToken = 0;
  var IDLE_FPS = 10;
  var IDLE_FRAME_MS = 1000 / IDLE_FPS;
  var IDLE_MAX_FRAMES = 70;
  var idleCtx = idleCanvas.getContext("2d", { alpha: true });

  function clampInt(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) n = fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function applyCharacterSize(sizePx) {
    characterSize = clampInt(sizePx, 120, 400, 200);
    characterWrap.style.width = characterSize + "px";
    characterWrap.style.height = characterSize + "px";
    updateLayoutOffsets();
  }

  function applyPanelWidth(widthPx) {
    panelWidth = clampInt(widthPx, 220, 420, 280);
    panel.style.width = panelWidth + "px";
  }

  function applyTranscriptionVisibility() {
    if (showTranscription) transcriptEl.classList.add("show");
    else transcriptEl.classList.remove("show");
  }

  function clearTranscript() {
    transcriptEl.innerHTML = "";
    transcriptSegMap = {};
  }

  var transcriptSegMap = {};

  function roleFromParticipant(participant) {
    var identity =
      (participant && (participant.identity || participant)) || "";
    identity = String(identity).toLowerCase();
    if (
      identity.indexOf("visitor") === 0 ||
      identity.indexOf("user") === 0 ||
      identity.indexOf("guest") === 0
    ) {
      return "user";
    }
    return "assistant";
  }

  function appendTranscript(role, text, segId) {
    if (!showTranscription || !text) return;
    var cleaned = String(text).trim();
    if (!cleaned) return;
    var line = null;
    if (segId && transcriptSegMap[segId]) {
      line = transcriptSegMap[segId];
      while (line.firstChild) line.removeChild(line.firstChild);
    } else {
      line = document.createElement("div");
      line.className = "vc-line";
      transcriptEl.appendChild(line);
      if (segId) transcriptSegMap[segId] = line;
    }
    var roleSpan = document.createElement("span");
    roleSpan.className = role === "assistant" ? "vc-role assistant" : "vc-role";
    roleSpan.textContent = (role === "assistant" ? "Assistant" : "You") + ":";
    line.appendChild(roleSpan);
    line.appendChild(document.createTextNode(" " + cleaned));
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function updateLayoutOffsets() {
    if (!panel || !characterWrap) return;
    var launcherBottom = 20;
    var fabH = 60;
    if (launcherMode === "avatar") {
      fabH = clampInt(launcherSize * 0.4, 48, 96, 60);
    }
    // Floating: idle avatar + label under it (no separate mic FAB).
    var hintH = 44;
    var idleStack =
      launcherMode === "floating" ? launcherSize + hintH - 18 : fabH;
    var charVisible =
      characterAnimator && characterAnimator.isVisible && characterAnimator.isVisible();
    var charBottom;

    if (launcher.classList.contains("live")) {
      idleBtn.style.marginBottom = "";
      charBottom = launcherBottom + 8;
      characterWrap.style.bottom = charBottom + "px";
      characterWrap.style.pointerEvents = charVisible ? "auto" : "none";
      panel.style.bottom = charVisible
        ? charBottom + characterSize - 52 + "px"
        : launcherBottom + fabH + 16 + "px";
    } else if (launcherMode === "floating") {
      idleBtn.style.marginBottom = "";
      characterWrap.style.pointerEvents = "none";
      characterWrap.style.bottom = launcherBottom + idleStack + 16 + "px";
      if (panel.classList.contains("no-character")) {
        panel.style.bottom = launcherBottom + idleStack + 16 + "px";
      } else {
        panel.style.bottom =
          launcherBottom + idleStack + 16 + characterSize + 16 + "px";
      }
    } else {
      idleBtn.style.marginBottom = "";
      characterWrap.style.pointerEvents = "none";
      characterWrap.style.bottom = launcherBottom + idleStack + 16 + "px";
      if (panel.classList.contains("no-character")) {
        panel.style.bottom = launcherBottom + idleStack + 16 + "px";
      } else {
        panel.style.bottom =
          launcherBottom + idleStack + 16 + characterSize + 16 + "px";
      }
    }
  }

  function frameUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    var base = apiBase.replace(/\/$/, "");
    var parts = path.split("/").filter(Boolean);
    return (
      base +
      "/" +
      parts
        .map(function (p) {
          return encodeURIComponent(p);
        })
        .join("/")
    );
  }

  function stopIdleLoop() {
    if (idleRafId) {
      cancelAnimationFrame(idleRafId);
      idleRafId = null;
    }
    idleAccMs = 0;
    idleLastNow = 0;
  }

  function drawIdleFrame(index) {
    if (!idleReady || !idleImages.length || !idleCtx) return;
    var img = idleImages[index % idleImages.length];
    if (!img || !img.complete || !img.naturalWidth) return;
    var size = idleCanvas.width;
    idleCtx.clearRect(0, 0, size, size);
    var iw = img.naturalWidth;
    var ih = img.naturalHeight;
    var scale = Math.min(size / iw, size / ih);
    var dw = Math.round(iw * scale);
    var dh = Math.round(ih * scale);
    // Snap to integer pixels — avoids subpixel "kapa kapi"
    var dx = Math.floor((size - dw) / 2);
    var dy = Math.floor((size - dh) / 2);
    idleCtx.drawImage(img, dx, dy, dw, dh);
  }

  function idleTick(now) {
    idleRafId = requestAnimationFrame(idleTick);
    if (!idleReady || idleImages.length < 2) return;
    if (!idleLastNow) {
      idleLastNow = now;
      return;
    }
    idleAccMs += now - idleLastNow;
    idleLastNow = now;
    var advanced = false;
    while (idleAccMs >= IDLE_FRAME_MS) {
      idleAccMs -= IDLE_FRAME_MS;
      idleFrameIndex = (idleFrameIndex + 1) % idleImages.length;
      advanced = true;
    }
    if (advanced) drawIdleFrame(idleFrameIndex);
  }

  function loadIdleImage(url) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.decoding = "async";
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  }

  function startIdleLoop() {
    stopIdleLoop();
    idleReady = false;
    idleImages = [];
    idleFrameIndex = 0;
    idleAccMs = 0;
    idleLastNow = 0;

    var display = clampInt(launcherSize, 80, 320, 160);
    // Fixed internal resolution — no resize thrash while animating
    var pixel = 240;
    idleBtn.style.width = display + "px";
    idleBtn.style.height = display + "px";
    if (idleCanvas.width !== pixel || idleCanvas.height !== pixel) {
      idleCanvas.width = pixel;
      idleCanvas.height = pixel;
    }
    if (idleCtx) idleCtx.clearRect(0, 0, pixel, pixel);
    if (launcherMode !== "floating" || !idleFrames.length) return;

    var token = ++idleLoadToken;
    var urls = idleFrames
      .slice(0, IDLE_MAX_FRAMES)
      .map(frameUrl)
      .filter(Boolean);
    if (!urls.length) return;

    // First frame ASAP (no pixel processing — keeps page responsive)
    loadIdleImage(urls[0]).then(function (first) {
      if (token !== idleLoadToken || launcherMode !== "floating" || !first) return;
      idleImages = [first];
      idleReady = true;
      idleFrameIndex = 0;
      drawIdleFrame(0);
      if (urls.length < 2) return;

      var i = 1;
      function loadNext() {
        if (token !== idleLoadToken || launcherMode !== "floating") return;
        loadIdleImage(urls[i]).then(function (img) {
          if (token !== idleLoadToken || launcherMode !== "floating") return;
          if (img) idleImages.push(img);
          i += 1;
          if (idleImages.length > 1 && !idleRafId) {
            idleLastNow = 0;
            idleRafId = requestAnimationFrame(idleTick);
          }
          if (i < urls.length) {
            // One frame at a time — never flood the network/main thread
            setTimeout(loadNext, 40);
          }
        });
      }
      setTimeout(loadNext, 80);
    });
  }

  function applyLauncherLook() {
    launcher.classList.remove("mode-mic", "mode-avatar", "mode-floating");
    launcher.classList.add("mode-" + launcherMode);
    launcher.style.setProperty("--vc-accent", launcherColor);
    setHintLabel(launcherLabel);
    btn.setAttribute("aria-label", launcherLabel);
    idleBtn.setAttribute("aria-label", launcherLabel);

    if (launcherMode === "avatar") {
      var avatarBtn = clampInt(launcherSize * 0.4, 48, 96, 60);
      btn.style.width = avatarBtn + "px";
      btn.style.height = avatarBtn + "px";
      btn.style.background = "";
      btn.style.boxShadow = "";
    } else {
      btn.style.width = "60px";
      btn.style.height = "60px";
      btn.style.background = launcherColor;
      btn.style.boxShadow =
        "0 10px 28px " +
        launcherColor +
        "59,0 2px 6px rgba(15,23,42,.12)";
    }

    if (launcherMode === "floating") {
      idleBtn.style.width = launcherSize + "px";
      idleBtn.style.height = launcherSize + "px";
      startIdleLoop();
    } else {
      stopIdleLoop();
      idleBtn.style.width = "";
      idleBtn.style.height = "";
    }
    updateLayoutOffsets();
  }

  function setBtnLive(live) {
    if (live) {
      btn.classList.add("live");
      launcher.classList.add("live");
      characterWrap.classList.add("vc-call-active");
      btn.setAttribute("aria-label", "End call");
      setHintLabel("End call");
      stopIdleLoop();
      updateLayoutOffsets();
    } else {
      btn.classList.remove("live");
      launcher.classList.remove("live");
      characterWrap.classList.remove("vc-call-active");
      btn.setAttribute("aria-label", launcherLabel);
      setHintLabel(launcherLabel);
      applyLauncherLook();
    }
  }

  function loadBootstrap() {
    var url =
      apiBase.replace(/\/$/, "") +
      "/v1/widget/bootstrap?public_key=" +
      encodeURIComponent(agentKey);
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("bootstrap failed");
        return res.json();
      })
      .then(function (data) {
        launcherMode = data.launcher_mode || "mic";
        if (["mic", "avatar", "floating"].indexOf(launcherMode) === -1) {
          launcherMode = "mic";
        }
        launcherLabel = data.launcher_label || "Tap to talk with AI";
        launcherColor = data.launcher_color || "#2563eb";
        launcherSize = clampInt(data.launcher_size, 80, 320, 160);
        panelWidth = clampInt(data.panel_width, 220, 420, 280);
        showTranscription = Boolean(data.show_transcription);
        applyPanelWidth(panelWidth);
        applyTranscriptionVisibility();
        idleFrames = [];
        if (data.skin) {
          if (data.skin.avatar_url) {
            avatarImg.src = frameUrl(data.skin.avatar_url);
          }
          if (data.skin.idle_frames && data.skin.idle_frames.length) {
            idleFrames = data.skin.idle_frames;
          }
        }
        if ((launcherMode === "avatar" || launcherMode === "floating") && !data.skin) {
          launcherMode = "mic";
        }
        applyLauncherLook();
      })
      .catch(function () {
        applyLauncherLook();
      });
  }

  var panel = document.createElement("div");
  panel.id = "vc-panel";
  panel.className = "no-character";
  panel.style.display = "none";
  panel.innerHTML =
    "<div id='vc-panel-header'>" +
    "<h3>Voice assistant</h3>" +
    "<button id='vc-close' type='button' aria-label='End call'>" +
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' aria-hidden='true'><path d='M6 6l12 12M18 6L6 18'/></svg>" +
    "</button>" +
    "</div>" +
    "<div id='vc-status'>Idle</div>" +
    "<div id='vc-error'></div>" +
    "<div id='vc-transcript' aria-live='polite'></div>" +
    "<p>Allow the microphone, then speak. Ask questions in any language.</p>";
  root.appendChild(panel);

  var statusEl = panel.querySelector("#vc-status");
  var errorEl = panel.querySelector("#vc-error");
  var closeBtn = panel.querySelector("#vc-close");
  var transcriptEl = panel.querySelector("#vc-transcript");
  applyPanelWidth(panelWidth);
  applyTranscriptionVisibility();
  var room = null;
  var livekitReady = null;
  var characterConfig = null;
  var characterAnimator = null;
  var endingCall = false;
  var callLimitTimer = null;
  var lastAgentSpeakingAt = 0;
  var SPEAKING_HOLD_MS = 450;

  function setStatus(text) {
    statusEl.textContent = text;
  }
  function setError(text) {
    errorEl.textContent = text || "";
  }

  function createCharacterAnimator(config) {
    var state = "idle";
    var frameIndex = 0;
    var rafId = null;
    var onComplete = null;
    var visible = false;
    var pendingState = null;
    var pendingTimer = null;
    var front = characterImgA;
    var back = characterImgB;
    var currentUrl = "";
    var lastSwapAt = 0;
    var swapping = false;
    var cache = {};

    function framesFor(s) {
      if (!config || !config.states) return [];
      return config.states[s] || [];
    }

    function fpsFor(s) {
      return s === "speaking" ? 10 : 12;
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      swapping = false;
    }

    function loadImage(url) {
      if (cache[url] && cache[url].complete) return Promise.resolve(cache[url]);
      return new Promise(function (resolve) {
        var img = cache[url] || new Image();
        cache[url] = img;
        if (img.complete && img.src === url) {
          resolve(img);
          return;
        }
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          resolve(null);
        };
        img.src = url;
      });
    }

    function applyFrame(url) {
      front.src = url;
      front.className = "vc-char-frame active";
      back.className = "vc-char-frame";
      back.removeAttribute("src");
      currentUrl = url;
      lastSwapAt = performance.now();
    }

    function swapTo(url) {
      if (!url || url === currentUrl) return Promise.resolve(false);
      if (swapping) return Promise.resolve(false);
      swapping = true;
      return loadImage(url).then(function (img) {
        if (!img || state === "idle") {
          swapping = false;
          return false;
        }
        function reveal() {
          back.src = url;
          back.className = "vc-char-frame active";
          front.className = "vc-char-frame";
          var tmp = front;
          front = back;
          back = tmp;
          currentUrl = url;
          lastSwapAt = performance.now();
          swapping = false;
          return true;
        }
        if (img.decode) {
          return img.decode().then(reveal).catch(reveal);
        }
        return Promise.resolve(reveal());
      });
    }

    function prefetch(frames, start, count) {
      for (var i = start; i < Math.min(start + count, frames.length); i++) {
        loadImage(frameUrl(frames[i]));
      }
    }

    function show() {
      visible = true;
      characterWrap.style.display = "block";
      panel.classList.remove("no-character");
      updateLayoutOffsets();
    }

    function hide() {
      visible = false;
      stopLoop();
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
      pendingState = null;
      state = "idle";
      frameIndex = 0;
      currentUrl = "";
      characterWrap.style.display = "none";
      front.removeAttribute("src");
      back.removeAttribute("src");
      front.className = "vc-char-frame active";
      back.className = "vc-char-frame";
      panel.classList.add("no-character");
      updateLayoutOffsets();
    }

    function advanceAfterSwap() {
      var frames = framesFor(state);
      if (!frames.length) return;
      frameIndex += 1;
      if (frameIndex >= frames.length) {
        if (state === "welcome" || state === "bye") {
          stopLoop();
          var done = onComplete;
          onComplete = null;
          if (done) done();
          return;
        }
        frameIndex = 0;
      }
      prefetch(frames, frameIndex, 4);
    }

    function loop(now) {
      rafId = requestAnimationFrame(loop);
      if (swapping) return;
      var frames = framesFor(state);
      if (!frames.length) return;
      var interval = 1000 / fpsFor(state);
      if (now - lastSwapAt < interval) return;
      var url = frameUrl(frames[frameIndex]);
      if (url === currentUrl) {
        advanceAfterSwap();
        return;
      }
      swapTo(url).then(function (ok) {
        if (ok) advanceAfterSwap();
      });
    }

    function play(nextState, loopFlag, complete) {
      var frames = framesFor(nextState);
      if (!frames.length) {
        if (complete) complete();
        return;
      }
      stopLoop();
      state = nextState;
      frameIndex = 0;
      onComplete = complete || null;
      var firstUrl = frameUrl(frames[0]);
      prefetch(frames, 0, 10);
      loadImage(firstUrl).then(function (img) {
        if (!img || state !== nextState) {
          if (complete) complete();
          return;
        }
        applyFrame(firstUrl);
        frameIndex = 1;
        show();
        if (frames.length === 1) {
          if (state === "welcome" || state === "bye") {
            stopLoop();
            var done = onComplete;
            onComplete = null;
            if (done) done();
          }
          return;
        }
        rafId = requestAnimationFrame(loop);
      });
    }

    function softSwitchState(nextState) {
      if (state === nextState || state === "bye" || state === "welcome") return;
      var frames = framesFor(nextState);
      if (!frames.length) return;
      if (state === "idle") {
        play(nextState, true);
        return;
      }
      state = nextState;
      if (frameIndex >= frames.length) frameIndex = 0;
      prefetch(frames, frameIndex, 8);
      if (!rafId) {
        lastSwapAt = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    }

    function requestState(nextState) {
      if (state === "bye" || state === "welcome") return;
      if (state === nextState) {
        pendingState = null;
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingTimer = null;
        }
        return;
      }
      pendingState = nextState;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () {
        pendingTimer = null;
        var s = pendingState;
        pendingState = null;
        if (!s || state === s || state === "bye" || state === "welcome") return;
        softSwitchState(s);
      }, 500);
    }

    return {
      welcomeThenListen: function () {
        play("welcome", false, function () {
          play("listening", true);
        });
      },
      setListening: function () {
        requestState("listening");
      },
      setSpeaking: function () {
        requestState("speaking");
      },
      playBye: function (complete) {
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          pendingTimer = null;
        }
        pendingState = null;
        stopLoop();
        play("bye", false, function () {
          hide();
          if (complete) complete();
        });
      },
      hide: hide,
      isVisible: function () {
        return visible;
      },
    };
  }

  function loadLivekit() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    if (livekitReady) return livekitReady;
    livekitReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://unpkg.com/livekit-client@2.11.4/dist/livekit-client.umd.js";
      s.onload = function () {
        resolve(window.LivekitClient);
      };
      s.onerror = function () {
        reject(new Error("Could not load LiveKit client"));
      };
      document.head.appendChild(s);
    });
    return livekitReady;
  }

  function attachSpeakerHandlers(LK, activeRoom) {
    if (!characterAnimator) return;
    activeRoom.on(LK.RoomEvent.ActiveSpeakersChanged, function (speakers) {
      if (!characterAnimator || endingCall) return;
      var localId = activeRoom.localParticipant.identity;
      var agentSpeaking = false;
      for (var i = 0; i < speakers.length; i++) {
        if (speakers[i].identity !== localId) {
          agentSpeaking = true;
          break;
        }
      }
      if (agentSpeaking) {
        lastAgentSpeakingAt = Date.now();
        characterAnimator.setSpeaking();
        setStatus("Agent speaking…");
      } else if (Date.now() - lastAgentSpeakingAt >= SPEAKING_HOLD_MS) {
        characterAnimator.setListening();
        setStatus("Listening — speak now");
      }
    });
  }

  function buildNavigateUrl(path) {
    if (!path) return null;
    path = String(path).trim();
    var lower = path.toLowerCase();
    if (
      lower.indexOf("javascript:") === 0 ||
      lower.indexOf("data:") === 0 ||
      lower.indexOf("vbscript:") === 0 ||
      lower.indexOf("file:") === 0
    ) {
      return null;
    }
    if (/^https?:\/\//i.test(path)) return path;
    if (path.charAt(0) === "/") return window.location.origin + path;
    return null;
  }

  function isSameOriginUrl(url) {
    try {
      var u = new URL(url, window.location.href);
      return u.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function scrollToHash(url) {
    try {
      var u = new URL(url, window.location.href);
      var id = (u.hash || "").replace(/^#/, "");
      if (!id) return false;
      var el = document.getElementById(id);
      if (!el || typeof el.scrollIntoView !== "function") return false;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return true;
    } catch (e) {
      return false;
    }
  }

  function scheduleScrollToHash(url) {
    requestAnimationFrame(function () {
      setTimeout(function () {
        scrollToHash(url);
      }, 0);
    });
  }

  function sameDocumentUrl(url) {
    try {
      var next = new URL(url, window.location.href);
      return (
        next.origin === window.location.origin &&
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      );
    } catch (e) {
      return false;
    }
  }

  function preservedBodyNodes() {
    var keep = [];
    Array.prototype.forEach.call(document.body.childNodes, function (node) {
      if (node.nodeType !== 1) return;
      if (node.id === "vc-root") keep.push(node);
      else if (node.getAttribute && node.getAttribute("data-vc-audio")) keep.push(node);
    });
    return keep;
  }

  function shouldSkipIncomingNode(node) {
    if (node.nodeType !== 1) return false;
    if (node.id === "vc-root") return true;
    if (node.getAttribute && node.getAttribute("data-vc-audio")) return true;
    if (node.tagName === "SCRIPT") {
      var src = (node.getAttribute("src") || "").toLowerCase();
      // Never re-run the widget; call must stay on the existing LiveKit room.
      if (src.indexOf("widget.js") !== -1) return true;
    }
    return false;
  }

  function runPageScripts(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll("script"), function (oldScript) {
      var src = oldScript.getAttribute("src") || "";
      if (/widget\.js/i.test(src)) return;
      var s = document.createElement("script");
      if (src) {
        // Cache-bust local helpers like nav.js so active link updates.
        s.src = /^(https?:)?\/\//i.test(src) ? src : src.split("?")[0] + "?t=" + Date.now();
      } else {
        s.textContent = oldScript.textContent || "";
      }
      document.body.appendChild(s);
    });
  }

  async function softNavigate(url) {
    var absolute;
    try {
      absolute = new URL(url, window.location.href);
    } catch (e) {
      throw new Error("Invalid URL");
    }

    // Same page, only hash changed — scroll without swapping DOM (keeps call stable).
    if (sameDocumentUrl(absolute.href)) {
      history.pushState({ vcSoftNav: true }, document.title, absolute.href);
      scheduleScrollToHash(absolute.href);
      return;
    }

    var fetchUrl = absolute.origin + absolute.pathname + absolute.search;
    var res = await fetch(fetchUrl, { credentials: "same-origin", cache: "no-cache" });
    if (!res.ok) throw new Error("Could not load page (" + res.status + ")");
    var html = await res.text();
    var doc = new DOMParser().parseFromString(html, "text/html");
    var keep = preservedBodyNodes();

    if (doc.title) document.title = doc.title;

    // Swap stylesheets from the target page (same demo site).
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"]'), function (el) {
      el.remove();
    });
    Array.prototype.forEach.call(doc.querySelectorAll('link[rel="stylesheet"]'), function (link) {
      var href = link.getAttribute("href");
      if (!href) return;
      var l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      document.head.appendChild(l);
    });

    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }

    Array.prototype.forEach.call(doc.body.childNodes, function (node) {
      if (shouldSkipIncomingNode(node)) return;
      if (node.nodeType === 1 && node.tagName === "SCRIPT") return;
      document.body.appendChild(document.importNode(node, true));
    });

    keep.forEach(function (node) {
      document.body.appendChild(node);
    });

    runPageScripts(doc);
    history.pushState({ vcSoftNav: true }, document.title, absolute.href);
    scheduleScrollToHash(absolute.href);
  }

  var navigateInFlight = false;

  function handleNavigateMessage(msg) {
    if (!msg || msg.type !== "navigate") return;
    var url = buildNavigateUrl(msg.path || msg.url || "");
    if (!url) {
      setError("Navigation blocked: invalid page path");
      return;
    }
    if (navigateInFlight) return;
    navigateInFlight = true;
    setStatus("Opening page…");
    setTimeout(function () {
      var go = isSameOriginUrl(url)
        ? softNavigate(url)
        : Promise.reject(new Error("cross-origin"));
      Promise.resolve(go)
        .then(function () {
          setStatus("Listening — speak now");
          setError("");
        })
        .catch(function () {
          // Cross-origin or soft-nav failure: full reload (call will end).
          try {
            window.location.assign(url);
          } catch (e) {
            setError("Could not open page");
          }
        })
        .finally(function () {
          navigateInFlight = false;
        });
    }, 900);
  }

  // Keep the voice call alive when the user clicks in-site links during a call.
  document.addEventListener(
    "click",
    function (ev) {
      if (!room || endingCall) return;
      var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.indexOf("mailto:") === 0 || href.indexOf("tel:") === 0) {
        return;
      }
      if (a.target && a.target !== "" && a.target !== "_self") return;
      var url;
      try {
        url = new URL(href, window.location.href).href;
      } catch (e) {
        return;
      }
      if (!isSameOriginUrl(url)) return;
      // Hash-only or same-origin links: soft navigate (keeps call; scrolls to section).
      ev.preventDefault();
      if (navigateInFlight) return;
      navigateInFlight = true;
      setStatus("Opening page…");
      softNavigate(url)
        .then(function () {
          setStatus("Listening — speak now");
        })
        .catch(function () {
          window.location.assign(url);
        })
        .finally(function () {
          navigateInFlight = false;
        });
    },
    true,
  );

  window.addEventListener("popstate", function () {
    if (!room || endingCall) return;
    if (navigateInFlight) return;
    navigateInFlight = true;
    softNavigate(window.location.href)
      .catch(function () {})
      .finally(function () {
        navigateInFlight = false;
        setStatus("Listening — speak now");
      });
  });

  function attachNavigateHandler(LK, activeRoom) {
    activeRoom.on(LK.RoomEvent.DataReceived, function (payload) {
      try {
        var text =
          typeof payload === "string"
            ? payload
            : payload instanceof Uint8Array
              ? new TextDecoder().decode(payload)
              : payload && payload.byteLength != null
                ? new TextDecoder().decode(new Uint8Array(payload))
                : "";
        if (!text) return;
        var msg = JSON.parse(text);
        if (msg && msg.type === "transcript") {
          var role = msg.role === "assistant" ? "assistant" : "user";
          appendTranscript(role, msg.text || "");
          return;
        }
        handleNavigateMessage(msg);
      } catch (e) {}
    });

    // LiveKit Agents publish captions on the lk.transcription text stream.
    if (typeof activeRoom.registerTextStreamHandler === "function") {
      try {
        activeRoom.registerTextStreamHandler("lk.transcription", function (reader, participantInfo) {
          Promise.resolve()
            .then(function () {
              return reader.readAll();
            })
            .then(function (message) {
              if (!showTranscription || !message) return;
              var attrs = (reader.info && reader.info.attributes) || {};
              if (attrs["lk.transcription_final"] === "false") return;
              var segId = attrs["lk.segment_id"] || (reader.info && reader.info.id) || "";
              appendTranscript(roleFromParticipant(participantInfo), message, segId);
            })
            .catch(function () {});
        });
      } catch (e) {}
    }

    // Legacy path (pre text-stream clients / older agent SDKs).
    if (LK.RoomEvent.TranscriptionReceived) {
      activeRoom.on(LK.RoomEvent.TranscriptionReceived, function (segments, participant) {
        if (!showTranscription || !segments || !segments.length) return;
        for (var i = 0; i < segments.length; i++) {
          var seg = segments[i];
          if (!seg || seg.final === false) continue;
          appendTranscript(
            roleFromParticipant(participant),
            seg.text || "",
            seg.id || "",
          );
        }
      });
    }
  }

  function cleanupAudio() {
    document.querySelectorAll("[data-vc-audio]").forEach(function (el) {
      el.remove();
    });
  }

  function clearCallLimitTimer() {
    if (callLimitTimer) {
      clearTimeout(callLimitTimer);
      callLimitTimer = null;
    }
  }

  function resetUi() {
    room = null;
    endingCall = false;
    clearCallLimitTimer();
    cleanupAudio();
    setBtnLive(false);
    if (characterAnimator) characterAnimator.hide();
    clearTranscript();
    panel.style.display = "none";
  }

  async function startCall() {
    setError("");
    clearTranscript();
    panel.style.display = "block";
    setStatus("Connecting…");
    characterConfig = null;
    characterAnimator = null;
    endingCall = false;
    try {
      var res = await fetch(apiBase + "/v1/widget/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_key: agentKey,
          origin: window.location.origin,
        }),
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Session failed");
      applyPanelWidth(data.panel_width || panelWidth);
      showTranscription = Boolean(data.show_transcription);
      applyTranscriptionVisibility();
      if (data.character && data.character.enabled) {
        characterConfig = data.character;
        applyCharacterSize(data.character_size || 200);
        characterAnimator = createCharacterAnimator(characterConfig);
      } else {
        applyCharacterSize(data.character_size || characterSize);
      }
      if (!data.voice_enabled) {
        setStatus("Voice offline");
        setError(data.message || "LiveKit is not configured on the server.");
        return;
      }
      var LK = await loadLivekit();
      room = new LK.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      room.on(LK.RoomEvent.TrackSubscribed, function (track) {
        if (track.kind === "audio") {
          var el = track.attach();
          el.setAttribute("data-vc-audio", "1");
          el.autoplay = true;
          el.playsInline = true;
          document.body.appendChild(el);
          var playPromise = el.play && el.play();
          if (playPromise && playPromise.catch) playPromise.catch(function () {});
        }
      });
      room.on(LK.RoomEvent.Disconnected, function () {
        if (characterAnimator && characterAnimator.isVisible() && !endingCall) {
          endingCall = true;
          characterAnimator.playBye(function () {
            resetUi();
            setStatus("Call ended");
          });
        } else {
          resetUi();
          setStatus("Call ended");
        }
      });
      attachSpeakerHandlers(LK, room);
      attachNavigateHandler(LK, room);
      await room.connect(data.livekit_url, data.token);
      if (room.startAudio) {
        try {
          await room.startAudio();
        } catch (e) {}
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      setBtnLive(true);
      if (characterAnimator) {
        characterAnimator.welcomeThenListen();
      }
      var limitMins = Math.max(1, Math.min(120, Number(data.max_call_minutes) || 10));
      clearCallLimitTimer();
      callLimitTimer = setTimeout(function () {
        setStatus("Time limit reached");
        endCall();
      }, limitMins * 60 * 1000);
      setStatus("Listening — speak now (max " + limitMins + " min)");
    } catch (err) {
      setStatus("Error");
      setError(err.message || String(err));
    }
  }

  async function endCall() {
    if (endingCall) return;
    endingCall = true;
    clearCallLimitTimer();
    var activeRoom = room;
    room = null;

    if (characterAnimator) {
      try {
        characterAnimator.hide();
      } catch (e) {}
    }
    if (activeRoom) {
      try {
        await activeRoom.disconnect();
      } catch (e) {}
    }
    cleanupAudio();
    setBtnLive(false);
    clearTranscript();
    panel.style.display = "none";
    setStatus("Idle");
    endingCall = false;
  }

  function toggleCall() {
    if (room || endingCall) endCall();
    else startCall();
  }

  btn.addEventListener("click", toggleCall);
  idleBtn.addEventListener("click", toggleCall);
  closeBtn.addEventListener("click", endCall);
  avatarCloseBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    endCall();
  });
  loadBootstrap();
})();
