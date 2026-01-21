import React, { useState, useEffect, useMemo } from 'react';
import './App.css';

const API_URL = window.location.hostname === "localhost" 
  ? "http://localhost:3001" 
  : "/api";

const FORMACOES = [
  { id: 'fullstack', nome: 'Fullstack Developer', tag: 'WEB' },
  { id: 'ia-gen', nome: 'IA Generativa', tag: 'AI' },
  { id: 'ia-soft', nome: 'IA + Soft Skills', tag: 'SOFT' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [isDarkMode] = useState(true);
  const [form, setForm] = useState({ cpf: '', dataNasc: '', formacao: 'fullstack' });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [feedback, setFeedback] = useState({ nota: 0, revisao: '' });
  const [view, setView] = useState('aulas'); 
  const [historico, setHistorico] = useState([]);
  const [relatorioGeral, setRelatorioGeral] = useState([]);
  const [filtroTurma, setFiltroTurma] = useState('todos');
  const [buscaCpf, setBuscaCpf] = useState('');

  const segundas = useMemo(() => {
    const dates = [];
    let d = new Date('2026-01-26T12:00:00');
    for (let i = 0; i < 10; i++) {
      dates.push(new Date(d).toLocaleDateString('pt-BR'));
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }, []);

  const [dataSel] = useState(segundas[0]);

  useEffect(() => {
    isDarkMode ? document.body.classList.add('dark') : document.body.classList.remove('dark');
  }, [isDarkMode]);

  const validarHorario = (tipo) => {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();
    if (tipo === 'in') return hora >= 18 && hora < 20;
    if (hora === 22) return minuto >= 0 && minuto <= 30;
    return false;
  };

  const handleLogin = async () => {
    if (!form.cpf || !form.dataNasc) return alert("Preencha todos os campos!");
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: form.cpf.replace(/\D/g, ''), dataNascimento: form.dataNasc })
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data);
        setSelectedCurso(form.formacao);
      } else {
        alert(data.error);
      }
    } catch { alert("Erro de conexão com o servidor."); }
  };

  const carregarHistorico = async (cpfBusca) => {
    const targetCpf = cpfBusca || user.cpf;
    try {
      const res = await fetch(`${API_URL}/historico/${targetCpf}`);
      const data = await res.json();
      if (res.ok) {
        setHistorico(data);
        setView('historico');
      }
    } catch { alert("Erro ao carregar histórico."); }
  };

  const carregarRelatorioAdmin = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/relatorio-geral`);
      const data = await res.json();
      if (res.ok) {
        setRelatorioGeral(data);
        setView('admin-geral');
      }
    } catch { alert("Erro ao carregar relatório administrativo."); }
  };

  const registrarPresenca = async (tipo, dadosExtra = {}) => {
    if (!validarHorario(tipo)) {
      return alert(tipo === 'in' ? "Check-in: 18h às 20h." : "Check-out: 22h às 22h30.");
    }
    try {
      const res = await fetch(`${API_URL}/presenca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: user.cpf, formacao: selectedCurso, tipo, data: dataSel,
          nota: dadosExtra.nota, revisao: dadosExtra.revisao
        })
      });
      if (res.ok) alert("Registro salvo com sucesso!");
      else alert("Erro ao salvar.");
    } catch { alert("Erro de conexão."); }
  };

  if (!user) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1>GERAÇÃO <span>TECH 3.0</span></h1>
          <input placeholder="CPF" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} />
          <input type="date" value={form.dataNasc} onChange={e => setForm({...form, dataNasc: e.target.value})} />
          <select value={form.formacao} onChange={e => setForm({...form, formacao: e.target.value})}>
            {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <button className="btn-primary" onClick={handleLogin}>Entrar no Portal</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      <header>
        <div className="brand"><h1>GT <span>3.0</span></h1><div className="badge">{user.role.toUpperCase()}</div></div>
        <div className="nav-actions">
          {user.role === 'admin' ? (
            <>
              <button className="btn-secondary" onClick={carregarRelatorioAdmin}>Relatório Geral</button>
              <button className="btn-secondary" onClick={() => setView('admin-busca')}>Busca por CPF</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setView('aulas')}>Marcar Presença</button>
              <button className="btn-secondary" onClick={() => carregarHistorico()}>Meu Histórico</button>
            </>
          )}
          <button className="btn-secondary" onClick={() => setUser(null)}>Sair</button>
        </div>
      </header>

      <main className="content-grid">
        {user.role === 'admin' && view === 'admin-geral' && (
          <div className="historico-container">
            <h2>Relatório de Presenças por Turma</h2>
            <select onChange={(e) => setFiltroTurma(e.target.value)} style={{marginBottom: '20px'}}>
              <option value="todos">Todas as Turmas</option>
              {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <table className="historico-table">
              <thead>
                <tr><th>CPF</th><th>Turma</th><th>Data Aula</th><th>Entrada</th><th>Saída</th><th>Nota</th></tr>
              </thead>
              <tbody>
                {relatorioGeral.filter(r => filtroTurma === 'todos' || r.formacao === filtroTurma).map((item, i) => (
                  <tr key={i}>
                    <td>{item.cpf}</td>
                    <td>{item.formacao.toUpperCase()}</td>
                    <td>{new Date(item.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td>{item.check_in ? new Date(item.check_in).toLocaleTimeString('pt-BR') : '-'}</td>
                    <td>{item.check_out ? new Date(item.check_out).toLocaleTimeString('pt-BR') : '-'}</td>
                    <td>{item.compreensao || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {user.role === 'admin' && view === 'admin-busca' && (
          <div className="historico-container">
            <h2>Consultar Aluno Individual</h2>
            <div className="select-box">
              <input placeholder="Digite o CPF" value={buscaCpf} onChange={e => setBuscaCpf(e.target.value)} />
              <button className="btn-primary" onClick={() => carregarHistorico(buscaCpf)}>Buscar</button>
            </div>
          </div>
        )}

        {(view === 'historico') && (
          <div className="historico-container">
            <h2>Histórico de {user.role === 'admin' ? `CPF: ${buscaCpf}` : user.nome}</h2>
            <table className="historico-table">
              <thead>
                <tr><th>Data Aula</th><th>Turma</th><th>Entrada</th><th>Saída</th><th>Nota</th><th>Feedback</th></tr>
              </thead>
              <tbody>
                {historico.map((item, i) => (
                  <tr key={i}>
                    <td>{new Date(item.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                    <td>{item.formacao.toUpperCase()}</td>
                    <td>{item.check_in ? new Date(item.check_in).toLocaleTimeString('pt-BR') : '-'}</td>
                    <td>{item.check_out ? new Date(item.check_out).toLocaleTimeString('pt-BR') : '-'}</td>
                    <td>{item.compreensao || '-'}</td>
                    <td><small>{item.feedback || '-'}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {user.role === 'admin' && <button className="btn-secondary" onClick={() => setView('admin-geral')}>Voltar</button>}
          </div>
        )}

        {user.role === 'aluno' && view === 'aulas' && (
          <div className="aula">
            <h3>{FORMACOES.find(c => c.id === selectedCurso)?.nome}</h3>
            <p>Data selecionada: {dataSel}</p>
            <div className="aula-actions">
              <button className="btn-primary" onClick={() => registrarPresenca('in')}>CHECK-IN</button>
              <button className="btn-primary btn-checkout" onClick={() => setModalOpen(true)}>CHECK-OUT</button>
            </div>
          </div>
        )}
      </main>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="aula modal-content">
            <h3>Finalizar Aula</h3>
            <div className="rating-group">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFeedback({...feedback, nota: n})} className="btn-secondary" style={{backgroundColor: feedback.nota === n ? 'var(--accent-glow)' : ''}}>{n}</button>
              ))}
            </div>
            <textarea placeholder="O que revisar?" value={feedback.revisao} onChange={e => setFeedback({...feedback, revisao: e.target.value})} />
            <button className="btn-save" onClick={() => { registrarPresenca('out', feedback); setModalOpen(false); }}>SALVAR</button>
            <button className="btn-secondary" onClick={() => setModalOpen(false)}>CANCELAR</button>
          </div>
        </div>
      )}
    </div>
  );
}