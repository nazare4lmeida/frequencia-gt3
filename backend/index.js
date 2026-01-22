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

// Helper para pegar data e hora de Brasília
const getBrasiliaTime = () => {
  const agora = new Date();
  const brasilia = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const data = brasilia.toISOString().split('T')[0];
  const hora = brasilia.toLocaleTimeString('pt-BR', { hour12: false });
  return { data, hora };
};

// ==========================================
// LOGIN E PERFIL
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, dataNascimento, formacao } = req.body;

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
          data_nascimento: dataNascimento,
          formacao: formacao 
        }])
        .select();

      if (insertError) throw insertError;
      aluno = novoAluno[0];
    } else {
      aluno = alunos[0];
      const dataFormatadaDb = aluno.data_nascimento.toString().split('T')[0];
      if (dataFormatadaDb !== dataNascimento) {
        return res.status(401).json({ error: 'Data de nascimento incorreta.' });
      }

      if (formacao && !aluno.formacao) {
        await supabase.from('alunos').update({ formacao }).eq('id', aluno.id);
        aluno.formacao = formacao;
      }
    }

    res.json({ ...aluno, role: 'aluno' });
  } catch (err) {
    console.error('ERRO NO LOGIN:', err);
    res.status(500).json({ error: 'Erro interno no servidor de login.' });
  }
});

// APRIMORADO: Atualizar Perfil (Nome, CPF e Avatar)
app.put('/api/aluno/perfil', async (req, res) => {
  const { id, nome, cpf, avatar } = req.body;
  try {
    const { error } = await supabase
      .from('alunos')
      .update({ 
        nome, 
        cpf, 
        avatar // Certifique-se de que esta coluna existe no Supabase
      })
      .eq('id', id);
    
    if (error) throw error;
    res.json({ msg: 'Dados atualizados com sucesso!' });
  } catch (err) {
    console.error('ERRO PERFIL:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
});

// ==========================================
// REGISTRAR PONTO
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
      return res.json({ msg: 'Check-out realizado!' });
    }
  } catch (err) {
    console.error('ERRO AO BATER PONTO:', err);
    res.status(500).json({ error: 'Falha ao registrar ponto.' });
  }
});

// ==========================================
// ADMINISTRAÇÃO
// ==========================================

// MELHORADO: Busca por termo (Nome, CPF ou Email) ignorando caixa alta/baixa
app.get('/api/admin/busca', async (req, res) => {
  const { termo } = req.query;
  if (!termo) return res.json([]);

  try {
    const { data, error } = await supabase
      .from('alunos')
      .select('*')
      .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('ERRO BUSCA ADMIN:', err);
    res.status(500).json({ error: 'Erro na busca de alunos.' });
  }
});

// Relatório por Turma
app.get('/api/admin/relatorio/:formacao', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('alunos')
      .select(`
        id, nome, email, cpf, formacao,
        presencas ( data, check_in, check_out )
      `)
      .eq('formacao', req.params.formacao);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('ERRO RELATORIO ADMIN:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório da turma.' });
  }
});

// ==========================================
// HISTÓRICO E SAÚDE
// ==========================================
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