// ===================================
// ===== CONFIGURAÇÕES GLOBAIS =====
// ===================================

const socket = io();
window.socket = socket; // Disponibiliza para o escopo global

let usuarioAtual = null;
let jogoEmJogo = null;
let instanciaJogo = null;
let janelaModalAberta = false;
const PONTOS_POR_GELADINHO = 2000; 

// ===================================
// ===== CONTROLE DE TELAS =====
// ===================================

function mostrarTela(telaId) {
    document.querySelectorAll('.screen').forEach(tela => tela.classList.remove('active'));
    const telaAlvo = document.getElementById(telaId);
    if(telaAlvo) telaAlvo.classList.add('active');

    if (telaId === 'shopScreen') {
        atualizarShopDisplay();
    }
    if (telaId === 'profileScreen') {
        atualizarInventarioDisplay();
    }
}

// Função Auxiliar para esconder/mostrar o botão fixo do topo
function alternarBotaoFixo(mostrar) {
    const btn = document.getElementById('btnMenuFromGame');
    if (btn) {
        if (mostrar) {
            // Remove o inline style para voltar a usar o CSS original (flex)
            btn.style.removeProperty('display'); 
        } else {
            // Força o desaparecimento com prioridade máxima para vencer o !important do CSS
            btn.style.setProperty('display', 'none', 'important'); 
        }
    }
}

// ===================================
// ===== MODAL DE MENSAGENS =====
// ===================================
function mostrarMensagem(titulo, mensagem, tipoErro = true) {
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const messageModal = document.getElementById('messageModal');

    if(modalTitle && modalMessage && messageModal) {
        modalTitle.textContent = titulo;
        modalMessage.textContent = mensagem;
        modalTitle.style.color = tipoErro ? 'var(--icegurt-red)' : '#00FF00';
        messageModal.style.display = 'flex';
        janelaModalAberta = true;
    }
    console.log(`[${tipoErro ? 'ERRO' : 'SUCESSO'}] ${titulo}: ${mensagem}`);
}

const btnCloseModal = document.getElementById('modalCloseButton');
if(btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
        document.getElementById('messageModal').style.display = 'none';
        janelaModalAberta = false;
    });
}

// ===================================
// ===== LOGIN E REGISTRO (FLIP) =====
// ===================================
const authCard = document.getElementById('authCard');
if(authCard) {
    document.getElementById('toggleRegister').addEventListener('click', (e) => {
        e.preventDefault();
        authCard.classList.add('is-flipped');
    });
    document.getElementById('toggleLogin').addEventListener('click', (e) => {
        e.preventDefault();
        authCard.classList.remove('is-flipped');
    });
}

// Login
const loginForm = document.getElementById('loginForm');
if(loginForm) {
    loginForm.addEventListener('submit', async (e) => {
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
                data.usuario.inventario = data.usuario.inventario || [];
                usuarioAtual = { ...data.usuario, token: data.token };
                localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
                
                atualizarInfoUsuario();
                carregarLeaderboard();
                mostrarTela('mainScreen');
                loginForm.reset();
                mostrarMensagem('✅ Bem-vindo!', `Login realizado com sucesso, ${usuarioAtual.username}!`, false);
            } else {
                mostrarMensagem('⚠️ Falha no Login', data.message || 'Credenciais inválidas.', true);
            }
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem('❌ Erro de Conexão', 'Não foi possível conectar ao servidor.', true);
        }
    });
}

// Registro
const registerForm = document.getElementById('registerForm');
if(registerForm) {
    registerForm.addEventListener('submit', async (e) => {
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
                    if(authCard) authCard.classList.remove('is-flipped');
                }, 2000);
                registerForm.reset();
            } else {
                mostrarMensagem('⚠️ Falha no Registro', data.message || 'Email/usuário já existe.', true);
            }
        } catch (error) {
            console.error('Erro:', error);
            mostrarMensagem('❌ Erro de Conexão', 'Não foi possível conectar ao servidor', true);
        }
    });
}

// Logout
const btnLogout = document.getElementById('btnLogout');
if(btnLogout) {
    btnLogout.addEventListener('click', () => {
        usuarioAtual = null;
        localStorage.removeItem('usuarioAtual');
        mostrarTela('authScreen');
        if(loginForm) loginForm.reset();
        if(registerForm) registerForm.reset();
        mostrarMensagem('👋 Até logo!', 'Você foi desconectado com sucesso!', false);
    });
}

