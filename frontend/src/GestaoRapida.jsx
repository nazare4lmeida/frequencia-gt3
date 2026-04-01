import React, { useState, useEffect } from "react";
import { fetchComToken } from "./Api";
import { API_URL, FORMACOES } from "./Constants";

// ─────────────────────────────────────────────
// CRONOGRAMAS OFICIAIS (fonte única da verdade)
// ─────────────────────────────────────────────
const CRONOGRAMAS = {
  fullstack: ["2026-02-02", "2026-02-13", "2026-02-16", "2026-02-23"],
  ia: [
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

// Retorna quantas aulas do cronograma já ocorreram até agora
const obterAulasOcorridas = (formacaoId) => {
  const agora = new Date();
  const datas = CRONOGRAMAS[formacaoId] || [];
  return datas.filter((dataStr) => {
    // A aula conta após as 18:30 do dia
    const dataAula = new Date(dataStr + "T18:30:00");
    return dataAula <= agora;
  }).length;
};

// Retorna as datas oficiais que já ocorreram para uma formação
const obterDatasOcorridas = (formacaoId) => {
  const agora = new Date();
  const datas = CRONOGRAMAS[formacaoId] || [];
  return datas.filter((dataStr) => new Date(dataStr + "T18:30:00") <= agora);
};

export default function GestaoRapida({ user, setView }) {
  const [alunos, setAlunos] = useState([]);
  const [filtroTurma, setFiltroTurma] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [statusSalva, setStatusSalva] = useState({});

  // Estados para o Modal de Detalhes
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [historicoAluno, setHistoricoAluno] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState({
    nome: "",
    email: "",
    data_nascimento: "",
  });
  const [manualPonto, setManualPonto] = useState({
    data: new Date().toISOString().split("T")[0],
    check_in: "18:30",
    check_out: "22:00",
  });

  useEffect(() => {
    carregarTodos();
  }, []);

  // ─────────────────────────────────────────────
  // CARREGAMENTO PRINCIPAL
  // Busca alunos + histórico completo de todos,
  // depois recalcula total_presencas filtrando
  // apenas pelas datas oficiais de cada formação.
  // ─────────────────────────────────────────────
  const carregarTodos = async () => {
    setCarregando(true);
    try {
      // 1. Busca lista de alunos
      const resAlunos = await fetchComToken(
        `/admin/busca?termo=&turma=todos&status=todos`,
      );
      if (!resAlunos.ok) return;
      const dataAlunos = await resAlunos.json();
      const listaAlunos = dataAlunos.alunos || [];

      // 2. Para cada aluno, busca o histórico real e filtra pelo cronograma
      //    Fazemos em paralelo para ser mais rápido
      const alunosComPresencasReais = await Promise.all(
        listaAlunos.map(async (aluno) => {
          try {
            const resHist = await fetchComToken(
              `/historico/aluno/${aluno.email}`,
            );
            if (!resHist.ok) return aluno;

            const dadosBrutos = await resHist.json();
            const datasValidas = obterDatasOcorridas(aluno.formacao);

            // Conta apenas presenças em dias oficiais (deduplicado por data)
            const datasPresentes = new Set(
              dadosBrutos
                .map((p) => p.data.split("T")[0])
                .filter((d) => datasValidas.includes(d)),
            );

            return {
              ...aluno,
              total_presencas: datasPresentes.size,
            };
          } catch {
            return aluno;
          }
        }),
      );

      setAlunos(alunosComPresencasReais);
    } finally {
      setCarregando(false);
    }
  };

  const salvarNome = async (email, novoNome) => {
    const alunoOriginal = alunos.find((a) => a.email === email);
    if (!novoNome || alunoOriginal.nome === novoNome) return;
    setStatusSalva((prev) => ({ ...prev, [email]: "salvando" }));
    try {
      const res = await fetch(`${API_URL}/admin/limpeza-nome`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ email, nome: novoNome }),
      });
      if (res.ok) {
        setStatusSalva((prev) => ({ ...prev, [email]: "ok" }));
        setAlunos((prev) =>
          prev.map((a) => (a.email === email ? { ...a, nome: novoNome } : a)),
        );
      } else {
        setStatusSalva((prev) => ({ ...prev, [email]: "erro" }));
      }
    } catch {
      setStatusSalva((prev) => ({ ...prev, [email]: "erro" }));
    }
  };

  // ─────────────────────────────────────────────
  // HELPER: calcula faltas finais de um aluno
  // (usado tanto na tabela quanto na exportação)
  // ─────────────────────────────────────────────
  const calcularFaltas = (aluno) => {
    const totalAulas = obterAulasOcorridas(aluno.formacao);
    const presencasValidas = Math.min(aluno.total_presencas || 0, totalAulas);
    const faltasBrutas = Math.max(0, totalAulas - presencasValidas);

    if (aluno.se_ausenta_sempre) {
      return { presencasValidas, faltasExibidas: 0, sufixoAbono: " (ABONADO)" };
    }

    const faltasExibidas =
      aluno.saldo_abonos > 0
        ? Math.max(0, faltasBrutas - aluno.saldo_abonos)
        : faltasBrutas;

    return { presencasValidas, faltasExibidas, sufixoAbono: "" };
  };

  const exportarFaltosos = () => {
    const faltosos = alunosFiltrados.filter((a) => {
      const { faltasExibidas } = calcularFaltas(a);
      return faltasExibidas > 0;
    });

    if (faltosos.length === 0) return alert("Nenhum faltoso encontrado.");

    const cabecalho = "Nome;Email;Turma;Presencas;Faltas;Status\n";
    const linhas = faltosos
      .map((a) => {
        const { presencasValidas, faltasExibidas, sufixoAbono } =
          calcularFaltas(a);
        const status = sufixoAbono ? "ABONADO" : "";
        return `${a.nome || "Sem Nome"};${a.email};${a.formacao};${presencasValidas};${faltasExibidas};${status}`;
      })
      .join("\n");

    const blob = new Blob(["\ufeff" + cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `auditoria_faltas_gtech.csv`);
    link.click();
  };

  const verDetalhes = async (aluno) => {
    setCarregando(true);
    setAlunoSelecionado(aluno);
    setEditando(false);
    setDadosEdicao({
      nome: aluno.nome,
      email: aluno.email,
      data_nascimento: aluno.data_nascimento || "",
    });

    try {
      const res = await fetchComToken(`/historico/aluno/${aluno.email}`);
      if (res.ok) {
        const dadosBrutos = await res.json();
        const datasValidas = obterDatasOcorridas(aluno.formacao);

        const historicoFiltrado = dadosBrutos.filter((p) =>
          datasValidas.includes(p.data.split("T")[0]),
        );

        // Recalcula e sincroniza o total na tabela principal
        const totalReal = new Set(
          historicoFiltrado.map((p) => p.data.split("T")[0]),
        ).size;

        setAlunos((prev) =>
          prev.map((a) =>
            a.email === aluno.email ? { ...a, total_presencas: totalReal } : a,
          ),
        );
        setHistoricoAluno(historicoFiltrado);
        setModalAberto(true);
      }
    } finally {
      setCarregando(false);
    }
  };

  const salvarEdicao = async () => {
    setCarregando(true);
    try {
      const res = await fetchComToken(
        `/admin/aluno/${encodeURIComponent(alunoSelecionado.email)}`,
        "PUT",
        dadosEdicao,
      );
      if (res.ok) {
        alert("Atualizado!");
        setModalAberto(false);
        carregarTodos();
      }
    } finally {
      setCarregando(false);
    }
  };

  const registrarManual = async () => {
    if (!window.confirm("Registrar presença manual?")) return;
    try {
      const res = await fetchComToken(`/admin/ponto-manual`, "POST", {
        email: alunoSelecionado.email,
        ...manualPonto,
      });
      if (res.ok) {
        alert("Registrado!");
        verDetalhes(alunoSelecionado);
      }
    } catch {
      alert("Erro ao registrar.");
    }
  };

  const alunosFiltrados = alunos.filter((a) =>
    filtroTurma === "todos" ? true : a.formacao === filtroTurma,
  );

  if (carregando && !modalAberto)
    return <div className="app-wrapper">Carregando Auditoria GTech...</div>;

  return (
    <div className="app-wrapper">
      <div className="shadow-card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <div>
            <h3 style={{ color: "var(--teal-primary)" }}>
              📊 Geração Tech 3.0: Auditoria de Presenças
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
              Sincronizado com cronograma e justificativas de ausência.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setView("importacao")}
              className="btn-secondary"
              style={{ border: "1px dashed var(--teal-primary)" }}
            >
              📥 Importar Justificativas
            </button>
            <button
              onClick={exportarFaltosos}
              className="btn-secondary"
              style={{ border: "1px solid #ef4444", color: "#ef4444" }}
            >
              Exportar Faltosos
            </button>
            <select
              className="input-modern"
              style={{ width: "200px", margin: 0 }}
              value={filtroTurma}
              onChange={(e) => setFiltroTurma(e.target.value)}
            >
              <option value="todos">Todas as Formações</option>
              {FORMACOES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <button onClick={() => setView("admin")} className="btn-secondary">
              Voltar
            </button>
          </div>
        </div>

        <table className="historico-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>ALUNO (E-MAIL)</th>
              <th style={{ textAlign: "center" }}>CHECK-INS</th>
              <th style={{ textAlign: "center" }}>FALTAS</th>
              <th>NOME PARA CERTIFICADO</th>
              <th style={{ textAlign: "right" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.map((aluno) => {
              const { presencasValidas, faltasExibidas, sufixoAbono } =
                calcularFaltas(aluno);
              const status = statusSalva[aluno.email];

              return (
                <tr
                  key={aluno.email}
                  style={{
                    background:
                      faltasExibidas > 3
                        ? "rgba(239, 68, 68, 0.05)"
                        : "transparent",
                  }}
                >
                  <td style={{ fontSize: "0.75rem" }}>
                    <div style={{ fontWeight: "600" }}>{aluno.email}</div>
                    <div
                      style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}
                    >
                      {aluno.formacao_nome}
                      {aluno.justificou_ausencia && (
                        <span
                          style={{
                            marginLeft: "5px",
                            color: "var(--teal-primary)",
                          }}
                        >
                          [Forms OK]
                        </span>
                      )}
                    </div>
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      fontWeight: "bold",
                      color: "var(--teal-primary)",
                    }}
                  >
                    {presencasValidas}
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      color:
                        faltasExibidas > 0 ? "#ef4444" : "var(--teal-primary)",
                      fontWeight: "bold",
                    }}
                  >
                    {faltasExibidas}
                    {sufixoAbono}
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                      }}
                    >
                      <input
                        type="text"
                        className="input-modern"
                        style={{
                          margin: 0,
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          flex: 1,
                          borderColor:
                            status === "ok"
                              ? "#10b981"
                              : status === "erro"
                                ? "#ef4444"
                                : "var(--border-subtle)",
                        }}
                        defaultValue={aluno.nome || ""}
                        onBlur={(e) => salvarNome(aluno.email, e.target.value)}
                      />
                      <span style={{ width: "20px" }}>
                        {status === "salvando" && "⏳"}
                        {status === "ok" && "✅"}
                        {status === "erro" && "❌"}
                      </span>
                    </div>
                  </td>

                  <td style={{ textAlign: "right" }}>
                    <button
                      onClick={() => verDetalhes(aluno)}
                      className="btn-secondary"
                      style={{ padding: "4px 8px", fontSize: "0.65rem" }}
                    >
                      Gerenciar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalAberto && alunoSelecionado && (
        <div className="modal-overlay">
          <div
            className="modal-content shadow-card"
            style={{ maxWidth: "600px", width: "95%" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <h3>{alunoSelecionado.nome}</h3>
              <div style={{ display: "flex", gap: "5px" }}>
                <button
                  onClick={() => setEditando(false)}
                  className="btn-secondary"
                  style={{
                    background: !editando
                      ? "var(--teal-primary)"
                      : "transparent",
                    color: !editando ? "white" : "inherit",
                  }}
                >
                  Histórico
                </button>
                <button
                  onClick={() => setEditando(true)}
                  className="btn-secondary"
                  style={{
                    background: editando
                      ? "var(--teal-primary)"
                      : "transparent",
                    color: editando ? "white" : "inherit",
                  }}
                >
                  Editar/Manual
                </button>
              </div>
            </div>

            {!editando ? (
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left" }}>
                      <th>Data</th>
                      <th>Entrada</th>
                      <th>Saída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoAluno.length > 0 ? (
                      historicoAluno.map((h, i) => (
                        <tr
                          key={i}
                          style={{
                            borderBottom: "1px solid var(--border-subtle)",
                          }}
                        >
                          <td style={{ padding: "8px 0" }}>
                            {new Date(h.data).toLocaleDateString("pt-BR", {
                              timeZone: "UTC",
                            })}
                          </td>
                          <td>{h.check_in || "--:--"}</td>
                          <td>{h.check_out || "--:--"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="3"
                          style={{
                            textAlign: "center",
                            padding: "20px",
                            color: "var(--text-dim)",
                          }}
                        >
                          Nenhuma presença registrada nos dias oficiais de aula.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "15px",
                }}
              >
                <input
                  className="input-modern"
                  value={dadosEdicao.nome}
                  onChange={(e) =>
                    setDadosEdicao({ ...dadosEdicao, nome: e.target.value })
                  }
                  placeholder="Nome"
                />
                <button
                  className="btn-secondary"
                  style={{ width: "100%" }}
                  onClick={salvarEdicao}
                >
                  Salvar Alterações
                </button>
                <hr />
                <h5 style={{ margin: 0 }}>Ponto Manual</h5>
                <div style={{ display: "flex", gap: "5px" }}>
                  <input
                    type="date"
                    className="input-modern"
                    value={manualPonto.data}
                    onChange={(e) =>
                      setManualPonto({ ...manualPonto, data: e.target.value })
                    }
                  />
                  <input
                    type="time"
                    className="input-modern"
                    value={manualPonto.check_in}
                    onChange={(e) =>
                      setManualPonto({
                        ...manualPonto,
                        check_in: e.target.value,
                      })
                    }
                  />
                  <input
                    type="time"
                    className="input-modern"
                    value={manualPonto.check_out}
                    onChange={(e) =>
                      setManualPonto({
                        ...manualPonto,
                        check_out: e.target.value,
                      })
                    }
                  />
                </div>
                <button
                  className="btn-ponto in"
                  style={{ width: "100%" }}
                  onClick={registrarManual}
                >
                  Registrar Manual (Check-in)
                </button>
              </div>
            )}
            <button
              className="btn-secondary"
              style={{ width: "100%", marginTop: "20px" }}
              onClick={() => setModalAberto(false)}
            >
              Fechar Janela
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
