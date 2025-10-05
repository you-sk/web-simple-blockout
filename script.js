const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ゲーム状態
let gameRunning = false;
let score = 0;
let lives = 3;
let gameState = 'ready'; // 'ready', 'playing', 'gameOver', 'gameWin', 'stageClear'

// ステージ管理
let currentStage = 1;
const maxStages = 10;
let initialBallSpeedX = 2.5;
let initialBallSpeedY = -2.5;
let initialPaddleWidth = 150;

// コンボシステム
let combo = 0;
let comboTimer = null;
let highScore = localStorage.getItem('blockoutHighScore') || 0;

// パワーアップアイテム
const powerups = [];
const powerupTypes = [
    { type: 'expandPaddle', color: '#2ecc71', symbol: '⬌', duration: 10000 },
    { type: 'shrinkPaddle', color: '#e74c3c', symbol: '⬍', duration: 10000 },
    { type: 'slowBall', color: '#3498db', symbol: '↓', duration: 8000 },
    { type: 'fastBall', color: '#e67e22', symbol: '↑', duration: 8000 },
    { type: 'multiBall', color: '#9b59b6', symbol: '●', duration: 0 },
    { type: 'penetrate', color: '#f39c12', symbol: '⚡', duration: 12000 }
];
let activePowerups = [];
const balls = [];

// パーティクル
const particles = [];

// 画面シェイク
let shakeAmount = 0;
let shakeDecay = 0.9;

// ボールトレイル
const ballTrails = [];

// パドル
const paddle = {
    x: canvas.width / 2 - 75,
    y: canvas.height - 30,
    width: 150,
    height: 15,
    speed: 8,
    initialWidth: 150
};

// ボール
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speedX: 2.5,
    speedY: -2.5,
    maxSpeed: 8,
    initialSpeedX: 2.5,
    initialSpeedY: -2.5,
    penetrating: false
};

// ブロック
const blocks = [];
const blockRows = 6;
const blockCols = 10;
const blockWidth = 75;
const blockHeight = 25;
const blockPadding = 5;
const blockOffsetTop = 60;
const blockOffsetLeft = (canvas.width - (blockCols * blockWidth + (blockCols - 1) * blockPadding)) / 2;

// キー入力
const keys = {};

// 音響システム
let audioContext;

// 音を生成する関数
function playSound(frequency, duration, type = 'square') {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playBlockBreakSound() {
    playSound(800, 0.1, 'square');
}

function playPaddleHitSound() {
    playSound(200, 0.1, 'sine');
}

function playPowerupSound() {
    playSound(600, 0.15, 'triangle');
}

function playComboSound(comboLevel) {
    playSound(400 + comboLevel * 50, 0.1, 'sine');
}

// 初期化
function init() {
    createBlocks();
    resetBall();
    balls.length = 0;
    updateDisplay();
    gameLoop();
}

// ブロック生成
function createBlocks() {
    blocks.length = 0;
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
    
    for (let row = 0; row < blockRows; row++) {
        for (let col = 0; col < blockCols; col++) {
            blocks.push({
                x: col * (blockWidth + blockPadding) + blockOffsetLeft,
                y: row * (blockHeight + blockPadding) + blockOffsetTop,
                width: blockWidth,
                height: blockHeight,
                visible: true,
                color: colors[row]
            });
        }
    }
}

// ボールリセット
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = paddle.y - 100; // パドルの上方に配置

    // ステージごとに速度を調整（20%ずつ増加）
    const speedMultiplier = 1 + (currentStage - 1) * 0.2;
    const baseSpeedX = (Math.random() - 0.5) * 3; // -1.5 から 1.5 の範囲
    const baseSpeedY = Math.abs(ball.initialSpeedY); // 下向きに移動

    ball.speedX = baseSpeedX * speedMultiplier;
    ball.speedY = baseSpeedY * speedMultiplier;
    ball.penetrating = false;
}

// パワーアップ生成
function createPowerup(x, y) {
    if (Math.random() < 0.3) { // 30%の確率でアイテムドロップ
        const powerupType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
        powerups.push({
            x: x,
            y: y,
            width: 30,
            height: 30,
            speedY: 2,
            type: powerupType.type,
            color: powerupType.color,
            symbol: powerupType.symbol,
            duration: powerupType.duration
        });
    }
}

