const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const countdownOverlay = document.getElementById('countdown-overlay');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const finalResultImg = document.getElementById('final-result-img');
const frameOptions = document.querySelectorAll('.frame-option');
const filterBtns = document.querySelectorAll('.filter-btn');

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

// Canvas 2D 專用直接渲染濾鏡字串
const filterCanvasMap = {
  'normal': 'none',
  'beauty': 'brightness(1.1) contrast(0.95) saturate(1.1)',
  'retro': 'sepia(0.35) contrast(1.1) brightness(0.95) saturate(1.2)',
  'vintage': 'contrast(1.2) saturate(0.85) hue-rotate(-10deg)',
  'bw': 'grayscale(1) contrast(1.2)'
};

let currentFilterKey = 'normal';
let hasShot = false;

// 1. 開啟相機
navigator.mediaDevices.getUserMedia({ 
  video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" } 
})
.then(stream => { webcam.srcObject = stream; })
.catch(err => { alert("無法開啟相機，請確認授權權限！"); });

// 2. 切換濾鏡
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const activeBtn = document.querySelector('.filter-btn.active');
    if (activeBtn) activeBtn.classList.remove('active');
    
    e.currentTarget.classList.add('active');
    currentFilterKey = e.currentTarget.getAttribute('data-filter');
    
    // 即時預覽畫面
    webcam.style.filter = filterCanvasMap[currentFilterKey];

    // 如果已經拍完照，重新重繪濾鏡到 Canvas 像素上
    if (hasShot) {
      canvases.forEach(canvas => {
        // 重新繪製濾鏡
        const ctx = canvas.getContext('2d');
        const imgData = canvas._originalImageData;
        if (imgData) {
          ctx.filter = filterCanvasMap[currentFilterKey];
          ctx.putImageData(imgData, 0, 0);
        }
      });
      generateFinalImage();
    }
  });
});

// 3. 切換相框
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

// 4. 連拍流程
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

// 🎯 核心重點：把濾鏡真實刻進 Canvas 像素中 (解開 html2canvas 跑掉的 Bug)
function takePhoto(canvas) {
  const ctx = canvas.getContext('2d');
  
  const targetWidth = 500;
  const targetHeight = 332;
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

  // 🎯 關鍵修復：直接將 ctx.filter 作用在 drawImage 渲染階段！
  ctx.filter = filterCanvasMap[currentFilterKey];
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(webcam, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
  ctx.restore();
}

// 合成最終作品
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

// 重拍
retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  finalResultImg.style.display = 'none';
  hasShot = false;
  downloadBtn.disabled = true;
});

// 下載按鈕
downloadBtn.addEventListener('click', () => {
  if (finalResultImg.src && hasShot) {
    const link = document.createElement('a');
    link.download = `EXhOrizon_${Date.now()}.png`;
    link.href = finalResultImg.src;
    link.click();
  }
});

startBtn.addEventListener('click', startPhotography);