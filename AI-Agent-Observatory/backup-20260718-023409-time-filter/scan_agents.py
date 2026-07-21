from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import tomllib
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

HOME = Path.home()
APPDATA = Path(os.environ.get("APPDATA", HOME / "AppData/Roaming"))
LOCALAPPDATA = Path(os.environ.get("LOCALAPPDATA", HOME / "AppData/Local"))
DASHBOARD = Path(__file__).resolve().parent
TZ = ZoneInfo("Asia/Shanghai")
SECRET_RE = re.compile(r"(api.?key|token|secret|password|credential|authorization|bearer|cookie|private.?key|access.?key|auth)", re.I)
AGENT_NAMES = {
    "codex": "Codex",
    "claude": "Claude Code",
    "hermes": "Hermes",
    "openclaw": "OpenClaw",
    "workbuddy": "WorkBuddy",
    "codebuddy": "CodeBuddy",
}
AGENT_COLORS = {
    "codex": "#5ba8ff",
    "claude": "#ff9f63",
    "hermes": "#a78bfa",
    "openclaw": "#43d6b5",
    "workbuddy": "#f4cf57",
    "codebuddy": "#ff6f91",
}


def read_json(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {} if default is None else default


def read_toml(path: Path):
    try:
        return tomllib.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}


def read_yaml(path: Path):
    try:
        import yaml
        return yaml.safe_load(path.read_text(encoding="utf-8-sig")) or {}
    except Exception:
        return {}


def truthy(value):
    return value not in (None, "", False, [], {})


def has_secret(value, key=""):
    if SECRET_RE.search(str(key)):
        return truthy(value)
    if isinstance(value, dict):
        return any(has_secret(v, k) for k, v in value.items())
    if isinstance(value, list):
        return any(has_secret(v, key) for v in value)
    return False


def safe_url(value):
    if not value:
        return ""
    text = str(value).strip()
    try:
        parts = urlsplit(text)
        if not parts.scheme:
            return text[:240]
        host = parts.hostname or ""
        port = f":{parts.port}" if parts.port else ""
        netloc = host + port
        safe_query = []
        for key, val in parse_qsl(parts.query, keep_blank_values=True):
            safe_query.append((key, "••••" if SECRET_RE.search(key) else val))
        return urlunsplit((parts.scheme, netloc, parts.path, urlencode(safe_query), ""))[:320]
    except Exception:
        return text[:240]


def provider_vendor(url, fallback="自定义"):
    host = (urlsplit(url).hostname or "").lower() if url else ""
    mapping = [
        (("127.0.0.1", "localhost"), "本地代理"),
        (("openai.com",), "OpenAI"),
        (("anthropic.com",), "Anthropic"),
        (("siliconflow.cn",), "硅基流动"),
        (("dashscope.aliyuncs.com",), "阿里云百炼"),
        (("bigmodel.cn",), "智谱 AI"),
        (("tencentmaas.com", "tcloudbasegateway.com", "hunyuan.cloud.tencent.com"), "腾讯云"),
        (("agnes-ai.com",), "Agnes AI"),
        (("openrouter.ai",), "OpenRouter"),
        (("deepseek.com",), "DeepSeek"),
        (("moonshot.cn",), "月之暗面"),
    ]
    for domains, name in mapping:
        if any(host == d or host.endswith("." + d) for d in domains):
            return name
    return fallback or "自定义"


def command_version(name):
    executable = shutil.which(name)
    if not executable:
        return None
    try:
        if executable.lower().endswith(".ps1"):
            cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", executable, "--version"]
        elif executable.lower().endswith((".cmd", ".bat")):
            cmd = ["cmd", "/d", "/c", executable, "--version"]
        else:
            cmd = [executable, "--version"]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=8)
        if result.returncode != 0:
            return "CLI 已安装 / 版本不可用"
        line = result.stdout.strip().splitlines()
        return line[0][:120] if line else "CLI 已安装"
    except Exception:
        return None


