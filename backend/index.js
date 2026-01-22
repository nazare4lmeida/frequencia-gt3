const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Helper para pegar data e hora de Brasília (Independente de onde o servidor está)
const getBrasiliaTime = () => {
  const agora = new Date();
  const brasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const data = brasilia.toISOString().split('T')[0];
  const hora = brasilia.toLocaleTimeString('pt-BR', { hour12: false });
  return { data, hora };
};

// ==========================================
// LOGIN (ADMIN / ALUNO)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, dataNascimento, nome } = req.body;

  if (!email || !dataNascimento) {
    return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
  }

  // Admin fixo
  if (email === 'admin@gt3.com' && dataNascimento === '2026-01-01') {
    return res.json({ id: 'admin', nome: 'Administrador', role: 'admin', email });
  }

  try {
    const { data: alunos, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('email', email.trim().toLowerCase());

    if (error) throw error;

    let aluno;

    if (!alunos || alunos.length === 0) {
      const { data: novoAluno, error: insertError } = await supabase
        .from('alunos')
        .insert([{ 
          email: email.trim().toLowerCase(), 
          nome: nome || 'Aluno GT', 
          data_nascimento: dataNascimento 
        }])
        .select();

      if (insertError) throw insertError;
      aluno = novoAluno[0];
    } else {
      aluno = alunos[0];
      // Comparação rigorosa de data para evitar erros de fuso do DB
      const dataFormatadaDb = aluno.data_nascimento.toString().split('T')[0];
      if (dataFormatadaDb !== dataNascimento) {
        return res.status(401).json({ error: 'Data de nascimento incorreta.' });
      }
    }

    res.json({ ...aluno, role: 'aluno' });
  } catch (err) {
    console.error('ERRO NO LOGIN:', err);
    res.status(500).json({ error: 'Erro interno no servidor de login.' });
  }
});

// ==========================================
// REGISTRAR PONTO (CHECK-IN / CHECK-OUT)
// ==========================================
app.post('/api/ponto', async (req, res) => {
  const { aluno_id, nota, revisao } = req.body;
  const { data: hoje, hora: agora } = getBrasiliaTime();

  try {
    const { data: pontoExistente } = await supabase
      .from('presencas')
      .select('*')
      .eq('aluno_id', aluno_id)
      .eq('data', hoje)
      .single();

    if (!pontoExistente) {
      const { error } = await supabase
        .from('presencas')
        .insert([{ 
          aluno_id, 
          data: hoje, 
          check_in: agora 
        }]);
      if (error) throw error;
      return res.json({ msg: 'Check-in realizado com sucesso!' });
    } else {
      if (pontoExistente.check_out) {
        return res.status(400).json({ error: 'Ponto de hoje já concluído.' });
      }

      const { error } = await supabase
        .from('presencas')
        .update({ 
          check_out: agora,
          feedback_nota: nota,
          feedback_texto: revisao 
        })
        .eq('id', pontoExistente.id);
        
      if (error) throw error;
      return res.json({ msg: 'Check-out realizado! Até amanhã.' });
    }
  } catch (err) {
    console.error('ERRO AO BATER PONTO:', err);
    res.status(500).json({ error: 'Falha ao registrar ponto no banco.' });
  }
});

app.get('/api/historico/aluno/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*')
      .eq('aluno_id', req.params.id)
      .order('data', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('ERRO HISTORICO:', err);
    res.status(500).json({ error: 'Erro ao carregar histórico.' });
  }
});

app.get('/api/health', (_, res) => res.json({ status: 'online' }));

if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log('🚀 Backend rodando em http://localhost:3001'));
}

module.exports = app;