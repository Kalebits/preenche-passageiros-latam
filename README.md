# Preenche Passageiros LATAM

Numa emissão com cinco passageiros, a tela de passageiros da LATAM pede cinco vezes a mesma coisa: nome, sobrenome,
nascimento, sexo, CPF, e-mail e telefone. É digitação demorada, feita com o cliente esperando, e um erro pequeno não
fica barato: a LATAM não aceita acento nem ç, e um CPF trocado vira remarcação ou passageiro barrado.

A Preenche Passageiros LATAM faz essa digitação por você. Você cola os dados como chegaram, confere, e ela preenche os
cartões.

## O que você pode colar

O texto do jeito que chegou no atendimento, sem arrumar nada:

```
Ana Paula Souza
12/03/1985
CPF: 529.982.247-25

Bruno Lima, 111.444.777-35, 01/01/1990

ana@email.com
(82) 91234-5678
```

Uma pessoa por bloco ou por linha, com ou sem rótulos como `CPF:`. Um e-mail e um telefone soltos valem para todos.

O pedido do Bank também vai inteiro, do `🎫 PEDIDO` ao link de busca: a extensão pega só o bloco de passageiros e
respeita o `Nome:`, o `Sobrenome:`, o `Sexo:` e o `Tipo:` de cada um.

Texto e pedido do Bank são lidos ali mesmo, no seu navegador: nada sai do computador.

Também dá para colar **fotos de documento** (passaporte, RG, CNH, cédula estrangeira). Foto precisa de uma IA para ser
lida, e a extensão usa o **Gemini**, a IA do Google, com uma chave gratuita que cada pessoa cria para si. Só as fotos
(e textos que a extensão não consegue ler sozinha) vão para o Google.

## Como ela preenche

A tela de passageiros da LATAM tem um cartão por pessoa: Adulto 1, Adulto 2, Criança 1, Bebê 1. A extensão encaixa
cada passageiro no cartão do tipo dele e segue as mesmas regras que a equipe segue à mão:

| Campo | Regra |
|---|---|
| Nome e sobrenome | Sem acento e sem ç. Veio separado (documento, pedido do Bank): usa como está. Veio corrido: o primeiro nome no "Nome", o resto no "Sobrenome" |
| CPF | Só números. Criança e bebê repetem o CPF no "Nº de documento", que a LATAM pede para eles |
| Estrangeiro | Sem CPF: passaporte ou cédula no "Nº de documento". Nacionalidade e tipo de documento ficam para você escolher |
| Sexo | Do documento ou do pedido. Se não vier, pelo primeiro nome, com aviso para conferir. Nome que serve para os dois fica para você |
| E-mail e telefone | Obrigatórios. Um só informado vale para todos; sem nenhum, vale o contato padrão das opções |
| Documento repetido | O mesmo CPF em duas pessoas não existe: ela não deixa preencher |

Quando a mesma palavra aparece no nome e no sobrenome (`MARIA CLARA LIMA` / `LIMA`), ela avisa em amarelo:
na LATAM ficaria "LIMA LIMA".

## Até onde ela vai

Na tela de passageiros aparece um botão roxo, **Passageiros**, no canto de baixo. Ele abre o painel da extensão: você
cola o texto, o pedido ou as fotos e clica em **Ler dados**. Cada passageiro aparece para conferir, com aviso amarelo
no que vale olhar duas vezes e vermelho no que está faltando.

Depois, **Preencher todos** vai de passageiro em passageiro: abre o cartão, preenche e clica em **Confirmar dados**,
mas só quando tudo entrou e a LATAM não recusou nenhum campo. No primeiro problema ela para e mostra o que falta.
Quando acaba o último passageiro, ela para também.

**Continuar** ela nunca clica. Conferir a reserva inteira e seguir para o pagamento é sempre com você.

## Instalar

A extensão não está na loja do Chrome: você baixa daqui e o navegador carrega a pasta direto do seu computador.
Funciona no Chrome, Brave, Opera, Opera GX e Edge (no Firefox, não).

1. Nesta página, clique no botão verde **Code** → **Download ZIP**. Extraia o ZIP numa pasta fixa, por exemplo em
   Documentos, e não apague nem mova essa pasta depois: o navegador lê a extensão de lá.
2. Abra a página de extensões do navegador: `chrome://extensions`, `brave://extensions`, `opera://extensions` ou
   `edge://extensions`.
3. Ligue o **Modo do desenvolvedor** (chave no canto de cima; no Edge, no menu da esquerda). É ele que libera
   instalar extensões que não vieram da loja.
4. Clique em **Carregar sem compactação** e escolha a pasta extraída, a que tem o arquivo `manifest.json` dentro.

### As opções: chave do Gemini e contato padrão

Logo depois de instalar, abre a tela de opções. As duas coisas dela são opcionais.

A **chave do Gemini** só é necessária para ler fotos; sem ela, o texto e o pedido do Bank continuam funcionando.

1. Abra [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e entre com uma conta Google.
2. Clique em **Create API key** e copie a chave (um texto comprido que começa com `AIza` ou `AQ.`).
3. Cole na tela da extensão e clique em **Salvar**. Ela testa a chave e mostra "Chave salva e testada".

É grátis e não pede cartão. Cada pessoa usa a própria chave: não compartilhe a sua nem mande por chat.

O **contato padrão** é o e-mail e o telefone que vão quando o passageiro chega sem eles, como acontece nos pedidos do
Bank. Sem ele, a extensão preenche o resto e não confirma o passageiro.

### Versão nova

Baixe o ZIP de novo, troque os arquivos da pasta e clique na setinha de recarregar no cartão da extensão, na página de
extensões. O passo a passo completo, para mandar para quem for instalar, está em [COMO-INSTALAR.txt](COMO-INSTALAR.txt).

## Quando algo dá errado

Cada **Preencher todos** salva em Downloads um arquivo `preenche-passageiros-latam-registro-AAAA-MM-DD-HHMM.txt` com
o que a extensão tentou em cada campo. Ele não tem dados pessoais (os valores aparecem só como "preenchido" ou "sem
dado"): é esse arquivo que você manda para quem cuida da extensão.

## Privacidade (LGPD)

- **Texto simples e pedido do Bank:** processados só no seu navegador.
- **Fotos de documento:** vão para o Google Gemini com a sua chave. **No plano grátis, o Google pode usar o conteúdo
  enviado para melhorar os produtos dele** (no plano pago, não). Use só com a ciência de quem é dono dos dados.
- A chave e o contato padrão ficam só no seu navegador (`chrome.storage.local`). Nunca compartilhe a sua chave.
- A extensão só roda em `latamairlines.com` e só fala com `generativelanguage.googleapis.com`.