def skill_name(path: Path):
    try:
        head = path.read_text(encoding="utf-8-sig", errors="replace")[:5000]
        match = re.search(r"(?m)^name:\s*[\"']?([^\r\n\"']+)", head)
        return match.group(1).strip() if match else path.parent.name
    except Exception:
        return path.parent.name


def scan_skills(roots):
    found = {}
    for root in roots:
        if not root.exists():
            continue
        try:
            for path in root.rglob("SKILL.md"):
                lower = str(path).lower()
                if "node_modules" in lower or "\\.git\\" in lower:
                    continue
                name = skill_name(path)
                found.setdefault(name.lower(), {"name": name, "path": str(path.parent)})
        except Exception:
            continue
    return sorted(found.values(), key=lambda item: item["name"].lower())


def mcp_rows(config):
    servers = {}
    if isinstance(config, dict):
        servers = config.get("mcpServers") or config.get("mcp_servers") or config.get("mcp") or {}
    rows = []
    if not isinstance(servers, dict):
        return rows
    for name, item in servers.items():
        if not isinstance(item, dict):
            item = {}
        url = item.get("url") or item.get("endpoint") or ""
        command = item.get("command") or ""
        disabled = item.get("disabled") is True or item.get("enabled") is False
        transport = item.get("transportType") or item.get("transport") or item.get("type") or ("http" if url else "stdio")
        rows.append({
            "name": str(name),
            "enabled": not disabled,
            "transport": str(transport),
            "endpoint": safe_url(url) if url else str(command)[:180],
            "credentialConfigured": has_secret(item),
        })
    return rows


def merge_mcps(*groups):
    merged = {}
    for group in groups:
        for row in group:
            merged[row["name"].lower()] = row
    return sorted(merged.values(), key=lambda row: row["name"].lower())


def provider_row(name, url, models, key_configured, protocol=""):
    models = sorted({str(model) for model in models if model})
    return {
        "name": str(name or provider_vendor(url)),
        "vendor": provider_vendor(url, str(name or "自定义")),
        "baseUrl": safe_url(url),
        "protocol": str(protocol or "OpenAI compatible"),
        "models": models,
        "apiKeyConfigured": bool(key_configured),
    }


def build_codex():
    root = HOME / ".codex"
    config = read_toml(root / "config.toml")
    auth = read_json(root / "auth.json", {})
    catalog = read_json(root / "cc-switch-model-catalog.json", {})
    catalog_models = [m.get("slug") or m.get("display_name") for m in catalog.get("models", []) if isinstance(m, dict)]
    selected = config.get("model")
    providers = []
    for pid, item in (config.get("model_providers") or {}).items():
        if not isinstance(item, dict):
            continue
        key_ok = has_secret(item) or has_secret(auth)
        models = [selected] + catalog_models if pid == config.get("model_provider") else catalog_models
        providers.append(provider_row(item.get("name") or pid, item.get("base_url") or "", models, key_ok, item.get("wire_api") or "responses"))
    if not providers and selected:
        providers.append(provider_row("OpenAI", "https://api.openai.com/v1", [selected], has_secret(auth), "responses"))
    return agent_base("codex", root.exists(), command_version("codex"), providers,
                      mcp_rows(config), scan_skills([root / "skills", HOME / ".agents/skills", HOME / ".cc-switch/skills"]),
                      [root / "config.toml", root / "auth.json"])


def build_claude():
    root = HOME / ".claude"
    settings = read_json(root / "settings.json", {})
    env = settings.get("env") or {}
    url = env.get("ANTHROPIC_BASE_URL") or "https://api.anthropic.com"
    models = []
    for key, val in env.items():
        if "MODEL" in str(key).upper() and not str(key).upper().endswith("MODEL_NAME"):
            models.append(val)
    routes = ((settings.get("meta") or {}).get("claudeDesktopModelRoutes") or {})
    for route in routes.values():
        if isinstance(route, dict):
            models.append(route.get("model"))
    provider = provider_row("Anthropic 兼容接口", url, models, has_secret(env), (settings.get("meta") or {}).get("apiFormat") or "anthropic")
    global_cfg = read_json(HOME / ".claude.json", {})
    local_mcp = read_json(root / "mcp.json", {})
    return agent_base("claude", root.exists(), command_version("claude"), [provider],
                      merge_mcps(mcp_rows(global_cfg), mcp_rows(local_mcp)), scan_skills([root / "skills"]),
                      [root / "settings.json", HOME / ".claude.json", root / "mcp.json"])


