import json
import os
import random
import time
import urllib.error
import urllib.request

from playwright.sync_api import sync_playwright


API_URL = os.environ.get("YESTION_API_URL", "http://localhost:18084")
WEB_URL = os.environ.get("YESTION_WEB_URL", "http://localhost:3100")
AUTH_TOKEN = os.environ.get("YESTION_AUTH_TOKEN", "")


def api(method: str, path: str, payload: dict | None = None) -> dict | None:
    data = None if payload is None else json.dumps(payload).encode()
    request = urllib.request.Request(
        API_URL + path,
        data=data,
        method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AUTH_TOKEN}",
        },
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def paragraph(text: str = "Paragraph") -> dict:
    return {"type": "paragraph", "content": [{"type": "text", "text": text}]}


def random_words() -> str:
    words = [
        "alpha",
        "beta",
        "gamma",
        "render",
        "document",
        "editor",
        "Yestion",
        "随机",
        "稳定",
        "测试",
        "block",
        "node",
        "table",
        "list",
        "system",
    ]
    return " ".join(random.choice(words) for _ in range(random.randint(3, 10)))


def random_node(index: int) -> dict:
    kind = index % 14
    if kind == 0:
        return {
            "type": "heading",
            "attrs": {"level": random.randint(1, 4)},
            "content": [{"type": "text", "text": f"Heading {index} {random_words()}"}],
        }
    if kind == 1:
        return {
            "type": "bulletList",
            "content": [
                {
                    "type": "listItem",
                    "content": [paragraph(f"Bullet {j} {random_words()}")],
                }
                for j in range(random.randint(1, 4))
            ],
        }
    if kind == 2:
        return {
            "type": "orderedList",
            "attrs": {"start": 1},
            "content": [
                {
                    "type": "listItem",
                    "content": [paragraph(f"Order {j} {random_words()}")],
                }
                for j in range(random.randint(1, 4))
            ],
        }
    if kind == 3:
        return {
            "type": "taskList",
            "content": [
                {
                    "type": "taskItem",
                    "attrs": {"checked": bool(random.getrandbits(1))},
                    "content": [paragraph(f"Task {j} {random_words()}")],
                }
                for j in range(random.randint(1, 4))
            ],
        }
    if kind == 4:
        return {
            "type": "blockquote",
            "content": [paragraph(f"Quote {random_words()}")],
        }
    if kind == 5:
        return {
            "type": "codeBlock",
            "content": [
                {
                    "type": "text",
                    "text": f"console.log('doc {index}');\n// {random_words()}\n",
                }
            ],
        }
    if kind == 6:
        return {"type": "horizontalRule"}
    if kind == 7:
        header = {
            "type": "tableRow",
            "content": [
                {"type": "tableHeader", "content": [paragraph(f"Col {j}")]}
                for j in range(3)
            ],
        }
        rows = [
            {
                "type": "tableRow",
                "content": [
                    {
                        "type": "tableCell",
                        "content": [paragraph(f"R{r}C{j} {random_words()}")],
                    }
                    for j in range(3)
                ],
            }
            for r in range(2)
        ]
        return {"type": "table", "content": [header, *rows]}
    if kind == 8:
        return {
            "type": "details",
            "content": [
                {
                    "type": "detailsSummary",
                    "content": [{"type": "text", "text": f"Details {random_words()}"}],
                },
                {
                    "type": "detailsContent",
                    "content": [paragraph(f"Hidden {random_words()}")],
                },
            ],
        }
    if kind == 9:
        return {
            "type": "callout",
            "attrs": {"color": "blue", "emoji": "💡"},
            "content": [paragraph(f"Callout {random_words()}")],
        }
    if kind == 10:
        return {
            "type": "paragraph",
            "content": [
                {"type": "text", "text": "Bold ", "marks": [{"type": "bold"}]},
                {
                    "type": "text",
                    "text": "and italic ",
                    "marks": [{"type": "italic"}],
                },
                {"type": "text", "text": random_words()},
            ],
        }
    if kind == 11:
        return {
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": f"Section {random_words()}"}],
        }
    if kind == 12:
        return {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": "Link ",
                    "marks": [
                        {
                            "type": "link",
                            "attrs": {
                                "href": "https://example.com",
                                "target": "_blank",
                            },
                        }
                    ],
                },
                {"type": "text", "text": random_words()},
            ],
        }
    return paragraph(f"Paragraph {random_words()}")


def make_document(seed: int) -> dict:
    random.seed(seed)
    content = [random_node(i) for i in range(random.randint(8, 22))]
    return {"type": "doc", "content": content}


def main() -> None:
    if not AUTH_TOKEN:
        raise SystemExit("YESTION_AUTH_TOKEN is required")

    workspace_name = f"Playwright Stress Test {int(time.time())}"
    workspace = api("POST", "/api/workspaces", {"name": workspace_name})["workspace"]

    pages = []
    for index in range(30):
        title = (
            f"Random Doc {index:02d} · "
            f"{random.choice(['渲染', '表格', '列表', '引用', '代码', 'Callout', 'Detail', '系统', '稳定', 'Yestion'])}"
        )
        block = api(
            "POST",
            "/api/blocks",
            {
                "workspaceId": workspace["id"],
                "parentId": None,
                "type": "page",
                "title": title,
            },
        )["block"]
        document = make_document(index * 777 + 13)
        api(
            "PATCH",
            f"/api/blocks/{block['id']}",
            {"properties": {"title": title, "content": document}},
        )
        pages.append({"id": block["id"], "title": title})

    page_errors = []
    console_messages = []
    bad_responses = []
    loaded = 0

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(
            color_scheme="dark",
            viewport={"width": 1440, "height": 1000},
        )
        context.add_cookies(
            [
                {
                    "name": "auth_token",
                    "value": AUTH_TOKEN,
                    "domain": "localhost",
                    "path": "/",
                    "sameSite": "Lax",
                }
            ]
        )
        context.add_init_script(
            f"localStorage.setItem('yestion.activeWorkspaceId','{workspace['id']}');"
            "localStorage.setItem('yestion.theme','dark');"
        )

        page = context.new_page()
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))
        page.on(
            "console",
            lambda message: console_messages.append((message.type, message.text))
            if message.type in ("error", "warning")
            else None,
        )
        page.on(
            "response",
            lambda response: bad_responses.append((response.status, response.url))
            if response.status >= 400
            else None,
        )

        page.goto(WEB_URL + "/dashboard", wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(1200)

        for item in pages:
            locator = page.locator("aside").get_by_text(item["title"], exact=True).first
            locator.scroll_into_view_if_needed(timeout=2000)
            locator.click(timeout=3000)
            page.wait_for_timeout(250)
            loaded += 1
            if page.locator(".block-editor").count() == 0:
                page_errors.append(f"Missing editor for {item['title']}")

        page.screenshot(path="/tmp/yestion-random-doc-stress.png")
        browser.close()

    report = {
        "workspaceId": workspace["id"],
        "pagesCreated": len(pages),
        "pagesLoaded": loaded,
        "pageErrors": page_errors,
        "consoleErrorOrWarning": console_messages,
        "badHttpResponses": bad_responses,
        "passed": not page_errors and not console_messages and not bad_responses,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
