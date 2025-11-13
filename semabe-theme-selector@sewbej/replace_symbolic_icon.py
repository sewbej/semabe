#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import subprocess
from pathlib import Path
import shutil
import gi
from typing import List
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, GdkPixbuf, GLib, GObject

CONTROLS_FILES = [
    "window-close-symbolic.svg",
    "window-maximize-symbolic.svg",
    "window-minimize-symbolic.svg",
    "window-restore-symbolic.svg",
]

ARROW_FILES = [
    "adw-expander-arrow-symbolic.svg",
    "hdy-expander-arrow-symbolic.svg",
    "pan-down-symbolic.svg",
    "pan-end-symbolic-rtl.svg",
    "pan-end-symbolic.svg",
    "pan-start-symbolic-rtl.svg",
    "pan-start-symbolic.svg",
    "pan-up-symbolic.svg",
]

# only 4 shown in preview
ARROW_PREVIEW_FILES = [
    "pan-down-symbolic.svg",
    "pan-end-symbolic.svg",
    "pan-start-symbolic.svg",
    "pan-up-symbolic.svg",
]

BACKUP_SUFFIX = ".semabe.bak"


def zenity_error(msg):
    subprocess.run(["zenity", "--error", "--title=Semabe Theme Selector", "--text", msg])


def ensure_backup_once(target_file: Path):
    backup = Path(str(target_file) + BACKUP_SUFFIX)
    if backup.exists():
        return False
    try:
        shutil.copy2(target_file, backup)
        return True
    except Exception:
        return False


def replace_many(source_dir: Path, target_dir: Path, names: list[str]):
    replaced = 0
    skip_backup = "Adwaita/symbolic/ui" in str(target_dir)

    for name in names:
        src = source_dir / name
        if not src.exists():
            continue
        for dest in target_dir.rglob(name):
            if not dest.is_file():
                continue

            if not skip_backup:
                ensure_backup_once(dest)

            try:
                shutil.copy2(src, dest)
                replaced += 1
            except Exception:
                pass

    return replaced



def restore_from_backups(target_dir: Path, names: list[str]):
    restored = 0
    for name in names:
        for dest in target_dir.rglob(name):
            if not dest.is_file():
                continue
            backup = Path(str(dest) + BACKUP_SUFFIX)
            if backup.exists():
                try:
                    shutil.copy2(backup, dest)
                    backup.unlink(missing_ok=True)
                    restored += 1
                except Exception:
                    pass
    return restored


# ------------------------------
# GTK Animated Preview Dialog
# ------------------------------
class PreviewDialog(Gtk.Dialog):
    def __init__(self, title, header, icons_dir, filenames, target_dir, show_icons=True):
        super().__init__(title=title)
        self.set_default_size(420, 260)
        self.set_border_width(12)
        self.set_opacity(0.0)
        ok_label = "Restore" if "restore" in title.lower() else "Replace"
        self.add_button("         Cancel         ", Gtk.ResponseType.CANCEL)
        self.add_button(ok_label, Gtk.ResponseType.OK)


        label = Gtk.Label()
        extra = "" if "restore" in title.lower() else "\n\nwith the following icons:"
        label.set_markup(f"<b>{header}</b>\n\n<i>{GLib.markup_escape_text(target_dir.name)}</i>{extra}")

        label.set_justify(Gtk.Justification.CENTER)
        label.set_margin_bottom(10)
        box = self.get_content_area()
        box.pack_start(label, False, False, 0)

        if show_icons:
            grid = Gtk.FlowBox()
            grid.set_max_children_per_line(4)
            grid.set_selection_mode(Gtk.SelectionMode.NONE)
            grid.set_column_spacing(10)
            grid.set_row_spacing(10)

            for name in filenames:
                icon_path = icons_dir / name
                if not icon_path.exists():
                    continue
                try:
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(str(icon_path), 48, 48)
                    image = Gtk.Image.new_from_pixbuf(pixbuf)
                    grid.add(image)
                except Exception:
                    continue

            revealer = Gtk.Revealer()
            revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_UP)
            revealer.set_transition_duration(600)
            revealer.add(grid)

            scrolled = Gtk.ScrolledWindow()
            scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
            scrolled.add(revealer)

            box.pack_start(scrolled, True, True, 0)
            self.show_all()
            GLib.timeout_add(150, lambda: revealer.set_reveal_child(True) or False)
        else:
            self.show_all()

        self._fade_in()

    def _fade_in(self):
        duration = 300
        steps = 15
        step_time = duration // steps
        for i in range(steps + 1):
            GLib.timeout_add(i * step_time, lambda i=i: self.set_opacity(i / steps) or False)

    def _fade_out_and_close(self):
        duration = 300
        steps = 15
        step_time = duration // steps

        def fade_step(i=0):
            self.set_opacity(max(0, 1 - i / steps))
            if i >= steps:
                self.response(Gtk.ResponseType.NONE)
                self.destroy()
                return False
            GLib.timeout_add(step_time, lambda: fade_step(i + 1))
            return False

        fade_step()

    def run(self):
        response = super().run()
        if response != Gtk.ResponseType.NONE:
            GLib.idle_add(self._fade_out_and_close)
        return response



def preview_icons(title, header, icons_dir, filenames, target_dir, show_icons=True):
    win = PreviewDialog(title, header, icons_dir, filenames, target_dir, show_icons)
    response = win.run()
    win.destroy()
    return response == Gtk.ResponseType.OK


