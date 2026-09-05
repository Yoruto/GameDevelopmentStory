#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import posixpath
import re
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse

SCHEMA_VERSION = "code_package_security_preflight_v1"
ALLOWED_EXTENSIONS = {".html", ".htm", ".js", ".css"}
APPROVED_HOST_SUFFIXES = {"hupu.com", "hoopchina.com.cn", "app.tcloudbase.com"}
MAX_EVIDENCE_CHARS = 220
MAX_FINDINGS = 500
MAX_FINDINGS_PER_FILE_CATEGORY = 25
MINIFIED_LINE_CHARS = 4000
MINIFIED_SMALL_LINE_COUNT = 3

HTML_ATTR_RE = re.compile(
    r"""(?P<attr>src|href|srcset|poster|data|action|formaction|xlink:href)\s*=\s*(?:(?P<quote>["'])(?P<quoted>.*?)(?P=quote)|(?P<unquoted>[^\s"'=<>`]+))""",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(r"""url\(\s*(['"]?)(?P<value>.*?)(\1)\s*\)""", re.IGNORECASE)
CSS_IMPORT_RE = re.compile(r"""@import\s+(?:url\(\s*)?(['"]?)(?P<value>[^'")\s;]+|[^'")]+)(\1)""", re.IGNORECASE)
ABSOLUTE_URL_RE = re.compile(r"""(?P<url>https?://[^\s'"<>)]+|//[^\s'"<>)]+)""", re.IGNORECASE)
SUGGESTED_FINDING_CATEGORIES = {
    "direct_network_client": "请求 SDK 门禁",
    "standard_request_needs_review": "请求 SDK 门禁",
    "external_resource": "域名资源门禁",
    "unsafe_local_resource": "资源范围门禁",
    "missing_local_resource": "资源范围门禁",
    "out_of_scope_local_resource": "资源范围门禁",
    "dynamic_code_execution": "动态代码执行门禁",
    "embedded_frame": "跳转/弹窗/下载门禁",
    "popup_or_navigation": "跳转/弹窗/下载门禁",
    "sensitive_device_capability": "敏感设备能力门禁",
    "dom_injection_candidate": "XSS / DOM 注入",
    "message_handler_candidate": "数据外传",
    "client_storage_candidate": "存储风险",
    "prototype_pollution_candidate": "XSS / DOM 注入",
}
COMMON_FINDING_CATEGORIES = {
    "dom_injection_candidate",
    "message_handler_candidate",
    "client_storage_candidate",
    "prototype_pollution_candidate",
}
SUGGESTED_QUALITY_FINDING_CATEGORIES = {
    "blocking_script_candidate": "资源加载性能",
    "hot_event_listener_candidate": "主线程执行性能",
    "unbounded_timer_candidate": "主线程执行性能",
    "layout_thrashing_candidate": "渲染与布局性能",
    "broad_css_transition_candidate": "动画性能",
    "missing_viewport_candidate": "移动端适配",
    "placeholder_anchor_candidate": "交互语义",
    "missing_image_alt_candidate": "可访问性",
    "missing_element_guard_candidate": "运行稳定性",
    "fragile_json_parse_candidate": "状态容错",
}

TRACKER_STORAGE_KEYS = {
    "_hp_tracer_clt",
    "hp_tracker_clt",
    "hp-tracer-session-id",
}
SENSITIVE_STORAGE_TERMS = {
    "access_token",
    "accesstoken",
    "auth",
    "bearer",
    "credential",
    "jwt",
    "mobile",
    "openid",
    "password",
    "passwd",
    "phone",
    "secret",
    "token",
    "unionid",
    "user_id",
    "userid",
}

LINE_PATTERNS = [
    ("direct_network_client", "high", "SR-001", re.compile(r"""\b(fetch|XMLHttpRequest|axios|\$\.ajax|navigator\.sendBeacon|WebSocket|EventSource|RTCPeerConnection)\b""")),
    ("standard_request_needs_review", "medium", "SR-001", re.compile(r"""window\.ColorboxAI\.request\s*\(""")),
    ("dynamic_code_execution", "high", "SR-004", re.compile(r"""\b(eval|Function)\s*\(|new\s+Function\b|WebAssembly\.|setTimeout\s*\(\s*['"]|setInterval\s*\(\s*['"]|atob\s*\(""")),
    ("embedded_frame", "high", "SR-005", re.compile(r"""<\s*(iframe|frame|frameset|object|embed)\b""", re.IGNORECASE)),
    ("popup_or_navigation", "high", "SR-005", re.compile(r"""window\.open\s*\(|target\s*=\s*["_']_blank["_']|\bdownload\b|location\.(href|assign|replace)\b|http-equiv\s*=\s*["_']refresh["_']""", re.IGNORECASE)),
    ("sensitive_device_capability", "high", "SR-006", re.compile(r"""navigator\.(geolocation|clipboard|bluetooth|usb|hid|serial)|document\.execCommand\s*\(\s*['"](?:copy|cut|paste)['"]|DeviceOrientationEvent|Accelerometer|Gyroscope|Magnetometer|getDisplayMedia|requestFullscreen|webkitRequestFullscreen""")),
    ("dom_injection_candidate", "medium", "XSS", re.compile(r"""innerHTML|outerHTML|insertAdjacentHTML|document\.write|srcdoc|dangerouslySetInnerHTML|v-html""")),
    ("message_handler_candidate", "medium", "postMessage", re.compile(r"""postMessage\s*\(|addEventListener\s*\(\s*['"]message['"]""")),
    ("client_storage_candidate", "low", "storage", re.compile(r"""localStorage|sessionStorage|document\.cookie|Math\.random\s*\(""")),
    ("prototype_pollution_candidate", "medium", "client", re.compile(r"""__proto__|constructor|prototype""")),
]
QUALITY_LINE_PATTERNS = [
    ("hot_event_listener_candidate", "medium", "performance", re.compile(r"""addEventListener\s*\(\s*['"](?:scroll|resize|touchmove|wheel)['"]""")),
    ("unbounded_timer_candidate", "low", "performance", re.compile(r"""setInterval\s*\(""")),
    ("layout_thrashing_candidate", "low", "performance", re.compile(r"""getBoundingClientRect\s*\(|\boffset(?:Width|Height|Top|Left)\b|\bclient(?:Width|Height)\b|\bscroll(?:Top|Height|Width)\b""")),
    ("broad_css_transition_candidate", "low", "performance", re.compile(r"""transition\s*:\s*all\b""", re.IGNORECASE)),
    ("placeholder_anchor_candidate", "low", "function", re.compile(r"""<\s*a\b[^>]*\bhref\s*=\s*["'](?:#|javascript:void\(0\)|javascript:;)["']""", re.IGNORECASE)),
    ("missing_image_alt_candidate", "low", "function", re.compile(r"""<\s*img\b(?![^>]*\balt\s*=)""", re.IGNORECASE)),
    ("missing_element_guard_candidate", "medium", "function", re.compile(r"""document\.(?:getElementById|querySelector)\([^;\n]+\)\.addEventListener\s*\(""")),
    ("fragile_json_parse_candidate", "low", "function", re.compile(r"""JSON\.parse\s*\(\s*(?:localStorage|sessionStorage)\.""")),
]
HTML_VIEWPORT_RE = re.compile(r"""<\s*meta\b[^>]*\bname\s*=\s*["']viewport["']""", re.IGNORECASE)
SCRIPT_TAG_RE = re.compile(r"""<\s*script\b(?P<tag>[^>]*)>""", re.IGNORECASE)


def usage() -> None:
    print("Usage: preflight_scan.py [--json-summary] [--write-full-result] [--max-findings N] [--evidence-preview-chars N] <input-package-content-root|review-package-dir>", file=sys.stderr)


def snippet(text: str) -> str:
    compact = " ".join(text.strip().split())
    if len(compact) <= MAX_EVIDENCE_CHARS:
        return compact
    return compact[: MAX_EVIDENCE_CHARS - 3] + "..."


def line_number_at(text: str, offset: int) -> int:
    return text.count("\n", 0, max(0, offset)) + 1


def line_at(lines: list[str], line_number: int) -> str:
    if 1 <= line_number <= len(lines):
        return lines[line_number - 1]
    return ""


def analyzed_file_record(file: str, file_info: dict, lines: list[str]) -> dict:
    max_line_chars = max((len(line) for line in lines), default=0)
    byte_count = file_info.get("bytes")
    likely_minified = max_line_chars >= MINIFIED_LINE_CHARS or (
        isinstance(byte_count, int)
        and byte_count >= MINIFIED_LINE_CHARS
        and len(lines) <= MINIFIED_SMALL_LINE_COUNT
    )
    return {
        "file": file,
        "bytes": byte_count,
        "lineCount": len(lines),
        "maxLineChars": max_line_chars,
        "likelyMinified": likely_minified,
        "contextReadPolicy": "scanner_evidence_only" if likely_minified else "small_window",
        "readHint": (
            "avoid read_file on this minified/long-line file; use scanner evidence or exact-token grep only"
            if likely_minified
            else "read only small windows around scanner candidate lines"
        ),
    }


def extension(path: str) -> str:
    return posixpath.splitext(path)[1].lower()


def approved_host(hostname: str) -> bool:
    host = hostname.lower().rstrip(".")
    return host in APPROVED_HOST_SUFFIXES or any(host.endswith("." + approved) for approved in APPROVED_HOST_SUFFIXES)


def is_remote_url(value: str) -> bool:
    return value.startswith("//") or value.lower().startswith(("http://", "https://"))


def parsed_hostname(value: str) -> str:
    candidate = "https:" + value if value.startswith("//") else value
    return (urlparse(candidate).hostname or "").lower()


def strip_url_suffix(value: str) -> str:
    return value.split("#", 1)[0].split("?", 1)[0]


def normalize_local_reference(current_file: str, value: str) -> tuple[str | None, str | None]:
    raw = value.strip()
    if not raw or raw.startswith("#"):
        return None, None
    lowered = raw.lower()
    if lowered.startswith(("http://", "https://", "//", "data:", "blob:", "javascript:", "mailto:", "tel:", "about:")):
        return None, None

    path_value = unquote(strip_url_suffix(raw)).replace("\\", "/")
    if not path_value:
        return None, None
    if path_value.startswith("/"):
        normalized = posixpath.normpath(path_value.lstrip("/"))
    else:
        normalized = posixpath.normpath(posixpath.join(posixpath.dirname(current_file), path_value))
    if normalized == ".":
        return None, None
    if normalized.startswith("../") or normalized == "..":
        return normalized, "path_escapes_package"
    return normalized, None


def split_srcset(value: str) -> list[str]:
    parts = []
    for item in value.split(","):
        candidate = item.strip().split()
        if candidate:
            parts.append(candidate[0])
    return parts


def is_allowed_tracker_storage_line(line: str) -> bool:
    lowered = line.lower()
    if not any(key in lowered for key in TRACKER_STORAGE_KEYS):
        return False
    return not any(term in lowered for term in SENSITIVE_STORAGE_TERMS)


class FindingBuilder:
    def __init__(self) -> None:
        self.findings: list[dict] = []
        self.suppressed = 0
        self.counts: dict[tuple[str, str], int] = {}

    def add(self, *, category: str, severity: str, rule: str, file: str, line: int, evidence: str, value: str | None = None, decision_hint: str | None = None, finding_type: str = "security") -> None:
        key = (file, category)
        current = self.counts.get(key, 0)
        if current >= MAX_FINDINGS_PER_FILE_CATEGORY or len(self.findings) >= MAX_FINDINGS:
            self.suppressed += 1
            return
        self.counts[key] = current + 1
        finding = {
            "id": f"S-{len(self.findings) + 1:03d}",
            "type": finding_type,
            "severity": severity,
            "category": category,
            "rule": rule,
            "file": file,
            "line": line,
            "evidence": snippet(evidence),
        }
        if value:
            finding["value"] = value
        if decision_hint:
            finding["decisionHint"] = decision_hint
        if finding_type in {"security", "common"}:
            finding["suggestedFindingCategory"] = SUGGESTED_FINDING_CATEGORIES.get(category, "审查不完整")
        else:
            finding["suggestedFindingCategory"] = SUGGESTED_QUALITY_FINDING_CATEGORIES.get(category, "运行稳定性")
        self.findings.append(finding)


def load_manifest(content_root: Path) -> dict:
    """Load either the Agent package manifest or the legacy review-package manifest.

    The scanner rules are shared; only the staging manifest location/field names
    differ between the two callers.
    """
    manifest_path = content_root.parent / "manifest.json"
    legacy_manifest_path = content_root / ".code-review" / "manifest.json"
    if legacy_manifest_path.exists():
        manifest_path = legacy_manifest_path
    with manifest_path.open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)

    # Normalize legacy aliases once so the rest of the scanner is identical.
    for file_info in manifest.get("files", []):
        if "materialized" not in file_info and "included" in file_info:
            file_info["materialized"] = file_info.get("included") is True
    if "importFindings" not in manifest and "preflightFindings" in manifest:
        manifest["importFindings"] = manifest.get("preflightFindings", [])
    return manifest


