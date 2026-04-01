const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

if (!supabaseUrl || !supabaseKey || !JWT_SECRET) {
  console.error(
    "ERRO: Variáveis de ambiente (SUPABASE ou JWT_SECRET) não configuradas!",
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// CRONOGRAMAS OFICIAIS (fonte única — backend)
// ==========================================
const CRONOGRAMAS = {
  fullstack: ["2026-02-02", "2026-02-13", "2026-02-16", "2026-02-23"],
  "ia-gen": [
    "2026-02-02",
    "2026-02-09",
    "2026-02-23",
    "2026-03-02",
    "2026-03-09",
    "2026-03-16",
    "2026-03-23",
    "2026-03-30",
    "2026-04-06",
    "2026-04-13",
  ],
  "ia-soft": [
    "2026-02-02",
    "2026-02-09",
    "2026-02-23",
    "2026-03-02",
    "2026-03-09",
    "2026-03-16",
    "2026-03-23",
    "2026-03-30",
    "2026-04-06",
    "2026-04-13",
  ],
};

const obterDatasOcorridas = (formacaoId) => {
  const agora = new Date();
  const datas = CRONOGRAMAS[formacaoId] || [];
  return datas.filter((d) => new Date(d + "T18:30:00") <= agora);
};

// ==========================================
// MIDDLEWARES
// ==========================================

const verificarToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token)
    return res
      .status(401)
      .json({ error: "Acesso negado. Faça login novamente." });
  try {
    req.usuarioLogado = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res
      .status(401)
      .json({ error: "Sua sessão expirou. Entre novamente." });
  }
};

const verificarAdmin = (req, res, next) => {
  if (req.usuarioLogado.role !== "admin")
    return res
      .status(403)
      .json({ error: "Acesso restrito a administradores." });
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
  return {
    data: brasilia.toISOString().split("T")[0],
    hora: brasilia.toLocaleTimeString("pt-BR", { hour12: false }),
  };
};

// ==========================================
// LOGIN E PERFIL
// ==========================================

app.post("/api/login", async (req, res) => {
  const { email, dataNascimento, formacao } = req.body;
  if (!email || !dataNascimento)
    return res.status(400).json({ error: "Dados obrigatórios ausentes." });

  const emailFormatado = email.trim().toLowerCase();

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
      token,
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
          { email: emailFormatado, data_nascimento: dataNascimento, formacao },
        ])
        .select();
      if (insertError) throw insertError;
      aluno = novoAluno[0];
    } else {
      aluno = alunos[0];
      if (aluno.data_nascimento) {
        const dataBanco = new Date(aluno.data_nascimento)
          .toISOString()
          .split("T")[0];
        if (dataBanco !== dataNascimento)
          return res
            .status(401)
            .json({ error: "Data de nascimento incorreta." });
      }
      if (aluno.formacao && formacao && aluno.formacao !== formacao)
        return res.status(403).json({
          error: `Você já está registrado na formação ${aluno.formacao}.`,
        });
      if (formacao && !aluno.formacao) {
        await supabase
          .from("alunos")
          .update({ formacao })
          .eq("email", emailFormatado);
        aluno.formacao = formacao;
      }
    }

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
    res.status(500).json({ error: "Erro ao carregar perfil." });
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
    res.status(500).json({ error: "Erro ao salvar perfil." });
  }
});

// ==========================================
// REGISTRAR PONTO
// ==========================================

app.post("/api/ponto", verificarToken, async (req, res) => {
  const { aluno_id, nota, revisao } = req.body;
  const { data: hoje, hora: agora } = getBrasiliaTime();
  const emailBusca = aluno_id.trim().toLowerCase();
  const timestampCompleto = `${hoje}T${agora}`;

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
          { aluno_email: emailBusca, data: hoje, check_in: timestampCompleto },
        ])
        .select();
      if (insError) throw insError;
      return res.json({
        msg: "Check-in realizado com sucesso!",
        ponto: novoPonto[0],
      });
    } else {
      if (pontoExistente.check_out)
        return res.json({ msg: "Você já concluiu sua presença de hoje." });
      const { data: atualizado, error: updError } = await supabase
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
        ponto: atualizado[0],
      });
    }
  } catch (err) {
    console.error("ERRO NO PONTO:", err);
    res.status(500).json({ error: "Erro ao processar presença." });
  }
});

// ==========================================
// ADMIN — AUDITORIA UNIFICADA
// Retorna alunos com total_presencas já calculado
// filtrando pelo cronograma oficial de cada formação.
// Uma única requisição substitui N+1 do frontend.
// ==========================================

