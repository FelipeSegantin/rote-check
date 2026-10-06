// Gera um "print" (imagem .png) do trajeto percorrido pelo coletor num
// intervalo específico (o dia inteiro de trabalho, de "Iniciar o dia" até
// "Encerrar o dia"). Desenhado num <canvas> escondido a partir só dos pontos de GPS — não usa
// tiles de mapa reais (evita problema de CORS ao exportar a imagem e
// funciona mesmo sem internet no momento de gerar o print). O resultado é
// devolvido como Blob, pronto pra subir pro Supabase Storage.

const LARGURA = 900;
const ALTURA = 620;
const MARGEM = { top: 96, right: 40, bottom: 56, left: 40 };

function formatarHora(iso) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatarData(iso) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export async function gerarPrintRota({ pontos, coletorNome, inicioEm, fimEm }) {
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");

  // Fundo (estilo "recibo" — claro e neutro, legível independente do tema
  // que a pessoa estiver usando no app, já que essa imagem some do app e
  // pode ser vista solta em qualquer lugar).
  ctx.fillStyle = "#f6f4ee";
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // Cabeçalho
  ctx.fillStyle = "#1a1a16";
  ctx.font = "bold 26px system-ui, sans-serif";
  ctx.fillText("RoteCheck — trajeto do dia", 32, 42);

  ctx.font = "16px system-ui, sans-serif";
  ctx.fillStyle = "#6b6558";
  const linhaData = `${coletorNome || "Coletor"} · ${formatarData(inicioEm)} · ${formatarHora(inicioEm)} – ${formatarHora(fimEm)}`;
  ctx.fillText(linhaData, 32, 70);

  // Área do "mapa" (moldura)
  const areaX = MARGEM.left;
  const areaY = MARGEM.top;
  const areaW = LARGURA - MARGEM.left - MARGEM.right;
  const areaH = ALTURA - MARGEM.top - MARGEM.bottom;
  ctx.strokeStyle = "#d8d2c2";
  ctx.lineWidth = 1;
  ctx.strokeRect(areaX, areaY, areaW, areaH);
  ctx.fillStyle = "#fbfaf6";
  ctx.fillRect(areaX, areaY, areaW, areaH);

  if (!pontos || pontos.length === 0) {
    ctx.fillStyle = "#6b6558";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Nenhuma posição de GPS registrada nesse intervalo.", areaX + 24, areaY + areaH / 2);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // Converte lat/lon pra coordenadas dentro da área do mapa, preservando a
  // proporção (senão o trajeto sai esticado/achatado).
  const lats = pontos.map((p) => p.latitude);
  const lons = pontos.map((p) => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const paddingGraus = Math.max((maxLat - minLat) * 0.15, (maxLon - minLon) * 0.15, 0.0008);

  const lat0 = minLat - paddingGraus;
  const lat1 = maxLat + paddingGraus;
  const lon0 = minLon - paddingGraus;
  const lon1 = maxLon + paddingGraus;

  function paraXY(lat, lon) {
    const x = areaX + ((lon - lon0) / (lon1 - lon0 || 1)) * areaW;
    // Latitude cresce pra cima, mas Y do canvas cresce pra baixo.
    const y = areaY + (1 - (lat - lat0) / (lat1 - lat0 || 1)) * areaH;
    return [x, y];
  }

  // Linha tracejada do trajeto — mesmo estilo visual do mapa ao vivo do app.
  ctx.strokeStyle = "#e0b400";
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  pontos.forEach((p, i) => {
    const [x, y] = paraXY(p.latitude, p.longitude);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  // Marcador de início (verde) e fim (vermelho) — com só 1 ponto de GPS
  // registrado no intervalo, início e fim caem no mesmo lugar, então
  // mostra só um marcador em vez de dois rótulos "Início"/"Fim" um em
  // cima do outro.
  function marcador(x, y, cor, rotulo) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.strokeStyle = "#fbfaf6";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#1a1a16";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(rotulo, x + 12, y + 4);
  }

  if (pontos.length === 1) {
    const [x, y] = paraXY(pontos[0].latitude, pontos[0].longitude);
    marcador(x, y, "#2f9e44", "Único ponto registrado");
  } else {
    const [xIni, yIni] = paraXY(pontos[0].latitude, pontos[0].longitude);
    const [xFim, yFim] = paraXY(pontos[pontos.length - 1].latitude, pontos[pontos.length - 1].longitude);
    marcador(xIni, yIni, "#2f9e44", "Início");
    marcador(xFim, yFim, "#c22a38", "Fim");
  }

  // Rodapé
  ctx.fillStyle = "#a8a49a";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(
    `Gerado automaticamente pelo RoteCheck em ${new Date().toLocaleString("pt-BR")} · ${pontos.length} pontos de GPS`,
    32,
    ALTURA - 20
  );

  return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}
