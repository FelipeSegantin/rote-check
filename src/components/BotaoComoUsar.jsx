import { useEffect, useState } from "react";

// Felipe: dois vídeos — um vertical (feito pensando em celular) e um
// horizontal (feito pensando em tela de computador). O app escolhe sozinho
// qual mostrar, olhando a largura da tela na hora que a pessoa abre a
// janela. Aceita o link normal do YouTube (ex.: youtube.com/watch?v=... ou
// youtu.be/...), um link direto de vídeo (.mp4/.webm) ou um link de embed
// (Vimeo, Google Drive "preview" etc.) — o vídeo abre dentro do próprio
// app, numa janela por cima da tela, sem levar o cliente pra outro site.
// Enquanto um dos dois ficar vazio, some só ele (usa o outro pras duas
// larguras de tela); com os dois vazios, mostra um aviso de "em breve".
const LINK_VIDEO_COMO_USAR_CELULAR = "https://youtube.com/shorts/3KHA3oZotMs";
const LINK_VIDEO_COMO_USAR_PC = "https://youtu.be/PcOSzbThzL0";

// A partir dessa largura de tela (em pixels), mostra o vídeo horizontal
// (pensado pra computador) em vez do vertical.
const LARGURA_MINIMA_PC = 700;

// Aceita o link comum que dá pra copiar da barra de endereço/botão
// "Compartilhar" do YouTube e converte pro formato de embed — sem isso,
// o YouTube recusa mostrar o vídeo dentro de um iframe.
function paraEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : url;
      }
      if (u.pathname.startsWith("/shorts/")) {
        return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
      }
    }
    return url; // já é um link de embed, ou um vídeo direto (.mp4 etc.)
  } catch {
    return url;
  }
}

// Decide qual dos dois vídeos usar: o pensado pra tela larga (computador) a
// partir de LARGURA_MINIMA_PC, o vertical (celular) abaixo disso — caindo
// pro outro quando um dos dois ainda não foi preenchido.
function escolherLink() {
  const telaLarga = typeof window !== "undefined" && window.innerWidth >= LARGURA_MINIMA_PC;
  if (telaLarga) return LINK_VIDEO_COMO_USAR_PC || LINK_VIDEO_COMO_USAR_CELULAR;
  return LINK_VIDEO_COMO_USAR_CELULAR || LINK_VIDEO_COMO_USAR_PC;
}

function IconePlay() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconeFechar() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// Botão pequeno de "Como usar" — fixo no topo, ao lado do de Configurações
// (só aparece pro papel de cliente, ver App.jsx). Abre o vídeo numa janela
// dentro do próprio app, em vez de mandar o cliente pra outro site.
export default function BotaoComoUsar() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    function aoTeclar(e) {
      if (e.key === "Escape") setAberto(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  // Só recalcula quando a janela abre — não precisa acompanhar a pessoa
  // redimensionando a tela com o vídeo já tocando.
  const linkEscolhido = aberto ? escolherLink() : "";
  const ehArquivoDeVideo = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(linkEscolhido);
  const linkEmbed = paraEmbedUrl(linkEscolhido);

  return (
    <>
      <button
        type="button"
        className="botao-como-usar-fixo"
        aria-label="Como usar o app"
        title="Como usar o app"
        onClick={() => setAberto(true)}
      >
        <IconePlay />
      </button>

      {aberto && (
        <div className="modal-como-usar-fundo" onClick={() => setAberto(false)}>
          <div className="modal-como-usar-conteudo" onClick={(e) => e.stopPropagation()}>
            <div className="modal-como-usar-cabecalho">
              <strong>Como usar o app</strong>
              <button type="button" className="modal-como-usar-fechar" aria-label="Fechar" onClick={() => setAberto(false)}>
                <IconeFechar />
              </button>
            </div>

            {linkEscolhido ? (
              <>
                <div className="modal-como-usar-video">
                  {ehArquivoDeVideo ? (
                    <video controls autoPlay src={linkEscolhido} />
                  ) : (
                    <iframe
                      src={linkEmbed}
                      title="Como usar o app"
                      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                      allowFullScreen
                    />
                  )}
                </div>
                {!ehArquivoDeVideo && (
                  // Link de reserva: se o vídeo embutido não carregar por
                  // algum motivo (bloqueio do navegador, preview do Claude
                  // que não deixa embutir outros sites, etc.), a pessoa
                  // ainda consegue assistir abrindo no YouTube.
                  <p style={{ textAlign: "center", fontSize: 13, margin: "10px 0 4px" }}>
                    O vídeo não carregou?{" "}
                    <a href={linkEscolhido} target="_blank" rel="noreferrer">
                      Assistir no YouTube ↗
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: "var(--text-dim)", padding: "8px 16px 20px" }}>
                O vídeo ainda não foi gravado — em breve por aqui!
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
