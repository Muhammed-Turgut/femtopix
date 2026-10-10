# ivec draw — Proje Dokümanı

Gömülü sistem ekranları (OLED / TFT / e-paper) için masaüstü tasarım aracı.
Lopaka'nın gömülü kod üretimi + Figma'nın editör deneyimi. Linux ve Windows, tamamen offline.

---

## 1. Ürün özeti

| Konu | Karar |
|---|---|
| Hedef kullanıcı | Arduino / ESP32 / STM32 / Flipper Zero geliştiricileri |
| Platform | Linux (AppImage, deb, rpm), Windows (NSIS kurulum, portable exe) |
| Çalışma modeli | Tamamen yerel; hesap yok, plan/limit yok, internet gerekmez |
| Temel akış | Cihaz seç → ekran(lar) tasarla → görsel/ikon ekle → kodu kopyala veya klasöre export et |
| Fark yaratan özellikler | Bileşen sistemi, snapping/hizalama, TTF→bitmap font, klasöre export, piksel-doğru cihaz önizlemesi, light/dark tema |

---

## 2. Teknoloji yığını

### 2.0 Sıfırdan mı, fork mu? → Seçici yeniden kullanım
`sbrin/lopaka` açık kaynak (Apache-2.0, Vue 3 + TS, v0.6, aktif). İncelemesi (Ekim 2026):