def build_hermes():
    home_root = HOME / ".hermes"
    runtime_root = LOCALAPPDATA / "hermes"
    config_path = runtime_root / "config.yaml" if (runtime_root / "config.yaml").exists() else home_root / "config.yaml"
    config = read_yaml(config_path)
    model = config.get("model") or {}
    if not isinstance(model, dict):
        model = {"model": str(model)}
    url = model.get("base_url") or model.get("baseUrl") or ""
    models = [model.get("model"), model.get("default")]
    provider = provider_row(model.get("provider") or "Hermes Provider", url, models, has_secret(model), model.get("api") or "OpenAI compatible")
    mcps = merge_mcps(mcp_rows(config), mcp_rows(config.get("tools") if isinstance(config.get("tools"), dict) else {}))
    return agent_base("hermes", home_root.exists() or runtime_root.exists(), command_version("hermes"), [provider], mcps,
                      scan_skills([home_root / "skills", runtime_root / "skills"]), [config_path, runtime_root / "auth.json"])


def build_openclaw():
    root = HOME / ".openclaw"
    config = read_json(root / "openclaw.json", {})
    providers = []
    for pid, item in (((config.get("models") or {}).get("providers")) or {}).items():
        if not isinstance(item, dict):
            continue
        models = []
        for model in item.get("models") or []:
            models.append(model.get("id") or model.get("name") if isinstance(model, dict) else model)
        providers.append(provider_row(pid, item.get("baseUrl") or item.get("base_url") or "", models, has_secret(item), item.get("api") or "OpenAI compatible"))
    mcporter = read_json(root / "config/mcporter.json", {})
    return agent_base("openclaw", root.exists(), command_version("openclaw"), providers, mcp_rows(mcporter),
                      scan_skills([root / "skills", root / "workspace/skills"]), [root / "openclaw.json", root / "config/mcporter.json"])


def build_buddy(agent_id):
    root = HOME / (".workbuddy" if agent_id == "workbuddy" else ".codebuddy")
    models_cfg = read_json(root / "models.json", [])
    if isinstance(models_cfg, dict):
        models_cfg = models_cfg.get("models") or []
    providers = []
    for item in models_cfg if isinstance(models_cfg, list) else []:
        if not isinstance(item, dict):
            continue
        url = item.get("url") or item.get("baseUrl") or ""
        providers.append(provider_row(item.get("vendor") or provider_vendor(url), url, [item.get("id") or item.get("name")], has_secret(item), "OpenAI compatible"))
    mcps = merge_mcps(mcp_rows(read_json(root / "mcp.json", {})), mcp_rows(read_json(root / ".mcp.json", {})))
    installed = root.exists() or (APPDATA / ("WorkBuddy" if agent_id == "workbuddy" else "CodeBuddy CN")).exists()
    return agent_base(agent_id, installed, command_version(agent_id), providers, mcps, scan_skills([root / "skills"]),
                      [root / "models.json", root / "mcp.json", root / ".mcp.json", root / "settings.json"])


def agent_base(agent_id, installed, version, providers, mcps, skills, config_paths):
    models = sorted({model for provider in providers for model in provider.get("models", [])})
    return {
        "id": agent_id,
        "name": AGENT_NAMES[agent_id],
        "color": AGENT_COLORS[agent_id],
        "installed": bool(installed),
        "version": version or "桌面版 / 未检测到 CLI 版本",
        "providers": providers,
        "models": models,
        "mcps": mcps,
        "skills": skills,
        "apiKeyConfigured": any(item.get("apiKeyConfigured") for item in providers),
        "configPaths": [str(path) for path in config_paths if path and Path(path).exists()],
    }