// ===================================
// ===== PERFIL, LOJA E INVENTÁRIO (UI) =====
// ===================================
function setupNav(btnId, screenId) {
    const btn = document.getElementById(btnId);
    if(btn) btn.addEventListener('click', () => mostrarTela(screenId));
}

setupNav('btnShowProfile', 'profileScreen');
setupNav('btnShowShop', 'shopScreen');
setupNav('btnProfileToMenu', 'mainScreen');
setupNav('btnShopToMenu', 'mainScreen');
setupNav('btnShowDocs', 'docsScreen');
setupNav('btnDocsToMenu', 'mainScreen');

function atualizarInfoUsuario() {
    if (usuarioAtual) {
        const greeting = document.getElementById('userGreeting');
        const geladinhos = document.getElementById('userGeladinhos');
        if(greeting) greeting.textContent = `👋 ${usuarioAtual.username}`;
        if(geladinhos) geladinhos.textContent = `🍦 ${usuarioAtual.geladinhos || 0} Geladinhos`;
        
        atualizarShopDisplay();
        atualizarInventarioDisplay();
    }
}

function atualizarShopDisplay() {
    const shopScreen = document.getElementById('shopScreen');
    if (shopScreen && shopScreen.classList.contains('active')) {
        const saldoDisplay = document.getElementById('shop-geladinhos-display');
        if (saldoDisplay) saldoDisplay.textContent = usuarioAtual.geladinhos || 0;
        
        document.querySelectorAll('.btn-buy').forEach(btn => {
            const preco = parseInt(btn.dataset.preco, 10);
            if (usuarioAtual.geladinhos < preco && btn.textContent !== 'Em breve') {
                btn.disabled = true;
            } else if (btn.textContent !== 'Em breve') {
                btn.disabled = false;
            }
        });
    }
}

function atualizarInventarioDisplay() {
    const profileScreen = document.getElementById('profileScreen');
    if (profileScreen && profileScreen.classList.contains('active')) {
        const inventoryGrid = document.getElementById('inventory-grid');
        const inventoryStatus = document.getElementById('inventory-status');
        inventoryGrid.innerHTML = ''; 

        if (!usuarioAtual.inventario || usuarioAtual.inventario.length === 0) {
            inventoryStatus.textContent = 'Você ainda não comprou nenhum item.';
            return;
        }

        inventoryStatus.textContent = '';
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
            itemName.textContent = itemNome.replace('-', ' ');
            
            itemDiv.appendChild(itemIcon);
            itemDiv.appendChild(itemName);
            inventoryGrid.appendChild(itemDiv);
        });
    }
}

// ===================================
// ===== LÓGICA DE COMPRA (SERVIDOR) =====
// ===================================
document.querySelectorAll('.btn-buy').forEach(button => {
    button.addEventListener('click', (e) => {
        if (!usuarioAtual) {
            mostrarMensagem('❌ Erro', 'Você precisa estar logado para comprar.', true);
            return;
        }
        
        const itemNome = e.target.dataset.item;
        const itemPreco = parseInt(e.target.dataset.preco, 10);

        if (usuarioAtual.inventario && usuarioAtual.inventario.includes(itemNome)) {
            mostrarMensagem('ℹ️ Item já adquirido', 'Você já possui este item no seu inventário.', true);
            return;
        }
        if (usuarioAtual.geladinhos < itemPreco) {
            mostrarMensagem('❌ Saldo Insuficiente', `Você precisa de ${itemPreco} 🍦.`, true);
            return;
        }

        mostrarMensagem('⏳ Processando Compra', `Aguarde, comprando ${itemNome}...`, false);

        socket.emit('comprar-item', { 
            usuarioId: usuarioAtual.id,
            itemNome: itemNome
        });
    });
});

// ===================================
// ===== LEADERBOARD =====
// ===================================
async function carregarLeaderboard() {
    try {
        const response = await fetch('/api/leaderboard');
        const rankings = await response.json();
        const leaderboardDiv = document.getElementById('leaderboard');
        if(!leaderboardDiv) return;

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
            itemDiv.className = 'leaderboard-item info-display';
            itemDiv.innerHTML = `
                <div>${medalha} #${index + 1}</div>
                <div>${item.username}</div>
                <div>${item.high_score || 0} pts</div>`;
            leaderboardDiv.appendChild(itemDiv);
        });
    } catch (error) {
        console.error('Erro ao carregar leaderboard:', error);
        const status = document.getElementById('leaderboardStatus');
        if(status) status.textContent = 'Erro ao carregar ranking ❌';
    }
}
const btnRefresh = document.getElementById('btnRefreshLeaderboard');
if(btnRefresh) btnRefresh.addEventListener('click', carregarLeaderboard);

