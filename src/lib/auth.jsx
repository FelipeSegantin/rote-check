import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { registerServiceWorker, subscribeToPush } from "./push";

const AuthContext = createContext(null);

// Coletores logam com usuário simples, não e-mail. O Supabase Auth exige
// e-mail, então internamente mapeamos usuario -> um e-mail sintético
// dentro de um domínio que nunca recebe e-mail de verdade.
const COLETOR_DOMAIN = "coletor.rotecheck.internal";
export function usuarioParaEmailColetor(usuario) {
  return `${usuario.trim().toLowerCase()}@${COLETOR_DOMAIN}`;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null); // linha da tabela "perfis"
  const [carregando, setCarregando] = useState(true);
  // true só quando carregarPerfil desistiu de vez (depois da tentativa
  // extra abaixo) — é o que diferencia "ainda carregando" (tela em
  // branco por uma fração de segundo, normal) de "não vai carregar
  // sozinho" (precisa mostrar algo pra pessoa em vez de deixar a tela
  // preta pra sempre). Ver comentário logo abaixo sobre o retry.
  const [erroPerfil, setErroPerfil] = useState(false);

  async function carregarPerfil(userId, tentativa = 0) {
    setErroPerfil(false);
    const { data, error } = await supabase.from("perfis").select("*").eq("id", userId).single();
    if (error) {
      // A primeira falha pode ser um soluço passageiro (já vimos um bug
      // conhecido do lado do Supabase — "JWT issued at future" — dar erro
      // bem na hora de logar/cadastrar e sumir sozinho na tentativa
      // seguinte). Tenta mais uma vez antes de desistir e mostrar erro.
      if (tentativa < 1) {
        await new Promise((resolver) => setTimeout(resolver, 1500));
        return carregarPerfil(userId, tentativa + 1);
      }
      console.error("Erro ao carregar perfil:", error);
      setPerfil(null);
      setErroPerfil(true);
      return;
    }
    setPerfil(data);
  }

  useEffect(() => {
    registerServiceWorker();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) carregarPerfil(session.user.id);
      setCarregando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        carregarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Depois que o perfil carrega, inscreve o dispositivo em push — cada
  // papel recebe notificações diferentes (ver gatilhos no banco).
  useEffect(() => {
    if (perfil?.id) subscribeToPush(perfil.id);
  }, [perfil?.id]);

  async function loginEmail(email, senha) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return { data, error };
  }

  async function loginColetor(usuario, senha) {
    const email = usuarioParaEmailColetor(usuario);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return { data, error };
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    perfil,
    carregando,
    erroPerfil,
    papel: perfil?.papel || null, // "cliente" | "despachante" | "gerente" | "coletor"
    loginEmail,
    loginColetor,
    logout,
    recarregarPerfil: () => session?.user && carregarPerfil(session.user.id),
    // Igual a recarregarPerfil, mas recebe o id explicitamente em vez de
    // depender do "session" capturado no fechamento de quem chamou. É o
    // que a tela de Cadastro usa logo após criar a conta: o signUp dispara
    // "SIGNED_IN" e atualiza o session deste Provider, mas o componente
    // que chamou (Cadastro) pode ainda estar com uma versão antiga do
    // useAuth() nesse mesmo instante (o id que já temos em mãos ali evita
    // essa corrida).
    carregarPerfilPara: (userId) => carregarPerfil(userId),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
