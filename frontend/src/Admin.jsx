import React, { useState, useEffect } from "react";
import { FORMACOES, API_URL } from "./Constants";

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("fullstack");
  // Acrescentando estados para os dados reais
  const [alunos, setAlunos] = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Função para buscar alunos por termo (Nome/CPF)
  const buscarAlunos = async (termo) => {
    if (termo.length < 3) {
      setAlunos([]);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/busca?termo=${termo}`);
      if (res.ok) {
        const data = await res.json();
        setAlunos(data);
      }
    } catch (err) {
      console.error("Erro na busca:", err);
    }
  };

  // Efeito para busca automática enquanto digita
  useEffect(() => {
    const timer = setTimeout(() => {
      if (busca) buscarAlunos(busca);
    }, 500);
    return () => clearTimeout(timer);
  }, [busca]);

  // Função para exportar a turma selecionada para CSV
  const exportarCSV = async () => {
    setCarregando(true);
    try {
      const res = await fetch(`${API_URL}/admin/relatorio/${filtroTurma}`);
      if (res.ok) {
        const data = await res.json();
        
        // Lógica para converter JSON em CSV
        const cabecalho = "Nome,Email,CPF,Presencas\n";
        const csvContent = data.map(aluno => 
          `${aluno.nome},${aluno.email},${aluno.cpf || 'N/A'},${aluno.presencas?.length || 0}`
        ).join("\n");

        const blob = new Blob([cabecalho + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.setAttribute("download", `relatorio_${filtroTurma}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch {
      alert("Erro ao exportar relatório.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="shadow-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Relatório por Turma</h3>
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
          placeholder="Buscar aluno por Nome ou CPF..." 
          value={busca} 
          onChange={(e) => setBusca(e.target.value)} 
          style={{ marginTop: '15px' }}
        />

        {/* Acrescentando lista de resultados da busca rápida */}
        {alunos.length > 0 && (
          <div className="historico-container" style={{ marginTop: '10px', padding: '10px' }}>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {alunos.map(aluno => (
                <li key={aluno.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <span>{aluno.nome}</span>
                  <small style={{ color: 'var(--teal-primary)' }}>{aluno.cpf || 'Sem CPF'}</small>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="info-banner" style={{ marginTop: '15px' }}>
          Gerando relatório para: <strong>{FORMACOES.find(f => f.id === filtroTurma)?.nome}</strong>
        </div>
        
        <button 
          className="btn-ponto in" 
          style={{ maxWidth: '200px' }} 
          onClick={exportarCSV}
          disabled={carregando}
        >
          {carregando ? "Processando..." : "Exportar CSV"}
        </button>
      </div>
    </div>
  );
}