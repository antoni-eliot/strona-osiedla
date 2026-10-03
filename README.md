# strona-osiedla

Animacja intro + logowanie + tablica wiadomości.

## Uruchom lokalnie w WSL (localhost + API + wysyłka maili)
```bash
# wymaga Node 18+
sudo apt install nodejs   # jeżeli brak
npm start                # = node server.js
# otwórz http://localhost:3000
```
`server.js` uruchamia te same funkcje `api/*` co Vercel i czyta `RESEND_TOKEN` z `.env` - e-maile działają lokalnie.

### Trwałość danych (wersja lokalna)
Dane (konta, wiadomości, koncerty, ogłoszenia, zdjęcia osiedla, wyniki gier) są zapisywane na **dwa sposoby**:
- `localStorage` (przeglądarka) - dane działają od razu, także bez serwera
- `data.json` (dysk, przez `server.js`) - serwer jest nadrzędnym źródłem: `GET /api/data` pobiera dane przy starcie klienta, `POST /api/data` zapisuje każdą zmianę

Dzięki temu dane przetrwają restart serwera i są współdzielone między przeglądarkami. Plik `data.json` jest dodany do `.gitignore`.

⚠️ Na Vercel (serverless, tylko-do-odczytu dysk) dane pozostają w `localStorage` przeglądarki lub w pamięci jednej instancji (`api/data.js`). Do prawdziwej trwałości na produkcji podłącz Vercel KV / Redis / bazę danych.

## Vercel
```bash
npx vercel
npx vercel --prod
```
Lokalnie test z `vercel dev` wymaga `vercel.json` (już dodany).

## Aktywacja konta e-mailem (link aktywacyjny)
- Rejestracja zapisuje konto jako NIEAKTYWNE i wysyła na e-mail link aktywacyjny
- Konto działa po kliknięciu linku (`?activate=TOKEN` na stronie)
- Tylko aktywne konto może się zalogować (e-mail + hasło)
- API: `api/send-activation.js` i `api/activate.js`

### Tryb demo (bez maila)
Działa od razu - link aktywacyjny widoczny na ekranie i w console.log, fallback gdy brak tokenu Resend.
⚠️ Otwieranie `index.html` bezpośrednio z dysku (`file://`) NIE wysyła maili - funkcje API nie działają bez serwera. Użyj `npm start`, `npx vercel dev` albo deploy na Vercel.

### Tryb produkcyjny (Vercel + Resend)
1. Załóż konto https://resend.com
2. W Vercel > Settings > Environment Variables dodaj:
   - `RESEND_TOKEN` = `re_xxx` (skopiuj z twojego `.env`)
   - `FROM_EMAIL` = `noreply@twoja-domena.pl` (zweryfikowana domena)
   - `SITE_URL` = `https://twoja-strona.vercel.app`
   - `ADMIN_PASSWORD` = hasło admina
3. Deploy: `vercel --prod` lub push na GitHub

Uwaga: konta zapisywane są w przeglądarce (localStorage), więc aktywacja działa, gdy link klikniesz w tej samej przeglądarce, w której zarejestrowałeś konto.

## Gry (zakładka 🎮)
- **🐸 Żabka** — Frogger osiedlowy na **przewijanych, dużych stawach**: kamera podąża za żabą, skok po lilach (maks. 3 liście), jedzenie na liściach, wskakiwanie na innych graczy, znaki STOP na granicy stawu i bramka z metą na górnym brzegu
- 🦘 Gra skokowa, 🧩 Labirynt, 🎨 Pixel Paint

### Żabka — zasady
- Po otwarciu gry automatycznie pojawia się **menu główne**: wybór skina, **zmiana nicku** i **wybór mapy**
- `▶️ START` stawia gracza **na dolnym brzegu**, tuż pod siatką lil
- **Staw jest większy niż ekran** — kamera płynnie podąża za żabą, a **minimapa** w prawym górnym rogu pokazuje cały świat i białą ramką bieżący wycinek (klik w minimapę nie wywołuje skoku)
- **Skok tylko na odległość 3 liści** — najechanie myszą podświetla liście w zasięgu i rysuje **kropki toru lotu**, klik wykonuje skok
- **Meta na górnym brzegu** — wejście do niej w **bramce** (3 środkowe kolumny górnego wiersza) kończy poziom; kolejny poziom ma **nowy układ dziur**, a wynik dostaje premię
- **Jedzenie zjada się dopiero po wylądowaniu** na lilii, na której leży
- **Wskoczenie na gracza go zabija** — upuszcza wtedy całe swoje jedzenie na okoliczne liście
- **Znaki STOP** stoją na liściach na granicy stawu — kto tam wyląduje, wraca do menu głównego gry (brzeg dolny i meta to nie STOP)
- **Po śmierci** pojawia się ekran z powodem i statystykami, a gracz **sam wraca do menu głównego po 3 s** (można też kliknąć przycisk od razu)
- `Esc` wraca do menu, długi dziennik zdarzeń pokazuje co się dzieje na stawie
- Gra ma **własny przycisk pełnego ekranu** (cała karta gry, nie cała zakładka)

