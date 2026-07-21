const webcam = document.getElementById('webcam');
const startBtn = document.getElementById('start-btn');
const retakeBtn = document.getElementById('retake-btn');
const downloadBtn = document.getElementById('download-btn');
const countdownOverlay = document.getElementById('countdown-overlay');

const photoStrip = document.getElementById('photo-strip');
const frameOverlay = document.getElementById('frame-overlay');
const frameCards = document.querySelectorAll('.frame-card');

const canvases = [
  document.getElementById('canvas1'),
  document.getElementById('canvas2'),
  document.getElementById('canvas3'),
  document.getElementById('canvas4')
];

// 相框圖片對照表
const frameSources = {
  warm: 'frame_warm.png',
  cool: 'frame_cool.png',
  none: ''
};

// 1. 初始化開啟 Webcam 相機
navigator.mediaDevices.getUserMedia({ 
  video: { width: { ideal: 1280 }, height: { ideal: 960 }, facingMode: "user" } 
})
.then(stream => { 
  webcam.srcObject = stream; 
})
.catch(err => { 
  alert("無法存取相機，請確認瀏覽器已允許使用相機權限！"); 
});

// 2. 切換相框邏輯
frameCards.forEach(card => {
  card.addEventListener('click', () => {
    // 切換 active 狀態
    document.querySelector('.frame-card.active').classList.remove('active');
    card.classList.add('active');

    const frameType = card.getAttribute('data-frame');
    
    if (frameType === 'none') {
      photoStrip.className = 'strip-container frame-none';
    } else {
      photoStrip.className = `strip-container frame-${frameType}-active`;
      frameOverlay.src = frameSources[frameType];
      frameOverlay.style.display = 'block';
    }
  });
});

// 3. 開始連拍 4 張
async function startPhotography() {
  startBtn.disabled = true;
  retakeBtn.disabled = true;
  downloadBtn.disabled = true;

  for (let i = 0; i < 4; i++) {
    await countdown(3); // 每張倒數 3 秒
    takePhoto(canvases[i]);
  }

  startBtn.disabled = false;
  retakeBtn.disabled = false;
  downloadBtn.disabled = false;
}

// 倒數計時器
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

// 擷取影像並繪製到 Canvas
function takePhoto(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = webcam.videoWidth;
  canvas.height = webcam.videoHeight;
  
  // 水平鏡像翻轉繪製
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
}

// 4. 重拍按鈕
retakeBtn.addEventListener('click', () => {
  canvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });
  downloadBtn.disabled = true;
});

// 5. 下載作品 (結合 html2canvas 高解析度輸出)
downloadBtn.addEventListener('click', () => {
  // 高倍率渲染（scale: 3）確保下載品質清晰
  html2canvas(photoStrip, { 
    scale: 3,
    useCORS: true,
    backgroundColor: null
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `EXO_PhotoStrip_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
});

startBtn.addEventListener('click', startPhotography);