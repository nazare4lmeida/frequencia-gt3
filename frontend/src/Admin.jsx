import React, { useState } from "react";
import { FORMACOES } from "./Constants";

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [filtroTurma, setFiltroTurma] = useState("fullstack");

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

        <div className="info-banner" style={{ marginTop: '15px' }}>
          Gerando relatório para: <strong>{FORMACOES.find(f => f.id === filtroTurma)?.nome}</strong>
        </div>
        
        <button className="btn-ponto in" style={{ maxWidth: '200px' }}>Exportar CSV</button>
      </div>
    </div>
  );
}