// パワーアップ適用
function applyPowerup(powerup) {
    playPowerupSound();

    switch(powerup.type) {
        case 'expandPaddle':
            paddle.width = Math.min(paddle.width * 1.5, 300);
            addActivePowerup(powerup);
            break;
        case 'shrinkPaddle':
            paddle.width = Math.max(paddle.width * 0.7, 50);
            addActivePowerup(powerup);
            break;
        case 'slowBall':
            ball.speedX *= 0.6;
            ball.speedY *= 0.6;
            balls.forEach(b => {
                b.speedX *= 0.6;
                b.speedY *= 0.6;
            });
            addActivePowerup(powerup);
            break;
        case 'fastBall':
            ball.speedX *= 1.4;
            ball.speedY *= 1.4;
            balls.forEach(b => {
                b.speedX *= 1.4;
                b.speedY *= 1.4;
            });
            addActivePowerup(powerup);
            break;
        case 'multiBall':
            // 追加ボールを2つ作成
            for (let i = 0; i < 2; i++) {
                balls.push({
                    x: ball.x,
                    y: ball.y,
                    radius: ball.radius,
                    speedX: ball.speedX * (Math.random() * 0.6 + 0.7) * (Math.random() < 0.5 ? -1 : 1),
                    speedY: ball.speedY * (Math.random() * 0.6 + 0.7),
                    maxSpeed: ball.maxSpeed,
                    penetrating: ball.penetrating
                });
            }
            break;
        case 'penetrate':
            ball.penetrating = true;
            balls.forEach(b => b.penetrating = true);
            addActivePowerup(powerup);
            break;
    }
}

// アクティブパワーアップ追加
function addActivePowerup(powerup) {
    if (powerup.duration > 0) {
        const existing = activePowerups.find(p => p.type === powerup.type);
        if (existing) {
            clearTimeout(existing.timeout);
            activePowerups = activePowerups.filter(p => p.type !== powerup.type);
        }

        const timeout = setTimeout(() => {
            removePowerup(powerup.type);
        }, powerup.duration);

        activePowerups.push({
            type: powerup.type,
            timeout: timeout,
            endTime: Date.now() + powerup.duration,
            color: powerup.color,
            symbol: powerup.symbol
        });
    }
}

// パワーアップ削除
function removePowerup(type) {
    switch(type) {
        case 'expandPaddle':
        case 'shrinkPaddle':
            paddle.width = paddle.initialWidth * (1 - (currentStage - 1) * 0.1);
            break;
        case 'slowBall':
        case 'fastBall':
            // 速度を元に戻す（相対的に）
            const speedMultiplier = 1 + (currentStage - 1) * 0.2;
            const targetSpeed = ball.initialSpeedY * speedMultiplier;
            const currentSpeed = Math.sqrt(ball.speedX ** 2 + ball.speedY ** 2);
            const ratio = targetSpeed / currentSpeed;
            ball.speedX *= ratio;
            ball.speedY *= ratio;
            balls.forEach(b => {
                const bCurrentSpeed = Math.sqrt(b.speedX ** 2 + b.speedY ** 2);
                const bRatio = targetSpeed / bCurrentSpeed;
                b.speedX *= bRatio;
                b.speedY *= bRatio;
            });
            break;
        case 'penetrate':
            ball.penetrating = false;
            balls.forEach(b => b.penetrating = false);
            break;
    }
    activePowerups = activePowerups.filter(p => p.type !== type);
}

// パーティクル生成
function createParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        particles.push({
            x: x,
            y: y,
            speedX: Math.cos(angle) * (Math.random() * 3 + 2),
            speedY: Math.sin(angle) * (Math.random() * 3 + 2),
            radius: Math.random() * 3 + 2,
            color: color,
            life: 1.0,
            decay: 0.02
        });
    }
}

// 画面シェイク
function shake(amount) {
    shakeAmount = amount;
}

// コンボ追加
function addCombo() {
    combo++;

    if (comboTimer) {
        clearTimeout(comboTimer);
    }

    comboTimer = setTimeout(() => {
        combo = 0;
    }, 2000);

    if (combo > 1) {
        playComboSound(combo);
        const comboBonus = combo * 5;
        score += comboBonus;
    }
}


