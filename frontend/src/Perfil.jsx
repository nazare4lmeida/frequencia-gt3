import React, { useState } from "react";
import { API_URL } from "./Constants";

export default function Perfil({ user, setUser, onVoltar }) {
  // Estados para edição total
  const [nome, setNome] = useState(user.nome || "");
  const [cpf, setCpf] = useState(user.cpf || "");
  const [avatar, setAvatar] = useState(user.avatar || "bottts"); // Estilo padrão
  const [loading, setLoading] = useState(false);

  // Modelos prontos de tecnologia (Estilos do DiceBear)
  const modelosAvatar = [
    { id: "bottts", nome: "Robô", url: `https://api.dicebear.com/7.x/bottts/svg?seed=${user.nome}` },
    { id: "avataaars", nome: "Developer", url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.nome}` },
    { id: "pixel-art", nome: "8-Bit", url: `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.nome}` },
    { id: "identicon", nome: "Código", url: `https://api.dicebear.com/7.x/identicon/svg?seed=${user.nome}` }
  ];

  const salvarPerfil = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/aluno/perfil`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: user.id, 
          nome, 
          cpf,
          avatar 
        }),
      });

      if (res.ok) {
        // Atualiza o estado global e o localStorage para persistir
        const usuarioAtualizado = { ...user, nome, cpf, avatar };
        setUser(usuarioAtualizado);
        
        const session = JSON.parse(localStorage.getItem("gt3_session"));
        session.userData = usuarioAtualizado;
        localStorage.setItem("gt3_session", JSON.stringify(session));

        alert("Perfil atualizado com sucesso!");
      }
    } catch {
      alert("Erro ao salvar informações.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <div className="shadow-card" style={{ maxWidth: '650px', margin: '0 auto' }}>
        <div className="card-header-info" style={{ textAlign: 'center' }}>
          <h2>Meu Perfil Tech</h2>
          
          {/* Visualização do Avatar Selecionado */}
          <div style={{ margin: '20px auto', width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-deep)', border: '2px solid var(--teal-primary)', overflow: 'hidden' }}>
            <img 
              src={`https://api.dicebear.com/7.x/${avatar}/svg?seed=${nome}`} 
              alt="Avatar" 
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>

        {/* Seletor de Personagens */}
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