document.addEventListener('DOMContentLoaded', () => {
  // ==========================================
  // 🔴 Firebase 累積拍攝次數即時同步設定
  // ==========================================
  try {
    const firebaseConfig = {
      databaseURL: "https://exhorizon-photobooth-default-rtdb.firebaseio.com/"
    };
    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();
    const totalShotsEl = document.getElementById('total-shots');
    db.ref('stats/totalShots').on('value', (snapshot) => {
      const val = snapshot.val();
      if (val !== null && totalShotsEl) {
        totalShotsEl.innerText = val;
      } else if (totalShotsEl) {
        db.ref('stats/totalShots').set(128);
      }
    });
  } catch (e) {
    console.log("Firebase 略過：", e);
  }

  // ==========================================
  // 🎵 YouTube BGM 背景音樂設定
  // ==========================================
  const musicBtn = document.getElementById('music-btn');
  const musicIcon = document.getElementById('music-icon');
  const musicText = document.getElementById('music-text');

  let player = null;
  let isPlaying = false;

  window.onYouTubeIframeAPIReady = function() {
    try {
      player = new YT.Player('yt-player', {
        height: '1',
        width: '1',
        playerVars: {
          'listType': 'playlist',
          'list': 'PLyJ3pmxrjrzgWkwG52oMsyT41vQcjCfks',
          'autoplay': 0,
          'controls': 0,
          'loop': 1
        },
        events: {
          'onReady': (event) => {
            event.target.setVolume(40);
            if (typeof player.setShuffle === 'function') {
              player.setShuffle(true);
            }
          }
        }
      });
    } catch (e) {
      console.log("YouTube Player 初始化失敗：", e);
    }
  };

  function toggleMusic() {
    if (!player || typeof player.playVideo !== 'function') {
      alert("背景音樂載入中，請稍候再試一次！");
      return;
    }

    if (isPlaying) {
      player.pauseVideo();
      musicBtn.classList.remove('playing');
      musicIcon.innerText = '🔇';
      musicText.innerText = 'PAUSED';
      isPlaying = false;
    } else {
      if (typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
      player.playVideo();
      musicBtn.classList.add('playing');
      musicIcon.innerText = '🔊';
      musicText.innerText = 'PLAYING';
      isPlaying = true;
    }
  }

  musicBtn.addEventListener('click', toggleMusic);

  // ==========================================
  // 📸 拍貼機核心程式碼
  // ==========================================
  const webcam = document.getElementById('webcam');
  const startBtn = document.getElementById('start-btn');
  const retakeBtn = document.getElementById('retake-btn');
  const downloadBtn = document.getElementById('download-btn');
  const downloadVideoBtn = document.getElementById('download-video-btn');
  const countdownOverlay = document.getElementById('countdown-overlay');
  const flashEffect = document.getElementById('flash-effect');
  const flipBtn = document.getElementById('flip-btn');

  const photoStrip = document.getElementById('photo-strip');
  const photoLayer = document.querySelector('.photo-layer');
  const frameOverlay = document.getElementById('frame-overlay');
  const cameraFrameOverlay = document.getElementById('camera-frame-overlay'); // 🎯 預覽引導框
  const finalResultImg = document.getElementById('final-result-img');
  const frameOptions = document.querySelectorAll('.frame-option');

  const videoRecordCanvas = document.getElementById('video-record-canvas');
  const recordCtx = videoRecordCanvas.getContext('2d');

  let currentFacingMode = 'user'; 
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedVideoBlob = null;
  let audioCtx = null;
  let isRecordingActive = false;

  // 🎯 四格與三格 PNG 相框的挖孔座標與大小（4格維持原樣，3格間隔設為 0.35cm ≒ 13px）
  const FRAME_CONFIGS = {
    4: {
      positions: [
        { left: 18, top: 32, width: 204, height: 141 },
        { left: 18, top: 178.8, width: 204, height: 141 },
        { left: 18, top: 325.6, width: 204, height: 141 },
        { left: 18, top: 472.4, width: 204, height: 141 }
      ]
    },
    3: {
      positions: [
        { left: 15, top: 22, width: 210, height: 183 },   // 第一格
        { left: 15, top: 212, width: 210, height: 183 },  // 第二格 (間隔 0.35cm = 13px)
        { left: 15, top: 408, width: 210, height: 183 }   // 第三格 (間隔 0.35cm = 13px)
      ]
    }
  };

  let currentSlots = 4;
  let PHOTO_POSITIONS = FRAME_CONFIGS[4].positions;
  let canvases = [
    document.getElementById('canvas1'),
    document.getElementById('canvas2'),
    document.getElementById('canvas3'),
    document.getElementById('canvas4')
  ];

  // 3. 相機設定與鏡像切換（前鏡頭鏡像、外鏡頭正常不相反）
  function initCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("您的瀏覽器不支援相機功能！");
      return;
    }

    if (webcam.srcObject) {
      webcam.srcObject.getTracks().forEach(track => track.stop());
    }

    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 }, 
        height: { ideal: 960 }, 
        facingMode: currentFacingMode 
      } 
    })
    .then(stream => { 
      webcam.srcObject = stream;
      webcam.play().catch(e => console.log(e));

      // 🎯 動態調整鏡像：前鏡頭鏡像翻轉，外鏡頭維持正常方向
      if (currentFacingMode === 'user') {
        webcam.classList.remove('rear-camera');
        webcam.classList.add('front-camera');
      } else {
        webcam.classList.remove('front-camera');
        webcam.classList.add('rear-camera');
      }
    })
    .catch(err => {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => { 
          webcam.srcObject = stream;
          webcam.play().catch(e => console.log(e));
          if (currentFacingMode === 'user') {
            webcam.classList.remove('rear-camera');
            webcam.classList.add('front-camera');
          } else {
            webcam.classList.remove('front-camera');
            webcam.classList.add('rear-camera');
          }
        })
        .catch(e => {
          alert("無法開啟相機，請確認是否授權相機權限或使用 HTTPS 連線！");
        });
    });
  }

  flipBtn.addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
    initCamera();
  });

  initCamera();

  // 🎯 初始化時重建 DOM，確保 4 格與 3 格切換順暢且不丟失
  function rebuildPhotoLayer(slots) {
    photoLayer.innerHTML = '';
    for (let i = 0; i < slots; i++) {
      const pos = PHOTO_POSITIONS[i];
      photoLayer.innerHTML += `<div class="photo-frame" style="top: ${pos.top}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px; display: flex;"><canvas id="canvas${i + 1}"></canvas></div>`;
    }
    canvases = [];
    for (let i = 1; i <= slots; i++) {
      canvases.push(document.getElementById(`canvas${i}`));
    }
  }

  // 🎯 相框切換事件
  let hasShot = false;

  frameOptions.forEach(option => {
    option.addEventListener('click', (e) => {
      if (hasShot) return;
      
      const activeOld = document.querySelector('.frame-option.active');
      if (activeOld) activeOld.classList.remove('active');
      
      const targetOption = e.currentTarget;
      targetOption.classList.add('active');

      const selectedFrame = targetOption.getAttribute('data-frame');
      const slots = parseInt(targetOption.getAttribute('data-slots')) || 4;

      currentSlots = slots;
      PHOTO_POSITIONS = FRAME_CONFIGS[slots].positions;

      rebuildPhotoLayer(slots);

      startBtn.innerText = `2. 開始連拍 (${slots}張)`;
      frameOverlay.src = `${selectedFrame}.png`;
      if (cameraFrameOverlay) {
        cameraFrameOverlay.src = `${selectedFrame}.png`; // 🎯 同步更新相機預覽引導框
      }
    });
  });

  function renderFrameToContext(ctx, targetWidth, targetHeight, sourceVideoOrCanvas, isLiveVideo, activeFacing) {
    const vWidth = sourceVideoOrCanvas.videoWidth || sourceVideoOrCanvas.width || 640;
    const vHeight = sourceVideoOrCanvas.videoHeight || sourceVideoOrCanvas.height || 480;
    const videoAspect = vWidth / vHeight;
    const targetAspect = targetWidth / targetHeight;

    let sWidth, sHeight, sx, sy;
    if (videoAspect > targetAspect) {
      sHeight = vHeight;
      sWidth = vHeight * targetAspect;
      sx = (vWidth - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = vWidth;
      sHeight = vWidth / targetAspect;
      sx = 0;
      sy = (vHeight - sHeight) / 2;
    }

    ctx.save();
    // 🎯 僅前鏡頭 ('user') 進行左右反轉，外鏡頭 ('environment') 保持正常方向
    if (isLiveVideo && activeFacing === 'user') {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(sourceVideoOrCanvas, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    ctx.restore();
  }

  function takePhoto(canvas) {
    if (!canvas) return;
    const targetWidth = canvas.width || 510;
    const targetHeight = canvas.height || 352;
    const ctx = canvas.getContext('2d');
    renderFrameToContext(ctx, targetWidth, targetHeight, webcam, true, currentFacingMode);
  }

  function renderAllActiveFrames(currentActiveIndex) {
    recordCtx.clearRect(0, 0, 240, 720);

    PHOTO_POSITIONS.forEach((pos, idx) => {
      recordCtx.save();
      recordCtx.beginPath();
      if (typeof recordCtx.roundRect === 'function') {
        recordCtx.roundRect(pos.left, pos.top, pos.width, pos.height, 12);
      } else {
        recordCtx.rect(pos.left, pos.top, pos.width, pos.height);
      }
      recordCtx.clip();

      const sourceToDraw = (idx < currentActiveIndex && canvases[idx] && canvases[idx].width > 0) ? canvases[idx] : webcam;
      const isLive = !(idx < currentActiveIndex && canvases[idx] && canvases[idx].width > 0);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = pos.width;
      tempCanvas.height = pos.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      renderFrameToContext(tempCtx, pos.width, pos.height, sourceToDraw, isLive, currentFacingMode);
      recordCtx.drawImage(tempCanvas, pos.left, pos.top);
      recordCtx.restore();
    });

    if (frameOverlay.complete && frameOverlay.naturalWidth !== 0) {
      recordCtx.drawImage(frameOverlay, 0, 0, 240, 720);
    }
  }

  function startRecordingLoop(currentActiveIndex) {
    if (!isRecordingActive) return;
    renderAllActiveFrames(currentActiveIndex);
    requestAnimationFrame(() => startRecordingLoop(currentActiveIndex));
  }

  function run5SecCountdown(seconds) {
    return new Promise(resolve => {
      let count = seconds;
      countdownOverlay.innerText = count;
      void countdownOverlay.offsetHeight;

      const timer = setInterval(() => {
        count--;
        if (count > 0) {
          countdownOverlay.innerText = count;
          void countdownOverlay.offsetHeight;
        } else {
          clearInterval(timer);
          countdownOverlay.innerText = '';
          resolve();
        }
      }, 1000);
    });
  }

  async function startPhotography() {
    // 🎯 拍攝時自動播放音樂
    if (player && typeof player.playVideo === 'function' && !isPlaying) {
      if (typeof player.nextVideo === 'function') {
        player.nextVideo();
      }
      player.playVideo();
      musicBtn.classList.add('playing');
      musicIcon.innerText = '🔊';
      musicText.innerText = 'PLAYING';
      isPlaying = true;
    }

    startBtn.disabled = true;
    retakeBtn.disabled = true;
    downloadBtn.disabled = true;
    downloadVideoBtn.disabled = true;
    finalResultImg.style.display = 'none';
    finalResultImg.classList.remove('printing-animation');
    hasShot = false;
    recordedChunks = [];

    // 🎯 點擊按鈕的瞬間立即計入總拍攝次數
    try {
      firebase.database().ref('stats/totalShots').transaction((current) => {
        return (current || 128) + 1;
      });
    } catch (e) {}

    rebuildPhotoLayer(currentSlots);

    canvases.forEach((c, idx) => {
      if (c && PHOTO_POSITIONS[idx]) {
        c.width = PHOTO_POSITIONS[idx].width * 2;
        c.height = PHOTO_POSITIONS[idx].height * 2;
        c.getContext('2d').clearRect(0, 0, c.width, c.height);
      }
    });

    if (videoRecordCanvas.captureStream && window.MediaRecorder) {
      try {
        const recordStream = videoRecordCanvas.captureStream(30);
        let options = {};
        if (MediaRecorder.isTypeSupported('video/mp4')) {
          options = { mimeType: 'video/mp4' };
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options = { mimeType: 'video/webm' };
        }

        mediaRecorder = new MediaRecorder(recordStream, options);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) recordedChunks.push(e.data);
        };
        mediaRecorder.start(100);
        isRecordingActive = true;
      } catch (e) {
        console.log("錄影不支援：", e);
      }
    }

    for (let i = 0; i < currentSlots; i++) {
      startRecordingLoop(i);
      await run5SecCountdown(5);
      
      isRecordingActive = false;
      triggerFlash();
      takePhoto(canvases[i]); 
      isRecordingActive = true;
    }

    isRecordingActive = false;
    await new Promise(r => setTimeout(r, 1000));

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.onstop = () => {
        const mime = mediaRecorder.mimeType || 'video/mp4';
        recordedVideoBlob = new Blob(recordedChunks, { type: mime });
        downloadVideoBtn.disabled = false;
      };
    }

    hasShot = true;
    generateFinalImage();

    startBtn.disabled = false;
    retakeBtn.disabled = false;
    downloadBtn.disabled = false;
  }

  function triggerFlash() {
    flashEffect.classList.add('flash-active');
    setTimeout(() => {
      flashEffect.classList.remove('flash-active');
    }, 120);
  }

  function generateFinalImage() {
    html2canvas(photoStrip, { 
      scale: 2, 
      useCORS: true,
      backgroundColor: null
    }).then(canvas => {
      const dataUrl = canvas.toDataURL('image/png');
      finalResultImg.src = dataUrl;
      finalResultImg.style.display = 'block';
      finalResultImg.classList.add('printing-animation');
    }).catch(err => {
      alert("生成圖片時發生錯誤！");
    });
  }

  retakeBtn.addEventListener('click', () => {
    canvases.forEach(canvas => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
    finalResultImg.style.display = 'none';
    finalResultImg.classList.remove('printing-animation');
    hasShot = false;
    downloadBtn.disabled = true;
    downloadVideoBtn.disabled = true;
  });

  downloadBtn.addEventListener('click', () => {
    if (finalResultImg.src && hasShot) {
      const link = document.createElement('a');
      link.download = `EXhOrizon_${Date.now()}.png`;
      link.href = finalResultImg.src;
      link.click();
    }
  });

  downloadVideoBtn.addEventListener('click', () => {
    if (recordedVideoBlob) {
      const url = URL.createObjectURL(recordedVideoBlob);
      const a = document.createElement('a');
      const ext = recordedVideoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      a.href = url;
      a.download = `EXhOrizon_video_${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  startBtn.addEventListener('click', startPhotography);
});