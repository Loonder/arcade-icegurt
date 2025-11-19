// Carregar variáveis de ambiente do arquivo .env
require('dotenv').config();

// Importar módulos necessários
const express = require('express');
const http = require = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// 🚨 CORREÇÃO 1: Definir PORT e dbPath (se não estiverem no .env)
const PORT = process.env.PORT || 3000;
const dbPath = process.env.DB_PATH || path.join(__dirname, 'arcade_icegurt.db'); 

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

// Criar tabelas
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      geladinhos INTEGER DEFAULT 0,
      inventario TEXT DEFAULT '[]', -- Novo: Inventário como JSON string
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
  // Tabela Leaderboard (apenas para scores globais/total de geladinhos)
  db.run(`
    CREATE TABLE IF NOT EXISTS leaderboard (
      id TEXT PRIMARY KEY,
      usuario_id TEXT UNIQUE NOT NULL, 
      total_geladinhos INTEGER DEFAULT 0,
      vitarias INTEGER DEFAULT 0,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);
});

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

  // Validação
  if (!username || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios.' });
  }
  
  const id = uuidv4();
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error('Erro de configuração: JWT_SECRET não definido.');
      return res.status(500).json({ erro: 'Erro interno de configuração do servidor.' });
  }

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
        `INSERT INTO leaderboard (id, usuario_id, total_geladinhos, vitarias) VALUES (?, ?, 0, 0)`,
        [uuidv4(), id]
      );
      
      const token = jwt.sign({ id, username }, jwtSecret, { expiresIn: '24h' });
      
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

  // Validação
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
      console.error('Erro de configuração: JWT_SECRET não definido.');
      return res.status(500).json({ erro: 'Erro interno de configuração do servidor.' });
  }

  // Busca dados completos (incluindo inventário)
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
        jwtSecret,
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

// ===== ROTAS DE LEADERBOARD (CORRIGIDA) =====
app.get('/api/leaderboard', (req, res) => {
  // Esta query estava correta. O erro 500 era causado pela query do UPSERT
  // dentro do Socket.IO (ver abaixo), que falhava antes.
  db.all(
    `SELECT u.username, l.total_geladinhos, l.vitarias 
     FROM leaderboard l 
     JOIN usuarios u ON l.usuario_id = u.id 
     ORDER BY l.total_geladinhos DESC 
     LIMIT 10`,
    (err, rows) => {
      if (err) {
        console.error('Erro ao buscar leaderboard:', err.message);
        // Em caso de erro, retorna um array vazio (e loga o erro no servidor)
        return res.status(500).json([]);
      }
      // Retorna os dados, ou um array vazio se não houver linhas.
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

// ===== SOCKET.IO =====
let jogadoresConectados = {};

// LISTA DE ITENS DA LOJA (PARA VALIDAÇÃO NO SERVIDOR)
const SHOP_ITEMS = {
    'morango': 100,
    'chocolate': 150,
    'uva': 120,
    'skin-dourada': 500
};


io.on('connection', (socket) => {
  console.log('Novo usuário conectado:', socket.id);
  // ... (código de conexão e score-atualizado permanece o mesmo) ...

  // 🚨 NOVO EVENTO: Lógica de Compra (SERVER SIDE)
  socket.on('comprar-item', (dados) => {
    const { usuarioId, itemNome } = dados;

    // 1. Validação básica
    if (!usuarioId || !itemNome || !SHOP_ITEMS[itemNome]) {
      return socket.emit('compra-status', { sucesso: false, message: 'Item ou dados inválidos.' });
    }
    const preco = SHOP_ITEMS[itemNome];

    // 2. Buscar dados do usuário (Importante: a busca deve ser sempre feita antes de operações financeiras)
    getUsuarioCompleto(usuarioId, (err, usuario) => {
        if (err || !usuario) {
            return socket.emit('compra-status', { sucesso: false, message: 'Usuário não encontrado.' });
        }

        // 3. Validação de Saldo e Posse (SERVER SIDE)
        if (usuario.inventario.includes(itemNome)) {
            return socket.emit('compra-status', { sucesso: false, message: 'Você já possui este item.' });
        }
        if (usuario.geladinhos < preco) {
            return socket.emit('compra-status', { sucesso: false, message: 'Saldo de Geladinhos insuficiente.' });
        }

        // 4. Efetuar a Compra
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
    
    // Validação
    if (!jogador || typeof dados.score !== 'number' || !dados.usuarioId || !dados.jogo) {
      console.warn('Dados inválidos em jogo-finalizado:', dados);
      return;
    }
    
    jogador.finalizou = true;
    jogador.pontuacaoFinal = dados.score;
    
    // 1. Salvar o score individual
    db.run(
      `INSERT INTO scores (id, usuario_id, jogo, score) VALUES (?, ?, ?, ?)`,
      [uuidv4(), dados.usuarioId, dados.jogo, dados.score]
    );

    // 2. Atualizar total de geladinhos do usuário (apenas pontuação, já que o geladinho é calculado no cliente)
    // 🚨 ATENÇÃO: Se PONTOS_POR_GELADINHO não for 1, a lógica aqui deve ser ajustada
    const geladinhosGanhos = Math.floor(dados.score / 5000); // 5000 é o valor padrão do seu frontend
    
    db.run(
      `UPDATE usuarios SET geladinhos = geladinhos + ? WHERE id = ?`,
      [geladinhosGanhos, dados.usuarioId]
    );
    
    // 3. 🍦 Atualizar/Inserir no Leaderboard (CORRIGIDO: usando busca/update/insert)
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
                         vitarias = vitarias + 1
                     WHERE usuario_id = ?`,
                    [geladinhosGanhos, dados.usuarioId]
                );
            } else {
                // Se não existe, fazemos INSERT
                db.run(
                    `INSERT INTO leaderboard (id, usuario_id, total_geladinhos, vitarias) 
                     VALUES (?, ?, ?, 1)`,
                    [uuidv4(), dados.usuarioId, geladinhosGanhos]
                );
            }
        }
    );

    io.emit('jogo-finalizado-notificacao', {
      vencedor: jogador.username,
      score: dados.score,
      geladinhos: geladinhosGanhos // Emitindo o valor corrigido
    });
  });

  socket.on('disconnect', () => {
    if (jogadoresConectados[socket.id]) {
      console.log(`Usuário desconectado: ${jogadoresConectados[socket.id].username}`);
      delete jogadoresConectados[socket.id];
      io.emit('jogadores-atualizados', jogadoresConectados);
    }
  });
});

// Fallback para SPA (Rota "catch-all" usando Regex)
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