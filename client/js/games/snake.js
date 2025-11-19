class SnakeGame {
    // 🟢 CORREÇÃO 1: Adicionar o parâmetro updateScoreDisplay
    constructor(container, updateScoreDisplay) { 
        this.container = container;
        // 🟢 CORREÇÃO 2: Armazenar a função de callback
        this.updateScoreDisplay = updateScoreDisplay; 
        
        this.tileSize = 20;
        this.gridWidth = 30;
        this.gridHeight = 20;
        
        this.gameEnded = false; // Estado usado pelo app.js para finalizar o jogo
        this.animationFrameId = null; // ID para controlar o requestAnimationFrame

        this.init();
    }
    
    init() {
        // Inicializa o Canvas dentro do container fornecido pelo app.js
        this.container.innerHTML = '<canvas id="snakeCanvas"></canvas>';
        this.canvas = document.getElementById('snakeCanvas');
        this.canvas.width = this.gridWidth * this.tileSize;
        this.canvas.height = this.gridHeight * this.tileSize;
        this.ctx = this.canvas.getContext('2d');
        
        // Inicia ou reseta o jogo
        this.resetGame();
    }

    // 🟢 Adição: Método para parar o loop do jogo
    stopGame() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        this.animationFrameId = null;
        this.gameEnded = true; // Garante que o app.js finalize a instância
    }
    
    // 🟢 CORREÇÃO 3: Adicionar resetGame() para reiniciar o estado e o placar
    resetGame() {
        this.score = 0;
        if (this.updateScoreDisplay) {
            this.updateScoreDisplay(this.score); // Zera o placar na UI
        }
        
        this.gameOver = false;
        this.gameWon = false;
        // Não reseta this.gameEnded aqui, pois o gameLoop ainda não terminou.

        this.snake = [{ x: 15, y: 10 }];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.food = this.generateFood();
        this.speed = 100;
        this.lastUpdate = Date.now();
        
        // Limpa qualquer loop anterior antes de iniciar um novo
        if (this.animationFrameId) {
             cancelAnimationFrame(this.animationFrameId);
        }
        this.gameLoop();
    }
    
    generateFood() {
        let x, y, onSnake;
        do {
            x = Math.floor(Math.random() * this.gridWidth);
            y = Math.floor(Math.random() * this.gridHeight);
            onSnake = this.snake.some(segment => segment.x === x && segment.y === y);
        } while (onSnake);
        return { x, y };
    }
    
    // Método para desenhar a grade (separação de responsabilidade)
    drawGrid() {
        this.ctx.strokeStyle = '#003366';
        this.ctx.lineWidth = 0.5;
        for (let i = 0; i <= this.gridWidth; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.tileSize, 0);
            this.ctx.lineTo(i * this.tileSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= this.gridHeight; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.tileSize);
            this.ctx.lineTo(this.canvas.width, i * this.tileSize);
            this.ctx.stroke();
        }
    }

    draw() {
        // Fundo
        this.ctx.fillStyle = '#000033';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid(); // Chamada ao novo método

        // Cobra
        for (let i = 0; i < this.snake.length; i++) {
            const segment = this.snake[i];
            this.ctx.fillStyle = i === 0 ? '#00FF00' : '#00CC00';
            this.ctx.fillRect(
                segment.x * this.tileSize + 1,
                segment.y * this.tileSize + 1,
                this.tileSize - 2,
                this.tileSize - 2
            );
        }
        
        // Comida
        this.ctx.fillStyle = '#FF0000';
        this.ctx.beginPath();
        this.ctx.arc(
            this.food.x * this.tileSize + this.tileSize / 2,
            this.food.y * this.tileSize + this.tileSize / 2,
            this.tileSize / 2 - 2,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
    }
    
    checkCollisions(newHead) {
        // Colisão com Parede
        if (
            newHead.x < 0 || newHead.x >= this.gridWidth ||
            newHead.y < 0 || newHead.y >= this.gridHeight
        ) {
            return true;
        }
        
        // Colisão consigo mesma
        if (this.snake.some((segment, index) => index > 0 && segment.x === newHead.x && segment.y === newHead.y)) {
            return true;
        }
        
        return false;
    }

    update() {
        this.direction = this.nextDirection;
        
        const head = this.snake[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };
        
        if (this.checkCollisions(newHead)) {
            this.gameOver = true;
            this.gameEnded = true; 
            return;
        }
        
        this.snake.unshift(newHead);
        
        // Comida
        if (newHead.x === this.food.x && newHead.y === this.food.y) {
            this.score += 100;
            // 🟢 CORREÇÃO 4: Chamar o callback APÓS pontuar a comida
            if (this.updateScoreDisplay) { 
                this.updateScoreDisplay(this.score);
            }
            
            this.speed = Math.max(50, this.speed - 2); 
            
            // Verifica Condição de Vitória (mais limpo se estiver em um método separado)
            if (this.snake.length >= this.gridWidth * this.gridHeight * 0.9) {
                this.gameWon = true;
                this.gameEnded = true;
                return;
            }
            this.food = this.generateFood();
        } else {
            this.snake.pop(); 
        }
    }
    
    handleKeyPress(key) {
        if (this.gameOver || this.gameWon) return; 

        const moves = {
            'ArrowUp': { x: 0, y: -1 },
            'ArrowDown': { x: 0, y: 1 },
            'ArrowLeft': { x: -1, y: 0 },
            'ArrowRight': { x: 1, y: 0 },
            'w': { x: 0, y: -1 },
            's': { x: 0, y: 1 },
            'a': { x: -1, y: 0 },
            'd': { x: 1, y: 0 }
        };
        
        if (moves[key]) {
            // Evita movimento reverso instantâneo
            if (!(this.direction.x === -moves[key].x && this.direction.y === -moves[key].y)) {
                this.nextDirection = moves[key];
            }
        }
    }
    
    gameLoop() {
        const now = Date.now();
        
        if (now - this.lastUpdate > this.speed) {
            if (!this.gameOver && !this.gameWon) {
                this.update();
            }
            this.lastUpdate = now;
        }
        
        this.draw();
        
        if (!this.gameOver && !this.gameWon) {
            // Armazena o ID para poder cancelar depois
            this.animationFrameId = requestAnimationFrame(() => this.gameLoop()); 
        }
    }
}