def read_input_file(content_root: Path, package_path: str) -> str:
    target = (content_root / package_path).resolve()
    root = content_root.resolve()
    if root != target and root not in target.parents:
        raise ValueError(f"path escapes input package: {package_path}")
    return target.read_text(encoding="utf-8", errors="replace")


def scan_line_patterns(file: str, lines: list[str], builder: FindingBuilder) -> None:
    for line_number, line in enumerate(lines, start=1):
        for category, severity, rule, pattern in LINE_PATTERNS:
            if pattern.search(line):
                if category == "client_storage_candidate" and is_allowed_tracker_storage_line(line):
                    continue
                hint = "blocked" if severity == "high" else "needs_review"
                finding_type = "common" if category in COMMON_FINDING_CATEGORIES else "security"
                builder.add(category=category, severity=severity, rule=rule, file=file, line=line_number, evidence=line, decision_hint=hint, finding_type=finding_type)
        for category, priority, finding_type, pattern in QUALITY_LINE_PATTERNS:
            if pattern.search(line):
                builder.add(category=category, severity=priority, rule=finding_type, file=file, line=line_number, evidence=line, decision_hint="needs_review", finding_type=finding_type)


def scan_file_quality_findings(file: str, text: str, lines: list[str], builder: FindingBuilder) -> None:
    if extension(file) in {".html", ".htm"} and not HTML_VIEWPORT_RE.search(text):
        builder.add(
            category="missing_viewport_candidate",
            severity="medium",
            rule="function",
            file=file,
            line=1,
            evidence="HTML document has no viewport meta tag",
            decision_hint="needs_review",
            finding_type="function",
        )
    for match in SCRIPT_TAG_RE.finditer(text):
        tag = match.group("tag")
        lowered = tag.lower()
        if not re.search(r"""\bsrc\s*=""", lowered):
            continue
        if re.search(r"""\b(?:defer|async)\b""", lowered) or re.search(r"""\btype\s*=\s*["']module["']""", lowered):
            continue
        line = line_number_at(text, match.start())
        builder.add(
            category="blocking_script_candidate",
            severity="low",
            rule="performance",
            file=file,
            line=line,
            evidence=line_at(lines, line),
            decision_hint="needs_review",
            finding_type="performance",
        )


