require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// LOGIN
app.post('/login', async (req, res) => {
  const { cpf, dataNascimento } = req.body;
  try {
    const { data: aluno, error: fetchError } = await supabase
      .from('alunos')
      .select('*')
      .eq('cpf', cpf)
      .maybeSingle();

    if (fetchError) return res.status(500).json({ error: "Erro ao consultar banco." });

    if (!aluno) {
      const { data: novo, error: insError } = await supabase
        .from('alunos')
        .insert([{ cpf, data_nascimento: dataNascimento, nome: 'Estudante GT' }])
        .select().single();
      if (insError) return res.status(500).json({ error: "Erro no cadastro." });
      return res.json(novo);
    }

    if (aluno.data_nascimento !== dataNascimento) return res.status(401).json({ error: "Data incorreta." });
    res.json(aluno);
  } catch { res.status(500).json({ error: "Falha interna." }); }
});

// REGISTRAR PRESENÇA
app.post('/presenca', async (req, res) => {
  const { cpf, formacao, tipo, data, nota, revisao } = req.body;
  const [dia, mes, ano] = data.split('/');
  const dataFormatadaISO = `${ano}-${mes}-${dia}`;

  const dadosRegistro = {
    cpf,
    formacao,
    data: dataFormatadaISO,
    feedback: revisao || null,
    compreensao: nota || null,
  };

  const agora = new Date().toISOString();
  if (tipo === 'in') dadosRegistro.check_in = agora;
  else dadosRegistro.check_out = agora;

  try {
    const { data: registro, error } = await supabase
      .from('presencas')
      .insert([dadosRegistro])
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.status(200).json(registro);
  } catch { res.status(500).json({ error: "Erro interno." }); }
});

// NOVA ROTA: BUSCAR HISTÓRICO (O QUE VOCÊ PEDIU)
app.get('/historico/:cpf', async (req, res) => {
  const { cpf } = req.params;
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*')
      .eq('cpf', cpf)
      .order('data', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch { res.status(500).json({ error: "Erro ao buscar histórico." }); }
});

app.listen(3001, () => console.log("🚀 Backend rodando na porta 3001"));