import React, { useState } from "react";
import { API_URL } from "./Constants";

export default function Perfil({ user, setUser, onVoltar }) {
  const [nome, setNome] = useState(user.nome || "");
  const [cpf, setCpf] = useState(user.cpf || "");
  // Alterado para 'lorelei' como padrão inicial, que é mais moderno
  const [avatar, setAvatar] = useState(user.avatar || "lorelei");
  const [loading, setLoading] = useState(false);

  // Novos modelos de avatar mais profissionais e diversos
  // Usamos user.email no seed para a imagem ser estável e única por aluno
  const modelosAvatar = [
    { id: "lorelei", nome: "Casual", url: `https://api.dicebear.com/7.x/lorelei/svg?seed=${user.email}` },
    { id: "persona", nome: "Persona", url: `https://api.dicebear.com/7.x/personas/svg?seed=${user.email}` },
    { id: "open-peeps", nome: "Sketch", url: `https://api.dicebear.com/7.x/open-peeps/svg?seed=${user.email}` },
    { id: "big-smile", nome: "Expressivo", url: `https://api.dicebear.com/7.x/big-smile/svg?seed=${user.email}` },
    { id: "bottts-neutral", nome: "Tech", url: `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${user.email}` }
  ];

  const salvarPerfil = async () => {
    // Validação básica de CPF
    if (cpf && cpf.replace(/\D/g, "").length < 11) {
      alert("Por favor, insira um CPF válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/aluno/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: user.email, 
          nome: nome.trim(), 
          cpf: cpf.trim(),
          avatar 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const usuarioAtualizado = { ...user, nome: nome.trim(), cpf: cpf.trim(), avatar };
        
        setUser(usuarioAtualizado);
        
        const sessionStr = localStorage.getItem("gt3_session");
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          session.userData = usuarioAtualizado;
          session.timestamp = Date.now();
          localStorage.setItem("gt3_session", JSON.stringify(session));
        }

        const rememberStr = localStorage.getItem("gt3_remember");
        if (rememberStr) {
          const remember = JSON.parse(rememberStr);
          localStorage.setItem("gt3_remember", JSON.stringify({ 
            ...remember, 
            nome: usuarioAtualizado.nome 
          }));
        }

        alert("Perfil atualizado com sucesso!");
        onVoltar();
      } else {
        alert(data.error || "Erro ao salvar informações.");
      }
    } catch (err) {
      console.error("Erro ao salvar perfil:", err);
      alert("Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="shadow-card" style={{ maxWidth: '650px', margin: '20px auto' }}>
        <div className="card-header-info" style={{ textAlign: 'center' }}>
          <h2 className="text-teal-modern">Meu Perfil Tech</h2>
          
          <div style={{ 
            margin: '20px auto', 
            width: '110px', 
            height: '110px', 
            borderRadius: '50%', 
            background: 'var(--bg-deep)', 
            border: '3px solid var(--teal-primary)', 
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src={`https://api.dicebear.com/7.x/${avatar}/svg?seed=${user.email}`} 
              alt="Avatar Selecionado" 
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label className="stat-label" style={{ textAlign: 'center', display: 'block' }}>Escolha seu Estilo</label>
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            justifyContent: 'center', 
            marginTop: '12px',
            flexWrap: 'wrap' 
          }}>
            {modelosAvatar.map((m) => (
              <div 
                key={m.id}
                onClick={() => setAvatar(m.id)}
                style={{
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '50%',
                  border: avatar === m.id ? '3px solid var(--teal-primary)' : '2px solid transparent',
                  background: avatar === m.id ? 'rgba(0, 128, 128, 0.1)' : 'rgba(255,255,255,0.05)',
                  transition: 'all 0.2s ease-in-out',
                  transform: avatar === m.id ? 'scale(1.1)' : 'scale(1)'
                }}
              >
                <img src={m.url} alt={m.nome} style={{ width: '48px', height: '48px', borderRadius: '50%' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="login-form">
          <div style={{ marginBottom: '15px' }}>
            <label className="stat-label">Nome Completo</label>
            <input 
              type="text" 
              className="input-modern" 
              placeholder="Seu nome"
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label className="stat-label">CPF</label>
            <input 
              type="text" 
              className="input-modern" 
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '25px' }}>
            <label className="stat-label">E-mail (Chave de Acesso)</label>
            <input 
                type="text" 
                className="input-modern" 
                value={user.email} 
                disabled 
                style={{ opacity: 0.6, cursor: 'not-allowed', backgroundColor: 'rgba(71, 50, 61, 0.53)' }} 
            />
            <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>O e-mail não pode ser alterado.</small>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="btn-ponto in" 
              onClick={salvarPerfil} 
              disabled={loading || !nome} 
              style={{ flex: 2 }}
            >
              {loading ? "Processando..." : "Salvar Alterações"}
            </button>
            <button className="btn-secondary" onClick={onVoltar} style={{ flex: 1 }}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}