// ===================================
// ===== CONFIGURAÇÕES GLOBAIS =====
// ===================================

const socket = io();
window.socket = socket; // Disponibiliza para o escopo global

let usuarioAtual = null;
let jogoEmJogo = null;
let instanciaJogo = null;
let janelaModalAberta = false;
const PONTOS_POR_GELADINHO = 10;

// ===================================
// ===== CONTROLE DE TELAS =====
// ===================================

function mostrarTela(telaId) {
    document.querySelectorAll('.screen').forEach(tela => tela.classList.remove('active'));
    document.getElementById(telaId).classList.add('active');

    // NOVO: Atualizações específicas ao mostrar telas
    if (telaId === 'shopScreen') {
        atualizarShopDisplay();
    }
    if (telaId === 'profileScreen') {
        atualizarInventarioDisplay();
    }
}

// ===================================
// ===== MODAL DE MENSAGENS =====
// ===================================
// (Seu código original, sem alterações)
function mostrarMensagem(titulo, mensagem, tipoErro = true) {
    document.getElementById('modalTitle').textContent = titulo;
    document.getElementById('modalMessage').textContent = mensagem;
    document.getElementById('modalTitle').style.color = tipoErro ? 'var(--icegurt-red)' : '#00FF00'; // Verde sucesso
    document.getElementById('messageModal').style.display = 'flex';
    janelaModalAberta = true;
    console.log(`[${tipoErro ? 'ERRO' : 'SUCESSO'}] ${titulo}: ${mensagem}`);
}
document.getElementById('modalCloseButton').addEventListener('click', () => {
    document.getElementById('messageModal').style.display = 'none';
    janelaModalAberta = false;
});

// ===================================
// ===== LOGIN E REGISTRO (FLIP) =====
// ===================================
// (Seu código original, sem alterações no flip)
const authCard = document.getElementById('authCard');
document.getElementById('toggleRegister').addEventListener('click', (e) => {
    e.preventDefault();
    authCard.classList.add('is-flipped');
});
document.getElementById('toggleLogin').addEventListener('click', (e) => {
    e.preventDefault();
    authCard.classList.remove('is-flipped');
});

// (Seu código original de Login, com 1 adição)
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value.trim();

    if (!email || !senha) {
        mostrarMensagem('❌ Campos Vazios', 'Por favor, preencha email e senha', true);
        return;
    }
    try {
        console.log('Tentando login com:', email);
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const data = await response.json();

        if (response.ok) {
            // NOVO: Inicializa o inventário se não existir
            data.usuario.inventario = data.usuario.inventario || [];
            
            usuarioAtual = { ...data.usuario, token: data.token };
            localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
            
            atualizarInfoUsuario(); // Atualiza header e inventário
            carregarLeaderboard();
            mostrarTela('mainScreen');
            document.getElementById('loginForm').reset();
            mostrarMensagem('✅ Bem-vindo!', `Login realizado com sucesso, ${usuarioAtual.username}!`, false);
        } else {
            mostrarMensagem('⚠️ Falha no Login', data.message || 'Credenciais inválidas.', true);
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('❌ Erro de Conexão', 'Não foi possível conectar ao servidor.', true);
    }
});

// (Seu código original de Registro, sem alterações)
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('usernameReg').value.trim();
    const email = document.getElementById('emailReg').value.trim();
    const senha = document.getElementById('senhaReg').value.trim();

    if (!username || !email || !senha) {
        mostrarMensagem('❌ Campos Vazios', 'Preencha todos os campos.', true);
        return;
    }
    if (senha.length < 6) {
        mostrarMensagem('⚠️ Senha Fraca', 'A senha deve ter no mínimo 6 caracteres.', true);
        return;
    }
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, senha })
        });
        const data = await response.json();
        if (response.ok) {
            mostrarMensagem('✅ Sucesso!', 'Conta criada! Faça login para continuar.', false);
            setTimeout(() => {
                document.getElementById('messageModal').style.display = 'none';
                janelaModalAberta = false;
                authCard.classList.remove('is-flipped');
            }, 2000);
            document.getElementById('registerForm').reset();
        } else {
            mostrarMensagem('⚠️ Falha no Registro', data.message || 'Email/usuário já existe.', true);
        }
    } catch (error) {
        console.error('Erro:', error);
        mostrarMensagem('❌ Erro de Conexão', 'Não foi possível conectar ao servidor', true);
    }
});

