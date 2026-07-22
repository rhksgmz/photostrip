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
let isRecordingActive = false;

// 拍貼框內 4 張照片的精確位置
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

    const bufferSize = audioCtx.sampleRate * 1.6;
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
    gainNode.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.2);
    gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 1.2);
    gainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 1.6);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    noise.start();
    noise.stop(audioCtx.currentTime + 1.6);
  } catch (e) {
    console.log("音效播放支援受限：", e);
  }
}

// 3. 相機設定與翻轉
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

// 4. 拍攝與錄影設定
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
  if (isLiveVideo && activeFacing === 'user') {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(sourceVideoOrCanvas, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  ctx.restore();
}

function takePhoto(canvas) {
  const targetWidth = 510;
  const targetHeight = 352;
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  renderFrameToContext(ctx, targetWidth, targetHeight, webcam, true, currentFacingMode);
}

// 🎯 讓四個格子在 5 秒拍攝期間「同時動態更新」的渲染核心
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

    // 如果該格已經拍完，就顯示定格照片；如果是正在拍攝的當前格子，則呈現即時動態畫面
    const sourceToDraw = (idx < currentActiveIndex && canvases[idx].width > 0) ? canvases[idx] : webcam;
    const isLive = !(idx < currentActiveIndex && canvases[idx].width > 0);

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

// 🎯 專門設定為 5 秒的倒數計時器
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

  // 4 張照片，每張拍攝/倒數時間為 5 秒
  for (let i = 0; i < 4; i++) {
    startRecordingLoop(i);

    await run5SecCountdown(5); // 每一格倒數 5 秒，對應 5 秒影片段落
    
    isRecordingActive = false;
    triggerFlash();
    takePhoto(canvases[i]); // 5秒結束瞬間拍照定格
    
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
    
    playPrintingSound();
    finalResultImg.classList.add('printing-animation');
  }).catch(err => {
    console.log("截圖失敗：", err);
    alert("手機生成圖片時發生錯誤，請重新整理後再試一次！");
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