### Widok 2D / 3D (Mode 7)
- Przyciski **`2D` / `3D`** nad stawem (albo skrót **`V`**) przełączają kamerę; wybór zapamiętuje się prywatnie w `localStorage` (`osiedle_frog_view3d`)
- **2D** (domyślnie) — zwykły widok z góry, najłatwiejszy do klikania i zrzutów
- **3D** — kamera jedzie **za żabą** i patrzy w głąb stawu: rzędy lil są **płaskie i szerokie**, im dalej tym mniejsze, a dno wody tworzy **trapez** dociekający do horyzontu
- **Horyzont w 3D** — ląd sięga 90 jednostek świata za górną krawędź stawu, a dalej jest **niebo** z ciemną **linią zieleni** przy horyzoncie; grubość bocznych brzegów widać z góry jako wąski pas
- W 3D **wszystko działa tak samo**: zasięg 3 liści, kropki toru lotu, jedzenie, wskakiwanie na graczy, znaki STOP, meta i bramka; przełącznik widoku jest dostępny także w trakcie gry
- **Dalekie lilie** rysowane są jako plamki, ale **znaki STOP zostają czerwone**, a **dziury ciemne** — granica stawu i dziury muszą być czytelne także z daleka
- **Minimapa zostaje płaska 2D** w prawym górnym rogu, a jej biała ramka pokazuje pole widzenia kamery — w 2D prostokąt, w 3D **trapez**; kliknięcie w minimapę nadal nie skacze
- W menu 3D kamera celuje w **środek stawu** (żaba nie jest w centrum kadru), więc menu wygląda jak podgląd całego akwarium

### Mapy stawu
W menu gry jest **wybór mapy** — kliknij miniaturę, a staw zmienia się od razu (także w trakcie gry). Wybór zapisuje się prywatnie w `osiedle_frog_map`.
Wszystkie mapy mają ten sam limit skoku (**3 liście**), więc znajomość zasad przenosi się między nimi, ale **różny rozmiar świata** i własny układ. Różnią się:
- rozmiarem planszy (liczba kolumn × wierszy lil) — każdy staw jest szerszy i wyższy niż okno gry,
- paletą wody, brzegu i lil (każda mapa ma własne kolory),
- **dziurami wśród lil** — to po prostu woda, nie da się tam wylądować ani wskoczyć (klik daje odmowę); układ jest losowany, ale **deterministyczny dla pary mapa + poziom**,
- liczbą jedzenia i liczbą botów,
- opisem widocznym pod listą map.

| Mapa | Plansza | Wzór dziur | Jedzenia | Botów |
|---|---|---|---|---|
| 🪷 Staw osiedlowy (domyślna) | 14×20 | brak | 16 | 3 |
| 🌫️ Mroczne bagno | 16×24 | rozproszone | 18 | 4 |
| 🍂 Złota sadzawka | 18×26 | przekątne | 22 | 3 |
| ❄️ Mroźna tafla | 20×30 | rozproszone | 12 | 5 |
| 🧩 Labirynt lil | 18×28 | labirynt | 16 | 4 |

Generator dziur pilnuje, żeby **każdy układ dało się przejść** — od bramki na górze do brzegu na dole zawsze istnieje trasa zgodna z limitem 3 liści.
Dziury to woda, więc **nie da się na nich wylądować** — nie są celem skoku, nie pojawia się na nich jedzenie i boty ich unikają.