def ensure_local_copy(theme_name: str, icons_to_check: List[str], source_dir: Path) -> Path:
    home = Path.home()
    local_base = home / ".local/share/icons"
    local_dir = local_base / theme_name
    system_base = Path("/usr/share/icons")
    system_dir = system_base / theme_name

    exists_somewhere = local_dir.exists() or system_dir.exists()
    if not exists_somewhere:
        return None

    if local_dir.exists():
        has_local_svgs = any(any(local_dir.rglob(svg)) for svg in icons_to_check)
        if has_local_svgs:
            return local_dir
    else:
        local_dir.mkdir(parents=True, exist_ok=True)

    effective_system_dir = system_dir if system_dir.exists() else None
    if effective_system_dir:
        has_svgs_in_variant = any(any(effective_system_dir.rglob(svg)) for svg in icons_to_check)
        if not has_svgs_in_variant:
            main_name = None
            for prefix in ["Mint-Y", "Mint-X", "Mint-L", "Yaru", "Papirus"]:
                if theme_name.startswith(prefix):
                    main_name = prefix
                    break
            if main_name and (system_base / main_name).exists():
                effective_system_dir = system_base / main_name

    copied_any = False
    if effective_system_dir and effective_system_dir.exists():
        for svg in icons_to_check:
            for sys_file in effective_system_dir.rglob(svg):
                if not sys_file.is_file():
                    continue
                rel_path = sys_file.relative_to(effective_system_dir)
                local_target = local_dir / rel_path
                local_target.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(sys_file, local_target)
                    copied_any = True
                except Exception:
                    pass

        if copied_any:
            return local_dir

    adwaita_dir = local_base / "Adwaita/symbolic/ui"
    adwaita_dir.mkdir(parents=True, exist_ok=True)
    copied_any = False

    if source_dir and source_dir.exists():
        for svg in icons_to_check:
            src_file = source_dir / svg
            if not src_file.exists():
                continue
            local_target = adwaita_dir / src_file.name
            try:
                shutil.copy2(src_file, local_target)
                copied_any = True
            except Exception:
                pass

    return adwaita_dir if copied_any else None

    if not copied_any:
        print("⚙️ No matching SVGs in variant or base theme. Using Adwaita.")


# ------------------------------
# Main logic
# ------------------------------
def main():
    if len(sys.argv) < 4:
        zenity_error("Usage:\nreplace_symbolic_icon.py <mode> <style> <theme_dir>")
        sys.exit(1)

    mode, style, target = sys.argv[1], sys.argv[2], sys.argv[3]
    home = Path.home()
    target_dir = home / ".local/share/icons" / target

    # ---------------- TRYBY ----------------
    if mode == "controls":
        source_dir = home / f".themes/semabe/symbolic icons/close-minimize-maximize" / style
        all_names = CONTROLS_FILES
        preview_names = CONTROLS_FILES
        title = "Replace window control symbolic icons"
        header = "Replacing window control icons in theme:"
    elif mode == "arrows":
        source_dir = home / f".themes/semabe/symbolic icons/arrows" / style
        all_names = ARROW_FILES
        preview_names = ARROW_PREVIEW_FILES
        title = "Replace arrow symbolic icons"
        header = "Replacing arrow icons in theme:"
    elif mode == "restore":
        source_dir = None
        title = "Restore original symbolic icons"
        header = "Restoring all original symbolic icons in theme:"
    else:
        zenity_error(f"Unknown mode: {mode}")
        sys.exit(1)

    # ---------------- RESTORE ----------------
    if mode == "restore":
        confirmed = preview_icons(title, header, Path("."), [], target_dir, show_icons=False)
        if not confirmed:
            print("🟥 Operation canceled by user.")
            sys.exit(0)

        restored = 0

        if target_dir.exists():
            restored += restore_from_backups(target_dir, CONTROLS_FILES)
            restored += restore_from_backups(target_dir, ARROW_FILES)

        if restored == 0:
            adwaita_dir = Path.home() / ".local/share/icons/Adwaita/symbolic/ui"
            if adwaita_dir.exists():
                removed = 0
                for name in CONTROLS_FILES + ARROW_FILES:
                    for dest in adwaita_dir.rglob(name):
                        try:
                            dest.unlink(missing_ok=True)
                            removed += 1
                        except Exception:
                            pass
                if removed > 0:
                    print(f"🗑️ Removed {removed} files from {adwaita_dir}")
                    restored = removed

        if restored > 0:
            print(f"✅ Restored {restored} files.")
            sys.exit(0)
        else:
            zenity_error(
                "No backup files (.semabe.bak) found to restore,\n"
            )
            sys.exit(1)

    # ---------------- CONTROLS / ARROWS ----------------
    if not source_dir.exists():
        zenity_error(f"Source directory not found:\n{source_dir}")
        sys.exit(1)

    missing = [str(source_dir / n) for n in all_names if not (source_dir / n).exists()]
    if missing:
        print("⚠️ Some source SVG files are missing. Adwaita may be used.")

    confirmed = preview_icons(title, header, source_dir, preview_names, target_dir)
    if not confirmed:
        print("🟥 Operation canceled by user.")
        sys.exit(0)

    alt = ensure_local_copy(target, all_names, source_dir)
    if alt is None:
        zenity_error(
            f"Icon theme '{target}' not found locally or in system,\n"
            f"or contains no required SVG files."
        )
        sys.exit(1)
    target_dir = alt

    replaced = replace_many(source_dir, target_dir, all_names)
    if replaced > 0:
        print(f"✅ Replaced {replaced} files ({mode}, style='{style}').")
        sys.exit(0)
    else:
        zenity_error(f"No matching files found in:\n{target_dir}")
        sys.exit(1)


if __name__ == "__main__":
    main()