// ボール更新関数
function updateBall(b, isMainBall = false) {
    // ボール移動
    b.x += b.speedX;
    b.y += b.speedY;

    // トレイル追加
    ballTrails.push({
        x: b.x,
        y: b.y,
        radius: b.radius,
        life: 0.5
    });

    // 壁との衝突（位置修正付き）
    if (b.x + b.radius > canvas.width) {
        b.x = canvas.width - b.radius;
        b.speedX = -b.speedX;
    }
    if (b.x - b.radius < 0) {
        b.x = b.radius;
        b.speedX = -b.speedX;
    }
    if (b.y - b.radius < 0) {
        b.y = b.radius;
        b.speedY = -b.speedY;
    }

    // パドルとの衝突（改良版）
    if (b.x >= paddle.x &&
        b.x <= paddle.x + paddle.width &&
        b.y + b.radius >= paddle.y &&
        b.y + b.radius <= paddle.y + paddle.height + 10 &&
        b.speedY > 0) { // 下向きに移動している時のみ

        // ボールをパドルの上に配置
        b.y = paddle.y - b.radius;
        b.speedY = -Math.abs(b.speedY); // 確実に上向きにする
        playPaddleHitSound(); // パドルヒット音

        // パドルの端に近いほど角度をつける
        const hitPos = (b.x - paddle.x) / paddle.width;
        b.speedX = (hitPos - 0.5) * 5;

        // 速度制限
        if (Math.abs(b.speedX) > b.maxSpeed) {
            b.speedX = b.speedX > 0 ? b.maxSpeed : -b.maxSpeed;
        }
    }

    // ブロックとの衝突（改良版）
    for (let block of blocks) {
        if (block.visible) {
            // ボールの中心がブロックの範囲内にあるかチェック
            if (b.x >= block.x - b.radius &&
                b.x <= block.x + block.width + b.radius &&
                b.y >= block.y - b.radius &&
                b.y <= block.y + block.height + b.radius) {

                block.visible = false;
                score += 10;
                playBlockBreakSound(); // ブロック破壊音
                addCombo(); // コンボ追加
                createParticles(block.x + block.width / 2, block.y + block.height / 2, block.color); // パーティクル
                createPowerup(block.x + block.width / 2, block.y + block.height / 2); // パワーアップ生成
                shake(5); // 画面シェイク

                // 貫通モードでなければ跳ね返る
                if (!b.penetrating) {
                    // 衝突面を判定して適切に跳ね返す
                    const ballCenterX = b.x;
                    const ballCenterY = b.y;
                    const blockCenterX = block.x + block.width / 2;
                    const blockCenterY = block.y + block.height / 2;

                    const deltaX = ballCenterX - blockCenterX;
                    const deltaY = ballCenterY - blockCenterY;

                    // どちら側から衝突したかを判定
                    if (Math.abs(deltaX / block.width) > Math.abs(deltaY / block.height)) {
                        // 左右からの衝突
                        b.speedX = -b.speedX;
                        // 位置修正
                        if (deltaX > 0) {
                            b.x = block.x + block.width + b.radius;
                        } else {
                            b.x = block.x - b.radius;
                        }
                    } else {
                        // 上下からの衝突
                        b.speedY = -b.speedY;
                        // 位置修正
                        if (deltaY > 0) {
                            b.y = block.y + block.height + b.radius;
                        } else {
                            b.y = block.y - b.radius;
                        }
                    }

                    // 速度を少し上げる
                    b.speedX *= 1.01;
                    b.speedY *= 1.01;
                    break;
                }
            }
        }
    }

    // ボールが下に落ちた
    if (b.y + b.radius > canvas.height) {
        if (isMainBall) {
            lives--;
            if (lives > 0) {
                resetBall();
                balls.length = 0; // サブボールもクリア
                combo = 0; // コンボリセット
                gameRunning = false;
                setTimeout(() => gameRunning = true, 1000);
            } else {
                gameOver();
            }
        }
        return false; // ボールを削除
    }

    return true; // ボールを保持
}