### Dźwięki żabki
Efekty są **syntezowane w WebAudio** (nie ma plików `.mp3`/`.wav`) i grają niezależnie od muzyki w tle:
- 🔊 przycisk **Dźwięk** wycisza/włącza efekty; ustawienie zapisuje się prywatnie w `localStorage` (`osiedle_frog_sfx`)
- **Kliknięcie żaby** (`hop`) — rytmiczny „skok" z krótkim wzniosem tonu; kolejne skoki brzmią **coraz wyżej** (rosnące półtony, aż do 8)
- **Śmierć** (`death`) — długi (0,8 s) opadający ton z wibracją; wariant `stop` (wyższy, „zgrzytliwy") odtwarza lądowanie na znaku STOP
- dodatkowo: stuknięcie przy lądowaniu, zjedzenie jedzenia, zabicie gracza, sygnał odrzucenia skoku za daleko i fanfara na START

### Prywatny edytor skinów żabki
Menu główne gry → **🎨 Edytor skinów prywatnych**:
- budowa skina z nazwy, emotki, koloru i akcentu
- **wgrywanie własnego obrazka** (`input type=file`, skalowany do 96×96)
- zapis, edycja, usuwanie, „Użyj" w rozgrywce
- **📤 Eksport kodem** (base64) i **📥 Wczytaj kod** — przeniesienie skina na inny sprzęt

Skiny prywatne i nick są zapisywane **tylko w `localStorage`** (klucze `osiedle_frog_skins_private`, `osiedle_frog_skin`, `osiedle_frog_nick`) i celowo **nie należą do `SYNC_KEYS`**, więc nie trafiają na serwer ani do `data.json` — pozostają prywatne dla tej przeglądarki.

### Edytor własnych stawów
Menu główne gry → **🪷 Edytor stawu** (albo ✏️ przy własnej miniaturze). Układ siatki to jeden napis znaków, po jednym na komórkę: `p` lilia, `w` woda/dziura, `s` STOP.

Narzędzia malowania:
- 🌿 **Lilia** i 💧 **Dziura** — malowanie w komórkach siatki (przeciągnij myszą, działa też dotyk),
- ⛔ **STOP** — liście, na których lądowanie kończy powrotem do menu,
- 🐸 **Start** — punkty pojawiania się na dolnym brzegu (można kilka; gracz i boty rozchodzą się po nich),
- 🏁 **Meta** — kolumny bramki w górnym wierszu.

Wiersz 0 zawsze pozostaje **ścianą**: wchodzi się na metę wyłącznie w kolumnach zaznaczonych narzędziem 🏁, więc meta zawsze ma dokąd płynąć. Wiersza 0 nie da się zamalować — edytor go nie rusza.

Ustawienia mapy:
| Opcja | Co robi |
|---|---|
| **Kolumny / wiersze** | 6–30 × 8–40; stary ukód przenosi się w narożnik, reszta dostaje lilię |
| **Kolor lilii** | jeden kolor, z którego wyprowadzamy dwa odcienie używane przez rysowanie |
| **Jedzenie** | 0–200 % — 100 % = tyle, ile da średnia mapa; wpływa na liczbę sztuk na starcie i na tempo pojawiania się (0 % = suchy staw) |
| **Boty** | 0–7 sztuk, z własnymi nickami (puste pola dostają domyślne) |
| **Tryb wyścigów** | start na trójce, liczy się pierwszy na mecie, `R` powtarza wyścig |

Przyciski **🌿 Wszystkie lilie / 💧 Cała woda / 🎲 Losowo** wypełniają siatkę hurtowo. **💾 Zapisz** zapisuje mapę prywatnie w `localStorage` (klucz `osiedle_frog_maps_private`, maks. 24 mapy), a **💾 Zapisz i graj** robi to samo, tylko od razu zamyka edytor (zajmuje cały ekran) i wpuszcza na ten staw — inaczej zapisana mapa zostaje niewidoczna. **🆕 Nowa** wstawia do edytora czystą siatkę. **📤 Kod / 📥 Wklej kod** przenosi mapę na inny sprzęt (base64 z JSON).

Edytor pilnuje jednej rzeczy, której nie widać na oku: przy zapisie sprawdza przejście od punktów startowych do mety dokładnie tymi samymi skokami, jakie obowiązują w grze (odległość ≤ 3 liści, po Euklidesie). Jeśli staw jest nieprzechodni, dostaniesz ostrzeżenie **⚠️ Nie ma drogi do mety!** — mapa i tak się zapisuje, bo w trakcie malowania nieprzechodni układ bywa normalny. Przy **Zapisz i graj** gra nie startuje wtedy wcale, tylko wraca do menu z tym samym ostrzeżeniem — na nieprzechodnim stawie nie ma co wskazywać.

Własne mapy, tak jak skiny, **zostają w tej przeglądarce** i nie należą do `SYNC_KEYS`. Do wspólnego stawu trafiają dopiero jako konfiguracja pokoju (patrz niżej).

### 🏞️ Wspólny staw (multiplayer)
Menu główne gry → **🏞️ Wspólny staw**. Multiplayer działa **tylko w grze Żabka**.

- **🏞️ Załóż staw** — dostajesz 4-znakowy kod i zostajesz **właścicielem** stawu,
- **🚣 Dołącz** — wpisujesz kod kolegi (albo otwierasz link z zaproszeniem `?frog=KOD`, który podpowiada kod w polu),
- **📋 Zaproś** — kopiuje do schowka link z kodem,
- staw mieści **8 graczy**; po nim chodzą też **boty właściciela** (0–7, z edytora).

**Właściciel** decyduje: mapa stawu (wbudowana albo jego własna), ustawienia jedzenia i botów, tryb wyścigów. Goście dostają tę samą mapę i widzą tę samą grę. Właściciel **nie da się zbanować** (serwer to odrzuca).

**Ban** — tylko właściciel widi przyciski 🚫 przy nicku, tylko on może zbanować lub przywrócić gracza. Sprawdza to **serwer**: każdy członek pokoju dostaje własny token przy dołączeniu, a zmiana ustawień, ban i zamknięcie stawu wymagają tokenu właściciela. Gość z tokenem gościa dostanie `403`. Blokada trzymana jest po identyfikatorze gracza i po nicku — to blokada kulturalna, nie kryptograficzna, bo logowanie w tym osiedlu jest fikcyjne (każdy wpisuje nick, jaki chce).

Jak to działa technicznie: Vercel nie daje WebSocketów, a serwerless nie ma sesji, więc **staw prowadzi właściciel**. On w każdej klatce liczy całą symulację (swoją żabę, boty i żaby gości) i wypycha na serwer gotowy obrazek co ~0,35 s (`push`); goście pytają o ten sam obrazek co ~0,4 s (`state`) i wysyłają **tylko intencję skoku** (`cmd`), którą właściciel wykonuje i sprawdza u siebie (`frogReachable`). Dzięki temu serwer nie musi znać zasad gry, a wszyscy widzą to samo.

Ograniczenia, o których warto wiedzieć:
- **Jeśli właściciel zamknie kartę, staw zamiera** — goście widzą nieruchomy staw, aż sam wyjdzie albo pokój zniknie po 2 godzinach bez akcji (`ROOM_TTL_MS`).
- Na Vercel pokoje leżą **w pamięci jednej instancji** (tak jak `api/data.js`), więc znikają po restarcie, a dwie równoległe instancje ich nie widzą. Lokalnie `server.js` zapisuje je trwale do **`rooms.json`**.
- Ruch gościa jest **przesyłany jako intencja**, więc przy słabym połączeniu skoki mogą się lekko opóźniać (~0,4 s).

### Pliki i endpointy multiplayer
| Plik | Rola |
|---|---|
| `api/frog-room.js` | logika pokojów: `create`, `join`, `state`, `cmd`, `push`, `config`, `ban`, `start`, `close`; autoryzacja tokenem, sprzątanie starych pokojów |
| `server.js` | lokalnie podpina trwały magazyn `rooms.json` przez `setFrogRoomStore()` i wystawia trasę `/api/frog-room` |
| `index.html` | warstwa klienta: `frogNet*` (odpyty, wypychanie, intencje), `frogPeers` (żaby gości), `frogRenderPond()` (lista graczy i bany) |

Identyfikator gracza (`osiedle_frog_pid`) trzymany jest w `localStorage`, żeby po odświeżeniu strony wejść do tego samego stawu tym samym tokenem, a nie jako nowy gość. Serwer odrzuca mapę, gdy siatka nie zgadza się z rozmiarem, jest za duża albo zawiera niedozwolone znaki, i przycina liczbę graczy, botów i kolejek skoków.


## 🧱 Spike Prime — programowanie modelu blokami

Zakładka **🎮 → Spike Prime**. Budujesz model z elementów LEGO, programujesz go
klocki (jak w Scratchu) i od razu widzisz, co robi na arenie. Wszystko działa
na jednej stronie — bez backendu.

### Model
- **11 elementów** do podpięcia w **5 portach (A–E)**: silnik duży 🛞, silnik średni ⚙️, przekładnia zębatata 🦷, czujnik odległości 📡, czujnik koloru 🎨, czujnik siły 💥, czujnik dotyku 👆, lampka LED 💡, przycisk 🔘, głośnik 🔊, czujnik światła ☀️
- Silnik na **porcie A lub B** napędza koło — robot z dwoma takimi silnikami skręca różnicowo (taniec tankowy)
- Elementy zaklada się i zdejmuje kliknięciem w port; model jest zapisywany w `localStorage` (`osiedle_spike_model`)

### Klocki
- Kategorie: **Zdarzenia**, **Silniki**, **Światło i dźwięk**, **Czujniki**, **Kontrola**, **Operatory**
- **Czapki** (zdarzenia): Zielona flaga 🟢, przycisk huba, odległość `< N cm`, kolor, ciemność, siła, komunikat
- **Klocki C**: Powtórz, Powtarzaj w nieskończoność, Jeżeli / Jeżeli–w przeciwnym razie, Dopóki
- **Operatory** `+ − × ÷`, `porównania`, `i / lub / nie`, losowo — **gniazda matematyczne przyjmują reportery**, więc da się ułożyć `odległość < 20`
- Gniazda okrągłe (reportersy i warunki) przyjmują się w gniazdach innych klocków; **puste gniazdo matematyczne to pole z liczbą**
- Klocki przeciąga się myszą z palety do warsztatu; wskazują się w pionie, wsuwają w jamy klocków C i w gniazda. **Prawy przycisk kasuje klocek**
- **Trzymany klocker podąża za kursorem** — kopia z widoczną aktualną wartością pól, więc widać co się przenosi (tak jak w Scratchu). Miejsce upuszczenia od razu się podświetla
- Program jest zapisywany w `localStorage` (`osiedle_spike_scripts`)

### Arena i symulacja
- Arena **180 × 140 cm** z siatką co 20 cm; robot jedzie po różnych nawierzchniach (biały, kolorowe, ciemne — czujnik koloru i jasności to odczytują)
- `▶️ Uruchom` / `⏹️ Zatrzymaj` / `🔄 Resetuj` / `🧹 Wyczyść` / `✨ Przykład`
- **Przyciski huba są klikalne** — tak samo jak w programie (`przycisk huba`)
- HUD pokazuje na żywo: pozycję, odległość, kolor, jasność, siłę, obroty kół i stan portów
- **Tryb edycji areny** (`🗺`) pozwala zaznaczać i usuwać ściany, po których robot się zatrzymuje
- `✨ Przykład` wczytuje dwa programy: **kwadrat** (ustaw moc → 4 × jedź i skręć 90° → światło i uśmiech) oraz **obserwator** (gdy przeszkoda bliżej niż 26 cm — cofnij i zapal czerwone)

### Uruchomienie testów
```bash
npm install     # tylko do testów (jsdom)
npm test
```
Trzy pliki, 89 asercji, wszystkie na prawdziwym `index.html` w jsdom:

| Plik | Co pilnuje |
|---|---|
| `test/boot.test.mjs` | strona wstaje **także bez `localStorage`** (tryb prywatny, sandbox, `file://`) — wyjątek przy starcie zabijał cały skrypt |
| `test/spike.test.mjs` | interpreter klocków, napęd różnicowy (dwa koła vs jedno), **duch przeciąganego klocka**, trwałość modelu i skryptów, tekstury klocków |
| `test/handlers.test.mjs` | każdy handler `onclick`/`oninput` wskazuje na istniejącą funkcję — chroni przed literówką, która wycisza przycisk |

### Wygląd klocków
Klocki nie są płaskim kolorem — każdy dostaje gradient z trzech odcieni kategorii,
fazowane krawędzie (światło u góry, cień u dołu), **wypustki LEGO** wzdłuż górnej
krawędzi i pochyły połysk plastiku ABS. Reportery i warunki to gładkie płytki bez
wypustków. Wartości liczbowe są wtopione w klocek, a puste gniazdo wygląda jak
wydrążenie. Kolor kategorii siedzi w zmiennych `--c1/--c2/--c3`, więc nowy klocek
nie wymaga osobnych reguł tła.