def scan_remote_url(file: str, line: int, evidence: str, value: str, builder: FindingBuilder) -> None:
    host = parsed_hostname(value)
    if not host:
        return
    if not approved_host(host):
        builder.add(
            category="external_resource",
            severity="high",
            rule="SR-002",
            file=file,
            line=line,
            evidence=evidence,
            value=value,
            decision_hint="blocked",
        )


def scan_local_reference(file: str, line: int, evidence: str, value: str, manifest_files: dict[str, dict], builder: FindingBuilder) -> None:
    normalized, error = normalize_local_reference(file, value)
    if not normalized:
        return
    if error:
        builder.add(category="unsafe_local_resource", severity="high", rule="SR-002", file=file, line=line, evidence=evidence, value=value, decision_hint="blocked")
        return
    manifest_entry = manifest_files.get(normalized)
    if not manifest_entry:
        builder.add(category="missing_local_resource", severity="high", rule="SR-002", file=file, line=line, evidence=evidence, value=normalized, decision_hint="blocked")
        return
    if not manifest_entry.get("materialized") or extension(normalized) not in ALLOWED_EXTENSIONS:
        builder.add(category="out_of_scope_local_resource", severity="medium", rule="SR-000", file=file, line=line, evidence=evidence, value=normalized, decision_hint="needs_review")