// (Seu código original de Logout, sem alterações)
document.getElementById('btnLogout').addEventListener('click', () => {
    usuarioAtual = null;
    localStorage.removeItem('usuarioAtual');
    mostrarTela('authScreen');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    mostrarMensagem('👋 Até logo!', 'Você foi desconectado com sucesso', false);
});

// ===================================
// ===== PERFIL, LOJA E INVENTÁRIO =====
// ===================================
// (Listeners de navegação originais)
document.getElementById('btnShowProfile').addEventListener('click', () => mostrarTela('profileScreen'));
document.getElementById('btnShowShop').addEventListener('click', () => mostrarTela('shopScreen'));
document.getElementById('btnProfileToMenu').addEventListener('click', () => mostrarTela('mainScreen'));
document.getElementById('btnShopToMenu').addEventListener('click', () => mostrarTela('mainScreen'));
document.getElementById('btnShowDocs').addEventListener('click', () => mostrarTela('docsScreen'));
document.getElementById('btnDocsToMenu').addEventListener('click', () => mostrarTela('mainScreen'));

// Função ATUALIZADA para incluir o inventário
function atualizarInfoUsuario() {
    if (usuarioAtual) {
        // Atualiza Header
        document.getElementById('userGreeting').textContent = `👋 ${usuarioAtual.username}`;
        document.getElementById('userGeladinhos').textContent = `🍦 ${usuarioAtual.geladinhos || 0} Geladinhos`;
        
        // Atualiza a Loja (se estiver visível)
        atualizarShopDisplay();
        
        // Atualiza o Inventário (se estiver visível)
        atualizarInventarioDisplay();
    }
}

// NOVO: Atualiza o display de saldo na loja
function atualizarShopDisplay() {
    if (document.getElementById('shopScreen').classList.contains('active')) {
        const saldoDisplay = document.getElementById('shop-geladinhos-display');
        if (saldoDisplay) {
            saldoDisplay.textContent = usuarioAtual.geladinhos || 0;
        }
        // (Opcional) Desabilitar botões se não tiver saldo
        document.querySelectorAll('.btn-buy').forEach(btn => {
            if (!btn.disabled || btn.textContent === 'Em breve') { // Não re-habilita botões 'Em breve'
                const preco = parseInt(btn.dataset.preco, 10);
                if (usuarioAtual.geladinhos < preco) {
                    btn.disabled = true;
                } else {
                    btn.disabled = false;
                }
            }
        });
    }
}

// NOVO: Atualiza o display do inventário no Perfil
function atualizarInventarioDisplay() {
    if (document.getElementById('profileScreen').classList.contains('active')) {
        const inventoryGrid = document.getElementById('inventory-grid');
        const inventoryStatus = document.getElementById('inventory-status');
        inventoryGrid.innerHTML = ''; // Limpa

        if (!usuarioAtual.inventario || usuarioAtual.inventario.length === 0) {
            inventoryStatus.textContent = 'Você ainda não comprou nenhum item.';
            return;
        }

        inventoryStatus.textContent = ''; // Limpa o status
        const iconMap = {
            'morango': '🍓',
            'chocolate': '🍫',
            'uva': '🍇',
            'skin-dourada': '✨'
        };

        usuarioAtual.inventario.forEach(itemNome => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            
            const itemIcon = document.createElement('div');
            itemIcon.className = 'inventory-item-icon';
            itemIcon.textContent = iconMap[itemNome] || '❓';
            
            const itemName = document.createElement('p');
            itemName.textContent = itemNome.replace('-', ' '); // 'skin-dourada' -> 'skin dourada'
            
            itemDiv.appendChild(itemIcon);
            itemDiv.appendChild(itemName);
            inventoryGrid.appendChild(itemDiv);
        });
    }
}

