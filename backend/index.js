require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware para garantir funcionamento correto na Vercel (/api/...)
app.use('/api', (req, res, next) => next());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// FUNÇÃO AUXILIAR: VALIDAÇÃO DE HORÁRIO (SP)
// ==========================================
const getStatusHorario = () => {
  const agora = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
  const hora = agora.getHours();
  const diaSemana = agora.getDay(); // 1 = Segunda

  // Validação: Somente segundas-feiras
  if (diaSemana !== 1) {
    return { permitido: false, msg: "O registro de presença só está disponível às segundas-feiras." };
  }
  
  // Janelas de tempo: Check-in (18h-20h) | Check-out (22h-23h)
  if (hora >= 18 && hora < 20) return { permitido: true, tipo: 'in' };
  if (hora >= 22 && hora < 23) return { permitido: true, tipo: 'out' };
  
  return { permitido: false, msg: "Fora do horário permitido: Entrada (18h-20h) ou Saída (22h-22:30h)." };
};

// ==========================================
// ROTA: LOGIN (ADMIN E ALUNO)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, dataNascimento, cpf, nome } = req.body;

  // Lógica de Admin (Credenciais Fixas)
  if (email === 'admin@gt3.com' && dataNascimento === '2026-01-01') {
    return res.json({ nome: 'Administrador', role: 'admin', email: 'admin@gt3.com' });
  }

  try {
    // Busca aluno pelo e-mail
    const { data: aluno, error } = await supabase.from('alunos')
      .select('*').eq('email', email).maybeSingle();

    if (error) return res.status(500).json({ error: "Erro ao consultar banco de dados." });

    if (!aluno) {
      // Se não existir, cria um novo cadastro com os dados enviados
      const { data: novo, error: insError } = await supabase.from('alunos')
        .insert([{ 
          email, 
          cpf, 
          data_nascimento: dataNascimento, 
          nome: nome || 'Estudante GT' 
        }]).select().single();
      
      if (insError) return res.status(500).json({ error: "Erro ao criar novo cadastro." });
      return res.json({ ...novo, role: 'aluno' });
    }
    
    // Valida data de nascimento para alunos existentes
    if (aluno.data_nascimento !== dataNascimento) {
      return res.status(401).json({ error: "Data de nascimento incorreta para este e-mail." });
    }
    
    res.json({ ...aluno, role: aluno.role || 'aluno' });
  } catch (err) {
    res.status(500).json({ error: "Falha interna no servidor." });
  }
});

// ==========================================
// ROTA: PONTO INTELIGENTE (UPSERT AUTOMÁTICO)
// ==========================================
app.post('/api/ponto', async (req, res) => {
  const { cpf, formacao, nota, feedback } = req.body;
  
  // 1. Valida o horário pelo servidor para evitar fraudes no relógio do PC
  const status = getStatusHorario();
  if (!status.permitido) return res.status(403).json({ error: status.msg });

  const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const agora = new Date().toISOString();

  try {
    // Busca se já existe registro do aluno hoje
    const { data: existente } = await supabase.from('presencas')
      .select('*').eq('cpf', cpf).eq('data', hoje).maybeSingle();

    // LÓGICA DE CHECK-IN (18h às 20h)
    if (status.tipo === 'in') {
      if (existente) return res.status(400).json({ error: "Check-in já realizado hoje!" });
      
      const { data, error } = await supabase.from('presencas')
        .insert([{ cpf, formacao, data: hoje, check_in: agora }]).select();
      
      if (error) throw error;
      return res.json({ msg: "Check-in realizado com sucesso!", status: 'in' });
    } 

    // LÓGICA DE CHECK-OUT (22h às 23h)
    if (status.tipo === 'out') {
      if (!existente) return res.status(400).json({ error: "Você precisa realizar o Check-in primeiro!" });
      if (existente.check_out) return res.status(400).json({ error: "Check-out já realizado hoje!" });

      const { data, error } = await supabase.from('presencas')
        .update({ 
          check_out: agora, 
          compreensao: nota, 
          feedback: feedback 
        })
        .eq('id', existente.id).select();
      
      if (error) throw error;
      return res.json({ msg: "Check-out e feedback registrados!", status: 'out' });
    }
  } catch (err) {
    res.status(500).json({ error: "Erro ao processar o registro de ponto." });
  }
});

// ==========================================
// ROTAS DE CONSULTA (HISTÓRICO E ADMIN)
// ==========================================

// Histórico Individual do Aluno
app.get('/api/historico/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const { data, error } = await supabase.from('presencas')
      .select('*, alunos(nome)')
      .eq('cpf', cpf)
      .order('data', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

// Relatório Geral para Admin
app.get('/api/admin/relatorio-geral', async (req, res) => {
  try {
    const { data, error } = await supabase.from('presencas')
      .select(`*, alunos (nome)`)
      .order('data', { ascending: false });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar relatório geral." });
  }
});

// Inicialização Local
if (process.env.NODE_ENV !== 'production') {
  const PORT = 3001;
  app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
}

module.exports = app;