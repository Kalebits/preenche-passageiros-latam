// Painel dentro do site da LATAM (tela de passageiros): texto/fotos -> conferir -> preenche o cartão de cada passageiro
// (Adulto 1, Criança 1, Bebê 1...). Com tudo certo, clica em "Confirmar dados" DAQUELE passageiro.
// NUNCA clica em "Continuar": conferir a reserva e pagar é sempre você.
(() => {
  if (window.top !== window || document.getElementById("ppl-raiz")) return;

  // ---------- registro (log) do "Preencher todos" ----------
  // Vai para quem mantém a extensão: SEM dados pessoais. Valores aparecem só como "preenchido"/"sem dado".
  let diario = null;
  const anotar = (texto) => diario?.push(`${new Date().toLocaleTimeString("pt-BR")}  ${texto}`);
  const tem = (v) => (v ? "preenchido" : "sem dado");

  function baixarRegistro() {
    const agora = new Date();
    const dois = (n) => String(n).padStart(2, "0");
    const nome = `preenche-passageiros-latam-registro-${agora.getFullYear()}-${dois(agora.getMonth() + 1)}-${dois(agora.getDate())}-${dois(agora.getHours())}${dois(agora.getMinutes())}.txt`;
    const url = URL.createObjectURL(new Blob([diario.join("\n") + "\n"], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: nome });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return nome;
  }

  // ---------- regras dos dados (as mesmas do app Emissões MP) ----------
  const norm = (s) => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const semAcento = (s) => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").toUpperCase().trim();
  const digitos = (s) => (s || "").replace(/\D/g, "");
  const alfanum = (s) => (s || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  function telefone(s) {
    let d = digitos(s);
    if (d.length >= 12 && d.startsWith("55")) d = d.slice(2); // tira o +55: a LATAM já tem o país ao lado
    return d;
  }
  // LATAM: "Nome" e "Sobrenome". Veio separado (documento, pedido Bank): usa como está. Veio corrido: 1º nome / o resto.
  function dividirNome(p) {
    if (p.sobrenome) return { nome: semAcento(p.nome), sobrenome: semAcento(p.sobrenome) };
    const [nome, ...resto] = (p.nome || "").trim().split(/\s+/);
    return { nome: semAcento(nome), sobrenome: semAcento(resto.join(" ")) };
  }
  function sexoPeloNome(nome) {
    const primeiro = norm((nome || "").split(/\s+/)[0]);
    return globalThis.NOMES_MASCULINOS?.has(primeiro) ? "Masculino" : globalThis.NOMES_FEMININOS?.has(primeiro) ? "Feminino" : "";
  }
  const PARTICULAS = new Set(["da", "de", "do", "das", "dos", "e"]);
  // "MARIA CLARA LIMA" / "LIMA": a palavra do sobrenome já está no nome (ficaria "LIMA LIMA").
  function nomeRepetido(p) {
    const nome = norm(p.nome).split(/\s+/);
    return norm(p.sobrenome).split(/\s+/).filter((w) => w && nome.includes(w) && !PARTICULAS.has(w));
  }

  // ---------- leitura local (sem Gemini) de texto ----------
  // Aceita o texto solto (nome, CPF, nascimento, uma pessoa por bloco ou por linha) e o pedido Bank
  // ("Nome:", "Sobrenome:", "CPF:", "Nasc:", "Sexo:"). Faltou nome, nascimento ou documento: vai para o Gemini.
  const ROTULOS = [[/^nome/, "nome"], [/^sobrenome/, "sobrenome"], [/^cpf/, "cpf"], [/^(nasc|data de nasc)/, "nascimento"],
    [/^(sexo|genero)/, "sexo"], [/^(e-?mail)/, "email"], [/^(tel|cel|fone|whats)/, "telefone"], [/^passaporte/, "passaporte"],
    [/^(tipo)/, "tipo"], [/^(rg|identidade|cedula)/, "identidade"]];
  function dataBr(s) {
    const m = (s || "").match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    return m ? `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}` : "";
  }
  // Separa data e CPF de dentro de um pedaço ("Nome: 02/02/2019", "CPF 080.330.762-40"): cada valor vira um pedaço
  // próprio e o rótulo que estava junto ("CPF", "Nascimento") some. Pedaço sem valor (um nome) fica como está.
  function pedacos(parte) {
    const achados = [];
    let resto = parte
      .replace(/(?<!\d)\d{1,2}[/.-]\d{1,2}[/.-]\d{4}(?!\d)/g, (m) => { achados.push(m); return " "; })
      .replace(/(?<!\d)\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/g, (m) => { achados.push(m.replace(/\D/g, "")); return " "; });
    if (achados.length) resto = resto.replace(/\b(data de nascimento|nascimento|nasc|cpf|documento|doc)\b\.?\s*[:=-]?/gi, " ");
    resto = resto.replace(/\s*[:=-]\s*$/, "").replace(/\s+/g, " ").trim();
    return [...(resto ? [resto] : []), ...achados];
  }

  function lerTextoLocal(texto) {
    // Pedido Bank: só o bloco de passageiros (o cabeçalho e os voos não são pessoas).
    const pedido = texto.match(/PASSAGEIROS:?\s*\n([\s\S]*?)(?=\n\s*(?:🔗|🔍|EMISS[ÃA]O PRONTA|BUSCAR)|$)/i);
    if (pedido) texto = pedido[1];
    const linhas = texto.trim().split(/\n/).map((l) => l.trim());
    const porLinha = linhas.filter(Boolean).every((l) => /[A-Za-zÀ-ÿ]/.test(l) && /\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2}/.test(l));
    // Pedido Bank: cada passageiro começa em "Tipo:" (às vezes sem linha em branco entre eles).
    const blocos = porLinha ? linhas.filter(Boolean)
      : texto.trim().split(/\n\s*\n|\n(?=\s*Tipo\s*:)/i).filter((b) => b.trim());
    const contato = {};
    const lista = blocos.map((bloco) => {
      const p = {};
      for (const parte of bloco.split(/[\n,;]+/).flatMap(pedacos).map((x) => x.trim()).filter(Boolean)) {
        const rotulado = parte.match(/^([A-Za-zÀ-ÿ. -]{2,20}?)\s*:\s*(.*)$/);
        const chave = rotulado && ROTULOS.find(([re]) => re.test(norm(rotulado[1])))?.[1];
        if (chave) {
          const v = rotulado[2].trim();
          if (chave === "cpf") p.cpf = digitos(v);
          else if (chave === "nascimento") p.nascimento = dataBr(v);
          else if (chave === "sexo") { p.sexo = /^f/i.test(v) ? "Feminino" : /^m/i.test(v) ? "Masculino" : ""; p.sexo_origem = p.sexo ? "documento" : ""; }
          else if (chave === "telefone") p.telefone = digitos(v);
          else if (chave === "email") p.email = v.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || "";
          else if (chave === "passaporte") p.passaporte = alfanum(v);
          else if (chave === "identidade") p.identidade = digitos(v);
          else if (chave === "tipo") p.tipo = v.toUpperCase();
          else p[chave] = v;
          continue;
        }
        const dig = digitos(parte);
        if (/@/.test(parte)) p.email = parte.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] || "";
        else if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{4}$/.test(parte)) p.nascimento = dataBr(parte);
        else if (!/[A-Za-zÀ-ÿ]/.test(parte) && dig.length === 11 && !p.cpf) p.cpf = dig;
        else if (!/[A-Za-zÀ-ÿ]/.test(parte) && dig.length >= 10 && dig.length <= 13) p.telefone = dig;
        else if (/^[A-Za-z]{1,3}\d{5,8}$/.test(parte.replace(/\s/g, ""))) p.passaporte = alfanum(parte);
        else if (/[A-Za-zÀ-ÿ]{2}/.test(parte) && !p.nome) p.nome = parte;
      }
      // Bloco sem nome = só contato (e-mail/telefone de todos); ali um número de 11 dígitos é celular, não CPF.
      if (!p.nome) { Object.assign(contato, { email: p.email || contato.email, telefone: p.telefone || p.cpf || contato.telefone }); return null; }
      if (!p.sobrenome) Object.assign(p, dividirNome(p)); // nome corrido: 1º nome / o resto
      return p;
    }).filter(Boolean);
    if (!lista.length || lista.some((p) => !p.nome || !p.nascimento || !(p.cpf || p.passaporte || p.identidade))) return null;
    return lista.map((p) => {
      const sexo = p.sexo || sexoPeloNome(p.nome);
      return { cpf: "", passaporte: "", identidade: "", nacionalidade: p.cpf ? "Brasileira" : "", email: "", telefone: "",
        ...p, sexo, sexo_origem: p.sexo ? p.sexo_origem : sexo ? "nome" : "",
        email: p.email || contato.email || "", telefone: p.telefone || contato.telefone || "" };
    });
  }

  // ---------- a página de passageiros da LATAM ----------
  const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
  const visivel = (el) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  const NOMES_TIPO = { ADT: "Adulto", CHD: "Criança", INF: "Bebê" };
  // Um cartão por passageiro: data-testid="accordion-passenger-ADT_1-accordion" (campos com id "<campo>-ADT_1").
  const lugares = () => [...document.querySelectorAll('[data-testid^="accordion-passenger-"]')].map((el) => {
    const m = (el.dataset.testid || "").match(/^accordion-passenger-([A-Z]+)_(\d+)-accordion$/);
    return m && { el, tipo: m[1], n: Number(m[2]), sufixo: `${m[1]}_${m[2]}` };
  }).filter(Boolean);
  const nomeLugar = (l) => `${NOMES_TIPO[l.tipo] || l.tipo} ${l.n}`;
  const telaDePassageiros = () => /passageiros/i.test(location.pathname) || lugares().length > 0;

  async function abrir(lugar) {
    if (lugar.el.getAttribute("aria-expanded") === "true" || visivel(document.getElementById(`passengerDetails-firstName-${lugar.sufixo}`))) return;
    lugar.el.click();
    await esperar(700);
    if (!visivel(document.getElementById(`passengerDetails-firstName-${lugar.sufixo}`))) {
      lugar.el.querySelector("button, [role=button]")?.click(); // cabeçalho do cartão
      await esperar(700);
    }
  }

  // O site é React com máscara (data, CPF): digita como se fosse o teclado; se não pegar, valor + eventos.
  function escrever(campo, valor, soDigitos) {
    const conferir = (v) => (soDigitos ? digitos(v) : (v || "").trim().toUpperCase());
    campo.focus();
    campo.select?.();
    document.execCommand("insertText", false, valor);
    if (conferir(campo.value) !== conferir(valor)) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(campo, valor);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
      campo.dispatchEvent(new Event("change", { bubbles: true }));
    }
    campo.blur();
    return conferir(campo.value) === conferir(valor);
  }

  // Sexo (Material-UI): campo escondido MALE/FEMALE + botão ao lado que abre a lista (abre no "mousedown").
  async function escolherSexo(sufixo, sexo) {
    const valor = { masculino: "MALE", feminino: "FEMALE" }[norm(sexo)];
    const oculto = document.getElementById(`passengerInfo-gender-${sufixo}`);
    if (!valor || !oculto) return false;
    if (oculto.value === valor) return true;
    let botao = oculto.previousElementSibling;
    while (botao && !["button", "combobox"].includes(botao.getAttribute("role"))) botao = botao.previousElementSibling;
    if (!botao) return false;
    botao.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
    await esperar(400);
    const opcao = [...document.querySelectorAll(`[role=listbox] [role=option][data-value="${valor}"]`)].find(visivel);
    if (!opcao) return false;
    opcao.click();
    await esperar(300);
    return oculto.value === valor;
  }

  const recusados = (sufixo) => [...document.querySelectorAll(`[id$="-${sufixo}"][aria-invalid="true"]`)]
    .map((e) => e.id.slice(0, -sufixo.length - 1));

  async function preencher(lugar, p) {
    await abrir(lugar);
    const s = lugar.sufixo;
    const falhas = [];
    const por = (prefixo, valor, nome, soDigitos = false) => {
      const c = document.getElementById(`${prefixo}-${s}`);
      anotar(`    ${nome}: ${!valor ? "sem dado" : c ? "preenchido" : "CAMPO NÃO ACHADO na página"}`);
      if (!valor) return falhas.push(`${nome} (sem dado)`);
      if (!c) return falhas.push(`${nome} (campo não achado)`);
      if (!escrever(c, valor, soDigitos)) falhas.push(`${nome} (não entrou)`);
    };
    anotar(`  ${nomeLugar(lugar)} (${s})`);
    const { nome, sobrenome } = dividirNome(p);
    por("passengerDetails-firstName", nome, "Nome");
    por("passengerDetails-lastName", sobrenome, "Sobrenome");
    por("passengerInfo-dateOfBirth", (p.nascimento || "").replace(/\//g, "-"), "Data de nascimento", true);
    const cpf = digitos(p.cpf);
    const estrangeiro = cpf.length !== 11;
    if (!estrangeiro) por("taxDocument-documentNumber", cpf, "CPF", true);
    // "Nº de documento": criança/bebê brasileiros repetem o CPF; estrangeiro usa passaporte ou cédula.
    const doc = document.getElementById(`documentInfo-documentNumber-${s}`);
    if (doc && visivel(doc)) {
      const numero = estrangeiro ? alfanum(p.passaporte) || digitos(p.identidade) : cpf;
      por("documentInfo-documentNumber", numero, "Nº de documento", !estrangeiro);
    }
    if (estrangeiro) falhas.push(`Nacionalidade (${p.nacionalidade || "?"}) e tipo de documento: escolha à mão`);
    if (!p.sexo) { falhas.push("Sexo (sem dado: escolha)"); anotar("    Sexo: sem dado"); }
    else {
      const ok = await escolherSexo(s, p.sexo);
      anotar(`    Sexo: "${p.sexo}" (${p.sexo_origem || "digitado"}) ${ok ? "escolhido" : "NÃO ESCOLHIDO"}`);
      if (!ok) falhas.push("Sexo");
    }
    por("passengerInfo-emails", (p.email || "").trim(), "E-mail (obrigatório)");
    por("passengerInfo-phones0-number", telefone(p.telefone), "Telefone (obrigatório)", true);
    await esperar(500);
    const doSite = recusados(s);
    if (doSite.length) { anotar(`    LATAM RECUSOU: ${doSite.join(", ")}`); falhas.push(`a LATAM recusou: ${doSite.join(", ")}`); }
    // Só "Confirmar dados" deste passageiro, e só sem falhas. "Continuar" (pagamento) nunca.
    let confirmou = false;
    const confirmar = [...lugar.el.querySelectorAll("button"), ...document.querySelectorAll("button")]
      .find((b) => /^\s*confirmar dados\s*$/i.test(b.innerText) && visivel(b));
    if (!falhas.length && confirmar && !confirmar.disabled) {
      confirmar.click();
      await esperar(2000);
      const depois = recusados(s);
      if (depois.length) falhas.push(`a LATAM recusou: ${depois.join(", ")}`);
      else confirmou = true;
    }
    anotar(`    Confirmar dados: ${confirmou ? "CLICADO" : !confirmar ? "botão não achado" : falhas.length ? "não clicado (há falhas)" : "botão desabilitado"}`);
    lugar.el.scrollIntoView({ behavior: "smooth", block: "start" });
    return { falhas, confirmou };
  }

  // ---------- painel ----------
  const raiz = document.createElement("div");
  raiz.id = "ppl-raiz";
  document.body.append(raiz);
  const sombra = raiz.attachShadow({ mode: "open" });
  sombra.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; font-family: system-ui, "Segoe UI", sans-serif; }
    .abrir { position: fixed; right: 18px; bottom: 18px; z-index: 2147483646; padding: 12px 18px; border: 0; border-radius: 999px;
      background: #3b2ad6; color: #fff; font-weight: 700; font-size: 14px; box-shadow: 0 6px 20px #0004; cursor: pointer; }
    .painel { position: fixed; right: 18px; bottom: 76px; z-index: 2147483647; width: 400px; max-height: 80vh; overflow: auto;
      background: #fff; color: #18181b; border-radius: 14px; box-shadow: 0 18px 50px #0006; padding: 16px; font-size: 14px; }
    h2 { margin: 0 0 10px; font-size: 17px; }
    .lugares { margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; background: #f4f4f5; font-weight: 600; }
    .zona { border: 2px dashed #d4d4d8; border-radius: 10px; padding: 14px; text-align: center; color: #71717a; cursor: pointer; outline: none; }
    .zona:focus, .zona.sobre { border-color: #3b2ad6; color: #3b2ad6; }
    .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; } .fotos img { height: 56px; border-radius: 6px; }
    textarea { width: 100%; min-height: 70px; margin-top: 8px; padding: 8px; border: 1px solid #d4d4d8; border-radius: 8px; font-size: 13px; }
    button.acao { width: 100%; margin-top: 8px; padding: 10px; border: 0; border-radius: 8px; background: #3b2ad6; color: #fff; font-weight: 700; cursor: pointer; }
    button.acao:disabled { opacity: .6; cursor: wait; }
    .pax { border: 1px solid #e4e4e7; border-radius: 10px; padding: 10px; margin-top: 10px; }
    .pax h3 { margin: 0 0 6px; font-size: 14px; }
    .grade { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .grade label { display: flex; flex-direction: column; font-size: 11px; color: #52525b; gap: 2px; }
    .grade input { padding: 6px; border: 1px solid #d4d4d8; border-radius: 6px; font-size: 13px; color: #18181b; }
    .linha { display: flex; gap: 6px; align-items: center; margin-top: 8px; } .linha select { padding: 7px; border-radius: 6px; }
    .erro { background: #fee2e2; color: #991b1b; border: 2px solid #dc2626; border-radius: 10px; padding: 10px; margin-top: 10px; font-weight: 600; }
    .ok { background: #dcfce7; color: #166534; border-radius: 10px; padding: 10px; margin-top: 10px; }
    .atencao { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 10px; padding: 8px 10px; margin: 6px 0; font-weight: 600; }
    .nota { font-size: 11px; color: #71717a; margin-top: 8px; }
  </style>
  <button class="abrir" hidden>Passageiros</button>
  <div class="painel" hidden>
    <h2>Preencher passageiros (LATAM)</h2>
    <p class="lugares"></p>
    <div class="zona" tabindex="0">Cole (Ctrl+V), arraste ou clique para escolher fotos de passaporte, RG, CNH ou cédula</div>
    <input type="file" accept="image/*" multiple hidden>
    <div class="fotos"></div>
    <textarea placeholder="Ou cole os dados como vieram (nome, CPF, nascimento...) ou o pedido Bank inteiro"></textarea>
    <button class="acao ler">Ler dados</button>
    <div class="saida"></div>
    <p class="nota">Texto simples é lido aqui no navegador. Fotos vão para o Google Gemini (chave nas opções da extensão).
      O "Continuar" (pagamento) é sempre você.</p>
  </div>`;
  const $ = (s) => sombra.querySelector(s);
  const painel = $(".painel");
  // O botão só aparece na tela de passageiros (o site troca de tela sem recarregar).
  setInterval(() => { $(".abrir").hidden = !telaDePassageiros(); if ($(".abrir").hidden) painel.hidden = true; }, 1000);
  $(".abrir").onclick = () => {
    painel.hidden = !painel.hidden;
    const l = lugares();
    $(".lugares").textContent = l.length ? `Nesta reserva: ${l.map(nomeLugar).join(", ")}.` : "Não achei os cartões de passageiro nesta página.";
  };

  const fotos = [];
  function desenharFotos() {
    $(".fotos").replaceChildren(...fotos.map((url, i) => {
      const img = document.createElement("img");
      img.src = url; img.title = "Clique para remover";
      img.onclick = () => { fotos.splice(i, 1); desenharFotos(); };
      return img;
    }));
  }
  function adicionar(arquivos) {
    for (const a of arquivos) {
      if (!a.type.startsWith("image/")) continue;
      const leitor = new FileReader();
      leitor.onload = () => { fotos.push(leitor.result); desenharFotos(); };
      leitor.readAsDataURL(a);
    }
  }
  const zona = $(".zona"), escolha = $("input[type=file]");
  zona.onclick = () => escolha.click();
  escolha.onchange = () => { adicionar(escolha.files); escolha.value = ""; };
  zona.addEventListener("paste", (ev) => { ev.preventDefault(); adicionar([...ev.clipboardData.files]); });
  zona.addEventListener("dragover", (ev) => { ev.preventDefault(); zona.classList.add("sobre"); });
  zona.addEventListener("dragleave", () => zona.classList.remove("sobre"));
  zona.addEventListener("drop", (ev) => { ev.preventDefault(); zona.classList.remove("sobre"); adicionar(ev.dataTransfer.files); });

  const aviso = (classe, texto) => { const d = document.createElement("div"); d.className = classe; d.textContent = texto; return d; };
  const CAMPOS = [["nome", "Nome"], ["sobrenome", "Sobrenome"], ["nascimento", "Nascimento"], ["sexo", "Sexo"],
    ["cpf", "CPF"], ["passaporte", "Passaporte"], ["identidade", "Cédula (estrangeiro)"], ["nacionalidade", "Nacionalidade"],
    ["email", "E-mail"], ["telefone", "Telefone"]];
  function tipoPelaIdade(nascimento) {
    const [d, m, a] = (nascimento || "").split("/").map(Number);
    if (!a) return "";
    const hoje = new Date(), anos = hoje.getFullYear() - a - ((hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) ? 1 : 0);
    return anos < 2 ? "INF" : anos < 12 ? "CHD" : "ADT";
  }

  function cartaoPax(p, i, usados) {
    const caixa = document.createElement("div");
    caixa.className = "pax";
    const avisos = [];
    if (!p.sexo) avisos.push(`<div class="erro">Sexo desconhecido: não deu para saber pelo nome. Escreva Masculino ou Feminino.</div>`);
    else if (p.sexo_origem === "nome") avisos.push(`<div class="atencao">Sexo deduzido pelo nome (${p.sexo}): confira.</div>`);
    const repetido = nomeRepetido(p);
    if (repetido.length) avisos.push(`<div class="atencao">"${repetido.join(" ").toUpperCase()}" está no nome e no sobrenome: separe certo antes de preencher.</div>`);
    caixa.innerHTML = `<h3>Passageiro ${i + 1}</h3>${avisos.join("")}<div class="grade"></div>
      <div class="linha">Preencher em <select></select><button class="acao" style="margin:0;flex:1">Preencher</button></div>
      <div class="res"></div>`;
    for (const [k, rotulo] of CAMPOS) {
      const l = document.createElement("label");
      const inp = document.createElement("input");
      inp.value = p[k] || ""; inp.dataset.k = k;
      l.append(rotulo, inp);
      caixa.querySelector(".grade").append(l);
    }
    const sel = caixa.querySelector("select");
    const lista = lugares();
    lista.forEach((l) => sel.append(new Option(nomeLugar(l), l.sufixo)));
    // Sugere o primeiro lugar livre do mesmo tipo (pelo "Tipo:" do pedido Bank ou pela idade).
    const tipo = ["ADT", "CHD", "INF"].includes(p.tipo) ? p.tipo : tipoPelaIdade(p.nascimento);
    const livre = lista.find((l) => l.tipo === tipo && !usados.has(l.sufixo)) || lista.find((l) => !usados.has(l.sufixo));
    if (livre) { sel.value = livre.sufixo; usados.add(livre.sufixo); }
    caixa.executar = async () => {
      const dados = Object.fromEntries([...caixa.querySelectorAll("input")].map((x) => [x.dataset.k, x.value.trim()]));
      dados.sexo_origem = dados.sexo === (p.sexo || "") ? p.sexo_origem : "digitado";
      // Um único e-mail (ou celular) entre todos os passageiros vale para quem veio sem; senão, o contato padrão
      // das opções da extensão (pedido Bank não traz contato).
      const padrao = await chrome.storage.local.get(["email_padrao", "telefone_padrao"]).catch(() => ({}));
      for (const k of ["email", "telefone"]) {
        const valores = [...new Set([...sombra.querySelectorAll(`.pax input[data-k=${k}]`)].map((x) => x.value.trim()).filter(Boolean))];
        const usar = valores.length === 1 ? valores[0] : !valores.length ? padrao[`${k}_padrao`] : "";
        if (!dados[k] && usar) {
          dados[k] = usar;
          caixa.querySelector(`input[data-k=${k}]`).value = usar;
        }
      }
      const res = caixa.querySelector(".res");
      const recusa = (texto) => { anotar(`  RECUSADO: ${texto}`); res.replaceChildren(aviso("erro", texto)); return false; };
      anotar(`Passageiro ${i + 1} -> ${sel.value}; veio: ${["nome", "sobrenome", "nascimento", "cpf", "passaporte", "identidade", "email", "telefone"]
        .map((k) => `${k} ${tem(dados[k])}`).join(", ")}; sexo "${dados.sexo || ""}"`);
      if (digitos(dados.cpf).length !== 11 && !dados.passaporte && !dados.identidade) {
        return recusa("Sem documento: mande o CPF (brasileiro) ou o passaporte/cédula (estrangeiro).");
      }
      const lugar = lugares().find((l) => l.sufixo === sel.value);
      if (!lugar) return recusa("Não achei esse passageiro na página. Recarregue a tela da LATAM e tente de novo.");
      const idade = tipoPelaIdade(dados.nascimento);
      if (idade && idade !== lugar.tipo) {
        res.replaceChildren(aviso("atencao", `Pela idade de hoje esta pessoa é ${NOMES_TIPO[idade]}, e o lugar é ${nomeLugar(lugar)}. A LATAM conta a idade na data do voo: confira.`));
      }
      try {
        const { falhas, confirmou } = await preencher(lugar, dados);
        if (falhas.length) return recusa(`Preenchi, mas NÃO confirmei. Confira: ${falhas.join(" · ")}`);
        res.replaceChildren(aviso("ok", confirmou ? `${nomeLugar(lugar)} preenchido e confirmado ("Confirmar dados").`
          : `${nomeLugar(lugar)} preenchido, mas não achei o "Confirmar dados": clique você.`));
        return confirmou;
      } catch (e) {
        anotar(`  EXCEÇÃO: ${e.message} | ${(e.stack || "").split("\n").slice(1, 3).join(" ").trim()}`);
        return recusa(e.message);
      }
    };
    caixa.querySelector("button").onclick = () => caixa.executar();
    return caixa;
  }

  // Mesmo CPF/documento em duas pessoas não existe: a LATAM recusa.
  function documentosRepetidos(lista) {
    const vistos = {};
    for (const p of lista) {
      const doc = digitos(p.cpf).length === 11 ? digitos(p.cpf) : alfanum(p.passaporte) || digitos(p.identidade);
      if (doc) (vistos[doc] ||= []).push(`${p.nome} ${p.sobrenome || ""}`.trim());
    }
    return Object.entries(vistos).filter(([, nomes]) => nomes.length > 1)
      .map(([doc, nomes]) => `O mesmo documento (${doc}) está em ${nomes.length} passageiros: ${nomes.join(", ")}.`);
  }

  $(".ler").onclick = async (ev) => {
    const botao = ev.currentTarget, saida = $(".saida");
    if (!fotos.length && !$("textarea").value.trim()) return saida.replaceChildren(aviso("erro", "Cole uma foto ou os dados."));
    botao.disabled = true; botao.textContent = "Lendo… (até 20 s)";
    try {
      // Texto simples ou pedido Bank: lê aqui mesmo, sem mandar nada ao Google.
      const local = !fotos.length ? lerTextoLocal($("textarea").value) : null;
      const r = local ? { passageiros: local }
        : await chrome.runtime.sendMessage({ tipo: "ler", texto: $("textarea").value, imagens: fotos });
      if (r?.erro) throw new Error(r.erro);
      const lista = r?.passageiros || [];
      if (!lista.length) return saida.replaceChildren(aviso("erro", "Não achei passageiros nos dados."));
      const repetidos = documentosRepetidos(lista);
      const usados = new Set();
      const caixas = lista.map((p, i) => cartaoPax(p, i, usados));
      const todos = document.createElement("button");
      todos.className = "acao"; todos.textContent = `Preencher todos (${lista.length}) e confirmar um por um`;
      if (repetidos.length) todos.disabled = true; // documento repetido: corrija antes
      // Um passageiro de cada vez; para no primeiro problema. No fim para: "Continuar" é sempre você.
      todos.onclick = async () => {
        todos.disabled = true;
        diario = [];
        const l = lugares();
        anotar(`Preenche Passageiros LATAM v${chrome.runtime.getManifest().version} | ${new Date().toLocaleDateString("pt-BR")}`);
        anotar(`Página: ${location.pathname} | Navegador: ${navigator.userAgent}`);
        anotar(`Passageiros lidos: ${caixas.length} | cartões na página: ${l.length} (${l.map((x) => x.sufixo).join(" ")})`);
        let feitos = 0;
        for (const c of caixas) {
          c.scrollIntoView({ block: "nearest" });
          if (!(await c.executar())) break;
          feitos++;
          await esperar(1000); // a LATAM abre o próximo cartão sozinha
        }
        anotar(feitos === caixas.length ? `FIM: ${feitos} passageiro(s) confirmados. Parei antes do "Continuar".`
          : `PAROU no passageiro ${feitos + 1} (${feitos} confirmados antes).`);
        const arquivo = baixarRegistro();
        diario = null;
        todos.disabled = false;
        const registro = document.createElement("p");
        registro.className = "nota";
        registro.textContent = `Registro salvo em Downloads: ${arquivo}. Se algo deu errado, mande esse arquivo (não tem dados pessoais).`;
        todos.after(registro);
        todos.textContent = feitos === caixas.length ? `Pronto: ${feitos} passageiro(s) confirmados. Confira e clique em "Continuar" você.`
          : `Parei no passageiro ${feitos + 1}: veja o aviso vermelho dele.`;
      };
      const origem = document.createElement("p");
      origem.className = "nota";
      origem.textContent = local ? "Lido aqui no navegador, sem IA (nada foi enviado ao Google)." : "Lido pelo Gemini.";
      saida.replaceChildren(origem, ...repetidos.map((t) => aviso("erro", t + " Corrija antes de preencher.")), todos, ...caixas);
    } catch (e) {
      saida.replaceChildren(aviso("erro", e.message));
    } finally {
      botao.disabled = false; botao.textContent = "Ler dados";
    }
  };
})();