// ===================================
// ===== LÓGICA DE COMPRA (NOVO) =====
// ===================================
document.querySelectorAll('.btn-buy').forEach(button => {
    button.addEventListener('click', (e) => {
        if (!usuarioAtual) {
            mostrarMensagem('❌ Erro', 'Você precisa estar logado para comprar.', true);
            return;
        }
        
        const itemNome = e.target.dataset.item;
        const itemPreco = parseInt(e.target.dataset.preco, 10);

        // 1. Verificar se já possui o item (opcional, mas bom)
        if (usuarioAtual.inventario && usuarioAtual.inventario.includes(itemNome)) {
            mostrarMensagem('ℹ️ Item já adquirido', 'Você já possui este item no seu inventário.', true);
            return;
        }

        // 2. Verificar saldo
        if (usuarioAtual.geladinhos < itemPreco) {
            mostrarMensagem('❌ Saldo Insuficiente', `Você precisa de ${itemPreco} 🍦 para comprar. Você tem ${usuarioAtual.geladinhos}.`, true);
            return;
        }

        // 3. Efetuar a compra (Lógica do Cliente)
        usuarioAtual.geladinhos -= itemPreco;
        usuarioAtual.inventario.push(itemNome);

        // 4. Atualizar a UI
        atualizarInfoUsuario(); // Isso vai chamar atualizarShopDisplay() e atualizarInventarioDisplay()
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
        mostrarMensagem('✅ Compra Efetuada!', `Você comprou ${itemNome} por ${itemPreco} 🍦!`, false);

        // 5. Enviar para o servidor
        socket.emit('item-comprado', {
            usuarioId: usuarioAtual.id,
            itemNome: itemNome,
            itemPreco: itemPreco,
            geladinhosRestantes: usuarioAtual.geladinhos,
            novoInventario: usuarioAtual.inventario
        });
    });
});


// ===================================
// ===== LEADERBOARD =====
// ===================================
// (Seu código original, sem alterações)
async function carregarLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const rankings = await response.json();
        const leaderboardDiv = document.getElementById('leaderboard');
        leaderboardDiv.innerHTML = '';

        if (rankings.length === 0) {
            document.getElementById('leaderboardStatus').textContent = 'Nenhum jogador ainda 👀';
            return;
        }

        document.getElementById('leaderboardStatus').textContent = '';
        rankings.forEach((item, index) => {
            const medalhas = ['🥇', '🥈', '🥉'];
            const medalha = medalhas[index] || '🏅';
            const itemDiv = document.createElement('div');
            itemDiv.className = 'leaderboard-item info-display'; // Reutilizando sua classe
            itemDiv.innerHTML = `
                <div>${medalha} #${index + 1}</div>
                <div>${item.username}</div>
                <div>${item.high_score || 0} pts</div>`;
            leaderboardDiv.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Erro ao carregar leaderboard:', error);
        document.getElementById('leaderboardStatus').textContent = 'Erro ao carregar ranking ❌';
    }
}
document.getElementById('btnRefreshLeaderboard').addEventListener('click', carregarLeaderboard);

// ===================================
// ===== CARREGAMENTO DE JOGOS (COM TRATAMENTO DE SUBPASTA) =====
// ===================================
function carregarScriptJogo(nomeJogo, callback) {
    const scriptAntigo = document.getElementById('gameScript');
    if (scriptAntigo) scriptAntigo.remove();

    const script = document.createElement('script');
    script.id = 'gameScript';

    let caminhoScript;
    // 💡 NOVO: Lista de jogos que USAM SUBPASTA (como o Pacman e o Flappy Bird já faziam via iframe)
    // O jogo "Asteroids" também usa essa estrutura, mas o Snake não.
    const usaSubpasta = ['Asteroids', 'pacman', 'flappybird'].includes(nomeJogo);

    if (usaSubpasta) {
        // Exemplo: /js/games/asteroids/Asteroids.js
        caminhoScript = `/js/games/${nomeJogo.toLowerCase()}/${nomeJogo}.js`;
    } else {
        // Exemplo: /js/games/snake.js
        caminhoScript = `/js/games/${nomeJogo}.js`;
    }

    script.src = caminhoScript;
    script.async = true;

    script.onload = () => {
        console.log(`Script ${nomeJogo}.js carregado.`);
        callback();
    };
    script.onerror = () => {
        console.error(`Erro ao carregar ${caminhoScript}`);
        mostrarMensagem('❌ Erro de Jogo', `Não foi possível carregar ${nomeJogo}. Verifique o caminho.`, true);
        mostrarTela('mainScreen');
    };

    document.body.appendChild(script);
}


