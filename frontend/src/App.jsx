import React, { useState, useEffect, useMemo } from "react";
import "./App.css";

const API_URL =
  window.location.hostname === "localhost" ? "http://localhost:3001" : "/api";

const FORMACOES = [
  { id: "fullstack", nome: "Fullstack Developer", tag: "WEB" },
  { id: "ia-gen", nome: "IA Generativa", tag: "AI" },
  { id: "ia-soft", nome: "IA + Soft Skills", tag: "SOFT" },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [form, setForm] = useState({
    cpf: "",
    dataNasc: "",
    nome: "",
    formacao: "fullstack",
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [feedback, setFeedback] = useState({ nota: 0, revisao: "" });
  const [view, setView] = useState("aulas");
  const [historico, setHistorico] = useState([]);

  // Estados para o Painel Admin
  const [relatorioGeral, setRelatorioGeral] = useState([]);
  const [filtroTurma, setFiltroTurma] = useState("todos");
  const [buscaCpf, setBuscaCpf] = useState("");

  const TOTAL_AULAS = 10;

  const segundas = useMemo(() => {
    const dates = [];
    let d = new Date("2026-01-26T12:00:00");
    for (let i = 0; i < TOTAL_AULAS; i++) {
      dates.push(new Date(d).toLocaleDateString("pt-BR"));
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }, []);

  const [dataSel, setDataSel] = useState(segundas[0]);

  // ==========================================
  // LÓGICA DE SESSÃO PERSISTENTE (MEIA HORA)
  // ==========================================
  useEffect(() => {
    const sessaoSalva = localStorage.getItem("gt3_session");
    if (sessaoSalva) {
      const { userData, timestamp, curso } = JSON.parse(sessaoSalva);
      const meiaHora = 30 * 60 * 1000;
      if (Date.now() - timestamp < meiaHora) {
        setUser(userData);
        setSelectedCurso(curso);
      } else {
        localStorage.removeItem("gt3_session");
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("gt3_session");
    setUser(null);
  };

  useEffect(() => {
    isDarkMode
      ? document.body.classList.add("dark")
      : document.body.classList.remove("dark");
  }, [isDarkMode]);

  // ==========================================
  // LÓGICA DE FALTAS INTELIGENTES (DIAS PASSADOS)
  // ==========================================
  const estatisticasIndividuais = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diasLetivosPassados = segundas.filter((dataStr) => {
      const [dia, mes, ano] = dataStr.split("/");
      const dataAula = new Date(ano, mes - 1, dia);
      const limitePresenca = new Date(dataAula);
      limitePresenca.setHours(20, 0, 0); // Após 20h do dia da aula, já conta falta

      return (
        dataAula < hoje ||
        (dataAula.getTime() === hoje.getTime() && new Date() > limitePresenca)
      );
    });

    const totalPresentes = new Set(historico.map((h) => h.data)).size;
    const faltasReais = Math.max(0, diasLetivosPassados.length - totalPresentes);

    return { presencas: totalPresentes, faltas: faltasReais };
  }, [historico, segundas]);

  // ==========================================
  // CONTAGEM TOTAL POR TURMA (PAINEL ADMIN)
  // ==========================================
  const resumoAdmin = useMemo(() => {
    const dados = relatorioGeral.filter(
      (r) => filtroTurma === "todos" || r.formacao === filtroTurma
    );
    
    const totalPresencas = dados.filter(r => r.check_in).length;
    const totalRegistros = dados.length;

    return { totalPresencas, totalFaltas: totalRegistros - totalPresencas };
  }, [relatorioGeral, filtroTurma]);

  // FUNÇÃO PARA EXPORTAR CSV (EXCEL)
  const exportarExcel = () => {
    const dadosFiltrados = relatorioGeral.filter(
      (r) => filtroTurma === "todos" || r.formacao === filtroTurma,
    );
    let csv = "\ufeffNome;CPF;Turma;Data;Check-in;Check-out;Nota;Feedback\n";

    dadosFiltrados.forEach((row) => {
      csv += `${row.alunos?.nome || "Estudante"};${row.cpf};${row.formacao};${row.data};${row.check_in || "-"};${row.check_out || "-"};${row.compreensao || "-"};${row.feedback || "-"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `relatorio_gt3_${filtroTurma}.csv`);
    link.click();
  };

  const validarHorario = (tipo) => {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();

    if (tipo === "in") {
      return hora >= 18 && hora < 20;
    } else {
      if (hora === 22) {
        return minuto >= 0 && minuto <= 30;
      }
      return false;
    }
  };

  const handleLogin = async () => {
    if (!form.cpf || !form.dataNasc || !form.nome)
      return alert("Preencha todos os campos, incluindo seu nome!");
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: form.cpf.replace(/\D/g, ""),
          dataNascimento: form.dataNasc,
          nome: form.nome,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setSelectedCurso(form.formacao);
        // Salva sessão para 30 minutos
        localStorage.setItem(
          "gt3_session",
          JSON.stringify({ userData: data, timestamp: Date.now(), curso: form.formacao })
        );
      } else {
        alert(data.error);
      }
    } catch {
      alert("Erro de conexão com o servidor.");
    }
  };

  const carregarHistorico = async (cpfBusca) => {
    const targetCpf = cpfBusca || user.cpf;
    try {
      const res = await fetch(`${API_URL}/historico/${targetCpf}`);
      const data = await res.json();
      if (res.ok) {
        setHistorico(data);
        setView("historico");
      }
    } catch {
      alert("Erro ao carregar histórico.");
    }
  };

  const carregarRelatorioAdmin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/relatorio-geral`);
      const data = await res.json();
      if (res.ok) {
        setRelatorioGeral(data);
        setView("admin-geral");
      }
    } catch {
      alert("Erro ao carregar relatório administrativo.");
    }
  };

  const registrarPresenca = async (tipo, dadosExtra = {}) => {
    if (!validarHorario(tipo)) {
      const msg =
        tipo === "in"
          ? "O Check-in só é permitido entre 18:00 e 20:00."
          : "O Check-out só é permitido entre 22:00 e 22:30.";
      return alert(msg);
    }

    if (!selectedCurso || !user) return;
    const agoraStr = new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      const res = await fetch(`${API_URL}/presenca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: user.cpf,
          formacao: selectedCurso,
          tipo,
          data: dataSel,
          nota: dadosExtra.nota,
          revisao: dadosExtra.revisao,
        }),
      });

      if (res.ok) {
        alert(
          `✅ ${tipo === "in" ? "Check-in" : "Check-out"} realizado com sucesso às ${agoraStr}!`,
        );
        if (tipo === "out") {
          setModalOpen(false);
          setFeedback({ nota: 0, revisao: "" });
        }
        carregarHistorico();
      } else {
        const errorData = await res.json();
        alert("Erro no Banco: " + errorData.error);
      }
    } catch {
      alert("Erro ao salvar presença.");
    }
  };

  if (!user) {
    return (
      <div className="login-container">
        <button
          className="btn-secondary theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? "☀️" : "🌙"}
        </button>
        <div className="login-card">
          <div className="brand">
            <h1>
              GERAÇÃO <span>TECH 3.0</span>
            </h1>
          </div>
          <div id="loginForm">
            <input
              placeholder="Seu Nome Completo"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
            <input
              placeholder="CPF (Apenas números)"
              value={form.cpf}
              onChange={(e) => setForm({ ...form, cpf: e.target.value })}
            />
            <input
              type="date"
              value={form.dataNasc}
              onChange={(e) => setForm({ ...form, dataNasc: e.target.value })}
            />
            <div className="select-box" style={{ marginTop: "10px" }}>
              <label style={{ color: "white", fontSize: "0.8rem" }}>
                Sua Formação:
              </label>
              <select
                value={form.formacao}
                onChange={(e) => setForm({ ...form, formacao: e.target.value })}
              >
                {FORMACOES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-primary" onClick={handleLogin}>
              Entrar no Portal
            </button>
            <p
              style={{
                fontSize: "0.65rem",
                marginTop: "15px",
                opacity: 0.5,
                color: "white",
              }}
            >
              No primeiro acesso, informe seu nome para o cadastro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cursoAtual = FORMACOES.find((c) => c.id === selectedCurso);

  return (
    <div className="app-wrapper">
      <header>
        <div className="brand">
          <h1>
            GT <span>3.0</span>
          </h1>
          <div className="badge">{user.role?.toUpperCase() || "ALUNO"}</div>
        </div>
        <div className="nav-actions">
          {user.role === "admin" ? (
            <>
              <button
                className="btn-secondary"
                onClick={carregarRelatorioAdmin}
              >
                Relatório Geral
              </button>
              <button
                className="btn-secondary"
                onClick={() => setView("admin-busca")}
              >
                Busca por CPF
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary"
                onClick={() => setView("aulas")}
              >
                Marcar Presença
              </button>
              <button
                className="btn-secondary"
                onClick={() => carregarHistorico()}
              >
                Meu Histórico
              </button>
            </>
          )}
          <div className="tool-group">
            <button
              className="btn-secondary"
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? "☀️" : "🌙"}
            </button>
            <button className="btn-secondary" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="content-grid">
        {/* VIEW ADMIN: RELATÓRIO GERAL */}
        {user.role === "admin" && view === "admin-geral" && (
          <div className="admin-container">
            <div
              className="admin-header-box"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2>Relatório de Presenças por Turma</h2>
                <div style={{fontSize:'0.9rem', marginTop:'10px', opacity: 0.8}}>
                  <strong>Turma Atual:</strong> {resumoAdmin.totalPresencas} Presenças | {resumoAdmin.totalFaltas} Faltas
                </div>
              </div>
              <button
                className="btn-save"
                onClick={exportarExcel}
                style={{ backgroundColor: "#27ae60" }}
              >
                📥 Exportar Excel
              </button>
            </div>
            <div className="select-box" style={{ marginBottom: "20px" }}>
              <label>Filtrar por Formação:</label>
              <select
                onChange={(e) => setFiltroTurma(e.target.value)}
                value={filtroTurma}
              >
                <option value="todos">Todas as Turmas</option>
                {FORMACOES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
            <table className="historico-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Turma</th>
                  <th>Data Aula</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {relatorioGeral
                  .filter(
                    (r) =>
                      filtroTurma === "todos" || r.formacao === filtroTurma,
                  )
                  .map((item, i) => (
                    <tr key={i}>
                      <td>{item.alunos?.nome || "Estudante"}</td>
                      <td>{item.formacao.toUpperCase()}</td>
                      <td>
                        {new Date(item.data).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })}
                      </td>
                      <td>
                        {item.check_in
                          ? new Date(item.check_in).toLocaleTimeString("pt-BR")
                          : "-"}
                      </td>
                      <td>
                        {item.check_out
                          ? new Date(item.check_out).toLocaleTimeString("pt-BR")
                          : "-"}
                      </td>
                      <td>{item.compreensao || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW ADMIN: BUSCA INDIVIDUAL */}
        {user.role === "admin" && view === "admin-busca" && (
          <div className="historico-container">
            <h2>Consultar Aluno Individual</h2>
            <div
              className="select-box"
              style={{ display: "flex", gap: "10px", maxWidth: "400px" }}
            >
              <input
                placeholder="Digite o CPF do Aluno"
                value={buscaCpf}
                onChange={(e) => setBuscaCpf(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn-primary"
                onClick={() => carregarHistorico(buscaCpf)}
              >
                Buscar
              </button>
            </div>
          </div>
        )}

        {/* VIEW: HISTÓRICO */}
        {view === "historico" && (
          <div className="historico-container">
            <div
              className="perfil-info"
              style={{
                borderLeft: "4px solid var(--accent-glow)",
                paddingLeft: "15px",
              }}
            >
              <h2>
                {user.role === "admin"
                  ? `Histórico: ${historico[0]?.alunos?.nome || buscaCpf}`
                  : `Olá, ${user.nome}`}
              </h2>
              <div
                className="stats-container"
                style={{ display: "flex", gap: "20px", margin: "15px 0" }}
              >
                <div
                  className="stat-card"
                  style={{
                    flex: 1,
                    background: "var(--card)",
                    padding: "15px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      fontSize: "1.2rem",
                      color: "var(--accent)",
                    }}
                  >
                    {estatisticasIndividuais.presencas}
                  </strong>
                  <small>Presenças</small>
                </div>
                <div
                  className="stat-card"
                  style={{
                    flex: 1,
                    background: "var(--card)",
                    padding: "15px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      fontSize: "1.2rem",
                      color: "#ef4444",
                    }}
                  >
                    {estatisticasIndividuais.faltas}
                  </strong>
                  <small>Faltas Reais</small>
                </div>
              </div>
              {user.role !== "admin" && (
                <p>
                  <strong>CPF:</strong> {user.cpf}
                </p>
              )}
            </div>
            <table className="historico-table">
              <thead>
                <tr>
                  <th>Data Aula</th>
                  <th>Formação</th>
                  <th>Entrada</th>
                  <th>Saída</th>
                  <th>Nota</th>
                  <th>Feedback</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((item, idx) => (
                  <tr key={idx}>
                    <td>
                      {new Date(item.data).toLocaleDateString("pt-BR", {
                        timeZone: "UTC",
                      })}
                    </td>
                    <td>{item.formacao.toUpperCase()}</td>
                    <td>
                      {item.check_in
                        ? new Date(item.check_in).toLocaleTimeString("pt-BR")
                        : "-"}
                    </td>
                    <td>
                      {item.check_out
                        ? new Date(item.check_out).toLocaleTimeString("pt-BR")
                        : "-"}
                    </td>
                    <td>{item.compreensao || "-"}</td>
                    <td>
                      <small>{item.feedback || "-"}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {user.role === "admin" && (
              <button
                className="btn-secondary"
                style={{ marginTop: "20px" }}
                onClick={() => setView("admin-geral")}
              >
                Voltar ao Relatório
              </button>
            )}
          </div>
        )}

        {/* VIEW ALUNO: MARCAR PRESENÇA */}
        {user.role === "aluno" && view === "aulas" && (
          <>
            <div className="select-box">
              <label>Data da aula:</label>
              <select
                value={dataSel}
                onChange={(e) => setDataSel(e.target.value)}
              >
                {segundas.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <label style={{ marginLeft: "15px" }}>Trocar Turma:</label>
              <select
                value={selectedCurso}
                onChange={(e) => setSelectedCurso(e.target.value)}
              >
                {FORMACOES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>

            {cursoAtual && (
              <div className="aula">
                <div className="aula-header">
                  <small>{cursoAtual.tag}</small>
                  <h3>{cursoAtual.nome}</h3>
                  <span className="data-tag">Aula de {dataSel}</span>
                </div>
                <p
                  style={{
                    fontSize: "0.8rem",
                    opacity: 0.7,
                    marginBottom: "15px",
                  }}
                >
                  Check-in: 18h-20h | Check-out: 22h-22h30
                </p>
                <div className="aula-actions">
                  <button
                    className="btn-primary"
                    onClick={() => registrarPresenca("in")}
                  >
                    CHECK-IN
                  </button>
                  <button
                    className="btn-primary btn-checkout"
                    onClick={() => setModalOpen(true)}
                  >
                    CHECK-OUT
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="aula modal-content">
            <button className="close-modal" onClick={() => setModalOpen(false)}>
              &times;
            </button>
            <h3>Finalizar Aula</h3>
            <p>Como foi sua compreensão do conteúdo hoje?</p>
            <div className="rating-group">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setFeedback({ ...feedback, nota: n })}
                  className="btn-secondary"
                  style={{
                    flex: 1,
                    backgroundColor:
                      feedback.nota === n ? "var(--accent-glow)" : "",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <textarea
              className="input-notes"
              placeholder="O que revisar?"
              value={feedback.revisao}
              onChange={(e) =>
                setFeedback({ ...feedback, revisao: e.target.value })
              }
            />
            <button
              className="btn-save"
              onClick={() => registrarPresenca("out", feedback)}
            >
              SALVAR E SAIR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}