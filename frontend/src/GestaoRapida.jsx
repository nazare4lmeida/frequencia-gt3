import React, { useState, useEffect } from "react";
import { fetchComToken } from "./Api";
import { API_URL, FORMACOES } from "./Constants";

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
  const [dadosEdicao, setDadosEdicao] = useState({ nome: "", email: "", data_nascimento: "" });
  const [manualPonto, setManualPonto] = useState({
    data: new Date().toISOString().split("T")[0],
    check_in: "18:30",
    check_out: "22:00",
  });

  useEffect(() => {
    carregarTodos();
  }, []);

  const carregarTodos = async () => {
    setCarregando(true);
    try {
      const res = await fetchComToken(`/admin/busca?termo=&turma=todos&status=todos`);
      if (res.ok) {
        const data = await res.json();
        setAlunos(data.alunos || []);
      }
    } finally {
      setCarregando(false);
    }
  };

  // --- LÓGICA DE CRONOGRAMA GTECH (CONSIDERANDO APENAS CHECK-IN) ---
  const obterAulasOcorridas = (formacaoId) => {
    const hoje = new Date();
    // Definimos o horário de corte para a aula de hoje ser contada (ex: após 18:30)
    const corteHorario = "T18:30:00";

  // Apenas segundas para Fullstack (02/02 a 23/02)
    const cronogramaFullstack = [
      "2026-02-02", 
      "2026-02-13",
      "2026-02-16", 
      "2026-02-23" 
    ];

    // IA: Datas fornecidas por você (Majoritariamente segundas)
    const cronogramaIA = [
      "2026-02-02", "2026-02-09", "2026-02-23", 
      "2026-03-02", "2026-03-09", "2026-03-16", 
      "2026-03-23", "2026-03-30", "2026-04-06", 
      "2026-04-13", "2026-04-20"
    ];

    const datas = (formacaoId === "fullstack") ? cronogramaFullstack : cronogramaIA;
    
    return datas.filter(dataStr => {
      const dataAula = new Date(dataStr + corteHorario);
      return dataAula <= hoje;
    }).length;
  };

  const salvarNome = async (email, novoNome) => {
    const alunoOriginal = alunos.find(a => a.email === email);
    if (!novoNome || alunoOriginal.nome === novoNome) return;
    setStatusSalva(prev => ({ ...prev, [email]: 'salvando' }));
    try {
      const res = await fetch(`${API_URL}/admin/limpeza-nome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ email, nome: novoNome }),
      });
      if (res.ok) {
        setStatusSalva(prev => ({ ...prev, [email]: 'ok' }));
        setAlunos(prev => prev.map(a => a.email === email ? { ...a, nome: novoNome } : a));
      } else { setStatusSalva(prev => ({ ...prev, [email]: 'erro' })); }
    } catch { setStatusSalva(prev => ({ ...prev, [email]: 'erro' })); }
  };

  const exportarFaltosos = () => {
    const faltosos = alunosFiltrados.filter(a => {
        const totalAulas = obterAulasOcorridas(a.formacao);
        return (totalAulas - (a.total_presencas || 0)) > 0;
    });
    if (faltosos.length === 0) return alert("Nenhum faltoso encontrado.");
    const cabecalho = "Nome;Email;Turma;Presencas;Faltas\n";
    const linhas = faltosos.map(a => {
      const f = Math.max(0, obterAulasOcorridas(a.formacao) - (a.total_presencas || 0));
      return `${a.nome};${a.email};${a.formacao};${a.total_presencas || 0};${f}`;
    }).join("\n");
    const blob = new Blob(["\ufeff" + cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
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
    setDadosEdicao({ nome: aluno.nome, email: aluno.email, data_nascimento: aluno.data_nascimento || "" });
    try {
      const res = await fetch(`${API_URL}/historico/aluno/${aluno.email}`, { headers: { Authorization: `Bearer ${user.token}` } });
      if (res.ok) { setHistoricoAluno(await res.json()); setModalAberto(true); }
    } finally { setCarregando(false); }
  };

  const salvarEdicao = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/admin/aluno/${encodeURIComponent(alunoSelecionado.email)}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify(dadosEdicao),
      });
      if (res.ok) { alert("Atualizado!"); setModalAberto(false); carregarTodos(); }
    } finally { setCarregando(false); }
  };

  const registrarManual = async () => {
    if (!window.confirm("Registrar presença manual?")) return;
    try {
      const res = await fetch(`${API_URL}/admin/ponto-manual`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ email: alunoSelecionado.email, ...manualPonto }),
      });
      if (res.ok) { alert("Registrado!"); verDetalhes(alunoSelecionado); }
    } catch { alert("Erro ao registrar."); }
  };

  const alunosFiltrados = alunos.filter(a => filtroTurma === "todos" ? true : a.formacao === filtroTurma);

  if (carregando && !modalAberto) return <div className="app-wrapper">Carregando Auditoria GTech...</div>;

  return (
    <div className="app-wrapper">
      <div className="shadow-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: 'var(--teal-primary)' }}>📊 Geração Tech 3.0: Auditoria de Presenças</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Baseado apenas em Check-in (Início da contagem: 26/01).
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportarFaltosos} className="btn-secondary" style={{ border: '1px solid #ef4444', color: '#ef4444' }}>Exportar Faltosos</button>
            <select className="input-modern" style={{ width: '200px', margin: 0 }} value={filtroTurma} onChange={(e) => setFiltroTurma(e.target.value)}>
              <option value="todos">Todas as Formações</option>
              {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <button onClick={() => setView("admin")} className="btn-secondary">Voltar</button>
          </div>
        </div>
        
        <table className="historico-table">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>ALUNO (E-MAIL)</th>
              <th style={{ textAlign: 'center' }}>CHECK-INS</th>
              <th style={{ textAlign: 'center' }}>FALTAS</th>
              <th>NOME PARA CERTIFICADO</th>
              <th style={{ textAlign: 'right' }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {alunosFiltrados.map((aluno) => {
              const totalAulas = obterAulasOcorridas(aluno.formacao);
              const numFaltas = Math.max(0, totalAulas - (aluno.total_presencas || 0));
              const status = statusSalva[aluno.email];
              return (
                <tr key={aluno.email} style={{ background: numFaltas > 3 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                  <td style={{ fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: '600' }}>{aluno.email}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{aluno.formacao_nome}</div>
                  </td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--teal-primary)' }}>{aluno.total_presencas || 0}</td>
                  <td style={{ textAlign: 'center', color: numFaltas > 0 ? '#ef4444' : 'inherit', fontWeight: 'bold' }}>{numFaltas}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input type="text" className="input-modern" style={{ margin: 0, padding: '4px 8px', fontSize: '0.8rem', flex: 1, borderColor: status === 'ok' ? '#10b981' : status === 'erro' ? '#ef4444' : 'var(--border-subtle)' }} defaultValue={aluno.nome || ""} onBlur={(e) => salvarNome(aluno.email, e.target.value)} />
                      <span style={{ width: '20px' }}>{status === 'salvando' && "⏳"}{status === 'ok' && "✅"}{status === 'erro' && "❌"}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => verDetalhes(aluno)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '0.65rem' }}>Gerenciar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modalAberto && alunoSelecionado && (
        <div className="modal-overlay">
          <div className="modal-content shadow-card" style={{ maxWidth: "600px", width: "95%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <h3>{alunoSelecionado.nome}</h3>
              <div style={{ display: "flex", gap: "5px" }}>
                <button onClick={() => setEditando(false)} className="btn-secondary" style={{ background: !editando ? "var(--teal-primary)" : "transparent", color: !editando ? "white" : "inherit" }}>Histórico</button>
                <button onClick={() => setEditando(true)} className="btn-secondary" style={{ background: editando ? "var(--teal-primary)" : "transparent", color: editando ? "white" : "inherit" }}>Editar/Manual</button>
              </div>
            </div>
            {!editando ? (
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.85rem" }}>
                  <thead><tr style={{ textAlign: 'left' }}><th>Data</th><th>Entrada</th><th>Saída</th></tr></thead>
                  <tbody>
                    {historicoAluno.map((h, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 0" }}>{new Date(h.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</td>
                        <td>{h.check_in || "--:--"}</td><td>{h.check_out || "--:--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <input className="input-modern" value={dadosEdicao.nome} onChange={(e) => setDadosEdicao({...dadosEdicao, nome: e.target.value})} placeholder="Nome" />
                <button className="btn-secondary" style={{ width: "100%" }} onClick={salvarEdicao}>Salvar Alterações</button>
                <hr/>
                <h5 style={{ margin: 0 }}>Ponto Manual</h5>
                <div style={{ display: "flex", gap: "5px" }}>
                  <input type="date" className="input-modern" value={manualPonto.data} onChange={(e) => setManualPonto({...manualPonto, data: e.target.value})} />
                  <input type="time" className="input-modern" value={manualPonto.check_in} onChange={(e) => setManualPonto({...manualPonto, check_in: e.target.value})} />
                  <input type="time" className="input-modern" value={manualPonto.check_out} onChange={(e) => setManualPonto({...manualPonto, check_out: e.target.value})} />
                </div>
                <button className="btn-ponto in" style={{ width: "100%" }} onClick={registrarManual}>Registrar Manual (Check-in)</button>
              </div>
            )}
            <button className="btn-secondary" style={{ width: "100%", marginTop: "20px" }} onClick={() => setModalAberto(false)}>Fechar Janela</button>
          </div>
        </div>
      )}
    </div>
  );
}