// ===================================
// ===== FUNÇÃO INICIAR PACMAN (NOVA) =====
// ===================================
// Esta função centraliza a lógica de carregar o Pac-Man (iframe)
// É chamada pelo card do jogo E pelo botão "Jogar Novamente"
function iniciarPacman() {
    console.log('Carregando Pac-Man via iframe...');
    jogoEmJogo = 'pacman'; // Define o jogo atual
    document.body.classList.add('game-is-active'); // Ativa o modo tela cheia
    
    mostrarTela('gameScreen');
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = ''; // Limpa a tela (importante para o "Jogar Novamente")

    const iframe = document.createElement('iframe');
    iframe.id = 'gameFrame';
    iframe.src = '/js/games/pacman/index.html'; // Caminho para o index do Pac-Man
    iframe.className = 'game-iframe';
    iframe.frameBorder = 0;
    gameScreenDiv.appendChild(iframe);
    
    const btnVoltarPacman = document.createElement('button');
    btnVoltarPacman.textContent = '📋 Voltar ao Menu';
    btnVoltarPacman.className = 'btn-secondary';
    
    // O CSS (body.game-is-active #gameScreen .btn-secondary) já cuida do posicionamento
    
    btnVoltarPacman.onclick = () => {
        document.body.classList.remove('game-is-active'); // Desativa a tela cheia
        mostrarTela('mainScreen');
        gameScreenDiv.innerHTML = ''; // Limpa o iframe
        
        // A pontuação (se houver) já foi salva pelo 'message' listener
    };
    gameScreenDiv.appendChild(btnVoltarPacman);
}


// ===================================
// ===== FUNÇÃO INICIAR FLAPPYBIRD (NOVA) =====
// ===================================
// Esta função centraliza a lógica de carregar o Flappy Bird (iframe)
function iniciarFlappyBird() {
    console.log('Carregando Flappy Bird via iframe...');
    jogoEmJogo = 'flappybird'; // Define o jogo atual
    document.body.classList.add('game-is-active'); // Ativa o modo tela cheia
    
    mostrarTela('gameScreen');
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = ''; // Limpa a tela

    const iframe = document.createElement('iframe');
    iframe.id = 'gameFrame';
    iframe.src = '/js/games/flappybird/index.html'; // <<< Caminho para o index do Flappy Bird
    iframe.className = 'game-iframe';
    iframe.frameBorder = 0;
    gameScreenDiv.appendChild(iframe);
    
    const btnVoltar = document.createElement('button');
    btnVoltar.textContent = '📋 Voltar ao Menu';
    btnVoltar.className = 'btn-secondary';
    
    btnVoltar.onclick = () => {
        document.body.classList.remove('game-is-active'); 
        mostrarTela('mainScreen');
        gameScreenDiv.innerHTML = ''; 
    };
    gameScreenDiv.appendChild(btnVoltar);
}