def run_ccusage():
    node = shutil.which("node")
    cli = APPDATA / "npm/node_modules/ccusage/src/cli.js"
    if not node or not cli.exists():
        return {"daily": [], "monthly": [], "session": [], "error": "ccusage 未安装"}
    cmd = [node, str(cli), "daily", "--sections", "daily,monthly,session", "--by-agent", "--json", "--offline", "--no-cost"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
        if result.returncode != 0:
            raise RuntimeError((result.stderr or result.stdout).strip()[:300])
        return json.loads(result.stdout.lstrip("\ufeff"))
    except Exception as exc:
        return {"daily": [], "monthly": [], "session": [], "error": str(exc)}


def blank_metrics():
    return {"inputTokens": 0, "outputTokens": 0, "cacheReadTokens": 0, "cacheCreationTokens": 0,
            "reasoningTokens": 0, "totalTokens": 0, "models": {}}


def add_metrics(target, source, model_breakdowns=None):
    for key in ("inputTokens", "outputTokens", "cacheReadTokens", "cacheCreationTokens", "reasoningTokens", "totalTokens"):
        target[key] += int(source.get(key) or 0)
    for row in model_breakdowns or source.get("modelBreakdowns") or []:
        if not isinstance(row, dict):
            continue
        model = str(row.get("modelName") or row.get("model") or "未知模型")
        bucket = target["models"].setdefault(model, blank_metrics() | {"models": {}})
        for key in ("inputTokens", "outputTokens", "cacheReadTokens", "cacheCreationTokens", "reasoningTokens", "totalTokens"):
            if key == "totalTokens" and not row.get(key):
                value = sum(int(row.get(k) or 0) for k in ("inputTokens", "outputTokens", "cacheReadTokens", "cacheCreationTokens"))
            else:
                value = int(row.get(key) or 0)
            bucket[key] += value


def metrics_for_workbuddy(raw):
    input_tokens = int(raw.get("prompt_tokens") or raw.get("input_tokens") or 0)
    output_tokens = int(raw.get("completion_tokens") or raw.get("output_tokens") or 0)
    details_in = raw.get("prompt_tokens_details") or {}
    details_out = raw.get("completion_tokens_details") or {}
    cache = int(raw.get("prompt_cache_hit_tokens") or raw.get("cache_read_input_tokens") or details_in.get("cached_tokens") or 0)
    reasoning = int(raw.get("completion_thinking_tokens") or details_out.get("reasoning_tokens") or 0)
    total = int(raw.get("total_tokens") or (input_tokens + output_tokens))
    return {"inputTokens": input_tokens, "outputTokens": output_tokens, "cacheReadTokens": cache,
            "cacheCreationTokens": int(raw.get("cache_creation_input_tokens") or raw.get("prompt_cache_write_tokens") or 0),
            "reasoningTokens": reasoning, "totalTokens": total}


def timestamp_value(value):
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000 if value > 10_000_000_000 else value, TZ)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(TZ)
        except Exception:
            pass
    return None


def parse_workbuddy_file(path: Path, start_month: str):
    daily = {}
    sessions = {}
    seen = set()
    try:
        with path.open("r", encoding="utf-8", errors="replace") as handle:
            for line in handle:
                try:
                    item = json.loads(line)
                except Exception:
                    continue
                provider = item.get("providerData") or {}
                raw = provider.get("rawUsage") if isinstance(provider, dict) else None
                if not isinstance(raw, dict):
                    continue
                identity = str(item.get("id") or "") + ":" + str(item.get("timestamp") or "")
                if identity in seen:
                    continue
                seen.add(identity)
                dt = timestamp_value(item.get("timestamp"))
                if not dt or dt.strftime("%Y-%m") < start_month:
                    continue
                day = dt.strftime("%Y-%m-%d")
                model = provider.get("requestModelName") or provider.get("requestModelId") or provider.get("model") or "未知模型"
                metrics = metrics_for_workbuddy(raw)
                bucket = daily.setdefault(day, blank_metrics())
                add_metrics(bucket, metrics, [{"modelName": model, **metrics}])
                sid = str(item.get("sessionId") or path.stem)
                session = sessions.setdefault(sid, {"agent": "workbuddy", "period": sid, "lastActivity": dt.isoformat(), **blank_metrics()})
                if dt.isoformat() > session["lastActivity"]:
                    session["lastActivity"] = dt.isoformat()
                add_metrics(session, metrics, [{"modelName": model, **metrics}])
    except Exception:
        pass
    return {"daily": daily, "sessions": sessions}


