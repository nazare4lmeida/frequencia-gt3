require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => next());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LOGIN (ALUNO E ADMIN)
app.post('/login', async (req, res) => {
  const { cpf, dataNascimento } = req.body;
  
  // ACESSO ADMIN SIMPLES (VOCÊ PODE MUDAR ESSA SENHA/CPF)
  if (cpf === '00000000000' && dataNascimento === '2026-01-01') {
    return res.json({ nome: 'Administrador', role: 'admin', cpf: '00000000000' });
  }

  try {
    const { data: aluno, error } = await supabase.from('alunos').select('*').eq('cpf', cpf).maybeSingle();
    if (error) return res.status(500).json({ error: "Erro no banco." });

    if (!aluno) {
      const { data: novo, error: insError } = await supabase.from('alunos')
        .insert([{ cpf, data_nascimento: dataNascimento, nome: 'Estudante GT' }]).select().single();
      return res.json({ ...novo, role: 'aluno' });
    }
    if (aluno.data_nascimento !== dataNascimento) return res.status(401).json({ error: "Data incorreta." });
    res.json({ ...aluno, role: 'aluno' });
  } catch { res.status(500).json({ error: "Falha interna." }); }
});

// REGISTRAR PRESENÇA
app.post('/presenca', async (req, res) => {
  const { cpf, formacao, tipo, data, nota, revisao } = req.body;
  const [dia, mes, ano] = data.split('/');
  const dataFormatada = `${ano}-${mes}-${dia}`;
  const dados = { cpf, formacao, data: dataFormatada, feedback: revisao || null, compreensao: nota || null };
  const agora = new Date().toISOString();
  if (tipo === 'in') dados.check_in = agora; else dados.check_out = agora;

  try {
    const { data: registro, error } = await supabase.from('presencas').insert([dados]).select();
    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(registro);
  } catch { res.status(500).json({ error: "Erro interno." }); }
});

// HISTÓRICO INDIVIDUAL (PARA ALUNO E ADMIN BUSCAR)
app.get('/historico/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const { data, error } = await supabase.from('presencas').select('*').eq('cpf', cpf).order('data', { ascending: false });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro ao buscar histórico." }); }
});

// ROTA ADMIN: RELATÓRIO GERAL
app.get('/admin/relatorio-geral', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*, alunos(nome)') // Puxa o nome do aluno junto
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro admin." }); }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log("🚀 Rodando local"));
}
module.exports = app;