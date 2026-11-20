#!/usr/bin/env python3
"""
scraper_katalog.py - katalog produk -> CSV 9 kolom untuk tab `Products` Google Sheets.

Kolom: id,region,name,brand,category,price,shelf_life,image_url,is_available

Pemakaian:
  python scraper_katalog.py primarasa --no-images --out primarasa.csv
  python scraper_katalog.py kartika --no-images --out kartikasari.csv
  python scraper_katalog.py cheesecuit --no-images --out cheesecuit.csv
  python scraper_katalog.py pdf katalog.pdf --brand primarasa

Opsi: --out hasil_scrap.csv   --no-images   --start 1

Setup:
  pip install playwright beautifulsoup4 Pillow requests
  playwright install chromium
"""
import argparse
import csv
import os
import re
import subprocess
import sys
from urllib.parse import urljoin, urlparse

COLUMNS = [
    "id",
    "region",
    "name",
    "brand",
    "category",
    "price",
    "shelf_life",
    "image_url",
    "is_available",
]
BRANDS = {
    "primarasa": ("Prima Rasa", "PR"),
    "cheesecuit": ("Bandung Cheesecuit", "CC"),
    "kartika": ("Kartika Sari", "KS"),
}
PR_URL = "https://www.primarasabakery.co.id/produk"
KS_URL = "https://www.kartikasari.com/id/products/semua-produk"
CC_URL = "https://bandungcheesecuit.com/produk/"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Merchandise bukan produk makanan -> dilewati
SKIP_WORDS = (
    "tshirt",
    "t-shirt",
    "tumbler",
    "magnet",
    "sticker",
    "keychain",
    "canvas bag",
    "foldable bag",
    "plush",
    "merch",
)

# Estimasi masa simpan bila sumber tidak mencantumkan
DEFAULT_SHELF = {
    "Bolen": "Tahan 3-4 Hari",
    "Pastry": "Tahan 3-4 Hari",
    "Brownies": "Tahan 5-7 Hari",
    "Cake": "Tahan 5-7 Hari",
    "Cheesecuit": "Wajib Kulkas / Tahan 2-3 Hari",
    "Dessert Box": "Wajib Kulkas / Tahan 2-3 Hari",
    "Kue Kering": "Tahan 1-2 Bulan",
    "Camilan": "Tahan 1-2 Bulan",
    "Hampers": "Tahan 1-2 Bulan",
}

# ---------------------------------------------------------------- klasifikasi
SAVORY = re.compile(
    r"\b(keripik|kripik|kerupuk|tempe|sale|basreng|oncom|kecimpring|cimpring|"
    r"selondok|ubi|usus|potato|grisini|sumpia|pangsit|pastel|kentang|"
    r"rengginang|samosa|kacang bandung|seblak|cuanki|mie|bandrek|dodol|"
    r"telur gabus|belut|paru)\b",
    re.I,
)
KUE_KERING = re.compile(
    r"(bagel|nastar|naastart|kastengel|kaastengel|lidah kucing|putri salju|"
    r"cookies|biscotti|almond slice|soes|semprit|macaroon|wafer|wafel|toast|"
    r"choco stick|cinnamon stick|cheese bites|sagu keju|finger|sweet stick|"
    r"astor|pia )",
    re.I,
)
PASTRY = re.compile(
    r"(pie|pastry|puff|roll|strudle|strudel|sausage|raugout|lilit|crispy|"
    r"picnic|cheese stick)",
    re.I,
)
CAKE = re.compile(
    r"(lapis|cake|bolu|rolltart|roll tart|chiffon|marmer|tart kombinasi|"
    r"kue balok|madeleines|proll|banana roll)",
    re.I,
)
HINTS = {
    "BROWNIES": "Brownies",
    "BOLU": "Cake",
    "BOLEN": "Pastry",
    "KUE KERING": "Kue Kering",
}


