import React, { useState } from "react";
import { API_URL } from "./Constants";

export default function Perfil({ user, setUser, onVoltar }) {
  const [nome, setNome] = useState(user.nome || "");
  const [cpf, setCpf] = useState(user.cpf || "");
  const [avatar, setAvatar] = useState(user.avatar || "bottts");
  const [loading, setLoading] = useState(false);

  const modelosAvatar = [
    { id: "bottts", nome: "Robô", url: `https://api.dicebear.com/7.x/bottts/svg?seed=${nome}` },
    { id: "avataaars", nome: "Developer", url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nome}` },
    { id: "pixel-art", nome: "8-Bit", url: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${nome}` },
    { id: "identicon", nome: "Código", url: `https://api.dicebear.com/7.x/identicon/svg?seed=${nome}` }
  ];

  const salvarPerfil = async () => {
    // Validação básica de CPF antes de tentar salvar
    if (cpf && cpf.length < 11) {
      alert("Por favor, insira um CPF válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/aluno/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: user.id, 
          nome: nome.trim(), 
          cpf: cpf.trim(),
          avatar 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // 1. Criamos o objeto atualizado
        const usuarioAtualizado = { ...user, nome: nome.trim(), cpf: cpf.trim(), avatar };
        
        // 2. Atualizamos o estado global do App.jsx para refletir a mudança no Header e Boas-vindas
        setUser(usuarioAtualizado);
        
        // 3. ATUALIZAÇÃO CRÍTICA: Atualizar a sessão para que o F5 não resete os dados
        const sessionStr = localStorage.getItem("gt3_session");
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          session.userData = usuarioAtualizado;
          localStorage.setItem("gt3_session", JSON.stringify(session));
        }

        // 4. Opcional: Atualizar também o "gt3_remember" caso você queira que o nome mude no Login
        const rememberStr = localStorage.getItem("gt3_remember");
        if (rememberStr) {
          const remember = JSON.parse(rememberStr);
          localStorage.setItem("gt3_remember", JSON.stringify({ 
            ...remember, 
            email: usuarioAtualizado.email 
          }));
        }

        alert("Perfil atualizado com sucesso!");
        onVoltar(); // Retorna para a home após salvar
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
      <div className="shadow-card" style={{ maxWidth: '650px', margin: '0 auto' }}>
        <div className="card-header-info" style={{ textAlign: 'center' }}>
          <h2>Meu Perfil Tech</h2>
          
          <div style={{ margin: '20px auto', width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-deep)', border: '2px solid var(--teal-primary)', overflow: 'hidden' }}>
            <img 
              src={`https://api.dicebear.com/7.x/${avatar}/svg?seed=${nome}`} 
              alt="Avatar" 
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '25px' }}>
          <label className="stat-label" style={{ textAlign: 'center' }}>Escolha seu Personagem</label>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '10px' }}>
            {modelosAvatar.map((m) => (
              <div 
                key={m.id}
                onClick={() => setAvatar(m.id)}
                style={{
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '12px',
                  border: avatar === m.id ? '2px solid var(--teal-primary)' : '2px solid transparent',
                  background: 'rgba(255,255,255,0.05)',
                  transition: 'all 0.2s'
                }}
              >
                <img src={m.url} alt={m.nome} style={{ width: '45px', height: '45px' }} />
              </div>
            ))}
          </div>
        </div>

        <div className="login-form">
          <label className="stat-label">Nome Completo</label>
          <input 
            type="text" 
            className="input-modern" 
            value={nome} 
            onChange={(e) => setNome(e.target.value)} 
          />

          <label className="stat-label">CPF</label>
          <input 
            type="text" 
            className="input-modern" 
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />

          <label className="stat-label">E-mail (Apenas Visualização)</label>
          <input type="text" className="input-modern" value={user.email} disabled style={{ opacity: 0.5 }} />

          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button 
              className="btn-ponto in" 
              onClick={salvarPerfil} 
              disabled={loading}
              style={{ flex: 2 }}
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
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