import React, { useState, useEffect, useCallback } from "react";
import { FORMACOES, API_URL } from "./Constants";

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [alunos, setAlunos] = useState([]);
  const [stats, setStats] = useState({
    totalPresencas: 0,
    sessoesAtivas: 0,
    faltasHoje: 0,
    totalAlunos: 0,
  });
  const [carregando, setCarregando] = useState(false);

  // Estados para o Modal de Detalhes
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [historicoAluno, setHistoricoAluno] = useState([]);
  const [modalAberto, setModalAberto] = useState(false);

  // Estados para Edição e Registro Manual
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

  // 1. Carregar estatísticas gerais da turma
  useEffect(() => {
    const carregarStats = async () => {
      try {
        const res = await fetch(`${API_URL}/admin/stats/${filtroTurma}`);
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Erro ao carregar estatísticas:", err);
      }
    };
    carregarStats();
  }, [filtroTurma]);

  // 2. Lógica de busca e filtros (USANDO useCallback para corrigir erro de dependência)
  const buscarAlunos = useCallback(
    async (termo) => {
      setCarregando(true);
      try {
        const res = await fetch(
          `${API_URL}/admin/busca?termo=${termo}&turma=${filtroTurma}&status=${filtroStatus}`,
        );
        if (res.ok) {
          const data = await res.json();
          setAlunos(data);
        }
      } catch (err) {
        console.error("Erro na busca:", err);
      } finally {
        setCarregando(false);
      }
    },
    [filtroTurma, filtroStatus],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      // Busca se houver texto OU se os filtros forem alterados
      if (busca || filtroStatus !== "todos" || filtroTurma !== "todos") {
        buscarAlunos(busca);
      } else {
        setAlunos([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [busca, filtroStatus, filtroTurma, buscarAlunos]);

  // 3. Ver Detalhes
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
      const res = await fetch(`${API_URL}/historico/aluno/${aluno.email}`);
      if (res.ok) {
        const data = await res.json();
        setHistoricoAluno(data);
        setModalAberto(true);
      }
    } catch {
      alert("Erro ao carregar histórico do aluno.");
    } finally {
      setCarregando(false);
    }
  };

  // 4. Salvar Edição (CORRIGIDO: Envia o e-mail original para identificar na tabela)
  const salvarEdicao = async () => {
    const emailOriginal = alunoSelecionado.email;

    if (!emailOriginal) {
      alert("Erro: Não foi possível identificar o aluno.");
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/aluno/${encodeURIComponent(emailOriginal)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dadosEdicao),
        },
      );

      if (res.ok) {
        alert("Dados atualizados com sucesso!");
        setModalAberto(false);
        buscarAlunos(busca); // Atualiza a lista na tela
      } else {
        const erro = await res.json();
        alert(`Erro: ${erro.error}`);
      }
    } catch {
      alert("Erro ao salvar alterações no servidor.");
    } finally {
      setCarregando(false);
    }
  };

  // 5. Registro Manual
  const registrarManual = async () => {
    if (!window.confirm("Deseja inserir este registro manualmente?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/ponto-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: alunoSelecionado.email, ...manualPonto }),
      });
      if (res.ok) {
        alert("Presença registrada com sucesso!");
        verDetalhes(alunoSelecionado);
      }
    } catch {
      alert("Erro ao registrar ponto manual.");
    }
  };

  const excluirAluno = async () => {
    if (
      !window.confirm(
        `TEM CERTEZA? Isso excluirá permanentemente o cadastro e todo o histórico de ${alunoSelecionado.nome}. Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }

    setCarregando(true);
    try {
      const res = await fetch(
        `${API_URL}/admin/aluno/${encodeURIComponent(alunoSelecionado.email)}`,
        {
          method: "DELETE",
        },
      );

      if (res.ok) {
        alert("Cadastro removido com sucesso!");
        setModalAberto(false);
        buscarAlunos(busca); // Atualiza a lista da busca para remover o item deletado
      } else {
        const erro = await res.json();
        alert(`Erro: ${erro.error}`);
      }
    } catch {
      alert("Erro de conexão ao tentar excluir.");
    } finally {
      setCarregando(false);
    }
  };

  // 6. Reset de Sessão
  const resetarSessao = async (email) => {
    if (
      !window.confirm(
        "Isso forçará o aluno a fazer login novamente na próxima vez que abrir o site. Continuar?",
      )
    )
      return;
    try {
      await fetch(`${API_URL}/admin/reset-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      alert("Solicitação de reset enviada.");
    } catch {
      alert("Erro ao resetar.");
    }
  };

  const exportarCSV = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/admin/relatorio/${filtroTurma}`);
      const data = await res.json();
      if (!res.ok || !data || data.length === 0) {
        alert("Não existem dados disponíveis para exportar.");
        return;
      }
      const cabecalho = "Nome,Email,Presencas\n";
      const csvContent = data
        .map(
          (aluno) =>
            `"${aluno.nome}","${aluno.email}",${aluno.presencas?.length || 0}`,
        )
        .join("\n");
      const blob = new Blob(["\ufeff" + cabecalho + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.setAttribute("download", `relatorio_${filtroTurma}.csv`);
      link.click();
    } catch {
      alert("Erro ao exportar relatório.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      className="app-wrapper"
      style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px" }}
    >
      <div style={{ marginBottom: "30px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Dashboard Administrativo</h2>
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
              Gestão em Tempo Real • Horário de Brasília • Geração Tech 3.0
            </p>
          </div>
          <select
            className="input-modern"
            style={{ width: "250px" }}
            value={filtroTurma}
            onChange={(e) => setFiltroTurma(e.target.value)}
          >
            {/* Opção primária e padrão selecionada automaticamente */}
            <option value="todos">Todas as Turmas</option>
            {FORMACOES.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginTop: "20px",
            background: "var(--border-subtle)",
            height: "10px",
            borderRadius: "5px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(stats.sessoesAtivas / (stats.totalAlunos || 1)) * 100}%`,
              background: "#008080",
              height: "100%",
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <p
          style={{
            fontSize: "0.75rem",
            marginTop: "5px",
            color: "var(--text-dim)",
          }}
        >
          Adesão da Aula: <strong>{stats.sessoesAtivas || 0} alunos</strong>{" "}
          fizeram check-in hoje.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <div
          className="stat-card"
          style={{
            padding: "20px",
            textAlign: "center",
            background: "var(--card-bg)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            CHECK-INS HOJE
          </span>
          <h2 style={{ color: "#008080", margin: "5px 0" }}>
            {stats.sessoesAtivas || 0}
          </h2>
        </div>
        <div
          className="stat-card"
          style={{
            padding: "20px",
            textAlign: "center",
            background: "var(--card-bg)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            TOTAL HISTÓRICO
          </span>
          <h2 style={{ margin: "5px 0" }}>{stats.totalPresencas || 0}</h2>
        </div>
        <div
          className="stat-card"
          style={{
            padding: "20px",
            textAlign: "center",
            background: "var(--card-bg)",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            PENDENTES SAÍDA
          </span>
          <h2 style={{ color: "#f59e0b", margin: "5px 0" }}>
            {stats.pendentesSaida || 0}
          </h2>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "20px",
        }}
      >
        <div className="shadow-card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
            <input
              type="text"
              className="input-modern"
              placeholder="Nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select
              className="input-modern"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{ width: "180px" }}
            >
              <option value="todos">Todos Alunos</option>
              <option value="pendente_saida">Esqueceram Saída</option>
              <option value="incompleto">Cadastro Incompleto</option>
            </select>
          </div>

          <div className="historico-container" style={{ minHeight: "300px" }}>
            {alunos.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      fontSize: "0.8rem",
                      color: "var(--text-dim)",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    <th>ALUNO</th>
                    <th>CONTATO</th>
                    <th style={{ textAlign: "right" }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map((aluno) => (
                    <tr
                      key={aluno.email}
                      style={{ borderBottom: "1px solid var(--border-subtle)" }}
                    >
                      <td style={{ padding: "12px 0" }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
                          {aluno.nome}
                        </div>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-dim)",
                          }}
                        >
                          {aluno.formacao_nome}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.8rem" }}>{aluno.email}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          onClick={() => verDetalhes(aluno)}
                          className="btn-secondary"
                          style={{ fontSize: "0.7rem", padding: "5px 10px" }}
                        >
                          Gerenciar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p
                style={{
                  textAlign: "center",
                  color: "var(--text-dim)",
                  marginTop: "50px",
                }}
              >
                {carregando
                  ? "Processando..."
                  : "Use a busca para gerenciar alunos."}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div className="shadow-card" style={{ padding: "20px" }}>
            <h4>Relatórios</h4>
            <button
              className="btn-ponto in"
              style={{ width: "100%" }}
              onClick={exportarCSV}
            >
              Exportar CSV
            </button>
          </div>
          <div
            className="shadow-card"
            style={{ padding: "20px", borderLeft: "4px solid #f59e0b" }}
          >
            <h4 style={{ color: "#f59e0b" }}>Lembrete Rápido</h4>
            <p style={{ fontSize: "0.75rem" }}>
              Use o filtro "Esqueceram Saída" para identificar quem não fechou o
              ponto na última aula.
            </p>
          </div>
        </div>
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
                  style={{
                    background: !editando ? "#008080" : "transparent",
                    color: !editando ? "white" : "var(--text-normal)",
                    border: "1px solid #008080",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Histórico
                </button>
                <button
                  onClick={() => setEditando(true)}
                  style={{
                    background: editando ? "#008080" : "transparent",
                    color: editando ? "white" : "var(--text-normal)",
                    border: "1px solid #008080",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Editar/Manual
                </button>
              </div>
            </div>

            {!editando ? (
              <div
                style={{
                  maxHeight: "300px",
                  overflowY: "auto",
                  marginBottom: "20px",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.85rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--border-subtle)",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "8px" }}>Data</th>
                      <th>Entrada</th>
                      <th>Saída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoAluno.map((h, i) => (
                      <tr
                        key={i}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <td style={{ padding: "8px" }}>
                          {new Date(h.data).toLocaleDateString("pt-BR", {
                            timeZone: "UTC",
                          })}
                        </td>
                        <td>{h.check_in || "--:--"}</td>
                        <td>{h.check_out || "--:--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    padding: "15px",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "8px",
                  }}
                >
                  <h5 style={{ marginTop: 0 }}>Editar Cadastro</h5>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "10px",
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
                    <input
                      className="input-modern"
                      value={dadosEdicao.email}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          email: e.target.value,
                        })
                      }
                      placeholder="Email"
                    />
                    <input
                      type="date"
                      className="input-modern"
                      value={dadosEdicao.data_nascimento}
                      onChange={(e) =>
                        setDadosEdicao({
                          ...dadosEdicao,
                          data_nascimento: e.target.value,
                        })
                      }
                      placeholder="Data de Nascimento"
                    />
                  </div>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: "10px", width: "100%" }}
                    onClick={salvarEdicao}
                  >
                    Salvar Alterações
                  </button>
                  <button
                    className="btn-secondary"
                    style={{
                      marginTop: "5px",
                      width: "100%",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                    }}
                    onClick={() => resetarSessao(alunoSelecionado.email)}
                  >
                    Forçar Deslogar Aluno
                  </button>
                </div>

                <button
                  className="btn-danger-outline"
                  style={{
                    marginTop: "10px",
                    width: "100%",
                    border: "1px solid #9d3131",
                    color: "#9d3131",
                  }}
                  onClick={excluirAluno}
                  disabled={carregando}
                >
                  🗑️ Excluir Cadastro Permanente
                </button>

                <div
                  style={{
                    padding: "15px",
                    background: "rgba(0,0,0,0.2)",
                    borderRadius: "8px",
                  }}
                >
                  <h5 style={{ marginTop: 0 }}>➕ Inserir Ponto Manual</h5>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "10px",
                    }}
                  >
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
                    style={{ marginTop: "10px", width: "100%" }}
                    onClick={registrarManual}
                  >
                    Registrar Presença Manual
                  </button>
                </div>
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