// ===================================
// ===== CARREGAMENTO DE JOGOS =====
// ===================================
function carregarScriptJogo(nomeJogo, callback) {
    const scriptAntigo = document.getElementById('gameScript');
    if (scriptAntigo) scriptAntigo.remove();

    const script = document.createElement('script');
    script.id = 'gameScript';

    let caminhoScript;
    const usaSubpasta = ['Asteroids', 'pacman', 'flappybird'].includes(nomeJogo);

    if (usaSubpasta) {
        caminhoScript = `/js/games/${nomeJogo.toLowerCase()}/${nomeJogo}.js`;
    } else {
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

// Funções de Inicialização de IFRAME
function criarGameIframe(src, id, allow = null) {
    // Limpa apenas o container
    const gameContainer = document.getElementById('gameContainer');
    if(gameContainer) {
        gameContainer.innerHTML = ''; 

        const iframe = document.createElement('iframe');
        iframe.id = id;
        iframe.src = src;
        iframe.className = 'game-iframe';
        iframe.frameBorder = 0;
        
        // CSS inline para garantir tamanho
        iframe.style.width = "100%";
        iframe.style.height = "100vh";

        if (allow) iframe.allow = allow;
        gameContainer.appendChild(iframe);
    }
}

function iniciarPacman() {
    console.log('Carregando Pac-Man via iframe...');
    jogoEmJogo = 'pacman';
    document.body.classList.add('game-is-active');
    mostrarTela('gameScreen');
    alternarBotaoFixo(true); // Garante que o botão apareça ao iniciar
    criarGameIframe('/js/games/pacman/index.html', 'gameFrame');
}

function iniciarFlappyBird() {
    console.log('Carregando Flappy Bird via iframe...');
    jogoEmJogo = 'flappybird';
    document.body.classList.add('game-is-active');
    mostrarTela('gameScreen');
    alternarBotaoFixo(true);
    criarGameIframe('/js/games/flappybird/index.html', 'gameFrame');
}

function iniciarCS16() {
    console.log('Carregando CS 1.6 via iframe...');
    jogoEmJogo = 'cs16';
    document.body.classList.add('game-is-active');
    mostrarTela('gameScreen');
    alternarBotaoFixo(true);
    criarGameIframe('https://play-cs.com/pt/servers', 'gameFrameCS', "fullscreen; clipboard-write; autoplay");
}

function iniciarKrunker() {
    console.log('Carregando Krunker.io via iframe...');
    jogoEmJogo = 'krunker';
    document.body.classList.add('game-is-active');
    mostrarTela('gameScreen');
    alternarBotaoFixo(true);
    criarGameIframe('https://krunker.io/', 'gameFrameKrunker', "fullscreen; pointer-lock; gyroscope; accelerometer");
}

// Seleção de Jogos (Listener)
document.querySelectorAll('.btn-play:not([disabled])').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        const jogo = card.dataset.game;

        if (jogo === 'pacman') {
            iniciarPacman();
        } else if (jogo === 'flappybird') {
            iniciarFlappyBird();
        } else if (jogo === 'cs16') {
            iniciarCS16();
        } else if (jogo === 'krunker') {
            iniciarKrunker();
        } else if (jogo === 'snake' || jogo === 'Asteroids') {
            document.body.classList.add('game-is-active');
            mostrarTela('gameScreen');
            carregarScriptJogo(jogo, () => iniciarInstanciaJogo(jogo));
        } else {
            console.warn(`Jogo "${jogo}" não reconhecido.`);
        }
    });
});

