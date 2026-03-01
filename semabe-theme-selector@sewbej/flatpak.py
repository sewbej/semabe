#!/usr/bin/env python3

import sys
from pathlib import Path


def apply_flatpak_theme(theme_path: str):
    home = Path.home()
    global_path = home / ".local/share/flatpak/overrides/global"

    if not global_path.exists():
        return

    try:
        lines = global_path.read_text(encoding="utf-8").splitlines()
    except Exception as e:
        raise RuntimeError(f"File read error: {global_path}: {e}")

    new_lines = []
    filesystems_set = False
    gtk_theme_set = False

    for line in lines:
        if line.startswith("filesystems="):
            new_lines.append("filesystems=~/.themes;/usr/share/themes")
            filesystems_set = True
        elif line.startswith("GTK_THEME="):
            new_lines.append(f"GTK_THEME={theme_path}")
            gtk_theme_set = True
        else:
            new_lines.append(line)

    if not filesystems_set:
        new_lines.append("filesystems=~/.themes;/usr/share/themes")

    if not gtk_theme_set:
        new_lines.append(f"GTK_THEME={theme_path}")

    try:
        global_path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
    except Exception as e:
        raise RuntimeError(f"The file cannot be saved.: {global_path}: {e}")


def main():
    if len(sys.argv) != 2:
        sys.exit(1)

    theme_path = sys.argv[1]

    try:
        apply_flatpak_theme(theme_path)
    except Exception as e:
        print(f"[flatpak.py] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

