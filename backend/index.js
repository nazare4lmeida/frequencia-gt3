require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', (req, res, next) => next());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LOGIN
app.post('/api/login', async (req, res) => {
  const { cpf, dataNascimento } = req.body;
  try {
    const { data: aluno, error } = await supabase.from('alunos').select('*').eq('cpf', cpf).maybeSingle();
    if (error) return res.status(500).json({ error: "Erro no banco." });

    if (!aluno) {
      const { data: novo, error: insError } = await supabase.from('alunos')
        .insert([{ cpf, data_nascimento: dataNascimento, nome: 'Estudante GT' }]).select().single();
      return res.json(novo);
    }
    if (aluno.data_nascimento !== dataNascimento) return res.status(401).json({ error: "Data incorreta." });
    res.json(aluno);
  } catch { res.status(500).json({ error: "Falha interna." }); }
});

// PRESENÇA (CORREÇÃO DE DATA PARA O SUPABASE)
app.post('/api/presenca', async (req, res) => {
  const { cpf, formacao, tipo, data, nota, revisao } = req.body;
  
  // Converte "26/01/2026" para "2026-01-26" para evitar erro out of range
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

app.get('/api/historico/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const { data, error } = await supabase.from('presencas').select('*').eq('cpf', cpf).order('data', { ascending: false });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro." }); }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log("🚀 Rodando local"));
}
module.exports = app;