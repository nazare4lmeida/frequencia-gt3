const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
);

// Helper para pegar data e hora de Brasília
const getBrasiliaTime = () => {
  const agora = new Date();
  const brasilia = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const data = brasilia.toISOString().split("T")[0];
  const hora = brasilia.toLocaleTimeString("pt-BR", { hour12: false });
  return { data, hora };
};

// ==========================================
// LOGIN E PERFIL
// ==========================================

app.post("/api/login", async (req, res) => {
  const { email, dataNascimento, formacao } = req.body;

  if (!email || !dataNascimento) {
    return res.status(400).json({ error: "Dados obrigatórios ausentes." });
  }

  const emailFormatado = email.trim().toLowerCase();

  // Admin fixo
  if (emailFormatado === "admin@gt3.com" && dataNascimento === "2026-01-01") {
    return res.json({
      nome: "Administrador",
      role: "admin",
      email: emailFormatado,
    });
  }

  try {
    const { data: alunos, error } = await supabase
      .from("alunos")
      .select("*")
      .eq("email", emailFormatado);

    if (error) throw error;

    let aluno;

    if (!alunos || alunos.length === 0) {
      // Cadastro automático se não existir (Primeiro Acesso)
      const { data: novoAluno, error: insertError } = await supabase
        .from("alunos")
        .insert([
          {
            email: emailFormatado,
            data_nascimento: dataNascimento,
            formacao: formacao,
          },
        ])
        .select();

      if (insertError) throw insertError;
      aluno = novoAluno[0];
    } else {
      // Aluno já existe no sistema
      aluno = alunos[0];

      // BLOQUEIO DE DUPLICIDADE: Validação de data de nascimento
      const dataFormatadaDb = aluno.data_nascimento.toString().split("T")[0];
      if (dataFormatadaDb !== dataNascimento) {
        return res.status(401).json({ 
          error: "Este e-mail já está cadastrado com outra data de nascimento. Caso tenha digitado errado, procure a coordenação." 
        });
      }

      // BLOQUEIO DE ALTERAÇÃO DE TURMA: Se já tem formação, não permite trocar no login
      if (aluno.formacao && formacao && aluno.formacao !== formacao) {
        return res.status(403).json({ 
          error: `Você já está registrado na formação ${aluno.formacao}. Não é permitido acesso duplicado em outra turma.` 
        });
      }

      // Se o aluno existia mas por algum motivo não tinha formação salva ainda, atualiza uma única vez
      if (formacao && !aluno.formacao) {
        await supabase
          .from("alunos")
          .update({ formacao })
          .eq("email", emailFormatado);
        aluno.formacao = formacao;
      }
    }

    res.json({ ...aluno, role: "aluno" });
  } catch (err) {
    console.error("ERRO NO LOGIN:", err);
    res.status(500).json({ error: "Erro interno no servidor de login." });
  }
});

// Busca dados para a tela de Perfil
app.get("/api/aluno/perfil/:email", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("alunos")
      .select("*")
      .eq("email", req.params.email.trim().toLowerCase())
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("ERRO AO BUSCAR PERFIL:", err);
    res.status(500).json({ error: "Erro ao carregar dados do perfil." });
  }
});

// Salva alterações do perfil usando EMAIL como referência (PK)
app.put("/api/aluno/perfil", async (req, res) => {
  const { email, nome, cpf, avatar } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ error: "E-mail é necessário para identificar o aluno." });
  }

  try {
    const { error } = await supabase
      .from("alunos")
      .update({ nome, cpf, avatar })
      .eq("email", email.trim().toLowerCase());

    if (error) throw error;
    res.json({ msg: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("ERRO PERFIL:", err);
    res.status(500).json({ error: "Erro interno ao salvar perfil." });
  }
});

// ==========================================
// REGISTRAR PONTO (USANDO aluno_email)
// ==========================================
app.post("/api/ponto", async (req, res) => {
  const { aluno_id, nota, revisao } = req.body; // aluno_id aqui é o email vindo do front
  const { data: hoje, hora: agora } = getBrasiliaTime();

  try {
    const { data: pontoExistente } = await supabase
      .from("presencas")
      .select("*")
      .eq("aluno_email", aluno_id)
      .eq("data", hoje)
      .single();

    if (!pontoExistente) {
      // Check-in
      const { error } = await supabase.from("presencas").insert([
        {
          aluno_email: aluno_id,
          data: hoje,
          check_in: agora,
        },
      ]);
      if (error) throw error;
      return res.json({ msg: "Check-in realizado!" });
    } else {
      // Check-out
      if (pontoExistente.check_out) {
        return res.status(400).json({ error: "Ponto já concluído hoje." });
      }

      const { error } = await supabase
        .from("presencas")
        .update({
          check_out: agora,
          feedback_nota: nota,
          feedback_texto: revisao,
        })
        .eq("id", pontoExistente.id); 

      if (error) throw error;
      return res.json({ msg: "Check-out realizado!" });
    }
  } catch (err) {
    console.error("ERRO PONTO:", err);
    res
      .status(500)
      .json({ error: "Você só pode registrar frequência nas Segundas." });
  }
});

// ==========================================
// ADMIN E HISTÓRICO (BUSCA MELHORADA)
// ==========================================

