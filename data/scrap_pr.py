import csv
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

START_URL = "https://www.primarasabakery.co.id/produk"
OUT_CSV = "data/primarasa.csv"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

COLUMNS = [
    "id", "region", "name", "brand", "category",
    "price", "shelf_life", "image_url", "is_available",
]

DEFAULT_SHELF = {
    "Bolen": "Tahan 3-4 Hari",
    "Pastry": "Tahan 3-4 Hari",
    "Brownies": "Tahan 5-7 Hari",
    "Cake": "Tahan 5-7 Hari",
    "Kue Kering": "Tahan 1-2 Bulan",
    "Camilan": "Tahan 1-2 Bulan",
    "Hampers": "Tahan 1-2 Bulan",
}

SAVORY = re.compile(
    r"\b(keripik|kripik|kerupuk|tempe|sale|basreng|oncom|kecimpring|cimpring|"
    r"selondok|ubi|usus|potato|grisini|sumpia|pangsit|pastel|kentang|"
    r"rengginang|samosa|kacang|seblak|cuanki|mie|bandrek|dodol|telur gabus)\b",
    re.I,
)
KUE_KERING = re.compile(
    r"(bagel|nastar|kastengel|lidah kucing|putri salju|cookies|biscotti|"
    r"almond slice|soes|semprit|macaroon|wafer|wafel|toast|choco stick|"
    r"cinnamon stick|cheese bites|sagu keju|finger|sweet stick|astor|pia)",
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


def classify(name):
    n = name.lower()
    if "hampers" in n:
        return "Hampers"
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
    return "Pastry"


def parse_price(text):
    found = re.findall(r"R[pP]\.?\s*([\d.,]+)", text or "")
    return int(re.sub(r"\D", "", found[-1])) if found else 0


def get_img_src(el, base_url):
    if el.name == "img":
        src = (
            el.get("data-src")
            or el.get("data-lazy-src")
            or el.get("data-original")
            or el.get("src")
            or ""
        )
    else:
        style = el.get("style") or ""
        m = re.search(r"url\(['\"]?([^'\")]+)['\"]?\)", style)
        src = m.group(1) if m else ""
    if not src or src.startswith("data:"):
        return ""
    low = src.lower()
    if any(k in low for k in ("logo", "icon", "favicon", "banner", "slider", "avatar", ".svg")):
        return ""
    return urljoin(base_url, src)


def main():
    seen_names = set()
    items = []
    visited = set()
    queue = [START_URL]
    base_domain = urlparse(START_URL).netloc

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=UA, viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        while queue and len(visited) < 30:
            url = queue.pop(0)
            if url in visited:
                continue
            visited.add(url)
            print(f"Membuka: {url}", flush=True)

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2500)
            except Exception as e:
                print(f"  Gagal buka {url}: {e}", flush=True)
                continue

            for _ in range(15):
                page.mouse.wheel(0, 2000)
                page.wait_for_timeout(300)

            soup = BeautifulSoup(page.content(), "html.parser")
            if len(visited) == 1:
                t = soup.title.string.strip() if soup.title and soup.title.string else "-"
                print(f"  Judul halaman: {t}", flush=True)

            # Telusuri sub-halaman kategori / paginasi produk
            for a in soup.select("a[href]"):
                href = urljoin(url, a["href"]).split("#")[0]
                parsed = urlparse(href)
                if parsed.netloc != base_domain:
                    continue
                path_low = parsed.path.lower()
                if (
                    any(k in path_low for k in ("/produk", "/product", "/kategori", "/category"))
                    or "page" in parsed.query.lower()
                ):
                    if (
                        href not in visited
                        and href not in queue
                        and href.rstrip("/") != START_URL.rstrip("/")
                    ):
                        queue.append(href)

            before_count = len(items)
            media_els = soup.find_all("img") + soup.select("[style*='background-image']")

            for el in media_els:
                src = get_img_src(el, url)
                if not src:
                    continue

                card = el
                title = ""
                price = 0
                for _ in range(4):
                    if not card.parent:
                        break
                    card = card.parent
                    heading = card.select_one(
                        "h1, h2, h3, h4, h5, h6, .title, .product-title, [class*='title'], [class*='name']"
                    )
                    if heading:
                        cand = re.sub(r"\s+", " ", heading.get_text(" ", strip=True)).strip()
                        if 3 <= len(cand) <= 80:
                            title = cand
                            price = parse_price(card.get_text(" ", strip=True))
                            break

                if not title and el.name == "img" and el.get("alt"):
                    cand = re.sub(r"\s+", " ", el.get("alt")).strip()
                    if 3 <= len(cand) <= 80:
                        title = cand

                if not title:
                    continue

                low_t = title.lower()
                if any(
                    w in low_t
                    for w in ("prima rasa", "tentang kami", "outlet", "kontak", "artikel", "berita", "promo", "home", "beranda")
                ):
                    continue

                if low_t in seen_names:
                    continue
                seen_names.add(low_t)

                cat = classify(title)
                items.append(
                    {
                        "id": f"PRD-PR-{len(items)+1:03d}",
                        "region": "BANDUNG",
                        "name": title,
                        "brand": "Prima Rasa",
                        "category": cat,
                        "price": price,
                        "shelf_life": DEFAULT_SHELF.get(cat, ""),
                        "image_url": src,
                        "is_available": "TRUE",
                    }
                )

            print(f"  -> +{len(items) - before_count} produk (total: {len(items)})", flush=True)

        if not items:
            print("\nDEBUG - Struktur halaman pertama:", flush=True)
            for a in soup.select("a[href]")[:15]:
                print("  LINK:", a.get("href"), "|", a.get_text(strip=True)[:40])
            for im in soup.find_all("img")[:15]:
                print("  IMG:", im.get("src"), "| alt:", im.get("alt"))

        browser.close()

    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(items)
    print(f"\nSELESAI: {len(items)} produk tersimpan di {OUT_CSV}")


if __name__ == "__main__":
    main()