| Açık repoda var | Açık repoda yok (lopaka.app'e özel) |
|---|---|
| 12 platform üreticisi (u8g2 + ESP-IDF varyantı, Adafruit GFX, Arduino_GFX, TFT_eSPI, LVGL, Flipper, GxEPD2, ESPHome, MicroPython, Inkplate, raw) — Pug şablonları | Animasyon |
| Her platform için **kod → katman parser** | Çoklu ekran / çoklu proje / workspace |
| `PixelatedDrawingRenderer` + `SmoothDrawingRenderer` (LVGL) | Hesap, bulut, paylaşım, galeri |
| BDF / GFX / TTF font parser'ları, `bdf2gfx` | İkon kütüphaneleri (Gaai, Streamline) |
| `layer-property-capabilities` (hedef başına yetenek matrisi) | Light tema |
| Display listesi, Flipper seri RPC, WebMCP | Bileşenler, snapping |

**Karar:** Tam fork yapılmıyor. Gerekçe: Vue 3 ve tek-ekran `Session` mimarisi; bizim çoklu ekran, bileşen, workspace ve light tema modelimiz baştan farklı; fork'ta bunları eklemek yeniden yazmaya yakın. Ancak en riskli iş olan **hedef başına doğru kod üretimi** hazır ve çerçeveden bağımsız. Şunlar Apache-2.0 altında TypeScript'e port edilir (`NOTICE` dosyası ve kaynak atfı korunur):

1. `src/platforms/*` — üretici mantığı ve şablonlar (Pug → kendi şablon motorumuz veya `pug` runtime)
2. `src/platforms/parsers/*` — kod içe aktarma (ileride)
3. `src/draw/renderers/pixelated-drawing-renderer.ts` — çizgi/daire/elips algoritmaları (kullanıcılar tarafından cihazda doğrulanmış)
4. `src/draw/fonts/*` — BDF/GFX/TTF parser'ları, `bdf2gfx`
5. `src/core/displays.ts` — cihaz listesi ve ofsetler
6. `src/core/layer-property-capabilities.ts` — yetenek matrisi (bkz. 8.1)

Port sırasında her modülün mevcut testleri (`*.test.ts`, snapshot'lar) de alınır; böylece bizim üreticimiz Lopaka ile aynı çıktıyı verir, sonra üstüne ekleriz. Ücretli ikon setleri ve lopaka.app'e özel hiçbir şey kopyalanmaz.

### 2.1 Masaüstü kabuğu
- **Electron** (`electron-vite` ile main/preload/renderer ayrımı)
- Neden Tauri değil: Linux'ta WebKitGTK, Windows'ta WebView2 → canvas render farkları. Piksel hassasiyetli editörde iki platformda birebir aynı Chromium şart.
- Paketleme: `electron-builder`
  - Linux: AppImage (birincil), `.deb`, `.rpm`
  - Windows: NSIS installer + portable `.exe`
- Otomatik güncelleme: `electron-updater` (GitHub Releases), kullanıcı kapatabilir

### 2.2 Renderer (UI)
| Katman | Seçim |
|---|---|
| Dil | TypeScript (strict) |
| UI | React 19 |
| State | Zustand + Immer; doküman için command pattern (undo/redo) |
| Stil | Tailwind CSS v4 + CSS değişkenleri (tema tokenları) |
| Bileşen primitifleri | Radix UI (dialog, dropdown, tooltip, tabs, context menu) |
| İkonlar | Lucide |
| Paneller | `react-resizable-panels` |
| Kod görüntüleme | CodeMirror 6 (C/C++ highlight, salt okunur + kopyala) |
| Build | Vite |
| Test | Vitest (birim), Playwright (Electron e2e) |
| Lint/format | ESLint + Prettier |

### 2.3 Render motoru (kendi yazılacak)
İki katman:

1. **Sahne grafiği** — Figma tarafı. Frame (ekran), group, component/instance, rect, ellipse, line, polyline, polygon, text, bitmap, icon, pixel-layer (kalem ile boyanan). Transform, hizalama, snapping, çoklu seçim.
2. **Sanal framebuffer** — Lopaka tarafı. Sahne, cihazın gerçek çözünürlüğü ve renk derinliğinde rasterize edilir (1-bit mono, 2/4-bit gri, RGB565, RGB888). Sonra nearest-neighbor ile zoom'lanıp tuvale basılır. **Ekranda görülen = cihazda görülecek.**

- Canvas2D + OffscreenCanvas ile başlanır. Darboğazda framebuffer katmanı WebGL'e (PixiJS) taşınır; sahne grafiği etkilenmez.

**Render politikası (hedefe göre değişir):** rasterizer tek değil, hedef kütüphanenin çizim davranışını taklit eden bir `RenderPolicy` seçilir. Amaç her hedefte "önizleme = cihaz çıktısı".

| Hedef | Politika | Öncelik |
|---|---|---|
| u8g2, Adafruit GFX, Flipper | Anti-alias yok; Bresenham çizgi/daire, tam sayı koordinat, u8g2'nin kendi daire/elips algoritması birebir port edilir | Piksel doğruluğu |
| TFT_eSPI, Arduino_GFX | Anti-alias yok; RGB565 kuantizasyonu önizlemede uygulanır (renk cihazda nasıl görünecekse öyle) | Renk doğruluğu |
| LVGL | Anti-alias açık (LVGL yumuşatılmış çizer); widget metrikleri ve font render'ı LVGL'nin davranışına yakınsanır, piksel eşitliği hedeflenmez | Widget/font davranışı |
| E-paper (GxEPD2) | Mono/3 renk, anti-alias yok | Piksel doğruluğu |

- Politika yalnızca şekil algoritmasını değil **metin yerleşimini** de kapsar: Adafruit GFX'te `y` baseline'dır, u8g2'de `setFontPosTop/Baseline/Bottom` ile değişir, TFT_eSPI `setTextDatum` kullanır, LVGL label kutusu üstten hizalanır. Her politika `textOrigin` ve font metrik kurallarını tanımlar; üretilen kodda da aynı referans kullanılır.
- Kalın çizgi, yuvarlak köşe, arc gibi her hedefte doğrudan karşılığı olmayan özellikler politika + yetenek matrisi (8.1) ile çözülür: ya gizlenir ya da yardımcı fonksiyona açılır.
- Her politika için referans görüntüler gerçek cihazdan çekilip `tests/render/golden/` altında tutulur; rasterizer bunlarla test edilir.

### 2.4 Main process (Node) — native bağımlılık yok
- Yalnızca: dosya diyalogları, fs işlemleri, proje kütüphanesi indeksi, pencere/menü
- **Görsel decode renderer'da yapılır** (`sharp` yok → platform başına native paketleme derdi yok):
  - PNG/JPG/WebP/BMP/SVG → `createImageBitmap` / `<img>` + OffscreenCanvas → RGBA
  - GIF kareleri → `gifuct-js` (Lopaka'nın kullandığı, saf JS); gerekirse WebCodecs `ImageDecoder`
  - SVG, CSP nedeniyle dış kaynak yükleyemez; ayrıca yüklenmeden önce temizlenir (2.5)
- Font: `opentype.js` (TTF/OTF rasterize), BDF/GFX parser'ları Lopaka'dan port
- İleride: `serialport` (cihaza canlı önizleme) — bu tek native bağımlılık olur ve opsiyonel yüklenir

### 2.5 Güvenlik (Electron)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`
- Renderer'da `fs`/`child_process` yok; tüm dosya işlemleri main process'te, preload sadece tipli ve dar bir IPC yüzeyi sunar (`openProject`, `saveProject`, `importImage`, `exportToFolder`…). Keyfi yol kabul edilmez; yollar workspace veya kullanıcının diyalogdan seçtiği dosyalarla sınırlı
- CSP: `default-src 'self'`; uzak kaynak yüklenmez, `remote` modülü yok
- SVG: `sharp`/librsvg ile raster'a çevrilmeden önce `<script>`, `<foreignObject>`, dış `href`/`xlink:href`, `@import` temizlenir; dış kaynak yüklemesi kapalı
- Girdi sınırları: görsel ≤ 20 MB ve ≤ 8192×8192 px, byte dizisi girişi ≤ 4 MB, proje dosyası JSON derinlik/boyut sınırı; aşımda açık hata mesajı
- `.ivec` açılırken şema doğrulaması (zod); hatalı dosya uygulamayı çökertmez, hata panelinde gösterilir
- Auto-update imzalı paketlerle (Windows code signing, Linux AppImage için sha512 doğrulaması)

---

## 3. Renk paleti ve tema

### 3.1 Marka paleti
Kullanıcı paleti (coolors):

| Ad | Hex | Kullanım |
|---|---|---|
| `snow` | `#F7F8F6` | Light tema zemin, dark tema metin |
| `ink` | `#171329` | Dark tema zemin, light tema metin |
| `violet` | `#6F4BFF` | Birincil vurgu: seçim çerçevesi, aktif araç, birincil buton, odak |
| `mint` | `#18D9C5` | İkincil vurgu: başarı, "kopyalandı", snapping kılavuzları, hover vurgusu |

### 3.2 Türetilmiş ton skalası
`ink` ve `snow` arasında 10 kademeli nötr skala üretilir (OKLCH ile interpolasyon, hafif mor tint korunur).

```
ink-950  #171329   (dark bg)
ink-900  #1E1A33   (dark panel)
ink-800  #27223F   (dark panel yükseltilmiş / hover)
ink-700  #35304F   (dark kenarlık)
ink-600  #4A4563
ink-500  #6B667F   (ikincil metin dark)
ink-400  #908BA3
ink-300  #B6B2C4   (ikincil metin light)
ink-200  #D6D3DF   (light kenarlık)
ink-100  #E9E8EE   (light panel yükseltilmiş)
ink-50   #F0F0F3   (light panel)
snow     #F7F8F6   (light bg)
```

Vurgu türevleri:
```
violet-600 #5B3BE6   (pressed)
violet-500 #6F4BFF   (default)
violet-400 #8A6DFF   (hover)
violet-100 #E9E3FF   (light tema seçim dolgusu)
violet-900 #2A2250   (dark tema seçim dolgusu)

mint-600   #12B8A7
mint-500   #18D9C5
mint-400   #4CE3D3
mint-100   #D9F8F4
mint-900   #0F3F3B

danger     #FF5C7A   (silme, hata)
warning    #FFB54C
```

### 3.3 Tema tokenları (CSS değişkenleri)
Tema `data-theme="dark|light"` ile `<html>` üzerinde değişir. Bileşenler sadece semantik token kullanır.

| Token | Dark | Light |
|---|---|---|
| `--bg-app` | ink-950 | snow |
| `--bg-panel` | ink-900 | ink-50 |
| `--bg-elevated` | ink-800 | ink-100 |
| `--bg-canvas` | `#120F21` | `#E4E3EA` |
| `--border` | ink-700 | ink-200 |
| `--border-strong` | ink-600 | ink-300 |
| `--text` | snow | ink |
| `--text-muted` | ink-500 | ink-300… (kontrast ≥ 4.5 için ink-500) |
| `--accent` | violet-500 | violet-500 |
| `--accent-hover` | violet-400 | violet-600 |
| `--accent-soft` | violet-900 | violet-100 |
| `--accent-2` | mint-500 | mint-600 |
| `--accent-2-soft` | mint-900 | mint-100 |
| `--selection-stroke` | violet-400 | violet-500 |
| `--snap-guide` | mint-400 | mint-600 |
| `--danger` | `#FF5C7A` | `#E0405E` |

### 3.4 Tema davranışı
- Ayarlar: **System / Dark / Light**. Varsayılan System (`nativeTheme` dinlenir).
- Kısayol: `Ctrl+Shift+L` tema döngüsü.
- Tema değişimi anında, yeniden başlatma gerekmez.
- **Cihaz önizlemesi temadan bağımsızdır.** OLED'in siyah zemini, piksel rengi (beyaz/mavi/sarı), TFT renkleri her iki temada aynı görünür. Sadece tuval arka planı (`--bg-canvas`) değişir.
- Üretilen kod paneli: dark temada koyu, light temada açık syntax teması (CodeMirror iki tema).
- Tüm metin kontrastları WCAG AA (≥ 4.5:1) ile doğrulanır; test suite'inde kontrast testi bulunur.

---

## 4. Proje saklama sistemi

### 4.1 Workspace (proje kütüphanesi)
Kullanıcı bir **workspace klasörü** seçer; tüm projeler burada toplanır. Lopaka'daki "My Projects" ekranının yerel karşılığı.

```
<workspace>/
  .ivec/
    index.json            # proje listesi önbelleği (ad, cihaz, son açılış, thumbnail yolu)
    thumbnails/           # proje kartı önizlemeleri (PNG)
    recent.json
  Projeler/
    gps-tracker/
      gps-tracker.ivec    # proje dosyası (JSON)
      assets/             # kullanıcı yüklediği orijinal görseller
        logo.png
        map-pin.svg
      fonts/              # projeye özel fontlar (TTF / BDF)
      export/             # "Klasöre export" çıktıları (opsiyonel, kullanıcı seçer)
    weather-station/
      ...
  Kütüphane/
    icons/                # kullanıcının kendi ikon seti (projeler arası ortak)
    components/           # paylaşılan bileşenler (.ivec-comp)
    fonts/                # ortak fontlar
    palettes/
```

- Varsayılan konum: Linux `~/Belgeler/ivec-draw/`, Windows `%USERPROFILE%\Documents\ivec-draw\`. İlk açılışta değiştirilebilir; birden fazla workspace tanımlanabilir (sol üstten geçiş).
- Proje bir klasördür → git'e doğrudan konabilir. `.ivec` JSON, anlamlı diff verir.
- Projeyi `.ivecpkg` (zip) olarak paketle / paketten aç: tek dosya paylaşımı.
- `index.json` sadece önbellektir; silinirse klasör taranarak yeniden oluşturulur.
- Workspace dışından `.ivec` açılabilir ("Son dosyalar"da görünür, kütüphaneye kopyalama önerilir).

### 4.2 Başlangıç ekranı (Home)
- Üst: workspace seçici, arama, **+ Yeni Proje**, **Aç**, **Paketten içe aktar**
- Proje kartları: canlı piksel önizleme, ekranlar arası ok ile gezinme (Screen 1/3), kütüphane rozeti (`u8g2`, `tft_espi`…), çözünürlük rozeti, yıldız, son değişiklik; sağ tık: yeniden adlandır, kopyala, klasörde göster, sil
- Sıralama: son açılan / ad / cihaz; filtre: cihaz, kütüphane, yıldızlı
- Alt: **Şablonlar** (dahili örnek ekranlar: GPS menü, Wifi listesi, hız göstergesi, enerji monitörü, hava durumu, attendance menüsü)

### 4.3 Kaydetme davranışı
- `Ctrl+S` kaydet; **otomatik kaydetme** 30 sn / odak kaybında (ayarlardan kapatılabilir)
- Kayıt atomik: geçici dosyaya yaz → rename
- Her kayıtta `.ivec/backups/<proje>/<timestamp>.ivec` (son 20 sürüm) → "Sürüm geçmişi" panelinden geri dön
- Çökme sonrası kurtarma: kaydedilmemiş değişiklikler `.ivec/recovery/`
- Dosya dışarıdan değişirse (git pull) bildirim: yeniden yükle / üzerine yaz

### 4.4 `.ivec` dosya formatı (v1)

```jsonc
{
  "format": "ivec",
  "version": 1,
  "meta": { "name": "gps-tracker", "created": "...", "modified": "...", "app": "ivec draw 0.1.0" },
  "device": {
    "profile": "ssd1306-128x64",      // dahili profil id'si veya "custom"
    "width": 128, "height": 64,
    "colorMode": "mono",              // mono | gray2 | gray4 | rgb565 | rgb888
    "library": "u8g2",                // kod üretici hedefi
    "preview": { "pixelOn": "#FFFFFF", "pixelOff": "#000000", "bezel": "oled-blue-yellow" }
  },
  "fonts": [ { "id": "f1", "source": "fonts/roboto.ttf", "size": 12, "name": "roboto_12" } ],
  "assets": [
    // Kaynağı dosya olan varlık: sadece yol + işleme parametreleri. İşlenmiş bitmap dosyada TUTULMAZ,
    // cache/<hash>.bin'den okunur, yoksa yeniden üretilir.
    { "id": "img1", "name": "map_pin", "kind": "file", "source": "assets/map-pin.svg",
      "sourceHash": "sha256:…",
      "width": 16, "height": 16,
      "process": { "resample": "nearest", "mode": "threshold", "value": 128, "invert": false, "alphaThreshold": 128 } },
    // Kaynağı byte dizisi olan varlık (Input byte array): orijinal dosya yok, veri kaynağın kendisidir → inline.
    { "id": "img2", "name": "battery", "kind": "inline", "width": 8, "height": 8,
      "format": "mono-h-msb", "data": "base64…" }
  ],
  "components": [ { "id": "c1", "name": "Button", "children": [ /* nodes */ ] } ],
  "screens": [
    {
      "id": "s1", "name": "Screen 1", "x": 0, "y": 0,
      "cIdentifier": "screen_1",          // ekran adından türetilir, kullanıcı düzenleyebilir (4.6)
      "userCode": {                        // üretilen bloğun önüne/arkasına kullanıcının kendi kodu; export'ta korunur
        "prefix": "// sensör oku\nfloat t = readTemp();",
        "suffix": ""
      },
      "children": [
        { "type": "rect", "id": "n1", "name": "frame", "x": 0, "y": 0, "w": 128, "h": 64, "fill": false, "stroke": 1, "color": 1 },
        { "type": "text", "id": "n2", "name": "title", "x": 20, "y": 4, "text": "GPS", "font": "f1", "color": 1,
          "vars": { "text": "title_text", "x": "title_x" } },   // hangi özellik değişken olacak → kodda parametre/global
        { "type": "image", "id": "n3", "asset": "img1", "x": 2, "y": 2, "w": 16, "h": 16, "flipX": false, "rotate": 0 },
        { "type": "text", "id": "n5", "text": "12:45", "font": "f1", "x": 100, "y": 4, "rotation": 90 },
        { "type": "instance", "id": "n4", "component": "c1", "x": 4, "y": 50, "overrides": { "label": "back" } },
        { "type": "image", "id": "n6", "asset": "img9", "x": 0, "y": 0, "w": 128, "h": 64,
          "role": "reference", "opacity": 0.4 }   // referans/overlay katmanı: önizlemede görünür, koda GİRMEZ
      ]
    }
  ],
  "loose": [ /* ekran dışında duran scratch objeler */ ],
  "export": {
    "activeTarget": "u8g2",
    "common": { "comments": true, "naming": { "screenFn": "draw_{screen}", "imagePrefix": "image_", "fontPrefix": "font_" } },
    "targets": {                                   // ayarlar hedef başına; her hedef kendi şemasını tanımlar
      "u8g2":     { "wrapperFunction": true, "includeFonts": true, "declareImages": true, "includeImageFiles": true,
                    "declareVariables": true, "clearDisplay": true, "progmem": true, "syntax": "arduino" /* | esp-idf */,
                    "bufferMode": "full" /* | page */, "fontSubset": "used" /* | full */ },
      "tft_espi": { "wrapperFunction": true, "swapBytes": true, "useSprite": false, "clearDisplay": true },
      "lvgl":     { "version": 9, "declareStyles": true }
    }
  },
  "ui": { "zoom": 6, "pan": [0, 0], "grid": true }
}
```

### 4.5 Varlık yönetimi kuralları
- **Tek kaynak:** orijinal dosya (`assets/`) kaynaktır; işlenmiş bitmap `cache/<sourceHash>-<processHash>.bin` altında yeniden üretilebilir önbellektir. `cache/` git'e girmez (`.gitignore` proje oluşturulurken yazılır). Proje başka makinede açıldığında cache sıfırdan üretilir.
- **İnline varlıklar** (byte dizisi girişi, kalemle çizilmiş piksel katmanı) orijinali olmadığı için `.ivec` içinde base64 tutulur.
- **Değişiklik algılama:** `sourceHash` ile orijinal dosya değişmişse açılışta bildirim: "map-pin.svg değişti — yeniden işle / eskisini koru (inline'a dönüştür)".
- **Eksik varlık:** dosya bulunamazsa katman kırmızı placeholder ile çizilir, Layers'ta uyarı ikonu; sağ tık → "Dosyayı bul" / "Kaldır" / varsa cache'ten "inline'a dönüştür". Proje kaydedilmeye devam eder, veri kaybı olmaz.
- **Bozuk dosya:** decode hatası aynı akışa düşer; hata mesajı gösterilir.
- **Paketleme (`.ivecpkg`)** her zaman orijinalleri içerir, cache'i içermez.
- **Format migrasyonu:** `version` alanı; `src/core/document/migrations/v1→v2.ts` gibi sıralı migratörler. Eski dosya açılınca bellekte migrate edilir, kaydetmeden önce kullanıcıya "yeni formatta kaydedilecek, yedek alındı" denir (`.ivec/backups/`'a eski hali kopyalanır). Daha yeni sürüm dosyası açılırsa salt okunur uyarısı.
- **Bellek:** varlıklar tembel yüklenir; Home ekranında sadece thumbnail; editörde görüntülenmeyen ekranların bitmap'leri LRU ile boşaltılır. Tek varlık üst sınırı için bkz. 2.5.

### 4.6 C tanımlayıcı üretimi
Ekran, görsel, font ve değişken adları koda girer; kurallar:
- Türkçe/Unicode → ASCII transliterasyon (`ş→s`, `ğ→g`, `İ→I`), boşluk ve noktalama → `_`, ardışık `_` tekil
- Rakamla başlıyorsa `_` öneki; C/C++ ayrılmış kelimeler (`int`, `class`, `default`…) ve Arduino makro çakışmaları (`HIGH`, `LOW`, `INPUT`) → `_` soneki
- Aynı projede çakışma → `_2`, `_3`
- Kullanıcı `cIdentifier`'ı elle değiştirebilir; doğrulama anlık, hatalıysa kırmızı
- **Bitmap tekilleştirme:** piksel verisi aynı olan görseller tek sembolde birleştirilir (export'ta `image_a` ve `image_b` aynı diziyi gösterir), kullanıcıya bilgi verilir

---

## 5. Görsel yükleme ve "kod olarak al" noktaları

Kullanıcının görsel yükleyip ekran/görsel boyut ve byte verisini kod olarak alabildiği tüm noktalar.

### 5.1 Görsel yükleme kaynakları
| Kaynak | Yol |
|---|---|
| Dosya | Araç çubuğu "Görsel" → "Dosya yükle"; PNG, JPG, BMP, GIF (ilk kare/animasyon), SVG, WebP |
| Sürükle-bırak | Tuvale veya Layers paneline bırak |
| Pano | `Ctrl+V` ile pano görseli |
| Byte dizisi | "Input byte array": C dizisi yapıştır → bitmap'e çevir |
| İkon kütüphanesi | Dahili setler (Gaai, Flipper Zero, açık piksel-ikon setleri) + kullanıcı `Kütüphane/icons/` |
| Proje içi | "Current Project" sekmesi: projede zaten kullanılan görseller |

### 5.2 Görsel işleme diyaloğu
Yüklemeden sonra açılır, canlı önizleme ile. İşlem sırası sabittir ve arayüzde bu sırayla gösterilir:
1. **Kırpma** ve **ofset**
2. **Hedef boyut**: genişlik/yükseklik (oran kilidi), ekrana sığdır / orijinal / özel; yüzde ölçek; **yeniden örnekleme**: nearest (piksel-art) / bilinear / Lanczos
3. **Ön ayar**: parlaklık, kontrast, gama; "önce gri tonlama" (luma / ortalama / tek kanal)
4. **Paleti ters çevir** (kaynak görüntüyü dithering'den **önce** negatife çevirir — koyu zeminli görseller için)
5. **Renk indirgeme** (cihaz moduna göre):
   - mono: threshold (eşik kaydırıcı), Floyd-Steinberg, Atkinson, Bayer 2×2/4×4/8×8
   - gray2/gray4: seviye eşleme + dithering
   - rgb565/rgb888: doğrudan dönüşüm, opsiyonel palet indirgeme
6. **Şeffaflık**: alfa eşiği → mask bitmap üretimi (ayrı dizi)
7. **Sonucu ters çevir** (dithering'den **sonra** 1↔0 — cihazın piksel polaritesi için). 4 ve 7 farklı şeylerdir, ikisi de ayrı kutudur.
- Sağda: işlenmiş sonucun 1:1 ve zoomlu önizlemesi, byte boyutu ("256 B"), sağ altta **"Kodu kopyala"** düğmesi (bkz. 5.3)
- **Toplu içe aktarma:** birden çok dosya seçilince aynı ayarlar hepsine uygulanır, liste halinde önizlenir, tek tek düzeltilebilir
- **GIF / çoklu kare:** GIF kareleri (`gifuct-js`) veya numaralı PNG dizisi → kare seçimi (tümü / her N. kare / 7-14-28 kare ön ayarı), ortak işleme, sonuç bir **sprite seti** varlığı olur (`kind: "frames"`). Kare sayısı ve toplam byte gösterilir; üst sınır 1000 kare / 5 MB kaynak.

### 5.3 "Kod olarak al" noktaları
Boyut ve byte verisinin kod olarak alınabildiği her yer:

1. **Görsel işleme diyaloğu** → "Kodu kopyala": seçilen formatta sadece bu görselin dizisi
2. **Layers panelinde görsele sağ tık** → "Byte dizisini kopyala" / "`.h` olarak kaydet"
3. **Özellikler panelinde (görsel seçiliyken)** → "Kod" sekmesi: dizi + `#define` boyutları canlı görünür, kopyala
4. **Assets paneli** (projenin tüm görselleri) → tek tek veya toplu export
5. **Kod paneli (alt)** → "Images" bölümü: her görsel ayrı dosya olarak listelenir, tıkla-kopyala
6. **Ekran başlığına sağ tık** → "Ekran boyutlarını kopyala":
   ```c
   #define SCREEN_WIDTH  128
   #define SCREEN_HEIGHT 64
   ```
7. **Ekranı bitmap olarak export**: tüm ekranın rasterize halini tek dizi olarak al (splash screen kullanımı)
8. **Cihaz rozetine tıkla** → cihaz init snippet'i (örn. `U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0);`)

### 5.4 Byte dizisi formatları
Kopyalanan kodun şekli, dropdown ile seçilir ve projede hatırlanır:

| Format | Açıklama | Hedef |
|---|---|---|
| Horizontal 1-bit, MSB first | Satır satır, her byte 8 yatay piksel; XBM = LSB first | Adafruit GFX `drawBitmap`, u8g2 `drawXBM` |
| Vertical 1-bit (page) | 8 dikey piksel/byte, SSD1306 ham buffer düzeni | Doğrudan buffer yazma |
| RGB565 `uint16_t[]` | Byte-swap seçeneği | TFT_eSPI `pushImage`, Arduino_GFX |
| RGB888 `uint8_t[]` | 3 byte/piksel | LVGL / genel |
| LVGL `lv_img_dsc_t` | v8 ve v9 header yapısı, I1/I8/RGB565/ARGB8888 | LVGL |
| Flipper `.xbm` / icon C | Flipper Zero `Icon` yapısı | Flipper uygulamaları |
| Ham hex / dec / binary | Ayırıcı, satır başına eleman sayısı seçimi | Herhangi |

Üretilen dizi şablonu (örnek, Adafruit GFX):
```c
// map_pin — 16x16, 1-bit horizontal, 32 bytes
#define MAP_PIN_WIDTH  16
#define MAP_PIN_HEIGHT 16
static const unsigned char PROGMEM map_pin_bits[] = {
  0x07, 0xE0, 0x18, 0x18, ...
};
```
Seçenekler: `PROGMEM` / `const` / `static`, isimlendirme stili (snake/camel), yorum satırı, hex/dec, satır genişliği.

### 5.5 Ters yön: "Input byte array"
Yapıştırılan dizi için parametreler: genişlik, yükseklik, format (yukarıdaki tablo), MSB/LSB, byte-swap. Anlık önizleme; hatalı boyutta uyarı ("dizi 30 byte, 16×16 için 32 byte gerekir"). Sonuç projeye asset olarak eklenir ve yeniden düzenlenebilir.

### 5.6 Bitmap motoru: mimari ve test matrisi
`src/core/bitmap/` UI'dan tamamen bağımsız, saf TypeScript, Node ve tarayıcıda aynı çalışır:

```
decode (sharp, main)  →  RGBA buffer
RGBA → quantize(policy) → PixelGrid { w, h, mode, data }   // kanonik ara form
PixelGrid → encode(format) → Uint8Array                     // 7 format
Uint8Array → decode(format, w, h) → PixelGrid               // ters yön
```
Her format bir `Codec { encode, decode, byteLength(w,h) }` nesnesi; encode→decode round-trip testi zorunlu.

Zorunlu test vakaları (`tests/unit/bitmap/`):
| Vaka | Neden |
|---|---|
| 8×8, 16×16 | temel |
| 9×9, 17×5, 1×1, 128×64, 240×240 | 8 piksel sınırı: satır sonu padding, bit kaydırma |
| MSB vs LSB (XBM) aynı görsel | u8g2 `drawXBM` vs GFX `drawBitmap` farkı |
| Vertical page (SSD1306 buffer) 128×64 ve 128×33 | yükseklik 8'e bölünmediğinde son page |
| Alfa kanallı PNG → mask + bitmap | şeffaflık |
| RGB565 byte-swap açık/kapalı | TFT_eSPI `setSwapBytes` |
| Threshold, Floyd-Steinberg, Atkinson, Bayer için golden çıktılar | dithering determinizmi |
| Invert | 1/0 tersleme |
| Round-trip: encode→decode→encode eşitliği | tüm codec'ler |
| Hatalı uzunlukta byte dizisi | kullanıcıya doğru hata |

### 5.7 Bellek hesaplayıcı
Kod panelinin üstünde her zaman görünen küçük şerit:
```
Flash: 1.284 KB (bitmap 412 B · font 836 B · kod ~36 B)   RAM: 1.024 KB (framebuffer 128×64/8)
```
- Bitmap/font boyutları gerçek dizi uzunluğundan; framebuffer cihaz profilinden; u8g2 page-buffer modunda RAM 128/256 B olarak gösterilir
- Hedef MCU seçilirse (ATmega328P 32K/2K, ESP32 4M/320K, RP2040, STM32F1…) yüzde çubuğu ve uyarı eşiği
- Varlık bazında kırılım Assets panelinde

### 5.8 Font kapsama kontrolü
- Font seçildiğinde text katmanındaki her karakter fontta aranır; eksik glifler editörde `▯` ve Özellikler panelinde kırmızı listelenir ("Eksik: ğ, ş, İ")
- Hazır kontrol setleri: Türkçe (`çÇğĞıİöÖşŞüÜ`), Latin-1, sayılar+semboller
- TTF→bitmap dönüştürücüde karakter aralığına "Türkçe" ön ayarı; u8g2 font seçicisinde `_tf`/`_tr`/`_te` varyantlarının kapsamı rozetle gösterilir

---

## 6. Editör

### 6.1 Yerleşim
```
┌──────────────────────────────────────────────────────────────┐
│ Üst bar: logo | proje adı | cihaz rozeti | çözünürlük | kaydet | export | tema │
├──────────┬────────────────────────────────────────┬──────────┤
│ Layers   │ Araç çubuğu (ortada, yüzen)             │ Özellik  │
│ Ekranlar │                                        │ paneli / │
│ Assets   │ Tuval: ekranlar yan yana (frame)        │ Kısayol  │
│ Bileşen  │ sağ kenarda zoom/fit/grid               │ Cihaz    │
├──────────┴────────────────────────────────────────┴──────────┤
│ Kod paneli: ekran sekmeleri | kod | export seçenekleri | Images│
└──────────────────────────────────────────────────────────────┘
```
Tüm paneller boyutlandırılabilir, katlanabilir; düzen hatırlanır.

### 6.2 Sol panel
- **Ekranlar**: "+ Ekran ekle", sürükle sırala, çoğalt, yeniden adlandır; aktif ekran kod panelini seçer
- **Layers**: tipe göre ikon (görsel, `Aa`, rect, çizgi, grup, instance, pixel-layer); gruplar katlanır; sürükle-bırak sıralama ve gruba taşıma; kilit/gizle; çoklu seçim; çift tık ad; arama
- **Assets**: proje görselleri, kullanım sayısı, "kodu kopyala", yeniden işle, değiştir
- **Bileşenler**: proje + workspace kütüphanesi bileşenleri; tuvale sürükle

### 6.3 Araçlar
Seç (`V`), El (`H`), Görsel (`I`), Kalem/piksel (`B`), Silgi (`E`), Text (`T`), Rect (`R`), Daire/elips (`O`), Çizgi (`L`), Üçgen (`Y`), Çokgen (`P`), Arc (`A`, destekleyen hedeflerde), Nokta (`.`), Eyedropper (`K`)

Aktif hedefin desteklemediği araçlar araç çubuğunda devre dışı görünür ve tooltip nedenini söyler (bkz. 8.1).

**Katman işlemleri (bağlam menüsü):**
- Bitmap'e birleştir (merge to bitmap): seçili katmanlar rasterize edilip tek görsel katmanına dönüşür; geri alınabilir
- Görsel: yatay/dikey çevir, 90° döndür, invert — parametre olarak saklanır, orijinal bozulmaz
- Metin döndürme 0/90/180/270 (u8g2 `setFontDirection`, TFT_eSPI `setRotation` yerine `drawString` + sprite; desteklemeyen hedefte devre dışı)
- **Referans katmanı** (`role: "reference"`): mockup/fotoğraf/başka ekranın görüntüsü; opaklık ayarlı, tıklanamaz yapılabilir, **koda girmez**, bellek hesabına girmez
- Kalem desenleri (dama, yatay/dikey çizgi, nokta) ve paint kırpma — M5

### 6.4 Tuval
- Birden fazla ekran aynı tuvalde, Figma frame mantığı; ekran dışı scratch alanı
- Zoom 1×–64×, `Ctrl` + tekerlek, fit (`Shift+1`), 100% (`Shift+0`)
- Piksel grid (zoom ≥ 4×), cihaz bezel'i aç/kapa, 2 renkli OLED bölgesi gösterimi
- Snapping: piksel, diğer obje kenar/merkezleri, ekran merkezi, eşit aralık; kılavuz rengi `--snap-guide`
- Ruler + sürüklenebilir kılavuz çizgileri
- Seçim: tıkla, `Shift`+tıkla, kutu seçimi; handle'lar; `Alt` merkezden, `Shift` oranlı
- Hizala (sol/orta/sağ/üst/orta/alt), dağıt (yatay/dikey), ekrana ortala
- Çoklu seçimde bağlam menüsü: grupla, bileşen yap, kopyala, diğer ekrana kopyala

### 6.5 Özellikler paneli
Seçime göre:
- Ortak: ad, X/Y/W/H (tam sayı), görünür, kilit, renk (mono'da 1/0/invert; TFT'de renk seçici + RGB565 hex), hizalama butonları
- Text: içerik, font (proje + dahili u8g2/GFX fontları + TTF dönüşüm), hizalama, satır aralığı
- Rect/Ellipse: dolgu, çerçeve kalınlığı, köşe yarıçapı
- Line: kalınlık, uç noktalar
- Image: asset, yeniden işle, invert, **Kod sekmesi** (bkz. 5.3)
- Instance: override edilebilir alanlar
- Seçim yok: cihaz ayarları (profil, renk modu, önizleme rengi) + kısayol listesi

### 6.6 Kod paneli
- Ekran başına sekme; aktif ekran kodu; **Copy**; "Tümünü export et"
- Export seçenekleri (Lopaka ile bire bir): Wrapper function · Include fonts · Declare images · Include image files · Animation helpers · Declare variables · Comments/layer titles · Clear/fill display
- Ek: isimlendirme şablonu, `PROGMEM`, hedef kütüphane sürümü (LVGL 8/9)
- **Images** bölümü: her görsel ayrı `.h`, tıkla-kopyala
- **Klasöre export**: `export/` altına `screens.h`, `images/*.h`, `fonts/*.h`, opsiyonel `main.cpp` iskeleti (Arduino / PlatformIO şablonu)

### 6.7 Bileşen sistemi
- Seçimden "Bileşen oluştur" (`Ctrl+Alt+K`); instance'lar ana bileşeni izler
- Override: text içeriği, görsel, görünürlük, renk
- Instance'ı ayır (detach)
- Workspace kütüphanesine yayınla → diğer projelerde kullan
- Kod üretiminde bileşen → ayrı fonksiyon (`drawButton(x, y, label)`) üretme seçeneği

---

## 7. Cihaz profilleri

`src/core/devices/*.json`. Alanlar: `id, name, width, height, colorMode, shape (rect|round), library defaults, preview (pixelOn, pixelOff, bezel, dualColorSplitY), initSnippet, rotation (0|90|180|270), colOffset, rowOffset, mcuPresets`.

- **Rotasyon:** tasarım her zaman mantıksal yönde yapılır; profilde/projede rotasyon seçilince önizleme döner ve init snippet'e `U8G2_R1`, `tft.setRotation(1)` vb. yazılır. Genişlik/yükseklik otomatik yer değiştirir.
- **Ofset:** ST7735 80×160 (26/1), ST7789 135×240 (52/40), SH1106 (2 px sütun) gibi sürücülerdeki koordinat kaymaları profilde tutulur; önizlemeyi etkilemez, init/çizim koduna yansıtılır.
- **Özel profil:** kullanıcı JSON'u `Kütüphane/devices/` altına koyar, listede görünür.

Başlangıç seti:
| Profil | Çözünürlük | Mod |
|---|---|---|
| SSD1306 / SH1106 | 128×64, 128×32, 64×48 | mono (beyaz, mavi, sarı, sarı-mavi split) |
| SSD1309 | 128×64 | mono |
| ST7735 | 128×128, 128×160, 80×160 | rgb565 |
| ST7789 | 240×240, 240×320, 135×240 | rgb565 |
| ILI9341 | 320×240 | rgb565 |
| GC9A01 (yuvarlak) | 240×240 | rgb565, round |
| ILI9488 | 480×320 | rgb565 |
| E-paper 2.13" / 2.9" / 4.2" | 250×122, 296×128, 400×300 | mono / 3 renk |
| Flipper Zero | 128×64 | mono (turuncu zemin önizleme) |
| Nokia 5110 (PCD8544) | 84×48 | mono |
| Özel | serbest | serbest |

---

## 8. Kod üretici hedefleri

Her hedef `src/core/export/<target>/` altında ayrı modül; ortak IR (intermediate representation) kullanır.

| Hedef | Notlar |
|---|---|
| u8g2 | `drawXBMP`, `drawStr`, `drawFrame/Box`, font setleri; `firstPage/nextPage` ve full buffer modları |
| Adafruit GFX | `drawBitmap`, GFX fontları, `PROGMEM` |
| TFT_eSPI | `pushImage`, `drawString`, renk sabitleri, sprite seçeneği |
| Arduino_GFX | GC9A01 yuvarlak ekranlar için |
| LVGL v8 / v9 | `lv_obj`, `lv_label`, `lv_img_dsc_t`; stil yapıları |
| Flipper Zero | `canvas_draw_*`, `Icon` yapıları |
| Ham C | sadece diziler + `#define` boyutlar |
| PNG/GIF | ekranların görsel export'u (dokümantasyon/paylaşım için) |
| GxEPD2 | e-paper; Adafruit GFX API'si üzerine, partial refresh yardımcıları | sonraki aşama |
| ESPHome | `display: lambda:` YAML bloğu + `image:`/`font:` tanımları | sonraki aşama |
| MicroPython / CircuitPython | `framebuf` / `displayio` + `bytearray` çıktıları | sonraki aşama |

**Sıra:** ilk sürümde **u8g2** kusursuz olacak (SSD1306/SH1106 ile); hemen ardından **Adafruit GFX** eklenir — ikinci hedef, IR soyutlamasının doğru olduğunu kanıtlamak için gerekir ve GFX ucuzdur. Diğer hedefler IR üzerinden eklenir; IR tasarlanırken LVGL (widget tabanlı) ve ESPHome (YAML) gibi "çizim komutu olmayan" hedefler düşünülür → IR, çizim komutları listesi değil **katman ağacı + stil** olarak tutulur, her hedef kendi dönüştürücüsünü yazar. Üretici mantığı Lopaka'dan port edilir (2.0).

**Kullanıcı kodu korunur:** her ekranın `userCode.prefix/suffix` alanı üretilen fonksiyonun içine, çizim bloğunun önüne/arkasına yazılır. Klasöre export'ta mevcut dosya varsa `// ivec:begin generated` … `// ivec:end generated` işaretleri arasındaki bölüm güncellenir, dışarısı dokunulmaz; işaret bulunamazsa üzerine yazmadan önce sorulur.

**Değişkenler:** düğümdeki `vars` haritası hangi özelliğin değişken olacağını tutar. Üretimde `declareVariables` açıksa global/`static` tanımlar (`int title_x = 20; const char* title_text = "GPS";`), kapalıysa fonksiyon parametresi olur. Özellikler panelinde her alanın yanında "değişken yap" düğmesi ve ad kutusu bulunur.

### 8.1 Hedef başına yetenek matrisi
`src/core/export/capabilities.ts` — Lopaka'nın `layer-property-capabilities` yapısından port edilir ve genişletilir. Her hedef, her katman tipi ve özelliği için: `native` (doğrudan çağrı), `emulated` (yardımcı fonksiyon üretilir), `unsupported` (araç gizlenir / özellik devre dışı).

| Özellik | u8g2 | Adafruit GFX | TFT_eSPI | LVGL | Flipper |
|---|---|---|---|---|---|
| Çokgen | emulated (çizgilerden `draw_polygon`) | emulated | emulated | native | emulated |
| Kalın çizgi | emulated (paralel çizgiler) | emulated | native (`drawWideLine`) | native | unsupported |
| Yuvarlak köşe | native (`drawRFrame`) | native | native | native | native |
| Arc | unsupported | unsupported | native (`drawArc`, smooth seçeneği) | native | unsupported |
| Metin döndürme | native (`setFontDirection`) | native (`setRotation` yerine GFX font + rotation) | emulated (sprite) | native | unsupported |
| Özel font boyutu | unsupported (bitmap font) | native (`setTextSize` tamsayı) | native | native | unsupported |
| RGB | unsupported | unsupported (mono varyant) | native | native | unsupported |
| Widget (buton, switch, slider…) | unsupported | unsupported | unsupported | native | unsupported |
| Alfa / şeffaflık | unsupported | unsupported | emulated (mask) | native | unsupported |

Matris tek kaynaktır: araç çubuğu, özellikler paneli ve üretici aynı tabloyu okur. Hedef değiştirildiğinde desteklenmeyen özellikler listelenir ("3 katman TFT_eSPI'de farklı üretilecek") ve kullanıcı onaylar.

**Test (üç katman):**
1. Golden-file: üretilen metin beklenenle eşit (`tests/export/<target>/*.h`)
2. **Derleme:** CI'da `arduino-cli` ile hedef başına örnek sketch gerçekten derlenir (AVR `arduino:avr:uno`, ESP32 `esp32:esp32:esp32`, RP2040). Golden dosyalar bu sketch'lere include edilir; derlenmeyen çıktı test kırar. LVGL için host (Linux SDL) derlemesi.
3. **Render eşitliği:** üretilen kodun host emülasyonu (u8g2 için `u8g2` kütüphanesini WASM'a derleyip framebuffer'ını alma — M6+) ile uygulama önizlemesi piksel piksel karşılaştırılır. Buna kadar gerçek cihaz fotoğrafları `tests/render/golden/` altında manuel referans.

---

## 9. Font sistemi
u8g2'nin font formatı özel ve sıkıştırılmıştır (`bdfconv` üretir); GFX fontu düz bitmap+glif tablosudur. Bu fark stratejiyi belirler:

- **u8g2 dahili fontlar:** Lopaka'nın yaklaşımı — kodda u8g2'nin kendi font sembolü yazılır (`u8g2_font_helvB08_tr`), font verisi üretilmez; önizleme için aynı fontun BDF'i uygulamayla gelir. Katalog Lopaka'nın BDF seti + u8g2 deposundan seçilen alt küme. Türkçe için `_te`/`_tf` varyantları kataloğa dahil edilir ve kapsama rozeti gösterilir (5.8).
- **Adafruit GFX fontlar:** dahili GFX `.h` setleri; BDF→GFX (`bdf2gfx` portu) ve TTF→GFX (`opentype.js` ile rasterize; Lopaka'nın `truetype2gfx`'i yalnız 95 ASCII üretir, biz karakter aralığını seçtiriyoruz: ASCII, Latin-1, **Türkçe**, özel liste).
- **TTF → u8g2 (özel font):** `bdfconv`'un WASM derlemesi (Emscripten) veya TS portu gerekir. M6'da; o zamana kadar özel fontlar u8g2 hedefinde GFX fontu olarak **değil**, "u8g2 dahili font seç" uyarısıyla sınırlanır.
- **Yalnızca kullanılan glifler:** `fontSubset: "used"` açıkken font çıktısına sadece projede geçen karakterler girer (flash tasarrufu; bellek hesaplayıcıda fark gösterilir). Değişken metinlerde (`vars.text`) kullanıcı ek karakter aralığı belirtir.
- BDF import (kullanıcı dosyası)
- Fontlar projede `fonts/` altında saklanır, kodda `#include` ile referanslanır

---

## 10. Klavye kısayolları
| Kısayol | İşlev |
|---|---|
| `Shift + ok` | 10 px taşı |
| `Ctrl + ↑/↓` | katman sırası |
| `Ctrl + C/V/X`, `Ctrl + D` | kopyala / yapıştır / kes / çoğalt |
| `Ctrl + A` | tümünü seç |
| `Ctrl + Z / Y` | geri / ileri |
| `Ctrl + +/−/0` | zoom |
| `Shift + tık` | çoklu seçim |
| `Esc` | seçimi bırak / aracı iptal |
| `Ctrl + G`, `Ctrl + Shift + G` | grupla / çöz |
| `Ctrl + Alt + K` | bileşen yap |
| `Ctrl + S`, `Ctrl + Shift + E` | kaydet, klasöre export |
| `Ctrl + Shift + L` | tema değiştir |
| `Shift` sürükle | oran koru / düz çizgi |
| `Alt` sürükle | merkezden boyutlandır |
| Kalemde sağ tık | silgi |
| Çokgende çift tık / `Esc` | bitir |

---

## 11. Dizin yapısı

```
ivec-draw/
  package.json
  electron.vite.config.ts
  electron-builder.yml
  LICENSE                 # projenin kendi lisansı
  NOTICE                  # Apache-2.0 gereği: Lopaka'dan port edilen modüllerin listesi ve atıf
  electron/
    main/            pencere, menü, ipc, workspace indeksi, dosya io, backup
    preload/         güvenli köprü (contextBridge)
  src/
    app/             layout, router (home | editor), tema sağlayıcı, kısayol yöneticisi
    core/
      document/      model tipleri, komutlar, undo/redo, serializer (.ivec)
      render/        rasterizer (bresenham vb.), framebuffer, canvas painter, snapping
      devices/       profiller (json) + loader
      fonts/         bdf parser, ttf→bitmap, u8g2/gfx font kataloğu
      export/        IR + capabilities.ts + hedef modüller (u8g2, gfx, tft_espi, arduino_gfx, lvgl, flipper, gxepd2, esphome, micropython, raw, png)
      bitmap/        PixelGrid, codec'ler (encode/decode), dithering — UI bağımsız
      import/        görsel decode (canvas/gifuct), SVG temizleme, görsel sihirbazı hattı, byte-array parser
      components/    bileşen/instance çözümleme
    ui/
      home/          proje kartları, şablonlar, workspace seçici
      editor/        toolbar, canvas, layers, properties, code panel, assets, image dialog
      primitives/    buton, input, dropdown, tabs (Radix sarmalayıcılar)
      theme/         tokens.css, dark.css, light.css
    assets/
      icons/         dahili ikon setleri (Gaai, Flipper, pixel sets) + lisanslar
      templates/     örnek projeler
  tests/
    unit/            rasterizer, dithering, parser, serializer
    export/          golden dosyalar
    e2e/             playwright
```

---

## 12. Yol haritası

İlke: **önce SSD1306 + u8g2 üzerinde kusursuz çekirdek, sonra genişleme.** Uygulamanın asıl vaadi "önizleme = cihaz çıktısı, kod derlenir"; bu M3 sonunda tek hedefle kanıtlanmış olmalı.

| Aşama | Öncelik | Kapsam |
|---|---|---|
| **M0 — İskelet** | P0 | Electron (güvenli yapılandırma) + Vite + React + Tailwind; tema tokenları (dark/light); boş home + editör yerleşimi; IPC köprüsü; Lopaka klonu referans olarak `vendor/`'a değil `/tmp`'ye — kod port edildikçe NOTICE güncellenir |
| **M1 — Çekirdek editör** | P0 | Doküman modeli + command pattern **undo/redo (baştan, sonradan eklenmez)**, rasterizer (Lopaka `PixelatedDrawingRenderer` portu + u8g2 politikası, metin baseline kuralı), framebuffer önizleme, SSD1306 128×64 + özel çözünürlük, rect/line/ellipse/text/image/paint araçları, Layers, seçim/taşıma/boyutlandırma, **tek `.ivec` aç/kaydet** (workspace yok), referans katmanı |
| **M2 — Bitmap motoru** | P0 | `core/bitmap` codec'leri + test matrisi (5.6), görsel sihirbazı (parlaklık/kontrast/gri/iki ayrı invert), dithering, **GIF/çoklu kare → sprite seti**, toplu içe aktarma, byte-array in/out, "kodu kopyala" noktaları (5.3), Assets paneli, varlık kuralları (4.5), bitmap tekilleştirme |
| **M3 — Kod üretimi: u8g2 + Adafruit GFX** | P1 | IR (katman ağacı) + yetenek matrisi (8.1) + Lopaka üretici portu; önce **u8g2** (Arduino + ESP-IDF sözdizimi) yeşil, sonra **Adafruit GFX**; `export.targets` yapısı; kod paneli, kullanıcı önek/sonek kodu, değişkenler, C tanımlayıcı kuralları (4.6), klasöre export (işaretli bölge güncelleme), u8g2 font kataloğu + BDF önizleme, font kapsama kontrolü, kullanılan glif alt kümesi (GFX), bellek hesaplayıcı; golden + `arduino-cli` derleme testi |
| **M4 — Workspace** | P2 | Proje kütüphanesi, home kartları, autosave, backup, kurtarma, paket import/export, şablonlar, migrasyon altyapısı |
| **M5 — Figma katmanı** | P2 | Snapping, hizalama/dağıtma, ruler, bileşen sistemi, çoklu ekran kopyalama, bitmap'e birleştir, çevir/döndür, metin döndürme, kalem desenleri |
| **M6 — Hedef genişleme** | P3 | TFT_eSPI (RGB565 politikası, arc, sprite), TFT profilleri + rotasyon/ofset, Arduino_GFX, Flipper, GxEPD2, **TTF→u8g2 (`bdfconv` WASM)**, animasyon yardımcıları (`updateAnimations/drawAnimations`) |
| **M7 — Dağıtım** | P3 | electron-builder paketleri, imzalama, auto-update, Playwright e2e, kontrast testleri, i18n |
| **M8 — İleri hedefler** | P3 | LVGL v8/v9 (anti-alias politikası, widget katmanları), ESPHome, MicroPython/CircuitPython, Inkplate |
| **Sonra** | — | Seri port canlı önizleme (Flipper RPC portu dahil) + gerçek cihaz görüntüsüyle karşılaştırma, animasyon zaman çizelgesi, mevcut C kodunu içe aktarma (Lopaka parser portu, deneysel), sunum modu, BMP export, eklenti API'si, u8g2 WASM emülasyonu ile otomatik render eşitlik testi |

**İlk yayınlanabilir sürüm (v0.1) = M0–M3.** Tek dosya aç/kaydet, SSD1306, u8g2 + GFX, görsel sihirbazı. Lopaka'daki limit sorununu çözer ve ürünün ana vaadini kanıtlar. Workspace, bileşenler, snapping ve diğer hedefler v0.2+.

---

## 13. Açık kararlar / notlar
- İkon setleri lisansları `src/assets/icons/LICENSES.md` içinde tutulacak (Gaai, Flipper Zero açık; ücretli setler dahil edilmeyecek).
- Türkçe + İngilizce arayüz (i18n baştan, `i18next`).
- Proje adı ve uygulama kimliği: `ivec draw`, `com.ivec.draw`.
- Ürün hedefi: Lopaka arayüzünü kopyalamak değil; **görsel tasarımdan derlenen, cihazda birebir görünen gömülü koda güvenilir geçiş** sağlayan yerel ve sınırsız araç. Özellik önceliği bu cümleye göre verilir.

## 14. Dış inceleme notları (değerlendirildi)

### 14.1 İkinci inceleme (Lopaka repo karşılaştırmalı)
| Öneri | Karar |
|---|---|
| Sıfırdan yerine `sbrin/lopaka` fork | **Kısmen.** Tam fork yok (Vue 3, tek-ekran mimarisi, bizim modelle uyumsuz). Üreticiler, parser'lar, piksel rasterizer, font parser'ları, display listesi ve yetenek matrisi Apache-2.0 altında port edilir → 2.0 |
| GxEPD2, ESPHome, MicroPython, CircuitPython, ESP-IDF sözdizimi | Kabul → 8; ESP-IDF u8g2 varyantı M3'te, diğerleri M6/M8 |
| Önek/sonek kullanıcı kodu korunsun, kod import | Önek/sonek kabul → `userCode`, işaretli bölge güncelleme (M3). Kod import ertelendi (parser portu, "Sonra") |
| Özellik başına "değişken yap" | Kabul → düğümde `vars` haritası (M3) |
| GIF kare içe aktarma M2'ye, animasyon yardımcıları | Kabul → GIF/sprite seti M2, `updateAnimations/drawAnimations` M6 |
| Merge to bitmap, çevir/döndür, metin döndürme, referans katmanı, kalem desenleri, arc, LVGL widget | Kabul → 6.3; referans katmanı M1, diğerleri M5/M6/M8 |
| Parlaklık/kontrast, önce gri, iki ayrı invert, toplu import | Kabul → 5.2 |
| Sunum modu, BMP export, bitmap tekilleştirme, kullanılan glifler, C tanımlayıcı kuralları | Tekilleştirme + tanımlayıcı M2/M3 (4.6); glif alt kümesi M3 (GFX) / M6 (u8g2); sunum/BMP "Sonra" |
| Metin baseline farkları, hedef başına rasterizer profili | Kabul → 2.3 RenderPolicy `textOrigin` |
| Hedef başına yetenek matrisi | Kabul → 8.1 |
| `export` hedef başına | Kabul → `export.targets.<hedef>` |
| `.ivec` içinde base64 çift kayıt | Zaten düzeltilmişti → 4.4/4.5 |
| u8g2 font formatı özel, `bdfconv` gerekir | Kabul → 9: dahili fontlar sembol adıyla + BDF önizleme (Lopaka yöntemi), TTF→u8g2 için `bdfconv` WASM M6 |
| `sharp` native bağımlılık, renderer'da decode | Kabul → 2.4, main process'te native bağımlılık yok |
| Kapsam dar tutulsun; MVP tek dosya aç/kaydet, workspace sonra | Kabul → M1 "tek `.ivec` aç/kaydet", workspace M4; v0.1 = M0–M3 |
| MVP'de u8g2 + Adafruit GFX | Kabul → M3 (ilk inceleme "yalnız u8g2" demişti; ikinci hedef IR'ı doğruladığı için GFX eklendi) |
| MVP'de bir TFT profili | Red → TFT, RGB565 politikası ve renk UI'ı getirir; v0.1'i şişirir. M6 |

### 14.2 İlk inceleme
| Öneri | Karar |
|---|---|
| Hedefe göre ayrı render kuralı (OLED piksel, TFT renk, LVGL anti-alias) | Kabul → 2.3 RenderPolicy |
| Golden-file yetmez, gerçek derleme testi | Kabul → 8. bölüm, `arduino-cli` CI |
| Bitmap/byte motoru UI'dan bağımsız + 8 px sınırı, alfa, byte-swap testleri | Kabul → 5.6 |
| Orijinal tek kaynak, işlenmiş bitmap cache; eksik/bozuk varlık ve migrasyon | Kabul → 4.4/4.5 |
| Electron güvenlik yapılandırması, SVG temizleme, boyut sınırları | Kabul → 2.5 |
| Bellek hesaplayıcı | Kabul → 5.7, M3 |
| Cihaz rotasyonu ve ofset | Kabul → 7 |
| Türkçe karakter kapsama kontrolü | Kabul → 5.8, M3 |
| GxEPD2, ESPHome, MicroPython/CircuitPython hedefleri | Kabul, sonraki aşama → 8, M6/M8 |
| Undo/redo'yu P2'ye ertele | **Red.** Command pattern doküman modeliyle birlikte M1'de; sonradan eklenmesi tüm komutların yeniden yazılması demek |
| Gerçek cihaz görüntüsüyle karşılaştırma | Ertelendi → seri port ile birlikte "Sonra" |
| Mevcut C kodunu içe aktarma | Ertelendi → deneysel, "Sonra"; C parser kapsamı v1 için fazla |
| Gelişmiş animasyon | Zaten "Sonra"da; IR katman ağacı animasyon kareleri için genişletilebilir tutulur |
