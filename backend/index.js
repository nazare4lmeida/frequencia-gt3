const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const jwt = require("jsonwebtoken"); // Adicionado
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Verificação de segurança para as chaves do Supabase e JWT
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET; // Adicionado no seu .env

if (!supabaseUrl || !supabaseKey || !JWT_SECRET) {
  console.error(
    "ERRO: Variáveis de ambiente (SUPABASE ou JWT_SECRET) não configuradas!",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// MIDDLEWARES DE SEGURANÇA (NOVO)
// ==========================================

const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(403).json({ error: "Acesso negado. Faça login novamente." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuarioLogado = decoded; 
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sua sessão expirou. Entre novamente." });
  }
};

const verificarAdmin = (req, res, next) => {
  if (req.usuarioLogado.role !== "admin") {
    return res.status(403).json({ error: "Acesso restrito a administradores." });
  }
  next();
};

// ==========================================
// HELPERS
// ==========================================

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

  // LOGIN ADMIN
  if (emailFormatado === process.env.ADMIN_EMAIL && dataNascimento === process.env.ADMIN_PASS) {
    const token = jwt.sign(
      { email: emailFormatado, role: "admin" },
      JWT_SECRET,
      { expiresIn: "720h" }
    );
    return res.json({
      nome: "Administrador",
      role: "admin",
      email: emailFormatado,
      token // Envia o token para o front
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
        const dataBancoSrt = new Date(aluno.data_nascimento)
          .toISOString()
          .split("T")[0];

        if (dataBancoSrt !== dataNascimento) {
          return res.status(401).json({ error: "Data de nascimento incorreta." });
        }
      }

      if (aluno.formacao && formacao && aluno.formacao !== formacao) {
        return res.status(403).json({
          error: `Você já está registrado na formação ${aluno.formacao}. Não é permitido acesso duplicado em outra turma.`,
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

    // GERA TOKEN PARA ALUNO
    const token = jwt.sign(
      { id: aluno.id, email: aluno.email, role: "aluno" },
      JWT_SECRET,
      { expiresIn: "720h" }
    );

    res.json({ ...aluno, role: "aluno", token });
  } catch (err) {
    console.error("ERRO NO LOGIN:", err);
    res.status(500).json({ error: "Erro interno no servidor de login." });
  }
});

// Perfil agora usa verificarToken
app.get("/api/aluno/perfil/:email", verificarToken, async (req, res) => {
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

app.put("/api/aluno/perfil", verificarToken, async (req, res) => {
  const { email, nome, avatar } = req.body;
  try {
    const { error } = await supabase
      .from("alunos")
      .update({ nome, avatar })
      .eq("email", email.trim().toLowerCase());

    if (error) throw error;
    res.json({ msg: "Dados atualizados com sucesso!" });
  } catch (err) {
    console.error("ERRO PERFIL:", err);
    res.status(500).json({ error: "Erro interno ao salvar perfil." });
  }
});

// ==========================================
// REGISTRAR PONTO - PROTEGIDA
// ==========================================
app.post("/api/ponto", verificarToken, async (req, res) => {
  const { aluno_id, nota, revisao } = req.body;
  const { data: hoje, hora: agora } = getBrasiliaTime();
  const timestampCompleto = `${hoje}T${agora}`;
  const emailBusca = aluno_id.trim().toLowerCase();

  try {
    const { data: pontoExistente, error: fetchError } = await supabase
      .from("presencas")
      .select("*")
      .eq("aluno_email", emailBusca)
      .eq("data", hoje)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!pontoExistente) {
      const { data: novoPonto, error: insError } = await supabase
        .from("presencas")
        .insert([
          {
            aluno_email: emailBusca,
            data: hoje,
            check_in: timestampCompleto,
          },
        ])
        .select();

      if (insError) throw insError;
      return res.json({
        msg: "Check-in realizado com sucesso!",
        ponto: novoPonto[0],
      });
    } else {
      if (pontoExistente.check_out) {
        return res.json({ msg: "Você já concluiu sua presença de hoje." });
      }

      const { data: pontoAtualizado, error: updError } = await supabase
        .from("presencas")
        .update({
          check_out: timestampCompleto,
          feedback_nota: nota || null,
          feedback_texto: revisao || "",
        })
        .eq("id", pontoExistente.id)
        .select();

      if (updError) throw updError;
      return res.json({
        msg: "Check-out realizado com sucesso!",
        ponto: pontoAtualizado[0],
      });
    }
  } catch (err) {
    console.error("ERRO NO PONTO:", err);
    res.status(500).json({ error: "Erro ao processar presença." });
  }
});

// ==========================================
// ADMIN (TODAS PROTEGIDAS POR TOKEN + ADMIN)
// ==========================================

app.get("/api/admin/busca", verificarToken, verificarAdmin, async (req, res) => {
  const { termo, turma, status } = req.query;
  try {
    let query = supabase.from("alunos").select("*");
    if (turma && turma !== "todos") query = query.eq("formacao", turma);
    if (termo)
      query = query.or(
        `nome.ilike.%${termo}%,cpf.ilike.%${termo}%,email.ilike.%${termo}%`,
      );
    if (status === "incompleto") query = query.or("nome.is.null,cpf.is.null");

    const { data: alunos, error } = await query;
    if (error) throw error;

    if (status === "pendente_saida") {
      const { data: hoje } = getBrasiliaTime();
      const { data: presencas } = await supabase
        .from("presencas")
        .select("aluno_email")
        .eq("data", hoje)
        .is("check_out", null);
      const emailsPendentes = presencas.map((p) => p.aluno_email);
      return res.json(alunos.filter((a) => emailsPendentes.includes(a.email)));
    }
    res.json(alunos);
  } catch (err) {
    res.status(500).json({ error: "Erro na busca administrativa." });
  }
});

app.put("/api/admin/aluno/:email", verificarToken, verificarAdmin, async (req, res) => {
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
    res.status(500).json({ error: "Erro ao atualizar aluno." });
  }
});

app.delete("/api/admin/aluno/:email", verificarToken, verificarAdmin, async (req, res) => {
  const emailOriginal = decodeURIComponent(req.params.email);
  try {
    await supabase.from("presencas").delete().eq("aluno_email", emailOriginal);
    const { error } = await supabase
      .from("alunos")
      .delete()
      .eq("email", emailOriginal);
    if (error) throw error;
    res.json({ msg: "Cadastro excluído com sucesso!" });
  } catch (err) {
    res.status(500).json({ error: "Erro ao excluir cadastro." });
  }
});

app.post("/api/admin/ponto-manual", verificarToken, verificarAdmin, async (req, res) => {
  const { email, data, check_in, check_out } = req.body;
  try {
    const { error } = await supabase
      .from("presencas")
      .insert([{ aluno_email: email, data, check_in, check_out }]);
    if (error) throw error;
    res.json({ msg: "Ponto manual registrado!" });
  } catch (err) {
    res.status(500).json({ error: "Erro no registro manual." });
  }
});

app.post("/api/admin/reset-session", verificarToken, verificarAdmin, async (req, res) => {
  res.json({ msg: "Reset solicitado." });
});

app.get("/api/historico/aluno/:email", verificarToken, async (req, res) => {
  try {
    const emailFormatado = req.params.email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("presencas")
      .select("*")
      .eq("aluno_email", emailFormatado)
      .order("data", { ascending: false });

    if (error) throw error;

    const historicoFormatado = data.map((item) => ({
      ...item,
      data: item.data.includes("T") ? item.data.split("T")[0] : item.data,
    }));

    res.json(historicoFormatado);
  } catch (err) {
    console.error("ERRO HISTORICO:", err);
    res.status(500).json({ error: "Erro ao carregar histórico." });
  }
});

app.get("/api/admin/stats/:turma", verificarToken, verificarAdmin, async (req, res) => {
  const { turma } = req.params;
  const { data: hoje } = getBrasiliaTime();
  const agora = new Date();
  const isSegunda = agora.getDay() === 1;

  try {
    const { count: totalPresencas } = await supabase
      .from("presencas")
      .select("*", { count: "exact", head: true });
    const { count: sessoesAtivas } = await supabase
      .from("presencas")
      .select("*", { count: "exact", head: true })
      .eq("data", hoje);
    const { count: pendentesSaida } = await supabase
      .from("presencas")
      .select("*", { count: "exact", head: true })
      .eq("data", hoje)
      .is("check_out", null);

    let queryAlunos = supabase
      .from("alunos")
      .select("*", { count: "exact", head: true });
    if (turma !== "todos") queryAlunos = queryAlunos.eq("formacao", turma);
    const { count: totalAlunosTurma } = await queryAlunos;

    let faltasHoje = isSegunda
      ? (totalAlunosTurma || 0) - (sessoesAtivas || 0)
      : 0;

    res.json({
      totalPresencas: totalPresencas || 0,
      sessoesAtivas: sessoesAtivas || 0,
      faltasHoje: faltasHoje < 0 ? 0 : faltasHoje,
      totalAlunos: totalAlunosTurma || 0,
      pendentesSaida: pendentesSaida || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Erro ao carregar estatísticas." });
  }
});

app.get("/api/admin/relatorio/:turma", verificarToken, verificarAdmin, async (req, res) => {
  const { turma } = req.params;
  try {
    let query = supabase
      .from("alunos")
      .select(
        "nome, email, cpf, formacao, presencas(data, check_in, check_out)",
      );

    if (turma !== "todos") {
      query = query.eq("formacao", turma);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("ERRO RELATORIO:", err);
    res.status(500).json({ error: "Erro ao gerar relatório." });
  }
});

app.get("/api/health", (_, res) => res.json({ status: "online" }));

if (process.env.NODE_ENV !== "production") {
  app.listen(3001, () =>
    console.log("🚀 Backend rodando em http://localhost:3001"),
  );
}

module.exports = app;