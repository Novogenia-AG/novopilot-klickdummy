"""Kopiert den NovoPilot-Prototyp (Blau) nach index.html und ersetzt echte Personendaten durch Demo-Werte.
Aufruf: python publish.py  (danach commit + push)

Die Ersetzungsliste (echte Namen und Kontaktdaten) liegt NICHT im Repo, sondern neben der Quelldatei:
publish-ersetzungen.json im Projektordner (SharePoint). Nie ins Repo kopieren.
"""
import json
import os
import re
import shutil

DIR = r"C:\Users\DanielWallerstorfer\Novogenia GmbH\DANIEL FILES - Dokumente\DANIEL FILES\AI CHAT BOT GENE-IUS\APP DESIGN\NOVOPILOT-REDESIGN"
SRC = os.path.join(DIR, 'novopilot-geneius-v1-blau.html')
CFG = json.load(open(os.path.join(DIR, 'publish-ersetzungen.json'), encoding='utf-8'))

s = open(SRC, encoding='utf-8').read()
for a, b in CFG['ersetzungen']:
    assert a in s, 'Ersetzung nicht gefunden (publish-ersetzungen.json pruefen)'
    s = s.replace(a, b)
for a, b in CFG['namen']:
    s = s.replace(a, b)
s = s.replace('<title>[Blau] ', '<title>', 1)

left = set(re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}', s)) - set(CFG['erlaubte_mails'])
assert all(e.endswith('@example.com') for e in left), 'echte E-Mail-Adresse uebrig'
assert not re.search(CFG['verboten'], s, re.I), 'echter Name uebrig'
open('index.html', 'w', encoding='utf-8').write(s)
print('index.html geschrieben,', len(s), 'Zeichen')

# Produktberater-Seite (Empfaenger-Link aus dem Shop-Bereich) mitkopieren
shutil.copyfile(os.path.join(DIR, 'berater.html'), 'berater.html')
b = open('berater.html', encoding='utf-8').read()
assert not re.search(CFG['verboten_berater'], b, re.I), 'echter Name in berater.html'
print('berater.html kopiert,', len(b), 'Zeichen')