def scan_workbuddy_usage(start_month):
    root = HOME / ".workbuddy/projects"
    if not root.exists():
        return {"daily": {}, "sessions": {}}
    cache_path = DASHBOARD / "workbuddy-usage-cache.json"
    cache = read_json(cache_path, {"windowStart": start_month, "files": {}})
    if cache.get("windowStart") != start_month:
        cache = {"windowStart": start_month, "files": {}}
    old_files = cache.get("files") or {}
    new_files = {}
    for path in root.rglob("*.jsonl"):
        try:
            stat = path.stat()
            key = str(path)
            signature = [stat.st_size, stat.st_mtime_ns]
            old = old_files.get(key)
            if old and old.get("signature") == signature:
                result = old.get("result") or {"daily": {}, "sessions": {}}
            else:
                result = parse_workbuddy_file(path, start_month)
            new_files[key] = {"signature": signature, "result": result}
        except Exception:
            continue
    combined = {"daily": {}, "sessions": {}}
    for entry in new_files.values():
        result = entry.get("result") or {}
        for day, metrics in (result.get("daily") or {}).items():
            bucket = combined["daily"].setdefault(day, blank_metrics())
            add_metrics(bucket, metrics)
            for model, values in (metrics.get("models") or {}).items():
                model_bucket = bucket["models"].setdefault(model, blank_metrics())
                add_metrics(model_bucket, values)
        for sid, metrics in (result.get("sessions") or {}).items():
            bucket = combined["sessions"].setdefault(sid, {"agent": "workbuddy", "period": sid, "lastActivity": metrics.get("lastActivity"), **blank_metrics()})
            if metrics.get("lastActivity") and metrics["lastActivity"] > (bucket.get("lastActivity") or ""):
                bucket["lastActivity"] = metrics["lastActivity"]
            add_metrics(bucket, metrics)
            for model, values in (metrics.get("models") or {}).items():
                model_bucket = bucket["models"].setdefault(model, blank_metrics())
                add_metrics(model_bucket, values)
    try:
        temp = cache_path.with_suffix(".tmp")
        temp.write_text(json.dumps({"windowStart": start_month, "files": new_files}, ensure_ascii=False), encoding="utf-8")
        temp.replace(cache_path)
    except Exception:
        pass
    return combined


def month_keys(count=6):
    now = datetime.now(TZ)
    keys = []
    year, month = now.year, now.month
    for offset in range(count - 1, -1, -1):
        index = year * 12 + month - 1 - offset
        keys.append(f"{index // 12:04d}-{index % 12 + 1:02d}")
    return keys