def classify(name, shelf="", hint=None):
    n = name.lower()
    if re.search(r"\(k\d+\w*\)", n) or "bulan" in shelf.lower():
        return "Camilan" if SAVORY.search(n) else "Kue Kering"
    if "hampers" in n:
        return "Hampers"
    if "lasagna" in n:
        return "Dessert Box"
    if any(w in n for w in ("cheesecuit", "bogel", "bongsor")):
        return "Cheesecuit"
    if "brownies" in n or "mixbro" in n:
        return "Brownies"
    if "bolen" in n or "bollen" in n:
        return "Bolen"
    if CAKE.search(n):
        return "Cake"
    if SAVORY.search(n):
        return "Camilan"
    if KUE_KERING.search(n):
        return "Kue Kering"
    if PASTRY.search(n):
        return "Pastry"
    return hint or "Pastry"


# ------------------------------------------------------------------- helper
def parse_price(text):
    """Ambil harga TERAKHIR ('Rp 190,000 Rp 180,000' -> 180000 = harga diskon)."""
    found = re.findall(r"R[pP]\.?\s*([\d.,]+)", text or "")
    return int(re.sub(r"\D", "", found[-1])) if found else 0


def extract_img_url(img, base_url):
    if not img:
        return ""
    src = (
        img.get("data-src")
        or img.get("data-lazy-src")
        or img.get("data-original")
        or ""
    )
    if not src and img.get("srcset"):
        parts = [p.strip().split()[0] for p in img["srcset"].split(",") if p.strip()]
        if parts:
            src = parts[-1]
    if not src:
        src = img.get("src") or ""
    if not src or src.startswith("data:") or "placeholder" in src.lower():
        return ""
    src = re.sub(r"-\d+x\d+(\.\w+)$", r"\1", src)
    return urljoin(base_url, src)


def scroll_page(page, max_steps=40):
    last = 0
    for _ in range(max_steps):
        page.mouse.wheel(0, 4000)
        page.wait_for_timeout(600)
        h = page.evaluate("document.body.scrollHeight")
        if h == last:
            break
        last = h


def fetch_html(url, scroll=True):
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(user_agent=UA)
        try:
            page.goto(url, wait_until="networkidle", timeout=60000)
        except Exception:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(2000)
        if scroll:
            scroll_page(page)
        html = page.content()
        browser.close()
    return html


def download_image(url, dest):
    import requests

    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        r.raise_for_status()
        try:
            from io import BytesIO
            from PIL import Image

            img = Image.open(BytesIO(r.content)).convert("RGB")
            img.save(dest, "JPEG", quality=85)
        except Exception:
            with open(dest, "wb") as f:
                f.write(r.content)
        return True
    except Exception as e:
        print(f"  ! gagal unduh {url}: {e}", file=sys.stderr)
        return False


def make_rows(items, brand_key, start=1, images=True):
    """items: dict(name, price, category, shelf_life, image_url)."""
    brand, ini = BRANDS[brand_key]
    img_dir = f"images_{brand_key}"
    if images:
        os.makedirs(img_dir, exist_ok=True)
    rows = []
    for i, it in enumerate(items, start):
        pid = f"PRD-{ini}-{i:03d}"
        cat = it["category"]
        if images and it.get("image_url", "").startswith("http"):
            download_image(it["image_url"], os.path.join(img_dir, f"{pid}.jpg"))
        rows.append(
            {
                "id": pid,
                "region": "BANDUNG",
                "name": it["name"],
                "brand": brand,
                "category": cat,
                "price": it["price"],
                "shelf_life": it.get("shelf_life") or DEFAULT_SHELF.get(cat, ""),
                "image_url": it.get("image_url", ""),
                "is_available": "TRUE",
            }
        )
    return rows


def write_csv(rows, path):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"OK: {len(rows)} baris -> {path}")
    zero = [r["id"] for r in rows if int(r["price"] or 0) == 0]
    if zero:
        print(f"PERINGATAN: {len(zero)} produk berharga 0: {zero[:10]}")