def scan_references(file: str, text: str, lines: list[str], manifest_files: dict[str, dict], builder: FindingBuilder) -> None:
    for match in HTML_ATTR_RE.finditer(text):
        attr = match.group("attr").lower()
        raw_value = match.group("quoted") if match.group("quoted") is not None else match.group("unquoted")
        values = split_srcset(raw_value) if attr == "srcset" else [raw_value]
        line = line_number_at(text, match.start())
        evidence = line_at(lines, line)
        for value in values:
            if is_remote_url(value):
                scan_remote_url(file, line, evidence, value, builder)
            else:
                scan_local_reference(file, line, evidence, value, manifest_files, builder)

    for regex in (CSS_URL_RE, CSS_IMPORT_RE):
        for match in regex.finditer(text):
            value = match.group("value").strip()
            line = line_number_at(text, match.start())
            evidence = line_at(lines, line)
            if is_remote_url(value):
                scan_remote_url(file, line, evidence, value, builder)
            else:
                scan_local_reference(file, line, evidence, value, manifest_files, builder)

    for match in ABSOLUTE_URL_RE.finditer(text):
        line = line_number_at(text, match.start())
        scan_remote_url(file, line, line_at(lines, line), match.group("url"), builder)


def error_output(category: str, message: str) -> dict:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "ok": False,
        "decisionHint": "failed",
        "errors": [
            {
                "category": category,
                "message": message,
            },
        ],
        "findings": [],
        "suppressedFindingCount": 0,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="preflight_scan.py",
        description="Static preflight scanner for code package security review.",
    )
    parser.add_argument("content_root", help="input package content root")
    parser.add_argument("--json-summary", action="store_true", help="print compact summary JSON to stdout")
    parser.add_argument("--write-full-result", action="store_true", help="write full scan JSON to the package result file")
    parser.add_argument("--max-findings", type=int, default=MAX_FINDINGS, help="max findings included in summary stdout")
    parser.add_argument("--evidence-preview-chars", type=int, default=MAX_EVIDENCE_CHARS, help="max evidence chars included in summary stdout")
    return parser.parse_args(argv[1:])


