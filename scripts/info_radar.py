#!/usr/bin/env python3
"""Info Radar helper: fetch AI HOT data, score items, and write a Chinese digest."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import ssl
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
CN_TZ = timezone(timedelta(hours=8))
DEFAULT_TIMEOUT = 12


@dataclass
class Item:
    title: str
    summary: str = ""
    source: str = ""
    url: str = ""
    platform: str = ""
    source_type: str = ""
    rank: int | None = None
    hot: str = ""
    published_at: str = ""
    category: str = ""
    keywords: list[str] = field(default_factory=list)
    source_count: int = 1
    score: int = 0
    risk: str = ""
    why: str = ""
    angle: str = ""
    hook: str = ""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_json(url: str, allow_insecure: bool = False, timeout: int = DEFAULT_TIMEOUT) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    context = ssl._create_unverified_context() if allow_insecure else None
    with urllib.request.urlopen(req, timeout=timeout, context=context) as resp:
        return json.loads(resp.read().decode("utf-8"))


def build_aihot_url(
    query: str | None = None,
    category: str | None = None,
    mode: str = "selected",
    hours: int | None = None,
    days: int | None = None,
    take: int = 50,
) -> str:
    params: dict[str, str] = {"take": str(take), "mode": mode}
    if category:
        params["category"] = category
    if query:
        params["q"] = query
    if hours or days:
        params["since"] = iso_since(hours, days)
    return "https://aihot.virxact.com/api/public/items?" + urllib.parse.urlencode(params)


def fetch_aihot_items(
    query: str | None = None,
    category: str | None = None,
    mode: str = "selected",
    hours: int | None = None,
    days: int | None = None,
    take: int = 50,
    insecure: bool = False,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    return fetch_json(
        build_aihot_url(
            query=query,
            category=category,
            mode=mode,
            hours=hours,
            days=days,
            take=take,
        ),
        allow_insecure=insecure,
        timeout=timeout,
    )


def fetch_github_items(
    query: str,
    sort: str = "updated",
    take: int = 20,
    insecure: bool = False,
    timeout: int = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    params = {
        "q": query,
        "sort": sort,
        "order": "desc",
        "per_page": str(take),
    }
    url = "https://api.github.com/search/repositories?" + urllib.parse.urlencode(params)
    data = fetch_json(url, allow_insecure=insecure, timeout=timeout)
    items = []
    for repo in data.get("items", []):
        if not isinstance(repo, dict):
            continue
        stars = repo.get("stargazers_count") or 0
        forks = repo.get("forks_count") or 0
        issues = repo.get("open_issues_count") or 0
        topics = repo.get("topics") if isinstance(repo.get("topics"), list) else []
        items.append(
            {
                "title": repo.get("full_name") or repo.get("name") or "",
                "summary": repo.get("description") or "",
                "source": "GitHub",
                "url": repo.get("html_url") or "",
                "platform": "GitHub",
                "sourceType": "developer",
                "hot": f"{stars} stars / {forks} forks / {issues} open issues",
                "publishedAt": repo.get("updated_at") or repo.get("created_at") or "",
                "category": repo.get("language") or "",
                "keywords": topics,
                "metrics": {
                    "stars": stars,
                    "forks": forks,
                    "openIssues": issues,
                    "updatedAt": repo.get("updated_at"),
                    "createdAt": repo.get("created_at"),
                    "license": (repo.get("license") or {}).get("spdx_id") if isinstance(repo.get("license"), dict) else None,
                },
            }
        )
    return {"count": len(items), "items": items}


def iso_since(hours: int | None, days: int | None) -> str:
    now = datetime.now(timezone.utc)
    if hours:
        start = now - timedelta(hours=hours)
    else:
        start = now - timedelta(days=days or 7)
    return start.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def command_fetch_aihot(args: argparse.Namespace) -> int:
    data = fetch_aihot_items(
        query=args.query,
        category=args.category,
        mode=args.mode,
        hours=args.hours,
        days=args.days,
        take=args.take,
        insecure=args.insecure,
        timeout=args.timeout,
    )
    output = Path(args.output) if args.output else Path("aihot-items.json")
    dump_json(output, data)
    print(str(output.resolve()))
    return 0


def command_fetch_github(args: argparse.Namespace) -> int:
    data = fetch_github_items(args.query, sort=args.sort, take=args.take, insecure=args.insecure, timeout=args.timeout)
    output = Path(args.output) if args.output else Path("github-repositories.json")
    dump_json(output, data)
    print(str(output.resolve()))
    return 0


def parse_time(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def text_key(text: str) -> str:
    text = text.lower()
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[\W_]+", "", text, flags=re.UNICODE)
    for suffix in ("热搜", "最新消息", "官方回应", "冲上热搜"):
        text = text.replace(suffix, "")
    return text[:80]


def number_from_hot(value: Any) -> float:
    if value is None:
        return 0.0
    text = str(value)
    nums = re.findall(r"\d+(?:\.\d+)?", text)
    if not nums:
        return 0.0
    num = float(nums[0])
    if "亿" in text:
        num *= 100000000
    elif "万" in text or "w" in text.lower():
        num *= 10000
    return num


def as_list(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        if isinstance(data.get("items"), list):
            return [x for x in data["items"] if isinstance(x, dict)]
        if isinstance(data.get("data"), list):
            return [x for x in data["data"] if isinstance(x, dict)]
        if isinstance(data.get("sections"), list):
            rows: list[dict[str, Any]] = []
            for section in data["sections"]:
                label = section.get("label", "") if isinstance(section, dict) else ""
                for item in section.get("items", []):
                    if isinstance(item, dict):
                        copied = dict(item)
                        copied.setdefault("category", label)
                        rows.append(copied)
            return rows
    return []


def normalize(raw: dict[str, Any]) -> Item | None:
    title = str(raw.get("title") or raw.get("name") or raw.get("topic") or "").strip()
    if not title:
        return None
    rank = raw.get("rank")
    try:
        rank_value = int(rank) if rank is not None and str(rank).isdigit() else None
    except ValueError:
        rank_value = None
    return Item(
        title=title,
        summary=str(raw.get("summary") or raw.get("desc") or raw.get("description") or "").strip(),
        source=str(raw.get("source") or raw.get("sourceName") or raw.get("site") or "").strip(),
        url=str(raw.get("url") or raw.get("sourceUrl") or raw.get("link") or "").strip(),
        platform=str(raw.get("platform") or raw.get("collector") or "").strip(),
        source_type=str(raw.get("sourceType") or raw.get("source_type") or "").strip(),
        rank=rank_value,
        hot=str(raw.get("hot") or raw.get("heat") or raw.get("score") or raw.get("views") or "").strip(),
        published_at=str(raw.get("publishedAt") or raw.get("time") or raw.get("date") or "").strip(),
        category=str(raw.get("category") or "").strip(),
        keywords=[str(x) for x in raw.get("keywords", []) if str(x).strip()]
        if isinstance(raw.get("keywords"), list)
        else [],
    )


def dedupe(items: list[Item]) -> list[Item]:
    by_key: dict[str, Item] = {}
    for item in items:
        key = item.url.lower().rstrip("/") if item.url else text_key(item.title)
        if key in by_key:
            old = by_key[key]
            old.source_count += 1
            if item.source and item.source not in old.source:
                old.source = f"{old.source} / {item.source}" if old.source else item.source
            if not old.summary and item.summary:
                old.summary = item.summary
            if not old.url and item.url:
                old.url = item.url
        else:
            by_key[key] = item
    return list(by_key.values())


def story_terms(text: str) -> int:
    terms = [
        "首次",
        "发布",
        "开源",
        "融资",
        "收购",
        "裁员",
        "禁令",
        "监管",
        "争议",
        "回应",
        "反转",
        "突破",
        "下架",
        "上线",
        "盈利",
        "亏损",
        "AI",
        "Agent",
        "OpenAI",
        "Anthropic",
        "Gemini",
        "GPT",
        "模型",
        "芯片",
        "算力",
    ]
    return sum(1 for term in terms if term.lower() in text.lower())


def score_item(item: Item, keywords: list[str]) -> None:
    now = datetime.now(timezone.utc)
    score = 35

    dt = parse_time(item.published_at)
    if dt:
        age_hours = max((now - dt).total_seconds() / 3600, 0)
        if age_hours <= 24:
            score += 20
        elif age_hours <= 72:
            score += 12
        elif age_hours <= 168:
            score += 6
    else:
        score += 6

    if item.rank:
        if item.rank <= 3:
            score += 18
        elif item.rank <= 10:
            score += 12
        elif item.rank <= 30:
            score += 6

    hot_num = number_from_hot(item.hot)
    if hot_num:
        score += min(15, int(math.log10(max(hot_num, 10)) * 2))

    score += min(18, (item.source_count - 1) * 6)

    source_text = item.source.lower()
    if any(x in source_text for x in ["官方", "blog", "github", "reuters", "ap", "财联社", "新华社"]):
        score += 10
    elif any(x in source_text for x in ["x", "微博", "知乎", "抖音"]):
        score += 3
    elif item.source:
        score += 6

    combined = f"{item.title} {item.summary}"
    score += min(20, story_terms(combined) * 3)
    if item.source_type == "developer" or "github" in source_text:
        score += 8
        stars = number_from_hot(item.hot)
        if stars >= 10000:
            score += 12
        elif stars >= 1000:
            score += 8
        elif stars >= 100:
            score += 4
    for keyword in keywords:
        if keyword and keyword.lower() in combined.lower():
            score += 8

    risk_parts = []
    if not item.url:
        risk_parts.append("缺少原始链接")
    if item.source_count == 1 and any(x in source_text for x in ["x", "微博", "抖音", "小红书"]):
        risk_parts.append("单一社媒来源")
    if any(x in combined for x in ["网传", "疑似", "爆料", "传言"]):
        risk_parts.append("含未证实表述")
    if item.source_type == "developer" and item.source_count == 1:
        risk_parts.append("单一开源仓库信号")
    if risk_parts:
        score -= 8

    item.score = max(0, min(100, score))
    item.risk = "；".join(risk_parts) if risk_parts else "暂无明显风险"
    item.why = build_why(item)
    item.angle = build_angle(item)
    item.hook = build_hook(item)


def build_why(item: Item) -> str:
    if item.source_count > 1:
        return f"多个来源同时出现，说明注意力正在聚集；{item.summary[:80] or '需要进一步核对细节。'}"
    if item.rank and item.rank <= 10:
        return f"榜单排名靠前，适合判断大众注意力；{item.summary[:80] or '需要补充背景。'}"
    return item.summary[:100] or "有潜在信息价值，但需要补充背景和来源核对。"


def build_angle(item: Item) -> str:
    text = f"{item.title} {item.summary}"
    if any(x in text for x in ["裁员", "失业", "替代"]):
        return "从“AI 影响具体工作岗位”切入，讲清楚谁受影响、为什么现在发生。"
    if any(x in text for x in ["开源", "发布", "上线", "模型"]):
        return "从“新能力到底解决什么问题”切入，避免只复述发布信息。"
    if any(x in text for x in ["融资", "盈利", "亏损", "收购"]):
        return "从“商业化信号”切入，解释钱流向哪里、行业预期变了什么。"
    if any(x in text for x in ["监管", "禁令", "政策"]):
        return "从“规则变化”切入，说明对公司、用户和创作者分别意味着什么。"
    return "从“为什么这件事值得普通人关心”切入，把抽象热点落到具体影响。"


def build_hook(item: Item) -> str:
    clean = item.title.strip(" -_")
    return f"这条消息表面上是“{clean}”，真正值得看的是它背后的变化。"


def render_digest(items: list[Item], output_source: str, top_n: int) -> str:
    now = datetime.now(CN_TZ)
    top = sorted(items, key=lambda x: x.score, reverse=True)[:top_n]
    risky = [x for x in top if x.risk != "暂无明显风险"]
    lines = [
        f"# 信息雷达日报 | {now:%Y-%m-%d %H:%M}",
        "",
        f"- 汇总条目：{len(items)}",
        f"- 入选重点：{len(top)}",
        f"- 数据文件：{output_source}",
        "",
        "## 今日最值得关注",
        "",
    ]
    for idx, item in enumerate(top, 1):
        source = item.source or item.platform or "未知来源"
        signal = item.source_type or "未标注"
        lines.extend(
            [
                f"### {idx}. {item.title}",
                f"- 评分：{item.score}/100",
                f"- 信号类型：{signal}",
                f"- 来源：{source}",
                f"- 为什么重要：{item.why}",
                f"- 可确认事实：{item.summary or '目前只有标题信息，需要继续查证原文。'}",
                f"- 待核实风险：{item.risk}",
                f"- 选题角度：{item.angle}",
                f"- 开头钩子：{item.hook}",
            ]
        )
        if item.url:
            lines.append(f"- 原始链接：{item.url}")
        lines.append("")

    lines.extend(["## 关键词和趋势", ""])
    categories: dict[str, int] = {}
    for item in top:
        key = item.category or item.platform or "未分类"
        categories[key] = categories.get(key, 0) + 1
    for key, count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        lines.append(f"- {key}：{count} 条入选重点")
    if not categories:
        lines.append("- 暂无足够数据形成趋势。")

    lines.extend(["", "## 可做内容的选题", ""])
    for idx, item in enumerate(top[:5], 1):
        lines.extend(
            [
                f"{idx}. {item.title}",
                f"   - 角度：{item.angle}",
                f"   - 钩子：{item.hook}",
            ]
        )

    lines.extend(["", "## 风险和待核实", ""])
    if risky:
        for item in risky:
            lines.append(f"- {item.title}：{item.risk}")
    else:
        lines.append("- 入选重点暂无明显结构性风险，但发布前仍建议核对原始链接。")

    lines.extend(["", "## 原始来源", ""])
    for item in top:
        if item.url:
            lines.append(f"- {item.title}：{item.url}")
    return "\n".join(lines).rstrip() + "\n"


def command_digest(args: argparse.Namespace) -> int:
    keywords = [x.strip() for x in (args.keywords or "").split(",") if x.strip()]
    raw_items: list[dict[str, Any]] = []
    input_paths = [Path(x) for x in args.input]
    for path in input_paths:
        raw_items.extend(as_list(load_json(path)))

    items = [item for item in (normalize(raw) for raw in raw_items) if item]
    items = dedupe(items)
    for item in items:
        score_item(item, keywords)

    output_dir = Path(args.output_dir or Path.cwd() / "_outputs" / "info-radar")
    dated = output_dir / datetime.now(CN_TZ).strftime("%Y-%m-%d")
    dated.mkdir(parents=True, exist_ok=True)
    report_path = dated / "info-radar-digest.md"
    source_label = ", ".join(str(p) for p in input_paths)
    report_path.write_text(render_digest(items, source_label, args.top), encoding="utf-8")
    print(str(report_path.resolve()))
    return 0


def command_quick(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir or Path.cwd() / "_outputs" / "info-radar")
    dated = output_dir / datetime.now(CN_TZ).strftime("%Y-%m-%d")
    dated.mkdir(parents=True, exist_ok=True)

    jobs = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        jobs.append(
            (
                "aihot",
                pool.submit(
                    fetch_aihot_items,
                    query=args.query,
                    hours=args.hours,
                    days=args.days,
                    take=args.aihot_take,
                    insecure=args.insecure,
                    timeout=args.timeout,
                ),
            )
        )
        if args.github:
            github_query = args.github_query or args.query or "AI agent"
            jobs.append(
                (
                    "github",
                    pool.submit(
                        fetch_github_items,
                        github_query,
                        args.github_sort,
                        args.github_take,
                        args.insecure,
                        args.timeout,
                    ),
                )
            )

        raw: dict[str, Any] = {"items": [], "sources": {}, "errors": {}}
        for name, future in jobs:
            try:
                data = future.result()
                raw["sources"][name] = {"count": len(as_list(data))}
                raw["items"].extend(as_list(data))
            except Exception as exc:  # noqa: BLE001 - CLI should report partial source failures.
                raw["errors"][name] = str(exc)

    raw_path = dated / "info-radar-quick-raw.json"
    dump_json(raw_path, raw)

    items = [item for item in (normalize(row) for row in raw["items"]) if item]
    items = dedupe(items)
    keywords = [x.strip() for x in (args.keywords or args.query or "").split(",") if x.strip()]
    for item in items:
        score_item(item, keywords)

    report_path = dated / "info-radar-quick.md"
    report_path.write_text(render_digest(items, str(raw_path), args.top), encoding="utf-8")
    print(str(report_path.resolve()))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Info Radar helper")
    sub = parser.add_subparsers(dest="command", required=True)

    fetch = sub.add_parser("fetch-aihot", help="Fetch AI HOT public items")
    fetch.add_argument("--query", help="Keyword query")
    fetch.add_argument("--category", choices=["ai-models", "ai-products", "industry", "paper", "tip"])
    fetch.add_argument("--mode", choices=["selected", "all"], default="selected")
    fetch.add_argument("--hours", type=int, help="Lookback hours")
    fetch.add_argument("--days", type=int, help="Lookback days")
    fetch.add_argument("--take", type=int, default=50)
    fetch.add_argument("--output", help="Output JSON path")
    fetch.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Network timeout seconds")
    fetch.add_argument(
        "--insecure",
        action="store_true",
        help="Temporarily skip TLS verification for public non-sensitive sources",
    )
    fetch.set_defaults(func=command_fetch_aihot)

    github = sub.add_parser("fetch-github", help="Fetch public GitHub repositories")
    github.add_argument("--query", required=True, help="GitHub repository search query")
    github.add_argument("--sort", choices=["stars", "forks", "updated"], default="updated")
    github.add_argument("--take", type=int, default=20)
    github.add_argument("--output", help="Output JSON path")
    github.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Network timeout seconds")
    github.add_argument(
        "--insecure",
        action="store_true",
        help="Temporarily skip TLS verification for public non-sensitive sources",
    )
    github.set_defaults(func=command_fetch_github)

    digest = sub.add_parser("digest", help="Score JSON items and write a Markdown digest")
    digest.add_argument("--input", nargs="+", required=True, help="Input JSON files")
    digest.add_argument("--output-dir", help="Output directory")
    digest.add_argument("--top", type=int, default=12)
    digest.add_argument("--keywords", help="Comma-separated relevance keywords")
    digest.set_defaults(func=command_digest)

    quick = sub.add_parser("quick", help="Fast AI/GitHub scan and Markdown digest")
    quick.add_argument("--query", help="Optional keyword query")
    quick.add_argument("--hours", type=int, default=24, help="AI HOT lookback hours")
    quick.add_argument("--days", type=int, help="AI HOT lookback days")
    quick.add_argument("--aihot-take", type=int, default=30)
    quick.add_argument("--github", action="store_true", help="Also fetch GitHub repositories")
    quick.add_argument("--github-query", help="Override GitHub query")
    quick.add_argument("--github-sort", choices=["stars", "forks", "updated"], default="updated")
    quick.add_argument("--github-take", type=int, default=10)
    quick.add_argument("--output-dir", help="Output directory")
    quick.add_argument("--top", type=int, default=8)
    quick.add_argument("--keywords", help="Comma-separated relevance keywords")
    quick.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Per-source network timeout seconds")
    quick.add_argument(
        "--insecure",
        action="store_true",
        help="Temporarily skip TLS verification for public non-sensitive sources",
    )
    quick.set_defaults(func=command_quick)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
