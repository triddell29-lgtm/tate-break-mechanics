from playwright.sync_api import sync_playwright
import pathlib

base = pathlib.Path(__file__).parent

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    page = browser.new_page()
    page.goto(f"file://{base}/submission.html")
    page.pdf(
        path=str(base / "Tate Break - Tool Build (mechanics).pdf"),
        format="Letter",
        print_background=True,
    )
    browser.close()
print("done")
