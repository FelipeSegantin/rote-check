import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import { aplicarTema } from "./lib/tema.js";
import { instalarArrastoTabs } from "./lib/arrastoTabs.js";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import BottomNav from "./components/BottomNav.jsx";
import BotaoConfiguracoes from "./components/BotaoConfiguracoes.jsx";
import BotaoComoUsar from "./components/BotaoComoUsar.jsx";
import AvisosApp from "./components/AvisosApp.jsx";

import Login from "./pages/Login.jsx";
import Cadastro from "./pages/Cadastro.jsx";
import CadastroPendente from "./pages/CadastroPendente.jsx";
import RecuperarSenha from "./pages/RecuperarSenha.jsx";
import RecuperarUsuario from "./pages/RecuperarUsuario.jsx";
import Configuracoes from "./pages/Configuracoes.jsx";
import Chat from "./pages/Chat.jsx";
import Baixar from "./pages/Baixar.jsx";

import ClienteHome from "./pages/cliente/ClienteHome.jsx";
import NovaColeta from "./pages/cliente/NovaColeta.jsx";

import DespachanteHome from "./pages/despachante/DespachanteHome.jsx";
import GerenteHome from "./pages/gerente/GerenteHome.jsx";
import ColetorHome from "./pages/coletor/ColetorHome.jsx";

const HOME_POR_PAPEL = {
  cliente: ClienteHome,
  despachante: DespachanteHome,
  gerente: GerenteHome,
  coletor: ColetorHome,
};

function Home() {
  const { papel, erroPerfil, recarregarPerfil, logout } = useAuth();
  const Componente = HOME_POR_PAPEL[papel];
  if (Componente) return <Componente />;

  // Sessão existe mas o perfil não carregou (mesmo depois da tentativa
  // extra em carregarPerfil, ver auth.jsx) — antes disso a pessoa via só
  // uma tela preta, sem nenhuma pista do que fazer. Foi o que aconteceu
  // com a conta do primeiro gerente logo depois de criada.
  if (erroPerfil) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ maxWidth: 420, textAlign: "center" }}>
          <h1>Não foi possível carregar sua conta</h1>
          <p style={{ color: "var(--text-dim)" }}>
            Pode ter sido um problema passageiro de conexão com o banco. Tente de novo — se
            continuar acontecendo, saia e entre de novo.
          </p>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={recarregarPerfil}>
            Tentar novamente
          </button>
          <button className="btn btn-secondary" style={{ width: "100%", marginTop: 8 }} onClick={logout}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return null; // ainda carregando o perfil pela primeira vez
}

export default function App() {
  const { papel, perfil } = useAuth();
  const temaPreferido = perfil?.tema; // undefined = ainda não logou / perfil antigo sem esse campo

  // Aplica o tema escolhido (ou "sistema", o padrão) assim que o perfil
  // carrega, e reaplica se a preferência mudar (ex.: acabou de salvar em
  // Configurações) ou se "sistema" estiver escolhido e o SO trocar de
  // tema enquanto o app está aberto.
  useEffect(() => {
    aplicarTema(temaPreferido);
    if (temaPreferido === "claro" || temaPreferido === "escuro") return;

    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!media) return;
    const ouvir = () => aplicarTema(temaPreferido);
    media.addEventListener("change", ouvir);
    return () => media.removeEventListener("change", ouvir);
  }, [temaPreferido]);

  // Deixa arrastar as listas de abas pro lado com o mouse (não só com o
  // dedo) — sem isso, num computador só com mouse, não tinha como chegar
  // nas abas que passam da largura da tela.
  useEffect(() => instalarArrastoTabs(), []);

  return (
    <div className="app-shell">
      <AvisosApp />
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Pública de propósito — é o link que se manda direto pra quem
            ainda nem tem conta, só pra instalar o app no aparelho. */}
        <Route path="/baixar" element={<Baixar />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route path="/recuperar-senha" element={<RecuperarSenha />} />
        <Route path="/recuperar-usuario" element={<RecuperarUsuario />} />
        <Route path="/cadastro-pendente" element={<CadastroPendente />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/nova-coleta"
          element={
            <ProtectedRoute papeis={["cliente"]}>
              <NovaColeta />
            </ProtectedRoute>
          }
        />
        <Route
          path="/coletas/:id"
          element={
            // Chat de uma coleta: só cliente e equipe (gerente/despachante)
            // — não existe comunicação direta entre cliente e coletor.
            <ProtectedRoute papeis={["cliente", "despachante", "gerente"]}>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat-coletor/:coletorId"
          element={
            // Chat do coletor com a equipe (gerente/despachante) — mesma
            // tela de Chat.jsx, em outro modo (ver comentário lá).
            <ProtectedRoute papeis={["coletor", "despachante", "gerente"]}>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/configuracoes"
          element={
            <ProtectedRoute>
              <Configuracoes />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* Somem enquanto a conta está pendente de aprovação — a pessoa só vê a
          tela de "Cadastro em análise" e o botão de sair, sem atalhos pra
          telas que ainda não pode usar. */}
      {papel && perfil?.aprovado !== false && (
        <>
          <div className="botoes-topo-fixos">
            {papel === "cliente" && <BotaoComoUsar />}
            <BotaoConfiguracoes />
          </div>
          <BottomNav papel={papel} />
        </>
      )}
    </div>
  );
}
