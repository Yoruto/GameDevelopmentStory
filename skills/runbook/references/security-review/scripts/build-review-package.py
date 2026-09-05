#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""本地安全审查 staging 构建器（runbook 集成版）。

把活动工作区的前端产物（默认 h5/）组织成 code-package-security-review
协议要求的 review-package/ 结构：只拷贝 .html/.htm/.js/.css，并生成 .code-review/manifest.json，
使 preflight_scan.py 无需平台后端即可对本地实现产物做确定性预扫描。

用法（在活动工作区根运行）：
    python3 skills/runbook/references/security-review/scripts/build-review-package.py \
        [--source h5] [--output activity/review-package] [--package-id <id>]

package-id 缺省取 activity.json 的 activityId，无身份时用 "local"。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ALLOWED_EXTENSIONS = {".html", ".htm", ".js", ".css"}
IGNORED_NAMES = {".DS_Store", "Thumbs.db"}


def load_activity_id(cwd: Path) -> str | None:
    activity_file = cwd / "activity.json"
    if not activity_file.is_file():
        return None
    try:
        data = json.loads(activity_file.read_text(encoding="utf-8"))
        value = data.get("activityId")
        return str(value) if value else None
    except (OSError, ValueError):
        return None


def collect_files(source: Path) -> list[Path]:
    out: list[Path] = []
    for path in sorted(source.rglob("*")):
        if not path.is_file():
            continue
        if path.name in IGNORED_NAMES:
            continue
        out.append(path)
    return out


def extension(path: str) -> str:
    return Path(path).suffix.lower()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="build local security-review staging package")
    parser.add_argument("--source", default="h5", help="source H5 directory (default: h5)")
    parser.add_argument("--output", default="activity/review-package", help="staging review package directory (default: activity/review-package)")
    parser.add_argument("--package-id", default=None, help="packageId written into the manifest (default: activity.json activityId, else 'local')")
    args = parser.parse_args(argv)

    cwd = Path.cwd()
    source = (cwd / args.source).resolve()
    output = (cwd / args.output).resolve()
    if not source.is_dir():
        print(f"error: source directory not found: {source}", file=sys.stderr)
        return 1
    if output == source or source in output.parents:
        print(f"error: output must not be inside source: {output}", file=sys.stderr)
        return 1

    files = collect_files(source)
    if not files:
        print(f"error: no files under source: {source}", file=sys.stderr)
        return 1

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    package_id = args.package_id or load_activity_id(cwd) or "local"
    manifest_files: list[dict] = []
    digest = hashlib.sha256()
    analyzed_count = 0

    for path in files:
        rel = path.relative_to(source).as_posix()
        included = extension(rel) in ALLOWED_EXTENSIONS
        entry: dict = {"path": rel, "included": included}
        if included:
            target = output / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
            content = path.read_bytes()
            entry["bytes"] = len(content)
            entry["sha256"] = hashlib.sha256(content).hexdigest()
            digest.update(rel.encode("utf-8"))
            digest.update(content)
            analyzed_count += 1
        manifest_files.append(entry)

    manifest = {
        "packageId": package_id,
        "archive": {"sha256": digest.hexdigest()},
        "summary": {"totalFiles": len(files)},
        "files": manifest_files,
        "preflightFindings": [],
    }
    manifest_dir = output / ".code-review"
    manifest_dir.mkdir(parents=True, exist_ok=True)
    (manifest_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "ok": True,
        "reviewPackage": str(output),
        "packageId": package_id,
        "fileCount": len(files),
        "analyzedFileCount": analyzed_count,
        "skippedFileCount": len(files) - analyzed_count,
        "manifest": ".code-review/manifest.json",
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
