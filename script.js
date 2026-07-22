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

// 保存未加濾鏡原始影像（供即時切換濾鏡使用）
const rawPhotoData = [null, null, null, null];

const frameSources = {
  warm: 'frame_warm.png',
  cool: 'frame_cool.png'
};

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
.catch(err => { alert("無法開啟相機，請確認允許授權！"); });

// 2. 切換濾鏡 (直接重繪 Canvas 像素，徹底根治 html2canvas 跑圖問題)
filterBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const activeBtn = document.querySelector('.filter-btn.active');
    if (activeBtn) activeBtn.classList.remove('active');
    
    e.currentTarget.classList.add('active');
    currentFilterKey = e.currentTarget.getAttribute('data-filter');
    
    webcam.style.filter = filterCanvasMap[currentFilterKey];

    // 如果已經拍照，將原始相片重新以新濾鏡繪製至 Canvas 像素
    if (hasShot) {
      canvases.forEach((canvas, index) => {
        if (rawPhotoData[index]) {
          renderCanvasWithFilter(canvas, rawPhotoData[index], currentFilterKey);
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

// 4. 開始拍攝流程
async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;
  finalResultImg.style.display = 'none';
  hasShot = false;

  for (let i = 0; i < 4; i++) {
    await countdown(3);
    takePhoto(i);
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

// 拍攝照片並儲存 Raw Data
function takePhoto(index) {
  const canvas = canvases[index];
  const targetWidth = 500;
  const targetHeight = 332;
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 1. 建立離屏 Canvas 擷取視訊原始圖像
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = targetWidth;
  tempCanvas.height = targetHeight;
  const tempCtx = tempCanvas.getContext('2d');

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

  tempCtx.translate(targetWidth, 0);
  tempCtx.scale(-1, 1);
  tempCtx.drawImage(webcam, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

  // 2. 保存原始圖像
  rawPhotoData[index] = tempCanvas;

  // 3. 直接帶有濾鏡渲染至顯示用 Canvas 上
  renderCanvasWithFilter(canvas, tempCanvas, currentFilterKey);
}

// 將圖像帶濾鏡繪製至目標 Canvas (像素級刻入)
function renderCanvasWithFilter(targetCanvas, sourceCanvas, filterKey) {
  const ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  
  // 🎯 關鍵重點：直接將濾鏡寫入 Context，產生的圖像會自帶色彩濾鏡像素！
  ctx.filter = filterCanvasMap[filterKey];
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none'; // 重置 filter 避免後續繪圖受影響
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
  canvases.forEach((canvas, index) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rawPhotoData[index] = null;
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