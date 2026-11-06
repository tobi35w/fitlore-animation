"""Fetch the bridge's CC0 models from Kenney and keep a reproducible source manifest."""
from __future__ import annotations
import hashlib
import base64
import io
import json
import mimetypes
from pathlib import Path
import posixpath
import re
import struct
import sys
import urllib.request
import urllib.parse
import zipfile

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "public/bridge/kenney"
CACHE = ROOT / ".cache/downloads"
NEEDED = [
    "tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone",
    "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
    "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA",
    "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
    "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe",
]
PACKS = ["nature-kit", "fantasy-town-kit", "mini-forest", "castle-kit"]


def self_contained_glb(data: bytes, archive: zipfile.ZipFile, member: str) -> bytes:
    """Embed sidecar textures so different packs can safely share one model folder."""
    magic, version, length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or length != len(data):
        raise ValueError(f"Invalid GLB header: {member}")
    offset, chunks = 12, []
    while offset < len(data):
        size, kind = struct.unpack_from("<II", data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            document = json.loads(chunk.rstrip(b" \x00"))
            for resource in document.get("images", []) + document.get("buffers", []):
                uri = resource.get("uri")
                if uri and not uri.startswith("data:"):
                    source = posixpath.normpath(posixpath.join(posixpath.dirname(member), urllib.parse.unquote(uri)))
                    content = archive.read(source)
                    mime = mimetypes.guess_type(source)[0] or "application/octet-stream"
                    resource["uri"] = f"data:{mime};base64," + base64.b64encode(content).decode("ascii")
            chunk = json.dumps(document, separators=(",", ":")).encode("utf-8")
            chunk += b" " * ((-len(chunk)) % 4)
        chunks.append(struct.pack("<II", len(chunk), kind) + chunk)
        offset += 8 + size
    payload = b"".join(chunks)
    return struct.pack("<4sII", b"glTF", 2, len(payload) + 12) + payload


def fetch(url: str, referer: str = "https://kenney.nl/") -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "AnimatedShortsSetup/1.0", "Referer": referer})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def pack_archive(pack: str) -> tuple[zipfile.ZipFile, str]:
    path = CACHE / f"kenney-{pack}.zip"
    if path.exists() and zipfile.is_zipfile(path):
        data = path.read_bytes()
    else:
        page = f"https://kenney.nl/assets/{pack}"
        html = fetch(page).decode("utf-8")
        download_id = re.search(r"data-download-id=['\"]([^'\"]+)", html)
        if not download_id:
            raise RuntimeError(f"No public download link on {page}")
        link = json.loads(fetch("https://kenney.nl/download-link/" + download_id[1], page))
        print(f"Downloading Kenney {pack}...", flush=True)
        data = fetch(link["url"], page)
        if not zipfile.is_zipfile(io.BytesIO(data)):
            raise RuntimeError(f"{pack} did not return a valid ZIP")
        path.write_bytes(data)
    return zipfile.ZipFile(io.BytesIO(data)), hashlib.sha256(data).hexdigest()


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST / "manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        files = manifest.get("files", [])
        if manifest.get("schemaVersion") == 2 and {f["name"] for f in files} == set(NEEDED) and all(
            (DEST / (f["name"] + ".glb")).is_file()
            and hashlib.sha256((DEST / (f["name"] + ".glb")).read_bytes()).hexdigest() == f["sha256"]
            for f in files
        ):
            print(f"All {len(NEEDED)} Kenney models verified.")
            return
    found = {}
    sources = []
    for pack in PACKS:
        archive, archive_hash = pack_archive(pack)
        source = {"pack": pack, "page": f"https://kenney.nl/assets/{pack}", "archiveSha256": archive_hash, "license": "CC0-1.0"}
        used = False
        for member in archive.infolist():
            name = Path(member.filename).stem
            if member.filename.lower().endswith(".glb") and name in NEEDED and name not in found:
                data = archive.read(member)
                if data[:4] != b"glTF":
                    raise RuntimeError(f"Invalid GLB in {pack}: {member.filename}")
                source_hash = hashlib.sha256(data).hexdigest()
                data = self_contained_glb(data, archive, member.filename)
                (DEST / f"{name}.glb").write_bytes(data)
                found[name] = {"name": name, "pack": pack, "archivePath": member.filename,
                               "sourceSha256": source_hash, "sha256": hashlib.sha256(data).hexdigest()}
                used = True
        if used:
            sources.append(source)
            licenses = [m for m in archive.namelist() if Path(m).name.lower() in ("license.txt", "license.md")]
            for index, member in enumerate(licenses):
                (DEST / f"LICENSE-{pack}-{index + 1}.txt").write_bytes(archive.read(member))
        archive.close()
        missing = sorted(set(NEEDED) - found.keys())
        print(f"{pack}: {len(found)}/{len(NEEDED)} models found; missing: {', '.join(missing) or 'none'}", flush=True)
        if not missing:
            break
    if set(found) != set(NEEDED):
        raise RuntimeError("Missing models: " + ", ".join(sorted(set(NEEDED) - found.keys())))
    manifest_path.write_text(json.dumps({"schemaVersion": 2, "sources": sources, "files": list(found.values())}, indent=2) + "\n", encoding="utf-8")
    print(f"Installed and recorded {len(found)} CC0 models in {DEST}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Asset setup failed: {error}", file=sys.stderr)
        sys.exit(1)
