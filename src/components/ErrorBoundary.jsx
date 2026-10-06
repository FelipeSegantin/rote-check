import { Component } from "react";

// Sem isto, qualquer erro de render que a gente não previu (algo que veio
// de um jeito inesperado do banco, por exemplo) derruba a árvore inteira
// do React e a pessoa fica numa tela preta, sem nenhuma pista do que
// aconteceu nem um jeito de tentar de novo sem fechar o app. Isso já
// aconteceu pelo menos uma vez com uma conta recém-criada — daqui pra
// frente, em vez de tela preta, mostra o erro e um botão de recarregar.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro não tratado:", erro, info);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="auth-page">
          <div className="auth-card" style={{ maxWidth: 420, textAlign: "center" }}>
            <h1>Algo deu errado</h1>
            <p style={{ color: "var(--text-dim)" }}>
              O app encontrou um erro inesperado. Recarregar a página geralmente resolve.
            </p>
            <p
              style={{
                color: "var(--danger)",
                fontSize: 12,
                marginTop: 12,
                overflowWrap: "anywhere",
                textAlign: "left",
                background: "rgba(0,0,0,0.15)",
                padding: 10,
                borderRadius: 8,
              }}
            >
              {String(this.state.erro?.message || this.state.erro)}
            </p>
            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 16 }}
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
