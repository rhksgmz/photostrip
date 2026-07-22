const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const downloadVideoBtn = document.getElementById('download-video-btn');
const countdownOverlay = document.getElementById('countdown-overlay');
const flashEffect = document.getElementById('flash-effect');
const flipBtn = document.getElementById('flip-btn');
const filterSelect = document.getElementById('filter-select');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const finalResultImg = document.getElementById('final-result-img');
const frameOptions = document.querySelectorAll('.frame-option');

const videoRecordCanvas = document.getElementById('video-record-canvas');
const recordCtx = videoRecordCanvas.getContext('2d');

const musicBtn = document.getElementById('music-btn');
const musicIcon = document.getElementById('music-icon');
const musicText = document.getElementById('music-text');

let player;
let isPlaying = false;
let currentFacingMode = 'user'; 
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;
let currentFilter = 'none';
let recordAnimationId = null;

// 精確的相框內 4 張照片成像位置 (對應 CSS 樣式)
const PHOTO_POSITIONS = [
  { left: 18, top: 32, width: 204, height: 141 },
  { left: 18, top: 178.8, width: 204, height: 141 },
  { left: 18, top: 325.6, width: 204, height: 141 },
  { left: 18, top: 472.4, width: 204, height: 141 }
];

// 1. YouTube BGM
function onYouTubeIframeAPIReady() {
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
      'onReady': onPlayerReady
    }
  });
}

function onPlayerReady(event) {
  event.target.setVolume(40);
  if (typeof player.setShuffle === 'function') {
    player.setShuffle(true);
  }
}

function toggleMusic() {
  if (!player || typeof player.playVideo !== 'function') return;

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

document.body.addEventListener('click', () => {
  if (!isPlaying && player && typeof player.playVideo === 'function') {
    if (typeof player.nextVideo === 'function') {
      player.nextVideo();
    }
    player.playVideo();
    musicBtn.classList.add('playing');
    musicIcon.innerText = '🔊';
    musicText.innerText = 'PLAYING';
    isPlaying = true;
  }
}, { once: true });

// 2. 相機設定與翻轉
function initCamera() {
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
  })
  .catch(err => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => { webcam.srcObject = stream; })
      .catch(e => alert("無法開啟相機，請確認瀏覽器權限！"));
  });
}

flipBtn.addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  initCamera();
});

initCamera();

// 3. 濾鏡切換
filterSelect.addEventListener('change', (e) => {
  currentFilter = e.target.value;
});

// 4. 共用的濾鏡套用函式（確保照片與影片色彩 100% 一致）
function applyCanvasFilter(ctx) {
  if (currentFilter === 'bw') {
    ctx.filter = 'grayscale(100%) contrast(110%)';
  } else if (currentFilter === 'vintage') {
    ctx.filter = 'sepia(25%) contrast(95%) brightness(105%)';
  } else if (currentFilter === 'vivid') {
    ctx.filter = 'saturate(135%) contrast(105%)';
  } else {
    ctx.filter = 'none';
  }
}

// 5. 拍攝與動態相框側錄
const canvases = [
  document.getElementById('canvas1'),
  document.getElementById('canvas2'),
  document.getElementById('canvas3'),
  document.getElementById('canvas4')
];

const frameSources = {
  warm: 'frame_warm.png',
  cool: 'frame_cool.png'
};

let hasShot = false;

frameOptions.forEach(option => {
  option.addEventListener('click', (e) => {
    document.querySelector('.frame-option.active').classList.remove('active');
    e.currentTarget.classList.add('active');

    const selectedFrame = e.currentTarget.getAttribute('data-frame');
    frameOverlay.src = frameSources[selectedFrame];

    if (hasShot) {
      setTimeout(generateFinalImage, 100);
    }
  });
});

// 🎯 核心渲染：嚴格對齊照片裁切比例與位置，並同步套用濾鏡
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
  applyCanvasFilter(ctx);

  if (isLiveVideo && activeFacing === 'user') {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(sourceVideoOrCanvas, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  ctx.restore();
}

// 🎯 即時繪製「相框 + 濾鏡 + 影音畫面」至錄影畫布
function renderFullStripToCanvas(currentActiveIndex) {
  recordCtx.clearRect(0, 0, 240, 720);

  PHOTO_POSITIONS.forEach((pos, idx) => {
    if (idx === currentActiveIndex) {
      recordCtx.save();
      recordCtx.beginPath();
      recordCtx.roundRect(pos.left, pos.top, pos.width, pos.height, 12);
      recordCtx.clip();
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = pos.width;
      tempCanvas.height = pos.height;
      const tempCtx = tempCanvas.getContext('2d');
      renderFrameToContext(tempCtx, pos.width, pos.height, webcam, true, currentFacingMode);
      
      recordCtx.drawImage(tempCanvas, pos.left, pos.top);
      recordCtx.restore();
    } else if (idx < currentActiveIndex) {
      recordCtx.drawImage(canvases[idx], pos.left, pos.top, pos.width, pos.height);
    }
  });

  recordCtx.filter = 'none';
  if (frameOverlay.complete && frameOverlay.naturalWidth !== 0) {
    recordCtx.drawImage(frameOverlay, 0, 0, 240, 720);
  }
}

async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadVideoBtn.disabled = true;
  finalResultImg.style.display = 'none';
  hasShot = false;
  recordedChunks = [];

  canvases.forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));

  if (videoRecordCanvas.captureStream && window.MediaRecorder) {
    try {
      const recordStream = videoRecordCanvas.captureStream(30);
      let options = {};
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        options = { mimeType: 'video/webm;codecs=vp8' };
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
      }

      mediaRecorder = new MediaRecorder(recordStream, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start(100);
    } catch (e) {
      console.log("影音錄影初始化失敗：", e);
    }
  }

  for (let i = 0; i < 4; i++) {
    const updateFrameLoop = () => {
      renderFullStripToCanvas(i);
      recordAnimationId = requestAnimationFrame(updateFrameLoop);
    };
    updateFrameLoop();

    await countdown(3);
    cancelAnimationFrame(recordAnimationId);
    
    triggerFlash();
    takePhoto(canvases[i]);
    
    renderFullStripToCanvas(i + 1);
  }

  await new Promise(r => setTimeout(r, 2000));

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

function countdown(seconds) {
  return new Promise(resolve => {
    let count = seconds;
    countdownOverlay.innerText = count;
    
    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownOverlay.innerText = count;
      } else {
        clearInterval(interval);
        countdownOverlay.innerText = '';
        resolve();
      }
    }, 1000);
  });
}

// 🎯 單張照片拍攝（嚴格套用與預覽相同的濾鏡與成像公式）
function takePhoto(canvas) {
  const targetWidth = 510;
  const targetHeight = 352;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  renderFrameToContext(ctx, targetWidth, targetHeight, webcam, true, currentFacingMode);
}

function generateFinalImage() {
  html2canvas(photoStrip, { 
    scale: 3, 
    useCORS: true,
    backgroundColor: null
  }).then(canvas => {
    const dataUrl = canvas.toDataURL('image/png');
    finalResultImg.src = dataUrl;
    finalResultImg.style.display = 'block';
  });
}

retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  finalResultImg.style.display = 'none';
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