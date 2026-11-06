# Sistema OGB

Ferramentas do Colégio e Curso OGB.

## Leitor de Gabaritos (`leitor-gabarito/`)

App que roda no navegador do celular, sem instalar nada:

1. Importa turmas e alunos de uma planilha (colunas Turma, Número, Nome).
2. Cadastra simulados (SO, SP, SG, SE ou outro) e o gabarito, inclusive por cor de prova e com gabarito de Espanhol nas questões de língua estrangeira.
3. Imprime um cartão-resposta por aluno, no modelo do cartão do ENEM, com nome e QR code.
4. Corrige pela câmera (ou por foto): acha os 4 quadrados dos cantos, lê o QR code e as bolinhas marcadas.
5. Calcula acertos e nota pela tabela da escola (0 = 0; 1-9 = 2; 10-19 = 3; 20-29 = 5; 30-39 = 6; 40-49 = 7; 50-65 = 8; 66-71 = 9; 72 ou mais = 10), proporcional ao número de questões, e o bônus do SE. No Simulado Global da 3ª série cada metade da prova (40 questões) tem nota própria. Exporta a planilha final (.xlsx).

Os dados ficam guardados no próprio aparelho (localStorage). Use "Baixar cópia" na aba Alunos para fazer backup ou passar para outro aparelho. A câmera ao vivo só funciona em endereço https (por exemplo, GitHub Pages).

### Como gerar o `index.html`

O `leitor-gabarito/index.html` é um arquivo único, com as bibliotecas embutidas, que funciona sem internet. Depois de mudar algo em `leitor-gabarito/src/`:

```
cd leitor-gabarito
npm install
python3 build.py node_modules
```

Arquivos em `src/`:

- `layout.js`: medidas da folha (em mm), usadas para desenhar e para ler.
- `folha.js`: desenha o cartão-resposta (SVG).
- `leitor.js`: lê a foto (marcadores, QR code, bolinhas).
- `notas.js`: tabelas de nota e correção.
- `app.js` e `app.html`: telas do app. O objeto `Dados` em `app.js` é o ponto para ligar o app a um servidor (app de notas ou sistema da escola).
