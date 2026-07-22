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

const musicBtn = document.getElementById('music-btn');
const musicIcon = document.getElementById('music-icon');
const musicText = document.getElementById('music-text');

let player;
let isPlaying = false;
let currentFacingMode = 'user'; // 'user' (前鏡頭) 或 'environment' (後鏡頭)
let mediaRecorder = null;
let recordedChunks = [];
let recordedVideoBlob = null;
let currentFilter = 'none';
let supportedMimeType = '';

// 1. YouTube BGM API
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

// 2. 鏡頭初始化與切換
function initCamera() {
  if (webcam.srcObject) {
    webcam.srcObject.getTracks().forEach(track => track.stop());
  }

  const constraints = {
    video: { 
      width: { ideal: 1280 }, 
      height: { ideal: 960 }, 
      facingMode: { exact: currentFacingMode } 
    }
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => handleStreamSuccess(stream))
    .catch(() => {
      // 容錯機制：若不支援 exact 模式則退回普通模式
      navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } })
        .then(stream => handleStreamSuccess(stream))
        .catch(err => {
          alert("無法切換鏡頭或開啟相機！可能是裝置無多餘鏡頭。");
        });
    });
}

function handleStreamSuccess(stream) {
  webcam.srcObject = stream;
  if (currentFacingMode === 'user') {
    webcam.style.transform = 'scaleX(-1)';
  } else {
    webcam.style.transform = 'scaleX(1)';
  }
}

flipBtn.addEventListener('click', () => {
  currentFacingMode = (currentFacingMode === 'user') ? 'environment' : 'user';
  initCamera();
});

initCamera();

// 3. 切換濾鏡 (即時預覽)
filterSelect.addEventListener('change', (e) => {
  currentFilter = e.target.value;
  applyFilterToElement(webcam, currentFilter);
});

function applyFilterToElement(element, filterType) {
  if (filterType === 'bw') {
    element.style.filter = 'grayscale(100%) contrast(115%)';
  } else if (filterType === 'vintage') {
    element.style.filter = 'sepia(35%) contrast(95%) brightness(105%)';
  } else if (filterType === 'vivid') {
    element.style.filter = 'saturate(150%) contrast(110%)';
  } else {
    element.style.filter = 'none';
  }
}

// 4. 偵測瀏覽器支援的錄影格式
function getSupportedMimeType() {
  const types = [
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mpeg'
  ];
  for (let type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

// 5. 相框與拍攝流程
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

async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  downloadVideoBtn.disabled = true;
  finalResultImg.style.display = 'none';
  hasShot = false;
  recordedChunks = [];

  // 開啟錄影 (支援 Safari / iOS 相容格式)
  if (webcam.srcObject && window.MediaRecorder) {
    supportedMimeType = getSupportedMimeType();
    try {
      const options = supportedMimeType ? { mimeType: supportedMimeType } : {};
      mediaRecorder = new MediaRecorder(webcam.srcObject, options);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.start(100);
    } catch (e) {
      console.log("此瀏覽器限制影片錄製功能：", e);
    }
  }

  for (let i = 0; i < 4; i++) {
    await countdown(3);
    triggerFlash();
    takePhoto(canvases[i]);
  }

  // 停止錄影
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.onstop = () => {
      const type = supportedMimeType || 'video/mp4';
      recordedVideoBlob = new Blob(recordedChunks, { type: type });
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

// 拍照並寫入 Canvas
function takePhoto(canvas) {
  const ctx = canvas.getContext('2d');
  const targetWidth = 510;
  const targetHeight = 352;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const vWidth = webcam.videoWidth;
  const vHeight = webcam.videoHeight;
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

  // 強制套用 Canvas 濾鏡
  if (currentFilter === 'bw') {
    ctx.filter = 'grayscale(100%) contrast(115%)';
  } else if (currentFilter === 'vintage') {
    ctx.filter = 'sepia(35%) contrast(95%) brightness(105%)';
  } else if (currentFilter === 'vivid') {
    ctx.filter = 'saturate(150%) contrast(110%)';
  } else {
    ctx.filter = 'none';
  }

  if (currentFacingMode === 'user') {
    ctx.translate(targetWidth, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(webcam, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  ctx.restore();
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
    const ext = supportedMimeType.includes('mp4') ? 'mp4' : 'webm';
    a.href = url;
    a.download = `EXhOrizon_video_${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

startBtn.addEventListener('click', startPhotography);