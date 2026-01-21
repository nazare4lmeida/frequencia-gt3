require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware para garantir que o prefixo /api funcione corretamente na Vercel
app.use('/api', (req, res, next) => next());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LOGIN (ALUNO E ADMIN)
app.post('/api/login', async (req, res) => {
  const { cpf, dataNascimento, nome } = req.body;

  // LOGICA DE ADMIN (Credenciais fixas)
  if (cpf === '00000000000' && dataNascimento === '2026-01-01') {
    return res.json({ 
      nome: 'Administrador', 
      role: 'admin', 
      cpf: '00000000000' 
    });
  }

  try {
    const { data: aluno, error } = await supabase.from('alunos').select('*').eq('cpf', cpf).maybeSingle();
    if (error) return res.status(500).json({ error: "Erro no banco." });

    if (!aluno) {
      // No primeiro login, salva o nome preenchido pelo aluno no formulário
      const { data: novo, error: insError } = await supabase.from('alunos')
        .insert([{ 
          cpf, 
          data_nascimento: dataNascimento, 
          nome: nome || 'Estudante GT' 
        }]).select().single();
      
      if (insError) return res.status(500).json({ error: "Erro ao criar cadastro." });
      return res.json({ ...novo, role: 'aluno' });
    }
    
    if (aluno.data_nascimento !== dataNascimento) return res.status(401).json({ error: "Data incorreta." });
    
    // Retorna os dados com a role que está no banco (importante para admins manuais)
    res.json({ ...aluno, role: aluno.role || 'aluno' });
  } catch { res.status(500).json({ error: "Falha interna." }); }
});

// PRESENÇA
app.post('/api/presenca', async (req, res) => {
  const { cpf, formacao, tipo, data, nota, revisao } = req.body;
  const [dia, mes, ano] = data.split('/');
  const dataFormatada = `${ano}-${mes}-${dia}`;

  const dados = {
    cpf, formacao, data: dataFormatada,
    feedback: revisao || null, compreensao: nota || null
  };

  const agora = new Date().toISOString();
  if (tipo === 'in') dados.check_in = agora; else dados.check_out = agora;

  try {
    const { data: registro, error } = await supabase.from('presencas').insert([dados]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(registro);
  } catch { res.status(500).json({ error: "Erro interno." }); }
});

// HISTÓRICO (INDIVIDUAL) - Ajustado para trazer nome
app.get('/api/historico/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*, alunos(nome)') 
      .eq('cpf', cpf)
      .order('data', { ascending: false });
    
    if (error) return res.status(500).json({ error: "Erro ao buscar histórico." });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro." }); }
});

// ROTA ADMIN: RELATÓRIO GERAL (Ajustado para trazer nome)
app.get('/api/admin/relatorio-geral', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select(`*, alunos (nome)`)
      .order('data', { ascending: false });
      
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro ao carregar relatório." }); }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log("🚀 Rodando local na porta 3001"));
}
module.exports = app;