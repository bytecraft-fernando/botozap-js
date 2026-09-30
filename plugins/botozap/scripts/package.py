#!/usr/bin/env python3
"""Validate and create a local candidate ZIP from an explicit public allowlist."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
from urllib.parse import urlsplit
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--zip", type=Path, help="Write candidate ZIP outside plugin source")
parser.add_argument("--submission-ready", action="store_true", help="Fail on outstanding portal/release gates")
parser.add_argument("--catalog-ref", action="append", default=[], help="Also verify UI tool declarations against a git source revision (repeatable)")
args = parser.parse_args()
assert not (root / ".app.json").exists(), "Private app binding forbidden"
manifest = json.loads((root / "plugin.json").read_text())
mcp = json.loads((root / "mcp.json").read_text())
metadata = manifest["extensions"]["com.openai"]
listing = metadata["interface"]
assert manifest.get("apps") is None and metadata.get("apps") is None, "Private app binding forbidden"
assert re.fullmatch(r"\d+\.\d+\.\d+", manifest["version"]), "Explicit semantic version required"
assert len(mcp["mcpServers"]) == 1, "Review cases require exactly one MCP server"
assert mcp["mcpServers"]["botozap"]["type"] == "streamable-http"
for field, limit in [("displayName", 30), ("shortDescription", 30), ("longDescription", 4000), ("developerName", 80)]:
    value = listing[field]
    assert isinstance(value, str) and value.strip() and len(value) <= limit, field
for field in ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]:
    url = urlsplit(listing[field])
    assert url.scheme == "https" and url.hostname and not url.username and not url.password, field
prompts = listing["defaultPrompt"]
assert 1 <= len(prompts) <= 3
assert all(isinstance(p,str) and p.strip() and len(p) <= 128 and not re.search(r"[\r\n@]",p) for p in prompts)
assert len({" ".join(p.split()) for p in prompts}) == len(prompts)
assert metadata["publication"]["countries"] == ["BR"]
translation = metadata["publication"]["translations"]["pt-BR"]
assert 0 < len(translation["subtitle"]) <= 30 and "\n" not in translation["subtitle"]
assert 0 < len(translation["description"]) <= 4000
cases = metadata["review"]["test_cases"]
assert len(cases["positive"]) == 5 and len(cases["negative"]) == 3
assert (root / metadata["onboardingSkill"]).is_file()

# Static local catalogue evidence, including the explicit published input fixture.
repository = root.parents[1]
fixture = json.loads((repository / "packages/mcp/tests/fixtures/release-0.6.0-tools.json").read_text())
tools = {tool["name"] for tool in fixture["tools"]}
for source in (repository / "packages/mcp/src").rglob("*.ts"):
    tools.update(re.findall(r"(?:register|registerTool)\(\s*[\"']([a-z_]+)[\"']", source.read_text()))
contracts = json.loads((root / "ui-contracts.json").read_text())
ui_tools = set(contracts["tools"])
assert {c["screen"] for c in contracts["tools"].values() if "screen" in c} == set(range(1,9))
assert all(re.fullmatch(r"[0-9a-f]{40}",ref) for ref in contracts["verified_from_git"].values())
# main may not contain the UI PRs yet: validate planned tool contracts separately.
missing_on_main = sorted(ui_tools - tools)
if args.catalog_ref:
    integrated = set(tools)
    for ref in args.catalog_ref:
        revision = subprocess.check_output(["git","rev-parse","--verify",ref+"^{commit}"],cwd=repository,text=True).strip()
        paths = subprocess.check_output(["git","ls-tree","-r","--name-only",revision,"packages/mcp/src"],cwd=repository,text=True).splitlines()
        for path in paths:
            if path.endswith(".ts"):
                source = subprocess.check_output(["git","show",revision+":"+path],cwd=repository,text=True)
                integrated.update(re.findall(r"(?:register|registerTool)\(\s*[\"']([a-z_]+)[\"']",source))
    assert ui_tools.issubset(integrated), sorted(ui_tools - integrated)
tools.update(ui_tools)
assert "prepare_send_intent" in tools
for kind in ["positive", "negative"]:
    for case in cases[kind]:
        for field in ["description", "prompt"]:
            assert case[field].strip(), field
        if kind == "positive":
            assert case["expected_behavior"].strip()
            expected = [name.strip() for name in case["tools_triggered"].split(",")]
            assert all(name in tools for name in expected), expected

# Build only portable manifests, referenced icon and skills. Operational materials,
# validation scripts, evidence and credentials cannot enter this archive.
files = [root / "plugin.json", root / "mcp.json", root / "assets/icon.png"]
skill_names = ["conectar-botozap", "revisar-pendencias", "preparar-template", "casos-da-ia", "marcar-horario", "plantao-ao-vivo"]
files.extend(root / "skills" / name / "SKILL.md" for name in skill_names)
assert all(path.is_file() for path in files)
skill_text = "\n".join(path.read_text() for path in files if path.suffix == ".md")
assert all(f"`{name}`" in skill_text for name in ui_tools), "UI tool missing from skills"
files = sorted(files, key=lambda p: p.relative_to(root).as_posix())
for path in files:
    assert path.resolve().is_relative_to(root), f"Path outside package: {path}"
    assert not any(parent.is_symlink() for parent in [path,*path.parents] if parent.is_relative_to(root)), f"Symlink path forbidden: {path}"
    assert not path.is_symlink(), f"Symlink forbidden: {path}"
    if path.suffix == ".png":
        data = path.read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n"
        width, height = struct.unpack(">II", data[16:24])
        assert width == height and 256 <= width <= 4096 and len(data) <= 5 * 1024 * 1024
    else:
        text = path.read_text()
        assert not re.search(r'"(?:test_credentials|reviewer_instructions)"\s*:', text), path
        assert not re.search(r'\bbz_(?:live|sandbox)_[A-Za-z0-9._-]+\b|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', text), path
        assert not re.search(r'https://[^/\s"<>]+:[^/\s"<>]+@', text), path

video = metadata["review"].get("demo_recording_url")
gates = [
    "Review published privacy/terms coverage for this ChatGPT integration; reverify all listing URLs before submission.",
    "Confirm merged/deployed PR #14/#17 server support and permitted host/account UI availability in an authorized test environment; this script changes no flags.",
    "Provision the dedicated controlled review fixture and run all 5 positive/3 negative cases; record actual evidence.",
    "Enter reviewer account credentials and access instructions only in the secure portal form.",
    "Complete publisher verification, successful metadata/skill/tool scans and policy attestations.",
]
if not video:
    gates.insert(0, "Required video walkthrough URL is absent. Record the actual fixture walkthrough before submission.")
else:
    parsed = urlsplit(video)
    assert parsed.scheme == "https" and parsed.hostname and not parsed.username and not parsed.password
print(json.dumps({"candidate_valid": True, "files": [str(path.relative_to(root)) for path in files], "required_ui_tools": sorted(ui_tools), "ui_tools_missing_in_local_main": missing_on_main, "catalog_refs_verified": args.catalog_ref, "review_cases_executed": False, "submission_ready": False, "gates": gates}, ensure_ascii=False, indent=2))
if args.submission_ready:
    raise SystemExit("Submission blocked: candidate validation is not portal readiness; gates above remain open.")
if args.zip:
    destination = args.zip.expanduser().resolve()
    assert not destination.is_relative_to(root), "Write ZIP outside plugin source"
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            info = zipfile.ZipInfo(str(path.relative_to(root)), date_time=(2026, 9, 29, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            info.create_system = 3
            archive.writestr(info, path.read_bytes(), compresslevel=9)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert set(archive.namelist()) == {str(path.relative_to(root)) for path in files}
    print(json.dumps({"zip": str(destination), "bytes": destination.stat().st_size, "files": archive.namelist(), "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}))
