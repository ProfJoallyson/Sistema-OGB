"""Gera modelos/modelo-usuarios.xlsx: a planilha que a escola preenche para subir
usuários, perfis e as aulas de cada professor. Uso: python3 ferramentas/gerar-modelo-usuarios.py"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.worksheet.datavalidation import DataValidation

AZUL = PatternFill('solid', fgColor='2B3192')
CINZA = PatternFill('solid', fgColor='EEF0F4')
BRANCO = Font(bold=True, color='FFFFFF')
DOMINIO = 'colegioecursoogb.com.br'
PERFIS = ['Professor', 'Secretaria', 'Tesouraria', 'Coordenação', 'Direção', 'Administrador']
TURMAS = ['6º Ano A', '6º Ano B', '7º Ano U', '8º Ano U', '9º Ano A', '9º Ano B', '1ª Série U', '2ª Série A', '2ª Série B', '3ª Série U']
DISCIPLINAS = ['Língua Portuguesa', 'Língua Inglesa', 'Língua Espanhola', 'Ensino Religioso', 'História', 'Geografia',
               'Sociologia', 'Filosofia', 'Matemática', 'Ciências', 'Física', 'Química', 'Biologia', 'Arte', 'Educação Física',
               'Projeto de Vida', 'Ciência e Saúde', 'Educação Financeira', 'Sustentabilidade', 'Trabalho',
               'Desenvolvimento Sustentável', 'Interpretação de Texto', 'Matemática do Cotidiano', 'Política',
               'Aprofundamento em Matemática', 'Aprofundamento em Produção Textual']

wb = Workbook()
ins = wb.active
ins.title = 'Instruções'
textos = [
    ('Como preencher', True),
    ('1. Aba "Pessoas": uma linha por pessoa que vai entrar no sistema.', False),
    (f'   • E-mail: a conta Google da escola (termina em @{DOMINIO}).', False),
    ('   • Perfis: escolha na lista. Se a pessoa tiver mais de um, escreva separado por vírgula (ex.: "Professor, Coordenação").', False),
    ('   • Pode corrigir notas: "Sim" só para quem é da Secretaria e pode corrigir notas dos professores.', False),
    ('2. Aba "Aulas": uma linha para cada disciplina que o professor dá.', False),
    ('   • Turma: escolha na lista. Para várias turmas da mesma disciplina, separe por vírgula (ex.: "6º Ano A, 6º Ano B").', False),
    ('   • Cada disciplina de uma turma tem um professor só.', False),
    ('3. Apague as linhas de EXEMPLO antes de subir.', False),
    ('4. No sistema: Usuários e perfis › Subir pela planilha. O sistema mostra os erros antes de gravar.', False),
    ('', False),
    ('O que cada perfil faz', True),
    ('Professor: lança notas só das suas disciplinas e turmas e vê o boletim das suas turmas.', False),
    ('Secretaria: cadastros, simulados, frequência, boletins e documentos. Vê as notas; corrige só com "Pode corrigir notas".', False),
    ('Tesouraria: faz a matrícula (dados do aluno). Não vê notas, boletins nem frequência.', False),
    ('Coordenação e Direção: veem tudo (notas, boletins, frequência, cadastros e histórico), sem alterar.', False),
    ('Administrador: tudo, inclusive usuários, perfis e permissões.', False),
]
for i, (t, negrito) in enumerate(textos, 1):
    c = ins.cell(row=i, column=1, value=t)
    if negrito:
        c.font = Font(bold=True, size=13, color='2B3192')
ins.column_dimensions['A'].width = 120

def cabecalho(ws, nomes, larguras):
    for j, (n, w) in enumerate(zip(nomes, larguras), 1):
        c = ws.cell(row=1, column=j, value=n)
        c.font, c.fill, c.alignment = BRANCO, AZUL, Alignment(vertical='center')
        ws.column_dimensions[c.column_letter].width = w
    ws.freeze_panes = 'A2'
    ws.row_dimensions[1].height = 22

pes = wb.create_sheet('Pessoas')
cabecalho(pes, ['Nome', 'E-mail', 'Perfis', 'Pode corrigir notas'], [36, 40, 30, 20])
exemplos = [
    ('EXEMPLO Maria da Silva', f'maria.silva@{DOMINIO}', 'Professor', 'Não'),
    ('EXEMPLO João Souza', f'joao.souza@{DOMINIO}', 'Professor, Coordenação', 'Não'),
    ('EXEMPLO Ana Lima', f'ana.lima@{DOMINIO}', 'Secretaria', 'Sim'),
    ('EXEMPLO Pedro Rocha', f'tesouraria@{DOMINIO}', 'Tesouraria', 'Não'),
    ('EXEMPLO Direção', f'direcao@{DOMINIO}', 'Direção', 'Não'),
]
for i, l in enumerate(exemplos, 2):
    for j, v in enumerate(l, 1):
        pes.cell(row=i, column=j, value=v).fill = CINZA

aul = wb.create_sheet('Aulas')
cabecalho(aul, ['E-mail do professor', 'Turma', 'Disciplina'], [40, 34, 34])
for i, l in enumerate([
    (f'maria.silva@{DOMINIO}', '6º Ano A, 6º Ano B', 'Língua Portuguesa'),
    (f'maria.silva@{DOMINIO}', '7º Ano U', 'Língua Portuguesa'),
    (f'joao.souza@{DOMINIO}', '1ª Série U', 'Matemática'),
], 2):
    for j, v in enumerate(l, 1):
        aul.cell(row=i, column=j, value=v).fill = CINZA

lis = wb.create_sheet('Listas')
for j, (titulo, itens) in enumerate([('Perfis', PERFIS), ('Turmas 2026', TURMAS), ('Disciplinas', DISCIPLINAS), ('Sim/Não', ['Sim', 'Não'])], 1):
    lis.cell(row=1, column=j, value=titulo).font = Font(bold=True)
    for i, v in enumerate(itens, 2):
        lis.cell(row=i, column=j, value=v)
    lis.column_dimensions[lis.cell(row=1, column=j).column_letter].width = 34

def lista(ws, col, ref, livre):
    dv = DataValidation(type='list', formula1=ref, allow_blank=True, showErrorMessage=not livre)
    ws.add_data_validation(dv)
    dv.add(f'{col}2:{col}500')

lista(pes, 'C', f"=Listas!$A$2:$A${1 + len(PERFIS)}", True)  # livre: aceita "Professor, Coordenação"
lista(pes, 'D', '=Listas!$D$2:$D$3', False)
lista(aul, 'B', f"=Listas!$B$2:$B${1 + len(TURMAS)}", True)  # livre: várias turmas separadas por vírgula
lista(aul, 'C', f"=Listas!$C$2:$C${1 + len(DISCIPLINAS)}", False)

wb.active = 1
wb.save('modelos/modelo-usuarios.xlsx')
print('ok')