app.get(
  "/api/admin/auditoria",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { turma } = req.query;
    try {
      let queryAlunos = supabase.from("alunos").select("*");
      if (turma && turma !== "todos")
        queryAlunos = queryAlunos.eq("formacao", turma);
      const { data: alunos, error: errAlunos } = await queryAlunos;
      if (errAlunos) throw errAlunos;

      const { data: todasPresencas, error: errP } = await supabase
        .from("presencas")
        .select("aluno_email, data, check_in, check_out");
      if (errP) throw errP;

      const presencasPorEmail = {};
      for (const p of todasPresencas || []) {
        const email = p.aluno_email?.trim().toLowerCase();
        if (!presencasPorEmail[email]) presencasPorEmail[email] = [];
        presencasPorEmail[email].push(p);
      }

      const alunosComCalculo = alunos.map((aluno) => {
        const emailAlu = aluno.email?.trim().toLowerCase();
        const datasValidas = new Set(obterDatasOcorridas(aluno.formacao));
        const presencasDoAluno = presencasPorEmail[emailAlu] || [];
        const datasPresentes = new Set(
          presencasDoAluno
            .map((p) => (p.data.includes("T") ? p.data.split("T")[0] : p.data))
            .filter((d) => datasValidas.has(d)),
        );
        return { ...aluno, total_presencas: datasPresentes.size };
      });
      console.log("AUDITORIA PARAM TURMA:", turma);
      console.log("AUDITORIA TOTAL:", alunosComCalculo.length);
      console.log(
        "AUDITORIA AMOSTRA:",
        alunosComCalculo.slice(0, 20).map((a) => ({
          nome: a.nome,
          email: a.email,
          formacao: a.formacao,
          se_ausenta_sempre: a.se_ausenta_sempre,
          saldo_abonos: a.saldo_abonos,
        })),
      );

      res.json({ total: alunosComCalculo.length, alunos: alunosComCalculo });
    } catch (err) {
      console.error("ERRO AUDITORIA:", err);
      res.status(500).json({ error: "Erro ao gerar auditoria." });
    }
  },
);

// ==========================================
// ADMIN — BUSCA GERAL
// ==========================================

app.get(
  "/api/admin/busca",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { termo, turma, status, dataFiltro } = req.query;
    const { data: hoje } = getBrasiliaTime();
    const dataAlvo = dataFiltro || hoje;

    try {
      let query = supabase.from("alunos").select("*");
      if (turma && turma !== "todos") query = query.eq("formacao", turma);
      if (termo)
        query = query.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
      if (termo) {
        // Se houver termo, buscamos no email ou no nome (mesmo que nulo)
        query = query.or(`email.ilike.%${termo}%,nome.ilike.%${termo}%`);
      }
      const { data: alunos, error } = await query.range(0, 5000);
      console.log("TOTAL:", alunos.length);

      const emails = alunos.map((a) => a.email);

      // testa um específico
      console.log("TEM TAL EMAIL?", emails.includes("acacia.rocha@gmail.com"));
      if (error) throw error;

      let resultadoFinal = alunos;

      if (
        ["pendente_saida", "checkout_antecipado", "presentes_no_dia"].includes(
          status,
        )
      ) {
        const { data: presencas } = await supabase
          .from("presencas")
          .select("aluno_email, check_in, check_out")
          .eq("data", dataAlvo);

        let emailsFiltrados = [];
        if (status === "pendente_saida") {
          emailsFiltrados = presencas
            .filter((p) => !p.check_out)
            .map((p) => p.aluno_email);
        } else if (status === "checkout_antecipado") {
          emailsFiltrados = presencas
            .filter((p) => {
              if (!p.check_out) return false;
              const hora = p.check_out.includes("T")
                ? p.check_out.split("T")[1].substring(0, 5)
                : p.check_out.substring(0, 5);
              return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora) && hora < "22:00";
            })
            .map((p) => p.aluno_email);
        } else if (status === "presentes_no_dia") {
          const presencasHoje = presencas.reduce((acc, p) => {
            acc[p.aluno_email] = p;
            return acc;
          }, {});
          resultadoFinal = alunos
            .filter((a) => presencasHoje[a.email])
            .map((a) => ({
              ...a,
              check_in: presencasHoje[a.email]?.check_in,
              check_out: presencasHoje[a.email]?.check_out,
            }));
          return res.json({
            total: resultadoFinal.length,
            alunos: resultadoFinal,
          });
        }
        resultadoFinal = alunos.filter((a) =>
          emailsFiltrados.includes(a.email),
        );
      }

      const { data: todasPresencas } = await supabase
        .from("presencas")
        .select("aluno_email, data");

      const { data: logsJustificativa, error: errLogs } = await supabase
        .from("justificativas_logs")
        .select("aluno_email");

      if (errLogs) throw errLogs;

      const emailsComLog = new Set(
        (logsJustificativa || [])
          .map((j) => j.aluno_email?.trim().toLowerCase())
          .filter(Boolean),
      );

      const resultado = resultadoFinal.map((aluno) => {
        const emailAlu = aluno.email?.trim().toLowerCase();
        const datasValidas = new Set(obterDatasOcorridas(aluno.formacao));

        const presencasValidas = (todasPresencas || []).filter((p) => {
          const d = p.data.includes("T") ? p.data.split("T")[0] : p.data;
          return (
            p.aluno_email?.trim().toLowerCase() === emailAlu &&
            datasValidas.has(d)
          );
        }).length;

        const temLogJustificativa = emailsComLog.has(emailAlu);

        return {
          ...aluno,
          total_presencas: presencasValidas,
          tem_log_justificativa: temLogJustificativa,
          justificativa_ativa:
            Boolean(aluno.justificou_ausencia) || temLogJustificativa,
        };
      });

      res.json({ total: resultado.length, alunos: resultado });
    } catch (err) {
      console.error("ERRO BUSCA:", err);
      res.status(500).json({ error: "Erro na busca administrativa." });
    }
  },
);

