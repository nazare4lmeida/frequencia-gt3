import React, { useState } from "react";

export default function Perfil({ user, setUser }) {
  const [cpf, setCpf] = useState(user.cpf || "");
  const [loading, setLoading] = useState(false);

  const salvarPerfil = async () => {
    if (cpf.length < 11) {
      alert("Por favor, insira um CPF válido.");
      return;
    }
    setLoading(true);
    // Aqui virá sua chamada de API para atualizar o CPF no banco
    setTimeout(() => {
      setUser({ ...user, cpf });
      setLoading(false);
      alert("Perfil atualizado com sucesso!");
    }, 1000);
  };

  return (
    <div className="app-wrapper">
      <div className="login-card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div className="card-header-info">
          <h2>Meu Perfil</h2>
          <p className="text-muted">Mantenha seus dados atualizados para emissão de certificados.</p>
        </div>

        <div className="login-form" style={{ textAlign: 'left', marginTop: '20px' }}>
          <label className="stat-label">Nome Completo</label>
          <input type="text" className="input-modern" value={user.nome} disabled />

          <label className="stat-label">E-mail</label>
          <input type="text" className="input-modern" value={user.email} disabled />

          <label className="stat-label">CPF (Obrigatório)</label>
          <input 
            type="text" 
            className="input-modern" 
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
          />

          <label className="stat-label">Formação Selecionada</label>
          <input type="text" className="input-modern" value={user.formacao_nome} disabled />

          <button 
            className="btn-ponto in" 
            onClick={salvarPerfil}
            disabled={loading}
          >
            {loading ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
        
        <p className="usability-info" style={{ textAlign: 'center' }}>
          O CPF é um dado sensível e será utilizado apenas para fins de registro acadêmico e emissão de certificados no Geração Tech 3.0.
        </p>
      </div>
    </div>
  );
}