// ===================================
// ===== FUNÇÃO INICIAR CS 1.6 (via IFRAME) =====
// ===================================
function iniciarCS16() {
    console.log('Carregando CS 1.6 via iframe...');
    
    // Configura a tela e mostra a gameScreen
    jogoEmJogo = 'cs16'; 
    document.body.classList.add('game-is-active'); 
    mostrarTela('gameScreen');
    
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = ''; // Limpa qualquer conteúdo anterior

    const iframe = document.createElement('iframe');
    iframe.id = 'gameFrameCS';
    iframe.src = 'https://play-cs.com/pt/servers'; 
    iframe.className = 'game-iframe';
    iframe.frameBorder = 0;

    // ⬇️ ⬇️ ⬇️ CORREÇÃO ⬇️ ⬇️ ⬇️
    // As permissões devem ser definidas ANTES de apendar o iframe
    iframe.allow = "fullscreen; clipboard-write; autoplay";
    iframe.sandbox = "allow-scripts allow-same-origin allow-popups allow-forms";
    
    // Apenda o iframe à tela
    gameScreenDiv.appendChild(iframe);
    
    // Cria o botão para voltar ao menu
    const btnVoltar = document.createElement('button');
    btnVoltar.textContent = '📋 Voltar ao Menu Principal';
    btnVoltar.className = 'btn-secondary';
    
    btnVoltar.onclick = () => {
        document.body.classList.remove('game-is-active'); 
        mostrarTela('mainScreen');
        gameScreenDiv.innerHTML = ''; 
    };

    // (Certifique-se de que seu botão 'btnVoltar' está sendo adicionado
    // em algum lugar da página, por exemplo: gameScreenDiv.appendChild(btnVoltar)
    // ou em outro elemento)
    gameScreenDiv.appendChild(btnVoltar); // Exemplo de como adicionar o botão
}
// ===================================
// ===== SELEÇÃO DE JOGOS (ATUALIZADO PARA CS16 E KRUNKER) =====
// ===================================
document.querySelectorAll('.btn-play:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        const jogo = card.dataset.game;

        if (jogo === 'pacman') {
            iniciarPacman();
        } 
        else if (jogo === 'flappybird') {
            iniciarFlappyBird(); 
        } 
        // Adiciona a chamada para o CS 1.6
        else if (jogo === 'cs16') {
             iniciarCS16(); 
        } 
        // 💡 NOVO: Adiciona a chamada para o Krunker.io
        else if (jogo === 'krunker') {
             iniciarKrunker(); 
        } 
        // Lógica para jogos Canvas (Snake e Asteroids)
        else if (jogo === 'snake' || jogo === 'Asteroids') {
            
            document.body.classList.add('game-is-active');
            mostrarTela('gameScreen');

            // Carrega o script do jogo e depois inicia
            carregarScriptJogo(jogo, () => iniciarInstanciaJogo(jogo));
        } 
        else {
            console.warn(`Jogo "${jogo}" não reconhecido.`);
        }
    });
});

// ===================================
// ===== FUNÇÃO INICIAR KRUNKER (via IFRAME) =====
// ===================================
function iniciarKrunker() {
    console.log('Carregando Krunker.io via iframe...');
    
    // Configura a tela e mostra a gameScreen
    jogoEmJogo = 'krunker'; 
    document.body.classList.add('game-is-active'); 
    mostrarTela('gameScreen');
    
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = ''; // Limpa qualquer conteúdo anterior

    const iframe = document.createElement('iframe');
    iframe.id = 'gameFrameKrunker';
    
    // URL principal do Krunker.io
    iframe.src = 'https://krunker.io/'; 
    
    iframe.className = 'game-iframe';
    iframe.frameBorder = 0;
    // Permissões importantes para o FPS rodar melhor:
    iframe.allow = "fullscreen; pointer-lock; gyroscope; accelerometer"; 
    
    gameScreenDiv.appendChild(iframe);
    
    // Cria o botão para voltar ao menu
    const btnVoltar = document.createElement('button');
    btnVoltar.textContent = '📋 Voltar ao Menu Principal';
    btnVoltar.className = 'btn-secondary';
    
    btnVoltar.onclick = () => {
        document.body.classList.remove('game-is-active'); 
        mostrarTela('mainScreen');
        gameScreenDiv.innerHTML = ''; 
    };
    gameScreenDiv.appendChild(btnVoltar);
}

