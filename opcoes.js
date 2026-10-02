const estado = document.querySelector("#estado");
const mostrar = (texto, bom) => { estado.textContent = texto; estado.className = bom ? "ok" : "ruim"; };
chrome.storage.local.get("chave").then(({ chave }) => chave && mostrar("Chave salva ✓", true));

document.querySelector("#salvar").onclick = async () => {
  const campo = document.querySelector("#chave");
  const chave = campo.value.trim();
  if (!/^[A-Za-z0-9_.-]{20,}$/.test(chave)) return mostrar("Isso não parece uma chave do Gemini. Copie de novo.", false);
  mostrar("Testando a chave…", true);
  // Confere a chave de verdade (lista os modelos: não gasta leitura).
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: { "x-goog-api-key": chave } })
    .catch(() => null);
  if (!r || !r.ok) return mostrar(r ? "O Google recusou essa chave. Copie de novo." : "Sem internet para testar a chave.", false);
  await chrome.storage.local.set({ chave });
  campo.value = ""; // a chave não fica na tela
  mostrar("Chave salva e testada ✓", true);
};

// Contato padrão: usado só quando o passageiro vier sem e-mail ou sem telefone.
chrome.storage.local.get(["email_padrao", "telefone_padrao"]).then(({ email_padrao, telefone_padrao }) => {
  document.querySelector("#email-padrao").value = email_padrao || "";
  document.querySelector("#telefone-padrao").value = telefone_padrao || "";
});
document.querySelector("#salvar-contato").onclick = async () => {
  const email = document.querySelector("#email-padrao").value.trim();
  const telefone = document.querySelector("#telefone-padrao").value.trim();
  const estado = document.querySelector("#estado-contato");
  if (email && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) { estado.textContent = "E-mail inválido."; estado.className = "ruim"; return; }
  await chrome.storage.local.set({ email_padrao: email, telefone_padrao: telefone });
  estado.textContent = email || telefone ? "Contato salvo ✓" : "Contato apagado ✓";
  estado.className = "ok";
};