# --------------------------------------------------------- Prima Rasa Bakery
def scrape_primarasa(url=PR_URL):
    from bs4 import BeautifulSoup
    from playwright.sync_api import sync_playwright

    seen_names, items = set(), []
    visited_pages = set()
    queue = [url]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(user_agent=UA)

        while queue and len(visited_pages) < 20:
            current_url = queue.pop(0)
            if current_url in visited_pages:
                continue
            visited_pages.add(current_url)

            try:
                page.goto(current_url, wait_until="networkidle", timeout=60000)
            except Exception:
                page.goto(current_url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_timeout(2000)

            scroll_page(page)
            soup = BeautifulSoup(page.content(), "html.parser")

            # Deteksi kartu produk (WooCommerce maupun layout katalog kustom)
            cards = soup.select(
                "li.product, .product-small, .product-item, .produk-item, "
                "[class*='product-card'], [class*='produk-card'], article.product"
            )
            if not cards:
                cards = [
                    a
                    for a in soup.select("a[href*='/produk/'], a[href*='/product/']")
                    if a.find("img")
                    and urlparse(urljoin(current_url, a["href"])).path.rstrip("/")
                    != "/produk"
                ]

            for card in cards:
                img = card.find("img")
                src = extract_img_url(img, current_url)
                if not src or any(w in src.lower() for w in ("logo", "icon", "banner")):
                    continue

                title_el = card.select_one(
                    "h2, h3, h4, h5, .woocommerce-loop-product__title, "
                    ".product-title, .title, [class*='title'], [class*='name']"
                )
                texts = list(card.stripped_strings)
                name = (
                    title_el.get_text(" ", strip=True)
                    if title_el
                    else (
                        img.get("alt", "").strip()
                        if img and img.get("alt")
                        else (texts[0] if texts else "")
                    )
                )
                name = re.sub(r"\s+", " ", name).strip()
                if not name or len(name) < 3:
                    continue
                if any(w in name.lower() for w in SKIP_WORDS):
                    continue

                key = name.lower()
                if key in seen_names:
                    continue
                seen_names.add(key)

                price = parse_price(" ".join(texts))
                items.append(
                    {
                        "name": name,
                        "price": price,
                        "category": classify(name),
                        "image_url": src,
                    }
                )

            # Cek halaman berikutnya (pagination) bila ada
            for next_a in soup.select(
                "a.next, a[rel='next'], .pagination a, a.page-numbers"
            ):
                href = next_a.get("href")
                if not href or href.startswith("#"):
                    continue
                full_next = urljoin(current_url, href)
                if (
                    urlparse(full_next).netloc == urlparse(url).netloc
                    and "/produk" in urlparse(full_next).path
                    and full_next not in visited_pages
                    and full_next not in queue
                ):
                    queue.append(full_next)

        browser.close()

    return items


# -------------------------------------------------------------- Kartika Sari
def scrape_kartika(url=KS_URL):
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(fetch_html(url), "html.parser")
    seen, items = set(), []
    for a in soup.select('a[href*="/details"]'):
        href = urljoin(url, a["href"])
        m = re.search(r"/products/(\d+)/details", href)
        if not m or m.group(1) in seen:
            continue
        seen.add(m.group(1))
        img = a.find("img")
        texts = list(a.stripped_strings)
        name = (
            img.get("alt")
            if img and img.get("alt")
            else (texts[0] if texts else "")
        ).strip()
        name = re.sub(r"\s*\d+%\s*Off\s*$", "", name).strip()
        if not name or any(w in name.lower() for w in SKIP_WORDS):
            continue
        src = extract_img_url(img, url)
        items.append(
            {
                "name": name,
                "price": parse_price(" ".join(texts)),
                "category": classify(name),
                "image_url": src,
            }
        )
    return items


# ---------------------------------------------------------- Bandung Cheesecuit
def scrape_cheesecuit(url=CC_URL):
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(fetch_html(url), "html.parser")
    section, items = "", []
    for h in soup.find_all(["h2", "h3", "h4"]):
        a = h.find("a", href=re.compile(r"/shop/"))
        if not a:
            section = h.get_text(strip=True)
            continue
        name = a.get_text(strip=True)
        price_txt = h.find_next(string=re.compile(r"Rp\s?[\d.,]+"))
        img = h.find_previous("img")
        src = extract_img_url(img, url)
        if name.lower().startswith("bogel"):
            name = "Cheesecuit " + name
        elif section.strip().lower() == "cheesecuit":
            name += " (Reguler)"
        items.append(
            {
                "name": name,
                "price": parse_price(str(price_txt)),
                "category": classify(name),
                "image_url": src,
            }
        )
    return items


# ------------------------------------------------------------------ PDF harga
PRICE_RE = re.compile(r"R[Pp]\.?\s*(\d[\d.]*)\s*/\s*([A-Za-z]+)")
PAIR_RE = re.compile(r"R[Pp]\.?\s*(\d[\d.]*)\s*/\s*(\d{2,3}\.\d{3})\b")
WEIGHT_RE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:gram|gr|g)\b", re.I)
TYPOS = {"BRWONIES": "BROWNIES", "CHESE": "CHEESE"}


