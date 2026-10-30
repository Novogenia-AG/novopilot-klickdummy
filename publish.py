"""Kopiert den NovoPilot-Prototyp (Blau) nach index.html und ersetzt echte Personendaten durch Demo-Werte.
Aufruf: python publish.py  (danach commit + push)"""
import re
SRC = r"C:\Users\DanielWallerstorfer\Novogenia GmbH\DANIEL FILES - Dokumente\DANIEL FILES\AI CHAT BOT GENE-IUS\APP DESIGN\NOVOPILOT-REDESIGN\novopilot-geneius-v1-blau.html"
s = open(SRC, encoding='utf-8').read()
R = [
 ("'ForijZZ AlexandruZZ','forijalexandru@gmail.com'", "'Alexandra Berger','alexandra.berger@example.com'"),
 ("'Tony Dinozo','npdw2412.tony.dinozo@guest.novogenia.com'", "'Tobias Huber','tobias.huber@example.com'"),
 ("'Mladen Djukanovic','mladen.djukanovic+0108@novogenia.com'", "'Martina Steiner','martina.steiner@example.com'"),
 ("'QA Stage','cristian.cotoara+stagqa@mendelio.io'", "'Lukas Gruber','lukas.gruber@example.com'"),
 ("'Nick Wassermann','nick.wassermann+2008a@novogenia.com'", "'Nina Wagner','nina.wagner@example.com'"),
 ("'Nick Wassermann','nick.wassermann+teststag1808@novogenia.com'", "'Nina Wagner','nina.wagner2@example.com'"),
 ("'Nick Wassermann','nick.wassermann+408@novogenia.com'", "'Nina Wagner','n.wagner@example.com'"),
 ("daniel.wallerstorfer@novogenia.com", "partner@example.com"),
 ("<dd>Nick Wassermann</dd>", "<dd>John Doe</dd>"),
 ("0622524888219", "+43 662 000000"),
 ("+43 1784812770", "+43 660 0000000"),
 ("'QA stage regression'", "'NovoDaily Lifestyle+'"),
]
for a, b in R:
    assert a in s, a
    s = s.replace(a, b)
for a, b in [('ForijZZ AlexandruZZ', 'Alexandra Berger'), ('Tony Dinozo', 'Tobias Huber'), ('Mladen Djukanovic', 'Martina Steiner'),
             ('Nick Wassermann', 'Nina Wagner'), ('QA Stage', 'Lukas Gruber')]:
    s = s.replace(a, b)
s = s.replace('<title>[Blau] ', '<title>', 1)
left = set(re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}', s)) - {
    'np_ct_NPDW2412@email.com', 'np_ct_NPNG2883@email.com'}
assert all(e.endswith('@example.com') for e in left), left
assert not re.search(r'Wassermann|Djukanovic|Forij|Cotoara|Dinozo|wallerstorfer', s, re.I)
open('index.html', 'w', encoding='utf-8').write(s)
print('index.html geschrieben,', len(s), 'Zeichen')
