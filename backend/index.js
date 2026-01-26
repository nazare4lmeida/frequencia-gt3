const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Verificação de segurança para as chaves do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente SUPABASE_URL ou SUPABASE_KEY não configuradas!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
      aluno = alunos[0];

      if (aluno.data_nascimento) {
        const dataFormatadaDb = aluno.data_nascimento.toString().split("T")[0];
        if (dataFormatadaDb !== dataNascimento) {
          return res.status(401).json({ 
            error: "Este e-mail já está cadastrado com outra data de nascimento. Caso tenha digitado errado, procure a coordenação." 
          });
        }
      }

      if (aluno.formacao && formacao && aluno.formacao !== formacao) {
        return res.status(403).json({ 
          error: `Você já está registrado na formação ${aluno.formacao}. Não é permitido acesso duplicado em outra turma.` 
        });
      }

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

app.put("/api/aluno/perfil", async (req, res) => {
  const { email, nome, cpf, avatar } = req.body;

  if (!email) {
    return res.status(400).json({ error: "E-mail é necessário para identificar o aluno." });
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
// REGISTRAR PONTO (CORREÇÃO DO ERRO 500)
// ==========================================
// ==========================================
// REGISTRAR PONTO (CORREÇÃO DE SINTAXE DE DATA/HORA)
// ==========================================
// ==========================================
// REGISTRAR PONTO (CORREÇÃO DE NOT-NULL CPF)
// ==========================================
app.post("/api/ponto", async (req, res) => {
  const { aluno_id, nota, revisao } = req.body; 
  const { data: hoje, hora: agora } = getBrasiliaTime();
  const timestampCompleto = `${hoje} ${agora}`;
  
  if (!aluno_id) return res.status(400).json({ error: "E-mail do aluno não enviado." });

  const agoraBrasilia = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const diaSemana = agoraBrasilia.getDay(); 

  if (diaSemana !== 1) {
    return res.status(403).json({ 
      error: "O sistema só abre às segundas. Hoje é " + agoraBrasilia.toLocaleDateString('pt-BR', { weekday: 'long' }) 
    });
  }

  try {
    const emailBusca = aluno_id.trim().toLowerCase();

    // 1. Buscamos o CPF e os dados do aluno primeiro
    const { data: aluno, error: alunoError } = await supabase
      .from("alunos")
      .select("cpf")
      .eq("email", emailBusca)
      .maybeSingle();

    if (alunoError || !aluno) {
      return res.status(404).json({ error: "Aluno não encontrado. Complete seu perfil primeiro." });
    }

    // 2. Verificamos se já existe ponto hoje
    const { data: pontoExistente, error: fetchError } = await supabase
      .from("presencas")
      .select("*")
      .eq("aluno_email", emailBusca)
      .eq("data", hoje)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!pontoExistente) {
      // CHECK-IN: Agora enviamos o CPF que buscamos do aluno
      const { error: insError } = await supabase.from("presencas").insert([
        {
          aluno_email: emailBusca,
          cpf: aluno.cpf, // <-- Adicionado para satisfazer a restrição do banco
          data: hoje,
          check_in: timestampCompleto,
        },
      ]);
      if (insError) throw insError;
      return res.json({ msg: "Check-in realizado com sucesso!" });
    } else {
      // CHECK-OUT
      if (pontoExistente.check_out) {
        return res.status(400).json({ error: "Você já concluiu sua presença de hoje." });
      }

      const { error: updError } = await supabase
        .from("presencas")
        .update({
          check_out: timestampCompleto,
          feedback_nota: nota || null,
          feedback_texto: revisao || "",
        })
        .eq("id", pontoExistente.id); 

      if (updError) throw updError;
      return res.json({ msg: "Check-out realizado com sucesso!" });
    }
  } catch (err) {
    console.error("ERRO NO PONTO:", err);
    res.status(500).json({ error: "Erro no banco: " + (err.message || "Tente novamente.") });
  }
});

// ==========================================
// ADMIN E OUTROS (MANTIDOS)
// ==========================================

app.get("/api/admin/busca", async (req, res) => {
  const { termo, turma, status } = req.query;
  try {
    let query = supabase.from("alunos").select("*");
    if (turma && turma !== "todos") query = query.eq("formacao", turma);
    if (termo) query = query.or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
    if (status === "incompleto") query = query.or("nome.is.null,cpf.is.null");

    const { data: alunos, error } = await query;
    if (error) throw error;

    if (status === "pendente_saida") {
      const { data: hoje } = getBrasiliaTime();
      const { data: presencas } = await supabase.from("presencas").select("aluno_email").eq("data", hoje).is("check_out", null);
      const emailsPendentes = presencas.map(p => p.aluno_email);
      return res.json(alunos.filter(a => emailsPendentes.includes(a.email)));
    }
    res.json(alunos);
  } catch (err) {
    res.status(500).json({ error: "Erro na busca administrativa." });
  }
});

app.put("/api/admin/aluno/:email", async (req, res) => {
  const { nome, email, cpf, data_nascimento } = req.body;
  const emailOriginal = decodeURIComponent(req.params.email); 
  try {
    const { error } = await supabase.from("alunos").update({ nome, email, cpf, data_nascimento }).eq("email", emailOriginal);
    if (error) throw error;
    res.json({ msg: "Dados atualizados com sucesso" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar aluno." });
  }
});

app.delete("/api/admin/aluno/:email", async (req, res) => {
  const emailOriginal = decodeURIComponent(req.params.email);
  try {
    await supabase.from("presencas").delete().eq("aluno_email", emailOriginal);
    const { error } = await supabase.from("alunos").delete().eq("email", emailOriginal);
    if (error) throw error;
    res.json({ msg: "Cadastro excluído com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir cadastro." });
  }
});

app.post("/api/admin/ponto-manual", async (req, res) => {
  const { email, data, check_in, check_out } = req.body;
  try {
    const { error } = await supabase.from("presencas").insert([{ aluno_email: email, data, check_in, check_out }]);
    if (error) throw error;
    res.json({ msg: "Ponto manual registrado!" });
  } catch (err) {
    res.status(500).json({ error: "Erro no registro manual." });
  }
});

app.post("/api/admin/reset-session", async (req, res) => {
  res.json({ msg: "Reset solicitado." });
});

app.get("/api/historico/aluno/:email", async (req, res) => {
  try {
    const { data, error } = await supabase.from("presencas").select("*").eq("aluno_email", req.params.email).order("data", { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

app.get('/api/admin/stats/:turma', async (req, res) => {
  const { turma } = req.params;
  const { data: hoje } = getBrasiliaTime();
  const agora = new Date();
  const isSegunda = agora.getDay() === 1;

  try {
    const { count: totalPresencas } = await supabase.from('presencas').select('*', { count: 'exact', head: true });
    const { count: sessoesAtivas } = await supabase.from('presencas').select('*', { count: 'exact', head: true }).eq('data', hoje);
    const { count: pendentesSaida } = await supabase.from('presencas').select('*', { count: 'exact', head: true }).eq('data', hoje).is('check_out', null);

    let queryAlunos = supabase.from('alunos').select('*', { count: 'exact', head: true });
    if (turma !== "todos") queryAlunos = queryAlunos.eq('formacao', turma);
    const { count: totalAlunosTurma } = await queryAlunos;

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

app.get("/api/admin/relatorio/:turma", async (req, res) => {
  const { turma } = req.params;
  try {
    let query = supabase.from("alunos").select("nome, email, cpf, presencas(data)");
    if (turma !== "todos") query = query.eq("formacao", turma);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

app.get("/api/health", (_, res) => res.json({ status: "online" }));

if (process.env.NODE_ENV !== "production") {
  app.listen(3001, () => console.log("🚀 Backend rodando em http://localhost:3001"));
}

module.exports = app;