def fmt_shelf(raw):
    r = raw.lower().strip()
    if not r:
        return ""
    if m := re.search(r"(\d+)\s*bulan", r):
        return f"Tahan {m.group(1)} Bulan"
    if "dikulkas" in r:
        d = re.search(r"(\d+)\s*hari", r)
        return f"Wajib Kulkas / Tahan {d.group(1)} Hari" if d else raw.strip()
    parts = []
    if m := re.search(r"(\d+)\s*hari\s*diluar", r):
        parts.append(f"{m.group(1)} Hari (Luar)")
    if m := re.search(r"(\d+)\s*hari\s*kulkas", r):
        parts.append(f"{m.group(1)} Hari (Kulkas)")
    return "Tahan " + " / ".join(parts) if parts else raw.strip()


def nice_name(name):
    for a, b in TYPOS.items():
        name = re.sub(rf"\b{a}\b", b, name)
    name = re.sub(r"\s*\((?:K\d+\w*|[A-Z]{2,4}\d?)\)", "", name)
    name = name.title()
    name = re.sub(r"\bPr\b", "PR", name)
    name = re.sub(r"\bSpc\b", "SPC", name)
    return re.sub(r"\s+", " ", name).strip()


def fmt_weight(w):
    return re.sub(r"\s*(gram|gr|g)$", " gr", w.strip(), flags=re.I) if w else ""


def parse_prima_line(raw):
    s = raw.replace("\f", "").rstrip()
    st = s.strip()
    if not st:
        return None
    if st.isupper() and st.startswith("ANEKA"):
        return ("section", st)
    if re.search(r"NAMA PRODUK|PESANAN|HARGA PRODUK|PRODUK ASLI|JUMLAH", st):
        return None
    m = PAIR_RE.search(s) or PRICE_RE.search(s)
    if m:
        name, rest = s[: m.start()].strip(), s[m.end() :]
        if m.re is PAIR_RE:
            price = [
                (int(m.group(1).replace(".", "")), "Kecil"),
                (int(m.group(2).replace(".", "")), "Besar"),
            ]
            unit = ""
        else:
            price = int(m.group(1).replace(".", ""))
            unit = m.group(2)
    else:
        mm = re.match(r"^(\S.*?)\s{2,}(\d+\s*(?:bulan|hari).*)$", s, re.I)
        if not mm:
            return None
        name, rest, price, unit = mm.group(1).strip(), mm.group(2), None, ""
    weight = ""
    if wm := WEIGHT_RE.search(rest):
        weight = fmt_weight(wm.group(0))
        rest = rest[: wm.start()] + rest[wm.end() :]
    return (
        "line",
        {
            "name": name,
            "price": price,
            "unit": unit,
            "shelf": rest.strip(),
            "weight": weight,
        },
    )


