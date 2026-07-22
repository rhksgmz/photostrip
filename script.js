const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const countdownOverlay = document.getElementById('countdown-overlay');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const finalResultImg = document.getElementById('final-result-img');
const frameOptions = document.querySelectorAll('.frame-option');

const musicBtn = document.getElementById('music-btn');
const musicIcon = document.getElementById('music-icon');
const musicText = document.getElementById('music-text');

let player;
let isPlaying = false;

// 1. 載入 YouTube 官方播放器 API 並設定「隨機播放 (Shuffle)」
function onYouTubeIframeAPIReady() {
  player = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    playerVars: {
      'listType': 'playlist',
      'list': 'PLyJ3pmxrjrzgWkwG52oMsyT41vQcjCfks', // EXO 歌單 ID
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
  event.target.setVolume(40); // 預設音量 40%
  
  // 🎯 啟用歌單隨機播放 (Shuffle)
  if (typeof player.setShuffle === 'function') {
    player.setShuffle(true);
  }
}

// 2. 音樂開關按鈕控制 (若為暫停狀態點擊播放，會自動跳至隨機曲目)
function toggleMusic() {
  if (!player || typeof player.playVideo !== 'function') return;

  if (isPlaying) {
    player.pauseVideo();
    musicBtn.classList.remove('playing');
    musicIcon.innerText = '🔇';
    musicText.innerText = 'PAUSED';
    isPlaying = false;
  } else {
    // 每次點擊播放時跳至歌單隨機下一首
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

// 點擊頁面任意處自動觸發隨機播放
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

// 3. 相機設定與照片流程
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

navigator.mediaDevices.getUserMedia({ 
  video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" } 
})
.then(stream => { webcam.srcObject = stream; })
.catch(err => { alert("無法開啟相機，請確認授權權限！"); });

// 4. 切換相框
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

// 5. 拍攝流程
async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  finalResultImg.style.display = 'none';
  hasShot = false;

  for (let i = 0; i < 4; i++) {
    await countdown(3);
    takePhoto(canvases[i]);
  }

  hasShot = true;
  generateFinalImage();

  startBtn.disabled = false;
  retakeBtn.disabled = false;
  downloadBtn.disabled = false;
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

  ctx.translate(targetWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(webcam, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
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
});

downloadBtn.addEventListener('click', () => {
  if (finalResultImg.src && hasShot) {
    const link = document.createElement('a');
    link.download = `EXhOrizon_${Date.now()}.png`;
    link.href = finalResultImg.src;
    link.click();
  }
});

startBtn.addEventListener('click', startPhotography);