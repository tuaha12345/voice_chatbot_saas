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
    "#vc-root{all:initial;font-family:system-ui,-apple-system,sans-serif}" +
    "#vc-btn{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;background:#4f6ef7;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(79,110,247,.45)}" +
    "#vc-btn.live{background:#e5484d}" +
    "#vc-character{position:fixed;right:20px;bottom:92px;z-index:2147483000;width:200px;height:200px;display:none;pointer-events:none;overflow:hidden}" +
    "#vc-character img{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;opacity:0}" +
    "#vc-character img.active{opacity:1}" +
    "#vc-panel{position:fixed;right:20px;bottom:300px;z-index:2147483000;width:280px;background:#111827;color:#f9fafb;border-radius:16px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.35)}" +
    "#vc-panel.no-character{bottom:92px}" +
    "#vc-panel h3{margin:0 0 8px;font-size:16px}" +
    "#vc-panel p{margin:0 0 12px;font-size:13px;line-height:1.4;color:#d1d5db}" +
    "#vc-status{font-size:12px;color:#93c5fd;margin-bottom:10px}" +
    "#vc-error{font-size:12px;color:#fca5a5;margin-bottom:8px}" +
    "#vc-close{background:#374151;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;width:100%}";
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
  characterImgA.decoding = "async";
  characterImgB.decoding = "async";
  characterImgA.className = "active";
  characterWrap.appendChild(characterImgA);
  characterWrap.appendChild(characterImgB);
  root.appendChild(characterWrap);

  var btn = document.createElement("button");
  btn.id = "vc-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Voice chat");
  btn.textContent = "🎤";
  root.appendChild(btn);

  var panel = document.createElement("div");
  panel.id = "vc-panel";
  panel.className = "no-character";
  panel.style.display = "none";
  panel.innerHTML =
    "<h3>Voice assistant</h3>" +
    "<div id='vc-status'>Idle</div>" +
    "<div id='vc-error'></div>" +
    "<p>Allow the microphone, then speak. Ask questions from this site's FAQ.</p>" +
    "<button id='vc-close' type='button'>End call</button>";
  root.appendChild(panel);

  var statusEl = panel.querySelector("#vc-status");
  var errorEl = panel.querySelector("#vc-error");
  var closeBtn = panel.querySelector("#vc-close");
  var room = null;
  var livekitReady = null;
  var characterConfig = null;
  var characterAnimator = null;
  var endingCall = false;

  function setStatus(text) {
    statusEl.textContent = text;
  }
  function setError(text) {
    errorEl.textContent = text || "";
  }

  function frameUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return apiBase + path;
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
        img.decoding = "async";
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

    function prefetch(frames, start, count) {
      for (var i = start; i < Math.min(start + count, frames.length); i++) {
        loadImage(frameUrl(frames[i]));
      }
    }

    function show() {
      visible = true;
      characterWrap.style.display = "block";
      panel.classList.remove("no-character");
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
      front.className = "active";
      back.className = "";
      panel.classList.add("no-character");
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
        back.src = url;
        back.className = "active";
        front.className = "";
        var tmp = front;
        front = back;
        back = tmp;
        currentUrl = url;
        lastSwapAt = performance.now();
        swapping = false;
        return true;
      });
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
      show();
      prefetch(frames, 0, 6);
      lastSwapAt = 0;
      rafId = requestAnimationFrame(loop);
    }

    function requestState(nextState) {
      if (state === "bye" || state === "welcome") return;
      if (state === nextState || pendingState === nextState) return;
      pendingState = nextState;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = setTimeout(function () {
        pendingTimer = null;
        var s = pendingState;
        pendingState = null;
        if (!s || state === s || state === "bye" || state === "welcome") return;
        play(s, true);
      }, 220);
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
      s.src = "https://unpkg.com/livekit-client@2.8.1/dist/livekit-client.umd.js";
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
        characterAnimator.setSpeaking();
        setStatus("Agent speaking…");
      } else {
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

  function handleNavigateMessage(msg) {
    if (!msg || msg.type !== "navigate") return;
    var url = buildNavigateUrl(msg.path || msg.url || "");
    if (!url) {
      setError("Navigation blocked: invalid page path");
      return;
    }
    setStatus("Opening page…");
    setTimeout(function () {
      try {
        window.location.assign(url);
      } catch (e) {
        setError("Could not open page");
      }
    }, 1200);
  }

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
        handleNavigateMessage(msg);
      } catch (e) {}
    });
  }

  function cleanupAudio() {
    document.querySelectorAll("[data-vc-audio]").forEach(function (el) {
      el.remove();
    });
  }

  function resetUi() {
    room = null;
    endingCall = false;
    cleanupAudio();
    btn.classList.remove("live");
    if (characterAnimator) characterAnimator.hide();
    panel.style.display = "none";
  }

  async function startCall() {
    setError("");
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
      if (data.character && data.character.enabled) {
        characterConfig = data.character;
        characterAnimator = createCharacterAnimator(characterConfig);
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
      await room.connect(data.livekit_url, data.token);
      attachSpeakerHandlers(LK, room);
      attachNavigateHandler(LK, room);
      if (room.startAudio) {
        try {
          await room.startAudio();
        } catch (e) {}
      }
      await room.localParticipant.setMicrophoneEnabled(true);
      btn.classList.add("live");
      if (characterAnimator) {
        characterAnimator.welcomeThenListen();
      }
      setStatus("Listening — speak now");
    } catch (err) {
      setStatus("Error");
      setError(err.message || String(err));
    }
  }

  async function endCall() {
    if (endingCall) return;
    endingCall = true;
    var activeRoom = room;
    room = null;

    function finish() {
      if (activeRoom) {
        try {
          activeRoom.disconnect();
        } catch (e) {}
      }
      cleanupAudio();
      btn.classList.remove("live");
      panel.style.display = "none";
      setStatus("Idle");
      endingCall = false;
    }

    if (characterAnimator && characterAnimator.isVisible()) {
      characterAnimator.playBye(finish);
    } else {
      if (activeRoom) {
        try {
          await activeRoom.disconnect();
        } catch (e) {}
      }
      resetUi();
      setStatus("Idle");
      endingCall = false;
    }
  }

  btn.addEventListener("click", function () {
    if (room || endingCall) endCall();
    else startCall();
  });
  closeBtn.addEventListener("click", endCall);
})();