// ===================================
// ===== INICIALIZAÇÃO DE JOGOS CANVAS =====
// ===================================
function iniciarInstanciaJogo(nomeJogo) {

    if (!usuarioAtual) {
        mostrarMensagem('🛑 Sem Usuário', 'Você precisa fazer login para jogar!', true);
        return;
    }

    jogoEmJogo = nomeJogo;
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = '';

    const gameWrapper = document.createElement('div');
    gameWrapper.className = 'game-wrapper';

    const gameCanvasWrapper = document.createElement('div');
    gameCanvasWrapper.id = 'gameContainer';

    const scoreboardDiv = document.createElement('div');
    scoreboardDiv.id = 'game-scoreboard';
    scoreboardDiv.className = 'game-scoreboard';

    // Criar canvas
    const gameCanvas = document.createElement('canvas');
    gameCanvas.id = 'game';
    gameCanvas.width = 800;
    gameCanvas.height = 600;

    gameCanvasWrapper.appendChild(gameCanvas);
    gameWrapper.appendChild(gameCanvasWrapper);
    gameWrapper.appendChild(scoreboardDiv);
    gameScreenDiv.appendChild(gameWrapper);

    // ---- ATUALIZAÇÃO DE SCORE ----
    let geladinhosGanhos = 0;

    let updateScoreDisplay = (score) => {
        const scoreSpan = scoreboardDiv.querySelector('#current-game-score');
        if (scoreSpan) scoreSpan.textContent = score.toLocaleString('pt-BR');

        const novosGeladinhos = Math.floor(score / PONTOS_POR_GELADINHO);

        if (novosGeladinhos > geladinhosGanhos) {
            geladinhosGanhos = novosGeladinhos;
            const geladinhosSpan = scoreboardDiv.querySelector('#geladinhos-ganhos');
            if (geladinhosSpan) geladinhosSpan.textContent = geladinhosGanhos;
        }
    };


    // ---- SCOREBOARD HTML ----
    scoreboardDiv.innerHTML = `
        <h2>PLANTÃO DE PRÊMIOS</h2>

        <div class="current-score">
            SCORE: <span id="current-game-score">0</span>
        </div>

        <p class="prize-info">
            <span id="prize-text">
                A CADA ${PONTOS_POR_GELADINHO.toLocaleString('pt-BR')} PONTOS VOCÊ GANHA 1 🍦!
            </span>
        </p>

        <span class="icegurt-icon">
            🍦 Ganhos: <span id="geladinhos-ganhos">0</span>
        </span>

        <button id="btnVoltarCanvas" class="btn-secondary" style="width: 100%; margin-top: 20px;">
            📋 Voltar ao Menu
        </button>
    `;

    // ---- BOTÃO VOLTAR ----
    // ---- BOTÃO VOLTAR ----
    document.getElementById('btnVoltarCanvas').addEventListener('click', () => {
    document.body.classList.remove('game-is-active');
    mostrarTela('mainScreen');
    
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = '';

    if (instanciaJogo && typeof instanciaJogo.stopGame === 'function') {
        instanciaJogo.stopGame();
    }

    instanciaJogo = null;
    jogoEmJogo = null;

    document.removeEventListener('keydown', handleKeyGame);
});

    // ===================================
    // ===== MAPA DE CLASSES DE JOGO =====
    // ===================================
    const gameMap = {
        'flappybird': typeof FlappyBirdGame !== 'undefined' ? FlappyBirdGame : null,
        'pacman': typeof PacmanGame !== 'undefined' ? PacmanGame : null,
        'Asteroids': typeof Asteroids !== 'undefined' ? Asteroids : null,
        'snake': typeof SnakeGame !== 'undefined' ? SnakeGame : null,
    };

    const ClasseJogo = gameMap[nomeJogo];

    if (!ClasseJogo) {
        mostrarMensagem('❌ Erro', `Jogo ${nomeJogo} não carregou corretamente.`, true);
        mostrarTela('mainScreen');
        document.body.classList.remove('game-is-active');
        return;
    }

    // Inicializa o jogo
    instanciaJogo = new ClasseJogo(gameCanvasWrapper, updateScoreDisplay);
    document.addEventListener('keydown', handleKeyGame);

    // Verifica fim do jogo
    const verificarFim = setInterval(() => {
        if (instanciaJogo && instanciaJogo.gameEnded) {
            clearInterval(verificarFim);
            document.removeEventListener('keydown', handleKeyGame);
            finalizarJogo(instanciaJogo.score, instanciaJogo.gameWon, geladinhosGanhos);
        }
    }, 50);
}


