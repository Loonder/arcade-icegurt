class FlappyBirdGame {
    // 🟢 CORREÇÃO 1: Adicionar o parâmetro updateScoreDisplay no constructor
    constructor(container, updateScoreDisplay) { 
        this.container = container;
        // 🟢 CORREÇÃO 2: Armazenar a função de callback
        this.updateScoreDisplay = updateScoreDisplay; 

        this.score = 0;
        this.gameWon = false;
        this.gameEnded = false; 
        this.gameState = 'ready'; 
        this.startTime = 0; 
        this.readyDelay = 3000; 

        this.bird = {
            x: 50, y: 150, width: 30, height: 30, velocity: 0,
            gravity: 0.3, 
            jump: -6, 
            maxVelocity: 6 
        };
        
        this.pipes = [];
        this.pipeWidth = 60;
        this.pipeGap = 130; 
        this.pipeDistance = 250;
        this.pipeSpeed = 2; 
        this.nextPipeX = 400;
        
        this.canvasWidth = 800;
        this.canvasHeight = 400;

        this.init();
    }
    
    // NOVO: Função de Reinicialização Limpa
    resetGame() {
        this.score = 0;
        // 🟢 CORREÇÃO 3: Chamar a atualização no reset para zerar o placar na UI
        if (this.updateScoreDisplay) { 
            this.updateScoreDisplay(this.score);
        }
        this.gameWon = false;
        this.gameEnded = false;
        this.gameState = 'ready';
        this.bird.y = 150;
        this.bird.velocity = 0;
        this.pipes = [];
        this.pipeSpeed = 2;
        this.nextPipeX = 400;
        this.startTime = Date.now();
    }

    init() {
        this.container.innerHTML = '<canvas id="flappyCanvas"></canvas>';
        this.canvas = document.getElementById('flappyCanvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');
        
        this.canvas.addEventListener('mousedown', () => this.handleJump());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e.key));
        
        this.startTime = Date.now(); 
        this.gameLoop();
    }
    
    draw() {
        // ... (Desenho do jogo sem alterações) ...
        const groundHeight = 50;
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F6FF');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        this.ctx.fillStyle = '#228B22';
        this.ctx.fillRect(0, this.canvasHeight - groundHeight, this.canvasWidth, groundHeight);
        
        this.ctx.fillStyle = '#228B22';
        for (const pipe of this.pipes) {
            this.ctx.fillRect(pipe.x, 0, this.pipeWidth, pipe.topHeight);
            this.ctx.fillRect(
                pipe.x, 
                pipe.topHeight + this.pipeGap, 
                this.pipeWidth, 
                this.canvasHeight - this.pipeGap - pipe.topHeight - groundHeight
            );
        }
        
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.fillRect(this.bird.x, this.bird.y, this.bird.width, this.bird.height);
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(this.bird.x + 15, this.bird.y + 8, 6, 6);
        this.ctx.fillStyle = '#FF6B00';
        this.ctx.fillRect(this.bird.x + 25, this.bird.y + 12, 8, 4);
        
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 30px Courier New';
        this.ctx.fillText(`Score: ${this.score}`, 20, 40);
        
        this.ctx.textAlign = 'center';
        
        if (this.gameState === 'ready') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 50px Courier New';
            
            const tempoDecorrido = Date.now() - this.startTime;
            const tempoRestante = Math.ceil((this.readyDelay - tempoDecorrido) / 1000);
            
            if (tempoRestante > 0) {
                this.ctx.fillText(`PREPARE-SE: ${tempoRestante}`, this.canvasWidth / 2, this.canvasHeight / 2);
            } else {
                this.gameState = 'playing';
            }
            this.ctx.font = 'bold 20px Courier New';
            this.ctx.fillText(`Pule para começar!`, this.canvasWidth / 2, this.canvasHeight / 2 + 60);

        } else if (this.gameState === 'gameover') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 50px Courier New';
            const message = this.gameWon ? '🎉 VITÓRIA! 🎉' : '💀 GAME OVER 💀';
            this.ctx.fillText(message, this.canvasWidth / 2, this.canvasHeight / 2 - 30);
            this.ctx.font = 'bold 30px Courier New';
            this.ctx.fillText(`Score final: ${this.score}`, this.canvasWidth / 2, this.canvasHeight / 2 + 30);
            this.ctx.font = 'bold 20px Courier New';
            this.ctx.fillText(`Pressione ESPAÇO ou MOUSE para REJOGAR`, this.canvasWidth / 2, this.canvasHeight / 2 + 80);
        }

        this.ctx.textAlign = 'left';
    }

    update() {
        if (this.gameState !== 'playing') return;

        this.bird.velocity = Math.min(this.bird.velocity + this.bird.gravity, this.bird.maxVelocity);
        this.bird.y += this.bird.velocity;
        
        if (this.pipes.length === 0 || this.pipes[this.pipes.length - 1].x < this.canvasWidth - this.pipeDistance) {
            const topHeight = Math.random() * (this.canvasHeight - this.pipeGap - 150) + 50; 
            this.pipes.push({
                x: this.canvasWidth, 
                topHeight: topHeight,
                scored: false
            });
        }
        
        for (let i = this.pipes.length - 1; i >= 0; i--) {
            const pipe = this.pipes[i];
            pipe.x -= this.pipeSpeed; 

            if (!pipe.scored && pipe.x + this.pipeWidth < this.bird.x) {
                this.score += 10;
                pipe.scored = true;
                this.pipeSpeed += 0.03; 
                // 🟢 CORREÇÃO 4: Chamar o callback APÓS pontuar o cano
                if (this.updateScoreDisplay) { 
                    this.updateScoreDisplay(this.score);
                }
            }

            const groundY = this.canvasHeight - 50;
            const birdRight = this.bird.x + this.bird.width;
            const birdBottom = this.bird.y + this.bird.height;
            const collisionX = birdRight > pipe.x && this.bird.x < pipe.x + this.pipeWidth;

            if (collisionX) {
                const collisionYTop = this.bird.y < pipe.topHeight;
                const collisionYBottom = birdBottom > pipe.topHeight + this.pipeGap;

                if (collisionYTop || collisionYBottom) {
                    this.setGameOver();
                    return;
                }
            }

            if (pipe.x + this.pipeWidth < 0) {
                this.pipes.splice(i, 1);
            }
        }
        
        if (this.bird.y + this.bird.height >= this.canvasHeight - 50 || this.bird.y <= 0) {
            this.setGameOver();
            return;
        }

        if (this.score >= 500) {
            this.gameWon = true;
            this.setGameOver();
        }
    }

    setGameOver() {
        this.gameState = 'gameover';
        this.gameEnded = true;
    }
    
    handleJump() {
        if (this.gameState === 'gameover') {
            this.resetGame();
            this.gameLoop(); 
        } else if (this.gameState === 'ready') {
            this.gameState = 'playing';
            this.bird.velocity = this.bird.jump;
        } else if (this.gameState === 'playing') {
            this.bird.velocity = this.bird.jump;
        }
    }
    
    handleKeyPress(key) {
        if (key === ' ' || key === 'ArrowUp') {
            this.handleJump();
        }
    }
    
    gameLoop() {
        if (this.gameState === 'playing' || this.gameState === 'ready') { 
            this.update();
        }
        
        this.draw();
        
        if (this.gameState !== 'gameover') {
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}