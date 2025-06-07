        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // ゲーム状態
        let gameRunning = false;
        let score = 0;
        let lives = 3;
        let gameState = 'ready'; // 'ready', 'playing', 'gameOver', 'gameWin'
        
        // パドル
        const paddle = {
            x: canvas.width / 2 - 75,
            y: canvas.height - 30,
            width: 150,
            height: 15,
            speed: 8
        };
        
        // ボール
        const ball = {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: 10,
            speedX: 2.5,
            speedY: -2.5,
            maxSpeed: 8
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
        
        // 初期化
        function init() {
            createBlocks();
            resetBall();
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
            ball.speedX = (Math.random() - 0.5) * 3; // -1.5 から 1.5 の範囲
            ball.speedY = 2.5; // 下向きに移動（パドルに向かう）
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
            
            // ボール移動
            ball.x += ball.speedX;
            ball.y += ball.speedY;
            
            // 壁との衝突（位置修正付き）
            if (ball.x + ball.radius > canvas.width) {
                ball.x = canvas.width - ball.radius;
                ball.speedX = -ball.speedX;
            }
            if (ball.x - ball.radius < 0) {
                ball.x = ball.radius;
                ball.speedX = -ball.speedX;
            }
            if (ball.y - ball.radius < 0) {
                ball.y = ball.radius;
                ball.speedY = -ball.speedY;
            }
            
            // パドルとの衝突（改良版）
            if (ball.x >= paddle.x && 
                ball.x <= paddle.x + paddle.width && 
                ball.y + ball.radius >= paddle.y && 
                ball.y + ball.radius <= paddle.y + paddle.height + 10 && 
                ball.speedY > 0) { // 下向きに移動している時のみ
                
                // ボールをパドルの上に配置
                ball.y = paddle.y - ball.radius;
                ball.speedY = -Math.abs(ball.speedY); // 確実に上向きにする
                playPaddleHitSound(); // パドルヒット音
                
                // パドルの端に近いほど角度をつける
                const hitPos = (ball.x - paddle.x) / paddle.width;
                ball.speedX = (hitPos - 0.5) * 5;
                
                // 速度制限
                if (Math.abs(ball.speedX) > ball.maxSpeed) {
                    ball.speedX = ball.speedX > 0 ? ball.maxSpeed : -ball.maxSpeed;
                }
            }
            
            // ブロックとの衝突（改良版）
            for (let block of blocks) {
                if (block.visible) {
                    // ボールの中心がブロックの範囲内にあるかチェック
                    if (ball.x >= block.x - ball.radius && 
                        ball.x <= block.x + block.width + ball.radius && 
                        ball.y >= block.y - ball.radius && 
                        ball.y <= block.y + block.height + ball.radius) {
                        
                        block.visible = false;
                        score += 10;
                        playBlockBreakSound(); // ブロック破壊音
                        
                        // 衝突面を判定して適切に跳ね返す
                        const ballCenterX = ball.x;
                        const ballCenterY = ball.y;
                        const blockCenterX = block.x + block.width / 2;
                        const blockCenterY = block.y + block.height / 2;
                        
                        const deltaX = ballCenterX - blockCenterX;
                        const deltaY = ballCenterY - blockCenterY;
                        
                        // どちら側から衝突したかを判定
                        if (Math.abs(deltaX / block.width) > Math.abs(deltaY / block.height)) {
                            // 左右からの衝突
                            ball.speedX = -ball.speedX;
                            // 位置修正
                            if (deltaX > 0) {
                                ball.x = block.x + block.width + ball.radius;
                            } else {
                                ball.x = block.x - ball.radius;
                            }
                        } else {
                            // 上下からの衝突
                            ball.speedY = -ball.speedY;
                            // 位置修正
                            if (deltaY > 0) {
                                ball.y = block.y + block.height + ball.radius;
                            } else {
                                ball.y = block.y - ball.radius;
                            }
                        }
                        
                        // 速度を少し上げる
                        ball.speedX *= 1.01;
                        ball.speedY *= 1.01;
                        break;
                    }
                }
            }
            
            // ボールが下に落ちた
            if (ball.y + ball.radius > canvas.height) {
                lives--;
                if (lives > 0) {
                    resetBall();
                    gameRunning = false;
                    setTimeout(() => gameRunning = true, 1000);
                } else {
                    gameOver();
                }
            }
            
            // 勝利条件
            if (blocks.every(block => !block.visible)) {
                gameWin();
            }
            
            updateDisplay();
        }
        
        // 描画
        function draw() {
            // 背景クリア
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // パドル描画
            const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x, paddle.y + paddle.height);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, '#cccccc');
            ctx.fillStyle = gradient;
            ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
            
            // ボール描画
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.closePath();
            
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
                } else if (gameState === 'gameWin') {
                    ctx.fillStyle = '#2ecc71';
                    ctx.font = 'bold 36px Arial';
                    ctx.fillText('ゲームクリア!', canvas.width / 2, canvas.height / 2 - 30);
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
        }
        
        // ゲームオーバー
        function gameOver() {
            gameRunning = false;
            gameState = 'gameOver';
        }
        
        // ゲームクリア
        function gameWin() {
            gameRunning = false;
            gameState = 'gameWin';
        }
        
        // ゲーム再開
        function restartGame() {
            score = 0;
            lives = 3;
            gameRunning = false;
            gameState = 'ready';
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
                gameRunning = !gameRunning;
                if (gameRunning && (gameState === 'ready' || gameState === 'gameOver' || gameState === 'gameWin')) {
                    gameState = 'playing';
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
            gameRunning = !gameRunning;
            if (gameRunning && (gameState === 'ready' || gameState === 'gameOver' || gameState === 'gameWin')) {
                gameState = 'playing';
            }
        });
        
        // ゲーム開始
        init();