app.get("/api/admin/busca", async (req, res) => {
  const { termo, turma, status } = req.query;
  
  try {
    let query = supabase.from("alunos").select("*");

    if (turma && turma !== "todos") {
      query = query.eq("formacao", turma);
    }

    if (termo) {
      query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
    }

    // Lógica para Filtros de Inconsistência
    if (status === "incompleto") {
      query = query.or("nome.is.null,cpf.is.null");
    }

    const { data: alunos, error } = await query;
    if (error) throw error;

    // Filtro para "Esqueceram Saída" (Exige cruzamento com a tabela presencas)
    if (status === "pendente_saida") {
      const { data: hoje } = getBrasiliaTime();
      const { data: presencas } = await supabase
        .from("presencas")
        .select("aluno_email")
        .eq("data", hoje)
        .is("check_out", null);
      
      const emailsPendentes = presencas.map(p => p.aluno_email);
      return res.json(alunos.filter(a => emailsPendentes.includes(a.email)));
    }

    res.json(alunos);
  } catch (err) {
    res.status(500).json({ error: "Erro na busca administrativa." });
  }
});

// Rota para Atualizar Dados do Aluno pelo Admin usando EMAIL
app.put("/api/admin/aluno/:email", async (req, res) => {
  const { nome, email, cpf, data_nascimento } = req.body;
  const emailOriginal = decodeURIComponent(req.params.email); 

  try {
    const { error } = await supabase
      .from("alunos")
      .update({ nome, email, cpf, data_nascimento })
      .eq("email", emailOriginal);
      
    if (error) throw error;
    res.json({ msg: "Dados atualizados com sucesso" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao atualizar aluno no banco de dados." });
  }
});

// Rota para Excluir Aluno pelo Admin
app.delete("/api/admin/aluno/:email", async (req, res) => {
  const emailOriginal = decodeURIComponent(req.params.email);

  try {
    // Primeiro, removemos as presenças vinculadas a esse e-mail para evitar erro de chave estrangeira
    const { error: errorPresencas } = await supabase
      .from("presencas")
      .delete()
      .eq("aluno_email", emailOriginal);

    if (errorPresencas) throw errorPresencas;

    // Depois, removemos o cadastro do aluno
    const { error: errorAluno } = await supabase
      .from("alunos")
      .delete()
      .eq("email", emailOriginal);

    if (errorAluno) throw errorAluno;

    res.json({ msg: "Cadastro excluído com sucesso!" });
  } catch (err) {
    console.error("ERRO AO EXCLUIR:", err);
    res.status(500).json({ error: "Erro ao excluir cadastro do banco de dados." });
  }
});

// Rota para Ponto Manual
app.post("/api/admin/ponto-manual", async (req, res) => {
  const { email, data, check_in, check_out } = req.body;
  try {
    const { error } = await supabase.from("presencas").insert([
      { aluno_email: email, data, check_in, check_out }
    ]);
    if (error) throw error;
    res.json({ msg: "Ponto manual registrado!" });
  } catch (err) {
    res.status(500).json({ error: "Erro no registro manual." });
  }
});

// Rota para Reset de Sessão (Placeholder para implementação futura de tokens)
app.post("/api/admin/reset-session", async (req, res) => {
  // Nesta arquitetura, o reset apenas sinaliza sucesso para o front agir
  res.json({ msg: "Reset solicitado para o usuário." });
});

app.get("/api/historico/aluno/:email", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("presencas")
      .select("*")
      .eq("aluno_email", req.params.email)
      .order("data", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

// ==========================================
// ESTATÍSTICAS DO ADMIN (MELHORADAS)
// ==========================================

app.get('/api/admin/stats/:turma', async (req, res) => {
  const { turma } = req.params;
  const { data: hoje } = getBrasiliaTime();
  const agora = new Date();
  const isSegunda = agora.getDay() === 1;

  try {
    const { count: totalPresencas } = await supabase
      .from('presencas')
      .select('*', { count: 'exact', head: true });

    const { count: sessoesAtivas } = await supabase
      .from('presencas')
      .select('*', { count: 'exact', head: true })
      .eq('data', hoje);

    const { count: pendentesSaida } = await supabase
      .from('presencas')
      .select('*', { count: 'exact', head: true })
      .eq('data', hoje)
      .is('check_out', null);

    const { count: totalAlunosTurma } = await supabase
      .from('alunos')
      .select('*', { count: 'exact', head: true })
      .eq('formacao', turma);

    let faltasHoje = isSegunda ? (totalAlunosTurma || 0) - (sessoesAtivas || 0) : 0;

    res.json({
      totalPresencas: totalPresencas || 0,
      sessoesAtivas: sessoesAtivas || 0,
      faltasHoje: faltasHoje < 0 ? 0 : faltasHoje,
      totalAlunos: totalAlunosTurma || 0,
      pendentesSaida: pendentesSaida || 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar estatísticas.' });
  }
});

app.get("/api/health", (_, res) => res.json({ status: "online" }));

if (process.env.NODE_ENV !== "production") {
  app.listen(3001, () =>
    console.log("🚀 Backend rodando em http://localhost:3001"),
  );
}

module.exports = app;