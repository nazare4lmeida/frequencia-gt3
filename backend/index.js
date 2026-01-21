require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Middleware Vercel
app.use('/api', (_, __, next) => next());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ==========================================
// FUNÇÃO AUXILIAR: VALIDAÇÃO DE HORÁRIO (SP)
// ==========================================
const getStatusHorario = () => {
  const agora = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );

  const hora = agora.getHours();
  const diaSemana = agora.getDay(); // 1 = segunda

  if (diaSemana !== 1) {
    return {
      permitido: false,
      msg: 'Presença disponível apenas às segundas-feiras.'
    };
  }

  if (hora >= 18 && hora < 20) return { permitido: true, tipo: 'in' };
  if (hora >= 22 && hora < 23) return { permitido: true, tipo: 'out' };

  return {
    permitido: false,
    msg: 'Fora do horário permitido (18h–20h / 22h–23h).'
  };
};

// ==========================================
// LOGIN (ADMIN / ALUNO)
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, dataNascimento, nome } = req.body;

  // ADMIN
  if (email === 'admin@gt3.com' && dataNascimento === '2026-01-01') {
    return res.json({
      nome: 'Administrador',
      role: 'admin',
      email
    });
  }

  try {
    const { data: aluno, error } = await supabase
      .from('alunos')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;

    // Novo aluno (SEM CPF)
    if (!aluno) {
      const { data: novo, error: insertError } = await supabase
        .from('alunos')
        .insert([{
          email,
          nome: nome || 'Aluno GT',
          data_nascimento: dataNascimento
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      return res.json({ ...novo, role: 'aluno' });
    }

    if (aluno.data_nascimento !== dataNascimento) {
      return res.status(401).json({ error: 'Data de nascimento inválida.' });
    }

    res.json({ ...aluno, role: aluno.role || 'aluno' });
  } catch (err) {
    res.status(500).json({ error: 'Erro no login.' });
  }
});

// ==========================================
// ATUALIZAR CPF (ALUNO LOGADO)
// ==========================================
app.post('/api/aluno/cpf', async (req, res) => {
  const { aluno_id, cpf } = req.body;

  if (!cpf || cpf.length < 11) {
    return res.status(400).json({ error: 'CPF inválido.' });
  }

  try {
    const { error } = await supabase
      .from('alunos')
      .update({ cpf })
      .eq('id', aluno_id);

    if (error) throw error;

    res.json({ msg: 'CPF atualizado com sucesso.' });
  } catch {
    res.status(500).json({ error: 'Erro ao salvar CPF.' });
  }
});

// ==========================================
// REGISTRO DE PRESENÇA
// ==========================================
app.post('/api/ponto', async (req, res) => {
  const { aluno_id, formacao, nota, feedback } = req.body;

  if (!aluno_id) {
    return res.status(400).json({ error: 'Aluno inválido.' });
  }

  const status = getStatusHorario();
  if (!status.permitido) {
    return res.status(403).json({ error: status.msg });
  }

  const hoje = new Date().toISOString().split('T')[0];
  const agora = new Date().toISOString();

  try {
    // Verifica se aluno tem CPF cadastrado
    const { data: aluno } = await supabase
      .from('alunos')
      .select('cpf')
      .eq('id', aluno_id)
      .single();

    if (!aluno?.cpf) {
      return res.status(400).json({
        error: 'CPF não cadastrado. Atualize antes de registrar presença.'
      });
    }

    const { data: existente } = await supabase
      .from('presencas')
      .select('*')
      .eq('aluno_id', aluno_id)
      .eq('data', hoje)
      .maybeSingle();

    // CHECK-IN
    if (status.tipo === 'in') {
      if (existente) {
        return res.status(400).json({ error: 'Check-in já realizado.' });
      }

      await supabase.from('presencas').insert([{
        aluno_id,
        formacao,
        data: hoje,
        check_in: agora
      }]);

      return res.json({ msg: 'Check-in realizado.' });
    }

    // CHECK-OUT
    if (status.tipo === 'out') {
      if (!existente || existente.check_out) {
        return res.status(400).json({ error: 'Check-out inválido.' });
      }

      await supabase
        .from('presencas')
        .update({
          check_out: agora,
          compreensao: nota,
          feedback
        })
        .eq('id', existente.id);

      return res.json({ msg: 'Check-out registrado.' });
    }
  } catch {
    res.status(500).json({ error: 'Erro no registro de presença.' });
  }
});

// ==========================================
// HISTÓRICO DO ALUNO (POR CPF)
// ==========================================
app.get('/api/historico/:cpf', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*, alunos(nome, cpf)')
      .eq('alunos.cpf', req.params.cpf)
      .order('data', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// ==========================================
// RELATÓRIO GERAL (ADMIN)
// ==========================================
app.get('/api/admin/relatorio-geral', async (_, res) => {
  try {
    const { data, error } = await supabase
      .from('presencas')
      .select('*, alunos(nome, cpf)')
      .order('data', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch {
    res.status(500).json({ error: 'Erro no relatório.' });
  }
});

// ==========================================
// SERVER LOCAL
// ==========================================
if (process.env.NODE_ENV !== 'production') {
  app.listen(3001, () => console.log('🚀 Backend rodando na porta 3001'));
}

module.exports = app;
