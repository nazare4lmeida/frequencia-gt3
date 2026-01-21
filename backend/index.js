const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware Vercel
app.use('/api', (req, res, next) => next());

// ⚠️ LOG CRÍTICO (remove depois)
console.log('SUPABASE_URL OK?', !!process.env.SUPABASE_URL);
console.log('SUPABASE_KEY OK?', !!process.env.SUPABASE_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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
    return res.json({ nome: 'Administrador', role: 'admin', email });
  }

  try {
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('email', email);

    if (error) {
      console.error('SUPABASE SELECT ERROR:', error);
      return res.status(500).json({ error: 'Erro ao consultar aluno.' });
    }

    // Nenhum aluno → cria
    if (!data || data.length === 0) {
      const { data: novo, error: insertError } = await supabase
        .from('alunos')
        .insert([{
          email,
          nome: nome || 'Aluno GT',
          data_nascimento: dataNascimento
        }])
        .select()
        .single();

      if (insertError) {
        console.error('SUPABASE INSERT ERROR:', insertError);
        return res.status(500).json({ error: 'Erro ao criar aluno.' });
      }

      return res.json({ ...novo, role: 'aluno' });
    }

    // Mais de um registro → ERRO DE DADOS
    if (data.length > 1) {
      console.error('EMAIL DUPLICADO:', email);
      return res.status(500).json({
        error: 'Erro interno: email duplicado no banco.'
      });
    }

    const aluno = data[0];

    if (aluno.data_nascimento !== dataNascimento) {
      return res.status(401).json({ error: 'Data de nascimento inválida.' });
    }

    res.json({ ...aluno, role: 'aluno' });

  } catch (err) {
    console.error('LOGIN FATAL ERROR:', err);
    res.status(500).json({ error: 'Erro interno no login.' });
  }
});

// ==========================================
// HEALTH CHECK (TESTE DIRETO)
// ==========================================
app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

// ==========================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log('🚀 Backend rodando local'));
}

module.exports = app;
