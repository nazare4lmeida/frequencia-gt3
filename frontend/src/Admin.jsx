import React, { useState, useEffect } from "react";
import { FORMACOES, API_URL } from "./Constants";

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("fullstack");
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [fezBusca, setFezBusca] = useState(false); // Novo estado para saber se a busca foi tentada

  // Função para buscar alunos por termo (Nome/CPF)
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
      if (busca) {
        buscarAlunos(busca);
      } else {
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

      // Verificação se há dados antes de tentar exportar
      if (!res.ok || !data || data.length === 0) {
        alert("Não existem dados disponíveis para exportar nesta turma no momento.");
        setCarregando(false);
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
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Erro ao conectar com o servidor para exportar.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="shadow-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Painel de Controle Admin</h3>
          <select 
            className="input-modern" 
            style={{ width: '200px' }} 
            value={filtroTurma} 
            onChange={(e) => setFiltroTurma(e.target.value)}
          >
            {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
        
        <input 
          type="text" 
          className="input-modern" 
          placeholder="Buscar aluno por Nome ou CPF (mínimo 3 letras)..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          style={{ marginTop: '15px' }}
        />

        {/* Lógica de exibição de resultados ou vazio */}
        <div className="historico-container" style={{ marginTop: '10px', padding: '10px', minHeight: '50px' }}>
          {alunos.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {alunos.map(aluno => (
                <li key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{aluno.nome}</span>
                  <small style={{ color: 'var(--teal-primary)' }}>{aluno.cpf || 'Sem CPF registrado'}</small>
                </li>
              ))}
            </ul>
          ) : fezBusca && !carregando ? (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              Nenhum aluno encontrado com este termo.
            </p>
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.9rem' }}>
              {carregando ? "Buscando..." : "Digite para buscar um aluno específico."}
            </p>
          )}
        </div>

        {/* Banner Dinâmico */}
        <div className="info-banner" style={{ marginTop: '15px' }}>
          {carregando ? (
            "Processando solicitação..."
          ) : (
            <>Pronto para exportar: <strong>{FORMACOES.find(f => f.id === filtroTurma)?.nome}</strong></>
          )}
        </div>
        
        <button 
          className="btn-ponto in" 
          style={{ maxWidth: '100%', marginTop: '15px' }} 
          onClick={exportarCSV}
          disabled={carregando}
        >
          {carregando ? "Aguarde..." : "Gerar e Baixar Relatório CSV"}
        </button>
      </div>
    </div>
  );
}