// ===================================
// ===== CONTROLES DO TECLADO =====
// ===================================
function handleKeyGame(e) {
    if (instanciaJogo && instanciaJogo.handleKeyPress && !janelaModalAberta) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        instanciaJogo.handleKeyPress(e.key);
    }
}


// (Função finalizarJogo ATUALIZADA)
function finalizarJogo(score, vitoria, geladinhosGanhos) {
    const gameResultDiv = document.createElement('div');
    gameResultDiv.id = 'gameResult';
    gameResultDiv.className = 'game-result-panel';
    gameResultDiv.style.display = 'block';
    
    const resultTitle = vitoria ? '🎉 VITÓRIA! 🎉' : '💀 GAME OVER 💀';
    
    gameResultDiv.innerHTML = `
        <h2 id="resultTitle">${resultTitle}</h2>
        <p style="margin-top: 20px; color: var(--icegurt-text-dark); font-weight: bold;">Pontuação Final:</p>
        <p id="resultScore" class="result-score">${score.toLocaleString('pt-BR')}</p>
        <p id="resultGeladinhos" style="color: var(--icegurt-red); font-weight: bold; margin: 20px 0;">
            🍦 Você ganhou ${geladinhosGanhos} Geladinhos!
        </p>
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="btnRetry" class="btn-primary">🔄 Jogar Novamente</button>
            <button id="btnMenuFromGame" class="btn-secondary">📋 Voltar ao Menu</button>
        </div>`;

    // Limpa a tela de jogo (seja canvas ou iframe) e mostra o painel de resultado
    const gameScreenDiv = document.getElementById('gameScreen');
    gameScreenDiv.innerHTML = ''; // Limpa tudo
    gameScreenDiv.appendChild(gameResultDiv); // Adiciona só o painel de resultado

    // --- CORREÇÃO: Lógica do "Jogar Novamente" ---
    document.getElementById('btnRetry').addEventListener('click', () => {
        if (jogoEmJogo === 'pacman') {
            // Recarrega o Pac-Man (iframe)
            iniciarPacman();
        } else if (jogoEmJogo === 'flappybird') {
            // --- ADIÇÃO: Recarrega o Flappy Bird (iframe) ---
            iniciarFlappyBird();
        } else if (jogoEmJogo) {
            // Recarrega o jogo de Canvas (Snake, etc.)
            carregarScriptJogo(jogoEmJogo, () => iniciarInstanciaJogo(jogoEmJogo));
        } else {
            document.body.classList.remove('game-is-active'); // Garante que saiu da tela cheia
            mostrarTela('mainScreen');
        }
    });
    
    // --- CORREÇÃO: Lógica do "Voltar ao Menu" ---
    document.getElementById('btnMenuFromGame').addEventListener('click', () => {
        document.body.classList.remove('game-is-active'); // Desativa a tela cheia!
        mostrarTela('mainScreen');
    });
    
    // Envia o score para o servidor
    if (usuarioAtual && score !== undefined) {
        socket.emit('jogo-finalizado', {
            usuarioId: usuarioAtual.id,
            jogo: jogoEmJogo,
            score: Number(score),
            geladinhosGanhos: Number(geladinhosGanhos)
        });
        
        if (geladinhosGanhos > 0) {
            usuarioAtual.geladinhos = (usuarioAtual.geladinhos || 0) + geladinhosGanhos;
            atualizarInfoUsuario();
            localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
        }
        
        setTimeout(() => {
            carregarLeaderboard();
        }, 1000); // 1000ms = 1 segundo de atraso
    }
    
    // Limpa instâncias antigas
    instanciaJogo = null;
    // (Não resetamos 'jogoEmJogo' aqui, pois o 'btnRetry' precisa dele)
}

