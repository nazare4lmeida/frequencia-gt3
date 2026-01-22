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
      // Cadastro automático se não existir
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
      // Validação de data de nascimento
      const dataFormatadaDb = aluno.data_nascimento.toString().split("T")[0];
      if (dataFormatadaDb !== dataNascimento) {
        return res.status(401).json({ error: "Data de nascimento incorreta." });
      }

      // Atualiza formação se necessário usando email como chave
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
        .eq("id", pontoExistente.id); // 'id' de presencas é int8 e funciona aqui

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
// ADMIN E HISTÓRICO
// ==========================================

app.get("/api/admin/busca", async (req, res) => {
  const { termo } = req.query;
  if (!termo) return res.json([]);
  try {
    const { data, error } = await supabase
      .from("alunos")
      .select("*")
      .or(`nome.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`);
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erro na busca." });
  }
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
// ESTATÍSTICAS DO ADMIN
// ==========================================

app.get('/api/admin/stats/:turma', async (req, res) => {
  const { turma } = req.params;
  const { data: hoje } = getBrasiliaTime();
  const agora = new Date();
  const isSegunda = agora.getDay() === 1; //

  try {
    const { count: totalPresencas } = await supabase
      .from('presencas')
      .select('*', { count: 'exact', head: true })
      .not('check_out', 'is', null);

    const { count: sessoesAtivas } = await supabase
      .from('presencas')
      .select('*', { count: 'exact', head: true })
      .eq('data', hoje)
      .is('check_out', null);

    // Lógica corrigida: se não for segunda, faltas é 0
    let faltasHoje = 0;
    if (isSegunda) {
      const { count: totalAlunosTurma } = await supabase
        .from('alunos')
        .select('*', { count: 'exact', head: true })
        .eq('formacao', turma);

      const { count: presentesHoje } = await supabase
        .from('presencas')
        .select('*', { count: 'exact', head: true })
        .eq('data', hoje);

      faltasHoje = (totalAlunosTurma || 0) - (presentesHoje || 0);
    }

    res.json({
      totalPresencas: totalPresencas || 0,
      sessoesAtivas: sessoesAtivas || 0,
      faltasHoje: faltasHoje < 0 ? 0 : faltasHoje
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
