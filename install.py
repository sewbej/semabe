#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Semabe theme installer for Linux Mint / Cinnamon

Functions:
- (if available) confirmation dialog via Zenity; without Zenity installation goes without questions
- Extract archives:
    semabe.tar.xz -> ~/.themes
    semabe-theme-selector@sewbej.tar.xz -> ~/.local/share/cinnamon/extensions
- During installation (if Zenity present) an "installing…" dialog is shown,
  which closes automatically after completion. Without Zenity no dialogs – silent mode.

Additionally:
- `--run-tests` runs tests in a temporary directory (without touching real $HOME)
- `-y/--yes` or env `SEMABE_ASSUME_YES=1` skip confirmation dialog
"""

import argparse
import json
import os
import sys
import tarfile
import subprocess
from pathlib import Path
from typing import Optional

# --- archives expected next to this script ---
THEME_ARCHIVE = "semabe.tar.xz"
EXT_ARCHIVE = "semabe-theme-selector@sewbej.tar.xz"

# --- target directories ---
THEMES_DIR = Path.home() / ".themes"
EXT_DIR = Path.home() / ".local" / "share" / "cinnamon" / "extensions"


def extract(archive: Path, dest: Path) -> None:
    """Extract a .tar.xz archive into dest directory."""
    dest.mkdir(parents=True, exist_ok=True)
    try:
        with tarfile.open(archive, "r:xz") as tar:
            tar.extractall(dest)
        print(f"✅ Extracted: {archive} -> {dest}")
    except FileNotFoundError:
        print(f"❌ File not found: {archive}")
        raise
    except tarfile.ReadError as e:
        print(f"❌ Cannot read archive {archive}: {e}")
        raise


def confirm_install(assume_yes: bool = False) -> bool:
    """Confirm installation.

    - If `assume_yes=True` or `SEMABE_ASSUME_YES=1` → accept.
    - If Zenity is available → show question dialog; result according to clicked button.
    - If Zenity is not available → install without asking (no terminal fallback).
    """
    if assume_yes or os.environ.get("SEMABE_ASSUME_YES") in {"1", "true", "TRUE", "yes", "y"}:
        return True

    zenity = _which("zenity")

    if zenity:
        result = subprocess.run(
            [
                zenity,
                "--question",
                "--width=450",
                "--title=Semabe theme selector installer",
                "--text=The installer will extract the files to the following directories:\n\n~/.themes\n~/.local/share/cinnamon/extensions",
                "--ok-label=CONTINUE",
                "--cancel-label=CANCEL",
            ]
        )
        return result.returncode == 0

    # no zenity → install without asking
    return True


def clean_existing(theme_base: Path, ext_base: Path) -> None:
    """Remove only the exact target directories requested by the user."""
    import shutil
    shutil.rmtree(theme_base / "semabe", ignore_errors=True)
    shutil.rmtree(ext_base / "semabe-theme-selector@sewbej", ignore_errors=True)


def _which(cmd: str) -> Optional[str]:
    """Lightweight wrapper around shutil.which."""
    from shutil import which
    return which(cmd)


def main() -> int:
    parser = argparse.ArgumentParser(description="Semabe theme selector installer")
    parser.add_argument("--run-tests", action="store_true", help="run tests and exit")
    parser.add_argument("-y", "--yes", action="store_true", help="do not ask for confirmation (non-interactive)")
    args = parser.parse_args()

    if args.run_tests:
        return run_tests()

    if not confirm_install(assume_yes=args.yes):
        print("Cancelled.")
        if _which("zenity"):
            subprocess.run([
                _which("zenity"),
                "--info",
                "--width=350",
                "--no-wrap",
                "--title=Semabe theme selector installer",
                "--text=Installation cancelled                                                                              "
            ])
        return 0

    cwd = Path(__file__).resolve().parent

    theme_archive_path = cwd / THEME_ARCHIVE
    ext_archive_path = cwd / EXT_ARCHIVE

    # missing files handling (single popup for one or both)
    missing = []
    if not theme_archive_path.exists():
        missing.append(str(theme_archive_path))
    if not ext_archive_path.exists():
        missing.append(str(ext_archive_path))

    if missing:
        msg = "Missing file(s):\n" + "\n".join(missing)
        print(f"❌ {msg}")
        if _which("zenity"):
            subprocess.run([
                _which("zenity"),
                "--error",
                "--width=450",
                "--no-wrap",
                "--title=Semabe theme selector installer",
                f"--text={msg}"
            ])
        return 1

    # Installing dialog (non-blocking); no CANCEL; if no Zenity – no dialog
    zenity = _which("zenity")
    installing = None
    if zenity:
        try:
            installing = subprocess.Popen([
                zenity,
                "--info",
                "--width=450",
                "--no-wrap",
                "--title=Semabe theme selector installer",
                "--text=\n\ninstalling...          ",
            ])
            # short pause so the window can render; does not block process
            try:
                installing.wait(timeout=0.1)
            except subprocess.TimeoutExpired:
                pass
        except Exception as e:
            print(f"ℹ Could not show installing dialog: {e}")
            installing = None

    # ensure target directories exist
    THEMES_DIR.mkdir(parents=True, exist_ok=True)
    EXT_DIR.mkdir(parents=True, exist_ok=True)

    # remove existing target directories before unpacking
    clean_existing(THEMES_DIR, EXT_DIR)

    # unpack
    extract(theme_archive_path, THEMES_DIR)
    extract(ext_archive_path, EXT_DIR)

    # close installing dialog (if present)
    if installing is not None:
        try:
            installing.terminate()
        except Exception:
            pass

    print("✔ Installation finished!")

    # final OK dialog (if Zenity available)
    if zenity:
        subprocess.run([
            zenity,
            "--info",
            "--width=450",
            "--no-wrap",
            "--title=Semabe theme selector installer",
            "--text=Installation finished successfully.\n\nNow enable the SEMABE THEME SELECTOR extension in your system settings.",
            "--ok-label=OK",
        ])

    return 0


# --- basic tests ---

def run_tests() -> int:
    """Basic tests for extract(), confirm_install(), and cleaning.
    These tests use temporary directories and do NOT modify real user files.
    Return 0 on success, non‑zero on failure.
    """
    import tempfile

    failures = 0

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        # 1) build a test tar.xz archive and check extraction
        src_dir = tmp_path / "src"
        src_dir.mkdir()
        (src_dir / "SemabeTest" / "dummy.txt").parent.mkdir(parents=True)
        (src_dir / "SemabeTest" / "dummy.txt").write_text("ok")
        theme_tar = tmp_path / "theme.tar.xz"
        with tarfile.open(theme_tar, "w:xz") as tar:
            tar.add(src_dir / "SemabeTest", arcname="SemabeTest")

        out_dir = tmp_path / "out_themes"
        extract(theme_tar, out_dir)
        if not (out_dir / "SemabeTest" / "dummy.txt").exists():
            print("❌ TEST: extract() – file not extracted")
            failures += 1

        # 4) confirm_install – should accept assume_yes=True without interaction
        if not confirm_install(assume_yes=True):
            print("❌ TEST: confirm_install(assume_yes=True) should return True")
            failures += 1

        # 5) clean_existing – removes only specified directories
        themes_root = tmp_path / "themes"
        exts_root = tmp_path / "exts"
        (themes_root / "semabe").mkdir(parents=True)
        (themes_root / "leave-me").mkdir()
        (exts_root / "semabe-theme-selector@sewbej").mkdir(parents=True)
        (exts_root / "other-ext").mkdir()
        clean_existing(themes_root, exts_root)
        if (themes_root / "semabe").exists() or (exts_root / "semabe-theme-selector@sewbej").exists():
            print("❌ TEST: clean_existing – directories were not removed")
            failures += 1
        if not (themes_root / "leave-me").exists() or not (exts_root / "other-ext").exists():
            print("❌ TEST: clean_existing – too many directories removed")
            failures += 1

    if failures:
        print(f"\n❌ TESTS: failures: {failures}")
        return 1

    print("\n✅ TESTS: all passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

