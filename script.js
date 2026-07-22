const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const downloadVideoBtn = document.getElementById('download-video-btn');
const countdownOverlay = document.getElementById('countdown-overlay');
const flashEffect = document.getElementById('flash-effect');
const flipBtn = document.getElementById('flip-btn');

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
let audioCtx = null;

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
  if (!isPlaying && player && typeof player.playVideo !== 'function') {
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

// 2. 音效解鎖
function playPrintingSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const bufferSize = audioCtx.sampleRate * 1.5;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 3;

    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + 1.5);
  } catch (e) {
    console.log("音效未啟用：", e);
  }
}

// 3. 相機初始化
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
      .catch(e => alert("無法開啟相機，請確認手機相機權限已開啟！"));
  });
}

flipBtn.addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  initCamera();
});

initCamera();

// 4. 框選邏輯
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
    if (hasShot) return;
    document.querySelector('.frame-option.active').classList.remove('active');
    e.currentTarget.classList.add('active');

    const selectedFrame = e.currentTarget.getAttribute('data-frame');
    frameOverlay.src = frameSources[selectedFrame];
  });
});

// 5. 拍照與畫布運算
function takePhotoToCanvas(canvas) {
  const targetWidth = 510;
  const targetHeight = 352;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  const vWidth = webcam.videoWidth || 640;
  const vHeight = webcam.videoHeight || 480;
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
  if (currentFacingMode === 'user') {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(webcam, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  ctx.restore();
}

function renderFullStripToCanvas(currentActiveIndex) {
  recordCtx.clearRect(0, 0, 240, 720);

  PHOTO_POSITIONS.forEach((pos, idx) => {
    if (idx < currentActiveIndex && canvases[idx].width > 0) {
      recordCtx.drawImage(canvases[idx], pos.left, pos.top, pos.width, pos.height);
    }
  });

  if (frameOverlay.complete && frameOverlay.naturalWidth !== 0) {
    recordCtx.drawImage(frameOverlay, 0, 0, 240, 720);
  }
}

// 6. 核心拍照與錄影主流程（手機相容防卡死）
async function startPhotography() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  } catch (e) {}

  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadVideoBtn.disabled = true;
  finalResultImg.style.display = 'none';
  finalResultImg.classList.remove('printing-animation');
  hasShot = false;
  recordedChunks = [];

  canvases.forEach(c => c.getContext('2d').clearRect(0, 0, c.width, c.height));

  // 嘗試初始化錄影
  if (videoRecordCanvas.captureStream && window.MediaRecorder) {
    try {
      const recordStream = videoRecordCanvas.captureStream(25);
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
    } catch (e) {
      console.log("此手機不支援錄影：", e);
    }
  }

  // 4張連拍循環
  for (let i = 0; i < 4; i++) {
    await countdown(3);
    triggerFlash();
    takePhotoToCanvas(canvases[i]);
    renderFullStripToCanvas(i + 1);
  }

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

// 🎯 獨立穩定的倒數計時器（確保手機上看得到 3, 2, 1）
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

// 🎯 生成最終成象並觸發印相動畫
function generateFinalImage() {
  html2canvas(photoStrip, { 
    scale: 2, // 針對手機效能優化
    useCORS: true,
    backgroundColor: null
  }).then(canvas => {
    const dataUrl = canvas.toDataURL('image/png');
    finalResultImg.src = dataUrl;
    
    finalResultImg.style.display = 'block';
    playPrintingSound();
    finalResultImg.classList.add('printing-animation');
  }).catch(err => {
    console.log("截圖失敗：", err);
    alert("生成圖片時發生錯誤，請重新整理網頁再試一次！");
  });
}

retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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