def normalize_usage(report, workbuddy):
    months = month_keys(6)
    start_month = months[0]
    monthly = {month: {"period": month, "agents": {}} for month in months}
    daily = {}
    totals = {agent: blank_metrics() for agent in AGENT_NAMES}

    for row in report.get("daily") or []:
        period = row.get("period")
        if not period or period[:7] < start_month:
            continue
        out = daily.setdefault(period, {"period": period, "agents": {}})
        for agent_row in row.get("agents") or []:
            aid = str(agent_row.get("agent") or "").lower()
            if aid not in AGENT_NAMES:
                continue
            metrics = blank_metrics()
            add_metrics(metrics, agent_row)
            out["agents"][aid] = metrics

    for row in report.get("monthly") or []:
        period = row.get("period")
        if period not in monthly:
            continue
        for agent_row in row.get("agents") or []:
            aid = str(agent_row.get("agent") or "").lower()
            if aid not in AGENT_NAMES:
                continue
            metrics = blank_metrics()
            add_metrics(metrics, agent_row)
            monthly[period]["agents"][aid] = metrics

    for day, metrics in workbuddy.get("daily", {}).items():
        if day[:7] < start_month:
            continue
        daily.setdefault(day, {"period": day, "agents": {}})["agents"]["workbuddy"] = metrics
        month_bucket = monthly.setdefault(day[:7], {"period": day[:7], "agents": {}})["agents"].setdefault("workbuddy", blank_metrics())
        add_metrics(month_bucket, metrics)
        for model, values in (metrics.get("models") or {}).items():
            model_bucket = month_bucket["models"].setdefault(model, blank_metrics())
            add_metrics(model_bucket, values)

    for month in monthly.values():
        for aid, metrics in month["agents"].items():
            add_metrics(totals[aid], metrics)
            for model, values in (metrics.get("models") or {}).items():
                model_bucket = totals[aid]["models"].setdefault(model, blank_metrics())
                add_metrics(model_bucket, values)

    sessions = []
    for row in report.get("session") or []:
        aid = str(row.get("agent") or "").lower()
        if aid not in AGENT_NAMES:
            continue
        sessions.append({
            "agent": aid,
            "id": row.get("period"),
            "lastActivity": (row.get("metadata") or {}).get("lastActivity"),
            "inputTokens": int(row.get("inputTokens") or 0),
            "outputTokens": int(row.get("outputTokens") or 0),
            "cacheReadTokens": int(row.get("cacheReadTokens") or 0),
            "reasoningTokens": int(row.get("reasoningTokens") or (row.get("metadata") or {}).get("reasoningOutputTokens") or 0),
            "totalTokens": int(row.get("totalTokens") or 0),
            "models": row.get("modelsUsed") or [],
        })
    for sid, row in workbuddy.get("sessions", {}).items():
        sessions.append({
            "agent": "workbuddy", "id": sid, "lastActivity": row.get("lastActivity"),
            "inputTokens": row.get("inputTokens", 0), "outputTokens": row.get("outputTokens", 0),
            "cacheReadTokens": row.get("cacheReadTokens", 0), "reasoningTokens": row.get("reasoningTokens", 0),
            "totalTokens": row.get("totalTokens", 0), "models": list((row.get("models") or {}).keys()),
        })
    sessions.sort(key=lambda row: row.get("lastActivity") or "", reverse=True)
    grand = blank_metrics()
    for metrics in totals.values():
        add_metrics(grand, metrics)
    return {
        "months": [monthly[m] for m in months],
        "daily": [daily[k] for k in sorted(daily)],
        "totalsByAgent": totals,
        "totals": grand,
        "sessions": sessions[:100],
        "sourceError": report.get("error"),
    }


def main():
    months = month_keys(6)
    report = run_ccusage()
    workbuddy = scan_workbuddy_usage(months[0])
    usage = normalize_usage(report, workbuddy)
    agents = [build_codex(), build_claude(), build_hermes(), build_openclaw(), build_buddy("workbuddy"), build_buddy("codebuddy")]
    for agent in agents:
        metrics = usage["totalsByAgent"].get(agent["id"], blank_metrics())
        agent["usage"] = metrics
        agent["models"] = sorted(set(agent.get("models", [])) | set((metrics.get("models") or {}).keys()))
        agent["usageStatus"] = "已读取本地日志" if metrics.get("totalTokens") else "未发现可统计的本地 Token 日志"
    payload = {
        "generatedAt": datetime.now(ZoneInfo("UTC")).isoformat(),
        "hostname": os.environ.get("COMPUTERNAME") or os.uname().nodename,
        "security": {
            "secretsExposed": False,
            "message": "API Key、Token、Authorization 和密码只显示是否已配置，永不返回具体值。",
        },
        "agents": agents,
        "usage": usage,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()


