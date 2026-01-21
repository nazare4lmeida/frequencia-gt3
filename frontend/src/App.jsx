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
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [form, setForm] = useState({ cpf: '', dataNasc: '', formacao: 'fullstack' });
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCurso, setSelectedCurso] = useState(null);
  const [feedback, setFeedback] = useState({ nota: 0, revisao: '' });
  const [view, setView] = useState('aulas'); 
  const [historico, setHistorico] = useState([]);

  const segundas = useMemo(() => {
    const dates = [];
    let d = new Date('2026-01-26T12:00:00');
    for (let i = 0; i < 10; i++) {
      dates.push(new Date(d).toLocaleDateString('pt-BR'));
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }, []);

  const [dataSel, setDataSel] = useState(segundas[0]);

  useEffect(() => {
    isDarkMode ? document.body.classList.add('dark') : document.body.classList.remove('dark');
  }, [isDarkMode]);

  const validarHorario = (tipo) => {
    const agora = new Date();
    const hora = agora.getHours();
    const minuto = agora.getMinutes();

    if (tipo === 'in') {
      // Check-in: 18:00 às 20:00
      return hora >= 18 && hora < 20;
    } else {
      // Check-out: 22:00 às 22:30
      if (hora === 22) {
        return minuto >= 0 && minuto <= 30;
      }
      return false;
    }
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
        setSelectedCurso(form.formacao); // Define a turma escolhida no login
      } else {
        alert(data.error);
      }
    } catch { 
      alert("Erro de conexão com o servidor."); 
    }
  };

  const carregarHistorico = async () => {
    try {
      const res = await fetch(`${API_URL}/historico/${user.cpf}`);
      const data = await res.json();
      if (res.ok) {
        setHistorico(data);
        setView('historico');
      }
    } catch { 
      alert("Erro ao carregar histórico."); 
    }
  };

  const registrarPresenca = async (tipo, dadosExtra = {}) => {
    if (!validarHorario(tipo)) {
      const msg = tipo === 'in' 
        ? "O Check-in só é permitido entre 18:00 e 20:00." 
        : "O Check-out só é permitido entre 22:00 e 22:30.";
      return alert(msg);
    }

    if (!selectedCurso || !user) return;
    const agoraStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    try {
      const res = await fetch(`${API_URL}/presenca`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf: user.cpf,
          formacao: selectedCurso,
          tipo,
          data: dataSel,
          nota: dadosExtra.nota,
          revisao: dadosExtra.revisao
        })
      });

      if (res.ok) {
        alert(`✅ ${tipo === 'in' ? 'Check-in' : 'Check-out'} realizado com sucesso às ${agoraStr}!`);
        if (tipo === 'out') { setModalOpen(false); setFeedback({ nota: 0, revisao: '' }); }
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
        <button className="btn-secondary theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? '☀️' : '🌙'}</button>
        <div className="login-card">
          <div className="brand"><h1>GERAÇÃO <span>TECH 3.0</span></h1></div>
          <div id="loginForm">
            <input placeholder="CPF" value={form.cpf} onChange={e => setForm({...form, cpf: e.target.value})} />
            <input type="date" value={form.dataNasc} onChange={e => setForm({...form, dataNasc: e.target.value})} />
            <div className="select-box" style={{marginTop: '10px'}}>
              <label style={{color: 'white', fontSize: '0.8rem'}}>Sua Formação:</label>
              <select value={form.formacao} onChange={e => setForm({...form, formacao: e.target.value})}>
                {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={handleLogin}>Entrar no Portal</button>
          </div>
        </div>
      </div>
    );
  }

  // Filtra para mostrar apenas o curso selecionado
  const cursoAtual = FORMACOES.find(c => c.id === selectedCurso);

  return (
    <div className="app-wrapper">
      <header>
        <div className="brand"><h1>GT <span>3.0</span></h1><div className="badge">Aluno</div></div>
        <div className="nav-actions">
          <button className="btn-secondary" onClick={() => view === 'aulas' ? carregarHistorico() : setView('aulas')}>
            {view === 'aulas' ? 'Ver Meu Histórico' : 'Voltar para Aulas'}
          </button>
          <div className="tool-group">
            <button className="btn-secondary" onClick={() => setIsDarkMode(!isDarkMode)}>{isDarkMode ? '☀️' : '🌙'}</button>
            <button className="btn-secondary" onClick={() => setUser(null)}>Logout</button>
          </div>
        </div>
      </header>

      <main className="content-grid">
        {view === 'aulas' ? (
          <>
            <div className="select-box">
              <label>Data da aula:</label>
              <select value={dataSel} onChange={e => setDataSel(e.target.value)}>
                {segundas.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              
              <label style={{marginLeft: '15px'}}>Trocar Turma:</label>
              <select value={selectedCurso} onChange={e => setSelectedCurso(e.target.value)}>
                {FORMACOES.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>

            {cursoAtual && (
              <div className="aula">
                <div className="aula-header">
                  <small>{cursoAtual.tag}</small>
                  <h3>{cursoAtual.nome}</h3>
                  <span className="data-tag">Aula de {dataSel}</span>
                </div>
                <p style={{fontSize: '0.8rem', opacity: 0.7, marginBottom: '15px'}}>
                  Check-in: 18h-20h | Check-out: 22h-22h30
                </p>
                <div className="aula-actions">
                  <button className="btn-primary" onClick={() => registrarPresenca('in')}>CHECK-IN</button>
                  <button className="btn-primary btn-checkout" onClick={() => setModalOpen(true)}>CHECK-OUT</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="historico-container">
            <div className="perfil-info">
              <h2>Minha Frequência</h2>
              <p><strong>Nome:</strong> {user.nome}</p>
              <p><strong>CPF:</strong> {user.cpf}</p>
              <p><strong>Nascimento:</strong> {new Date(user.data_nascimento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
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
          </div>
        )}
      </main>

      {modalOpen && (
        <div className="modal-overlay">
          <div className="aula modal-content">
            <button className="close-modal" onClick={() => setModalOpen(false)}>&times;</button>
            <h3>Finalizar Aula</h3>
            <p>Como foi sua compreensão do conteúdo hoje?</p>
            <div className="rating-group">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setFeedback({...feedback, nota: n})} className="btn-secondary" style={{flex:1, backgroundColor: feedback.nota === n ? 'var(--accent-glow)' : ''}}>{n}</button>
              ))}
            </div>
            <textarea className="input-notes" placeholder="O que revisar?" value={feedback.revisao} onChange={e => setFeedback({...feedback, revisao: e.target.value})} />
            <button className="btn-save" onClick={() => registrarPresenca('out', feedback)}>SALVAR E SAIR</button>
          </div>
        </div>
      )}
    </div>
  );
}