def parse_prima_text(text):
    lines = []
    for raw in text.splitlines():
        if "Catatan :" in raw:
            break
        p = parse_prima_line(raw)
        if p:
            lines.append(p)
    items, hint, i = [], None, 0

    def emit(name, price, shelf_raw, weight, extra=""):
        base = nice_name(name)
        label = base + (f" ({extra})" if extra else "")
        if weight and not extra:
            label += f" ({weight})"
        items.append(
            {
                "name": label,
                "price": price,
                "category": classify(name, shelf_raw, hint),
                "shelf_life": fmt_shelf(shelf_raw),
                "image_url": "",
            }
        )

    while i < len(lines):
        kind, d = lines[i]
        if kind == "section":
            hint = next((v for k, v in HINTS.items() if k in d), hint)
            i += 1
        elif kind == "line" and d["name"] and d["price"] is not None:
            if isinstance(d["price"], list):
                for pr, size in d["price"]:
                    emit(
                        d["name"].replace("KECIL/BESAR", size.upper()),
                        pr,
                        d["shelf"],
                        d["weight"],
                    )
            else:
                emit(d["name"], d["price"], d["shelf"], d["weight"])
            i += 1
        elif kind == "line" and not d["name"]:
            before = []
            while i < len(lines) and lines[i][0] == "line" and not lines[i][1]["name"]:
                before.append(lines[i][1])
                i += 1
            head = lines[i][1]
            i += 1
            n = len(before)
            after = [lines[i + k][1] for k in range(n)]
            i += n
            cluster = (
                before + ([head] if head["price"] is not None else []) + after
            )
            for c in cluster:
                emit(
                    head["name"],
                    c["price"],
                    c["shelf"],
                    c["weight"],
                    extra=f"{c['unit'].title()} {c['weight']}".strip(),
                )
        else:
            i += 1
    return items


def scrape_pdf(path, brand_key, images=True):
    try:
        text = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except FileNotFoundError:
        sys.exit("pdftotext tidak ada. Install: sudo apt-get install poppler-utils")
    items = parse_prima_text(text)
    if images:
        extract_pdf_images(path, brand_key, items)
    return items


def extract_pdf_images(path, brand_key, items):
    import pymupdf

    out = f"images_{brand_key}"
    os.makedirs(out, exist_ok=True)
    found = []
    doc = pymupdf.open(path)
    for pno, page in enumerate(doc, 1):
        for n, info in enumerate(page.get_images(full=True), 1):
            pix = pymupdf.Pixmap(doc, info[0])
            if pix.width < 100 or pix.height < 100 or pix.width / pix.height > 4:
                continue
            if pix.n - pix.alpha >= 4:
                pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
            found.append((pno, n, pix))
    ini = BRANDS[brand_key][1]
    for k, (pno, n, pix) in enumerate(found, 1):
        fname = (
            f"PRD-{ini}-{k:03d}.jpg"
            if len(found) == len(items)
            else f"page{pno}_img{n}.jpg"
        )
        pix.save(os.path.join(out, fname))
    if found and len(found) != len(items):
        print(
            f"CATATAN: {len(found)} gambar vs {len(items)} produk; "
            f"cocokkan manual di ./{out}/"
        )
    if not found:
        print("CATATAN: tidak ada gambar produk di PDF (kolom image_url dikosongkan).")


# --------------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("source", choices=["primarasa", "kartika", "cheesecuit", "pdf"])
    ap.add_argument("file", nargs="?", help="path PDF (mode pdf)")
    ap.add_argument("--brand", default="primarasa", choices=list(BRANDS))
    ap.add_argument("--out", default="hasil_scrap.csv")
    ap.add_argument("--start", type=int, default=1, help="nomor id awal")
    ap.add_argument("--no-images", action="store_true")
    a = ap.parse_args()
    images = not a.no_images

    if a.source == "primarasa":
        brand, items = "primarasa", scrape_primarasa()
    elif a.source == "kartika":
        brand, items = "kartika", scrape_kartika()
    elif a.source == "cheesecuit":
        brand, items = "cheesecuit", scrape_cheesecuit()
    else:
        if not a.file:
            sys.exit("Mode pdf butuh path file: scraper_katalog.py pdf katalog.pdf")
        brand, items = a.brand, scrape_pdf(a.file, a.brand, images)

    write_csv(make_rows(items, brand, a.start, images and a.source != "pdf"), a.out)


if __name__ == "__main__":
    main()