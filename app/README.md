# Sistema escolar OGB (`app/`)

Um app só, para todos os perfis, que roda no navegador e pode ser instalado no
computador (Chrome/Edge › "Instalar app") e no celular. Os professores digitam as
notas e o boletim é calculado na hora; a secretaria cuida de cadastros, simulados,
frequência da catraca e documentos; a tesouraria faz a matrícula.

> **Estado atual: versão de teste.** Ainda não há Firebase: os dados são de exemplo
> (fictícios) e ficam guardados só no navegador. Na tela de entrada, escolha um perfil.
> O visual é neutro de propósito: o design está sendo definido à parte e se troca
> mudando só `css/tokens.css`.

## Como abrir

```
cd app
python3 -m http.server 8080
```

e abra http://localhost:8080. No GitHub Pages fica em `/app/`.

## Testes

```
cd app
npm test
```

Não há dependências para instalar: os testes usam o `node --test` (Node 18+).

## Perfis

| Perfil | O que faz |
|---|---|
| Professor | Lança notas só das suas disciplinas e turmas; vê o boletim das suas turmas. |
| Secretaria | Cadastros, simulados, frequência, boletins e documentos. Vê as notas; corrige só com a permissão "corrige notas". |
| Tesouraria | Faz a matrícula (dados do aluno). Não vê notas, boletins nem frequência. |
| Coordenação | Vê tudo, sem alterar. |
| Direção | Vê tudo, sem alterar. |
| Administrador | Tudo, inclusive usuários, perfis e permissões. |

Uma pessoa pode ter mais de um perfil. Os acessos são definidos dentro do app
(Usuários e perfis), um a um ou pela planilha `modelos/modelo-usuarios.xlsx`.
O login será com a conta Google da escola (@colegioecursoogb.com.br), e só entra
quem estiver cadastrado. Toda alteração fica no histórico (quem, quando, antes e depois).

## Organização do código

```
src/
  regras/       cálculo do boletim (sem tela, sem banco) — curriculo.js, simulados.js, boletim.js
  modelo/       perfis e permissões (perfis.js) e coleções do banco (esquema.js)
  dados/        camada de dados: repositorio.js (contrato), memoria.js (agora), firebase.js (depois), exemplo.js
  servicos/     regras de negócio com permissão e histórico (sistema.js), catraca, importação de usuários
  documentos/   modelos de declarações, boletim, ficha e listas; texto por extenso e concordância
  ui/           telas (JS puro, sem build)
css/tokens.css  todas as cores, fontes e raios (trocar aqui para mudar o visual)
firebase/       rascunho das regras de segurança do Firestore
ferramentas/    geração da planilha modelo e da lista de arquivos offline (sw.js)
```

As telas só falam com `servicos/sistema.js`, que só fala com o repositório. Para ligar o
Firebase: criar o projeto, preencher `src/config.js` (`modo: 'firebase'` e a configuração)
e publicar `firebase/firestore.rules` depois de testar no emulador.

Ao criar ou apagar arquivos do app, rode `python3 ferramentas/gerar-sw.py` e aumente a
`VERSAO` em `sw.js`.

## Regras de cálculo

Seguem as planilhas da escola (análise em `analise-drive/regras-boletim.md` do projeto),
com os erros corrigidos e as decisões do Prof. Joallyson:

- Nota em branco não conta como zero; toda média vai até 10; o boletim mostra 1 casa.
- EF: Português = média(PP, PE, PT, VL, SO) nos 3 trimestres; demais = média(PP, PE, SO).
- 1ª/2ª série: Português = média(PE, SO, PT, VL); Arte = média(PE, SO, VL); demais = média(PE, SO); itinerários = média(AV1, AV2, AV3).
- 3ª série: Português = média(SP, SG, PT, VL) + SE; Arte = média(SP, SG, VL) + SE; demais = média(SP, SG) + SE. O SG dá uma nota por área.
- Simulado de 80 questões: 0→0, 1→2, 10→3, 20→5, 30→6, 40→7, 50→8, 66→9, 72→10. SG por área (40 questões): limites divididos por 2. SE: 20→+0,5, 35→+1, 50→+1,5, 64→+2.
- RO só vale com MPT < 7 e substitui a MPT se for maior. MPA = média das 3 MDT. Com MPA < 7 (6,95): MDA = 0,6·MPA + 0,4·PF.
- MG = média das MDA, com Ed. Física. Aprovado com MDA ≥ 5 em todas as disciplinas, inclusive Ed. Física e itinerários.

## Ainda falta

- Criar o Firebase e ligar o login Google (código pronto em `dados/firebase.js`, não testado).
- Receber o arquivo de exemplo da catraca para ajustar a leitura.
- Mandar os acertos do leitor de gabarito direto para os simulados.
- Históricos escolares e ata de resultados (faltam carga horária, assinaturas e o modelo da ata).
- Telefone do cabeçalho dos documentos.
