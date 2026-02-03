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
    return res
      .status(403)
      .json({ error: "Acesso negado. Faça login novamente." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuarioLogado = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Sua sessão expirou. Entre novamente." });
  }
};

const verificarAdmin = (req, res, next) => {
  if (req.usuarioLogado.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Acesso restrito a administradores." });
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
  if (
    emailFormatado === process.env.ADMIN_EMAIL &&
    dataNascimento === process.env.ADMIN_PASS
  ) {
    const token = jwt.sign(
      { email: emailFormatado, role: "admin" },
      JWT_SECRET,
      { expiresIn: "720h" },
    );
    return res.json({
      nome: "Administrador",
      role: "admin",
      email: emailFormatado,
      token, // Envia o token para o front
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
          return res
            .status(401)
            .json({ error: "Data de nascimento incorreta." });
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
      { expiresIn: "720h" },
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

app.get(
  "/api/admin/busca",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { termo, turma, status, dataFiltro } = req.query; // Adicionado dataFiltro
    const { data: hoje } = getBrasiliaTime();
    const dataAlvo = dataFiltro || hoje; // Define se usa a data selecionada ou hoje

    try {
      let query = supabase.from("alunos").select("*");
      if (turma && turma !== "todos") query = query.eq("formacao", turma);
      if (termo)
        query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
      if (status === "incompleto") query = query.or("nome.is.null");

      const { data: alunos, error } = await query;
      if (error) throw error;

      let resultadoFinal = alunos; // Acréscimo para contagem

      // Lógica para filtros baseados em presenças - Adicionado presentes_no_dia
      if (status === "pendente_saida" || status === "checkout_antecipado" || status === "presentes_no_dia") {
        const { data: presencas } = await supabase
          .from("presencas")
          .select("aluno_email, check_out")
          .eq("data", dataAlvo); // Usa dataAlvo em vez de hoje fixo

        let emailsFiltrados = [];

        if (status === "pendente_saida") {
          // Check-in feito, mas check_out nulo
          emailsFiltrados = presencas
            .filter((p) => !p.check_out)
            .map((p) => p.aluno_email);
        } else if (status === "checkout_antecipado") {
          emailsFiltrados = presencas
            .filter((p) => {
              if (!p.check_out) return false;

              // Extrai apenas HH:mm independente do formato (ISO ou HH:mm:ss)
              let horaExtraida;
              if (p.check_out.includes("T")) {
                horaExtraida = p.check_out.split("T")[1].substring(0, 5);
              } else {
                horaExtraida = p.check_out.substring(0, 5);
              }

              // Verifica se a hora é válida antes de comparar
              const regexHora = /^([01]\d|2[0-3]):([0-5]\d)$/;
              if (!regexHora.test(horaExtraida)) return false;

              // Retorna true se saiu antes das 22:00
              return horaExtraida < "22:00";
            })
            .map((p) => p.aluno_email);
        } else if (status === "presentes_no_dia") {
          // Apenas mapeia todos que possuem registro na data alvo
          emailsFiltrados = presencas.map((p) => p.aluno_email);
        }

        resultadoFinal = alunos.filter((a) => emailsFiltrados.includes(a.email));
      }

      // Garante que o retorno seja sempre um objeto com as duas propriedades
      res.json({
        total: resultadoFinal.length,
        alunos: resultadoFinal
      });
    } catch (err) {
      res.status(500).json({ error: "Erro na busca administrativa." });
    }
  },
);
app.put(
  "/api/admin/aluno/:email",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { nome, email, data_nascimento } = req.body;
    const emailOriginal = decodeURIComponent(req.params.email);
    try {
      const { error } = await supabase
        .from("alunos")
        .update({ nome, email, data_nascimento })
        .eq("email", emailOriginal);
      if (error) throw error;
      res.json({ msg: "Dados atualizados com sucesso" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao atualizar aluno." });
    }
  },
);

app.delete(
  "/api/admin/aluno/:email",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const emailOriginal = decodeURIComponent(req.params.email);
    try {
      await supabase
        .from("presencas")
        .delete()
        .eq("aluno_email", emailOriginal);
      const { error } = await supabase
        .from("alunos")
        .delete()
        .eq("email", emailOriginal);
      if (error) throw error;
      res.json({ msg: "Cadastro excluído com sucesso!" });
    } catch (err) {
      res.status(500).json({ error: "Erro ao excluir cadastro." });
    }
  },
);

app.post(
  "/api/admin/ponto-manual",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { email, data, check_in, check_out, nota, revisao } = req.body;

    // Função para transformar "18:30" em "2026-01-29T18:30:00"
    const montarTimestamp = (valorHora) => {
      if (!valorHora) return null;
      // Se já estiver no formato completo (ISO), retorna ele mesmo
      if (valorHora.includes("T")) return valorHora;
      // Caso contrário, combina a data com a hora
      return `${data}T${valorHora}:00`;
    };

    try {
      const { data: novoPonto, error } = await supabase
        .from("presencas")
        .insert([
          {
            aluno_email: email.trim().toLowerCase(),
            data: data,
            check_in: montarTimestamp(check_in),
            check_out: montarTimestamp(check_out),
            feedback_nota: nota || null,
            feedback_texto: revisao || "",
          },
        ])
        .select();

      if (error) {
        console.error("ERRO SUPABASE:", error);
        return res.status(400).json({ error: error.message });
      }

      res.json({ msg: "Ponto manual registrado!", ponto: novoPonto[0] });
    } catch (err) {
      console.error("ERRO SERVIDOR:", err);
      res.status(500).json({ error: "Erro interno no servidor." });
    }
  },
);

app.post(
  "/api/admin/reset-session",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    res.json({ msg: "Reset solicitado." });
  },
);

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

app.get(
  "/api/admin/stats/:turma",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { turma } = req.params;
    const { data: hoje } = getBrasiliaTime();

    try {
      let queryAlunos = supabase.from("alunos").select("email");
      if (turma !== "todos") queryAlunos = queryAlunos.eq("formacao", turma);
      const { data: listaAlunos } = await queryAlunos;
      const emailsTurma = listaAlunos.map((a) => a.email);

      // Presenças totais no histórico desta turma
      const { count: totalPresencas } = await supabase
        .from("presencas")
        .select("*", { count: "exact", head: true })
        .in("aluno_email", emailsTurma);

      // Alunos que fizeram Check-in hoje
      const { data: presencasHoje } = await supabase
        .from("presencas")
        .select("check_in, check_out")
        .eq("data", hoje)
        .in("aluno_email", emailsTurma);

      const sessoesAtivas = presencasHoje.length;
      const concluidosHoje = presencasHoje.filter((p) => p.check_out).length;
      const pendentesSaida = presencasHoje.filter((p) => !p.check_out).length;

      res.json({
        totalPresencas: totalPresencas || 0,
        sessoesAtivas: sessoesAtivas || 0, // Total de check-ins hoje
        concluidosHoje: concluidosHoje || 0, // Check-in + Check-out
        totalAlunos: emailsTurma.length,
        pendentesSaida: pendentesSaida || 0,
      });
    } catch (err) {
      res.status(500).json({ error: "Erro ao carregar estatísticas." });
    }
  },
);
app.get(
  "/api/admin/relatorio/:turma",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { turma } = req.params;
    const { inicio, fim } = req.query; // Acréscimo: Captura datas de início e fim da URL
    try {
      let query = supabase
        .from("alunos")
        .select(
          "nome, email, formacao, presencas(data, check_in, check_out, feedback_nota, feedback_texto)",
        );

      if (turma !== "todos") query = query.eq("formacao", turma);

      const { data, error } = await query;
      if (error) throw error;

      const relatorioFormatado = [];

      data.forEach((aluno) => {
        const nomeAluno = aluno.nome || "Não cadastrado";
        const formacaoAluno = aluno.formacao || "Não informada";

        if (aluno.presencas && aluno.presencas.length > 0) {
          aluno.presencas.forEach((p) => {
            // Acréscimo: Lógica de filtro por período
            if (inicio && p.data < inicio) return;
            if (fim && p.data > fim) return;

            // Acréscimo: Função para extrair hora sem conversão de fuso
            const formatarHoraBruta = (valor) => {
              if (!valor) return "-";
              return valor.includes("T") ? valor.split("T")[1].substring(0, 5) : valor.substring(0, 5);
            };

            relatorioFormatado.push({
              Nome: nomeAluno,
              Email: aluno.email,
              Formacao: formacaoAluno,
              Data: p.data,
              Entrada: formatarHoraBruta(p.check_in),
              Saida: formatarHoraBruta(p.check_out),
              Nota: p.feedback_nota || "N/A",
              Feedback: p.feedback_texto || "",
            });
          });
        }
      });

      res.json(relatorioFormatado);
    } catch (err) {
      res.status(500).json({ error: "Erro ao gerar relatório." });
    }
  },
);

app.get("/api/health", (_, res) => res.json({ status: "online" }));

if (process.env.NODE_ENV !== "production") {
  app.listen(3001, () =>
    console.log("🚀 Backend rodando em http://localhost:3001"),
  );
}

module.exports = app;