// ===================================
// ===== INICIALIZAÇÃO DE JOGOS CANVAS (Snake, Asteroids) =====
// ===================================
function iniciarInstanciaJogo(nomeJogo) {

    if (!usuarioAtual) {
        mostrarMensagem('🛑 Sem Usuário', 'Você precisa fazer login para jogar!', true);
        return;
    }

    jogoEmJogo = nomeJogo;
    alternarBotaoFixo(true); // Mostra botão ao iniciar

    const gameContainer = document.getElementById('gameContainer');
    if(gameContainer) gameContainer.innerHTML = '';

    const gameWrapper = document.createElement('div');
    gameWrapper.className = 'game-wrapper';

    const gameCanvasWrapper = document.createElement('div');
    gameCanvasWrapper.id = 'gameCanvasContainer';

    const scoreboardDiv = document.createElement('div');
    scoreboardDiv.id = 'game-scoreboard';
    scoreboardDiv.className = 'game-scoreboard';

    const gameCanvas = document.createElement('canvas');
    gameCanvas.id = 'game';
    gameCanvas.width = 800;
    gameCanvas.height = 600;

    gameCanvasWrapper.appendChild(gameCanvas);
    gameWrapper.appendChild(gameCanvasWrapper);
    gameWrapper.appendChild(scoreboardDiv);
    gameContainer.appendChild(gameWrapper);

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

    // Listener para o botão de voltar interno do Canvas
    document.getElementById('btnVoltarCanvas').addEventListener('click', () => {
        voltarParaMenuPrincipal();
    });

    const gameMap = {
        'Asteroids': typeof Asteroids !== 'undefined' ? Asteroids : null,
        'snake': typeof SnakeGame !== 'undefined' ? SnakeGame : null,
    };

    const ClasseJogo = gameMap[nomeJogo];

    if (!ClasseJogo) {
        mostrarMensagem('❌ Erro', `Jogo ${nomeJogo} não carregou corretamente.`, true);
        voltarParaMenuPrincipal();
        return;
    }

    instanciaJogo = new ClasseJogo(gameCanvasWrapper, updateScoreDisplay); 
    document.addEventListener('keydown', handleKeyGame);

    const verificarFim = setInterval(() => {
        if (instanciaJogo && instanciaJogo.gameEnded) {
            clearInterval(verificarFim);
            document.removeEventListener('keydown', handleKeyGame);
            finalizarJogo(instanciaJogo.score, instanciaJogo.gameWon, geladinhosGanhos);
        }
    }, 50);
}

function handleKeyGame(e) {
    if (instanciaJogo && instanciaJogo.handleKeyPress && !janelaModalAberta) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        instanciaJogo.handleKeyPress(e.key);
    }
}

// =================================================
// 🏁 FUNÇÃO FINALIZAR JOGO (CORRIGIDA)
// =================================================