// ==========================================
// ADMIN — CRUD ALUNOS
// ==========================================

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
    } catch {
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
    } catch {
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
    const ts = (v) => (!v ? null : v.includes("T") ? v : `${data}T${v}:00`);
    try {
      const { data: novoPonto, error } = await supabase
        .from("presencas")
        .insert([
          {
            aluno_email: email.trim().toLowerCase(),
            data,
            check_in: ts(check_in),
            check_out: ts(check_out),
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
  (req, res) => {
    res.json({ msg: "Reset solicitado." });
  },
);

app.patch(
  "/api/admin/limpeza-nome",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { email, nome } = req.body;
    if (!email || nome === undefined)
      return res.status(400).json({ error: "E-mail e nome são obrigatórios." });
    try {
      const { error } = await supabase
        .from("alunos")
        .update({ nome: nome.trim() })
        .eq("email", email.trim().toLowerCase());
      if (error) throw error;
      res.json({ msg: "Nome atualizado com sucesso!" });
    } catch (err) {
      console.error("ERRO LIMPEZA:", err);
      res.status(500).json({ error: "Erro ao atualizar nome." });
    }
  },
);

// ==========================================
// ADMIN — IMPORTAR JUSTIFICATIVA
// ==========================================

app.post(
  "/api/admin/importar-justificativa",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    // MAPEAMENTO MELHORADO: Aceita tanto o que o front manda quanto o que a planilha bruta mandaria
    const email = req.body.email || req.body.aluno_email;
    const nome = req.body.nome || req.body.nome_aluno;

    // aceita front ou CSV bruto
    const curso = req.body.curso || req.body.formacao;

    // aceita front ou CSV bruto
    const recorrencia =
      req.body.recorrencia || req.body.frequencia || req.body.tipo_recorrencia;

    const emailFormatado = email?.trim().toLowerCase() || null;
    const nomeLimpo = nome?.trim() || null;
    const recorrenciaLimpa = recorrencia?.toString().trim().toLowerCase() || "";

    const mapaFormacoes = {
      fullstack: "fullstack",
      "ia-gen": "ia-gen",
      "ia-soft": "ia-soft",
      "ia soft": "ia-soft",
      ia_soft: "ia-soft",
      "ia-ss": "ia-soft",
    };

    const cursoRecebido = curso?.toString().trim().toLowerCase() || "";
    const cursoNormalizado = mapaFormacoes[cursoRecebido] || null;

    if (!cursoNormalizado) {
      return res.status(400).json({
        error: `Formação inválida (${cursoRecebido}). Use apenas "fullstack", "ia-gen" ou "ia-soft".`,
      });
    }

    const eSempre = recorrenciaLimpa.includes("sempre");
    const eUmaVez =
      recorrenciaLimpa.includes("uma vez") ||
      recorrenciaLimpa.includes("algumas");

    try {
      let alunoExistente = null;
      let modo = "nenhum";

      if (!emailFormatado) {
        return res.status(400).json({
          error: `Aluno "${nomeLimpo || "sem nome"}" está sem e-mail.`,
        });
      }

      // Busca se o aluno já existe para decidir entre Update ou Insert
      const { data: alunosPorEmail, error: erroBuscaEmail } = await supabase
        .from("alunos")
        .select("*")
        .eq("email", emailFormatado)
        .limit(1);

      if (erroBuscaEmail) {
        console.error("ERRO BUSCA EMAIL:", erroBuscaEmail);
        return res.status(500).json({ error: "Erro ao buscar aluno." });
      }

      if (alunosPorEmail && alunosPorEmail.length > 0) {
        alunoExistente = alunosPorEmail[0];
      }

      if (alunoExistente) {
        modo = "update";

        // Incrementa o saldo apenas se for justificativa pontual ("uma vez")
        const novoSaldo = eSempre
          ? Number(alunoExistente.saldo_abonos || 0)
          : Number(alunoExistente.saldo_abonos || 0) + (eUmaVez ? 1 : 0);

        const payloadUpdate = {
          email: emailFormatado,
          nome: nomeLimpo || alunoExistente.nome,
          formacao: cursoNormalizado, // ISSO garante a correção da turma no banco
          justificou_ausencia: true,
          se_ausenta_sempre:
            Boolean(alunoExistente.se_ausenta_sempre) || eSempre,
          saldo_abonos: novoSaldo,
        };

        const { data: updateData, error: updateError } = await supabase
          .from("alunos")
          .update(payloadUpdate)
          .eq("email", emailFormatado)
          .select();

        if (updateError) throw updateError;
        alunoExistente = updateData[0];
      } else {
        modo = "insert";

        const payloadInsert = {
          email: emailFormatado,
          nome: nomeLimpo,
          formacao: cursoNormalizado,
          justificou_ausencia: true,
          se_ausenta_sempre: eSempre,
          saldo_abonos: eUmaVez ? 1 : 0,
        };

        const { data: insertData, error: insertError } = await supabase
          .from("alunos")
          .insert([payloadInsert])
          .select();

        if (insertError) throw insertError;
        alunoExistente = insertData[0];
      }

      // Registro de Log na tabela de justificativas
      if (alunoExistente?.email) {
        await supabase.from("justificativas_logs").insert([
          {
            aluno_email: alunoExistente.email,
            tipo_recorrencia: recorrenciaLimpa,
          },
        ]);
      }

      console.log(
        `✅ [${modo.toUpperCase()}] ${emailFormatado} -> ${cursoNormalizado}`,
      );

      return res.json({
        msg: "OK",
        modo,
        aluno: alunoExistente,
      });
    } catch (err) {
      console.error("ERRO IMPORTAR:", err);
      return res.status(500).json({ error: "Erro interno no servidor." });
    }
  },
);
// ==========================================
// HISTÓRICO DO ALUNO
// ==========================================

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

// ==========================================
// STATS DO DASHBOARD
// ==========================================

app.get(
  "/api/admin/stats/:turma",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { turma } = req.params;
    const { dataFiltro } = req.query;
    const { data: hoje } = getBrasiliaTime();
    const dataAlvo = dataFiltro || hoje;

    try {
      let queryAlunos = supabase.from("alunos").select("email");
      if (turma !== "todos") queryAlunos = queryAlunos.eq("formacao", turma);
      const { data: listaAlunos, error: errA } = await queryAlunos;
      if (errA) throw errA;
      const emailsTurma = (listaAlunos || []).map((a) => a.email);

      let queryHoje = supabase
        .from("presencas")
        .select("check_in, check_out")
        .eq("data", dataAlvo);
      if (turma !== "todos")
        queryHoje = queryHoje.in("aluno_email", emailsTurma);
      const { data: presencasDia, error: errH } = await queryHoje;
      if (errH) throw errH;

      const dados = presencasDia || [];
      res.json({
        totalAlunos: (listaAlunos || []).length,
        sessoesAtivas: dados.length,
        concluidosHoje: dados.filter((p) => p.check_out).length,
        pendentesSaida: dados.filter((p) => !p.check_out).length,
      });
    } catch (err) {
      console.error("ERRO STATS:", err);
      res.status(500).json({ error: "Erro ao carregar estatísticas." });
    }
  },
);

// ==========================================
// RELATÓRIO DETALHADO
// ==========================================

app.get(
  "/api/admin/relatorio/:turma",
  verificarToken,
  verificarAdmin,
  async (req, res) => {
    const { turma } = req.params;
    const { inicio, fim } = req.query;
    try {
      let query = supabase
        .from("alunos")
        .select(
          "nome, email, formacao, presencas(data, check_in, check_out, feedback_nota, feedback_texto)",
        );
      if (turma !== "todos") query = query.eq("formacao", turma);
      const { data, error } = await query;
      if (error) throw error;

      const formatarHora = (v) =>
        !v
          ? "-"
          : v.includes("T")
            ? v.split("T")[1].substring(0, 5)
            : v.substring(0, 5);
      const relatorio = [];
      data.forEach((aluno) => {
        (aluno.presencas || []).forEach((p) => {
          if (inicio && p.data < inicio) return;
          if (fim && p.data > fim) return;
          relatorio.push({
            Nome: aluno.nome || "Não cadastrado",
            Email: aluno.email,
            Formacao: aluno.formacao || "Não informada",
            Data: p.data,
            Entrada: formatarHora(p.check_in),
            Saida: formatarHora(p.check_out),
            Nota: p.feedback_nota || "N/A",
            Feedback: p.feedback_texto || "",
          });
        });
      });
      res.json(relatorio);
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