// 更新
function update() {
    if (!gameRunning) return;

    // パドル移動
    if (keys['KeyA'] && paddle.x > 0) {
        paddle.x -= paddle.speed;
    }
    if (keys['KeyD'] && paddle.x < canvas.width - paddle.width) {
        paddle.x += paddle.speed;
    }

    // メインボール更新
    updateBall(ball, true);

    // サブボール更新
    for (let i = balls.length - 1; i >= 0; i--) {
        if (!updateBall(balls[i], false)) {
            balls.splice(i, 1);
        }
    }

    // パワーアップアイテム更新
    for (let i = powerups.length - 1; i >= 0; i--) {
        const powerup = powerups[i];
        powerup.y += powerup.speedY;

        // パドルとの衝突
        if (powerup.x + powerup.width > paddle.x &&
            powerup.x < paddle.x + paddle.width &&
            powerup.y + powerup.height > paddle.y &&
            powerup.y < paddle.y + paddle.height) {
            applyPowerup(powerup);
            powerups.splice(i, 1);
        }
        // 画面外に出た
        else if (powerup.y > canvas.height) {
            powerups.splice(i, 1);
        }
    }

    // パーティクル更新
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // トレイル更新
    for (let i = ballTrails.length - 1; i >= 0; i--) {
        ballTrails[i].life -= 0.05;
        if (ballTrails[i].life <= 0) {
            ballTrails.splice(i, 1);
        }
    }

    // 画面シェイク減衰
    if (shakeAmount > 0) {
        shakeAmount *= shakeDecay;
        if (shakeAmount < 0.1) shakeAmount = 0;
    }

    // 勝利条件
    if (blocks.every(block => !block.visible)) {
        stageClear();
    }

    updateDisplay();
}

// 描画
function draw() {
    // 画面シェイクの適用
    ctx.save();
    if (shakeAmount > 0) {
        const shakeX = (Math.random() - 0.5) * shakeAmount;
        const shakeY = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(shakeX, shakeY);
    }

    // 背景クリア
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // トレイル描画
    for (let trail of ballTrails) {
        ctx.beginPath();
        ctx.arc(trail.x, trail.y, trail.radius * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${trail.life * 0.3})`;
        ctx.fill();
        ctx.closePath();
    }

    // ブロック描画
    for (let block of blocks) {
        if (block.visible) {
            ctx.fillStyle = block.color;
            ctx.fillRect(block.x, block.y, block.width, block.height);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(block.x, block.y, block.width, block.height);
        }
    }

    // パーティクル描画
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(')', `, ${p.life})`).replace('rgb', 'rgba');
        ctx.fill();
        ctx.closePath();
    }

    // パワーアップアイテム描画
    for (let powerup of powerups) {
        ctx.fillStyle = powerup.color;
        ctx.fillRect(powerup.x - powerup.width / 2, powerup.y - powerup.height / 2, powerup.width, powerup.height);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(powerup.symbol, powerup.x, powerup.y);
    }

    // パドル描画
    const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#cccccc');
    ctx.fillStyle = gradient;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);

    // メインボール描画
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    if (ball.penetrating) {
        ctx.fillStyle = '#f39c12';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f39c12';
    } else {
        ctx.fillStyle = '#ffffff';
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.closePath();

    // サブボール描画
    for (let b of balls) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        if (b.penetrating) {
            ctx.fillStyle = '#f39c12';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#f39c12';
        } else {
            ctx.fillStyle = '#9b59b6';
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }

    // コンボ表示
    if (combo > 1 && gameRunning) {
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${combo} COMBO!`, canvas.width / 2, 40);
    }

    // アクティブパワーアップ表示
    let yOffset = 10;
    ctx.textAlign = 'left';
    ctx.font = '16px Arial';
    for (let powerup of activePowerups) {
        const remaining = Math.ceil((powerup.endTime - Date.now()) / 1000);
        ctx.fillStyle = powerup.color;
        ctx.fillText(`${powerup.symbol} ${remaining}s`, 10, yOffset);
        yOffset += 25;
    }

    ctx.restore();
    
    // ゲーム状態に応じたメッセージ表示
    if (!gameRunning) {
        // 半透明の背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        if (gameState === 'ready') {
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText('スペースキーまたはクリックでゲーム開始', canvas.width / 2, canvas.height / 2);
        } else if (gameState === 'gameOver') {
            ctx.fillStyle = '#ff6b6b';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('ゲームオーバー!', canvas.width / 2, canvas.height / 2 - 30);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText('再開ボタンを押してもう一度プレイ', canvas.width / 2, canvas.height / 2 + 20);
        } else if (gameState === 'stageClear') {
            ctx.fillStyle = '#2ecc71';
            ctx.font = 'bold 36px Arial';
            ctx.fillText(`ステージ ${currentStage} クリア!`, canvas.width / 2, canvas.height / 2 - 30);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText('スペースキーまたはクリックで次のステージへ', canvas.width / 2, canvas.height / 2 + 20);
        } else if (gameState === 'gameWin') {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 36px Arial';
            ctx.fillText('全ステージクリア!', canvas.width / 2, canvas.height / 2 - 30);
            ctx.fillStyle = '#ffffff';
            ctx.font = '18px Arial';
            ctx.fillText('おめでとうございます！', canvas.width / 2, canvas.height / 2 + 20);
        } else if (lives > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '24px Arial';
            ctx.fillText('スペースキーまたはクリックでゲーム開始', canvas.width / 2, canvas.height / 2);
        }
        
        // テキストの設定をリセット
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }
}