def preview_text(value: str, max_chars: int) -> str:
    if max_chars <= 0:
        return ""
    if len(value) <= max_chars:
        return value
    if max_chars <= 3:
        return value[:max_chars]
    return value[: max_chars - 3] + "..."


def compact_finding(finding: dict, evidence_preview_chars: int) -> dict:
    compact = dict(finding)
    if "evidence" in compact:
        compact["evidence"] = preview_text(str(compact["evidence"]), evidence_preview_chars)
    return compact


def summary_output(full_output: dict, full_result_path: str | None, max_findings: int, evidence_preview_chars: int) -> dict:
    max_findings = max(0, max_findings)
    findings = full_output.get("findings", [])
    manifest_findings = full_output.get("manifestPreflightFindings", [])
    return {
        "schemaVersion": full_output.get("schemaVersion", SCHEMA_VERSION),
        "ok": full_output.get("ok", True),
        "decisionHint": full_output.get("decisionHint"),
        "package": full_output.get("package"),
        "scanPolicy": full_output.get("scanPolicy"),
        "summary": {
            "findingCount": len(findings),
            "manifestPreflightFindingCount": len(manifest_findings),
            "suppressedFindingCount": full_output.get("suppressedFindingCount", 0),
            "analyzedFileCount": len(full_output.get("analyzedFiles", [])),
            "skippedDuringScanCount": len(full_output.get("skippedDuringScan", [])),
            "summaryFindingLimit": max_findings,
        },
        "analyzedFiles": full_output.get("analyzedFiles", []),
        "skippedDuringScan": full_output.get("skippedDuringScan", []),
        "manifestPreflightFindings": manifest_findings[:max_findings],
        "findings": [compact_finding(finding, evidence_preview_chars) for finding in findings[:max_findings]],
        "fullResultPath": full_result_path,
    }


