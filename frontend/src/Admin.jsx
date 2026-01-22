import React, { useState, useEffect } from "react";
import { FORMACOES, API_URL } from "./Constants";

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("fullstack");
  const [alunos, setAlunos] = useState([]);
  const [stats, setStats] = useState({ totalPresencas: 0, sessoesAtivas: 0, faltasHoje: 0 });
  const [carregando, setCarregando] = useState(false);
  const [fezBusca, setFezBusca] = useState(false);

  // 1. Efeito para carregar estatísticas gerais da turma selecionada
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

  // Lógica de busca de alunos (mantida conforme seu original)
  const buscarAlunos = async (termo) => {
    if (termo.length < 3) {
      setAlunos([]);
      setFezBusca(false);
      return;
    }
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/admin/busca?termo=${termo}`);
      if (res.ok) {
        const data = await res.json();
        setAlunos(data);
        setFezBusca(true);
      }
    } catch (err) {
      console.error("Erro na busca:", err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca) buscarAlunos(busca);
      else {
        setAlunos([]);
        setFezBusca(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);

  const exportarCSV = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/admin/relatorio/${filtroTurma}`);
      const data = await res.json();
      if (!res.ok || !data || data.length === 0) {
        alert("Não existem dados disponíveis para exportar.");
        return;
      }
      const cabecalho = "Nome,Email,CPF,Presencas\n";
      const csvContent = data.map(aluno => 
        `"${aluno.nome}","${aluno.email}","${aluno.cpf || 'N/A'}",${aluno.presencas?.length || 0}`
      ).join("\n");
      const blob = new Blob(["\ufeff" + cabecalho + csvContent], { type: 'text/csv;charset=utf-8;' });
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
    <div className="app-wrapper" style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
      
      {/* HEADER DO PAINEL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard Administrativo</h2>
          <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem' }}>Geração Tech 3.0 • Gestão de Frequência</p>
        </div>
        <select 
          className="input-modern" 
          style={{ width: '250px' }} 
          value={filtroTurma} 
          onChange={(e) => setFiltroTurma(e.target.value)}
        >
          {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
        </select>
      </div>

      {/* SEÇÃO DE ESTATÍSTICAS (MÉTRICAS) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '15px', 
        marginBottom: '25px' 
      }}>
        <div className="stat-card" style={{ padding: '20px', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Sessões Ativas</span>
          <h2 style={{ color: 'var(--accent-primary)', margin: '5px 0' }}>{stats.sessoesAtivas || 0}</h2>
        </div>
        <div className="stat-card" style={{ padding: '20px', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Presenças Totais</span>
          <h2 style={{ margin: '5px 0' }}>{stats.totalPresencas || 0}</h2>
        </div>
        <div className="stat-card" style={{ padding: '20px', textAlign: 'center', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Faltas registradas</span>
          <h2 style={{ color: '#ef4444', margin: '5px 0' }}>{stats.faltasHoje || 0}</h2>
        </div>
      </div>

      <div className="grid-main" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        
        {/* COLUNA ESQUERDA: BUSCA E GESTÃO */}
        <div className="shadow-card" style={{ padding: '20px' }}>
          <h4>Gestão de Alunos</h4>
          <input 
            type="text" 
            className="input-modern" 
            placeholder="Buscar por Nome ou CPF..." 
            value={busca} 
            onChange={(e) => setBusca(e.target.value)} 
            style={{ marginTop: '10px' }}
          />

          <div className="historico-container" style={{ marginTop: '20px', minHeight: '150px' }}>
            {alunos.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 0' }}>ALUNO</th>
                    <th>CPF</th>
                    <th style={{ textAlign: 'right' }}>AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {alunos.map(aluno => (
                    <tr key={aluno.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 0', fontSize: '0.9rem' }}>{aluno.nome}</td>
                      <td style={{ fontSize: '0.8rem' }}>{aluno.cpf || '---'}</td>
                      <td style={{ textAlign: 'right' }}>
                         <button style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>Ver Detalhes</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: '40px' }}>
                {carregando ? "Buscando dados..." : fezBusca ? "Nenhum resultado." : "Use o campo acima para pesquisar alunos."}
              </p>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: RELATÓRIOS E EXPORTAÇÃO */}
        <div className="shadow-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h4>Relatórios Exportáveis</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '10px' }}>
              Gere uma planilha completa com a frequência de todos os alunos da turma selecionada.
            </p>
            <div className="info-banner" style={{ marginTop: '15px', fontSize: '0.85rem' }}>
              Turma: <strong>{FORMACOES.find(f => f.id === filtroTurma)?.nome}</strong>
            </div>
          </div>
          
          <button 
            className="btn-ponto in" 
            style={{ width: '100%', marginTop: '20px' }} 
            onClick={exportarCSV}
            disabled={carregando}
          >
            {carregando ? "Gerando..." : "Baixar Planilha CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}