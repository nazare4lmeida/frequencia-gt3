import React, { useState, useEffect, useCallback } from "react";
import { fetchComToken } from "./Api";
import {
  API_URL,
  FORMACOES,
  obterDatasOcorridas,
  obterAulasOcorridas,
} from "./Constants";

export default function GestaoRapida({ user, setView }) {
  const [alunos, setAlunos] = useState([]);
  const [filtroTurma, setFiltroTurma] = useState("todos");
  const [carregando, setCarregando] = useState(true);
  const [statusSalva, setStatusSalva] = useState({});

  // Modal
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

  const carregarTodos = useCallback(async () => {
    setCarregando(true);
    try {
      const resAlunos = await fetchComToken(
        `/admin/busca?termo=&turma=todos&status=todos&_=${Date.now()}`,
      );

      if (!resAlunos.ok) throw new Error("Erro ao buscar alunos");

      const dataAlunos = await resAlunos.json();
      const listaAlunos = dataAlunos.alunos || [];

      console.log("RESPOSTA /admin/busca:", dataAlunos);
      console.log("LISTA ALUNOS:", listaAlunos.slice(0, 20));

      const alunosTratados = listaAlunos.map((aluno) => ({
        ...aluno,
        nome: aluno.nome || "",
        total_presencas: aluno.total_presencas || 0,
      }));

      setAlunos(alunosTratados);
    } catch (error) {
      console.error("Erro no carregamento:", error);
      alert("Erro ao carregar lista de alunos.");
    } finally {
      setCarregando(false);
    }
  }, []);

  // ─────────────────────────────────────────────
  // HELPER: calcula faltas finais (fonte única)
  // ─────────────────────────────────────────────
  const calcularFaltas = (aluno) => {
    const totalAulas = obterAulasOcorridas(aluno.formacao);
    const presencasValidas = Math.min(aluno.total_presencas || 0, totalAulas);
    const faltasBrutas = Math.max(0, totalAulas - presencasValidas);

    if (aluno.se_ausenta_sempre || aluno.justificou_ausencia) {
      return {
        totalAulas,
        presencasValidas,
        faltasExibidas: 0,
        sufixoAbono: " (JUSTIFICADO)",
      };
    }

    const faltasExibidas =
      (aluno.saldo_abonos || 0) > 0
        ? Math.max(0, faltasBrutas - aluno.saldo_abonos)
        : faltasBrutas;

    return { totalAulas, presencasValidas, faltasExibidas, sufixoAbono: "" };
  };

  // ─────────────────────────────────────────────
  // STATUS DO ALUNO PARA RELATÓRIO
  // ─────────────────────────────────────────────
  const calcularStatus = (aluno) => {
    if (aluno.se_ausenta_sempre || aluno.justificativa_ativa) {
      return "JUSTIFICADO";
    }

    const { faltasExibidas, totalAulas } = calcularFaltas(aluno);
    const pct = totalAulas > 0 ? (faltasExibidas / totalAulas) * 100 : 0;

    if (pct === 0) return "REGULAR";
    if (pct <= 45) return "ATENÇÃO";
    return "CRÍTICO";
  };

  const salvarNome = async (email, novoNome) => {
    const alunoOriginal = alunos.find((a) => a.email === email);
    if (!novoNome || alunoOriginal?.nome === novoNome) return;
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
  // EXPORTAÇÃO COMPLETA (todos os alunos)
  // ─────────────────────────────────────────────
  const exportarRelatorioCompleto = () => {
    if (alunosFiltrados.length === 0)
      return alert("Nenhum dado para exportar.");

    const cabecalho =
      "Nome;Email;Formação;Aulas Dadas;Presenças;Faltas Brutas;Abonos;Faltas Finais;Status\n";
    const linhas = alunosFiltrados
      .map((a) => {
        const { totalAulas, presencasValidas, faltasExibidas } =
          calcularFaltas(a);
        const faltasBrutas = Math.max(0, totalAulas - presencasValidas);
        const abonos = a.se_ausenta_sempre ? faltasBrutas : a.saldo_abonos || 0;
        return [
          a.nome || "Sem Nome",
          a.email,
          a.formacao_nome || a.formacao || "",
          totalAulas,
          presencasValidas,
          faltasBrutas,
          abonos,
          faltasExibidas,
          calcularStatus(a),
        ].join(";");
      })
      .join("\n");

    const blob = new Blob(["\ufeff" + cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `relatorio_gtech_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    link.click();
  };

  const exportarFaltosos = () => {
    const faltosos = alunosFiltrados.filter(
      (a) => calcularFaltas(a).faltasExibidas > 0,
    );
    if (faltosos.length === 0) return alert("Nenhum faltoso encontrado.");

    const cabecalho = "Nome;Email;Turma;Presenças;Faltas;Status\n";
    const linhas = faltosos
      .map((a) => {
        const { presencasValidas, faltasExibidas, sufixoAbono } =
          calcularFaltas(a);
        return `${a.nome || "Sem Nome"};${a.email};${a.formacao};${presencasValidas};${faltasExibidas};${sufixoAbono ? "JUSTIFICADO" : ""}`;
      })
      .join("\n");

    const blob = new Blob(["\ufeff" + cabecalho + linhas], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `faltosos_gtech_${new Date().toISOString().slice(0, 10)}.csv`,
    );
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
      const res = await fetchComToken("/admin/ponto-manual", "POST", {
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
    filtroTurma === "todos"
      ? true
      : String(a.formacao).toLowerCase().trim() ===
        String(filtroTurma).toLowerCase().trim(),
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
          <div
            style={{
              display: "flex",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              onClick={() => setView("importacao")}
              className="btn-secondary"
              style={{ border: "1px dashed var(--teal-primary)" }}
            >
              📥 Importar Justificativas
            </button>
            <button
              onClick={exportarRelatorioCompleto}
              className="btn-secondary"
              style={{
                border: "1px solid var(--teal-primary)",
                color: "var(--teal-primary)",
              }}
            >
              📋 Exportar Completo
            </button>
            <button
              onClick={exportarFaltosos}
              className="btn-secondary"
              style={{ border: "1px solid #ef4444", color: "#ef4444" }}
            >
              ⚠️ Exportar Faltosos
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

        {/* Resumo rápido por turma */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          {FORMACOES.map((f) => {
            const turmaAlunos = alunos.filter((a) => a.formacao === f.id);
            const faltosos = turmaAlunos.filter(
              (a) => calcularFaltas(a).faltasExibidas > 0,
            ).length;
            const aulasOcorridas = obterAulasOcorridas(f.id);
            return (
              <div
                key={f.id}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "12px 16px",
                  background: "rgba(0,128,128,0.05)",
                  borderRadius: "10px",
                  border: "1px solid rgba(0,128,128,0.15)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    marginBottom: "4px",
                  }}
                >
                  {f.nome} <span style={{ opacity: 0.6 }}>({f.tag})</span>
                </div>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: "bold",
                    color: "var(--teal-primary)",
                  }}
                >
                  {turmaAlunos.length}
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: "normal",
                      color: "var(--text-dim)",
                      marginLeft: "6px",
                    }}
                  >
                    alunos
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: faltosos > 0 ? "#ef4444" : "var(--text-dim)",
                  }}
                >
                  {faltosos > 0 ? `${faltosos} com falta` : "Todos em dia"} ·{" "}
                  {aulasOcorridas} aula{aulasOcorridas !== 1 ? "s" : ""} dada
                  {aulasOcorridas !== 1 ? "s" : ""}
                </div>
              </div>
            );
          })}
        </div>

        <table className="historico-table">
          <thead>
            <tr>
              <th style={{ width: "25%" }}>ALUNO (E-MAIL)</th>
              <th style={{ textAlign: "center" }}>AULAS</th>
              <th style={{ textAlign: "center" }}>CHECK-INS</th>
              <th style={{ textAlign: "center" }}>FALTAS</th>
              <th style={{ textAlign: "center" }}>STATUS</th>
              <th>NOME PARA CERTIFICADO</th>
              <th style={{ textAlign: "right" }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.map((aluno) => {
              const {
                totalAulas,
                presencasValidas,
                faltasExibidas,
                sufixoAbono,
              } = calcularFaltas(aluno);
              const statusAluno = calcularStatus(aluno);
              const statusCor =
                {
                  REGULAR: "#10b981",
                  ATENÇÃO: "#f59e0b",
                  CRÍTICO: "#ef4444",
                  JUSTIFICADO: "#1188b0",
                }[statusAluno] || "var(--text-dim)";
              const statusBg =
                {
                  REGULAR: "rgba(16,185,129,0.1)",
                  ATENÇÃO: "rgba(245,158,11,0.1)",
                  CRÍTICO: "rgba(239,68,68,0.1)",
                  JUSTIFICADO: "rgba(99,102,241,0.1)",
                }[statusAluno] || "transparent";
              const st = statusSalva[aluno.email];

              return (
                <tr
                  key={aluno.email}
                  style={{
                    background:
                      statusAluno === "CRÍTICO"
                        ? "rgba(239,68,68,0.04)"
                        : "transparent",
                  }}
                >
                  <td style={{ fontSize: "0.75rem" }}>
                    <div style={{ fontWeight: "600" }}>{aluno.email}</div>
                    <div
                      style={{ fontSize: "0.65rem", color: "var(--text-dim)" }}
                    >
                      {aluno.formacao_nome || aluno.formacao}
                      {(aluno.justificou_ausencia ||
                        aluno.tem_log_justificativa) && (
                        <span
                          style={{
                            marginLeft: "5px",
                            color: "var(--teal-primary)",
                          }}
                        >
                          [JUSTIFICADO]
                        </span>
                      )}
                    </div>
                  </td>

                  <td
                    style={{
                      textAlign: "center",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    {totalAulas}
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
                    {sufixoAbono ? "–" : faltasExibidas}
                  </td>

                  <td style={{ textAlign: "center" }}>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: "bold",
                        color: statusCor,
                        background: statusBg,
                        padding: "3px 8px",
                        borderRadius: "20px",
                        border: `1px solid ${statusCor}33`,
                      }}
                    >
                      {statusAluno}
                    </span>
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
                            st === "ok"
                              ? "#10b981"
                              : st === "erro"
                                ? "#ef4444"
                                : "var(--border-subtle)",
                        }}
                        defaultValue={aluno.nome || ""}
                        onBlur={(e) => salvarNome(aluno.email, e.target.value)}
                      />
                      <span style={{ width: "20px" }}>
                        {st === "salvando" && "⏳"}
                        {st === "ok" && "✅"}
                        {st === "erro" && "❌"}
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

      {/* MODAL */}
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
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3 style={{ margin: 0 }}>
                  {alunoSelecionado.nome || alunoSelecionado.email}
                </h3>
                {(() => {
                  const { totalAulas, presencasValidas, faltasExibidas } =
                    calcularFaltas(alunoSelecionado);
                  const status = calcularStatus(alunoSelecionado);
                  return (
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-dim)",
                        marginTop: "4px",
                      }}
                    >
                      {presencasValidas}/{totalAulas} aulas · {faltasExibidas}{" "}
                      falta{faltasExibidas !== 1 ? "s" : ""} ·{" "}
                      <strong
                        style={{
                          color: {
                            REGULAR: "#10b981",
                            ATENÇÃO: "#f59e0b",
                            CRÍTICO: "#ef4444",
                            JUSTIFICADO: "#21a4d7",
                          }[status],
                        }}
                      >
                        {status}
                      </strong>
                    </div>
                  );
                })()}
              </div>
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
                          <td>
                            {h.check_in
                              ? String(h.check_in).slice(11, 16) || h.check_in
                              : "--:--"}
                          </td>
                          <td>
                            {h.check_out
                              ? String(h.check_out).slice(11, 16) || h.check_out
                              : "--:--"}
                          </td>
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
                  placeholder="Nome completo"
                />
                <button
                  className="btn-secondary"
                  style={{ width: "100%" }}
                  onClick={salvarEdicao}
                >
                  Salvar Alterações
                </button>
                <hr />
                <h5 style={{ margin: 0 }}>Registrar Ponto Manual</h5>
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
                  Registrar Manual
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