function finalizarJogo(score, vitoria, geladinhosGanhos) {
    // 1. Esconde o botão fixo do topo
    alternarBotaoFixo(false); 

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
        <div class="result-buttons">
            <button id="btnPlayAgain" class="btn-primary">🔄 Jogar Novamente</button>
            <button id="btnMenuFromResult" class="btn-secondary">📋 Voltar ao Menu</button>
        </div>
    `;

    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) {
        gameContainer.innerHTML = ''; 
        gameContainer.appendChild(gameResultDiv);
    }

    document.getElementById('btnPlayAgain').addEventListener('click', () => {
        // Reexibe o botão ao reiniciar
        alternarBotaoFixo(true);

        if (jogoEmJogo === 'pacman') {
            iniciarPacman();
        } else if (jogoEmJogo === 'flappybird') {
            iniciarFlappyBird();
        } else if (jogoEmJogo === 'cs16') {
            iniciarCS16();
        } else if (jogoEmJogo === 'krunker') {
            iniciarKrunker();
        } else if (jogoEmJogo) {
            carregarScriptJogo(jogoEmJogo, () => iniciarInstanciaJogo(jogoEmJogo));
        } else {
            voltarParaMenuPrincipal();
        }
    });
    
    document.getElementById('btnMenuFromResult').addEventListener('click', () => {
        voltarParaMenuPrincipal();
    });

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
        }, 1000);
    }
    
    instanciaJogo = null;
}

// ===================================
// ===== SOCKET.IO HANDLERS =====
// ===================================

socket.on('connect', () => console.log('✅ Conectado ao Socket.IO'));
socket.on('disconnect', () => console.log('❌ Desconectado do Socket.IO'));

socket.on('compra-status', (dados) => {
    if (dados.sucesso) {
        mostrarMensagem('✅ Compra Efetuada!', dados.message, false);
    } else {
        mostrarMensagem('❌ Falha na Compra', dados.message, true);
    }
});

socket.on('atualizar-geladinhos', (dados) => {
    if (usuarioAtual && usuarioAtual.id === dados.usuarioId) {
        usuarioAtual.geladinhos = dados.totalGeladinhos;
        atualizarInfoUsuario();
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
    }
});

socket.on('atualizar-inventario', (dados) => {
    if (usuarioAtual && usuarioAtual.id === dados.usuarioId) {
        usuarioAtual.inventario = dados.inventario;
        usuarioAtual.geladinhos = dados.totalGeladinhos;
        atualizarInfoUsuario();
        localStorage.setItem('usuarioAtual', JSON.stringify(usuarioAtual));
    }
});

// ===================================
// ===== RECEBE SCORE DO IFRAME (postMessage) =====
// ===================================

window.addEventListener('message', (event) => {
    const data = event.data;
    let pontos = 0;
    let jogoRecebido = null;

    if (data.tipo === 'PACMAN_SCORE') {
        pontos = data.pontos;
        jogoRecebido = 'pacman';
    } else if (data.tipo === 'FLAPPYBIRD_SCORE') {
        pontos = data.pontos;
        jogoRecebido = 'flappybird';
    } else if (data.tipo === 'ASTEROIDS_SCORE_LIVE') { 
        pontos = data.pontos;
        jogoRecebido = 'Asteroids';
    }

    if (jogoRecebido) {
        const geladinhosGanhos = Math.floor(pontos / PONTOS_POR_GELADINHO);
        const vitoria = false;
        jogoEmJogo = jogoRecebido;
        finalizarJogo(pontos, vitoria, geladinhosGanhos);
    }
});

// =================================================
// 🔄 FUNÇÃO AUXILIAR: VOLTAR AO MENU (GLOBAL)
// =================================================
function voltarParaMenuPrincipal() {
    console.log("Voltando ao menu...");
    
    // Garante que o botão fixo reapareça ao sair do jogo
    alternarBotaoFixo(true); 

    const gameContainer = document.getElementById('gameContainer');
    if (gameContainer) gameContainer.innerHTML = ''; 

    const gameScreen = document.getElementById('gameScreen');
    gameScreen.classList.remove('active');
    
    document.body.classList.remove('game-is-active');
    mostrarTela('mainScreen');
    
    jogoEmJogo = null;
    instanciaJogo = null;
    document.removeEventListener('keydown', handleKeyGame);
}

// =================================================
// 📱 DETECÇÃO MOBILE E BLOQUEIO DE JOGOS
// =================================================
function verificarDispositivoEBloquearJogos() {
    const isMobile = window.innerWidth <= 768; 
    const gameCards = document.querySelectorAll('.game-card');

    gameCards.forEach(card => {
        const gameName = card.getAttribute('data-game');
        const btnJogar = card.querySelector('.btn-play');

        if (isMobile && gameName !== 'flappybird') {
            card.classList.add('mobile-disabled');
            if (btnJogar) {
                btnJogar.textContent = "Disponível no PC";
                btnJogar.disabled = true; 
            }
            card.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                alert("Este jogo precisa de teclado e mouse! Jogue o Flappy Bird :)");
            };
        } else {
            card.classList.remove('mobile-disabled');
            if (btnJogar) {
                btnJogar.textContent = "JOGAR";
                btnJogar.disabled = false;
            }
            card.onclick = null;
        }
    });
}

// ===================================
// ===== INICIALIZAÇÃO DA PÁGINA =====
// ===================================
window.addEventListener('DOMContentLoaded', () => {
    console.log('Página carregada, inicializando...');
    
    // Listener do Botão Fixo Global
    const btnFixo = document.getElementById('btnMenuFromGame');
    if (btnFixo) {
        const novoBtn = btnFixo.cloneNode(true);
        btnFixo.parentNode.replaceChild(novoBtn, btnFixo);
        novoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            voltarParaMenuPrincipal();
        });
    }

    const usuarioSalvo = localStorage.getItem('usuarioAtual');
    if (usuarioSalvo) {
        try {
            usuarioAtual = JSON.parse(usuarioSalvo);
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

window.addEventListener('load', verificarDispositivoEBloquearJogos);
window.addEventListener('resize', verificarDispositivoEBloquearJogos);