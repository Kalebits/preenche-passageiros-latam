// Leitura dos documentos pelo Google Gemini, com a chave de quem usa (opções da extensão).
// Fica aqui (e não na página) porque a página da LATAM não pode chamar o Google direto.
const MODELOS = ["gemini-3.8-flash", "gemini-2.5-flash"]; // melhor grátis em 30/09/2026 + reserva quando ele está cheio
const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

const PROMPT = `Você extrai dados de passageiros de fotos de documentos (passaporte, RG, CNH, cédula estrangeira)
e/ou de texto solto, para preencher uma passagem aérea da LATAM. Pode haver vários passageiros misturados.

Responda SOMENTE com este JSON:
{"passageiros": [{"nome": "", "sobrenome": "", "nascimento": "DD/MM/AAAA", "sexo": "Masculino|Feminino", "sexo_origem": "documento|nome|",
  "nacionalidade": "", "cpf": "", "passaporte": "", "identidade": "", "email": "", "telefone": ""}]}

Regras:
- Um item por pessoa. Documento com NOMES/SOBRENOMES separados (passaporte: Given names / Surname; cédula:
  NOMBRES / APELLIDOS): use como está. Nome completo corrido (brasileiro): nome = primeiro nome, sobrenome = o resto.
- Passaporte: leia também a zona de leitura mecânica (as 2 linhas com <<<) e confira com o que está impresso.
- Datas sempre DD/MM/AAAA. CPF só números (11 dígitos). Passaporte: número exatamente como no documento.
- sexo: pelo documento (M/F, Masculino/Feminino, SOLTERA = Feminino, SOLTERO = Masculino) com sexo_origem "documento".
  Se o documento não disser, deduza pelo primeiro nome SÓ se for claramente de homem ou de mulher (sexo_origem "nome").
  Nome que serve para os dois ou desconhecido: sexo "" e sexo_origem "".
- CPF brasileiro (11 dígitos) vai em cpf. Estrangeiro NÃO tem CPF: passaporte vai em passaporte; cédula/carteira de
  identidade estrangeira vai em identidade, só os números (sem a letra de nacionalidade, ex.: "V").
- nacionalidade em português ("Brasileira", "Venezuelana", "Americana"...).
- Se e-mail ou telefone aparecerem uma vez só, repita em todos.
- Nunca invente: o que não aparecer fica "".`;

chrome.runtime.onMessage.addListener((msg, _sender, responder) => {
  if (msg.tipo !== "ler") return;
  ler(msg.texto || "", msg.imagens || []).then(responder, (e) => responder({ erro: e.message }));
  return true; // resposta assíncrona
});

async function ler(texto, imagens) {
  const { chave } = await chrome.storage.local.get("chave");
  if (!chave) throw new Error("Falta a chave do Gemini: abra as opções da extensão e cole a sua chave.");
  const partes = imagens.map((url) => {
    const [cabeca, dados] = url.split(",");
    return { inline_data: { mime_type: cabeca.slice(5, cabeca.indexOf(";")), data: dados } };
  });
  partes.push({ text: PROMPT + (texto.trim() ? `\n\nTexto recebido:\n<<<\n${texto.trim()}\n>>>` : "") });
  const corpo = JSON.stringify({ contents: [{ parts: partes }],
    generationConfig: { temperature: 0, responseMimeType: "application/json" } });
  // 500/502/503/504 = Google sobrecarregado: tenta de novo (1,5 s e 3 s) e depois o modelo reserva.
  let r;
  for (const modelo of MODELOS) {
    for (const pausa of [0, 1500, 3000]) {
      await esperar(pausa);
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": chave }, body: corpo });
      if (r.status < 500) break;
    }
    if (r.status < 500) break;
  }
  if (r.status >= 500) throw new Error(`O Gemini está sobrecarregado agora (erro ${r.status}), mesmo depois de tentar de novo. Espere um minuto e clique em "Ler dados" outra vez.`);
  if (r.status === 429) throw new Error("Acabou a cota grátis do Gemini por agora. Espere um pouco ou preencha à mão.");
  if (!r.ok) {
    const resposta = await r.text();
    throw new Error(/key/i.test(resposta) ? "A chave do Gemini não foi aceita. Confira nas opções da extensão."
      : `Erro do Gemini (${r.status}).`);
  }
  const resposta = await r.json();
  const bruto = (resposta.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  const json = bruto.match(/\{[\s\S]*\}/);
  if (!json) throw new Error("O Gemini não devolveu os dados no formato esperado. Tente de novo.");
  return JSON.parse(json[0]);
}

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
// Logo depois de instalar, abre o passo a passo da chave.
chrome.runtime.onInstalled.addListener(({ reason }) => { if (reason === "install") chrome.runtime.openOptionsPage(); });