def full_result_sidecar(content_root: Path, manifest: dict) -> tuple[Path, str]:
    resolved_content_root = content_root.resolve(strict=True)
    package_root = resolved_content_root.parent
    package_id = manifest.get("packageId")
    if not isinstance(package_id, str) or not package_id:
        raise ValueError("manifest packageId is required to write full result")
    if (
        resolved_content_root.name != "content"
        or package_root.name != package_id
        or package_root.parent.name != "packages"
        or package_root.parent.parent.name != "input-packages"
    ):
        # Legacy runbook staging keeps the manifest under review-package/.code-review
        # and has no package/content wrapper. Keep its sidecar local to that root.
        legacy_manifest = resolved_content_root / ".code-review" / "manifest.json"
        if legacy_manifest.exists():
            target = resolved_content_root / ".code-review" / "preflight-full.json"
            return target, "review-package/.code-review/preflight-full.json"
        raise ValueError("content root must be input-packages/packages/<packageId>/content")
    target = package_root / "preflight-full.json"
    return target, f"input-packages/packages/{package_id}/preflight-full.json"


def write_json_file(target: Path, data: dict) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=target.parent,
            prefix=f".{target.name}.",
            suffix=".tmp",
            delete=False,
        ) as handle:
            temp_path = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_path, target)
    finally:
        if temp_path is not None:
            try:
                temp_path.unlink(missing_ok=True)
            except OSError:
                pass


def main(argv: list[str]) -> int:
    try:
        args = parse_args(argv)
    except SystemExit as exit_error:
        return int(exit_error.code or 0)

    content_root = Path(args.content_root)
    try:
        manifest = load_manifest(content_root)
    except Exception as error:
        print(json.dumps(error_output("manifest_read_error", str(error)), ensure_ascii=False, indent=2))
        return 1

    manifest_files = {file_info.get("path", ""): file_info for file_info in manifest.get("files", [])}
    reviewable_files = [
        file_info for file_info in manifest.get("files", [])
        if file_info.get("materialized") is True and extension(file_info.get("path", "")) in ALLOWED_EXTENSIONS
    ]

    builder = FindingBuilder()
    analyzed = []
    skipped = []

    for file_info in reviewable_files:
        package_path = file_info.get("path", "")
        try:
            text = read_input_file(content_root, package_path)
        except Exception as error:
            skipped.append({"file": package_path, "reason": f"read_error: {error}"})
            continue
        lines = text.splitlines()
        analyzed.append(analyzed_file_record(package_path, file_info, lines))
        scan_line_patterns(package_path, lines, builder)
        scan_file_quality_findings(package_path, text, lines, builder)
        scan_references(package_path, text, lines, manifest_files, builder)

    output = {
        "schemaVersion": SCHEMA_VERSION,
        "package": {
            "packageId": manifest.get("packageId"),
            "archiveSha256": (manifest.get("archive") or {}).get("sha256"),
            "fileCount": (manifest.get("summary") or {}).get("totalFiles"),
            "analyzedFileCount": len(analyzed),
            "skippedFileCount": len(manifest.get("files", [])) - len(analyzed),
        },
        "scanPolicy": {
            "executedCode": False,
            "networkAccess": False,
            "allowedExtensions": sorted(ALLOWED_EXTENSIONS),
            "maxFindings": MAX_FINDINGS,
            "maxFindingsPerFileCategory": MAX_FINDINGS_PER_FILE_CATEGORY,
        },
        "analyzedFiles": analyzed,
        "skippedDuringScan": skipped,
        "manifestPreflightFindings": manifest.get("importFindings", []),
        "findings": builder.findings,
        "suppressedFindingCount": builder.suppressed,
    }
    result_path = None
    display_path = None
    if args.write_full_result:
        try:
            result_path, display_path = full_result_sidecar(content_root, manifest)
            write_json_file(result_path, output)
        except Exception as error:
            print(json.dumps(error_output("full_result_path_error", str(error)), ensure_ascii=False, indent=2))
            return 1

    stdout_output = summary_output(
        output,
        display_path,
        args.max_findings,
        args.evidence_preview_chars,
    ) if args.json_summary else output
    print(json.dumps(stdout_output, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