// ===================================
// ===== SOCKET.IO =====
// ===================================
// (Seu código original, com 1 adição)
socket.on('connect', () => console.log('✅ Conectado ao Socket.IO'));
socket.on('disconnect', () => console.log('❌ Desconectado do Socket.IO'));

socket.on('atualizar-geladinhos', (dados) => {
    if (usuarioAtual && usuarioAtual.id === dados.usuarioId) {
        console.log(`Servidor atualizou geladinhos: ${dados.totalGeladinhos}`);
        usuarioAtual.geladinhos = dados.totalGeladinhos;
        atualizarInfoUsuario();
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
    }
});

// NOVO: Listener para caso o servidor atualize o inventário
socket.on('atualizar-inventario', (dados) => {
    if (usuarioAtual && usuarioAtual.id === dados.usuarioId) {
        console.log('Servidor atualizou inventário');
        usuarioAtual.inventario = dados.inventario;
        usuarioAtual.geladinhos = dados.totalGeladinhos; // Garantir sincronia
        atualizarInfoUsuario();
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
    }
});

// ===================================
// ===== INICIALIZAÇÃO =====
// ===================================
// (Seu código original, com 1 adição)
window.addEventListener('DOMContentLoaded', () => {
    console.log('Página carregada, inicializando...');
    const usuarioSalvo = localStorage.getItem('usuarioAtual');
    if (usuarioSalvo) {
        try {
            usuarioAtual = JSON.parse(usuarioSalvo);
            // NOVO: Garante que o inventário exista
            usuarioAtual.inventario = usuarioAtual.inventario || [];
            
            console.log('Usuário carregado:', usuarioAtual.username);
            atualizarInfoUsuario();
            carregarLeaderboard();
            mostrarTela('mainScreen');
        } catch {
            localStorage.removeItem('usuarioAtual');
            mostrarTela('authScreen');
        }
    } else {
        console.log('Nenhum usuário salvo, mostrando auth');
        mostrarTela('authScreen');
    }
});

// ===================================
// ===== RECEBE SCORE DO IFRAME (PAC-MAN E FLAPPY BIRD) =====
// ===================================

window.addEventListener('message', (event) => {
    // É uma boa prática verificar event.origin se você não usou '*' no postMessage
    // const origemEsperada = 'http://localhost:8000'; 
    // if (event.origin !== origemEsperada) return; 

    const data = event.data;
    let pontos = 0;
    let jogoRecebido = null;

    // Verifica a origem da mensagem
    if (data.tipo === 'PACMAN_SCORE') {
        pontos = data.pontos;
        jogoRecebido = 'pacman';
    } else if (data.tipo === 'FLAPPYBIRD_SCORE') {
        pontos = data.pontos;
        jogoRecebido = 'flappybird';
    } else if (data.tipo === 'ASTEROIDS_SCORE_LIVE') { // <-- INTEGRAÇÃO ASTEROIDS
        pontos = data.pontos;
        jogoRecebido = 'Asteroids';
    }

    // Se recebemos uma pontuação válida de um jogo conhecido
    if (jogoRecebido) {
        console.log(`🏁 Pontuação recebida do ${jogoRecebido}: ${pontos}`);
        
        // Certifique-se de que PONTOS_POR_GELADINHO esteja definido no seu escopo
        const geladinhosGanhos = Math.floor(pontos / PONTOS_POR_GELADINHO);
        const vitoria = false; // Nenhum desses jogos reporta "vitória"
        
        // Define o jogoEmJogo para o contexto de finalizar
        jogoEmJogo = jogoRecebido; 
        
        // Chame a função que você já criou!
        // Isso centraliza a lógica de "fim de jogo"
        finalizarJogo(pontos, vitoria, geladinhosGanhos);
    }
});
