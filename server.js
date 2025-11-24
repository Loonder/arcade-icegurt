// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importar módulos necessários
const express = require('express');
const http = require('http'); 
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Função para gerar IDs (Usando a versão mais robusta e nativa)
const generateId = () => crypto.randomUUID();

// 🚨 CONFIGURAÇÃO 🚨
const PORT = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, 'arcade_icegurt.db');
const PONTOS_POR_GELADINHO = 5000; 
// O JWT_SECRET é lido automaticamente pelo require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET; 

// Inicializar o aplicativo Express
const app = express();
const server = http.createServer(app);

// Configurar o Socket.IO
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// Banco de Dados SQLite
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Criar tabelas e aplicar migrações (CRUCIAL!)
db.serialize(() => {
    // 1. Tabela USUARIOS
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            geladinhos INTEGER DEFAULT 0,
            inventario TEXT DEFAULT '[]', 
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // MIGRACAO CRITICA: Adicionar a coluna inventario a usuários existentes
    // Isso resolve o erro 'no such column: inventario' no login.
    db.run(`
        ALTER TABLE usuarios ADD COLUMN inventario TEXT DEFAULT '[]'
    `, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
            console.error("Erro ao migrar a coluna inventario:", err.message);
        }
    });

    // 2. Tabela SCORES
    db.run(`
        CREATE TABLE IF NOT EXISTS scores (
            id TEXT PRIMARY KEY,
            usuario_id TEXT NOT NULL,
            jogo TEXT NOT NULL,
            score INTEGER NOT NULL,
            data DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);

    // 3. Tabela LEADERBOARD
    db.run(`
        CREATE TABLE IF NOT EXISTS leaderboard (
            id TEXT PRIMARY KEY,
            usuario_id TEXT UNIQUE NOT NULL, 
            total_geladinhos INTEGER DEFAULT 0,
            vitorias INTEGER DEFAULT 0, 
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
    `);
}); // <<-- FECHAR db.serialize() AQUI (corrigido)

// FUNÇÃO HELPER: Busca o usuário completo (inclui inventário)
function getUsuarioCompleto(usuarioId, callback) {
    db.get(
        `SELECT id, username, email, geladinhos, inventario FROM usuarios WHERE id = ?`,
        [usuarioId],
        (err, usuario) => {
            if (err) {
                console.error("Erro ao buscar usuário completo:", err.message);
                return callback(err, null);
            }
            if (usuario) {
                // Tenta analisar o inventário como JSON
                try {
                    usuario.inventario = JSON.parse(usuario.inventario || '[]');
                } catch (e) {
                    usuario.inventario = [];
                    console.error("Erro ao parsear inventário:", e);
                }
            }
            callback(null, usuario);
        }
    );
}

// ===== ROTAS DE AUTENTICAÇÃO =====
app.post('/api/auth/register', (req, res) => {
    const { username, email, senha } = req.body;

    if (!username || !email || !senha) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
    }
    
    if (!JWT_SECRET) {
        console.error('Erro de configuração: JWT_SECRET não definido.');
        return res.status(500).json({ erro: 'Erro interno de configuração do servidor.' });
    }
    
    const id = generateId(); 
    const senhaHash = bcrypt.hashSync(senha, 10);
    
    db.run(
        `INSERT INTO usuarios (id, username, email, senha) VALUES (?, ?, ?, ?)`,
        [id, username, email, senhaHash],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ erro: 'Nome de usuário ou email já cadastrado.' });
                }
                console.error('Erro ao registrar usuário:', err.message);
                return res.status(500).json({ erro: 'Erro interno ao registrar usuário.' });
            }
            
            // Inicializa o registro no leaderboard
            db.run(
                `INSERT INTO leaderboard (id, usuario_id, total_geladinhos, vitorias) VALUES (?, ?, 0, 0)`,
                [generateId(), id]
            );
            
            const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '24h' });
            
            res.status(201).json({
                mensagem: 'Usuário criado com sucesso!',
                token,
                usuario: { id, username, email, geladinhos: 0, inventario: [] }
            });
        }
    );
});

app.post('/api/auth/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
    }

    if (!JWT_SECRET) {
        console.error('Erro de configuração: JWT_SECRET não definido.');
        return res.status(500).json({ erro: 'Erro interno de configuração do servidor.' });
    }

    // Busca dados completos (incluindo inventário e hash de senha)
    db.get(
        `SELECT id, username, email, senha, geladinhos, inventario FROM usuarios WHERE email = ?`,
        [email],
        (err, usuario) => {
            if (err) {
                console.error('Erro ao buscar usuário:', err.message);
                return res.status(500).json({ erro: 'Erro interno ao fazer login.' });
            }
            if (!usuario) {
                return res.status(401).json({ erro: 'Credenciais inválidas.' });
            }
            
            // Checa a senha
            if (!bcrypt.compareSync(senha, usuario.senha)) {
                return res.status(401).json({ erro: 'Credenciais inválidas.' });
            }

            // Transforma inventário string em Array para o cliente
            try {
                usuario.inventario = JSON.parse(usuario.inventario || '[]');
            } catch (e) {
                usuario.inventario = [];
            }
            
            const token = jwt.sign(
                { id: usuario.id, username: usuario.username },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                mensagem: 'Login bem-sucedido!',
                token,
                usuario: {
                    id: usuario.id,
                    username: usuario.username,
                    email: usuario.email,
                    geladinhos: usuario.geladinhos,
                    inventario: usuario.inventario
                }
            });
        }
    );
});

// ===== ROTAS DE LEADERBOARD E SCORES =====
app.get('/api/leaderboard', (req, res) => {
    db.all(
        `SELECT u.username, l.total_geladinhos, l.vitorias 
         FROM leaderboard l 
         JOIN usuarios u ON l.usuario_id = u.id 
         ORDER BY l.total_geladinhos DESC 
         LIMIT 10`,
        (err, rows) => {
            if (err) {
                console.error('Erro ao buscar leaderboard:', err.message);
                return res.status(500).json([]);
            }
            res.json(rows || []);
        }
    );
});

app.get('/api/scores/:usuarioId', (req, res) => {
    const { usuarioId } = req.params;
    db.all(
        `SELECT jogo, score, data FROM scores WHERE usuario_id = ? ORDER BY data DESC`,
        [usuarioId],
        (err, rows) => {
            if (err) {
                console.error('Erro ao buscar scores:', err.message);
                return res.status(500).json({ erro: 'Erro ao buscar scores.' });
            }
            res.json(rows);
        }
    );
});

// ===== DADOS GLOBAIS DA LOJA =====
const SHOP_ITEMS = {
    'morango': 100,
    'chocolate': 150,
    'uva': 120,
    'skin-dourada': 500
};

// ===== SOCKET.IO HANDLERS =====
let jogadoresConectados = {};

io.on('connection', (socket) => {
    console.log('Novo usuário conectado:', socket.id);

    // Evento de Conexão
    socket.on('usuario-conectado', (dados) => {
        if (!dados || !dados.usuarioId || !dados.username || !dados.jogo) {
            console.warn('Dados incompletos em usuario-conectado:', dados);
            return;
        }
        
        jogadoresConectados[socket.id] = {
            socketId: socket.id,
            usuarioId: dados.usuarioId,
            username: dados.username,
            score: 0,
            jogo: dados.jogo,
            conectado: true
        };
    
        io.emit('jogadores-atualizados', jogadoresConectados);
    });

    // Evento de Score em Tempo Real
    socket.on('score-atualizado', (dados) => {
        if (jogadoresConectados[socket.id] && typeof dados.score === 'number') {
            jogadoresConectados[socket.id].score = dados.score;
            io.emit('scores-em-tempo-real', jogadoresConectados);
        }
    });

    // 🚨 NOVO EVENTO: Lógica de Compra (SERVER SIDE)
    socket.on('comprar-item', (dados) => {
        const { usuarioId, itemNome } = dados;

        // 1. Validação básica
        if (!usuarioId || !itemNome || !SHOP_ITEMS[itemNome]) {
            return socket.emit('compra-status', { sucesso: false, message: 'Item ou dados inválidos.' });
        }
        const preco = SHOP_ITEMS[itemNome];

        // 2. Buscar dados do usuário (Importante para segurança)
        getUsuarioCompleto(usuarioId, (err, usuario) => {
            if (err || !usuario) {
                return socket.emit('compra-status', { sucesso: false, message: 'Usuário não encontrado.' });
            }

            // 3. Validação de Saldo e Posse
            if (usuario.inventario.includes(itemNome)) {
                return socket.emit('compra-status', { sucesso: false, message: 'Você já possui este item.' });
            }
            if (usuario.geladinhos < preco) {
                return socket.emit('compra-status', { sucesso: false, message: 'Saldo de Geladinhos insuficiente.' });
            }

            // 4. Efetuar a Compra e Atualizar BD
            const novoSaldo = usuario.geladinhos - preco;
            usuario.inventario.push(itemNome);
            const novoInventarioJSON = JSON.stringify(usuario.inventario);

            db.run(
                `UPDATE usuarios SET geladinhos = ?, inventario = ? WHERE id = ?`,
                [novoSaldo, novoInventarioJSON, usuarioId],
                function(updateErr) {
                    if (updateErr) {
                        console.error("Erro ao finalizar compra:", updateErr.message);
                        return socket.emit('compra-status', { sucesso: false, message: 'Erro interno ao salvar compra.' });
                    }

                    // 5. Enviar sucesso e atualização de volta ao cliente
                    socket.emit('compra-status', { sucesso: true, message: `Compra de ${itemNome} efetuada!` });

                    // Emite a atualização global para sincronizar UI do cliente
                    io.emit('atualizar-inventario', { 
                        usuarioId: usuarioId, 
                        inventario: usuario.inventario, 
                        totalGeladinhos: novoSaldo 
                    });
                }
            );
        });
    });

    // Evento Jogo Finalizado
    socket.on('jogo-finalizado', (dados) => {
        const jogador = jogadoresConectados[socket.id];
        
        if (!jogador || typeof dados.score !== 'number' || !dados.usuarioId || !dados.jogo) {
            console.warn('Dados inválidos em jogo-finalizado:', dados);
            return;
        }
        
        jogador.finalizou = true;
        jogador.pontuacaoFinal = dados.score;
        
        // Calcular Geladinhos ganhos (SERVER SIDE)
        const geladinhosGanhos = Math.floor(dados.score / PONTOS_POR_GELADINHO);
        
        // 1. Salvar o score individual
        db.run(
            `INSERT INTO scores (id, usuario_id, jogo, score) VALUES (?, ?, ?, ?)`,
            [generateId(), dados.usuarioId, dados.jogo, dados.score]
        );

        // 2. Atualizar total de geladinhos do usuário
        db.run(
            `UPDATE usuarios SET geladinhos = geladinhos + ? WHERE id = ?`,
            [geladinhosGanhos, dados.usuarioId],
            function(err) {
                if (err) console.error("Erro ao atualizar geladinhos do usuário:", err.message);
            }
        );
        
        // 3. 🍦 Atualizar/Inserir no Leaderboard (UPSERT manual, mais compatível com SQLite)
        db.get(
            `SELECT usuario_id FROM leaderboard WHERE usuario_id = ?`,
            [dados.usuarioId],
            (err, row) => {
                if (err) {
                    console.error('Erro ao buscar leaderboard para UPSERT:', err.message);
                    return;
                }

                if (row) {
                    // Se existe, fazemos UPDATE
                    db.run(
                        `UPDATE leaderboard 
                         SET total_geladinhos = total_geladinhos + ?, 
                             vitorias = vitorias + 1
                         WHERE usuario_id = ?`,
                        [geladinhosGanhos, dados.usuarioId]
                    );
                } else {
                    // Se não existe, fazemos INSERT
                    db.run(
                        `INSERT INTO leaderboard (id, usuario_id, total_geladinhos, vitorias) 
                         VALUES (?, ?, ?, 1)`,
                        [generateId(), dados.usuarioId, geladinhosGanhos]
                    );
                }
            }
        );

        // Notificação Global (Score e Geladinhos ganhos)
        io.emit('jogo-finalizado-notificacao', {
            vencedor: jogador.username,
            score: dados.score,
            geladinhos: geladinhosGanhos
        });
    });

    // Evento Desconexão
    socket.on('disconnect', () => {
        if (jogadoresConectados[socket.id]) {
            console.log(`Usuário desconectado: ${jogadoresConectados[socket.id].username}`);
            delete jogadoresConectados[socket.id];
            io.emit('jogadores-atualizados', jogadoresConectados);
        }
    });
});

// Fallback para SPA (Rota "catch-all")
app.get(/.*/, (req, res) => { 
    res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// ===== INICIAR SERVIDOR =====
server.listen(PORT, () => {
    console.log(`🎮 Servidor IceGurt rodando em http://localhost:${PORT}`);
    console.log(`🍦 Bem-vindo ao Arcade IceGurt!`);
});

process.on('SIGINT', () => {
    db.close(() => {
        console.log('Conexão com o banco fechada.');
        process.exit(0);
    });
});