// 表示更新
function updateDisplay() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('stage').textContent = currentStage;
    document.getElementById('highScore').textContent = highScore;

    // ハイスコア更新
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('blockoutHighScore', highScore);
        document.getElementById('highScore').textContent = highScore;
    }
}

// ゲームオーバー
function gameOver() {
    gameRunning = false;
    gameState = 'gameOver';
}

// ステージクリア
function stageClear() {
    gameRunning = false;
    gameState = 'stageClear';
    
    // 最終ステージクリアならゲームクリア
    if (currentStage >= maxStages) {
        gameWin();
    }
}

// ゲームクリア
function gameWin() {
    gameRunning = false;
    gameState = 'gameWin';
}

// 次のステージへ進む
function nextStage() {
    currentStage++;
    
    // パドルの幅を10%ずつ減らす
    paddle.width = paddle.initialWidth * (1 - (currentStage - 1) * 0.1);
    paddle.x = canvas.width / 2 - paddle.width / 2;
    
    // ブロックを再生成
    createBlocks();
    resetBall();
    gameState = 'ready';
    gameRunning = false;
    updateDisplay();
}

// ゲーム再開
function restartGame() {
    score = 0;
    lives = 3;
    currentStage = 1;
    gameRunning = false;
    gameState = 'ready';
    combo = 0;

    // パワーアップのクリア
    powerups.length = 0;
    balls.length = 0;
    particles.length = 0;
    ballTrails.length = 0;
    activePowerups.forEach(p => clearTimeout(p.timeout));
    activePowerups.length = 0;

    // パドルの幅を初期値に戻す
    paddle.width = paddle.initialWidth;
    paddle.x = canvas.width / 2 - paddle.width / 2;

    createBlocks();
    resetBall();
    updateDisplay();
}

// メインループ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// イベントリスナー
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        e.preventDefault();
        
        if (gameState === 'stageClear') {
            nextStage();
        } else {
            gameRunning = !gameRunning;
            if (gameRunning && (gameState === 'ready' || gameState === 'gameOver' || gameState === 'gameWin')) {
                gameState = 'playing';
            }
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// マウス操作
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    paddle.x = mouseX - paddle.width / 2;
    
    // パドルが画面外に出ないよう制限
    if (paddle.x < 0) paddle.x = 0;
    if (paddle.x > canvas.width - paddle.width) paddle.x = canvas.width - paddle.width;
});

// マウスクリックでゲーム開始/一時停止
canvas.addEventListener('click', (e) => {
    if (gameState === 'stageClear') {
        nextStage();
    } else {
        gameRunning = !gameRunning;
        if (gameRunning && (gameState === 'ready' || gameState === 'gameOver' || gameState === 'gameWin')) {
            gameState = 'playing';
        }
    }
});

// ゲーム開始
init();