// Edge Function: send-push
//
// Chamada pelos triggers do Postgres (trg_nova_coleta, trg_status_coleta,
// trg_nova_mensagem, trg_conta_aprovada, trg_nova_solicitacao_usuario) com
// { tipo, coleta_id }, { tipo, mensagem_id }, { tipo, perfil_id } ou
// { tipo, solicitacao_id }, conforme o tipo.
// Decide quem deve receber o push e dispara via Web Push (VAPID) para cada
// subscription salva em `push_subscriptions`.
//
// Secrets necessários (supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (já vêm por padrão)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:seuemail@dominio.com)

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@rotecheck.app",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

type Payload =
  | { tipo: "nova_coleta" | "coleta_aceita" | "coleta_recusada" | "coleta_atribuida" | "coleta_concluida"; coleta_id: string }
  | { tipo: "nova_mensagem"; mensagem_id: string }
  | { tipo: "conta_aprovada"; perfil_id: string }
  | { tipo: "nova_solicitacao_usuario"; solicitacao_id: string };

// Mensagem longa demais não cabe legível numa notificação do sistema.
function resumir(texto: string, max = 140) {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// Monta o texto e decide os destinatários para cada tipo de evento.
async function resolverDestinatarios(payload: Payload) {
  if (payload.tipo === "conta_aprovada") {
    const { data: perfil, error } = await supabaseAdmin
      .from("perfis")
      .select("id, nome, papel")
      .eq("id", payload.perfil_id)
      .single();

    if (error || !perfil) throw new Error(`Perfil não encontrado: ${error?.message}`);

    return {
      userIds: [perfil.id],
      titulo: "Cadastro aprovado!",
      corpo: "Seu cadastro no RoteCheck foi aprovado — você já pode entrar no app normalmente.",
      coletaId: null,
      coletorId: null,
      url: "/",
      tag: `conta-aprovada-${perfil.id}`,
    };
  }

  if (payload.tipo === "nova_solicitacao_usuario") {
    // Avisa todo gerente e despachante ativo — mesma audiência de "nova
    // coleta", já que é a mesma equipe que decide essas solicitações (aba
    // Convites).
    const { data: solicitacao, error } = await supabaseAdmin
      .from("solicitacoes_usuario")
      .select("id, estabelecimento")
      .eq("id", payload.solicitacao_id)
      .single();

    if (error || !solicitacao) throw new Error(`Solicitação não encontrada: ${error?.message}`);

    const { data: destinatarios } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .in("papel", ["gerente", "despachante"]);

    return {
      userIds: (destinatarios ?? []).map((d) => d.id),
      titulo: "Pedido pra recuperar usuário",
      corpo: `${solicitacao.estabelecimento} pediu ajuda pra recuperar o usuário de login.`,
      coletaId: null,
      coletorId: null,
      url: "/",
      tag: `solicitacao-usuario-${solicitacao.id}`,
    };
  }

  if (payload.tipo === "nova_mensagem") {
    const { data: mensagem, error } = await supabaseAdmin
      .from("mensagens")
      .select(
        "*, remetente:remetente_id(id, nome, papel), coleta:coleta_id(id, local, cliente_id, cliente:cliente_id(id, nome)), coletor:coletor_id(id, nome)"
      )
      .eq("id", payload.mensagem_id)
      .single();

    if (error || !mensagem) throw new Error(`Mensagem não encontrada: ${error?.message}`);

    const remetenteEhCliente = mensagem.remetente?.papel === "cliente";
    const remetenteEhColetor = mensagem.remetente?.papel === "coletor";

    // Chat do coletor com a equipe (coleta_id nulo, coletor_id preenchido)
    // — nunca tem cliente envolvido.
    if (mensagem.coletor_id) {
      if (remetenteEhColetor) {
        // Coletor mandou mensagem -> avisa todo gerente e despachante ativo.
        const { data: destinatarios } = await supabaseAdmin
          .from("perfis")
          .select("id")
          .in("papel", ["gerente", "despachante"]);

        return {
          userIds: (destinatarios ?? []).map((d) => d.id),
          titulo: `Mensagem de ${mensagem.coletor?.nome ?? "coletor"}`,
          corpo: resumir(mensagem.texto),
          coletaId: null,
          coletorId: mensagem.coletor_id,
          url: `/chat-coletor/${mensagem.coletor_id}`,
          tag: `chat-coletor-${mensagem.coletor_id}`,
        };
      }

      // Despachante/gerente mandou mensagem -> avisa esse coletor.
      return {
        userIds: mensagem.coletor_id ? [mensagem.coletor_id] : [],
        titulo: "Nova mensagem da equipe",
        corpo: resumir(mensagem.texto),
        coletaId: null,
        coletorId: mensagem.coletor_id,
        url: `/chat-coletor/${mensagem.coletor_id}`,
        tag: `chat-coletor-${mensagem.coletor_id}`,
      };
    }

    if (remetenteEhCliente) {
      // Cliente mandou mensagem -> avisa todo gerente e despachante ativo,
      // igual em "nova coleta".
      const { data: destinatarios } = await supabaseAdmin
        .from("perfis")
        .select("id")
        .in("papel", ["gerente", "despachante"]);

      return {
        userIds: (destinatarios ?? []).map((d) => d.id),
        titulo: `Mensagem de ${mensagem.coleta?.cliente?.nome ?? "cliente"}`,
        corpo: resumir(mensagem.texto),
        coletaId: mensagem.coleta_id,
        coletorId: null,
        url: `/coletas/${mensagem.coleta_id}`,
        tag: `coleta-${mensagem.coleta_id}`,
      };
    }

    // Despachante/gerente mandou mensagem -> avisa o cliente dono da coleta.
    return {
      userIds: mensagem.coleta?.cliente_id ? [mensagem.coleta.cliente_id] : [],
      titulo: `Nova mensagem sobre sua coleta${mensagem.coleta?.local ? ` em ${mensagem.coleta.local}` : ""}`,
      corpo: resumir(mensagem.texto),
      coletaId: mensagem.coleta_id,
      coletorId: null,
      url: `/coletas/${mensagem.coleta_id}`,
      tag: `coleta-${mensagem.coleta_id}`,
    };
  }

  const { data: coleta, error } = await supabaseAdmin
    .from("coletas")
    .select("*, cliente:cliente_id(id, nome), coletor:coletor_id(id, nome)")
    .eq("id", payload.coleta_id)
    .single();

  if (error || !coleta) throw new Error(`Coleta não encontrada: ${error?.message}`);

  if (payload.tipo === "nova_coleta") {
    // Avisa todo gerente e despachante ativo.
    const { data: destinatarios } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .in("papel", ["gerente", "despachante"]);

    return {
      userIds: (destinatarios ?? []).map((d) => d.id),
      titulo: "Nova coleta solicitada",
      corpo: `${coleta.cliente?.nome ?? "Cliente"} pediu uma coleta em ${coleta.local}.`,
      coletaId: coleta.id,
      coletorId: null,
      url: `/coletas/${coleta.id}`,
      tag: `coleta-${coleta.id}`,
    };
  }

  if (payload.tipo === "coleta_aceita") {
    return {
      userIds: [coleta.cliente_id],
      titulo: "Coleta aceita",
      corpo: `Sua coleta em ${coleta.local} foi aceita${
        coleta.coletor?.nome ? ` — coletor: ${coleta.coletor.nome}` : ""
      }.`,
      coletaId: coleta.id,
      coletorId: null,
      url: `/coletas/${coleta.id}`,
      tag: `coleta-${coleta.id}`,
    };
  }

  if (payload.tipo === "coleta_recusada") {
    return {
      userIds: [coleta.cliente_id],
      titulo: "Coleta recusada",
      corpo: coleta.motivo_recusa
        ? `Sua coleta em ${coleta.local} foi recusada: ${coleta.motivo_recusa}`
        : `Sua coleta em ${coleta.local} foi recusada.`,
      coletaId: coleta.id,
      coletorId: null,
      url: `/coletas/${coleta.id}`,
      tag: `coleta-${coleta.id}`,
    };
  }

  if (payload.tipo === "coleta_atribuida") {
    // Avisa o coletor que ficou responsável — pedido separado do aviso que
    // já ia pro cliente em "coleta_aceita" (mesmo momento, pessoa diferente).
    // Abre a Home do coletor em vez de /coletas/:id, porque essa rota é só
    // de cliente/despachante/gerente (ver App.jsx) — o coletor não acessa.
    return {
      userIds: coleta.coletor_id ? [coleta.coletor_id] : [],
      titulo: "Nova coleta pra você",
      corpo: `Você ficou responsável pela coleta em ${coleta.local}.`,
      coletaId: coleta.id,
      coletorId: null,
      url: "/",
      tag: `coleta-atribuida-${coleta.id}`,
    };
  }

  // coleta_concluida
  return {
    userIds: [coleta.cliente_id],
    titulo: "Coleta concluída",
    corpo: `Sua coleta em ${coleta.local} foi realizada${coleta.coletor?.nome ? ` por ${coleta.coletor.nome}` : ""}.`,
    coletaId: coleta.id,
    coletorId: null,
    url: `/coletas/${coleta.id}`,
    tag: `coleta-${coleta.id}`,
  };
}

Deno.serve(async (req) => {
  try {
    const payload: Payload = await req.json();
    const { userIds, titulo, corpo, coletaId, coletorId, url, tag } = await resolverDestinatarios(payload);

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviados: 0 }), { status: 200 });
    }

    // Registra no histórico in-app (independente do push ter sucesso).
    await supabaseAdmin.from("notificacoes").insert(
      userIds.map((userId) => ({
        user_id: userId,
        coleta_id: coletaId,
        coletor_id: coletorId,
        tipo: payload.tipo,
        titulo,
        corpo,
      }))
    );

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    // Cada branch de resolverDestinatarios já diz pra onde abrir e qual tag
    // usar (pra notificações do mesmo assunto se substituírem em vez de
    // empilhar) — não precisa mais adivinhar aqui a partir de coletaId/
    // coletorId, já que agora tem tipos sem nenhum dos dois (conta
    // aprovada, solicitação de usuário).
    const notificationBody = JSON.stringify({
      title: titulo,
      body: corpo,
      url,
      coletaId,
      coletorId,
      tipo: payload.tipo,
      tag,
    });

    const resultados = await Promise.allSettled(
      (subscriptions ?? []).map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationBody
        )
      )
    );

    // Subscription expirada/inválida (410/404) -> limpa do banco.
    const paraRemover: string[] = [];
    resultados.forEach((r, i) => {
      if (r.status === "rejected") {
        const statusCode = (r.reason as any)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          paraRemover.push(subscriptions![i].endpoint);
        }
      }
    });
    if (paraRemover.length > 0) {
      await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", paraRemover);
    }

    return new Response(
      JSON.stringify({ ok: true, enviados: resultados.filter((r) => r.status === "fulfilled").length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
});
